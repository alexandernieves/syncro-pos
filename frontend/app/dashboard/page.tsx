"use client";

import React, { useState, useEffect } from "react";
import { ChartAreaInteractive } from "@/components/chart-area-interactive";
import { 
  Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription, CardAction 
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IconTrendingUp, IconUsers, IconShoppingCart, IconPackage, IconCheck, IconExternalLink, IconCash, IconCreditCard } from "@tabler/icons-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000";

const RecentSalesTable = ({ sales }: { sales: any[] }) => (
  <div className="rounded-xl border border-[#79716b]/10 bg-card overflow-hidden">
    <Table>
      <TableHeader className="bg-muted/50">
        <TableRow className="hover:bg-transparent border-[#79716b]/10 font-bold uppercase tracking-tight text-[10px] text-[#79716b]">
          <TableHead className="w-[100px] h-10 px-4">Orden</TableHead>
          <TableHead className="h-10 px-4">Cliente</TableHead>
          <TableHead className="h-10 px-4">Metodo</TableHead>
          <TableHead className="h-10 px-4 text-right">Total</TableHead>
          <TableHead className="h-10 px-4">Estado</TableHead>
          <TableHead className="h-10 px-4 text-right">Fecha</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sales.length === 0 ? (
          <TableRow>
            <TableCell colSpan={6} className="h-24 text-center text-xs text-muted-foreground italic">No hay ventas registradas recientemente</TableCell>
          </TableRow>
        ) : (
          sales.map((sale) => (
            <TableRow key={sale.id} className="hover:bg-muted/30 border-[#79716b]/5 transition-colors group">
              <TableCell className="px-4 py-3 font-mono text-[10px] text-primary">{sale.id.substring(0, 8)}</TableCell>
              <TableCell className="px-4 py-3 text-xs font-bold text-white uppercase tracking-tight">{sale.client}</TableCell>
              <TableCell className="px-4 py-3">
                 <Badge variant="outline" className="text-[10px] gap-1.5 border-[#79716b]/20 text-[#79716b] font-black uppercase">
                   <IconCash size={10} /> POS
                 </Badge>
              </TableCell>
              <TableCell className="px-4 py-3 text-right font-black tabular-nums text-white text-sm">${sale.total.toFixed(2)}</TableCell>
              <TableCell className="px-4 py-3">
                 <div className="flex items-center gap-1.5">
                    <div className="size-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Completada</span>
                 </div>
              </TableCell>
              <TableCell className="px-4 py-3 text-right text-[10px] text-muted-foreground font-medium uppercase">{new Date(sale.date).toLocaleString('es-VE', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  </div>
);

export default function Page() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API}/dashboard/stats`);
      if (res.ok) {
        setStats(await res.json());
      }
    } catch {
      toast.error("Error al cargar estadísticas");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-6 py-4 md:gap-8 md:py-6 px-4 lg:px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
        <Skeleton className="h-[400px] rounded-xl" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 py-4 md:gap-8 md:py-6 font-sans">
      
      {/* Premium Dashboard Metrics */}
      <div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card text-secondary-foreground">
        <Card className="@container/card shadow-sm border-none">
          <CardHeader>
            <CardDescription className="text-[10px] font-black uppercase tracking-widest text-[#79716b]">Ingresos Totales</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums @[250px]/card:text-3xl">
              ${stats?.revenue?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </CardTitle>
            <CardAction>
              <Badge variant="outline" className="gap-1 border-emerald-500/20 text-emerald-600 bg-emerald-500/5">
                <IconTrendingUp size={12} />
                +100%
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1 text-[10px] pb-5">
            <div className="line-clamp-1 flex gap-2 font-bold text-muted-foreground uppercase tracking-tight">
              Actividad en Tiempo Real <IconCheck className="size-3 text-emerald-500" />
            </div>
          </CardFooter>
        </Card>

        <Card className="@container/card shadow-sm border-none">
          <CardHeader>
            <CardDescription className="text-[10px] font-black uppercase tracking-widest text-[#79716b]">Ventas (Órdenes)</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums @[250px]/card:text-3xl text-emerald-600">
              {stats?.salesCount}
            </CardTitle>
            <CardAction>
              <IconShoppingCart size={20} className="text-emerald-500/30" />
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1 text-[10px] pb-5">
            <div className="line-clamp-1 flex gap-2 font-bold text-muted-foreground uppercase tracking-tight">
              Procesamiento de órdenes activo
            </div>
          </CardFooter>
        </Card>

        <Card className="@container/card shadow-sm border-none">
          <CardHeader>
            <CardDescription className="text-[10px] font-black uppercase tracking-widest text-[#79716b]">Total Clientes</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums @[250px]/card:text-3xl text-primary font-black">
              {stats?.clientsCount}
            </CardTitle>
            <CardAction>
              <IconUsers size={20} className="text-primary/30" />
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1 text-[10px] pb-5">
            <div className="line-clamp-1 flex gap-2 font-bold text-muted-foreground uppercase tracking-tight">
              Base de datos de clientes <IconExternalLink className="size-3" />
            </div>
          </CardFooter>
        </Card>

        <Card className="@container/card shadow-sm border-none">
          <CardHeader>
            <CardDescription className="text-[10px] font-black uppercase tracking-widest text-[#79716b]">Productos en Almacén</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums @[250px]/card:text-3xl text-orange-600">
              {stats?.productsCount}
            </CardTitle>
            <CardAction>
               <IconPackage size={20} className="text-orange-500/30" />
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1 text-[10px] pb-5">
            <div className="line-clamp-1 flex gap-2 font-bold text-muted-foreground uppercase tracking-tight">
              Monitoreo de stock activo
            </div>
          </CardFooter>
        </Card>
      </div>

      <div className="px-4 lg:px-6">
        <ChartAreaInteractive data={stats?.chartData} />
      </div>
      
      <div className="px-4 lg:px-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-black uppercase tracking-[0.2em] text-[#79716b]">Ventas Recientes</h2>
        </div>
        <RecentSalesTable sales={stats?.recentSales || []} />
      </div>
    </div>
  );
}
