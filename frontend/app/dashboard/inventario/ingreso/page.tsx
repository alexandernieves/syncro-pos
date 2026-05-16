"use client";

import React, { useState, useEffect } from "react";
import { API_URL } from "@/lib/constants"
import { 
  Card, CardContent, CardHeader, CardTitle, CardDescription, CardAction 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  IconPackageImport, IconSearch, IconBuilding, IconCheck, IconAlertCircle, IconBarcode, IconPlus, IconTruckLoading, IconHistory, IconArrowRight
} from "@tabler/icons-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";

const API = API_URL;

export default function IngresoPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [selectedVariant, setSelectedVariant] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("");
  const [quantity, setQuantity] = useState("");

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      const branchId = localStorage.getItem("currentBranchId") || "";
      if (branchId) setSelectedBranch(branchId);

      const [pRes, bRes] = await Promise.all([
        fetch(`${API}/products${branchId ? `?branchId=${branchId}` : ""}`),
        fetch(`${API}/branches`)
      ]);
      if(pRes.ok && bRes.ok) {
        setProducts(await pRes.json());
        setBranches(await bRes.json());
      }
    } catch (error) {
      toast.error("Error al cargar datos iniciales");
    } finally {
      setLoading(false);
    }
  };

  const handleRestock = async () => {
    if (!selectedVariant || !selectedBranch || !quantity) {
      toast.warning("Complete todos los campos");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API}/inventory/restock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          variantId: selectedVariant,
          branchId: selectedBranch,
          quantity: parseInt(quantity)
        })
      });

      if (res.ok) {
        toast.success("Stock actualizado correctamente");
        setQuantity("");
      } else {
        toast.error("Error al actualizar stock");
      }
    } catch (error) {
      toast.error("Error en la conexión");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 py-4 md:gap-8 md:py-6 font-sans">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 px-4 lg:px-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <IconPackageImport size={24} className="text-primary" /> Ingreso de Mercancía
          </h1>
          <p className="text-sm text-muted-foreground font-medium">Registro de entradas de productos y reabastecimiento de sucursales.</p>
        </div>
        <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2 h-9 shadow-sm">
                <IconHistory size={16} /> Ver Historial
            </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 px-4 lg:px-6">
          <div className="lg:col-span-12">
            <Card className="border-muted/60 shadow-sm overflow-hidden rounded-2xl">
              <CardHeader className="bg-muted/30 border-b p-6">
                <div className="flex items-center gap-4">
                  <div className="size-12 rounded-xl bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/20">
                    <IconTruckLoading size={24} stroke={1.5} />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-bold tracking-tight">Formulario de Recepción</CardTitle>
                    <CardDescription className="text-xs font-medium">Incremente el stock de sus variantes asociándolas a una sucursal.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-8 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80">Variante de Producto</Label>
                    <Select onValueChange={setSelectedVariant} value={selectedVariant}>
                      <SelectTrigger className="h-11 bg-muted/20 border-none shadow-none text-xs font-semibold focus:ring-1 focus:ring-primary/20">
                        <SelectValue placeholder="Busque o seleccione la variante..." />
                      </SelectTrigger>
                      <SelectContent className="border-none shadow-2xl rounded-xl max-h-[300px]">
                        {loading ? (
                            <div className="p-4 text-center text-xs text-muted-foreground">Cargando catálogo...</div>
                        ) : products.flatMap(p => (p.variants || []).map((v: any) => (
                          <SelectItem key={v.id || v._id} value={v.id || v._id} className="text-xs font-medium py-2.5">
                            <div className="flex flex-col gap-0.5">
                                <span className="font-bold">{p.name}</span>
                                <span className="text-[10px] opacity-60 uppercase">{v.name} • SKU: {v.sku}</span>
                            </div>
                          </SelectItem>
                        )))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80">Sucursal Destino</Label>
                    <Select onValueChange={setSelectedBranch} value={selectedBranch}>
                      <SelectTrigger className="h-11 bg-muted/20 border-none shadow-none text-xs font-semibold focus:ring-1 focus:ring-primary/20">
                        <SelectValue placeholder="Seleccione sucursal de recepción..." />
                      </SelectTrigger>
                      <SelectContent className="border-none shadow-2xl rounded-xl">
                        {branches.map(b => (
                          <SelectItem key={b.id || b._id} value={b.id || b._id} className="text-xs font-bold py-2.5">{b.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-end">
                  <div className="space-y-2.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80">Cantidad Unidades</Label>
                    <div className="relative">
                      <IconCheck className="absolute left-3.5 top-1/2 -translate-y-1/2 text-primary" size={16} />
                      <Input 
                        type="number" 
                        placeholder="0" 
                        className="pl-10 h-11 bg-muted/20 border-none shadow-none text-base font-bold focus:ring-1 focus:ring-primary/20"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                      />
                    </div>
                  </div>
                  <Button 
                      className="h-11 font-black text-xs uppercase tracking-widest gap-2 shadow-lg shadow-primary/20 rounded-xl" 
                      onClick={handleRestock}
                      disabled={submitting}
                  >
                    {submitting ? "PROCESANDO..." : "CONFIRMAR ENTRADA"}
                    <IconArrowRight size={16} />
                  </Button>
                </div>

                <Separator className="my-6" />

                <Alert className="border-amber-200 bg-amber-50/50 text-amber-800">
                  <IconAlertCircle className="h-4 w-4" />
                  <AlertTitle className="text-xs font-bold uppercase tracking-widest">Nota Técnica</AlertTitle>
                  <AlertDescription className="text-[11px] leading-normal">
                    Esta acción generará un movimiento de tipo <strong>ENTRADA (IN)</strong> en el Kardex y actualizará inmediatamente el stock físico. Asegúrese de que la mercancía ya esté físicamente en el almacén antes de confirmar.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </div>
      </div>

    </div>
  );
}
