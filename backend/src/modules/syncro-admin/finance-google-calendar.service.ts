import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { financeNubiSecret } from './finance-nubi-transport';

export type GoogleCalendarTokenData = {
  refreshToken: string;
  accessToken?: string;
  expiresAt?: number;
  email?: string | null;
};

export type CalendarEventInput = {
  summary: string;
  date: string; // YYYY-MM-DD
  startTime?: string | null; // HH:mm (optional -> all-day if omitted)
  durationMinutes?: number;
  description?: string | null;
};

const TIMEZONE = 'America/Caracas';
const SCOPE = 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/userinfo.email';

@Injectable()
export class FinanceGoogleCalendarService {
  private readonly logger = new Logger(FinanceGoogleCalendarService.name);

  constructor(private readonly prisma: PrismaService) {}

  isConfigured() {
    return Boolean(process.env.GOOGLE_CALENDAR_CLIENT_ID && process.env.GOOGLE_CALENDAR_CLIENT_SECRET);
  }

  private redirectUri() {
    if (process.env.GOOGLE_CALENDAR_REDIRECT_URI) return process.env.GOOGLE_CALENDAR_REDIRECT_URI;
    const root =
      process.env.SYNCRO_FINANCE_WHATSAPP_BACKEND_URL ??
      process.env.BACKEND_WEBHOOK_URL?.replace(/\/whatsapp\/webhook\/?$/, '') ??
      process.env.BACKEND_URL;
    if (!root) throw new ServiceUnavailableException('Configura GOOGLE_CALENDAR_REDIRECT_URI en el backend');
    return new URL('/syncro-admin/finance-nubi/google/callback', root).toString();
  }

  private signState(payload: string) {
    const secret = process.env.JWT_SECRET || financeNubiSecret();
    return createHmac('sha256', secret).update(`gcal:${payload}`).digest('base64url');
  }

  buildAuthUrl(userId: string) {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException('Falta configurar GOOGLE_CALENDAR_CLIENT_ID y GOOGLE_CALENDAR_CLIENT_SECRET en el servidor.');
    }
    const payload = Buffer.from(JSON.stringify({ userId, exp: Date.now() + 10 * 60_000 })).toString('base64url');
    const state = `${payload}.${this.signState(payload)}`;
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', process.env.GOOGLE_CALENDAR_CLIENT_ID!);
    url.searchParams.set('redirect_uri', this.redirectUri());
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', SCOPE);
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('prompt', 'consent');
    url.searchParams.set('state', state);
    return url.toString();
  }

  async handleCallback(code: string, state: string) {
    if (!this.isConfigured()) throw new ServiceUnavailableException('Google Calendar no está configurado');
    const [payload, sig] = String(state || '').split('.');
    if (!payload || !sig) throw new BadRequestException('Estado OAuth inválido');
    const expected = this.signState(payload);
    if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      throw new BadRequestException('Firma OAuth inválida');
    }
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { userId?: string; exp?: number };
    if (!parsed.userId || !parsed.exp || parsed.exp < Date.now()) {
      throw new BadRequestException('El enlace de conexión venció. Intenta de nuevo desde Syncro.');
    }

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CALENDAR_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET!,
        redirect_uri: this.redirectUri(),
        grant_type: 'authorization_code',
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const tokenJson = await tokenRes.json().catch(() => null);
    if (!tokenRes.ok || !tokenJson?.access_token) {
      throw new BadRequestException('Google no pudo completar la autorización.');
    }

    let email: string | null = null;
    try {
      const info = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokenJson.access_token}` },
        signal: AbortSignal.timeout(8_000),
      });
      if (info.ok) {
        const userInfo = await info.json();
        if (typeof userInfo?.email === 'string') email = userInfo.email;
      }
    } catch {
      // Optional email display
    }

    const scope = `personal:${parsed.userId}`;
    const existing = await this.prisma.centralFinancePlan.findUnique({ where: { scope } });
    const data = (existing?.data ?? { income: 0, grocery: 0, dining: 0, reserve: 0, payday1: 15, payday2: 31, obligations: [], debts: [] }) as Record<string, any>;
    const prevRefresh = data.googleCalendar?.refreshToken;
    const refreshToken = tokenJson.refresh_token || prevRefresh;
    if (!refreshToken) {
      throw new BadRequestException('Google no devolvió refresh_token. Revoca el acceso previo en tu cuenta Google e intenta de nuevo.');
    }

    const googleCalendar: GoogleCalendarTokenData = {
      refreshToken,
      accessToken: tokenJson.access_token,
      expiresAt: Date.now() + Math.max(60, Number(tokenJson.expires_in ?? 3500) - 120) * 1000,
      email,
    };

    const updated = { ...data, googleCalendar };
    await this.prisma.centralFinancePlan.upsert({
      where: { scope },
      create: { scope, data: updated as Prisma.InputJsonObject },
      update: { data: updated as Prisma.InputJsonObject },
    });
    return { email };
  }

  async getStatus(userId: string) {
    const scope = `personal:${userId}`;
    const existing = await this.prisma.centralFinancePlan.findUnique({ where: { scope } });
    const gcal = (existing?.data as Record<string, any> | null)?.googleCalendar as GoogleCalendarTokenData | undefined;
    return {
      configured: this.isConfigured(),
      connected: Boolean(gcal?.refreshToken),
      email: gcal?.email ?? null,
    };
  }

  async disconnect(userId: string) {
    const scope = `personal:${userId}`;
    const existing = await this.prisma.centralFinancePlan.findUnique({ where: { scope } });
    if (!existing) return { ok: true };
    const data = { ...((existing.data ?? {}) as Record<string, any>) };
    delete data.googleCalendar;
    await this.prisma.centralFinancePlan.update({
      where: { scope },
      data: { data: data as Prisma.InputJsonObject },
    });
    return { ok: true };
  }

  private async getAccessToken(userId: string): Promise<string | null> {
    if (!this.isConfigured()) return null;
    const scope = `personal:${userId}`;
    const existing = await this.prisma.centralFinancePlan.findUnique({ where: { scope } });
    const data = (existing?.data ?? {}) as Record<string, any>;
    const gcal = data.googleCalendar as GoogleCalendarTokenData | undefined;
    if (!gcal?.refreshToken) return null;
    if (gcal.accessToken && gcal.expiresAt && gcal.expiresAt > Date.now()) {
      return gcal.accessToken;
    }
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CALENDAR_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET!,
        refresh_token: gcal.refreshToken,
        grant_type: 'refresh_token',
      }),
      signal: AbortSignal.timeout(12_000),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.access_token) {
      this.logger.warn(`Google Calendar token refresh failed for user ${userId}`);
      return null;
    }
    const updated = {
      ...data,
      googleCalendar: {
        ...gcal,
        accessToken: json.access_token,
        expiresAt: Date.now() + Math.max(60, Number(json.expires_in ?? 3500) - 120) * 1000,
      },
    };
    await this.prisma.centralFinancePlan.update({
      where: { scope },
      data: { data: updated as Prisma.InputJsonObject },
    });
    return json.access_token as string;
  }

  async createEvent(userId: string, input: CalendarEventInput): Promise<{ id: string; htmlLink?: string }> {
    const token = await this.getAccessToken(userId);
    if (!token) {
      throw new Error('Tu Google Calendar aún no está conectado. Conéctalo en Syncro Central → Finanzas → Nubi WhatsApp.');
    }
    const duration = Math.max(15, Math.min(480, Math.round(input.durationMinutes ?? 60)));
    let start: Record<string, string>;
    let end: Record<string, string>;
    if (input.startTime && /^\d{2}:\d{2}$/.test(input.startTime)) {
      const startIso = `${input.date}T${input.startTime}:00-04:00`;
      const endMs = Date.parse(startIso) + duration * 60_000;
      const endParts = new Intl.DateTimeFormat('en-CA', {
        timeZone: TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).formatToParts(new Date(endMs));
      const p = (type: string) => endParts.find(x => x.type === type)?.value ?? '00';
      const endIso = `${p('year')}-${p('month')}-${p('day')}T${p('hour')}:${p('minute')}:00-04:00`;
      start = { dateTime: startIso, timeZone: TIMEZONE };
      end = { dateTime: endIso, timeZone: TIMEZONE };
    } else {
      const nextDay = new Date(Date.parse(`${input.date}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
      start = { date: input.date };
      end = { date: nextDay };
    }

    const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        summary: input.summary.slice(0, 200),
        description: input.description?.slice(0, 500) || 'Agendado por Nubi Finanzas',
        start,
        end,
        reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 30 }] },
      }),
      signal: AbortSignal.timeout(12_000),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.id) {
      throw new Error('Google Calendar no pudo crear el evento. Intenta reconectar tu cuenta.');
    }
    return { id: json.id, htmlLink: json.htmlLink };
  }

  async listUpcomingEvents(userId: string, days = 3): Promise<{ summary: string; start: string }[]> {
    const token = await this.getAccessToken(userId);
    if (!token) return [];
    const now = new Date();
    const max = new Date(now.getTime() + days * 86_400_000);
    const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
    url.searchParams.set('timeMin', now.toISOString());
    url.searchParams.set('timeMax', max.toISOString());
    url.searchParams.set('singleEvents', 'true');
    url.searchParams.set('orderBy', 'startTime');
    url.searchParams.set('maxResults', '10');
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8_000),
    }).catch(() => null);
    if (!res?.ok) return [];
    const json = await res.json().catch(() => null);
    const items = Array.isArray(json?.items) ? json.items : [];
    return items.map((item: any) => ({
      summary: String(item.summary || 'Evento sin título'),
      start: String(item.start?.dateTime || item.start?.date || ''),
    }));
  }
}
