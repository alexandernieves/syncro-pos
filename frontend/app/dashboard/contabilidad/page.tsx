"use client";

import React, { useState, useEffect } from "react";
import { 
  Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription, CardAction 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  IconPlus, IconReceipt, IconReportAnalytics, IconArrowRight, IconLoader2, IconDotsVertical, IconFilter, IconCash, IconArrowUpRight, IconArrowDownLeft, IconDeviceDesktop, IconPackage, IconUserCog, IconDatabase, IconTrendingUp, IconTrendingDown, IconCheck
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
import { ChartBarAccounting } from "@/components/chart-bar-accounting";
import { ChartRadialAccounting } from "@/components/chart-radial-accounting";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000";

type AccountingEntry = {
  id: string;
  description: string;
  amount: number;
  type: "INCOME" | "EXPENSE";
  category: string;
  origin: "POS" | "INVENTARIO" | "MANUAL" | "SISTEMA";
  createdAt: string;
};

const originConfig: Record<string, { label: string; icon: any; color: string }> = {
    POS: { label: "Punto de Venta", icon: IconDeviceDesktop, color: "text-blue-600" },
    INVENTARIO: { label: "Inventario", icon: IconPackage, color: "text-amber-600" },
    MANUAL: { label: "Manual", icon: IconUserCog, color: "text-purple-600" },
    SISTEMA: { label: "Sistema", icon: IconDatabase, color: "text-emerald-600" },
};

export default function AccountingPage() {
  const [entries, setEntries] = useState<AccountingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
      description: "",
      type: "INCOME",
      amount: "",
      category: "GENERAL",
      origin: "MANUAL"
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const res = await fetch(`${API}/accounting`);
      if (res.ok) {
        // We ensure all items have an origin for the UI
        const data = await res.json();
        setEntries(data.map((item: any) => ({ ...item, origin: item.origin || "MANUAL" })));
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
          const res = await fetch(`${API}/accounting`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  ...formData,
                  amount: parseFloat(formData.amount)
              })
          });

          if (res.ok) {
              toast.success("Movimiento registrado correctamente");
              setIsModalOpen(false);
              setFormData({ description: "", type: "INCOME", amount: "", category: "GENERAL" , origin: "MANUAL" });
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
        id: "select",
        header: ({ table }) => (
          <div className="flex items-center justify-center w-8">
            <Checkbox
              checked={
                table.getIsAllPageRowsSelected() ||
                (table.getIsSomePageRowsSelected() && "indeterminate")
              }
              onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
              aria-label="Select all"
            />
          </div>
        ),
        cell: ({ row }) => (
          <div className="flex items-center justify-center w-8">
            <Checkbox
              checked={row.getIsSelected()}
              onCheckedChange={(value) => row.toggleSelected(!!value)}
              aria-label="Select row"
            />
          </div>
        ),
        enableSorting: false,
        enableHiding: false,
    },
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
          const Icon = config.icon;
          return (
            <div className="flex items-center gap-3">
                <div className={`size-8 rounded-lg bg-muted/40 flex items-center justify-center ${config.color}`}>
                    <Icon size={16} />
                </div>
                <span className="text-sm font-semibold tracking-tight">{row.getValue("description")}</span>
            </div>
          )
      }
    },
    {
      accessorKey: "origin",
      header: "Origen",
      cell: ({ row }) => {
        const origin = row.getValue("origin") as string;
        const config = originConfig[origin] || originConfig.MANUAL;
        return (
            <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest px-1.5 h-6 opacity-70">
                {config.label}
            </Badge>
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
                <Button
                    variant="ghost"
                    className="data-[state=open]:bg-muted text-muted-foreground flex size-8 p-0"
                    size="icon"
                >
                    <IconDotsVertical size={16} />
                </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44 border-none shadow-2xl rounded-xl">
                <DropdownMenuItem className="text-xs gap-2"><IconReceipt size={14} /> Ver comprobante</DropdownMenuItem>
                <DropdownMenuItem className="text-xs gap-2"><IconReportAnalytics size={14} /> Auditoría de movimiento</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" className="text-xs gap-2">Eliminar registro</DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-6 py-4 md:gap-8 md:py-6 font-sans text-secondary-foreground">
      {/* Metrics Row - NEW PREMIUM PATTERN */}
      <div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card text-secondary-foreground">
          <Card className="@container/card shadow-sm border-none">
            <CardHeader>
              <CardDescription className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Ingresos Totales</CardDescription>
              <CardTitle className="text-2xl font-bold tabular-nums @[250px]/card:text-3xl text-emerald-600">
                $45,678.00
              </CardTitle>
              <CardAction>
                <Badge variant="outline" className="gap-1 border-emerald-500/20 text-emerald-600 bg-emerald-500/5">
                  <IconTrendingUp size={12} />
                  +12.5%
                </Badge>
              </CardAction>
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1 text-[10px] pb-5">
              <div className="line-clamp-1 flex gap-2 font-bold text-muted-foreground uppercase tracking-tight">
                Flujo positivo mensual <IconTrendingUp className="size-3 text-emerald-500" />
              </div>
              <div className="text-muted-foreground/60 font-medium italic">
                Rendimiento superior al mes anterior
              </div>
            </CardFooter>
          </Card>

          <Card className="@container/card shadow-sm border-none">
            <CardHeader>
              <CardDescription className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Gastos Operativos</CardDescription>
              <CardTitle className="text-2xl font-bold tabular-nums @[250px]/card:text-3xl text-rose-600">
                $12,234.00
              </CardTitle>
              <CardAction>
                <Badge variant="outline" className="gap-1 border-rose-500/20 text-rose-600 bg-rose-500/5">
                  <IconTrendingDown size={12} />
                  -8.2%
                </Badge>
              </CardAction>
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1 text-[10px] pb-5">
              <div className="line-clamp-1 flex gap-2 font-bold text-muted-foreground uppercase tracking-tight">
                Reducción de costos <IconTrendingDown className="size-3 text-rose-500" />
              </div>
              <div className="text-muted-foreground/60 font-medium italic">
                Optimización de egresos en inventario
              </div>
            </CardFooter>
          </Card>

          <Card className="@container/card shadow-sm border-none">
            <CardHeader>
              <CardDescription className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Balance Neto</CardDescription>
              <CardTitle className="text-2xl font-bold tabular-nums @[250px]/card:text-3xl text-primary font-black">
                $33,444.00
              </CardTitle>
              <CardAction>
                <Badge variant="outline" className="gap-1 border-primary/20 text-primary bg-primary/5">
                  <IconTrendingUp size={12} />
                  Saludable
                </Badge>
              </CardAction>
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1 text-[10px] pb-5">
              <div className="line-clamp-1 flex gap-2 font-bold text-muted-foreground uppercase tracking-tight">
                Margen operativo sólido <IconCheck className="size-3 text-primary" />
              </div>
              <div className="text-muted-foreground/60 font-medium italic">
                Utilidad neta proyectada
              </div>
            </CardFooter>
          </Card>

          <Card className="@container/card shadow-sm border-none">
            <CardHeader>
              <CardDescription className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Proyección Trimestral</CardDescription>
              <CardTitle className="text-2xl font-bold tabular-nums @[250px]/card:text-3xl text-amber-600">
                8.4%
              </CardTitle>
              <CardAction>
                <Badge variant="outline" className="gap-1 border-amber-500/20 text-amber-600 bg-amber-500/5">
                  <IconTrendingUp size={12} />
                  +1.2%
                </Badge>
              </CardAction>
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1 text-[10px] pb-5">
              <div className="line-clamp-1 flex gap-2 font-bold text-muted-foreground uppercase tracking-tight">
                Crecimiento sostenido <IconTrendingUp className="size-3 text-amber-500" />
              </div>
              <div className="text-muted-foreground/60 font-medium italic">
                Dentro de las metas corporativas
              </div>
            </CardFooter>
          </Card>
      </div>

      {/* Chart Section - Main Area Chart Full Width */}
      <div className="px-4 lg:px-6">
        <ChartAreaInteractive />
      </div>

      {/* Diversified Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 px-4 lg:px-6">
          <ChartBarAccounting />
          <ChartRadialAccounting />
      </div>

      {/* Tabs Layout with Table */}
      <Tabs defaultValue="movimientos" className="w-full flex flex-col gap-6">
        <div className="flex items-center justify-between px-4 lg:px-6">
          <TabsList className="**:data-[slot=badge]:bg-muted-foreground/30 **:data-[slot=badge]:size-5 **:data-[slot=badge]:rounded-full **:data-[slot=badge]:px-1">
            <TabsTrigger value="movimientos">Registro Maestro</TabsTrigger>
            <TabsTrigger value="manual">Entradas Manuales</TabsTrigger>
            <TabsTrigger value="analisis">Libro Mayor <Badge variant="secondary" className="ml-2">3</Badge></TabsTrigger>
          </TabsList>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2 h-9 shadow-sm">
                <IconFilter size={16} /> Filtros Rápidos
            </Button>
            <Button size="sm" onClick={() => setIsModalOpen(true)} className="gap-2 h-9 shadow-sm font-medium">
                <IconPlus size={16} />
                <span className="hidden lg:inline">Nuevo Registro Manual</span>
                <span className="lg:hidden">Nuevo</span>
            </Button>
          </div>
        </div>

        <TabsContent value="movimientos" className="px-4 lg:px-6 space-y-4">
            <div className="flex flex-col gap-1 mb-2">
                <h2 className="text-xl font-bold tracking-tight">Libro Diario de Control</h2>
                <p className="text-sm text-muted-foreground font-medium">Centralización de toda actividad transaccional y operativa del sistema.</p>
            </div>
            <div className="overflow-hidden">
                {loading ? (
                    <Skeleton className="h-[450px] w-full rounded-xl" />
                ) : (
                    <DataTable 
                        columns={columns} 
                        data={entries} 
                        filterColumn="description" 
                        filterPlaceholder="Buscar por concepto o ID..." 
                    />
                )}
            </div>
        </TabsContent>

        <TabsContent value="manual" className="px-4 lg:px-6">
            <div className="aspect-video w-full flex-1 rounded-2xl border border-dashed flex items-center justify-center text-muted-foreground text-sm italic bg-muted/20">
                Filtro especializado para movimientos financieros manuales...
            </div>
        </TabsContent>
      </Tabs>

      {/* Modal - Syncro Style */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="sm:max-w-md font-sans p-0 overflow-hidden border shadow-2xl rounded-2xl">
              <DialogHeader className="p-6 bg-muted/20 border-b">
                  <DialogTitle className="text-xl font-bold italic font-black uppercase tracking-tight">Registro Manual</DialogTitle>
                  <DialogDescription className="text-sm font-medium">Asigne los fondos a la categoría correspondiente.</DialogDescription>
              </DialogHeader>
              <div className="p-6">
                <form onSubmit={handleSave} className="space-y-4">
                    <div className="space-y-1.5 min-h-[4.5rem]">
                        <Label htmlFor="desc" className="text-xs font-semibold uppercase opacity-50">Descripción / Glosa</Label>
                        <Input id="desc" placeholder="Concepto del movimiento" className="h-9 text-sm" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} required />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5 min-h-[4.5rem]">
                            <Label className="text-xs font-semibold uppercase opacity-50">Flujo</Label>
                            <Select value={formData.type} onValueChange={(val) => setFormData({...formData, type: val as any})}>
                                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                                <SelectContent><SelectItem value="INCOME">Ingreso (+)</SelectItem><SelectItem value="EXPENSE">Egreso (-)</SelectItem></SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5 min-h-[4.5rem]">
                            <Label className="text-xs font-semibold uppercase opacity-50">Monto (USD)</Label>
                            <Input type="number" step="0.01" className="h-9 text-sm font-bold" value={formData.amount} onChange={(e) => setFormData({...formData, amount: e.target.value})} required />
                        </div>
                    </div>
                </form>
              </div>
              <DialogFooter className="bg-muted/10 p-6 border-t gap-3">
                  <Button variant="ghost" size="sm" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                  <Button size="sm" onClick={handleSave} disabled={submitting} className="shadow-sm font-semibold">
                      {submitting ? <IconLoader2 className="animate-spin mr-2" size={16} /> : "Finalizar Registro"}
                  </Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>
    </div>
  );
}
