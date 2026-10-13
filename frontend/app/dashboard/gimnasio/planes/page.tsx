"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { IconCalendarRepeat, IconCash, IconCheck, IconLoader2, IconPencil, IconPlus, IconTrophy, IconUsers, IconX } from "@tabler/icons-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StatCard, StatGrid } from "@/components/stat-card";
import { Optional } from "@/components/forms/contact-fields";
import { DAYS, OptionSelect, TimeSelect } from "@/components/forms/option-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { type GymPlan, durationLabel, gymApi, money } from "@/lib/gym";
import { FilterChips, GymPage, GymPageHeader } from "@/components/gym/gym-ui";

const COLORS = ["#E4572E", "#2563EB", "#059669", "#7C3AED", "#DB2777", "#D97706", "#16140F"];
const DURATIONS: [number, string][] = [[1, "Pase diario"], [7, "Semanal"], [15, "Quincenal"], [30, "Mensual"], [90, "Trimestral"], [180, "Semestral"], [365, "Anual"]];

type Window = { days: number[]; start: string; end: string };
type Draft = {
  id?: string;
  name: string;
  description: string;
  durationDays: number;
  price: string;
  color: string;
  maxFreezeDays: string;
  guestPassesPerMonth: string;
  isActive: boolean;
  windows: Window[];
  maxEntriesPerDay: string;
  maxEntriesPerWeek: string;
  totalEntries: string;
  includesClasses: boolean;
  allowedClassIds: string[];
};
/** "HH:MM" plus some minutes, capped at 23:30. */
const laterBy = (t: string, minutes: number) => { const m = Math.min(23 * 60 + 30, Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5)) + minutes); return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`; };
const WEEK: [number, string][] = [[1, "L"], [2, "M"], [3, "M"], [4, "J"], [5, "V"], [6, "S"], [0, "D"]];
const hm = (t: string) => { const [h, m] = t.split(":").map(Number); return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "a. m." : "p. m."}`; };
const toDraft = (p: GymPlan): Draft => ({
  id: p.id,
  name: p.name,
  description: p.description || "",
  durationDays: p.durationDays,
  price: String(p.price),
  color: p.color || COLORS[0],
  maxFreezeDays: String(p.maxFreezeDays),
  guestPassesPerMonth: String(p.guestPassesPerMonth ?? 0),
  isActive: p.isActive,
  windows: (p.accessWindows as Window[] | null) ?? [],
  maxEntriesPerDay: String(p.maxEntriesPerDay ?? 0),
  maxEntriesPerWeek: String(p.maxEntriesPerWeek ?? 0),
  totalEntries: String(p.totalEntries ?? 0),
  includesClasses: p.includesClasses ?? true,
  allowedClassIds: p.allowedClassIds ?? [],
});
const emptyDraft: Draft = { name: "", description: "", durationDays: 30, price: "", color: COLORS[0], maxFreezeDays: "0", guestPassesPerMonth: "0", isActive: true, windows: [], maxEntriesPerDay: "0", maxEntriesPerWeek: "0", totalEntries: "0", includesClasses: true, allowedClassIds: [] };

export default function GymPlansPage() {
  const [plans, setPlans] = useState<GymPlan[] | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [classes, setClasses] = useState<{ id: string; name: string; isActive: boolean }[]>([]);
  useEffect(() => { gymApi<{ id: string; name: string; isActive: boolean }[]>("/classes").then(setClasses).catch(() => {}); }, []);

  const load = () => gymApi<GymPlan[]>("/plans").then(setPlans).catch((e) => toast.error(e.message));
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const body = {
        name: draft.name,
        description: draft.description,
        durationDays: Number(draft.durationDays),
        price: Number(draft.price),
        color: draft.color,
        maxFreezeDays: Number(draft.maxFreezeDays) || 0,
        guestPassesPerMonth: Number(draft.guestPassesPerMonth) || 0,
        isActive: draft.isActive,
        accessWindows: draft.windows,
        maxEntriesPerDay: Number(draft.maxEntriesPerDay) || 0,
        maxEntriesPerWeek: Number(draft.maxEntriesPerWeek) || 0,
        totalEntries: Number(draft.totalEntries) || 0,
        includesClasses: draft.includesClasses,
        allowedClassIds: draft.includesClasses ? draft.allowedClassIds : [],
      };
      await gymApi(draft.id ? `/plans/${draft.id}` : "/plans", { method: draft.id ? "PUT" : "POST", json: body });
      toast.success(draft.id ? "Plan actualizado" : "Plan creado");
      setDraft(null);
      load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const [filter, setFilter] = useState<"active" | "inactive">("active");
  const shown = (plans ?? []).filter((p) => (filter === "active" ? p.isActive : !p.isActive));
  const activePlans = (plans ?? []).filter((p) => p.isActive);
  const totalMembers = activePlans.reduce((t, p) => t + (p.activeMembers ?? 0), 0);
  const revenue = (plans ?? []).reduce((t, p) => t + (p.revenue30d ?? 0), 0);
  const top = [...activePlans].sort((a, b) => (b.activeMembers ?? 0) - (a.activeMembers ?? 0))[0];
  const topId = top && (top.activeMembers ?? 0) > 0 ? top.id : null;
  const set = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  return (
    <GymPage>
      <GymPageHeader
        title="Planes y membresías"
        description="Lo que vendes: precio, duración y qué incluye cada plan."
        actions={<Button className="gap-2" onClick={() => setDraft({ ...emptyDraft })}><IconPlus size={16} /> Nuevo plan</Button>}
      />

      <StatGrid>
        <StatCard label="Planes a la venta" value={plans ? activePlans.length : "—"} icon={<IconCalendarRepeat size={20} />} title={`${(plans ?? []).length - activePlans.length} desactivados`} hint="Los desactivados no se pueden vender" />
        <StatCard label="Socios con plan" value={plans ? totalMembers : "—"} icon={<IconUsers size={20} />} tone="good" title="Membresías vigentes hoy" hint="Incluye las congeladas" />
        <StatCard label="Cobrado en 30 días" value={plans ? money(revenue) : "—"} icon={<IconCash size={20} />} tone="primary" title="Planes vendidos y abonos" hint="Sin pases de día" />
        <StatCard label="El más vendido" value={topId ? top!.name : "—"} icon={<IconTrophy size={20} />} title={topId ? `${top!.activeMembers} socios activos` : "Todavía sin socios"} hint="Por socios con el plan hoy" />
      </StatGrid>

      <FilterChips value={filter} onChange={setFilter} options={[["active", "A la venta"], ["inactive", "Desactivados"]]} counts={{ active: activePlans.length, inactive: (plans ?? []).length - activePlans.length }} />

      {!plans ? (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-96 rounded-3xl" />)}</div>
      ) : plans.length === 0 ? (
        <Card className="gap-0 py-0">
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary"><IconCalendarRepeat size={24} /></span>
            <p className="font-semibold">Crea tu primer plan</p>
            <p className="max-w-sm text-sm text-muted-foreground">Por ejemplo: mensual, trimestral o pase diario. Después podrás vendérselos a tus socios.</p>
            <Button className="mt-2 gap-2" onClick={() => setDraft({ ...emptyDraft })}><IconPlus size={16} /> Nuevo plan</Button>
          </CardContent>
        </Card>
      ) : !shown.length ? (
        <p className="py-10 text-center text-sm text-muted-foreground">No hay planes desactivados.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {shown.map((p) => <PlanCard key={p.id} plan={p} classes={classes} popular={p.id === topId} onEdit={() => setDraft(toDraft(p))} />)}
          {filter === "active" && (
            <button type="button" onClick={() => setDraft({ ...emptyDraft })} className="flex min-h-64 flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed text-muted-foreground transition hover:border-primary/40 hover:text-primary">
              <IconPlus size={24} />
              <span className="text-sm font-medium">Nuevo plan</span>
            </button>
          )}
        </div>
      )}

      <Dialog open={!!draft} onOpenChange={(open) => !open && setDraft(null)}>
        <DialogContent className="max-h-[92vh] gap-0 overflow-y-auto p-0 sm:max-w-2xl">
          <DialogHeader className="border-b px-6 py-5">
            <DialogTitle>{draft?.id ? `Editar ${draft.name || "plan"}` : "Nuevo plan"}</DialogTitle>
            <DialogDescription>Los cambios aplican a las ventas nuevas; las membresías ya vendidas conservan su precio y fechas.</DialogDescription>
          </DialogHeader>
          {draft && (
            <div className="divide-y">
              <section className="grid gap-4 px-6 py-5 sm:grid-cols-[1fr_auto]">
                <div className="space-y-1.5">
                  <Label>Nombre</Label>
                  <Input autoFocus value={draft.name} onChange={(e) => set({ name: e.target.value })} placeholder="Ej.: mensual" />
                </div>
                <div className="space-y-1.5">
                  <Label>Color</Label>
                  <div className="flex h-9 items-center gap-1.5">
                    {COLORS.map((c) => (
                      <button key={c} type="button" onClick={() => set({ color: c })} className={cn("size-6 rounded-full transition", draft.color === c ? "ring-2 ring-offset-2 ring-offset-background" : "opacity-80 hover:opacity-100")} style={{ background: c, ["--tw-ring-color" as string]: c }} title={c} />
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Descripción <Optional /></Label>
                  <Input value={draft.description} onChange={(e) => set({ description: e.target.value })} placeholder="Ej.: sala de máquinas y clases grupales" />
                </div>
              </section>

              <section className="space-y-4 px-6 py-5">
                <p className="text-sm font-semibold">Precio y duración</p>
                <div className="flex flex-wrap gap-1.5">
                  {DURATIONS.map(([days, label]) => (
                    <button key={days} type="button" onClick={() => set({ durationDays: days })} className={cn("h-8 rounded-full border px-3 text-xs font-semibold transition", draft.durationDays === days ? "border-primary bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:text-foreground")}>
                      {label}
                    </button>
                  ))}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Duración en días</Label>
                    <OptionSelect value={draft.durationDays} onChange={(v) => set({ durationDays: v })} options={[1, 7, 15, 30, 60, 90, 180, 365]} unit={DAYS} min={1} max={730} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Precio ($)</Label>
                    <OptionSelect value={draft.price === "" ? null : Number(draft.price)} onChange={(v) => set({ price: String(v) })} options={[3, 5, 10, 15, 20, 25, 30, 40, 50, 65, 100]} unit="money" min={0} max={2000} zeroLabel="Gratis" placeholder="Elegir precio" />
                    {Number(draft.price) > 0 && draft.durationDays >= 60 && <p className="text-xs text-muted-foreground">Equivale a {money(Number(draft.price) / (draft.durationDays / 30))} al mes</p>}
                  </div>
                </div>
              </section>

              <section className="space-y-4 px-6 py-5">
                <p className="text-sm font-semibold">Qué incluye</p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Horario en que puede entrar</Label>
                    <Button size="sm" variant="ghost" className="h-7 gap-1 text-primary" onClick={() => set({ windows: [...draft.windows, { days: [1, 2, 3, 4, 5], start: "06:00", end: "12:00" }] })}><IconPlus size={14} /> Agregar horario</Button>
                  </div>
                  {draft.windows.length === 0 && <p className="rounded-xl bg-muted/40 px-3 py-2 text-sm text-muted-foreground">A cualquier hora que abra el gimnasio.</p>}
                  {draft.windows.map((w, i) => (
                    <div key={i} className="flex flex-wrap items-center gap-2 rounded-xl bg-muted/40 p-2">
                      <div className="flex gap-1">
                        {WEEK.map(([d, l]) => {
                          const on = w.days.includes(d);
                          return <button key={d} type="button" onClick={() => set({ windows: draft.windows.map((x, j) => (j === i ? { ...x, days: on ? x.days.filter((y) => y !== d) : [...x.days, d] } : x)) })} className={cn("size-7 rounded-md text-[11px] font-semibold", on ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground")}>{l}</button>;
                        })}
                      </div>
                      <TimeSelect value={w.start} onChange={(v) => set({ windows: draft.windows.map((x, j) => (j === i ? { ...x, start: v, end: x.end > v ? x.end : laterBy(v, 60) } : x)) })} />
                      <span className="text-xs text-muted-foreground">a</span>
                      <TimeSelect value={w.end} min={w.start} onChange={(v) => set({ windows: draft.windows.map((x, j) => (j === i ? { ...x, end: v } : x)) })} />
                      <Button size="icon" variant="ghost" className="ml-auto size-8 text-rose-600" title="Quitar horario" onClick={() => set({ windows: draft.windows.filter((_, j) => j !== i) })}><IconX size={15} /></Button>
                    </div>
                  ))}
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5"><Label>Entradas por día</Label><OptionSelect value={Number(draft.maxEntriesPerDay) || 0} onChange={(v) => set({ maxEntriesPerDay: String(v) })} options={[0, 1, 2, 3]} unit={{ one: "entrada", many: "entradas" }} min={0} max={10} zeroLabel="Sin límite" /></div>
                  <div className="space-y-1.5"><Label>Entradas por semana</Label><OptionSelect value={Number(draft.maxEntriesPerWeek) || 0} onChange={(v) => set({ maxEntriesPerWeek: String(v) })} options={[0, 1, 2, 3, 4, 5, 6]} unit={{ one: "entrada", many: "entradas" }} min={0} max={21} zeroLabel="Sin límite" /></div>
                  <div className="space-y-1.5"><Label>Paquete de entradas</Label><OptionSelect value={Number(draft.totalEntries) || 0} onChange={(v) => set({ totalEntries: String(v) })} options={[0, 4, 8, 10, 12, 15, 20, 30]} unit={{ one: "entrada", many: "entradas" }} min={0} max={100} zeroLabel="Sin paquete" /></div>
                </div>
                <p className="-mt-1 text-xs text-muted-foreground">El paquete sirve para planes como "12 entradas en el mes".</p>
                <div className="space-y-2 rounded-xl bg-muted/40 p-3">
                  <label className="flex items-center justify-between gap-3 text-sm font-medium">
                    Incluye clases grupales
                    <Switch checked={draft.includesClasses} onCheckedChange={(v) => set({ includesClasses: v })} />
                  </label>
                  {draft.includesClasses && classes.length > 0 && (
                    <>
                      <p className="text-xs text-muted-foreground">{draft.allowedClassIds.length ? "Solo las clases marcadas:" : "Todas las clases. Marca algunas para limitarlo:"}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {classes.filter((c) => c.isActive).map((c) => {
                          const on = draft.allowedClassIds.includes(c.id);
                          return <button key={c.id} type="button" onClick={() => set({ allowedClassIds: on ? draft.allowedClassIds.filter((x) => x !== c.id) : [...draft.allowedClassIds, c.id] })} className={cn("rounded-full border px-3 py-1 text-xs", on ? "border-primary bg-primary/10 text-primary" : "bg-background text-muted-foreground")}>{c.name}</button>;
                        })}
                      </div>
                    </>
                  )}
                </div>
              </section>

              <section className="grid gap-4 px-6 py-5 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Días que se puede congelar</Label>
                  <OptionSelect value={Number(draft.maxFreezeDays) || 0} onChange={(v) => set({ maxFreezeDays: String(v) })} options={[0, 3, 5, 7, 10, 15, 30]} unit={DAYS} min={0} max={90} zeroLabel="No se puede congelar" />
                  <p className="text-xs text-muted-foreground">Días que el socio puede pausar su plan.</p>
                </div>
                <div className="space-y-1.5">
                  <Label>Invitados gratis al mes</Label>
                  <OptionSelect value={Number(draft.guestPassesPerMonth) || 0} onChange={(v) => set({ guestPassesPerMonth: String(v) })} options={[0, 1, 2, 3, 4, 5]} unit={{ one: "invitado", many: "invitados" }} min={0} max={10} zeroLabel="Ninguno" />
                  <p className="text-xs text-muted-foreground">Después se cobra el pase de día.</p>
                </div>
                {draft.id && (
                  <label className="flex items-center justify-between gap-3 rounded-xl bg-muted/40 px-3 py-2 text-sm sm:col-span-2">
                    <span>
                      <span className="block font-medium">A la venta</span>
                      <span className="block text-xs text-muted-foreground">Desactívalo para dejar de venderlo; los socios que ya lo tienen no se afectan.</span>
                    </span>
                    <Switch checked={draft.isActive} onCheckedChange={(v) => set({ isActive: v })} />
                  </label>
                )}
              </section>
            </div>
          )}
          <DialogFooter className="border-t px-6 py-4">
            <Button variant="outline" onClick={() => setDraft(null)}>Cancelar</Button>
            <Button onClick={save} disabled={saving || !draft?.name.trim() || draft?.price === ""} className="gap-2">{saving && <IconLoader2 size={16} className="animate-spin" />} Guardar plan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </GymPage>
  );
}

/** Pricing card: what the plan costs, what it includes and how it's selling. */
function PlanCard({ plan: p, classes, popular, onEdit }: { plan: GymPlan; classes: { id: string; name: string }[]; popular: boolean; onEdit: () => void }) {
  const color = p.color || COLORS[0];
  const windows = (p.accessWindows as Window[] | null) ?? [];
  const perMonth = p.durationDays >= 60 ? p.price / (p.durationDays / 30) : null;
  const allowed = p.allowedClassIds?.length ? classes.filter((c) => p.allowedClassIds!.includes(c.id)).map((c) => c.name) : [];
  const dayNames = (days: number[]) => {
    const order = [1, 2, 3, 4, 5, 6, 0];
    const sorted = order.filter((d) => days.includes(d));
    const names = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
    if (sorted.length === 7) return "Todos los días";
    if (sorted.join() === "1,2,3,4,5") return "Lun a vie";
    return sorted.map((d) => names[d]).join(", ");
  };
  const features: { ok: boolean; text: string }[] = [
    windows.length ? { ok: true, text: windows.map((w) => `${dayNames(w.days)} · ${hm(w.start)} a ${hm(w.end)}`).join(" / ") } : { ok: true, text: "Acceso en todo el horario del gimnasio" },
    p.includesClasses === false ? { ok: false, text: "Sin clases grupales" } : { ok: true, text: allowed.length ? `Clases: ${allowed.join(", ")}` : "Todas las clases grupales" },
    ...((p.maxEntriesPerDay ?? 0) > 0 || (p.maxEntriesPerWeek ?? 0) > 0
      ? [{ ok: true, text: [p.maxEntriesPerDay ? `${p.maxEntriesPerDay} ${p.maxEntriesPerDay === 1 ? "entrada" : "entradas"} al día` : null, p.maxEntriesPerWeek ? `${p.maxEntriesPerWeek} por semana` : null].filter(Boolean).join(" · ") }]
      : [{ ok: true, text: "Entradas ilimitadas" }]),
    ...((p.totalEntries ?? 0) > 0 ? [{ ok: true, text: `Paquete de ${p.totalEntries} entradas` }] : []),
    p.maxFreezeDays > 0 ? { ok: true, text: `Congela hasta ${p.maxFreezeDays} días` } : { ok: false, text: "No se puede congelar" },
    ...((p.guestPassesPerMonth ?? 0) > 0 ? [{ ok: true, text: `${p.guestPassesPerMonth} ${p.guestPassesPerMonth === 1 ? "invitado gratis" : "invitados gratis"} al mes` }] : []),
  ];

  return (
    <div className={cn("relative flex flex-col rounded-3xl bg-card p-6 shadow-sm ring-1 ring-border/60 transition hover:shadow-md", popular && "ring-2 ring-primary/50", !p.isActive && "opacity-60")}>
      {popular && <span className="absolute -top-3 left-6 rounded-full bg-primary px-3 py-1 text-[11px] font-bold text-primary-foreground shadow-sm">El más vendido</span>}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-2xl" style={{ background: `color-mix(in oklab, ${color} 22%, var(--card))`, color: `color-mix(in oklab, ${color} 45%, black)` }}>
            <IconCalendarRepeat size={22} />
          </span>
          <div>
            <p className="text-lg font-bold leading-tight">{p.name}</p>
            <p className="text-xs text-muted-foreground">{p.durationDays === 1 ? "Un día" : durationLabel(p.durationDays)}</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="size-8 text-muted-foreground" title="Editar plan" onClick={onEdit}><IconPencil size={16} /></Button>
      </div>

      <div className="mt-5">
        <p className="flex items-baseline gap-1.5">
          <span className="text-4xl font-bold tracking-tight tabular-nums">{money(p.price)}</span>
          <span className="text-sm text-muted-foreground">/ {p.durationDays === 1 ? "día" : durationLabel(p.durationDays)}</span>
        </p>
        <p className="mt-1 min-h-5 text-sm text-muted-foreground">{perMonth ? `Equivale a ${money(perMonth)} al mes` : p.description || ""}</p>
        {perMonth && p.description && <p className="text-sm text-muted-foreground">{p.description}</p>}
      </div>

      <ul className="mt-5 flex-1 space-y-2.5">
        {features.map((f) => (
          <li key={f.text} className={cn("flex items-start gap-2.5 text-sm", !f.ok && "text-muted-foreground")}>
            <span className={cn("mt-0.5 flex size-4.5 shrink-0 items-center justify-center rounded-full", f.ok ? "bg-emerald-500/15 text-emerald-700" : "bg-muted text-muted-foreground")}>
              {f.ok ? <IconCheck size={12} stroke={3} /> : <IconX size={11} stroke={3} />}
            </span>
            {f.text}
          </li>
        ))}
      </ul>

      <div className="mt-6 grid grid-cols-2 gap-2 rounded-2xl bg-muted/40 p-3 text-center">
        <div>
          <p className="text-lg font-bold tabular-nums">{p.activeMembers ?? 0}</p>
          <p className="text-[11px] text-muted-foreground">{p.activeMembers === 1 ? "Socio activo" : "Socios activos"}</p>
        </div>
        <div>
          <p className="text-lg font-bold tabular-nums">{money(p.revenue30d ?? 0)}</p>
          <p className="text-[11px] text-muted-foreground">Cobrado en 30 días</p>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <Button asChild variant="outline" className="flex-1"><Link href="/dashboard/gimnasio/socios">Vender a un socio</Link></Button>
        <Button variant="ghost" onClick={onEdit}>Editar</Button>
      </div>
    </div>
  );
}
