"use client";

import React, { useState, useEffect, useCallback } from "react";
import { 
  Card, CardContent, CardHeader, CardTitle, CardDescription 
} from "@/components/ui/card";
import { 
  Button 
} from "@/components/ui/button";
import { 
  Badge 
} from "@/components/ui/badge";
import { 
  IconPlus, IconArrowRight, IconCheck, IconX, IconTruck, IconPackage, IconBuilding
} from "@tabler/icons-react";
import { toast } from "sonner";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription 
} from "@/components/ui/dialog";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { db } from "@/lib/db";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000";

export default function TrasladosPage() {
  const [transfers, setTransfers] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  
  // Create form state
  const [targetBranchId, setTargetBranchId] = useState("");
  const [selectedItems, setSelectedItems] = useState<{variantId: string, quantity: number, name: string, stock: number}[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentBranchId = typeof window !== 'undefined' ? localStorage.getItem("currentBranchId") : "";

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const [transRes, branchesRes] = await Promise.all([
        fetch(`${API}/transfers?branchId=${currentBranchId}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${API}/branches`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      if (transRes.ok) setTransfers(await transRes.json());
      if (branchesRes.ok) setBranches(await branchesRes.json());
      
      // Load products from local DB (master catalog)
      const localProducts = await db.products.toArray();
      setProducts(localProducts);
    } catch (error) {
      toast.error("Error al cargar datos");
    } finally {
      setLoading(false);
    }
  }, [currentBranchId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAddItem = (variantId: string, name: string, stock: number) => {
    if (selectedItems.find(i => i.variantId === variantId)) {
      toast.error("Este producto ya está en la lista");
      return;
    }
    setSelectedItems([...selectedItems, { variantId, name, stock, quantity: 1 }]);
  };

  const handleRemoveItem = (variantId: string) => {
    setSelectedItems(selectedItems.filter(i => i.variantId !== variantId));
  };

  const handleQuantityChange = (variantId: string, value: string) => {
    const qty = value === "" ? "" : parseInt(value) || 0;
    setSelectedItems(selectedItems.map(i => {
      if (i.variantId === variantId) {
        return { ...i, quantity: qty as any };
      }
      return i;
    }));
  };

  const handleSubmit = async () => {
    if (!targetBranchId) {
      toast.error("Selecciona una sucursal de destino");
      return;
    }
    if (selectedItems.length === 0) {
      toast.error("Añade al menos un producto");
      return;
    }

    setIsSubmitting(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/transfers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          sourceBranchId: currentBranchId,
          destinationBranchId: targetBranchId,
          items: selectedItems.map(i => ({ variantId: i.variantId, quantity: i.quantity })),
          notes: "Traslado entre sucursales"
        })
      });

      if (res.ok) {
        toast.success("Traslado creado y stock en tránsito");
        setIsCreateOpen(false);
        setSelectedItems([]);
        setTargetBranchId("");
        loadData();
      } else {
        const err = await res.json();
        toast.error(err.message || "Error al crear traslado");
      }
    } catch (error) {
      toast.error("Error de conexión");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleComplete = async (id: string) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/transfers/${id}/complete`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        toast.success("Traslado completado. Stock recibido.");
        loadData();
      }
    } catch (error) {
      toast.error("Error al completar");
    }
  };

  const handleCancel = async (id: string) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/transfers/${id}/cancel`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        toast.success("Traslado cancelado. Stock devuelto a origen.");
        loadData();
      }
    } catch (error) {
      toast.error("Error al cancelar");
    }
  };

  return (
    <div className="flex flex-col gap-6 py-4 md:gap-8 md:py-6 font-sans px-4 lg:px-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Traslados de Inventario</h1>
          <p className="text-muted-foreground">Mueve mercancía entre tus bodegas de forma segura.</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} className="rounded-xl shadow-lg shadow-primary/20">
          <IconPlus className="mr-2 h-4 w-4" /> Nuevo Traslado
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {loading ? (
          <div className="text-center py-20 opacity-50">Cargando traslados...</div>
        ) : transfers.length === 0 ? (
          <Card className="border-dashed bg-transparent">
            <CardContent className="flex flex-col items-center justify-center py-20 text-center">
              <div className="bg-primary/10 p-4 rounded-full mb-4">
                <IconTruck size={40} className="text-primary" />
              </div>
              <h3 className="text-lg font-semibold">No hay traslados</h3>
              <p className="text-muted-foreground max-w-xs">Comienza enviando mercancía de tu bodega principal a otras sucursales.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {transfers.map((t) => (
              <Card key={t.id} className="overflow-hidden shadow-sm hover:shadow-md transition-shadow border-none bg-white dark:bg-zinc-900 rounded-2xl">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant={t.status === 'COMPLETED' ? 'default' : t.status === 'CANCELLED' ? 'destructive' : 'secondary'} className="rounded-full px-3">
                      {t.status === 'COMPLETED' ? 'Completado' : t.status === 'CANCELLED' ? 'Cancelado' : 'En Tránsito'}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(t.createdAt), "dd MMM yyyy", { locale: es })}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-sm font-medium">
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase text-muted-foreground">Origen</span>
                      <span className="truncate max-w-[100px]">{t.sourceBranch.name}</span>
                    </div>
                    <IconArrowRight size={16} className="text-muted-foreground" />
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase text-muted-foreground">Destino</span>
                      <span className="truncate max-w-[100px]">{t.destinationBranch.name}</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pb-4">
                  <div className="space-y-2">
                    <span className="text-[10px] uppercase text-muted-foreground font-bold">Items</span>
                    <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-2 text-sm">
                      {t.items.slice(0, 2).map((item: any) => (
                        <div key={item.id} className="flex justify-between py-1">
                          <span className="truncate">{item.variant.product.name}</span>
                          <span className="font-bold">x{item.quantity}</span>
                        </div>
                      ))}
                      {t.items.length > 2 && (
                        <div className="text-center text-xs text-muted-foreground pt-1 border-t mt-1">
                          + {t.items.length - 2} productos más
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
                {t.status === 'PENDING' && (
                  <div className="p-3 bg-zinc-50 dark:bg-zinc-800/80 flex gap-2">
                    {currentBranchId === t.destinationBranchId ? (
                      <Button onClick={() => handleComplete(t.id)} className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 h-9">
                        <IconCheck className="mr-1 h-4 w-4" /> Recibir
                      </Button>
                    ) : (
                      <Button variant="outline" onClick={() => handleCancel(t.id)} className="flex-1 rounded-xl h-9 text-destructive">
                        <IconX className="mr-1 h-4 w-4" /> Cancelar
                      </Button>
                    )}
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Modal Crear Traslado */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-[95vw] lg:max-w-[90vw] xl:max-w-7xl rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
              <IconTruck className="text-primary" /> Nuevo Traslado de Mercancía
            </DialogTitle>
            <DialogDescription>
              Retira mercancía de tu bodega actual para enviarla a otra sucursal.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 py-4">
            <div className="space-y-2">
              <Label>Sucursal de Destino</Label>
              <Select value={targetBranchId} onValueChange={setTargetBranchId}>
                <SelectTrigger className="rounded-xl h-12">
                  <SelectValue placeholder="Selecciona la bodega destino" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {branches.filter(b => b.id !== currentBranchId).map(b => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-lg font-bold">Productos a Trasladar</Label>
                <Badge variant="outline" className="font-bold">{selectedItems.length} seleccionados</Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-[550px]">
                {/* Selector de productos */}
                <div className="border rounded-2xl overflow-hidden flex flex-col">
                  <div className="bg-muted p-2 text-xs font-bold uppercase tracking-wider">Catálogo Master</div>
                  <ScrollArea className="flex-1 p-2">
                    <div className="space-y-1">
                      {products.map(p => (
                        <div key={p.id} className="p-2 border-b last:border-0 hover:bg-muted/50 rounded-lg transition-colors group cursor-pointer" 
                             onClick={() => handleAddItem(p.variants?.[0]?.id, p.name, p.variants?.[0]?.stock || 0)}>
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium truncate max-w-[150px]">{p.name}</span>
                            <div className="flex items-center gap-2">
                                <Badge className="bg-zinc-100 text-zinc-900 hover:bg-zinc-100 border-none font-bold">Stock: {p.variants?.[0]?.stock || 0}</Badge>
                                <IconPlus size={16} className="text-primary opacity-0 group-hover:opacity-100" />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>

                {/* Lista de seleccionados */}
                <div className="border rounded-2xl overflow-hidden flex flex-col bg-zinc-50 dark:bg-zinc-900/50">
                  <div className="bg-primary/10 p-2 text-xs font-bold uppercase tracking-wider text-primary">Para enviar</div>
                  <ScrollArea className="flex-1 p-2">
                    <div className="space-y-2">
                      {selectedItems.map(item => (
                        <div key={item.variantId} className="bg-white dark:bg-zinc-900 p-2 rounded-xl shadow-sm border border-zinc-100 dark:border-zinc-800 space-y-2">
                          <div className="flex justify-between items-start">
                            <span className="text-sm font-bold truncate max-w-[180px]">{item.name}</span>
                            <button onClick={() => handleRemoveItem(item.variantId)} className="text-destructive">
                              <IconX size={14} />
                            </button>
                          </div>
                          <div className="flex items-center gap-3">
                            <Label className="text-[10px] font-bold">CANTIDAD:</Label>
                            <Input 
                              type="number" 
                              className="h-9 w-24 rounded-lg text-center font-bold bg-background shadow-sm" 
                              value={item.quantity} 
                              onChange={(e) => handleQuantityChange(item.variantId, e.target.value)}
                              min={1}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)} className="rounded-xl h-12">Cancelar</Button>
            <Button 
              onClick={handleSubmit} 
              disabled={isSubmitting || selectedItems.length === 0}
              className="rounded-xl h-12 px-8 bg-primary shadow-lg shadow-primary/30"
            >
              {isSubmitting ? "Procesando..." : "Confirmar Envío"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
