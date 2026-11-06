"use client";

import { useEffect, useState } from "react";
import { IconLoader2 } from "@tabler/icons-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const GYM_EXAMPLES = {
  title: "Ej.: Alquiler de casilleros, Pago por semana, Nutricionista",
  problem: "Ej.: alquilamos casilleros por mes y queremos saber cuáles están libres y cuándo vence cada uno…",
  process: "Ej.: en una libreta en recepción",
};

/**
 * Asks Syncro for a new function inside a module the business already has
 * ("que el gimnasio maneje casilleros"). Only the owner sees the button that opens it.
 */
export function FeatureRequestDialog({
  open,
  onClose,
  moduleCode,
  moduleName,
  sections,
  examples = GYM_EXAMPLES,
}: {
  open: boolean;
  onClose: () => void;
  moduleCode: string;
  moduleName: string;
  /** Parts of the module, so the owner can say where the new function goes */
  sections: string[];
  /** Examples shown in the empty fields */
  examples?: { title: string; problem: string; process: string };
}) {
  const [form, setForm] = useState({ section: "", title: "", problem: "", currentProcess: "" });
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setForm({ section: "", title: "", problem: "", currentProcess: "" }); }, [open]);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const ready = form.title.trim().length > 2 && form.problem.trim().length > 9;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    try {
      const res = await apiFetch("/modules/requests", {
        method: "POST",
        body: JSON.stringify({
          kind: "CUSTOM_FEATURE",
          moduleCode,
          title: form.title,
          problem: form.problem,
          currentProcess: form.currentProcess,
          extra: form.section ? `Dónde: ${form.section}` : undefined,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.message || "No se pudo enviar");
      toast.success("Recibimos tu idea. Te escribiremos por el chat de soporte y la sigues en la Tienda de módulos.");
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Pedir una función para {moduleName}</DialogTitle>
            <DialogDescription>Cuéntanos qué le falta a {moduleName} para tu forma de trabajar. La construimos solo para tu negocio.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="fr-section">¿En qué parte?</Label>
            <select id="fr-section" value={form.section} onChange={(e) => set("section", e.target.value)} className="h-9 w-full rounded-md border bg-background px-2 text-sm">
              <option value="">Algo nuevo / no estoy seguro</option>
              {sections.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fr-title">Ponle un nombre corto</Label>
            <Input id="fr-title" value={form.title} onChange={(e) => set("title", e.target.value)} placeholder={examples.title} maxLength={120} autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fr-problem">¿Qué necesitas que haga?</Label>
            <textarea id="fr-problem" rows={4} value={form.problem} onChange={(e) => set("problem", e.target.value)} placeholder={examples.problem} className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fr-process">¿Cómo lo haces hoy? (opcional)</Label>
            <Input id="fr-process" value={form.currentProcess} onChange={(e) => set("currentProcess", e.target.value)} placeholder={examples.process} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancelar</Button>
            <Button type="submit" disabled={busy || !ready}>{busy && <IconLoader2 size={16} className="animate-spin" />} Enviar idea</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
