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
      const res = await fetch(`${API}/purchase-orders`, {
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

  const handleReceive = async (id: string) => {
    if (!confirm("¿Confirma la recepción de esta mercancía? El stock se actualizará automáticamente.")) return;
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/purchase-orders/${id}/receive`, {
        method: "POST",
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        toast.success("Mercancía recibida e inventario actualizado");
        fetchOrders();
      } else {
        const err = await res.json();
        toast.error(err.message || "Error al recibir");
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
        name: order.branch.name
      }),
      total: JSON.stringify({
        formattedTotal: formatCurrency(order.total)
      }),
      status: JSON.stringify({
        status: order.status
      }),
      createdAt: new Date(order.createdAt).toLocaleDateString("es-VE"),
      raw: order
    }));
  }, [orders]);

  const stats = React.useMemo(() => {
    const pending = orders.filter(o => o.status === 'SENT' || o.status === 'DRAFT').length;
    const totalMonth = orders
      .filter(o => o.status === 'RECEIVED' && new Date(o.createdAt).getMonth() === new Date().getMonth())
      .reduce((acc, curr) => acc + curr.total, 0);
    
    return { pending, totalMonth };
  }, [orders]);

  return (
    <div className="flex flex-col gap-6 py-4 md:gap-8 md:py-6 font-sans">
      <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Metrica 1: OC Pendientes */}
        <Card className="@container/card bg-gradient-to-t from-primary/5 to-card shadow-xs">
          <CardHeader>
            <CardDescription>OC Pendientes</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {stats.pending}
            </CardTitle>
            <CardAction>
              <Badge variant="outline" className="gap-1 animate-pulse">
                <IconClock className="size-3 text-amber-500" />
                En Proceso
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 flex gap-2 font-medium">
              Por recibir mercancía
            </div>
          </CardFooter>
        </Card>

        {/* Metrica 2: Inversión Mes */}
        <Card className="@container/card bg-gradient-to-t from-primary/5 to-card shadow-xs">
          <CardHeader>
            <CardDescription>Inversión del Mes</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {formatCurrency(stats.totalMonth)}
            </CardTitle>
            <CardAction>
              <Badge variant="outline" className="gap-1 text-emerald-600">
                <IconTrendingUp className="size-3" />
                Capitalizado
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 flex gap-2 font-medium">
              Compras liquidadas 
            </div>
          </CardFooter>
        </Card>

        {/* Metrica 3: Proveedores */}
        <Card className="@container/card bg-gradient-to-t from-primary/5 to-card shadow-xs">
          <CardHeader>
            <CardDescription>Control de Carga</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {orders.filter(o => o.status === 'RECEIVED').length}
            </CardTitle>
            <CardAction>
              <Badge variant="outline" className="gap-1">
                <IconBox className="size-3 text-blue-500" />
                Auditado
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 flex gap-2 font-medium">
              Recepciones exitosas
            </div>
          </CardFooter>
        </Card>

        {/* Metrica 4: Cumplimiento */}
        <Card className="@container/card bg-gradient-to-t from-primary/5 to-card shadow-xs">
          <CardHeader>
            <CardDescription>Variación de Costos</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              +1.2%
            </CardTitle>
            <CardAction>
              <Badge variant="outline" className="gap-1">
                <IconAlertTriangle className="size-3 text-rose-500" />
                Inflación
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 flex gap-2 font-medium">
              Tendencia de mercado
            </div>
          </CardFooter>
        </Card>
      </div>

      <div className="flex items-center justify-between px-4 lg:px-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight">Órdenes de Compra</h1>
          <p className="text-sm text-muted-foreground font-medium">Gestión de procura, abastecimiento y recepción de inventario.</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-9 shadow-none">
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
            columns={getPurchaseOrdersColumns(handleReceive, handleDelete) as any}
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
                  columns={getPurchaseOrdersColumns(handleReceive, handleDelete) as any}
                />
              ),
              keyPersonnel: (
                <UniversalTable 
                  hideHeader={true}
                  data={tableData.filter(d => JSON.parse(d.status).status === 'RECEIVED')}
                  columns={getPurchaseOrdersColumns(handleReceive, handleDelete) as any}
                />
              ),
              focusDocuments: (
                <UniversalTable 
                  hideHeader={true}
                  data={tableData.filter(d => JSON.parse(d.status).status === 'CANCELLED')}
                  columns={getPurchaseOrdersColumns(handleReceive, handleDelete) as any}
                />
              )
            }}
          />
        )}
      </div>
    </div>
  );
}
