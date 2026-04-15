"use client";
import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  IconPlus, IconPencil, IconTrash,
  IconPackage, IconBarcode, IconTag,
  IconEye, IconBuilding, IconList,
  IconTrendingUp, IconAlertCircle, IconBolt
} from "@tabler/icons-react";
import { toast } from "sonner";
import { PosTable } from "@/components/pos-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000";

type Variant = {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  price: number;
  promoPrice?: number;
  bulkPrice?: number;
  stock: number;
  minStock: number;
};

type Product = {
  id: string;
  name: string;
  description: string;
  totalStock: number;
  status: 'CRITICAL' | 'LOW' | 'NORMAL';
  image?: string;
  category?: { id: string, name: string };
  variants: Variant[];
};


export default function ProductosPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [stats, setStats] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };
      const res = await fetch(`${API}/products`, { headers });
      const data = await res.json();
      setProducts(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Error al cargar los productos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openDetail = async (p: Product) => { 
    setSelectedProduct(p); 
    setDetailOpen(true); 
    // Fetch stats
    try {
      const res = await fetch(`${API}/products/${p.id}/stats`);
      if (res.ok) setStats(await res.json());
    } catch (e) {}
  };

  const handleQuickCreate = async () => {
    const name = prompt("Nombre del producto:");
    const price = prompt("Precio:");
    const stock = prompt("Stock inicial:");
    
    if (!name || !price || !stock) return;

    try {
      const res = await fetch(`${API}/products/quick-create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, price: Number(price), stock: Number(stock) })
      });
      if (res.ok) {
        toast.success("Producto creado rápidamente");
        load();
      }
    } catch (e) {
      toast.error("Error en creación rápida");
    }
  };

  const columns: ColumnDef<Product>[] = [
    {
      accessorKey: "name",
      header: "Producto",
      cell: ({ row }) => {
        const p = row.original;
        return (
          <div
            className="flex items-center gap-3 cursor-pointer group/row"
            onClick={() => openDetail(p)}
          >
            <div className="bg-muted size-12 rounded-lg overflow-hidden flex items-center justify-center border shrink-0 group-hover/row:border-primary/50 transition-colors">
              {p.image ? (
                <img src={p.image} alt={p.name} className="size-full object-cover" />
              ) : (
                <IconPackage size={24} className="text-muted-foreground" />
              )}
            </div>
            <div>
              <p className="font-bold text-sm leading-tight text-foreground group-hover/row:text-primary transition-colors">{p.name}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {p.variants.length} variantes
              </p>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "category",
      header: "Categoría",
      cell: ({ row }) => (
        <Badge variant="outline" className="font-normal">
          {row.original.category?.name || "Sin categoría"}
        </Badge>
      ),
    },
    {
      accessorKey: "status",
      header: "Estado Stock",
      cell: ({ row }) => {
        const status = row.original.status;
        const totalStock = row.original.totalStock;
        return (
          <Badge variant={status === 'CRITICAL' ? "destructive" : status === 'LOW' ? "warning" : "secondary"} className="font-bold">
            {totalStock} unid. {status !== 'NORMAL' && `(${status})`}
          </Badge>
        );
      },
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const p = row.original;
        return (
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" size="icon" className="size-8 text-primary" title="Ver ficha" onClick={() => openDetail(p)}>
              <IconEye size={16} />
            </Button>
            <Button variant="ghost" size="icon" className="size-8" title="Editar producto" onClick={() => router.push(`/dashboard/productos/editar/${p.id}`)}>
              <IconPencil size={15} />
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold font-heading">SYNCRO RETAIL HUB</h1>
          <p className="text-muted-foreground text-sm">Gestión avanzada de productos y variantes</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2 border-primary/20 text-primary" onClick={handleQuickCreate}>
            <IconBolt size={16} /> Creación Rápida
          </Button>
          <Button className="gap-2 shadow-lg shadow-primary/20" onClick={() => router.push("/dashboard/productos/nuevo")}>
            <IconPlus size={16} /> Nuevo Producto
          </Button>
        </div>
      </div>

      <PosTable
        columns={columns}
        data={products}
        loading={loading}
        searchPlaceholder="Buscar por nombre, SKU o código de barras..."
      />


      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="sm:max-w-2xl overflow-y-auto">
          {selectedProduct && (
            <div className="space-y-8 py-4">
              <SheetHeader>
                <div className="flex items-start gap-4">
                  <div className="size-24 bg-muted rounded-2xl overflow-hidden border-2 border-primary/10">
                    {selectedProduct.image ? <img src={selectedProduct.image} className="size-full object-cover" /> : <div className="size-full flex items-center justify-center opacity-20"><IconPackage size={40}/></div>}
                  </div>
                  <div className="flex-1">
                    <Badge className="mb-2">{selectedProduct.category?.name || "Retail"}</Badge>
                    <SheetTitle className="text-3xl font-black leading-none mb-2">{selectedProduct.name}</SheetTitle>
                    <p className="text-muted-foreground text-sm line-clamp-2">{selectedProduct.description}</p>
                  </div>
                </div>
              </SheetHeader>

              <div className="grid grid-cols-3 gap-4">
                <div className="bg-primary/5 p-4 rounded-2xl border border-primary/10">
                  <p className="text-[10px] font-bold text-primary uppercase tracking-wider mb-1">Stock Total</p>
                  <p className="text-2xl font-black">{selectedProduct.totalStock}</p>
                </div>
                <div className="bg-muted/50 p-4 rounded-2xl border">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Ventas (7d)</p>
                  <p className="text-2xl font-black">{stats?.totalSoldLast7Days || 0}</p>
                </div>
                <div className="bg-muted/50 p-4 rounded-2xl border">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Precio Prom.</p>
                  <p className="text-2xl font-black">${stats?.averagePrice || 0}</p>
                </div>
              </div>

              <Tabs defaultValue="variantes">
                <TabsList className="w-full bg-muted/30 p-1 rounded-xl">
                  <TabsTrigger value="variantes" className="flex-1 rounded-lg">Variantes</TabsTrigger>
                  <TabsTrigger value="stats" className="flex-1 rounded-lg">Inteligencia</TabsTrigger>
                </TabsList>

                <TabsContent value="variantes" className="mt-6 space-y-4">
                  {selectedProduct.variants.map(v => (
                    <div key={v.id} className="p-4 rounded-xl border bg-card hover:border-primary/30 transition-all flex items-center justify-between group">
                      <div className="flex items-center gap-4">
                        <div className="size-10 bg-muted rounded-lg flex items-center justify-center font-bold text-xs">
                          {v.name[0]}
                        </div>
                        <div>
                          <p className="font-bold text-sm">{v.name}</p>
                          <p className="text-xs text-muted-foreground font-mono">{v.sku} | {v.barcode}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-primary">${v.price}</p>
                        <Badge variant={v.stock > v.minStock ? "secondary" : "destructive"} className="text-[10px] h-5">
                          Stock: {v.stock}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </TabsContent>

                <TabsContent value="stats" className="mt-6 space-y-6">
                  <div className="p-6 rounded-2xl border bg-gradient-to-br from-primary/5 to-transparent">
                    <h3 className="font-bold mb-4 flex items-center gap-2"><IconTrendingUp size={18} className="text-primary"/> Rendimiento de Venta</h3>
                    <div className="space-y-4 text-sm">
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-muted-foreground">Última Venta</span>
                        <span className="font-bold">{new Date(stats?.lastSale).toLocaleDateString()}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-muted-foreground">Frecuencia de Reposición</span>
                        <span className="font-bold">Alta</span>
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
