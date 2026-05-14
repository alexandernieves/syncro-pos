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
  IconX,
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

export const conteoSchema = z.object({
  id: z.union([z.number(), z.string()]),
  header: z.string(),        // Variante / Referencia
  type: z.string(),          // SKU / Código
  status: z.string(),        // Estado Stock
  target: z.string(),        // Stock Teórico
  limit: z.string(),         // Físico Real
  reviewer: z.string(),      // Ajuste / Dif.
})

export const conteoColumns: ColumnDef<z.infer<typeof conteoSchema>>[] = [
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
    header: "Variante / Referencia",
    cell: ({ row }) => {
      return (
        <div className="flex items-center gap-3 cursor-pointer group/item">
          <div className="size-10 rounded-xl border bg-muted/20 flex items-center justify-center overflow-hidden shrink-0 group-hover/item:border-primary/30 transition-colors">
            <IconBox className="text-muted-foreground/30" size={20} />
          </div>
          <div className="flex flex-col text-left">
            <span className="text-sm font-bold text-foreground group-hover/item:text-primary transition-colors line-clamp-1">{row.original.header}</span>
            <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-tighter opacity-70">{row.original.type}</span>
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
      const isOut = row.original.status === "Agotado";
      
      return (
        <Badge variant="outline" className={`px-1.5 font-light tracking-tight ${isOk ? 'border-muted-foreground/30 text-muted-foreground' : isLow ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' : 'bg-rose-500/10 text-rose-600 border-rose-500/20'}`}>
          {isOk ? (
            <IconCircleCheckFilled className="fill-green-500 dark:fill-green-400 mr-1" size={14} />
          ) : isLow ? (
            <IconAlertTriangle size={14} className="mr-1" />
          ) : (
            <IconX size={14} className="mr-1" />
          )}
          {row.original.status}
        </Badge>
      )
    },
  },
  {
    accessorKey: "target",
    header: () => <div className="w-full text-center">Stock Teórico</div>,
    cell: ({ row }) => (
      <div className="w-full text-center">
        <Badge variant="outline" className="h-6 px-2.5 text-[10px] font-light tracking-widest bg-muted/50 border-none">
          {row.original.target} UNI
        </Badge>
      </div>
    ),
  },
  {
    accessorKey: "limit",
    header: () => <div className="w-full text-center">Físico Real</div>,
    cell: ({ row, table }) => {
      const meta = table.options.meta as any;
      return (
        <div className="flex items-center justify-center">
          <Label htmlFor={`${row.original.id}-limit`} className="sr-only">
            Físico Real
          </Label>
          <Input
            type="number"
            placeholder="0"
            className="h-9 w-24 rounded-lg text-center font-bold bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 shadow-sm focus-visible:ring-1 focus-visible:ring-primary/50"
            value={row.original.limit}
            onChange={(e) => meta?.updateData(row.original.id, parseInt(e.target.value) || 0)}
            id={`${row.original.id}-limit`}
          />
        </div>
      );
    },
  },
  {
    accessorKey: "reviewer",
    header: () => <div className="w-full text-center">Ajuste / Dif.</div>,
    cell: ({ row }) => (
      <div className="w-full text-center font-light text-xs text-muted-foreground italic">
        {row.original.reviewer || "--"}
      </div>
    ),
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
          <DropdownMenuItem className="text-xs">Editar Variante</DropdownMenuItem>
          <DropdownMenuItem className="text-xs">Ver Historial</DropdownMenuItem>
          <DropdownMenuItem className="text-xs">Imprimir Etiqueta</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" className="text-xs text-rose-600">Eliminar</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
]
