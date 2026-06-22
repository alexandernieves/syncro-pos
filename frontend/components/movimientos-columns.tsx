"use client"

import * as React from "react"
import { z } from "zod"
import {
  IconCircleCheckFilled,
  IconDotsVertical,
  IconAlertTriangle,
  IconLoader,
  IconGripVertical,
  IconBox,
  IconArrowUp,
  IconArrowDown,
  IconAdjustments,
  IconArrowLeftRight,
  IconBarcode,
  IconChecklist,
  IconDatabase,
} from "@tabler/icons-react"
import { ColumnDef } from "@tanstack/react-table"
import { useSortable } from "@dnd-kit/sortable"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"

export const movimientosSchema = z.object({
  id: z.union([z.number(), z.string()]),
  header: z.string(),        // Tipo / Movimiento
  type: z.string(),          // Producto / SKU
  status: z.string(),        // Variación
  target: z.string(),        // Balance Kardex
  limit: z.string(),         // Registro
  reviewer: z.string(),      // Acciones
})

const typeConfig: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  IN:         { label: "ENTRADA",  icon: IconArrowUp,    color: "text-emerald-600",  bg: "bg-emerald-500/10" },
  OUT:        { label: "SALIDA",   icon: IconArrowDown,  color: "text-rose-600",    bg: "bg-rose-500/10" },
  ADJUSTMENT: { label: "AJUSTE",   icon: IconAdjustments,color: "text-amber-600", bg: "bg-amber-500/10" },
  TRANSFER:   { label: "TRASLADO", icon: IconArrowLeftRight,        color: "text-blue-600",   bg: "bg-blue-500/10" },
};

export const movimientosColumns: ColumnDef<z.infer<typeof movimientosSchema>>[] = [
  {
    id: "drag",
    header: () => null,
    cell: ({ row }) => {
      const { attributes, listeners } = useSortable({
        id: row.original.id,
      })
      
      return (
        <Button
          {...attributes}
          {...listeners}
          variant="ghost"
          size="icon"
          className="text-muted-foreground size-7 hover:bg-transparent"
        >
          <IconGripVertical className="text-muted-foreground size-3" />
          <span className="sr-only">Arrastrar para reordenar</span>
        </Button>
      )
    },
  },
  {
    id: "select",
    header: ({ table }) => (
      <div className="flex items-center justify-center">
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Seleccionar todo"
        />
      </div>
    ),
    cell: ({ row }) => (
      <div className="flex items-center justify-center">
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Seleccionar fila"
        />
      </div>
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "header",
    header: "Tipo / Movimiento",
    cell: ({ row }) => {
      const movementData = JSON.parse(row.original.header || '{}');
      const type = movementData.type || 'UNKNOWN';
      const t = typeConfig[type] || { label: type, color: "text-gray-600", bg: "bg-muted", icon: IconBox };
      const Icon = t.icon;
      
      return (
        <Badge variant="outline" className={`${t.bg} ${t.color} border-none font-light text-[9px] tracking-widest gap-2 h-7 px-2.5`}>
          <Icon size={12} stroke={2.5} />
          {t.label}
        </Badge>
      );
    },
  },
  {
    accessorKey: "type",
    header: "Producto Afectado",
    cell: ({ row }) => {
      const movementData = JSON.parse(row.original.type || '{}');
      const product = movementData.product || {};
      
      return (
        <div className="flex flex-col">
          <span className="text-sm font-bold tracking-tight text-foreground/90 leading-none mb-1">
            {product.name || <span className="italic text-muted-foreground font-medium">No identificado</span>}
          </span>
          <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-tighter flex items-center gap-1.5 opacity-60">
            <IconBarcode size={10} /> {product.sku || "S/K"}
          </span>
        </div>
      );
    },
  },
  {
    accessorKey: "status",
    header: "Variación",
    cell: ({ row }) => {
      const movementData = JSON.parse(row.original.status || '{}');
      const rawQuantity = movementData.quantity || 0;
      const type = movementData.type || 'OUT';
      
      let isNegative = false;
      let displayQuantity = rawQuantity;
      
      if (type === "OUT") {
        isNegative = true;
        displayQuantity = -Math.abs(rawQuantity);
      } else if (type === "IN") {
        isNegative = false;
        displayQuantity = Math.abs(rawQuantity);
      } else {
        isNegative = rawQuantity < 0;
        displayQuantity = rawQuantity;
      }
      
      const formattedValue = isNegative 
        ? `${displayQuantity} UNI` 
        : `+${displayQuantity} UNI`;
      
      return (
        <div className={`font-light text-sm tabular-nums ${isNegative ? "text-rose-600" : "text-emerald-600"}`}>
          {formattedValue}
        </div>
      );
    },
  },
  {
    accessorKey: "target",
    header: "Balance Kardex",
    cell: ({ row }) => {
      const movementData = JSON.parse(row.original.target || '{}');
      const previousStock = movementData.previousStock || 0;
      const newStock = movementData.newStock || 0;
      
      return (
        <div className="flex items-center h-full">
          <div className="flex items-center gap-3 bg-muted/40 px-3 py-1.5 rounded-lg border border-muted/50">
            <span className="text-[11px] font-light text-muted-foreground/60">{previousStock}</span>
            <IconArrowLeftRight size={10} className="text-muted-foreground/30" />
            <span className="text-xs font-bold text-primary">{newStock}</span>
          </div>
        </div>
      );
    },
  },
  {
    accessorKey: "limit",
    header: () => <div className="text-right">Registro</div>,
    cell: ({ row }) => {
      const movementData = JSON.parse(row.original.limit || '{}');
      const createdAt = movementData.createdAt || new Date().toISOString();
      
      return (
        <div className="flex flex-col text-right text-[11px] font-light text-muted-foreground leading-tight">
          <span className="text-foreground/80 font-semibold">{new Date(createdAt).toLocaleDateString()}</span>
          <span>{new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      );
    },
  },
  {
    id: "actions",
    cell: () => (
      <div className="flex justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="size-8 rounded-full" size="icon">
              <IconDotsVertical size={16} className="text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44 border-none shadow-2xl rounded-xl">
            <DropdownMenuItem className="text-xs gap-2"><IconChecklist size={14} /> Detalle de flujo</DropdownMenuItem>
            <DropdownMenuItem className="text-xs gap-2"><IconDatabase size={14} /> Trazabilidad SQL</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    ),
  },
]
