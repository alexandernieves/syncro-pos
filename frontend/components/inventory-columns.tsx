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

export const inventorySchema = z.object({
  id: z.union([z.number(), z.string()]),
  header: z.string(),        // Producto / Especificación
  type: z.string(),          // SKU / Código
  status: z.string(),        // Estado Stock
  target: z.string(),        // Existencia
  limit: z.string(),         // Mínimo
  reviewer: z.string(),      // Proveedor / Categoría
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
      <form
        onSubmit={(e) => {
          e.preventDefault()
          toast.promise(new Promise((resolve) => setTimeout(resolve, 1000)), {
            loading: `Guardando stock de ${row.original.header}`,
            success: "Stock actualizado",
            error: "Error al actualizar",
          })
        }}
      >
        <Label htmlFor={`${row.original.id}-target`} className="sr-only">
          Existencia
        </Label>
        <Input
          className="hover:bg-input/30 focus-visible:bg-background dark:hover:bg-input/30 dark:focus-visible:bg-input/30 h-8 w-20 border-transparent bg-transparent text-right shadow-none focus-visible:border dark:bg-transparent"
          defaultValue={row.original.target}
          id={`${row.original.id}-target`}
        />
      </form>
    ),
  },
  {
    accessorKey: "limit",
    header: () => <div className="w-full text-right">Mínimo</div>,
    cell: ({ row }) => (
      <form
        onSubmit={(e) => {
          e.preventDefault()
          toast.promise(new Promise((resolve) => setTimeout(resolve, 1000)), {
            loading: `Guardando mínimo de ${row.original.header}`,
            success: "Mínimo actualizado",
            error: "Error al actualizar",
          })
        }}
      >
        <Label htmlFor={`${row.original.id}-limit`} className="sr-only">
          Mínimo
        </Label>
        <Input
          className="hover:bg-input/30 focus-visible:bg-background dark:hover:bg-input/30 dark:focus-visible:bg-input/30 h-8 w-20 border-transparent bg-transparent text-right shadow-none focus-visible:border dark:bg-transparent text-muted-foreground/80"
          defaultValue={row.original.limit}
          id={`${row.original.id}-limit`}
        />
      </form>
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
    cell: () => (
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
          <DropdownMenuItem className="text-xs">Editar Producto</DropdownMenuItem>
          <DropdownMenuItem className="text-xs">Duplicar</DropdownMenuItem>
          <DropdownMenuItem className="text-xs">Kardex de Movimientos</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" className="text-xs text-rose-600">Eliminar</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
]
