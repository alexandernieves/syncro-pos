/**
 * Currencies taken in cash. Amounts live in dollars; these convert to what goes in the drawer.
 * Táchira also trades in Colombian pesos.
 */
export type Currency = "USD" | "VES" | "EUR" | "COP";

export const CURRENCY_META: Record<Currency, { label: string; short: string; symbol: string; decimals: number }> = {
  USD: { label: "Dólares", short: "USD", symbol: "$", decimals: 2 },
  VES: { label: "Bolívares", short: "Bs", symbol: "Bs", decimals: 2 },
  EUR: { label: "Euros", short: "EUR", symbol: "€", decimals: 2 },
  COP: { label: "Pesos colombianos", short: "COP", symbol: "COP", decimals: 0 },
};

export const isTachira = (state?: string | null) =>
  !!state && state.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().includes("tachira");

export const branchCurrencies = (state?: string | null): Currency[] => (isTachira(state) ? ["USD", "VES", "EUR", "COP"] : ["USD", "VES", "EUR"]);

/** Units of each currency per dollar. */
export type Rates = Record<Currency, number>;

export function ratesFrom(s: { exchangeRate?: number; exchangeRateEur?: number; exchangeRateCop?: number; copRateManual?: number | null } | null | undefined): Rates {
  const ves = Number(s?.exchangeRate) > 0 ? Number(s!.exchangeRate) : 1;
  const eurVes = Number(s?.exchangeRateEur) > 0 ? Number(s!.exchangeRateEur) : ves;
  const cop = Number(s?.copRateManual) > 0 ? Number(s!.copRateManual) : Number(s?.exchangeRateCop) > 0 ? Number(s!.exchangeRateCop) : 0;
  return { USD: 1, VES: ves, EUR: ves / eurVes, COP: cop };
}

const round2 = (n: number) => Math.round(n * 100) / 100;
export const toUsd = (amount: number, cur: Currency, r: Rates) => (r[cur] > 0 ? amount / r[cur] : 0);
export const fromUsd = (usd: number, cur: Currency, r: Rates) => round2(usd * r[cur]);

/** "$25.00", "Bs 21.784,22", "€22.20", "COP 79.861". */
export function formatMoney(amount: number, cur: Currency) {
  const m = CURRENCY_META[cur];
  const n = (Number(amount) || 0).toLocaleString(cur === "USD" || cur === "EUR" ? "en-US" : "es-VE", { minimumFractionDigits: m.decimals, maximumFractionDigits: m.decimals });
  return cur === "USD" || cur === "EUR" ? `${m.symbol}${n}` : `${m.symbol} ${n}`;
}

/**
 * Cash in Colombian pesos is handed over in round amounts: what the customer pays is rounded
 * up to the next 100 pesos and the change is rounded down. Transfers keep the exact amount.
 */
export const COP_CASH_STEP = 100;
export const cashDue = (amount: number, cur: Currency) => (cur === "COP" ? Math.ceil(Math.round(amount) / COP_CASH_STEP) * COP_CASH_STEP : amount);
export const cashChange = (amount: number, cur: Currency) => (cur === "COP" ? Math.floor(amount / COP_CASH_STEP) * COP_CASH_STEP : Math.round(amount * 100) / 100);

export type CashByCurrency = Partial<Record<Currency, number>>;
export const cashToUsd = (cash: CashByCurrency, r: Rates) => round2(Object.entries(cash).reduce((t, [c, v]) => t + toUsd(Number(v) || 0, c as Currency, r), 0));
