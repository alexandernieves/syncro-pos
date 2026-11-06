"use client";

import { useCallback, useEffect, useState } from "react";
import { IconCheck, IconClockPlay, IconLoader2, IconPlayerPause, IconPlus, IconTrash } from "@tabler/icons-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { adminApi, shortDate } from "@/lib/syncro-admin";

export const MODULE_STATUS_LABEL: Record<string, string> = {
  REQUESTED: "Solicitado",
  IN_REVIEW: "En revisión",
  BUILDING: "En construcción",
  READY: "Listo para probar",
  TRIAL: "En prueba",
  ACTIVE: "Activo",
  PAUSED: "Pausado",
  REJECTED: "Rechazado",
};
export const MODULE_STATUS_CLASS: Record<string, string> = {
  TRIAL: "border-blue-600/30 bg-blue-600/10 text-blue-700",
  ACTIVE: "border-emerald-600/30 bg-emerald-600/10 text-emerald-700",
  PAUSED: "border-amber-600/30 bg-amber-600/10 text-amber-800",
  REJECTED: "border-rose-600/30 bg-rose-600/10 text-rose-700",
};

type Feature = { key: string; label: string; description?: string; enabled: boolean; custom?: boolean };
type Mod = { code: string; name: string; summary: string; status: string | null; origin: string | null; trialEndsAt: string | null; activatedAt: string | null; features: Feature[] };
type Action = "ACTIVATE" | "TRIAL" | "EXTEND_TRIAL" | "PAUSE" | "REMOVE";

const ACTION_COPY: Record<Action, { title: (m: string) => string; button: string; askDays?: boolean; message: boolean }> = {
  TRIAL: { title: (m) => `Ofrecer ${m} en prueba`, button: "Activar prueba", askDays: true, message: true },
  EXTEND_TRIAL: { title: (m) => `Extender la prueba de ${m}`, button: "Extender", askDays: true, message: true },
  ACTIVATE: { title: (m) => `Activar ${m}`, button: "Activar", message: true },
  PAUSE: { title: (m) => `Pausar ${m}`, button: "Pausar", message: true },
  REMOVE: { title: (m) => `Quitar ${m}`, button: "Quitar", message: false },
};

/** Packaged modules of one business: turn them on, offer a trial, pause, and switch features. */
export function ModulesSection({ businessId, businessName, onChanged }: { businessId: string; businessName: string; onChanged?: () => void }) {
  const [mods, setMods] = useState<Mod[] | null>(null);
  const [pending, setPending] = useState<{ mod: Mod; action: Action } | null>(null);
  const [busyFeature, setBusyFeature] = useState<string | null>(null);

  const load = useCallback(() => {
    adminApi<Mod[]>(`/business/${businessId}/modules`).then(setMods).catch((e) => toast.error(e.message));
  }, [businessId]);
  useEffect(() => { setMods(null); load(); }, [load]);

  const toggleFeature = async (mod: Mod, f: Feature, enabled: boolean) => {
    setBusyFeature(f.key);
    setMods((list) => list?.map((m) => (m.code === mod.code ? { ...m, features: m.features.map((x) => (x.key === f.key ? { ...x, enabled } : x)) } : m)) ?? list);
    try {
      await adminApi(`/business/${businessId}/modules/${mod.code}/features/${encodeURIComponent(f.key)}`, { method: "PUT", body: JSON.stringify({ enabled }) });
    } catch (e) {
      toast.error((e as Error).message);
      load();
    } finally {
      setBusyFeature(null);
    }
  };

  if (!mods) return <div className="flex justify-center py-6 text-muted-foreground"><IconLoader2 className="animate-spin" /></div>;

  return (
    <div className="space-y-3">
      {mods.map((m) => {
        const usable = m.status === "TRIAL" || m.status === "ACTIVE";
        const left = m.trialEndsAt ? Math.ceil((new Date(m.trialEndsAt).getTime() - Date.now()) / 86_400_000) : null;
        return (
          <div key={m.code} className="rounded-xl border">
            <div className="flex flex-wrap items-start gap-3 p-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{m.name}</p>
                  {m.status ? (
                    <Badge variant="outline" className={MODULE_STATUS_CLASS[m.status]}>{MODULE_STATUS_LABEL[m.status] ?? m.status}</Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">No lo tiene</Badge>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {m.status === "TRIAL" && m.trialEndsAt
                    ? left !== null && left < 0
                      ? <span className="font-medium text-rose-700">La prueba terminó el {shortDate(m.trialEndsAt)}. Decide si lo activas o lo pausas.</span>
                      : `Prueba hasta el ${shortDate(m.trialEndsAt)} (${left} ${left === 1 ? "día" : "días"})`
                    : m.activatedAt
                      ? `Activo desde el ${shortDate(m.activatedAt)}`
                      : m.summary}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {!m.status || m.status === "PAUSED" || m.status === "REJECTED" ? (
                  <>
                    <Button size="sm" onClick={() => setPending({ mod: m, action: "TRIAL" })}><IconClockPlay size={16} /> Ofrecer prueba</Button>
                    <Button size="sm" variant="outline" onClick={() => setPending({ mod: m, action: "ACTIVATE" })}><IconCheck size={16} /> Activar</Button>
                  </>
                ) : m.status === "TRIAL" ? (
                  <>
                    <Button size="sm" onClick={() => setPending({ mod: m, action: "ACTIVATE" })}><IconCheck size={16} /> Dejar activo</Button>
                    <Button size="sm" variant="outline" onClick={() => setPending({ mod: m, action: "EXTEND_TRIAL" })}><IconPlus size={16} /> Extender</Button>
                    <Button size="sm" variant="outline" onClick={() => setPending({ mod: m, action: "PAUSE" })}><IconPlayerPause size={16} /> Pausar</Button>
                  </>
                ) : m.status === "ACTIVE" ? (
                  <Button size="sm" variant="outline" onClick={() => setPending({ mod: m, action: "PAUSE" })}><IconPlayerPause size={16} /> Pausar</Button>
                ) : (
                  <Button size="sm" onClick={() => setPending({ mod: m, action: "TRIAL" })}><IconClockPlay size={16} /> Ofrecer prueba</Button>
                )}
                {m.status && (
                  <Button size="icon" variant="ghost" className="size-8" aria-label={`Quitar ${m.name}`} onClick={() => setPending({ mod: m, action: "REMOVE" })}><IconTrash size={16} /></Button>
                )}
              </div>
            </div>

            {usable && (
              <div className="border-t px-3 py-2.5">
                <p className="mb-2 text-xs font-medium text-muted-foreground">Funciones de {businessName}</p>
                <div className="grid gap-1 sm:grid-cols-2">
                  {m.features.map((f) => (
                    <label key={f.key} className={cn("flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted/50", !f.enabled && "text-muted-foreground")}>
                      <span className="min-w-0 truncate">
                        {f.label}
                        {f.custom && <Badge variant="secondary" className="ml-1.5 text-[10px]">A la medida</Badge>}
                      </span>
                      <Switch checked={f.enabled} disabled={busyFeature === f.key} onCheckedChange={(v) => toggleFeature(m, f, v)} aria-label={f.label} />
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {pending && (
        <ModuleActionDialog
          businessId={businessId}
          businessName={businessName}
          mod={pending.mod}
          action={pending.action}
          onClose={() => setPending(null)}
          onDone={() => { load(); onChanged?.(); }}
        />
      )}
    </div>
  );
}

function defaultMessage(action: Action, mod: Mod, days: number) {
  const until = new Date(Date.now() + days * 86_400_000).toLocaleDateString("es-VE", { day: "numeric", month: "long" });
  switch (action) {
    case "TRIAL":
      return `Te activamos el módulo ${mod.name} para que lo pruebes sin costo durante ${days} días (hasta el ${until}). Lo encuentras en el menú lateral. ${mod.summary} Cuéntanos qué te parece o qué te gustaría adaptar a tu forma de trabajar.`;
    case "EXTEND_TRIAL":
      return `Extendimos tu prueba del módulo ${mod.name} ${days} días más.`;
    case "ACTIVATE":
      return `¡Listo! Activamos el módulo ${mod.name} en tu cuenta. Lo encuentras en el menú lateral. Cualquier duda, escríbenos por aquí.`;
    case "PAUSE":
      return `Pausamos el módulo ${mod.name} en tu cuenta. Tus datos se conservan y lo podemos reactivar cuando quieras.`;
    default:
      return "";
  }
}

function ModuleActionDialog({ businessId, businessName, mod, action, onClose, onDone }: { businessId: string; businessName: string; mod: Mod; action: Action; onClose: () => void; onDone: () => void }) {
  const copy = ACTION_COPY[action];
  const [days, setDays] = useState("15");
  const [notify, setNotify] = useState(true);
  const [message, setMessage] = useState(() => defaultMessage(action, mod, 15));
  const [edited, setEdited] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!edited) setMessage(defaultMessage(action, mod, Number(days) || 15)); }, [days, action, mod, edited]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await adminApi(`/business/${businessId}/modules/${mod.code}`, { method: "PUT", body: JSON.stringify({ action, days: Number(days) || 15, notify, message }) });
      toast.success(action === "REMOVE" ? `${mod.name} quitado` : `${mod.name}: listo${notify && copy.message ? ". Le avisamos por el chat de soporte" : ""}`);
      onDone();
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{copy.title(mod.name)}</DialogTitle>
            <DialogDescription>
              {action === "REMOVE"
                ? `${businessName} deja de ver el módulo. Sus datos no se borran, pero se pierde el historial de este módulo en su ficha.`
                : action === "PAUSE"
                  ? `${businessName} deja de ver el módulo hasta que lo reactives. Sus datos se conservan.`
                  : action === "ACTIVATE"
                    ? `${businessName} lo tendrá sin fecha de vencimiento.`
                    : `${businessName} lo verá en su menú de inmediato. Al terminar la prueba te avisamos aquí; no se apaga solo.`}
            </DialogDescription>
          </DialogHeader>

          {copy.askDays && (
            <div className="flex items-center gap-2">
              <Label htmlFor="mod-days" className="shrink-0">Días de prueba</Label>
              <Input id="mod-days" type="number" min={1} max={90} value={days} onChange={(e) => setDays(e.target.value)} className="w-24" autoFocus />
            </div>
          )}

          {copy.message && (
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={notify} onCheckedChange={(v) => setNotify(v === true)} />
                Avisarle por el chat de soporte
              </label>
              {notify && (
                <textarea
                  rows={5}
                  value={message}
                  onChange={(e) => { setMessage(e.target.value); setEdited(true); }}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                  aria-label="Mensaje para el negocio"
                />
              )}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancelar</Button>
            <Button type="submit" variant={action === "REMOVE" ? "destructive" : "default"} disabled={busy}>{busy && <IconLoader2 size={16} className="animate-spin" />} {copy.button}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
