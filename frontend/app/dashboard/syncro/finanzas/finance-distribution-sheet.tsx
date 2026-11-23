"use client";

import { useEffect, useState } from "react";
import {
  Landmark,
  Receipt,
  Rocket,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  TrendingDown,
  Wallet,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { usd } from "@/lib/syncro-admin";
import { FinanceSheet } from "./finance-sheet";
import { distributeIncome } from "./calculations";

const money = (cents: number) => usd((cents || 0) / 100);

export function FinanceDistributionSheet({
  open,
  onOpenChange,
  mobile,
  initialAmountCents,
  fiscalIvaCents,
  upcomingBillsCents,
  foodRemainingCents,
  reserveGapCents,
  totalDebtCents,
  topDebtName,
  monthlyInvestmentTargetCents,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mobile: boolean;
  initialAmountCents: number;
  fiscalIvaCents: number;
  upcomingBillsCents: number;
  foodRemainingCents: number;
  reserveGapCents: number;
  totalDebtCents: number;
  topDebtName?: string;
  monthlyInvestmentTargetCents: number;
}) {
  const [amountInput, setAmountInput] = useState(
    initialAmountCents > 0 ? (initialAmountCents / 100).toFixed(2) : "",
  );

  useEffect(() => {
    if (open && initialAmountCents > 0) {
      setAmountInput((initialAmountCents / 100).toFixed(2));
    }
  }, [open, initialAmountCents]);

  const parsedCents = Math.max(0, Math.round((Number(amountInput) || 0) * 100));
  const split = distributeIncome(parsedCents, {
    fiscalIvaCents,
    upcomingBillsCents,
    foodRemainingCents,
    reserveGapCents,
    totalDebtCents,
    topDebtName,
    monthlyInvestmentTargetCents,
  });

  const rows = [
    {
      label: "Apartado Fiscal (IVA SENIAT)",
      hint: "No es dinero tuyo — apártalo primero",
      cents: split.fiscal,
      color: "bg-rose-500",
      tone: "text-rose-600 dark:text-rose-400 bg-rose-500/12",
      icon: Receipt,
    },
    {
      label: "Compromisos próximos (15 días)",
      hint: "Pagos fijos antes del siguiente cobro",
      cents: split.bills,
      color: "bg-zinc-500",
      tone: "text-zinc-700 dark:text-zinc-300 bg-zinc-500/12",
      icon: Landmark,
    },
    {
      label: "Mercado y comidas pendientes",
      hint: "Para completar tu tope de comida del mes",
      cents: split.food,
      color: "bg-amber-500",
      tone: "text-amber-600 dark:text-amber-400 bg-amber-500/12",
      icon: ShoppingCart,
    },
    {
      label: "Completar reserva mínima",
      hint: "Tu colchón intocable de seguridad",
      cents: split.reserve,
      color: "bg-sky-500",
      tone: "text-sky-600 dark:text-sky-400 bg-sky-500/12",
      icon: ShieldCheck,
    },
    {
      label: topDebtName ? `Abono Deuda #1 (${topDebtName})` : "Ataque a deudas (Avalancha)",
      hint: "Reduce intereses y meses de deuda",
      cents: split.debtAttack,
      color: "bg-[#F26B3A]",
      tone: "text-[#F26B3A] bg-[#F26B3A]/12",
      icon: TrendingDown,
    },
    {
      label: "Inversiones y Objetivos",
      hint: "Construye patrimonio y capital de negocio",
      cents: split.investments,
      color: "bg-violet-500",
      tone: "text-violet-600 dark:text-violet-400 bg-violet-500/12",
      icon: Rocket,
    },
    {
      label: "Libre para disfrutar",
      hint: "Sin culpa: todo lo importante ya está cubierto",
      cents: split.freeCash,
      color: "bg-emerald-500",
      tone: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/12",
      icon: Wallet,
    },
  ].filter(row => row.cents > 0);

  return (
    <FinanceSheet
      open={open}
      onOpenChange={onOpenChange}
      mobile={mobile}
      title="Reparto inteligente del cobro"
      description="Basado en tus compromisos de 15 días, IVA fiscal, deudas, reserva y metas de inversión."
    >
      <div className="space-y-4">
        <label className="block space-y-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <span>Monto recibido (USD)</span>
          <Input
            className="h-12 rounded-2xl text-lg font-bold tabular-nums"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            placeholder="Ej. 500.00"
            value={amountInput}
            onChange={e => setAmountInput(e.target.value)}
          />
        </label>

        {parsedCents > 0 && (
          <>
            {/* Stacked visual bar */}
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
              {rows.map(row => (
                <div
                  key={row.label}
                  className={`h-full ${row.color} transition-all`}
                  style={{ width: `${Math.max(3, Math.round((row.cents / parsedCents) * 100))}%` }}
                  title={`${row.label}: ${money(row.cents)}`}
                />
              ))}
            </div>

            <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl border bg-card">
              {rows.map(row => {
                const Icon = row.icon;
                const pct = Math.round((row.cents / parsedCents) * 100);
                return (
                  <li key={row.label} className="flex items-center justify-between gap-3 p-3.5">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${row.tone}`}>
                        <Icon className="size-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{row.label}</p>
                        <p className="text-[11px] text-muted-foreground">{row.hint}</p>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-bold tabular-nums">{money(row.cents)}</p>
                      <p className="text-[10px] font-semibold text-muted-foreground">{pct}%</p>
                    </div>
                  </li>
                );
              })}
            </ul>

            <p className="flex items-center gap-2 rounded-xl bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              <Sparkles className="size-4 shrink-0 text-primary" />
              También puedes escribirle a Nubi por WhatsApp: «¿cómo reparto estos {money(parsedCents)}?»
            </p>
          </>
        )}
      </div>
    </FinanceSheet>
  );
}
