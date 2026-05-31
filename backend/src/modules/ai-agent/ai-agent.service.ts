import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { EmbeddingsService } from './embeddings.service';

interface BusinessContext {
  activeShift: any;
  recentClosedShifts: any[];
  todayStats: any;
  recentSales: any[];
  accountingStats: any;
  settings: any;
  products: any[];
  clients: any[];
  suppliers: any[];
  branches: any[];
  lowStockStats?: {
    totalLowStock: number;
    criticalItems: { productName: string; variantName: string; stock: number; minStock: number }[];
  };
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AgentResponse {
  id?: string;
  message: string;
  action: AgentAction | null;
}

interface AgentAction {
  type: 'register_expense' | 'register_income' | 'create_purchase_order' | 'close_shift' | 'info';
  label: string;
  data: Record<string, any>;
}

import { NotificationsService } from '../notifications/notifications.service';
import { PushService } from '../chat/push.service';

@Injectable()
export class AiAgentService {
  private readonly logger = new Logger('AiAgentService');
  private readonly openrouterApiKey: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddingsService: EmbeddingsService,
    private readonly config: ConfigService,
    private readonly notificationsService: NotificationsService,
    private readonly pushService: PushService,
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
    const savedMessage = await this.prisma.aiChatMessage.create({
      data: { businessId, userId, sessionId, role: 'assistant', content: message, actionJson: action ? JSON.stringify(action) : null }
    });

    // Send push notification about AI response
    this.pushService.sendToUser(userId, {
      title: 'Syncro IA ha respondido',
      body: message.length > 120 ? (message.substring(0, 117) + '...') : message,
      url: '/dashboard/soporte'
    }).catch(err => this.logger.warn(`Failed to send push notification: ${err.message}`));

    return { id: savedMessage.id, message, action };
  }

  // ── Chat Stream ──────────────────────────────────────────────────────────────

  async chatStream(
    userId: string,
    businessId: string,
    userMessage: string,
    sessionId: string = 'default',
    onChunk: (chunk: string) => void,
    onFinish: (result: AgentResponse) => void
  ): Promise<void> {
    try {
      // 1. Get recent history
      const history = await this.getHistory(businessId, userId, sessionId, 10);

      // Ensure session exists
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

      // 6. Call OpenRouter with streaming
      const rawResponse = await this.callOpenRouterStream(systemPrompt, history, userMessage, onChunk);

      // 7. Parse action if present
      const { message, action } = this.parseResponse(rawResponse);

      // 8. Save assistant response to history DB
      const savedMessage = await this.prisma.aiChatMessage.create({
        data: {
          businessId,
          userId,
          sessionId,
          role: 'assistant',
          content: message,
          actionJson: action ? JSON.stringify(action) : null
        }
      });

      // 9. Callback on completion
      onFinish({ id: savedMessage.id, message, action });

      // Send push notification about AI response
      this.pushService.sendToUser(userId, {
        title: 'Syncro IA ha respondido',
        body: message.length > 120 ? (message.substring(0, 117) + '...') : message,
        url: '/dashboard/soporte'
      }).catch(err => this.logger.warn(`Failed to send push notification in stream: ${err.message}`));
    } catch (error) {
      this.logger.error(`Error in chatStream: ${error.message}`);
      onChunk('⚠️ Ocurrió un error al procesar tu solicitud.');
      onFinish({ message: '⚠️ Ocurrió un error al procesar tu solicitud.', action: null });
    }
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

    const messageIds = messages.map(m => m.id);
    const feedbacks = await this.prisma.aiFeedback.findMany({
      where: { messageId: { in: messageIds } }
    });

    const feedbackMap = new Map(feedbacks.map(f => [f.messageId, f]));

    return messages.map(m => {
      const fb = feedbackMap.get(m.id);
      return {
        ...m,
        action: m.actionJson ? JSON.parse(m.actionJson) : null,
        rating: fb ? fb.rating : null,
        comment: fb ? fb.comment : null,
      };
    });
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
          if (msgId && !msgId.startsWith('temp-')) {
            try {
              const dbMsg = await this.prisma.aiChatMessage.findUnique({ where: { id: msgId } });
              if (dbMsg) {
                const parsedAction = dbMsg.actionJson ? JSON.parse(dbMsg.actionJson) : action;
                parsedAction.createdIds = {
                  accountingEntryId: accountingEntry.id,
                  expenseId: expense.id
                };
                await this.prisma.aiChatMessage.update({
                  where: { id: msgId },
                  data: { 
                    actionConfirmed: true,
                    actionJson: JSON.stringify(parsedAction)
                  }
                });
              }
            } catch (e) {
              this.logger.warn(`Failed to update actionJson on confirm for msg ${msgId}: ${e.message}`);
            }
          }
          return { success: true, message: `✅ Egreso registrado: ${action.data.description} por $${action.data.amount}` };
        }
        case 'register_income': {
          const accountingEntry = await this.prisma.accountingEntry.create({
            data: {
              description: action.data.description,
              type: 'INCOME',
              amount: action.data.amount,
              category: action.data.category || 'INGRESO_OPERATIVO',
              userId,
              branchId,
            }
          });
          if (msgId && !msgId.startsWith('temp-')) {
            try {
              const dbMsg = await this.prisma.aiChatMessage.findUnique({ where: { id: msgId } });
              if (dbMsg) {
                const parsedAction = dbMsg.actionJson ? JSON.parse(dbMsg.actionJson) : action;
                parsedAction.createdIds = {
                  accountingEntryId: accountingEntry.id
                };
                await this.prisma.aiChatMessage.update({
                  where: { id: msgId },
                  data: { 
                    actionConfirmed: true,
                    actionJson: JSON.stringify(parsedAction)
                  }
                });
              }
            } catch (e) {
              this.logger.warn(`Failed to update actionJson on confirm for msg ${msgId}: ${e.message}`);
            }
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

          if (msgId && !msgId.startsWith('temp-')) {
            try {
              const msgExists = await this.prisma.aiChatMessage.findUnique({ where: { id: msgId } });
              if (msgExists) {
                await this.prisma.aiChatMessage.update({
                  where: { id: msgId },
                  data: { actionConfirmed: true }
                });
              }
            } catch (e) {
              this.logger.warn(`Failed to update actionConfirmed for message ${msgId}: ${e.message}`);
            }
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

  private async getBusinessContext(userId: string, businessId: string): Promise<BusinessContext> {
    const now = new Date();
    // VET (Venezuela Time) is GMT-4. Adjust start of day to GMT-4.
    const localTime = new Date(now.getTime() - 4 * 60 * 60 * 1000);
    const startOfDay = new Date(Date.UTC(
      localTime.getUTCFullYear(),
      localTime.getUTCMonth(),
      localTime.getUTCDate(),
      4, // 04:00:00 UTC = 00:00:00 VET (GMT-4)
      0,
      0,
      0
    ));

    // 1. Fetch active shift first to determine branch
    const activeShift = await (this.prisma.shift as any).findFirst({
      where: { userId, status: 'OPEN' },
      include: { branch: true }
    });

    const branchIdToUse = activeShift?.branchId;
    let targetBranchId = branchIdToUse;
    if (!targetBranchId) {
      const firstBranch = await this.prisma.branch.findFirst({
        where: { businessId }
      });
      targetBranchId = firstBranch?.id;
    }

    const [recentClosedShifts, todaySales, recentSales, accountingEntries, settings, products, clients, suppliers, branches, allBranchVariants] = await Promise.all([
      // Recent closed shifts
      this.prisma.shift.findMany({
        where: { branch: { businessId }, status: 'CLOSED' },
        orderBy: { closedAt: 'desc' },
        take: 10,
        include: { branch: true, user: true }
      }),
      // Today's sales summary
      this.prisma.sale.findMany({
        where: {
          branch: { businessId },
          createdAt: { gte: startOfDay },
          status: { not: 'CANCELLED' }
        },
        include: { payments: true }
      }),
      // Recent sales summary (last 30) for history audits
      this.prisma.sale.findMany({
        where: {
          branch: { businessId },
          status: { not: 'CANCELLED' }
        },
        orderBy: { createdAt: 'desc' },
        take: 30,
        include: { payments: true, user: true, client: true }
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
        include: {
          variants: {
            include: {
              inventory: targetBranchId ? {
                where: { branchId: targetBranchId }
              } : true
            }
          }
        },
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
      }),
      // All variants in business with their inventories to calculate complete low stock list
      this.prisma.productVariant.findMany({
        where: {
          product: { businessId }
        },
        include: {
          product: true,
          inventory: targetBranchId ? {
            where: { branchId: targetBranchId }
          } : true
        }
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

    // Process all variants to compute complete low stock list
    const lowStockAlerts: { productName: string; variantName: string; stock: number; minStock: number }[] = [];
    allBranchVariants.forEach((v: any) => {
      let vStock = v.stock;
      if (targetBranchId && v.inventory) {
        const branchInventory = v.inventory.find((inv: any) => inv.branchId === targetBranchId);
        if (branchInventory !== undefined) {
          vStock = branchInventory.quantity;
        }
      }
      const isLow = vStock < v.minStock;
      const isCritical = vStock === 0;
      if (isLow || isCritical) {
        lowStockAlerts.push({
          productName: v.product.name,
          variantName: v.name,
          stock: vStock,
          minStock: v.minStock
        });
      }
    });

    // Sort by severity (lowest stock first)
    lowStockAlerts.sort((a, b) => a.stock - b.stock);

    // Limit to top 20 most critical for system prompt to avoid token overflow
    const criticalItems = lowStockAlerts.slice(0, 20);

    return {
      activeShift: activeShift ? {
        ...activeShift,
        expectedCash: shiftExpected,
        openedAtFormatted: new Date(activeShift.openedAt).toLocaleString('es-VE'),
      } : null,
      recentClosedShifts: recentClosedShifts.map(s => ({
        id: s.id,
        openedAt: s.openedAt,
        closedAt: s.closedAt,
        openingBalance: s.openingBalance,
        expectedBalance: s.expectedBalance,
        closingBalance: s.closingBalance,
        difference: s.difference,
        notes: s.notes,
        userName: s.user?.name || 'Usuario',
        branchName: s.branch?.name || 'Principal'
      })),
      todayStats: {
        totalSales: todaySales.length,
        totalRevenue: todayTotal,
        byPaymentMethod: todayByCurrency,
      },
      recentSales: recentSales.map(s => ({
        id: s.id,
        createdAt: s.createdAt,
        total: s.total,
        userName: s.user?.name || 'Usuario',
        clientName: s.client?.name || 'Cliente Genérico',
        payments: s.payments.map((p: any) => ({
          method: p.method,
          amount: p.amount
        }))
      })),
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
        variants: p.variants.map((v: any) => {
          let vStock = v.stock;
          if (targetBranchId && v.inventory) {
            const branchInventory = v.inventory.find((inv: any) => inv.branchId === targetBranchId);
            if (branchInventory !== undefined) {
              vStock = branchInventory.quantity;
            }
          }
          return {
            id: v.id,
            name: v.name,
            price: v.price,
            cost: v.cost || 0,
            stock: vStock,
            minStock: v.minStock
          };
        })
      })),
      clients: clients.map(c => ({ name: c.name, document: c.documentId, phone: c.phone })),
      suppliers: suppliers.map(s => ({ id: s.id, name: s.name, contact: s.contactName, status: s.status })),
      branches: branches.map(b => ({ name: b.name, location: b.location })),
      lowStockStats: {
        totalLowStock: lowStockAlerts.length,
        criticalItems
      }
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

    const closedShiftsInfo = context.recentClosedShifts && context.recentClosedShifts.length > 0
      ? `\n## Historial de cierres de caja recientes (Turnos cerrados):
${context.recentClosedShifts.map(s => `- Turno de ${s.userName} en ${s.branchName} | Abierto: ${new Date(s.openedAt).toLocaleString('es-VE')} | Cerrado: ${s.closedAt ? new Date(s.closedAt).toLocaleString('es-VE') : 'N/A'} | Fondo Inicial: $${s.openingBalance?.toFixed(2)} | Esperado: $${s.expectedBalance?.toFixed(2)} | Entregado: $${s.closingBalance?.toFixed(2)} | Diferencia: $${s.difference?.toFixed(2)} | Notas: ${s.notes || 'Sin observaciones'}`).join('\n')}`
      : '\n## Historial de cierres de caja: No hay registros de cierres anteriores.';

    const todayInfo = `\n## Ventas de hoy:
- Número de ventas: ${context.todayStats.totalSales}
- Total facturado: $${context.todayStats.totalRevenue?.toFixed(2)}
- Por método de pago: ${JSON.stringify(context.todayStats.byPaymentMethod, null, 2)}`;

    const recentSalesInfo = context.recentSales && context.recentSales.length > 0
      ? `\n## Historial de ventas anteriores (últimas 30):
${context.recentSales.map(s => `- Venta | Fecha: ${new Date(s.createdAt).toLocaleString('es-VE')} | Cajero: ${s.userName} | Cliente: ${s.clientName} | Total: $${s.total?.toFixed(2)} | Métodos: ${s.payments.map((p: any) => `${p.method} ($${p.amount?.toFixed(2)})`).join(', ')}`).join('\n')}`
      : '\n## Historial de ventas anteriores: No hay registros de ventas anteriores.';

    const accountingInfo = `\n## Balance contable reciente:
- Balance: $${context.accountingStats.recentBalance?.toFixed(2)}
- Últimos movimientos: ${context.accountingStats.recentEntries?.map((e: any) => `${e.type === 'INCOME' ? '+' : '-'}$${e.amount} (${e.description})`).join(', ')}`;

    const inventoryInfo = context.products && context.products.length > 0 
      ? `\n## Inventario (Muestra):
${context.products.slice(0, 50).map(p => `- ${p.name}: ${p.variants.map((v: any) => `${v.name} (ID: ${v.id}, Stock: ${v.stock})`).join(' | ')}`).join('\n')}`
      : '\n## Inventario: Sin productos registrados.';

    const lowStockInfo = context.lowStockStats && context.lowStockStats.totalLowStock > 0
      ? `\n## Alertas de Bajo Stock (Reabastecimiento):
- Total de productos con bajo stock en la sucursal actual: ${context.lowStockStats.totalLowStock} productos.
- Los productos con bajo stock más críticos (prioridad alta para compras) son:
${context.lowStockStats.criticalItems.map(item => `- ${item.productName}${item.variantName !== 'Default' && item.variantName !== 'Default variant' && item.variantName !== '' ? ` (${item.variantName})` : ''}: Stock actual: ${item.stock} | Stock mínimo requerido: ${item.minStock}`).join('\n')}`
      : '\n## Alertas de Bajo Stock: Todos los productos de la sucursal superan el stock mínimo.';

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
- IMPORTANTE PARA CIERRE DE CAJA: Si el usuario te pide cerrar la caja o cuadrar turno, primero verifica si ya te proporcionó el monto de efectivo que contó físicamente en la gaveta en su mensaje anterior (por ejemplo, si te dijo "tengo 0", "no hay efectivo", o especificó un valor numérico exacto). Si NO te ha dado el monto físico, pregúntale: "¿Cuánto dinero en efectivo (billetes y monedas) contaste físicamente en la gaveta?". Si SÍ te dio el monto, NO le vuelvas a preguntar; procede inmediatamente a preparar la acción 'close_shift' utilizando ese valor como dinero reportado.

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
${closedShiftsInfo}
${todayInfo}
${recentSalesInfo}
${accountingInfo}
${inventoryInfo}
${lowStockInfo}
${otherInfo}`;
  }

  private async callOpenRouterStream(
    systemPrompt: string,
    history: ChatMessage[],
    userMessage: string,
    onChunk: (chunk: string) => void
  ): Promise<string> {
    const messages = [
      ...history.slice(-8).map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: userMessage }
    ];

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
            stream: true,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          this.logger.warn(`Model ${model} failed stream call: ${response.status} — ${errorText}`);
          continue; // try next model
        }

        if (!response.body) {
          this.logger.warn(`Model ${model} failed: Response body is null`);
          continue;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let fullResponseText = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep the last incomplete line in the buffer

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            if (trimmed === 'data: [DONE]') continue;
            if (trimmed.startsWith('data: ')) {
              try {
                const json = JSON.parse(trimmed.slice(6));
                const text = json.choices?.[0]?.delta?.content || '';
                if (text) {
                  fullResponseText += text;
                  onChunk(text);
                }
              } catch (e) {
                // Ignore parse errors for incomplete lines
              }
            }
          }
        }

        // Process remaining buffer
        if (buffer && buffer.startsWith('data: ')) {
          try {
            const json = JSON.parse(buffer.slice(6));
            const text = json.choices?.[0]?.delta?.content || '';
            if (text) {
              fullResponseText += text;
              onChunk(text);
            }
          } catch (e) {}
        }

        return fullResponseText;
      } catch (err) {
        this.logger.warn(`Model ${model} stream error: ${err.message}`);
        continue; // try next model
      }
    }

    this.logger.error('All OpenRouter models failed streaming');
    const errorMessage = '⚠️ El asistente no está disponible en este momento. Por favor intenta de nuevo en unos segundos.';
    onChunk(errorMessage);
    return errorMessage;
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

  async submitFeedback(
    businessId: string | null,
    data: { messageId?: string; prompt: string; response: string; rating: string; comment?: string },
  ) {
    if (data.messageId) {
      const existing = await this.prisma.aiFeedback.findFirst({
        where: { messageId: data.messageId },
      });
      if (existing) {
        return this.prisma.aiFeedback.update({
          where: { id: existing.id },
          data: {
            rating: data.rating,
            comment: data.comment || null,
            prompt: data.prompt,
            response: data.response,
          },
        });
      }
    }

    return this.prisma.aiFeedback.create({
      data: {
        messageId: data.messageId || null,
        prompt: data.prompt,
        response: data.response,
        rating: data.rating,
        comment: data.comment || null,
        businessId: businessId || null,
      },
    });
  }

  async getAllFeedback() {
    return this.prisma.aiFeedback.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        business: {
          select: {
            name: true,
          },
        },
      },
    });
  }

  async undoAction(userId: string, businessId: string, msgId: string) {
    if (!msgId || msgId.startsWith('temp-')) {
      return { success: false, message: 'ID de mensaje no válido.' };
    }

    const dbMsg = await this.prisma.aiChatMessage.findUnique({ where: { id: msgId } });
    if (!dbMsg) {
      return { success: false, message: 'No se encontró el registro de la acción en el chat.' };
    }

    if (!dbMsg.actionJson) {
      return { success: false, message: 'Este mensaje no tiene una acción asociada.' };
    }

    const action = JSON.parse(dbMsg.actionJson);
    if (!action.createdIds) {
      return { success: false, message: 'La acción no ha sido confirmada o no se pueden revertir sus cambios.' };
    }

    const { accountingEntryId, expenseId } = action.createdIds;

    try {
      if (action.type === 'register_expense') {
        const operations = [];
        if (accountingEntryId) {
          operations.push(this.prisma.accountingEntry.delete({ where: { id: accountingEntryId } }));
        }
        if (expenseId) {
          operations.push(this.prisma.expense.delete({ where: { id: expenseId } }));
        }
        if (operations.length > 0) {
          await this.prisma.$transaction(operations);
        }
      } else if (action.type === 'register_income') {
        if (accountingEntryId) {
          await this.prisma.accountingEntry.delete({ where: { id: accountingEntryId } });
        }
      } else {
        return { success: false, message: 'Solo se pueden deshacer los registros de ingresos y egresos.' };
      }

      // Reset action state to unconfirmed and clean createdIds
      delete action.createdIds;
      await this.prisma.aiChatMessage.update({
        where: { id: msgId },
        data: { 
          actionConfirmed: false,
          actionJson: JSON.stringify(action)
        }
      });

      return { success: true, message: 'Acción deshecha correctamente de tu contabilidad.' };
    } catch (e) {
      this.logger.error(`Error undoing action: ${e.message}`);
      return { success: false, message: `Error al deshacer la acción: ${e.message}` };
    }
  }

  async dismissAction(msgId: string) {
    if (!msgId || msgId.startsWith('temp-')) {
      return { success: false, message: 'ID de mensaje no válido.' };
    }

    try {
      const msgExists = await this.prisma.aiChatMessage.findUnique({ where: { id: msgId } });
      if (msgExists) {
        await this.prisma.aiChatMessage.update({
          where: { id: msgId },
          data: { actionConfirmed: null }
        });
        return { success: true, message: 'Acción sugerida cancelada en base de datos.' };
      }
      return { success: false, message: 'No se encontró el registro del mensaje.' };
    } catch (e) {
      this.logger.error(`Error dismissing action: ${e.message}`);
      return { success: false, message: `Error: ${e.message}` };
    }
  }

  // ── Proactive AI Auditing & Alerts ───────────────────────────────────────────

  async runProactiveAudit(businessId: string): Promise<{ success: boolean; alertsFound: number }> {
    try {
      this.logger.log(`Running proactive AI business audit for business ${businessId}...`);
      let alertsCount = 0;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // 1. Stock Crítico Check
      const inventories = await this.prisma.inventory.findMany({
        where: {
          branch: { businessId },
        },
        include: {
          variant: {
            include: { product: true }
          },
          branch: true
        }
      });

      const lowStockItems = inventories.filter(inv => inv.quantity <= inv.variant.minStock);
      for (const item of lowStockItems) {
        const title = `⚠️ Stock Crítico: ${item.variant.product.name}`;
        const msg = `El producto "${item.variant.product.name} (${item.variant.name})" en la sucursal ${item.branch.name} tiene un stock crítico de ${item.quantity} unidades (mínimo requerido: ${item.variant.minStock}).`;

        const exists = await this.prisma.notification.findFirst({
          where: {
            branchId: item.branchId,
            title,
            createdAt: { gte: today }
          }
        });

        if (!exists) {
          await this.notificationsService.create({
            type: 'STOCK_ALERT',
            title,
            message: msg,
            branchId: item.branchId
          });
          alertsCount++;
        }
      }

      const sixteenHoursAgo = new Date(Date.now() - 16 * 60 * 60 * 1000);
      const longOpenShifts = await this.prisma.shift.findMany({
        where: {
          status: 'OPEN',
          openedAt: { lte: sixteenHoursAgo },
          branch: { businessId }
        },
        include: {
          branch: true,
          user: true
        }
      });

      for (const shift of longOpenShifts) {
        const title = `⏳ Turno de Caja Prolongado`;
        const msg = `La caja abierta por ${shift.user.name} en la sucursal ${shift.branch.name} lleva más de 16 horas activa sin cuadre. Por favor recuerda realizar el cierre de caja.`;

        const exists = await this.prisma.notification.findFirst({
          where: {
            branchId: shift.branchId,
            title,
            createdAt: { gte: today }
          }
        });

        if (!exists) {
          await this.notificationsService.create({
            type: 'SHIFT_ALERT',
            title,
            message: msg,
            branchId: shift.branchId
          });
          alertsCount++;
        }
      }

      // 3. Anomalía de Gastos Check (today's expenses > 1.5x daily avg and > $100)
      const todayExpenses = await this.prisma.expense.aggregate({
        where: {
          businessId,
          createdAt: { gte: today }
        },
        _sum: { amount: true }
      });
      const todaySum = todayExpenses._sum.amount || 0;

      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      sevenDaysAgo.setHours(0, 0, 0, 0);
      const pastExpenses = await this.prisma.expense.findMany({
        where: {
          businessId,
          createdAt: {
            gte: sevenDaysAgo,
            lt: today
          }
        },
        select: { amount: true }
      });

      const pastSum = pastExpenses.reduce((sum, exp) => sum + exp.amount, 0);
      const dailyAvg = pastSum > 0 ? (pastSum / 7) : 20; // default benchmark fallback

      if (todaySum > dailyAvg * 1.5 && todaySum > 100) {
        const title = `💸 Alerta de Gastos Inusuales`;
        const msg = `Se ha registrado un incremento inusual en los egresos de hoy ($${todaySum.toFixed(2)}), superando por más de 50% el promedio diario habitual ($${dailyAvg.toFixed(2)}).`;

        const exists = await this.prisma.notification.findFirst({
          where: {
            title,
            createdAt: { gte: today }
          }
        });

        if (!exists) {
          const firstBranch = await this.prisma.branch.findFirst({ where: { businessId } });
          if (firstBranch) {
            await this.notificationsService.create({
              type: 'EXPENSE_ALERT',
              title,
              message: msg,
              branchId: firstBranch.id
            });
            alertsCount++;
          }
        }
      }

      this.logger.log(`Proactive AI business audit completed successfully. Alerts pushed: ${alertsCount}`);
      return { success: true, alertsFound: alertsCount };
    } catch (e) {
      this.logger.error(`Error in runProactiveAudit: ${e.message}`);
      return { success: false, alertsFound: 0 };
    }
  }

  // ── Predictive Smart Purchases ───────────────────────────────────────────────

  async getPredictivePurchases(businessId: string, branchId?: string) {
    try {
      const products = await this.prisma.product.findMany({
        where: { businessId },
        include: {
          variants: true,
          supplier: true
        }
      });

      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const saleItems = await this.prisma.saleItem.findMany({
        where: {
          sale: {
            businessId,
            status: 'COMPLETED',
            createdAt: { gte: thirtyDaysAgo }
          }
        },
        select: {
          variantId: true,
          quantity: true
        }
      });

      const variantSalesMap = new Map<string, number>();
      for (const item of saleItems) {
        if (!item.variantId) continue;
        const currentVal = variantSalesMap.get(item.variantId) || 0;
        variantSalesMap.set(item.variantId, currentVal + item.quantity);
      }

      const inventories = await this.prisma.inventory.findMany({
        where: {
          branch: { businessId },
          ...(branchId ? { branchId } : {})
        },
        select: {
          variantId: true,
          quantity: true
        }
      });

      const variantStockMap = new Map<string, number>();
      for (const inv of inventories) {
        const currentStock = variantStockMap.get(inv.variantId) || 0;
        variantStockMap.set(inv.variantId, currentStock + inv.quantity);
      }

      const supplierGroups = new Map<string, {
        supplierId: string;
        supplierName: string;
        items: any[];
        totalCost: number;
      }>();

      const noSupplierGroup: {
        supplierId: string;
        supplierName: string;
        items: any[];
        totalCost: number;
      } = {
        supplierId: 'no-supplier',
        supplierName: 'Sin Proveedor Asignado',
        items: [],
        totalCost: 0
      };

      for (const product of products) {
        const supplier = product.supplier;
        const supplierId = supplier?.id || 'no-supplier';
        const supplierName = supplier?.name || 'Sin Proveedor Asignado';

        for (const variant of product.variants) {
          const currentStock = variantStockMap.get(variant.id) || 0;
          const totalSoldLast30Days = variantSalesMap.get(variant.id) || 0;
          const salesVelocityDaily = totalSoldLast30Days / 30;
          const daysOfStockRemaining = salesVelocityDaily > 0 ? (currentStock / salesVelocityDaily) : 999;

          const needsPurchase = currentStock <= variant.minStock || (daysOfStockRemaining < 10 && salesVelocityDaily > 0);

          if (needsPurchase) {
            const targetStock = Math.ceil(salesVelocityDaily * 14) + variant.minStock;
            let suggestQty = targetStock - currentStock;
            if (suggestQty < 5) suggestQty = 5;

            const itemCost = variant.cost || (variant.price * 0.6);
            const estimatedTotalCost = suggestQty * itemCost;

            const suggestedItem = {
              productId: product.id,
              productName: product.name,
              variantId: variant.id,
              variantName: variant.name,
              sku: variant.sku,
              currentStock,
              minStock: variant.minStock,
              salesVelocityDaily: parseFloat(salesVelocityDaily.toFixed(2)),
              totalSoldLast30Days,
              daysOfStockRemaining: daysOfStockRemaining === 999 ? 'N/A' : Math.round(daysOfStockRemaining),
              suggestedQuantity: suggestQty,
              cost: itemCost,
              totalCost: estimatedTotalCost
            };

            if (supplierId === 'no-supplier') {
              noSupplierGroup.items.push(suggestedItem);
              noSupplierGroup.totalCost += estimatedTotalCost;
            } else {
              if (!supplierGroups.has(supplierId)) {
                supplierGroups.set(supplierId, {
                  supplierId,
                  supplierName,
                  items: [],
                  totalCost: 0
                });
              }
              const group = supplierGroups.get(supplierId)!;
              group.items.push(suggestedItem);
              group.totalCost += estimatedTotalCost;
            }
          }
        }
      }

      const result = Array.from(supplierGroups.values());
      if (noSupplierGroup.items.length > 0) {
        result.push(noSupplierGroup);
      }

      return result;
    } catch (e) {
      this.logger.error(`Error in getPredictivePurchases: ${e.message}`);
      throw e;
    }
  }
}
