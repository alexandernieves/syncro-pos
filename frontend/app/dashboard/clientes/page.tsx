"use client";
import React, { useState, useEffect, useCallback } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  IconPlus, IconPencil, IconTrash, IconDotsVertical,
  IconId, IconPhone, IconMapPin, IconMail, IconUser, IconDeviceFloppy,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { PosTable } from "@/components/pos-table";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000";
const emptyForm = { name: "", documentId: "", phone: "", address: "", email: "" };

type Client = {
  _id: string;
  name: string;
  documentId: string;
  phone: string;
  address: string;
  email: string;
  totalPurchases: number;
  isActive: boolean;
};

export default function ClientesPage() {
  const [clients, setClients]       = useState<Client[]>([]);
  const [loading, setLoading]       = useState(true);
  const [open, setOpen]             = useState(false);
  const [form, setForm]             = useState(emptyForm);
  const [editId, setEditId]         = useState<string | null>(null);
  const [saving, setSaving]         = useState(false);

  const token   = typeof window !== "undefined" ? localStorage.getItem("token") : "";
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${API}/clients`, { headers });
      const data = await res.json();
      setClients(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Error al cargar los clientes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setForm(emptyForm); setEditId(null); setOpen(true); };
  const openEdit   = (c: Client) => {
    setForm({ name: c.name ?? "", documentId: c.documentId ?? "", phone: c.phone ?? "", address: c.address ?? "", email: c.email ?? "" });
    setEditId(c._id);
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.documentId.trim()) { toast.error("El documento de identidad es obligatorio"); return; }
    if (!form.phone.trim())      { toast.error("El teléfono es obligatorio"); return; }
    setSaving(true);
    try {
      const url    = editId ? `${API}/clients/${editId}` : `${API}/clients`;
      const method = editId ? "PUT" : "POST";
      const res    = await fetch(url, { method, headers, body: JSON.stringify(form) });
      if (res.ok) {
        toast.success(editId ? `Cliente actualizado correctamente` : `Cliente registrado exitosamente`);
        setOpen(false);
        load();
      } else {
        toast.error("Error al guardar el cliente");
      }
    } catch {
      toast.error("Error de conexión con el servidor");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    try {
      const res = await fetch(`${API}/clients/${id}`, { method: "DELETE", headers });
      if (res.ok) {
        toast.success(`Cliente "${name || id}" eliminado`);
        load();
      } else {
        toast.error("Error al eliminar el cliente");
      }
    } catch {
      toast.error("Error de conexión");
    }
  };

  // ─── Columns definition ───────────────────────────────────────────────────
  const columns: ColumnDef<Client>[] = [
    {
      accessorKey: "name",
      header: "Cliente",
      cell: ({ row }) => {
        const c = row.original;
        const initials = (c.name || c.documentId || "?").charAt(0).toUpperCase();
        return (
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 text-primary rounded-full size-9 flex items-center justify-center font-bold text-sm shrink-0">
              {initials}
            </div>
            <div>
              <p className="font-medium text-sm leading-tight">{c.name || <span className="text-muted-foreground italic">Sin nombre</span>}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <IconId size={11}/>{c.documentId}
              </p>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "phone",
      header: "Teléfono",
      cell: ({ row }) => (
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <IconPhone size={13}/>{row.original.phone || "—"}
        </span>
      ),
    },
    {
      accessorKey: "address",
      header: "Dirección",
      cell: ({ row }) => (
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground max-w-[200px] truncate">
          <IconMapPin size={13}/>{row.original.address || "—"}
        </span>
      ),
    },
    {
      accessorKey: "totalPurchases",
      header: "Compras",
      cell: ({ row }) => (
        <Badge variant="outline">${(row.original.totalPurchases || 0).toFixed(2)}</Badge>
      ),
    },
    {
      accessorKey: "isActive",
      header: "Estado",
      cell: ({ row }) => (
        <Badge className={row.original.isActive ? "bg-green-600/10 text-green-700 border-green-200" : "bg-muted text-muted-foreground"} variant="outline">
          {row.original.isActive ? "Activo" : "Inactivo"}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const c = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8">
                <IconDotsVertical size={14}/>
                <span className="sr-only">Opciones</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36">
              <DropdownMenuItem onClick={() => openEdit(c)}>
                <IconPencil size={13} className="mr-2"/>Editar
              </DropdownMenuItem>
              <DropdownMenuSeparator/>
              <DropdownMenuItem variant="destructive" onClick={() => handleDelete(c._id, c.name)}>
                <IconTrash size={13} className="mr-2"/>Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Clientes</h1>
        <p className="text-muted-foreground text-sm">{clients.length} clientes registrados</p>
      </div>

      {/* Table */}
      <PosTable
        columns={columns}
        data={clients}
        loading={loading}
        searchPlaceholder="Buscar por nombre, documento..."
        actions={
          <Button className="gap-2" onClick={openCreate}>
            <IconPlus size={16}/>Nuevo Cliente
          </Button>
        }
      />

      {/* ─── Modal ─── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IconUser size={20}/>{editId ? "Editar Cliente" : "Registrar Nuevo Cliente"}
            </DialogTitle>
            <DialogDescription>
              {editId ? "Actualiza los datos del cliente." : "Completa los campos para registrar al cliente en el sistema."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            {/* Nombre */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="client-name">Nombre Completo <span className="text-xs text-muted-foreground">(opcional)</span></Label>
              <div className="relative">
                <IconUser size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/>
                <Input id="client-name" className="pl-9" placeholder="Ej: Juan Pérez"
                  value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}/>
              </div>
            </div>

            {/* Documento */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="client-doc">Documento de Identidad <span className="text-destructive">*</span></Label>
              <div className="relative">
                <IconId size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/>
                <Input id="client-doc" className="pl-9" placeholder="Cédula, DNI, Pasaporte..."
                  value={form.documentId} onChange={e => setForm(p => ({ ...p, documentId: e.target.value }))}/>
              </div>
            </div>

            {/* Teléfono */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="client-phone">Teléfono <span className="text-destructive">*</span></Label>
              <div className="relative">
                <IconPhone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/>
                <Input id="client-phone" className="pl-9" placeholder="+1 555 000 000"
                  value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}/>
              </div>
            </div>

            {/* Dirección */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="client-address">Dirección</Label>
              <div className="relative">
                <IconMapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/>
                <Input id="client-address" className="pl-9" placeholder="Calle 123, Ciudad, País"
                  value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))}/>
              </div>
            </div>

            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="client-email">Correo Electrónico <span className="text-xs text-muted-foreground">(opcional)</span></Label>
              <div className="relative">
                <IconMail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/>
                <Input id="client-email" className="pl-9" type="email" placeholder="correo@ejemplo.com"
                  value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}/>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              <IconDeviceFloppy size={16}/>
              {saving ? "Guardando..." : editId ? "Actualizar" : "Registrar Cliente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
