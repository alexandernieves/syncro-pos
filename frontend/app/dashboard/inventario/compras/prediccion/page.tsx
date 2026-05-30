"use client";

import React, { useState, useEffect } from "react";
import { API_URL } from "@/lib/constants";
import { 
  Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  IconSparkles, IconArrowLeft, IconLoader2, IconAlertTriangle, IconPackage, IconTrendingUp, IconCash, IconBuildingStore
} from "@tabler/icons-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from "next/navigation";
import { useCurrency } from "@/context/CurrencyContext";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const API = API_URL;

export default function PredictivePurchasesPage() {
  const router = useRouter();
  const { formatPrice } = useCurrency();
  const [predictions, setPredictions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingPo, setCreatingPo] = useState<string | null>(null);

  useEffect(() => {
    fetchPredictions();
  }, []);

  const fetchPredictions = async () => {
    try {
      const token = localStorage.getItem("token");
      const branchId = localStorage.getItem("currentBranchId") || "";
      const res = await fetch(`${API}/ai-agent/predictive-purchases${branchId ? `?branchId=${branchId}` : ""}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        setPredictions(await res.json());
      } else {
        toast.error("Error al cargar predicciones de la IA");
      }
    } catch (error) {
      toast.error("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDraftPO = async (supplierId: string, supplierName: string, items: any[]) => {
    if (supplierId === "no-supplier") {
      toast.error("No se puede crear una orden de compra para productos sin un proveedor asignado. Modifica el proveedor de los productos primero.");
      return;
    }

    try {
      setCreatingPo(supplierId);
      const token = localStorage.getItem("token");
      const branchId = localStorage.getItem("currentBranchId") || "";

      if (!branchId) {
        toast.error("Por favor selecciona una sucursal activa antes de proceder.");
        return;
      }

      const poItems = items.map(item => ({
        variantId: item.variantId,
        quantity: item.suggestedQuantity,
        cost: item.cost
      }));

      const res = await fetch(`${API}/purchase-orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          supplierId,
          branchId,
          items: poItems
        })
      });

      if (res.ok) {
        toast.success(`🤖 ¡Orden de compra borrador creada con éxito para ${supplierName}!`);
        // Remove this supplier from predictions list since we already created its order
        setPredictions(prev => prev.filter(p => p.supplierId !== supplierId));
      } else {
        const err = await res.json();
        toast.error(err.message || "Error al crear orden de compra");
      }
    } catch (error) {
      toast.error("Error de conexión al servidor");
    } finally {
      setCreatingPo(null);
    }
  };

  // Metricas
  const kpis = React.useMemo(() => {
    let totalItems = 0;
    let totalInvestment = 0;
    const suppliersCount = predictions.filter(p => p.supplierId !== 'no-supplier').length;

    predictions.forEach(group => {
      group.items.forEach((item: any) => {
        totalItems += item.suggestedQuantity;
        totalInvestment += item.totalCost;
      });
    });

    return { totalItems, totalInvestment, suppliersCount };
  }, [predictions]);

  return (
    <div className="flex flex-col gap-6 py-4 md:gap-8 md:py-6 font-sans max-w-7xl mx-auto w-full px-4 lg:px-6">
      
      {/* Header with back button */}
      <div className="flex flex-col gap-2">
        <button 
          onClick={() => router.push('/dashboard/inventario/compras')} 
          className="flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors max-w-max uppercase tracking-wider"
        >
          <IconArrowLeft size={14} /> Volver a compras
        </button>
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <IconSparkles size={20} className="text-white animate-pulse" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">Predicción de Compras Inteligente</h1>
            <p className="text-sm text-muted-foreground font-medium">Algoritmo predictivo contable que analiza la velocidad de ventas de los últimos 30 días y sugiere órdenes de reabastecimiento.</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 w-full rounded-2xl" />)}
          </div>
          <Skeleton className="h-96 w-full rounded-2xl" />
        </div>
      ) : predictions.length === 0 ? (
        <Card className="border-[#79716b]/20 bg-zinc-950/40 backdrop-blur-md p-8 text-center flex flex-col items-center justify-center gap-4">
          <div className="size-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
            <IconPackage size={24} />
          </div>
          <div>
            <CardTitle className="text-lg font-bold text-white">¡Inventario Perfectamente Abastecido!</CardTitle>
            <CardDescription className="text-sm max-w-md mx-auto mt-1">
              La IA no detecta ningún producto con stock crítico o velocidad de venta insatisfecha para los próximos 14 días. ¡Excelente gestión de inventario!
            </CardDescription>
          </div>
          <Button onClick={() => router.push('/dashboard/inventario/compras')} className="mt-2 text-xs font-bold uppercase tracking-wider">
            Regresar a Compras
          </Button>
        </Card>
      ) : (
        <div className="space-y-6">
          
          {/* KPI Dashboard */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            <Card className="bg-gradient-to-t from-violet-600/5 to-card border-violet-500/10 shadow-lg backdrop-blur-xs">
              <CardHeader className="pb-2">
                <CardDescription className="text-[10px] font-black uppercase tracking-widest text-violet-400 opacity-80">Presupuesto Estimado</CardDescription>
                <CardTitle className="text-2xl font-black text-white tabular-nums mt-1">
                  {formatPrice(kpis.totalInvestment)}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-[11px] text-muted-foreground font-medium pt-0">
                Inversión requerida sugerida en stock óptimo.
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-t from-indigo-600/5 to-card border-indigo-500/10 shadow-lg backdrop-blur-xs">
              <CardHeader className="pb-2">
                <CardDescription className="text-[10px] font-black uppercase tracking-widest text-indigo-400 opacity-80">Volumen Sugerido</CardDescription>
                <CardTitle className="text-2xl font-black text-white tabular-nums mt-1">
                  {kpis.totalItems} unidades
                </CardTitle>
              </CardHeader>
              <CardContent className="text-[11px] text-muted-foreground font-medium pt-0">
                Cantidad total de productos proyectados a reabastecer.
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-t from-amber-600/5 to-card border-amber-500/10 shadow-lg backdrop-blur-xs">
              <CardHeader className="pb-2">
                <CardDescription className="text-[10px] font-black uppercase tracking-widest text-amber-400 opacity-80">Proveedores Involucrados</CardDescription>
                <CardTitle className="text-2xl font-black text-white tabular-nums mt-1">
                  {kpis.suppliersCount} proveedores
                </CardTitle>
              </CardHeader>
              <CardContent className="text-[11px] text-muted-foreground font-medium pt-0">
                Diferentes abastecedores con productos a solicitar.
              </CardContent>
            </Card>
          </div>

          {/* Warnings block */}
          <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/10 flex gap-3 shadow-inner">
             <IconAlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
             <div className="space-y-0.5">
                <p className="text-xs font-bold text-amber-500">¿Cómo calcula la IA estas predicciones?</p>
                <p className="text-[11px] text-amber-500/80 font-medium leading-relaxed">
                   Nuestra IA audita la velocidad de venta individual de cada variante basándose en la facturación real del POS de los últimos 30 días. Si detecta que a una variante le quedan menos de 10 días de stock a su ritmo de venta habitual, o que ha tocado su stock mínimo establecido, calcula y sugiere la compra de unidades necesarias para cubrir la demanda de las siguientes 2 semanas completas.
                </p>
             </div>
          </div>

          {/* Supplier Groups predictions list */}
          <div className="space-y-8">
            {predictions.map((group) => {
              const isSupplierValid = group.supplierId !== 'no-supplier';
              return (
                <Card key={group.supplierId} className="border-[#79716b]/20 bg-zinc-950/30 backdrop-blur-sm shadow-xl overflow-hidden">
                  
                  {/* Card Header for Supplier Group */}
                  <div className="p-4 border-b border-[#79716b]/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-zinc-950/40">
                    <div className="flex items-center gap-3">
                      <div className="size-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/10">
                        <IconBuildingStore size={16} />
                      </div>
                      <div>
                        <h3 className="text-sm font-extrabold text-white tracking-tight">{group.supplierName}</h3>
                        <p className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase">
                          {group.items.length} {group.items.length === 1 ? 'Producto Sugerido' : 'Productos Sugeridos'}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                      <div className="text-right">
                        <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest block leading-none">Costo Total Sugerido</span>
                        <span className="text-sm font-black text-white tabular-nums mt-0.5 block">{formatPrice(group.totalCost)}</span>
                      </div>
                      
                      {isSupplierValid ? (
                        <Button 
                          onClick={() => handleCreateDraftPO(group.supplierId, group.supplierName, group.items)}
                          disabled={creatingPo === group.supplierId}
                          className="h-9 px-4 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-black uppercase text-[10px] tracking-wider shadow-md shrink-0 gap-1.5"
                        >
                          {creatingPo === group.supplierId ? (
                            <>
                              <IconLoader2 size={12} className="animate-spin" /> Procesando...
                            </>
                          ) : (
                            <>
                              <IconSparkles size={12} /> Sugerir Borrador OC
                            </>
                          )}
                        </Button>
                      ) : (
                        <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground bg-muted/40 px-3 py-1.5 rounded-lg border border-transparent">
                          Asignar Proveedor en POS
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Suggested Items Table */}
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-zinc-950/20 border-b border-[#79716b]/10">
                        <TableRow className="border-[#79716b]/10 hover:bg-transparent">
                          <TableHead className="text-[10px] font-black uppercase tracking-wider text-white h-10">Producto</TableHead>
                          <TableHead className="text-[10px] font-black uppercase tracking-wider text-white h-10 text-center">SKU</TableHead>
                          <TableHead className="text-[10px] font-black uppercase tracking-wider text-white h-10 text-center">Stock Actual</TableHead>
                          <TableHead className="text-[10px] font-black uppercase tracking-wider text-white h-10 text-center">Ritmo Ventas (Día)</TableHead>
                          <TableHead className="text-[10px] font-black uppercase tracking-wider text-white h-10 text-center">Cobertura (Días)</TableHead>
                          <TableHead className="text-[10px] font-black uppercase tracking-wider text-white h-10 text-center bg-violet-600/5">Cantidad IA</TableHead>
                          <TableHead className="text-[10px] font-black uppercase tracking-wider text-white h-10 text-right">Costo Unit.</TableHead>
                          <TableHead className="text-[10px] font-black uppercase tracking-wider text-white h-10 text-right">Inversión Est.</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {group.items.map((item: any) => (
                          <TableRow key={item.variantId} className="border-[#79716b]/10 hover:bg-white/2 bg-transparent transition-colors">
                            
                            {/* Product & Variant */}
                            <TableCell className="py-3">
                              <p className="text-xs font-bold text-white leading-tight">{item.productName}</p>
                              <p className="text-[10px] text-muted-foreground font-semibold uppercase mt-0.5">{item.variantName}</p>
                            </TableCell>

                            {/* SKU */}
                            <TableCell className="text-center font-mono text-[10px] text-muted-foreground">{item.sku}</TableCell>

                            {/* Stock vs Min */}
                            <TableCell className="text-center">
                              <span className={`text-xs font-bold ${item.currentStock <= item.minStock ? 'text-red-500 font-extrabold animate-pulse' : 'text-white'}`}>
                                {item.currentStock}
                              </span>
                              <span className="text-[10px] text-muted-foreground font-semibold"> / {item.minStock} mín</span>
                            </TableCell>

                            {/* Sales velocity */}
                            <TableCell className="text-center font-semibold text-xs text-foreground">
                              {item.salesVelocityDaily > 0 ? (
                                <span className="flex items-center justify-center gap-0.5 text-emerald-500 font-bold">
                                  <IconTrendingUp size={11} /> {item.salesVelocityDaily}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">0</span>
                              )}
                            </TableCell>

                            {/* Remaining Days of stock */}
                            <TableCell className="text-center">
                              {item.daysOfStockRemaining === 'N/A' ? (
                                <span className="text-[10px] font-black text-muted-foreground uppercase">Estable</span>
                              ) : (
                                <span className={`text-xs font-extrabold px-1.5 py-0.5 rounded-md ${item.daysOfStockRemaining <= 3 ? 'bg-red-500/10 text-red-500 border border-red-500/20' : item.daysOfStockRemaining <= 7 ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 'text-white'}`}>
                                  {item.daysOfStockRemaining} días
                                </span>
                              )}
                            </TableCell>

                            {/* Suggested Quantity */}
                            <TableCell className="text-center font-black text-sm text-indigo-400 bg-violet-600/5 select-none">
                              +{item.suggestedQuantity}
                            </TableCell>

                            {/* Cost */}
                            <TableCell className="text-right font-semibold text-xs tabular-nums text-muted-foreground">
                              {formatPrice(item.cost)}
                            </TableCell>

                            {/* Total Cost */}
                            <TableCell className="text-right font-extrabold text-xs tabular-nums text-white">
                              {formatPrice(item.totalCost)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              )
            })}
          </div>
        </div>
      )}
    </div>
  );
}
