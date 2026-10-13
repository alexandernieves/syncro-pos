/**
 * Currencies the business takes in cash. Amounts are kept in USD everywhere; these helpers
 * convert to and from what physically goes in the drawer.
 */
export type Currency = 'USD' | 'VES' | 'EUR' | 'COP';
export const CURRENCIES: Currency[] = ['USD', 'VES', 'EUR', 'COP'];
export const isCurrency = (c: unknown): c is Currency => typeof c === 'string' && (CURRENCIES as string[]).includes(c);

/** Táchira trades in Colombian pesos too; the rest of Venezuela in bolívares, dollars and euros. */
export const isTachira = (state?: string | null) =>
  !!state && state.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().includes('tachira');

export const branchCurrencies = (state?: string | null): Currency[] => (isTachira(state) ? ['USD', 'VES', 'EUR', 'COP'] : ['USD', 'VES', 'EUR']);

/** Units of each currency per dollar. */
export type Rates = Record<Currency, number>;

type RateSettings = { exchangeRate?: number | null; exchangeRateEur?: number | null; exchangeRateCop?: number | null; copRateManual?: number | null } | null | undefined;

/** Rates the cash drawer uses (the POS ones): BCV for VES and EUR, and the business's COP rate. */
export function ratesFrom(s: RateSettings): Rates {
  const ves = Number(s?.exchangeRate) > 0 ? Number(s!.exchangeRate) : 1;
  const eurVes = Number(s?.exchangeRateEur) > 0 ? Number(s!.exchangeRateEur) : ves;
  const cop = Number(s?.copRateManual) > 0 ? Number(s!.copRateManual) : Number(s?.exchangeRateCop) > 0 ? Number(s!.exchangeRateCop) : 0;
  return { USD: 1, VES: ves, EUR: ves / eurVes, COP: cop };
}

export const round2 = (n: number) => Math.round(n * 100) / 100;
export const toUsd = (amount: number, cur: Currency, r: Rates) => (r[cur] > 0 ? amount / r[cur] : 0);
export const fromUsd = (usd: number, cur: Currency, r: Rates) => round2(usd * r[cur]);

export type CashByCurrency = Partial<Record<Currency, number>>;

/** Only known currencies with finite, non-negative amounts. */
export function cleanCash(input: unknown): CashByCurrency {
  const out: CashByCurrency = {};
  if (!input || typeof input !== 'object') return out;
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    const n = Number(v);
    if (isCurrency(k) && Number.isFinite(n) && n >= 0) out[k] = round2(n);
  }
  return out;
}

export const cashToUsd = (cash: CashByCurrency, r: Rates) =>
  round2(Object.entries(cash).reduce((sum, [c, v]) => sum + toUsd(Number(v) || 0, c as Currency, r), 0));
