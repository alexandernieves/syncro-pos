/**
 * "Avisos por WhatsApp": which of the business's notifications are forwarded to WhatsApp, to whom,
 * and when not to (quiet hours). Kept in Setting.whatsappAlerts.
 */
export const ALERT_GROUPS = ['SALE', 'CREDIT', 'CREDIT_PAYMENT', 'EXPENSE', 'STOCK', 'ORDERS', 'CASH'] as const;
export type AlertGroup = (typeof ALERT_GROUPS)[number];

export type WhatsAppAlerts = {
  enabled: boolean;
  /** Numbers (digits only) from the bot's authorized list that receive the alerts */
  recipients: string[];
  /** Also to the number that scanned the QR (its "You" chat: WhatsApp doesn't ring for those) */
  self: boolean;
  events: Record<AlertGroup, boolean>;
  /** Sales below this amount (USD) are not sent; 0 = every sale */
  saleMin: number;
  quiet: { enabled: boolean; from: string; to: string };
};

export const DEFAULT_ALERTS: WhatsAppAlerts = {
  enabled: false,
  recipients: [],
  self: false,
  events: { SALE: false, CREDIT: true, CREDIT_PAYMENT: true, EXPENSE: true, STOCK: true, ORDERS: true, CASH: true },
  saleMin: 0,
  quiet: { enabled: true, from: '22:00', to: '06:00' },
};

const time = (v: unknown, fallback: string) => (typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : fallback);

/** Whatever comes from the screen (or an old value), as a valid configuration. */
export function normalizeAlerts(raw: unknown): WhatsAppAlerts {
  const r = (raw && typeof raw === 'object' ? raw : {}) as any;
  const events = { ...DEFAULT_ALERTS.events };
  for (const g of ALERT_GROUPS) if (typeof r.events?.[g] === 'boolean') events[g] = r.events[g];
  const min = Number(r.saleMin);
  return {
    enabled: r.enabled === true,
    recipients: Array.isArray(r.recipients) ? [...new Set(r.recipients.map((p: unknown) => String(p ?? '').replace(/\D/g, '')).filter((p: string) => p.length >= 8 && p.length <= 15))].slice(0, 10) as string[] : [],
    self: r.self === true,
    events,
    saleMin: Number.isFinite(min) && min > 0 ? Math.min(min, 1_000_000) : 0,
    quiet: {
      enabled: r.quiet?.enabled !== false,
      from: time(r.quiet?.from, DEFAULT_ALERTS.quiet.from),
      to: time(r.quiet?.to, DEFAULT_ALERTS.quiet.to),
    },
  };
}

/** Which switch a notification belongs to (null: never forwarded). */
export function groupOf(type: string, title: string): AlertGroup | null {
  switch (type) {
    case 'SALE': return 'SALE';
    case 'CREDIT': return 'CREDIT';
    case 'CREDIT_PAYMENT': return 'CREDIT_PAYMENT';
    case 'EXPENSE':
    case 'EXPENSE_ALERT': return 'EXPENSE';
    case 'STOCK_ALERT': return 'STOCK';
    case 'SYNCRO_SHOP_ORDER': return 'ORDERS';
    case 'SHIFT_CLOSED':
    case 'SHIFT_ALERT': return 'CASH';
    case 'ALERT': return /abono/i.test(title) ? 'CREDIT_PAYMENT' : /pedido|delivery/i.test(title) ? 'ORDERS' : null;
    default: return null;
  }
}

export const GROUP_ICON: Record<AlertGroup, string> = {
  SALE: '💰',
  CREDIT: '📒',
  CREDIT_PAYMENT: '✅',
  EXPENSE: '💸',
  STOCK: '📦',
  ORDERS: '🛵',
  CASH: '🧾',
};

/** Minutes since midnight in Venezuela (UTC-4, no daylight saving). */
export const caracasMinutes = (d = new Date()) => {
  const x = new Date(d.getTime() - 4 * 3600000);
  return x.getUTCHours() * 60 + x.getUTCMinutes();
};
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

/** Inside the quiet hours (they may cross midnight, e.g. 22:00 → 06:00). */
export function inQuietHours(a: WhatsAppAlerts, d = new Date()) {
  if (!a.quiet.enabled) return false;
  const now = caracasMinutes(d);
  const from = toMin(a.quiet.from);
  const to = toMin(a.quiet.to);
  if (from === to) return false;
  return from < to ? now >= from && now < to : now >= from || now < to;
}
