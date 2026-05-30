import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { EmbeddingsService } from './embeddings.service';

interface BusinessContext {
  activeShift: any;
  todayStats: any;
  accountingStats: any;
  settings: any;
  products: any[];
  clients: any[];
  suppliers: any[];
  branches: any[];
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AgentResponse {
  message: string;
  action: AgentAction | null;
}

interface AgentAction {
  type: 'register_expense' | 'register_income' | 'create_purchase_order' | 'close_shift' | 'info';
  label: string;
  data: Record<string, any>;
}

@Injectable()
export class AiAgentService {
  private readonly logger = new Logger('AiAgentService');
  private readonly openrouterApiKey: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddingsService: EmbeddingsService,
    private readonly config: ConfigService,
  ) {
    this.openrouterApiKey = this.config.get<string>('OPENROUTER_API_KEY') || '';
  }

  // ── Chat ─────────────────────────────────────────────────────────────────────

  async chat(userId: string, businessId: string, userMessage: string, sessionId: string = 'default'): Promise<AgentResponse> {
    // 1. Get recent conversation history BEFORE saving the new message (last 10 messages for context)
    const history = await this.getHistory(businessId, userId, sessionId, 10);

    // Ensure session exists (create if not found to avoid foreign key constraints)
    if (sessionId !== 'default') {
      const sessionExists = await this.prisma.aiChatSession.findUnique({ where: { id: sessionId } });
      if (!sessionExists) {
        await this.prisma.aiChatSession.create({
          data: { id: sessionId, businessId, userId, title: userMessage.substring(0, 30) + '...' }
        });
      }
    }

    // 2. Save user message to history DB
    await this.prisma.aiChatMessage.create({
      data: { businessId, userId, sessionId, role: 'user', content: userMessage }
    });

    // 3. Retrieve relevant knowledge chunks (RAG)
    const relevantChunks = await this.embeddingsService.searchRelevantChunks(userMessage, 3);

    // 4. Augment with real business data
    const context = await this.getBusinessContext(userId, businessId);

    // 5. Build system prompt
    const systemPrompt = this.buildSystemPrompt(relevantChunks, context);

    // 6. Call OpenRouter LLM
    const rawResponse = await this.callOpenRouter(systemPrompt, history, userMessage);

    // 7. Parse action if present
    const { message, action } = this.parseResponse(rawResponse);

    // 8. Save assistant response to history DB
    await this.prisma.aiChatMessage.create({
      data: { businessId, userId, sessionId, role: 'assistant', content: message, actionJson: action ? JSON.stringify(action) : null }
    });

    return { message, action };
  }

  // ── Sessions & History ───────────────────────────────────────────────────────

  async getSessions(businessId: string, userId: string) {
    return this.prisma.aiChatSession.findMany({
      where: { businessId, userId },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, title: true, createdAt: true, updatedAt: true }
    });
  }

  async createSession(businessId: string, userId: string, title?: string) {
    return this.prisma.aiChatSession.create({
      data: { businessId, userId, title: title || 'Nuevo Chat' }
    });
  }

  async getHistory(businessId: string, userId: string, sessionId: string = 'default', limit = 50): Promise<ChatMessage[]> {
    const messages = await this.prisma.aiChatMessage.findMany({
      where: { businessId, userId, sessionId },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });

    return messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));
  }

  async getHistoryWithMeta(businessId: string, userId: string, sessionId: string = 'default') {
    const messages = await this.prisma.aiChatMessage.findMany({
      where: { businessId, userId, sessionId },
      orderBy: { createdAt: 'asc' },
    });
    return messages.map(m => ({
      ...m,
      action: m.actionJson ? JSON.parse(m.actionJson) : null
    }));
  }

  async clearHistory(businessId: string, userId: string, sessionId: string = 'default') {
    return this.prisma.aiChatMessage.deleteMany({ where: { businessId, userId, sessionId } });
  }

  async confirmAction(userId: string, businessId: string, branchId: string, action: AgentAction, msgId?: string): Promise<{ success: boolean; message: string }> {
    try {
      switch (action.type) {
        case 'register_expense': {
          const [accountingEntry, expense] = await this.prisma.$transaction([
            this.prisma.accountingEntry.create({
              data: {
                description: action.data.description,
                type: 'EXPENSE',
                amount: action.data.amount,
                category: action.data.category || 'GASTO_OPERATIVO',
                userId,
                branchId,
              }
            }),
            this.prisma.expense.create({
              data: {
                amount: action.data.amount,
                category: action.data.category || 'GASTO_OPERATIVO',
                description: action.data.description,
                branchId,
                businessId,
                userId,
              }
            })
          ]);
          if (msgId) {
            await this.prisma.aiChatMessage.update({
              where: { id: msgId },
              data: { actionConfirmed: true }
            });
          }
          return { success: true, message: `✅ Egreso registrado: ${action.data.description} por $${action.data.amount}` };
        }
        case 'register_income': {
          await this.prisma.accountingEntry.create({
            data: {
              description: action.data.description,
              type: 'INCOME',
              amount: action.data.amount,
              category: action.data.category || 'INGRESO_OPERATIVO',
              userId,
              branchId,
            }
          });
          if (msgId) {
            await this.prisma.aiChatMessage.update({
              where: { id: msgId },
              data: { actionConfirmed: true }
            });
          }
          return { success: true, message: `✅ Ingreso registrado: ${action.data.description} por $${action.data.amount}` };
        }
        case 'create_purchase_order': {
          const { supplierId, items, notes } = action.data;
          
          let subtotal = 0;
          for (const item of items) {
            subtotal += item.cost * item.quantity;
          }

          const po = await this.prisma.purchaseOrder.create({
            data: {
              supplierId,
              branchId,
              status: 'DRAFT',
              notes,
              subtotal,
              total: subtotal, // without tax/discount for simplicity
              items: {
                create: items.map((i: any) => ({
                  variantId: i.variantId,
                  quantity: i.quantity,
                  cost: i.cost,
                  subtotal: i.cost * i.quantity,
                  total: i.cost * i.quantity
                }))
              }
            }
          });

          if (msgId) {
            await this.prisma.aiChatMessage.update({
              where: { id: msgId },
              data: { actionConfirmed: true }
            });
          }
          return { success: true, message: `✅ Orden de Compra guardada como Borrador.` };
        }
        case 'close_shift': {
          const activeShift = await (this.prisma as any).shift.findFirst({
            where: { userId, status: 'OPEN' },
            include: { sales: { include: { payments: true } } }
          });

          if (!activeShift) {
            return { success: false, message: 'No tienes un turno abierto actualmente.' };
          }

          let cashPayments = 0;
          for (const sale of activeShift.sales) {
            if (sale.status !== 'CANCELLED') {
              for (const p of sale.payments) {
                if (p.method === 'CASH') cashPayments += p.amount;
              }
            }
          }

          const expectedCash = activeShift.openingBalance + cashPayments;
          const reportedCash = action.data.reportedCash;
          const difference = reportedCash - expectedCash;

          await (this.prisma as any).shift.update({
            where: { id: activeShift.id },
            data: {
              status: 'CLOSED',
              closedAt: new Date(),
              closingBalance: reportedCash,
              expectedBalance: expectedCash,
              difference: difference
            }
          });

          if (msgId) {
            await this.prisma.aiChatMessage.update({
              where: { id: msgId },
              data: { actionConfirmed: true }
            });
          }
          return { success: true, message: `✅ Turno cerrado exitosamente. Diferencia: $${difference.toFixed(2)}` };
        }
        default:
          return { success: false, message: 'Acción no reconocida' };
      }
    } catch (err) {
      this.logger.error(`Action execution error: ${err.message}`);
      return { success: false, message: `Error al ejecutar acción: ${err.message}` };
    }
  }

  // ── Private helpers ───────────────────────────────────────────────────────────

  private async getBusinessContext(userId: string, businessId: string): Promise<BusinessContext> {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [activeShift, todaySales, accountingEntries, settings, products, clients, suppliers, branches] = await Promise.all([
      // Active shift for this user
      (this.prisma.shift as any).findFirst({
        where: { userId, status: 'OPEN' },
        include: { branch: true }
      }),
      // Today's sales summary
      this.prisma.sale.findMany({
        where: {
          businessId,
          createdAt: { gte: startOfDay },
          status: { not: 'CANCELLED' }
        },
        include: { payments: true }
      }),
      // Accounting totals
      this.prisma.accountingEntry.findMany({
        where: { branch: { businessId } },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      // Business settings
      this.prisma.setting.findFirst({ where: { businessId } }),
      // Products with variants and stock (limit 150)
      this.prisma.product.findMany({
        where: { businessId },
        include: { variants: true },
        take: 150
      }),
      // Clients (limit 50)
      this.prisma.client.findMany({
        where: { businessId },
        take: 50
      }),
      // Suppliers (limit 50)
      this.prisma.supplier.findMany({
        where: { businessId },
        take: 50
      }),
      // Branches (all)
      this.prisma.branch.findMany({
        where: { businessId }
      })
    ]);

    // Calculate today totals
    const todayTotal = todaySales.reduce((acc, s) => acc + s.total, 0);
    const todayByCurrency: Record<string, number> = {};
    todaySales.forEach(s => {
      s.payments.forEach((p: any) => {
        todayByCurrency[p.method] = (todayByCurrency[p.method] || 0) + p.amount;
      });
    });

    // Calculate accounting balance
    const accountingBalance = accountingEntries.reduce((acc, e) => {
      return acc + (e.type === 'INCOME' ? e.amount : -e.amount);
    }, 0);

    // Calculate expected shift balance
    let shiftExpected = null;
    if (activeShift) {
      const cashPayments = todaySales.reduce((acc, s) => {
        return acc + s.payments.filter((p: any) => p.method === 'CASH').reduce((sum: number, p: any) => sum + p.amount, 0);
      }, 0);
      shiftExpected = activeShift.openingBalance + cashPayments;
    }

    return {
      activeShift: activeShift ? {
        ...activeShift,
        expectedCash: shiftExpected,
        openedAtFormatted: new Date(activeShift.openedAt).toLocaleString('es-VE'),
      } : null,
      todayStats: {
        totalSales: todaySales.length,
        totalRevenue: todayTotal,
        byPaymentMethod: todayByCurrency,
      },
      accountingStats: {
        recentBalance: accountingBalance,
        recentEntries: accountingEntries.slice(0, 5).map(e => ({
          description: e.description,
          type: e.type,
          amount: e.amount,
        })),
      },
      settings: settings ? {
        currency: settings.currency,
        exchangeRate: settings.exchangeRate,
        businessName: settings.businessName,
      } : null,
      products: products.map(p => ({
        name: p.name,
        isWeighable: p.isWeighable,
        variants: p.variants.map((v: any) => ({
          id: v.id,
          name: v.name,
          price: v.price,
          cost: v.cost || 0,
          stock: v.stock,
          minStock: v.minStock
        }))
      })),
      clients: clients.map(c => ({ name: c.name, document: c.documentId, phone: c.phone })),
      suppliers: suppliers.map(s => ({ id: s.id, name: s.name, contact: s.contactName, status: s.status })),
      branches: branches.map(b => ({ name: b.name, location: b.location }))
    };
  }

  private buildSystemPrompt(
    chunks: { content: string; topic: string }[],
    context: BusinessContext,
  ): string {
    const knowledgeContext = chunks.length > 0
      ? `\n\n## Conocimiento relevante:\n${chunks.map(c => `[${c.topic}]: ${c.content}`).join('\n\n')}`
      : '';

    const shiftInfo = context.activeShift
      ? `\n## Turno activo:
- Abierto desde: ${context.activeShift.openedAtFormatted}
- Sucursal: ${context.activeShift.branch?.name || 'Principal'}
- Fondo inicial: $${context.activeShift.openingBalance?.toFixed(2)}
- Efectivo esperado en caja: $${context.activeShift.expectedCash?.toFixed(2)}`
      : `\n## Turno: No hay turno abierto actualmente.`;

    const todayInfo = `\n## Ventas de hoy:
- Número de ventas: ${context.todayStats.totalSales}
- Total facturado: $${context.todayStats.totalRevenue?.toFixed(2)}
- Por método de pago: ${JSON.stringify(context.todayStats.byPaymentMethod, null, 2)}`;

    const accountingInfo = `\n## Balance contable reciente:
- Balance: $${context.accountingStats.recentBalance?.toFixed(2)}
- Últimos movimientos: ${context.accountingStats.recentEntries?.map((e: any) => `${e.type === 'INCOME' ? '+' : '-'}$${e.amount} (${e.description})`).join(', ')}`;

    const inventoryInfo = context.products && context.products.length > 0 
      ? `\n## Inventario (Muestra):
${context.products.slice(0, 50).map(p => `- ${p.name}: ${p.variants.map((v: any) => `${v.name} (ID: ${v.id}, Stock: ${v.stock})`).join(' | ')}`).join('\n')}`
      : '\n## Inventario: Sin productos registrados.';

    const otherInfo = `\n## Sucursales:
${context.branches.map(b => `- ${b.name} (Ubicación: ${b.location || 'N/A'})`).join('\n')}
## Proveedores (Muestra):
${context.suppliers.slice(0, 10).map(s => `- ID: ${s.id} | ${s.name} (${s.status})`).join('\n')}
## Clientes (Muestra):
${context.clients.slice(0, 10).map(c => `- ${c.name}`).join('\n')}`;

    return `Eres "Syncro IA", el asistente financiero inteligente de Syncro POS, un sistema de punto de venta para negocios venezolanos.

Tu misión es:
1. Ayudar al usuario a entender y ejecutar el cuadre y cierre de caja paso a paso
2. Explicar cómo registrar ingresos y egresos en el módulo de Contabilidad
3. Responder preguntas sobre el estado financiero del negocio con datos reales
4. Enseñar conceptos de administración de caja de forma simple y clara

## Reglas de comportamiento:
- Responde SIEMPRE en español venezolano, amigable y profesional
- Usa números concretos de los datos reales del negocio (turno, ventas, balance)
- Si el usuario quiere registrar algo, genera una acción JSON estructurada para confirmación
- NUNCA uses emojis ni caracteres especiales (sin ✅ ❌ 💰 📊 ni similares) — tus respuestas deben ser texto limpio legible en voz alta
- No uses asteriscos ni markdown de formato; escribe en texto plano con puntos o guiones para listas
- Sé conciso pero completo
- Si el usuario te pide registrar algo (ej: "registra este gasto", "crea una orden", "cierra la caja"), genera la acción JSON pero NUNCA le digas "he registrado" o "he cerrado". Dile siempre algo como: "Claro, preparé la acción. Por favor haz clic en Confirmar en la tarjeta para proceder."
- Nunca ejecutes acciones sin confirmación explícita del usuario, la acción solo pre-llena los datos para que el usuario confirme.
- IMPORTANTE PARA CIERRE DE CAJA: Si el usuario te pide cerrar la caja o cuadrar turno, PRIMERO debes preguntarle: "¿Cuánto dinero en efectivo (billetes y monedas) contaste físicamente en la gaveta?". Solo cuando te diga el monto contado, generas la acción 'close_shift'.

## Formato de acciones (cuando el usuario quiere ejecutar algo):
Si detectas que el usuario te está pidiendo registrar un egreso o gasto (por ejemplo: "compré una coca cola por 5", "pagué 20 de luz", "saqué de la caja chica para X"), INCLUYE al FINAL de tu respuesta EXACTAMENTE este bloque JSON, adaptando los datos:
\`\`\`action
{
  "type": "register_expense",
  "label": "Registrar egreso: Coca Cola - $5",
  "data": {
    "description": "Coca Cola",
    "amount": 5,
    "category": "GASTO_OPERATIVO"
  }
}
\`\`\`

Si el usuario quiere registrar un ingreso extraordinario que no sea venta (ej: "un inversor inyectó 100", "metí 50 extra a la caja"):
\`\`\`action
{
  "type": "register_income",
  "label": "Registrar ingreso: Inyección capital - $100",
  "data": {
    "description": "Inyección capital",
    "amount": 100,
    "category": "INGRESO_OPERATIVO"
  }
}
\`\`\`

Si el usuario quiere crear una Orden de Compra para pedir mercancía a un proveedor (ej: "pídele a Polar 10 cervezas Solera y 5 Polar Pilsen"):
Debes buscar los UUIDs (ID) exactos en la lista de Proveedores e Inventario que se te proporciona. NO inventes IDs.
\`\`\`action
{
  "type": "create_purchase_order",
  "label": "Orden de Compra: Empresas Polar (15 items)",
  "data": {
    "supplierId": "uuid-del-proveedor",
    "notes": "Pedido automático vía IA",
    "items": [
      { "variantId": "uuid-de-la-variante-solera", "quantity": 10, "cost": 0 },
      { "variantId": "uuid-de-la-variante-pilsen", "quantity": 5, "cost": 0 }
    ]
  }
}
\`\`\`

Si el usuario te dice cuánto efectivo contó para CERRAR LA CAJA (ej: "conté 150 dólares, cierra la caja"):
Es obligatorio que en la acción incluyas el 'expectedCash' que tienes en tu contexto actual para que la interfaz lo pueda comparar.
\`\`\`action
{
  "type": "close_shift",
  "label": "Cierre de Caja",
  "data": {
    "reportedCash": 150,
    "expectedCash": 145.50
  }
}
\`\`\`

Tipos de acción disponibles: "register_expense", "register_income", "create_purchase_order", "close_shift"
Categorías de egreso: GASTO_OPERATIVO, COMPRA_INVENTARIO, PAGO_NOMINA, OTRO_EGRESO
Categorías de ingreso: INGRESO_OPERATIVO, OTRO_INGRESO
${knowledgeContext}
${shiftInfo}
${todayInfo}
${accountingInfo}
${inventoryInfo}
${otherInfo}`;
  }

  private async callOpenRouter(systemPrompt: string, history: ChatMessage[], userMessage: string): Promise<string> {
    const messages = [
      ...history.slice(-8).map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: userMessage }
    ];

    // Models in priority order — first available is used
    const models = [
      'openai/gpt-4o-mini',
      'google/gemini-2.5-flash',
      'meta-llama/llama-3.3-70b-instruct:free',
      'openrouter/free',
    ];

    for (const model of models) {
      try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.openrouterApiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://syncropos.com',
            'X-Title': 'Syncro POS AI Agent',
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: systemPrompt },
              ...messages,
            ],
            max_tokens: 800,
            temperature: 0.4,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          this.logger.warn(`Model ${model} failed: ${response.status} — ${errorText}`);
          continue; // try next model
        }

        const data = await response.json();
        const content = data?.choices?.[0]?.message?.content;
        if (content) {
          this.logger.log(`Response from model: ${model}`);
          return content;
        }
      } catch (err) {
        this.logger.warn(`Model ${model} error: ${err.message}`);
        continue; // try next model
      }
    }

    this.logger.error('All OpenRouter models failed');
    return '⚠️ El asistente no está disponible en este momento. Por favor intenta de nuevo en unos segundos.';
  }

  private parseResponse(rawResponse: string): { message: string; action: AgentAction | null } {
    const actionMatch = rawResponse.match(/```action\s*([\s\S]*?)\s*```/);

    if (!actionMatch) {
      return { message: rawResponse, action: null };
    }

    // Remove the action block from the visible message
    const message = rawResponse.replace(/```action\s*[\s\S]*?\s*```/g, '').trim();

    try {
      const action = JSON.parse(actionMatch[1]) as AgentAction;
      return { message, action };
    } catch (err) {
      this.logger.warn(`Failed to parse action JSON: ${err.message}`);
      return { message, action: null };
    }
  }

  /**
   * Generates audio from text using ElevenLabs Text-to-Speech API.
   */
  async textToSpeech(text: string): Promise<Buffer> {
    const apiKey = this.config.get<string>('ELEVENLABS_API_KEY') || process.env.ELEVENLABS_API_KEY || '';
    if (!apiKey) {
      throw new Error('ElevenLabs API key is not configured in backend .env file');
    }

    // Clean text: strip emojis, markdown symbols, and code blocks so the TTS doesn't read them
    const cleanedText = text
      .replace(/[\u{1F300}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F1E6}-\u{1F1FF}\u{1F191}-\u{1F251}\u{1F004}\u{1F0CF}\u{1F170}-\u{1F171}\u{1F17E}-\u{1F17F}\u{1F18E}\u{3030}\u{2B50}\u{2B55}\u{2934}-\u{2935}\u{2B05}-\u{2B07}\u{2b1b}\u{2b1c}\u{3297}\u{3299}\u{303d}\u{00a9}\u{00ae}\u{2122}\u{23f3}\u{24c2}\u{23e9}-\u{23ef}\u{25b6}\u{23f8}-\u{23fa}]/gu, '')
      .replace(/\*+/g, '') // remove asterisks
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // remove links, keep text
      .replace(/```action[\s\S]*?```/g, '') // remove action blocks
      .replace(/```[\s\S]*?```/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Voice: Adam (pNInz6obpgDQGcFmaJgB) - Deep, warm, extremely natural conversational voice
    const voiceId = 'pNInz6obpgDQGcFmaJgB';
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: cleanedText || 'Hola',
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`ElevenLabs TTS failed: ${response.status} - ${errText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}
