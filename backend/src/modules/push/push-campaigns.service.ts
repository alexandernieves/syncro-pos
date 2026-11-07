import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../chat/push.service';
import { ChatGateway } from '../chat/chat.gateway';
import { AUTOMATION, AUTOMATIONS, fill, firstName } from './push-automations';

const OWNER_ROLES = ['ownerpos', 'owner', 'admin', 'superadmin'];
/** Everyone who works in a business (its customers have their own portal and are not users). */
const NOT_TEAM = ['syncropos', 'client'];

export type Audience = { mode: 'all' | 'selected'; businessIds?: string[]; who: 'owners' | 'team' };
type Recipient = { id: string; name: string | null; businessId: string | null; businessName: string | null };
type Message = { title: string; body: string; url?: string | null };

const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+$/g, '').trim().slice(0, max) : '');

/** Internal paths ("/dashboard/…") or https links; anything else is dropped. */
function cleanUrl(v: unknown): string | null {
  const s = clean(v, 500);
  if (!s) return null;
  if (/^\/(?!\/)/.test(s)) return s;
  if (/^https:\/\/[^\s]+$/i.test(s)) return s;
  throw new BadRequestException('El enlace debe empezar con / (una pantalla de Syncro) o con https://');
}

@Injectable()
export class PushCampaignsService {
  private readonly logger = new Logger(PushCampaignsService.name);

  constructor(
    private prisma: PrismaService,
    private push: PushService,
    private chat: ChatGateway,
  ) {}

  /* ───────────────────────── Syncro central ───────────────────────── */

  async overview() {
    const [rows, devices, campaigns] = await Promise.all([
      this.prisma.pushAutomation.findMany(),
      this.prisma.pushSubscription.findMany({ where: { user: { role: { notIn: NOT_TEAM } } }, select: { userId: true, user: { select: { businessId: true } } } }),
      this.prisma.pushCampaign.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }),
    ]);
    const saved = new Map(rows.map((r) => [r.key, r]));
    const automations = AUTOMATIONS.map((a) => {
      const r = saved.get(a.key);
      return {
        key: a.key, label: a.label, when: a.when, vars: a.vars, fixedText: !!a.fixedText,
        enabled: r?.enabled ?? true,
        title: r?.title ?? a.title, body: r?.body ?? a.body, url: r ? r.url : a.url,
        defaults: { title: a.title, body: a.body, url: a.url },
      };
    });
    const sent = await this.prisma.pushCampaign.groupBy({ by: ['trigger'], where: { kind: 'AUTO' }, _count: true, _max: { createdAt: true } });
    const autoStats = Object.fromEntries(sent.map((s) => [s.trigger ?? '', { count: s._count, last: s._max.createdAt }]));
    return {
      configured: this.push.configured,
      devices: devices.length,
      people: new Set(devices.map((d) => d.userId)).size,
      businesses: new Set(devices.map((d) => d.user.businessId).filter(Boolean)).size,
      automations: automations.map((a) => ({ ...a, sent: autoStats[a.key]?.count ?? 0, lastSent: autoStats[a.key]?.last ?? null })),
      campaigns,
    };
  }

  /** Every business with how many people and devices each audience reaches. */
  async audience() {
    const [businesses, users] = await Promise.all([
      this.prisma.business.findMany({ select: { id: true, name: true, status: true, email: true, createdAt: true }, orderBy: { name: 'asc' } }),
      this.prisma.user.findMany({
        where: { businessId: { not: null }, role: { notIn: NOT_TEAM } },
        select: { businessId: true, role: true, _count: { select: { pushSubscriptions: true } } },
      }),
    ]);
    const by = new Map<string, { owners: number; team: number; ownerDevices: number; teamDevices: number }>();
    for (const u of users) {
      const b = by.get(u.businessId!) ?? { owners: 0, team: 0, ownerDevices: 0, teamDevices: 0 };
      const d = u._count.pushSubscriptions;
      b.team++;
      b.teamDevices += d;
      if (OWNER_ROLES.includes(u.role)) {
        b.owners++;
        b.ownerDevices += d;
      }
      by.set(u.businessId!, b);
    }
    return businesses.map((b) => ({ ...b, ...(by.get(b.id) ?? { owners: 0, team: 0, ownerDevices: 0, teamDevices: 0 }) }));
  }

  async campaign(id: string) {
    const c = await this.prisma.pushCampaign.findUnique({ where: { id }, include: { deliveries: { orderBy: { createdAt: 'asc' }, take: 500 } } });
    if (!c) throw new NotFoundException('Notificación no encontrada');
    const ids = [...new Set(c.deliveries.map((d) => d.userId))];
    const users = await this.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, email: true, business: { select: { name: true } } } });
    const who = new Map(users.map((u) => [u.id, u]));
    return {
      ...c,
      deliveries: c.deliveries.map((d) => ({ id: d.id, status: d.status, sentAt: d.sentAt, name: who.get(d.userId)?.name ?? 'Usuario', email: who.get(d.userId)?.email ?? null, business: who.get(d.userId)?.business?.name ?? null })),
    };
  }

  /** A notification written by the Syncro team. */
  async sendManual(body: any, adminId: string) {
    const msg = this.message(body);
    const who: Audience['who'] = body?.who === 'team' ? 'team' : 'owners';
    const mode: Audience['mode'] = body?.mode === 'all' ? 'all' : 'selected';
    const businessIds = Array.isArray(body?.businessIds) ? [...new Set(body.businessIds.filter((x: unknown) => typeof x === 'string'))].slice(0, 5000) as string[] : [];
    if (mode === 'selected' && !businessIds.length) throw new BadRequestException('Elige al menos un comercio');
    const audience: Audience = { mode, who, businessIds: mode === 'all' ? [] : businessIds };
    const recipients = await this.resolve(audience);
    if (!recipients.length) throw new BadRequestException('Ese grupo no tiene personas a quienes enviar');
    return this.deliver({ kind: 'MANUAL', sentById: adminId, audience, ...msg }, recipients);
  }

  /** A test that only reaches whoever is sending it. */
  async sendTest(body: any, adminId: string) {
    const msg = this.message(body);
    const me = await this.prisma.user.findUnique({ where: { id: adminId }, select: { id: true, name: true, businessId: true } });
    if (!me) throw new NotFoundException('Usuario no encontrado');
    const vars = { nombre: firstName(me.name), negocio: 'Bodega Ejemplo', solicitud: 'Módulo de ejemplo', estado: 'En revisión', cuando: 'en 3 días', fecha: '15 de noviembre' };
    const id = `test-${Date.now()}`;
    const title = fill(msg.title, vars);
    const text = fill(msg.body, vars);
    const devices = await this.push.sendToUser(me.id, { title, body: text, url: msg.url ?? undefined, tag: id });
    this.chat.server.to(`user_${me.id}`).emit('syncroPush', { id, title, body: text, url: msg.url, devices });
    return { devices, configured: this.push.configured };
  }

  async updateAutomation(key: string, body: any) {
    const def = AUTOMATION[key];
    if (!def) throw new NotFoundException('Automatización no encontrada');
    const current = await this.prisma.pushAutomation.findUnique({ where: { key } });
    const enabled = typeof body?.enabled === 'boolean' ? body.enabled : current?.enabled ?? true;
    let title = current?.title ?? def.title;
    let text = current?.body ?? def.body;
    let url = current ? current.url : def.url;
    if (!def.fixedText) {
      if (body?.title !== undefined) title = clean(body.title, 80) || def.title;
      if (body?.body !== undefined) text = clean(body.body, 300) || def.body;
      if (body?.url !== undefined) url = cleanUrl(body.url);
    }
    await this.prisma.pushAutomation.upsert({ where: { key }, update: { enabled, title, body: text, url }, create: { key, enabled, title, body: text, url } });
    return (await this.overview()).automations.find((a) => a.key === key);
  }

  /* ───────────────────────── Automations ───────────────────────── */

  /**
   * Fires an automation. Best-effort: it never breaks what triggered it.
   * `dedupeKey` keeps it from going out twice for the same event.
   */
  async automate(key: string, to: { userIds?: string[]; ownersOf?: string }, vars: Record<string, string> = {}, dedupeKey?: string) {
    try {
      const def = AUTOMATION[key];
      if (!def || def.fixedText) return null;
      const row = await this.prisma.pushAutomation.findUnique({ where: { key } });
      if (row && !row.enabled) return null;
      if (dedupeKey && (await this.prisma.pushCampaign.findUnique({ where: { dedupeKey }, select: { id: true } }))) return null;

      const recipients = to.ownersOf
        ? await this.resolve({ mode: 'selected', businessIds: [to.ownersOf], who: 'owners' })
        : await this.users(to.userIds ?? []);
      if (!recipients.length) return null;
      return await this.deliver(
        { kind: 'AUTO', trigger: key, dedupeKey, title: row?.title ?? def.title, body: row?.body ?? def.body, url: row ? row.url : def.url, vars },
        recipients,
      );
    } catch (err: any) {
      if (err?.code !== 'P2002') this.logger.warn(`Automation ${key} failed: ${err.message}`);
      return null;
    }
  }

  /** Three days before a subscription runs out, every morning in Venezuela. */
  @Cron('0 0 9 * * *', { timeZone: 'America/Caracas' })
  async paymentReminders() {
    const now = new Date();
    const soon = new Date(now.getTime() + 3 * 86_400_000);
    const due = await this.prisma.business.findMany({
      where: { subscriptionEndsAt: { gte: now, lte: soon }, status: { not: 'SUSPENDED' } },
      select: { id: true, name: true, subscriptionEndsAt: true },
    });
    for (const b of due) {
      const ends = b.subscriptionEndsAt!;
      const days = Math.max(0, Math.round((startOfDay(ends) - startOfDay(now)) / 86_400_000));
      const cuando = days === 0 ? 'hoy' : days === 1 ? 'mañana' : `en ${days} días`;
      const fecha = ends.toLocaleDateString('es-VE', { day: 'numeric', month: 'long', timeZone: 'America/Caracas' });
      await this.automate('payment_reminder', { ownersOf: b.id }, { cuando, fecha }, `payment_reminder:${b.id}:${ends.toISOString().slice(0, 10)}`);
    }
  }

  /* ───────────────────────── Delivery ───────────────────────── */

  private message(body: any): Message {
    const title = clean(body?.title, 80);
    const text = clean(body?.body, 300);
    if (!title) throw new BadRequestException('Escribe un título');
    if (!text) throw new BadRequestException('Escribe el mensaje');
    return { title, body: text, url: cleanUrl(body?.url) };
  }

  private async resolve(a: Audience): Promise<Recipient[]> {
    const rows = await this.prisma.user.findMany({
      where: {
        businessId: a.mode === 'all' ? { not: null } : { in: a.businessIds ?? [] },
        role: a.who === 'owners' ? { in: OWNER_ROLES } : { notIn: NOT_TEAM },
      },
      select: { id: true, name: true, businessId: true, business: { select: { name: true } } },
    });
    return rows.map((u) => ({ id: u.id, name: u.name, businessId: u.businessId, businessName: u.business?.name ?? null }));
  }

  private async users(ids: string[]): Promise<Recipient[]> {
    if (!ids.length) return [];
    const rows = await this.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, businessId: true, business: { select: { name: true } } } });
    return rows.map((u) => ({ id: u.id, name: u.name, businessId: u.businessId, businessName: u.business?.name ?? null }));
  }

  /**
   * Personalizes and sends to each person: on their devices (web push), on any screen they
   * have open right now (socket), and in the bell. Whoever has no device yet gets it as soon
   * as they turn notifications on.
   */
  private async deliver(
    c: { kind: 'MANUAL' | 'AUTO'; trigger?: string; dedupeKey?: string; sentById?: string; audience?: Audience; title: string; body: string; url?: string | null; vars?: Record<string, string> },
    recipients: Recipient[],
  ) {
    const campaign = await this.prisma.pushCampaign.create({
      data: {
        kind: c.kind, trigger: c.trigger ?? null, dedupeKey: c.dedupeKey ?? null, sentById: c.sentById ?? null,
        title: c.title, body: c.body, url: c.url ?? null, audience: (c.audience ?? undefined) as any, recipients: recipients.length,
      },
    });

    let reached = 0;
    let devices = 0;
    const bells = new Map<string, { userId: string; title: string; body: string }>();
    for (let i = 0; i < recipients.length; i += 10) {
      const chunk = recipients.slice(i, i + 10);
      await Promise.all(chunk.map(async (r) => {
        const vars = { nombre: firstName(r.name), negocio: r.businessName ?? 'tu negocio', ...(c.vars ?? {}) };
        const title = fill(c.title, vars);
        const body = fill(c.body, vars);
        const sent = await this.push.sendToUser(r.id, { title, body, url: c.url ?? undefined, tag: campaign.id }).catch(() => 0);
        if (sent) { reached++; devices += sent; }
        await this.prisma.pushDelivery.create({
          data: { campaignId: campaign.id, userId: r.id, businessId: r.businessId, title, body, status: sent ? 'SENT' : 'PENDING', sentAt: sent ? new Date() : null },
        }).catch(() => undefined);
        // Screens open right now show it at once (the desktop app has no web push)
        this.chat.server.to(`user_${r.id}`).emit('syncroPush', { id: campaign.id, title, body, url: c.url ?? null, devices: sent });
        // The bell is shared by the team, so it carries the text without anyone's name
        if (r.businessId && !bells.has(r.businessId)) {
          const shared = { ...vars, nombre: '' };
          bells.set(r.businessId, { userId: r.id, title: fill(c.title, shared), body: fill(c.body, shared) });
        }
      }));
    }

    // One entry per business in the bell (the bell already shows a business's notices to its whole team)
    if (bells.size) {
      await this.prisma.notification.createMany({
        data: [...bells.values()].map((b) => ({ type: 'SYNCRO', title: b.title, message: b.body, userId: b.userId })),
      }).catch(() => undefined);
    }

    const done = await this.prisma.pushCampaign.update({ where: { id: campaign.id }, data: { reached, devices } });
    return { ...done, pending: recipients.length - reached, configured: this.push.configured };
  }
}

const startOfDay = (d: Date) => {
  const local = new Date(d.toLocaleString('en-US', { timeZone: 'America/Caracas' }));
  local.setHours(0, 0, 0, 0);
  return local.getTime();
};
