"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  IconBrandWhatsapp, IconBuildingStore, IconCheck, IconClockHour4, IconEye, IconForms, IconPackage,
  IconReceipt2, IconSettings, IconShoppingBag, IconStarFilled, IconTruckDelivery, IconWorld, IconX,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { API_URL } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/context/CurrencyContext";
import { PosTable } from "@/components/pos-table";
import { CheckoutFormBuilder } from "@/components/syncro-shop/checkout-form-builder";
import { ReviewsModeration } from "@/components/syncro-shop/reviews-moderation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const SHOP_URL = "https://syncro.shop";

type OrderItem = {
  id: string;
  productName: string;
  variantName: string | null;
  image: string | null;
  quantity: number;
  price: number;
  subtotal: number;
  branch?: { name: string } | null;
};
type ShopOrder = {
  id: string;
  code: string;
  status: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  address: string | null;
  city: string | null;
  reference: string | null;
  notes: string | null;
  deliveryMethod: "PICKUP" | "DELIVERY";
  customFields: Record<string, string> | null;
  subtotal: number;
  deliveryCost: number;
  total: number;
  paymentMethod: string | null;
  rejectionReason: string | null;
  statusHistory: { status: string; at: string; note?: string }[] | null;
  saleIds: string[];
  createdAt: string;
  items: OrderItem[];
};
type Stats = {
  pendingOrders: number;
  monthSales: number;
  monthOrders: number;
  averageTicket: number;
  totalSales: number;
  totalOrders: number;
  publishedProducts: number;
  featuredProducts: number;
  maxFeatured: number;
};

const STATUS: Record<string, { label: string; className: string }> = {
  PENDIENTE: { label: "Pendiente", className: "bg-amber-500/10 text-amber-700 border-amber-500/30" },
  PROCESANDO: { label: "Procesando", className: "bg-amber-500/10 text-amber-700 border-amber-500/30" },
  APROBADO: { label: "Aprobado", className: "bg-blue-500/10 text-blue-700 border-blue-500/30" },
  EN_CAMINO: { label: "En camino", className: "bg-violet-500/10 text-violet-700 border-violet-500/30" },
  ENTREGADO: { label: "Entregado", className: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30" },
  RECHAZADO: { label: "Rechazado", className: "bg-rose-500/10 text-rose-700 border-rose-500/30" },
  CANCELADO: { label: "Cancelado", className: "bg-muted text-muted-foreground border-border" },
};
const FILTERS: [string, string][] = [
  ["ALL", "Todos"], ["PENDIENTE", "Pendientes"], ["APROBADO", "Aprobados"], ["EN_CAMINO", "En camino"], ["ENTREGADO", "Entregados"], ["CLOSED", "Rechazados / cancelados"],
];
const PAYMENT_METHODS: [string, string, string?][] = [
  ["CASH", "Efectivo (USD)", "Aplica IGTF 3%, igual que en el POS"],
  ["PAGO_MOVIL", "Pago móvil"],
  ["TRANSFER", "Transferencia"],
  ["CARD", "Punto de venta"],
  ["BINANCE", "Binance"],
  ["ZINLI", "Zinli"],
  ["PAYPAL", "PayPal"],
];

function authHeaders(json = false) {
  return { Authorization: `Bearer ${localStorage.getItem("token")}`, ...(json ? { "Content-Type": "application/json" } : {}) };
}

function whatsappUrl(phone: string, text: string) {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = "58" + digits.slice(1); // 0414... → 58414...
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

function customerMessage(order: ShopOrder, storeTotal: string) {
  switch (order.status) {
    case "APROBADO":
      return `Hola ${order.customerName}, confirmamos tu pedido ${order.code} por ${storeTotal}. ${order.deliveryMethod === "DELIVERY" ? "Te avisamos cuando salga a entrega." : "Ya puedes pasar a retirarlo."}`;
    case "EN_CAMINO":
      return `Hola ${order.customerName}, tu pedido ${order.code} va en camino. Ten listo el pago de ${storeTotal}.`;
    case "ENTREGADO":
      return `Hola ${order.customerName}, gracias por tu compra (pedido ${order.code}). ¡Esperamos verte pronto!`;
    case "RECHAZADO":
      return `Hola ${order.customerName}, lamentablemente no podemos procesar tu pedido ${order.code}${order.rejectionReason ? `: ${order.rejectionReason}` : ""}.`;
    default:
      return `Hola ${order.customerName}, recibimos tu pedido ${order.code} por ${storeTotal}. ¿Confirmamos?`;
  }
}

export default function SyncroShopPage() {
  const router = useRouter();
  const { formatPrice, currency, exchangeRate } = useCurrency();
  const [stats, setStats] = useState<Stats | null>(null);
  const [orders, setOrders] = useState<ShopOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");
  const [slug, setSlug] = useState<string | null>(null);
  const [selected, setSelected] = useState<ShopOrder | null>(null);
  const [busy, setBusy] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("PAGO_MOVIL");
  const [reasonDialog, setReasonDialog] = useState<null | "reject" | "cancel">(null);
  const [reason, setReason] = useState("");

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [sRes, oRes] = await Promise.all([
        fetch(`${API_URL}/storefront/admin/stats`, { headers: authHeaders() }),
        fetch(`${API_URL}/storefront/admin/orders`, { headers: authHeaders() }),
      ]);
      if (sRes.ok) setStats(await sRes.json());
      if (oRes.ok) {
        const list: ShopOrder[] = await oRes.json();
        setOrders(list);
        setSelected((current) => (current ? list.find((o) => o.id === current.id) ?? current : current));
      }
    } catch {
      if (!silent) toast.error("No se pudieron cargar los pedidos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    fetch(`${API_URL}/storefront/admin/profile`, { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => p && setSlug(p.slug))
      .catch(() => {});
    // New orders arrive while the merchant works: refresh quietly.
    const timer = setInterval(() => load(true), 30000);
    return () => clearInterval(timer);
  }, [load]);

  const filtered = useMemo(() => orders.filter((o) =>
    filter === "ALL" ? true
      : filter === "CLOSED" ? ["RECHAZADO", "CANCELADO"].includes(o.status)
      : o.status === filter,
  ), [orders, filter]);

  const runAction = async (path: string, body?: unknown, success?: string) => {
    if (!selected) return;
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/storefront/admin/orders/${selected.id}/${path}`, {
        method: "POST",
        headers: authHeaders(true),
        body: JSON.stringify(body ?? {}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(Array.isArray(data.message) ? data.message.join(". ") : data.message);
      toast.success(success ?? "Pedido actualizado");
      setApproveOpen(false);
      setReasonDialog(null);
      setReason("");
      await load(true);
    } catch (e: any) {
      toast.error(e?.message || "No se pudo actualizar el pedido");
    } finally {
      setBusy(false);
    }
  };

  const columns: ColumnDef<ShopOrder>[] = [
    {
      accessorKey: "code",
      header: "Pedido",
      cell: ({ row }) => (
        <button className="text-left" onClick={() => setSelected(row.original)}>
          <p className="font-bold text-sm font-mono hover:text-primary">{row.original.code}</p>
          <p className="text-[11px] text-muted-foreground">{format(new Date(row.original.createdAt), "d MMM, h:mm a", { locale: es })}</p>
        </button>
      ),
    },
    {
      accessorKey: "customerName",
      header: "Cliente",
      cell: ({ row }) => (
        <div>
          <p className="text-sm font-medium">{row.original.customerName}</p>
          <p className="text-[11px] text-muted-foreground">{row.original.customerPhone}</p>
        </div>
      ),
    },
    {
      id: "items",
      header: "Productos",
      cell: ({ row }) => (
        <div className="max-w-[220px]">
          <p className="text-sm truncate">{row.original.items.map((i) => i.productName).join(", ")}</p>
          <p className="text-[11px] text-muted-foreground">{row.original.items.length} {row.original.items.length === 1 ? "producto" : "productos"}</p>
        </div>
      ),
    },
    {
      accessorKey: "deliveryMethod",
      header: "Entrega",
      cell: ({ row }) => (
        <Badge variant="outline" className="gap-1 font-normal">
          {row.original.deliveryMethod === "DELIVERY" ? <IconTruckDelivery size={12} /> : <IconBuildingStore size={12} />}
          {row.original.deliveryMethod === "DELIVERY" ? "Delivery" : "Retiro"}
        </Badge>
      ),
    },
    {
      accessorKey: "total",
      header: "Total",
      cell: ({ row }) => <span className="font-bold text-sm tabular-nums">{formatPrice(row.original.total)}</span>,
    },
    {
      accessorKey: "status",
      header: "Estado",
      cell: ({ row }) => {
        const s = STATUS[row.original.status] ?? STATUS.PENDIENTE;
        return <Badge variant="outline" className={cn("font-semibold", s.className)}>{s.label}</Badge>;
      },
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex justify-end">
          <Button variant="ghost" size="icon" className="size-8 text-primary" title="Ver pedido" onClick={() => setSelected(row.original)}>
            <IconEye size={16} />
          </Button>
        </div>
      ),
    },
  ];

  const statCard = (label: string, value: React.ReactNode, footerTitle: string, footer: string, icon: React.ReactNode, highlight = false) => (
    <Card className={cn("@container/card bg-gradient-to-t to-card shadow-xs", highlight ? "from-amber-500/10" : "from-primary/5")}>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">{value}</CardTitle>
        <CardAction>{icon}</CardAction>
      </CardHeader>
      <CardFooter className="flex-col items-start gap-1.5 text-sm">
        <div className="line-clamp-1 flex gap-2 font-medium">{footerTitle}</div>
        <div className="text-muted-foreground">{footer}</div>
      </CardFooter>
    </Card>
  );

  const canAct = selected && !busy;

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6 @container/main">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading flex items-center gap-2">
            <IconBuildingStore className="text-primary" /> Syncro Shop
          </h1>
          <p className="text-muted-foreground text-sm">Pedidos de tu tienda en línea. Los productos se publican desde productos → todos los productos.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => router.push("/dashboard/configuracion")}>
            <IconSettings size={16} /> Configurar tienda
          </Button>
          <Button className="gap-2" onClick={() => window.open(slug ? `${SHOP_URL}/tienda/${slug}` : SHOP_URL, "_blank")}>
            <IconWorld size={16} /> Ver mi tienda
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
        {statCard("Pedidos pendientes", stats ? stats.pendingOrders : "—", stats?.pendingOrders ? "Por revisar y aprobar" : "Todo al día", "Pedidos nuevos de tus clientes",
          <IconClockHour4 className="text-amber-500" />, Boolean(stats?.pendingOrders))}
        {statCard("Ventas en línea del mes", stats ? formatPrice(stats.monthSales) : "—", `${stats?.monthOrders ?? 0} pedidos aprobados este mes`,
          currency === "USD" && stats ? `Bs ${(stats.monthSales * exchangeRate).toLocaleString("es-VE", { minimumFractionDigits: 2 })}` : "Incluye delivery",
          <IconReceipt2 className="text-primary" />)}
        {statCard("Ticket promedio", stats ? formatPrice(stats.averageTicket) : "—", "Por pedido aprobado este mes", `Histórico: ${stats ? formatPrice(stats.totalSales) : "—"} en ${stats?.totalOrders ?? 0} pedidos`,
          <IconShoppingBag className="text-primary" />)}
        {statCard("Productos publicados", stats ? stats.publishedProducts : "—", `${stats?.featuredProducts ?? 0} de ${stats?.maxFeatured ?? 5} destacados`, "Visibles en Syncro Shop",
          <IconStarFilled className="text-amber-500" />)}
      </div>

      <Tabs defaultValue="orders" className="w-full">
        <TabsList className="bg-muted p-1 rounded-xl">
          <TabsTrigger value="orders" className="gap-2 rounded-lg text-xs font-medium">
            <IconShoppingBag className="w-4 h-4" /> Pedidos
            {stats?.pendingOrders ? <Badge className="h-4 px-1.5 bg-amber-500 text-white">{stats.pendingOrders}</Badge> : null}
          </TabsTrigger>
          <TabsTrigger value="checkout-form" className="gap-2 rounded-lg text-xs font-medium">
            <IconForms className="w-4 h-4" /> Formulario de compra
          </TabsTrigger>
          <TabsTrigger value="reviews" className="gap-2 rounded-lg text-xs font-medium">
            <IconStarFilled className="w-4 h-4" /> Reseñas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            {FILTERS.map(([key, label]) => {
              const count = key === "ALL" ? orders.length : key === "CLOSED" ? orders.filter((o) => ["RECHAZADO", "CANCELADO"].includes(o.status)).length : orders.filter((o) => o.status === key).length;
              return (
                <button key={key} onClick={() => setFilter(key)} className={cn("h-7 px-3 rounded-full border text-xs font-semibold transition-colors", filter === key ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground hover:text-foreground")}>
                  {label} <span className="opacity-70">{count}</span>
                </button>
              );
            })}
          </div>
          <PosTable columns={columns} data={filtered} loading={loading} searchPlaceholder="Buscar por pedido, cliente o teléfono..." getRowId={(o) => o.id} />
        </TabsContent>

        <TabsContent value="checkout-form" className="mt-4">
          <CheckoutFormBuilder />
        </TabsContent>

        <TabsContent value="reviews" className="mt-4">
          <ReviewsModeration />
        </TabsContent>
      </Tabs>

      {/* Order detail */}
      <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="sm:max-w-xl overflow-y-auto">
          {selected && (() => {
            const s = STATUS[selected.status] ?? STATUS.PENDIENTE;
            const totalLabel = `$${selected.total.toFixed(2)}`;
            return (
              <div className="space-y-6 p-1">
                <SheetHeader className="p-0">
                  <div className="flex items-center gap-2">
                    <SheetTitle className="font-mono text-xl">{selected.code}</SheetTitle>
                    <Badge variant="outline" className={cn("font-semibold", s.className)}>{s.label}</Badge>
                  </div>
                  <SheetDescription>{format(new Date(selected.createdAt), "EEEE d 'de' MMMM, h:mm a", { locale: es })}</SheetDescription>
                </SheetHeader>

                {/* Actions */}
                <div className="flex flex-wrap gap-2">
                  {selected.status === "PENDIENTE" && (
                    <>
                      <Button disabled={!canAct} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700" onClick={() => setApproveOpen(true)}><IconCheck size={16} /> Aprobar pedido</Button>
                      <Button disabled={!canAct} variant="outline" className="gap-1.5 text-rose-600" onClick={() => setReasonDialog("reject")}><IconX size={16} /> Rechazar</Button>
                    </>
                  )}
                  {selected.status === "APROBADO" && selected.deliveryMethod === "DELIVERY" && (
                    <Button disabled={!canAct} className="gap-1.5" onClick={() => runAction("ship", undefined, "Pedido marcado en camino")}><IconTruckDelivery size={16} /> Marcar en camino</Button>
                  )}
                  {["APROBADO", "EN_CAMINO"].includes(selected.status) && (
                    <>
                      <Button disabled={!canAct} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700" onClick={() => runAction("deliver", undefined, "Pedido entregado")}><IconPackage size={16} /> Marcar entregado</Button>
                      <Button disabled={!canAct} variant="outline" className="gap-1.5 text-rose-600" onClick={() => setReasonDialog("cancel")}>Cancelar pedido</Button>
                    </>
                  )}
                  <Button variant="outline" className="gap-1.5 text-emerald-700" onClick={() => window.open(whatsappUrl(selected.customerPhone, customerMessage(selected, totalLabel)), "_blank")}>
                    <IconBrandWhatsapp size={16} /> Escribir al cliente
                  </Button>
                </div>
                {selected.status === "PENDIENTE" && (
                  <p className="text-xs text-muted-foreground -mt-3">Al aprobar se registra la venta en el POS y se descuenta el inventario de la sucursal de cada producto.</p>
                )}
                {selected.rejectionReason && <p className="rounded-xl bg-muted p-3 text-sm">Motivo: {selected.rejectionReason}</p>}

                {/* Customer */}
                <section className="rounded-2xl border p-4 space-y-2 text-sm">
                  <h3 className="text-xs font-bold text-primary">Cliente</h3>
                  <p className="font-semibold">{selected.customerName}</p>
                  <p>{selected.customerPhone}{selected.customerEmail ? ` · ${selected.customerEmail}` : ""}</p>
                  <p className="flex items-center gap-1.5">
                    {selected.deliveryMethod === "DELIVERY" ? <IconTruckDelivery size={14} /> : <IconBuildingStore size={14} />}
                    {selected.deliveryMethod === "DELIVERY" ? "Delivery" : "Retira en tienda"}
                  </p>
                  {selected.address && <p className="text-muted-foreground">{selected.address}{selected.city ? `, ${selected.city}` : ""}{selected.reference ? ` (Ref: ${selected.reference})` : ""}</p>}
                  {selected.notes && <p className="rounded-lg bg-muted/60 p-2 text-xs">“{selected.notes}”</p>}
                  {selected.customFields && Object.keys(selected.customFields).length > 0 && (
                    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs pt-1">
                      {Object.entries(selected.customFields).map(([k, v]) => (
                        <div key={k} className="contents"><dt className="text-muted-foreground">{k}</dt><dd className="font-medium">{String(v)}</dd></div>
                      ))}
                    </dl>
                  )}
                </section>

                {/* Items */}
                <section className="rounded-2xl border p-4 space-y-3">
                  <h3 className="text-xs font-bold text-primary">Productos</h3>
                  {selected.items.map((item) => (
                    <div key={item.id} className="flex items-center gap-3">
                      <div className="size-12 rounded-lg border bg-white overflow-hidden shrink-0">
                        {item.image && <img src={item.image} alt="" className="size-full object-contain" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.productName}{item.variantName ? ` · ${item.variantName}` : ""}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {item.quantity} × {formatPrice(item.price)}{item.branch?.name ? ` · sale de ${item.branch.name}` : ""}
                        </p>
                      </div>
                      <span className="text-sm font-semibold tabular-nums">{formatPrice(item.subtotal)}</span>
                    </div>
                  ))}
                  <div className="border-t pt-3 space-y-1 text-sm">
                    <div className="flex justify-between text-muted-foreground"><span>Subtotal (IVA incluido)</span><span>{formatPrice(selected.subtotal)}</span></div>
                    {selected.deliveryMethod === "DELIVERY" && <div className="flex justify-between text-muted-foreground"><span>Delivery</span><span>{selected.deliveryCost ? formatPrice(selected.deliveryCost) : "Gratis / a convenir"}</span></div>}
                    <div className="flex justify-between font-bold"><span>Total</span><span>{formatPrice(selected.total)}</span></div>
                    {selected.paymentMethod && <p className="text-xs text-muted-foreground">Pago: {PAYMENT_METHODS.find(([m]) => m === selected.paymentMethod)?.[1] ?? selected.paymentMethod}</p>}
                  </div>
                </section>

                {/* History */}
                {selected.statusHistory && selected.statusHistory.length > 0 && (
                  <section className="space-y-3">
                    <h3 className="text-xs font-bold text-primary">Historial</h3>
                    <ol className="relative border-l pl-4 space-y-3">
                      {selected.statusHistory.map((h, i) => (
                        <li key={i} className="text-sm">
                          <span className="absolute -left-1.5 mt-1.5 size-3 rounded-full border-2 border-background bg-primary" />
                          <p className="font-medium">{STATUS[h.status]?.label ?? h.status}</p>
                          <p className="text-[11px] text-muted-foreground">{format(new Date(h.at), "d MMM, h:mm a", { locale: es })}{h.note ? ` · ${h.note}` : ""}</p>
                        </li>
                      ))}
                    </ol>
                  </section>
                )}
              </div>
            );
          })()}
        </SheetContent>
      </Sheet>

      {/* Approve: payment method */}
      <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Aprobar pedido {selected?.code}</DialogTitle>
            <DialogDescription>Se registrará la venta en el POS y se descontará el inventario. ¿Cómo te pagará el cliente?</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            {PAYMENT_METHODS.map(([method, label, hint]) => (
              <button key={method} type="button" onClick={() => setPaymentMethod(method)} className={cn("flex items-center justify-between rounded-xl border p-3 text-left", paymentMethod === method ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "hover:border-primary/40")}>
                <span>
                  <span className="block text-sm font-semibold">{label}</span>
                  {hint && <span className="block text-[11px] text-muted-foreground">{hint}</span>}
                </span>
                {paymentMethod === method && <IconCheck size={16} className="text-primary" />}
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setApproveOpen(false)}>Volver</Button>
            <Button disabled={busy} className="bg-emerald-600 hover:bg-emerald-700" onClick={() => runAction("approve", { paymentMethod }, "Pedido aprobado: venta registrada e inventario descontado")}>
              {busy ? "Registrando venta..." : "Aprobar y registrar venta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject / cancel: reason */}
      <Dialog open={reasonDialog !== null} onOpenChange={(open) => !open && setReasonDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{reasonDialog === "reject" ? "Rechazar pedido" : "Cancelar pedido"} {selected?.code}</DialogTitle>
            <DialogDescription>
              {reasonDialog === "reject" ? "El cliente verá el motivo en el estado de su pedido." : "La venta se devolverá en el POS y el stock regresa al inventario."}
            </DialogDescription>
          </DialogHeader>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={300} placeholder={reasonDialog === "reject" ? "Ej: no tenemos ese producto en este momento" : "Ej: el cliente no recibió el pedido"} className="w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50" />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setReasonDialog(null)}>Volver</Button>
            <Button disabled={busy || (reasonDialog === "reject" && !reason.trim())} variant="destructive" onClick={() => runAction(reasonDialog === "reject" ? "reject" : "cancel", { reason }, reasonDialog === "reject" ? "Pedido rechazado" : "Pedido cancelado y stock devuelto")}>
              {reasonDialog === "reject" ? "Rechazar pedido" : "Cancelar pedido"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
