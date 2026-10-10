import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { ClassNoticeKind, GymRemindersService } from './gym-reminders.service';

type Notice = { memberId: string; extra?: { motivo?: string; antes?: string } };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * WhatsApp notices to members about their classes. They go out in the background,
 * one by one with a pause, so the screen that triggered them answers at once.
 */
@Injectable()
export class GymNotificationsService {
  private readonly logger = new Logger('GymNotices');
  /** One queue per business, so two cancellations don't send at the same time. */
  private queues = new Map<string, Promise<void>>();
  /** Schedule changes wait a minute: an undo or a second drag sends one message, or none. */
  private pendingMoves = new Map<string, { timer: NodeJS.Timeout; originalStart: Date }>();
  static readonly MOVE_DELAY_MS = 60_000;

  constructor(
    private prisma: PrismaService,
    private whatsapp: WhatsAppService,
    private settings: GymRemindersService,
  ) {}

  /** Formats a session time the way members read it: "martes 14 de octubre, 6:30 p. m." */
  static when(date: Date, timeZone: string) {
    const day = date.toLocaleDateString('es-VE', { timeZone, weekday: 'long', day: 'numeric', month: 'long' });
    const time = date.toLocaleTimeString('es-VE', { timeZone, hour: 'numeric', minute: '2-digit' });
    return `${day}, ${time}`;
  }

  /** Queues a notice for each member. Returns how many will be attempted. */
  async notify(businessId: string, sessionId: string, kind: ClassNoticeKind, notices: Notice[]) {
    if (!notices.length) return 0;
    const settings = await this.settings.getSettings(businessId);
    if (!settings.notices[kind]) return 0;
    const previous = this.queues.get(businessId) ?? Promise.resolve();
    const run = previous
      .then(() => this.send(businessId, sessionId, kind, notices))
      .catch((e) => this.logger.warn(`Notices ${kind} for session ${sessionId} failed: ${e.message}`));
    this.queues.set(businessId, run);
    run.finally(() => this.queues.get(businessId) === run && this.queues.delete(businessId));
    return notices.length;
  }

  /** Notice for a session dragged to another time. Sent after a pause, with the time it had before the first move. */
  async notifyMoved(businessId: string, sessionId: string, previousStart: Date) {
    const settings = await this.settings.getSettings(businessId);
    if (!settings.notices.CLASS_MOVED) return 0;
    const pending = this.pendingMoves.get(sessionId);
    if (pending) clearTimeout(pending.timer);
    const originalStart = pending?.originalStart ?? previousStart;
    const timer = setTimeout(async () => {
      this.pendingMoves.delete(sessionId);
      try {
        const session = await this.prisma.gymClassSession.findFirst({ where: { id: sessionId, businessId } });
        // Back where it was, or cancelled meanwhile: nothing to tell
        if (!session || session.status !== 'SCHEDULED' || session.startsAt.getTime() === originalStart.getTime()) return;
        const rows = await this.prisma.gymBooking.findMany({ where: { sessionId, status: { in: ['BOOKED', 'WAITLIST'] } }, select: { memberId: true } });
        const antes = GymNotificationsService.when(originalStart, settings.timeZone);
        await this.notify(businessId, sessionId, 'CLASS_MOVED', rows.map((r) => ({ memberId: r.memberId, extra: { antes } })));
      } catch (e) {
        this.logger.warn(`Move notice for session ${sessionId} failed: ${e.message}`);
      }
    }, GymNotificationsService.MOVE_DELAY_MS);
    this.pendingMoves.set(sessionId, { timer, originalStart });
    return this.prisma.gymBooking.count({ where: { sessionId, status: { in: ['BOOKED', 'WAITLIST'] } } });
  }

  private async send(businessId: string, sessionId: string, kind: ClassNoticeKind, notices: Notice[]) {
    const settings = await this.settings.getSettings(businessId);
    const session = await this.prisma.gymClassSession.findFirst({ where: { id: sessionId, businessId }, include: { class: { select: { name: true } } } });
    if (!session) return;
    const businessName = (await this.prisma.setting.findFirst({ where: { businessId }, select: { businessName: true } }))?.businessName || 'tu gimnasio';
    const members = await this.prisma.gymMember.findMany({
      where: { businessId, id: { in: notices.map((n) => n.memberId) } },
      include: { client: { select: { name: true, phone: true } } },
    });
    const connected = (await this.whatsapp.getStatus(businessId).catch(() => ({ connected: false }))).connected;

    for (const [i, notice] of notices.entries()) {
      const member = members.find((m) => m.id === notice.memberId);
      if (!member) continue;
      const text = settings.notices.templates[kind]
        .replace(/\{nombre\}/g, member.client.name.trim().split(/\s+/)[0] || member.client.name)
        .replace(/\{clase\}/g, session.class.name)
        .replace(/\{fecha\}/g, GymNotificationsService.when(session.startsAt, settings.timeZone))
        .replace(/\{antes\}/g, notice.extra?.antes ?? '')
        .replace(/\{motivo\}/g, notice.extra?.motivo ? ` Motivo: ${notice.extra.motivo}.` : '')
        .replace(/\{gimnasio\}/g, businessName);
      const base = { businessId, memberId: member.id, sessionId, kind, phone: member.client.phone, text };

      if (!member.client.phone || !connected) {
        await this.prisma.gymNotification.create({ data: { ...base, status: 'SKIPPED', error: !member.client.phone ? 'El socio no tiene WhatsApp' : 'WhatsApp desconectado' } });
        continue;
      }
      if (i > 0) await sleep(3000 + Math.random() * 2000);
      try {
        await this.whatsapp.sendTextMessage(member.client.phone, text, businessId);
        await this.prisma.gymNotification.create({ data: { ...base, status: 'SENT' } });
      } catch (e) {
        await this.prisma.gymNotification.create({ data: { ...base, status: 'FAILED', error: String(e.message).slice(0, 300) } });
      }
    }
  }

  list(businessId: string, sessionId?: string) {
    return this.prisma.gymNotification.findMany({
      where: { businessId, ...(sessionId && { sessionId }) },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { member: { select: { id: true, memberNumber: true, client: { select: { name: true } } } } },
    });
  }
}
