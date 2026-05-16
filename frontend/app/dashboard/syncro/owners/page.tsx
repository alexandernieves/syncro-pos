"use client";

import React, { useEffect, useState } from "react";
import { API_URL } from "@/lib/constants"
import { 
  IconUsers, 
  IconBuildingStore, 
  IconCreditCard, 
  IconCheck, 
  IconX, 
  IconDotsVertical,
  IconSearch,
  IconShoppingCart
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { 
  Card,
  CardHeader, 
  CardTitle, 
  CardDescription,
  CardAction,
  CardFooter 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

const API = process.env.NEXT_PUBLIC_API_URL || "${process.env.NEXT_PUBLIC_API_URL || ``${API_URL}`}";

export default function OwnersManagementPage() {
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchBusinesses = async () => {
    try {
      const res = await fetch(`${API}/syncro-admin/businesses`);
      if (res.ok) {
        const data = await res.json();
        setBusinesses(data);
      }
    } catch (error) {
      console.error("Error fetching businesses:", error);
      toast.error("No se pudieron cargar los negocios");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBusinesses();
  }, []);

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      const res = await fetch(`${API}/syncro-admin/business/${id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus })
      });

      if (res.ok) {
        toast.success(`Estado actualizado a ${newStatus}`);
        fetchBusinesses();
      }
    } catch (error) {
      toast.error("Error al actualizar el estado");
    }
  };

  const filtered = businesses.filter(b => 
    b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (b.ruc && b.ruc.includes(searchTerm))
  );

  return (
    <div className="p-6 flex flex-col gap-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gestión de Negocios (Owners)</h1>
          <p className="text-muted-foreground">Monitorea y gestiona todos los clientes de la plataforma Syncro POS.</p>
        </div>
        <div className="relative w-72">
          <IconSearch className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o RUC..."
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
        <Card className="@container/card bg-gradient-to-t from-primary/5 to-card shadow-xs">
          <CardHeader>
            <CardDescription>Total Negocios</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {businesses.length}
            </CardTitle>
            <CardAction>
              <IconBuildingStore className="size-5 text-muted-foreground/50" />
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 flex gap-2 font-medium">Registrados</div>
            <div className="text-muted-foreground italic text-xs">En toda la plataforma</div>
          </CardFooter>
        </Card>

        <Card className="@container/card bg-gradient-to-t from-primary/5 to-card shadow-xs">
          <CardHeader>
            <CardDescription>Suscripciones Activas</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl text-emerald-600">
              {businesses.filter(b => b.status === "ACTIVE").length}
            </CardTitle>
            <CardAction>
              <Badge variant="outline" className="gap-1 border-emerald-500/20 text-emerald-500">
                <IconCheck className="size-3" /> ACTIVO
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 flex gap-2 font-medium">Generando Ingresos</div>
            <div className="text-muted-foreground italic text-xs">Clientes vigentes</div>
          </CardFooter>
        </Card>

        <Card className="@container/card bg-gradient-to-t from-primary/5 to-card shadow-xs">
          <CardHeader>
            <CardDescription>En Período de Prueba</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl text-blue-600">
              {businesses.filter(b => b.status === "TRIAL").length}
            </CardTitle>
            <CardAction>
              <IconUsers className="size-5 text-blue-500/30" />
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 flex gap-2 font-medium">Potenciales Clientes</div>
            <div className="text-muted-foreground italic text-xs">Probando el sistema</div>
          </CardFooter>
        </Card>

        <Card className="@container/card bg-gradient-to-t from-primary/5 to-card shadow-xs">
          <CardHeader>
            <CardDescription>Suspendidos</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl text-red-600">
              {businesses.filter(b => b.status === "SUSPENDED").length}
            </CardTitle>
            <CardAction>
              <IconX className="size-5 text-red-500/30" />
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 flex gap-2 font-medium">Acceso Restringido</div>
            <div className="text-muted-foreground italic text-xs">Cuentas inactivas</div>
          </CardFooter>
        </Card>
      </div>

      <Card className="border-none shadow-none bg-transparent">
        <CardHeader className="px-0">
          <CardTitle>Listado de Clientes</CardTitle>
          <CardDescription>Detalle de cada negocio y su uso del sistema.</CardDescription>
        </CardHeader>
        <div className="rounded-xl border border-border/40 bg-card overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow className="hover:bg-transparent border-border/10 font-semibold uppercase tracking-tight text-[10px] text-muted-foreground">
                <TableHead className="px-4 h-10">Negocio</TableHead>
                <TableHead className="px-4 h-10">Estado</TableHead>
                <TableHead className="px-4 h-10">Plan</TableHead>
                <TableHead className="px-4 h-10 text-right">Sucursales</TableHead>
                <TableHead className="px-4 h-10 text-right">Ventas</TableHead>
                <TableHead className="px-4 h-10 text-right">Usuarios</TableHead>
                <TableHead className="px-4 h-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((b) => (
                <TableRow key={b.id} className="hover:bg-muted/30 border-border/5 transition-colors group">
                  <TableCell className="px-4 py-3">
                    <div className="font-bold text-xs text-white uppercase tracking-tight">{b.name}</div>
                    <div className="text-[10px] font-mono text-primary/70">{b.id.substring(0, 8)} • {b.ruc || "SIN RUC"}</div>
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <div className={cn(
                        "size-1.5 rounded-full shadow-lg",
                        b.status === "ACTIVE" ? "bg-emerald-500 shadow-emerald-500/40" : 
                        b.status === "TRIAL" ? "bg-blue-500 shadow-blue-500/40" : 
                        "bg-red-500 shadow-red-500/40"
                      )} />
                      <span className={cn(
                        "text-[10px] font-semibold uppercase tracking-tight",
                        b.status === "ACTIVE" ? "text-emerald-500" : 
                        b.status === "TRIAL" ? "text-blue-500" : 
                        "text-red-500"
                      )}>
                        {b.status}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <Badge variant="outline" className="text-[9px] font-black uppercase border-primary/20 text-primary">
                      {b.subscription}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right font-bold text-xs tabular-nums text-white">
                    {b._count?.branches || 0}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right font-bold text-xs tabular-nums text-white">
                    {b._count?.sales || 0}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right font-bold text-xs tabular-nums text-white">
                    {b._count?.users || 0}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-primary/10 transition-colors">
                          <IconDotsVertical className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56 border-border/40 shadow-2xl rounded-xl">
                        <DropdownMenuLabel className="text-[10px] uppercase text-muted-foreground tracking-widest">Control SaaS</DropdownMenuLabel>
                        <DropdownMenuSeparator className="bg-border/10" />
                        <DropdownMenuItem onClick={() => handleStatusChange(b.id, "ACTIVE")} className="text-xs font-semibold gap-2 py-2.5">
                          <IconCheck className="size-4 text-emerald-500" /> Activar Negocio
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleStatusChange(b.id, "SUSPENDED")} className="text-xs font-semibold gap-2 py-2.5 text-red-500">
                          <IconX className="size-4" /> Suspender Acceso
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-border/10" />
                        <DropdownMenuItem className="text-xs font-semibold gap-2 py-2.5">
                          Ver Detalles de Cliente
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
