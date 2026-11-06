"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { IconBuildingStore, IconLoader2 } from "@tabler/icons-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PosTable } from "@/components/pos-table";
import { BusinessSheet } from "@/components/syncro-admin/business-sheet";
import { useRequireSyncroAdmin } from "@/hooks/use-require-syncro-admin";
import { adminApi, dateTime, shortDate } from "@/lib/syncro-admin";

type Event = { id: string; status: string; note: string | null; byRole: string | null; createdAt: string };
type Request = {
  id: string;
  kind: "CATALOG" | "CUSTOM_MODULE" | "CUSTOM_FEATURE";
  moduleCode: string | null;
  title: string;
  trade: string | null;
  problem: string;
  currentProcess: string | null;
  extra: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  business: { id: string; name: string; email: string | null; phone: string | null };
  events: Event[];
};
type Data = { counts: Record<string, number>; items: Request[] };

const REQUEST_STATUS: { key: string; label: string; cls: string }[] = [
  { key: "REQUESTED", label: "Nueva", cls: "border-primary/30 bg-primary/10 text-primary" },
  { key: "IN_REVIEW", label: "En revisión", cls: "border-blue-600/30 bg-blue-600/10 text-blue-700" },
  { key: "BUILDING", label: "En construcción", cls: "border-violet-600/30 bg-violet-600/10 text-violet-700" },
  { key: "READY", label: "Lista para probar", cls: "border-amber-600/30 bg-amber-600/10 text-amber-800" },
  { key: "DONE", label: "Entregada", cls: "border-emerald-600/30 bg-emerald-600/10 text-emerald-700" },
  { key: "REJECTED", label: "No procede", cls: "border-rose-600/30 bg-rose-600/10 text-rose-700" },
];
const STATUS = Object.fromEntries(REQUEST_STATUS.map((s) => [s.key, s]));
const KIND_LABEL: Record<string, string> = { CATALOG: "Módulo del catálogo", CUSTOM_MODULE: "Módulo a la medida", CUSTOM_FEATURE: "Función nueva" };
const OPEN = ["REQUESTED", "IN_REVIEW", "BUILDING", "READY"];

export default function ModuleRequestsPage() {
  useRequireSyncroAdmin();
  const [data, setData] = useState<Data | null>(null);
  const [filter, setFilter] = useState<string>("OPEN");
  const [open, setOpen] = useState<Request | null>(null);
  const [business, setBusiness] = useState<string | null>(null);

  const load = useCallback(() => {
    adminApi<Data>("/requests").then((d) => {
      setData(d);
      setOpen((cur) => (cur ? d.items.find((i) => i.id === cur.id) ?? null : cur));
    }).catch((e) => toast.error(e.message));
  }, []);
  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => (data?.items ?? []).filter((r) => (filter === "OPEN" ? OPEN.includes(r.status) : filter === "ALL" ? true : r.status === filter)), [data, filter]);
  const openCount = OPEN.reduce((s, k) => s + (data?.counts[k] ?? 0), 0);

  const columns: ColumnDef<Request>[] = [
    {
      id: "title",
      header: "Solicitud",
      accessorFn: (r) => `${r.title} ${r.business.name} ${r.trade ?? ""}`,
      cell: ({ row: { original: r } }) => (
        <div className="min-w-0">
          <p className="truncate font-semibold">{r.title}</p>
          <p className="truncate text-xs text-muted-foreground">{KIND_LABEL[r.kind]}{r.trade ? ` · ${r.trade}` : ""}</p>
        </div>
      ),
    },
    { id: "business", header: "Negocio", accessorFn: (r) => r.business.name },
    { id: "status", header: "Estado", accessorFn: (r) => STATUS[r.status]?.label ?? r.status, cell: ({ row: { original: r } }) => <Badge variant="outline" className={STATUS[r.status]?.cls}>{STATUS[r.status]?.label ?? r.status}</Badge> },
    { id: "created", header: "Recibida", accessorFn: (r) => r.createdAt, cell: ({ row: { original: r } }) => shortDate(r.createdAt) },
    { id: "updated", header: "Último cambio", accessorFn: (r) => r.updatedAt, cell: ({ row: { original: r } }) => shortDate(r.updatedAt) },
  ];

  const tabs = [
    { key: "OPEN", label: "Abiertas", n: openCount },
    ...REQUEST_STATUS.map((s) => ({ key: s.key, label: s.label, n: data?.counts[s.key] ?? 0 })),
    { key: "ALL", label: "Todas", n: data?.items.length ?? 0 },
  ];

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Solicitudes de módulos</h1>
        <p className="text-sm text-muted-foreground">Lo que los negocios piden desde su Tienda de módulos. Cada cambio de estado le llega al negocio por el chat de soporte.</p>
      </div>

      <PosTable
        columns={columns}
        data={rows}
        loading={!data}
        searchPlaceholder="Buscar solicitud, negocio o rubro…"
        getRowId={(r) => r.id}
        onRowClick={setOpen}
        emptyMessage={filter === "OPEN" ? "No hay solicitudes abiertas." : "No hay solicitudes en esta lista."}
        actions={
          <div className="flex flex-wrap rounded-lg border bg-muted/40 p-0.5">
            {tabs.map((t) => (
              <button key={t.key} type="button" onClick={() => setFilter(t.key)} className={cn("rounded-md px-3 py-1.5 text-sm transition", filter === t.key ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                {t.label} <span className="tabular-nums text-muted-foreground">{t.n}</span>
              </button>
            ))}
          </div>
        }
      />

      <RequestSheet request={open} onClose={() => setOpen(null)} onChanged={load} onOpenBusiness={setBusiness} />
      <BusinessSheet businessId={business} onClose={() => setBusiness(null)} onChanged={load} />
    </div>
  );
}

function RequestSheet({ request: r, onClose, onChanged, onOpenBusiness }: { request: Request | null; onClose: () => void; onChanged: () => void; onOpenBusiness: (id: string) => void }) {
  const [status, setStatus] = useState("");
  const [note, setNote] = useState("");
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (r) { setStatus(r.status); setNote(""); setNotify(true); } }, [r?.id, r?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    if (!r) return;
    setBusy(true);
    try {
      await adminApi(`/requests/${r.id}`, { method: "PUT", body: JSON.stringify({ status, note, notify }) });
      toast.success(notify ? "Estado guardado y avisado al negocio" : "Estado guardado");
      setNote("");
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={!!r} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-xl">
        {r && (
          <>
            <SheetHeader className="border-b px-6 py-5">
              <div className="flex flex-wrap items-center gap-2">
                <SheetTitle className="text-xl">{r.title}</SheetTitle>
                <Badge variant="outline" className={STATUS[r.status]?.cls}>{STATUS[r.status]?.label}</Badge>
              </div>
              <SheetDescription>{KIND_LABEL[r.kind]} · {r.business.name} · recibida el {shortDate(r.createdAt)}</SheetDescription>
              <div className="mt-2">
                <Button size="sm" variant="outline" onClick={() => onOpenBusiness(r.business.id)}><IconBuildingStore size={16} /> Ver negocio y sus módulos</Button>
              </div>
            </SheetHeader>

            <div className="space-y-6 px-6 py-5 text-sm">
              {r.kind === "CATALOG" && OPEN.includes(r.status) && (
                <p className="rounded-xl bg-primary/10 px-4 py-3">Para entregarlo, abre <strong>Ver negocio</strong> → Módulos y pulsa <strong>Ofrecer prueba</strong> o <strong>Activar</strong>. La solicitud se marca como entregada sola.</p>
              )}
              <div className="space-y-3">
                {r.trade && <div><p className="text-xs text-muted-foreground">Rubro</p><p>{r.trade}</p></div>}
                <div><p className="text-xs text-muted-foreground">Qué quiere resolver</p><p className="whitespace-pre-wrap">{r.problem}</p></div>
                {r.currentProcess && <div><p className="text-xs text-muted-foreground">Cómo lo hace hoy</p><p className="whitespace-pre-wrap">{r.currentProcess}</p></div>}
                {r.extra && <div><p className="text-xs text-muted-foreground">Más detalles</p><p className="whitespace-pre-wrap">{r.extra}</p></div>}
                <div><p className="text-xs text-muted-foreground">Contacto</p><p>{[r.business.email, r.business.phone].filter(Boolean).join(" · ") || "—"}</p></div>
              </div>

              <div className="space-y-3 rounded-xl border p-4">
                <p className="font-semibold">Cambiar estado</p>
                <div className="flex flex-wrap gap-1.5">
                  {REQUEST_STATUS.map((s) => (
                    <button key={s.key} type="button" onClick={() => setStatus(s.key)} className={cn("rounded-full border px-3 py-1 text-sm transition", status === s.key ? s.cls + " font-medium" : "hover:bg-muted")}>{s.label}</button>
                  ))}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rq-note">Mensaje para el negocio (opcional)</Label>
                  <textarea id="rq-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej.: ya empezamos; ¿nos mandas una foto de cómo llevas el control hoy?" className="w-full rounded-md border bg-background px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-ring/40" />
                </div>
                <label className="flex items-center gap-2"><Checkbox checked={notify} onCheckedChange={(v) => setNotify(v === true)} /> Avisarle por el chat de soporte</label>
                <Button onClick={save} disabled={busy || (status === r.status && !note.trim())}>{busy && <IconLoader2 size={16} className="animate-spin" />} Guardar</Button>
              </div>

              <div className="space-y-2">
                <p className="font-semibold">Historial</p>
                <ol className="space-y-2 border-l pl-4">
                  {r.events.map((e) => (
                    <li key={e.id} className="relative">
                      <span className="absolute -left-[21px] top-1.5 size-2.5 rounded-full bg-primary" />
                      <p><span className="font-medium">{STATUS[e.status]?.label ?? e.status}</span> <span className="text-xs text-muted-foreground">· {dateTime(e.createdAt)} · {e.byRole === "business" ? "el negocio" : "Syncro"}</span></p>
                      {e.note && <p className="text-muted-foreground">{e.note}</p>}
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
