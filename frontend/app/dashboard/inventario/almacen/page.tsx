"use client";

import React, { useState, useEffect, useMemo } from "react";
import { 
  Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription, CardAction 
} from "@/components/ui/card";
import { 
  IconTrendingUp, IconTrendingDown, IconCheck, IconRefresh, IconLoader, IconDatabase
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { UniversalTable } from "@/components/universal-table";
import { inventoryColumns } from "@/components/inventory-columns";

import { db } from "@/lib/db";
import { useSync } from "@/hooks/useSync";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000";

export default function AlmacenPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMainBranch, setIsMainBranch] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const { pullRemoteData } = useSync();

  const load = React.useCallback(async () => {
    setLoading(true);
    // 1. Cargar locales (Offline-First)
    const localProducts = await db.products.toArray();
    if (localProducts.length > 0) {
      setProducts(localProducts as any);
      setLoading(false);
    }

    // 2. Sincronizar con Postgres
    if (navigator.onLine) {
      await pullRemoteData();
      const updated = await db.products.toArray();
      setProducts(updated as any);
    }
    setLoading(false);
  }, [pullRemoteData]);

  useEffect(() => {
    load();
    
    // Check if current branch is main
    const branchId = localStorage.getItem("currentBranchId");
    if (branchId) {
      fetch(`${API}/branches/${branchId}`)
        .then(res => res.json())
        .then(data => setIsMainBranch(data.isMain))
        .catch(() => setIsMainBranch(false));
    }
  }, [load]);

  const handleSyncMaster = async () => {
    const branchId = localStorage.getItem("currentBranchId");
    if (!branchId) return;

    setSyncing(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/inventory/sync-master`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ branchId })
      });

      if (res.ok) {
        const data = await res.json();
        toast.success(`Sincronización completada. Se crearon ${data.createdCount} nuevos registros.`);
        load();
      } else {
        const error = await res.json();
        toast.error(error.message || "Error al sincronizar");
      }
    } catch (error) {
      toast.error("Error de conexión");
    } finally {
      setSyncing(false);
    }
  };

  const fetchProducts = load;

  const tableData = useMemo(() => {
    return products.flatMap(p => 
      (p.variants || []).map((v: any) => {
        const stock = v.stock || 0;
        const minStock = v.minStock || 5;
        let status = "En Stock";
        if (stock === 0) status = "Sin Stock";
        else if (stock <= minStock) status = "Stock Bajo";

        return {
          id: v.id || `${p.id}-${v.name}`,
          productId: p.id,
          header: `${p.name} - ${v.name}`,
          type: v.sku || "N/A",
          status: status,
          target: stock.toString(),
          limit: minStock.toString(),
          reviewer: p.category?.name || "General",
          image: p.image
        };
      })
    );
  }, [products]);

  const stats = useMemo(() => {
    const totalItems = tableData.length;
    const lowStock = tableData.filter(d => d.status === "Stock Bajo").length;
    const outOfStock = tableData.filter(d => d.status === "Sin Stock").length;
    const totalValue = products.reduce((acc, p) => acc + (p.variants?.reduce((vacc: number, v: any) => vacc + (v.stock || 0) * (v.price || 0), 0) || 0), 0);
    
    return {
      total: totalItems,
      alerts: lowStock + outOfStock,
      value: totalValue
    };
  }, [tableData, products]);

  return (
    <div className="flex flex-col gap-6 py-4 md:gap-8 md:py-6 font-sans">
      
      {/* Metrics Header */}
      <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-3">
          <Card className="@container/card bg-gradient-to-t from-primary/5 to-card shadow-xs">
            <CardHeader>
              <CardDescription>Valor del Almacén</CardDescription>
              <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                ${stats.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </CardTitle>
              <CardAction>
                <Badge variant="outline" className="gap-1">
                  <IconTrendingUp className="size-3 text-emerald-500" />
                  +2.4%
                </Badge>
              </CardAction>
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1.5 text-sm">
              <div className="line-clamp-1 flex gap-2 font-medium">
                Incremento de stock este mes
              </div>
              <div className="text-muted-foreground">
                Basado en ingresos recientes
              </div>
            </CardFooter>
          </Card>

          <Card className="@container/card bg-gradient-to-t from-primary/5 to-card shadow-xs">
            <CardHeader>
              <CardDescription>Alertas de Stock</CardDescription>
              <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl text-rose-600">
                {stats.alerts}
              </CardTitle>
              <CardAction>
                <Badge variant="outline" className="gap-1 text-rose-600 border-rose-500/20 bg-rose-500/5">
                  <IconTrendingDown className="size-3 text-rose-500" />
                  Crítico
                </Badge>
              </CardAction>
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1.5 text-sm">
              <div className="line-clamp-1 flex gap-2 font-medium text-rose-600">
                Variantes que requieren atención
              </div>
              <div className="text-muted-foreground">
                Reabastecimiento sugerido
              </div>
            </CardFooter>
          </Card>

          <Card className="@container/card bg-gradient-to-t from-primary/5 to-card shadow-xs">
            <CardHeader>
              <CardDescription>Variantes Activas</CardDescription>
              <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                {stats.total}
              </CardTitle>
              <CardAction>
                <Badge variant="outline" className="gap-1">
                  <IconCheck className="size-3 text-emerald-500" />
                  Verificado
                </Badge>
              </CardAction>
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1.5 text-sm">
              <div className="line-clamp-1 flex gap-2 font-medium">
                Catálogo operativo vigente
              </div>
              <div className="text-muted-foreground">
                Sincronización completada
              </div>
            </CardFooter>
          </Card>
      </div>

      <div className="px-4 lg:px-6 space-y-2">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-foreground uppercase">Gestión de Inventario</h2>
                <p className="text-sm text-muted-foreground font-medium">Control avanzado de existencias, variantes técnicas y parámetros de reabastecimiento.</p>
              </div>
              
              {isMainBranch && (
                <Button 
                  onClick={handleSyncMaster} 
                  disabled={syncing}
                  variant="outline" 
                  className="gap-2 font-bold shadow-sm h-10 border-primary/20 hover:border-primary/50"
                >
                  {syncing ? <IconLoader className="animate-spin" size={18} /> : <IconDatabase size={18} />}
                  <span>{syncing ? "Sincronizando..." : "Sincronizar Catálogo Maestro"}</span>
                </Button>
              )}
          </div>

          <div className="w-full">
              {loading ? (
                  <div className="space-y-4">
                      <Skeleton className="h-10 w-full rounded-xl" />
                      <Skeleton className="h-[400px] w-full rounded-2xl" />
                  </div>
              ) : (
                  <UniversalTable 
                    data={tableData} 
                    columns={inventoryColumns}
                    tabs={{
                        outline: "Existencias",
                        pastPerformance: "Movimientos",
                        keyPersonnel: "Alertas",
                        focusDocuments: "Reportes"
                    }}
                />
              )}
          </div>
      </div>
    </div>
  );
}
