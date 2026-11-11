import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import * as webpush from 'web-push';

export type PushPayload = { title: string; body: string; icon?: string; url?: string; tag?: string };

/** Notifications that wait for someone to turn them on are delivered for this long. */
const PENDING_DAYS = 7;

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private enabled = false;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    const email = this.config.get<string>('VAPID_EMAIL');
    const publicKey = this.config.get<string>('VAPID_PUBLIC_KEY');
    const privateKey = this.config.get<string>('VAPID_PRIVATE_KEY');
    // Without the keys the server still starts; browser notifications just stay off
    if (email && publicKey && privateKey) {
      try {
        webpush.setVapidDetails(email.includes(':') ? email : `mailto:${email}`, publicKey, privateKey);
        this.enabled = true;
      } catch (err: any) {
        this.logger.error(`Invalid VAPID keys, push notifications are off: ${err.message}`);
      }
    } else {
      this.logger.warn('VAPID_EMAIL, VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY missing: push notifications are off');
    }
  }

  /** True when the server has its VAPID keys and can send. */
  get configured() {
    return this.enabled;
  }

  /**
   * Saves this device for the signed-in user. A shared computer moves to whoever signed in last.
   * Then hands over what was waiting for them (the welcome, an announcement sent before they
   * turned notifications on).
   */
  async subscribe(userId: string, subscription: { endpoint: string; keys: { p256dh: string; auth: string } }, userAgent?: string) {
    const ua = userAgent ? userAgent.slice(0, 300) : null;
    await this.prisma.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      update: { userId, p256dh: subscription.keys.p256dh, auth: subscription.keys.auth, userAgent: ua },
      create: { userId, endpoint: subscription.endpoint, p256dh: subscription.keys.p256dh, auth: subscription.keys.auth, userAgent: ua },
    });
    const delivered = await this.flushPending(userId);
    return { ok: true, delivered };
  }

  async unsubscribe(userId: string, endpoint: string) {
    return this.prisma.pushSubscription.deleteMany({ where: { endpoint, userId } });
  }

  /** How many devices this user has signed up for push. */
  deviceCount(userId: string) {
    return this.prisma.pushSubscription.count({ where: { userId } });
  }

  /** Sends to every device of a user. Returns how many devices accepted it. */
  async sendToUser(userId: string, payload: PushPayload): Promise<number> {
    if (!this.enabled) return 0;
    const subscriptions = await this.prisma.pushSubscription.findMany({ where: { userId } });
    if (!subscriptions.length) return 0;

    const body = JSON.stringify({ ...payload, icon: payload.icon || '/syncro.png' });
    const results = await Promise.allSettled(
      subscriptions.map((sub) =>
        webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, body, { TTL: 60 * 60 * 24 * 3 }),
      ),
    );

    let ok = 0;
    results.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        ok++;
        return;
      }
      const err = result.reason as any;
      // The browser dropped this subscription: forget it
      if (err?.statusCode === 410 || err?.statusCode === 404) {
        this.prisma.pushSubscription.deleteMany({ where: { endpoint: subscriptions[i].endpoint } }).catch(() => undefined);
      } else {
        this.logger.warn(`Push to ${userId} failed: ${err?.statusCode ?? ''} ${err?.body ?? err?.message ?? err}`);
      }
    });
    return ok;
  }

  /** Delivers the notifications that were waiting for this user to have a device. */
  async flushPending(userId: string) {
    if (!this.enabled) return 0;
    const since = new Date(Date.now() - PENDING_DAYS * 86_400_000);
    const pending = await this.prisma.pushDelivery.findMany({
      where: { userId, status: 'PENDING', createdAt: { gte: since } },
      include: { campaign: { select: { id: true, url: true } } },
      orderBy: { createdAt: 'asc' },
      take: 5,
    });
    let delivered = 0;
    for (const d of pending) {
      const devices = await this.sendToUser(userId, { title: d.title, body: d.body, url: d.campaign.url ?? undefined, tag: d.campaign.id });
      if (!devices) continue;
      delivered++;
      await this.prisma.pushDelivery.update({ where: { id: d.id }, data: { status: 'SENT', sentAt: new Date() } });
      await this.prisma.pushCampaign.update({ where: { id: d.campaignId }, data: { reached: { increment: 1 }, devices: { increment: devices } } });
    }
    return delivered;
  }

  /** Whether an automatic notification is switched on in Syncro central (on unless turned off). */
  async automationOn(key: string) {
    const row = await this.prisma.pushAutomation.findUnique({ where: { key }, select: { enabled: true } }).catch(() => null);
    return row?.enabled ?? true;
  }
}
