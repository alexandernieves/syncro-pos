"use client";

import { useEffect, useState } from "react";
import { IconDeviceFloppy, IconShieldCheck } from "@tabler/icons-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { useRequireSyncroAdmin } from "@/hooks/use-require-syncro-admin";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { GymPage as Page, GymPageHeader as PageHeader } from "@/components/gym/gym-ui";

/**
 * Syncro Central → Préstamos P2P: the caps of the whole platform, by level. Whatever each lender
 * offers, nobody can owe more than this adding every business up, nor have more loans at once;
 * and someone late with any business can't borrow anywhere.
 */
const LEVELS: { l: number; name: string; at: string }[] = [
  { l: 4, name: "Chispa", at: "Clientes nuevos" },
  { l: 3, name: "Cometa", at: "Pagó a tiempo $200" },
  { l: 2, name: "Órbita", at: "Pagó a tiempo $500" },
  { l: 1, name: "Galaxia", at: "Pagó a tiempo $1500" },
];
type Caps = { blockIfLate: boolean; levels: Record<number, { maxDebt: number; maxActive: number }> };

export default function SyncroLendingCaps() {
  useRequireSyncroAdmin();
  const [caps, setCaps] = useState<Caps | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch("/syncro-admin/lending/caps")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("No se pudieron cargar los topes"))))
      .then(setCaps)
      .catch((e) => toast.error(e.message));
  }, []);

  const setLevel = (l: number, k: "maxDebt" | "maxActive", v: string) =>
    setCaps((c) => (c ? { ...c, levels: { ...c.levels, [l]: { ...c.levels[l], [k]: Number(v) } } } : c));

  const save = async () => {
    if (!caps) return;
    setSaving(true);
    try {
      const r = await apiFetch("/syncro-admin/lending/caps", { method: "PUT", body: JSON.stringify(caps), headers: { "Content-Type": "application/json" } });
      const body = await r.json().catch(() => null);
      if (!r.ok) throw new Error(body?.message || "No se pudo guardar");
      setCaps(body);
      toast.success("Topes guardados: ya se aplican a todos los prestamistas");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Page>
      <PageHeader
        title="Préstamos P2P"
        description="Topes de toda la plataforma por nivel. Protegen a los prestamistas de quien pide en muchos comercios a la vez."
        actions={<Button className="gap-2" onClick={save} disabled={!caps || saving}><IconDeviceFloppy size={16} />{saving ? "Guardando…" : "Guardar"}</Button>}
      />
      {!caps ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : (
        <div className="grid max-w-4xl gap-4">
          <Card className="shadow-xs">
            <CardHeader>
              <CardTitle className="text-base">Topes por nivel</CardTitle>
              <CardDescription>
                Lo máximo que una persona puede deber sumando todos los comercios (capital más intereses de lo que tiene en curso, más lo que tiene pedido) y cuántos préstamos o solicitudes puede tener abiertos a la vez. Un nivel mejor nunca tiene un tope menor que el anterior.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="divide-y rounded-lg border">
                <div className="hidden grid-cols-[1fr_160px_160px] gap-3 bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground sm:grid">
                  <span>Nivel</span><span className="text-right">Deuda máxima</span><span className="text-right">Préstamos a la vez</span>
                </div>
                {LEVELS.map(({ l, name, at }) => (
                  <div key={l} className="grid grid-cols-1 items-center gap-2 px-3 py-3 sm:grid-cols-[1fr_160px_160px] sm:gap-3">
                    <div className="flex items-center gap-3">
                      <span className="grid size-8 place-items-center rounded-full bg-primary/10 text-sm font-bold text-primary">{l}</span>
                      <div><p className="text-sm font-semibold">{name}</p><p className="text-xs text-muted-foreground">{at}</p></div>
                    </div>
                    <div className="flex items-center justify-end gap-1.5">
                      <span className="text-sm text-muted-foreground">$</span>
                      <Input type="number" min={0} value={caps.levels[l].maxDebt} onChange={(e) => setLevel(l, "maxDebt", e.target.value)} className="w-28 text-right font-mono font-bold" aria-label={`Deuda máxima ${name}`} />
                    </div>
                    <div className="flex justify-end">
                      <Input type="number" min={1} max={50} value={caps.levels[l].maxActive} onChange={(e) => setLevel(l, "maxActive", e.target.value)} className="w-20 text-right font-mono font-bold" aria-label={`Préstamos a la vez ${name}`} />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-xs">
            <CardContent className="flex items-start justify-between gap-4 p-6">
              <div className="flex gap-3">
                <IconShieldCheck size={22} className="mt-0.5 shrink-0 text-primary" />
                <div>
                  <p className="font-semibold">Bloquear a quien esté atrasado</p>
                  <p className="mt-1 max-w-xl text-sm text-muted-foreground">Si una persona tiene una cuota vencida con cualquier comercio, no puede pedir préstamos en ninguno hasta ponerse al día. Los prestamistas tampoco pueden aprobarle.</p>
                </div>
              </div>
              <Switch checked={caps.blockIfLate} onCheckedChange={(v) => setCaps({ ...caps, blockIfLate: v })} aria-label="Bloquear a quien esté atrasado" />
            </CardContent>
          </Card>
        </div>
      )}
    </Page>
  );
}
