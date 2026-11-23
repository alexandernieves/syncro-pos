import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { createHash, createHmac, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import { Prisma, type CentralFinanceBotPhone } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BcvService } from '../settings/bcv.service';
import { fiscalRecordData, fiscalSupport } from './central-fiscal-data';
import { requireFinanceScope } from './finance-access';
import { defaultFinanceModel, FinanceNubiAi, type FinanceHistory } from './finance-nubi-ai';
import { describeDraft, storeDrafts, validateDrafts, type CalendarEventDraft, type FinanceDraft, type LedgerDraft } from './finance-nubi-drafts';
import { financeNubiSecret, FinanceNubiTransport } from './finance-nubi-transport';
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
    const [status, phones, googleCalendar] = await Promise.all([
      this.transport.status().catch(() => ({ connected: false, state: 'UNAVAILABLE' })),
      this.prisma.centralFinanceBotPhone.findMany({
        where: { userId: user.id },
        select: { phone: true, workspace: true, activeUntil: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.gcal.getStatus(user.id).catch(() => ({ configured: false, connected: false, email: null })),
    ]);
    return { ...status, phones, googleCalendar, model: process.env.SYNCRO_FINANCE_OPENROUTER_MODEL || defaultFinanceModel, aiConfigured: !!process.env.OPENROUTER_API_KEY };
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
    const isNaturalConfirm = !attachment && !!pendingObj?.id && /^(confirmar|confirmo|s[ií]|dale|ok|okay|listo|perfecto|claro|an[oó]talo|gu[aá]rdalo|de una|va|hagale|h[aá]gale|adelante)[\s!.,]*$/i.test(text);
    const isNaturalCancel = !attachment && !!pendingObj?.id && /^(cancelar|cancela|no|descartar|descarta|d[eé]jalo|olv[ií]dalo)[\s!.,]*$/i.test(text);

    if (isNaturalConfirm || (!attachment && command === 'confirmar')) {
      const pending = pendingObj;
      if (!pending?.id) {
        await send('No hay registros pendientes de confirmar.');
        return { ok: true };
      }
      let result: Awaited<ReturnType<typeof storeDrafts>> | null;
      let calendarDrafts: CalendarEventDraft[] = [];
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
          calendarDrafts = validated.filter((d): d is CalendarEventDraft => d.kind === 'calendarEvent');
          const financeOnly = validated.filter(d => d.kind !== 'calendarEvent');
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
      let calendarCreated = 0;
      let calendarError = '';
      if (result && calendarDrafts.length) {
        for (const ev of calendarDrafts) {
          try {
            await this.gcal.createEvent(row.userId, {
              summary: ev.description,
              date: ev.date,
              startTime: ev.startTime,
              durationMinutes: ev.durationMinutes,
              description: ev.notes,
            });
            calendarCreated++;
          } catch (err) {
            calendarError = err instanceof Error ? err.message : 'No se pudo agendar en Google Calendar.';
          }
        }
      }
      if (result && pending.fiscal) await send('Listo, dejé el registro fiscal y el soporte guardados en Syncro Finanzas.');
      else if (result) {
        const totalSaved = result.saved + calendarCreated;
        const parts: string[] = [];
        if (result.saved > 0) parts.push(`${result.saved === 1 ? '1 registro guardado' : `${result.saved} registros guardados`} en Syncro Finanzas`);
        if (calendarCreated > 0) parts.push(`${calendarCreated === 1 ? '1 evento agendado' : `${calendarCreated} eventos agendados`} en tu Google Calendar`);
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
      const date = todayKey();
      let media = attachment ? await this.transport.media({ ...message, message: content }, attachment) : undefined;
      let effectiveText = text;
      if (media?.type === 'input_audio') {
        const transcript = await this.ai.transcribeAudio(media);
        effectiveText = text ? `${text}\n(Nota de voz): ${transcript}` : transcript;
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
        await send((question || 'Aquí tienes el resumen.') + review + repeatNote +
          (drafts.length ? '\n\n¿Te lo dejo guardado así en la app? Solo dime *dale* o corrígeme cualquier detalle.' : ''));
      }
    } catch (error) {
      if (fiscalKind) {
        if (await this.change(row, noDraft)) {
          const detail = error instanceof BadRequestException ? error.message : 'No pude leer el comprobante fiscal.';
          await send(detail + ' Reenvía el archivo como PDF, PNG o JPEG con los datos faltantes.');
        }
        return { ok: true };
      }
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
          await this.transport.send(
            row.phone,
            `¡Buenos días! Aquí tienes tu radar de hoy en *Syncro Finanzas*:\n\n${alerts.join('\n')}\n\nSi necesitas ajustar algo o agendar un pendiente, escríbeme por aquí.`,
          );
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
        await this.transport.send(row.phone, lines.join('\n'));
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
      this.gcal.listUpcomingEvents(userId, 3).catch(() => []),
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
    if (safePlan && 'googleCalendar' in safePlan) delete safePlan.googleCalendar;

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
