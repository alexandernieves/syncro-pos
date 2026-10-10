import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';

export type ReminderKind = 'BEFORE' | 'EXPIRY' | 'AFTER';

export type GymSettings = {
  timeZone: string;
  /** Image shown at the top of the gym menu (the gym's brand) */
  brandImageUrl: string | null;
  /** Space around that image, in px (0 = edge to edge) */
  brandPaddingX: number;
  brandPaddingY: number;
  reminders: {
    enabled: boolean;
    /** Days before the end date for the "vence pronto" message (0 = off). */
    daysBefore: number;
    onExpiry: boolean;
    /** Days after it ended, if not renewed (0 = off). */
    afterDays: number;
    /** Local hour from which messages go out. */
    hour: number;
    templates: Record<ReminderKind, string>;
  };
};

export const DEFAULT_GYM_SETTINGS: GymSettings = {
  timeZone: 'America/Caracas',
  brandImageUrl: null,
  brandPaddingX: 0,
  brandPaddingY: 0,
  reminders: {
    enabled: false,
    daysBefore: 3,
    onExpiry: true,
    afterDays: 3,
    hour: 9,
    templates: {
      BEFORE: 'Hola {nombre} 👋 Tu plan *{plan}* en *{gimnasio}* vence el *{fecha}* (en {dias} días). Renuévalo en recepción para seguir entrenando sin interrupciones 💪',
      EXPIRY: 'Hola {nombre}, tu plan *{plan}* en *{gimnasio}* vence *hoy*. Pasa por recepción para renovarlo y mantener tu acceso 🏋️',
      AFTER: 'Hola {nombre}, te extrañamos en *{gimnasio}* 💙 Tu plan *{plan}* venció el {fecha}. Cuando quieras volver, te esperamos en recepción.',
    },
  },
};

const DAY = 24 * 60 * 60 * 1000;
const MAX_PER_RUN = 40;
const MAX_FAILED_ATTEMPTS = 3;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Date parts (y-m-d and hour) in the gym's time zone. */
function localParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { y: get('year'), m: get('month'), d: get('day'), hour: get('hour') };
}
/** Whole days from today to `date`, both in the gym's time zone. */
function daysFromToday(date: Date, now: Date, timeZone: string) {
  const a = localParts(date, timeZone);
  const b = localParts(now, timeZone);
  return Math.round((Date.UTC(a.y, a.m - 1, a.d) - Date.UTC(b.y, b.m - 1, b.d)) / DAY);
}

@Injectable()
export class GymRemindersService {
  private readonly logger = new Logger('GymReminders');
  private running = false;

  constructor(
    private prisma: PrismaService,
    private whatsapp: WhatsAppService,
  ) {}

  // ── Settings ───────────────────────────────────────────────────────────────

  normalizeSettings(saved: any): GymSettings {
    const r = saved?.reminders ?? {};
    const d = DEFAULT_GYM_SETTINGS.reminders;
    const int = (v: any, min: number, max: number, def: number) => (Number.isFinite(Number(v)) ? Math.min(max, Math.max(min, Math.round(Number(v)))) : def);
    return {
      timeZone: typeof saved?.timeZone === 'string' && saved.timeZone ? saved.timeZone : DEFAULT_GYM_SETTINGS.timeZone,
      brandImageUrl: typeof saved?.brandImageUrl === 'string' && saved.brandImageUrl.trim() ? saved.brandImageUrl.trim() : null,
      brandPaddingX: int(saved?.brandPaddingX, 0, 48, 0),
      brandPaddingY: int(saved?.brandPaddingY, 0, 48, 0),
      reminders: {
        enabled: r.enabled === true,
        daysBefore: int(r.daysBefore, 0, 30, d.daysBefore),
        onExpiry: r.onExpiry !== false,
        afterDays: int(r.afterDays, 0, 60, d.afterDays),
        hour: int(r.hour, 0, 23, d.hour),
        templates: {
          BEFORE: r.templates?.BEFORE?.trim() || d.templates.BEFORE,
          EXPIRY: r.templates?.EXPIRY?.trim() || d.templates.EXPIRY,
          AFTER: r.templates?.AFTER?.trim() || d.templates.AFTER,
        },
      },
    };
  }

  async getSettings(businessId: string) {
    const s = await this.prisma.setting.findFirst({ where: { businessId }, select: { gymSettings: true } });
    return this.normalizeSettings(s?.gymSettings);
  }

  async saveSettings(businessId: string, data: any) {
    const settings = this.normalizeSettings(data);
    const row = await this.prisma.setting.findFirst({ where: { businessId }, select: { id: true } });
    if (!row) throw new NotFoundException('Configuración del negocio no encontrada');
    await this.prisma.setting.update({ where: { id: row.id }, data: { gymSettings: settings as any } });
    return settings;
  }

  // ── Messages ───────────────────────────────────────────────────────────────

  private render(template: string, vars: { nombre: string; plan: string; fecha: string; dias: number; gimnasio: string }) {
    return template
      .replace(/\{nombre\}/g, vars.nombre)
      .replace(/\{plan\}/g, vars.plan)
      .replace(/\{fecha\}/g, vars.fecha)
      .replace(/\{dias\}/g, String(Math.abs(vars.dias)))
      .replace(/\{gimnasio\}/g, vars.gimnasio);
  }

  private async send(
    businessId: string,
    target: { membershipId: string; memberId: string; phone: string; name: string; planName: string; endDate: Date },
    kind: ReminderKind,
    settings: GymSettings,
    businessName: string,
    manual = false,
  ) {
    const text = this.render(settings.reminders.templates[kind], {
      nombre: target.name.trim().split(/\s+/)[0] || target.name,
      plan: target.planName,
      fecha: target.endDate.toLocaleDateString('es-VE', { timeZone: settings.timeZone, day: 'numeric', month: 'long' }),
      dias: daysFromToday(target.endDate, new Date(), settings.timeZone),
      gimnasio: businessName,
    });
    try {
      await this.whatsapp.sendTextMessage(target.phone, text, businessId);
      return this.prisma.gymReminder.create({ data: { businessId, membershipId: target.membershipId, memberId: target.memberId, kind, status: 'SENT', phone: target.phone, manual } });
    } catch (e) {
      await this.prisma.gymReminder.create({ data: { businessId, membershipId: target.membershipId, memberId: target.memberId, kind, status: 'FAILED', phone: target.phone, error: String(e.message).slice(0, 300), manual } });
      throw e;
    }
  }

  // ── Which reminders are due ────────────────────────────────────────────────

  /** Memberships that should get a reminder now, with the kind of message. */
  async dueReminders(businessId: string, settings: GymSettings, now = new Date()) {
    const r = settings.reminders;
    const from = new Date(now.getTime() - (r.afterDays + 3) * DAY);
    const to = new Date(now.getTime() + (r.daysBefore + 2) * DAY);
    const memberships = await this.prisma.gymMembership.findMany({
      where: { businessId, status: 'ACTIVE', endDate: { gte: from, lte: to }, startDate: { lte: now } },
      include: {
        member: { include: { client: { select: { name: true, phone: true } }, memberships: { where: { status: { not: 'CANCELLED' } }, select: { id: true, endDate: true } } } },
        reminders: { select: { kind: true, status: true } },
      },
    });

    const due: { membership: (typeof memberships)[number]; kind: ReminderKind }[] = [];
    for (const m of memberships) {
      if (!m.member.accessEnabled || !m.member.client.phone) continue;
      // Already renewed: a later membership exists
      if (m.member.memberships.some((o) => o.id !== m.id && o.endDate > m.endDate)) continue;
      const days = daysFromToday(m.endDate, now, settings.timeZone);
      let kind: ReminderKind | null = null;
      if (r.daysBefore > 0 && days >= 1 && days <= r.daysBefore) kind = 'BEFORE';
      else if (r.onExpiry && days === 0) kind = 'EXPIRY';
      else if (r.afterDays > 0 && days <= -r.afterDays && days >= -(r.afterDays + 2)) kind = 'AFTER';
      if (!kind) continue;
      const attempts = m.reminders.filter((x) => x.kind === kind);
      if (attempts.some((x) => x.status === 'SENT') || attempts.length >= MAX_FAILED_ATTEMPTS) continue;
      due.push({ membership: m, kind });
    }
    return due;
  }

  /** Sends what's due for one business. Messages go one at a time, spaced out, to protect the WhatsApp number. */
  async runForBusiness(businessId: string, opts: { ignoreHour?: boolean } = {}) {
    const settings = await this.getSettings(businessId);
    if (!settings.reminders.enabled && !opts.ignoreHour) return { sent: 0, failed: 0, skipped: 'disabled' };
    if (!opts.ignoreHour && localParts(new Date(), settings.timeZone).hour < settings.reminders.hour) return { sent: 0, failed: 0, skipped: 'hour' };
    if (!(await this.whatsapp.getStatus(businessId)).connected) return { sent: 0, failed: 0, skipped: 'whatsapp' };

    const businessName = (await this.prisma.setting.findFirst({ where: { businessId }, select: { businessName: true } }))?.businessName || 'tu gimnasio';
    const due = (await this.dueReminders(businessId, settings)).slice(0, MAX_PER_RUN);
    let sent = 0;
    let failed = 0;
    for (const [i, { membership: m, kind }] of due.entries()) {
      if (i > 0) await sleep(4000 + Math.random() * 3000);
      try {
        await this.send(businessId, { membershipId: m.id, memberId: m.memberId, phone: m.member.client.phone!, name: m.member.client.name, planName: m.planName, endDate: m.endDate }, kind, settings, businessName);
        sent++;
      } catch (e) {
        failed++;
        this.logger.warn(`Reminder ${kind} for membership ${m.id} failed: ${e.message}`);
      }
    }
    return { sent, failed, pending: due.length };
  }

  @Cron('0 */10 * * * *')
  async scheduledRun() {
    if (this.running) return;
    this.running = true;
    try {
      // The database can be briefly unreachable (restart, sleep): try again on the next run
      const businesses = await this.prisma.setting
        .findMany({ where: { businessId: { not: null } }, select: { businessId: true, gymSettings: true } })
        .catch((e) => {
          this.logger.warn(`Reminders skipped this run: ${String(e.message).split('\n').filter(Boolean).pop()}`);
          return [];
        });
      for (const b of businesses) {
        if (!b.businessId || !(b.gymSettings as any)?.reminders?.enabled) continue;
        const result = await this.runForBusiness(b.businessId).catch((e) => ({ error: e.message }));
        if ((result as any).sent || (result as any).failed) this.logger.log(`Business ${b.businessId}: ${JSON.stringify(result)}`);
      }
    } finally {
      this.running = false;
    }
  }

  /** "Enviar recordatorio" from the member's card: picks the message that fits the membership right now. */
  async sendManual(businessId: string, memberId: string) {
    const member = await this.prisma.gymMember.findFirst({
      where: { id: memberId, businessId },
      include: { client: { select: { name: true, phone: true } }, memberships: { where: { status: { not: 'CANCELLED' } }, orderBy: { endDate: 'desc' }, take: 1 } },
    });
    if (!member) throw new NotFoundException('Socio no encontrado');
    if (!member.client.phone) throw new BadRequestException('El socio no tiene WhatsApp registrado');
    const m = member.memberships[0];
    if (!m) throw new BadRequestException('El socio no tiene membresía para recordar');
    if (!(await this.whatsapp.getStatus(businessId)).connected) throw new BadRequestException('El WhatsApp del negocio no está conectado');
    const settings = await this.getSettings(businessId);
    const days = daysFromToday(m.endDate, new Date(), settings.timeZone);
    const kind: ReminderKind = days > 0 ? 'BEFORE' : days === 0 ? 'EXPIRY' : 'AFTER';
    const businessName = (await this.prisma.setting.findFirst({ where: { businessId }, select: { businessName: true } }))?.businessName || 'tu gimnasio';
    await this.send(businessId, { membershipId: m.id, memberId: member.id, phone: member.client.phone, name: member.client.name, planName: m.planName, endDate: m.endDate }, kind, settings, businessName, true);
    return { sent: true, kind };
  }

  async listLog(businessId: string) {
    return this.prisma.gymReminder.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { member: { select: { id: true, memberNumber: true, client: { select: { name: true } } } }, membership: { select: { planName: true, endDate: true } } },
    });
  }

  /** Preview of what would go out now (for the settings screen). */
  async preview(businessId: string) {
    const settings = await this.getSettings(businessId);
    const due = await this.dueReminders(businessId, settings);
    return due.map(({ membership: m, kind }) => ({ membershipId: m.id, memberId: m.memberId, name: m.member.client.name, planName: m.planName, endDate: m.endDate, kind }));
  }
}
