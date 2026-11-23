"use client";

import Link from "next/link";
import { AlertTriangle, ArrowDownLeft, ArrowLeftRight, ArrowUpRight, CheckCircle2, Receipt, ShieldCheck, Sparkles, TrendingDown, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usd } from "@/lib/syncro-admin";
import { readableDate } from "./finance-calendar";

const money = (cents: number) => usd((cents || 0) / 100);

export function FinanceQuickActions({
  hasCashActivity,
  onOpening,
  onIncome,
  onTransfer,
  expensesHref,
  fiscalHref,
}: {
  hasCashActivity: boolean;
  onOpening: () => void;
  onIncome: () => void;
  onTransfer: () => void;
  expensesHref: string;
  fiscalHref: string;
}) {
  return (
    <section className="space-y-3 rounded-[24px] border bg-card p-4 shadow-xs sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold tracking-tight">
            {hasCashActivity ? "Acciones rápidas" : "Empieza por tu saldo de hoy"}
          </h2>
          <p className="text-xs text-muted-foreground">
            {hasCashActivity
              ? "Registra en segundos lo que entra, sale o facturas."
              : "Anota cuánto tienes hoy en banco, efectivo o Binance."}
          </p>
        </div>
        {!hasCashActivity && (
          <Button type="button" size="sm" className="rounded-full" onClick={onOpening}>
            <Wallet className="size-4" /> Saldo inicial
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <button
          type="button"
          onClick={onIncome}
          className="group flex flex-col items-start gap-2 rounded-2xl border bg-emerald-500/8 p-3.5 text-left transition-all hover:border-emerald-500/40 hover:bg-emerald-500/12 active:scale-[0.98]"
        >
          <span className="flex size-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xs transition-transform group-hover:scale-105">
            <ArrowDownLeft className="size-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">Ingreso</p>
            <p className="text-[11px] text-muted-foreground">Cobro o pago</p>
          </div>
        </button>

        <Link
          href={expensesHref}
          className="group flex flex-col items-start gap-2 rounded-2xl border bg-orange-500/8 p-3.5 text-left transition-all hover:border-orange-500/40 hover:bg-orange-500/12 active:scale-[0.98]"
        >
          <span className="flex size-9 items-center justify-center rounded-xl bg-[#F26B3A] text-white shadow-xs transition-transform group-hover:scale-105">
            <ArrowUpRight className="size-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">Gasto</p>
            <p className="text-[11px] text-muted-foreground">Compra o pago</p>
          </div>
        </Link>

        <button
          type="button"
          onClick={onTransfer}
          className="group flex flex-col items-start gap-2 rounded-2xl border bg-sky-500/8 p-3.5 text-left transition-all hover:border-sky-500/40 hover:bg-sky-500/12 active:scale-[0.98]"
        >
          <span className="flex size-9 items-center justify-center rounded-xl bg-sky-600 text-white shadow-xs transition-transform group-hover:scale-105">
            <ArrowLeftRight className="size-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">Cambiar</p>
            <p className="text-[11px] text-muted-foreground">Entre cuentas</p>
          </div>
        </button>

        <Link
          href={fiscalHref}
          className="group flex flex-col items-start gap-2 rounded-2xl border bg-violet-500/8 p-3.5 text-left transition-all hover:border-violet-500/40 hover:bg-violet-500/12 active:scale-[0.98]"
        >
          <span className="flex size-9 items-center justify-center rounded-xl bg-violet-600 text-white shadow-xs transition-transform group-hover:scale-105">
            <Receipt className="size-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">Facturas</p>
            <p className="text-[11px] text-muted-foreground">IVA e ISLR</p>
          </div>
        </Link>
      </div>
    </section>
  );
}

export function FinanceDecisionCard({
  available,
  reserve,
  foodRemaining,
  extraForDebts,
  totalDebt,
  shortfall,
  debtsHref,
  budgetHref,
}: {
  available: number;
  reserve: number;
  foodRemaining: number;
  extraForDebts: number;
  totalDebt: number;
  shortfall?: { date: string; cents: number };
  debtsHref: string;
  budgetHref: string;
}) {
  const safeBase = Math.max(1, available);
  const reservePct = Math.min(100, Math.round((Math.min(available, reserve) / safeBase) * 100));
  const foodPct = Math.min(100 - reservePct, Math.round((Math.min(Math.max(0, available - reserve), foodRemaining) / safeBase) * 100));
  const extraPct = Math.max(0, Math.min(100 - reservePct - foodPct, Math.round((extraForDebts / safeBase) * 100)));
  const committedPct = Math.max(0, 100 - reservePct - foodPct - extraPct);

  return (
    <section className="space-y-4 rounded-[24px] border bg-card p-4 shadow-xs sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Sparkles className="size-3.5 text-primary" /> Guía de distribución
          </p>
          <h2 className="mt-0.5 text-lg font-bold tracking-tight">
            {shortfall
              ? "Prioriza cubrir tus compromisos"
              : extraForDebts > 0 && totalDebt > 0
                ? `Puedes abonar ${money(extraForDebts)} a deudas`
                : extraForDebts > 0
                  ? `Tienes ${money(extraForDebts)} libres para ahorrar`
                  : "Tu saldo cubre tus compromisos"}
          </h2>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
            shortfall
              ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
              : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
          }`}
        >
          {shortfall ? <AlertTriangle className="size-3.5" /> : <CheckCircle2 className="size-3.5" />}
          {shortfall ? "Ajustar" : "En orden"}
        </span>
      </div>

      {available > 0 && (
        <div className="space-y-2">
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
            {reservePct > 0 && <div className="h-full bg-sky-500 transition-all" style={{ width: `${reservePct}%` }} title="Reserva mínima" />}
            {foodPct > 0 && <div className="h-full bg-amber-500 transition-all" style={{ width: `${foodPct}%` }} title="Comida del mes" />}
            {committedPct > 0 && <div className="h-full bg-zinc-400 transition-all" style={{ width: `${committedPct}%` }} title="Compromisos y cuotas" />}
            {extraPct > 0 && <div className="h-full bg-emerald-500 transition-all" style={{ width: `${extraPct}%` }} title="Libre / Extra deudas" />}
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            <div className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-sky-500" />
              <span className="text-muted-foreground">Reserva:</span>
              <strong className="tabular-nums">{money(reserve)}</strong>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-amber-500" />
              <span className="text-muted-foreground">Comida:</span>
              <strong className="tabular-nums">{money(foodRemaining)}</strong>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-emerald-500" />
              <span className="text-muted-foreground">Libre hoy:</span>
              <strong className="tabular-nums text-emerald-600 dark:text-emerald-400">{money(extraForDebts)}</strong>
            </div>
            {totalDebt > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-rose-500" />
                <span className="text-muted-foreground">Deudas:</span>
                <strong className="tabular-nums">{money(totalDebt)}</strong>
              </div>
            )}
          </div>
        </div>
      )}

      {shortfall ? (
        <p className="rounded-xl border border-amber-300/60 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
          Para el <strong>{readableDate(shortfall.date)}</strong> faltarían <strong>{money(shortfall.cents)}</strong> para mantener tu reserva mínima. Revisa tus pagos o topes de gasto.
        </p>
      ) : (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="size-4 shrink-0 text-emerald-600" />
          Tu reserva mínima y tus pagos programados están protegidos en el horizonte actual.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {totalDebt > 0 && (
          <Button asChild size="sm" className="rounded-full">
            <Link href={debtsHref}>
              <TrendingDown className="size-4" /> Plan para salir de deudas
            </Link>
          </Button>
        )}
        <Button asChild size="sm" variant="outline" className="rounded-full">
          <Link href={budgetHref}>Ajustar distribución</Link>
        </Button>
      </div>
    </section>
  );
}

