"use client";

import { useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import {
  PiggyBank,
  Plus,
  Rocket,
  ShieldCheck,
  Target,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usd } from "@/lib/syncro-admin";
import { FinanceSelect } from "./finance-fields";
import { FinanceSheet } from "./finance-sheet";
import type { Goal, GoalKind } from "./calculations";

const money = (cents: number) => usd((cents || 0) / 100);

const kindMeta: Record<GoalKind, { label: string; icon: typeof Rocket; badge: string; bar: string }> = {
  investment: {
    label: "Inversión",
    icon: TrendingUp,
    badge: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
    bar: "bg-violet-500",
  },
  emergency: {
    label: "Emergencia",
    icon: ShieldCheck,
    badge: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
    bar: "bg-sky-500",
  },
  goal: {
    label: "Objetivo",
    icon: Target,
    badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    bar: "bg-emerald-500",
  },
};

export function FinanceGoalsView({
  goals,
  busy,
  mobile,
  onSaveGoals,
}: {
  goals: Goal[];
  busy: boolean;
  mobile: boolean;
  onSaveGoals: (next: Goal[]) => Promise<void> | void;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [contributingId, setContributingId] = useState<string | null>(null);

  const totalSaved = goals.reduce((sum, g) => sum + g.savedCents, 0);
  const totalTarget = goals.reduce((sum, g) => sum + g.targetCents, 0);
  const totalInvested = goals.filter(g => g.kind === "investment").reduce((sum, g) => sum + g.savedCents, 0);
  const monthlyCommitment = goals.reduce((sum, g) => sum + g.monthlyTargetCents, 0);
  const contributingGoal = goals.find(g => g.id === contributingId);

  async function handleAddGoal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const name = String(fields.get("name") ?? "").trim();
    const kind = (String(fields.get("kind") ?? "investment") as GoalKind);
    const targetCents = Math.round(Number(fields.get("target")) * 100);
    const savedCents = Math.max(0, Math.round(Number(fields.get("saved") || 0) * 100));
    const monthlyTargetCents = Math.max(0, Math.round(Number(fields.get("monthly") || 0) * 100));
    if (!name || targetCents <= 0) return;

    const created: Goal = {
      id: crypto.randomUUID().slice(0, 16),
      name,
      kind,
      targetCents,
      savedCents,
      monthlyTargetCents,
      deadline: null,
    };
    await onSaveGoals([created, ...goals]);
    setAddOpen(false);
  }

  async function handleContribute(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!contributingGoal) return;
    const addCents = Math.round(Number(new FormData(event.currentTarget).get("amount")) * 100);
    if (!Number.isFinite(addCents) || addCents <= 0) return;
    const next = goals.map(g =>
      g.id === contributingGoal.id ? { ...g, savedCents: g.savedCents + addCents } : g,
    );
    await onSaveGoals(next);
    setContributingId(null);
  }

  return (
    <div className="space-y-4">
      {/* Hero Wealth & Investments Card */}
      <section className="finance-bank-card relative overflow-hidden rounded-[28px] p-5 text-white shadow-[0_20px_44px_-18px_rgba(20,16,12,0.55)]">
        <div aria-hidden className="finance-grid-bg pointer-events-none absolute inset-0 opacity-70" />
        <div className="relative z-10 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/60">
                <Rocket className="size-3.5 text-[#F6A27F]" /> Objetivos e Inversiones
              </p>
              <p className="mt-1 text-[clamp(30px,8vw,40px)] font-bold leading-none tracking-[-0.04em] tabular-nums">
                {money(totalSaved)}
              </p>
              <p className="mt-1 text-xs text-white/65">
                {totalTarget > 0 ? `de ${money(totalTarget)} en metas activas` : "Define metas de inversión y ahorro para prosperar"}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={() => setAddOpen(true)}
              className="h-10 rounded-full bg-[#F26B3A] px-4 text-xs font-bold text-white shadow-lg shadow-[#F26B3A]/30 hover:bg-[#e35d2c]"
            >
              <Plus className="size-4" /> Nuevo
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-white/[0.06] p-3 backdrop-blur-md">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-white/55">En inversiones</p>
              <p className="mt-0.5 text-sm font-bold tabular-nums text-violet-300">{money(totalInvested)}</p>
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-white/55">Meta mensual</p>
              <p className="mt-0.5 text-sm font-bold tabular-nums text-emerald-300">{money(monthlyCommitment)}/mes</p>
            </div>
          </div>
        </div>
      </section>

      {/* Goals Grid */}
      {goals.length === 0 ? (
        <section className="flex flex-col items-center justify-center gap-2 rounded-[24px] border border-dashed bg-card/60 p-8 text-center">
          <PiggyBank className="size-9 text-muted-foreground/60" />
          <h3 className="text-sm font-bold">Sin objetivos creados</h3>
          <p className="max-w-xs text-xs text-muted-foreground">
            Crea sobres para invertir en un negocio, armar tu fondo de emergencia o ahorrar para una meta específica.
          </p>
          <Button type="button" size="sm" variant="outline" className="mt-2 rounded-full" onClick={() => setAddOpen(true)}>
            <Plus className="size-4" /> Crear primer objetivo
          </Button>
        </section>
      ) : (
        <ul className="space-y-3">
          {goals.map(goal => {
            const meta = kindMeta[goal.kind] ?? kindMeta.goal;
            const Icon = meta.icon;
            const pct = Math.min(100, Math.round((goal.savedCents / Math.max(1, goal.targetCents)) * 100));
            const missing = Math.max(0, goal.targetCents - goal.savedCents);
            const monthsLeft = missing > 0 && goal.monthlyTargetCents > 0
              ? Math.ceil(missing / goal.monthlyTargetCents)
              : null;

            return (
              <li key={goal.id} className="space-y-3 rounded-[24px] border bg-card p-4 shadow-xs">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className={`flex size-10 shrink-0 items-center justify-center rounded-2xl ${meta.badge}`}>
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate text-sm font-bold">{goal.name}</h3>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${meta.badge}`}>
                          {meta.label}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {goal.monthlyTargetCents > 0 ? `Plan: ${money(goal.monthlyTargetCents)}/mes` : "Aporte libre"}
                        {monthsLeft ? ` · ~${monthsLeft} ${monthsLeft === 1 ? "mes" : "meses"}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-base font-bold tabular-nums">{money(goal.savedCents)}</p>
                    <p className="text-[11px] text-muted-foreground tabular-nums">de {money(goal.targetCents)}</p>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ type: "spring", stiffness: 220, damping: 28 }}
                      className={`h-full rounded-full ${meta.bar}`}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="font-semibold text-foreground">{pct}% completado</span>
                    <span className="tabular-nums">{missing > 0 ? `Faltan ${money(missing)}` : "¡Meta lograda!"}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 border-t pt-2.5">
                  <Button type="button" size="sm" className="h-9 rounded-full px-4 text-xs" onClick={() => setContributingId(goal.id)}>
                    <Plus className="size-3.5" /> Aportar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-9 rounded-full text-xs text-muted-foreground hover:text-destructive"
                    onClick={() => void onSaveGoals(goals.filter(g => g.id !== goal.id))}
                  >
                    <Trash2 className="size-3.5" /> Quitar
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* New Goal Sheet */}
      <FinanceSheet
        open={addOpen}
        onOpenChange={open => { if (!busy) setAddOpen(open); }}
        mobile={mobile}
        title="Nuevo objetivo o inversión"
        description="Incluiremos esta meta en tu asistente de reparto al cobrar."
      >
        <fieldset disabled={busy} className="min-w-0">
          <form className="grid gap-3.5" onSubmit={handleAddGoal}>
            <label className="block space-y-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <span>Nombre del objetivo</span>
              <Input className="h-12 rounded-2xl" name="name" placeholder="Ej. Capital para invertir en negocio" maxLength={120} required />
            </label>
            <FinanceSelect
              label="Tipo"
              name="kind"
              defaultValue="investment"
              options={[
                ["investment", "Inversión / Negocio"],
                ["emergency", "Fondo de emergencia"],
                ["goal", "Meta personal / Ahorro"],
              ]}
            />
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <span>Meta total (USD)</span>
                <Input className="h-12 rounded-2xl tabular-nums" name="target" type="number" inputMode="decimal" step="0.01" min="1" placeholder="1000" required />
              </label>
              <label className="block space-y-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <span>Aporte mensual (USD)</span>
                <Input className="h-12 rounded-2xl tabular-nums" name="monthly" type="number" inputMode="decimal" step="0.01" min="0" placeholder="150" />
              </label>
            </div>
            <label className="block space-y-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <span>Ya ahorrado (USD, opcional)</span>
              <Input className="h-12 rounded-2xl tabular-nums" name="saved" type="number" inputMode="decimal" step="0.01" min="0" defaultValue="0" />
            </label>
            <Button type="submit" className="h-12 rounded-full text-base font-semibold">Guardar objetivo</Button>
          </form>
        </fieldset>
      </FinanceSheet>

      {/* Contribute Sheet */}
      <FinanceSheet
        open={!!contributingGoal}
        onOpenChange={open => { if (!open && !busy) setContributingId(null); }}
        mobile={mobile}
        title={`Aportar a ${contributingGoal?.name ?? ""}`}
        description="Registra cuánto apartaste hoy para este sobre/objetivo."
      >
        <fieldset disabled={busy} className="min-w-0">
          <form className="grid gap-3.5" onSubmit={handleContribute}>
            <label className="block space-y-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <span>Monto apartado (USD)</span>
              <Input className="h-12 rounded-2xl text-lg font-bold tabular-nums" name="amount" type="number" inputMode="decimal" step="0.01" min="0.01" placeholder="50.00" required />
            </label>
            <Button type="submit" className="h-12 rounded-full text-base font-semibold">Sumar al objetivo</Button>
          </form>
        </fieldset>
      </FinanceSheet>
    </div>
  );
}
