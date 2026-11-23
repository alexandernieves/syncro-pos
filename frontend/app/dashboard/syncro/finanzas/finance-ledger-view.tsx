"use client";

import { useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Building2,
  Landmark,
  Plus,
  Search,
  Upload,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usd } from "@/lib/syncro-admin";
import { FinanceDate, readableDate } from "./finance-calendar";
import { FinanceSelect, MoneyFields, type Quotes } from "./finance-fields";
import { FinanceSheet } from "./finance-sheet";
import { walletAccounts, type Entry } from "./calculations";

const money = (cents: number) => usd((cents || 0) / 100);
const nativeMoney = (cents: number, currency: string) =>
  `${currency} ${(cents / 100).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

type LedgerFilter = "all" | "income" | "expense" | "transfer";

export function FinanceLedgerView({
  entries,
  asOf,
  personal,
  workspace,
  mobile,
  busy,
  quotes,
  names,
  expenseAccounts,
  monthlyIncome,
  monthlyExpenses,
  formRevision,
  onOpenBankImport,
  onOpenOpening,
  onPostEntry,
  onPostOwnerPayment,
}: {
  entries: Entry[];
  asOf: string;
  personal: boolean;
  workspace: "personal" | "company";
  mobile: boolean;
  busy: boolean;
  quotes: Quotes;
  names: Record<string, string>;
  expenseAccounts: string[];
  monthlyIncome: number;
  monthlyExpenses: number;
  formRevision: number;
  onOpenBankImport: () => void;
  onOpenOpening: () => void;
  onPostEntry: (event: FormEvent<HTMLFormElement>) => void;
  onPostOwnerPayment: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<LedgerFilter>("all");
  const [manualOpen, setManualOpen] = useState(false);
  const [ownerPayOpen, setOwnerPayOpen] = useState(false);

  function classify(entry: Entry): "income" | "expense" | "transfer" | "other" {
    if (entry.credit === "income") return "income";
    if (expenseAccounts.includes(entry.debit)) return "expense";
    if (walletAccounts.includes(entry.debit) && walletAccounts.includes(entry.credit)) return "transfer";
    return "other";
  }

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = entries.filter(entry => {
    const kind = classify(entry);
    if (filter !== "all" && kind !== filter) return false;
    if (!normalizedQuery) return true;
    const haystack = `${entry.description} ${names[entry.debit] ?? ""} ${names[entry.credit] ?? ""} ${entry.currency ?? ""}`.toLowerCase();
    return haystack.includes(normalizedQuery);
  });

  // Group by date descending
  const grouped = new Map<string, Entry[]>();
  for (const entry of filtered) {
    const list = grouped.get(entry.date) ?? [];
    list.push(entry);
    grouped.set(entry.date, list);
  }
  const dateGroups = Array.from(grouped.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  const netFlow = monthlyIncome - monthlyExpenses;

  const filters: { id: LedgerFilter; label: string }[] = [
    { id: "all", label: "Todos" },
    { id: "income", label: "Ingresos" },
    { id: "expense", label: "Gastos" },
    { id: "transfer", label: "Cambios" },
  ];

  return (
    <div className="space-y-4">
      {/* Hero Cashflow Statement Card */}
      <section className="finance-bank-card relative overflow-hidden rounded-[28px] p-5 text-white shadow-[0_20px_44px_-18px_rgba(20,16,12,0.55)]">
        <div aria-hidden className="finance-grid-bg pointer-events-none absolute inset-0 opacity-70" />
        <div className="relative z-10 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/60">
                Flujo neto del mes
              </p>
              <p className={`mt-1 text-[clamp(28px,7.5vw,38px)] font-bold leading-none tracking-[-0.04em] tabular-nums ${netFlow >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {netFlow >= 0 ? "+" : ""}{money(netFlow)}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={() => setManualOpen(true)}
              className="h-10 rounded-full bg-[#F26B3A] px-4 text-xs font-bold text-white shadow-lg shadow-[#F26B3A]/30 hover:bg-[#e35d2c]"
            >
              <Plus className="size-4" /> Asiento
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-white/[0.06] p-3 backdrop-blur-md">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-white/55">Entradas</p>
              <p className="mt-0.5 text-sm font-bold tabular-nums text-emerald-400">+{money(monthlyIncome)}</p>
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-white/55">Salidas</p>
              <p className="mt-0.5 text-sm font-bold tabular-nums text-orange-300">-{money(monthlyExpenses)}</p>
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-white/55">Asientos</p>
              <p className="mt-0.5 text-sm font-bold tabular-nums">{entries.length}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Action Pills */}
      <div className="flex flex-wrap gap-2">
        {personal && (
          <Button type="button" size="sm" variant="outline" className="h-10 rounded-full bg-card px-4 text-xs font-semibold shadow-2xs" onClick={onOpenBankImport}>
            <Upload className="size-3.5 text-primary" /> Importar Banesco
          </Button>
        )}
        {personal && (
          <Button type="button" size="sm" variant="outline" className="h-10 rounded-full bg-card px-4 text-xs font-semibold shadow-2xs" onClick={onOpenOpening}>
            <Wallet className="size-3.5 text-sky-600" /> Saldo inicial
          </Button>
        )}
        {workspace === "company" && (
          <Button type="button" size="sm" variant="outline" className="h-10 rounded-full bg-card px-4 text-xs font-semibold shadow-2xs" onClick={() => setOwnerPayOpen(true)}>
            <Building2 className="size-3.5 text-violet-600" /> Pago a cuenta personal
          </Button>
        )}
      </div>

      {/* Search + Spring Segmented Filter */}
      <div className="space-y-2.5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar por concepto, cuenta o moneda…"
            className="h-11 rounded-2xl pl-10 text-sm"
          />
        </div>

        <div className="grid grid-cols-4 gap-1 rounded-2xl border bg-card p-1 shadow-2xs">
          {filters.map(item => {
            const active = filter === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setFilter(item.id)}
                className={`relative h-9 rounded-xl text-xs font-semibold transition-colors ${
                  active ? "text-white" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="ledger-filter-pill"
                    transition={{ type: "spring", stiffness: 450, damping: 32 }}
                    className="absolute inset-0 rounded-xl bg-[#1A1815] shadow-xs dark:bg-[#F26B3A]"
                  />
                )}
                <span className="relative z-10">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Date-grouped Banking Ledger */}
      {dateGroups.length === 0 ? (
        <div className="rounded-[24px] border border-dashed bg-card/60 p-8 text-center">
          <Landmark className="mx-auto size-8 text-muted-foreground/50" />
          <p className="mt-2 text-sm font-medium">Sin movimientos que coincidan</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Prueba otro filtro o registra tu primer asiento.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {dateGroups.map(([date, list]) => (
            <div key={date} className="space-y-1.5">
              <div className="flex items-center justify-between px-1">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  {date === asOf ? "Hoy" : readableDate(date)}
                </p>
                <span className="text-[11px] text-muted-foreground">{list.length}</span>
              </div>
              <ul className="divide-y divide-border/60 overflow-hidden rounded-[22px] border bg-card shadow-xs">
                {list.map(entry => {
                  const kind = classify(entry);
                  const Icon = kind === "income" ? ArrowDownLeft : kind === "expense" ? ArrowUpRight : kind === "transfer" ? ArrowLeftRight : Landmark;
                  const iconStyle = kind === "income"
                    ? "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400"
                    : kind === "expense"
                      ? "bg-orange-500/12 text-orange-600 dark:text-orange-400"
                      : kind === "transfer"
                        ? "bg-sky-500/12 text-sky-600 dark:text-sky-400"
                        : "bg-violet-500/12 text-violet-600 dark:text-violet-400";
                  const sign = kind === "income" ? "+" : kind === "expense" ? "-" : "";
                  const amountTone = kind === "income" ? "text-emerald-600 dark:text-emerald-400" : "text-foreground";

                  return (
                    <li key={entry.id} className="flex items-center justify-between gap-3 p-3.5 transition-colors hover:bg-muted/35">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className={`flex size-10 shrink-0 items-center justify-center rounded-2xl ${iconStyle}`}>
                          <Icon className="size-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">{entry.description}</p>
                          <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
                            <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-foreground/75">
                              {names[entry.credit] ?? entry.credit} → {names[entry.debit] ?? entry.debit}
                            </span>
                            {entry.rate && entry.currency && entry.currency !== "USD" && (
                              <span className="text-[10px] tabular-nums">
                                @ {Number(entry.rate).toLocaleString("es-VE", { maximumFractionDigits: 4 })}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className={`text-sm font-bold tabular-nums ${amountTone}`}>
                          {sign}{money(entry.cents)}
                        </p>
                        {entry.nativeCents != null && entry.currency && entry.currency !== "USD" && (
                          <p className="text-[11px] tabular-nums text-muted-foreground">
                            {nativeMoney(entry.nativeCents, entry.currency)}
                          </p>
                        )}
                        {entry.toCurrency && entry.toCents != null && (
                          <p className="text-[10px] tabular-nums text-sky-600 dark:text-sky-400">
                            → {nativeMoney(entry.toCents, entry.toCurrency)}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* Sheet: Asiento manual */}
      <FinanceSheet
        open={manualOpen}
        onOpenChange={open => { if (!busy) setManualOpen(open); }}
        mobile={mobile}
        title="Registrar asiento manual"
        description="Para corregir un asiento, registra su reversión con las cuentas invertidas."
      >
        <fieldset disabled={busy} className="min-w-0">
          <form
            key={formRevision}
            className="grid gap-3.5"
            onSubmit={event => {
              onPostEntry(event);
              setManualOpen(false);
            }}
          >
            <FinanceDate label="Fecha" max={asOf} defaultValue={asOf} />
            <label className="block space-y-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <span>Descripción</span>
              <Input className="h-12 rounded-2xl text-base sm:text-sm" name="description" maxLength={200} placeholder="Ej. Ajuste de caja" required />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <FinanceSelect label="Debe" name="debit" options={Object.entries(names)} />
              <FinanceSelect label="Haber" name="credit" options={Object.entries(names)} />
            </div>
            <MoneyFields quotes={quotes} label="Importe" />
            <Button type="submit" className="h-12 rounded-full text-base font-semibold">Registrar asiento</Button>
          </form>
        </fieldset>
      </FinanceSheet>

      {/* Sheet: Pago Syncro a cuenta personal */}
      {workspace === "company" && (
        <FinanceSheet
          open={ownerPayOpen}
          onOpenChange={open => { if (!busy) setOwnerPayOpen(open); }}
          mobile={mobile}
          title="Pago de Syncro a cuenta personal"
          description="Registra el movimiento automáticamente en los dos espacios."
        >
          <fieldset disabled={busy} className="min-w-0">
            <form
              key={formRevision}
              className="grid gap-3.5"
              onSubmit={event => {
                onPostOwnerPayment(event);
                setOwnerPayOpen(false);
              }}
            >
              <FinanceDate label="Fecha" max={asOf} defaultValue={asOf} />
              <label className="block space-y-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <span>Descripción</span>
                <Input className="h-12 rounded-2xl text-base sm:text-sm" name="description" maxLength={200} required />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <FinanceSelect label="Concepto contable" name="classification" options={[["expense", "Remuneración"], ["equity", "Retiro de patrimonio"]]} />
                <FinanceSelect label="Medio en ambas cuentas" name="account" defaultValue="bank" options={walletAccounts.map(key => [key, names[key]])} />
              </div>
              <MoneyFields quotes={quotes} label="Importe pagado" />
              <Button type="submit" className="h-12 rounded-full text-base font-semibold">Registrar pago vinculado</Button>
            </form>
          </fieldset>
        </FinanceSheet>
      )}
    </div>
  );
}
