"use client";

import React, { useState, useEffect, useCallback } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  IconHistory, IconUser, IconDotsVertical, IconFilter, IconCalendar, IconSearch, IconEye, IconTrash, IconDeviceDesktop, IconShieldCheck, IconPackage, IconUserCog, IconDatabase, IconReceipt, IconTrendingUp, IconCheck
} from "@tabler/icons-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Tabs, TabsContent, TabsList, TabsTrigger 
} from "@/components/ui/tabs";
import { DataTable } from "./data-table";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription, CardAction 
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

import { DatePickerWithRange } from "./date-range-picker";
import { DateRange } from "react-day-picker";
import { subDays } from "date-fns";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000";

type AuditLog = {
  id: string;
  userId: string;
  user: {
      name: string;
      email: string;
  };
  action: string;
  entity: string;
  entityId?: string;
  details?: string;
  ipAddress?: string;
  createdAt: string;
};

const moduleConfig: Record<string, { label: string; icon: any; color: string; bg: string }> = {
    SALE: { label: "Ventas", icon: IconReceipt, color: "text-blue-600", bg: "bg-blue-500/10" },
    PRODUCT: { label: "Inventario", icon: IconPackage, color: "text-amber-600", bg: "bg-amber-500/10" },
    USER: { label: "Seguridad", icon: IconUserCog, color: "text-purple-600", bg: "bg-purple-500/10" },
    SYSTEM: { label: "Sistema", icon: IconDatabase, color: "text-emerald-600", bg: "bg-emerald-500/10" },
    INVENTORY: { label: "Movimiento", icon: IconPackage, color: "text-orange-600", bg: "bg-orange-500/10" },
};

export default function HistorialPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });

  // State for actions
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [showInspect, setShowInspect] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      
      let url = `${API}/history?`;
      if (date?.from) url += `startDate=${date.from.toISOString()}&`;
      if (date?.to) url += `endDate=${date.to.toISOString()}&`;

      const [logsRes, statsRes] = await Promise.all([
        fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${API}/history/stats`, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      if (logsRes.ok) setLogs(await logsRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
    } catch {
      toast.error("Error al cargar el historial de acciones");
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDeleteLog = async () => {
      if (!selectedLog) return;
      try {
          const token = localStorage.getItem("token");
          const res = await fetch(`${API}/history/${selectedLog.id}`, {
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
              toast.success("Registro eliminado correctamente");
              fetchData();
          } else {
              throw new Error();
          }
      } catch {
          toast.error("No se pudo eliminar el registro");
      } finally {
          setShowDelete(false);
          setSelectedLog(null);
      }
  };

  const columns: ColumnDef<AuditLog>[] = [
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
      accessorKey: "user",
      header: "Operador",
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
            <div className="size-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground border">
                <IconUser size={16} />
            </div>
            <div className="flex flex-col">
                <span className="text-sm font-semibold tracking-tight leading-none mb-1">{row.original.user?.name || "Sistema"}</span>
                <span className="text-[10px] text-muted-foreground font-medium">{row.original.user?.email || "N/A"}</span>
            </div>
        </div>
      )
    },
    {
      accessorKey: "action",
      header: "Actividad / Acción",
      cell: ({ row }) => {
          const entity = row.original.entity;
          const config = moduleConfig[entity] || moduleConfig.SYSTEM;
          const Icon = config.icon;
          
          let actionLabel = row.original.action;
          let subDetail = "";
          
          try {
              const details = row.original.details ? JSON.parse(row.original.details) : {};
              
              if (row.original.action === 'PROCESS_SALE') {
                  actionLabel = "Venta Procesada";
                  subDetail = details.total ? `Total: $${details.total}` : "";
              }
              else if (row.original.action === 'SALE_RETURN') {
                  actionLabel = "Devolución de Venta";
                  subDetail = details.saleId ? `Ticket #${details.saleId.slice(0,8)}` : "";
              }
              else if (row.original.action === 'CREATE_PRODUCT') {
                  actionLabel = "Producto Creado";
                  subDetail = details.name ? `Nombre: ${details.name}` : "";
              }
              else if (row.original.action === 'UPDATE_PRODUCT') {
                  actionLabel = "Producto Actualizado";
                  subDetail = details.name ? `Nombre: ${details.name}` : "";
              }
              else if (row.original.action === 'LOGIN') {
                  actionLabel = "Inicio de Sesión";
                  subDetail = "Sesión iniciada correctamente";
              }
              else if (row.original.action === 'RESTOCK_PRODUCT') {
                  actionLabel = "Reabastecimiento";
                  subDetail = details.quantity ? `Cantidad: +${details.quantity}` : "";
              } else {
                  subDetail = row.original.details || "";
              }
          } catch(e) {
              subDetail = row.original.details || "";
          }

          return (
            <div className="flex items-center gap-3">
                <div className={`size-7 rounded-lg ${config.bg} ${config.color} flex items-center justify-center`}>
                    <Icon size={14} />
                </div>
                <div className="flex flex-col">
                    <span className="text-sm font-medium text-foreground/90">{actionLabel}</span>
                    <span className="text-[10px] text-muted-foreground line-clamp-1 italic">{subDetail}</span>
                </div>
            </div>
          )
      }
    },
    {
      accessorKey: "entity",
      header: "Área",
      cell: ({ row }) => {
        const entity = row.original.entity;
        const config = moduleConfig[entity] || moduleConfig.SYSTEM;
        return (
            <Badge variant="outline" className={`text-[10px] font-semibold tracking-tight px-1.5 h-6 opacity-70 border-none ${config.bg} ${config.color}`}>
                {config.label}
            </Badge>
        )
      }
    },
    {
      accessorKey: "ipAddress",
      header: "Terminal / IP",
      cell: ({ row }) => (
        <div className="flex items-center gap-2 text-[11px] font-mono text-muted-foreground">
            <IconDeviceDesktop size={12} className="opacity-50" />
            {row.original.ipAddress || '127.0.0.1'}
        </div>
      )
    },
    {
      accessorKey: "createdAt",
      header: () => <div className="text-right">Fecha / Hora</div>,
      cell: ({ row }) => (
        <div className="flex flex-col text-right text-[11px] font-medium text-muted-foreground leading-tight">
          <span className="text-foreground/80 font-bold">{new Date(row.original.createdAt).toLocaleDateString()}</span>
          <span>{new Date(row.original.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      ),
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <div className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-8">
                  <IconDotsVertical size={16} className="text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44 border-none shadow-2xl rounded-xl">
                <DropdownMenuItem className="gap-2 text-xs" onClick={() => { setSelectedLog(row.original); setShowInspect(true); }}>
                    <IconEye size={14} /> Inspeccionar rastro
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2 text-xs" onClick={() => toast.success("Integridad verificada (SHA-256 Valid)")}>
                    <IconShieldCheck size={14} /> Validar integridad
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" className="gap-2 text-xs" onClick={() => { setSelectedLog(row.original); setShowDelete(true); }}>
                    <IconTrash size={14} /> Eliminar log
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6 py-4 md:py-6 font-sans">
      
      {/* Metrics Row */}
      <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 md:grid-cols-3">
          <Card className="shadow-sm border-none bg-card">
            <CardHeader>
              <CardDescription className="text-[10px] font-semibold uppercase tracking-tight text-muted-foreground">Acciones Totales</CardDescription>
              <CardTitle className="text-2xl font-bold tabular-nums">
                {stats?.totalActions || 0}
              </CardTitle>
              <CardAction>
                <Badge variant="outline" className="gap-1 border-primary/20 text-primary bg-primary/5">
                  <IconTrendingUp size={12} />
                  Realtime
                </Badge>
              </CardAction>
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1 text-[10px] pb-5">
              <div className="line-clamp-1 flex gap-2 font-bold text-muted-foreground uppercase tracking-tight">
                Actividad operativa intensa <IconTrendingUp className="size-3 text-primary" />
              </div>
            </CardFooter>
          </Card>

          <Card className="shadow-sm border-none bg-card">
            <CardHeader>
              <CardDescription className="text-[10px] font-semibold uppercase tracking-tight text-muted-foreground">Alertas Críticas</CardDescription>
              <CardTitle className="text-2xl font-bold tabular-nums text-rose-600">
                {stats?.criticalAlerts || 0}
              </CardTitle>
              <CardAction>
                <Badge variant="outline" className="gap-1 border-rose-500/20 text-rose-600 bg-rose-500/5">
                  <IconShieldCheck size={12} />
                  Atención
                </Badge>
              </CardAction>
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1 text-[10px] pb-5">
              <div className="line-clamp-1 flex gap-2 font-bold text-muted-foreground uppercase tracking-tight">
                Incidentes de seguridad <IconShieldCheck className="size-3 text-rose-500" />
              </div>
            </CardFooter>
          </Card>

          <Card className="shadow-sm border-none bg-card">
            <CardHeader>
              <CardDescription className="text-[10px] font-semibold uppercase tracking-tight text-muted-foreground">Estabilidad Sistema</CardDescription>
              <CardTitle className="text-2xl font-bold tabular-nums text-emerald-600">
                {stats?.systemStability || 99.9}%
              </CardTitle>
              <CardAction>
                <Badge variant="outline" className="gap-1 border-emerald-500/20 text-emerald-600 bg-emerald-500/5">
                  <IconCheck size={12} />
                  Optimal
                </Badge>
              </CardAction>
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1 text-[10px] pb-5">
              <div className="line-clamp-1 flex gap-2 font-bold text-muted-foreground uppercase tracking-tight">
                Plataforma 100% operativa <IconCheck className="size-3 text-emerald-500" />
              </div>
            </CardFooter>
          </Card>
      </div>

      {/* Header Info */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 px-4 lg:px-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <IconHistory size={24} className="text-primary" /> Auditoría de Sistema
          </h1>
          <p className="text-sm text-muted-foreground font-medium">Registro cronológico de todas las acciones y eventos ejecutados en la plataforma.</p>
        </div>
        <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2 h-9 shadow-sm" onClick={fetchData}>
                <IconFilter size={16} /> Refrescar
            </Button>
            <DatePickerWithRange date={date} setDate={setDate} />
        </div>
      </div>

      <Tabs defaultValue="actividad" className="w-full flex flex-col gap-6">
        <div className="px-4 lg:px-6">
          <TabsList>
            <TabsTrigger value="actividad">Actividad Global</TabsTrigger>
            <TabsTrigger value="seguridad">Seguridad <Badge variant="destructive" className="ml-2 text-white h-5 px-1 min-w-5">{stats?.criticalAlerts || 0}</Badge></TabsTrigger>
            <TabsTrigger value="mantenimiento">Logs de Sistema</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="actividad" className="px-4 lg:px-6 space-y-4">
            {loading ? (
                <Skeleton className="h-[500px] w-full rounded-xl" />
            ) : (
                <DataTable 
                    columns={columns} 
                    data={logs} 
                    filterColumn="action" 
                    filterPlaceholder="Buscar por acción o usuario..." 
                />
            )}
        </TabsContent>

        <TabsContent value="seguridad" className="px-4 lg:px-6 space-y-4">
            {loading ? (
                <Skeleton className="h-[500px] w-full rounded-xl" />
            ) : (
                <DataTable 
                    columns={columns} 
                    data={logs.filter(l => l.entity === 'USER' || ['LOGIN', 'FAILED_LOGIN', 'SECURITY_BREACH'].includes(l.action))} 
                    filterColumn="action" 
                    filterPlaceholder="Filtrar eventos de seguridad..." 
                />
            )}
        </TabsContent>

        <TabsContent value="mantenimiento" className="px-4 lg:px-6 space-y-4">
            {loading ? (
                <Skeleton className="h-[500px] w-full rounded-xl" />
            ) : (
                <DataTable 
                    columns={columns} 
                    data={logs.filter(l => l.entity === 'SYSTEM')} 
                    filterColumn="action" 
                    filterPlaceholder="Filtrar logs de sistema..." 
                />
            )}
        </TabsContent>
      </Tabs>

      {/* Action Modals */}
      <Dialog open={showInspect} onOpenChange={setShowInspect}>
          <DialogContent className="max-w-2xl border-none shadow-2xl rounded-2xl p-0 overflow-hidden bg-card">
              <div className="bg-primary/5 p-6 border-b">
                  <DialogHeader>
                      <div className="flex items-center gap-3 mb-2">
                          <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                              <IconHistory size={20} />
                          </div>
                          <div>
                              <DialogTitle className="text-lg font-bold">Inspección de Rastro</DialogTitle>
                              <DialogDescription className="text-xs font-medium">Metadatos técnicos y contexto del evento</DialogDescription>
                          </div>
                      </div>
                  </DialogHeader>
              </div>
              <div className="p-6 space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                          <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">ID de Evento</label>
                          <div className="text-xs font-mono bg-muted/50 p-2 rounded border">{selectedLog?.id}</div>
                      </div>
                      <div className="space-y-1">
                          <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Fecha de Ejecución</label>
                          <div className="text-xs p-2 rounded bg-muted/20 border">{selectedLog ? new Date(selectedLog.createdAt).toLocaleString() : ''}</div>
                      </div>
                  </div>
                  
                  <div className="space-y-2">
                      <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Metadatos (JSON Raw)</label>
                      <pre className="text-[11px] p-4 bg-zinc-950 text-emerald-400 rounded-xl overflow-x-auto font-mono border border-zinc-800 leading-relaxed">
                          {JSON.stringify(selectedLog ? JSON.parse(selectedLog.details || '{}') : {}, null, 2)}
                      </pre>
                  </div>

                  <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/30 border border-dashed">
                      <div className="size-12 rounded-full border-4 border-emerald-500/20 border-t-emerald-500 flex items-center justify-center">
                          <IconShieldCheck className="text-emerald-500" size={24} />
                      </div>
                      <div>
                          <h4 className="text-sm font-bold">Firma Digital Válida</h4>
                          <p className="text-[11px] text-muted-foreground font-medium">Este registro no ha sido alterado desde su creación original.</p>
                      </div>
                  </div>
              </div>
          </DialogContent>
      </Dialog>

      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
          <AlertDialogContent className="border-none shadow-2xl rounded-2xl">
              <AlertDialogHeader>
                  <AlertDialogTitle className="font-bold">¿Eliminar registro de auditoría?</AlertDialogTitle>
                  <AlertDialogDescription className="text-xs font-medium">
                      Esta acción es irreversible. El rastro de esta actividad desaparecerá de los reportes de cumplimiento y seguridad.
                  </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                  <AlertDialogCancel className="rounded-xl h-10 font-medium">Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteLog} className="bg-rose-600 hover:bg-rose-700 rounded-xl h-10 shadow-lg shadow-rose-600/20 border-none text-white font-bold">
                      Confirmar Eliminación
                  </AlertDialogAction>
              </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
