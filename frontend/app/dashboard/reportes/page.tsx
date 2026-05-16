"use client";

import React, { useState, useEffect } from "react";
import { API_URL } from "@/lib/constants"
import { 
  Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription, CardAction 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  IconDownload, IconTrendingUp, IconShoppingCart, IconTarget, IconUsers, IconFilter, IconArrowRight, IconLayoutColumns, IconChevronsRight, IconReportAnalytics, IconCheck
} from "@tabler/icons-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ChartAreaInteractive } from "@/components/chart-area-interactive";
import { ChartBarSales } from "@/components/ChartBarSales";
import { ChartRadialCategories } from "@/components/ChartRadialCategories";
import { 
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";

const API = process.env.NEXT_PUBLIC_API_URL || "${process.env.NEXT_PUBLIC_API_URL || `${API_URL}`}`;

export default function ReportsPage() {
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSales();
  }, []);

  const fetchSales = async () => {
    try {
      const branchId = localStorage.getItem("currentBranchId") || "";
      const res = await fetch(`${API}/sales${branchId ? `?branchId=${branchId}` : ""}`);
      if (res.ok) {
        setSales(await res.json());
      }
    } catch (error) {
      toast.error("Error al cargar reportes");
    } finally {
      setLoading(false);
    }
  };

  const totalRevenue = sales.reduce((acc, s) => acc + s.total, 0);
  const totalOrders = sales.length;
  const avgTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  
  // Dynamic top products calculation
  const topProducts = React.useMemo(() => {
    const counts: any = {};
    sales.forEach(s => {
      s.items?.forEach((it: any) => {
        const name = it.variant?.product?.name || "Desconocido";
        counts[name] = (counts[name] || 0) + it.quantity;
      });
    });
    return Object.entries(counts)
      .sort((a: any, b: any) => (b[1] as number) - (a[1] as number))
      .slice(0, 5)
      .map(([name, value]) => ({ name, value }));
  }, [sales]);

  // Dynamic Chart Data Calculation (Real Postgres Data)
  const chartData = React.useMemo(() => {
    const daily: Record<string, { date: string, revenue: number, orders: number }> = {};
    
    sales.forEach(sale => {
      const day = new Date(sale.createdAt || sale.date).toISOString().split('T')[0];
      if (!daily[day]) {
        daily[day] = { date: day, revenue: 0, orders: 0 };
      }
      daily[day].revenue += sale.total;
      daily[day].orders += 1;
    });

    return Object.values(daily).sort((a, b) => a.date.localeCompare(b.date));
  }, [sales]);

  return (
    <div className="flex flex-col gap-6 py-4 md:gap-8 md:py-6 font-sans">
      
      {/* Header with Dashboard Style Actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 px-4 lg:px-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reportes de Inteligencia</h1>
          <p className="text-sm text-muted-foreground font-medium">Análisis de rendimiento, ventas y métricas clave en tiempo real.</p>
        </div>
        <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2 h-9">
                <IconFilter size={16} /> Filtros Avanzados
            </Button>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button size="sm" className="gap-2 h-9 shadow-md">
                        <IconDownload size={16} /> 
                        <span className="hidden lg:inline">Exportar Datos</span>
                        <span className="lg:hidden">Exportar</span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 border-none shadow-2xl rounded-xl">
                    <DropdownMenuItem className="text-xs">Descargar PDF (Reporte)</DropdownMenuItem>
                    <DropdownMenuItem className="text-xs">Excel / CSV (Libro)</DropdownMenuItem>
                    <DropdownMenuItem className="text-xs font-semibold text-primary">Enviar a correo</DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
      </div>

      {/* Main Interactive Chart */}
      <div className="px-4 lg:px-6">
        <ChartAreaInteractive data={chartData} />
      </div>      {/* Optimized Metric Cards - NEW PREMIUM PATTERN */}
      <div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card text-secondary-foreground">
          <Card className="@container/card shadow-sm border-none">
            <CardHeader>
              <CardDescription className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Ventas Totales</CardDescription>
              <CardTitle className="text-2xl font-bold tabular-nums @[250px]/card:text-3xl">
                ${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </CardTitle>
              <CardAction>
                <Badge variant="outline" className="gap-1 border-primary/20 text-primary bg-primary/5">
                  <IconTrendingUp size={12} />
                  +12.5%
                </Badge>
              </CardAction>
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1 text-[10px] pb-5">
              <div className="line-clamp-1 flex gap-2 font-bold text-muted-foreground uppercase tracking-tight">
                Crecimiento mensual sostenido <IconTrendingUp className="size-3 text-primary" />
              </div>
              <div className="text-muted-foreground/60 font-medium italic">
                Rendimiento proyectado superado
              </div>
            </CardFooter>
          </Card>

          <Card className="@container/card shadow-sm border-none">
            <CardHeader>
              <CardDescription className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Órdenes Realizadas</CardDescription>
              <CardTitle className="text-2xl font-bold tabular-nums @[250px]/card:text-3xl text-emerald-600">
                {totalOrders}
              </CardTitle>
              <CardAction>
                <Badge variant="outline" className="gap-1 border-emerald-500/20 text-emerald-600 bg-emerald-500/5">
                  <IconTrendingUp size={12} />
                  +5%
                </Badge>
              </CardAction>
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1 text-[10px] pb-5">
              <div className="line-clamp-1 flex gap-2 font-bold text-muted-foreground uppercase tracking-tight">
                Volumen de transacciones <IconCheck className="size-3 text-emerald-500" />
              </div>
              <div className="text-muted-foreground/60 font-medium italic">
                Procesamiento estable sin demoras
              </div>
            </CardFooter>
          </Card>

          <Card className="@container/card shadow-sm border-none">
            <CardHeader>
              <CardDescription className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Ticket Promedio</CardDescription>
              <CardTitle className="text-2xl font-bold tabular-nums @[250px]/card:text-3xl text-amber-600">
                ${avgTicket.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </CardTitle>
              <CardAction>
                <Badge variant="outline" className="gap-1 border-amber-500/20 text-amber-600 bg-amber-500/5">
                  <IconTrendingUp size={12} />
                  +4.5%
                </Badge>
              </CardAction>
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1 text-[10px] pb-5">
              <div className="line-clamp-1 flex gap-2 font-bold text-muted-foreground uppercase tracking-tight">
                Aumento en valor de cesta <IconTrendingUp className="size-3 text-amber-500" />
              </div>
              <div className="text-muted-foreground/60 font-medium italic">
                Estrategias de venta cruzada efectivas
              </div>
            </CardFooter>
          </Card>

          <Card className="@container/card shadow-sm border-none">
            <CardHeader>
              <CardDescription className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Clientes Registrados</CardDescription>
              <CardTitle className="text-2xl font-bold tabular-nums @[250px]/card:text-3xl text-primary font-black">
                {Array.from(new Set(sales.map(s => s.clientId))).filter(Boolean).length || 0}
              </CardTitle>
              <CardAction>
                <Badge variant="outline" className="gap-1 border-primary/20 text-primary bg-primary/5">
                   <IconUsers size={12} />
                   Verificado
                </Badge>
              </CardAction>
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1 text-[10px] pb-5">
              <div className="line-clamp-1 flex gap-2 font-bold text-muted-foreground uppercase tracking-tight">
                Cartera de clientes con compras <IconCheck className="size-3 text-primary" />
              </div>
              <div className="text-muted-foreground/60 font-medium italic">
                Basado en transacciones reales
              </div>
            </CardFooter>
          </Card>
      </div>

      {/* Secondary Dynamic Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 px-4 lg:px-6">
          <ChartBarSales data={topProducts} />
          <ChartRadialCategories sales={sales} />
      </div>

      {/* Footer Info / Log mirroring dashboard look */}
      <div className="px-4 lg:px-6 mb-4">
          <Card className="bg-muted/30 border-dashed border-2 shadow-none flex flex-col items-center justify-center p-8 gap-4 overflow-hidden group hover:bg-muted/50 transition-colors cursor-pointer">
              <div className="size-12 rounded-full bg-background flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                  <IconReportAnalytics className="text-primary" />
              </div>
              <div className="text-center">
                  <h3 className="font-bold text-lg">Reporte Detallado de Auditoría</h3>
                  <p className="text-sm text-muted-foreground max-w-sm mx-auto">Consulte el desglose ítem por ítem de cada transacción realizada en el periodo actual con filtros avanzados de sucursal.</p>
              </div>
              <Button size="sm" variant="outline" className="gap-2 bg-background font-semibold">
                  Acceder al Auditor <IconChevronsRight size={16} />
              </Button>
          </Card>
      </div>

    </div>
  );
}
