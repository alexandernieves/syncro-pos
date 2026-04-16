"use client"

import * as React from "react"
import { z } from "zod"
import {
  IconDotsVertical,
  IconGripVertical,
  IconBuildingStore,
  IconPackage,
  IconClock,
  IconCircleCheckFilled,
  IconAlertTriangle,
  IconBan,
  IconExternalLink,
  IconTruck,
  IconFileText
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
import { useRouter } from "next/navigation"

export const purchaseOrdersSchema = z.object({
  id: z.string(),
  header: z.string(),        // Nº Orden / Info
  supplier: z.string(),      // Proveedor
  branch: z.string(),        // Sucursal
  total: z.string(),         // Monto
  status: z.string(),        // Estatus
  createdAt: z.string(),     // Fecha
  raw: z.any(),              // Objeto crudo
})

export const getPurchaseOrdersColumns = (onReceive: (id: string) => void, onDelete: (id: string) => void): ColumnDef<z.infer<typeof purchaseOrdersSchema>>[] => [
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
    header: "Orden de Compra",
    cell: ({ row }) => {
      const data = JSON.parse(row.original.header || '{}');
      return (
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-xl bg-primary/5 flex items-center justify-center text-primary shrink-0 border border-primary/10">
            <IconFileText size={18} stroke={1.5} />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold tracking-tight text-foreground leading-none mb-1.5">
              {data.number || `OC-${row.original.id.substring(0, 4)}`}
            </span>
            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-tight">
              PROCURA E INVENTARIO
            </span>
          </div>
        </div>
      );
    },
  },
  {
    accessorKey: "supplier",
    header: "Proveedor",
    cell: ({ row }) => {
      const data = JSON.parse(row.original.supplier || '{}');
      return (
        <div className="flex items-center gap-2">
          <div className="size-6 rounded-md bg-muted/30 flex items-center justify-center text-muted-foreground shrink-0 border border-muted/20">
            <IconBuildingStore size={12} stroke={1.5} />
          </div>
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {data.name}
          </span>
        </div>
      );
    },
  },
  {
    accessorKey: "total",
    header: "Inversión Total",
    cell: ({ row }) => {
      const data = JSON.parse(row.original.total || '{}');
      return (
        <div className="flex flex-col">
          <span className="text-sm font-bold tabular-nums text-foreground">
            {data.formattedTotal}
          </span>
          <span className="text-[10px] text-muted-foreground">
            Exento de IVA
          </span>
        </div>
      );
    },
  },
  {
    accessorKey: "status",
    header: "Estado",
    cell: ({ row }) => {
      const data = JSON.parse(row.original.status || '{}');
      const status = data.status;
      
      const config: any = {
        DRAFT: { label: "BORRADOR", color: "bg-slate-500/10 text-slate-600", icon: <IconClock size={14} /> },
        SENT: { label: "ENVIADA", color: "bg-blue-500/10 text-blue-600", icon: <IconTruck size={14} /> },
        RECEIVED: { label: "RECIBIDA", color: "bg-emerald-500/10 text-emerald-600", icon: <IconCircleCheckFilled size={14} /> },
        CANCELLED: { label: "ANULADA", color: "bg-rose-500/10 text-rose-600", icon: <IconBan size={14} /> },
      };

      const style = config[status] || config.DRAFT;
      
      return (
        <Badge variant="outline" className={`px-2 py-0.5 font-bold tracking-tight border-none ${style.color}`}>
          <span className="mr-1">{style.icon}</span>
          {style.label}
        </Badge>
      );
    },
  },
  {
    accessorKey: "createdAt",
    header: "Emisión",
    cell: ({ row }) => {
      return (
        <div className="text-xs text-muted-foreground font-medium">
          {row.original.createdAt}
        </div>
      );
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const router = useRouter();
      const status = JSON.parse(row.original.status || '{}').status;

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Abrir menú</span>
              <IconDotsVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={() => router.push(`/dashboard/inventario/compras/${row.original.id}`)}>
              <IconExternalLink className="mr-2 h-4 w-4" />
              Ver Detalles / Tracking
            </DropdownMenuItem>
            
            {status === "SENT" && (
              <DropdownMenuItem onClick={() => onReceive(row.original.id)}>
                <IconCircleCheckFilled className="mr-2 h-4 w-4 text-emerald-600" />
                Marcar como RECIBIDA
              </DropdownMenuItem>
            )}

            {status === "DRAFT" && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive" onClick={() => onDelete(row.original.id)}>
                  <IconBan className="mr-2 h-4 w-4" />
                  Anular Orden
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
