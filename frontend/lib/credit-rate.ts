/**
 * The rate Syncro Credit uses to tell a client how much to transfer (Configuración → Syncro Credit →
 * Tasa para pagar). One rule for the app and the settings screen:
 *  - BCV dollar / euro: the POS rate; if the POS never synced it (empty or 1), the dashboard's;
 *  - pesos: the business's own peso rate, else the TRM;
 *  - custom: the business's own Bs per $1.
 * A mode without a rate falls back to the BCV dollar.
 */
export type CreditRateMode = "usd" | "eur" | "cop" | "custom";

const real = (n: unknown) => (Number(n) > 1 ? Number(n) : 0);

export function creditRates(s: any) {
  return {
    usd: real(s?.exchangeRate) || real(s?.exchangeRateDashboard),
    eur: real(s?.exchangeRateEur) || real(s?.exchangeRateDashboardEur),
    cop: real(s?.copRateManual) || real(s?.exchangeRateCop),
    custom: real(s?.syncroCreditRateCustom),
  };
}

export const CREDIT_RATE_LABEL: Record<CreditRateMode, string> = {
  usd: "Tasa BCV",
  eur: "Tasa euro BCV",
  cop: "Tasa del peso",
  custom: "Tasa del comercio",
};

export function creditPayRate(s: any): { mode: CreditRateMode; rate: number; cur: "Bs" | "COP"; label: string; fellBack: boolean } {
  const rates = creditRates(s);
  const wanted: CreditRateMode = ["eur", "cop", "custom"].includes(s?.syncroCreditRate) ? s.syncroCreditRate : "usd";
  const mode: CreditRateMode = rates[wanted] ? wanted : "usd";
  return {
    mode,
    rate: rates[mode] || 1,
    cur: mode === "cop" ? "COP" : "Bs",
    label: CREDIT_RATE_LABEL[mode],
    fellBack: mode !== wanted,
  };
}
