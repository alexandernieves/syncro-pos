"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
  Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  IconArrowLeft, IconTruck, IconCircleCheckFilled, IconClock, IconBan, IconDownload, IconPrinter, IconMail, IconPackage, IconBuildingStore
} from "@tabler/icons-react";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000";

export default function PurchaseOrderDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrder();
  }, [id]);

  const fetchOrder = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/purchase-orders/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setOrder(await res.json());
    } catch (error) {
      toast.error("Error al cargar la orden");
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (status: string) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/purchase-orders/${id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        toast.success(`Orden marcada como ${status}`);
        fetchOrder();
      }
    } catch (error) {
      toast.error("Error al actualizar estatus");
    }
  };

  const handleReceive = async () => {
    if (!confirm("¿Confirma la recepción total de la mercancía? El inventario se actualizará de inmediato.")) return;
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/purchase-orders/${id}/receive`, {
        method: "POST",
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        toast.success("Mercancía ingresada al almacén correctamente");
        fetchOrder();
      } else {
        const err = await res.json();
        toast.error(err.message || "Error al recibir");
      }
    } catch (error) {
      toast.error("Error de conexión");
    }
  };

  if (loading) return <div className="p-8"><Skeleton className="h-[600px] w-full rounded-2xl" /></div>;
  if (!order) return <div className="p-8 text-center">Orden no encontrada</div>;

  const statusConfig: any = {
    DRAFT: { label: "BORRADOR", color: "bg-slate-500/10 text-slate-600", icon: <IconClock size={16} /> },
    SENT: { label: "ENVIADA", color: "bg-blue-500/10 text-blue-600", icon: <IconTruck size={16} /> },
    RECEIVED: { label: "RECIBIDA", color: "bg-emerald-500/10 text-emerald-600", icon: <IconCircleCheckFilled size={16} /> },
    CANCELLED: { label: "ANULADA", color: "bg-rose-500/10 text-rose-600", icon: <IconBan size={16} /> },
  };

  const currentStatus = statusConfig[order.status] || statusConfig.DRAFT;

  return (
    <div className="flex flex-col gap-6 py-4 md:gap-8 md:py-6 max-w-6xl mx-auto px-4 lg:px-6 font-sans">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => router.back()} className="h-9 shadow-none">
            <IconArrowLeft size={16} />
          </Button>
          <div className="flex flex-col">
            <div className="flex items-center gap-2 mb-0.5">
                <Badge variant="outline" className={`px-2 py-0.5 font-bold tracking-tight border-none ${currentStatus.color}`}>
                    <span className="mr-1">{currentStatus.icon}</span>
                    {currentStatus.label}
                </Badge>
                <span className="text-xs font-bold text-muted-foreground">/</span>
                <span className="text-xs font-bold text-muted-foreground">{new Date(order.createdAt).toLocaleDateString("es-VE")}</span>
            </div>
            <h1 className="text-2xl font-black tracking-tight">{order.number || `ORDEN #${order.id.substring(0, 8)}`}</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-10 px-4 font-bold shadow-none text-xs flex gap-2">
                <IconPrinter size={16} /> Imprimir OC
            </Button>
            {order.status === 'DRAFT' && (
                <Button size="sm" onClick={() => updateStatus('SENT')} className="h-10 px-6 font-bold shadow-none text-xs bg-blue-600 hover:bg-blue-700 text-white flex gap-2">
                    <IconMail size={16} /> Marcar como Enviada
                </Button>
            )}
            {order.status === 'SENT' && (
                <Button size="sm" onClick={handleReceive} className="h-10 px-6 font-bold shadow-none text-xs bg-emerald-600 hover:bg-emerald-700 text-white flex gap-2">
                    <IconCircleCheckFilled size={16} /> Recibir Mercancía
                </Button>
            )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
            <Card className="border-none shadow-sm overflow-hidden">
                <CardHeader className="bg-muted/30 border-b">
                    <CardTitle className="text-sm font-bold flex items-center gap-2 uppercase tracking-widest">
                        <IconPackage size={16} className="text-primary" /> Detalle de Ítems Solicitados
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/10 border-b">
                                <TableHead className="text-[10px] font-black uppercase py-4">Descripción de Producto</TableHead>
                                <TableHead className="text-[10px] font-black uppercase text-center w-24">Cantidad</TableHead>
                                <TableHead className="text-[10px] font-black uppercase text-right w-32">Costo Unit.</TableHead>
                                <TableHead className="text-[10px] font-black uppercase text-right pr-6">Subtotal</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {order.items.map((item: any) => (
                                <TableRow key={item.id} className="border-b last:border-0">
                                    <TableCell className="py-4">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold text-slate-900 dark:text-white mb-0.5">{item.variant.product.name}</span>
                                            <span className="text-[11px] text-muted-foreground">{item.variant.name} — SKU: {item.variant.sku}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-center font-black tabular-nums">{item.quantity}</TableCell>
                                    <TableCell className="text-right font-medium tabular-nums">${item.cost.toFixed(2)}</TableCell>
                                    <TableCell className="text-right pr-6 font-black tabular-nums text-slate-900 dark:text-white">${item.subtotal.toFixed(2)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Card className="border-none shadow-sm bg-muted/20">
                <CardHeader>
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <IconClock size={16} className="text-primary" /> Notas y Observaciones
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground italic leading-relaxed">
                        {order.notes || "Sin observaciones adicionales para esta orden de compra."}
                    </p>
                </CardContent>
            </Card>
        </div>

        <div className="space-y-8">
            <Card className="border-none shadow-xl bg-slate-900 text-white overflow-hidden">
                <CardHeader className="pb-4 bg-slate-800/50">
                    <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-400">Puntos de Referencia</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6 pt-6">
                    <div className="flex gap-4">
                        <div className="size-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 shrink-0">
                            <IconBuildingStore size={20} />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-0.5">Socio Comercial</span>
                            <span className="text-sm font-bold text-slate-200 leading-tight">{order.supplier.name}</span>
                            <span className="text-[11px] text-slate-500 mt-1">{order.supplier.taxId}</span>
                        </div>
                    </div>

                    <div className="flex gap-4 pt-4 border-t border-slate-800">
                        <div className="size-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 shrink-0">
                            <IconTruck size={20} />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-0.5">Destino de Carga</span>
                            <span className="text-sm font-bold text-slate-200 leading-tight">{order.branch.name}</span>
                            <span className="text-[11px] text-slate-500 mt-1">{order.branch.location}</span>
                        </div>
                    </div>

                    <div className="pt-6 mt-6 border-t border-slate-800 space-y-4">
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-500 font-bold uppercase tracking-tight text-[10px]">Subtotal Acumulado</span>
                            <span className="font-bold tabular-nums text-slate-200">${order.subtotal?.toFixed(2) || (order.total).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-500 font-bold uppercase tracking-tight text-[10px]">Tasa Fiscal (IVA)</span>
                            <span className="font-bold tabular-nums text-slate-200">${order.taxAmount?.toFixed(2) || "0.00"}</span>
                        </div>
                        <div className="flex justify-between items-center pt-2">
                            <span className="text-lg font-black uppercase tracking-tighter text-white">Total a Pagar</span>
                            <span className="text-2xl font-black tabular-nums text-emerald-400">${order.total.toFixed(2)}</span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card className="border-none shadow-none bg-blue-50 dark:bg-zinc-900 shadow-sm border border-blue-100 dark:border-zinc-800">
                <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-black uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400">Tracking de Estado</CardTitle>
                </CardHeader>
                <CardContent className="pt-2 space-y-4">
                    <div className="flex gap-3 relative">
                        <div className="flex flex-col items-center">
                            <div className={`size-3 rounded-full mt-1 ${order.status === 'RECEIVED' ? 'bg-emerald-500' : (order.status === 'CANCELLED' ? 'bg-rose-500' : 'bg-primary')} ring-4 ring-primary/10`} />
                            {order.status !== 'RECEIVED' && <div className="w-0.5 flex-1 bg-muted my-1" />}
                        </div>
                        <div className="flex flex-col pb-6">
                            <span className="text-xs font-bold uppercase tracking-tight text-slate-900 dark:text-white leading-none mb-1.5">{currentStatus.label}</span>
                            <p className="text-[11px] text-muted-foreground leading-relaxed">
                                {order.status === 'DRAFT' && "La orden de compra ha sido redactada. Se requieren aprobaciones internas antes de su envío."}
                                {order.status === 'SENT' && "El documento ha sido despachado satisfactoriamente. Se espera la confirmación del proveedor."}
                                {order.status === 'RECEIVED' && "La mercancía ha ingresado al almacén. Se han actualizado los registros de stock e inversión."}
                                {order.status === 'CANCELLED' && "Operación anulada definitivamente."}
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
}
