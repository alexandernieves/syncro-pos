"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { IconAlertTriangle, IconBarbell, IconCash, IconCheck, IconLoader2, IconPlus, IconTool, IconTools } from "@tabler/icons-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { gymApi, money, shortDate } from "@/lib/gym";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PosTable } from "@/components/pos-table";
import { StatCard, StatGrid } from "@/components/stat-card";
import { FilterChips, GymPage, GymPageHeader } from "@/components/gym/gym-ui";

type Status = "OK" | "NEEDS_SERVICE" | "OUT_OF_ORDER" | "RETIRED";
type Ticket = { id: string; kind: "REPAIR" | "PREVENTIVE" | "INSPECTION"; status: "OPEN" | "IN_PROGRESS" | "DONE"; title: string; description?: string | null; reportedBy?: string | null; scheduledFor?: string | null; doneAt?: string | null; cost?: number | null; vendor?: string | null; resolution?: string | null; createdAt: string };
type Equipment = {
  id: string;
  name: string;
  category: string;
  brand: string | null;
  model: string | null;
  serial: string | null;
  area: string | null;
  purchaseDate: string | null;
  purchasePrice: number | null;
  warrantyUntil: string | null;
  status: Status;
  serviceEveryDays: number;
  lastServiceAt: string | null;
  nextServiceAt: string | null;
  notes: string | null;
  open: Ticket[];
  serviceDue: boolean;
  maintenance?: Ticket[];
};
type Stats = { total: number; ok: number; needsService: number; outOfOrder: number; serviceDue: number; openTickets: number; costThisMonth: number };

const CATEGORIES: [string, string][] = [["CARDIO", "Cardio"], ["STRENGTH", "Máquinas de fuerza"], ["FREE_WEIGHTS", "Peso libre"], ["FUNCTIONAL", "Funcional"], ["OTHER", "Otro"]];
const STATUS: Record<Status, { label: string; cls: string }> = {
  OK: { label: "Funcionando", cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700" },
  NEEDS_SERVICE: { label: "Necesita revisión", cls: "border-amber-500/30 bg-amber-500/10 text-amber-700" },
  OUT_OF_ORDER: { label: "Fuera de servicio", cls: "border-rose-500/30 bg-rose-500/10 text-rose-700" },
  RETIRED: { label: "Dado de baja", cls: "text-muted-foreground" },
};
const KIND: Record<Ticket["kind"], string> = { REPAIR: "Reparación", PREVENTIVE: "Servicio preventivo", INSPECTION: "Revisión" };
const catLabel = (c: string) => CATEGORIES.find(([k]) => k === c)?.[1] ?? c;
const dateInput = (d?: string | null) => (d ? new Date(d).toLocaleDateString("en-CA") : "");

function StatusBadge({ status }: { status: Status }) {
  return <Badge variant="outline" className={cn("gap-1.5 whitespace-nowrap", STATUS[status].cls)}><span className="size-1.5 rounded-full bg-current" />{STATUS[status].label}</Badge>;
}

function EquipmentDialog({ item, open, onClose, onSaved }: { item: Equipment | null; open: boolean; onClose: () => void; onSaved: () => void }) {
  const empty = { name: "", category: "STRENGTH", brand: "", model: "", serial: "", area: "", purchaseDate: "", purchasePrice: "", warrantyUntil: "", serviceEveryDays: "0", lastServiceAt: "", notes: "", retired: false };
  const [f, setF] = useState(empty);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!open) return;
    setF(item ? { name: item.name, category: item.category, brand: item.brand ?? "", model: item.model ?? "", serial: item.serial ?? "", area: item.area ?? "", purchaseDate: dateInput(item.purchaseDate), purchasePrice: item.purchasePrice ? String(item.purchasePrice) : "", warrantyUntil: dateInput(item.warrantyUntil), serviceEveryDays: String(item.serviceEveryDays), lastServiceAt: dateInput(item.lastServiceAt), notes: item.notes ?? "", retired: item.status === "RETIRED" } : empty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item]);
  const set = (k: keyof typeof f, v: string | boolean) => setF((x) => ({ ...x, [k]: v }));
  const save = async () => {
    setSaving(true);
    try {
      const { retired, ...rest } = f;
      const body = { ...rest, purchasePrice: f.purchasePrice ? Number(f.purchasePrice) : null, serviceEveryDays: Number(f.serviceEveryDays) || 0, purchaseDate: f.purchaseDate || null, warrantyUntil: f.warrantyUntil || null, lastServiceAt: f.lastServiceAt || null, ...(item && { status: retired ? "RETIRED" : item.status === "RETIRED" ? "OK" : item.status }) };
      await gymApi(item ? `/equipment/${item.id}` : "/equipment", { method: item ? "PUT" : "POST", json: body });
      toast.success(item ? "Equipo actualizado" : `${f.name} quedó en el inventario`);
      onSaved();
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{item ? "Editar equipo" : "Nuevo equipo"}</DialogTitle>
          <DialogDescription>Máquinas y equipos del gimnasio, con su servicio preventivo.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2"><Label>Nombre</Label><Input autoFocus value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Ej.: caminadora #2" /></div>
          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <select value={f.category} onChange={(e) => set("category", e.target.value)} className="h-9 w-full rounded-md border bg-background px-2 text-sm">{CATEGORIES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          </div>
          <div className="space-y-1.5"><Label>Área</Label><Input value={f.area} onChange={(e) => set("area", e.target.value)} placeholder="Cardio, pesas, salón…" /></div>
          <div className="space-y-1.5"><Label>Marca</Label><Input value={f.brand} onChange={(e) => set("brand", e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Modelo</Label><Input value={f.model} onChange={(e) => set("model", e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Serial</Label><Input value={f.serial} onChange={(e) => set("serial", e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Costo ($)</Label><Input value={f.purchasePrice} onChange={(e) => set("purchasePrice", e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" /></div>
          <div className="space-y-1.5"><Label>Fecha de compra</Label><Input type="date" value={f.purchaseDate} onChange={(e) => set("purchaseDate", e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Garantía hasta</Label><Input type="date" value={f.warrantyUntil} onChange={(e) => set("warrantyUntil", e.target.value)} /></div>
        </div>
        <div className="grid gap-3 rounded-xl bg-muted/40 p-3 sm:grid-cols-2">
          <div className="space-y-1.5"><Label>Servicio preventivo cada (días)</Label><Input type="number" min={0} value={f.serviceEveryDays} onChange={(e) => set("serviceEveryDays", e.target.value)} className="w-24" /></div>
          <div className="space-y-1.5"><Label>Último servicio</Label><Input type="date" value={f.lastServiceAt} onChange={(e) => set("lastServiceAt", e.target.value)} /></div>
          <p className="text-xs text-muted-foreground sm:col-span-2">Con 0 no se programa. Tres días antes se abre solo un servicio preventivo.</p>
        </div>
        <div className="space-y-1.5"><Label>Notas</Label><Input value={f.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Proveedor de servicio, repuestos…" /></div>
        {item && (
          <label className="flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2 text-sm">
            Dado de baja (ya no se usa)
            <Switch checked={f.retired} onCheckedChange={(v) => set("retired", v)} />
          </label>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving || !f.name.trim()} className="gap-2">{saving && <IconLoader2 size={16} className="animate-spin" />} Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EquipmentSheet({ id, onClose, onChanged, onEdit }: { id: string | null; onClose: () => void; onChanged: () => void; onEdit: (e: Equipment) => void }) {
  const [item, setItem] = useState<Equipment | null>(null);
  const [report, setReport] = useState<{ kind: Ticket["kind"]; title: string; outOfOrder: boolean; scheduledFor: string } | null>(null);
  const [closing, setClosing] = useState<{ ticket: Ticket; cost: string; vendor: string; resolution: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => { if (id) gymApi<Equipment>(`/equipment/${id}`).then(setItem).catch((e) => toast.error(e.message)); }, [id]);
  useEffect(() => { setItem(null); setReport(null); setClosing(null); load(); }, [load]);
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try { await fn(); toast.success(ok); load(); onChanged(); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };
  const open = item?.maintenance?.filter((t) => t.status !== "DONE") ?? [];
  const done = item?.maintenance?.filter((t) => t.status === "DONE") ?? [];
  return (
    <Sheet open={!!id} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-md">
        <SheetHeader className="border-b p-5">
          <SheetTitle className="sr-only">Equipo</SheetTitle>
          {item ? (
            <div className="flex items-start gap-3">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground"><IconBarbell size={24} /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-bold">{item.name}</p>
                <p className="text-sm text-muted-foreground">{catLabel(item.category)}{item.area ? ` · ${item.area}` : ""}</p>
                <div className="mt-1.5"><StatusBadge status={item.status} /></div>
              </div>
              <Button size="sm" variant="ghost" className="mr-6" onClick={() => onEdit(item)}>Editar</Button>
            </div>
          ) : <div className="h-14 animate-pulse rounded-lg bg-muted" />}
        </SheetHeader>
        {item && (
          <div className="space-y-5 p-5">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-xs text-muted-foreground">Marca y modelo</p><p>{[item.brand, item.model].filter(Boolean).join(" ") || "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">Serial</p><p>{item.serial || "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">Último servicio</p><p>{item.lastServiceAt ? shortDate(item.lastServiceAt) : "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">Próximo servicio</p><p className={cn(item.nextServiceAt && new Date(item.nextServiceAt) < new Date() && "font-medium text-rose-600")}>{item.nextServiceAt ? shortDate(item.nextServiceAt) : item.serviceEveryDays ? "Al registrar el primero" : "No programado"}</p></div>
              {item.warrantyUntil && <div><p className="text-xs text-muted-foreground">Garantía</p><p>{new Date(item.warrantyUntil) > new Date() ? `Hasta el ${shortDate(item.warrantyUntil)}` : "Vencida"}</p></div>}
              {item.purchasePrice && <div><p className="text-xs text-muted-foreground">Costo</p><p>{money(item.purchasePrice)}</p></div>}
            </div>

            {item.status !== "RETIRED" && !report && (
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" className="gap-2 text-rose-600" onClick={() => setReport({ kind: "REPAIR", title: "", outOfOrder: false, scheduledFor: "" })}><IconAlertTriangle size={16} /> Reportar falla</Button>
                <Button variant="outline" className="gap-2" onClick={() => setReport({ kind: "PREVENTIVE", title: "Servicio preventivo", outOfOrder: false, scheduledFor: new Date().toLocaleDateString("en-CA") })}><IconTools size={16} /> Programar servicio</Button>
              </div>
            )}
            {report && (
              <div className="space-y-2 rounded-xl bg-muted/40 p-3">
                <p className="text-sm font-semibold">{report.kind === "REPAIR" ? "¿Qué le pasa?" : "Servicio"}</p>
                <Input autoFocus value={report.title} onChange={(e) => setReport({ ...report, title: e.target.value })} placeholder={report.kind === "REPAIR" ? "Ej.: la banda se patina" : "Qué se va a hacer"} />
                {report.kind === "REPAIR" ? (
                  <label className="flex items-center justify-between text-sm">Sacarla de servicio mientras tanto<Switch checked={report.outOfOrder} onCheckedChange={(v) => setReport({ ...report, outOfOrder: v })} /></label>
                ) : (
                  <Input type="date" value={report.scheduledFor} onChange={(e) => setReport({ ...report, scheduledFor: e.target.value })} />
                )}
                <div className="flex gap-2">
                  <Button size="sm" disabled={busy || !report.title.trim()} onClick={() => run(async () => { await gymApi("/maintenance", { method: "POST", json: { equipmentId: item.id, ...report } }); setReport(null); }, report.kind === "REPAIR" ? "Falla reportada" : "Servicio programado")}>Guardar</Button>
                  <Button size="sm" variant="ghost" onClick={() => setReport(null)}>Cancelar</Button>
                </div>
              </div>
            )}

            {open.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-semibold">Pendientes</p>
                {open.map((t) => (
                  <div key={t.id} className="space-y-2 rounded-xl border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{t.title}</p>
                        <p className="text-xs text-muted-foreground">{KIND[t.kind]} · {t.reportedBy ? `${t.reportedBy} · ` : ""}{shortDate(t.scheduledFor ?? t.createdAt)}</p>
                      </div>
                      <Badge variant="outline" className={t.status === "IN_PROGRESS" ? "border-sky-500/30 bg-sky-500/10 text-sky-700" : ""}>{t.status === "IN_PROGRESS" ? "En proceso" : "Abierto"}</Badge>
                    </div>
                    {closing?.ticket.id === t.id ? (
                      <div className="space-y-2 border-t pt-2">
                        <Input value={closing.resolution} onChange={(e) => setClosing({ ...closing, resolution: e.target.value })} placeholder="Qué se hizo" />
                        <div className="grid grid-cols-2 gap-2">
                          <Input value={closing.cost} onChange={(e) => setClosing({ ...closing, cost: e.target.value.replace(/[^\d.]/g, "") })} placeholder="Costo $ (opcional)" inputMode="decimal" />
                          <Input value={closing.vendor} onChange={(e) => setClosing({ ...closing, vendor: e.target.value })} placeholder="Técnico o taller" />
                        </div>
                        <p className="text-xs text-muted-foreground">El costo se registra como gasto en contabilidad.</p>
                        <div className="flex gap-2">
                          <Button size="sm" className="gap-1.5" disabled={busy} onClick={() => run(async () => { await gymApi(`/maintenance/${t.id}/complete`, { method: "POST", json: { cost: closing.cost ? Number(closing.cost) : undefined, vendor: closing.vendor, resolution: closing.resolution, branchId: localStorage.getItem("currentBranchId") || undefined } }); setClosing(null); }, "Mantenimiento cerrado")}><IconCheck size={14} /> Cerrar</Button>
                          <Button size="sm" variant="ghost" onClick={() => setClosing(null)}>Cancelar</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => setClosing({ ticket: t, cost: "", vendor: "", resolution: "" })}>Marcar como resuelto</Button>
                        {t.status === "OPEN" && <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(() => gymApi(`/maintenance/${t.id}`, { method: "PATCH", json: { status: "IN_PROGRESS" } }), "Marcado en proceso")}>En proceso</Button>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2">
              <p className="text-sm font-semibold">Historial</p>
              {!done.length && <p className="text-sm text-muted-foreground">Sin mantenimientos registrados.</p>}
              {done.map((t) => (
                <div key={t.id} className="flex items-start gap-3 text-sm">
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-700"><IconCheck size={14} /></span>
                  <div className="min-w-0 flex-1">
                    <p>{t.title}{t.resolution ? `: ${t.resolution}` : ""}</p>
                    <p className="text-xs text-muted-foreground">{KIND[t.kind]} · {shortDate(t.doneAt!)}{t.vendor ? ` · ${t.vendor}` : ""}</p>
                  </div>
                  {t.cost ? <span className="tabular-nums text-muted-foreground">{money(t.cost)}</span> : null}
                </div>
              ))}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

export default function GymEquipmentPage() {
  const [items, setItems] = useState<Equipment[] | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [filter, setFilter] = useState<"all" | "attention" | Status>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ open: boolean; item: Equipment | null }>({ open: false, item: null });
  const load = useCallback(() => {
    gymApi<Equipment[]>("/equipment").then(setItems).catch((e) => toast.error(e.message));
    gymApi<Stats>("/equipment/stats").then(setStats).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => (items ?? []).filter((e) => (filter === "all" ? e.status !== "RETIRED" : filter === "attention" ? e.status === "NEEDS_SERVICE" || e.status === "OUT_OF_ORDER" || e.serviceDue || e.open.length > 0 : e.status === filter)), [items, filter]);
  const tickets = useMemo(() => (items ?? []).flatMap((e) => e.open.map((t) => ({ ...t, equipment: e }))).sort((a, b) => (a.kind === "REPAIR" ? -1 : 1) - (b.kind === "REPAIR" ? -1 : 1)), [items]);

  const columns = useMemo<ColumnDef<Equipment>[]>(
    () => [
      {
        id: "name",
        header: "Equipo",
        accessorFn: (e) => `${e.name} ${e.brand ?? ""} ${e.area ?? ""}`,
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground"><IconBarbell size={18} /></span>
            <div className="min-w-0">
              <p className="truncate font-medium">{row.original.name}</p>
              <p className="truncate text-xs text-muted-foreground">{catLabel(row.original.category)}{row.original.area ? ` · ${row.original.area}` : ""}</p>
            </div>
          </div>
        ),
      },
      { id: "status", header: "Estado", accessorFn: (e) => STATUS[e.status].label, cell: ({ row }) => <StatusBadge status={row.original.status} /> },
      {
        id: "next",
        header: "Próximo servicio",
        accessorFn: (e) => e.nextServiceAt ?? "",
        cell: ({ row }) => {
          const e = row.original;
          if (!e.nextServiceAt) return <span className="text-muted-foreground">{e.serviceEveryDays ? "Pendiente del primero" : "—"}</span>;
          const late = new Date(e.nextServiceAt) < new Date();
          return <span className={cn("tabular-nums", late ? "font-medium text-rose-600" : e.serviceDue ? "font-medium text-amber-700" : "")}>{late ? "Vencido · " : ""}{shortDate(e.nextServiceAt)}</span>;
        },
      },
      { id: "open", header: "Pendientes", accessorFn: (e) => e.open.length, cell: ({ row }) => (row.original.open.length ? <span className="font-medium">{row.original.open.length}</span> : <span className="text-muted-foreground">—</span>) },
      { id: "brand", header: "Marca", accessorFn: (e) => [e.brand, e.model].filter(Boolean).join(" "), cell: ({ getValue }) => <span className="text-muted-foreground">{getValue<string>() || "—"}</span> },
    ],
    [],
  );

  return (
    <GymPage>
      <GymPageHeader title="Equipos" description="Inventario de máquinas, fallas y mantenimiento preventivo." actions={<Button className="gap-2" onClick={() => setDialog({ open: true, item: null })}><IconPlus size={16} /> Nuevo equipo</Button>} />
      <StatGrid>
        <StatCard label="Equipos" value={stats?.total ?? "—"} icon={<IconBarbell size={20} />} title={`${stats?.ok ?? 0} funcionando`} hint="Sin contar los dados de baja" onClick={() => setFilter("all")} />
        <StatCard label="Fuera de servicio" value={stats ? stats.outOfOrder + stats.needsService : "—"} icon={<IconAlertTriangle size={20} />} tone={stats?.outOfOrder ? "bad" : stats?.needsService ? "warn" : "good"} title={stats?.outOfOrder ? `${stats.outOfOrder} sin poder usarse` : stats?.needsService ? (stats.needsService === 1 ? "1 necesita revisión" : `${stats.needsService} necesitan revisión`) : "Todo funciona"} hint="Reportados por el equipo o los socios" onClick={() => setFilter("attention")} />
        <StatCard label="Servicios por hacer" value={stats?.serviceDue ?? "—"} icon={<IconTools size={20} />} tone={stats?.serviceDue ? "warn" : "default"} title={stats?.openTickets === 1 ? "1 pendiente abierto" : `${stats?.openTickets ?? 0} pendientes abiertos`} hint="Vencidos o en los próximos 3 días" onClick={() => setFilter("attention")} />
        <StatCard label="Gasto del mes" value={stats ? money(stats.costThisMonth) : "—"} icon={<IconCash size={20} />} tone="primary" title="Reparaciones y servicios" hint="Registrado en contabilidad" />
      </StatGrid>

      {tickets.length > 0 && (
        <Card className="gap-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><IconTool size={18} className="text-muted-foreground" /> Pendientes</CardTitle>
            <CardDescription>Fallas reportadas (también por socios desde su app) y servicios programados.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {tickets.map((t) => (
              <button key={t.id} type="button" onClick={() => setOpenId(t.equipment.id)} className="flex items-start gap-3 rounded-xl bg-muted/40 p-3 text-left transition hover:bg-muted">
                <span className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg", t.kind === "REPAIR" ? "bg-rose-500/10 text-rose-700" : "bg-sky-500/10 text-sky-700")}>{t.kind === "REPAIR" ? <IconAlertTriangle size={16} /> : <IconTools size={16} />}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{t.equipment.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{t.title}{t.reportedBy ? ` · ${t.reportedBy}` : ""}</span>
                </span>
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      <FilterChips value={filter} onChange={setFilter} options={[["all", "En uso"], ["attention", "Requieren atención"], ["OK", "Funcionando"], ["OUT_OF_ORDER", "Fuera de servicio"], ["RETIRED", "Dados de baja"]]} />
      <PosTable columns={columns} data={rows} loading={!items} searchPlaceholder="Buscar equipo…" getRowId={(e) => e.id} onRowClick={(e) => setOpenId(e.id)} emptyMessage={filter === "all" ? "Agrega tus máquinas para llevar su mantenimiento." : "No hay equipos en este filtro."} />

      <EquipmentDialog item={dialog.item} open={dialog.open} onClose={() => setDialog({ open: false, item: null })} onSaved={load} />
      <EquipmentSheet id={openId} onClose={() => setOpenId(null)} onChanged={load} onEdit={(e) => setDialog({ open: true, item: e })} />
    </GymPage>
  );
}
