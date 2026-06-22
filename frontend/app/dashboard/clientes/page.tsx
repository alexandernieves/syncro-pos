"use client";

import React, { useState, useEffect, useCallback } from "react";
import { API_URL } from "@/lib/constants"
import { 
  Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription, CardAction 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  IconUserPlus, IconSearch, IconUser, IconMail, IconPhone, IconMapPin, IconFilter, IconArrowRight, IconUsersGroup, IconDotsVertical, IconBriefcase, IconCalendar, IconLayoutColumns, IconPlus, IconTrendingUp, IconTrendingDown, IconCheck, IconX, IconCash, IconCreditCard, IconHistory, IconQrcode, IconDownload, IconPrinter, IconReceipt, IconAlertCircle, IconClock, IconCopy, IconDeviceMobile, IconBuildingBank, IconEye, IconPhoto
} from "@tabler/icons-react";
import { QRCodeCanvas } from "qrcode.react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { 
  Tabs, TabsContent, TabsList, TabsTrigger 
} from "@/components/ui/tabs";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "./data-table";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { 
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter 
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

import { db } from "@/lib/db";
import { useSync } from "@/hooks/useSync";

const API = API_URL;

type Client = {
  id: string;
  name: string;
  documentId: string;
  email: string;
  phone: string;
  address: string;
  isActive: boolean;
  walletBalance: number;
  creditLimit: number;
  currentDebt: number;
  creditScore: number;
  downPaymentPercentage: number;
  totalPaymentsCount: number;
  latePaymentsCount: number;
  sales?: any[];
  nextPaymentDate?: string;
};

type PaymentSubmission = {
  id: string;
  amount: number;
  referenceNumber: string;
  receiptUrl: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  client: { id: string; name: string; documentId: string; phone: string };
  debtType: string;
  debtId: string;
};

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const { pullRemoteData } = useSync();

  const [searchTerm, setSearchTerm] = useState("");

  const filteredClients = React.useMemo(() => {
    const query = searchTerm.toLowerCase().trim();
    if (!query) return clients;
    return clients.filter((client) => {
      return (
        client.name.toLowerCase().includes(query) ||
        (client.documentId && client.documentId.toLowerCase().includes(query))
      );
    });
  }, [clients, searchTerm]);

  // Credit Management State
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isCreditModalOpen, setIsCreditModalOpen] = useState(false);
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // Pago Móvil Submissions State
  const [submissions, setSubmissions] = useState<PaymentSubmission[]>([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<PaymentSubmission | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    documentId: "",
    email: "",
    phone: "",
    address: ""
  });
  const [newLimit, setNewLimit] = useState<string>("0");
  const [downPayment, setDownPayment] = useState<string>("50");
  const [cycle, setCycle] = useState<string>("15");
  const [maxInstallments, setMaxInstallments] = useState<string>("");
  const [frequencyDays, setFrequencyDays] = useState<string>("");
  const [paymentAmount, setPaymentAmount] = useState<string>("0");
  const [isSaving, setIsSaving] = useState(false);

  // PWA Activation Code State
  const [activationCode, setActivationCode] = useState<string>("");
  const [isActivationModalOpen, setIsActivationModalOpen] = useState(false);
  const [activationCreditLimit, setActivationCreditLimit] = useState<string>("100");
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);

  const handleOpenActivationModal = (client: Client) => {
    setSelectedClient(client);
    setActivationCreditLimit((client.creditLimit || 100).toString());
    setActivationCode("");
    setIsActivationModalOpen(true);
  };

  const handleGenerateActivationCode = async () => {
    if (!selectedClient) return;
    setIsGeneratingCode(true);
    try {
      const token = localStorage.getItem("token");

      // 1. Update credit limit before generating code
      const limitVal = parseFloat(activationCreditLimit);
      if (!isNaN(limitVal) && limitVal > 0) {
        await fetch(`${API}/clients/${selectedClient.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
          body: JSON.stringify({ creditLimit: limitVal })
        });
      }

      // 2. Generate activation code
      const res = await fetch(`${API}/clients/${selectedClient.id}/activation-code`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setActivationCode(data.activationCode);
        load(); // Refresh list to show updated credit limit
      } else {
        toast.error("Error al generar el código de activación");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setIsGeneratingCode(false);
    }
  };

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/clients`, {
          headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
          setClients(await res.json());
      }
    } catch (e) {
      toast.error("Error al sincronizar clientes");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSubmissions = useCallback(async () => {
    setSubmissionsLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/clients/submissions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setSubmissions(await res.json());
      }
    } catch {
      toast.error("Error al cargar abonos");
    } finally {
      setSubmissionsLoading(false);
    }
  }, []);

  const handleApproveSubmission = async (id: string) => {
    setIsProcessing(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/clients/submissions/${id}/approve`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        toast.success("✅ Abono aprobado y acreditado al cliente");
        setIsReceiptModalOpen(false);
        loadSubmissions();
        load();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.message || "Error al aprobar el abono");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRejectSubmission = async (id: string) => {
    setIsProcessing(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/clients/submissions/${id}/reject`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        toast.success("Abono rechazado");
        setIsReceiptModalOpen(false);
        loadSubmissions();
      } else {
        toast.error("Error al rechazar el abono");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    load();
    loadSubmissions();
  }, [load, loadSubmissions]);

  const totalSalesValue = clients.reduce((acc, c) => acc + (c.sales?.reduce((sum: number, s: any) => sum + (s.total || 0), 0) || 0), 0);
  const totalSalesCount = clients.reduce((acc, c) => acc + (c.sales?.length || 0), 0);
  const ticketPromedio = totalSalesCount > 0 ? totalSalesValue / totalSalesCount : 0;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
  };

  const handleUpdateCredit = async () => {
    if (!selectedClient) return;
    setIsSaving(true);
    try {
      const token = localStorage.getItem("token");
      
      // 1. Update Limit and Terms
      const resLimit = await fetch(`${API}/clients/${selectedClient.id}`, {
        method: "PATCH",
        headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}` 
        },
        body: JSON.stringify({ 
          creditLimit: parseFloat(newLimit),
          downPaymentPercentage: parseFloat(downPayment),
          paymentCycleDays: parseInt(cycle),
          syncroCreditMaxInstallments: maxInstallments ? parseInt(maxInstallments) : null,
          syncroCreditFrequencyDays: frequencyDays ? parseInt(frequencyDays) : null
        }),
      });

      // 2. Register Payment if amount > 0
      if (parseFloat(paymentAmount) > 0) {
          await fetch(`${API}/clients/${selectedClient.id}/payment`, {
              method: "POST",
              headers: { 
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${token}` 
              },
              body: JSON.stringify({ amount: parseFloat(paymentAmount), notes: "Abono manual desde dashboard" }),
          });
      }

      if (resLimit.ok) {
        toast.success("Crédito actualizado correctamente");
        load();
        setIsCreditModalOpen(false);
        setPaymentAmount("0");
      }
    } catch (error) {
      toast.error("Error al actualizar crédito");
    } finally {
      setIsSaving(false);
    }
  };
  const handleSaveClient = async () => {
    if (!formData.name.trim()) return toast.error("El nombre es obligatorio");
    if (!formData.documentId.trim()) return toast.error("La Cédula / RIF es obligatoria");
    setIsSaving(true);
    try {
      const token = localStorage.getItem("token");
      const url = selectedClient ? `${API}/clients/${selectedClient.id}` : `${API}/clients`;
      const method = selectedClient ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}` 
        },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        toast.success(selectedClient ? "Cliente actualizado" : "Cliente creado");
        setIsEditModalOpen(false);
        fetchClients();
      } else {
        toast.error("Error al guardar cliente");
      }
    } catch (error) {
      toast.error("Error de conexión");
    } finally {
      setIsSaving(false);
    }
  };

  const fetchClients = load;

  const columns: ColumnDef<Client>[] = [
    {
        id: "select",
        header: ({ table }) => (
          <div className="flex items-center justify-center w-8">
            <Checkbox
              checked={
                table.getIsAllPageRowsSelected() ||
                (table.getIsSomePageRowsSelected() && "indeterminate")
              }
              onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
              aria-label="Select all"
            />
          </div>
        ),
        cell: ({ row }) => (
          <div className="flex items-center justify-center w-8">
            <Checkbox
              checked={row.getIsSelected()}
              onCheckedChange={(value) => row.toggleSelected(!!value)}
              aria-label="Select row"
            />
          </div>
        ),
        enableSorting: false,
        enableHiding: false,
    },
    {
        accessorKey: "name",
        header: "Cliente / Identificación",
        cell: ({ row }) => (
            <div className="flex items-center gap-3">
                <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-[10px] border border-primary/20">
                    {row.original.name.substring(0,2).toUpperCase()}
                </div>
                <div className="flex flex-col">
                    <span className="text-sm font-semibold tracking-tight text-foreground/90">{row.original.name}</span>
                    <span className="text-[10px] font-medium text-muted-foreground font-mono">{row.original.documentId || "ID-PEN"}</span>
                </div>
            </div>
        )
    },
    {
        accessorKey: "contact",
        header: "Contacto y Correo",
        cell: ({ row }) => (
            <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2 text-xs font-medium">
                    <IconMail size={12} className="text-muted-foreground" />
                    {row.original.email || "No asignado"}
                </div>
            </div>
        )
    },
    {
        accessorKey: "isActive",
        header: "Estado",
        cell: ({ row }) => (
            <Badge variant="outline" className="text-muted-foreground px-1.5 font-medium gap-1.5">
                <div className={`size-1.5 rounded-full ${row.getValue("isActive") ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                {row.getValue("isActive") ? "Activo" : "Suspendido"}
            </Badge>
        )
    },

    /* 
    {
        accessorKey: "creditScore",
        header: "Syncro Score",
        cell: ({ row }) => {
            const score = row.original.creditScore;
            return (
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                        <Badge className={cn(
                            "rounded-lg px-2 py-0.5 text-[10px] font-bold border-none",
                            score >= 85 ? "bg-emerald-500 text-white" :
                            score >= 70 ? "bg-blue-500 text-white" :
                            score >= 50 ? "bg-amber-500 text-white" :
                            "bg-rose-500 text-white"
                        )}>
                            {score.toFixed(0)} PTS
                        </Badge>
                        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">
                            {score >= 85 ? "Excelente" : score >= 70 ? "Bueno" : score >= 50 ? "Regular" : "Riesgo"}
                        </span>
                    </div>
                    <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
                        <div 
                            className={cn(
                                "h-full transition-all",
                                score >= 85 ? "bg-emerald-500" : score >= 70 ? "bg-blue-500" : score >= 50 ? "bg-amber-500" : "bg-rose-500"
                            )} 
                            style={{ width: `${score}%` }}
                        />
                    </div>
                </div>
            );
        }
    },
    */
    {
        accessorKey: "sales",
        header: () => <div className="w-full text-right">Última Operación</div>,
        cell: ({ row }) => {
            const lastSale = row.original.sales?.[row.original.sales.length - 1];
            return (
                <div className="text-right flex flex-col items-end">
                    <span className="text-[11px] font-semibold">
                        {lastSale ? new Date(lastSale.createdAt).toLocaleDateString() : 'Sin actividad'}
                    </span>
                    <span className="text-[10px] text-muted-foreground uppercase font-black tracking-tighter opacity-30">Auditoría</span>
                </div>
            )
        }
    },
    {
        id: "actions",
        cell: ({ row }) => (
          <div className="flex justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="data-[state=open]:bg-muted text-muted-foreground flex size-8 p-0"
                    size="icon"
                  >
                    <IconDotsVertical size={16} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40 border-none shadow-2xl rounded-xl">
                  <DropdownMenuItem className="text-xs" onClick={() => {
                      setSelectedClient(row.original);
                      setIsProfileModalOpen(true);
                  }}>
                      Ver perfil completo
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-xs" onClick={() => {
                      setSelectedClient(row.original);
                      setNewLimit(row.original.creditLimit.toString());
                      setDownPayment((row.original as any).downPaymentPercentage?.toString() || "50");
                      setCycle((row.original as any).paymentCycleDays?.toString() || "15");
                      setMaxInstallments((row.original as any).syncroCreditMaxInstallments?.toString() || "");
                      setFrequencyDays((row.original as any).syncroCreditFrequencyDays?.toString() || "");
                      setIsCreditModalOpen(true);
                  }}>
                      Gestionar crédito
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-xs" onClick={() => {
                      setSelectedClient(row.original);
                      setIsQRModalOpen(true);
                  }}>
                      Generar QR de Acceso
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-xs" onClick={() => {
                      handleOpenActivationModal(row.original);
                  }}>
                      Generar Código PWA
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-xs" onClick={() => {
                      setSelectedClient(row.original);
                      setFormData({
                        name: row.original.name,
                        documentId: row.original.documentId || "",
                        email: row.original.email || "",
                        phone: row.original.phone || "",
                        address: row.original.address || ""
                      });
                      setIsEditModalOpen(true);
                  }}>
                      Editar datos
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-xs font-semibold text-rose-500">Suspender cuenta</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
          </div>
        ),
    }
  ];

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 font-sans">
      <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-3">
          <Card className="@container/card bg-gradient-to-t from-primary/5 to-card shadow-xs">
            <CardHeader>
              <CardDescription>Total Clientes</CardDescription>
              <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                {clients.length}
              </CardTitle>
              <CardAction>
                <Badge variant="outline" className="gap-1 opacity-0">
                  <IconTrendingUp className="size-3 text-primary" />
                  +0%
                </Badge>
              </CardAction>
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1.5 text-sm">
              <div className="line-clamp-1 flex gap-2 font-medium">
                Cartera de clientes registrados
              </div>
              <div className="text-muted-foreground">
                Base de datos de clientes vinculados al negocio
              </div>
            </CardFooter>
          </Card>

          <Card className="@container/card bg-gradient-to-t from-primary/5 to-card shadow-xs">
            <CardHeader>
              <CardDescription>Clientes Activos</CardDescription>
              <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                {clients.filter(c => c.isActive).length}
              </CardTitle>
              <CardAction>
                <Badge variant="outline" className="gap-1 opacity-0">
                  <IconTrendingUp className="size-3 text-muted-foreground" />
                  100%
                </Badge>
              </CardAction>
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1.5 text-sm">
              <div className="line-clamp-1 flex gap-2 font-medium">
                Retención de clientes
              </div>
              <div className="text-muted-foreground">
                Clientes que mantienen una relación activa
              </div>
            </CardFooter>
          </Card>

          <Card className="@container/card bg-gradient-to-t from-primary/5 to-card shadow-xs">
            <CardHeader>
              <CardDescription>Ticket Promedio</CardDescription>
              <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl text-amber-600">
                {formatCurrency(ticketPromedio)}
              </CardTitle>
              <CardAction>
                <Badge variant="outline" className="gap-1 opacity-0">
                  <IconTrendingUp className="size-3 text-amber-500" />
                  +0%
                </Badge>
              </CardAction>
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1.5 text-sm">
              <div className="line-clamp-1 flex gap-2 font-medium text-amber-600">
                Valor promedio por venta
              </div>
              <div className="text-muted-foreground">
                Basado en el historial real de operaciones
              </div>
            </CardFooter>
          </Card>
      </div>



      {/* Tabs Layout Mirroring Dashboard EXACTLY */}
      <Tabs defaultValue="perfiles" className="w-full flex flex-col gap-6">
        <div className="flex items-center justify-between px-4 lg:px-6">
          <TabsList className="**:data-[slot=badge]:bg-muted-foreground/30 **:data-[slot=badge]:size-5 **:data-[slot=badge]:rounded-full **:data-[slot=badge]:px-1">
            <TabsTrigger value="perfiles">Cartera de Clientes</TabsTrigger>
            <TabsTrigger value="abonos" className="relative" onClick={loadSubmissions}>
              Abonos por Validar
              {submissions.filter(s => s.status === 'PENDING').length > 0 && (
                <span className="ml-2 inline-flex items-center justify-center size-4 rounded-full bg-amber-500 text-white text-[9px] font-black">
                  {submissions.filter(s => s.status === 'PENDING').length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2">
                <IconFilter size={14} /> Filtros
            </Button>
            <Button size="sm" className="gap-2 shadow-sm font-medium" onClick={() => {
                setSelectedClient(null);
                setFormData({ name: "", documentId: "", email: "", phone: "", address: "" });
                setIsEditModalOpen(true);
            }}>
                <IconPlus size={16} />
                <span className="hidden lg:inline">Agregar Cliente</span>
                <span className="lg:hidden">Nuevo</span>
            </Button>
          </div>
        </div>

        <TabsContent value="perfiles" className="px-4 lg:px-6 space-y-4">
            <div className="overflow-hidden">
                {loading ? (
                    <Skeleton className="h-[500px] w-full rounded-xl" />
                ) : (
                    <DataTable 
                        columns={columns} 
                        data={filteredClients} 
                        searchTerm={searchTerm}
                        onSearchChange={setSearchTerm}
                        filterPlaceholder="Filtrar por nombre o RIF..." 
                    />
                )}
            </div>
        </TabsContent>

        {/* === ABONOS POR VALIDAR TAB === */}
        <TabsContent value="abonos" className="px-4 lg:px-6 space-y-4">
          {submissionsLoading ? (
            <Skeleton className="h-[400px] w-full rounded-2xl" />
          ) : submissions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4 opacity-40">
              <div className="size-16 rounded-2xl bg-muted flex items-center justify-center">
                <IconBuildingBank size={32} className="text-muted-foreground" />
              </div>
              <div className="text-center space-y-1">
                <p className="font-bold text-sm">Sin abonos pendientes</p>
                <p className="text-xs text-muted-foreground">Aquí aparecerán los comprobantes de Pago Móvil enviados por tus clientes</p>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border overflow-hidden bg-card shadow-xs">
              {/* Table Header */}
              <div className="grid grid-cols-[1fr_1fr_120px_130px_110px] gap-4 px-5 py-3 bg-muted/40 border-b">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Cliente</span>
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Referencia / Fecha</span>
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground text-right">Monto</span>
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground text-center">Estado</span>
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground text-right">Acción</span>
              </div>
              <div className="divide-y divide-border/50">
                {submissions.map((sub) => (
                  <div key={sub.id} className="grid grid-cols-[1fr_1fr_120px_130px_110px] gap-4 px-5 py-4 items-center hover:bg-muted/20 transition-colors">
                    {/* Client */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="size-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600 font-black text-[10px] border border-amber-500/20 shrink-0">
                        {sub.client.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate tracking-tight">{sub.client.name}</p>
                        <p className="text-[10px] font-mono text-muted-foreground">{sub.client.documentId}</p>
                      </div>
                    </div>
                    {/* Reference + Date */}
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-bold font-mono text-foreground">{sub.referenceNumber || '—'}</span>
                      <span className="text-[10px] text-muted-foreground">{new Date(sub.createdAt).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' })}</span>
                    </div>
                    {/* Amount */}
                    <div className="text-right">
                      <span className="text-sm font-black tabular-nums text-emerald-600">${sub.amount.toFixed(2)}</span>
                    </div>
                    {/* Status Badge */}
                    <div className="flex justify-center">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide border ${
                        sub.status === 'PENDING' ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' :
                        sub.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' :
                        'bg-rose-500/10 text-rose-600 border-rose-500/20'
                      }`}>
                        <span className={`size-1.5 rounded-full ${
                          sub.status === 'PENDING' ? 'bg-amber-500 animate-pulse' :
                          sub.status === 'APPROVED' ? 'bg-emerald-500' : 'bg-rose-500'
                        }`} />
                        {sub.status === 'PENDING' ? 'Pendiente' : sub.status === 'APPROVED' ? 'Aprobado' : 'Rechazado'}
                      </span>
                    </div>
                    {/* Action */}
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1.5 text-xs font-bold rounded-lg"
                        onClick={() => {
                          setSelectedSubmission(sub);
                          setIsReceiptModalOpen(true);
                        }}
                      >
                        <IconEye size={13} />
                        Ver Comprobante
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

      </Tabs>

      {/* Credit Management Modal */}
      <AlertDialog open={isCreditModalOpen} onOpenChange={setIsCreditModalOpen}>
        <AlertDialogContent className="max-w-md border-none shadow-2xl rounded-2xl p-0 overflow-hidden bg-card">
          <AlertDialogHeader className="bg-emerald-500/10 p-6 border-b border-emerald-500/10">
            <div className="flex items-center gap-3 mb-2">
              <div className="size-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <IconCreditCard size={20} />
              </div>
              <div>
                <AlertDialogTitle className="text-lg font-bold tracking-tight">Syncro Credit</AlertDialogTitle>
                <AlertDialogDescription className="text-xs font-medium text-emerald-600/80">Gestión de límite y cobranza de fiado</AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>

          <div className="p-6 space-y-6">
            {/* Current Status Card */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-muted/50 border space-y-1">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Deuda Actual</span>
                <div className="text-xl font-bold text-rose-600 tabular-nums">${selectedClient?.currentDebt.toFixed(2)}</div>
              </div>
              <div className="p-3 rounded-xl bg-muted/50 border space-y-1">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Cupo Disponible</span>
                <div className="text-xl font-bold text-emerald-600 tabular-nums">
                    ${((selectedClient?.creditLimit || 0) - (selectedClient?.currentDebt || 0)).toFixed(2)}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-tight">Nuevo Límite de Crédito ($)</label>
                <div className="relative">
                  <IconCreditCard className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                  <Input 
                    type="number" 
                    value={newLimit} 
                    onChange={(e) => setNewLimit(e.target.value)}
                    className="pl-10 h-11 rounded-xl bg-muted/30 border-none font-bold text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-tight">Pago Inicial (%)</label>
                  <Input 
                    type="number" 
                    value={downPayment} 
                    onChange={(e) => setDownPayment(e.target.value)}
                    className="h-11 rounded-xl bg-muted/30 border-none font-bold text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-tight">Ciclo Pago (Días)</label>
                  <Input 
                    type="number" 
                    value={cycle} 
                    onChange={(e) => setCycle(e.target.value)}
                    className="h-11 rounded-xl bg-muted/30 border-none font-bold text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-tight">Cuotas Máximas</label>
                  <Input 
                    type="number" 
                    placeholder="Por defecto"
                    value={maxInstallments} 
                    onChange={(e) => setMaxInstallments(e.target.value)}
                    className="h-11 rounded-xl bg-muted/30 border-none font-bold text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-tight">Frecuencia Cuotas (Días)</label>
                  <Input 
                    type="number" 
                    placeholder="Por defecto"
                    value={frequencyDays} 
                    onChange={(e) => setFrequencyDays(e.target.value)}
                    className="h-11 rounded-xl bg-muted/30 border-none font-bold text-sm"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-tight">Registrar Abono / Pago ($)</label>
                <div className="relative">
                  <IconCash className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                  <Input 
                    type="number" 
                    value={paymentAmount} 
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="pl-10 h-11 rounded-xl bg-muted/30 border-none font-bold text-sm text-emerald-600"
                    placeholder="0.00"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground italic px-1">Este monto se restará de la deuda actual del cliente.</p>
              </div>
            </div>
          </div>

          <AlertDialogFooter className="p-6 pt-0">
            <AlertDialogCancel className="rounded-xl h-11 font-semibold text-xs">Cancelar</AlertDialogCancel>
            <AlertDialogAction 
                onClick={handleUpdateCredit} 
                disabled={isSaving}
                className="rounded-xl h-11 px-8 font-bold text-xs bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/20"
            >
                {isSaving ? "Guardando..." : "Actualizar Crédito"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* QR Access Modal */}
      <Dialog open={isQRModalOpen} onOpenChange={setIsQRModalOpen}>
        <DialogContent className="max-w-sm border-none shadow-2xl rounded-[2.5rem] p-0 overflow-hidden bg-[#050505] text-white">
          <DialogHeader className="bg-emerald-500 p-8 flex flex-col items-center justify-center text-center gap-2">
              <div className="size-16 bg-white rounded-2xl flex items-center justify-center shadow-xl shadow-black/10">
                  <IconQrcode size={32} className="text-emerald-500" />
              </div>
              <DialogTitle className="text-xl font-black tracking-tighter mt-2">SYNCRO CREDIT</DialogTitle>
              <DialogDescription className="text-xs font-bold text-emerald-950/60 uppercase tracking-widest">Portal Personal de Cliente</DialogDescription>
          </DialogHeader>

          <div className="p-8 flex flex-col items-center gap-6">
              <div className="p-4 bg-white rounded-3xl shadow-2xl shadow-emerald-500/10 border-4 border-emerald-500/5">
                <QRCodeCanvas 
                    id="client-qr"
                    value={typeof window !== 'undefined' ? `${window.location.origin}/portal` : ''} 
                    size={200}
                    level="H"
                    includeMargin={false}
                    imageSettings={{
                        src: "/syncro.png",
                        x: undefined,
                        y: undefined,
                        height: 40,
                        width: 40,
                        excavate: true,
                    }}
                />
              </div>

              <div className="text-center space-y-1">
                  <h4 className="text-sm font-bold tracking-tight">{selectedClient?.name}</h4>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-[0.2em]">{selectedClient?.documentId}</p>
              </div>

              <div className="w-full grid grid-cols-2 gap-3">
                  <Button 
                    variant="outline" 
                    className="h-12 rounded-2xl border-white/10 bg-white/5 hover:bg-white/10 text-white font-bold text-xs gap-2"
                    onClick={() => {
                        const canvas = document.getElementById('client-qr') as HTMLCanvasElement;
                        const url = canvas.toDataURL("image/png");
                        const link = document.createElement('a');
                        link.download = `QR-Syncro-${selectedClient?.name}.png`;
                        link.href = url;
                        link.click();
                    }}
                  >
                      <IconDownload size={16} /> Descargar
                  </Button>
                  <Button 
                    className="h-12 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs gap-2"
                    onClick={() => window.print()}
                  >
                      <IconPrinter size={16} /> Imprimir
                  </Button>
              </div>
              
              <p className="text-[9px] text-zinc-600 text-center font-medium italic leading-relaxed px-4">
                  Escanea este código para consultar tu límite de crédito, deuda actual y pagar tus cuotas desde el portal.
              </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* PWA Activation Code Modal */}
      <Dialog open={isActivationModalOpen} onOpenChange={setIsActivationModalOpen}>
        <DialogContent className="max-w-sm border border-border/80 bg-background/95 backdrop-blur-md shadow-2xl rounded-2xl p-6 overflow-hidden text-foreground">
          <div className="flex flex-col items-center text-center gap-4 mt-2">
              <div className="size-12 rounded-full bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 flex items-center justify-center border border-amber-500/25 shadow-inner">
                  <IconDeviceMobile size={22} />
              </div>
              
              <div className="space-y-1">
                  <DialogTitle className="text-lg font-bold tracking-tight">Activar Cuenta PWA</DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground max-w-[280px] mx-auto">
                      Define el crédito disponible y genera el código de activación para el cliente.
                  </DialogDescription>
              </div>

              <div className="border-t border-border/50 w-full pt-3 pb-1 space-y-1">
                  <p className="text-[10px] text-muted-foreground uppercase font-black tracking-wider">Cliente</p>
                  <h4 className="text-sm font-extrabold text-foreground">{selectedClient?.name}</h4>
                  <p className="text-[10px] font-mono text-muted-foreground bg-muted/50 px-2 py-0.5 rounded border border-border/40 inline-block mt-0.5">{selectedClient?.documentId}</p>
              </div>

              {/* Credit Limit Input */}
              <div className="w-full space-y-2">
                  <label className="text-[11px] font-black text-muted-foreground uppercase tracking-wider text-left w-full block">
                      Crédito a Habilitar (USD)
                  </label>
                  <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg font-black text-muted-foreground">$</span>
                      <Input
                          type="number"
                          min="0"
                          step="10"
                          value={activationCreditLimit}
                          onChange={(e) => setActivationCreditLimit(e.target.value)}
                          className="pl-8 h-12 text-xl font-black text-center rounded-xl bg-muted/30 border-border/60 focus-visible:ring-amber-500/30"
                          placeholder="100"
                      />
                  </div>
                  <p className="text-[9px] text-muted-foreground italic text-left">
                      Este monto define cuánto puede comprar a crédito este cliente. El radial se llenará según su uso.
                  </p>
              </div>

              {/* Code Display (shown after generation) */}
              {activationCode ? (
                  <>
                      <div className="py-4 px-6 bg-muted/30 rounded-xl border border-border/80 w-full text-center shadow-inner">
                          <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-widest mb-1">Código de Activación</p>
                          <span className="text-3xl font-black font-mono tracking-[0.3em] pl-[0.3em] text-amber-600 dark:text-amber-400">
                              {activationCode}
                          </span>
                      </div>
                      <div className="w-full">
                          <Button 
                            className="w-full h-11 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-xs gap-2 shadow-sm transition-all active:scale-[0.98]"
                            onClick={() => {
                                navigator.clipboard.writeText(activationCode);
                                toast.success("Código copiado al portapapeles");
                            }}
                          >
                              <IconCopy size={16} /> Copiar Código
                          </Button>
                      </div>
                      <p className="text-[10px] text-muted-foreground leading-normal px-2">
                          Entrega este código al cliente. Expira en <strong className="text-foreground">24 horas</strong>.
                      </p>
                  </>
              ) : (
                  <Button 
                    className="w-full h-11 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs gap-2 shadow-sm transition-all active:scale-[0.98] border-none"
                    onClick={handleGenerateActivationCode}
                    disabled={isGeneratingCode}
                  >
                      <IconDeviceMobile size={16} /> {isGeneratingCode ? "Generando..." : "Generar Código"}
                  </Button>
              )}
          </div>
        </DialogContent>
      </Dialog>
 
      {/* Edit/Add Client Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-md border-none shadow-2xl rounded-[1.8rem] p-0 overflow-hidden bg-background">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle className="text-xl font-bold tracking-tight">
                {selectedClient ? "Editar Cliente" : "Nuevo Cliente"}
            </DialogTitle>
            <DialogDescription className="text-xs uppercase font-bold tracking-widest text-muted-foreground opacity-70">
                Información básica y contacto
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 space-y-4">
            <div className="space-y-2">
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-tight">Nombre Completo</label>
                <Input 
                    value={formData.name} 
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="Ej. Juan Pérez"
                    className="h-11 rounded-xl bg-muted/30 border-none font-medium text-sm"
                />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-tight">Cédula / RIF</label>
                    <Input 
                        value={formData.documentId} 
                        onChange={(e) => setFormData({...formData, documentId: e.target.value})}
                        placeholder="V-12345678"
                        className="h-11 rounded-xl bg-muted/30 border-none font-medium text-sm"
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-tight">Teléfono</label>
                    <Input 
                        value={formData.phone} 
                        onChange={(e) => setFormData({...formData, phone: e.target.value})}
                        placeholder="0412-0000000"
                        className="h-11 rounded-xl bg-muted/30 border-none font-medium text-sm"
                    />
                </div>
            </div>
            <div className="space-y-2">
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-tight">Correo Electrónico</label>
                <Input 
                    type="email"
                    value={formData.email} 
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    placeholder="cliente@email.com"
                    className="h-11 rounded-xl bg-muted/30 border-none font-medium text-sm"
                />
            </div>
            <div className="space-y-2">
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-tight">Dirección</label>
                <Input 
                    value={formData.address} 
                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                    placeholder="Ciudad, Calle, Edificio..."
                    className="h-11 rounded-xl bg-muted/30 border-none font-medium text-sm"
                />
            </div>
          </div>

          <DialogFooter className="p-6 pt-2">
            <Button variant="ghost" onClick={() => setIsEditModalOpen(false)} className="rounded-xl h-11 font-semibold text-xs">
                Cancelar
            </Button>
            <Button onClick={handleSaveClient} disabled={isSaving} className="rounded-xl h-11 px-8 font-bold text-xs bg-primary shadow-lg shadow-primary/20">
                {isSaving ? "Guardando..." : "Guardar Cambios"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Profile/History Modal */}
      <Dialog open={isProfileModalOpen} onOpenChange={setIsProfileModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <div className="flex items-center gap-4">
              <div className="size-12 rounded-full bg-muted flex items-center justify-center">
                <IconUser size={24} className="text-muted-foreground" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold">{selectedClient?.name}</DialogTitle>
                <DialogDescription className="text-xs uppercase tracking-widest font-semibold">
                  {selectedClient?.documentId} • Límite: ${selectedClient?.creditLimit.toFixed(2)}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-lg border bg-card p-4 space-y-1">
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Deuda Actual</p>
                <p className="text-xl font-bold text-rose-500">${selectedClient?.currentDebt.toFixed(2)}</p>
              </div>
              <div className="rounded-lg border bg-card p-4 space-y-1">
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Syncro Score</p>
                <p className="text-xl font-bold text-emerald-500">{selectedClient?.creditScore.toFixed(0)} PTS</p>
              </div>
              <div className="rounded-lg border bg-card p-4 space-y-1">
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Pagos</p>
                <p className="text-xl font-bold">{selectedClient?.totalPaymentsCount}</p>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Últimas Transacciones</h4>
              <div className="rounded-lg border divide-y overflow-hidden">
                {selectedClient?.sales?.slice().reverse().map((sale: any) => (
                  <div key={sale.id} className="p-3 flex items-center justify-between hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <IconReceipt size={16} className="text-muted-foreground" />
                      <div>
                        <p className="text-xs font-bold">Compra en Tienda</p>
                        <p className="text-[10px] text-muted-foreground">{new Date(sale.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold">${sale.total.toFixed(2)}</p>
                      <Badge variant="outline" className="text-[8px] font-bold uppercase">{sale.status}</Badge>
                    </div>
                  </div>
                ))}
                {(!selectedClient?.sales || selectedClient.sales.length === 0) && (
                  <div className="p-10 text-center space-y-2 opacity-30">
                    <IconHistory size={32} className="mx-auto" />
                    <p className="text-[10px] font-bold uppercase tracking-widest">Sin actividad</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsProfileModalOpen(false)} className="w-full">
              Cerrar Perfil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* === RECEIPT PREVIEW MODAL === */}
      <Dialog open={isReceiptModalOpen} onOpenChange={setIsReceiptModalOpen}>
        <DialogContent className="max-w-lg border-none shadow-2xl rounded-[2rem] p-0 overflow-hidden bg-background">
          {/* Header */}
          <div className="flex items-center gap-3 p-6 border-b bg-gradient-to-r from-amber-500/10 to-transparent">
            <div className="size-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/20">
              <IconBuildingBank size={20} />
            </div>
            <div>
              <DialogTitle className="text-base font-bold tracking-tight">Comprobante de Pago Móvil</DialogTitle>
              <DialogDescription className="text-[11px] font-medium text-amber-600/80">Revisión y validación de abono</DialogDescription>
            </div>
          </div>

          <div className="p-6 space-y-5">
            {/* Client info */}
            {selectedSubmission && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-muted/40 border space-y-1">
                    <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest block">Cliente</span>
                    <p className="text-sm font-bold truncate">{selectedSubmission.client.name}</p>
                    <p className="text-[10px] font-mono text-muted-foreground">{selectedSubmission.client.documentId}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-muted/40 border space-y-1">
                    <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest block">Monto del Abono</span>
                    <p className="text-2xl font-black tabular-nums text-emerald-600">${selectedSubmission.amount.toFixed(2)}</p>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-muted/40 border flex items-center justify-between">
                  <div>
                    <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest block">N° de Referencia</span>
                    <span className="text-sm font-bold font-mono">{selectedSubmission.referenceNumber || 'No indicado'}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest block">Enviado</span>
                    <span className="text-xs font-medium">{new Date(selectedSubmission.createdAt).toLocaleString('es-VE', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                  </div>
                </div>

                {/* Receipt Image */}
                <div className="space-y-2">
                  <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Captura del Comprobante</span>
                  {selectedSubmission.receiptUrl ? (
                    <div className="rounded-2xl overflow-hidden border-2 border-dashed border-muted-foreground/20 bg-muted/30 relative">
                      <img
                        src={selectedSubmission.receiptUrl.startsWith('http') ? selectedSubmission.receiptUrl : `${API_URL.replace('/api', '')}${selectedSubmission.receiptUrl}`}
                        alt="Comprobante de pago"
                        className="w-full max-h-64 object-contain"
                      />
                      <a
                        href={selectedSubmission.receiptUrl.startsWith('http') ? selectedSubmission.receiptUrl : `${API_URL.replace('/api', '')}${selectedSubmission.receiptUrl}`}
                        target="_blank"
                        rel="noreferrer"
                        className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-black/60 text-white text-[10px] font-bold hover:bg-black/80 transition-colors"
                      >
                        <IconPhoto size={12} /> Ver completo
                      </a>
                    </div>
                  ) : (
                    <div className="rounded-2xl border-2 border-dashed border-muted-foreground/20 bg-muted/30 p-10 flex flex-col items-center gap-2 opacity-50">
                      <IconPhoto size={28} className="text-muted-foreground" />
                      <p className="text-xs font-bold text-muted-foreground">Sin captura adjunta</p>
                    </div>
                  )}
                </div>

                {/* Actions */}
                {selectedSubmission.status === 'PENDING' && (
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <Button
                      variant="outline"
                      className="h-12 rounded-xl font-bold text-xs border-rose-500/30 text-rose-600 hover:bg-rose-500/10 gap-2"
                      onClick={() => handleRejectSubmission(selectedSubmission.id)}
                      disabled={isProcessing}
                    >
                      <IconX size={16} />
                      {isProcessing ? 'Procesando...' : 'Rechazar'}
                    </Button>
                    <Button
                      className="h-12 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20 gap-2"
                      onClick={() => handleApproveSubmission(selectedSubmission.id)}
                      disabled={isProcessing}
                    >
                      <IconCheck size={16} />
                      {isProcessing ? 'Aplicando...' : 'Aprobar Abono'}
                    </Button>
                  </div>
                )}

                {selectedSubmission.status !== 'PENDING' && (
                  <div className={`p-3 rounded-xl text-center text-xs font-bold ${
                    selectedSubmission.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                  }`}>
                    {selectedSubmission.status === 'APPROVED' ? '✅ Este abono ya fue aprobado y acreditado' : '❌ Este abono fue rechazado'}
                  </div>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
