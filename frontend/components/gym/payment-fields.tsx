"use client";

import { cn } from "@/lib/utils";
import { PAYMENT_METHODS } from "@/lib/gym";
import { useCurrency } from "@/context/CurrencyContext";
import { type Currency, CURRENCY_META, formatMoney, fromUsd, toUsd } from "@/lib/currency";
import { Input } from "@/components/ui/input";

export type PaymentValue = { method: string; reference: string; currency: Currency; received: string; changeCurrency: Currency | null };
export const emptyPayment = (method = "CASH"): PaymentValue => ({ method, reference: "", currency: "USD", received: "", changeCurrency: null });

const DIGITAL_IN_BS = ["CARD", "PAGO_MOVIL", "TRANSFER"];

/** What the API expects for a charge of `amountUsd` dollars. */
export function paymentBody(p: PaymentValue, amountUsd: number) {
  const received = Number(p.received.replace(",", "."));
  return {
    amount: amountUsd,
    method: p.method,
    reference: p.reference,
    branchId: localStorage.getItem("currentBranchId") || undefined,
    ...(p.method === "CASH" && {
      currency: p.currency,
      ...(received > 0 && { received, changeCurrency: p.changeCurrency ?? p.currency }),
    }),
  };
}

/** Whether the cash handed over covers the charge (or wasn't typed, meaning exact). */
export function paymentReady(p: PaymentValue, amountUsd: number, rates: Record<Currency, number>) {
  if (p.method === "CASH") {
    if (!(rates[p.currency] > 0)) return false;
    if (!p.received.trim()) return true;
    const received = Number(p.received.replace(",", "."));
    return /^\d+([.,]\d{1,2})?$/.test(p.received.trim()) && received + 0.004 >= fromUsd(amountUsd, p.currency, rates);
  }
  return true;
}

/**
 * Method, and for cash: the currency it comes in (the branch's ones), how much the customer
 * hands over and the currency of the change. Everything converts at the cash (POS) rates.
 */
export function PaymentFields({ value, onChange, amountUsd, allowLater, compact }: { value: PaymentValue; onChange: (v: PaymentValue) => void; amountUsd: number; allowLater?: boolean; compact?: boolean }) {
  const { currencies, cashRates } = useCurrency();
  const set = (patch: Partial<PaymentValue>) => onChange({ ...value, ...patch });
  const due = fromUsd(amountUsd, value.currency, cashRates);
  const received = Number(value.received.replace(",", "."));
  const typed = value.received.trim() !== "";
  const formatOk = /^\d+([.,]\d{1,2})?$/.test(value.received.trim());
  const short = typed && formatOk && received + 0.004 < due;
  const changeUsd = typed && formatOk && !short ? Math.max(0, toUsd(received, value.currency, cashRates) - amountUsd) : 0;
  const changeCur = value.changeCurrency ?? value.currency;

  return (
    <div className="space-y-3">
      <div className={cn("grid gap-2", !compact && "sm:grid-cols-2")}>
        <select
          value={value.method}
          onChange={(e) => set({ method: e.target.value, received: "", changeCurrency: null })}
          className="h-9 w-full rounded-md border bg-background px-3 text-sm"
        >
          {allowLater && <option value="">Cobrar después</option>}
          {PAYMENT_METHODS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        {value.method && value.method !== "CASH" && <Input value={value.reference} onChange={(e) => set({ reference: e.target.value })} placeholder="Referencia del pago" />}
      </div>

      {DIGITAL_IN_BS.includes(value.method) && amountUsd > 0 && (
        <p className="text-xs text-muted-foreground">A tasa BCV equivale a <span className="font-semibold text-foreground tabular-nums">{formatMoney(fromUsd(amountUsd, "VES", cashRates), "VES")}</span></p>
      )}

      {value.method === "CASH" && amountUsd > 0 && (
        <div className="space-y-3 rounded-xl border p-3">
          <div className="space-y-1.5">
            <p className="text-xs font-medium">¿En qué moneda paga?</p>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {currencies.map((c) => {
                const missing = !(cashRates[c] > 0);
                return (
                  <button
                    key={c}
                    type="button"
                    disabled={missing}
                    onClick={() => set({ currency: c, received: "", changeCurrency: null })}
                    className={cn(
                      "rounded-lg border px-2.5 py-2 text-left transition disabled:opacity-40",
                      value.currency === c ? "border-primary bg-primary/10" : "hover:bg-muted",
                    )}
                  >
                    <span className="block text-[11px] text-muted-foreground">{CURRENCY_META[c].label}</span>
                    <span className="block text-sm font-semibold tabular-nums">{missing ? "Sin tasa" : formatMoney(fromUsd(amountUsd, c, cashRates), c)}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-medium">¿Con cuánto paga?</p>
            <p className="-mt-1 text-[11px] text-muted-foreground">Si paga justo, déjalo vacío.</p>
            <div className={cn("flex h-9 items-center overflow-hidden rounded-md border bg-background focus-within:border-ring", (short || (typed && !formatOk)) && "border-destructive")}>
              <span className="pl-3 text-xs text-muted-foreground">{CURRENCY_META[value.currency].symbol}</span>
              <input
                inputMode="decimal"
                value={value.received}
                onChange={(e) => set({ received: e.target.value.replace(/[^\d.,]/g, "").slice(0, 12) })}
                placeholder={String(due)}
                className="min-w-0 flex-1 bg-transparent px-2 text-sm tabular-nums outline-none"
              />
            </div>
            {typed && !formatOk && <p className="text-[11px] text-destructive">Solo números, con hasta 2 decimales</p>}
            {short && <p className="text-[11px] text-destructive">Faltan {formatMoney(due - received, value.currency)}</p>}
          </div>

          {changeUsd >= 0.01 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium">¿En qué moneda le das el vuelto?</p>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                {currencies.filter((c) => cashRates[c] > 0).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => set({ changeCurrency: c })}
                    className={cn("rounded-lg border px-2.5 py-2 text-left transition", changeCur === c ? "border-emerald-600 bg-emerald-500/10" : "hover:bg-muted")}
                  >
                    <span className="block text-[11px] text-muted-foreground">{CURRENCY_META[c].label}</span>
                    <span className="block text-sm font-semibold tabular-nums">{formatMoney(fromUsd(changeUsd, c, cashRates), c)}</span>
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">Ese vuelto sale de la gaveta y el cierre de caja lo descuenta.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
