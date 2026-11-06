"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { IconBan, IconBuildingStore, IconCheck, IconClockPlay, IconSparkles } from "@tabler/icons-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { PosTable } from "@/components/pos-table";
import { StatCard, StatGrid } from "@/components/stat-card";
import { BusinessSheet } from "@/components/syncro-admin/business-sheet";
import { MODULE_STATUS_CLASS, MODULE_STATUS_LABEL } from "@/components/syncro-admin/modules-section";
import { useRequireSyncroAdmin } from "@/hooks/use-require-syncro-admin";
import { type AdminBusiness, PLAN_LABEL, STATUS_CLASS, STATUS_LABEL, adminApi, ago, shortDate, usd } from "@/lib/syncro-admin";

type Filter = "ALL" | "ACTIVE" | "TRIAL" | "SUSPENDED";
type Trial = { businessId: string; businessName: string; code: string; name: string; trialEndsAt: string; daysLeft: number };
const MODULE_NAME: Record<string, string> = { gym: "Gimnasio" };

export default function OwnersManagementPage() {
  useRequireSyncroAdmin();
  const [businesses, setBusinesses] = useState<AdminBusiness[] | null>(null);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [openId, setOpenId] = useState<string | null>(null);
  const [trials, setTrials] = useState<Trial[]>([]);

  const load = useCallback(() => {
    adminApi<AdminBusiness[]>("/businesses").then(setBusinesses).catch((e) => { toast.error(e.message); setBusinesses([]); });
    adminApi<Trial[]>("/modules/trials").then(setTrials).catch(() => setTrials([]));
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
      id: "modules",
      header: "Módulos",
      accessorFn: (b) => (b.modules ?? []).map((m) => `${MODULE_NAME[m.moduleCode] ?? m.moduleCode} ${MODULE_STATUS_LABEL[m.status] ?? ""}`).join(" "),
      cell: ({ row: { original: b } }) =>
        b.modules?.length ? (
          <div className="flex flex-wrap gap-1">
            {b.modules.map((m) => (
              <Badge key={m.moduleCode} variant="outline" className={MODULE_STATUS_CLASS[m.status]}>
                {MODULE_NAME[m.moduleCode] ?? m.moduleCode}{m.status !== "ACTIVE" ? ` · ${(MODULE_STATUS_LABEL[m.status] ?? m.status).toLowerCase()}` : ""}
              </Badge>
            ))}
          </div>
        ) : <span className="text-muted-foreground">Solo base</span>,
    },
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

      {trials.length > 0 && (
        <div className="rounded-xl border border-amber-600/30 bg-amber-500/10 p-4">
          <p className="flex items-center gap-2 font-medium text-amber-900"><IconSparkles size={18} /> Pruebas de módulos que terminan o ya terminaron</p>
          <p className="mt-0.5 text-sm text-amber-900/80">No se apagan solas. Abre cada negocio y decide si lo dejas activo, extiendes la prueba o lo pausas.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {trials.map((t) => (
              <button
                key={`${t.businessId}-${t.code}`}
                type="button"
                onClick={() => setOpenId(t.businessId)}
                className="rounded-lg border border-amber-600/30 bg-background px-3 py-1.5 text-left text-sm transition hover:border-amber-600/60"
              >
                <span className="font-medium">{t.businessName}</span> · {t.name} ·{" "}
                <span className={t.daysLeft < 0 ? "font-medium text-rose-700" : ""}>{t.daysLeft < 0 ? `terminó hace ${-t.daysLeft} ${-t.daysLeft === 1 ? "día" : "días"}` : t.daysLeft === 0 ? "termina hoy" : `termina en ${t.daysLeft} ${t.daysLeft === 1 ? "día" : "días"}`}</span>
              </button>
            ))}
          </div>
        </div>
      )}

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
