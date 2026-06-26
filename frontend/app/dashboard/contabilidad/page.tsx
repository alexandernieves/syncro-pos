"use client";

import React, { useState, useEffect } from "react";
import { API_URL } from "@/lib/constants"
import { 
  Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription, CardAction 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  IconPlus, IconReceipt, IconReportAnalytics, IconArrowRight, IconLoader2, IconDotsVertical, IconFilter, IconCash, IconArrowUpRight, IconArrowDownLeft, IconDeviceDesktop, IconPackage, IconUserCog, IconDatabase, IconTrendingUp, IconTrendingDown, IconCheck, IconTicket, IconShoppingCart, IconStack2, IconWallet, IconBuildingStore, IconPrinter, IconCalendar
} from "@tabler/icons-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { 
  Tabs, TabsContent, TabsList, TabsTrigger 
} from "@/components/ui/tabs";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "./data-table";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { ChartAreaInteractive } from "@/components/chart-area-interactive";

const API = API_URL;

const categoryExplanations: Record<string, string> = {
  OPERATIVO: "Gastos del día a día del negocio: papelería, mantenimiento, limpieza, suministros, etc.",
  SALARIO: "Sueldos pagados a tus empleados. No incluye tu propio retiro como dueño.",
  MARKETING: "Lo que gastaste en publicidad, redes sociales, volantes o promociones.",
  SERVICIOS: "Pagos de servicios: luz, agua, internet, teléfono, alquiler del local.",
  OTROS: "Gastos varios que no encajan en las otras categorías pero que registraste manualmente.",
};

type AdvancedStats = {
  revenue: {
    totalSales: number;
    totalNetSales: number;
    totalTickets: number;
    ticketPromedio: number;
    upt: number;
  };
  profitability: {
    cogs: number;
    grossMargin: number;
    grossMarginPercentage: number;
    operatingExpenses: number;
    netProfit: number;
    netMarginPercentage: number;
  };
  inventory: {
    totalValue: number;
  };
  payments: Record<string, number>;
  trend: any[];
};

type AccountingEntry = {
  id: string;
  description: string;
  amount: number;
  type: "INCOME" | "EXPENSE";
  category: string;
  origin: "POS" | "INVENTARIO" | "MANUAL" | "SISTEMA";
  createdAt: string;
  branch?: { name: string };
};

const originConfig: Record<string, { label: string; icon: any; color: string }> = {
    POS: { label: "Punto de Venta", icon: IconDeviceDesktop, color: "text-blue-600" },
    INVENTARIO: { label: "Inventario", icon: IconPackage, color: "text-amber-600" },
    MANUAL: { label: "Manual", icon: IconUserCog, color: "text-purple-600" },
    SISTEMA: { label: "Sistema", icon: IconDatabase, color: "text-emerald-600" },
};

export default function AccountingPage() {
  const [entries, setEntries] = useState<AccountingEntry[]>([]);
  const [stats, setStats] = useState<AdvancedStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state for manual entries
  const [formData, setFormData] = useState({
      description: "",
      type: "EXPENSE",
      amount: "",
      category: "OPERATIVO",
      origin: "MANUAL"
  });

  // State for period filters
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [period, setPeriod] = useState<"month" | "year" | "custom">("month");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [financialData, setFinancialData] = useState<any>(null);
  const [loadingFS, setLoadingFS] = useState<boolean>(false);

  const getDatesForPeriod = (p: string) => {
    const now = new Date();
    let start = "";
    let end = "";
    if (p === "month") {
      const y = now.getFullYear();
      const m = now.getMonth();
      start = `${y}-${String(m + 1).padStart(2, "0")}-01`;
      const lastDay = new Date(y, m + 1, 0).getDate();
      end = `${y}-${String(m + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    } else if (p === "year") {
      const y = now.getFullYear();
      start = `${y}-01-01`;
      end = `${y}-12-31`;
    }
    return { start, end };
  };

  const handlePeriodChange = (val: "month" | "year" | "custom") => {
    setPeriod(val);
    if (val !== "custom") {
      const { start, end } = getDatesForPeriod(val);
      setStartDate(start);
      setEndDate(end);
    }
  };

  // Mount effect to initialize states
  useEffect(() => {
    const initialBranchId = localStorage.getItem("currentBranchId") || "";
    setSelectedBranchId(initialBranchId);

    const { start, end } = getDatesForPeriod("month");
    setStartDate(start);
    setEndDate(end);
  }, []);

  // Update data and financial statements when filters change
  useEffect(() => {
    if (startDate && endDate) {
      fetchData();
      fetchFinancialStatements();
    }
  }, [selectedBranchId, startDate, endDate]);

  const fetchFinancialStatements = async () => {
    if (!startDate || !endDate) return;
    setLoadingFS(true);
    try {
      const token = localStorage.getItem("token");
      const headers = { 'Authorization': `Bearer ${token}` };
      
      let url = `${API}/accounting/financial-statements?startDate=${startDate}&endDate=${endDate}`;
      if (selectedBranchId && selectedBranchId !== "all") {
        url += `&branchId=${selectedBranchId}`;
      }
      
      const res = await fetch(url, { headers });
      if (res.ok) {
        const data = await res.json();
        setFinancialData(data);
      } else {
        toast.error("Error al cargar estados financieros");
      }
    } catch (error) {
      toast.error("Error de conexión al cargar estados financieros");
    } finally {
      setLoadingFS(false);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const headers = { 'Authorization': `Bearer ${token}` };
      
      const bParam = selectedBranchId && selectedBranchId !== "all" ? `?branchId=${selectedBranchId}` : "";
      
      const dateParams = `startDate=${startDate}&endDate=${endDate}`;
      const statsUrl = `${API}/accounting/advanced-stats${bParam ? `${bParam}&${dateParams}` : `?${dateParams}`}`;
      const entriesUrl = `${API}/accounting${bParam}`;

      const [entriesRes, statsRes] = await Promise.all([
        fetch(entriesUrl, { headers }),
        fetch(statsUrl, { headers })
      ]);
      
      if (entriesRes.ok) {
        const data = await entriesRes.json();
        setEntries(data.map((item: any) => ({ ...item, origin: item.origin || "MANUAL" })));
      }
      
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }
    } catch (error) {
      toast.error("Error al cargar datos contables");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!formData.description || !formData.amount) {
          toast.error("Por favor rellene todos los campos obligatorios");
          return;
      }

      setSubmitting(true);
      try {
          const token = localStorage.getItem("token");
          const branchId = localStorage.getItem("currentBranchId") || "";
          
          const res = await fetch(`${API}/accounting`, {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
              },
              body: JSON.stringify({
                  ...formData,
                  amount: parseFloat(formData.amount),
                  branchId
              })
          });

          if (res.ok) {
              toast.success("Movimiento registrado correctamente");
              setIsModalOpen(false);
              setFormData({ description: "", type: "EXPENSE", amount: "", category: "OPERATIVO" , origin: "MANUAL" });
              fetchData(); 
          } else {
              toast.error("Error al registrar movimiento");
          }
      } catch (err) {
          toast.error("Error de conexión");
      } finally {
          setSubmitting(false);
      }
  };

  const columns: ColumnDef<AccountingEntry>[] = [
    {
      accessorKey: "createdAt",
      header: "Fecha / Registro",
      cell: ({ row }) => {
        return (
          <div className="flex flex-col text-[11px] font-medium leading-tight text-muted/80">
            <span className="font-bold text-foreground/80">{new Date(row.getValue("createdAt")).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
            <span>{new Date(row.getValue("createdAt")).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        )
      }
    },
    {
      accessorKey: "description",
      header: "Descripción / Concepto",
      cell: ({ row }) => {
          const origin = row.original.origin || "MANUAL";
          const config = originConfig[origin];
          const Icon = config?.icon || IconDatabase;
          return (
            <div className="flex items-center gap-3">
                <div className={`size-8 rounded-lg bg-muted/40 flex items-center justify-center ${config?.color || 'text-primary'}`}>
                    <Icon size={16} />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold tracking-tight">{row.getValue("description")}</span>
                  <span className="text-[10px] text-muted-foreground uppercase">{row.original.category} {row.original.branch ? `• ${row.original.branch.name}` : ""}</span>
                </div>
            </div>
          )
      }
    },
    {
      accessorKey: "type",
      header: "Tipo",
      cell: ({ row }) => {
        const type = row.getValue("type") as string;
        return (
            <Badge variant="outline" className={`text-[10px] font-black tracking-widest px-1.5 h-6 gap-1.5 border-none ${type === 'INCOME' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'}`}>
                <div className={`size-1.5 rounded-full ${type === 'INCOME' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                {type === 'INCOME' ? 'INGRESO' : 'EGRESO'}
            </Badge>
        )
      }
    },
    {
      accessorKey: "amount",
      header: () => <div className="w-full text-right">Monto</div>,
      cell: ({ row }) => {
        const amount = parseFloat(row.getValue("amount"));
        const type = row.original.type;
        return (
            <div className={`text-right font-black text-sm tabular-nums ${type === 'INCOME' ? 'text-emerald-600' : 'text-rose-600'}`}>
                {type === 'INCOME' ? '+' : '-'}${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
        )
      }
    },
    {
        id: "actions",
        cell: () => (
          <div className="flex justify-end">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="data-[state=open]:bg-muted text-muted-foreground flex size-8 p-0" size="icon">
                    <IconDotsVertical size={16} />
                </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44 border-none shadow-2xl rounded-xl">
                <DropdownMenuItem className="text-xs gap-2"><IconReceipt size={14} /> Ver comprobante</DropdownMenuItem>
                <DropdownMenuItem className="text-xs gap-2"><IconReportAnalytics size={14} /> Auditoría</DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
    },
  ];

  if (loading && !stats) {
    return (
      <div className="flex flex-col gap-6 py-4 md:gap-8 md:py-6 animate-pulse">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 px-6">
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
        <div className="px-6">
          <Skeleton className="h-[400px] w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 py-4 md:gap-8 md:py-6 font-sans text-secondary-foreground">
      
      {/* Print Styles */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * {
            visibility: hidden;
          }
          .print-report, .print-report * {
            visibility: visible;
          }
          .print-report {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white !important;
            color: black !important;
            padding: 0;
            border: none !important;
            box-shadow: none !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}} />

      {/* Header with Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-4 lg:px-6 border-b pb-6 no-print">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <IconReportAnalytics className="text-primary" size={24} />
            Contabilidad y Finanzas
          </h1>
          <p className="text-sm text-muted-foreground">
            Visualiza el balance general, estado de resultados y flujos de caja de tu negocio.
          </p>
        </div>
        
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">

          {/* Period Selector */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <IconCalendar size={12} /> Período
            </span>
            <Select value={period} onValueChange={(val: any) => handlePeriodChange(val)}>
              <SelectTrigger className="w-[150px] h-9 rounded-xl">
                <SelectValue placeholder="Seleccionar período" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="month">Este Mes</SelectItem>
                <SelectItem value="year">Este Año</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Custom Date Inputs */}
          {period === "custom" && (
            <>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Desde</span>
                <Input 
                  type="date" 
                  value={startDate} 
                  onChange={(e) => setStartDate(e.target.value)} 
                  className="h-9 w-[140px] rounded-xl text-xs"
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Hasta</span>
                <Input 
                  type="date" 
                  value={endDate} 
                  onChange={(e) => setEndDate(e.target.value)} 
                  className="h-9 w-[140px] rounded-xl text-xs"
                />
              </div>
            </>
          )}
        </div>
      </div>
      
      {/* 💰 MÉTRICAS CLAVE (Modo CEO) */}
      <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
          
          {/* 1. VENTAS TOTALES */}
          <Card className="@container/card bg-gradient-to-t from-primary/5 to-card shadow-xs">
            <CardHeader>
              <CardDescription>Ventas Brutas</CardDescription>
              <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl text-emerald-600">
                ${(stats?.revenue.totalSales || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </CardTitle>
              <CardAction>
                <Badge variant="outline" className="gap-1 border-emerald-500/20 text-emerald-600 bg-emerald-500/5">
                  <IconCash size={12} /> Ventas
                </Badge>
              </CardAction>
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1.5 text-sm">
               <div className="line-clamp-1 flex gap-2 font-medium">
                 Total de {stats?.revenue.totalTickets || 0} transacciones
               </div>
               <div className="text-muted-foreground">
                 Registradas exitosamente
               </div>
            </CardFooter>
          </Card>

          {/* 2. MARGEN BRUTO */}
          <Card className="@container/card bg-gradient-to-t from-primary/5 to-card shadow-xs">
            <CardHeader>
              <CardDescription>Margen Bruto (Utilidad)</CardDescription>
              <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl text-blue-600">
                ${(stats?.profitability.grossMargin || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </CardTitle>
              <CardAction>
                <Badge variant="outline" className="gap-1 border-blue-500/20 text-blue-600 bg-blue-500/5">
                  <IconTrendingUp size={12} /> Rentabilidad
                </Badge>
              </CardAction>
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1.5 text-sm">
               <div className="line-clamp-1 flex gap-2 font-medium text-blue-600">
                 {(stats?.profitability.grossMarginPercentage || 0).toFixed(1)}% de rendimiento
               </div>
               <div className="text-muted-foreground">
                 Beneficio por producto
               </div>
            </CardFooter>
          </Card>

          {/* 3. TICKET PROMEDIO / UPT */}
          <Card className="@container/card bg-gradient-to-t from-primary/5 to-card shadow-xs">
            <CardHeader>
              <CardDescription>Ticket Promedio</CardDescription>
              <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl text-purple-600">
                ${(stats?.revenue.ticketPromedio || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </CardTitle>
              <CardAction>
                <Badge variant="outline" className="gap-1 border-purple-500/20 text-purple-600 bg-purple-500/5">
                  <IconTicket size={12} /> Eficacia
                </Badge>
              </CardAction>
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1.5 text-sm">
               <div className="line-clamp-1 flex gap-2 font-medium">
                 {(stats?.revenue.upt || 0).toFixed(1)} productos por compra
               </div>
               <div className="text-muted-foreground">
                 Métrica UPT actual
               </div>
            </CardFooter>
          </Card>

          {/* 4. INVENTARIO VALORIZADO */}
          <Card className="@container/card bg-gradient-to-t from-primary/5 to-card shadow-xs">
            <CardHeader>
              <CardDescription>Valor de Inventario (Costo)</CardDescription>
              <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl text-amber-600">
                ${(stats?.inventory.totalValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </CardTitle>
              <CardAction>
                <Badge variant="outline" className="gap-1 border-amber-500/20 text-amber-600 bg-amber-500/5">
                  <IconStack2 size={12} /> Patrimonio
                </Badge>
              </CardAction>
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1.5 text-sm">
               <div className="line-clamp-1 flex gap-2 font-medium">
                 Inversión en mercancía
               </div>
               <div className="text-muted-foreground">
                 Costo total acumulado
               </div>
            </CardFooter>
          </Card>
      </div>

      {/* 🚀 MARGEN NETO Y SALUD OPERATIVA */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 px-4 lg:px-6">
          
          {/* Main Chart: Sales Trend */}
          <div className="lg:col-span-2">
             <ChartAreaInteractive data={stats?.trend || []} />
          </div>

          {/* Margen Operativo & Cash Flow */}
          <div className="flex flex-col gap-6">
             <Card className="border-none shadow-sm bg-primary/5">
                <CardHeader className="pb-2 text-center">
                   <CardDescription className="text-[10px] font-black uppercase tracking-widest text-primary">Ganancia Neta Final</CardDescription>
                   <CardTitle className="text-4xl font-black text-primary">${(stats?.profitability.netProfit || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</CardTitle>
                </CardHeader>
                <CardContent className="pb-6">
                   <div className="space-y-4">
                      <div className="flex justify-between items-center text-xs">
                         <span className="text-muted-foreground font-medium">Margen Bruto</span>
                         <span className="font-bold text-emerald-600">+${(stats?.profitability.grossMargin || 0).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                         <span className="text-muted-foreground font-medium">Gastos Operativos</span>
                         <span className="font-bold text-rose-600">-${(stats?.profitability.operatingExpenses || 0).toLocaleString()}</span>
                      </div>
                      <div className="h-px bg-primary/10 w-full" />
                      <div className="flex justify-between items-center text-xs font-black">
                         <span>SALUD DEL NEGOCIO</span>
                         <Badge className={(stats?.profitability.netProfit || 0) > 0 ? "bg-emerald-500" : "bg-rose-500"}>
                           {(stats?.profitability.netMarginPercentage || 0).toFixed(1)}% ROI
                         </Badge>
                      </div>
                   </div>
                </CardContent>
             </Card>

             <Card className="border-none shadow-sm">
                <CardHeader className="pb-2">
                   <div className="flex items-center gap-2">
                     <IconWallet className="text-muted-foreground" size={18} />
                     <CardTitle className="text-sm">Métodos de Cobro</CardTitle>
                   </div>
                </CardHeader>
                <CardContent>
                   <div className="space-y-2">
                      {Object.entries(stats?.payments || {}).map(([method, amount]: any) => (
                        <div key={method} className="flex justify-between items-center text-[11px]">
                           <span className="font-medium text-muted-foreground uppercase">{method}</span>
                           <span className="font-bold tabular-nums">${amount.toLocaleString()}</span>
                        </div>
                      ))}
                      {Object.keys(stats?.payments || {}).length === 0 && (
                        <p className="text-center text-[10px] text-muted-foreground italic">No hay pagos registrados</p>
                      )}
                   </div>
                </CardContent>
             </Card>
          </div>
      </div>

      {/* 🏆 TOP PRODUCTOS RENTABLES */}
      <div className="px-4 lg:px-6">
        <Card className="border-none shadow-sm overflow-hidden">
          <CardHeader className="bg-muted/10 pb-4">
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-lg font-bold">Top 5 Productos más Rentables</CardTitle>
                <CardDescription>Productos que dejan más utilidad neta al negocio</CardDescription>
              </div>
              <IconTrendingUp className="text-emerald-500" size={24} />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/30 text-[10px] uppercase font-black tracking-widest text-muted-foreground border-b">
                  <tr>
                    <th className="px-6 py-3">Producto</th>
                    <th className="px-6 py-3 text-center">Unid. Vendidas</th>
                    <th className="px-6 py-3 text-right">Utilidad Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(stats as any)?.topProducts?.map((p: any, i: number) => (
                    <tr key={i} className="hover:bg-muted/20 transition-colors">
                      <td className="px-6 py-4 font-semibold">{p.name}</td>
                      <td className="px-6 py-4 text-center font-medium opacity-70">{p.quantity}</td>
                      <td className="px-6 py-4 text-right font-black text-emerald-600">${p.profit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                  {(!stats || (stats as any).topProducts?.length === 0) && (
                    <tr>
                      <td colSpan={3} className="px-6 py-8 text-center text-muted-foreground italic">No hay datos de ventas disponibles</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs Layout with Table */}
      <Tabs defaultValue="movimientos" className="w-full flex flex-col gap-6">
        <div className="flex items-center justify-between px-4 lg:px-6 no-print">
          <TabsList>
            <TabsTrigger value="movimientos">Libro Diario</TabsTrigger>
            <TabsTrigger value="manual">Gestión de Gastos</TabsTrigger>
            <TabsTrigger value="estado-resultados">Estado de Resultados</TabsTrigger>
            <TabsTrigger value="balance-general">Balance General</TabsTrigger>
          </TabsList>
          
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => setIsModalOpen(true)} className="gap-2 h-9 shadow-sm font-medium">
                <IconPlus size={16} />
                <span className="hidden lg:inline">Registrar Gasto / Ingreso</span>
                <span className="lg:hidden">Nuevo</span>
            </Button>
          </div>
        </div>

        <TabsContent value="movimientos" className="px-4 lg:px-6 space-y-4">
            <div className="flex flex-col gap-1 mb-2">
                <h2 className="text-xl font-bold tracking-tight">Transacciones Maestras</h2>
                <p className="text-sm text-muted-foreground font-medium">Auditoría completa de toda la actividad financiera del sistema.</p>
            </div>
            <div className="overflow-hidden">
                <DataTable 
                    columns={columns} 
                    data={entries} 
                    filterColumn="description" 
                    filterPlaceholder="Buscar por concepto o ID..." 
                />
            </div>
        </TabsContent>
        
        <TabsContent value="manual" className="px-4 lg:px-6 no-print">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="border-dashed flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
                 <IconBuildingStore size={40} className="mb-4 opacity-20" />
                 <p className="text-sm font-medium underline cursor-pointer hover:text-primary transition-colors" onClick={() => setIsModalOpen(true)}> Haz clic aquí para registrar un gasto operativo </p>
                 <p className="text-[10px] mt-2 italic">(Alquiler, sueldos, servicios, etc.)</p>
              </Card>
           </div>
        </TabsContent>

        <TabsContent value="estado-resultados" className="px-4 lg:px-6">
          <Card className="border-none shadow-sm rounded-2xl bg-card p-6 print-report">
            {/* Report Header */}
            <div className="flex flex-col items-center text-center pb-6 border-b mb-6">
              <h2 className="text-xl font-bold uppercase tracking-wide">Estado de Resultados</h2>
              <p className="text-sm font-semibold text-primary mt-1">
                {financialData?.branchName || "Consolidado - Todas las Sucursales"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Período: {financialData?.period ? `${new Date(financialData.period.from + 'T00:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })} al ${new Date(financialData.period.to + 'T00:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}` : ""}
              </p>
              <div className="no-print mt-4">
                <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-2 rounded-xl">
                  <IconPrinter size={16} /> Exportar PDF / Imprimir
                </Button>
              </div>
            </div>

            {/* Statement Body */}
            {loadingFS ? (
              <div className="py-20 flex flex-col items-center justify-center gap-3">
                <IconLoader2 className="animate-spin text-primary" size={32} />
                <span className="text-sm text-muted-foreground font-medium">Generando estado financiero...</span>
              </div>
            ) : !financialData ? (
              <div className="py-20 text-center text-muted-foreground italic">No hay datos para el período seleccionado.</div>
            ) : (
              <div className="space-y-6 max-w-3xl mx-auto text-sm">
                
                {/* 1. INGRESOS */}
                <div>
                  <h3 className="font-bold border-b pb-1 text-xs uppercase tracking-wider text-muted-foreground">Ingresos</h3>
                  <div className="mt-3 space-y-2">
                    <div className="flex justify-between items-start py-1.5 border-b border-muted/10">
                      <div className="flex flex-col">
                        <span className="font-semibold text-foreground">Total de Ventas</span>
                        <span className="text-[11px] text-muted-foreground">Dinero recibido de todos los clientes por las ventas realizadas en el período.</span>
                      </div>
                      <span className="font-semibold text-foreground">${(financialData.incomeStatement.grossRevenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    {/* Only show tax deduction if there actually ARE taxes */}
                    {(financialData.incomeStatement.salesTax || 0) > 0 && (
                      <div className="flex justify-between items-start py-1.5 text-rose-500 border-b border-muted/10">
                        <div className="flex flex-col">
                          <span>(-) Impuestos Cobrados (IVA / IGTF)</span>
                          <span className="text-[11px] text-rose-400/80">Impuestos que cobraste al cliente y que debes entregar al fisco — no son ingresos tuyos.</span>
                        </div>
                        <span className="font-semibold">-${(financialData.incomeStatement.salesTax || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center py-2 border-t font-bold text-base text-emerald-600 bg-emerald-500/5 px-2 rounded-lg">
                      <div className="flex flex-col">
                        <span>INGRESOS NETOS</span>
                        <span className="text-[10px] text-emerald-600/70 font-medium">
                          {(financialData.incomeStatement.salesTax || 0) > 0
                            ? "Dinero real del negocio después de separar los impuestos cobrados."
                            : "Total de dinero que ingresó al negocio por ventas en este período."}
                        </span>
                      </div>
                      <span>${(financialData.incomeStatement.netRevenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </div>

                {/* 2. COSTO DE VENTAS */}
                <div>
                  <h3 className="font-bold border-b pb-1 text-xs uppercase tracking-wider text-muted-foreground">Costo de lo Vendido</h3>
                  <div className="mt-3 space-y-2">
                    <div className="flex justify-between items-start py-1.5 text-rose-500 border-b border-muted/10">
                      <div className="flex flex-col">
                        <span>(-) Costo de los Productos Vendidos</span>
                        <span className="text-[11px] text-rose-400/80">Lo que te costó comprar los productos que vendiste — precio de compra al proveedor.</span>
                      </div>
                      <span className="font-semibold">-${(financialData.incomeStatement.cogs || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-t font-bold text-base text-blue-600 bg-blue-500/5 px-2 rounded-lg">
                      <div className="flex flex-col">
                        <span>GANANCIA BRUTA</span>
                        <span className="text-[10px] text-blue-600/70 font-medium">Lo que te queda después de pagar lo que costaron los productos (Ventas - Costo de Compra).</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full dark:bg-blue-900/30 dark:text-blue-300">
                          Margen: {financialData.incomeStatement.grossMarginPct.toFixed(1)}%
                        </span>
                        <span>${(financialData.incomeStatement.grossProfit || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. GASTOS OPERATIVOS */}
                <div>
                  <h3 className="font-bold border-b pb-1 text-xs uppercase tracking-wider text-muted-foreground">Gastos del Negocio</h3>
                  <div className="mt-3 space-y-2">
                    {financialData.incomeStatement.operatingExpenses.byCategory.map((cat: any) => (
                      <div key={cat.category} className="flex justify-between items-start py-1.5 border-b border-muted/10">
                        <div className="flex flex-col">
                          <span className="capitalize font-semibold">{cat.category.toLowerCase()}</span>
                          <span className="text-[11px] text-muted-foreground">
                            {categoryExplanations[cat.category.toUpperCase()] || "Gastos varios registrados manualmente en esta categoría."}
                          </span>
                        </div>
                        <span className="text-rose-500 font-semibold">-${(cat.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                    ))}
                    {financialData.incomeStatement.operatingExpenses.byCategory.length === 0 && (
                      <div className="text-center py-4 text-xs text-muted-foreground italic">✓ No se registraron gastos en el período seleccionado</div>
                    )}
                    <div className="flex justify-between items-center py-2 border-t font-bold text-rose-600 bg-rose-500/5 px-2 rounded-lg">
                      <div className="flex flex-col">
                        <span>TOTAL GASTOS</span>
                        <span className="text-[10px] text-rose-600/70 font-medium">Suma de todos los gastos que registraste: alquiler, salarios de empleados, servicios, etc.</span>
                      </div>
                      <span>-${(financialData.incomeStatement.operatingExpenses.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </div>

                {/* 4. RESULTADO NETO */}
                <div className="pt-4">
                  <div className="flex justify-between items-center p-4 border border-primary/20 bg-primary/5 rounded-2xl shadow-sm">
                    <div className="flex flex-col gap-1">
                      <span className="text-lg font-black tracking-tight text-primary uppercase">
                        {(financialData.incomeStatement.netProfit || 0) >= 0 ? "✅ GANANCIA NETA" : "❌ PÉRDIDA NETA"}
                      </span>
                      <span className="text-xs text-muted-foreground font-medium">
                        Lo que realmente te quedó del negocio después de pagar productos y gastos. Es lo que puedes reinvertir o retirar.
                      </span>
                      <div className="flex items-center gap-3 mt-1 text-[11px] font-semibold">
                        <span className="text-emerald-600">Ventas: ${(financialData.incomeStatement.netRevenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        <span className="text-muted-foreground">−</span>
                        <span className="text-rose-500">Costo: ${(financialData.incomeStatement.cogs || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        <span className="text-muted-foreground">−</span>
                        <span className="text-rose-500">Gastos: ${(financialData.incomeStatement.operatingExpenses.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">Margen neto: {financialData.incomeStatement.netMarginPct.toFixed(1)}% de tus ventas</span>
                    </div>
                    <div className={`text-2xl font-black tabular-nums ${(financialData.incomeStatement.netProfit || 0) >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                      ${(financialData.incomeStatement.netProfit || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>

                {/* Metrics footnotes */}
                <div className="flex justify-between text-[11px] text-muted-foreground pt-4 border-t border-dashed">
                  <span>Transacciones procesadas: {financialData.incomeStatement.totalTickets}</span>
                  <span>Unidades vendidas: {financialData.incomeStatement.totalUnits}</span>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="balance-general" className="px-4 lg:px-6">
          <Card className="border-none shadow-sm rounded-2xl bg-card p-6 print-report">
            {/* Report Header */}
            <div className="flex flex-col items-center text-center pb-6 border-b mb-6">
              <h2 className="text-xl font-bold uppercase tracking-wide">Balance General</h2>
              <p className="text-sm font-semibold text-primary mt-1">
                {financialData?.branchName || "Consolidado - Todas las Sucursales"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Al: {financialData?.period ? `${new Date(financialData.period.to + 'T23:59:59').toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}` : ""}
              </p>
              
              {/* Balanced indicator */}
              {financialData && (
                <div className="mt-2.5">
                  {financialData.balanceSheet.isBalanced ? (
                    <Badge className="bg-emerald-500/10 text-emerald-600 border-none font-bold text-xs gap-1.5 px-3 py-1 rounded-full">
                      <IconCheck size={14} /> Ecuación Contable Balanceada
                    </Badge>
                  ) : (
                    <Badge className="bg-rose-500/10 text-rose-600 border-none font-bold text-xs gap-1.5 px-3 py-1 rounded-full animate-pulse">
                      ⚠️ Diferencia en Ecuación Contable: ${(Math.abs(financialData.balanceSheet.assets.totalAssets - financialData.balanceSheet.totalLiabilitiesAndEquity)).toFixed(2)}
                    </Badge>
                  )}
                </div>
              )}

              <div className="no-print mt-4">
                <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-2 rounded-xl">
                  <IconPrinter size={16} /> Exportar PDF / Imprimir
                </Button>
              </div>
            </div>

            {/* Statement Body */}
            {loadingFS ? (
              <div className="py-20 flex flex-col items-center justify-center gap-3">
                <IconLoader2 className="animate-spin text-primary" size={32} />
                <span className="text-sm text-muted-foreground font-medium">Generando balance general...</span>
              </div>
            ) : !financialData ? (
              <div className="py-20 text-center text-muted-foreground italic">No hay datos para el período seleccionado.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-sm">
                
                {/* ─── COLUMNA 1: ACTIVOS ─── */}
                <div className="space-y-6">
                  <div>
                    <h3 className="font-bold border-b pb-1 text-xs uppercase tracking-wider text-muted-foreground">Activos</h3>
                    
                    {/* Activos Corrientes */}
                    <div className="mt-4 space-y-3">
                      <h4 className="font-semibold text-xs text-primary/80 uppercase">Activos Corrientes</h4>
                      <div className="pl-3 space-y-2">
                        <div className="flex justify-between items-start py-1 border-b border-muted/30 pb-2">
                          <div className="flex flex-col">
                            <span className="font-semibold text-foreground">Efectivo en Caja (Ventas Cash)</span>
                            <span className="text-[11px] text-muted-foreground">Dinero físico disponible en caja por cobros de ventas en efectivo.</span>
                          </div>
                          <span className="font-medium text-foreground">${(financialData.balanceSheet.assets.current.cash || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between items-start py-1 border-b border-muted/30 pb-2">
                          <div className="flex flex-col">
                            <span className="font-semibold text-foreground">Cuentas por Cobrar (Créditos Clientes)</span>
                            <span className="text-[11px] text-muted-foreground">Dinero pendiente que tus clientes le deben al negocio por compras a crédito.</span>
                          </div>
                          <span className="font-medium text-foreground">${(financialData.balanceSheet.assets.current.accountsReceivable || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between items-start py-1 border-b border-muted/30 pb-2">
                          <div className="flex flex-col">
                            <span className="font-semibold text-foreground">Préstamos por Cobrar</span>
                            <span className="text-[11px] text-muted-foreground">Saldos pendientes de financiamientos o préstamos activos otorgados a clientes.</span>
                          </div>
                          <span className="font-medium text-foreground">${(financialData.balanceSheet.assets.current.loansReceivable || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between items-start py-1 border-b border-muted/30 pb-2">
                          <div className="flex flex-col">
                            <span className="font-semibold text-foreground">Inventario de Productos (a Costo)</span>
                            <span className="text-[11px] text-muted-foreground">El valor total de tus productos en stock calculados al costo de compra original.</span>
                          </div>
                          <span className="font-medium text-foreground">${(financialData.balanceSheet.assets.current.inventory || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center font-semibold bg-muted/20 p-2 rounded-lg text-xs mt-2 pl-3">
                        <div className="flex flex-col">
                          <span>TOTAL ACTIVOS CORRIENTES</span>
                          <span className="text-[10px] text-muted-foreground font-medium">Bienes de valor y dinero físico convertibles a efectivo en un corto plazo.</span>
                        </div>
                        <span>${(financialData.balanceSheet.assets.current.totalCurrent || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>

                    {/* Activos No Corrientes */}
                    <div className="mt-6 space-y-3">
                      <h4 className="font-semibold text-xs text-primary/80 uppercase">Activos No Corrientes</h4>
                      <div className="pl-3 space-y-2">
                        <div className="flex justify-between items-start py-1 border-b border-muted/30 pb-2">
                          <div className="flex flex-col">
                            <span className="font-semibold text-foreground">Propiedades, Planta y Equipo</span>
                            <span className="text-[11px] text-muted-foreground">Bienes fijos tangibles del negocio (local, mobiliario, vehículos, computadoras).</span>
                          </div>
                          <span className="font-medium text-foreground">${(financialData.balanceSheet.assets.nonCurrent.totalNonCurrent || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center font-semibold bg-muted/20 p-2 rounded-lg text-xs mt-2 pl-3">
                        <div className="flex flex-col">
                          <span>TOTAL ACTIVOS NO CORRIENTES</span>
                          <span className="text-[10px] text-muted-foreground font-medium">Activos permanentes que usa la empresa a largo plazo y no son para venta directa.</span>
                        </div>
                        <span>${(financialData.balanceSheet.assets.nonCurrent.totalNonCurrent || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  </div>

                  {/* TOTAL ACTIVOS */}
                  <div className="flex justify-between items-center p-3 font-bold text-base bg-emerald-500/5 text-emerald-600 border border-emerald-500/10 rounded-xl">
                    <div className="flex flex-col">
                      <span>TOTAL ACTIVOS</span>
                      <span className="text-[10px] text-emerald-600/70 font-medium">El valor de todo lo que tu negocio posee (Efectivo + Créditos + Inventario + Equipos).</span>
                    </div>
                    <span>${(financialData.balanceSheet.assets.totalAssets || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>

                {/* ─── COLUMNA 2: PASIVOS Y PATRIMONIO ─── */}
                <div className="space-y-6 flex flex-col justify-between">
                  <div className="space-y-6">
                    {/* Pasivos */}
                    <div>
                      <h3 className="font-bold border-b pb-1 text-xs uppercase tracking-wider text-muted-foreground">Pasivos</h3>
                      
                      {/* Pasivos Corrientes */}
                      <div className="mt-4 space-y-3">
                        <h4 className="font-semibold text-xs text-primary/80 uppercase">Pasivos Corrientes</h4>
                        <div className="pl-3 space-y-2">
                          <div className="flex justify-between items-start py-1 border-b border-muted/30 pb-2">
                            <div className="flex flex-col">
                              <span className="font-semibold text-foreground">Cuentas por Pagar (Proveedores)</span>
                              <span className="text-[11px] text-muted-foreground">Facturas de compras de mercancía que le debes a tus proveedores.</span>
                            </div>
                            <span className="font-medium text-foreground">${(financialData.balanceSheet.liabilities.current.accountsPayable || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                          </div>
                        </div>
                        <div className="flex justify-between items-center font-semibold bg-muted/20 p-2 rounded-lg text-xs mt-2 pl-3">
                          <div className="flex flex-col">
                            <span>TOTAL PASIVOS CORRIENTES</span>
                            <span className="text-[10px] text-muted-foreground font-medium">Deudas u obligaciones financieras que el negocio debe pagar en un corto plazo.</span>
                          </div>
                          <span>${(financialData.balanceSheet.liabilities.current.totalCurrent || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                      </div>
                    </div>

                    {/* Patrimonio */}
                    <div>
                      <h3 className="font-bold border-b pb-1 text-xs uppercase tracking-wider text-muted-foreground">Patrimonio</h3>
                      
                      <div className="mt-4 space-y-3">
                        <div className="pl-3 space-y-2">
                          <div className="flex justify-between items-start py-1 border-b border-muted/30 pb-2">
                            <div className="flex flex-col">
                              <span className="font-semibold text-foreground">Utilidades Retenidas / Acumuladas</span>
                              <span className="text-[11px] text-muted-foreground">Ganancias del negocio acumuladas y reinvertidas históricamente (Activos - Pasivos).</span>
                            </div>
                            <span className="font-medium text-foreground">${(financialData.balanceSheet.equity.retainedEarnings || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                          </div>
                        </div>
                        <div className="flex justify-between items-center font-semibold bg-muted/20 p-2 rounded-lg text-xs mt-2 pl-3">
                          <div className="flex flex-col">
                            <span>TOTAL PATRIMONIO NETO</span>
                            <span className="text-[10px] text-muted-foreground font-medium">El valor neto real del negocio que pertenece directamente a los socios o dueños.</span>
                          </div>
                          <span>${(financialData.balanceSheet.equity.totalEquity || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* TOTAL PASIVOS Y PATRIMONIO */}
                  <div className="flex justify-between items-center p-3 font-bold text-base bg-blue-500/5 text-blue-600 border border-blue-500/10 rounded-xl">
                    <div className="flex flex-col">
                      <span>TOTAL PASIVOS Y PATRIMONIO</span>
                      <span className="text-[10px] text-blue-600/70 font-medium">Suma de las deudas del negocio y el patrimonio (debe igualar exactamente al Total Activos).</span>
                    </div>
                    <span>${(financialData.balanceSheet.totalLiabilitiesAndEquity || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>

              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal Manual Entry */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="sm:max-w-md font-sans p-0 overflow-hidden border shadow-2xl rounded-2xl">
              <DialogHeader className="p-6 bg-muted/20 border-b">
                  <DialogTitle className="text-xl font-bold font-black uppercase tracking-tight">Nuevo Registro Contable</DialogTitle>
                  <DialogDescription className="text-sm font-medium">Registra un movimiento manual fuera de ventas.</DialogDescription>
              </DialogHeader>
              <div className="p-6">
                <form onSubmit={handleSave} className="space-y-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="desc" className="text-xs font-semibold uppercase opacity-50">Descripción / Concepto</Label>
                        <Input id="desc" placeholder="Ej. Pago de Alquiler Abril" className="h-9 text-sm" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} required />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold uppercase opacity-50">Tipo</Label>
                            <Select value={formData.type} onValueChange={(val) => setFormData({...formData, type: val as any})}>
                                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                                <SelectContent><SelectItem value="EXPENSE">Egreso (-)</SelectItem><SelectItem value="INCOME">Ingreso (+)</SelectItem></SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold uppercase opacity-50">Monto (USD)</Label>
                            <Input type="number" step="0.01" className="h-9 text-sm font-bold" value={formData.amount} onChange={(e) => setFormData({...formData, amount: e.target.value})} required />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold uppercase opacity-50">Categoría</Label>
                        <Select value={formData.category} onValueChange={(val) => setFormData({...formData, category: val})}>
                            <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                            <SelectContent>
                               <SelectItem value="OPERATIVO">Gasto Operativo</SelectItem>
                               <SelectItem value="SALARIO">Sueldos / Salarios</SelectItem>
                               <SelectItem value="MARKETING">Marketing / Publicidad</SelectItem>
                               <SelectItem value="SERVICIOS">Servicios (Luz, Agua, Internet)</SelectItem>
                               <SelectItem value="OTROS">Otros</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </form>
              </div>
              <DialogFooter className="bg-muted/10 p-6 border-t gap-3">
                  <Button variant="ghost" size="sm" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                  <Button size="sm" onClick={handleSave} disabled={submitting} className="shadow-sm font-semibold">
                      {submitting ? <IconLoader2 className="animate-spin mr-2" size={16} /> : "Registrar Movimiento"}
                  </Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>
    </div>
  );
}
