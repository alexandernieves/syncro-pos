"use client";

import React, { useState, useEffect, useCallback } from "react";
import { API_URL } from "@/lib/constants"
import { 
  Card, CardContent, CardHeader, CardTitle, CardDescription 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  IconUser, IconHistory, IconCash, IconAlertCircle, IconCheck, IconSearch, IconCreditCard, IconPlus, IconX
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
  const [chargeOpen, setChargeOpen] = useState(false);
  const [chargeAmount, setChargeAmount] = useState("");
  const [chargeNotes, setChargeNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Historial Completo Modal States
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyClient, setHistoryClient] = useState<any>(null);
  const [historyTransactions, setHistoryTransactions] = useState<any[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  const [historyTypeFilter, setHistoryTypeFilter] = useState<"ALL" | "DEBT" | "PAYMENT">("ALL");
  const [clientsPage, setClientsPage] = useState(1);
  const [clientsPageSize, setClientsPageSize] = useState(12);

  useEffect(() => {
    setClientsPage(1);
  }, [searchTerm]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/clients`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setClients(data); // Guardar todos los clientes
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

  // Si no hay búsqueda activa, solo mostramos clientes con saldo pendiente.
  // Si busca, buscamos entre todos los clientes registrados para permitir abrirles cuenta desde aquí.
  const filteredClients = clients.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          c.documentId?.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (searchTerm.trim() === "") {
      return c.currentDebt > 0;
    }
    return matchesSearch;
  });

  const totalClientsPages = Math.max(1, Math.ceil(filteredClients.length / clientsPageSize));

  const handleOpenPayment = (client: any) => {
    setSelectedClient(client);
    setPaymentAmount(client.currentDebt.toString());
    setPaymentOpen(true);
  };

  const handleOpenCharge = (client: any) => {
    setSelectedClient(client);
    setChargeAmount("");
    setChargeNotes("");
    setChargeOpen(true);
  };

  const handleOpenHistory = async (client: any) => {
    setHistoryClient(client);
    setHistoryOpen(true);
    setHistoryPage(1);
    setHistorySearch("");
    setHistoryTypeFilter("ALL");
    setHistoryTransactions([]);
    setLoadingHistory(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/clients/${client.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setHistoryTransactions(data.creditTransactions || []);
      }
    } catch (error) {
      toast.error("Error al cargar el historial completo");
    } finally {
      setLoadingHistory(false);
    }
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

  const handleRegisterCharge = async () => {
    if (!chargeAmount || parseFloat(chargeAmount) <= 0) {
      toast.error("Monto inválido");
      return;
    }

    setIsSubmitting(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/clients/${selectedClient.id}/charge`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          amount: parseFloat(chargeAmount),
          notes: chargeNotes || "Cargo manual de deuda"
        })
      });

      if (res.ok) {
        toast.success("Cargo registrado y deuda actualizada");
        setChargeOpen(false);
        setChargeNotes("");
        loadData();
      } else {
        toast.error("Error al registrar cargo");
      }
    } catch (error) {
      toast.error("Error de conexión");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Paginación y filtrado local del historial en el modal
  const filteredHistoryTransactions = historyTransactions.filter((t: any) => {
    const concept = (t.notes || (t.type === 'DEBT' ? 'Cargo de deuda' : 'Abono')).toLowerCase();
    const amountStr = t.amount.toString();
    let dateStr = "";
    try {
      dateStr = format(new Date(t.createdAt), "dd MMMM yyyy", { locale: es }).toLowerCase();
    } catch (_) {}
    const query = historySearch.toLowerCase();
    
    const matchesSearch = concept.includes(query) || amountStr.includes(query) || dateStr.includes(query);
    const matchesType = historyTypeFilter === "ALL" || 
                        (historyTypeFilter === "DEBT" && t.type === "DEBT") ||
                        (historyTypeFilter === "PAYMENT" && t.type === "PAYMENT");
    return matchesSearch && matchesType;
  });

  const ITEMS_PER_PAGE = 5;
  const totalPages = Math.ceil(filteredHistoryTransactions.length / ITEMS_PER_PAGE);
  const paginatedTransactions = filteredHistoryTransactions.slice(
    (historyPage - 1) * ITEMS_PER_PAGE,
    historyPage * ITEMS_PER_PAGE
  );

  return (
    <div className="flex flex-col gap-6 py-4 md:gap-8 md:py-6 font-sans px-4 lg:px-6">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Cuentas por Cobrar (Fiado)</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Gestiona de forma unificada las deudas de tus clientes y sus pagos en libreta.</p>
        </div>
        <div className="relative w-full md:w-80">
          <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" size={18} />
          <Input 
            placeholder="Buscar cliente por nombre o cédula..." 
            className="pl-10 rounded-xl h-11 border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/40 text-sm focus-visible:ring-zinc-300 dark:focus-visible:ring-zinc-700 text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-24 text-zinc-400 dark:text-zinc-500 animate-pulse text-sm uppercase tracking-wider font-semibold">Cargando libreta digital...</div>
      ) : filteredClients.length === 0 ? (
        <Card className="border border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/20 rounded-2xl shadow-none">
          <CardContent className="flex flex-col items-center justify-center py-24 text-center text-zinc-400 dark:text-zinc-500">
            <div className="size-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 dark:text-emerald-400 mb-6 shadow-lg shadow-emerald-500/5">
              <IconCheck size={28} />
            </div>
            <h3 className="text-lg font-bold text-zinc-800 dark:text-zinc-200">¡Todo al día!</h3>
            <p className="max-w-xs text-sm text-zinc-500 dark:text-zinc-500 mt-2">No hay clientes con deudas pendientes actualmente en esta sucursal.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredClients.slice((clientsPage - 1) * clientsPageSize, clientsPage * clientsPageSize).map((c) => (
            <Card key={c.id} className="overflow-hidden shadow-sm dark:shadow-none border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-950/40 backdrop-blur-md rounded-2xl group transition-all duration-300 hover:border-zinc-300 dark:hover:border-zinc-700/80">
              {/* CARD HEADER */}
              <CardHeader className="pb-4 border-b border-zinc-100 dark:border-zinc-900 bg-zinc-50/20 dark:bg-zinc-950/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-xl bg-gradient-to-tr from-zinc-100 to-zinc-200/50 dark:from-zinc-800 dark:to-zinc-700/50 border border-zinc-200 dark:border-zinc-700/30 flex items-center justify-center text-zinc-700 dark:text-zinc-200 font-bold uppercase shadow-inner">
                      {c.name.charAt(0)}
                    </div>
                    <div>
                      <CardTitle className="text-base font-bold text-zinc-800 dark:text-zinc-100 tracking-tight truncate max-w-[150px]">{c.name}</CardTitle>
                      <CardDescription className="text-[11px] text-zinc-400 dark:text-zinc-500 font-mono tracking-tight mt-0.5">{c.documentId || "Cédula S/D"}</CardDescription>
                    </div>
                  </div>
                  <Badge className={c.creditScore >= 70 
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 hover:bg-emerald-500/10" 
                    : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20 hover:bg-amber-500/10"}>
                    Score: {c.creditScore || 100}
                  </Badge>
                </div>
              </CardHeader>
              
              {/* CARD CONTENT */}
              <CardContent className="pt-5 space-y-4">
                {/* DEBT METRICS */}
                <div className="flex justify-between items-baseline border-b border-zinc-100 dark:border-zinc-900 pb-4">
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Deuda Actual</span>
                    <div className={`text-3xl font-black tabular-nums tracking-tight ${c.currentDebt > 0 ? "text-rose-600 dark:text-rose-500 dark:drop-shadow-[0_0_12px_rgba(244,63,94,0.15)]" : "text-emerald-600"}`}>
                      ${c.currentDebt.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="text-right space-y-1">
                    <span className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Límite Autorizado</span>
                    <div className="text-sm font-bold text-zinc-500 dark:text-zinc-400 tabular-nums">
                      ${(c.creditLimit || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>

                {/* DATE GRID */}
                <div className="grid grid-cols-2 gap-3 py-1">
                  <div className="flex flex-col gap-1 p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/20 border border-zinc-100 dark:border-zinc-900/60">
                    <span className="text-[9px] uppercase font-bold text-zinc-400 dark:text-zinc-500 tracking-wider flex items-center gap-1">
                      <IconHistory size={12} className="text-zinc-400 dark:text-zinc-500" /> Último Pago
                    </span>
                    <span className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
                      {c.lastPaymentDate ? format(new Date(c.lastPaymentDate), "dd MMM yyyy", { locale: es }) : "Nunca"}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/20 border border-zinc-100 dark:border-zinc-900/60">
                    <span className="text-[9px] uppercase font-bold text-zinc-400 dark:text-zinc-500 tracking-wider flex items-center gap-1">
                      <IconAlertCircle size={12} className="text-zinc-400 dark:text-zinc-500" /> Vencimiento
                    </span>
                    <span className={`text-[11px] font-semibold ${c.nextPaymentDate && new Date(c.nextPaymentDate) < new Date() ? "text-rose-600 dark:text-rose-400 font-bold" : "text-zinc-700 dark:text-zinc-300"}`}>
                      {c.nextPaymentDate ? format(new Date(c.nextPaymentDate), "dd MMM yyyy", { locale: es }) : "No definido"}
                    </span>
                  </div>
                </div>
                {/* Historial de Libreta */}
                <div className="pt-1.5">
                  <Button 
                    variant="outline"
                    onClick={() => handleOpenHistory(c)}
                    className="w-full rounded-xl h-11 bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-900/40 dark:hover:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 transition-all font-bold text-xs flex items-center justify-center gap-2 hover:shadow-sm"
                  >
                    <IconHistory size={16} className="text-zinc-400 dark:text-zinc-500" />
                    Ver Historial Completo
                  </Button>
                </div>

                {/* TWIN BUTTONS */}
                <div className="flex gap-2.5 pt-2">
                  {c.currentDebt > 0 && (
                    <Button 
                      onClick={() => handleOpenPayment(c)} 
                      className="flex-1 rounded-xl h-11 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 hover:border-emerald-300 dark:hover:border-emerald-500/30 transition-all font-bold text-xs"
                    >
                      <IconCash size={16} /> Abono
                    </Button>
                  )}
                  <Button 
                    onClick={() => handleOpenCharge(c)} 
                    className="flex-1 rounded-xl h-11 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800/80 text-zinc-800 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 transition-all font-bold text-xs"
                  >
                    <IconCreditCard size={16} /> Fiar / Cargo
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredClients.length > 0 && (
          <div className="flex items-center justify-between border-t border-zinc-150 dark:border-zinc-800 pt-5 mt-4 text-xs text-zinc-500 font-medium">
            <span>{filteredClients.length} cliente(s)</span>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span>Filas por página</span>
                <select
                  value={clientsPageSize}
                  onChange={e => { setClientsPageSize(Number(e.target.value)); setClientsPage(1); }}
                  className="h-8 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs font-semibold px-2 cursor-pointer outline-none focus:ring-2 focus:ring-primary/30 text-zinc-700 dark:text-zinc-300"
                >
                  {[6, 12, 24, 48].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <span>Página <strong className="text-zinc-700 dark:text-zinc-300">{clientsPage}</strong> de {totalClientsPages}</span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setClientsPage(1)}
                  disabled={clientsPage === 1}
                  className="size-8 flex items-center justify-center rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 hover:bg-zinc-50 dark:hover:bg-zinc-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-zinc-600 dark:text-zinc-400"
                  title="Primera página"
                >
                  <svg width="12" height="12" viewBox="0 0 15 15" fill="none"><path d="M2 7.5L7.5 2M2 7.5L7.5 13M2 7.5H13M8.5 2L14 7.5M8.5 13L14 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
                <button
                  onClick={() => setClientsPage(p => Math.max(1, p - 1))}
                  disabled={clientsPage === 1}
                  className="size-8 flex items-center justify-center rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 hover:bg-zinc-50 dark:hover:bg-zinc-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-zinc-600 dark:text-zinc-400"
                  title="Anterior"
                >
                  <svg width="12" height="12" viewBox="0 0 15 15" fill="none"><path d="M9 11L5 7.5L9 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
                <button
                  onClick={() => setClientsPage(p => Math.min(totalClientsPages, p + 1))}
                  disabled={clientsPage === totalClientsPages}
                  className="size-8 flex items-center justify-center rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 hover:bg-zinc-50 dark:hover:bg-zinc-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-zinc-600 dark:text-zinc-400"
                  title="Siguiente"
                >
                  <svg width="12" height="12" viewBox="0 0 15 15" fill="none"><path d="M6 4L10 7.5L6 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
                <button
                  onClick={() => setClientsPage(totalClientsPages)}
                  disabled={clientsPage === totalClientsPages}
                  className="size-8 flex items-center justify-center rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 hover:bg-zinc-50 dark:hover:bg-zinc-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-zinc-600 dark:text-zinc-400"
                  title="Última página"
                >
                  <svg width="12" height="12" viewBox="0 0 15 15" fill="none"><path d="M13 7.5L7.5 2M13 7.5L7.5 13M13 7.5H2M6.5 2L1 7.5M6.5 13L1 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
              </div>
            </div>
          </div>
        )}
        </>
      )}

      {/* Modal Abono */}
      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent className="rounded-2xl p-6 max-w-sm border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-200">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2 text-emerald-500 dark:text-emerald-400">
              <IconCreditCard size={20} /> Recibir Abono
            </DialogTitle>
            <DialogDescription className="text-zinc-500 dark:text-zinc-500 text-xs mt-1">
              Registra un pago para reducir la deuda de <strong className="text-zinc-700 dark:text-zinc-300">{selectedClient?.name}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label className="text-zinc-500 dark:text-zinc-400 text-xs font-semibold uppercase tracking-wider">Monto a abonar ($)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xl font-black text-zinc-400 dark:text-zinc-500">$</span>
                <Input 
                  type="number" 
                  className="rounded-xl h-12 pl-8 text-2xl font-black text-center text-emerald-500 dark:text-emerald-400 bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 focus-visible:ring-emerald-500 focus-visible:ring-offset-0" 
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                />
              </div>
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500 text-right">Deuda actual: ${selectedClient?.currentDebt.toFixed(2)}</p>
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-500 dark:text-zinc-400 text-xs font-semibold uppercase tracking-wider">Notas / Concepto</Label>
              <Input 
                placeholder="Ej. Abono en efectivo / Pago móvil" 
                className="rounded-xl h-11 bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-sm focus-visible:ring-zinc-300 dark:focus-visible:ring-zinc-700 text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPaymentOpen(false)} className="rounded-xl h-11 border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900 bg-transparent">Cancelar</Button>
            <Button 
              onClick={handleRegisterPayment} 
              disabled={isSubmitting}
              className="rounded-xl h-11 flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-lg shadow-emerald-600/20 border-none animate-all"
            >
              {isSubmitting ? "Procesando..." : "Confirmar Abono"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Nuevo Cargo / Fiar */}
      <Dialog open={chargeOpen} onOpenChange={setChargeOpen}>
        <DialogContent className="rounded-2xl p-6 max-w-sm border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-200">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2 text-primary">
              <IconCreditCard size={20} /> Registrar Cargo (Fiar)
            </DialogTitle>
            <DialogDescription className="text-zinc-500 dark:text-zinc-500 text-xs mt-1">
              Agrega una nueva deuda a la libreta de <strong className="text-zinc-700 dark:text-zinc-300">{selectedClient?.name}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label className="text-zinc-500 dark:text-zinc-400 text-xs font-semibold uppercase tracking-wider">Monto a fiar ($)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xl font-black text-zinc-400 dark:text-zinc-500">$</span>
                <Input 
                  type="number" 
                  className="rounded-xl h-12 pl-8 text-2xl font-black text-center text-primary bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 focus-visible:ring-primary focus-visible:ring-offset-0" 
                  value={chargeAmount}
                  onChange={(e) => setChargeAmount(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500 text-right">Nueva deuda estimada: ${(selectedClient?.currentDebt + (parseFloat(chargeAmount) || 0)).toFixed(2)}</p>
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-500 dark:text-zinc-400 text-xs font-semibold uppercase tracking-wider">Concepto / Notas del Fiado</Label>
              <Input 
                placeholder="Ej. Se llevó 1 refresco y harina" 
                className="rounded-xl h-11 bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-sm focus-visible:ring-zinc-300 dark:focus-visible:ring-zinc-700 text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
                value={chargeNotes}
                onChange={(e) => setChargeNotes(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setChargeOpen(false)} className="rounded-xl h-11 border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900 bg-transparent">Cancelar</Button>
            <Button 
              onClick={handleRegisterCharge} 
              disabled={isSubmitting}
              className="rounded-xl h-11 flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-lg shadow-primary/20 border-none animate-all"
            >
              {isSubmitting ? "Procesando..." : "Confirmar Fiado"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Historial Completo Paginado */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="rounded-2xl p-6 max-w-md border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-200">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2 text-zinc-800 dark:text-zinc-100">
              <IconHistory size={22} className="text-primary" /> Historial de {historyClient?.name}
            </DialogTitle>
            <DialogDescription className="text-zinc-500 dark:text-zinc-500 text-xs mt-1">
              Consulta el registro detallado de todas las compras a crédito y abonos de este cliente.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 min-h-[360px] flex flex-col justify-between">
            {loadingHistory ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 py-10">
                <div className="size-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest animate-pulse">Cargando libreta...</p>
              </div>
            ) : historyTransactions.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center text-zinc-500 py-10">
                <IconCheck size={36} className="text-emerald-500 mb-3" />
                <p className="font-semibold text-zinc-800 dark:text-zinc-200">Sin movimientos</p>
                <p className="text-xs text-zinc-500 mt-1 max-w-[200px]">No se encontraron transacciones registradas para este cliente.</p>
              </div>
            ) : (
              <div className="space-y-4 flex-1 flex flex-col justify-between">
                <div className="space-y-2.5 pb-2">
                  <div className="relative">
                    <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" size={14} />
                    <Input 
                      placeholder="Filtrar por concepto o fecha..." 
                      className="pl-8 rounded-xl h-9 border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 text-xs text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus-visible:ring-zinc-300 dark:focus-visible:ring-zinc-700"
                      value={historySearch}
                      onChange={(e) => {
                        setHistorySearch(e.target.value);
                        setHistoryPage(1);
                      }}
                    />
                  </div>
                  
                  <div className="flex gap-1.5 p-1 bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/80 rounded-xl">
                    <button
                      onClick={() => {
                        setHistoryTypeFilter("ALL");
                        setHistoryPage(1);
                      }}
                      className={`flex-1 py-1 px-2.5 rounded-lg text-[10px] font-bold tracking-tight transition-all ${
                        historyTypeFilter === "ALL"
                          ? "bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 shadow-sm border border-zinc-200/50 dark:border-zinc-750/50"
                          : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                      }`}
                    >
                      Todos
                    </button>
                    <button
                      onClick={() => {
                        setHistoryTypeFilter("DEBT");
                        setHistoryPage(1);
                      }}
                      className={`flex-1 py-1 px-2.5 rounded-lg text-[10px] font-bold tracking-tight transition-all flex items-center justify-center gap-1 ${
                        historyTypeFilter === "DEBT"
                          ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200/30 dark:border-rose-500/10 shadow-sm"
                          : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                      }`}
                    >
                      Cargos (+)
                    </button>
                    <button
                      onClick={() => {
                        setHistoryTypeFilter("PAYMENT");
                        setHistoryPage(1);
                      }}
                      className={`flex-1 py-1 px-2.5 rounded-lg text-[10px] font-bold tracking-tight transition-all flex items-center justify-center gap-1 ${
                        historyTypeFilter === "PAYMENT"
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200/30 dark:border-emerald-500/10 shadow-sm"
                          : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                      }`}
                    >
                      Abonos (-)
                    </button>
                  </div>
                </div>

                {filteredHistoryTransactions.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center text-zinc-500 py-12">
                    <IconAlertCircle size={32} className="text-zinc-405 dark:text-zinc-600 mb-2" />
                    <p className="font-semibold text-zinc-700 dark:text-zinc-300 text-xs">Sin coincidencias</p>
                    <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1">Prueba con otros términos o filtros.</p>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col justify-between space-y-4">
                    <div className="rounded-xl border border-zinc-100 dark:border-zinc-900 bg-zinc-50/30 dark:bg-zinc-950/40 overflow-hidden divide-y divide-zinc-100 dark:divide-zinc-900">
                      {paginatedTransactions.map((t: any) => (
                        <div key={t.id} className="flex justify-between items-center p-3.5 text-xs transition-colors hover:bg-zinc-100/40 dark:hover:bg-zinc-900/20">
                          <div className="space-y-1 min-w-0 flex-1">
                            <p className="font-bold text-zinc-800 dark:text-zinc-200 truncate">{t.notes || (t.type === 'DEBT' ? 'Cargo de deuda' : 'Abono')}</p>
                            <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium">
                              {(() => {
                                try {
                                  return format(new Date(t.createdAt), "dd MMMM yyyy, hh:mm a", { locale: es });
                                } catch (_) {
                                  return "Fecha desconocida";
                                }
                              })()}
                            </p>
                          </div>
                          <div className="text-right ml-3 shrink-0">
                            <span className={`font-bold tabular-nums text-xs px-2.5 py-1 rounded-full ${
                              t.type === 'DEBT' 
                                ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20" 
                                : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20"
                            }`}>
                              {t.type === 'DEBT' ? '+' : '-'}${Math.abs(t.amount).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* PAGINATION PANEL */}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between pt-3 border-t border-zinc-100 dark:border-zinc-900">
                        <span className="text-xs text-zinc-500 font-medium">
                          Página <strong className="text-zinc-700 dark:text-zinc-300">{historyPage}</strong> de {totalPages}
                        </span>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={historyPage === 1}
                            onClick={() => setHistoryPage(p => p - 1)}
                            className="rounded-lg h-8 px-3 border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 bg-transparent"
                          >
                            Anterior
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={historyPage === totalPages}
                            onClick={() => setHistoryPage(p => p + 1)}
                            className="rounded-lg h-8 px-3 border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 bg-transparent"
                          >
                            Siguiente
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="pt-2 border-t border-zinc-100 dark:border-zinc-900">
            <Button onClick={() => setHistoryOpen(false)} className="rounded-xl h-11 w-full bg-zinc-900 hover:bg-zinc-800/80 text-zinc-100 dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 font-bold border-none transition-all">
              Cerrar Historial
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
