"use client";

import React, { useState, useEffect, useCallback } from "react";
import { API_URL } from "@/lib/constants"
import { 
  Card, CardContent, CardHeader, CardTitle, CardDescription 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  IconClipboardCheck, 
  IconReload, 
  IconDeviceFloppy, 
  IconSearch, 
  IconFilter, 
  IconChecklist, 
  IconAlertTriangle,
  IconQrcode,
  IconLoader
} from "@tabler/icons-react";
import { UniversalTable } from "@/components/universal-table";
import { conteoColumns } from "@/components/conteo-columns";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { movementsColumns } from "@/components/movements-columns";

const API = process.env.NEXT_PUBLIC_API_URL || `${API_URL}`;

export default function ConteoPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [auditData, setAuditData] = useState<any[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [categories, setCategories] = useState<any[]>([]);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const branchId = localStorage.getItem("currentBranchId") || "";
      const [prodRes, catRes, movRes] = await Promise.all([
        fetch(`${API}/products${branchId ? `?branchId=${branchId}` : ""}`),
        fetch(`${API}/categories`),
        fetch(`${API}/inventory/movements${branchId ? `?branchId=${branchId}` : ""}`)
      ]);

      if (prodRes.ok) {
        const data = await prodRes.json();
        setProducts(data);
        
        // Initialize audit data
        const variants = data.flatMap((p: any) => p.variants.map((v: any) => ({
          id: v.id,
          header: p.name + (v.name !== 'Default' ? ` - ${v.name}` : ''),
          type: v.sku || "N/A",
          status: v.stock === 0 ? "Agotado" : v.stock <= (v.minStock || 5) ? "Stock Bajo" : "En Stock",
          target: v.stock,
          limit: v.stock, 
          reviewer: "0",
          categoryId: p.categoryId
        })));
        setAuditData(variants);
      }

      if (catRes.ok) {
        setCategories(await catRes.json());
      }

      if (movRes.ok) {
        setMovements(await movRes.json());
      }
    } catch (error) {
      toast.error("Error al cargar datos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const updateCount = (id: string, value: number) => {
    setAuditData(prev => prev.map(item => {
      if (item.id === id) {
        const diff = value - item.target;
        return {
          ...item,
          limit: value,
          reviewer: diff > 0 ? `+${diff}` : `${diff}`
        };
      }
      return item;
    }));
  };

  const handleFinishAudit = async () => {
    const branchId = localStorage.getItem("currentBranchId");
    if (!branchId) return;

    // Only send items that have a difference
    const adjustments = auditData
      .filter(item => parseInt(item.reviewer) !== 0)
      .map(item => ({
        variantId: item.id,
        quantity: item.limit
      }));

    if (adjustments.length === 0) {
      toast.info("No se detectaron diferencias para ajustar.");
      return;
    }

    setIsSubmitting(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/inventory/reconcile`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          branchId,
          items: adjustments
        })
      });

      if (res.ok) {
        toast.success("Auditoría finalizada con éxito. Inventario actualizado.");
        fetchProducts();
      } else {
        toast.error("Error al finalizar la auditoría");
      }
    } catch (error) {
      toast.error("Error de conexión");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredData = auditData.filter(item => {
    const matchesSearch = item.header.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         item.type.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "all" || item.categoryId === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const differencesData = auditData.filter(item => parseInt(item.reviewer) !== 0);

  const totalDifferences = auditData.reduce((acc, item) => acc + Math.abs(parseInt(item.reviewer) || 0), 0);
  const itemsAudited = auditData.filter(item => parseInt(item.reviewer) !== 0).length;

  const stockStats = {
    enStock: auditData.filter(i => i.status === "En Stock").length,
    bajo: auditData.filter(i => i.status === "Stock Bajo").length,
    agotado: auditData.filter(i => i.status === "Agotado").length,
  };

  return (
    <div className="flex flex-col gap-6 py-4 md:gap-8 md:py-6 font-sans">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 px-4 lg:px-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <IconClipboardCheck size={24} className="text-primary" /> Conteo de Inventario
          </h1>
          <p className="text-sm text-muted-foreground font-medium">Auditoría física de existencias para conciliación de stocks.</p>
        </div>
        <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2 h-9 shadow-sm" onClick={fetchProducts} disabled={loading}>
                <IconReload size={16} /> 
                <span className="hidden lg:inline">Recargar Listado</span>
            </Button>
            <Button 
              size="sm" 
              className="gap-2 h-9 shadow-md font-bold" 
              onClick={handleFinishAudit} 
              disabled={isSubmitting || loading}
            >
                {isSubmitting ? <IconLoader className="animate-spin" size={16} /> : <IconDeviceFloppy size={16} />}
                <span>{isSubmitting ? "Procesando..." : "Finalizar Auditoría"}</span>
            </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 px-4 lg:px-6">
          <div className="lg:col-span-3 space-y-4">
            <div className="flex items-center justify-between mb-2 gap-4">
                <div className="relative w-full max-w-[400px]">
                    <IconSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input 
                        placeholder="Escanear código o buscar variante..." 
                        className="h-9 pl-9 bg-muted/30 border-none shadow-none text-xs focus-visible:ring-1 focus-visible:ring-primary/20"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-[200px] h-9 text-xs border-none bg-muted/30 shadow-none">
                    <div className="flex items-center gap-2">
                      <IconFilter size={14} className="text-muted-foreground" />
                      <SelectValue placeholder="Categoría" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las categorías</SelectItem>
                    {categories.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
            </div>

            <div className="w-full">
              {loading ? (
                  <div className="space-y-4">
                      <Skeleton className="h-10 w-full rounded-xl" />
                      <Skeleton className="h-[400px] w-full rounded-2xl" />
                  </div>
              ) : (
                  <UniversalTable 
                    data={filteredData} 
                    columns={conteoColumns}
                    updateData={updateCount}
                    hideAddButton={true}
                    tabs={{
                        outline: "Conteo",
                        pastPerformance: "Historial",
                        keyPersonnel: "Diferencias",
                        focusDocuments: "Reportes"
                    }}
                    customTabsContent={{
                      pastPerformance: (
                        <div className="mt-4">
                          <UniversalTable 
                            data={movements.map(m => ({ ...m, id: m.id }))} 
                            columns={movementsColumns}
                            hideAddButton={true}
                            hideHeader={true}
                          />
                        </div>
                      ),
                      keyPersonnel: (
                        <div className="mt-4">
                          <UniversalTable 
                            data={differencesData} 
                            columns={conteoColumns}
                            updateData={updateCount}
                            hideAddButton={true}
                            hideHeader={true}
                          />
                        </div>
                      ),
                      focusDocuments: (
                        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                           <Card className="shadow-none border-dashed bg-emerald-500/5">
                              <CardContent className="pt-6 text-center space-y-2">
                                <div className="text-3xl font-bold text-emerald-600">{stockStats.enStock}</div>
                                <div className="text-xs font-medium text-emerald-600/70 uppercase">Productos en Stock</div>
                              </CardContent>
                           </Card>
                           <Card className="shadow-none border-dashed bg-amber-500/5">
                              <CardContent className="pt-6 text-center space-y-2">
                                <div className="text-3xl font-bold text-amber-600">{stockStats.bajo}</div>
                                <div className="text-xs font-medium text-amber-600/70 uppercase">Stock Bajo</div>
                              </CardContent>
                           </Card>
                           <Card className="shadow-none border-dashed bg-rose-500/5">
                              <CardContent className="pt-6 text-center space-y-2">
                                <div className="text-3xl font-bold text-rose-600">{stockStats.agotado}</div>
                                <div className="text-xs font-medium text-rose-600/70 uppercase">Productos Agotados</div>
                              </CardContent>
                           </Card>
                        </div>
                      )
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
                          <span className="font-bold">{itemsAudited} / {auditData.length}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs font-medium">
                          <span className="text-muted-foreground">Diferencias Totales:</span>
                          <span className={`font-bold ${totalDifferences > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                            {totalDifferences} unidades
                          </span>
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
