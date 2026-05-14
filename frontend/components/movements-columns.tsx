"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { IconArrowUpRight, IconArrowDownLeft, IconArrowsExchange, IconClipboardList } from "@tabler/icons-react"

export const movementsColumns: ColumnDef<any>[] = [
  {
    accessorKey: "createdAt",
    header: "Fecha",
    cell: ({ row }) => (
      <div className="text-xs font-medium">
        {format(new Date(row.original.createdAt), "dd MMM, HH:mm", { locale: es })}
      </div>
    ),
  },
  {
    accessorKey: "variant",
    header: "Producto",
    cell: ({ row }) => (
      <div className="flex flex-col">
        <span className="text-sm font-bold">{row.original.variant?.product?.name}</span>
        <span className="text-[10px] text-muted-foreground uppercase">{row.original.variant?.name !== 'Default' ? row.original.variant?.name : 'Único'}</span>
      </div>
    ),
  },
  {
    accessorKey: "type",
    header: "Tipo",
    cell: ({ row }) => {
      const type = row.original.type;
      const config: any = {
        IN: { label: "Entrada", color: "text-emerald-600 bg-emerald-500/10", icon: IconArrowDownLeft },
        OUT: { label: "Salida", color: "text-rose-600 bg-rose-500/10", icon: IconArrowUpRight },
        ADJUSTMENT: { label: "Ajuste", color: "text-amber-600 bg-amber-500/10", icon: IconClipboardList },
        TRANSFER_IN: { label: "Traslado (E)", color: "text-blue-600 bg-blue-500/10", icon: IconArrowsExchange },
        TRANSFER_OUT: { label: "Traslado (S)", color: "text-blue-600 bg-blue-500/10", icon: IconArrowsExchange },
      };
      const item = config[type] || { label: type, color: "text-muted-foreground bg-muted", icon: IconClipboardList };
      const Icon = item.icon;

      return (
        <Badge variant="outline" className={`gap-1 border-none font-bold ${item.color}`}>
          <Icon size={12} />
          {item.label}
        </Badge>
      );
    },
  },
  {
    accessorKey: "quantity",
    header: "Cant.",
    cell: ({ row }) => (
      <div className={`text-sm font-bold ${row.original.quantity > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
        {row.original.quantity > 0 ? `+${row.original.quantity}` : row.original.quantity}
      </div>
    ),
  },
  {
    accessorKey: "reason",
    header: "Motivo",
    cell: ({ row }) => (
      <div className="text-xs italic text-muted-foreground lowercase">
        {row.original.reason || "--"}
      </div>
    ),
  },
]
