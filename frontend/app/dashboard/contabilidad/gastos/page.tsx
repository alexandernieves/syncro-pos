"use client";

import React, { useState, useEffect, useCallback } from "react";
import { API_URL } from "@/lib/constants"
import { 
  Card, CardContent, CardHeader, CardTitle, CardDescription 
} from "@/components/ui/card";
import { 
  Button 
} from "@/components/ui/button";
import { 
  Badge 
} from "@/components/ui/badge";
import { 
  IconPlus, IconTrash, IconCash, IconReceipt, IconTag
} from "@tabler/icons-react";
import { toast } from "sonner";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription 
} from "@/components/ui/dialog";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const API = API_URL;

const CATEGORIES = [
  "Servicios (Luz/Agua)",
  "Suministros Oficina",
  "Mantenimiento",
  "Flete / Transporte",
  "Alimentación",
  "Otros"
];

export default function GastosPage() {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    amount: "",
    category: "",
    description: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentBranchId = typeof window !== 'undefined' ? localStorage.getItem("currentBranchId") : "";

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const [res, statsRes] = await Promise.all([
        fetch(`${API}/expenses?branchId=${currentBranchId}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${API}/expenses/stats?branchId=${currentBranchId}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      if (res.ok) setExpenses(await res.json());
      if (statsRes.ok) {
        const stats = await statsRes.json();
        setTotalExpenses(stats.totalAmount);
      }
    } catch (error) {
      toast.error("Error al cargar gastos");
    } finally {
      setLoading(false);
    }
  }, [currentBranchId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSubmit = async () => {
    if (!formData.amount || !formData.category) {
      toast.error("Completa los campos obligatorios");
      return;
    }

    setIsSubmitting(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/expenses`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          ...formData,
          amount: parseFloat(formData.amount),
          branchId: currentBranchId
        })
      });

      if (res.ok) {
        toast.success("Gasto registrado correctamente");
        setIsCreateOpen(false);
        setFormData({ amount: "", category: "", description: "" });
        loadData();
      } else {
        toast.error("Error al registrar gasto");
      }
    } catch (error) {
      toast.error("Error de conexión");
    } finally {
      setIsSubmitting(false);
    }
  };

  const executeDelete = async (id: string) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/expenses/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        toast.success("Gasto eliminado");
        loadData();
      }
    } catch (error) {
      toast.error("Error al eliminar");
    }
  };

  return (
    <div className="flex flex-col gap-6 py-4 md:gap-8 md:py-6 font-sans px-4 lg:px-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gastos de Caja Chica</h1>
          <p className="text-muted-foreground">Registra salidas de efectivo de la sucursal actual.</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} className="rounded-xl shadow-lg shadow-primary/20 bg-primary hover:bg-primary/90">
          <IconPlus className="mr-2 h-4 w-4" /> Registrar Gasto
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1 border-none bg-gradient-to-br from-primary/10 to-primary/5 shadow-sm rounded-2xl">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-primary uppercase tracking-wider">Total Gastos del Mes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">
              ${totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-2">Monto total acumulado en la sucursal activa.</p>
          </CardContent>
        </Card>

        <Card className="md:col-span-2 border-none bg-white dark:bg-zinc-900 shadow-sm rounded-2xl">
          <CardHeader>
            <CardTitle>Historial de Salidas</CardTitle>
            <CardDescription>Lista de gastos registrados recientemente.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {loading ? (
                <div className="text-center py-10 opacity-50">Cargando...</div>
              ) : expenses.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">No hay gastos registrados.</div>
              ) : (
                <div className="divide-y">
                  {expenses.map((g) => (
                    <div key={g.id} className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
                      <div className="flex items-center gap-3">
                        <div className="bg-zinc-100 dark:bg-zinc-800 p-2 rounded-lg">
                          <IconReceipt className="text-muted-foreground" size={20} />
                        </div>
                        <div>
                          <div className="font-bold text-sm">{g.category}</div>
                          <div className="text-xs text-muted-foreground">{g.description || "Sin descripción"}</div>
                          <div className="text-[10px] text-muted-foreground flex items-center gap-2 mt-1">
                            <span>{format(new Date(g.createdAt), "dd/MM/yyyy HH:mm")}</span>
                            <span className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded">{g.user.name}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-sm font-black text-destructive">
                          -${g.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteId(g.id)} className="h-8 w-8 text-muted-foreground hover:text-destructive">
                          <IconTrash size={16} />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modal Registrar Gasto */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
              <IconCash className="text-primary" /> Registrar Nueva Salida
            </DialogTitle>
            <DialogDescription>
              Asegúrate de tener el comprobante físico de este gasto.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Monto ($)</Label>
              <Input 
                type="number" 
                placeholder="0.00" 
                className="rounded-xl h-12 text-lg font-bold" 
                value={formData.amount}
                onChange={(e) => setFormData({...formData, amount: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label>Categoría</Label>
              <Select value={formData.category} onValueChange={(v) => setFormData({...formData, category: v})}>
                <SelectTrigger className="rounded-xl h-12">
                  <SelectValue placeholder="Selecciona una categoría" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {CATEGORIES.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Descripción / Motivo</Label>
              <Input 
                placeholder="Ej. Pago de flete Maracaibo" 
                className="rounded-xl h-12"
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)} className="rounded-xl h-12">Cancelar</Button>
            <Button 
              onClick={handleSubmit} 
              disabled={isSubmitting}
              className="rounded-xl h-12 px-8 bg-primary shadow-lg shadow-primary/30"
            >
              {isSubmitting ? "Registrando..." : "Guardar Gasto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Confirmar Eliminar Gasto */}
      <Dialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <DialogContent className="rounded-3xl p-6 sm:max-w-md bg-background border border-border shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2 text-destructive">
              <IconTrash size={22} /> Confirmar Eliminación
            </DialogTitle>
            <DialogDescription className="text-muted-foreground pt-1.5">
              ¿Estás seguro de que deseas eliminar este registro de gasto? Esta acción es irreversible y afectará el balance de caja chica.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button 
              variant="outline" 
              onClick={() => setDeleteId(null)} 
              className="rounded-xl h-11 border-border text-foreground hover:bg-muted"
            >
              Cancelar
            </Button>
            <Button 
              onClick={async () => {
                if (deleteId) {
                  await executeDelete(deleteId);
                  setDeleteId(null);
                }
              }} 
              className="rounded-xl h-11 bg-destructive hover:bg-destructive/90 text-destructive-foreground shadow-lg shadow-destructive/20 font-bold"
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
