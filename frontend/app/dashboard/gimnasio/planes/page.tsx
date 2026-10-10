"use client";

import { useEffect, useState } from "react";
import { IconCalendarRepeat, IconLoader2, IconPencil, IconPlus, IconSnowflake } from "@tabler/icons-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { type GymPlan, durationLabel, gymApi, money } from "@/lib/gym";
import { GymPage, GymPageHeader } from "@/components/gym/gym-ui";

const COLORS = ["#E4572E", "#2563EB", "#059669", "#7C3AED", "#DB2777", "#D97706", "#16140F"];
const DURATIONS: [number, string][] = [[1, "Pase diario"], [7, "Semanal"], [15, "Quincenal"], [30, "Mensual"], [90, "Trimestral"], [180, "Semestral"], [365, "Anual"]];

type Draft = { id?: string; name: string; description: string; durationDays: number; price: string; color: string; maxFreezeDays: string; isActive: boolean };
const emptyDraft: Draft = { name: "", description: "", durationDays: 30, price: "", color: COLORS[0], maxFreezeDays: "0", isActive: true };

export default function GymPlansPage() {
  const [plans, setPlans] = useState<GymPlan[] | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

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
        isActive: draft.isActive,
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

  return (
    <GymPage>
      <GymPageHeader
        title="Planes y membresías"
        description="Los planes que vendes: duración, precio y días que se pueden congelar."
        actions={<Button className="gap-2" onClick={() => setDraft({ ...emptyDraft })}><IconPlus size={16} /> Nuevo plan</Button>}
      />

      {!plans ? (
        <div className="grid gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}</div>
      ) : plans.length === 0 ? (
        <Card className="gap-0 py-0">
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary"><IconCalendarRepeat size={24} /></span>
            <p className="font-semibold">Crea tu primer plan</p>
            <p className="max-w-sm text-sm text-muted-foreground">Por ejemplo: mensual, trimestral o pase diario. Después podrás vendérselos a tus socios.</p>
            <Button className="mt-2 gap-2" onClick={() => setDraft({ ...emptyDraft })}><IconPlus size={16} /> Nuevo plan</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-3">
          {plans.map((p) => (
            <Card key={p.id} className={cn("@container/card relative overflow-hidden bg-gradient-to-t from-primary/5 to-card shadow-xs", !p.isActive && "opacity-60")}>
              <div className="absolute inset-x-0 top-0 h-1" style={{ background: p.color || COLORS[0] }} />
              <CardHeader>
                <CardDescription>{durationLabel(p.durationDays)}</CardDescription>
                <CardTitle className="text-xl font-semibold">{p.name}</CardTitle>
                <CardAction>
                  <Button variant="ghost" size="icon" className="size-8" title="Editar plan" onClick={() => setDraft({ id: p.id, name: p.name, description: p.description || "", durationDays: p.durationDays, price: String(p.price), color: p.color || COLORS[0], maxFreezeDays: String(p.maxFreezeDays), isActive: p.isActive })}>
                    <IconPencil size={16} />
                  </Button>
                </CardAction>
              </CardHeader>
              <CardContent className="space-y-1">
                <p className="text-3xl font-semibold tabular-nums">{money(p.price)}</p>
                {p.description ? (
                  <p className="line-clamp-2 text-sm text-muted-foreground">{p.description}</p>
                ) : p.durationDays >= 60 ? (
                  <p className="text-sm text-muted-foreground">Equivale a {money(p.price / (p.durationDays / 30))} al mes</p>
                ) : (
                  <p className="text-sm text-muted-foreground">{p.durationDays === 1 ? "Acceso por un día" : `Acceso por ${durationLabel(p.durationDays)}`}</p>
                )}
              </CardContent>
              <CardFooter className="flex flex-wrap gap-1.5">
                <Badge variant="outline">{p._count?.memberships ?? 0} vendidas</Badge>
                {p.maxFreezeDays > 0 && <Badge variant="outline" className="gap-1"><IconSnowflake size={12} /> Congela hasta {p.maxFreezeDays} días</Badge>}
                {!p.isActive && <Badge variant="outline">Desactivado</Badge>}
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!draft} onOpenChange={(open) => !open && setDraft(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{draft?.id ? "Editar plan" : "Nuevo plan"}</DialogTitle></DialogHeader>
          {draft && (
            <div className="grid gap-4">
              <div className="space-y-1.5">
                <Label>Nombre</Label>
                <Input autoFocus value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Mensual" />
              </div>
              <div className="space-y-1.5">
                <Label>Duración</Label>
                <div className="flex flex-wrap gap-1.5">
                  {DURATIONS.map(([days, label]) => (
                    <button key={days} type="button" onClick={() => setDraft({ ...draft, durationDays: days })} className={cn("h-8 rounded-full border px-3 text-xs font-semibold", draft.durationDays === days ? "border-primary bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:text-foreground")}>
                      {label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <Input type="number" min={1} value={draft.durationDays} onChange={(e) => setDraft({ ...draft, durationDays: Number(e.target.value) })} className="w-28" />
                  <span className="text-sm text-muted-foreground">Días</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Precio ($)</Label>
                  <Input type="number" min={0} step="0.01" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} placeholder="25.00" />
                </div>
                <div className="space-y-1.5">
                  <Label>Días para congelar</Label>
                  <Input type="number" min={0} value={draft.maxFreezeDays} onChange={(e) => setDraft({ ...draft, maxFreezeDays: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Descripción (opcional)</Label>
                <Input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Acceso libre a sala de máquinas y clases grupales" />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex gap-1.5">
                  {COLORS.map((c) => (
                    <button key={c} type="button" onClick={() => setDraft({ ...draft, color: c })} className={cn("size-6 rounded-full ring-1 ring-black/10", draft.color === c && "ring-2 ring-foreground ring-offset-2")} style={{ background: c }} title={c} />
                  ))}
                </div>
                {draft.id && (
                  <label className="flex items-center gap-2 text-sm">
                    <Switch checked={draft.isActive} onCheckedChange={(v) => setDraft({ ...draft, isActive: v })} /> Activo
                  </label>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>Cancelar</Button>
            <Button onClick={save} disabled={saving} className="gap-2">{saving && <IconLoader2 size={16} className="animate-spin" />} Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </GymPage>
  );
}
