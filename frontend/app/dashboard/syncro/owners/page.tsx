"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { IconBan, IconBuildingStore, IconCheck, IconClockPlay } from "@tabler/icons-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { PosTable } from "@/components/pos-table";
import { StatCard, StatGrid } from "@/components/stat-card";
import { BusinessSheet } from "@/components/syncro-admin/business-sheet";
import { useRequireSyncroAdmin } from "@/hooks/use-require-syncro-admin";
import { type AdminBusiness, PLAN_LABEL, STATUS_CLASS, STATUS_LABEL, adminApi, ago, shortDate, usd } from "@/lib/syncro-admin";

type Filter = "ALL" | "ACTIVE" | "TRIAL" | "SUSPENDED";

export default function OwnersManagementPage() {
  useRequireSyncroAdmin();
  const [businesses, setBusinesses] = useState<AdminBusiness[] | null>(null);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(() => {
    adminApi<AdminBusiness[]>("/businesses").then(setBusinesses).catch((e) => { toast.error(e.message); setBusinesses([]); });
  }, []);
  useEffect(() => { load(); }, [load]);

  const count = (s: Filter) => (businesses ?? []).filter((b) => s === "ALL" || b.status === s).length;
  const rows = useMemo(() => (businesses ?? []).filter((b) => filter === "ALL" || b.status === filter), [businesses, filter]);

  const columns: ColumnDef<AdminBusiness>[] = [
    {
      id: "name",
      header: "Negocio",
      accessorFn: (b) => `${b.name} ${b.owner?.email ?? ""} ${b.owner?.name ?? ""} ${b.ruc ?? ""}`,
      cell: ({ row: { original: b } }) => (
        <div className="min-w-0">
          <p className="truncate font-semibold">{b.name}</p>
          <p className="truncate text-xs text-muted-foreground">{b.owner ? `${b.owner.name ?? ""} · ${b.owner.email}` : "Sin dueño"}</p>
        </div>
      ),
    },
    {
      id: "status",
      header: "Estado",
      accessorFn: (b) => STATUS_LABEL[b.status],
      cell: ({ row: { original: b } }) => <Badge variant="outline" className={STATUS_CLASS[b.status]}>{STATUS_LABEL[b.status] ?? b.status}</Badge>,
    },
    { id: "plan", header: "Plan", accessorFn: (b) => PLAN_LABEL[b.subscription] ?? b.subscription },
    {
      id: "due",
      header: "Pagado hasta",
      accessorFn: (b) => b.subscriptionEndsAt ?? "",
      cell: ({ row: { original: b } }) => {
        if (!b.subscriptionEndsAt) return <span className="text-muted-foreground">Sin fecha</span>;
        const late = new Date(b.subscriptionEndsAt) < new Date();
        return <span className={cn(late && "font-medium text-rose-700")}>{shortDate(b.subscriptionEndsAt)}</span>;
      },
    },
    {
      id: "activity",
      header: "Última actividad",
      accessorFn: (b) => b.lastActivityAt ?? "",
      cell: ({ row: { original: b } }) => {
        const stale = !b.lastActivityAt || Date.now() - new Date(b.lastActivityAt).getTime() > 14 * 86_400_000;
        return <span className={cn(stale && "text-amber-700")}>{ago(b.lastActivityAt)}</span>;
      },
    },
    { id: "revenue", header: "Movido en 30 días", accessorFn: (b) => b.revenue30d, cell: ({ row: { original: b } }) => <span className="tabular-nums">{usd(b.revenue30d)}</span> },
    { id: "users", header: "Usuarios", accessorFn: (b) => b._count.users, cell: ({ row: { original: b } }) => <span className="tabular-nums">{b._count.users}</span> },
    { id: "branches", header: "Sucursales", accessorFn: (b) => b._count.branches, cell: ({ row: { original: b } }) => <span className="tabular-nums">{b._count.branches}</span> },
    { id: "created", header: "Cliente desde", accessorFn: (b) => b.createdAt, cell: ({ row: { original: b } }) => shortDate(b.createdAt) },
  ];

  const filters: { key: Filter; label: string }[] = [
    { key: "ALL", label: "Todos" },
    { key: "ACTIVE", label: "Activos" },
    { key: "TRIAL", label: "En prueba" },
    { key: "SUSPENDED", label: "Suspendidos" },
  ];

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Gestión de negocios</h1>
        <p className="text-sm text-muted-foreground">Todos los negocios registrados en Syncro. Toca uno para ver su ficha, su suscripción y su actividad.</p>
      </div>

      <StatGrid>
        <StatCard label="Negocios registrados" value={businesses ? businesses.length : "—"} icon={<IconBuildingStore size={20} />} title="En toda la plataforma" onClick={() => setFilter("ALL")} />
        <StatCard label="Activos" value={businesses ? count("ACTIVE") : "—"} tone="good" icon={<IconCheck size={20} />} title="Con acceso completo" onClick={() => setFilter("ACTIVE")} />
        <StatCard label="En prueba" value={businesses ? count("TRIAL") : "—"} tone="primary" icon={<IconClockPlay size={20} />} title="Probando el sistema" onClick={() => setFilter("TRIAL")} />
        <StatCard label="Suspendidos" value={businesses ? count("SUSPENDED") : "—"} tone="bad" icon={<IconBan size={20} />} title="Sin acceso" onClick={() => setFilter("SUSPENDED")} />
      </StatGrid>

      <PosTable
        columns={columns}
        data={rows}
        loading={!businesses}
        searchPlaceholder="Buscar por negocio, dueño, correo o RIF…"
        getRowId={(b) => b.id}
        onRowClick={(b) => setOpenId(b.id)}
        emptyMessage={filter === "ALL" ? "Todavía no hay negocios registrados." : "No hay negocios con este estado."}
        actions={
          <div className="flex rounded-lg border bg-muted/40 p-0.5">
            {filters.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={cn("rounded-md px-3 py-1.5 text-sm transition", filter === f.key ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground")}
              >
                {f.label} <span className="tabular-nums text-muted-foreground">{businesses ? count(f.key) : ""}</span>
              </button>
            ))}
          </div>
        }
      />

      <BusinessSheet businessId={openId} onClose={() => setOpenId(null)} onChanged={load} />
    </div>
  );
}
