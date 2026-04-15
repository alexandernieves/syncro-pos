"use client";
import React, { useState, useEffect, useCallback } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  IconBox, IconArrowUp, IconArrowDown, IconAdjustments,
  IconClock, IconBarcode,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { PosTable } from "@/components/pos-table";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000";

type Movement = {
  _id: string;
  type: "IN" | "OUT" | "ADJUSTMENT" | "TRANSFER";
  quantity: number;
  previousStock: number;
  newStock: number;
  notes: string;
  createdAt: string;
  product?: { name: string; sku: string };
};

const typeConfig: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  IN:         { label: "Entrada",  icon: IconArrowUp,    color: "text-green-600",  bg: "bg-green-100 dark:bg-green-900/30" },
  OUT:        { label: "Salida",   icon: IconArrowDown,  color: "text-red-600",    bg: "bg-red-100 dark:bg-red-900/30" },
  ADJUSTMENT: { label: "Ajuste",   icon: IconAdjustments,color: "text-yellow-600", bg: "bg-yellow-100 dark:bg-yellow-900/30" },
  TRANSFER:   { label: "Traslado", icon: IconBox,        color: "text-blue-600",   bg: "bg-blue-100 dark:bg-blue-900/30" },
};

export default function MovimientosPage() {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : "";
  const headers = { Authorization: `Bearer ${token}` };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/inventory`, { headers });
      const data = await res.json();
      setMovements(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Error al cargar los movimientos de inventario");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const columns: ColumnDef<Movement>[] = [
    {
      accessorKey: "type",
      header: "Tipo",
      cell: ({ row }) => {
        const t = typeConfig[row.original.type] || { label: row.original.type, color: "text-gray-600", bg: "bg-muted", icon: IconBox };
        const Icon = t.icon;
        return (
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-md ${t.bg} ${t.color}`}>
              <Icon size={14} />
            </div>
            <span className={`text-xs font-bold ${t.color}`}>{t.label}</span>
          </div>
        );
      },
    },
    {
      accessorKey: "product",
      header: "Producto",
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="text-sm font-medium leading-none mb-1">
            {row.original.product?.name || <span className="italic text-muted-foreground">Producto eliminado</span>}
          </span>
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            <IconBarcode size={10} /> {row.original.product?.sku || "S/K"}
          </span>
        </div>
      ),
    },
    {
      accessorKey: "quantity",
      header: "Cantidad",
      cell: ({ row }) => {
        const m = row.original;
        const prefix = m.type === "OUT" ? "-" : "+";
        const color = m.type === "OUT" ? "text-red-600" : "text-green-600";
        return (
          <span className={`font-black tabular-nums ${color}`}>
            {prefix}{m.quantity}
          </span>
        );
      },
    },
    {
      accessorKey: "stock",
      header: "Balance Stock",
      cell: ({ row }) => (
        <div className="flex items-center gap-2 text-xs font-medium">
          <span className="text-muted-foreground">{row.original.previousStock}</span>
          <span className="text-muted-foreground/30">→</span>
          <span className="text-primary font-bold">{row.original.newStock}</span>
        </div>
      ),
    },
    {
      accessorKey: "notes",
      header: "Notas",
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground max-w-[150px] truncate block">
          {row.original.notes || "—"}
        </span>
      ),
    },
    {
      accessorKey: "createdAt",
      header: "Fecha y Hora",
      cell: ({ row }) => (
        <div className="flex flex-col text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <IconClock size={10} /> {new Date(row.original.createdAt).toLocaleDateString()}
          </span>
          <span>{new Date(row.original.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div>
        <h1 className="text-2xl font-bold">Kardex / Movimientos</h1>
        <p className="text-muted-foreground text-sm">Historial pormenorizado de entradas y salidas de stock.</p>
      </div>

      <PosTable
        columns={columns}
        data={movements}
        loading={loading}
        searchPlaceholder="Buscar por producto..."
      />
    </div>
  );
}
