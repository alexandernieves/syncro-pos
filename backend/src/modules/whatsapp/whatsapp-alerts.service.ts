import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppService } from './whatsapp.service';
import { AlertGroup, GROUP_ICON, WhatsAppAlerts, groupOf, inQuietHours, normalizeAlerts } from './whatsapp-alerts.config';

type Alert = { group: AlertGroup; title: string; message: string; createdAt: Date };

/** Longest stretch looked back: after a long disconnection, old alerts aren't sent in a burst */
const MAX_LOOKBACK_MS = 12 * 3600_000;
/** The first time it's turned on, only the last minutes (never the whole history) */
const FIRST_LOOKBACK_MS = 10 * 60_000;
const MAX_LINES = 12;

/**
 * "Avisos por WhatsApp": the business's notifications (sales, fiado, payments, expenses, stock,
 * orders, till closings) forwarded to the owner's numbers through the bot's WhatsApp connection.
 *
 * Every minute it takes what was notified since the last send and sends it as one message per
 * number, so a burst of sales is one message, not twenty (WhatsApp blocks numbers that send too
 * much without the official API). During quiet hours nothing goes out; it all arrives together
 * when they end. It works from the notifications table, so nothing is lost if the server restarts.
 * Only ever to the business's own authorized numbers, never to clients.
 */
@Injectable()
export class WhatsAppAlertsService {
  private readonly logger = new Logger('WhatsAppAlerts');
  private running = false;

  constructor(private readonly prisma: PrismaService, private readonly whatsapp: WhatsAppService) {}

  @Cron('15 * * * * *')
  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const settings = await this.prisma.setting.findMany({
        where: { businessId: { not: null }, whatsappAlerts: { path: ['enabled'], equals: true } },
        select: { id: true, businessId: true, businessName: true, whatsappAlerts: true, whatsappAlertsSentAt: true, whatsappAuthorizedPhones: true },
      });
      for (const s of settings) {
        try {
          await this.forward(s);
        } catch (e: any) {
          this.logger.error(`Business ${s.businessId}: ${e.message}`);
        }
      }
    } finally {
      this.running = false;
    }
  }

  private async forward(s: { id: string; businessId: string | null; businessName: string | null; whatsappAlerts: unknown; whatsappAlertsSentAt: Date | null; whatsappAuthorizedPhones: string[] }) {
    const businessId = s.businessId!;
    const config = normalizeAlerts(s.whatsappAlerts);
    if (!config.enabled) return;
    const now = new Date();
    if (inQuietHours(config, now)) return; // they wait; the cursor doesn't move

    const advance = () => this.prisma.setting.update({ where: { id: s.id }, data: { whatsappAlertsSentAt: now } });
    const since = new Date(Math.max(s.whatsappAlertsSentAt?.getTime() ?? now.getTime() - FIRST_LOOKBACK_MS, now.getTime() - MAX_LOOKBACK_MS));
    const alerts = await this.pending(businessId, config, since, now);
    if (!alerts.length) return advance();

    const conn = await this.whatsapp.botConnection(businessId);
    if (!conn.connected) return; // tried again next minute (up to 12 hours back)
    const to = this.recipients(config, s.whatsappAuthorizedPhones, conn.phone);
    if (!to.length) return advance();

    const text = this.compose(s.businessName || 'tu negocio', alerts);
    for (const phone of to) {
      const res = await this.whatsapp.sendBotTextMessage(phone, text, businessId);
      if (!res.success) this.logger.warn(`Business ${businessId}: not sent to ${phone.slice(0, 5)}…: ${res.error}`);
      await new Promise((r) => setTimeout(r, 1500));
    }
    await advance();
  }

  /** Notifications of this business since the cursor that the owner wants on WhatsApp. */
  private async pending(businessId: string, config: WhatsAppAlerts, since: Date, until: Date): Promise<Alert[]> {
    const rows = await this.prisma.notification.findMany({
      where: {
        createdAt: { gt: since, lte: until },
        OR: [{ branch: { businessId } }, { user: { businessId } }],
      },
      orderBy: { createdAt: 'asc' },
      take: 300,
      select: { type: true, title: true, message: true, data: true, createdAt: true },
    });
    const out: Alert[] = [];
    for (const n of rows) {
      const group = groupOf(n.type, n.title);
      if (!group || !config.events[group]) continue;
      const data = (n.data ?? {}) as any;
      if (group === 'SALE') {
        if (config.saleMin > 0 && Number(data.amount ?? 0) < config.saleMin) continue;
        if (data.creditOnly && config.events.CREDIT) continue; // the fiado notice already says it
      }
      out.push({ group, title: n.title, message: this.short(group, n.message, data), createdAt: n.createdAt });
    }
    return out;
  }

  /** Sales get a shorter line than the bell's "El cajero X ha procesado una venta por…" */
  private short(group: AlertGroup, message: string, data: any) {
    if (group !== 'SALE' || typeof data.amount !== 'number') return message;
    const how: Record<string, string> = { CASH: 'efectivo', PAGO_MOVIL: 'pago móvil', CARD: 'tarjeta', TRANSFER: 'transferencia', CREDIT: 'fiado', BINANCE: 'Binance', ZINLI: 'Zinli', PAYPAL: 'PayPal', WALLET: 'monedero' };
    const methods = Array.isArray(data.methods) ? data.methods.map((m: string) => how[m] ?? m).join(' + ') : '';
    return `Venta de $${data.amount.toFixed(2)}${methods ? ` en ${methods}` : ''}${data.cashier ? ` · cobró ${data.cashier}` : ''}.`;
  }

  private recipients(config: WhatsAppAlerts, authorized: string[], selfPhone: string | null) {
    const allowed = new Set((authorized ?? []).map((p) => p.replace(/\D/g, '')));
    const to = config.recipients.filter((p) => allowed.has(p));
    if (config.self && selfPhone) to.push(selfPhone);
    return [...new Set(to)];
  }

  private compose(business: string, alerts: Alert[]) {
    const hour = (d: Date) => d.toLocaleTimeString('es-VE', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Caracas' });
    if (alerts.length === 1) {
      const a = alerts[0];
      return `🔔 *${business}*\n\n${GROUP_ICON[a.group]} *${a.title}*\n${a.message}\n_${hour(a.createdAt)}_`;
    }
    const shown = alerts.slice(-MAX_LINES);
    const lines = shown.map((a) => `${GROUP_ICON[a.group]} *${a.title}* · _${hour(a.createdAt)}_\n${a.message}`);
    const more = alerts.length - shown.length;
    return `🔔 *${business}* · ${alerts.length} avisos\n\n${lines.join('\n\n')}${more > 0 ? `\n\n…y ${more} avisos más en Syncro.` : ''}`;
  }

  /** "Enviar mensaje de prueba" from Configuración, with what's on the screen (saved or not). */
  async sendTest(businessId: string, raw: unknown) {
    const config = normalizeAlerts(raw);
    const setting = await this.prisma.setting.findFirst({ where: { businessId }, select: { businessName: true, whatsappAuthorizedPhones: true } });
    const conn = await this.whatsapp.botConnection(businessId);
    if (!conn.connected) throw new ConflictException('El WhatsApp del bot no está conectado. Escanea el código QR primero.');
    const to = this.recipients(config, setting?.whatsappAuthorizedPhones ?? [], conn.phone);
    if (!to.length) throw new BadRequestException('Elige al menos un número para recibir los avisos.');
    const text = `🔔 *${setting?.businessName || 'Syncro'}*\n\n✅ *Prueba de avisos*\nAsí te llegarán las notificaciones de Syncro por WhatsApp.`;
    const sent: string[] = [];
    const failed: string[] = [];
    for (const phone of to) {
      const res = await this.whatsapp.sendBotTextMessage(phone, text, businessId);
      (res.success ? sent : failed).push(phone);
    }
    return { sent, failed };
  }
}
