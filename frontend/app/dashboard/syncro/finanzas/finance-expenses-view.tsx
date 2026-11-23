"use client";

import { motion } from "framer-motion";
import {
  AlertTriangle,
  Car,
  Coffee,
  CreditCard,
  HeartPulse,
  Home,
  Percent,
  Plus,
  Repeat,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Utensils,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { usd } from "@/lib/syncro-admin";
import { readableDate } from "./finance-calendar";
import type { Entry } from "./calculations";

const money = (cents: number) => usd((cents || 0) / 100);
const nativeMoney = (cents: number, currency: string) =>
  `${currency} ${(cents / 100).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const categoryMeta: Record<string, { icon: LucideIcon; color: string; bg: string; bar: string }> = {
  food: { icon: ShoppingCart, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/12", bar: "bg-emerald-500" },
  dining: { icon: Utensils, color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-500/12", bar: "bg-orange-500" },
  housing: { icon: Home, color: "text-sky-600 dark:text-sky-400", bg: "bg-sky-500/12", bar: "bg-sky-500" },
  transport: { icon: Car, color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-500/12", bar: "bg-indigo-500" },
  health: { icon: HeartPulse, color: "text-rose-600 dark:text-rose-400", bg: "bg-rose-500/12", bar: "bg-rose-500" },
  subscriptions: { icon: Repeat, color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-500/12", bar: "bg-violet-500" },
  shopping: { icon: ShoppingBag, color: "text-pink-600 dark:text-pink-400", bg: "bg-pink-500/12", bar: "bg-pink-500" },
  leisure: { icon: Sparkles, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/12", bar: "bg-amber-500" },
  interest: { icon: Percent, color: "text-red-600 dark:text-red-400", bg: "bg-red-500/12", bar: "bg-red-500" },
  expense: { icon: CreditCard, color: "text-zinc-600 dark:text-zinc-400", bg: "bg-zinc-500/12", bar: "bg-zinc-500" },
};

export function FinanceExpensesView({
  asOf,
  monthlyExpenses,
  monthlyIncome,
  spendingCategories,
  largestExpense,
  purchases,
  filteredPurchases,
  smallPurchasesCount,
  smallTotal,
  smallLimit,
  expenseFilter,
  onFilterChange,
  onOpenNewExpense,
  names,
}: {
  asOf: string;
  monthlyExpenses: number;
  monthlyIncome: number;
  spendingCategories: { account: string; amount: number }[];
  largestExpense: number;
  purchases: Entry[];
  filteredPurchases: Entry[];
  smallPurchasesCount: number;
  smallTotal: number;
  smallLimit: number;
  expenseFilter: string;
  onFilterChange: (value: string) => void;
  onOpenNewExpense: () => void;
  names: Record<string, string>;
}) {
  const dayOfMonth = Math.max(1, Number(asOf.slice(8, 10)) || 1);
  const dailyAvg = Math.round(monthlyExpenses / dayOfMonth);
  const incomePct = monthlyIncome > 0 ? Math.min(999, Math.round((monthlyExpenses / monthlyIncome) * 100)) : null;
  const activeCategories = spendingCategories.filter(item => item.amount > 0);
  const smallPct = smallLimit > 0 ? Math.min(100, Math.round((smallTotal / smallLimit) * 100)) : 0;
  const smallExceeded = smallLimit > 0 && smallTotal > smallLimit;

  const filterChips: { id: string; label: string; count?: number }[] = [
    { id: "all", label: "Todos", count: purchases.length },
    { id: "small", label: "Hormiga", count: smallPurchasesCount },
    ...activeCategories.map(item => ({ id: item.account, label: names[item.account] })),
  ];

  return (
    <div className="space-y-4">
      {/* Hero Obsidian Banking Card with Grid Texture */}
      <section className="finance-bank-card relative overflow-hidden rounded-[28px] p-5 text-white shadow-[0_20px_44px_-18px_rgba(20,16,12,0.55)]">
        <div aria-hidden className="finance-grid-bg pointer-events-none absolute inset-0 opacity-70" />
        <div className="relative z-10 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/60">
                Gastos del mes
              </p>
              <p className="mt-1 text-[clamp(30px,8vw,40px)] font-bold leading-none tracking-[-0.04em] tabular-nums">
                {money(monthlyExpenses)}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={onOpenNewExpense}
              className="h-10 rounded-full bg-[#F26B3A] px-4 text-xs font-bold text-white shadow-lg shadow-[#F26B3A]/30 hover:bg-[#e35d2c]"
            >
              <Plus className="size-4" /> Nuevo gasto
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-white/[0.06] p-3 backdrop-blur-md">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-white/55">Promedio / día</p>
              <p className="mt-0.5 text-sm font-bold tabular-nums">{money(dailyAvg)}</p>
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-white/55">Movimientos</p>
              <p className="mt-0.5 text-sm font-bold tabular-nums">{purchases.length}</p>
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-white/55">Vs. ingresos</p>
              <p className="mt-0.5 text-sm font-bold tabular-nums text-[#F6A27F]">
                {incomePct !== null ? `${incomePct}%` : "—"}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Bento: Gastos hormiga + Categorías */}
      <div className="grid gap-3.5 sm:grid-cols-2">
        {/* Gastos hormiga gauge */}
        <section className="finance-grid-light relative overflow-hidden rounded-[24px] border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="flex size-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
                <Coffee className="size-4" />
              </span>
              <div>
                <h2 className="text-sm font-bold leading-tight">Gastos hormiga</h2>
                <p className="text-[11px] text-muted-foreground">
                  {smallPurchasesCount} {smallPurchasesCount === 1 ? "compra pequeña" : "compras pequeñas"}
                </p>
              </div>
            </div>
            <p className="text-lg font-bold tabular-nums">{money(smallTotal)}</p>
          </div>

          {smallLimit > 0 ? (
            <div className="mt-3.5 space-y-1.5">
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${smallPct}%` }}
                  transition={{ type: "spring", stiffness: 220, damping: 28 }}
                  className={`h-full rounded-full ${smallExceeded ? "bg-rose-500" : "bg-amber-500"}`}
                />
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className={smallExceeded ? "flex items-center gap-1 font-semibold text-rose-600" : "text-muted-foreground"}>
                  {smallExceeded ? (
                    <>
                      <AlertTriangle className="size-3" /> Superaste el tope por {money(smallTotal - smallLimit)}
                    </>
                  ) : (
                    `Disponible: ${money(smallLimit - smallTotal)}`
                  )}
                </span>
                <span className="font-semibold tabular-nums text-muted-foreground">Tope {money(smallLimit)}</span>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">
              Define un tope mensual en <strong>Plan</strong> para controlar tus compras pequeñas.
            </p>
          )}
        </section>

        {/* Categorías breakdown */}
        <section className="rounded-[24px] border bg-card p-4 shadow-xs">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold">Distribución por categoría</h2>
            <span className="text-[11px] font-medium text-muted-foreground">
              {activeCategories.length} {activeCategories.length === 1 ? "activa" : "activas"}
            </span>
          </div>
          {activeCategories.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">Aún no registras gastos este mes.</p>
          ) : (
            <div className="space-y-2.5">
              {activeCategories.slice(0, 5).map(({ account, amount }) => {
                const meta = categoryMeta[account] ?? categoryMeta.expense;
                const Icon = meta.icon;
                const share = monthlyExpenses > 0 ? Math.round((amount / monthlyExpenses) * 100) : 0;
                const barWidth = largestExpense > 0 ? Math.max(8, Math.round((amount / largestExpense) * 100)) : 0;
                return (
                  <button
                    key={account}
                    type="button"
                    onClick={() => onFilterChange(expenseFilter === account ? "all" : account)}
                    className="group block w-full text-left"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="flex items-center gap-2 font-medium">
                        <span className={`flex size-6 items-center justify-center rounded-lg ${meta.bg} ${meta.color}`}>
                          <Icon className="size-3.5" />
                        </span>
                        <span className="group-hover:text-primary">{names[account]}</span>
                      </span>
                      <span className="flex items-center gap-1.5 tabular-nums">
                        <span className="text-[11px] text-muted-foreground">{share}%</span>
                        <strong className="font-semibold">{money(amount)}</strong>
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${barWidth}%` }}
                        transition={{ type: "spring", stiffness: 240, damping: 28 }}
                        className={`h-full rounded-full ${meta.bar}`}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Interactive Spring / Gooey Filter Chips */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold tracking-tight">Movimientos del mes</h2>
          <span className="text-xs text-muted-foreground tabular-nums">
            {filteredPurchases.length} {filteredPurchases.length === 1 ? "registro" : "registros"}
          </span>
        </div>

        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {filterChips.map(chip => {
            const active = expenseFilter === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => onFilterChange(chip.id)}
                className={`relative shrink-0 rounded-full px-3.5 py-2 text-xs font-semibold transition-colors ${
                  active ? "text-white" : "border bg-card text-muted-foreground hover:text-foreground"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="expenses-filter-pill"
                    transition={{ type: "spring", stiffness: 450, damping: 32 }}
                    className="absolute inset-0 rounded-full bg-[#1A1815] shadow-sm dark:bg-[#F26B3A]"
                  />
                )}
                <span className="relative z-10 flex items-center gap-1.5">
                  {chip.label}
                  {chip.count !== undefined && (
                    <span className={`rounded-full px-1.5 py-0.2 text-[10px] ${active ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"}`}>
                      {chip.count}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>

        {/* Modern Banking Transaction Feed */}
        {filteredPurchases.length === 0 ? (
          <div className="rounded-[24px] border border-dashed bg-card/60 p-8 text-center">
            <Wallet className="mx-auto size-8 text-muted-foreground/50" />
            <p className="mt-2 text-sm font-medium">Sin gastos en este filtro</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Registra un gasto o cambia de categoría.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border/60 overflow-hidden rounded-[24px] border bg-card shadow-xs">
            {filteredPurchases.map(entry => {
              const meta = categoryMeta[entry.debit] ?? categoryMeta.expense;
              const Icon = meta.icon;
              return (
                <li key={entry.id} className="flex items-center justify-between gap-3 p-3.5 transition-colors hover:bg-muted/35">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className={`flex size-10 shrink-0 items-center justify-center rounded-2xl ${meta.bg} ${meta.color}`}>
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{entry.description}</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                        <span>{readableDate(entry.date)}</span>
                        <span>·</span>
                        <span>{names[entry.debit]}</span>
                        <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-foreground/75">
                          {names[entry.credit]}
                        </span>
                        {entry.smallSpend && (
                          <span className="rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                            Hormiga
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold tabular-nums text-foreground">
                      -{entry.nativeCents != null ? nativeMoney(entry.nativeCents, entry.currency ?? "USD") : money(entry.cents)}
                    </p>
                    {entry.nativeCents != null && entry.currency && entry.currency !== "USD" && (
                      <p className="text-[11px] tabular-nums text-muted-foreground">{money(entry.cents)}</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
