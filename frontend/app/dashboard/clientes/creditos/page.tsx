"use client";

import React, { useState, useEffect, useCallback } from "react";
import { API_URL } from "@/lib/constants"
import { 
  Card, CardContent, CardHeader, CardTitle, CardDescription 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  IconUser, IconHistory, IconCash, IconAlertCircle, IconCheck, IconSearch, IconCreditCard
} from "@tabler/icons-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription 
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const API = API_URL;

export default function CreditosPage() {
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/clients`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        // Filtrar solo los que tienen deuda
        setClients(data.filter((c: any) => c.currentDebt > 0));
      }
    } catch (error) {
      toast.error("Error al cargar créditos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.documentId?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOpenPayment = (client: any) => {
    setSelectedClient(client);
    setPaymentAmount(client.currentDebt.toString());
    setPaymentOpen(true);
  };

  const handleRegisterPayment = async () => {
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
      toast.error("Monto inválido");
      return;
    }

    setIsSubmitting(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/clients/${selectedClient.id}/payment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          amount: parseFloat(paymentAmount),
          notes: paymentNotes || "Abono a deuda"
        })
      });

      if (res.ok) {
        toast.success("Pago registrado y deuda actualizada");
        setPaymentOpen(false);
        setPaymentNotes("");
        loadData();
      } else {
        toast.error("Error al registrar pago");
      }
    } catch (error) {
      toast.error("Error de conexión");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 py-4 md:gap-8 md:py-6 font-sans px-4 lg:px-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cuentas por Cobrar (Fiado)</h1>
          <p className="text-muted-foreground">Gestiona las deudas de tus clientes y sus pagos.</p>
        </div>
        <div className="relative w-full md:w-80">
          <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <Input 
            placeholder="Buscar por nombre o cédula..." 
            className="pl-10 rounded-xl h-11"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 opacity-50">Cargando cuentas...</div>
      ) : filteredClients.length === 0 ? (
        <Card className="border-dashed bg-transparent">
          <CardContent className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
            <IconCheck size={48} className="mb-4 text-emerald-500" />
            <h3 className="text-lg font-semibold text-foreground">¡Todo al día!</h3>
            <p className="max-w-xs">No hay clientes con deudas pendientes actualmente.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredClients.map((c) => (
            <Card key={c.id} className="overflow-hidden shadow-sm hover:shadow-md transition-all border-none bg-white dark:bg-zinc-900 rounded-2xl group">
              <CardHeader className="pb-3 border-b bg-zinc-50/50 dark:bg-zinc-800/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                      {c.name.charAt(0)}
                    </div>
                    <div>
                      <CardTitle className="text-base truncate max-w-[150px]">{c.name}</CardTitle>
                      <CardDescription className="text-[10px] tabular-nums font-medium">{c.documentId || "S/D"}</CardDescription>
                    </div>
                  </div>
                  <Badge className={c.creditScore >= 70 ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/10 border-none" : "bg-amber-500/10 text-amber-600 hover:bg-amber-500/10 border-none"}>
                    Score: {c.creditScore || 100}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-5 space-y-4">
                <div className="flex justify-between items-end">
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Deuda Actual</span>
                    <div className="text-3xl font-black text-destructive tabular-nums">
                      ${c.currentDebt.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Límite</span>
                    <div className="text-sm font-bold text-muted-foreground">
                      ${(c.creditLimit || 0).toLocaleString()}
                    </div>
                  </div>
                </div>

                <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <IconHistory size={14} /> Último pago:
                    </span>
                    <span className="font-bold">
                      {c.lastPaymentDate ? format(new Date(c.lastPaymentDate), "dd MMM yyyy", { locale: es }) : "Nunca"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <IconAlertCircle size={14} /> Próximo vencimiento:
                    </span>
                    <span className={c.nextPaymentDate && new Date(c.nextPaymentDate) < new Date() ? "text-destructive font-black" : "font-bold"}>
                      {c.nextPaymentDate ? format(new Date(c.nextPaymentDate), "dd MMM yyyy", { locale: es }) : "No definido"}
                    </span>
                  </div>
                </div>

                <Button 
                  onClick={() => handleOpenPayment(c)} 
                  className="w-full rounded-xl h-11 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 gap-2 font-bold"
                >
                  <IconCash size={18} /> Registrar Abono
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal Abono */}
      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent className="rounded-3xl p-6 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
              <IconCreditCard className="text-primary" /> Recibir Abono
            </DialogTitle>
            <DialogDescription>
              {selectedClient?.name} debe un total de **${selectedClient?.currentDebt.toFixed(2)}**.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Monto a abonar ($)</Label>
              <Input 
                type="number" 
                className="rounded-xl h-12 text-2xl font-black text-center text-primary" 
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Notas</Label>
              <Input 
                placeholder="Ej. Pago en efectivo $20" 
                className="rounded-xl h-12"
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentOpen(false)} className="rounded-xl h-12">Cancelar</Button>
            <Button 
              onClick={handleRegisterPayment} 
              disabled={isSubmitting}
              className="rounded-xl h-12 flex-1 bg-primary shadow-lg shadow-primary/30 font-bold"
            >
              {isSubmitting ? "Procesando..." : "Confirmar Pago"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
