"use client"

import * as React from "react"
import { API_URL } from "@/lib/constants"
import { z } from "zod"
import {
  IconCircleCheckFilled,
  IconDotsVertical,
  IconAlertTriangle,
  IconLoader,
  IconGripVertical,
  IconBox,
} from "@tabler/icons-react"
import { ColumnDef } from "@tanstack/react-table"
import { useSortable } from "@dnd-kit/sortable"
import { useRouter } from "next/navigation"

const API = API_URL;

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"

export const inventorySchema = z.object({
  id: z.union([z.number(), z.string()]),
  header: z.string(),        // Producto / Especificación
  type: z.string(),          // SKU / Código
  status: z.string(),        // Estado Stock
  target: z.string(),        // Existencia
  limit: z.string(),         // Mínimo
  reviewer: z.string(),      // Proveedor / Categoría
  productId: z.string().optional(),
})

export const inventoryColumns: ColumnDef<z.infer<typeof inventorySchema>>[] = [
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
    header: "Producto / Especificación",
    cell: ({ row }) => {
      return (
        <div className="flex items-center gap-3 cursor-pointer group/item">
          <div className="size-10 rounded-xl border bg-muted/20 flex items-center justify-center overflow-hidden shrink-0 group-hover/item:border-primary/30 transition-colors">
            <IconBox className="text-muted-foreground/30" size={20} />
          </div>
          <div className="flex flex-col text-left">
            <span className="text-sm font-bold text-foreground group-hover/item:text-primary transition-colors line-clamp-1">{row.original.header}</span>
            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-tight">{row.original.type}</span>
          </div>
        </div>
      )
    },
    enableHiding: false,
  },
  {
    accessorKey: "type",
    header: "SKU / Código",
    cell: ({ row }) => (
      <div className="w-32">
        <code className="text-[10px] font-light border border-muted-foreground/30 px-1.5 py-0.5 rounded text-muted-foreground bg-transparent">
          {row.original.type}
        </code>
      </div>
    ),
  },
  {
    accessorKey: "status",
    header: "Estado Stock",
    cell: ({ row }) => {
      const isOk = row.original.status === "En Stock";
      const isLow = row.original.status === "Stock Bajo";
      
      return (
        <Badge variant="outline" className={`px-1.5 font-light tracking-tight ${isOk ? 'border-muted-foreground/30 text-muted-foreground' : isLow ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' : 'bg-rose-500/10 text-rose-600 border-rose-500/20'}`}>
          {isOk ? (
            <IconCircleCheckFilled className="fill-green-500 dark:fill-green-400 mr-1" size={14} />
          ) : isLow ? (
            <IconAlertTriangle size={14} className="mr-1" />
          ) : (
            <IconLoader className="mr-1 animate-spin" size={14} />
          )}
          {row.original.status}
        </Badge>
      )
    },
  },
  {
    accessorKey: "target",
    header: () => <div className="w-full text-right">Existencia</div>,
    cell: ({ row }) => (
      <div className="w-full text-right">
        <span className="text-sm font-semibold pr-2">
          {row.original.target}
        </span>
      </div>
    ),
  },
  {
    accessorKey: "limit",
    header: () => <div className="w-full text-right">Mínimo</div>,
    cell: ({ row }) => (
      <div className="w-full text-right">
        <span className="text-sm font-medium text-muted-foreground/80 pr-2">
          {row.original.limit}
        </span>
      </div>
    ),
  },
  {
    accessorKey: "reviewer",
    header: "Proveedor / Categoría",
    cell: ({ row }) => {
      const isAssigned = row.original.reviewer !== "Asignar"

      if (isAssigned) {
        return <span className="text-xs font-medium text-muted-foreground">{row.original.reviewer}</span>
      }

      return (
        <>
          <Label htmlFor={`${row.original.id}-reviewer`} className="sr-only">
            Proveedor
          </Label>
          <Select>
            <SelectTrigger
              className="w-38 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate h-8 text-[11px]"
              size="sm"
              id={`${row.original.id}-reviewer`}
            >
              <SelectValue placeholder="Asignar" />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="Proveedor A">Proveedor A</SelectItem>
              <SelectItem value="Proveedor B">Proveedor B</SelectItem>
            </SelectContent>
          </Select>
        </>
      )
    },
  },
  {
    id: "actions",
    cell: ({ row }) => <ActionsCell row={row} />,
  },
]

function ActionsCell({ row }: { row: any }) {
  const router = useRouter();
  const variantId = row.original.id;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="flex size-8 text-muted-foreground data-[state=open]:bg-muted rounded-full"
          size="icon"
        >
          <IconDotsVertical size={16} />
          <span className="sr-only">Abrir menú</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 border-none shadow-2xl rounded-xl">
        <DropdownMenuItem 
          className="text-xs"
          onClick={() => router.push(`/dashboard/inventario/movimientos?variantId=${variantId}`)}
        >
          Kardex de Movimientos
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
