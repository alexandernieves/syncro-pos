"use client";

import React, { useState, useEffect, Suspense } from "react";
import { API_URL } from "@/lib/constants"
import { 
  Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  IconArrowLeft, IconTruck, IconBox, IconFileText, IconCircleCheckFilled, 
  IconAlertTriangle, IconClock, IconPrinter, IconBuildingStore, IconDownload,
  IconReceipt
} from "@tabler/icons-react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const API = process.env.NEXT_PUBLIC_API_URL || ``${API_URL}`;

function PurchaseOrderDetailContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const router = useRouter();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) fetchOrder(id);
  }, [id]);

  const fetchOrder = async (orderId: string) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/purchase-orders/${orderId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setOrder(await res.json());
      } else {
        toast.error("No se pudo cargar la orden");
        router.push("/dashboard/inventario/compras");
      }
    } catch (error) {
      toast.error("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  const statusConfig: any = {
    DRAFT: { label: "BORRADOR", color: "bg-slate-500/10 text-slate-600", icon: <IconClock size={16} /> },
    SENT: { label: "ENVIADA", color: "bg-blue-500/10 text-blue-600", icon: <IconTruck size={16} /> },
    RECEIVED: { label: "RECIBIDA", color: "bg-emerald-500/10 text-emerald-600", icon: <IconCircleCheckFilled size={16} /> },
    CANCELLED: { label: "ANULADA", color: "bg-rose-500/10 text-rose-600", icon: <IconAlertTriangle size={16} /> },
  };

  if (loading) return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <Skeleton className="h-10 w-48" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Skeleton className="h-64 lg:col-span-2" />
        <Skeleton className="h-64" />
      </div>
    </div>
  );

  if (!order) return null;

  const currentStatus = statusConfig[order.status] || statusConfig.DRAFT;

  return (
    <div className="flex flex-col gap-6 py-4 md:gap-8 md:py-6 max-w-7xl mx-auto px-4 lg:px-6 font-sans text-white">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => router.back()} className="h-10 w-10 p-0 border-[#79716b]/30 bg-card hover:bg-[#79716b]/10 transition-colors">
            <IconArrowLeft size={18} />
          </Button>
          <div className="flex flex-col">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-black tracking-tight">{order.number || `OC-${order.id.substring(0, 8)}`}</h1>
              <Badge variant="outline" className={`px-2 py-0.5 font-bold tracking-tight border-none ${currentStatus.color}`}>
                <span className="mr-1.5">{currentStatus.icon}</span>
                {currentStatus.label}
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-widest mt-1">Emitida el {new Date(order.createdAt).toLocaleString("es-VE")}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 print:hidden">
          <Button variant="outline" size="sm" onClick={() => window.print()} className="h-10 gap-2 border-[#79716b]/30 bg-card hover:bg-[#79716b]/10 transition-colors font-bold text-xs uppercase tracking-widest px-5">
            <IconPrinter size={16} /> Imprimir / PDF
          </Button>
          {order.status === 'RECEIVED' && (
             <Button variant="outline" size="sm" className="h-10 gap-2 border-emerald-500/30 bg-emerald-500/5 text-emerald-500 hover:bg-emerald-500/10 transition-colors font-bold text-xs uppercase tracking-widest px-5">
                <IconDownload size={16} /> Ticket de Recepción
             </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* MAIN CONTENT: ITEMS TABLE */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-[#79716b]/20 bg-card/30 overflow-hidden shadow-2xl">
            <CardHeader className="bg-muted border-b border-[#79716b]/30">
              <CardTitle className="text-[11px] font-black uppercase tracking-[0.2em] text-white opacity-70 flex items-center gap-2">
                <IconBox size={14} /> Detalle de Ítems / Stock Solicitado
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/50 border-b border-[#79716b]/20">
                  <TableRow className="hover:bg-transparent border-none">
                    <TableHead className="text-white font-bold text-[10px] uppercase tracking-wider h-12 px-6">Producto / Especificación</TableHead>
                    <TableHead className="text-white font-bold text-[10px] uppercase tracking-wider h-12 text-center">Cant.</TableHead>
                    <TableHead className="text-white font-bold text-[10px] uppercase tracking-wider h-12 text-right">Costo Unit.</TableHead>
                    <TableHead className="text-white font-bold text-[10px] uppercase tracking-wider h-12 text-right px-6">Subtotal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.items.map((item: any) => (
                    <TableRow key={item.id} className="border-b border-[#79716b]/10 hover:bg-[#79716b]/5 transition-colors group">
                      <TableCell className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-white group-hover:text-primary transition-colors">{item.variant.product.name}</span>
                          <span className="text-[10px] text-muted-foreground uppercase font-black tracking-tight mt-1">{item.variant.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center font-black tabular-nums text-sm">{item.quantity}</TableCell>
                      <TableCell className="text-right tabular-nums text-sm text-muted-foreground">USD {item.cost.toFixed(2)}</TableCell>
                      <TableCell className="text-right px-6 font-bold tabular-nums text-sm text-foreground">
                        USD {(item.quantity * item.cost).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
            <CardFooter className="bg-muted/20 border-t border-[#79716b]/30 flex justify-between items-center py-4 px-6">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tabular-nums">{order.items.length} Referencias Únicas</p>
              <div className="flex gap-8">
                <div className="text-right">
                  <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Base Imponible</p>
                  <p className="text-sm font-bold text-white uppercase">USD {order.subtotal.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest text-emerald-400">Total Inversión</p>
                  <p className="text-lg font-black text-white uppercase tabular-nums">USD {order.total.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</p>
                </div>
              </div>
            </CardFooter>
          </Card>
          {order.notes && (
            <Card className="border-[#79716b]/20 bg-card/30 shadow-xl">
               <CardHeader className="py-3 bg-muted/30">
                  <CardTitle className="text-[10px] font-black uppercase tracking-widest text-[#79716b]">Observaciones de la Orden</CardTitle>
               </CardHeader>
               <CardContent className="pt-4 text-sm text-muted-foreground italic leading-relaxed">
                  "{order.notes}"
               </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card className="border-[#79716b]/20 bg-card/30 shadow-xl overflow-hidden">
            <CardHeader className="bg-muted border-b border-[#79716b]/30 py-3">
              <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-white opacity-70">Socio Comercial</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-5">
              <div className="flex items-center gap-4">
                <div className="size-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shrink-0">
                  <IconBuildingStore size={24} />
                </div>
                <div className="flex flex-col overflow-hidden">
                  <span className="text-sm font-black truncate text-white">{order.supplier.name}</span>
                  <span className="text-[10px] text-muted-foreground font-black tracking-widest uppercase mt-1">{order.supplier.taxId || 'SIN RIF'}</span>
                </div>
              </div>
              <Separator className="bg-[#79716b]/20" />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Sucursal Destino</p>
                  <p className="text-xs font-bold text-white mt-1 uppercase">{order.branch?.name}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Crédito</p>
                  <p className="text-xs font-bold text-emerald-400 mt-1 uppercase">{order.supplier.paymentTerms || 'CONTADO'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-[#79716b]/20 bg-card/50 shadow-xl overflow-hidden">
            <CardHeader className="bg-muted border-b border-[#79716b]/30 py-3">
              <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-white opacity-70">Logística y Auditoría</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-6">
                <div className="flex gap-4 relative">
                  <div className="absolute left-[9px] top-6 bottom-0 w-px bg-[#79716b]/30 border-dashed" />
                  <div className={`size-5 rounded-full z-10 shrink-0 flex items-center justify-center ${order.status === 'RECEIVED' ? 'bg-emerald-500' : 'bg-[#79716b]/30'}`}>
                    <IconCircleCheckFilled size={12} className="text-zinc-950" />
                  </div>
                  <div className="flex flex-col">
                    <span className={`text-xs font-black uppercase tracking-tight ${order.status === 'RECEIVED' ? 'text-white' : 'text-muted-foreground'}`}>Mercancía Recibida</span>
                    <span className="text-[10px] text-muted-foreground mt-0.5">{order.status === 'RECEIVED' ? 'Verificado en sistema' : 'Pendiente por recepcionar'}</span>
                  </div>
                </div>
                <div className="flex gap-4 relative">
                  <div className="absolute left-[9px] top-6 bottom-0 w-px bg-[#79716b]/30 border-dashed" />
                  <div className={`size-5 rounded-full z-10 shrink-0 flex items-center justify-center ${order.status === 'SENT' || order.status === 'RECEIVED' ? 'bg-blue-500' : 'bg-[#79716b]/30'}`}>
                    <IconTruck size={12} className="text-zinc-950" />
                  </div>
                  <div className="flex flex-col">
                    <span className={`text-xs font-black uppercase tracking-tight ${order.status === 'SENT' || order.status === 'RECEIVED' ? 'text-white' : 'text-muted-foreground'}`}>Orden Despachada</span>
                    <span className="text-[10px] text-muted-foreground mt-0.5">Esperando llegada a {order.branch?.name}</span>
                  </div>
                </div>
                <div className="flex gap-4 relative">
                  <div className="size-5 rounded-full z-10 shrink-0 flex items-center justify-center bg-white">
                    <IconFileText size={12} className="text-zinc-950" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-black uppercase tracking-tight text-white">Orden Emitida</span>
                    <span className="text-[10px] text-muted-foreground mt-0.5">Registrado por Admin</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          {order.status === 'RECEIVED' && (
            <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10 flex items-start gap-3">
              <IconReceipt className="text-emerald-500 mt-0.5" size={18} />
              <div className="flex flex-col">
                <p className="text-xs font-bold text-emerald-500">Factura de Compra Generada</p>
                <p className="text-[10px] text-emerald-500/60 leading-relaxed mt-1">Se ha creado una cuenta por pagar asociada a esta recepción en el módulo de contabilidad.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PurchaseOrderDetailsPage() {
  return (
    <Suspense fallback={<div className="p-6">Cargando detalles...</div>}>
      <PurchaseOrderDetailContent />
    </Suspense>
  );
}
