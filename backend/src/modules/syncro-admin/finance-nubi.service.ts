import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { createHash, createHmac, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import { Prisma, type CentralFinanceBotPhone } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BcvService } from '../settings/bcv.service';
import { fiscalRecordData, fiscalSupport } from './central-fiscal-data';
import { requireFinanceScope } from './finance-access';
import { defaultFinanceModel, financeModelOptions, FinanceNubiAi, type AiCallUsage, type FinanceHistory } from './finance-nubi-ai';
import { describeDraft, storeDrafts, validateDrafts, type CalendarEventDraft, type DeleteCalendarEventDraft, type FinanceDraft, type LedgerDraft, type UpdateCalendarEventDraft } from './finance-nubi-drafts';
import { financeNubiSecret, FinanceNubiTransport } from './finance-nubi-transport';
import { FinanceNubiTelegramTransport } from './finance-nubi-telegram';
import { FinanceGoogleCalendarService } from './finance-google-calendar.service';

const minutes = (value: number) => new Date(Date.now() + value * 60_000);
const noDraft = { pending: Prisma.DbNull, fiscalDocument: null };
const cleared = { ...noDraft, awaiting: false, activeUntil: null, history: Prisma.DbNull };
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
    private readonly telegram: FinanceNubiTelegramTransport,
    private readonly ai: FinanceNubiAi,
    private readonly bcv: BcvService,
    private readonly gcal: FinanceGoogleCalendarService,
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
    const personalScope = `personal:${user.id}`;
    const [status, allPhones, googleCalendar, openRouterKey, personalPlan, telegram] = await Promise.all([
      this.transport.status().catch(() => ({ connected: false, state: 'UNAVAILABLE' })),
      this.prisma.centralFinanceBotPhone.findMany({
        where: { userId: user.id },
        select: { phone: true, workspace: true, activeUntil: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.gcal.getStatus(user.id).catch(() => ({ configured: false, connected: false, email: null })),
      this.ai.getKeyUsage().catch(() => null),
      this.prisma.centralFinancePlan.findUnique({ where: { scope: personalScope }, select: { data: true } }),
      this.telegram.status().catch(() => ({ configured: false, connected: false, botUsername: null, webhookUrl: null })),
    ]);
    const phones = allPhones.filter(p => !p.phone.startsWith('tg:'));
    const telegramChats = allPhones
      .filter(p => p.phone.startsWith('tg:'))
      .map(p => ({ chatId: p.phone.slice(3), workspace: p.workspace, activeUntil: p.activeUntil }));
    const rawPlan = personalPlan?.data as Record<string, any> | null;
    const aiUsage = rawPlan?.aiUsage ?? null;
    const activeModel = typeof rawPlan?.aiModel === 'string' && rawPlan.aiModel.trim()
      ? rawPlan.aiModel.trim()
      : (process.env.SYNCRO_FINANCE_OPENROUTER_MODEL || defaultFinanceModel);
    return {
      ...status,
      phones,
      telegram,
      telegramChats,
      googleCalendar,
      openRouterKey,
      aiUsage,
      model: activeModel,
      availableModels: financeModelOptions,
      aiConfigured: !!process.env.OPENROUTER_API_KEY,
    };
  }

  async setModel(user: any, rawModel: unknown) {
    await requireFinanceScope(this.prisma, user, 'company');
    const model = typeof rawModel === 'string' ? rawModel.trim() : '';
    if (!/^[a-z0-9._-]+\/[a-z0-9._:-]+$/i.test(model) || model.length > 100) {
      throw new BadRequestException('Modelo de OpenRouter inválido');
    }
    const scope = `personal:${user.id}`;
    const existing = await this.prisma.centralFinancePlan.findUnique({ where: { scope } });
    const data = (existing?.data ?? { income: 0, grocery: 0, dining: 0, reserve: 0, payday1: 15, payday2: 31, obligations: [], debts: [] }) as Record<string, any>;
    const updated = { ...data, aiModel: model };
    await this.prisma.centralFinancePlan.upsert({
      where: { scope },
      create: { scope, data: updated as Prisma.InputJsonObject },
      update: { data: updated as Prisma.InputJsonObject },
    });
    return { model };
  }

  private async recordAiUsage(userId: string, usage: AiCallUsage, isAudio = false) {
    if (!usage.totalTokens && !usage.costUsd) return;
    try {
      const scope = `personal:${userId}`;
      const month = todayKey().slice(0, 7);
      const existing = await this.prisma.centralFinancePlan.findUnique({ where: { scope } });
      const data = (existing?.data ?? { income: 0, grocery: 0, dining: 0, reserve: 0, payday1: 15, payday2: 31, obligations: [], debts: [] }) as Record<string, any>;
      const prev = (data.aiUsage ?? {}) as Record<string, any>;
      const sameMonth = prev.month === month;
      const nextUsage = {
        totalCalls: (Number(prev.totalCalls) || 0) + 1,
        audioCalls: (Number(prev.audioCalls) || 0) + (isAudio ? 1 : 0),
        promptTokens: (Number(prev.promptTokens) || 0) + usage.promptTokens,
        completionTokens: (Number(prev.completionTokens) || 0) + usage.completionTokens,
        totalTokens: (Number(prev.totalTokens) || 0) + usage.totalTokens,
        totalCostUsd: Number(((Number(prev.totalCostUsd) || 0) + usage.costUsd).toFixed(6)),
        month,
        monthCalls: (sameMonth ? Number(prev.monthCalls) || 0 : 0) + 1,
        monthTokens: (sameMonth ? Number(prev.monthTokens) || 0 : 0) + usage.totalTokens,
        monthCostUsd: Number(((sameMonth ? Number(prev.monthCostUsd) || 0 : 0) + usage.costUsd).toFixed(6)),
        lastCallAt: new Date().toISOString(),
      };
      const updated = { ...data, aiUsage: nextUsage };
      await this.prisma.centralFinancePlan.upsert({
        where: { scope },
        create: { scope, data: updated as Prisma.InputJsonObject },
        update: { data: updated as Prisma.InputJsonObject },
      });
    } catch {
      // Never block chat response for telemetry
    }
  }

  async connect(user: any) {
    await requireFinanceScope(this.prisma, user, 'company');
    return this.transport.connect();
  }

  async disconnect(user: any) {
    await requireFinanceScope(this.prisma, user, 'company');
    return this.transport.disconnect();
  }

  async connectTelegram(user: any, publicOrigin?: string) {
    await requireFinanceScope(this.prisma, user, 'company');
    return this.telegram.connect(publicOrigin);
  }

  async disconnectTelegram(user: any) {
    await requireFinanceScope(this.prisma, user, 'company');
    return this.telegram.disconnect();
  }

  async authorizeTelegram(user: any, input: any) {
    await requireFinanceScope(this.prisma, user, 'company');
    const raw = String(input?.chatId ?? '').trim();
    if (!/^-?\d{5,20}$/.test(raw)) throw new BadRequestException('Ingresa un Chat ID numérico válido de Telegram');
    const workspace = input?.workspace;
    if (workspace !== 'company' && workspace !== 'personal') throw new BadRequestException('Selecciona qué espacio autorizas');
    const key = `tg:${raw}`;
    try {
      await this.prisma.centralFinanceBotPhone.create({
        data: { phone: key, userId: user.id, workspace, activeUntil: minutes(30 * 24 * 60) },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Ese Chat ID de Telegram ya está autorizado.');
      }
      throw error;
    }
    return { chatId: raw, workspace };
  }

  async revokeTelegram(user: any, raw: string) {
    await requireFinanceScope(this.prisma, user, 'company');
    const clean = String(raw ?? '').trim();
    if (!/^-?\d{5,20}$/.test(clean)) throw new BadRequestException('Chat ID inválido');
    await this.prisma.centralFinanceBotPhone.deleteMany({ where: { phone: `tg:${clean}`, userId: user.id } });
    return { ok: true };
  }

  async receiveTelegram(secretHeader: unknown, update: any) {
    if (!this.telegram.isConfigured()) return { ok: true };
    if (typeof secretHeader !== 'string' || !equal(secretHeader, this.telegram.webhookSecret())) {
      throw new ForbiddenException();
    }
    const cb = update?.callback_query;
    const msg = cb?.message ?? update?.message;
    const chatId = msg?.chat?.id != null ? String(msg.chat.id) : null;
    if (!chatId) return { ok: true };
    const updateId = String(update?.update_id ?? msg?.message_id ?? '');
    if (!updateId) return { ok: true };

    if (cb?.id) void this.telegram.answerCallback(String(cb.id));

    const eventId = hash(`tg:${chatId}:${updateId}`);
    const ev = await this.prisma.centralFinanceBotEvent.createMany({ data: [{ id: eventId }], skipDuplicates: true });
    if (!ev.count) return { ok: true, duplicate: true };

    const key = `tg:${chatId}`;
    const row = await this.prisma.centralFinanceBotPhone.findUnique({ where: { phone: key } });
    const rawText = cb ? (cb.data === 'confirm' ? 'confirmar' : cb.data === 'cancel' ? 'cancelar' : '') : String(msg.text ?? msg.caption ?? '');
    const text = rawText.trim().slice(0, 4000);
    const command = text.toLowerCase();

    if (!row) {
      if (command === '/start' || command === 'finanza') {
        await this.telegram.send(
          chatId,
          `Hola, soy *Nubi Finanzas*.\n\nTu *Chat ID* de Telegram es: \`${chatId}\`\n\nAgrégalo en *Syncro Central → Finanzas → Nubi* (sección Telegram) para autorizar este chat privado.`,
        );
      }
      return { ok: true };
    }

    let scope: string;
    try {
      scope = await requireFinanceScope(this.prisma, { id: row.userId, role: 'syncropos' }, row.workspace);
    } catch {
      return { ok: true };
    }

    const send = (reply: string, withButtons = false) => this.telegram.send(chatId, reply, withButtons);

    if (command === '/start') {
      await this.change(row, { activeUntil: minutes(30 * 24 * 60) });
      await send(`¡Hola! Ya estoy lista contigo en *${row.workspace === 'personal' ? 'Mis finanzas' : 'Empresa Syncro'}*. Escríbeme o mándame notas de voz, fotos de tickets, captures o PDFs.`);
      return { ok: true };
    }
    if (command === 'memoria') {
      await send(row.memory.length ? 'Preferencias guardadas:\n' + row.memory.map(n => `• ${n}`).join('\n')
        : 'Todavía no hay preferencias guardadas. Escribe «recordar» y una nota.');
      return { ok: true };
    }
    if (command === 'olvidar memoria') {
      if (await this.change(row, { memory: [] })) await send('Preferencias borradas. Tus registros financieros siguen guardados.');
      return { ok: true };
    }
    if (command.startsWith('recordar ')) {
      const note = text.slice(9).trim();
      if (!note || note.length > 250 || /\b\d{8,}\b|\S+@\S+|\b(contrase[nñ]a|password|clave|pin|otp)\b/i.test(note)) {
        await send('Guarda una preferencia de hasta 250 caracteres (sin claves ni números de cuenta).');
      } else if (await this.change(row, { memory: [...row.memory.filter(v => v !== note), note].slice(-20), activeUntil: minutes(30 * 24 * 60) })) {
        await send('¡Listo! Ya lo guardé en mi memoria.');
      }
      return { ok: true };
    }

    const pendingObj = row.pending as { id?: string; rows?: unknown; fiscal?: Prisma.InputJsonObject } | null;
    const hasAttachment = Boolean(!cb && (msg.voice || msg.audio || msg.photo?.length || msg.document));
    const isNaturalConfirm = !hasAttachment && !!pendingObj?.id && /^(confirmar|confirmo|confirmado|s[ií]|dale|ok|okay|listo|perfecto|claro|an[oó]talo|gu[aá]rdalo|de una|va|hagale|h[aá]gale|adelante)[\s!.,]*$/i.test(text);
    const isNaturalCancel = !hasAttachment && !!pendingObj?.id && /^(cancelar|cancela|no|descartar|descarta|d[eé]jalo|olv[ií]dalo)[\s!.,]*$/i.test(text);

    if (isNaturalConfirm && pendingObj?.id) {
      let result: Awaited<ReturnType<typeof storeDrafts>> | null = null;
      let calendarDrafts: (CalendarEventDraft | UpdateCalendarEventDraft | DeleteCalendarEventDraft)[] = [];
      try {
        result = await this.prisma.$transaction(async tx => {
          const session = await tx.centralFinanceBotPhone.updateMany({
            where: { phone: key, userId: row.userId, revision: row.revision },
            data: { ...noDraft, activeUntil: minutes(30 * 24 * 60), revision: { increment: 1 } },
          });
          if (!session.count) return null;
          const validated = validateDrafts(pendingObj.rows, todayKey());
          const isCal = (d: FinanceDraft): d is CalendarEventDraft | UpdateCalendarEventDraft | DeleteCalendarEventDraft =>
            d.kind === 'calendarEvent' || d.kind === 'updateCalendarEvent' || d.kind === 'deleteCalendarEvent';
          calendarDrafts = validated.filter(isCal);
          const financeOnly = validated.filter(d => !isCal(d));
          if (!financeOnly.length) return { saved: 0, duplicates: 0 };
          return storeDrafts(tx, scope, row.userId, pendingObj.id!, financeOnly);
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      } catch {
        await send('No pude guardar ese lote. Revisa los datos e intenta de nuevo.');
        return { ok: true };
      }
      let calendarDone = 0;
      let calendarError = '';
      if (result && calendarDrafts.length) {
        for (const item of calendarDrafts) {
          try {
            if (item.kind === 'calendarEvent') {
              await this.gcal.createEvent(row.userId, { summary: item.description, date: item.date, startTime: item.startTime, durationMinutes: item.durationMinutes, description: item.notes });
            } else if (item.kind === 'updateCalendarEvent') {
              await this.gcal.updateEvent(row.userId, item.eventId, { summary: item.description, date: item.date, startTime: item.startTime, durationMinutes: item.durationMinutes, description: item.notes });
            } else {
              await this.gcal.deleteEvent(row.userId, item.eventId);
            }
            calendarDone++;
          } catch (err) {
            calendarError = err instanceof Error ? err.message : 'Error en Google Calendar.';
          }
        }
      }
      if (result) {
        const parts: string[] = [];
        if (result.saved > 0) parts.push(`${result.saved === 1 ? '1 registro guardado' : `${result.saved} registros guardados`} en Syncro Finanzas`);
        if (calendarDone > 0) parts.push(`${calendarDone === 1 ? '1 cambio aplicado' : `${calendarDone} cambios aplicados`} en Google Calendar`);
        if (calendarError) parts.push(`⚠️ ${calendarError}`);
        await send(`¡Listo! ${parts.join(' · ') || 'Sin cambios nuevos'}.${result.duplicates ? ` (Omití ${result.duplicates} duplicado(s)).` : ''}`);
      }
      return { ok: true };
    }

    if (isNaturalCancel) {
      if (await this.change(row, { ...noDraft, activeUntil: minutes(30 * 24 * 60) })) {
        await send('Perfecto, lo descarté sin problema.');
      }
      return { ok: true };
    }

    try {
      void this.telegram.action(chatId, 'typing');
      const date = todayKey();
      let media: import('./finance-nubi-transport').FinanceMedia | undefined;
      let effectiveText = text;
      let wasAudio = false;
      if (!cb && (msg.voice || msg.audio)) {
        const fileId = msg.voice?.file_id ?? msg.audio?.file_id;
        media = await this.telegram.downloadMedia(fileId, { kind: 'voice' });
        if (media.type === 'input_audio') {
          wasAudio = true;
          const audioRes = await this.ai.transcribeAudio(media);
          void this.recordAiUsage(row.userId, audioRes.usage, true);
          effectiveText = text ? `${text}\n(Nota de voz): ${audioRes.text}` : audioRes.text;
          media = undefined;
        }
      } else if (!cb && Array.isArray(msg.photo) && msg.photo.length) {
        const best = msg.photo[msg.photo.length - 1];
        media = await this.telegram.downloadMedia(best.file_id, { kind: 'photo' });
      } else if (!cb && msg.document) {
        media = await this.telegram.downloadMedia(msg.document.file_id, {
          kind: 'document',
          fileName: msg.document.file_name,
          mimeType: msg.document.mime_type,
        });
      }

      const submitted = effectiveText || (media ? 'Lee este archivo y dime qué debo registrar.' : '');
      if (!submitted) return { ok: true };

      const snapshot = await this.snapshot(scope, date, row.userId, { bcv: true, fiscal: true });
      const history = Array.isArray(row.history) ? row.history as FinanceHistory : [];
      const personalPlanRow = await this.prisma.centralFinancePlan.findUnique({ where: { scope: `personal:${row.userId}` }, select: { data: true } });
      const selectedModel = typeof (personalPlanRow?.data as Record<string, any> | null)?.aiModel === 'string'
        ? String((personalPlanRow?.data as Record<string, any>).aiModel)
        : undefined;

      const output = await this.ai.respond(history, submitted, media, { ...snapshot, esNotaDeVoz: wasAudio, preferenciasDelUsuario: row.memory }, selectedModel);
      void this.recordAiUsage(row.userId, output.usage, false);

      let drafts: FinanceDraft[] = [];
      let question = output.reply;
      if (output.drafts.length) {
        try {
          drafts = validateDrafts(output.drafts, date);
        } catch (err) {
          question = err instanceof Error ? err.message : 'Revisa los datos antes de guardar.';
        }
      }
      const review = drafts.length ? '\n\n' + drafts.map((d, i) => `${i + 1}. ${describeDraft(d)}`).join('\n') : '';
      const updatedHistory: FinanceHistory = [
        ...history,
        { role: 'user', content: submitted },
        { role: 'assistant', content: (question + review).slice(0, 14_000) },
      ].slice(-16) as FinanceHistory;
      const learned = output.learn && !/\b\d{8,}\b|\S+@\S+|\b(contrase[nñ]a|password|clave|pin|otp)\b/i.test(output.learn)
        ? [...row.memory.filter(v => v !== output.learn), output.learn].slice(-20)
        : undefined;

      await this.change(row, {
        history: updatedHistory,
        activeUntil: minutes(30 * 24 * 60),
        ...(learned ? { memory: learned } : {}),
        pending: drafts.length ? { id: eventId, rows: drafts } as Prisma.InputJsonObject : Prisma.DbNull,
      });

      let sentVoice = false;
      if (output.voice && process.env.FISH_AUDIO_API_KEY) {
        const spoken = output.voiceText || question;
        if (spoken) {
          void this.telegram.action(chatId, 'record_voice');
          const audioB64 = await this.ai.synthesizeVoice(spoken);
          if (audioB64) {
            try {
              await this.telegram.sendAudio(chatId, audioB64);
              sentVoice = true;
            } catch {
              sentVoice = false;
            }
          }
        }
      }

      if (drafts.length) {
        const textBody = (sentVoice ? '' : (question || 'Aquí tienes el resumen.')) +
          (sentVoice ? review.trimStart() : review) +
          '\n\nToca *Guardar* o dime *dale* para registrarlo.';
        await send(textBody.trim(), true);
      } else if (!sentVoice) {
        await send(question || 'Aquí tienes el resumen.');
      }
    } catch (error) {
      const safeReason = error instanceof Error ? error.message.slice(0, 160) : 'unknown';
      this.logger.warn(`No se pudo procesar un mensaje de Nubi Telegram: ${safeReason}`);
      const detail = error instanceof Error && /^(Envía|No pude|OpenRouter)/.test(error.message)
        ? error.message
        : 'No pude procesar este mensaje. Intenta nuevamente.';
      await send(detail);
    }
    return { ok: true };
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
        ...noDraft, activeUntil: null, history: Prisma.DbNull,
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
    const attachment = content.imageMessage ?? content.documentMessage ?? content.audioMessage;
    const original = content.conversation ?? content.extendedTextMessage?.text ?? attachment?.caption ?? '';
    const text = typeof original === 'string' ? original.trim().slice(0, 4000) : '';
    const command = text.toLowerCase();
    const active = !!row.activeUntil && row.activeUntil.getTime() > Date.now();
    if (!active && !row.awaiting && (command !== 'finanza' || attachment)) return { ok: true };

    let scope: string;
    try {
      scope = await requireFinanceScope(this.prisma, { id: row.userId, role: 'syncropos' }, row.workspace);
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
      if (!await this.change(row, valid ? { ...reset, activeUntil: minutes(12 * 60) } : reset)) return { ok: true };
      await send(valid ? `¡Hola! Ya estoy activa contigo por 12 horas en ${row.workspace === 'personal' ? 'Mis finanzas' : 'Empresa Syncro'} (y me mantengo activa mientras sigamos conversando). Envíame texto, notas de voz, fotos, PDF o CSV. Escribe «salir» cuando quieras cerrar.`
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

    const pendingObj = row.pending as { id?: string; rows?: unknown; fiscal?: Prisma.InputJsonObject } | null;
    const isNaturalConfirm = !attachment && !!pendingObj?.id && /^(confirmar|confirmo|confirmado|s[ií]|dale|ok|okay|listo|perfecto|claro|an[oó]talo|gu[aá]rdalo|de una|va|hagale|h[aá]gale|adelante)[\s!.,]*$/i.test(text);
    const isNaturalCancel = !attachment && !!pendingObj?.id && /^(cancelar|cancela|no|descartar|descarta|d[eé]jalo|olv[ií]dalo)[\s!.,]*$/i.test(text);

    if (isNaturalConfirm || (!attachment && command === 'confirmar')) {
      const pending = pendingObj;
      if (!pending?.id) {
        await send('No hay registros pendientes de confirmar.');
        return { ok: true };
      }
      let result: Awaited<ReturnType<typeof storeDrafts>> | null;
      let calendarDrafts: (CalendarEventDraft | UpdateCalendarEventDraft | DeleteCalendarEventDraft)[] = [];
      try {
        result = await this.prisma.$transaction(async tx => {
          const session = await tx.centralFinanceBotPhone.updateMany({
            where: { phone, userId: row.userId, revision: row.revision, activeUntil: { gt: new Date() } },
            data: { ...noDraft, revision: { increment: 1 } },
          });
          if (!session.count) return null;
          if (pending.fiscal) {
            if (!row.fiscalDocument) throw new Error('Falta el comprobante original');
            const data = await fiscalRecordData(tx, scope, row.userId, {
              ...pending.fiscal, support: Buffer.from(row.fiscalDocument).toString('base64'),
            });
            await tx.centralFiscalRecord.create({ data: { ...data, scope, id: randomUUID() } });
            return { saved: 1, duplicates: 0 };
          }
          const validated = validateDrafts(pending.rows, todayKey());
          const isCal = (d: FinanceDraft): d is CalendarEventDraft | UpdateCalendarEventDraft | DeleteCalendarEventDraft =>
            d.kind === 'calendarEvent' || d.kind === 'updateCalendarEvent' || d.kind === 'deleteCalendarEvent';
          calendarDrafts = validated.filter(isCal);
          const financeOnly = validated.filter(d => !isCal(d));
          if (!financeOnly.length) return { saved: 0, duplicates: 0 };
          return storeDrafts(tx, scope, row.userId, pending.id!, financeOnly);
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      } catch (error) {
        if (pending.fiscal) {
          const duplicate = error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
          if (duplicate) await this.change(row, noDraft);
          await send(duplicate ? 'Ya existe ese registro fiscal. Abre el registro en la app para revisar sus adjuntos.'
            : 'No pude guardar el registro fiscal. Revisa la factura vinculada o vuelve a confirmar.');
          return { ok: true };
        }
        await send('No se confirmó el lote. Revisa tus movimientos y vuelve a confirmar si sigue pendiente.');
        return { ok: true };
      }
      let calendarDone = 0;
      let calendarError = '';
      if (result && calendarDrafts.length) {
        for (const ev of calendarDrafts) {
          try {
            if (ev.kind === 'calendarEvent') {
              await this.gcal.createEvent(row.userId, {
                summary: ev.description,
                date: ev.date,
                startTime: ev.startTime,
                durationMinutes: ev.durationMinutes,
                description: ev.notes,
              });
            } else if (ev.kind === 'updateCalendarEvent') {
              await this.gcal.updateEvent(row.userId, ev.eventId, {
                summary: ev.description,
                date: ev.date,
                startTime: ev.startTime,
                durationMinutes: ev.durationMinutes,
                description: ev.notes,
              });
            } else {
              await this.gcal.deleteEvent(row.userId, ev.eventId);
            }
            calendarDone++;
          } catch (err) {
            calendarError = err instanceof Error ? err.message : 'No se pudo actualizar Google Calendar.';
          }
        }
      }
      if (result && pending.fiscal) await send('Listo, dejé el registro fiscal y el soporte guardados en Syncro Finanzas.');
      else if (result) {
        const totalSaved = result.saved + calendarDone;
        const parts: string[] = [];
        if (result.saved > 0) parts.push(`${result.saved === 1 ? '1 registro guardado' : `${result.saved} registros guardados`} en Syncro Finanzas`);
        if (calendarDone > 0) parts.push(`${calendarDone === 1 ? '1 cambio aplicado' : `${calendarDone} cambios aplicados`} en tu Google Calendar`);
        if (calendarError) parts.push(`⚠️ ${calendarError}`);
        const msg = parts.length ? `¡Listo! ${parts.join(' · ')}.` : (totalSaved ? '¡Listo!' : 'Sin cambios nuevos.');
        await send(`${msg}${result.duplicates ? ` (Omití ${result.duplicates} duplicado(s)).` : ''}`);
      }
      return { ok: true };
    }
    if (isNaturalCancel || (!attachment && command === 'cancelar')) {
      if (await this.change(row, { ...noDraft, history: Prisma.DbNull })) await send('Perfecto, lo descarté sin problema. Seguimos conversando.');
      return { ok: true };
    }

    const fiscalKind = /^\s*factura emitida\b/i.test(text) ? 'invoice'
      : /^\s*retenci[oó]n\b/i.test(text) ? 'retention'
        : /^\s*declaraci[oó]n\b/i.test(text) ? 'declaration' : null;
    if (fiscalKind && !attachment) {
      if (await this.change(row, noDraft)) await send('Adjunta un PDF, PNG o JPEG y escribe el tipo de registro en el mismo mensaje.');
      return { ok: true };
    }
    try {
      void this.transport.typing(phone);
      const date = todayKey();
      let media = attachment ? await this.transport.media({ ...message, message: content }, attachment) : undefined;
      let effectiveText = text;
      let wasAudio = false;
      if (media?.type === 'input_audio') {
        wasAudio = true;
        const audioResult = await this.ai.transcribeAudio(media);
        void this.recordAiUsage(row.userId, audioResult.usage, true);
        effectiveText = text ? `${text}\n(Nota de voz): ${audioResult.text}` : audioResult.text;
        media = undefined;
      }
      if (fiscalKind) {
        const url = media?.type === 'file' ? media.file.file_data : media?.type === 'image_url' ? media.image_url.url : '';
        const document = fiscalSupport(url.split(',')[1]);
        const invoiceReference = fiscalKind === 'retention' ? /\bfactura\s*[:#]\s*([^\s,;]+)/i.exec(text)?.[1] : undefined;
        const invoice = invoiceReference ? await this.prisma.centralFiscalRecord.findFirst({
          where: { scope, kind: 'invoice', reference: { equals: invoiceReference, mode: 'insensitive' } },
          select: { id: true, reference: true },
        }) : null;
        if (fiscalKind === 'retention' && !invoice) {
          if (await this.change(row, noDraft)) {
            await send('Reenvía el comprobante con «Retención IVA factura: 000123» o «Retención ISLR factura: 000123». Usa el número exacto de una factura ya guardada en este espacio.');
          }
          return { ok: true };
        }
        const output = await this.ai.respond([], text, media, { modoFiscal: true, tipoSolicitado: fiscalKind });
        const candidate = output.fiscal;
        if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate) ||
            (candidate as { kind?: string }).kind !== fiscalKind || output.drafts.length) {
          if (await this.change(row, noDraft)) {
            await send((output.reply || 'No pude verificar el tipo de documento.') + '\nReenvía el archivo con los datos faltantes.');
          }
          return { ok: true };
        }
        const { reference, counterparty, status, date, period, tax, amountCents, baseCents, vatCents } = candidate as Record<string, Prisma.InputJsonValue>;
        const requestedTax = /^(?:retenci[oó]n|declaraci[oó]n)\s+(IVA|ISLR)\b/i.exec(text)?.[1].toUpperCase();
        if (requestedTax && requestedTax !== tax) {
          throw new BadRequestException('El impuesto del archivo no coincide con el que indicaste.');
        }
        if (fiscalKind === 'retention' && amountCents == null) {
          throw new BadRequestException('Indica el importe retenido en bolívares.');
        }
        const fiscal = {
          kind: fiscalKind, reference, counterparty, status, date, period, tax, amountCents, baseCents, vatCents,
          direction: fiscalKind === 'retention' ? 'received' : null, invoiceId: invoice?.id ?? null,
        };
        const data = await fiscalRecordData(this.prisma, scope, row.userId, fiscal);
        const number = (cents: number | null) => cents == null ? 'sin importe' : new Intl.NumberFormat('es-VE', {
          minimumFractionDigits: 2, maximumFractionDigits: 2,
        }).format(cents / 100) + ' Bs';
        const type = fiscalKind === 'invoice' ? 'Factura emitida' : fiscalKind === 'retention' ? 'Retención recibida' : 'Declaración';
        if (await this.change(row, {
          pending: { id: eventId, fiscal: JSON.parse(JSON.stringify(fiscal)) },
          fiscalDocument: new Uint8Array(document.bytes),
          history: Prisma.DbNull,
        })) {
          await send([
            `${type}${data.tax ? ' ' + data.tax : ''} · ${data.reference} · ${data.date}`,
            data.counterparty, data.period && `Período ${data.period}`, `Importe ${number(data.amountCents)}`,
            data.baseCents != null && `Base ${number(data.baseCents)}`,
            data.vatCents != null && `IVA ${number(data.vatCents)}`,
            invoice && `Factura vinculada ${invoice.reference}`,
            'El original se guardará con vista previa. Escribe «confirmar» para guardar o «cancelar» para descartar.',
          ].filter(Boolean).join('\n'));
        }
        return { ok: true };
      }
      const snapshot = await this.snapshot(scope, date, row.userId, {
        bcv: true,
        fiscal: true,
      });
      const history = Array.isArray(row.history) ? row.history as FinanceHistory : [];
      const submitted = effectiveText || (attachment ? 'Lee el archivo. Pregunta qué hacer si no queda claro.' : '');
      if (!submitted) return { ok: true };
      const personalPlanRow = await this.prisma.centralFinancePlan.findUnique({ where: { scope: `personal:${row.userId}` }, select: { data: true } });
      const selectedModel = typeof (personalPlanRow?.data as Record<string, any> | null)?.aiModel === 'string'
        ? String((personalPlanRow?.data as Record<string, any>).aiModel)
        : undefined;
      const output = await this.ai.respond(history, submitted, media, { ...snapshot, esNotaDeVoz: wasAudio, preferenciasDelUsuario: row.memory }, selectedModel);
      void this.recordAiUsage(row.userId, output.usage, false);
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
      const recordedBank = drafts.filter((draft): draft is LedgerDraft => 'bankReference' in draft && Boolean(draft.bankReference));
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
      ].slice(-16) as FinanceHistory;
      const learned = output.learn && !/\b\d{8,}\b|\S+@\S+|\b(contrase[nñ]a|password|clave|pin|otp)\b/i.test(output.learn)
        ? [...row.memory.filter(value => value !== output.learn), output.learn].slice(-20)
        : undefined;
      const updated = await this.change(row, {
        history: updatedHistory,
        activeUntil: minutes(12 * 60),
        ...(learned ? { memory: learned } : {}),
        fiscalDocument: null,
        pending: drafts.length ? { id: eventId, rows: drafts } as Prisma.InputJsonObject : Prisma.DbNull,
      });
      if (updated && row.activeUntil && row.activeUntil.getTime() > Date.now()) {
        let sentVoice = false;
        if (output.voice && process.env.FISH_AUDIO_API_KEY) {
          const spoken = output.voiceText || question;
          if (spoken) {
            void this.transport.recording(phone);
            const audioB64 = await this.ai.synthesizeVoice(spoken);
            if (audioB64) {
              try {
                await this.transport.sendAudio(phone, audioB64);
                sentVoice = true;
              } catch {
                sentVoice = false;
              }
            }
          }
        }
        if (drafts.length) {
          const textBody = (sentVoice ? '' : (question || 'Aquí tienes el resumen.')) +
            (sentVoice ? review.trimStart() : review) + repeatNote +
            '\n\n¿Te lo dejo guardado así? Solo dime *dale* o corrígeme cualquier detalle.';
          await send(textBody.trim());
        } else if (!sentVoice) {
          await send((question || 'Aquí tienes el resumen.') + repeatNote);
        }
      }
    } catch (error) {
      if (fiscalKind) {
        if (await this.change(row, noDraft)) {
          const detail = error instanceof BadRequestException ? error.message : 'No pude leer el comprobante fiscal.';
          await send(detail + ' Reenvía el archivo como PDF, PNG o JPEG con los datos faltantes.');
        }
        return { ok: true };
      }
      // Log only safe technical reason (never user content or credentials).
      const safeReason = error instanceof Error ? error.message.slice(0, 160) : 'unknown';
      this.logger.warn(`No se pudo procesar un mensaje de Nubi Finanzas: ${safeReason}`);
      const latest = await this.prisma.centralFinanceBotPhone.findUnique({ where: { phone }, select: { activeUntil: true, revision: true } });
      if (latest?.revision === row.revision && latest.activeUntil && latest.activeUntil.getTime() > Date.now()) {
        const detail = error instanceof Error && /^(Envía|No pude abrir el archivo|No pude leer ese archivo|No pude escuchar|OpenRouter)/.test(error.message)
          ? error.message
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

  @Cron('0 8 * * *', { timeZone: 'America/Caracas' })
  async sendDailyProactiveAlerts() {
    if (!process.env.EVOLUTION_API_URL || !process.env.EVOLUTION_API_KEY) return;
    const today = todayKey();
    const tomorrow = new Date(Date.parse(`${today}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
    const inTwoDays = new Date(Date.parse(`${today}T12:00:00Z`) + 2 * 86_400_000).toISOString().slice(0, 10);
    const phones = await this.prisma.centralFinanceBotPhone.findMany({
      where: { workspace: 'personal' },
      select: { phone: true, userId: true },
    });
    for (const row of phones) {
      try {
        const scope = await requireFinanceScope(this.prisma, { id: row.userId, role: 'syncropos' }, 'personal');
        const [plan, fiscal, calendarEvents] = await Promise.all([
          this.prisma.centralFinancePlan.findUnique({ where: { scope } }),
          this.prisma.centralFiscalRecord.findMany({
            where: { scope, kind: 'declaration', status: 'pending', dueDate: { lte: inTwoDays } },
            select: { tax: true, period: true, dueDate: true },
          }),
          this.gcal.listUpcomingEvents(row.userId, 1).catch(() => []),
        ]);
        const data = (plan?.data ?? {}) as Record<string, any>;
        const alerts: string[] = [];
        const debts = Array.isArray(data.debts) ? data.debts : [];
        for (const d of debts) {
          if (d?.date === today || d?.date === tomorrow) {
            alerts.push(`• *Deuda:* ${d.name} vence ${d.date === today ? 'hoy' : 'mañana'} ($${(Number(d.minimum || 0) / 100).toFixed(2)})`);
          }
        }
        const obligations = Array.isArray(data.obligations) ? data.obligations : [];
        for (const ob of obligations) {
          if (ob?.kind === 'payment' && (ob?.date === today || ob?.date === tomorrow)) {
            alerts.push(`• *Pago programado:* ${ob.name} vence ${ob.date === today ? 'hoy' : 'mañana'} ($${(Number(ob.cents || 0) / 100).toFixed(2)})`);
          }
        }
        for (const dec of fiscal) {
          alerts.push(`• *Fiscal:* Declaración ${dec.tax ?? ''} (${dec.period ?? ''}) vence el ${dec.dueDate}`);
        }
        if (calendarEvents.length) {
          alerts.push(`• *Agenda hoy:* ${calendarEvents.slice(0, 3).map(e => e.summary).join(' · ')}`);
        }
        if (alerts.length) {
          const msg = `¡Buenos días! Aquí tienes tu radar de hoy en *Syncro Finanzas*:\n\n${alerts.join('\n')}\n\nSi necesitas ajustar algo o agendar un pendiente, escríbeme por aquí.`;
          if (row.phone.startsWith('tg:')) {
            if (this.telegram.isConfigured()) await this.telegram.send(row.phone.slice(3), msg);
          } else {
            await this.transport.send(row.phone, msg);
          }
        }
      } catch {
        // Keep cron resilient per user
      }
    }
  }

  @Cron('0 19 * * 0', { timeZone: 'America/Caracas' })
  async sendWeeklySummary() {
    if (!process.env.EVOLUTION_API_URL || !process.env.EVOLUTION_API_KEY) return;
    const today = todayKey();
    const weekAgo = new Date(Date.parse(`${today}T12:00:00Z`) - 7 * 86_400_000).toISOString().slice(0, 10);
    const phones = await this.prisma.centralFinanceBotPhone.findMany({
      where: { workspace: 'personal' },
      select: { phone: true, userId: true },
    });
    for (const row of phones) {
      try {
        const scope = await requireFinanceScope(this.prisma, { id: row.userId, role: 'syncropos' }, 'personal');
        const [weekEntries, plan] = await Promise.all([
          this.prisma.centralFinanceEntry.findMany({
            where: { scope, date: { gte: weekAgo, lte: today } },
            select: { debit: true, credit: true, cents: true, smallSpend: true },
          }),
          this.prisma.centralFinancePlan.findUnique({ where: { scope } }),
        ]);
        let weekIncome = 0;
        let weekExpense = 0;
        let weekSmall = 0;
        for (const e of weekEntries) {
          if (e.credit === 'income') weekIncome += e.cents;
          else if (!['cash', 'bank', 'binance', 'equity', 'receivable', 'payable', 'debt'].includes(e.debit)) {
            weekExpense += e.cents;
            if (e.smallSpend) weekSmall += e.cents;
          }
        }
        const data = (plan?.data ?? {}) as Record<string, any>;
        const debts = Array.isArray(data.debts) ? data.debts : [];
        const totalDebt = debts.reduce((s: number, d: any) => s + Number(d.balance || 0), 0);
        const topDebt = [...debts].sort((a: any, b: any) => Number(b.apr || 0) - Number(a.apr || 0))[0];
        const usdFmt = (c: number) => `$${(c / 100).toFixed(2)}`;
        const lines = [
          'Hola, aquí tienes tu *resumen semanal de Nubi*:',
          `• *Ingresos (7 días):* ${usdFmt(weekIncome)}`,
          `• *Gastos (7 días):* ${usdFmt(weekExpense)}${weekSmall > 0 ? ` (hormiga: ${usdFmt(weekSmall)})` : ''}`,
          totalDebt > 0 ? `• *Deudas totales:* ${usdFmt(totalDebt)}${topDebt ? ` · Prioridad #1: ${topDebt.name}` : ''}` : '• *Deudas:* $0.00',
          'Mañana arrancamos con foco. Si quieres que revisemos tu plan para esta semana, escríbeme.',
        ];
        const textMsg = lines.join('\n');
        if (row.phone.startsWith('tg:')) {
          if (this.telegram.isConfigured()) await this.telegram.send(row.phone.slice(3), textMsg);
        } else {
          await this.transport.send(row.phone, textMsg);
        }
      } catch {
        // Keep cron resilient per user
      }
    }
  }

  private async snapshot(scope: string, today: string, userId: string, requested: { bcv: boolean; fiscal: boolean }) {
    const [plan, current, wallets, recent, bcv, fiscal, upcomingEvents] = await Promise.all([
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
      this.gcal.listUpcomingEvents(userId, 14).catch(() => []),
    ]);
    const balances: Record<string, number> = { cash: 0, bank: 0, binance: 0 };
    for (const entry of wallets) {
      const cents = entry._sum.cents ?? 0;
      if (entry.debit in balances) balances[entry.debit] += cents;
      if (entry.credit in balances) balances[entry.credit] -= cents;
    }
    const planData = (plan?.data ?? {}) as Record<string, any>;
    const foodSpentCents = current.reduce((sum, row) => sum + (row.debit === 'food' ? row._sum.cents ?? 0 : 0), 0);
    const openTrip = Array.isArray(planData.marketTrips) ? planData.marketTrips.find((t: any) => t.status === 'open') : null;
    const cartCents = Number(openTrip?.totalCents ?? 0);
    const groceryCap = Number(planData.grocery ?? 0);
    const fiscalRows = fiscal ?? [];
    const ivaBilledVes = fiscalRows.filter(r => r.kind === 'invoice' && r.status !== 'void').reduce((s, r) => s + (r.vatCents ?? 0), 0);
    const ivaRetVes = fiscalRows.filter(r => r.kind === 'retention' && r.tax === 'IVA' && r.direction === 'received').reduce((s, r) => s + (r.amountCents ?? 0), 0);
    const ivaPaidVes = fiscalRows.filter(r => r.kind === 'declaration' && r.tax === 'IVA' && r.status === 'paid').reduce((s, r) => s + (r.amountCents ?? 0), 0);
    const ivaNetDueVes = Math.max(0, ivaBilledVes - ivaRetVes - ivaPaidVes);

    const assetsList = Array.isArray(planData.assets) ? planData.assets : [];
    const liabilitiesList = Array.isArray(planData.liabilities) ? planData.liabilities : [];
    const activeAssetsCount = assetsList.filter((a: any) => a.status !== 'planned').length;
    const activeAssetsFlowCents = assetsList.filter((a: any) => a.status !== 'planned').reduce((s: number, a: any) => s + Number(a.monthlyCashflowCents || 0), 0);
    const totalLiabilitiesDrainCents = liabilitiesList.reduce((s: number, l: any) => s + Number(l.monthlyDrainCents || 0), 0);

    const safePlan = plan?.data ? { ...(plan.data as Record<string, unknown>) } : null;
    if (safePlan) {
      delete safePlan.googleCalendar;
      delete safePlan.aiUsage;
      delete safePlan.aiModel;
    }

    return {
      fechaCaracas: today, saldoContablePorCuentaEnCentavosUSD: balances,
      movimientosDelMesAgrupadosEnCentavosUSD: current, ultimosMovimientos: recent,
      proximosEventosGoogleCalendar: upcomingEvents,
      activosYPasivosEnCentavosUSD: {
        fuentesDeIngresoActivas: activeAssetsCount,
        flujoMensualActivos: activeAssetsFlowCents,
        drenajeMensualPasivos: totalLiabilitiesDrainCents,
        flujoNetoPatrimonial: activeAssetsFlowCents - totalLiabilitiesDrainCents,
        activos: assetsList,
        pasivos: liabilitiesList,
      },
      resumenMercadoMesEnCentavosUSD: {
        topeMensual: groceryCap,
        gastadoEnLibro: foodSpentCents,
        carritoAbiertoHoy: cartCents,
        restanteDelTope: Math.max(0, groceryCap - foodSpentCents - cartCents),
        itemsEnCarritoAbierto: openTrip?.items ?? [],
      },
      reservaFiscalIvaEstimadaEnCentavosVES: {
        ivaFacturado: ivaBilledVes,
        retencionesIvaRecibidas: ivaRetVes,
        declaracionesIvaPagadas: ivaPaidVes,
        ivaNetoPorPagar: ivaNetDueVes,
      },
      plan: safePlan, ...(bcv && { referenciaBcv: bcv }), ...(fiscal && { registrosFiscalesEnCentavosVES: fiscal }),
    };
  }
}
