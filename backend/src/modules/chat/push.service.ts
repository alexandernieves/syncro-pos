import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import * as webpush from 'web-push';

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    const email = this.config.get<string>('VAPID_EMAIL');
    const publicKey = this.config.get<string>('VAPID_PUBLIC_KEY');
    const privateKey = this.config.get<string>('VAPID_PRIVATE_KEY');
    // Without the keys the server still starts; browser notifications just stay off
    if (email && publicKey && privateKey) {
      webpush.setVapidDetails(email.includes(':') ? email : `mailto:${email}`, publicKey, privateKey);
      this.enabled = true;
    } else {
      this.logger.warn('VAPID_EMAIL, VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY missing: push notifications are off');
    }
  }

  private enabled = false;

  async subscribe(userId: string, subscription: { endpoint: string; keys: { p256dh: string; auth: string } }) {
    return this.prisma.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      update: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
      create: {
        userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
    });
  }

  async unsubscribe(endpoint: string) {
    return this.prisma.pushSubscription.deleteMany({ where: { endpoint } });
  }

  async sendToUser(userId: string, payload: { title: string; body: string; icon?: string; url?: string }) {
    if (!this.enabled) return [];
    const subscriptions = await this.prisma.pushSubscription.findMany({ where: { userId } });

    const results = await Promise.allSettled(
      subscriptions.map((sub) =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({ ...payload, icon: payload.icon || '/syncro.png' }),
        ),
      ),
    );

    // Remove expired subscriptions
    results.forEach((result, i) => {
      if (result.status === 'rejected') {
        const err = result.reason as any;
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          this.prisma.pushSubscription
            .deleteMany({ where: { endpoint: subscriptions[i].endpoint } })
            .catch(() => {});
        }
      }
    });
  }
}
