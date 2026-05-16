"use client";

import React, { useState, useEffect } from "react";
import { API_URL } from "@/lib/constants"
import { useRouter } from "next/navigation";
import { ChartAreaInteractive } from "@/components/chart-area-interactive";
import { 
  Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription, CardAction 
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IconTrendingUp, IconUsers, IconShoppingCart, IconPackage, IconCheck, IconExternalLink, IconCash, IconCreditCard, IconTarget, IconBrandWhatsapp, IconTrendingDown } from "@tabler/icons-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { useCurrency } from "@/context/CurrencyContext";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const API = process.env.NEXT_PUBLIC_API_URL || ``${API_URL}`;

const RecentSalesTable = ({ sales }: { sales: any[] }) => {
  const { formatPrice } = useCurrency();
  return (
    <div className="rounded-xl border border-[#79716b]/10 bg-card overflow-hidden">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow className="hover:bg-transparent border-[#79716b]/10 font-semibold uppercase tracking-tight text-[10px] text-[#79716b]">
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
                    <Badge variant="outline" className="text-[10px] gap-1.5 border-[#79716b]/20 text-[#79716b] font-semibold uppercase">
                     <IconCash size={10} /> POS
                   </Badge>
                </TableCell>
                <TableCell className="px-4 py-3 text-right font-black tabular-nums text-white text-sm">
                  {formatPrice(sale.total)}
                </TableCell>
                <TableCell className="px-4 py-3">
                   <div className="flex items-center gap-1.5">
                      <div className="size-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                      <span className="text-[10px] font-semibold uppercase tracking-tight text-emerald-500">Completada</span>
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
};

export default function Page() {
  const router = useRouter();
  const { formatPrice, currency, exchangeRate } = useCurrency();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      const user = JSON.parse(userStr);
      if (user.role === "syncropos") {
        router.replace("/dashboard/syncro/owners");
        return;
      }
    }
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const branchId = localStorage.getItem("currentBranchId") || "";
      const res = await fetch(`${API}/dashboard/stats${branchId ? `?branchId=${branchId}` : ""}`);
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
      <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
        <Card className="@container/card bg-gradient-to-t from-primary/5 to-card shadow-xs">
          <CardHeader>
            <CardDescription>Ingresos Totales</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {formatPrice(stats?.revenue || 0)}
              {currency === "USD" && (
                <div className="text-xs text-muted-foreground font-medium mt-0.5">
                  Bs {( (stats?.revenue || 0) * exchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                </div>
              )}
            </CardTitle>
            <CardAction>
              <Badge variant="outline" className="gap-1">
                <IconTrendingUp className="size-3 text-emerald-500" />
                +100%
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 flex gap-2 font-medium">
              Actividad en Tiempo Real
            </div>
            <div className="text-muted-foreground">
              Ingresos procesados
            </div>
          </CardFooter>
        </Card>

        <Card className="@container/card bg-gradient-to-t from-primary/5 to-card shadow-xs">
          <CardHeader>
            <CardDescription>Ventas (Órdenes)</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl text-emerald-600">
              {stats?.salesCount}
            </CardTitle>
            <CardAction>
              <IconShoppingCart size={20} className="text-emerald-500/30" />
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 flex gap-2 font-medium">
              Procesamiento de órdenes
            </div>
            <div className="text-muted-foreground">
              Transacciones completadas
            </div>
          </CardFooter>
        </Card>

        <Card className="@container/card bg-gradient-to-t from-primary/5 to-card shadow-xs">
          <CardHeader>
            <CardDescription>Total Clientes</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl text-primary font-black">
              {stats?.clientsCount}
            </CardTitle>
            <CardAction>
              <IconUsers size={20} className="text-primary/30" />
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 flex gap-2 font-medium">
              Base de datos de clientes
            </div>
            <div className="text-muted-foreground">
              Directorio actualizado
            </div>
          </CardFooter>
        </Card>

        <Card className="@container/card bg-gradient-to-t from-primary/5 to-card shadow-xs">
          <CardHeader>
            <CardDescription>Productos en Almacén</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl text-orange-600">
              {stats?.productsCount}
            </CardTitle>
            <CardAction>
               <IconPackage size={20} className="text-orange-500/30" />
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 flex gap-2 font-medium text-orange-600">
              Monitoreo de stock activo
            </div>
            <div className="text-muted-foreground">
              Variantes registradas
            </div>
          </CardFooter>
        </Card>
      </div>

      {/* Syncro Growth Partner Section */}
      {stats?.settings?.showSalesGoal && (
        <div className="px-4 lg:px-6">
          <div className="flex items-center gap-2 mb-4">
            <IconTarget size={18} className="text-blue-500" />
            <h2 className="text-sm font-bold uppercase tracking-tight text-blue-500">Syncro Growth Partner (Metas)</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Sales Goal */}
            <Card className="bg-gradient-to-br from-blue-500/5 to-transparent border-blue-500/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center justify-between">
                  Meta de Ventas del Mes
                  <span className="text-xs font-mono text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded-full">
                    {Math.min(Math.round(((stats?.revenue || 0) / (stats?.settings?.salesGoal || 10000)) * 100), 100)}%
                  </span>
                </CardTitle>
                <CardDescription className="text-xs">Progreso hacia el objetivo de {formatPrice(stats?.settings?.salesGoal || 10000)}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Progress value={Math.min(((stats?.revenue || 0) / (stats?.settings?.salesGoal || 10000)) * 100, 100)} className="h-2 bg-blue-500/10" indicatorColor="bg-blue-500" />
                <div className="flex justify-between text-xs font-medium tabular-nums">
                  <span className="text-muted-foreground">{formatPrice(stats?.revenue || 0)}</span>
                  <span className="text-blue-600 font-bold">{formatPrice(stats?.settings?.salesGoal || 10000)}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      <div className="px-4 lg:px-6">
        <ChartAreaInteractive data={stats?.chartData} />
      </div>
      
      <div className="px-4 lg:px-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold uppercase tracking-tight text-[#79716b]">Ventas Recientes</h2>
        </div>
        <RecentSalesTable sales={stats?.recentSales || []} />
      </div>
    </div>
  );
}
