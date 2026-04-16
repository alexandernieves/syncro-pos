"use client";

import React, { useState, useEffect } from "react";
import { 
  Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription, CardAction 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  IconUserPlus, IconSearch, IconUser, IconMail, IconPhone, IconMapPin, IconFilter, IconArrowRight, IconUsersGroup, IconDotsVertical, IconBriefcase, IconCalendar, IconLayoutColumns, IconPlus, IconTrendingUp, IconTrendingDown, IconCheck
} from "@tabler/icons-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { 
  Tabs, TabsContent, TabsList, TabsTrigger 
} from "@/components/ui/tabs";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "./data-table";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000";

type Client = {
  id: string;
  name: string;
  documentId: string;
  email: string;
  phone: string;
  address: string;
  isActive: boolean;
  sales: any[];
};

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      const res = await fetch(`${API}/clients`);
      if (res.ok) {
        const data = await res.json();
        setClients(data);
      }
    } catch (error) {
      toast.error("Error al cargar clientes");
    } finally {
      setLoading(false);
    }
  };

  const columns: ColumnDef<Client>[] = [
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
        accessorKey: "name",
        header: "Cliente / Identificación",
        cell: ({ row }) => (
            <div className="flex items-center gap-3">
                <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-[10px] border border-primary/20">
                    {row.original.name.substring(0,2).toUpperCase()}
                </div>
                <div className="flex flex-col">
                    <span className="text-sm font-semibold tracking-tight text-foreground/90">{row.original.name}</span>
                    <span className="text-[10px] font-medium text-muted-foreground font-mono">{row.original.documentId || "ID-PEN"}</span>
                </div>
            </div>
        )
    },
    {
        accessorKey: "contact",
        header: "Contacto y Correo",
        cell: ({ row }) => (
            <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2 text-xs font-medium">
                    <IconMail size={12} className="text-muted-foreground" />
                    {row.original.email || "No asignado"}
                </div>
            </div>
        )
    },
    {
        accessorKey: "isActive",
        header: "Estado",
        cell: ({ row }) => (
            <Badge variant="outline" className="text-muted-foreground px-1.5 font-medium gap-1.5">
                <div className={`size-1.5 rounded-full ${row.getValue("isActive") ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                {row.getValue("isActive") ? "Activo" : "Suspendido"}
            </Badge>
        )
    },
    {
        accessorKey: "sales",
        header: () => <div className="w-full text-right">Última Operación</div>,
        cell: ({ row }) => {
            const lastSale = row.original.sales?.[row.original.sales.length - 1];
            return (
                <div className="text-right flex flex-col items-end">
                    <span className="text-[11px] font-semibold">
                        {lastSale ? new Date(lastSale.createdAt).toLocaleDateString() : 'Sin actividad'}
                    </span>
                    <span className="text-[10px] text-muted-foreground uppercase font-black tracking-tighter opacity-30">Auditoría</span>
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
                <DropdownMenuContent align="end" className="w-40 border-none shadow-2xl rounded-xl">
                  <DropdownMenuItem className="text-xs">Ver perfil completo</DropdownMenuItem>
                  <DropdownMenuItem className="text-xs">Editar datos</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-xs font-semibold text-rose-500">Suspender cuenta</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
          </div>
        ),
    }
  ];

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 font-sans">
         {/* Stats row wide - Mirroring Dashboard metrics - NEW PREMIUM PATTERN */}
      <div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-3 dark:*:data-[slot=card]:bg-card text-secondary-foreground">
          <Card className="@container/card shadow-sm border-none">
            <CardHeader>
              <CardDescription className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Total Clientes</CardDescription>
              <CardTitle className="text-2xl font-bold tabular-nums @[250px]/card:text-3xl">
                {clients.length}
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
                Cartera comercial en expansión <IconTrendingUp className="size-3 text-primary" />
              </div>
              <div className="text-muted-foreground/60 font-medium italic">
                Crecimiento orgánico registrado este trimestre
              </div>
            </CardFooter>
          </Card>

          <Card className="@container/card shadow-sm border-none">
            <CardHeader>
              <CardDescription className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Clientes Activos</CardDescription>
              <CardTitle className="text-2xl font-bold tabular-nums @[250px]/card:text-3xl text-emerald-600">
                {clients.filter(c => c.isActive).length}
              </CardTitle>
              <CardAction>
                <Badge variant="outline" className="gap-1 border-emerald-500/20 text-emerald-600 bg-emerald-500/5">
                  <IconTrendingUp size={12} />
                  98%
                </Badge>
              </CardAction>
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1 text-[10px] pb-5">
              <div className="line-clamp-1 flex gap-2 font-bold text-muted-foreground uppercase tracking-tight">
                Alta retención de cartera <IconTrendingUp className="size-3 text-emerald-500" />
              </div>
              <div className="text-muted-foreground/60 font-medium italic">
                Clientes con actividad en los últimos 30 días
              </div>
            </CardFooter>
          </Card>

          <Card className="@container/card shadow-sm border-none">
            <CardHeader>
              <CardDescription className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Ticket Promedio</CardDescription>
              <CardTitle className="text-2xl font-bold tabular-nums @[250px]/card:text-3xl text-amber-600">
                $245.00
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
                Incremento en valor de compra <IconTrendingUp className="size-3 text-amber-500" />
              </div>
              <div className="text-muted-foreground/60 font-medium italic">
                Optimización de estrategias de up-selling
              </div>
            </CardFooter>
          </Card>
      </div>

      {/* Tabs Layout Mirroring Dashboard EXACTLY */}
      <Tabs defaultValue="perfiles" className="w-full flex flex-col gap-6">
        <div className="flex items-center justify-between px-4 lg:px-6">
          <TabsList className="**:data-[slot=badge]:bg-muted-foreground/30 **:data-[slot=badge]:size-5 **:data-[slot=badge]:rounded-full **:data-[slot=badge]:px-1">
            <TabsTrigger value="perfiles">Cartera de Clientes</TabsTrigger>
            <TabsTrigger value="segmentacion">Segmentación <Badge variant="secondary" className="ml-2">5</Badge></TabsTrigger>
            <TabsTrigger value="creditos">Créditos <Badge variant="secondary" className="ml-2">2</Badge></TabsTrigger>
          </TabsList>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2">
                <IconFilter size={14} /> Filtros
            </Button>
            <Button size="sm" className="gap-2 shadow-sm font-medium">
                <IconPlus size={16} />
                <span className="hidden lg:inline">Agregar Cliente</span>
                <span className="lg:hidden">Nuevo</span>
            </Button>
          </div>
        </div>

        <TabsContent value="perfiles" className="px-4 lg:px-6 space-y-4">
            <div className="overflow-hidden">
                {loading ? (
                    <Skeleton className="h-[500px] w-full rounded-xl" />
                ) : (
                    <DataTable 
                        columns={columns} 
                        data={clients} 
                        filterColumn="name" 
                        filterPlaceholder="Filtrar por nombre o RIF..." 
                    />
                )}
            </div>
        </TabsContent>

        <TabsContent value="segmentacion" className="px-4 lg:px-6">
            <div className="aspect-video w-full flex-1 rounded-lg border border-dashed flex items-center justify-center text-muted-foreground text-sm italic">
                Cargando módulos de segmentación estratégica...
            </div>
        </TabsContent>
        
        <TabsContent value="creditos" className="px-4 lg:px-6">
            <div className="aspect-video w-full flex-1 rounded-lg border border-dashed flex items-center justify-center text-muted-foreground text-sm italic">
                Historial de créditos y límites de consumo...
            </div>
        </TabsContent>
      </Tabs>

    </div>
  );
}
