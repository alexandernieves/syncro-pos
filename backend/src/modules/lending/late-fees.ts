/**
 * Charges for late installments, configured by each business in Configuración → Syncro Credit.
 *
 * Once an installment is late (past its due date plus the grace days) it can get:
 *  - a fixed charge, once;
 *  - a percentage of the installment, once;
 *  - late interest: a percentage of what is still unpaid of the installment, every N days;
 *  - the business's own charges (name, fixed $ or % of the installment, once or every N days).
 * A cap (percentage of the installment) limits everything charged on one installment.
 * Nothing is charged for days before the policy was turned on ("since").
 */
export type LateExtra = { id: string; name: string; type: 'fixed' | 'percent'; amount: number; when: 'once' | 'every'; everyDays: number };
export type LateFeePolicy = {
  enabled: boolean;
  since: string | null;
  graceDays: number;
  fixedFee: number;
  percentFee: number;
  interestPct: number;
  interestEveryDays: number;
  capPct: number;
  extras: LateExtra[];
};

export const LATE_FEES_OFF: LateFeePolicy = {
  enabled: false, since: null, graceDays: 3, fixedFee: 0, percentFee: 0, interestPct: 0, interestEveryDays: 7, capPct: 50, extras: [],
};

const num = (v: unknown, min: number, max: number, dflt: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n * 100) / 100)) : dflt;
};
const int = (v: unknown, min: number, max: number, dflt: number) => Math.round(num(v, min, max, dflt));

/** Only sane values are stored (and read back), whatever arrives */
export function cleanLateFees(raw: any): LateFeePolicy {
  if (!raw || typeof raw !== 'object') return { ...LATE_FEES_OFF };
  const extras: LateExtra[] = (Array.isArray(raw.extras) ? raw.extras : [])
    .slice(0, 8)
    .map((e: any, i: number) => {
      const type: LateExtra['type'] = e?.type === 'percent' ? 'percent' : 'fixed';
      return {
        id: String(e?.id || `x${Date.now().toString(36)}${i}`).replace(/[^\w-]/g, '').slice(0, 24) || `x${i}`,
        name: String(e?.name || '').trim().slice(0, 40),
        type,
        amount: type === 'percent' ? num(e?.amount, 0, 100, 0) : num(e?.amount, 0, 10000, 0),
        when: e?.when === 'every' ? 'every' : 'once',
        everyDays: int(e?.everyDays, 1, 90, 7),
      } as LateExtra;
    })
    .filter((e: LateExtra) => e.name && e.amount > 0);
  return {
    enabled: !!raw.enabled,
    since: typeof raw.since === 'string' && !Number.isNaN(Date.parse(raw.since)) ? raw.since : null,
    graceDays: int(raw.graceDays, 0, 60, 3),
    fixedFee: num(raw.fixedFee, 0, 10000, 0),
    percentFee: num(raw.percentFee, 0, 100, 0),
    interestPct: num(raw.interestPct, 0, 100, 0),
    interestEveryDays: int(raw.interestEveryDays, 1, 90, 7),
    capPct: num(raw.capPct, 0, 1000, 50),
    extras,
  };
}

const DAY = 86400000;
const round2 = (n: number) => Math.round(n * 100) / 100;
export type WantedCharge = { kind: string; ref: string; name: string; period: number; amount: number };

/**
 * Every charge an installment should have by `now` (already-applied ones are filtered by the caller).
 * `base` is the original installment; `unpaid` what is still owed of it (for the interest).
 */
export function chargesDue(p: LateFeePolicy, dueDate: Date, base: number, unpaid: number, now: Date): WantedCharge[] {
  if (!p.enabled || base <= 0) return [];
  // late from the end of the grace days, but never counting days before the policy was turned on
  const lateFrom = Math.max(dueDate.getTime() + p.graceDays * DAY, p.since ? Date.parse(p.since) : 0);
  if (now.getTime() <= lateFrom) return [];
  // the first period starts the moment it becomes late; each further one after every N full days
  const periods = (every: number) => Math.max(1, Math.ceil((now.getTime() - lateFrom) / (every * DAY)));
  const out: WantedCharge[] = [];
  if (p.fixedFee > 0) out.push({ kind: 'FEE_FIXED', ref: 'fixed', name: 'Cargo por atraso', period: 1, amount: p.fixedFee });
  if (p.percentFee > 0) out.push({ kind: 'FEE_PCT', ref: 'pct', name: `Cargo por atraso (${p.percentFee}%)`, period: 1, amount: round2((base * p.percentFee) / 100) });
  if (p.interestPct > 0 && unpaid > 0.004) {
    const each = round2((unpaid * p.interestPct) / 100);
    for (let k = 1; k <= periods(p.interestEveryDays); k++) out.push({ kind: 'INTEREST', ref: 'interest', name: `Interés por mora (${p.interestPct}%)`, period: k, amount: each });
  }
  for (const e of p.extras) {
    const amount = e.type === 'percent' ? round2((base * e.amount) / 100) : e.amount;
    const n = e.when === 'every' ? periods(e.everyDays) : 1;
    for (let k = 1; k <= n; k++) out.push({ kind: 'EXTRA', ref: e.id, name: e.name, period: k, amount });
  }
  return out.filter((c) => c.amount > 0.004);
}
