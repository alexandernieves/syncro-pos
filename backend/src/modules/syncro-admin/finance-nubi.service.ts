import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createHash, createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { Prisma, type CentralFinanceBotPhone } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BcvService } from '../settings/bcv.service';
import { requireFinanceScope } from './finance-access';
import { defaultFinanceModel, FinanceNubiAi, type FinanceHistory } from './finance-nubi-ai';
import { describeDraft, storeDrafts, validateDrafts, type FinanceDraft } from './finance-nubi-drafts';
import { financeNubiSecret, FinanceNubiTransport } from './finance-nubi-transport';

const minutes = (value: number) => new Date(Date.now() + value * 60_000);
const cleared = { awaiting: false, activeUntil: null, pending: Prisma.DbNull, history: Prisma.DbNull };
const reset = { ...cleared, challengeHash: null, challengeUntil: null };
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const equal = (left: string, right: string) => timingSafeEqual(Buffer.from(hash(left)), Buffer.from(hash(right)));
const todayKey = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Caracas', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());

function phoneNumber(raw: unknown) {
  if (typeof raw !== 'string' || !/^\+?[\d\s()-]{8,24}$/.test(raw)) throw new BadRequestException('Usa el número con código de país');
  const normalized = raw.replace(/\D/g, '');
  if (!/^[1-9]\d{7,14}$/.test(normalized)) throw new BadRequestException('Usa el número con código de país');
  return normalized;
}

@Injectable()
export class FinanceNubiService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FinanceNubiService.name);
  private cleanupTimer?: ReturnType<typeof setInterval>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly transport: FinanceNubiTransport,
    private readonly ai: FinanceNubiAi,
    private readonly bcv: BcvService,
  ) {}

  onModuleInit() {
    if (process.env.SYNCRO_FINANCE_WHATSAPP_WEBHOOK_SECRET) {
      this.cleanupTimer = setInterval(() => this.cleanup(), 5 * 60_000);
      this.cleanupTimer.unref();
      this.cleanup();
    }
  }

  onModuleDestroy() {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
  }

  async settings(user: any) {
    await requireFinanceScope(this.prisma, user, 'company');
    const [status, phones] = await Promise.all([
      this.transport.status().catch(() => ({ connected: false, state: 'UNAVAILABLE' })),
      this.prisma.centralFinanceBotPhone.findMany({
        where: { userId: user.id },
        select: { phone: true, workspace: true, activeUntil: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);
    return { ...status, phones, model: process.env.SYNCRO_FINANCE_OPENROUTER_MODEL || defaultFinanceModel, aiConfigured: !!process.env.OPENROUTER_API_KEY };
  }

  async connect(user: any) {
    await requireFinanceScope(this.prisma, user, 'company');
    return this.transport.connect();
  }

  async authorize(user: any, input: any) {
    await requireFinanceScope(this.prisma, user, 'company');
    const phone = phoneNumber(input?.phone);
    const workspace = input?.workspace;
    if (workspace !== 'company' && workspace !== 'personal') throw new BadRequestException('Selecciona qué espacio autorizas');
    try {
      await this.prisma.centralFinanceBotPhone.create({ data: { phone, userId: user.id, workspace } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('El número ya está autorizado. El responsable del número puede revocar su acceso.');
      }
      throw error;
    }
    return { phone, workspace };
  }

  async revoke(user: any, raw: string) {
    await requireFinanceScope(this.prisma, user, 'company');
    const phone = phoneNumber(raw);
    await this.prisma.centralFinanceBotPhone.deleteMany({ where: { phone, userId: user.id } });
    return { ok: true };
  }

  async issueCode(user: any, raw: string) {
    await requireFinanceScope(this.prisma, user, 'company');
    const phone = phoneNumber(raw);
    const secret = financeNubiSecret();
    const code = randomInt(0, 100_000_000).toString().padStart(8, '0');
    const expiresAt = minutes(5);
    const changed = await this.prisma.centralFinanceBotPhone.updateMany({
      where: { phone, userId: user.id },
      data: {
        activeUntil: null, pending: Prisma.DbNull, history: Prisma.DbNull,
        challengeHash: this.challenge(secret, phone, code), challengeUntil: expiresAt, revision: { increment: 1 },
      },
    });
    if (!changed.count) throw new NotFoundException('Número no autorizado para tu cuenta');
    return { code, expiresAt };
  }

  private challenge(secret: string, phone: string, code: string) {
    return createHmac('sha256', secret).update(`finance-nubi:${phone}:${code}`).digest('hex');
  }

  private async change(row: CentralFinanceBotPhone, data: Prisma.CentralFinanceBotPhoneUpdateManyMutationInput) {
    const result = await this.prisma.centralFinanceBotPhone.updateMany({
      where: { phone: row.phone, userId: row.userId, revision: row.revision },
      data: { ...data, revision: { increment: 1 } },
    });
    return result.count > 0;
  }

  async receive(token: unknown, payload: any) {
    const secret = financeNubiSecret();
    if (typeof token !== 'string' || token.length > 128 || !equal(token, secret)) throw new ForbiddenException();
    if (payload?.instance !== this.transport.instance || !['messages.upsert', 'MESSAGES_UPSERT'].includes(payload.event)) return { ok: true };
    const message = payload.data;
    const remote = message?.key?.remoteJid;
    if (message?.key?.fromMe !== false || typeof remote !== 'string') return { ok: true };
    const jid = /^\d+@lid$/.test(remote) ? message.key.remoteJidAlt : remote;
    const match = typeof jid === 'string' ? /^([1-9]\d{7,14})(?::\d+)?@s\.whatsapp\.net$/.exec(jid) : null;
    const id = message?.key?.id;
    const rawTimestamp = message.messageTimestamp;
    const timestamp = Number(typeof rawTimestamp === 'object' ? rawTimestamp?.low : rawTimestamp);
    const age = Math.floor(Date.now() / 1000) - timestamp;
    if (!match || typeof id !== 'string' || !id || id.length > 128 || !Number.isFinite(age) || age < -60 || age > 300) {
      return { ok: true };
    }
    const phone = match[1];
    const row = await this.prisma.centralFinanceBotPhone.findUnique({ where: { phone } });
    if (!row) return { ok: true };

    const content = message.message?.ephemeralMessage?.message ??
      message.message?.documentWithCaptionMessage?.message ?? message.message;
    if (!content) return { ok: true };
    const attachment = content.imageMessage ?? content.documentMessage;
    const original = content.conversation ?? content.extendedTextMessage?.text ?? attachment?.caption ?? '';
    const text = typeof original === 'string' ? original.trim().slice(0, 4000) : '';
    const command = text.toLowerCase();
    const active = !!row.activeUntil && row.activeUntil.getTime() > Date.now();
    if (!active && !row.awaiting && (command !== 'finanza' || attachment)) return { ok: true };

    let scope: string;
    try {
      const company = await requireFinanceScope(this.prisma, { id: row.userId, role: 'syncropos' }, 'company');
      scope = row.workspace === 'company' ? company : `personal:${row.userId}`;
    } catch (error) {
      if (!(error instanceof ForbiddenException)) throw error;
      await this.change(row, reset);
      return { ok: true };
    }
    const eventId = hash(`${this.transport.instance}:${phone}:${id}`);
    const event = await this.prisma.centralFinanceBotEvent.createMany({ data: [{ id: eventId }], skipDuplicates: true });
    if (!event.count) return { ok: true, duplicate: true };
    const send = (reply: string) => this.transport.send(phone, reply);
    if (!attachment && command === 'salir') {
      await this.prisma.centralFinanceBotPhone.updateMany({
        where: { phone, userId: row.userId }, data: { ...reset, revision: { increment: 1 } },
      });
      await send('Sesión de Nubi Finanzas cerrada.');
      return { ok: true };
    }
    if (!attachment && command === 'finanza') {
      if (!active && !await this.change(row, {
        ...cleared, awaiting: true,
        challengeUntil: row.challengeUntil && row.challengeUntil.getTime() > Date.now() ? row.challengeUntil : minutes(5),
      })) return { ok: true };
      await send(active ? 'Tu sesión ya está activa. Escribe «salir» para cerrarla.'
        : 'Genera tu código de un solo uso en Syncro Central → Finanzas → Nubi WhatsApp y envíalo aquí. Nunca envíes tu contraseña.');
      return { ok: true };
    }
    if (row.awaiting && !active) {
      const valid = !attachment && /^\d{8}$/.test(text) && row.challengeHash && row.challengeUntil &&
        row.challengeUntil.getTime() > Date.now() && equal(row.challengeHash, this.challenge(secret, phone, text));
      if (!await this.change(row, valid ? { ...reset, activeUntil: minutes(30) } : reset)) return { ok: true };
      await send(valid ? `Nubi Finanzas activo por 30 minutos en ${row.workspace === 'personal' ? 'Mis finanzas' : 'Empresa Syncro'}. Envíame texto, fotos, PDF o CSV. Los archivos se procesan con OpenRouter. Escribe «salir» para cerrar.`
        : 'Código inválido o vencido. Cerré la activación. Genera otro código y escribe «finanza».');
      return { ok: true };
    }
    if (!active) return { ok: true };
    const mayContainCredentials = /\b(contrase[nñ]a|password|clave)\s*[:=]/i.test(text) ||
      (/\S+@\S+\.\S+/.test(text) && /\b(contrase[nñ]a|password|clave)\b/i.test(text));
    if (!attachment && mayContainCredentials) {
      await send('No envíes claves por WhatsApp. Esta sesión solo necesita tus datos de movimientos.');
      return { ok: true };
    }

    if (!attachment && command === 'memoria') {
      await send(row.memory.length ? 'Preferencias guardadas:\n' + row.memory.map(note => `• ${note}`).join('\n')
        : 'Todavía no hay preferencias guardadas. Escribe «recordar» y una nota, por ejemplo «recordar que mi cuenta de cobro es Banco».');
      return { ok: true };
    }
    if (!attachment && command === 'olvidar memoria') {
      if (await this.change(row, { memory: [] })) await send('Preferencias borradas. Tus registros financieros siguen guardados.');
      return { ok: true };
    }
    if (!attachment && command.startsWith('recordar ')) {
      const note = text.slice(9).trim();
      if (!note || note.length > 250 || /\b\d{8,}\b|\S+@\S+|\b(contrase[nñ]a|password|clave|pin|otp)\b/i.test(note)) {
        await send('Guarda una preferencia de hasta 250 caracteres. Evita credenciales y números de cuenta.');
      } else if (await this.change(row, { memory: [...row.memory.filter(value => value !== note), note].slice(-12) })) {
        await send('Preferencia guardada. Escribe «memoria» para verla u «olvidar memoria» para borrarla.');
      }
      return { ok: true };
    }

    if (!attachment && command === 'confirmar') {
      const pending = row.pending as { id?: string; rows?: unknown } | null;
      if (!pending?.id) {
        await send('No hay registros pendientes de confirmar.');
        return { ok: true };
      }
      let result: Awaited<ReturnType<typeof storeDrafts>> | null;
      try {
        result = await this.prisma.$transaction(async tx => {
          const session = await tx.centralFinanceBotPhone.updateMany({
            where: { phone, userId: row.userId, revision: row.revision, activeUntil: { gt: new Date() } },
            data: { pending: Prisma.DbNull, revision: { increment: 1 } },
          });
          if (!session.count) return null;
          return storeDrafts(tx, scope, row.userId, pending.id!, validateDrafts(pending.rows, todayKey()));
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      } catch {
        await send('No se confirmó el lote. Revisa tus movimientos y vuelve a confirmar si sigue pendiente.');
        return { ok: true };
      }
      if (result) await send(`${result.saved} registro(s) guardado(s) en Syncro Finanzas.${result.duplicates ? ` Omití ${result.duplicates} duplicado(s).` : ''}`);
      return { ok: true };
    }
    if (!attachment && command === 'cancelar') {
      if (await this.change(row, { pending: Prisma.DbNull, history: Prisma.DbNull })) await send('Borrador descartado. La sesión sigue activa.');
      return { ok: true };
    }

    try {
      const date = todayKey();
      const media = attachment ? await this.transport.media({ ...message, message: content }, attachment) : undefined;
      const snapshot = await this.snapshot(scope, date, {
        bcv: /\bbcv\b/i.test(text),
        fiscal: /\b(iva|islr|declaraci[oó]n|retenci[oó]n|vencimiento fiscal)\b/i.test(text),
      });
      const history = Array.isArray(row.history) ? row.history as FinanceHistory : [];
      const submitted = text || (attachment ? 'Lee el archivo. Pregunta qué hacer si no queda claro.' : '');
      if (!submitted) return { ok: true };
      const output = await this.ai.respond(history, submitted, media, { ...snapshot, preferenciasDelUsuario: row.memory });
      let drafts: FinanceDraft[] = [];
      let question = output.reply;
      if (output.drafts.length) {
        try {
          drafts = validateDrafts(output.drafts, date);
          if (/banesco/i.test(text) && /extracto|estado de cuenta|movimientos/i.test(text) &&
              drafts.some(draft => !('bankReference' in draft) || !draft.bankReference)) {
            drafts = [];
            throw new Error('Antes de importar Banesco, confirma la referencia de cada movimiento. Si es una transferencia propia, registrémosla por separado.');
          }
        } catch (error) {
          question = error instanceof Error ? error.message : 'Revisa los datos antes de guardar.';
        }
      }
      const recordedBank = drafts.filter(draft => 'bankReference' in draft && draft.bankReference);
      const possibleRepeat = recordedBank.length ? await this.prisma.centralFinanceEntry.findFirst({
        where: { scope, OR: recordedBank.map(draft => ({
          date: draft.date, currency: draft.currency, nativeCents: draft.nativeCents,
          ...(draft.kind === 'income' ? { debit: 'bank' } : { credit: 'bank' }),
        })) }, select: { id: true },
      }) : null;
      const repeatNote = possibleRepeat ? '\nAlgunos movimientos coinciden por fecha y monto con registros existentes. Revisa las coincidencias antes de confirmar.' : '';
      const review = drafts.length ? '\n\n' + drafts.map((draft, index) => `${index + 1}. ${describeDraft(draft)}`).join('\n') : '';
      const recordedContext = output.remember ? '\nDatos extraídos para continuar esta sesión: ' + output.remember : '';
      const updatedHistory: FinanceHistory = [
        ...history,
        { role: 'user', content: submitted },
        { role: 'assistant', content: (question + review + recordedContext).slice(0, 14_000) },
      ].slice(-8) as FinanceHistory;
      const updated = await this.change(row, {
        history: updatedHistory,
        pending: drafts.length ? { id: eventId, rows: drafts } as Prisma.InputJsonObject : Prisma.DbNull,
      });
      if (updated && row.activeUntil && row.activeUntil.getTime() > Date.now()) {
        await send((question || 'Revisa estos datos.') + review + repeatNote +
          (drafts.length ? '\n\nEscribe «confirmar» para guardar este lote o corrige los datos. Usa «cancelar» para descartarlo.' : ''));
      }
    } catch (error) {
      // Never log message content, document bodies, model output, credentials or provider responses.
      this.logger.warn('No se pudo procesar un mensaje de Nubi Finanzas');
      const latest = await this.prisma.centralFinanceBotPhone.findUnique({ where: { phone }, select: { activeUntil: true, revision: true } });
      if (latest?.revision === row.revision && latest.activeUntil && latest.activeUntil.getTime() > Date.now()) {
        const detail = error instanceof Error && /^(Envía|No pude abrir el archivo|No pude leer ese archivo)/.test(error.message) ? error.message
          : 'No pude procesar este mensaje. Intenta nuevamente.';
        await send(detail);
      }
    }
    return { ok: true };
  }

  private cleanup() {
    const now = new Date();
    void Promise.all([
      this.prisma.centralFinanceBotEvent.deleteMany({ where: { createdAt: { lt: minutes(-60 * 24 * 7) } } }),
      this.prisma.centralFinanceBotPhone.updateMany({
        where: { activeUntil: { lte: now } }, data: { ...reset, revision: { increment: 1 } },
      }),
      this.prisma.centralFinanceBotPhone.updateMany({
        where: { challengeUntil: { lte: now } },
        data: { challengeHash: null, challengeUntil: null, awaiting: false, revision: { increment: 1 } },
      }),
    ]).catch(() => this.logger.warn('No se pudo limpiar el estado vencido de Nubi Finanzas'));
  }

  private async snapshot(scope: string, today: string, requested: { bcv: boolean; fiscal: boolean }) {
    const [plan, current, wallets, recent, bcv, fiscal] = await Promise.all([
      this.prisma.centralFinancePlan.findUnique({ where: { scope } }),
      this.prisma.centralFinanceEntry.groupBy({
        by: ['debit', 'credit', 'smallSpend'], where: { scope, date: { gte: today.slice(0, 7) + '-01', lte: today } }, _sum: { cents: true },
      }),
      this.prisma.centralFinanceEntry.groupBy({
        by: ['debit', 'credit'], where: { scope, date: { lte: today } }, _sum: { cents: true },
      }),
      this.prisma.centralFinanceEntry.findMany({
        where: { scope, date: { lte: today } }, orderBy: [{ date: 'desc' }, { createdAt: 'desc' }], take: 12,
        select: { date: true, description: true, debit: true, credit: true, cents: true, currency: true, nativeCents: true },
      }),
      requested.bcv ? this.bcv.fetchBcv().catch(() => null) : null,
      requested.fiscal ? this.prisma.centralFiscalRecord.findMany({
        where: { scope }, orderBy: [{ date: 'desc' }], take: 15,
        select: { kind: true, tax: true, direction: true, period: true, dueDate: true, status: true, amountCents: true, vatCents: true },
      }) : null,
    ]);
    const balances: Record<string, number> = { cash: 0, bank: 0, binance: 0 };
    for (const entry of wallets) {
      const cents = entry._sum.cents ?? 0;
      if (entry.debit in balances) balances[entry.debit] += cents;
      if (entry.credit in balances) balances[entry.credit] -= cents;
    }
    return {
      fechaCaracas: today, saldoContablePorCuentaEnCentavosUSD: balances,
      movimientosDelMesAgrupadosEnCentavosUSD: current, ultimosMovimientos: recent,
      plan: plan?.data ?? null, ...(bcv && { referenciaBcv: bcv }), ...(fiscal && { registrosFiscalesEnCentavosVES: fiscal }),
    };
  }
}
