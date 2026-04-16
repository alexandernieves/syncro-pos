"use client"

import * as React from "react"
import { z } from "zod"
import {
  IconDotsVertical,
  IconGripVertical,
  IconBuildingStore,
  IconPackage,
  IconMail,
  IconPhone,
  IconExternalLink,
  IconPlus,
  IconBan,
  IconId,
  IconUser,
  IconCircleCheckFilled,
  IconAlertTriangle,
  IconLoader
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

export const suppliersSchema = z.object({
  id: z.union([z.number(), z.string()]),
  header: z.string(),        // Nombre / Razón Social
  type: z.string(),          // RIF / ID
  status: z.string(),        // Estatus / Badge
  target: z.string(),        // Contacto (Email/Tlf)
  limit: z.string(),         // Suministros (Count)
  reviewer: z.string(),      // Vendedor Asignado
  raw: z.any(),              // Objeto crudo del proveedor
})

export const getSuppliersColumns = (onEdit: (supplier: any) => void, onDelete: (id: string) => void): ColumnDef<z.infer<typeof suppliersSchema>>[] => [
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
          className="text-slate-500/50 size-7 hover:bg-white/5"
        >
          <IconGripVertical className="size-3" />
        </Button>
      )
    },
  },
  {
    accessorKey: "header",
    header: "Socio Comercial",
    cell: ({ row }) => {
      const data = JSON.parse(row.original.header || '{}');
      return (
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-xl bg-muted/20 flex items-center justify-center text-muted-foreground shrink-0 border border-muted/30">
            <IconBuildingStore size={18} stroke={1.5} />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium tracking-tight text-foreground leading-none mb-1.5">
              {data.name}
            </span>
            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-tight border border-muted-foreground/30 w-fit px-2 py-0.5 rounded-md bg-transparent">
              {data.category || "PROVEEDOR MASTER"}
            </span>
          </div>
        </div>
      );
    },
  },
  {
    accessorKey: "type",
    header: "ID Fiscal",
    cell: ({ row }) => {
      const data = JSON.parse(row.original.type || '{}');
      return (
        <div className="flex items-center gap-2 text-xs font-normal text-muted-foreground uppercase tracking-tighter">
          <IconId size={14} className="opacity-30 text-muted-foreground" />
          {data.taxId || "N/A"}
        </div>
      );
    },
  },
  {
    accessorKey: "target",
    header: "Contacto",
    cell: ({ row }) => {
      const data = JSON.parse(row.original.target || '{}');
      return (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-[11px] font-normal text-muted-foreground">
            <IconMail size={12} className="text-muted-foreground" />
            <span className="line-clamp-1">{data.email || "Sin correo"}</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] font-normal text-muted-foreground">
            <IconPhone size={12} className="text-muted-foreground" />
            <span>{data.phone || "Sin teléfono"}</span>
          </div>
        </div>
      );
    },
  },
  {
    accessorKey: "limit",
    header: "Suministros",
    cell: ({ row }) => {
      const data = JSON.parse(row.original.limit || '{}');
      return (
        <div className="flex items-center gap-2 px-3 py-1 border border-muted-foreground/30 bg-muted/20 rounded-md w-fit">
          <IconPackage size={12} className="text-muted-foreground" />
          <span className="text-[10px] font-normal text-muted-foreground tracking-tight">{data.productsCount || 0} PROD</span>
        </div>
      );
    },
  },
  {
    accessorKey: "status",
    header: "Estado",
    cell: ({ row }) => {
      const status = JSON.parse(row.original.status || '{}');
      const isActive = status.status === "active" || status.status === "Activo" || status.status === "ACTIVE";
      const isPending = status.status === "pending" || status.status === "Pendiente" || status.status === "PENDING";
      
      return (
        <Badge variant="outline" className={`px-1.5 font-bold tracking-tight border-none ${isActive ? 'bg-emerald-500/10 text-emerald-600' : isPending ? 'bg-amber-500/10 text-amber-600' : 'bg-rose-500/10 text-rose-600'}`}>
          {isActive ? (
            <IconCircleCheckFilled size={14} className="mr-1 shadow-sm" />
          ) : isPending ? (
            <IconAlertTriangle size={14} className="mr-1" />
          ) : (
            <IconLoader className="mr-1 animate-spin" size={14} />
          )}
          {status.status || "Activo"}
        </Badge>
      );
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const router = useRouter();
      // Recover the full supplier object from row state if possible, or just pass the ID
      // For this table, the ID is in row.original.id
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <IconDotsVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => router.push(`/dashboard/proveedores/${row.original.id}`)}>
              <IconExternalLink className="mr-2 h-4 w-4" />
              Ficha Técnica del Proveedor
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => {
              // We pass the raw supplier data to the edit handler
              onEdit(row.original.raw);
            }}>
              <IconUser className="mr-2 h-4 w-4" />
              Editar Datos Generales
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push(`/dashboard/inventario?supplierId=${row.original.id}`)}>
              <IconPackage className="mr-2 h-4 w-4" />
              Catálogo de Suministros
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push(`/dashboard/proveedores/${row.original.id}?tab=compras`)}>
              <IconPlus className="mr-2 h-4 w-4" />
              Generar Orden Compra
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" onClick={() => onDelete(row.original.id as string)}>
              <IconBan className="mr-2 h-4 w-4" />
              Restringir / Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
