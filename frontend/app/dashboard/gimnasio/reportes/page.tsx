"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { IconCalendarStats, IconClockHour4, IconDoorEnter, IconRepeat, IconTarget, IconUserExclamation, IconUsers } from "@tabler/icons-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { gymApi, leadSourceLabel, money } from "@/lib/gym";
import { formatWhatsAppNumber } from "@/lib/phone-countries";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { PosTable } from "@/components/pos-table";
import { StatCard, StatGrid } from "@/components/stat-card";
import { FilterChips, GymPage, GymPageHeader, PersonCell } from "@/components/gym/gym-ui";

type Attendance = {
  days: number;
  totals: { entries: number; memberEntries: number; visits: number; denied: number; perDay: number; uniqueMembers: number; activeMembers: number };
  perDay: { date: string; members: number; visits: number }[];
  heat: number[][];
  byHour: number[];
  peak: { dow: number; hour: number; count: number };
  frequency: { never: number; low: number; mid: number; high: number };
  deniedReasons: { reason: string; count: number }[];
};
type AtRisk = { id: string; memberNumber: number; photoUrl: string | null; client: { name: string; phone: string | null }; lastVisit: string | null; daysAway: number | null };
type Retention = {
  days: number;
  renewals: { ended: number; renewed: number; early: number; rate: number | null; churned: number };
  activeNow: number;
  months: { month: string; active: number; newMembers: number }[];
  atRisk: AtRisk[];
  revenue: { plan: string; amount: number }[];
  funnel: { created: number; trial: number; won: number; lost: number; conversion: number | null; avgDaysToWin: number | null };
  sources: { source: string; created: number; won: number; conversion: number | null }[];
};
type ClassRow = { id: string; name: string; color?: string | null; sessions: number; cancelled: number; capacity: number; booked: number; attended: number; noShow: number; waitlist: number; trials: number; occupancy: number | null; attendanceRate: number | null; avgPerSession: number; plannedHours?: number; workedHours?: number; lateArrivals?: number };
type Classes = { days: number; totals: { sessions: number; capacity: number; booked: number; attended: number; noShow: number; waitlist: number; cancelled: number; occupancy: number | null; attendanceRate: number | null }; classes: ClassRow[]; trainers: ClassRow[] };

const DOW: [number, string][] = [[1, "Lun"], [2, "Mar"], [3, "Mié"], [4, "Jue"], [5, "Vie"], [6, "Sáb"], [0, "Dom"]];
const hourLabel = (h: number) => `${h % 12 || 12} ${h < 12 ? "a. m." : "p. m."}`;
const pctText = (v: number | null) => (v == null ? "—" : `${v}%`);
const perDayConfig = { members: { label: "Socios", color: "var(--primary)" }, visits: { label: "Pases e invitados", color: "#2563EB" } } satisfies ChartConfig;
const monthsConfig = { active: { label: "Socios activos", color: "var(--primary)" }, newMembers: { label: "Nuevos", color: "#059669" } } satisfies ChartConfig;

function Bars({ items, max, format }: { items: { label: string; value: number; hint?: string }[]; max?: number; format?: (v: number) => string }) {
  const top = max ?? Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="space-y-2.5">
      {items.map((i) => (
        <div key={i.label} className="space-y-1">
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="truncate">{i.label}</span>
            <span className="shrink-0 tabular-nums text-muted-foreground">{format ? format(i.value) : i.value}{i.hint ? ` · ${i.hint}` : ""}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${i.value ? Math.max(2, (i.value / top) * 100) : 0}%` }} /></div>
        </div>
      ))}
      {!items.length && <p className="text-sm text-muted-foreground">Sin datos en estas fechas.</p>}
    </div>
  );
}

/** Weekday × hour grid; darker means more people coming in. */
function Heatmap({ heat }: { heat: number[][] }) {
  const max = Math.max(1, ...heat.flat());
  const hours = Array.from({ length: 24 }, (_, h) => h).filter((h) => heat.some((row) => row[h] > 0) || (h >= 6 && h <= 21));
  return (
    <div className="overflow-x-auto">
      <div className="inline-grid gap-1" style={{ gridTemplateColumns: `40px repeat(${hours.length}, minmax(26px, 1fr))` }}>
        <span />
        {hours.map((h) => <span key={h} className="text-center text-[10px] text-muted-foreground">{h % 12 || 12}{h < 12 ? "a" : "p"}</span>)}
        {DOW.map(([d, label]) => (
          <div key={d} className="contents">
            <span className="pr-1 text-right text-[11px] leading-[26px] text-muted-foreground">{label}</span>
            {hours.map((h) => {
              const v = heat[d][h];
              return <span key={h} title={`${label} ${hourLabel(h)}: ${v} ${v === 1 ? "entrada" : "entradas"}`} className="h-[26px] rounded-md" style={{ background: v ? `color-mix(in oklab, var(--primary) ${Math.round(15 + (v / max) * 85)}%, var(--card))` : "var(--muted)" }} />;
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function GymReportsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"attendance" | "retention" | "classes">("attendance");
  const [days, setDays] = useState("30");
  const [att, setAtt] = useState<Attendance | null>(null);
  const [ret, setRet] = useState<Retention | null>(null);
  const [cls, setCls] = useState<Classes | null>(null);

  useEffect(() => {
    setAtt(null); setRet(null); setCls(null);
    gymApi<Attendance>(`/reports/attendance?days=${days}`).then(setAtt).catch((e) => toast.error(e.message));
    gymApi<Retention>(`/reports/retention?days=${days}`).then(setRet).catch(() => {});
    gymApi<Classes>(`/reports/classes?days=${days}`).then(setCls).catch(() => {});
  }, [days]);

  const riskColumns = useMemo<ColumnDef<AtRisk>[]>(
    () => [
      { id: "member", header: "Socio", accessorFn: (m) => m.client.name, cell: ({ row }) => <PersonCell src={row.original.photoUrl} name={row.original.client.name} sub={`N.º ${row.original.memberNumber}`} /> },
      { id: "away", header: "Sin venir", accessorFn: (m) => m.daysAway ?? 9999, cell: ({ row }) => <span className={cn("font-semibold tabular-nums", (row.original.daysAway ?? 99) >= 30 ? "text-rose-600" : "text-amber-700")}>{row.original.daysAway == null ? "Nunca ha venido" : `${row.original.daysAway} días`}</span> },
      { id: "phone", header: "WhatsApp", accessorFn: (m) => m.client.phone ?? "", cell: ({ getValue }) => <span className="text-muted-foreground tabular-nums">{getValue<string>() ? formatWhatsAppNumber(getValue<string>()) : "—"}</span> },
    ],
    [],
  );
  const classColumns = (trainer: boolean): ColumnDef<ClassRow>[] => [
    { id: "name", header: trainer ? "Entrenador" : "Clase", accessorFn: (c) => c.name, cell: ({ row }) => (trainer ? <PersonCell name={row.original.name} /> : <span className="font-medium">{row.original.name}</span>) },
    { id: "sessions", header: "Sesiones", accessorFn: (c) => c.sessions, cell: ({ row }) => <span className="tabular-nums">{row.original.sessions}{row.original.cancelled ? <span className="text-xs text-muted-foreground"> · {row.original.cancelled} canceladas</span> : null}</span> },
    {
      id: "occupancy",
      header: "Ocupación",
      accessorFn: (c) => c.occupancy ?? 0,
      cell: ({ row }) => (
        <div className="w-32 space-y-1">
          <span className="text-sm font-semibold tabular-nums">{pctText(row.original.occupancy)}</span>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, row.original.occupancy ?? 0)}%` }} /></div>
        </div>
      ),
    },
    { id: "avg", header: "Por sesión", accessorFn: (c) => c.avgPerSession, cell: ({ getValue }) => <span className="tabular-nums">{getValue<number>()}</span> },
    { id: "attendance", header: "Asistencia", accessorFn: (c) => c.attendanceRate ?? 0, cell: ({ row }) => <span className="tabular-nums">{pctText(row.original.attendanceRate)}{row.original.noShow ? <span className="text-xs text-muted-foreground"> · {row.original.noShow} no vinieron</span> : null}</span> },
    trainer
      ? { id: "hours", header: "Horas", accessorFn: (c) => c.workedHours ?? 0, cell: ({ row }) => <span className="tabular-nums">{row.original.workedHours ? `${row.original.workedHours} h trabajadas` : row.original.plannedHours ? `${row.original.plannedHours} h en turnos` : "—"}{row.original.lateArrivals ? <span className="text-xs text-amber-700"> · {row.original.lateArrivals} tarde</span> : null}</span> }
      : { id: "waitlist", header: "En espera", accessorFn: (c) => c.waitlist, cell: ({ row }) => (row.original.waitlist ? <span className="font-medium text-amber-700">{row.original.waitlist}</span> : <span className="text-muted-foreground">—</span>) },
  ];

  const peakLabel = att && att.peak.count ? `${DOW.find(([d]) => d === att.peak.dow)?.[1]} ${hourLabel(att.peak.hour)}` : "—";
  const busyHours = att ? att.byHour.map((v, h) => ({ h, v })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v).slice(0, 3) : [];

  return (
    <GymPage>
      <GymPageHeader
        title="Reportes"
        description="Cuánta gente viene y cuándo, quién renueva y quién se está alejando, y cómo van las clases."
        actions={<FilterChips value={days} onChange={setDays} options={[["7", "7 días"], ["30", "30 días"], ["90", "90 días"], ["365", "1 año"]]} />}
      />
      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="attendance">Asistencia</TabsTrigger>
          <TabsTrigger value="retention">Retención</TabsTrigger>
          <TabsTrigger value="classes">Clases y entrenadores</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === "attendance" && (
        <>
          <StatGrid>
            <StatCard label="Entradas" value={att?.totals.entries ?? "—"} icon={<IconDoorEnter size={20} />} title={`${att?.totals.perDay ?? 0} por día en promedio`} hint={`${att?.totals.visits ?? 0} con pase o invitados`} />
            <StatCard label="Hora pico" value={peakLabel} icon={<IconClockHour4 size={20} />} tone="primary" title={busyHours.length ? `Más llenas: ${busyHours.map((x) => hourLabel(x.h)).join(", ")}` : "Sin entradas todavía"} hint="Según las entradas registradas" />
            <StatCard label="Socios que vinieron" value={att ? `${att.totals.uniqueMembers}/${att.totals.activeMembers}` : "—"} icon={<IconUsers size={20} />} tone="good" title="De los socios activos" hint={`Sin venir: ${att?.frequency.never ?? 0}`} />
            <StatCard label="Entradas denegadas" value={att?.totals.denied ?? "—"} icon={<IconUserExclamation size={20} />} tone={att?.totals.denied ? "warn" : "default"} title={att?.deniedReasons[0]?.reason ?? "Ninguna"} hint="El motivo más común" />
          </StatGrid>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <Card className="gap-3">
              <CardHeader><CardTitle>Entradas por día</CardTitle><CardDescription>Socios con membresía y personas con pase o invitadas.</CardDescription></CardHeader>
              <CardContent>
                <ChartContainer config={perDayConfig} className="h-64 w-full">
                  <BarChart data={(att?.perDay ?? []).map((d) => ({ ...d, label: new Date(`${d.date}T12:00:00`).toLocaleDateString("es-VE", { day: "numeric", month: "short" }) }))}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} minTickGap={16} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} fontSize={11} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="members" stackId="a" fill="var(--color-members)" radius={[0, 0, 0, 0]} isAnimationActive={false} />
                    <Bar dataKey="visits" stackId="a" fill="var(--color-visits)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
            <Card className="gap-3">
              <CardHeader><CardTitle>Frecuencia de los socios activos</CardTitle><CardDescription>Veces por semana, en promedio.</CardDescription></CardHeader>
              <CardContent>
                <Bars items={att ? [{ label: "4 o más", value: att.frequency.high }, { label: "2 a 3", value: att.frequency.mid }, { label: "Menos de 2", value: att.frequency.low }, { label: "No vinieron", value: att.frequency.never }] : []} />
              </CardContent>
            </Card>
          </div>
          <Card className="gap-3">
            <CardHeader><CardTitle>Horas pico</CardTitle><CardDescription>Cuántas personas entran cada día de la semana y a cada hora. Úsalo para poner más personal o abrir clases.</CardDescription></CardHeader>
            <CardContent>{att ? <Heatmap heat={att.heat} /> : <div className="h-48 animate-pulse rounded-lg bg-muted" />}</CardContent>
          </Card>
          {!!att?.deniedReasons.length && (
            <Card className="gap-3">
              <CardHeader><CardTitle>Por qué se negó la entrada</CardTitle></CardHeader>
              <CardContent><Bars items={att.deniedReasons.map((r) => ({ label: r.reason, value: r.count }))} /></CardContent>
            </Card>
          )}
        </>
      )}

      {tab === "retention" && (
        <>
          <StatGrid>
            <StatCard label="Renovaron" value={pctText(ret?.renewals.rate ?? null)} icon={<IconRepeat size={20} />} tone="good" title={`Renovaron ${ret?.renewals.renewed ?? 0} de ${ret?.renewals.ended ?? 0} vencidas`} hint={`Antes de vencer: ${ret?.renewals.early ?? 0}`} />
            <StatCard label="Se fueron" value={ret?.renewals.churned ?? "—"} icon={<IconUserExclamation size={20} />} tone={ret?.renewals.churned ? "bad" : "default"} title="No renovaron en 15 días" hint="Escríbeles para recuperarlos" />
            <StatCard label="En riesgo" value={ret?.atRisk.length ?? "—"} icon={<IconCalendarStats size={20} />} tone={ret?.atRisk.length ? "warn" : "good"} title="Activos sin venir 14 días o más" hint="Lista abajo" />
            <StatCard label="Conversión de prospectos" value={pctText(ret?.funnel.conversion ?? null)} icon={<IconTarget size={20} />} tone="primary" title={`Inscritos: ${ret?.funnel.won ?? 0} de ${ret?.funnel.created ?? 0}`} hint={ret?.funnel.avgDaysToWin != null ? `${ret.funnel.avgDaysToWin} días en promedio` : "Prospectos creados en estas fechas"} onClick={() => router.push("/dashboard/gimnasio/prospectos")} />
          </StatGrid>
          <div className="grid gap-4 xl:grid-cols-2">
            <Card className="gap-3">
              <CardHeader><CardTitle>Socios activos y nuevos</CardTitle><CardDescription>Últimos 6 meses, al cierre de cada mes.</CardDescription></CardHeader>
              <CardContent>
                <ChartContainer config={monthsConfig} className="h-60 w-full">
                  <BarChart data={ret?.months ?? []}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={11} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} fontSize={11} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="active" fill="var(--color-active)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                    <Bar dataKey="newMembers" fill="var(--color-newMembers)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
            <Card className="gap-3">
              <CardHeader><CardTitle>Ingresos por plan</CardTitle><CardDescription>Cobrado en estas fechas, incluidos pases de día.</CardDescription></CardHeader>
              <CardContent><Bars items={(ret?.revenue ?? []).map((r) => ({ label: r.plan, value: r.amount }))} format={money} /></CardContent>
            </Card>
            <Card className="gap-3">
              <CardHeader><CardTitle>Embudo de prospectos</CardTitle><CardDescription>De los creados en estas fechas.</CardDescription></CardHeader>
              <CardContent>
                <Bars max={Math.max(1, ret?.funnel.created ?? 1)} items={ret ? [{ label: "Prospectos", value: ret.funnel.created }, { label: "Con clase de prueba", value: ret.funnel.trial }, { label: "Inscritos", value: ret.funnel.won }, { label: "Perdidos", value: ret.funnel.lost }] : []} />
              </CardContent>
            </Card>
            <Card className="gap-3">
              <CardHeader><CardTitle>Origen que mejor convierte</CardTitle><CardDescription>Dónde vale la pena invertir en publicidad.</CardDescription></CardHeader>
              <CardContent><Bars items={(ret?.sources ?? []).map((s) => ({ label: leadSourceLabel(s.source), value: s.created, hint: `inscritos: ${s.won} (${pctText(s.conversion)})` }))} /></CardContent>
            </Card>
          </div>
          <Card className="gap-4">
            <CardHeader><CardTitle>Socios en riesgo</CardTitle><CardDescription>Tienen membresía activa pero hace 14 días o más que no vienen. Un mensaje a tiempo evita que no renueven.</CardDescription></CardHeader>
            <CardContent>
              <PosTable columns={riskColumns} data={ret?.atRisk ?? []} loading={!ret} searchPlaceholder="Buscar socio…" getRowId={(m) => m.id} onRowClick={(m) => router.push(`/dashboard/gimnasio/socios?socio=${m.id}`)} emptyMessage="Todos tus socios activos vinieron en las últimas dos semanas." skeletonRows={3} />
            </CardContent>
          </Card>
        </>
      )}

      {tab === "classes" && (
        <>
          <StatGrid>
            <StatCard label="Sesiones dadas" value={cls?.totals.sessions ?? "—"} icon={<IconCalendarStats size={20} />} title={`Canceladas: ${cls?.totals.cancelled ?? 0}`} hint="Clases que ya pasaron" />
            <StatCard label="Ocupación" value={pctText(cls?.totals.occupancy ?? null)} icon={<IconUsers size={20} />} tone="primary" title={`${cls?.totals.booked ?? 0} cupos usados de ${cls?.totals.capacity ?? 0}`} hint="Incluye clases de prueba" />
            <StatCard label="Asistencia real" value={pctText(cls?.totals.attendanceRate ?? null)} icon={<IconDoorEnter size={20} />} tone="good" title={`Faltaron: ${cls?.totals.noShow ?? 0}`} hint="De los marcados en la clase" />
            <StatCard label="Demanda sin cupo" value={cls?.totals.waitlist ?? "—"} icon={<IconUserExclamation size={20} />} tone={cls?.totals.waitlist ? "warn" : "default"} title="Personas en lista de espera" hint="Considera abrir otro horario" />
          </StatGrid>
          <Card className="gap-4">
            <CardHeader><CardTitle>Por clase</CardTitle></CardHeader>
            <CardContent><PosTable columns={classColumns(false)} data={cls?.classes ?? []} loading={!cls} searchPlaceholder="Buscar clase…" getRowId={(c) => c.id} emptyMessage="No hubo clases en estas fechas." skeletonRows={3} /></CardContent>
          </Card>
          <Card className="gap-4">
            <CardHeader><CardTitle>Por entrenador</CardTitle><CardDescription>Las horas salen de sus turnos en personal.</CardDescription></CardHeader>
            <CardContent><PosTable columns={classColumns(true)} data={cls?.trainers ?? []} loading={!cls} searchPlaceholder="Buscar entrenador…" getRowId={(c) => c.id} emptyMessage="No hubo clases en estas fechas." skeletonRows={3} /></CardContent>
          </Card>
          <p className="text-xs text-muted-foreground">La asistencia real se calcula con las reservas marcadas como «vino» o «no vino» en la ficha de cada clase.</p>
        </>
      )}
    </GymPage>
  );
}
