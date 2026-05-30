"use client";

import React, { useState, useEffect } from "react";
import { API_URL } from "@/lib/constants"
import { useRouter } from "next/navigation";
import { ChartAreaInteractive } from "@/components/chart-area-interactive";
import { 
  Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription, CardAction 
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  IconTrendingUp, IconUsers, IconShoppingCart, IconPackage, IconCheck, IconExternalLink, 
  IconCash, IconCreditCard, IconTarget, IconBrandWhatsapp, IconTrendingDown, IconCalendar 
} from "@tabler/icons-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { useCurrency } from "@/context/CurrencyContext";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const API = API_URL;

const RecentSalesTable = ({ sales }: { sales: any[] }) => {
  const { formatPrice } = useCurrency();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const totalPages = Math.max(1, Math.ceil(sales.length / pageSize));

  useEffect(() => {
    setCurrentPage(1);
  }, [sales.length]);

  const paginatedSales = sales.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return (
    <div className="space-y-3">
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
            {paginatedSales.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-xs text-muted-foreground italic">No hay ventas registradas recientemente</TableCell>
              </TableRow>
            ) : (
              paginatedSales.map((sale) => (
                <TableRow key={sale.id} className="hover:bg-muted/30 border-[#79716b]/5 transition-colors group">
                  <TableCell className="px-4 py-3 font-mono text-[10px] text-primary">{sale.id?.substring(0, 8) || 'N/A'}</TableCell>
                  <TableCell className="px-4 py-3 text-xs font-bold text-white uppercase tracking-tight">{sale.client || 'Consumidor Final'}</TableCell>
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
                        <div className={cn(
                          "size-1.5 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)]",
                          sale.status === 'CANCELLED' ? "bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" : "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                        )} />
                        <span className={cn(
                          "text-[10px] font-semibold uppercase tracking-tight",
                          sale.status === 'CANCELLED' ? "text-rose-500 animate-pulse" : "text-emerald-500"
                        )}>{sale.status === 'CANCELLED' ? 'Cancelada' : 'Completada'}</span>
                     </div>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right text-[10px] text-muted-foreground font-medium uppercase">{new Date(sale.date).toLocaleString('es-VE', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Reusable Platform Pagination Footer */}
      {sales.length > 0 && (
        <div className="flex items-center justify-between px-2 text-xs text-muted-foreground bg-card/40 border border-[#79716b]/10 rounded-xl p-3 shadow-xs font-sans">
          <span>{sales.length} venta{sales.length !== 1 ? 's' : ''} en total</span>
          <div className="flex items-center gap-4">
            {/* Rows per page selector */}
            <div className="flex items-center gap-2">
              <span>Filas por página</span>
              <select
                value={pageSize}
                onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                className="h-8 rounded-lg border border-[#79716b]/20 bg-muted/40 px-2 text-xs cursor-pointer outline-none focus:ring-1 focus:ring-primary/20 text-white font-medium"
              >
                {[5, 10, 20, 50].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            {/* Page info */}
            <span className="font-medium text-white">Página {currentPage} de {totalPages}</span>
            {/* Nav buttons */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="size-8 flex items-center justify-center rounded-lg border border-[#79716b]/20 bg-muted/30 hover:bg-muted/80 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                title="Primera página"
              >
                <svg width="12" height="12" viewBox="0 0 15 15" fill="none"><path d="M2 7.5L7.5 2M2 7.5L7.5 13M2 7.5H13M8.5 2L14 7.5M8.5 13L14 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="size-8 flex items-center justify-center rounded-lg border border-[#79716b]/20 bg-muted/30 hover:bg-muted/80 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                title="Anterior"
              >
                <svg width="12" height="12" viewBox="0 0 15 15" fill="none"><path d="M9 11L5 7.5L9 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="size-8 flex items-center justify-center rounded-lg border border-[#79716b]/20 bg-muted/30 hover:bg-muted/80 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                title="Siguiente"
              >
                <svg width="12" height="12" viewBox="0 0 15 15" fill="none"><path d="M6 4L10 7.5L6 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="size-8 flex items-center justify-center rounded-lg border border-[#79716b]/20 bg-muted/30 hover:bg-muted/80 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                title="Última página"
              >
                <svg width="12" height="12" viewBox="0 0 15 15" fill="none"><path d="M13 7.5L7.5 2M13 7.5L7.5 13M13 7.5H2M6.5 2L1 7.5M6.5 13L1 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default function Page() {
  const router = useRouter();
  const { formatPrice, currency, exchangeRate } = useCurrency();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  useEffect(() => {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      const user = JSON.parse(userStr);
      if (user.role === "syncropos") {
        router.replace("/dashboard/syncro/owners");
        return;
      }
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [selectedDate]);

  const fetchStats = async () => {
    try {
      const branchId = localStorage.getItem("currentBranchId") || "";
      const token = localStorage.getItem("token");
      const dateStr = selectedDate.toISOString();
      const res = await fetch(`${API}/dashboard/stats?date=${dateStr}${branchId ? `&branchId=${branchId}` : ""}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
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
              <Badge variant="outline" className="gap-1 opacity-0">
                <IconTrendingUp className="size-3 text-muted-foreground" />
                +0%
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 flex gap-2 font-medium">
              Actividad del negocio
            </div>
            <div className="text-muted-foreground">
              Ingresos brutos acumulados
            </div>
          </CardFooter>
        </Card>

        <Card className="@container/card bg-gradient-to-t from-primary/5 to-card shadow-xs">
          <CardHeader>
            <CardDescription>Ventas (Órdenes)</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {stats?.salesCount}
            </CardTitle>
            <CardAction>
              <IconShoppingCart size={20} className="text-foreground/30" />
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <div className={cn(
              "size-2 rounded-full",
              stats?.hasActiveShift ? "bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.6)]" : "bg-[#79716b]/40"
            )} />
            <h2 className="text-sm font-bold uppercase tracking-tight text-white">
              Ventas del Día
            </h2>
          </div>

          {/* Reusable Style Popover Calendar Date Picker */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-[260px] justify-start text-left font-semibold h-9 border-[#79716b]/20 bg-card hover:bg-muted/50 text-white text-xs rounded-xl shadow-xs gap-2"
                )}
              >
                <IconCalendar size={15} className="text-primary" />
                {selectedDate ? (
                  format(selectedDate, "eeee, dd 'de' MMMM", { locale: es })
                ) : (
                  <span>Seleccionar Día</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 border-[#79716b]/20 bg-card rounded-xl overflow-hidden shadow-xl" align="end">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                initialFocus
                className="bg-card text-white font-sans"
              />
            </PopoverContent>
          </Popover>
        </div>
        <RecentSalesTable sales={stats?.recentSales || []} />
      </div>
    </div>
  );
}
