"use client";

import React, { useState, useEffect } from "react";
import { 
  Card, CardContent, CardHeader, CardTitle, CardDescription, CardAction 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  IconClipboardCheck, IconQrcode, IconDeviceFloppy, IconReload, IconSearch, IconFilter, IconChecklist, IconAlertTriangle
} from "@tabler/icons-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { UniversalTable } from "@/components/universal-table";
import { conteoColumns } from "@/components/conteo-columns";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000";

export default function ConteoPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/products`);
      if (res.ok) {
        setProducts(await res.json());
      }
    } catch (error) {
      toast.error("Error al cargar productos");
    } finally {
      setLoading(false);
    }
  };

  const allVariants = products.flatMap(p => p.variants || []);

  const tableData = React.useMemo(() => {
    return allVariants.map((v: any, index: number) => {
      const stock = v.stock || 0;
      let status = "En Stock";
      if (stock === 0) status = "Sin Stock";
      else if (stock <= 5) status = "Stock Bajo";

      return {
        id: v.id || index,
        header: v.name,
        type: v.sku || "N/A",
        status: status,
        target: `${stock} UNI`,
        limit: "",
        reviewer: "--"
      };
    });
  }, [allVariants]);

  return (
    <div className="flex flex-col gap-6 py-4 md:gap-8 md:py-6 font-sans">
      
      {/* Header Info - Audit Control */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 px-4 lg:px-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <IconClipboardCheck size={24} className="text-primary" /> Conteo de Inventario
          </h1>
          <p className="text-sm text-muted-foreground font-medium">Auditoría física de existencias para conciliación de stocks.</p>
        </div>
        <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2 h-9 shadow-sm" onClick={fetchProducts}>
                <IconReload size={16} /> 
                <span className="hidden lg:inline">Recargar Listado</span>
            </Button>
            <Button size="sm" className="gap-2 h-9 shadow-md font-bold">
                <IconDeviceFloppy size={16} />
                <span>Finalizar Auditoría</span>
            </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 px-4 lg:px-6">
          <div className="lg:col-span-3 space-y-4">
            <div className="flex items-center justify-between mb-2">
                <div className="relative w-full max-w-[400px]">
                    <IconSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input 
                        placeholder="Escanear código o buscar variante..." 
                        className="h-9 pl-9 bg-muted/30 border-none shadow-none text-xs focus-visible:ring-1 focus-visible:ring-primary/20"
                    />
                </div>
                <Button variant="ghost" size="sm" className="gap-2 text-xs font-bold text-muted-foreground">
                    <IconFilter size={14} /> Filtrar por categoría
                </Button>
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
                    columns={conteoColumns}
                    tabs={{
                        outline: "Conteo",
                        pastPerformance: "Historial",
                        keyPersonnel: "Diferencias",
                        focusDocuments: "Reportes"
                    }}
                />
              )}
            </div>
          </div>

          <div className="space-y-6">
              <Card className="shadow-none border-dashed bg-muted/20">
                  <CardHeader>
                      <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <IconChecklist size={16} /> Resumen de Auditoría
                      </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                      <div className="flex justify-between items-center text-xs font-medium">
                          <span className="text-muted-foreground">Ítems Auditados:</span>
                          <span className="font-bold">0 / {allVariants.length}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs font-medium">
                          <span className="text-muted-foreground">Diferencias Totales:</span>
                          <span className="font-bold text-rose-600">$0.00</span>
                      </div>
                      <div className="h-px bg-muted" />
                      <div className="flex items-start gap-2 text-[10px] text-muted-foreground leading-relaxed italic">
                          <IconAlertTriangle size={14} className="shrink-0 mt-0.5" />
                          <span>Los ajustes manuales se reflejarán automáticamente en el Kardex al finalizar.</span>
                      </div>
                  </CardContent>
              </Card>

              <Button variant="outline" className="w-full h-11 border-dashed hover:border-primary/50 hover:bg-primary/5 transition-all text-sm font-bold gap-2">
                  <IconQrcode size={18} /> Modo Escáner (QR)
              </Button>
          </div>
      </div>

    </div>
  );
}
