"use client";

import React, { useState, useEffect, useMemo } from "react";
import { 
  Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription, CardAction 
} from "@/components/ui/card";
import { 
  IconTrendingUp, IconTrendingDown, IconCheck 
} from "@tabler/icons-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { UniversalTable } from "@/components/universal-table";
import { inventoryColumns } from "@/components/inventory-columns";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000";

export default function AlmacenPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const res = await fetch(`${API}/products`);
      if (res.ok) {
        setProducts(await res.json());
      }
    } catch (error) {
      toast.error("Error al cargar inventario");
    } finally {
      setLoading(false);
    }
  };

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
      <div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:px-6 md:grid-cols-2 lg:grid-cols-3 dark:*:data-[slot=card]:bg-card">
          <Card className="@container/card shadow-sm border-none bg-white dark:bg-zinc-900 rounded-2xl">
            <CardHeader>
              <CardDescription className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">Valor del Almacén</CardDescription>
              <CardTitle className="text-2xl font-bold tabular-nums @[250px]/card:text-3xl">
                ${stats.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </CardTitle>
              <CardAction>
                <Badge variant="outline" className="gap-1 border-emerald-500/20 text-emerald-600 bg-emerald-500/5 font-bold">
                  <IconTrendingUp size={12} />
                  +2.4%
                </Badge>
              </CardAction>
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1 text-[10px] pb-5">
              <div className="line-clamp-1 flex gap-2 font-bold text-muted-foreground uppercase tracking-tight">
                Incremento de stock este mes <IconTrendingUp className="size-3 text-emerald-500" />
              </div>
            </CardFooter>
          </Card>

          <Card className="@container/card shadow-sm border-none bg-white dark:bg-zinc-900 rounded-2xl">
            <CardHeader>
              <CardDescription className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">Alertas de Stock</CardDescription>
              <CardTitle className="text-2xl font-bold tabular-nums @[250px]/card:text-3xl text-rose-600">
                {stats.alerts}
              </CardTitle>
              <CardAction>
                <Badge variant="outline" className="gap-1 border-rose-500/20 text-rose-600 bg-rose-500/5 font-bold">
                  <IconTrendingDown size={12} />
                  Crítico
                </Badge>
              </CardAction>
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1 text-[10px] pb-5">
              <div className="line-clamp-1 flex gap-2 font-bold text-muted-foreground uppercase tracking-tight">
                Variantes que requieren atención <IconTrendingDown className="size-3 text-rose-500" />
              </div>
            </CardFooter>
          </Card>

          <Card className="@container/card shadow-sm border-none bg-white dark:bg-zinc-900 rounded-2xl hidden lg:flex">
            <CardHeader>
              <CardDescription className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">Variantes Activas</CardDescription>
              <CardTitle className="text-2xl font-bold tabular-nums @[250px]/card:text-3xl text-primary">
                {stats.total}
              </CardTitle>
              <CardAction>
                <Badge variant="outline" className="gap-1 border-primary/20 text-primary bg-primary/5 font-bold">
                  <IconCheck size={12} />
                  Verificado
                </Badge>
              </CardAction>
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1 text-[10px] pb-5">
              <div className="line-clamp-1 flex gap-2 font-bold text-muted-foreground uppercase tracking-tight">
                Catálogo operativo vigente <IconCheck className="size-3 text-primary" />
              </div>
            </CardFooter>
          </Card>
      </div>

      <div className="px-4 lg:px-6 space-y-2">
          <div className="flex flex-col gap-1 mb-6">
              <h2 className="text-xl font-bold tracking-tight text-foreground uppercase">Gestión de Inventario</h2>
              <p className="text-sm text-muted-foreground font-medium">Control avanzado de existencias, variantes técnicas y parámetros de reabastecimiento.</p>
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
                        focusDocuments: "Documentos"
                    }}
                />
              )}
          </div>
      </div>
    </div>
  );
}
