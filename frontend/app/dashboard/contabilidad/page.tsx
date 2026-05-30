"use client";

import React, { useState, useEffect } from "react";
import { API_URL } from "@/lib/constants"
import { 
  Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription, CardAction 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  IconPlus, IconReceipt, IconReportAnalytics, IconArrowRight, IconLoader2, IconDotsVertical, IconFilter, IconCash, IconArrowUpRight, IconArrowDownLeft, IconDeviceDesktop, IconPackage, IconUserCog, IconDatabase, IconTrendingUp, IconTrendingDown, IconCheck, IconTicket, IconShoppingCart, IconStack2, IconWallet, IconBuildingStore
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

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const branchId = localStorage.getItem("currentBranchId") || "";
      const token = localStorage.getItem("token");
      const headers = { 'Authorization': `Bearer ${token}` };

      const [entriesRes, statsRes] = await Promise.all([
        fetch(`${API}/accounting${branchId ? `?branchId=${branchId}` : ""}`, { headers }),
        fetch(`${API}/accounting/advanced-stats${branchId ? `?branchId=${branchId}` : ""}`, { headers })
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
        <div className="flex items-center justify-between px-4 lg:px-6">
          <TabsList>
            <TabsTrigger value="movimientos">Libro Diario</TabsTrigger>
            <TabsTrigger value="manual">Gestión de Gastos</TabsTrigger>
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
        
        <TabsContent value="manual" className="px-4 lg:px-6">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="border-dashed flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
                 <IconBuildingStore size={40} className="mb-4 opacity-20" />
                 <p className="text-sm font-medium underline cursor-pointer hover:text-primary transition-colors" onClick={() => setIsModalOpen(true)}> Haz clic aquí para registrar un gasto operativo </p>
                 <p className="text-[10px] mt-2 italic">(Alquiler, sueldos, servicios, etc.)</p>
              </Card>
           </div>
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
