"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { IconAlertTriangle, IconShoppingCart, IconArrowsExchange, IconChevronRight } from "@tabler/icons-react"
import { useRouter } from "next/navigation"

export interface AlertData {
  id: string | number;
  header: string;
  status: string;
  target: number;
  limit: number;
  category: string;
}

export const alertsColumns: ColumnDef<AlertData>[] = [
  {
    accessorKey: "header",
    header: "Producto",
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${row.original.status === 'Sin Stock' ? 'bg-rose-500/10 text-rose-600' : 'bg-amber-500/10 text-amber-600'}`}>
          <IconAlertTriangle size={18} />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-bold">{row.original.header}</span>
          <span className="text-[10px] text-muted-foreground uppercase">{row.original.category}</span>
        </div>
      </div>
    ),
  },
  {
    accessorKey: "status",
    header: "Estado",
    cell: ({ row }) => (
      <Badge variant={row.original.status === 'Sin Stock' ? 'destructive' : 'secondary'} className="font-bold border-none">
        {row.original.status.toUpperCase()}
      </Badge>
    ),
  },
  {
    accessorKey: "target",
    header: "Stock Actual",
    cell: ({ row }) => (
      <div className="text-center">
        <span className="text-lg font-black">{row.original.target}</span>
      </div>
    ),
  },
  {
    accessorKey: "limit",
    header: "Stock Mínimo",
    cell: ({ row }) => (
      <div className="text-center opacity-60">
        <span className="text-lg font-bold">{row.original.limit}</span>
      </div>
    ),
  },
  {
    id: "actions",
    header: "Acciones Rápidas",
    cell: ({ row }) => {
      const router = useRouter();
      return (
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 gap-2 text-[10px] font-bold"
            onClick={() => router.push("/dashboard/inventario/traslados")}
          >
            <IconArrowsExchange size={14} />
            TRASLADO
          </Button>
          <Button 
            size="sm" 
            className="h-8 gap-2 text-[10px] font-bold bg-primary"
            onClick={() => router.push("/dashboard/inventario/compras")}
          >
            <IconShoppingCart size={14} />
            COMPRA
          </Button>
        </div>
      );
    },
  },
]
