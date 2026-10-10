"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { IconAlertTriangle, IconCalendarRepeat, IconCash, IconDoorEnter, IconUserPlus, IconUsers } from "@tabler/icons-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PosTable } from "@/components/pos-table";
import { StatCard, StatGrid } from "@/components/stat-card";
import { GymPage, GymPageHeader, PersonCell } from "@/components/gym/gym-ui";
import { type GymMemberRow, gymApi, money, shortDate } from "@/lib/gym";
import { cn } from "@/lib/utils";

type Summary = {
  totalMembers: number;
  active: number;
  frozen: number;
  expired: number;
  withoutMembership: number;
  newThisMonth: number;
  revenueThisMonth: number;
  checkInsToday: number;
  expiringSoon: GymMemberRow[];
};

export default function GymSummaryPage() {
  const router = useRouter();
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    gymApi<Summary>("/summary").then(setSummary).catch((e) => toast.error(e.message));
  }, []);

  const columns = useMemo<ColumnDef<GymMemberRow>[]>(
    () => [
      {
        id: "member",
        header: "Socio",
        accessorFn: (r) => `${r.client.name} ${r.client.documentId ?? ""}`,
        cell: ({ row }) => <PersonCell src={row.original.photoUrl} name={row.original.client.name} sub={`N.º ${row.original.memberNumber}${row.original.client.documentId ? ` · ${row.original.client.documentId}` : ""}`} />,
      },
      { id: "plan", header: "Plan", accessorFn: (r) => r.currentMembership?.planName ?? "", cell: ({ getValue }) => <span>{getValue<string>() || "—"}</span> },
      {
        id: "end",
        header: "Vence",
        accessorFn: (r) => r.currentMembership?.endDate ?? "",
        cell: ({ row }) => (row.original.currentMembership ? shortDate(row.original.currentMembership.endDate) : "—"),
      },
      {
        id: "days",
        header: "Quedan",
        accessorFn: (r) => r.daysLeft ?? 0,
        cell: ({ row }) => {
          const d = row.original.daysLeft ?? 0;
          return <span className={cn("font-semibold tabular-nums", d <= 2 ? "text-rose-600" : "text-amber-600")}>{d === 0 ? "Vence hoy" : d === 1 ? "1 día" : `${d} días`}</span>;
        },
      },
    ],
    [],
  );

  return (
    <GymPage>
      <GymPageHeader
        title="Gimnasio"
        description="Socios, membresías y entradas de hoy."
        actions={
          <>
            <Button asChild variant="outline" className="gap-2"><Link href="/dashboard/gimnasio/recepcion"><IconDoorEnter size={16} /> Recepción</Link></Button>
            <Button asChild variant="outline" className="gap-2"><Link href="/dashboard/gimnasio/planes"><IconCalendarRepeat size={16} /> Planes</Link></Button>
            <Button asChild className="gap-2"><Link href="/dashboard/gimnasio/socios?nuevo=1"><IconUserPlus size={16} /> Nuevo socio</Link></Button>
          </>
        }
      />

      {!summary ? (
        <StatGrid>{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[172px] rounded-xl" />)}</StatGrid>
      ) : (
        <StatGrid>
          <StatCard
            label="Socios activos"
            value={summary.active}
            icon={<IconUsers size={20} />}
            title={`${summary.totalMembers} socios registrados`}
            hint={`${summary.newThisMonth} nuevos este mes`}
            onClick={() => router.push("/dashboard/gimnasio/socios?estado=ACTIVE")}
          />
          <StatCard label="Cobrado este mes" value={money(summary.revenueThisMonth)} icon={<IconCash size={20} />} tone="primary" title="Membresías y renovaciones" hint="Incluido en tus turnos de caja" />
          <StatCard
            label="Membresías vencidas"
            value={summary.expired}
            icon={<IconAlertTriangle size={20} />}
            tone={summary.expired ? "bad" : "default"}
            title={summary.expired ? "Socios sin acceso" : "Todo al día"}
            hint={`${summary.withoutMembership} sin membresía · ${summary.frozen} congeladas`}
            onClick={() => router.push("/dashboard/gimnasio/socios?estado=EXPIRED")}
          />
          <StatCard
            label="Entradas hoy"
            value={summary.checkInsToday}
            icon={<IconDoorEnter size={20} />}
            tone="good"
            title="Registradas en recepción"
            hint="Abre recepción para registrar entradas"
            onClick={() => router.push("/dashboard/gimnasio/recepcion")}
          />
        </StatGrid>
      )}

      <Card className="gap-4">
        <CardHeader>
          <CardTitle>Vencen en los próximos 7 días</CardTitle>
          <CardDescription>Renuévalas antes de que el socio quede sin acceso. Toca un socio para abrir su ficha.</CardDescription>
        </CardHeader>
        <CardContent>
          <PosTable
            columns={columns}
            data={summary?.expiringSoon ?? []}
            loading={!summary}
            searchPlaceholder="Buscar socio…"
            getRowId={(r) => r.id}
            onRowClick={(r) => router.push(`/dashboard/gimnasio/socios?socio=${r.id}`)}
            emptyMessage="Ninguna membresía vence esta semana."
            skeletonRows={3}
          />
        </CardContent>
      </Card>
    </GymPage>
  );
}
