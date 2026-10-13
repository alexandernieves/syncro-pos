"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { IconArrowDownRight, IconArrowUpRight, IconArrowsExchange, IconChecks, IconClockHour4, IconLoader2, IconLock, IconPhoto } from "@tabler/icons-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { API_URL } from "@/lib/constants";
import { formatMoney } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PosTable } from "@/components/pos-table";
import { StatCard, StatGrid } from "@/components/stat-card";
import { FilterChips, GymPage, GymPageHeader } from "@/components/gym/gym-ui";
import { ConfirmDialog } from "@/components/gym/confirm-dialog";
import { DateField } from "@/components/forms/date-field";
import { MINUTES, OptionSelect } from "@/components/forms/option-select";
import { METHOD_LABELS, MOVEMENT_LABELS, type Movement } from "@/components/finance-widget";

type Meta = { outCategories: string[]; inCategories: string[]; rules: { staffLimitUsd: number; receiptOverUsd: number; undoMinutes: number; protectedCategories: string[] }; isManager: boolean; hasSupervisorPin: boolean };
type Filter = "pending" | "all" | "voided";

const api = async <T,>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> => {
  const { json, ...rest } = init;
  const res = await fetch(`${API_URL}${path}`, { ...rest, headers: { Authorization: `Bearer ${localStorage.getItem("token")}`, ...(json !== undefined && { "Content-Type": "application/json" }) }, ...(json !== undefined && { body: JSON.stringify(json) }) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(Array.isArray(data.message) ? data.message[0] : data.message || "No se pudo completar");
  return data as T;
};

/** The rules for the staff: limit per movement, receipt photo, undo time and PIN categories. */
function RulesCard({ meta, onSaved }: { meta: Meta; onSaved: () => void }) {
  const [rules, setRules] = useState(meta.rules);
  const [saving, setSaving] = useState(false);
  useEffect(() => setRules(meta.rules), [meta]);
  const dirty = JSON.stringify(rules) !== JSON.stringify(meta.rules);
  const toggle = (c: string) => setRules((r) => ({ ...r, protectedCategories: r.protectedCategories.includes(c) ? r.protectedCategories.filter((x) => x !== c) : [...r.protectedCategories, c] }));
  return (
    <Card>
      <CardHeader>
        <CardTitle>Reglas para el personal</CardTitle>
        <CardDescription>Los administradores registran sin límite. Cajeros y recepción siguen estas reglas en el botón de ingresos y egresos.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1.5">
            <p className="text-sm font-medium">Límite por movimiento</p>
            <OptionSelect value={rules.staffLimitUsd} onChange={(v) => setRules((r) => ({ ...r, staffLimitUsd: v }))} options={[0, 10, 20, 50, 100]} unit="money" min={0} max={5000} step={0.01} zeroLabel="Siempre con PIN" />
            <p className="text-xs text-muted-foreground">Por encima, pide el PIN de un supervisor.</p>
          </div>
          <div className="space-y-1.5">
            <p className="text-sm font-medium">Foto obligatoria desde</p>
            <OptionSelect value={rules.receiptOverUsd} onChange={(v) => setRules((r) => ({ ...r, receiptOverUsd: v }))} options={[0, 5, 10, 20, 50]} unit="money" min={0} max={5000} step={0.01} zeroLabel="Siempre" />
            <p className="text-xs text-muted-foreground">Egresos de más de este monto llevan factura o recibo.</p>
          </div>
          <div className="space-y-1.5">
            <p className="text-sm font-medium">Tiempo para deshacer</p>
            <OptionSelect value={rules.undoMinutes} onChange={(v) => setRules((r) => ({ ...r, undoMinutes: v }))} options={[0, 5, 10, 15, 30]} unit={MINUTES} min={0} max={120} zeroLabel="No se puede deshacer" />
            <p className="text-xs text-muted-foreground">Quien lo registró puede deshacerlo mientras nadie lo revise.</p>
          </div>
        </div>
        <div className="space-y-1.5">
          <p className="text-sm font-medium">Categorías que siempre piden PIN</p>
          <div className="flex flex-wrap gap-1.5">
            {[...meta.outCategories, ...meta.inCategories].map((c) => (
              <button key={c} type="button" onClick={() => toggle(c)} className={cn("flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs transition", rules.protectedCategories.includes(c) ? "border-primary bg-primary/10 font-semibold text-primary" : "text-muted-foreground hover:bg-muted")}>
                {rules.protectedCategories.includes(c) && <IconLock size={11} />}{MOVEMENT_LABELS[c] ?? c}
              </button>
            ))}
          </div>
        </div>
        {!meta.hasSupervisorPin && <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm">No hay PIN de supervisor configurado: el personal no podrá pasar del límite ni usar esas categorías. Créalo en la configuración del negocio, en el PIN de autorización.</p>}
        <div className="flex justify-end">
          <Button disabled={!dirty || saving} onClick={async () => { setSaving(true); try { await api("/movements/settings", { method: "PUT", json: rules }); toast.success("Reglas guardadas"); onSaved(); } catch (e) { toast.error((e as Error).message); } finally { setSaving(false); } }}>
            {saving && <IconLoader2 size={15} className="mr-1 animate-spin" />} Guardar reglas
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/** Income and expenses that aren't sales, of the branch picked: review, void and rules. */
export default function MovementsPage() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [rows, setRows] = useState<Movement[] | null>(null);
  const [filter, setFilter] = useState<Filter>("pending");
  const [day, setDay] = useState("");
  const [voiding, setVoiding] = useState<Movement | null>(null);
  const [busy, setBusy] = useState(false);

  const loadMeta = useCallback(() => api<Meta>("/movements/meta").then(setMeta).catch(() => {}), []);
  const load = useCallback(() => {
    const params = new URLSearchParams({ branchId: localStorage.getItem("currentBranchId") || "", ...(day && { day }), ...(filter === "pending" ? { review: "pending" } : filter === "voided" ? { status: "VOIDED" } : {}) });
    setRows(null);
    api<Movement[]>(`/movements?${params}`).then(setRows).catch((e) => { toast.error(e.message); setRows([]); });
  }, [filter, day]);
  useEffect(() => { loadMeta(); }, [loadMeta]);
  useEffect(() => { load(); }, [load]);

  const active = (rows ?? []).filter((r) => r.status === "ACTIVE");
  const totals = useMemo(() => ({
    out: active.filter((r) => r.type === "OUT").reduce((t, r) => t + r.amount, 0),
    in: active.filter((r) => r.type === "IN").reduce((t, r) => t + r.amount, 0),
    pending: active.filter((r) => !r.reviewedAt).length,
  }), [rows]); // eslint-disable-line react-hooks/exhaustive-deps

  const review = async (ids: string[]) => {
    setBusy(true);
    try {
      const r = await api<{ reviewed: number }>("/movements/review", { method: "POST", json: { ids } });
      toast.success(r.reviewed === 1 ? "Movimiento revisado" : `${r.reviewed} movimientos revisados`);
      load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const columns = useMemo<ColumnDef<Movement>[]>(() => [
    { id: "date", header: "Fecha", accessorFn: (r) => r.occurredAt, cell: ({ row }) => <span className="whitespace-nowrap text-sm tabular-nums">{new Date(row.original.occurredAt).toLocaleString("es-VE", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</span> },
    {
      id: "what",
      header: "Movimiento",
      accessorFn: (r) => `${MOVEMENT_LABELS[r.category] ?? r.category} ${r.description ?? ""}`,
      cell: ({ row }) => {
        const r = row.original;
        return (
          <div className="flex items-center gap-2.5">
            <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full", r.type === "OUT" ? "bg-rose-500/10 text-rose-600" : "bg-emerald-500/10 text-emerald-700")}>{r.type === "OUT" ? <IconArrowUpRight size={16} /> : <IconArrowDownRight size={16} />}</span>
            <span className="min-w-0">
              <span className={cn("block truncate text-sm font-medium", r.status === "VOIDED" && "line-through opacity-60")}>{MOVEMENT_LABELS[r.category] ?? r.category}</span>
              {r.description && <span className="block truncate text-xs text-muted-foreground">{r.description}</span>}
            </span>
          </div>
        );
      },
    },
    {
      id: "amount",
      header: "Monto",
      accessorFn: (r) => r.amount,
      cell: ({ row }) => {
        const r = row.original;
        return (
          <span className={cn("whitespace-nowrap text-sm font-semibold tabular-nums", r.type === "OUT" ? "text-rose-600" : "text-emerald-700", r.status === "VOIDED" && "line-through opacity-60")}>
            {r.type === "OUT" ? "−" : "+"}{formatMoney(r.amountCurrency, r.currency)}
            {r.currency !== "USD" && <span className="block text-xs font-normal text-muted-foreground">{formatMoney(r.amount, "USD")}</span>}
          </span>
        );
      },
    },
    { id: "method", header: "Con qué", accessorFn: (r) => METHOD_LABELS[r.method] ?? r.method, cell: ({ getValue }) => <span className="text-sm text-muted-foreground">{getValue<string>()}</span> },
    {
      id: "who",
      header: "Registró",
      accessorFn: (r) => r.userName ?? "",
      cell: ({ row }) => <span className="text-sm">{row.original.userName ?? "—"}{row.original.authorizedBy && <span className="block text-xs text-amber-700">Con PIN de supervisor</span>}</span>,
    },
    {
      id: "receipt",
      header: "Recibo",
      enableSorting: false,
      cell: ({ row }) => (row.original.receiptUrl ? <a href={row.original.receiptUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-primary hover:underline" onClick={(e) => e.stopPropagation()}><IconPhoto size={15} /> Ver</a> : <span className="text-sm text-muted-foreground">—</span>),
    },
    {
      id: "state",
      header: "Estado",
      accessorFn: (r) => (r.status === "VOIDED" ? "Anulado" : r.reviewedAt ? "Revisado" : "Por revisar"),
      cell: ({ row }) => {
        const r = row.original;
        if (r.status === "VOIDED") return <span className="text-xs text-muted-foreground" title={r.voidReason ?? undefined}><Badge variant="outline" className="text-muted-foreground">Anulado</Badge><span className="mt-0.5 block max-w-[180px] truncate">{r.voidReason}</span></span>;
        return r.reviewedAt ? <Badge variant="outline" className="border-emerald-500/30 text-emerald-700">Revisado</Badge> : <Badge variant="outline" className="border-amber-500/30 text-amber-700">Por revisar</Badge>;
      },
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) => {
        const r = row.original;
        if (r.status === "VOIDED" || !meta?.isManager) return null;
        return (
          <span className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            {!r.reviewedAt && <Button size="sm" variant="ghost" disabled={busy} onClick={() => review([r.id])}>Revisar</Button>}
            <Button size="sm" variant="ghost" className="text-rose-600" onClick={() => setVoiding(r)}>Anular</Button>
          </span>
        );
      },
    },
  ], [meta, busy]); // eslint-disable-line react-hooks/exhaustive-deps

  const pendingIds = active.filter((r) => !r.reviewedAt).map((r) => r.id);

  return (
    <GymPage>
      <GymPageHeader
        title="Ingresos y egresos"
        description="El dinero que no viene de ventas, de la sucursal elegida arriba. Nada se borra: lo equivocado se anula con su motivo."
        actions={
          <>
            {meta?.isManager && pendingIds.length > 0 && <Button variant="outline" className="gap-2" disabled={busy} onClick={() => review(pendingIds)}><IconChecks size={16} /> Marcar {pendingIds.length === 1 ? "1 como revisado" : `${pendingIds.length} como revisados`}</Button>}
            <Button className="gap-2" onClick={() => window.dispatchEvent(new Event("finance-widget:open"))}><IconArrowsExchange size={16} /> Registrar movimiento</Button>
          </>
        }
      />
      <StatGrid>
        <StatCard label="Egresos" value={formatMoney(totals.out, "USD")} tone="bad" icon={<IconArrowUpRight size={20} />} title="Lo que salió" hint={filter === "pending" ? "Por revisar" : day ? "Del día elegido" : "Últimos 300 movimientos"} />
        <StatCard label="Ingresos" value={formatMoney(totals.in, "USD")} tone="good" icon={<IconArrowDownRight size={20} />} title="Lo que entró" hint="Sin contar las ventas" />
        <StatCard label="Por revisar" value={totals.pending} tone={totals.pending ? "warn" : "default"} icon={<IconClockHour4 size={20} />} title="Del personal" hint="Al revisarlos quedan bloqueados" onClick={() => setFilter("pending")} />
      </StatGrid>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterChips value={filter} onChange={setFilter} options={[["pending", "Por revisar"], ["all", "Todos"], ["voided", "Anulados"]]} />
        <div className="w-56"><DateField value={day} onChange={setDay} clearable placeholder="Todos los días" /></div>
      </div>

      <PosTable columns={columns} data={rows ?? []} loading={!rows} searchPlaceholder="Buscar categoría, detalle o persona…" getRowId={(r) => r.id} emptyMessage={filter === "pending" ? "No hay movimientos por revisar." : "No hay movimientos con estos filtros."} />

      {meta?.isManager && <RulesCard meta={meta} onSaved={loadMeta} />}

      <ConfirmDialog
        open={!!voiding}
        danger
        title="¿Anular este movimiento?"
        description="Deja de contar en contabilidad y, si fue efectivo de la gaveta, en esa caja. Queda en el historial, tachado, con tu nombre y el motivo."
        details={voiding ? `${voiding.type === "OUT" ? "Egreso" : "Ingreso"} · ${MOVEMENT_LABELS[voiding.category] ?? voiding.category} · ${formatMoney(voiding.amountCurrency, voiding.currency)} · ${voiding.userName ?? ""}` : null}
        confirmLabel="Anular"
        reason={{ label: "Motivo", suggestions: ["Monto equivocado", "Categoría equivocada", "Se registró dos veces", "No ocurrió"], required: true }}
        onConfirm={async (reason) => {
          if (!voiding) return;
          try {
            await api(`/movements/${voiding.id}/void`, { method: "POST", json: { reason } });
            toast.success("Movimiento anulado");
            load();
          } catch (e) {
            toast.error((e as Error).message);
            throw e;
          }
        }}
        onClose={() => setVoiding(null)}
      />
    </GymPage>
  );
}
