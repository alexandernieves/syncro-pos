"use client";

import { useState, type FormEvent } from "react";
import { CheckCircle2, Flame, Landmark, Plus, Sparkles, Trash2, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usd } from "@/lib/syncro-admin";
import { FinanceDate, readableDate } from "./finance-calendar";
import { FinanceSelect, MoneyFields, type Quotes } from "./finance-fields";
import { FinanceSheet } from "./finance-sheet";
import { walletAccounts, type Debt, type OriginalMoney } from "./calculations";

const money = (cents: number) => usd((cents || 0) / 100);
const nativeMoney = (cents: number, currency: string) =>
  `${currency} ${(cents / 100).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const walletLabels: Record<string, string> = {
  cash: "Efectivo",
  bank: "Banco",
  binance: "Binance",
};

type Simulation = { months: number; interest: number; first?: string } | null;

export function FinanceDebtsView({
  debts,
  asOf,
  quotes,
  horizon,
  extra,
  baseline,
  accelerated,
  busy,
  mobile,
  onAddDebt,
  onRemoveDebt,
  onPayDebt,
}: {
  debts: Debt[];
  asOf: string;
  quotes: Quotes;
  horizon: number;
  extra: number;
  baseline: Simulation;
  accelerated: Simulation;
  busy: boolean;
  mobile: boolean;
  onAddDebt: (debt: Debt) => Promise<void> | void;
  onRemoveDebt: (index: number) => Promise<void> | void;
  onPayDebt: (payload: { index: number; date: string; wallet: string; original: OriginalMoney }) => Promise<void> | void;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [payingIndex, setPayingIndex] = useState<number | null>(null);

  const sorted = debts
    .map((debt, index) => ({ debt, index }))
    .sort((a, b) => b.debt.apr - a.debt.apr);

  const totalBalance = debts.reduce((sum, d) => sum + d.balance, 0);
  const totalMinimum = debts.reduce((sum, d) => sum + d.minimum, 0);
  const interestSaved = baseline && accelerated ? Math.max(0, baseline.interest - accelerated.interest) : 0;
  const monthsSaved = baseline && accelerated ? Math.max(0, baseline.months - accelerated.months) : 0;

  function parseOriginal(fields: FormData, prefix = ""): OriginalMoney {
    const selected = fields.get(prefix ? prefix + "Currency" : "currency");
    const currency = String(
      selected === "other" ? fields.get(prefix ? prefix + "CurrencyCode" : "currencyCode") : selected ?? "USD",
    ).toUpperCase();
    return {
      currency,
      nativeCents: Math.round(Number(fields.get(prefix ? prefix + "Amount" : "amount")) * 100),
      rate: Number(fields.get(prefix ? prefix + "Rate" : "rate") ?? 1),
    };
  }

  async function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    await onAddDebt({
      name: String(fields.get("name")),
      date: String(fields.get("date")),
      balance: 0,
      minimum: 0,
      balanceOriginal: parseOriginal(fields, "balance"),
      minimumOriginal: parseOriginal(fields, "minimum"),
      apr: Math.round(Number(fields.get("apr")) * 100),
    });
    setAddOpen(false);
  }

  async function handlePay(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (payingIndex === null) return;
    const fields = new FormData(event.currentTarget);
    await onPayDebt({
      index: payingIndex,
      date: String(fields.get("date")),
      wallet: String(fields.get("wallet")),
      original: parseOriginal(fields),
    });
    setPayingIndex(null);
  }

  const payingDebt = payingIndex !== null ? debts[payingIndex] : undefined;

  return (
    <div className="space-y-4">
      {/* Resumen de deudas */}
      <section className="space-y-4 rounded-[24px] border bg-card p-4 shadow-xs sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <TrendingDown className="size-3.5 text-primary" /> Plan de salida de deudas
            </p>
            <h2 className="mt-0.5 text-2xl font-bold tracking-tight tabular-nums">{money(totalBalance)}</h2>
          </div>
          <Button type="button" size="sm" className="rounded-full" onClick={() => setAddOpen(true)}>
            <Plus className="size-4" /> Nueva deuda
          </Button>
        </div>

        {debts.length > 0 && (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            <div className="rounded-2xl border bg-muted/35 p-3">
              <p className="text-xs text-muted-foreground">Cuota mensual total</p>
              <p className="mt-0.5 text-lg font-bold tabular-nums">{money(totalMinimum)}</p>
            </div>
            <div className="rounded-2xl border bg-emerald-500/8 p-3">
              <p className="text-xs text-muted-foreground">Extra disponible hoy</p>
              <p className="mt-0.5 text-lg font-bold tabular-nums text-emerald-700 dark:text-emerald-400">{money(extra)}</p>
            </div>
            <div className="col-span-2 rounded-2xl border bg-primary/8 p-3 sm:col-span-1">
              <p className="text-xs text-muted-foreground">Libre de deudas en</p>
              <p className="mt-0.5 text-lg font-bold tabular-nums">
                {accelerated ? `${accelerated.months} ${accelerated.months === 1 ? "mes" : "meses"}` : "+600 meses"}
              </p>
            </div>
          </div>
        )}

        {debts.length > 0 && (
          <div className="rounded-2xl border bg-muted/30 p-3.5 text-xs space-y-1.5">
            <p className="flex items-center gap-1.5 font-semibold text-foreground">
              <Sparkles className="size-3.5 text-primary" /> Estrategia Avalancha (mayor interés primero)
            </p>
            {extra > 0 && (interestSaved > 0 || monthsSaved > 0) ? (
              <p className="text-muted-foreground">
                Si abonas hoy <strong>{money(extra)}</strong> a <strong>{sorted[0]?.debt.name}</strong> (protegiendo tu reserva por {horizon} semanas), ahorras{" "}
                <strong className="text-emerald-700 dark:text-emerald-400">{money(interestSaved)}</strong> en intereses
                {monthsSaved > 0 ? ` y sales ${monthsSaved} ${monthsSaved === 1 ? "mes" : "meses"} antes` : ""}.
              </p>
            ) : (
              <p className="text-muted-foreground">
                Orden recomendado de pago: <strong>{sorted.map(item => item.debt.name).join(" → ")}</strong>.
                {baseline ? ` Pagando cuotas mínimas: ${baseline.months} meses (${money(baseline.interest)} en intereses).` : ""}
              </p>
            )}
          </div>
        )}
      </section>

      {/* Lista de deudas interactiva */}
      {sorted.length === 0 ? (
        <section className="flex flex-col items-center justify-center gap-2 rounded-[24px] border bg-card p-8 text-center">
          <CheckCircle2 className="size-10 text-emerald-500" />
          <h3 className="text-base font-semibold">Sin deudas registradas</h3>
          <p className="max-w-sm text-sm text-muted-foreground">
            Si tienes tarjetas, préstamos o compromisos pendientes, agrégalos aquí para calcular la forma más rápida de liquidarlos.
          </p>
          <Button type="button" variant="outline" className="mt-2 rounded-full" onClick={() => setAddOpen(true)}>
            <Plus className="size-4" /> Agregar primera deuda
          </Button>
        </section>
      ) : (
        <ul className="space-y-3">
          {sorted.map(({ debt, index }, priority) => (
            <li key={`${debt.name}-${index}`} className="space-y-3 rounded-[22px] border bg-card p-4 shadow-xs">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-bold">{debt.name}</h3>
                    {priority === 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/15 px-2.5 py-0.5 text-[11px] font-bold text-orange-700 dark:text-orange-400">
                        <Flame className="size-3" /> Prioridad #1
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {debt.apr / 100}% anual · Próximo pago {readableDate(debt.date)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold tabular-nums">
                    {debt.balanceOriginal ? nativeMoney(debt.balanceOriginal.nativeCents, debt.balanceOriginal.currency) : money(debt.balance)}
                  </p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    Cuota {debt.minimumOriginal ? nativeMoney(debt.minimumOriginal.nativeCents, debt.minimumOriginal.currency) : money(debt.minimum)}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                <Button type="button" size="sm" className="rounded-full" onClick={() => setPayingIndex(index)}>
                  <Landmark className="size-3.5" /> Registrar abono
                </Button>
                <Button type="button" size="sm" variant="ghost" className="rounded-full text-muted-foreground hover:text-destructive" onClick={() => void onRemoveDebt(index)}>
                  <Trash2 className="size-3.5" /> Quitar
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Sheet adaptativo: Nueva deuda */}
      <FinanceSheet
        open={addOpen}
        onOpenChange={open => { if (!busy) setAddOpen(open); }}
        mobile={mobile}
        title="Agregar deuda"
        description="Incluiremos sus cuotas en tu flujo de caja y calcularemos el orden más rápido para pagarla."
      >
        <fieldset disabled={busy} className="min-w-0">
          <form className="grid gap-3.5" onSubmit={handleAdd}>
            <label className="block space-y-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <span>Acreedor o tarjeta</span>
              <Input className="h-12 rounded-2xl text-base sm:text-sm" name="name" placeholder="Ej. Tarjeta Banesco o Préstamo familiar" maxLength={200} required />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <FinanceDate label="Próximo vencimiento" min={asOf} defaultValue={asOf} />
              <label className="block space-y-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <span>Tasa anual (%)</span>
                <Input className="h-12 rounded-2xl text-base sm:text-sm" name="apr" type="number" min="0" max="1000" step="0.01" defaultValue="0" required />
              </label>
            </div>
            <MoneyFields quotes={quotes} prefix="balance" label="Saldo pendiente" />
            <MoneyFields quotes={quotes} prefix="minimum" label="Cuota mensual" />
            <Button type="submit" className="h-12 rounded-full text-base font-semibold">Guardar deuda</Button>
          </form>
        </fieldset>
      </FinanceSheet>

      {/* Sheet adaptativo: Registrar abono a deuda */}
      <FinanceSheet
        open={payingIndex !== null}
        onOpenChange={open => { if (!open && !busy) setPayingIndex(null); }}
        mobile={mobile}
        title={`Abonar a ${payingDebt?.name ?? ""}`}
        description="Descuenta el pago de tu cuenta y reduce automáticamente el saldo pendiente de esta deuda."
      >
        {payingDebt && (
          <fieldset disabled={busy} className="min-w-0">
            <form className="grid gap-3.5" onSubmit={handlePay}>
              <FinanceDate label="Fecha del pago" max={asOf} defaultValue={asOf} />
              <FinanceSelect
                label="Pagado desde"
                name="wallet"
                defaultValue="bank"
                options={walletAccounts.map(key => [key, walletLabels[key]])}
              />
              <MoneyFields
                quotes={quotes}
                label="Monto abonado"
                initial={payingDebt.minimumOriginal ?? { currency: "USD", nativeCents: payingDebt.minimum, rate: 1 }}
              />
              <Button type="submit" className="h-12 rounded-full text-base font-semibold">Confirmar abono</Button>
            </form>
          </fieldset>
        )}
      </FinanceSheet>
    </div>
  );
}

