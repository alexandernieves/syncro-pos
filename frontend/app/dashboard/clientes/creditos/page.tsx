"use client";

import React, { useState, useEffect, useCallback } from "react";
import { API_URL } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  IconUser, IconHistory, IconCash, IconAlertCircle, IconCheck, IconSearch,
  IconCreditCard, IconInfoCircle, IconArrowLeft, IconCalendar,
  IconReceipt, IconShoppingCart, IconSettings
} from "@tabler/icons-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  PolarGrid, PolarRadiusAxis, RadialBar, RadialBarChart, Label as RechartsLabel
} from "recharts";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";

const API = API_URL;

// ─── Mini Radial Credit Gauge ────────────────────────────────────────────────
function CreditRadialCard({ client }: { client: any }) {
  const limit = client.creditLimit || 0;
  const debt = client.currentDebt || 0;
  const available = Math.max(0, limit - debt);
  const pct = limit > 0 ? Math.round((available / limit) * 100) : 0;

  if (limit === 0) {
    return (
      <div className="flex items-center gap-4 py-3 border-b border-zinc-100 dark:border-zinc-900">
        <div className="mx-auto size-[90px] shrink-0 flex items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500">
          <IconReceipt size={32} className="opacity-90 animate-pulse" />
        </div>
        <div className="flex-1 space-y-2">
          <div>
            <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Crédito Disponible</p>
            <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">
              Sin Límite
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-[8px] font-bold text-zinc-400 uppercase">Límite</p>
              <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-md uppercase tracking-tight">Tradicional</span>
            </div>
            <div>
              <p className="text-[8px] font-bold text-zinc-400 uppercase">Usado</p>
              <p className="text-xs font-bold text-rose-600 dark:text-rose-400">${debt.toFixed(2)}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const chartConfig: ChartConfig = {
    available: { label: "Disponible", color: available > 0 ? "hsl(142 71% 45%)" : "hsl(0 72% 51%)" },
  };
  const chartData = [{ name: "available", value: pct, fill: available > 0 ? "hsl(142 71% 45%)" : "hsl(0 72% 51%)" }];

  return (
    <div className="flex items-center gap-4 py-3 border-b border-zinc-100 dark:border-zinc-900">
      <ChartContainer config={chartConfig} className="mx-auto aspect-square w-[90px] shrink-0">
        <RadialBarChart data={chartData} startAngle={90} endAngle={90 - 360 * (pct / 100)} innerRadius={30} outerRadius={44}>
          <PolarGrid gridType="circle" radialLines={false} stroke="none" className="first:fill-zinc-100 dark:first:fill-zinc-900 last:fill-card" />
          <RadialBar dataKey="value" background cornerRadius={10} />
          <PolarRadiusAxis tick={false} tickLine={false} axisLine={false}>
            <RechartsLabel
              content={({ viewBox }) => {
                if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                  return (
                    <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                      <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-[11px] font-black">{pct}%</tspan>
                    </text>
                  );
                }
              }}
            />
          </PolarRadiusAxis>
        </RadialBarChart>
      </ChartContainer>
      <div className="flex-1 space-y-2">
        <div>
          <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Crédito Disponible</p>
          <p className={`text-xl font-black tabular-nums ${available > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
            ${available.toFixed(2)}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-[8px] font-bold text-zinc-400 uppercase">Límite</p>
            <p className="text-xs font-bold text-zinc-600 dark:text-zinc-300">${limit.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-[8px] font-bold text-zinc-400 uppercase">Usado</p>
            <p className="text-xs font-bold text-rose-600 dark:text-rose-400">${debt.toFixed(2)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CreditosPage() {
  const [clients, setClients] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Abono Modal
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [paymentCurrency, setPaymentCurrency] = useState<"USD" | "VES" | "COP">("USD");
  const [paidAmountRaw, setPaidAmountRaw] = useState("");
  const [customRate, setCustomRate] = useState("");
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Limit Modal
  const [limitOpen, setLimitOpen] = useState(false);
  const [limitAmount, setLimitAmount] = useState("");
  const [isTraditional, setIsTraditional] = useState(false);
  const [selectedClientForLimit, setSelectedClientForLimit] = useState<any>(null);
  const [isUpdatingLimit, setIsUpdatingLimit] = useState(false);

  // Surcharge/Commission Section within Limit Modal
  const [surchargeType, setSurchargeType] = useState<"PERCENT" | "FIXED">("PERCENT");
  const [surchargeValue, setSurchargeValue] = useState("");
  const [surchargeNotes, setSurchargeNotes] = useState("");
  const [isApplyingSurcharge, setIsApplyingSurcharge] = useState(false);

  // History Modal
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyClient, setHistoryClient] = useState<any>(null);
  const [historyTransactions, setHistoryTransactions] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  const [historyTypeFilter, setHistoryTypeFilter] = useState<"ALL" | "DEBT" | "PAYMENT">("ALL");
  const [historyDateFrom, setHistoryDateFrom] = useState("");
  const [historyDateTo, setHistoryDateTo] = useState("");

  // Transaction Detail
  const [selectedTx, setSelectedTx] = useState<any>(null);
  const [txSaleDetail, setTxSaleDetail] = useState<any>(null);
  const [loadingTxDetail, setLoadingTxDetail] = useState(false);

  // Pagination
  const [clientsPage, setClientsPage] = useState(1);
  const [clientsPageSize, setClientsPageSize] = useState(12);
  const [historyPage, setHistoryPage] = useState(1);

  useEffect(() => { setClientsPage(1); }, [searchTerm]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const [clientsRes, settingsRes] = await Promise.all([
        fetch(`${API}/clients`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/settings`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (clientsRes.ok) setClients(await clientsRes.json());
      if (settingsRes.ok) setSettings(await settingsRes.json());
    } catch {
      toast.error("Error al cargar créditos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Currency conversion
  useEffect(() => {
    if (!paymentOpen) return;
    if (paymentCurrency === "USD") {
      setPaymentAmount(paidAmountRaw);
    } else {
      const rate = parseFloat(customRate) || (paymentCurrency === "VES" ? (settings?.exchangeRate || 40) : 4000);
      setPaymentAmount(rate > 0 && paidAmountRaw ? (parseFloat(paidAmountRaw) / rate).toFixed(2) : "");
    }
  }, [paymentCurrency, paidAmountRaw, customRate, paymentOpen, settings]);

  // Only show clients with active debt (outstanding balance)
  const filteredClients = clients.filter(c => {
    const hasCredit = c.currentDebt > 0;
    if (!hasCredit) return false;
    if (searchTerm.trim() === "") return true;
    return (
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.documentId?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const totalClientsPages = Math.max(1, Math.ceil(filteredClients.length / clientsPageSize));

  const handleOpenHistory = async (client: any) => {
    setHistoryClient(client);
    setHistoryOpen(true);
    setHistorySearch("");
    setHistoryTypeFilter("ALL");
    setHistoryDateFrom("");
    setHistoryDateTo("");
    setHistoryPage(1);
    setSelectedTx(null);
    setTxSaleDetail(null);
    setHistoryTransactions([]);
    setLoadingHistory(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/clients/${client.id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setHistoryTransactions(data.creditTransactions || []);
      }
    } catch {
      toast.error("Error al cargar el historial");
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleTxClick = async (tx: any) => {
    setSelectedTx(tx);
    setTxSaleDetail(null);
    if (tx.type === "DEBT" && tx.saleId) {
      setLoadingTxDetail(true);
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API}/sales/${tx.saleId}`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) setTxSaleDetail(await res.json());
      } catch { /* silent */ } finally {
        setLoadingTxDetail(false);
      }
    }
  };

  const handleOpenPayment = (client: any) => {
    setSelectedClient(client);
    setPaymentAmount(client.currentDebt.toString());
    setPaidAmountRaw(client.currentDebt.toString());
    setPaymentCurrency("USD");
    setCustomRate("");
    setPaymentNotes("");
    setPaymentOpen(true);
  };

  const handleOpenLimitModal = (client: any) => {
    setSelectedClientForLimit(client);
    setIsTraditional(client.creditLimit === 0);
    setLimitAmount(client.creditLimit > 0 ? client.creditLimit.toString() : "100");
    // Reset surcharge fields
    setSurchargeType("PERCENT");
    setSurchargeValue("");
    setSurchargeNotes("");
    setLimitOpen(true);
  };

  const handleUpdateLimit = async () => {
    if (!selectedClientForLimit) return;
    const finalLimit = isTraditional ? 0 : parseFloat(limitAmount);
    if (!isTraditional && (isNaN(finalLimit) || finalLimit < 0)) {
      toast.error("Por favor ingresa un límite válido");
      return;
    }
    
    // Check if limit is less than current debt
    if (finalLimit > 0 && finalLimit < selectedClientForLimit.currentDebt) {
      toast.error(`El límite no puede ser menor a la deuda actual ($${selectedClientForLimit.currentDebt.toFixed(2)})`);
      return;
    }

    setIsUpdatingLimit(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/clients/${selectedClientForLimit.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          creditLimit: finalLimit
        })
      });
      if (res.ok) {
        toast.success("Límite de crédito actualizado");
        setLimitOpen(false);
        loadData();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.message || "Error al actualizar límite");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setIsUpdatingLimit(false);
    }
  };

  const handleApplySurcharge = async () => {
    if (!selectedClientForLimit) return;
    const val = parseFloat(surchargeValue);
    if (isNaN(val) || val <= 0) {
      toast.error("Por favor ingresa un monto o porcentaje válido");
      return;
    }

    let finalAmount = val;
    if (surchargeType === "PERCENT") {
      const debt = selectedClientForLimit.currentDebt || 0;
      if (debt <= 0) {
        toast.error("No se puede aplicar un recargo porcentual a un cliente sin deuda actual");
        return;
      }
      finalAmount = (val / 100) * debt;
    }

    setIsApplyingSurcharge(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/clients/${selectedClientForLimit.id}/charge`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          amount: parseFloat(finalAmount.toFixed(2)),
          notes: surchargeNotes || (surchargeType === "PERCENT" ? `Recargo del ${val}% por crédito` : `Recargo fijo por crédito`)
        })
      });
      if (res.ok) {
        toast.success("Recargo aplicado y deuda actualizada");
        setLimitOpen(false);
        loadData();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.message || "Error al aplicar recargo");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setIsApplyingSurcharge(false);
    }
  };

  const handleRegisterPayment = async () => {
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) { toast.error("Monto inválido"); return; }
    setIsSubmitting(true);
    try {
      const token = localStorage.getItem("token");
      const calculatedRate = paymentCurrency !== "USD"
        ? (parseFloat(customRate) || (paymentCurrency === "VES" ? settings?.exchangeRate : 4000))
        : undefined;
      const res = await fetch(`${API}/clients/${selectedClient.id}/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          amount: parseFloat(paymentAmount),
          notes: paymentNotes || "Abono a deuda",
          paidCurrency: paymentCurrency,
          paidAmount: parseFloat(paidAmountRaw) || parseFloat(paymentAmount),
          exchangeRate: calculatedRate,
        }),
      });
      if (res.ok) {
        toast.success("Pago registrado y deuda actualizada");
        setPaymentOpen(false);
        loadData();
      } else {
        toast.error("Error al registrar pago");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered history
  const filteredHistory = historyTransactions.filter((t: any) => {
    const concept = (t.notes || (t.type === "DEBT" ? "Cargo" : "Abono")).toLowerCase();
    const query = historySearch.toLowerCase();
    const matchesSearch = !query || concept.includes(query) || t.amount?.toString().includes(query);
    const matchesType =
      historyTypeFilter === "ALL" ||
      (historyTypeFilter === "DEBT" && t.type === "DEBT") ||
      (historyTypeFilter === "PAYMENT" && t.type === "PAYMENT");
    let matchesDate = true;
    if (historyDateFrom) {
      matchesDate = matchesDate && new Date(t.createdAt) >= new Date(historyDateFrom);
    }
    if (historyDateTo) {
      const to = new Date(historyDateTo);
      to.setHours(23, 59, 59, 999);
      matchesDate = matchesDate && new Date(t.createdAt) <= to;
    }
    return matchesSearch && matchesType && matchesDate;
  });

  const ITEMS_PER_PAGE = 8;
  const totalHistoryPages = Math.ceil(filteredHistory.length / ITEMS_PER_PAGE);
  const paginatedHistory = filteredHistory.slice(
    (historyPage - 1) * ITEMS_PER_PAGE,
    historyPage * ITEMS_PER_PAGE
  );

  const debtForSurcharge = selectedClientForLimit?.currentDebt || 0;
  const surchargeValNum = parseFloat(surchargeValue) || 0;
  const calculatedSurchargeAmount = surchargeType === "PERCENT" ? (surchargeValNum / 100) * debtForSurcharge : surchargeValNum;

  return (
    <div className="flex flex-col gap-6 py-4 md:gap-8 md:py-6 font-sans px-4 lg:px-6">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Cuentas por Cobrar (Fiado)</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Clientes con deudas pendientes o saldo utilizado.</p>
        </div>
        <div className="relative w-full md:w-80">
          <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
          <Input
            placeholder="Buscar cliente..."
            className="pl-10 rounded-xl h-11 border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/40 text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-24 text-zinc-400 animate-pulse text-sm uppercase tracking-wider font-semibold">Cargando libreta digital...</div>
      ) : filteredClients.length === 0 ? (
        <Card className="border border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/20 rounded-2xl shadow-none">
          <CardContent className="flex flex-col items-center justify-center py-24 text-center text-zinc-400">
            <div className="size-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 mb-6">
              <IconCheck size={28} />
            </div>
            <h3 className="text-lg font-bold text-zinc-800 dark:text-zinc-200">¡Todo al día!</h3>
            <p className="max-w-xs text-sm text-zinc-500 mt-2">No hay clientes con crédito activo actualmente.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredClients
              .slice((clientsPage - 1) * clientsPageSize, clientsPage * clientsPageSize)
              .map((c) => (
                <Card
                  key={c.id}
                  className={`overflow-hidden shadow-sm dark:shadow-none border ${
                    c.isSuspended
                      ? "border-rose-500/30 dark:border-rose-500/20"
                      : "border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-950/40"
                  } backdrop-blur-md rounded-2xl transition-all duration-300 hover:border-zinc-300 dark:hover:border-zinc-700/80`}
                >
                  {/* CARD HEADER */}
                  <CardHeader className="pb-3 border-b border-zinc-100 dark:border-zinc-900 bg-zinc-50/20 dark:bg-zinc-950/20">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="size-10 rounded-xl bg-gradient-to-tr from-zinc-100 to-zinc-200/50 dark:from-zinc-800 dark:to-zinc-700/50 border border-zinc-200 dark:border-zinc-700/30 flex items-center justify-center font-bold uppercase shadow-inner text-zinc-700 dark:text-zinc-200">
                          {c.name.charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-base font-bold text-zinc-800 dark:text-zinc-100 truncate max-w-[130px]">{c.name}</CardTitle>
                            {c.isSuspended && (
                              <Badge className="bg-rose-500 text-white border-none hover:bg-rose-500 text-[9px] h-4 px-1.5 font-bold uppercase">Mora</Badge>
                            )}
                          </div>
                          <CardDescription className="text-[11px] text-zinc-400 font-mono mt-0.5">{c.documentId || "Cédula S/D"}</CardDescription>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        {(() => {
                          const stars = Math.round((c.creditScore || 0) / 20);
                          const color = stars >= 4 ? "text-emerald-500" : stars >= 2 ? "text-amber-400" : "text-rose-400";
                          return (
                            <div className={`flex items-center gap-1 ${color}`}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
                                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                              </svg>
                              <span className="text-[11px] font-black tabular-nums">{stars}/5</span>
                            </div>
                          );
                        })()}
                        <button
                          onClick={() => handleOpenLimitModal(c)}
                          className="p-1 rounded-md text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-all flex items-center justify-center"
                          title="Gestionar Límite"
                        >
                          <IconSettings size={15} />
                        </button>
                      </div>
                    </div>
                  </CardHeader>

                  {/* CARD CONTENT */}
                  <CardContent className="pt-4 space-y-3">
                    {/* Radial Credit Gauge */}
                    <CreditRadialCard client={c} />

                    {/* Date info */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex flex-col gap-0.5 p-2 rounded-xl bg-zinc-50 dark:bg-zinc-900/20 border border-zinc-100 dark:border-zinc-900/60">
                        <span className="text-[8px] uppercase font-bold text-zinc-400 flex items-center gap-1">
                          <IconHistory size={10} /> Último Pago
                        </span>
                        <span className="text-[10px] font-semibold text-zinc-700 dark:text-zinc-300">
                          {c.lastPaymentDate ? format(new Date(c.lastPaymentDate), "dd MMM yyyy", { locale: es }) : "Nunca"}
                        </span>
                      </div>
                      <div className="flex flex-col gap-0.5 p-2 rounded-xl bg-zinc-50 dark:bg-zinc-900/20 border border-zinc-100 dark:border-zinc-900/60">
                        <span className="text-[8px] uppercase font-bold text-zinc-400 flex items-center gap-1">
                          <IconAlertCircle size={10} /> Vencimiento
                        </span>
                        <span
                          className={`text-[10px] font-semibold ${
                            c.nextPaymentDate && new Date(c.nextPaymentDate) < new Date()
                              ? "text-rose-600 dark:text-rose-400 font-bold"
                              : "text-zinc-700 dark:text-zinc-300"
                          }`}
                        >
                          {c.nextPaymentDate ? format(new Date(c.nextPaymentDate), "dd MMM yyyy", { locale: es }) : "No definido"}
                        </span>
                      </div>
                    </div>

                    {/* Action buttons — only Historial + Abono */}
                    <div className="flex gap-2 pt-1">
                      <Button
                        variant="outline"
                        onClick={() => handleOpenHistory(c)}
                        className="flex-1 rounded-xl h-10 bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-900/40 dark:hover:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold text-xs flex items-center gap-1.5"
                      >
                        <IconHistory size={14} className="text-zinc-400" /> Historial
                      </Button>
                      {c.currentDebt > 0 && (
                        <Button
                          onClick={() => handleOpenPayment(c)}
                          className="flex-1 rounded-xl h-10 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 font-bold text-xs flex items-center gap-1.5"
                        >
                          <IconCash size={14} /> Abono
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>

          {/* Pagination */}
          {filteredClients.length > clientsPageSize && (
            <div className="flex items-center justify-between border-t border-zinc-150 dark:border-zinc-800 pt-5 mt-2 text-xs text-zinc-500 font-medium">
              <span>{filteredClients.length} cliente(s)</span>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span>Filas</span>
                  <select
                    value={clientsPageSize}
                    onChange={(e) => { setClientsPageSize(Number(e.target.value)); setClientsPage(1); }}
                    className="h-8 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs font-semibold px-2"
                  >
                    {[6, 12, 24, 48].map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <span>Pág. <strong>{clientsPage}</strong> / {totalClientsPages}</span>
                <div className="flex gap-1">
                  <button onClick={() => setClientsPage(1)} disabled={clientsPage === 1} className="size-8 flex items-center justify-center rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 disabled:opacity-40">«</button>
                  <button onClick={() => setClientsPage((p) => Math.max(1, p - 1))} disabled={clientsPage === 1} className="size-8 flex items-center justify-center rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 disabled:opacity-40">‹</button>
                  <button onClick={() => setClientsPage((p) => Math.min(totalClientsPages, p + 1))} disabled={clientsPage === totalClientsPages} className="size-8 flex items-center justify-center rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 disabled:opacity-40">›</button>
                  <button onClick={() => setClientsPage(totalClientsPages)} disabled={clientsPage === totalClientsPages} className="size-8 flex items-center justify-center rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 disabled:opacity-40">»</button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ─── MODAL HISTORIAL ─────────────────────────────────────────────── */}
      <Dialog open={historyOpen} onOpenChange={(o) => { if (!o) { setHistoryOpen(false); setSelectedTx(null); } }}>
        <DialogContent className="rounded-2xl p-0 max-w-xl border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-200 overflow-hidden max-h-[92vh] flex flex-col">
          <DialogTitle className="sr-only">Historial de {historyClient?.name}</DialogTitle>
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-zinc-100 dark:border-zinc-900 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              {selectedTx && (
                <button
                  onClick={() => { setSelectedTx(null); setTxSaleDetail(null); }}
                  className="size-7 flex items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors shrink-0"
                >
                  <IconArrowLeft size={14} />
                </button>
              )}
              <div className="min-w-0">
                <h2 className="font-bold text-base text-zinc-800 dark:text-zinc-100 flex items-center gap-1.5 truncate">
                  {selectedTx ? (
                    <><IconReceipt size={16} className="text-primary shrink-0" /> Detalle de Transacción</>
                  ) : (
                    <><IconHistory size={16} className="text-primary shrink-0" /> Historial — {historyClient?.name}</>
                  )}
                </h2>
                {!selectedTx && (
                  <p className="text-[10px] text-zinc-400 mt-0.5">{filteredHistory.length} transacciones encontradas</p>
                )}
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* ── DETAIL VIEW ── */}
            {selectedTx ? (
              <div className="p-5 space-y-4 animate-in fade-in slide-in-from-right-4 duration-200">
                {/* Transaction summary */}
                <div className={`rounded-xl p-4 border ${selectedTx.type === "DEBT" ? "bg-rose-500/5 border-rose-200 dark:border-rose-500/20" : "bg-emerald-500/5 border-emerald-200 dark:border-emerald-500/20"}`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className={`text-[9px] font-black uppercase tracking-widest ${selectedTx.type === "DEBT" ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                        {selectedTx.type === "DEBT" ? "Compra a Crédito" : "Abono a Deuda"}
                      </p>
                      <p className={`text-2xl font-black tabular-nums mt-1 ${selectedTx.type === "DEBT" ? "text-rose-600 dark:text-rose-500" : "text-emerald-600 dark:text-emerald-400"}`}>
                        {selectedTx.type === "DEBT" ? "+" : "-"}${Math.abs(selectedTx.amount).toFixed(2)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] text-zinc-400 font-bold uppercase">Fecha y Hora</p>
                      <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300 mt-0.5">
                        {(() => { try { return format(new Date(selectedTx.createdAt), "dd MMM yyyy", { locale: es }); } catch { return "—"; } })()}
                      </p>
                      <p className="text-[10px] text-zinc-400">
                        {(() => { try { return format(new Date(selectedTx.createdAt), "hh:mm a"); } catch { return ""; } })()}
                      </p>
                    </div>
                  </div>
                  {selectedTx.notes && (
                    <p className="text-[10px] text-zinc-500 mt-2 border-t border-zinc-200/50 dark:border-zinc-700/30 pt-2">{selectedTx.notes}</p>
                  )}
                </div>

                {/* Sale detail if it's a DEBT with saleId */}
                {selectedTx.type === "DEBT" && selectedTx.saleId && (
                  <div className="space-y-3">
                    {loadingTxDetail ? (
                      <div className="flex items-center justify-center py-8 gap-2 text-zinc-400">
                        <div className="size-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs font-semibold">Cargando detalle...</span>
                      </div>
                    ) : txSaleDetail ? (
                      <>
                        {/* Cashier + Branch */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-100 dark:border-zinc-900">
                            <p className="text-[8px] font-black uppercase text-zinc-400 tracking-wider flex items-center gap-1 mb-1">
                              <IconUser size={9} /> Cajero
                            </p>
                            <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200 truncate">
                              {txSaleDetail.user?.name || "—"}
                            </p>
                          </div>
                          <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-100 dark:border-zinc-900">
                            <p className="text-[8px] font-black uppercase text-zinc-400 tracking-wider flex items-center gap-1 mb-1">
                              <IconInfoCircle size={9} /> Sucursal
                            </p>
                            <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200 truncate">
                              {txSaleDetail.branch?.name || "—"}
                            </p>
                          </div>
                        </div>

                        {/* Ticket number + summary */}
                        <div className="flex items-center justify-between text-[10px] text-zinc-400 px-1">
                          <span className="font-mono">Ticket #{txSaleDetail.id?.slice(-6).toUpperCase()}</span>
                          <span>{txSaleDetail.items?.length || 0} artículo(s)</span>
                        </div>

                        {/* Items list */}
                        <div className="rounded-xl border border-zinc-100 dark:border-zinc-900 overflow-hidden">
                          <div className="bg-zinc-50 dark:bg-zinc-900/60 px-3 py-2 flex items-center gap-1.5">
                            <IconShoppingCart size={12} className="text-zinc-400" />
                            <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Productos Comprados</span>
                          </div>
                          <div className="divide-y divide-zinc-100 dark:divide-zinc-900">
                            {txSaleDetail.items?.length > 0 ? txSaleDetail.items.map((item: any, idx: number) => (
                              <div key={idx} className="flex items-center justify-between px-3 py-2.5">
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200 truncate">
                                    {item.variant?.product?.name || "Artículo"}
                                  </p>
                                  <p className="text-[9px] text-zinc-400 font-medium">
                                    {item.quantity} × ${(item.price || 0).toFixed(2)}
                                    {item.discountAmt > 0 && (
                                      <span className="ml-1 text-rose-500">(-${item.discountAmt.toFixed(2)})</span>
                                    )}
                                  </p>
                                </div>
                                <span className="text-xs font-black text-zinc-900 dark:text-zinc-100 tabular-nums ml-3">
                                  ${(item.subtotal || (item.price * item.quantity)).toFixed(2)}
                                </span>
                              </div>
                            )) : (
                              <div className="px-3 py-4 text-center text-xs text-zinc-400">Sin detalles de artículos</div>
                            )}
                          </div>
                          {/* Totals */}
                          <div className="bg-zinc-50 dark:bg-zinc-900/40 px-3 py-2.5 border-t border-zinc-100 dark:border-zinc-900 space-y-1">
                            {txSaleDetail.subtotal != null && (
                              <div className="flex justify-between text-[10px] text-zinc-500">
                                <span>Subtotal</span><span className="font-semibold">${txSaleDetail.subtotal?.toFixed(2)}</span>
                              </div>
                            )}
                            {txSaleDetail.taxAmount > 0 && (
                              <div className="flex justify-between text-[10px] text-zinc-500">
                                <span>IVA</span><span>${txSaleDetail.taxAmount?.toFixed(2)}</span>
                              </div>
                            )}
                            {txSaleDetail.discountAmt > 0 && (
                              <div className="flex justify-between text-[10px] text-rose-500">
                                <span>Descuento</span><span>-${txSaleDetail.discountAmt?.toFixed(2)}</span>
                              </div>
                            )}
                            <div className="flex justify-between text-xs font-black text-zinc-800 dark:text-zinc-100 border-t border-zinc-200 dark:border-zinc-800 pt-1.5 mt-1">
                              <span>Total</span><span>${txSaleDetail.total?.toFixed(2)}</span>
                            </div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-6 text-xs text-zinc-400">No se pudo cargar el detalle de venta.</div>
                    )}
                  </div>
                )}

                {/* Payment detail */}
                {selectedTx.type === "PAYMENT" && (
                  <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-100 dark:border-zinc-900 space-y-1 text-xs">
                    {selectedTx.paidCurrency && selectedTx.paidCurrency !== "USD" && (
                      <div className="flex justify-between text-zinc-500">
                        <span>Moneda recibida</span>
                        <span className="font-bold">{selectedTx.paidCurrency}</span>
                      </div>
                    )}
                    {selectedTx.paidAmount && selectedTx.paidAmount !== selectedTx.amount && (
                      <div className="flex justify-between text-zinc-500">
                        <span>Monto recibido</span>
                        <span className="font-bold">{selectedTx.paidAmount?.toFixed(2)} {selectedTx.paidCurrency}</span>
                      </div>
                    )}
                    {selectedTx.exchangeRate && (
                      <div className="flex justify-between text-zinc-500">
                        <span>Tasa de cambio</span>
                        <span className="font-bold">{selectedTx.exchangeRate}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              /* ── LIST VIEW ── */
              <div className="p-5 space-y-3">
                {/* Filters */}
                {!loadingHistory && historyTransactions.length > 0 && (
                  <div className="space-y-2.5">
                    {/* Search */}
                    <div className="relative">
                      <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={13} />
                      <Input
                        placeholder="Buscar por concepto, monto..."
                        className="pl-8 rounded-xl h-9 border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 text-xs"
                        value={historySearch}
                        onChange={(e) => { setHistorySearch(e.target.value); setHistoryPage(1); }}
                      />
                    </div>

                    {/* Date range */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="relative">
                        <IconCalendar className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" size={12} />
                        <input
                          type="date"
                          value={historyDateFrom}
                          onChange={(e) => { setHistoryDateFrom(e.target.value); setHistoryPage(1); }}
                          className="w-full h-9 pl-7 pr-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      </div>
                      <div className="relative">
                        <IconCalendar className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" size={12} />
                        <input
                          type="date"
                          value={historyDateTo}
                          onChange={(e) => { setHistoryDateTo(e.target.value); setHistoryPage(1); }}
                          className="w-full h-9 pl-7 pr-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      </div>
                    </div>

                    {/* Type filter */}
                    <div className="flex gap-1 p-1 bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/80 rounded-xl">
                      {(["ALL", "DEBT", "PAYMENT"] as const).map((f) => (
                        <button
                          key={f}
                          onClick={() => { setHistoryTypeFilter(f); setHistoryPage(1); }}
                          className={`flex-1 py-1 px-2.5 rounded-lg text-[10px] font-bold tracking-tight transition-all ${
                            historyTypeFilter === f
                              ? f === "ALL"
                                ? "bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 shadow-sm border border-zinc-200/50"
                                : f === "DEBT"
                                  ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200/30 shadow-sm"
                                  : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200/30 shadow-sm"
                              : "text-zinc-500 hover:text-zinc-700"
                          }`}
                        >
                          {f === "ALL" ? "Todos" : f === "DEBT" ? "Cargos (+)" : "Abonos (-)"}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {loadingHistory ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-12">
                    <div className="size-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                    <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest animate-pulse">Cargando...</p>
                  </div>
                ) : filteredHistory.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-center py-12 text-zinc-400">
                    <IconAlertCircle size={32} className="mb-2 text-zinc-300 dark:text-zinc-700" />
                    <p className="font-semibold text-zinc-700 dark:text-zinc-300 text-xs">Sin resultados</p>
                    <p className="text-[10px] mt-1">Ajusta los filtros o el rango de fechas.</p>
                  </div>
                ) : (
                  <>
                    <div className="rounded-xl border border-zinc-100 dark:border-zinc-900 overflow-hidden divide-y divide-zinc-100 dark:divide-zinc-900">
                      {paginatedHistory.map((t: any) => (
                        <button
                          key={t.id}
                          onClick={() => handleTxClick(t)}
                          className="w-full flex justify-between items-center p-3.5 text-xs transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/40 text-left group"
                        >
                          <div className="space-y-0.5 min-w-0 flex-1">
                            <p className="font-bold text-zinc-800 dark:text-zinc-200 truncate group-hover:text-primary transition-colors">
                              {t.notes || (t.type === "DEBT" ? "Compra a crédito" : "Abono a deuda")}
                            </p>
                            <p className="text-[10px] text-zinc-400 font-medium flex items-center gap-1">
                              <IconCalendar size={9} />
                              {(() => { try { return format(new Date(t.createdAt), "dd MMM yyyy · hh:mm a", { locale: es }); } catch { return "—"; } })()}
                              {t.type === "DEBT" && t.saleId && (
                                <span className="ml-1 text-[9px] text-zinc-300 dark:text-zinc-600 font-mono">#{t.saleId?.slice(-6).toUpperCase()}</span>
                              )}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 ml-3 shrink-0">
                            <span
                              className={`font-bold tabular-nums px-2.5 py-1 rounded-full text-xs ${
                                t.type === "DEBT"
                                  ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20"
                                  : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20"
                              }`}
                            >
                              {t.type === "DEBT" ? "+" : "-"}${Math.abs(t.amount).toFixed(2)}
                            </span>
                            <svg className="text-zinc-300 group-hover:text-zinc-500 transition-colors" width="12" height="12" viewBox="0 0 15 15" fill="none">
                              <path d="M6 4L10 7.5L6 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </div>
                        </button>
                      ))}
                    </div>

                    {/* Pagination */}
                    {totalHistoryPages > 1 && (
                      <div className="flex items-center justify-between pt-2">
                        <span className="text-[10px] text-zinc-400">Pág. <strong className="text-zinc-700 dark:text-zinc-300">{historyPage}</strong> / {totalHistoryPages}</span>
                        <div className="flex gap-1.5">
                          <button onClick={() => setHistoryPage((p) => Math.max(1, p - 1))} disabled={historyPage === 1}
                            className="h-8 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 text-[10px] font-semibold text-zinc-600 disabled:opacity-40 hover:bg-zinc-50 dark:hover:bg-zinc-900">
                            Anterior
                          </button>
                          <button onClick={() => setHistoryPage((p) => Math.min(totalHistoryPages, p + 1))} disabled={historyPage === totalHistoryPages}
                            className="h-8 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 text-[10px] font-semibold text-zinc-600 disabled:opacity-40 hover:bg-zinc-50 dark:hover:bg-zinc-900">
                            Siguiente
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── MODAL ABONO ─────────────────────────────────────────────────── */}
      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent className="rounded-2xl p-6 max-w-sm border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2 text-emerald-500">
              <IconCreditCard size={20} /> Recibir Abono
            </DialogTitle>
            <DialogDescription className="text-xs mt-1">
              Registra un pago para <strong>{selectedClient?.name}</strong> — Deuda actual: <strong className="text-rose-500">${selectedClient?.currentDebt?.toFixed(2)}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-3">
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Moneda de Pago</Label>
              <select
                value={paymentCurrency}
                onChange={(e: any) => { setPaymentCurrency(e.target.value); setPaidAmountRaw(""); setCustomRate(""); }}
                className="w-full h-10 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-sm font-semibold px-3 outline-none"
              >
                <option value="USD">Dólares (USD)</option>
                <option value="VES">Bolívares (VES)</option>
                <option value="COP">Pesos Colombianos (COP)</option>
              </select>
            </div>
            {paymentCurrency !== "USD" && (
              <div className="space-y-1">
                <Label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Tasa de Cambio</Label>
                <Input
                  type="number"
                  className="rounded-xl h-10 bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-sm"
                  placeholder={paymentCurrency === "VES" ? `BCV: ${settings?.exchangeRate || 40}` : "Aprox. 4000"}
                  value={customRate}
                  onChange={(e) => setCustomRate(e.target.value)}
                />
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Monto Recibido ({paymentCurrency})</Label>
              <Input
                type="number"
                className="rounded-xl h-11 bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-lg font-bold text-center"
                value={paidAmountRaw}
                onChange={(e) => setPaidAmountRaw(e.target.value)}
                placeholder="0.00"
              />
            </div>
            {paymentCurrency !== "USD" && (
              <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10 flex justify-between items-center">
                <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-1">
                  <IconInfoCircle size={12} /> Equivalente USD
                </span>
                <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">${paymentAmount || "0.00"}</span>
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Concepto / Notas</Label>
              <Input
                placeholder="Ej. Pago móvil, efectivo..."
                className="rounded-xl h-10 bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-sm"
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => setPaymentOpen(false)} className="rounded-xl h-11 border-zinc-200 dark:border-zinc-800 bg-transparent">Cancelar</Button>
            <Button
              onClick={handleRegisterPayment}
              disabled={isSubmitting}
              className="flex-1 rounded-xl h-11 bg-emerald-600 hover:bg-emerald-500 text-white font-bold border-none"
            >
              {isSubmitting ? "Procesando..." : "Confirmar Abono"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── MODAL GESTIONAR LÍMITE ──────────────────────────────────────── */}
      <Dialog open={limitOpen} onOpenChange={setLimitOpen}>
        <DialogContent className="rounded-2xl p-6 max-w-sm border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-200 overflow-y-auto max-h-[95vh]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-zinc-800 dark:text-zinc-100">
              <IconSettings size={20} className="text-zinc-500" /> Gestionar Límite de Crédito
            </DialogTitle>
            <DialogDescription className="text-xs mt-1">
              Configura el límite para <strong>{selectedClientForLimit?.name}</strong>. Deuda actual: <strong className="text-rose-500">${selectedClientForLimit?.currentDebt?.toFixed(2)}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="flex items-center space-x-2 rounded-xl bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-100 dark:border-zinc-900 p-3">
              <input
                type="checkbox"
                id="isTraditional"
                checked={isTraditional}
                onChange={(e) => setIsTraditional(e.target.checked)}
                className="size-4 rounded border-zinc-300 dark:border-zinc-800 accent-emerald-500 cursor-pointer"
              />
              <Label htmlFor="isTraditional" className="text-xs font-bold text-zinc-700 dark:text-zinc-300 cursor-pointer flex-1">
                Sin límite de crédito (Libreta Tradicional)
              </Label>
            </div>

            {!isTraditional && (
              <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
                <Label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Límite Autorizado ($ USD)</Label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-zinc-400">$</span>
                  <Input
                    type="number"
                    className="rounded-xl h-11 bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-sm pl-7 font-semibold"
                    placeholder="100.00"
                    value={limitAmount}
                    onChange={(e) => setLimitAmount(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-2 border-b border-zinc-150 dark:border-zinc-800 pb-4">
              <Button variant="outline" onClick={() => setLimitOpen(false)} className="rounded-xl h-11 border-zinc-200 dark:border-zinc-800 bg-transparent flex-1 text-xs">Cancelar</Button>
              <Button
                onClick={handleUpdateLimit}
                disabled={isUpdatingLimit}
                className="flex-1 rounded-xl h-11 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-bold border-none text-xs"
              >
                {isUpdatingLimit ? "Guardando..." : "Guardar Límite"}
              </Button>
            </div>

            {/* SECCIÓN CARGO / RECARGO */}
            <div className="space-y-3 pt-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Aplicar Cargo / Recargo</h4>
              
              <div className="flex gap-2 bg-zinc-50 dark:bg-zinc-900/60 p-1 border border-zinc-200 dark:border-zinc-800/80 rounded-xl">
                <button
                  type="button"
                  onClick={() => setSurchargeType("PERCENT")}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-[10px] font-bold tracking-tight transition-all ${
                    surchargeType === "PERCENT"
                      ? "bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 shadow-sm border border-zinc-200/50"
                      : "text-zinc-500 hover:text-zinc-700"
                  }`}
                >
                  Porcentaje (%)
                </button>
                <button
                  type="button"
                  onClick={() => setSurchargeType("FIXED")}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-[10px] font-bold tracking-tight transition-all ${
                    surchargeType === "FIXED"
                      ? "bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 shadow-sm border border-zinc-200/50"
                      : "text-zinc-500 hover:text-zinc-700"
                  }`}
                >
                  Monto Fijo ($)
                </button>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  {surchargeType === "PERCENT" ? "Porcentaje de la Deuda (%)" : "Monto a Cargar ($ USD)"}
                </Label>
                <div className="relative">
                  {surchargeType === "FIXED" && (
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-zinc-400">$</span>
                  )}
                  <Input
                    type="number"
                    className={`rounded-xl h-11 bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-sm font-semibold ${
                      surchargeType === "FIXED" ? "pl-7" : "px-3.5"
                    }`}
                    placeholder="0.00"
                    value={surchargeValue}
                    onChange={(e) => setSurchargeValue(e.target.value)}
                  />
                  {surchargeType === "PERCENT" && (
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-zinc-400">%</span>
                  )}
                </div>
              </div>

              {surchargeType === "PERCENT" && (
                <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-100 dark:border-zinc-900 flex justify-between items-center text-xs">
                  <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                    Monto Calculado:
                  </span>
                  <span className="font-bold text-zinc-700 dark:text-zinc-300">
                    ${calculatedSurchargeAmount.toFixed(2)}
                  </span>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Concepto / Notas</Label>
                <Input
                  placeholder="Ej. Recargo por crédito"
                  className="rounded-xl h-10 bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-sm"
                  value={surchargeNotes}
                  onChange={(e) => setSurchargeNotes(e.target.value)}
                />
              </div>

              <Button
                type="button"
                onClick={handleApplySurcharge}
                disabled={isApplyingSurcharge || !surchargeValue || parseFloat(surchargeValue) <= 0}
                className="w-full rounded-xl h-11 bg-rose-600 hover:bg-rose-500 text-white font-bold border-none mt-2 text-xs"
              >
                {isApplyingSurcharge ? "Aplicando..." : "Aplicar y Cobrar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
