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

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000";

type AuditLog = {
  id: string;
  user: string;
  action: string;
  module: "VENTAS" | "INVENTARIO" | "USUARIOS" | "SISTEMA" | "REPORTE";
  details: string;
  ipAddress: string;
  createdAt: string;
};

const moduleConfig: Record<string, { label: string; icon: any; color: string; bg: string }> = {
    VENTAS: { label: "Ventas", icon: IconReceipt, color: "text-blue-600", bg: "bg-blue-500/10" },
    INVENTARIO: { label: "Inventario", icon: IconPackage, color: "text-amber-600", bg: "bg-amber-500/10" },
    USUARIOS: { label: "Seguridad", icon: IconUserCog, color: "text-purple-600", bg: "bg-purple-500/10" },
    SISTEMA: { label: "Sistema", icon: IconDatabase, color: "text-emerald-600", bg: "bg-emerald-500/10" },
    REPORTE: { label: "Reportes", icon: IconShieldCheck, color: "text-rose-600", bg: "bg-rose-500/10" },
};

export default function HistorialPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // For now we simulate since the user wants the UI to reflect Global Actions
      // In a real scenario, this would be an /audit or /logs endpoint
      const mockLogs: AuditLog[] = [
          { id: "1", user: "admin@mipos.com", action: "Inicio de sesión", module: "SISTEMA", details: "Autenticación exitosa", ipAddress: "192.168.1.1", createdAt: new Date().toISOString() },
          { id: "2", user: "admin@mipos.com", action: "Creación de producto", module: "INVENTARIO", details: "ID: PRD-092 (Monitor Gamer)", ipAddress: "192.168.1.1", createdAt: new Date().toISOString() },
          { id: "3", user: "vendedor1@mipos.com", action: "Venta procesada", module: "VENTAS", details: "Factura #0029", ipAddress: "192.168.1.45", createdAt: new Date().toISOString() },
          { id: "4", user: "admin@mipos.com", action: "Exportación de reporte", module: "REPORTE", details: "Ventas Mensuales PDF", ipAddress: "192.168.1.1", createdAt: new Date().toISOString() },
      ];
      setLogs(mockLogs);
    } catch {
      toast.error("Error al cargar el historial de acciones");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

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
                <span className="text-sm font-semibold tracking-tight leading-none mb-1">{row.original.user.split('@')[0]}</span>
                <span className="text-[10px] text-muted-foreground font-medium">{row.original.user}</span>
            </div>
        </div>
      )
    },
    {
      accessorKey: "action",
      header: "Actividad / Acción",
      cell: ({ row }) => {
          const mod = row.original.module;
          const config = moduleConfig[mod] || moduleConfig.SISTEMA;
          const Icon = config.icon;
          return (
            <div className="flex items-center gap-3">
                <div className={`size-7 rounded-lg ${config.bg} ${config.color} flex items-center justify-center`}>
                    <Icon size={14} />
                </div>
                <div className="flex flex-col">
                    <span className="text-sm font-medium text-foreground/90">{row.original.action}</span>
                    <span className="text-[10px] text-muted-foreground line-clamp-1 italic">{row.original.details}</span>
                </div>
            </div>
          )
      }
    },
    {
      accessorKey: "module",
      header: "Área",
      cell: ({ row }) => {
        const mod = row.getValue("module") as string;
        const config = moduleConfig[mod] || moduleConfig.SISTEMA;
        return (
            <Badge variant="outline" className={`text-[10px] font-black tracking-widest px-1.5 h-6 opacity-70 border-none ${config.bg} ${config.color}`}>
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
            {row.original.ipAddress}
        </div>
      )
    },
    {
      accessorKey: "createdAt",
      header: () => <div className="text-right">Fecha / Hora</div>,
      cell: ({ row }) => (
        <div className="flex flex-col text-right text-[11px] font-medium text-muted-foreground leading-tight">
          <span className="text-foreground/80 font-bold">{new Date(row.original.createdAt).toLocaleDateString()}</span>
          <span>{new Date(row.original.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
        </div>
      ),
    },
    {
      id: "actions",
      cell: () => (
        <div className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-8">
                  <IconDotsVertical size={16} className="text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44 border-none shadow-2xl rounded-xl">
                <DropdownMenuItem className="gap-2 text-xs"><IconEye size={14} /> Inspeccionar rastro</DropdownMenuItem>
                <DropdownMenuItem className="gap-2 text-xs"><IconShieldCheck size={14} /> Validar integridad</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" className="gap-2 text-xs"><IconTrash size={14} /> Eliminar log</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6 py-4 md:py-6 font-sans">
      
      {/* Metrics Row - NEW PREMIUM PATTERN */}
      <div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-3 dark:*:data-[slot=card]:bg-card text-secondary-foreground">
          <Card className="@container/card shadow-sm border-none">
            <CardHeader>
              <CardDescription className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Acciones Totales</CardDescription>
              <CardTitle className="text-2xl font-bold tabular-nums @[250px]/card:text-3xl">
                1,284
              </CardTitle>
              <CardAction>
                <Badge variant="outline" className="gap-1 border-primary/20 text-primary bg-primary/5">
                  <IconTrendingUp size={12} />
                  +5.2%
                </Badge>
              </CardAction>
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1 text-[10px] pb-5">
              <div className="line-clamp-1 flex gap-2 font-bold text-muted-foreground uppercase tracking-tight">
                Actividad operativa intensa <IconTrendingUp className="size-3 text-primary" />
              </div>
              <div className="text-muted-foreground/60 font-medium italic">
                Eventos registrados en las últimas 24 horas
              </div>
            </CardFooter>
          </Card>

          <Card className="@container/card shadow-sm border-none">
            <CardHeader>
              <CardDescription className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Alertas Críticas</CardDescription>
              <CardTitle className="text-2xl font-bold tabular-nums @[250px]/card:text-3xl text-rose-600">
                2
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
              <div className="text-muted-foreground/60 font-medium italic">
                Intentos de acceso no autorizados
              </div>
            </CardFooter>
          </Card>

          <Card className="@container/card shadow-sm border-none">
            <CardHeader>
              <CardDescription className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Estabilidad Sistema</CardDescription>
              <CardTitle className="text-2xl font-bold tabular-nums @[250px]/card:text-3xl text-emerald-600">
                99.9%
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
              <div className="text-muted-foreground/60 font-medium italic">
                Sin fallos detectados en el núcleo
              </div>
            </CardFooter>
          </Card>
      </div>

      {/* Header Info - Global Activity Control */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 px-4 lg:px-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <IconHistory size={24} className="text-primary" /> Auditoría de Sistema
          </h1>
          <p className="text-sm text-muted-foreground font-medium">Registro cronológico de todas las acciones y eventos ejecutados en la plataforma.</p>
        </div>
        <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2 h-9 shadow-sm">
                <IconFilter size={16} /> Filtros Rápidos
            </Button>
            <Button size="sm" className="gap-2 h-9 shadow-md font-medium">
                <IconCalendar size={16} />
                <span>Rango Histórico</span>
            </Button>
        </div>
      </div>

      {/* Tabs Layout for Log categorization */}
      <Tabs defaultValue="actividad" className="w-full flex flex-col gap-6">
        <div className="px-4 lg:px-6">
          <TabsList className="**:data-[slot=badge]:bg-muted-foreground/30 **:data-[slot=badge]:size-5 **:data-[slot=badge]:rounded-full **:data-[slot=badge]:px-1">
            <TabsTrigger value="actividad">Actividad Global</TabsTrigger>
            <TabsTrigger value="seguridad">Alertas de Seguridad <Badge variant="destructive" className="ml-2 text-white">2</Badge></TabsTrigger>
            <TabsTrigger value="mantenimiento">Logs de Sistema</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="actividad" className="px-4 lg:px-6 space-y-4">
            {loading ? (
                <Skeleton className="h-[500px] w-full rounded-2xl" />
            ) : (
                <DataTable 
                    columns={columns} 
                    data={logs} 
                    filterColumn="action" 
                    filterPlaceholder="Buscar por acción o usuario..." 
                />
            )}
        </TabsContent>

        <TabsContent value="seguridad" className="px-4 lg:px-6 pb-20">
            <div className="aspect-video w-full flex-1 rounded-3xl border-2 border-dashed flex flex-col items-center justify-center text-muted-foreground text-sm italic bg-muted/10 gap-4">
                <IconShieldCheck size={48} stroke={1} className="opacity-20" />
                <p>Monitoreando intentos de acceso y cambios de privilegios...</p>
            </div>
        </TabsContent>
      </Tabs>

    </div>
  );
}
