"use client";
import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { 
  IconBox, IconAlertTriangle, IconArrowUp, IconArrowDown, 
  IconPackage, IconBarcode, IconTag 
} from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { PosTable } from "@/components/pos-table";
import { ColumnDef } from "@tanstack/react-table";
import { Skeleton } from "@/components/ui/skeleton";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000";

type Product = {
  _id: string;
  name: string;
  sku: string;
  price: number;
  stock: number;
  minStock: number;
  category?: { name: string };
};

export default function AlmacenPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : "";
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const load = useCallback(async () => {
    setLoading(true);
    const currentBranchId = localStorage.getItem("currentBranchId") || "";
    try {
      const url = currentBranchId ? `${API}/products?branchId=${currentBranchId}` : `${API}/products`;
      const res = await fetch(url, { headers });
      const data = await res.json();
      setProducts(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Error al cargar inventario");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const totalProducts = products.length;
  const criticalStock = products.filter(p => p.stock <= (p.minStock || 5)).length;

  const columns: ColumnDef<Product>[] = [
    {
      accessorKey: "name",
      header: "Producto",
      cell: ({ row }) => {
        const p = row.original;
        return (
          <div className="flex items-center gap-3">
            <div className="bg-muted size-10 rounded-lg flex items-center justify-center border shrink-0">
              <IconPackage size={20} className="text-muted-foreground" />
            </div>
            <div>
              <p className="font-bold text-sm leading-tight">{p.name}</p>
              <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                <IconBarcode size={11} /> {p.sku || "Sin SKU"}
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
        <Badge variant="outline" className="font-normal text-[10px]">
          {row.original.category?.name || "General"}
        </Badge>
      ),
    },
    {
      accessorKey: "stock",
      header: "Existencias",
      cell: ({ row }) => {
        const p = row.original;
        const lowStock = p.stock <= (p.minStock || 5);
        return (
          <Badge variant={lowStock ? "destructive" : "secondary"} className="font-bold">
            {p.stock} unidades
          </Badge>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Estado",
      cell: ({ row }) => {
        const p = row.original;
        const low = p.stock <= (p.minStock || 5);
        const empty = p.stock <= 0;
        return (
          <div className="flex items-center gap-2">
            <div className={`size-1.5 rounded-full ${empty ? 'bg-red-600' : low ? 'bg-orange-500' : 'bg-green-500'}`} />
            <span className="text-[10px] font-medium uppercase tracking-wider">
              {empty ? 'Agotado' : low ? 'Bajo Stock' : 'Optimizado'}
            </span>
          </div>
        );
      },
    },
  ];

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div>
        <h1 className="text-2xl font-bold">Almacén</h1>
        <p className="text-muted-foreground text-sm">Vista general del estado físico de los productos</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: "Total Productos", value: totalProducts, icon: IconBox, color: "text-blue-600" },
          { title: "Stock Crítico", value: criticalStock, icon: IconAlertTriangle, color: "text-red-600" },
          { title: "Entradas Hoy", value: "0", icon: IconArrowUp, color: "text-green-600" },
          { title: "Salidas Hoy", value: "0", icon: IconArrowDown, color: "text-orange-600" },
        ].map(({ title, value, icon: Icon, color }) => (
          <Card key={title} className="border-0 shadow-sm bg-background/50 backdrop-blur-md">
            <CardContent className="flex items-center gap-4 p-5">
              <div className={`${color} bg-muted rounded-xl p-3 shrink-0`}><Icon size={24}/></div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-tight">{title}</p>
                {loading ? <Skeleton className="h-8 w-16 mt-1" /> : <p className="text-2xl font-black">{value}</p>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <PosTable
        columns={columns}
        data={products}
        loading={loading}
        searchPlaceholder="Filtrar almacén..."
      />
    </div>
  );
}
