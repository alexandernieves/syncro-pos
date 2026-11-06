"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { IconActivity, IconBuildingStore, IconMessageCircle, IconRepeat, IconShoppingCart, IconThumbUp, IconUsers } from "@tabler/icons-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { StatCard, StatGrid } from "@/components/stat-card";
import { useRequireSyncroAdmin } from "@/hooks/use-require-syncro-admin";
import { MODULE_LABEL, PLAN_LABEL, STATUS_LABEL, adminApi, usd } from "@/lib/syncro-admin";

type Stats = {
  businessCount: number;
  userCount: number;
  gymMembers: number;
  byStatus: Record<string, number>;
  byPlan: Record<string, number>;
  active7: number;
  active30: number;
  mrr: number;
  totalSales: number;
  totalSalesCount: number;
  last30d: { sales: number; salesTotal: number; gymPayments: number; gymTotal: number };
  dailySales: { day: string; sales: number; total: number }[];
  newBusinesses: { month: string; count: number }[];
  topBusinesses: { businessId: string; name: string; sales: number; total: number }[];
  moduleUse: Record<string, number>;
  feedback: { likes: number; dislikes: number };
  unreadSupport: number;
};

const salesConfig = { total: { label: "Vendido (USD)", color: "var(--primary)" } } satisfies ChartConfig;
const newConfig = { count: { label: "Negocios nuevos", color: "var(--primary)" } } satisfies ChartConfig;

/** Horizontal bars with the value at the end, for short lists. */
function Bars({ items, format = (n: number) => String(n) }: { items: { label: string; value: number }[]; format?: (n: number) => string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  if (!items.length) return <p className="py-6 text-center text-sm text-muted-foreground">Sin datos todavía.</p>;
  return (
    <div className="space-y-2.5">
      {items.map((i) => (
        <div key={i.label} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-sm">
          <span className="truncate">{i.label}</span>
          <div className="h-2 rounded-full bg-muted">
            <div className="h-2 rounded-full bg-primary" style={{ width: `${(i.value / max) * 100}%` }} />
          </div>
          <span className="w-20 text-right tabular-nums text-muted-foreground">{format(i.value)}</span>
        </div>
      ))}
    </div>
  );
}

export default function GlobalStatsPage() {
  useRequireSyncroAdmin();
  const router = useRouter();
  const [s, setS] = useState<Stats | null>(null);

  useEffect(() => {
    adminApi<Stats>("/stats").then(setS).catch((e) => toast.error(e.message));
  }, []);

  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
  const rated = s ? s.feedback.likes + s.feedback.dislikes : 0;
  const label = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("es-VE", { day: "numeric", month: "short" });
  const monthLabel = (m: string) => new Date(`${m}-15T12:00:00`).toLocaleDateString("es-VE", { month: "short", year: "2-digit" });

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Métricas globales</h1>
        <p className="text-sm text-muted-foreground">Cómo va la plataforma: negocios, uso real, lo que se vende con Syncro y el soporte.</p>
      </div>

      <StatGrid>
        <StatCard label="Negocios" value={s?.businessCount ?? "—"} icon={<IconBuildingStore size={20} />} title={s ? `${s.byStatus.ACTIVE ?? 0} activos · ${s.byStatus.TRIAL ?? 0} en prueba` : ""} hint={s ? `${s.byStatus.SUSPENDED ?? 0} suspendidos` : ""} onClick={() => router.push("/dashboard/syncro/owners")} />
        <StatCard label="Usaron Syncro esta semana" value={s ? s.active7 : "—"} tone="good" icon={<IconActivity size={20} />} title={s ? `${pct(s.active7, s.businessCount)} % de los negocios` : ""} hint={s ? `${s.active30} en los últimos 30 días` : ""} />
        <StatCard label="Ingreso mensual" value={s ? usd(s.mrr) : "—"} tone="primary" icon={<IconRepeat size={20} />} title="Cuotas de los negocios activos" onClick={() => router.push("/dashboard/syncro/subscriptions")} />
        <StatCard label="Soporte sin leer" value={s?.unreadSupport ?? "—"} tone={s?.unreadSupport ? "warn" : "default"} icon={<IconMessageCircle size={20} />} title="Mensajes de negocios" onClick={() => router.push("/dashboard/syncro/chat")} />
      </StatGrid>

      <StatGrid>
        <StatCard label="Vendido en 30 días" value={s ? usd(s.last30d.salesTotal) : "—"} icon={<IconShoppingCart size={20} />} title={s ? `${s.last30d.sales.toLocaleString("es-VE")} ventas` : ""} hint="Todos los negocios, en el punto de venta" />
        <StatCard label="Cobrado en gimnasios, 30 días" value={s ? usd(s.last30d.gymTotal) : "—"} icon={<IconShoppingCart size={20} />} title={s ? `${s.last30d.gymPayments.toLocaleString("es-VE")} cobros` : ""} hint="Membresías, pases y abonos" />
        <StatCard label="Usuarios" value={s?.userCount.toLocaleString("es-VE") ?? "—"} icon={<IconUsers size={20} />} title={s ? `${s.gymMembers.toLocaleString("es-VE")} socios de gimnasio` : ""} hint="Sin contar al equipo de Syncro" />
        <StatCard label="Respuestas útiles de la IA" value={s ? (rated ? `${pct(s.feedback.likes, rated)} %` : "—") : "—"} tone="good" icon={<IconThumbUp size={20} />} title={s ? `${rated} calificaciones` : ""} onClick={() => router.push("/dashboard/syncro/feedback")} />
      </StatGrid>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card className="gap-3">
          <CardHeader><CardTitle>Ventas por día</CardTitle><CardDescription>Lo vendido en todos los negocios, últimos 30 días.</CardDescription></CardHeader>
          <CardContent>
            {s && !s.dailySales.length ? (
              <p className="py-16 text-center text-sm text-muted-foreground">Sin ventas en los últimos 30 días.</p>
            ) : (
              <ChartContainer config={salesConfig} className="h-64 w-full">
                <BarChart data={(s?.dailySales ?? []).map((d) => ({ ...d, label: label(d.day), total: Math.round(d.total * 100) / 100 }))}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} minTickGap={16} />
                  <YAxis tickLine={false} axisLine={false} width={48} fontSize={11} tickFormatter={(v) => `$${v}`} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="total" fill="var(--color-total)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
        <Card className="gap-3">
          <CardHeader><CardTitle>Negocios nuevos por mes</CardTitle><CardDescription>Registros de los últimos 12 meses.</CardDescription></CardHeader>
          <CardContent>
            <ChartContainer config={newConfig} className="h-64 w-full">
              <BarChart data={(s?.newBusinesses ?? []).map((m) => ({ ...m, label: monthLabel(m.month) }))}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} minTickGap={8} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} fontSize={11} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="gap-3 lg:col-span-1">
          <CardHeader><CardTitle>Negocios que más venden</CardTitle><CardDescription>Últimos 30 días.</CardDescription></CardHeader>
          <CardContent><Bars items={(s?.topBusinesses ?? []).map((t) => ({ label: t.name, value: t.total }))} format={usd} /></CardContent>
        </Card>
        <Card className="gap-3">
          <CardHeader><CardTitle>Módulos en uso</CardTitle><CardDescription>Cuántos negocios tienen activo cada módulo.</CardDescription></CardHeader>
          <CardContent>
            <Bars items={Object.entries(s?.moduleUse ?? {}).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: MODULE_LABEL[k] ?? k, value: v }))} />
          </CardContent>
        </Card>
        <Card className="gap-3">
          <CardHeader><CardTitle>Planes y estados</CardTitle><CardDescription>Cómo se reparten los negocios.</CardDescription></CardHeader>
          <CardContent className="space-y-5">
            <Bars items={Object.entries(s?.byPlan ?? {}).map(([k, v]) => ({ label: `Plan ${PLAN_LABEL[k] ?? k}`, value: v }))} />
            <Bars items={Object.entries(s?.byStatus ?? {}).map(([k, v]) => ({ label: STATUS_LABEL[k] ?? k, value: v }))} />
          </CardContent>
        </Card>
      </div>

      {s && (
        <p className="text-xs text-muted-foreground">
          Desde el inicio se han registrado {s.totalSalesCount.toLocaleString("es-VE")} ventas por {usd(s.totalSales)} en Syncro.
        </p>
      )}
    </div>
  );
}
