"use client";

import React, { useState, useEffect } from "react";
import { 
  Card, CardContent, CardHeader, CardTitle, CardDescription, CardAction, CardFooter
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  IconTruck, IconPlus, IconAlertTriangle, IconClock, IconReceipt, IconTrendingUp, IconDownload, IconBox
} from "@tabler/icons-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { UniversalTable } from "@/components/universal-table";
import { getPurchaseOrdersColumns } from "@/components/purchase-orders-columns";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000";

export default function PurchaseOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const token = localStorage.getItem("token");
      const branchId = localStorage.getItem("currentBranchId") || "";
      const res = await fetch(`${API}/purchase-orders${branchId ? `?branchId=${branchId}` : ""}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        setOrders(await res.json());
      }
    } catch (error) {
      toast.error("Error al cargar órdenes de compra");
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async (id: string) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/purchase-orders/${id}/send`, {
        method: "POST",
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        toast.success("Orden marcada como enviada");
        fetchOrders();
      } else {
        const err = await res.json();
        toast.error(err.message || "Error al enviar");
      }
    } catch (error) {
      toast.error("Error de conexión");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Desea anular esta orden?")) return;
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/purchase-orders/${id}`, {
        method: "DELETE",
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        toast.success("Orden anulada");
        fetchOrders();
      }
    } catch (error) {
      toast.error("Error al anular");
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-VE", { style: "currency", currency: "USD" }).format(amount);
  };

  const tableData = React.useMemo(() => {
    return orders.map((order: any) => ({
      id: order.id,
      header: JSON.stringify({
        number: order.number
      }),
      supplier: JSON.stringify({
        name: order.supplier.name
      }),
      branch: JSON.stringify({
        name: order.branch?.name || "N/A"
      }),
      total: JSON.stringify({
        formattedTotal: formatCurrency(order.total)
      }),
      status: JSON.stringify({
        status: order.status
      }),
      createdAt: new Date(order.createdAt).toLocaleDateString("es-VE"),
      type: "PURCHASE",
      target: order.branch?.name || "N/A",
      limit: formatCurrency(order.total),
      reviewer: order.supplier.name,
      raw: order
    }));
  }, [orders]);

  const [selectedOrderForReception, setSelectedOrderForReception] = useState<any | null>(null);

  const stats = React.useMemo(() => {
    const pending = orders.filter(o => o.status === 'SENT' || o.status === 'DRAFT').length;
    const totalMonth = orders
      .filter(o => o.status === 'RECEIVED' && new Date(o.createdAt).getMonth() === new Date().getMonth())
      .reduce((acc, curr) => acc + curr.total, 0);
    
    return { pending, totalMonth };
  }, [orders]);

  const handleReceive = (id: string) => {
    const order = orders.find(o => o.id === id);
    if (!order) return;
    setSelectedOrderForReception(order);
  };

  const processReceive = async (id: string) => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/purchase-orders/${id}/receive`, {
        method: "POST",
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        toast.success("Mercancía recibida e inventario actualizado");
        setSelectedOrderForReception(null);
        fetchOrders();
      } else {
        const err = await res.json();
        toast.error(err.message || "Error al recibir");
      }
    } catch (error) {
      toast.error("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 py-4 md:gap-8 md:py-6 font-sans">
      <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Metrica 1: OC Pendientes */}
        <Card className="@container/card bg-gradient-to-t from-primary/5 to-card shadow-xs">
          <CardHeader>
            <CardDescription className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">Logística</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {stats.pending}
            </CardTitle>
            <CardAction>
              <Badge variant="outline" className="gap-1 animate-pulse border-none bg-amber-500/10 text-amber-600 font-bold uppercase text-[9px]">
                En Proceso
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-[11px] font-medium text-muted-foreground pt-0">
             Órdenes pendientes por recepción
          </CardFooter>
        </Card>

        {/* Metrica 2: Inversión Mes */}
        <Card className="@container/card bg-gradient-to-t from-primary/5 to-card shadow-xs">
          <CardHeader>
            <CardDescription className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">Capitalización</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              USD {stats.totalMonth.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
            </CardTitle>
            <CardAction>
              <Badge variant="outline" className="gap-1 border-none bg-emerald-500/10 text-emerald-600 font-bold uppercase text-[9px]">
                Mes Actual
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-[11px] font-medium text-muted-foreground pt-0">
            Inversión liquidada en stock
          </CardFooter>
        </Card>

        {/* Metrica 3: Recepciones */}
        <Card className="@container/card bg-gradient-to-t from-primary/5 to-card shadow-xs">
          <CardHeader>
            <CardDescription className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">Stock Auditado</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {orders.filter(o => o.status === 'RECEIVED').length}
            </CardTitle>
            <CardAction>
              <Badge variant="outline" className="gap-1 border-none bg-blue-500/10 text-blue-600 font-bold uppercase text-[9px]">
                Recepciones
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-[11px] font-medium text-muted-foreground pt-0">
            Cargas validadas con éxito
          </CardFooter>
        </Card>

        {/* Metrica 4: Total */}
        <Card className="@container/card bg-gradient-to-t from-primary/5 to-card shadow-xs">
          <CardHeader>
            <CardDescription className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">Procura</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {orders.length}
            </CardTitle>
            <CardAction>
              <Badge variant="outline" className="gap-1 border-none bg-slate-900/10 text-slate-900 dark:text-slate-100 font-bold uppercase text-[9px]">
                Total OC
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-[11px] font-medium text-muted-foreground pt-0">
            Documentos emitidos a la fecha
          </CardFooter>
        </Card>
      </div>

      <div className="flex items-center justify-between px-4 lg:px-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight">Órdenes de Compra</h1>
          <p className="text-sm text-muted-foreground font-medium">Gestión de procura, abastecimiento y recepción de inventario.</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-9 shadow-none bg-card">
            <IconDownload size={16} className="mr-2" /> Reporte Mensual
          </Button>
          <Button size="sm" onClick={() => router.push('/dashboard/inventario/compras/nuevo')} className="gap-2 h-9 shadow-none font-bold text-xs px-5">
            <IconPlus size={16} />
            Nueva Orden
          </Button>
        </div>
      </div>

      <div className="px-4 lg:px-6 h-full">
        {loading ? (
          <Skeleton className="h-[500px] w-full rounded-2xl" />
        ) : (
          <UniversalTable 
            data={tableData} 
            columns={getPurchaseOrdersColumns({ onReceive: handleReceive, onSend: handleSend, onDelete: handleDelete }) as any}
            tabs={{
              outline: "Todas las Órdenes",
              pastPerformance: `Pendientes (${stats.pending})`,
              keyPersonnel: "Recibidas",
              focusDocuments: "Anuladas"
            }}
            customTabsContent={{
              pastPerformance: (
                <UniversalTable 
                  hideHeader={true}
                  data={tableData.filter(d => JSON.parse(d.status).status === 'SENT' || JSON.parse(d.status).status === 'DRAFT')}
                  columns={getPurchaseOrdersColumns({ onReceive: handleReceive, onSend: handleSend, onDelete: handleDelete }) as any}
                />
              ),
              keyPersonnel: (
                <UniversalTable 
                  hideHeader={true}
                  data={tableData.filter(d => JSON.parse(d.status).status === 'RECEIVED')}
                  columns={getPurchaseOrdersColumns({ onReceive: handleReceive, onSend: handleSend, onDelete: handleDelete }) as any}
                />
              ),
              focusDocuments: (
                <UniversalTable 
                  hideHeader={true}
                  data={tableData.filter(d => JSON.parse(d.status).status === 'CANCELLED')}
                  columns={getPurchaseOrdersColumns({ onReceive: handleReceive, onSend: handleSend, onDelete: handleDelete }) as any}
                />
              )
            }}
          />
        )}
      </div>
      <Dialog open={!!selectedOrderForReception} onOpenChange={(open) => !open && setSelectedOrderForReception(null)}>
        <DialogContent className="max-w-2xl bg-zinc-950 border-[#79716b]/30 text-white shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <IconBox size={20} className="text-emerald-500" /> Confirmar Recepción
            </DialogTitle>
            <div className="flex items-center gap-4 mt-2 p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/10 mb-4">
               <div>
                  <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Orden de Compra</p>
                  <p className="text-sm font-bold text-white">{selectedOrderForReception?.number}</p>
               </div>
               <div className="h-6 w-px bg-[#79716b]/30" />
               <div>
                  <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Sucursal Destino</p>
                  <p className="text-sm font-bold text-white">{selectedOrderForReception?.branch?.name}</p>
               </div>
            </div>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="max-h-[300px] overflow-y-auto rounded-lg border border-[#79716b]/20">
              <Table>
                <TableHeader className="bg-muted sticky top-0 z-10">
                  <TableRow className="border-[#79716b]/20">
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider text-white h-10">Producto</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider text-white h-10 text-center">Cantidad</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider text-white h-10 text-right">Costo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedOrderForReception?.items?.map((item: any) => (
                    <TableRow key={item.id} className="border-[#79716b]/10 bg-transparent">
                      <TableCell className="py-2.5">
                        <p className="text-xs font-bold text-white">{item.variant.product.name}</p>
                        <p className="text-[10px] text-muted-foreground font-medium uppercase">{item.variant.name}</p>
                      </TableCell>
                      <TableCell className="text-center font-black text-sm text-foreground">{item.quantity}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs text-muted-foreground">USD {item.cost.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/10 flex gap-3">
               <IconAlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
               <p className="text-[11px] text-amber-500/80 font-medium leading-relaxed">Al confirmar, se incrementará el inventario en la sucursal {selectedOrderForReception?.branch?.name} y se generará una cuenta por pagar al proveedor.</p>
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button variant="ghost" onClick={() => setSelectedOrderForReception(null)} className="h-10 text-xs font-bold opacity-60 hover:opacity-100 uppercase tracking-widest">
              Cancelar
            </Button>
            <Button onClick={() => processReceive(selectedOrderForReception.id)} disabled={loading} className="h-10 px-8 bg-emerald-500 hover:bg-emerald-600 text-white font-black uppercase text-xs tracking-widest shadow-[0_0_20px_rgba(16,185,129,0.3)]">
              {loading ? "Procesando..." : "Proceder con Recepción"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
