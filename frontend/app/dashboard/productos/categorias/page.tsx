"use client";
import React, { useState, useEffect, useCallback } from "react";
import { API_URL } from "@/lib/constants"
import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
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
  IconTag, IconDeviceFloppy,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { PosTable } from "@/components/pos-table";
import { Checkbox } from "@/components/ui/checkbox";
import { IconX, IconDownload } from "@tabler/icons-react";
import * as XLSX from "xlsx";

const API = process.env.NEXT_PUBLIC_API_URL || ``${API_URL}`;

type Category = {
  _id: string;
  name: string;
  description: string;
};

const emptyForm = { name: "", description: "" };

export default function CategoriasPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : "";
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/categories`, { headers });
      const data = await res.json();
      setCategories(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Error al cargar las categorías");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setForm(emptyForm); setEditId(null); setOpen(true); };
  const openEdit = (c: Category) => {
    setForm({ name: c.name, description: c.description || "" });
    setEditId(c._id);
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("El nombre de la categoría es obligatorio"); return; }
    setSaving(true);
    try {
      const url = editId ? `${API}/categories/${editId}` : `${API}/categories`;
      const method = editId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(form),
      });
      if (res.ok) {
        toast.success(editId ? `Categoría actualizada` : `Categoría registrada`);
        setOpen(false);
        load();
      } else {
        toast.error("Error al guardar la categoría");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setSaving(false);
    }
  };

  const handleExport = () => {
    try {
      const selectedIds = Object.keys(rowSelection);
      const isSelected = selectedIds.length > 0;
      
      const categoriesToExport = isSelected 
        ? categories.filter(c => selectedIds.includes(c._id)) 
        : categories;

      if (categoriesToExport.length === 0) return toast.info("No hay categorías para exportar");

      const dataToExport = categoriesToExport.map(c => ({
        ID: c._id,
        Nombre: c.name,
        Descripcion: c.description || ""
      }));

      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Categorias");
      XLSX.writeFile(wb, `Syncro_Categorias_${isSelected ? 'Seleccion_' : ''}${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success(isSelected ? "Categorías seleccionadas exportadas" : "Todas las categorías exportadas");
    } catch (e) {
      toast.error("Error al exportar categorías");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    try {
      const res = await fetch(`${API}/categories/${id}`, { method: "DELETE", headers });
      if (res.ok) {
        toast.success(`Categoría "${name}" eliminada`);
        load();
      } else {
        toast.error("Error al eliminar la categoría");
      }
    } catch {
      toast.error("Error de conexión");
    }
  };

  const handleBulkDelete = async () => {
    const selectedIds = Object.keys(rowSelection);
    if (selectedIds.length === 0) return;

    const confirmed = window.confirm(`¿Estás seguro de eliminar ${selectedIds.length} categorías?`);
    if (!confirmed) return;

    toast.promise(
      async () => {
        let successCount = 0;
        let failCount = 0;

        for (const id of selectedIds) {
          try {
            const res = await fetch(`${API}/categories/${id}`, {
              method: "DELETE",
              headers
            });
            if (res.ok) successCount++;
            else failCount++;
          } catch (e) {
            failCount++;
          }
        }

        setRowSelection({});
        load();
        
        if (failCount > 0) {
          throw new Error(`Se eliminaron ${successCount} categorías, pero ${failCount} fallaron.`);
        }
        return true;
      },
      {
        loading: "Eliminando categorías seleccionadas...",
        success: "Categorías eliminadas correctamente",
        error: (err) => err.message,
      }
    );
  };

  const columns: ColumnDef<Category>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "name",
      header: "Nombre",
      cell: ({ row }) => (
        <div className="flex items-center gap-3 font-medium">
          <div className="bg-primary/10 text-primary rounded-lg p-2 shrink-0">
            <IconTag size={18} />
          </div>
          {row.original.name}
        </div>
      ),
    },
    {
      accessorKey: "description",
      header: "Descripción",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground whitespace-pre-wrap">
          {row.original.description || "—"}
        </span>
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
                <IconDotsVertical size={14} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36">
              <DropdownMenuItem onClick={() => openEdit(c)}>
                <IconPencil size={13} className="mr-2" /> Editar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => handleDelete(c._id, c.name)}>
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
        <h1 className="text-2xl font-bold">Categorías</h1>
        <p className="text-muted-foreground text-sm">{categories.length} categorías registradas</p>
      </div>

      <PosTable
        columns={columns}
        data={categories}
        loading={loading}
        rowSelection={rowSelection}
        onRowSelectionChange={setRowSelection}
        getRowId={(row) => row._id}
        searchPlaceholder="Buscar categorías..."
        bulkActions={
          Object.keys(rowSelection).length > 0 && (
            <Button 
              variant="destructive" 
              size="sm" 
              className="h-8 gap-2 font-bold text-xs"
              onClick={handleBulkDelete}
            >
              <IconTrash size={14} /> Eliminar Seleccionadas ({Object.keys(rowSelection).length})
            </Button>
          )
        }
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" className="gap-2 border-primary/20 text-muted-foreground" onClick={handleExport}>
              <IconDownload size={16} /> Exportar
            </Button>
            <Button className="gap-2" onClick={openCreate}>
              <IconPlus size={16} /> Nueva Categoría
            </Button>
          </div>
        }
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IconTag size={20} /> {editId ? "Editar Categoría" : "Registrar Nueva Categoría"}
            </DialogTitle>
            <DialogDescription>
              {editId ? "Modifica el nombre y descripción de la categoría." : "Ingresa los datos para clasificar tus productos."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label>Nombre de la Categoría *</Label>
              <Input
                placeholder="Ej: Bebidas, Limpieza..."
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Descripción</Label>
              <Input
                placeholder="Detalles sobre esta categoría..."
                value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              <IconDeviceFloppy size={16} />
              {saving ? "Guardando..." : editId ? "Actualizar" : "Registrar Categoría"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
