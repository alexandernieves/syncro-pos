"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { IconAlertTriangle, IconCalendarDue, IconCash, IconReceipt2, IconRepeat } from "@tabler/icons-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PosTable } from "@/components/pos-table";
import { StatCard, StatGrid } from "@/components/stat-card";
import { BusinessSheet, PaymentDialog } from "@/components/syncro-admin/business-sheet";
import { useRequireSyncroAdmin } from "@/hooks/use-require-syncro-admin";
import { PLAN_LABEL, STATUS_CLASS, STATUS_LABEL, adminApi, shortDate, usd } from "@/lib/syncro-admin";

type Row = {
  id: string;
  name: string;
  status: string;
  subscription: string;
  monthlyFee: number | null;
  subscriptionEndsAt: string | null;
  daysLeft: number | null;
  owner: { name: string | null; email: string } | null;
  lastPayment: { amount: number; createdAt: string; months: number } | null;
};
type Data = {
  summary: { mrr: number; collectedThisMonth: number; paymentsThisMonth: number; expiringSoon: number; overdue: number; withoutDate: number };
  businesses: Row[];
};
type Filter = "ALL" | "OVERDUE" | "SOON" | "NODATE";

function dueText(r: Row) {
  if (r.daysLeft === null) return { text: "Sin fecha", tone: "text-muted-foreground" };
  if (r.daysLeft < 0) return { text: `Vencida hace ${-r.daysLeft} ${-r.daysLeft === 1 ? "día" : "días"}`, tone: "text-rose-700 font-medium" };
  if (r.daysLeft === 0) return { text: "Vence hoy", tone: "text-amber-700 font-medium" };
  if (r.daysLeft <= 7) return { text: `Vence en ${r.daysLeft} ${r.daysLeft === 1 ? "día" : "días"}`, tone: "text-amber-700 font-medium" };
  return { text: `${r.daysLeft} días`, tone: "" };
}

export default function SubscriptionsPage() {
  useRequireSyncroAdmin();
  const [data, setData] = useState<Data | null>(null);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [openId, setOpenId] = useState<string | null>(null);
  const [paying, setPaying] = useState<Row | null>(null);

  const load = useCallback(() => {
    adminApi<Data>("/subscriptions").then(setData).catch((e) => toast.error(e.message));
  }, []);
  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => {
    const all = data?.businesses ?? [];
    const live = all.filter((r) => r.status !== "SUSPENDED");
    if (filter === "OVERDUE") return live.filter((r) => r.daysLeft !== null && r.daysLeft < 0);
    if (filter === "SOON") return live.filter((r) => r.daysLeft !== null && r.daysLeft >= 0 && r.daysLeft <= 7);
    if (filter === "NODATE") return live.filter((r) => r.daysLeft === null);
    // Most urgent first
    return [...all].sort((a, b) => (a.daysLeft ?? 9999) - (b.daysLeft ?? 9999));
  }, [data, filter]);

  const columns: ColumnDef<Row>[] = [
    {
      id: "name",
      header: "Negocio",
      accessorFn: (r) => `${r.name} ${r.owner?.email ?? ""}`,
      cell: ({ row: { original: r } }) => (
        <div className="min-w-0">
          <p className="truncate font-semibold">{r.name}</p>
          <p className="truncate text-xs text-muted-foreground">{r.owner?.email ?? "Sin dueño"}</p>
        </div>
      ),
    },
    { id: "status", header: "Estado", accessorFn: (r) => STATUS_LABEL[r.status], cell: ({ row: { original: r } }) => <Badge variant="outline" className={STATUS_CLASS[r.status]}>{STATUS_LABEL[r.status] ?? r.status}</Badge> },
    { id: "plan", header: "Plan", accessorFn: (r) => PLAN_LABEL[r.subscription] ?? r.subscription },
    { id: "fee", header: "Cuota", accessorFn: (r) => r.monthlyFee ?? 0, cell: ({ row: { original: r } }) => (r.monthlyFee != null ? <span className="tabular-nums">{usd(r.monthlyFee)}/mes</span> : <span className="text-muted-foreground">Sin cuota</span>) },
    { id: "ends", header: "Pagado hasta", accessorFn: (r) => r.subscriptionEndsAt ?? "", cell: ({ row: { original: r } }) => shortDate(r.subscriptionEndsAt) },
    {
      id: "left",
      header: "Vencimiento",
      accessorFn: (r) => r.daysLeft ?? 9999,
      cell: ({ row: { original: r } }) => {
        const d = dueText(r);
        return <span className={d.tone}>{d.text}</span>;
      },
    },
    {
      id: "last",
      header: "Último pago",
      accessorFn: (r) => r.lastPayment?.createdAt ?? "",
      cell: ({ row: { original: r } }) => (r.lastPayment ? <span className="tabular-nums">{usd(r.lastPayment.amount)} · {shortDate(r.lastPayment.createdAt)}</span> : <span className="text-muted-foreground">Nunca</span>),
    },
    {
      id: "pay",
      header: "",
      enableSorting: false,
      cell: ({ row: { original: r } }) => (
        <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setPaying(r); }}>
          <IconReceipt2 size={16} /> Registrar pago
        </Button>
      ),
    },
  ];

  const s = data?.summary;
  const filters: { key: Filter; label: string; n?: number }[] = [
    { key: "ALL", label: "Todas" },
    { key: "OVERDUE", label: "Vencidas", n: s?.overdue },
    { key: "SOON", label: "Vencen esta semana", n: s?.expiringSoon },
    { key: "NODATE", label: "Sin fecha", n: s?.withoutDate },
  ];

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Suscripciones</h1>
        <p className="text-sm text-muted-foreground">Cuánto paga cada negocio, hasta cuándo está al día y quién debe. Al registrar un pago, la fecha avanza sola.</p>
      </div>

      <StatGrid>
        <StatCard label="Ingreso mensual" value={s ? usd(s.mrr) : "—"} icon={<IconRepeat size={20} />} tone="primary" title="Suma de cuotas de los activos" />
        <StatCard label="Cobrado este mes" value={s ? usd(s.collectedThisMonth) : "—"} icon={<IconCash size={20} />} tone="good" title={s ? `${s.paymentsThisMonth} ${s.paymentsThisMonth === 1 ? "pago" : "pagos"}` : ""} />
        <StatCard label="Vencen esta semana" value={s ? s.expiringSoon : "—"} icon={<IconCalendarDue size={20} />} tone="warn" title="Avísales antes de que venza" onClick={() => setFilter("SOON")} />
        <StatCard label="Vencidas" value={s ? s.overdue : "—"} icon={<IconAlertTriangle size={20} />} tone="bad" title="Cobrar o suspender" onClick={() => setFilter("OVERDUE")} />
      </StatGrid>

      <PosTable
        columns={columns}
        data={rows}
        loading={!data}
        searchPlaceholder="Buscar negocio o correo…"
        getRowId={(r) => r.id}
        onRowClick={(r) => setOpenId(r.id)}
        emptyMessage={filter === "ALL" ? "Todavía no hay negocios." : "Ningún negocio en esta lista."}
        actions={
          <div className="flex flex-wrap rounded-lg border bg-muted/40 p-0.5">
            {filters.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={cn("rounded-md px-3 py-1.5 text-sm transition", filter === f.key ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground")}
              >
                {f.label}{f.n !== undefined && <span className="ml-1 tabular-nums text-muted-foreground">{f.n}</span>}
              </button>
            ))}
          </div>
        }
      />

      <BusinessSheet businessId={openId} onClose={() => setOpenId(null)} onChanged={load} />
      {paying && <PaymentDialog business={paying} open={!!paying} onClose={() => setPaying(null)} onSaved={load} />}
    </div>
  );
}
