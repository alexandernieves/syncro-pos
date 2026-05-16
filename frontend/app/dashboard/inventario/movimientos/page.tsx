"use client";

import React, { useState, useEffect, useCallback } from "react";
import { API_URL } from "@/lib/constants"
import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardAction } from "@/components/ui/card";
import {
  IconBox, IconArrowUp, IconArrowDown, IconAdjustments,
  IconClock, IconBarcode, IconArrowLeftRight, IconFilter, IconCalendar, IconDotsVertical, IconChecklist, IconDatabase
} from "@tabler/icons-react";
import { toast } from "sonner";
import { UniversalTable } from "@/components/universal-table";
import { movimientosColumns } from "@/components/movimientos-columns";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Tabs, TabsContent, TabsList, TabsTrigger 
} from "@/components/ui/tabs";
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";

const API = API_URL;

type Movement = {
  id?: string;
  _id?: string;
  type: "IN" | "OUT" | "ADJUSTMENT" | "TRANSFER";
  quantity: number;
  previousStock: number;
  newStock: number;
  notes: string;
  createdAt: string;
  product?: { name: string; sku: string };
};

const typeConfig: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  IN:         { label: "ENTRADA",  icon: IconArrowUp,    color: "text-emerald-600",  bg: "bg-emerald-500/10" },
  OUT:        { label: "SALIDA",   icon: IconArrowDown,  color: "text-rose-600",    bg: "bg-rose-500/10" },
  ADJUSTMENT: { label: "AJUSTE",   icon: IconAdjustments,color: "text-amber-600", bg: "bg-amber-500/10" },
  TRANSFER:   { label: "TRASLADO", icon: IconArrowLeftRight,        color: "text-blue-600",   bg: "bg-blue-500/10" },
};

export default function MovimientosPage() {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const branchId = localStorage.getItem("currentBranchId") || "";
      const res = await fetch(`${API}/inventory/movements${branchId ? `?branchId=${branchId}` : ""}`);
      const data = await res.json();
      setMovements(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Error al cargar los movimientos de inventario");
    } finally {
      setLoading(false);
    }
  }, []);

  const tableData = React.useMemo(() => {
    return movements.map((movement: any, index: number) => ({
      id: movement.id || movement._id || index,
      header: JSON.stringify({
        type: movement.type,
        label: movement.type
      }),
      type: JSON.stringify({
        product: movement.product
      }),
      status: JSON.stringify({
        quantity: movement.quantity,
        type: movement.type
      }),
      target: JSON.stringify({
        previousStock: movement.previousStock,
        newStock: movement.newStock
      }),
      limit: JSON.stringify({
        createdAt: movement.createdAt
      }),
      reviewer: "actions"
    }));
  }, [movements]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="flex flex-col gap-6 py-4 md:py-6 font-sans">
      
      {/* Header Info - Global Activity Control */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 px-4 lg:px-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <IconArrowLeftRight size={24} className="text-primary" /> Kardex de Movimientos
          </h1>
          <p className="text-sm text-muted-foreground font-medium">Control pormenorizado del flujo físico de mercancías entre sucursales y clientes.</p>
        </div>
        <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2 h-9 shadow-sm">
                <IconFilter size={16} /> Filtros Rápidos
            </Button>
            <Button size="sm" className="gap-2 h-9 shadow-md font-medium">
                <IconCalendar size={16} />
                <span>Rango Histórico</span>
            </Button>
        </div>
      </div>

      <div className="px-4 lg:px-6 space-y-6 flex-1 mt-4">
        {loading ? (
            <Skeleton className="h-[500px] w-full rounded-2xl" />
        ) : (
            <UniversalTable 
                data={tableData} 
                columns={movimientosColumns}
                tabs={{
                    outline: "Todos los flujos",
                    pastPerformance: "Entradas",
                    keyPersonnel: "Salidas",
                    focusDocuments: "Ajustes Críticos"
                }}
            />
        )}
      </div>

    </div>
  );
}
