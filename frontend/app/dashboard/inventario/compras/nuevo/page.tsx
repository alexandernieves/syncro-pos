"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { 
  IconArrowLeft, IconPlus, IconTrash, IconBuildingStore, IconTruck, IconInfoCircle, IconBarcode, IconSearch, IconPackage
} from "@tabler/icons-react";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000";

interface OrderItem {
  variantId: string;
  productName: string;
  variantName: string;
  quantity: number;
  cost: number;
  taxRate: number;
}

export default function NewPurchaseOrderPage() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<OrderItem[]>([]);
  
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem("token");
      const headers = { 'Authorization': `Bearer ${token}` };
      
      const [suppRes, branchRes, prodRes] = await Promise.all([
        fetch(`${API}/suppliers`, { headers }),
        fetch(`${API}/branches`, { headers }),
        fetch(`${API}/products`, { headers })
      ]);

      if (suppRes.ok) setSuppliers(await suppRes.json());
      if (branchRes.ok) setBranches(await branchRes.json());
      if (prodRes.ok) {
        const prodData = await prodRes.json();
        // Flatten products to variants for easier selection
        const flattened: any[] = [];
        prodData.forEach((p: any) => {
          p.variants.forEach((v: any) => {
            flattened.push({ ...v, productName: p.name });
          });
        });
        setProducts(flattened);
      }
    } catch (error) {
      toast.error("Error al cargar datos iniciales");
    }
  };

  const addItem = (variantId: string) => {
    const variant = products.find(v => v.id === variantId);
    if (!variant) return;

    // Check if already in list
    if (items.some(i => i.variantId === variantId)) {
      toast.info("El producto ya está en la lista");
      return;
    }

    setItems([...items, {
      variantId: variant.id,
      productName: variant.productName,
      variantName: variant.name,
      quantity: 1,
      cost: variant.cost || 0,
      taxRate: 16 // Default VAT for Venezuela
    }]);
  };

  const removeItem = (index: number) => {
    const newItems = [...items];
    newItems.splice(index, 1);
    setItems(newItems);
  };

  const updateItem = (index: number, field: keyof OrderItem, value: any) => {
    const newItems = [...items];
    (newItems[index] as any)[field] = value;
    setItems(newItems);
  };

  const calculateTotals = () => {
    const subtotal = items.reduce((acc, curr) => acc + (curr.quantity * curr.cost), 0);
    const tax = items.reduce((acc, curr) => acc + (curr.quantity * curr.cost * (curr.taxRate / 100)), 0);
    return { subtotal, tax, total: subtotal + tax };
  };

  const handleSubmit = async () => {
    if (!selectedSupplierId || !selectedBranchId || items.length === 0) {
      toast.error("Complete todos los campos obligatorios");
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/purchase-orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          supplierId: selectedSupplierId,
          branchId: selectedBranchId,
          notes,
          items: items.map(i => ({
            variantId: i.variantId,
            quantity: i.quantity,
            cost: i.cost,
            taxRate: i.taxRate
          }))
        })
      });

      if (res.ok) {
        toast.success("Orden de compra creada exitosamente");
        router.push("/dashboard/inventario/compras");
      } else {
        const err = await res.json();
        toast.error(err.message || "Error al crear la orden");
      }
    } catch (error) {
      toast.error("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  const { subtotal, tax, total } = calculateTotals();

  return (
    <div className="flex flex-col gap-6 py-4 md:gap-8 md:py-6 max-w-7xl mx-auto px-4 lg:px-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => router.back()} className="h-9 shadow-none">
            <IconArrowLeft size={16} className="mr-2" /> Volver
          </Button>
          <div className="flex flex-col">
            <h1 className="text-2xl font-bold tracking-tight">Generar Nueva Orden de Compra</h1>
            <p className="text-sm text-muted-foreground font-medium italic">Documento formal de procura y abastecimiento.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-none shadow-sm bg-card/50">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <IconTruck size={18} className="text-primary" /> Información de Envío y Pago
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Proveedor Destino</Label>
                <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
                  <SelectTrigger className="h-11 bg-white dark:bg-zinc-900 border-muted">
                    <SelectValue placeholder="Seleccione un socio comercial" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name} ({s.taxId || 'N/A'})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Sede de Recepción</Label>
                <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
                  <SelectTrigger className="h-11 bg-white dark:bg-zinc-900 border-muted">
                    <SelectValue placeholder="Sucursal de entrega" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map(b => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm overflow-hidden">
            <CardHeader className="bg-muted/30 pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                    <IconPackage size={18} className="text-primary" /> Catálogo de Ítems a Solicitar
                </CardTitle>
                <div className="flex items-center gap-2 max-w-xs w-full">
                    <div className="relative w-full">
                        <IconSearch className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Select onValueChange={addItem}>
                            <SelectTrigger className="h-9 pl-9 bg-white dark:bg-zinc-900 border-muted shadow-none text-xs">
                                <SelectValue placeholder="Buscar por SKU o Nombre..." />
                            </SelectTrigger>
                            <SelectContent>
                                {products.map(p => (
                                    <SelectItem key={p.id} value={p.id} className="text-xs">
                                        <div className="flex flex-col">
                                            <span className="font-bold">{p.productName}</span>
                                            <span className="text-[10px] text-muted-foreground">{p.name} - SKU: {p.sku}</span>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/10 hover:bg-muted/10 border-b">
                    <TableHead className="text-xs font-bold uppercase py-4">Producto / Variante</TableHead>
                    <TableHead className="text-xs font-bold uppercase w-24 text-center">Cant.</TableHead>
                    <TableHead className="text-xs font-bold uppercase w-32 text-right">Costo Unit.</TableHead>
                    <TableHead className="text-xs font-bold uppercase w-20 text-center">IVA %</TableHead>
                    <TableHead className="text-xs font-bold uppercase text-right pr-6">Subtotal</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-32 text-center text-muted-foreground italic">
                        No hay productos en esta orden. Comience buscando arriba ↑
                      </TableCell>
                    </TableRow>
                  ) : (
                    items.map((item, index) => (
                      <TableRow key={item.variantId} className="border-b last:border-0 hover:bg-muted/5">
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-slate-900 dark:text-white leading-none mb-1">{item.productName}</span>
                            <span className="text-[11px] text-muted-foreground">{item.variantName}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Input 
                            type="number" 
                            className="h-8 text-center text-xs font-bold shadow-none" 
                            value={item.quantity}
                            onChange={(e) => updateItem(index, 'quantity', Number(e.target.value))}
                          />
                        </TableCell>
                        <TableCell>
                          <Input 
                            type="number" 
                            className="h-8 text-right text-xs font-bold shadow-none pr-2" 
                            value={item.cost}
                            onChange={(e) => updateItem(index, 'cost', Number(e.target.value))}
                          />
                        </TableCell>
                        <TableCell>
                           <Select 
                            value={item.taxRate.toString()} 
                            onValueChange={(v) => updateItem(index, 'taxRate', Number(v))}
                           >
                             <SelectTrigger className="h-8 text-[10px] font-bold shadow-none">
                               <SelectValue />
                             </SelectTrigger>
                             <SelectContent>
                               <SelectItem value="0" className="text-xs">Exento 0%</SelectItem>
                               <SelectItem value="8" className="text-xs">Reducido 8%</SelectItem>
                               <SelectItem value="16" className="text-xs">General 16%</SelectItem>
                             </SelectContent>
                           </Select>
                        </TableCell>
                        <TableCell className="text-sm font-bold tabular-nums text-right pr-6 text-slate-900 dark:text-white">
                          ${(item.quantity * item.cost).toFixed(2)}
                        </TableCell>
                        <TableCell className="pr-4">
                          <Button variant="ghost" size="icon" onClick={() => removeItem(index)} className="size-8 text-rose-500 hover:bg-rose-50 hover:text-rose-600 transition-colors">
                            <IconTrash size={14} />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Summary */}
        <div className="space-y-6">
          <Card className="border-none bg-slate-900 text-white shadow-xl overflow-hidden">
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-400">Resumen Presupuestario</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
               <div className="flex justify-between items-center text-sm border-b border-slate-800 pb-3">
                 <span className="text-slate-400 font-medium tracking-tight">Monto Imponible</span>
                 <span className="font-bold tabular-nums text-slate-200">${subtotal.toFixed(2)}</span>
               </div>
               <div className="flex justify-between items-center text-sm border-b border-slate-800 pb-3">
                 <span className="text-slate-400 font-medium tracking-tight">Impuestos (IVA)</span>
                 <span className="font-bold tabular-nums text-slate-200">${tax.toFixed(2)}</span>
               </div>
               <div className="flex justify-between items-center pt-3">
                 <span className="text-xl font-black uppercase tracking-tighter text-white">Total OC</span>
                 <span className="text-2xl font-black tabular-nums text-emerald-400">${total.toFixed(2)}</span>
               </div>
            </CardContent>
            <CardFooter className="bg-slate-800/50 flex flex-col gap-3 pt-6 p-6">
               <div className="w-full space-y-2">
                 <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Notas de Procura</Label>
                 <textarea 
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-xl p-3 text-xs text-slate-300 min-h-[80px] focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all"
                  placeholder="Instrucciones especiales para el proveedor..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                 />
               </div>
               <Button 
                onClick={handleSubmit} 
                disabled={loading || items.length === 0} 
                className="w-full h-12 bg-white text-slate-900 hover:bg-slate-100 font-black uppercase tracking-widest text-xs shadow-xl shadow-emerald-500/10 transition-all active:scale-[0.98]"
               >
                 {loading ? "Procesando..." : "Emitir Orden de Compra"}
               </Button>
               <p className="text-[10px] text-center text-slate-500 font-medium leading-relaxed mt-2">
                 Al emitir, este documento será enviado digitalmente al proveedor y quedará registrado como un pasivo fiscal pendiente.
               </p>
            </CardFooter>
          </Card>

          <Card className="border-none bg-blue-50/50 dark:bg-zinc-900/50 shadow-none">
            <CardContent className="p-5 flex items-start gap-3">
              <IconInfoCircle className="text-blue-600 shrink-0" size={18} />
              <div className="flex flex-col gap-1">
                <span className="text-xs font-black text-blue-900 dark:text-blue-400 uppercase tracking-widest leading-none mb-1">Dato Importante</span>
                <p className="text-[11px] text-blue-700/70 dark:text-blue-500/80 leading-relaxed font-medium">
                  Los precios unitarios pueden actualizarse aquí manualmente. El sistema sugerirá el último costo registrado para agilizar el proceso.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
