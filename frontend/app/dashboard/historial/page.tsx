"use client";
import React, { useState, useEffect, useCallback } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  IconHistory, IconReceipt, IconUser, IconCash, IconCreditCard,
  IconDotsVertical, IconTrash, IconPencil,
} from "@tabler/icons-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { PosTable } from "@/components/pos-table";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000";

type Sale = {
  _id: string;
  client?: { name: string; documentId: string };
  items: Array<{ product: { name: string }; quantity: number; price: number }>;
  paymentMethod: "CASH" | "CARD";
  total: number;
  status: "COMPLETED" | "CANCELLED";
  createdAt: string;
};

const payConfig: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  CASH: { label: "Efectivo", icon: IconCash,       color: "text-green-600", bg: "bg-green-100 dark:bg-green-900/40" },
  CARD: { label: "Tarjeta",  icon: IconCreditCard, color: "text-blue-600",  bg: "bg-blue-100 dark:bg-blue-900/40" },
};

export default function HistorialPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : "";
  const headers = { Authorization: `Bearer ${token}` };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/sales`, { headers });
      const data = await res.json();
      setSales(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Error al cargar el historial de ventas");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const columns: ColumnDef<Sale>[] = [
    {
      accessorKey: "_id",
      header: "Comprobante",
      cell: ({ row }) => (
        <div className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground uppercase">
          <IconReceipt size={14} className="text-primary/60" />
          {row.original._id.slice(-8)}
        </div>
      ),
    },
    {
      accessorKey: "client",
      header: "Cliente",
      cell: ({ row }) => {
        const c = row.original.client;
        return (
          <div className="flex flex-col">
            <span className="text-sm font-medium">
              {c ? c.name : "Consumidor Final"}
            </span>
            {c && (
              <span className="text-[10px] text-muted-foreground uppercase">
                {c.documentId}
              </span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "paymentMethod",
      header: "Pago",
      cell: ({ row }) => {
        const method = row.original.paymentMethod;
        const config = payConfig[method] || { label: method, icon: IconCash, color: "text-gray-600", bg: "bg-muted" };
        const Icon = config.icon;
        return (
          <Badge variant="outline" className={`${config.bg} ${config.color} border-0 flex items-center gap-1.5 font-bold`}>
            <Icon size={12} /> {config.label}
          </Badge>
        );
      },
    },
    {
      accessorKey: "total",
      header: "Monto Total",
      cell: ({ row }) => (
        <span className="font-black text-sm text-primary tabular-nums">
          ${(row.original.total || 0).toFixed(2)}
        </span>
      ),
    },
    {
      accessorKey: "createdAt",
      header: "Fecha",
      cell: ({ row }) => (
        <div className="flex flex-col text-[11px] text-muted-foreground leading-tight">
          <span>{new Date(row.original.createdAt).toLocaleDateString()}</span>
          <span>{new Date(row.original.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: "Estado",
      cell: ({ row }) => (
        <Badge variant={row.original.status === "COMPLETED" ? "secondary" : "destructive"}>
          {row.original.status === "COMPLETED" ? "Completada" : "Cancelada"}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ table, row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8">
              <IconDotsVertical size={14} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-32">
            <DropdownMenuItem onClick={() => toast.info("Re-imprimir ticket")}>
              Imprimir
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => toast.error("Función no disponible")}>
              Anular
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <IconHistory size={24} className="text-primary" /> Historial de Ventas
          </h1>
          <p className="text-muted-foreground text-sm">Registro histórico de todas las transacciones POS.</p>
        </div>
      </div>

      <PosTable
        columns={columns}
        data={sales}
        loading={loading}
        searchPlaceholder="Buscar por cliente..."
      />
    </div>
  );
}
