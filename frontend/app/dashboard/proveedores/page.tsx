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
  IconTruck, IconMail, IconPhone, IconMapPin, IconUser,
  IconDeviceFloppy, IconX,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { PosTable } from "@/components/pos-table";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000";

type Supplier = {
  _id: string;
  name: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
  isActive: boolean;
};

const emptyForm = { name: "", contactName: "", email: "", phone: "", address: "" };

export default function ProveedoresPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : "";
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/suppliers`, { headers });
      const data = await res.json();
      setSuppliers(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Error al cargar los proveedores");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setForm(emptyForm); setEditId(null); setOpen(true); };
  const openEdit = (s: Supplier) => {
    setForm({
      name: s.name,
      contactName: s.contactName || "",
      email: s.email || "",
      phone: s.phone || "",
      address: s.address || "",
    });
    setEditId(s._id);
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("El nombre del proveedor es obligatorio"); return; }
    setSaving(true);
    try {
      const url = editId ? `${API}/suppliers/${editId}` : `${API}/suppliers`;
      const method = editId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(form),
      });
      if (res.ok) {
        toast.success(editId ? `Proveedor actualizado` : `Proveedor registrado`);
        setOpen(false);
        load();
      } else {
        toast.error("Error al guardar el proveedor");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    try {
      const res = await fetch(`${API}/suppliers/${id}`, { method: "DELETE", headers });
      if (res.ok) {
        toast.success(`Proveedor "${name}" eliminado`);
        load();
      } else {
        toast.error("Error al eliminar el proveedor");
      }
    } catch {
      toast.error("Error de conexión");
    }
  };

  const columns: ColumnDef<Supplier>[] = [
    {
      accessorKey: "name",
      header: "Proveedor",
      cell: ({ row }) => {
        const s = row.original;
        return (
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 text-primary rounded-lg size-10 flex items-center justify-center font-bold text-sm shrink-0">
              <IconTruck size={20} />
            </div>
            <div>
              <p className="font-medium text-sm leading-tight">{s.name}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <IconUser size={11} /> {s.contactName || "—"}
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
          <IconPhone size={13} /> {row.original.phone || "—"}
        </span>
      ),
    },
    {
      accessorKey: "email",
      header: "Correo",
      cell: ({ row }) => (
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground max-w-[180px] truncate">
          <IconMail size={13} /> {row.original.email || "—"}
        </span>
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
        const s = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8">
                <IconDotsVertical size={14} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36">
              <DropdownMenuItem onClick={() => openEdit(s)}>
                <IconPencil size={13} className="mr-2" /> Editar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => handleDelete(s._id, s.name)}>
                <IconTrash size={13} className="mr-2" /> Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div>
        <h1 className="text-2xl font-bold">Proveedores</h1>
        <p className="text-muted-foreground text-sm">{suppliers.length} proveedores registrados</p>
      </div>

      <PosTable
        columns={columns}
        data={suppliers}
        loading={loading}
        searchPlaceholder="Buscar proveedores..."
        actions={
          <Button className="gap-2" onClick={openCreate}>
            <IconPlus size={16} /> Nuevo Proveedor
          </Button>
        }
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IconTruck size={20} /> {editId ? "Editar Proveedor" : "Registrar Nuevo Proveedor"}
            </DialogTitle>
            <DialogDescription>
              {editId ? "Modifica los datos del proveedor." : "Ingresa la información del nuevo proveedor para el sistema."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            <div className="sm:col-span-2 flex flex-col gap-1.5">
              <Label>Nombre del Proveedor *</Label>
              <div className="relative">
                <IconTruck size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Ej: Distribuidora Central S.A."
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Persona de Contacto</Label>
              <div className="relative">
                <IconUser size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Juan Pérez"
                  value={form.contactName}
                  onChange={e => setForm(p => ({ ...p, contactName: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Teléfono</Label>
              <div className="relative">
                <IconPhone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="+1 555 000 000"
                  value={form.phone}
                  onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Correo Electrónico</Label>
              <div className="relative">
                <IconMail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  type="email"
                  placeholder="contacto@proveedor.com"
                  value={form.email}
                  onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                />
              </div>
            </div>

            <div className="sm:col-span-2 flex flex-col gap-1.5">
              <Label>Dirección</Label>
              <div className="relative">
                <IconMapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Calle 123, Ciudad, País"
                  value={form.address}
                  onChange={e => setForm(p => ({ ...p, address: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              <IconDeviceFloppy size={16} />
              {saving ? "Guardando..." : editId ? "Actualizar" : "Registrar Proveedor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
