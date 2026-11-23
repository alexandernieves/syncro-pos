"use client";

import { useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Briefcase,
  Building2,
  Car,
  CheckCircle2,
  CreditCard,
  Home,
  Laptop,
  Plus,
  Repeat,
  Rocket,
  Sparkles,
  Trash2,
  TrendingDown,
  TrendingUp,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usd } from "@/lib/syncro-admin";
import { FinanceSelect } from "./finance-fields";
import { FinanceSheet } from "./finance-sheet";
import type { AssetCategory, AssetItem, LiabilityCategory, LiabilityItem } from "./calculations";

const money = (cents: number) => usd((cents || 0) / 100);

const assetMeta: Record<AssetCategory, { label: string; icon: LucideIcon; tone: string }> = {
  salary: { label: "Sueldo", icon: Briefcase, tone: "bg-sky-500/15 text-sky-600 dark:text-sky-400" },
  business: { label: "Negocio", icon: Building2, tone: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  investment: { label: "Inversión", icon: TrendingUp, tone: "bg-violet-500/15 text-violet-600 dark:text-violet-400" },
  rental: { label: "Alquiler", icon: Home, tone: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  digital: { label: "Digital", icon: Laptop, tone: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400" },
  other: { label: "Otro activo", icon: Sparkles, tone: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400" },
};

const liabilityMeta: Record<LiabilityCategory, { label: string; icon: LucideIcon; tone: string }> = {
  vehicle: { label: "Vehículo", icon: Car, tone: "bg-rose-500/15 text-rose-600 dark:text-rose-400" },
  housing: { label: "Vivienda", icon: Home, tone: "bg-orange-500/15 text-orange-600 dark:text-orange-400" },
  subscription: { label: "Suscripciones", icon: Repeat, tone: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  debt: { label: "Deuda", icon: CreditCard, tone: "bg-red-500/15 text-red-600 dark:text-red-400" },
  lifestyle: { label: "Estilo de vida", icon: TrendingDown, tone: "bg-pink-500/15 text-pink-600 dark:text-pink-400" },
  other: { label: "Otro pasivo", icon: TrendingDown, tone: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400" },
};

export function FinanceAssetsView({
  assets,
  liabilities,
  monthlySurplusCents,
  busy,
  mobile,
  onSave,
}: {
  assets: AssetItem[];
  liabilities: LiabilityItem[];
  monthlySurplusCents: number;
  busy: boolean;
  mobile: boolean;
  onSave: (next: { assets: AssetItem[]; liabilities: LiabilityItem[] }) => Promise<void> | void;
}) {
  const [addAssetOpen, setAddAssetOpen] = useState(false);
  const [addLiabOpen, setAddLiabOpen] = useState(false);
  const [capitalAssetId, setCapitalAssetId] = useState<string | null>(null);
  const [assetStatusDraft, setAssetStatusDraft] = useState<"active" | "planned">("planned");

  const activeAssets = assets.filter(a => a.status === "active");
  const plannedAssets = assets.filter(a => a.status === "planned");
  const totalAssetFlow = activeAssets.reduce((s, a) => s + a.monthlyCashflowCents, 0);
  const totalLiabilityDrain = liabilities.reduce((s, l) => s + l.monthlyDrainCents, 0);
  const netCashflow = totalAssetFlow - totalLiabilityDrain;
  const singleSourceRisk = activeAssets.length <= 1;

  const liabilityMap = new Map(liabilities.map(l => [l.id, l]));
  const capitalAsset = assets.find(a => a.id === capitalAssetId);

  async function handleAddAsset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    const name = String(f.get("name") ?? "").trim();
    if (!name) return;
    const status = String(f.get("status") ?? "planned") === "active" ? "active" : "planned";
    const category = (String(f.get("category") ?? "business") as AssetCategory);
    const monthlyCashflowCents = Math.max(0, Math.round(Number(f.get("flow") || 0) * 100));
    const startupCapitalCents = Math.max(0, Math.round(Number(f.get("capital") || 0) * 100));
    const savedCapitalCents = Math.max(0, Math.round(Number(f.get("saved") || 0) * 100));
    const linkedRaw = String(f.get("linkedLiabilityId") ?? "none");
    const linkedLiabilityId = linkedRaw === "none" ? null : linkedRaw;

    const created: AssetItem = {
      id: crypto.randomUUID().slice(0, 16),
      name,
      category,
      status,
      monthlyCashflowCents,
      valuationCents: 0,
      startupCapitalCents,
      savedCapitalCents,
      linkedLiabilityId,
      notes: null,
    };
    await onSave({ assets: [created, ...assets], liabilities });
    setAddAssetOpen(false);
  }

  async function handleAddLiability(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    const name = String(f.get("name") ?? "").trim();
    if (!name) return;
    const category = (String(f.get("category") ?? "vehicle") as LiabilityCategory);
    const monthlyDrainCents = Math.max(0, Math.round(Number(f.get("drain") || 0) * 100));
    const balanceCents = Math.max(0, Math.round(Number(f.get("balance") || 0) * 100));

    const created: LiabilityItem = {
      id: crypto.randomUUID().slice(0, 16),
      name,
      category,
      monthlyDrainCents,
      balanceCents,
      notes: null,
    };
    await onSave({ assets, liabilities: [created, ...liabilities] });
    setAddLiabOpen(false);
  }

  async function handleAddCapital(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!capitalAsset) return;
    const addCents = Math.round(Number(new FormData(event.currentTarget).get("amount")) * 100);
    if (!Number.isFinite(addCents) || addCents <= 0) return;
    const nextAssets = assets.map(a =>
      a.id === capitalAsset.id ? { ...a, savedCapitalCents: a.savedCapitalCents + addCents } : a,
    );
    await onSave({ assets: nextAssets, liabilities });
    setCapitalAssetId(null);
  }

  async function handleLaunchAsset(asset: AssetItem) {
    const nextAssets = assets.map(a =>
      a.id === asset.id ? { ...a, status: "active" as const } : a,
    );
    const nextLiabilities = asset.linkedLiabilityId
      ? liabilities.filter(l => l.id !== asset.linkedLiabilityId)
      : liabilities;
    await onSave({ assets: nextAssets, liabilities: nextLiabilities });
  }

  return (
    <div className="space-y-4">
      {/* Hero Assets vs Liabilities Card */}
      <section className="finance-bank-card relative overflow-hidden rounded-[24px] border p-5 text-foreground shadow-xs">
        <div aria-hidden className="finance-grid-light pointer-events-none absolute inset-0 opacity-80" />
        <div className="relative z-10 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                <Rocket className="size-3.5 text-primary" /> Activos vs. Pasivos
              </p>
              <p className={`mt-1 text-[clamp(28px,7vw,38px)] font-bold leading-none tracking-[-0.04em] tabular-nums ${netCashflow >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                {netCashflow >= 0 ? "+" : ""}{money(netCashflow)}<span className="text-sm font-medium text-muted-foreground">/mes</span>
              </p>
            </div>
            <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${singleSourceRisk ? "bg-amber-500/15 text-amber-700 dark:text-amber-400" : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"}`}>
              {singleSourceRisk ? <AlertTriangle className="size-3" /> : <CheckCircle2 className="size-3" />}
              {activeAssets.length} {activeAssets.length === 1 ? "fuente" : "fuentes"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 rounded-2xl border bg-background/75 p-3 backdrop-blur-sm">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Activos producen</p>
              <p className="mt-0.5 text-sm font-bold tabular-nums text-emerald-600 dark:text-emerald-400">+{money(totalAssetFlow)}/mes</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Pasivos drenan</p>
              <p className="mt-0.5 text-sm font-bold tabular-nums text-rose-600 dark:text-rose-400">-{money(totalLiabilityDrain)}/mes</p>
            </div>
          </div>

          {singleSourceRisk && (
            <p className="rounded-xl border border-amber-300/70 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
              Depender de 1 sola fuente de ingreso es frágil. Diseña abajo tu <strong>2do activo</strong> y calcula cuánto capital necesitas para lanzarlo.
            </p>
          )}
        </div>
      </section>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-2.5">
        <Button type="button" className="h-11 rounded-full font-semibold" onClick={() => { setAssetStatusDraft("planned"); setAddAssetOpen(true); }}>
          <Plus className="size-4" /> Nuevo activo
        </Button>
        <Button type="button" variant="outline" className="h-11 rounded-full bg-card font-semibold" onClick={() => setAddLiabOpen(true)}>
          <Plus className="size-4 text-rose-500" /> Nuevo pasivo
        </Button>
      </div>

      {/* Planned Assets (Next Income Sources in Construction) */}
      {plannedAssets.length > 0 && (
        <section className="space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-bold uppercase tracking-wider text-primary">
              Próximos activos en construcción
            </h2>
            <span className="text-xs text-muted-foreground">{plannedAssets.length}</span>
          </div>
          <ul className="space-y-3">
            {plannedAssets.map(asset => {
              const meta = assetMeta[asset.category] ?? assetMeta.business;
              const Icon = meta.icon;
              const linkedLiab = asset.linkedLiabilityId ? liabilityMap.get(asset.linkedLiabilityId) : undefined;
              const pct = asset.startupCapitalCents > 0
                ? Math.min(100, Math.round((asset.savedCapitalCents / asset.startupCapitalCents) * 100))
                : 0;
              const missingCap = Math.max(0, asset.startupCapitalCents - asset.savedCapitalCents);
              const estMonths = missingCap > 0 && monthlySurplusCents > 0
                ? Math.ceil(missingCap / Math.max(1, Math.round(monthlySurplusCents * 0.4)))
                : null;
              const netImpact = asset.monthlyCashflowCents + (linkedLiab?.monthlyDrainCents ?? 0);

              return (
                <li key={asset.id} className="finance-grid-light space-y-3 rounded-[24px] border bg-card p-4 shadow-xs">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className={`flex size-10 shrink-0 items-center justify-center rounded-2xl ${meta.tone}`}>
                        <Icon className="size-4" />
                      </span>
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-bold">{asset.name}</h3>
                        <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold tabular-nums">
                          Flujo estimado: +{money(asset.monthlyCashflowCents)}/mes
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-8 rounded-full text-muted-foreground hover:text-destructive"
                      onClick={() => void onSave({ assets: assets.filter(a => a.id !== asset.id), liabilities })}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>

                  {linkedLiab && (
                    <div className="flex items-start gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-800 dark:text-emerald-300">
                      <Zap className="mt-0.5 size-3.5 shrink-0" />
                      <span>
                        <strong>Sinergia:</strong> neutraliza el pasivo <strong>{linkedLiab.name}</strong> ({money(linkedLiab.monthlyDrainCents)}/mes) → impacto neto total <strong className="tabular-nums">+{money(netImpact)}/mes</strong>.
                      </span>
                    </div>
                  )}

                  {asset.startupCapitalCents > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Capital para lanzarlo</span>
                        <strong className="tabular-nums">{money(asset.savedCapitalCents)} / {money(asset.startupCapitalCents)} ({pct}%)</strong>
                      </div>
                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ type: "spring", stiffness: 220, damping: 28 }}
                          className="h-full rounded-full bg-[#F26B3A]"
                        />
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {missingCap > 0
                          ? `Faltan ${money(missingCap)}${estMonths ? ` · ~${estMonths} meses al ritmo actual` : ""}`
                          : "¡Ya tienes el capital listo para lanzarlo!"}
                      </p>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 border-t pt-2.5">
                    <Button type="button" size="sm" className="h-9 rounded-full px-4 text-xs" onClick={() => setCapitalAssetId(asset.id)}>
                      <Plus className="size-3.5" /> Aportar capital
                    </Button>
                    <Button type="button" size="sm" variant="secondary" className="h-9 rounded-full px-4 text-xs" onClick={() => void handleLaunchAsset(asset)}>
                      <CheckCircle2 className="size-3.5 text-emerald-600" /> Marcar en marcha
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Active Assets */}
      <section className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Activos en marcha (meten dinero)
          </h2>
          <span className="text-xs font-bold tabular-nums text-emerald-600">+{money(totalAssetFlow)}/mes</span>
        </div>
        {activeAssets.length === 0 ? (
          <div className="rounded-[22px] border border-dashed bg-card/60 p-6 text-center text-xs text-muted-foreground">
            Registra tu sueldo o negocio actual como tu primer activo para medir tu diversificación.
          </div>
        ) : (
          <ul className="divide-y divide-border/60 overflow-hidden rounded-[22px] border bg-card shadow-xs">
            {activeAssets.map(asset => {
              const meta = assetMeta[asset.category] ?? assetMeta.other;
              const Icon = meta.icon;
              return (
                <li key={asset.id} className="flex items-center justify-between gap-3 p-3.5">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className={`flex size-10 shrink-0 items-center justify-center rounded-2xl ${meta.tone}`}>
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{asset.name}</p>
                      <p className="text-[11px] text-muted-foreground">{meta.label} · En marcha</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <strong className="text-sm font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                      +{money(asset.monthlyCashflowCents)}/mes
                    </strong>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-8 rounded-full text-muted-foreground hover:text-destructive"
                      onClick={() => void onSave({ assets: assets.filter(a => a.id !== asset.id), liabilities })}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Liabilities */}
      <section className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Pasivos (te sacan dinero cada mes)
          </h2>
          <span className="text-xs font-bold tabular-nums text-rose-600">-{money(totalLiabilityDrain)}/mes</span>
        </div>
        {liabilities.length === 0 ? (
          <div className="rounded-[22px] border border-dashed bg-card/60 p-6 text-center text-xs text-muted-foreground">
            Anota aquí lo que te quita dinero cada mes (ej. carro, alquiler, suscripciones) para planificar cómo neutralizarlo con activos.
          </div>
        ) : (
          <ul className="divide-y divide-border/60 overflow-hidden rounded-[22px] border bg-card shadow-xs">
            {liabilities.map(liab => {
              const meta = liabilityMeta[liab.category] ?? liabilityMeta.other;
              const Icon = meta.icon;
              const neutralizedBy = plannedAssets.find(a => a.linkedLiabilityId === liab.id);
              return (
                <li key={liab.id} className="flex items-center justify-between gap-3 p-3.5">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className={`flex size-10 shrink-0 items-center justify-center rounded-2xl ${meta.tone}`}>
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{liab.name}</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                        <span>{meta.label}</span>
                        <span>·</span>
                        <span className="tabular-nums">-{money(liab.monthlyDrainCents * 12)}/año</span>
                        {neutralizedBy && (
                          <span className="rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                            Lo neutraliza: {neutralizedBy.name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <strong className="text-sm font-bold tabular-nums text-rose-600 dark:text-rose-400">
                      -{money(liab.monthlyDrainCents)}/mes
                    </strong>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-8 rounded-full text-muted-foreground hover:text-destructive"
                      onClick={() => void onSave({ assets, liabilities: liabilities.filter(l => l.id !== liab.id) })}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Sheet: Nuevo Activo */}
      <FinanceSheet
        open={addAssetOpen}
        onOpenChange={open => { if (!busy) setAddAssetOpen(open); }}
        mobile={mobile}
        title="Registrar activo"
        description="Un activo mete dinero en tu bolsillo (o lo hará cuando lo lances)."
      >
        <fieldset disabled={busy} className="min-w-0">
          <form className="grid gap-3.5" onSubmit={handleAddAsset}>
            <label className="block space-y-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <span>Nombre del activo</span>
              <Input className="h-12 rounded-2xl" name="name" placeholder="Ej. Sueldo fijo o Taller mecánico" maxLength={120} required />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <FinanceSelect
                label="Estado"
                name="status"
                value={assetStatusDraft}
                onChange={v => setAssetStatusDraft(v === "active" ? "active" : "planned")}
                options={[
                  ["planned", "En construcción"],
                  ["active", "En marcha"],
                ]}
              />
              <FinanceSelect
                label="Tipo"
                name="category"
                defaultValue="business"
                options={[
                  ["salary", "Sueldo"],
                  ["business", "Negocio"],
                  ["investment", "Inversión"],
                  ["rental", "Alquiler"],
                  ["digital", "Digital"],
                  ["other", "Otro"],
                ]}
              />
            </div>
            <label className="block space-y-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <span>Flujo mensual estimado (USD/mes)</span>
              <Input className="h-12 rounded-2xl tabular-nums" name="flow" type="number" inputMode="decimal" step="0.01" min="0" placeholder="600" required />
            </label>
            {assetStatusDraft === "planned" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block space-y-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <span>Capital necesario (USD)</span>
                    <Input className="h-12 rounded-2xl tabular-nums" name="capital" type="number" inputMode="decimal" step="0.01" min="0" placeholder="3000" />
                  </label>
                  <label className="block space-y-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <span>Ya reunido (USD)</span>
                    <Input className="h-12 rounded-2xl tabular-nums" name="saved" type="number" inputMode="decimal" step="0.01" min="0" defaultValue="0" />
                  </label>
                </div>
                {liabilities.length > 0 && (
                  <FinanceSelect
                    label="¿Neutraliza algún pasivo?"
                    name="linkedLiabilityId"
                    defaultValue="none"
                    options={[
                      ["none", "Ninguno"],
                      ...liabilities.map(l => [l.id, `${l.name} (-${money(l.monthlyDrainCents)}/mes)`] as const),
                    ]}
                  />
                )}
              </>
            )}
            <Button type="submit" className="h-12 rounded-full text-base font-semibold">Guardar activo</Button>
          </form>
        </fieldset>
      </FinanceSheet>

      {/* Sheet: Nuevo Pasivo */}
      <FinanceSheet
        open={addLiabOpen}
        onOpenChange={open => { if (!busy) setAddLiabOpen(open); }}
        mobile={mobile}
        title="Registrar pasivo"
        description="Todo lo que te saca dinero cada mes (vehículo, alquiler, gastos fijos improductivos)."
      >
        <fieldset disabled={busy} className="min-w-0">
          <form className="grid gap-3.5" onSubmit={handleAddLiability}>
            <label className="block space-y-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <span>Nombre del pasivo</span>
              <Input className="h-12 rounded-2xl" name="name" placeholder="Ej. Carro (mantenimiento y gasolina)" maxLength={120} required />
            </label>
            <FinanceSelect
              label="Categoría"
              name="category"
              defaultValue="vehicle"
              options={[
                ["vehicle", "Vehículo"],
                ["housing", "Vivienda"],
                ["subscription", "Suscripciones"],
                ["debt", "Deuda"],
                ["lifestyle", "Estilo de vida"],
                ["other", "Otro"],
              ]}
            />
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <span>Te saca al mes (USD)</span>
                <Input className="h-12 rounded-2xl tabular-nums" name="drain" type="number" inputMode="decimal" step="0.01" min="1" placeholder="120" required />
              </label>
              <label className="block space-y-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <span>Valor/Saldo (opcional)</span>
                <Input className="h-12 rounded-2xl tabular-nums" name="balance" type="number" inputMode="decimal" step="0.01" min="0" defaultValue="0" />
              </label>
            </div>
            <Button type="submit" className="h-12 rounded-full text-base font-semibold">Guardar pasivo</Button>
          </form>
        </fieldset>
      </FinanceSheet>

      {/* Sheet: Aportar capital al activo */}
      <FinanceSheet
        open={!!capitalAsset}
        onOpenChange={open => { if (!open && !busy) setCapitalAssetId(null); }}
        mobile={mobile}
        title={`Sumar capital a ${capitalAsset?.name ?? ""}`}
        description="Registra cuánto dinero apartaste hoy para lanzar este nuevo activo."
      >
        <fieldset disabled={busy} className="min-w-0">
          <form className="grid gap-3.5" onSubmit={handleAddCapital}>
            <label className="block space-y-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <span>Capital apartado hoy (USD)</span>
              <Input className="h-12 rounded-2xl text-lg font-bold tabular-nums" name="amount" type="number" inputMode="decimal" step="0.01" min="0.01" placeholder="100.00" required />
            </label>
            <Button type="submit" className="h-12 rounded-full text-base font-semibold">Sumar capital</Button>
          </form>
        </fieldset>
      </FinanceSheet>
    </div>
  );
}

