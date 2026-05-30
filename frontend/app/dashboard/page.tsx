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
  IconCash, IconCreditCard, IconTarget, IconBrandWhatsapp, IconTrendingDown, IconCalendar,
  IconChevronLeft, IconChevronRight, IconChevronsLeft, IconChevronsRight
} from "@tabler/icons-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { useCurrency } from "@/context/CurrencyContext";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
        <div className="flex items-center justify-between px-4 py-3 text-xs text-muted-foreground bg-card/40 border border-[#79716b]/10 rounded-xl shadow-xs font-sans">
          <span>{sales.length} venta{sales.length !== 1 ? 's' : ''} en total</span>
          <div className="flex items-center gap-6">
            {/* Rows per page selector */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground">Filas por página</span>
              <Select
                value={`${pageSize}`}
                onValueChange={(value) => {
                  setPageSize(Number(value));
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger size="sm" className="w-16 h-8 bg-card border-[#79716b]/20 text-white font-medium text-xs rounded-lg" id="rows-per-page">
                  <SelectValue placeholder={pageSize} />
                </SelectTrigger>
                <SelectContent side="top" className="bg-[#121110] border-[#79716b]/20 text-white">
                  {[5, 10, 20, 50].map((size) => (
                    <SelectItem key={size} value={`${size}`} className="hover:bg-emerald-500/20 focus:bg-emerald-500/20 text-xs">
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Page info */}
            <span className="font-semibold text-white/90 text-xs">Página {currentPage} de {totalPages}</span>
            {/* Nav buttons */}
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                className="size-8 p-0 border-[#79716b]/20 bg-muted/20 hover:bg-muted/60 text-white disabled:opacity-30 rounded-lg transition-all"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                title="Primera página"
              >
                <IconChevronsLeft size={15} />
              </Button>
              <Button
                variant="outline"
                className="size-8 p-0 border-[#79716b]/20 bg-muted/20 hover:bg-muted/60 text-white disabled:opacity-30 rounded-lg transition-all"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                title="Anterior"
              >
                <IconChevronLeft size={15} />
              </Button>
              <Button
                variant="outline"
                className="size-8 p-0 border-[#79716b]/20 bg-muted/20 hover:bg-muted/60 text-white disabled:opacity-30 rounded-lg transition-all"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                title="Siguiente"
              >
                <IconChevronRight size={15} />
              </Button>
              <Button
                variant="outline"
                className="size-8 p-0 border-[#79716b]/20 bg-muted/20 hover:bg-muted/60 text-white disabled:opacity-30 rounded-lg transition-all"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                title="Última página"
              >
                <IconChevronsRight size={15} />
              </Button>
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
  const [salesDates, setSalesDates] = useState<string[]>([]);

  const salesDatesMap = React.useMemo(() => {
    return new Set(salesDates);
  }, [salesDates]);

  const isSalesDate = React.useCallback((date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const formatted = `${year}-${month}-${day}`;
    return salesDatesMap.has(formatted);
  }, [salesDatesMap]);

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
      const [resStats, resDates] = await Promise.all([
        fetch(`${API}/dashboard/stats?date=${dateStr}${branchId ? `&branchId=${branchId}` : ""}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }),
        fetch(`${API}/dashboard/sales-dates${branchId ? `?branchId=${branchId}` : ""}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
      ]);

      if (resStats.ok) {
        setStats(await resStats.json());
      }
      if (resDates.ok) {
        setSalesDates(await resDates.json());
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
      {(stats?.settings?.showSalesGoal || stats?.settings?.showNetMargin) && (
        <div className="px-4 lg:px-6">
          <div className="flex items-center gap-2 mb-4">
            <IconTarget size={18} className="text-blue-500" />
            <h2 className="text-sm font-bold uppercase tracking-tight text-blue-500">Syncro Growth Partner (Métricas Clave)</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Sales Goal */}
            {stats?.settings?.showSalesGoal && (
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
            )}

            {/* Net Margin & Real Profit */}
            {stats?.settings?.showNetMargin && (
              <Card className="bg-gradient-to-t from-primary/5 to-card border border-[#79716b]/10 shadow-xs">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center justify-between">
                    Margen y Ganancia Real (Neto)
                    <span className="text-xs font-mono text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full font-bold">
                      {stats?.netMarginPercentage !== undefined ? `${stats.netMarginPercentage.toFixed(1)}%` : "0.0%"}
                    </span>
                  </CardTitle>
                  <CardDescription className="text-xs">Deduciendo costo de mercancía y egresos del negocio</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase text-muted-foreground font-semibold">Valor Neto Estimado</span>
                    <span className="text-2xl font-semibold tabular-nums text-foreground tracking-tight">
                      {formatPrice(stats?.netProfit || 0)}
                    </span>
                    {currency === "USD" && (
                      <div className="text-xs text-muted-foreground font-medium mt-0.5">
                        Bs {((stats?.netProfit || 0) * exchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                      </div>
                    )}
                  </div>
                  {/* Subtle bar to visualize net margin ratio */}
                  <div className="h-1.5 w-full bg-emerald-500/10 rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                      style={{ width: `${Math.min(Math.max((stats?.netMarginPercentage || 0), 0), 100)}%` }}
                    />
                  </div>
                </CardContent>
              </Card>
            )}
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
                className="w-[260px] justify-start text-left font-semibold h-10 border border-[#79716b]/20 bg-card/40 hover:bg-card/75 backdrop-blur-md text-white text-xs rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.1)] hover:border-emerald-500/30 transition-all duration-300 gap-2.5 group active:scale-[0.98]"
              >
                <IconCalendar size={15} className="text-emerald-500 group-hover:scale-110 transition-transform duration-300" />
                <span className="flex-1 capitalize text-white/90">
                  {selectedDate ? (
                    format(selectedDate, "eeee, dd 'de' MMMM", { locale: es })
                  ) : (
                    "Seleccionar Día"
                  )}
                </span>
                <div className="size-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
              </Button>
            </PopoverTrigger>
            <PopoverContent 
              className="w-auto p-0 border border-white/5 bg-[#121110]/95 backdrop-blur-xl rounded-2xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] animate-in fade-in-50 zoom-in-95 duration-200" 
              align="end"
              sideOffset={8}
            >
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                initialFocus
                className="bg-transparent text-white font-sans p-4"
                modifiers={{
                  hasSales: isSalesDate
                }}
                modifiersClassNames={{
                  hasSales: "relative after:absolute after:bottom-[3px] after:left-1/2 after:-translate-x-1/2 after:size-1.5 after:rounded-full after:bg-emerald-500 after:shadow-[0_0_8px_rgba(16,185,129,0.8)] after:transition-all after:duration-200 aria-selected:after:bg-white aria-selected:after:shadow-[0_0_8px_rgba(255,255,255,0.8)] hover:after:scale-110"
                }}
              />
            </PopoverContent>
          </Popover>
        </div>
        <RecentSalesTable sales={stats?.recentSales || []} />
      </div>
    </div>
  );
}
