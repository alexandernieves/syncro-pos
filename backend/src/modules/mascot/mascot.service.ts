import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { usableModules } from '../business-modules/module-access';
import { softwareKnowledge } from './mascot-knowledge';

/** Everything the merchant can tune in Configuración → Mascota. */
export const MASCOT_DEFAULTS = {
  visible: true,
  roam: false,
  ideas: true,
  /** few | normal | many */
  frequency: 'normal',
  /** Season decorations on (older switch; `outfit: 'none'` is the same as off) */
  festive: true,
  /** Season outfit: auto (Syncro picks) | santa | reindeer | none */
  outfit: 'auto',
  /** default | professional | friendly | direct | playful */
  tone: 'default',
  /** less | default | more */
  warmth: 'default',
  enthusiasm: 'default',
  emoji: 'default',
  /** short | default | detailed */
  length: 'default',
  name: 'Syncro',
  instructions: '',
  aboutMe: '',
  memory: true,
};
export type MascotSettings = typeof MASCOT_DEFAULTS;

const CHOICES: Partial<Record<keyof MascotSettings, string[]>> = {
  frequency: ['few', 'normal', 'many'],
  outfit: ['auto', 'santa', 'reindeer', 'none'],
  tone: ['default', 'professional', 'friendly', 'direct', 'playful'],
  warmth: ['less', 'default', 'more'],
  enthusiasm: ['less', 'default', 'more'],
  emoji: ['less', 'default', 'more'],
  length: ['short', 'default', 'detailed'],
};

/** Minimum time between two ideas, per frequency. */
const GAP_MS: Record<string, number> = { few: 4 * 3600_000, normal: 90 * 60_000, many: 30 * 60_000 };
const EMOTIONS = ['neutral', 'happy', 'angry', 'sad', 'surprised', 'thinking', 'sleepy'];
const MODELS = ['openai/gpt-4o-mini', 'google/gemini-2.5-flash', 'meta-llama/llama-3.3-70b-instruct:free'];

type Msg = { role: 'user' | 'assistant'; content: string; at: string };
type AuthUser = { id: string; role?: string; businessId?: string | null; name?: string };

const money = (n: number) => `$${(Math.round(n * 100) / 100).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (now: number, before: number) => (before > 0 ? `${now >= before ? '+' : ''}${Math.round(((now - before) / before) * 100)}%` : 'sin datos del período anterior');

@Injectable()
export class MascotService {
  private readonly logger = new Logger('Mascot');
  private readonly apiKey: string;
  /** One idea at a time per user, even if several screens ask together */
  private readonly thinking = new Set<string>();

  constructor(private readonly prisma: PrismaService, config: ConfigService) {
    this.apiKey = config.get<string>('OPENROUTER_API_KEY') || '';
  }

  private assertMerchant(user: AuthUser) {
    if (!user?.businessId || user.role === 'syncropos' || user.role === 'client') throw new ForbiddenException('La mascota es para los usuarios de un negocio');
  }

  // ── Settings ───────────────────────────────────────────────────────────────

  async settings(user: AuthUser): Promise<MascotSettings> {
    const row = await this.prisma.mascotProfile.findUnique({ where: { userId: user.id } });
    return { ...MASCOT_DEFAULTS, ...((row?.settings as Partial<MascotSettings>) ?? {}) };
  }

  async updateSettings(user: AuthUser, body: Partial<MascotSettings>) {
    const current = await this.settings(user);
    const next = { ...current };
    for (const key of Object.keys(MASCOT_DEFAULTS) as (keyof MascotSettings)[]) {
      if (body?.[key] === undefined) continue;
      const value = body[key];
      const def = MASCOT_DEFAULTS[key];
      if (typeof def === 'boolean') (next as any)[key] = !!value;
      else if (CHOICES[key]) {
        if (CHOICES[key]!.includes(String(value))) (next as any)[key] = String(value);
      } else (next as any)[key] = String(value ?? '').slice(0, key === 'name' ? 24 : 1500).trim() || (key === 'name' ? 'Syncro' : '');
    }
    await this.prisma.mascotProfile.upsert({ where: { userId: user.id }, create: { userId: user.id, settings: next }, update: { settings: next } });
    return next;
  }

  async memory(user: AuthUser) {
    const row = await this.prisma.mascotProfile.findUnique({ where: { userId: user.id }, select: { memory: true } });
    return (row?.memory as string[]) ?? [];
  }

  async clearMemory(user: AuthUser) {
    await this.prisma.mascotProfile.updateMany({ where: { userId: user.id }, data: { memory: [] } });
    await this.prisma.mascotThought.deleteMany({ where: { userId: user.id } });
    return { ok: true };
  }

  // ── What it knows about the business ───────────────────────────────────────

  /** A compact picture of the business for the prompt: money in and out, stock, customers, modules. */
  async snapshot(businessId: string) {
    const now = Date.now();
    const d30 = new Date(now - 30 * 86400_000);
    const d60 = new Date(now - 60 * 86400_000);
    // Today in Caracas (UTC-4)
    const local = new Date(now - 4 * 3600_000);
    const today = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), 4));

    const business = await this.prisma.business.findUnique({ where: { id: businessId }, select: { name: true } });
    const salesBetween = async (from: Date, to: Date) => {
      const [r] = await this.prisma.$queryRaw<{ total: number | null; n: bigint }[]>`
        SELECT COALESCE(SUM(s."total"), 0)::float AS total, COUNT(*)::bigint AS n
        FROM "Sale" s JOIN "Branch" b ON b."id" = s."branchId"
        WHERE b."businessId" = ${businessId} AND s."status" = 'COMPLETED' AND s."createdAt" >= ${from} AND s."createdAt" < ${to}`;
      return { total: Number(r?.total ?? 0), count: Number(r?.n ?? 0) };
    };
    const expensesBetween = async (from: Date, to: Date) => {
      const [r] = await this.prisma.$queryRaw<{ total: number | null }[]>`
        SELECT COALESCE(SUM(e."amount"), 0)::float AS total
        FROM "Expense" e JOIN "Branch" b ON b."id" = e."branchId"
        WHERE b."businessId" = ${businessId} AND e."createdAt" >= ${from} AND e."createdAt" < ${to}`;
      return Number(r?.total ?? 0);
    };
    const nowD = new Date(now);
    const [sales30, salesPrev, salesToday, exp30, expPrev] = await Promise.all([
      salesBetween(d30, nowD),
      salesBetween(d60, d30),
      salesBetween(today, nowD),
      expensesBetween(d30, nowD),
      expensesBetween(d60, d30),
    ]);

    const [expenseCats, topProducts, lowStock, clients, newClients, modules] = await Promise.all([
      this.prisma.$queryRaw<{ category: string; total: number }[]>`
        SELECT e."category", SUM(e."amount")::float AS total
        FROM "Expense" e JOIN "Branch" b ON b."id" = e."branchId"
        WHERE b."businessId" = ${businessId} AND e."createdAt" >= ${d30}
        GROUP BY e."category" ORDER BY total DESC LIMIT 5`,
      this.prisma.$queryRaw<{ name: string; qty: number; revenue: number }[]>`
        SELECT p."name", SUM(i."quantity")::float AS qty, SUM(i."quantity" * i."price")::float AS revenue
        FROM "SaleItem" i
        JOIN "Sale" s ON s."id" = i."saleId"
        JOIN "Branch" b ON b."id" = s."branchId"
        JOIN "ProductVariant" v ON v."id" = i."variantId"
        JOIN "Product" p ON p."id" = v."productId"
        WHERE b."businessId" = ${businessId} AND s."status" = 'COMPLETED' AND s."createdAt" >= ${d30}
        GROUP BY p."name" ORDER BY revenue DESC LIMIT 5`,
      this.prisma.$queryRaw<{ name: string; stock: number; min: number }[]>`
        SELECT p."name" || CASE WHEN v."name" IN ('', 'Default', 'Única', 'Unica') THEN '' ELSE ' ' || v."name" END AS name,
               v."stock"::float AS stock, v."minStock"::float AS min
        FROM "ProductVariant" v JOIN "Product" p ON p."id" = v."productId"
        WHERE p."businessId" = ${businessId} AND v."stock" <= v."minStock"
        ORDER BY v."stock" ASC LIMIT 6`,
      this.prisma.client.count({ where: { businessId } }),
      this.prisma.client.count({ where: { businessId, createdAt: { gte: d30 } } }),
      usableModules(this.prisma as any, businessId),
    ]);

    let gym = '';
    if (modules.has('gym')) {
      const in7 = new Date(now + 7 * 86400_000);
      const [active, expiring, members] = await Promise.all([
        this.prisma.gymMembership.count({ where: { businessId, status: 'ACTIVE', endDate: { gte: nowD } } }),
        this.prisma.gymMembership.count({ where: { businessId, status: 'ACTIVE', endDate: { gte: nowD, lte: in7 } } }),
        this.prisma.gymMember.count({ where: { businessId } }),
      ]);
      gym = `\nGIMNASIO: ${members} socios registrados, ${active} membresías vigentes, ${expiring} vencen en los próximos 7 días.`;
    }

    const avg = sales30.count ? sales30.total / sales30.count : 0;
    const text = `
NEGOCIO: ${business?.name ?? 'el negocio'}
VENTAS hoy: ${money(salesToday.total)} en ${salesToday.count} ventas.
VENTAS últimos 30 días: ${money(sales30.total)} en ${sales30.count} ventas (ticket promedio ${money(avg)}). Antes (30 días previos): ${money(salesPrev.total)} → ${pct(sales30.total, salesPrev.total)}.
EGRESOS últimos 30 días: ${money(exp30)} (antes ${money(expPrev)} → ${pct(exp30, expPrev)}). Por categoría: ${expenseCats.map((c) => `${c.category} ${money(c.total)}`).join(', ') || 'sin gastos registrados'}.
RESULTADO 30 días (ventas − egresos registrados): ${money(sales30.total - exp30)}.
MÁS VENDIDOS (30 días): ${topProducts.map((p) => `${p.name} (${Math.round(p.qty)} u, ${money(p.revenue)})`).join('; ') || 'sin ventas de productos'}.
STOCK BAJO: ${lowStock.map((v) => `${v.name}: ${v.stock} (mín ${v.min})`).join('; ') || 'nada por debajo del mínimo'}.
CLIENTES: ${clients} registrados, ${newClients} nuevos en 30 días.${gym}`.trim();

    return { text, modules, hasData: sales30.count + salesPrev.count > 0 || exp30 > 0 };
  }

  // ── Personality ────────────────────────────────────────────────────────────

  private persona(s: MascotSettings, userName: string | undefined, memory: string[]) {
    const tone: Record<string, string> = {
      default: 'cercano, claro y útil',
      professional: 'profesional y preciso, como un asesor de negocios',
      friendly: 'muy amigable y cálido, como un compañero de trabajo',
      direct: 'directo y breve, sin rodeos',
      playful: 'divertido y con chispa, sin dejar de ser útil',
    };
    const level = (v: string, less: string, more: string) => (v === 'less' ? less : v === 'more' ? more : '');
    const length = s.length === 'short' ? 'Máximo 2 frases cortas.' : s.length === 'detailed' ? 'Hasta 5 frases si hace falta.' : 'Máximo 3 frases.';
    return [
      `Eres ${s.name}, la mascota de Syncro POS: una cabecita blanca lustrada con ojos negros que vive en la pantalla del comerciante y lo acompaña mientras trabaja. Tienes criterio propio, eres observador y te importa que al negocio le vaya bien.`,
      `Hablas en español de Venezuela, tuteando${userName ? ` a ${userName.split(' ')[0]}` : ''}. Tono: ${tone[s.tone] ?? tone.default}. ${level(s.warmth, 'Poca calidez, al grano.', 'Mucha calidez y ánimo.')} ${level(s.enthusiasm, 'Calmado.', 'Muy entusiasta.')} ${s.emoji === 'less' ? 'Sin emojis.' : s.emoji === 'more' ? 'Usa algunos emojis.' : 'Como mucho un emoji.'} ${length}`,
      'Nunca inventes cifras: usa solo los datos que te doy. Si algo no está en los datos, dilo o pregunta. No prometas hacer acciones en el sistema: indica dónde hacerlo (pantalla y ruta).',
      s.aboutMe ? `Lo que el comerciante te contó de sí mismo y su negocio: ${s.aboutMe}` : '',
      s.instructions ? `Instrucciones del comerciante para ti (respétalas): ${s.instructions}` : '',
      s.memory && memory.length ? `Lo que recuerdas de conversaciones anteriores: ${memory.join(' | ')}` : '',
    ].filter(Boolean).join('\n');
  }

  // ── Ideas (the light bulb) ─────────────────────────────────────────────────

  /** The idea still waiting for the user, if any (bulb on). */
  async pending(user: AuthUser) {
    this.assertMerchant(user);
    return this.prisma.mascotThought.findFirst({
      where: { userId: user.id, status: 'NEW', createdAt: { gte: new Date(Date.now() - 6 * 3600_000) } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Has a new idea when it's time (per the chosen frequency). The mascot decides what is worth
   * saying, how important it is and whether it wants an answer.
   */
  async think(user: AuthUser) {
    this.assertMerchant(user);
    const s = await this.settings(user);
    if (!s.visible || !s.ideas) return null;
    const waiting = await this.pending(user);
    if (waiting) return waiting;
    const last = await this.prisma.mascotThought.findFirst({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } });
    if (last && Date.now() - last.createdAt.getTime() < (GAP_MS[s.frequency] ?? GAP_MS.normal)) return null;
    if (!this.apiKey || this.thinking.has(user.id)) return null;

    this.thinking.add(user.id);
    try {
      const businessId = user.businessId!;
      const [snap, memory, recent, dbUser] = await Promise.all([
        this.snapshot(businessId),
        this.memory(user),
        this.prisma.mascotThought.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 6, select: { text: true, topic: true } }),
        this.prisma.user.findUnique({ where: { id: user.id }, select: { name: true, role: true } }),
      ]);
      const hour = new Date(Date.now() - 4 * 3600_000).getUTCHours();
      const system = [
        this.persona(s, dbUser?.name ?? undefined, memory),
        `CONOCES EL SOFTWARE:\n${softwareKnowledge(snap.modules)}`,
        `DATOS ACTUALES DEL NEGOCIO:\n${snap.text}`,
        `Hora local: ${hour}:00. Rol del usuario: ${dbUser?.role ?? 'usuario'}.`,
        `Ideas que ya diste (no repitas el mismo tema ni la misma frase): ${recent.map((r) => `[${r.topic}] ${r.text}`).join(' | ') || 'ninguna todavía'}.`,
      ].join('\n\n');
      const prompt = `Se te prendió el bombillo: comparte UNA idea útil y concreta para este comerciante ahora. Puede ser una observación de sus ingresos y egresos, un consejo de administración, una alerta de inventario, una oportunidad con sus clientes, o enseñarle una función de Syncro que le sirva${snap.hasData ? '' : ' (todavía casi no tiene datos: ayúdalo a arrancar)'}.
Prioriza en este orden lo que veas en los datos: 1) productos agotados o bajo el mínimo que se venden, 2) gastos que suben más que las ventas o resultado negativo, 3) caída o subida fuerte de ventas, 4) membresías por vencer (si hay gimnasio), 5) clientes, 6) una función de Syncro útil. Menciona el producto o la cifra concreta.
Decide con tu criterio:
- "importance": 3 si es urgente o muy valioso (ej. stock agotado de un producto que se vende mucho, gastos que se dispararon, membresías por vencer), 2 si es útil, 1 si es solo un comentario amable.
- "needsReply": true solo si de verdad necesitas que te responda algo (una pregunta concreta).
- "emotion": cómo te sientes al decirlo: happy, surprised, thinking, sad, angry (solo si algo anda muy mal) o neutral.
Responde SOLO con JSON: {"thought": "...", "topic": "sales|expenses|inventory|customers|modules|tip|greeting|gym", "importance": 1, "needsReply": false, "emotion": "neutral"}`;

      const raw = await this.complete(system, [], prompt, 400);
      const parsed = this.parseJson(raw);
      const text = String(parsed?.thought ?? '').trim();
      if (!text) return null;
      return await this.prisma.mascotThought.create({
        data: {
          userId: user.id,
          businessId,
          text: text.slice(0, 1200),
          topic: String(parsed?.topic ?? 'tip').slice(0, 30),
          importance: Math.min(3, Math.max(1, Number(parsed?.importance) || 1)),
          needsReply: !!parsed?.needsReply,
          emotion: EMOTIONS.includes(parsed?.emotion) ? parsed.emotion : 'neutral',
          messages: [{ role: 'assistant', content: text, at: new Date().toISOString() }],
        },
      });
    } finally {
      this.thinking.delete(user.id);
    }
  }

  /** The bulb went off unread (DISMISSED) or the thought was shown (SHOWN). */
  async setStatus(user: AuthUser, id: string, status: string) {
    if (!['SHOWN', 'DISMISSED'].includes(status)) throw new BadRequestException('Estado no válido');
    const t = await this.own(user, id);
    return this.prisma.mascotThought.update({ where: { id: t.id }, data: { status } });
  }

  /** The user shares a thought of their own (from the bulb in the chat); the mascot answers. */
  async share(user: AuthUser, text: string) {
    this.assertMerchant(user);
    const clean = String(text ?? '').trim().slice(0, 1500);
    if (!clean) throw new BadRequestException('Escribe lo que quieres compartir');
    const t = await this.prisma.mascotThought.create({
      data: { userId: user.id, businessId: user.businessId!, text: clean, topic: 'user', importance: 1, status: 'SHOWN', messages: [] },
    });
    const answer = await this.reply(user, t.id, clean);
    const thought = await this.prisma.mascotThought.findUnique({ where: { id: t.id } });
    return { thought, ...answer };
  }

  /** Keeps (or drops) a thought in the user's idea history. */
  async setSaved(user: AuthUser, id: string, saved: boolean) {
    const t = await this.own(user, id);
    return this.prisma.mascotThought.update({ where: { id: t.id }, data: { saved: !!saved } });
  }

  /** The idea history: thoughts the user saved, newest first. */
  async savedThoughts(user: AuthUser) {
    this.assertMerchant(user);
    return this.prisma.mascotThought.findMany({ where: { userId: user.id, saved: true }, orderBy: { updatedAt: 'desc' }, take: 60 });
  }

  /** The user answers a thought; the mascot replies and may remember something useful. */
  async reply(user: AuthUser, id: string, text: string) {
    this.assertMerchant(user);
    const clean = String(text ?? '').trim().slice(0, 1500);
    if (!clean) throw new BadRequestException('Escribe tu respuesta');
    const t = await this.own(user, id);
    if (!this.apiKey) throw new BadRequestException('La mascota no tiene conexión con la IA ahora mismo');
    const s = await this.settings(user);
    const [snap, memory, dbUser] = await Promise.all([
      this.snapshot(user.businessId!),
      this.memory(user),
      this.prisma.user.findUnique({ where: { id: user.id }, select: { name: true } }),
    ]);
    const history = ((t.messages as Msg[]) ?? []).slice(-12);
    const system = [
      this.persona(s, dbUser?.name ?? undefined, memory),
      `CONOCES EL SOFTWARE:\n${softwareKnowledge(snap.modules)}`,
      `DATOS ACTUALES DEL NEGOCIO:\n${snap.text}`,
      t.topic === 'user'
        ? 'El comerciante te compartió un pensamiento suyo (una idea, una duda o algo que le preocupa del negocio). Respóndele con criterio, usando sus datos, como en una burbuja de pensamiento: corto y concreto.'
        : 'Estás conversando sobre una idea que compartiste. Contesta como en una burbuja de pensamiento: corto y concreto.',
      `Responde SOLO con JSON: {"reply": "...", "emotion": "happy|surprised|thinking|sad|angry|neutral", "needsReply": false, "remember": "..."}
En "remember" anota en una frase corta cualquier dato duradero que el comerciante te haya contado en su último mensaje (proveedores, días de compra, horarios, metas, empleados, preferencias). Déjalo vacío solo si no contó nada nuevo.`,
    ].join('\n\n');
    const raw = await this.complete(system, history.map((m) => ({ role: m.role, content: m.content })), clean, 450);
    const parsed = this.parseJson(raw);
    const answer = String(parsed?.reply ?? raw ?? '').trim().slice(0, 1500) || 'Mmm, no se me ocurre nada ahora. ¿Me lo dices de otra forma?';
    const now = new Date().toISOString();
    const messages = [...((t.messages as Msg[]) ?? []), { role: 'user', content: clean, at: now }, { role: 'assistant', content: answer, at: now }];
    await this.prisma.mascotThought.update({ where: { id: t.id }, data: { messages, status: 'SHOWN' } });

    const remember = String(parsed?.remember ?? '').trim().slice(0, 200);
    if (s.memory && remember) {
      const next = [...memory.filter((m) => m !== remember), remember].slice(-30);
      await this.prisma.mascotProfile.upsert({ where: { userId: user.id }, create: { userId: user.id, settings: s, memory: next }, update: { memory: next } });
    }
    return { reply: answer, emotion: EMOTIONS.includes(parsed?.emotion) ? parsed.emotion : 'happy', needsReply: !!parsed?.needsReply };
  }

  private async own(user: AuthUser, id: string) {
    const t = await this.prisma.mascotThought.findUnique({ where: { id } });
    if (!t || t.userId !== user.id) throw new NotFoundException('Pensamiento no encontrado');
    return t;
  }

  // ── LLM ────────────────────────────────────────────────────────────────────

  private async complete(system: string, history: { role: string; content: string }[], message: string, maxTokens: number) {
    for (const model of MODELS) {
      try {
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://syncropos.com', 'X-Title': 'Syncro POS Mascot' },
          body: JSON.stringify({ model, messages: [{ role: 'system', content: system }, ...history, { role: 'user', content: message }], max_tokens: maxTokens, temperature: 0.7 }),
          signal: AbortSignal.timeout(25_000),
        });
        if (!res.ok) {
          this.logger.warn(`${model}: ${res.status} ${(await res.text()).slice(0, 200)}`);
          continue;
        }
        const data = await res.json();
        const content = data?.choices?.[0]?.message?.content;
        if (content) return String(content);
      } catch (e: any) {
        this.logger.warn(`${model}: ${e.message}`);
      }
    }
    return '';
  }

  private parseJson(raw: string): any {
    if (!raw) return null;
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}
