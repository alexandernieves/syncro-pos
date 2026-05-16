"use client";

import React, { useState, useEffect, Suspense } from "react";
import { API_URL } from "@/lib/constants"
import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardAction, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  IconArrowLeft, IconBuildingStore, IconPhone, IconMail, IconMapPin, 
  IconPackage, IconCurrencyDollar, IconTrendingUp, IconClock,
  IconReceipt, IconTruck, IconRefresh, IconDownload, IconPlus, IconAlertTriangle, IconTrendingDown, IconCheck
} from "@tabler/icons-react";
import { toast } from "sonner";
import { 
  Dialog, DialogContent, DialogDescription, DialogFooter, 
  DialogHeader, DialogTitle, DialogTrigger 
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

const API = API_URL;

interface Supplier {
  id: string;
  name: string;
  taxId?: string;
  phone?: string;
  email?: string;
  address?: string;
  status: string;
  createdAt: string;
}

interface SupplierStats {
  supplier: Supplier;
  purchaseStats: {
    totalOrders: number;
    totalPurchased: number;
    lastPurchase: string | null;
    avgDeliveryDays: number;
    completedOrders: number;
    pendingOrders: number;
  };
  financialStats: {
    totalInvoiced: number;
    totalPaid: number;
    outstandingBalance: number;
    paymentCompletionRate: number;
  };
  priceAnalysis: {
    productsTracked: number;
    priceVariations: Array<{
      productId: string;
      productName: string;
      supplierPrice: number;
      currentCost: number;
      variationPercentage: number;
    }>;
    averageVariation: number;
  };
  returnStats: {
    totalReturns: number;
    totalReturnedQuantity: number;
    totalReturnValue: number;
    returnRate: number;
  };
  performance: {
    reliability: number;
    qualityScore: number;
    overallRating: number;
  };
}

interface PurchaseOrder {
  id: string;
  status: string;
  total: number;
  createdAt: string;
  branch: { name: string };
  items: any[];
}

interface SupplierInvoice {
  id: string;
  total: number;
  balance: number;
  dueDate: string;
  status: string;
}

interface SupplierPayment {
  id: string;
  amount: number;
  method: string;
  reference?: string;
  createdAt: string;
}

interface SupplierReturn {
  id: string;
  quantity: number;
  reason: string;
  createdAt: string;
  variant: {
    name: string;
    product: { name: string };
  };
}

function SupplierDetailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const supplierId = searchParams.get("id");

  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [stats, setStats] = useState<SupplierStats | null>(null);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [invoices, setInvoices] = useState<SupplierInvoice[]>([]);
  const [payments, setPayments] = useState<SupplierPayment[]>([]);
  const [returns, setReturns] = useState<SupplierReturn[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [paymentData, setPaymentData] = useState({ amount: 0, method: "CASH", reference: "" });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (supplierId) loadSupplierData();
    else setLoading(false);
  }, [supplierId]);

  const handlePayment = async () => {
    if (!paymentData.amount || paymentData.amount <= 0) {
      toast.error("El monto debe ser mayor a cero");
      return;
    }
    try {
      setSubmitting(true);
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/supplier-payments`, {
        method: "POST",
        headers: { 
          Authorization: `Bearer ${token}`, 
          "Content-Type": "application/json" 
        },
        body: JSON.stringify({
          supplierId,
          ...paymentData,
          amount: Number(paymentData.amount)
        })
      });

      if (res.ok) {
        toast.success("Pago registrado exitosamente y vinculado a contabilidad");
        setIsPaymentDialogOpen(false);
        setPaymentData({ amount: 0, method: "CASH", reference: "" });
        loadSupplierData();
      } else {
        const err = await res.json();
        toast.error(err.message || "Error al registrar el pago");
      }
    } catch (error) {
      toast.error("Error de conexión");
    } finally {
      setSubmitting(false);
    }
  };

  const loadSupplierData = async () => {
    if (!supplierId) return;
    try {
      const token = localStorage.getItem("token");
      if (!token) { router.push("/login"); return; }

      const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

      const [supplierRes, statsRes, ordersRes, accountRes, returnsRes] = await Promise.all([
        fetch(`${API}/suppliers/${supplierId}`, { headers }),
        fetch(`${API}/suppliers/${supplierId}/stats`, { headers }),
        fetch(`${API}/purchase-orders?supplierId=${supplierId}`, { headers }),
        fetch(`${API}/suppliers/${supplierId}/account`, { headers }),
        fetch(`${API}/supplier-returns?supplierId=${supplierId}`, { headers })
      ]);

      if (supplierRes.ok) setSupplier(await supplierRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
      if (ordersRes.ok) setPurchaseOrders(await ordersRes.json());
      if (accountRes.ok) {
        const accountData = await accountRes.json();
        setInvoices(accountData.invoices || []);
        setPayments(accountData.payments || []);
      }
      if (returnsRes.ok) setReturns(await returnsRes.json());

      // Fetch low stock suggestions
      const suggestionsRes = await fetch(`${API}/suppliers/${supplierId}/suggestions`, { headers });
      if (suggestionsRes.ok) setSuggestions(await suggestionsRes.json());

    } catch (error) {
      console.error("Error loading supplier data:", error);
      toast.error("Error al cargar datos del proveedor");
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { variant: "default" | "secondary" | "destructive"; label: string }> = {
      ACTIVE: { variant: "default", label: "Activo" },
      BLOCKED: { variant: "destructive", label: "Bloqueado" },
      PENDING: { variant: "secondary", label: "Pendiente" },
      PAID: { variant: "default", label: "Pagado" },
      PARTIAL: { variant: "secondary", label: "Parcial" },
      DRAFT: { variant: "secondary", label: "Borrador" },
      SENT: { variant: "default", label: "Enviado" },
      RECEIVED: { variant: "default", label: "Recibido" },
      CANCELLED: { variant: "destructive", label: "Cancelado" }
    };
    const c = config[status] || { variant: "secondary", label: status };
    return <Badge variant={c.variant}>{c.label}</Badge>;
  };

  const formatCurrency = (amount: number) => 
    new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(amount);

  const formatDate = (dateString: string) => 
    new Date(dateString).toLocaleDateString("es-MX");

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!supplierId || !supplier) {
    return (
      <div className="container mx-auto p-6 text-center">
        <h2 className="text-2xl font-bold">Proveedor no encontrado</h2>
        <Button onClick={() => router.back()} className="mt-4">
          <IconArrowLeft className="h-4 w-4 mr-2" /> Volver
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => router.back()}>
            <IconArrowLeft className="h-4 w-4 mr-2" /> Volver
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{supplier.name}</h1>
            <p className="text-muted-foreground">Ficha Técnica del Proveedor</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {getStatusBadge(supplier.status)}
          <Button variant="outline">Editar</Button>
          <Button variant="default" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setIsPaymentDialogOpen(true)}>
            <IconCurrencyDollar className="h-4 w-4 mr-2" /> Registrar Pago
          </Button>
        </div>
      </div>

      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconBuildingStore className="h-5 w-5" />
            Información del Proveedor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {supplier.taxId && (
              <div>
                <p className="text-sm text-muted-foreground">RFC/Tax ID</p>
                <p className="font-medium">{supplier.taxId}</p>
              </div>
            )}
            {supplier.phone && (
              <div>
                <p className="text-sm text-muted-foreground">Teléfono</p>
                <p className="font-medium flex items-center gap-2">
                  <IconPhone className="h-4 w-4" /> {supplier.phone}
                </p>
              </div>
            )}
            {supplier.email && (
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium flex items-center gap-2">
                  <IconMail className="h-4 w-4" /> {supplier.email}
                </p>
              </div>
            )}
            {supplier.address && (
              <div>
                <p className="text-sm text-muted-foreground">Dirección</p>
                <p className="font-medium flex items-center gap-2">
                  <IconMapPin className="h-4 w-4" /> {supplier.address}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 gap-4 px-0 lg:px-0 @xl/main:grid-cols-2 @5xl/main:grid-cols-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="@container/card bg-gradient-to-t from-primary/5 to-card shadow-xs">
            <CardHeader>
              <CardDescription>Compras Totales</CardDescription>
              <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                {formatCurrency(stats.purchaseStats.totalPurchased)}
              </CardTitle>
              <CardAction>
                <Badge variant="outline" className="gap-1">
                  <IconTrendingUp className="size-3 text-emerald-500" />
                  +12.5%
                </Badge>
              </CardAction>
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1.5 text-sm">
              <div className="line-clamp-1 flex gap-2 font-medium">
                {stats.purchaseStats.totalOrders} órdenes procesadas
              </div>
              <div className="text-muted-foreground">
                Inversión bruta histórica
              </div>
            </CardFooter>
          </Card>

          <Card className="@container/card bg-gradient-to-t from-primary/5 to-card shadow-xs">
            <CardHeader>
              <CardDescription>Balance Pendiente</CardDescription>
              <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                {formatCurrency(stats.financialStats.outstandingBalance)}
              </CardTitle>
              <CardAction>
                <Badge variant="outline" className="gap-1">
                  <IconTrendingDown className="size-3 text-rose-500" />
                  -5.2%
                </Badge>
              </CardAction>
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1.5 text-sm">
              <div className="line-clamp-1 flex gap-2 font-medium">
                {stats.financialStats.paymentCompletionRate.toFixed(1)}% liquidado
              </div>
              <div className="text-muted-foreground">
                Cuentas por pagar activas
              </div>
            </CardFooter>
          </Card>

          <Card className="@container/card bg-gradient-to-t from-primary/5 to-card shadow-xs">
            <CardHeader>
              <CardDescription>Tasa de Devolución</CardDescription>
              <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                {stats.returnStats.returnRate.toFixed(1)}%
              </CardTitle>
              <CardAction>
                <Badge variant="outline" className="gap-1">
                  <IconTrendingUp className="size-3 text-emerald-500" />
                  Estable
                </Badge>
              </CardAction>
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1.5 text-sm">
              <div className="line-clamp-1 flex gap-2 font-medium">
                {stats.returnStats.totalReturns} incidencias registradas
              </div>
              <div className="text-muted-foreground">Calidad del suministro</div>
            </CardFooter>
          </Card>

          <Card className="@container/card bg-gradient-to-t from-primary/5 to-card shadow-xs">
            <CardHeader>
              <CardDescription>Inversión en Mercancía</CardDescription>
              <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                {formatCurrency(stats.purchaseStats.totalPurchased)}
              </CardTitle>
              <CardAction>
                <Badge variant="outline" className="gap-1">
                  <IconTrendingUp className="size-3 text-emerald-500" />
                  +4.5%
                </Badge>
              </CardAction>
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1.5 text-sm">
              <div className="line-clamp-1 flex gap-2 font-medium">
                Valorización de inventario
              </div>
              <div className="text-muted-foreground">Stock actual valorado</div>
            </CardFooter>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="compras" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="compras">Compras</TabsTrigger>
          <TabsTrigger value="finanzas">Finanzas</TabsTrigger>
          <TabsTrigger value="productos">Productos</TabsTrigger>
          <TabsTrigger value="devoluciones">Devoluciones</TabsTrigger>
          <TabsTrigger value="historial">Historial</TabsTrigger>
        </TabsList>

        <TabsContent value="compras">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <IconTruck className="h-5 w-5" /> Órdenes de Compra
                  </CardTitle>
                  <Button size="sm" onClick={() => router.push(`/dashboard/inventario/compras/nuevo?supplierId=${supplierId}`)}>
                    <IconPlus className="h-4 w-4 mr-2" /> Nueva Orden
                  </Button>
                </CardHeader>
                <CardContent>
                  {purchaseOrders.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No hay órdenes registradas</p>
                  ) : (
                    <div className="space-y-4">
                      {purchaseOrders.map((order) => (
                        <div key={order.id} className="flex justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => router.push(`/dashboard/inventario/compras/detalle?id=${order.id}`)}>
                          <div>
                            <p className="font-medium">Orden #{order.id.substring(0, 8)}</p>
                            <p className="text-sm text-muted-foreground">{order.branch.name} • {formatDate(order.createdAt)}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">{formatCurrency(order.total)}</p>
                            {getStatusBadge(order.status)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <Card className="border-none bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent shadow-none">
                <CardHeader className="pb-3">
                  <CardTitle className="text-xs font-bold flex items-center gap-2 text-amber-600 uppercase tracking-widest leading-none">
                    <div className="size-6 rounded-lg bg-amber-500/10 flex items-center justify-center">
                      <IconAlertTriangle size={14} />
                    </div>
                    Sugerencias de Reabastecimiento
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {suggestions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-6 text-center space-y-2">
                      <div className="size-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                        <IconCheck size={20} />
                      </div>
                      <p className="text-[11px] font-medium text-muted-foreground max-w-[150px]">Todo el stock está en niveles óptimos.</p>
                    </div>
                  ) : (
                    <div className="space-y-3 pt-2">
                      {suggestions.map((s, idx) => (
                        <div key={idx} className="text-xs bg-white p-2 rounded border border-amber-100 shadow-sm">
                          <p className="font-bold text-slate-800">{s.productName}</p>
                          <p className="text-slate-500 font-medium">{s.variantName}</p>
                          <div className="flex justify-between mt-1 text-[10px] font-bold">
                            <span className="text-rose-600">Stock: {s.currentStock}</span>
                            <span className="text-slate-400">Min: {s.minStock}</span>
                            <span className="text-emerald-600">Sugerido: +{s.suggestedQty}</span>
                          </div>
                        </div>
                      ))}
                      <Button className="w-full mt-2 text-xs h-8 bg-amber-600 hover:bg-amber-700" onClick={() => router.push(`/dashboard/inventario/compras/nuevo?supplierId=${supplierId}&auto=true`)}>
                        Generar Orden Sugerida
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="finanzas">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <IconReceipt className="h-5 w-5" /> Facturas
                </CardTitle>
              </CardHeader>
              <CardContent>
                {invoices.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No hay facturas</p>
                ) : (
                  <div className="space-y-4">
                    {invoices.map((inv) => (
                      <div key={inv.id} className="flex justify-between p-4 border rounded-lg">
                        <div>
                          <p className="font-medium">Factura #{inv.id.substring(0, 8)}</p>
                          <p className="text-sm text-muted-foreground">Vence: {formatDate(inv.dueDate)}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">{formatCurrency(inv.balance)}</p>
                          {getStatusBadge(inv.status)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <IconCurrencyDollar className="h-5 w-5" /> Pagos
                </CardTitle>
              </CardHeader>
              <CardContent>
                {payments.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No hay pagos</p>
                ) : (
                  <div className="space-y-4">
                    {payments.map((pay) => (
                      <div key={pay.id} className="flex justify-between p-4 border rounded-lg">
                        <div>
                          <p className="font-medium">{pay.method}</p>
                          <p className="text-sm text-muted-foreground">{formatDate(pay.createdAt)}</p>
                        </div>
                        <p className="font-medium text-green-600">{formatCurrency(pay.amount)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="productos">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconPackage className="h-5 w-5" /> Productos y Precios
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats?.priceAnalysis?.priceVariations?.length ? (
                <div className="space-y-4">
                  {stats.priceAnalysis.priceVariations.map((v: any, i: number) => (
                    <div key={i} className="flex justify-between p-4 border rounded-lg">
                      <div>
                        <p className="font-medium">{v.productName}</p>
                        <p className="text-sm text-muted-foreground">Precio proveedor: {formatCurrency(v.supplierPrice)}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{formatCurrency(v.currentCost)}</p>
                        <p className="text-sm text-muted-foreground">Variación: {v.variationPercentage.toFixed(1)}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">No hay productos asociados</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="devoluciones">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconRefresh className="h-5 w-5" /> Devoluciones
              </CardTitle>
            </CardHeader>
            <CardContent>
              {returns.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No hay devoluciones</p>
              ) : (
                <div className="space-y-4">
                  {returns.map((ret) => (
                    <div key={ret.id} className="flex justify-between p-4 border rounded-lg">
                      <div>
                        <p className="font-medium">{ret.variant.product.name}</p>
                        <p className="text-sm text-muted-foreground">{ret.variant.name} • {formatDate(ret.createdAt)}</p>
                        <p className="text-sm text-muted-foreground">Motivo: {ret.reason}</p>
                      </div>
                      <p className="font-medium">{ret.quantity} unidades</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historial">
          <Card>
            <CardHeader className="flex justify-between">
              <CardTitle className="flex items-center gap-2">
                <IconClock className="h-5 w-5" /> Historial
              </CardTitle>
              <Button variant="outline"><IconDownload className="h-4 w-4 mr-2" /> Exportar</Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stats?.purchaseStats?.lastPurchase && (
                  <div className="flex items-center gap-4 p-4 border rounded-lg">
                    <IconPackage className="h-5 w-5 text-blue-500" />
                    <div>
                      <p className="font-medium">Última compra</p>
                      <p className="text-sm text-muted-foreground">{formatDate(stats.purchaseStats.lastPurchase)}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-4 p-4 border rounded-lg">
                  <IconBuildingStore className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="font-medium">Proveedor creado</p>
                    <p className="text-sm text-muted-foreground">{formatDate(supplier.createdAt)}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Payment Dialog */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Registrar Pago a Proveedor</DialogTitle>
            <DialogDescription>
              Este pago se aplicará a las facturas pendientes de {supplier.name} y se registrará en contabilidad.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="amount">Monto a Pagar</Label>
              <Input 
                id="amount" 
                type="number" 
                value={paymentData.amount} 
                onChange={(e) => setPaymentData({ ...paymentData, amount: Number(e.target.value) })}
                placeholder="0.00"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="method">Método de Pago</Label>
              <Select value={paymentData.method} onValueChange={(v) => setPaymentData({ ...paymentData, method: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccione método" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">Efectivo</SelectItem>
                  <SelectItem value="TRANSFER">Transferencia</SelectItem>
                  <SelectItem value="CARD">Tarjeta</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="reference">Referencia / Comprobante</Label>
              <Input 
                id="reference" 
                value={paymentData.reference} 
                onChange={(e) => setPaymentData({ ...paymentData, reference: e.target.value })}
                placeholder="Ej. #Transf-1234"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPaymentDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handlePayment} disabled={submitting} className="bg-emerald-600 hover:bg-emerald-700">
              {submitting ? "Procesando..." : "Confirmar Pago"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function SupplierDetailPage() {
  return (
    <Suspense fallback={<div className="p-6">Cargando perfil de proveedor...</div>}>
      <SupplierDetailContent />
    </Suspense>
  );
}
