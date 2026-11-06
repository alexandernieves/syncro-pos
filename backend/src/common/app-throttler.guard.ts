import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Rate limit per client IP. Sign-in attempts also count per account, so switching
 * between two accounts from the same office doesn't lock both out.
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const ip = req.ip ?? 'unknown';
    const path: string = req.originalUrl ?? req.url ?? '';
    if (/\/auth\/login\/?(\?|$)/.test(path)) {
      const email = String(req.body?.email ?? '').trim().toLowerCase();
      return `${ip}|${email}`;
    }
    return ip;
  }
}
