"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { IconAlertTriangle, IconArrowRight, IconBarcode, IconCircleCheck, IconFileInvoice, IconLoader2, IconMinus, IconPackageImport, IconPlus, IconTrash, IconTruckDelivery, IconX } from "@tabler/icons-react";
import { fmtQty, unitInfo } from "@/lib/purchase-units";
import { API_URL } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LinkBarcodeDialog } from "@/components/pos/link-barcode-dialog";
import { cn } from "@/lib/utils";

type Variant = { id: string; name: string; price: number; stock: number; sku: string; barcode?: string; secondaryBarcodes?: string[] };
type Product = { id: string; name: string; isWeighable?: boolean; variants: Variant[]; category?: { name: string } };
/** A line of the purchase order being received: quantities are in the ordered unit (cajas…) */
type OcLine = { itemId: string; ordered: number; received: number; unit: string; unitFactor: number };
type Line = { variantId: string; label: string; stock: number; quantity: string; oc?: OcLine };
type Order = { id: string; number: string | null; status: string; branchId: string; createdAt: string; supplier: { name: string }; items: any[] };

const plain = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const sameCode = (a?: string, b?: string) => {
  if (!a || !b) return false;
  const x = a.trim().replace(/^0+/, "");
  const y = b.trim().replace(/^0+/, "");
  if (x === y) return true;
  return x.length >= 12 && y.length >= 12 && (x.endsWith(y) || y.endsWith(x));
};
const looksLikeCode = (s: string) => /^[0-9A-Za-z-]{6,}$/.test(s) && /\d{4,}/.test(s);
const labelOf = (p: Product, v: Variant) => p.name + (v.name && !["Principal", "Única", "Unica", "Default"].includes(v.name) ? ` · ${v.name}` : "");

/**
 * Merchandise that arrives: scan each box (or type its name), set how many came, confirm. A box
 * with a barcode the shop doesn't know is linked to the product it already has.
 *
 * With a purchase order: choose it (or come from Compras → Recibir mercancía) and each product
 * shows what was ordered and what arrives, prefilled with what's pending. Confirming receives the
 * order (completely or in part: what didn't come stays pending in the order) and moves the stock
 * and the kardex in one go. Products scanned that aren't in the order go in as a plain entry.
 */
export default function IngresoPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [branchId, setBranchId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [entry, setEntry] = useState("");
  const [active, setActive] = useState(0);
  const [lines, setLines] = useState<Line[]>([]);
  const [flash, setFlash] = useState<string | null>(null);
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  /** Pending purchase orders of the branch, and the one being received */
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderId, setOrderId] = useState<string>("");
  const order = orders.find((o) => o.id === orderId) ?? null;
  const qtyRefs = useRef(new Map<string, HTMLInputElement>());

  const headers = () => ({ Authorization: `Bearer ${localStorage.getItem("token") || ""}`, "Content-Type": "application/json" });

  const load = async (branch: string) => {
    try {
      const [pRes, bRes, oRes] = await Promise.all([
        fetch(`${API_URL}/products${branch ? `?branchId=${branch}` : ""}`, { headers: headers() }),
        fetch(`${API_URL}/branches`, { headers: headers() }),
        fetch(`${API_URL}/purchase-orders`, { headers: headers() }),
      ]);
      if (pRes.ok) setProducts(await pRes.json());
      if (bRes.ok) setBranches(await bRes.json());
      if (oRes.ok) {
        const all: Order[] = await oRes.json();
        setOrders(all.filter((o) => ["DRAFT", "SENT", "PARTIAL"].includes(o.status)));
      }
    } catch {
      toast.error("No se pudieron cargar los productos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const b = localStorage.getItem("currentBranchId") || "";
    setBranchId(b);
    void load(b);
  }, []);

  // From Compras → "Recibir mercancía": that order comes chosen
  const fromUrl = useRef(false);
  useEffect(() => {
    if (fromUrl.current || !orders.length) return;
    fromUrl.current = true;
    const id = new URLSearchParams(window.location.search).get("oc");
    if (id && orders.some((o) => o.id === id)) chooseOrder(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders]);

  /** Loads the order's products, each prefilled with what is still pending */
  const chooseOrder = (id: string) => {
    const o = orders.find((x) => x.id === id);
    setOrderId(o ? o.id : "");
    if (!o) { setLines((prev) => prev.filter((l) => !l.oc)); return; }
    if (o.branchId) setBranchId(o.branchId);
    const ocLines: Line[] = o.items.map((it: any) => {
      const pending = Math.max(0, it.quantity - (it.receivedQuantity ?? 0));
      const p = it.variant?.product;
      return {
        variantId: it.variantId,
        label: (p?.name ?? "Producto") + (it.variant?.name && !["Principal", "Única", "Unica", "Default"].includes(it.variant.name) ? ` · ${it.variant.name}` : ""),
        stock: Number(it.variant?.stock ?? 0),
        quantity: String(pending),
        oc: { itemId: it.id, ordered: it.quantity, received: it.receivedQuantity ?? 0, unit: it.unit ?? "UNIDAD", unitFactor: it.unitFactor ?? 1 },
      };
    }).filter((l: Line) => l.oc!.ordered - l.oc!.received > 0);
    setLines(ocLines);
    toast.success(`${o.number ?? "Orden"} cargada`, { description: "Cambia solo lo que llegó distinto a lo pedido." });
    setTimeout(() => inputRef.current?.focus(), 50);
  };
  useEffect(() => {
    if (!branchId && branches.length) setBranchId(branches[0].id);
  }, [branches, branchId]);

  const variants = useMemo(() => products.flatMap((p) => (p.variants ?? []).map((v) => ({ p, v, label: labelOf(p, v), hay: plain(`${p.name} ${v.name} ${v.sku} ${p.category?.name ?? ""}`) }))), [products]);

  const byCode = (code: string) => variants.find(({ v }) => sameCode(v.barcode, code) || v.sku === code || v.secondaryBarcodes?.some((c) => sameCode(c, code)));

  const results = useMemo(() => {
    const words = plain(entry).split(/\s+/).filter(Boolean);
    if (!words.length || looksLikeCode(entry.trim())) return [];
    return variants.filter((r) => words.every((w) => r.hay.includes(w))).slice(0, 7);
  }, [variants, entry]);
  useEffect(() => setActive(0), [entry]);

  const add = (p: Product, v: Variant, n = 1) => {
    // A product of the order being received: go to its line to type how many came
    const inOrder = lines.find((l) => l.oc && l.variantId === v.id);
    if (inOrder) {
      setFlash(v.id);
      setTimeout(() => setFlash((f) => (f === v.id ? null : f)), 900);
      setEntry("");
      const el = qtyRefs.current.get(v.id);
      el?.focus();
      el?.select();
      return;
    }
    setLines((prev) => {
      const i = prev.findIndex((l) => l.variantId === v.id);
      if (i >= 0) {
        const copy = [...prev];
        const [line] = copy.splice(i, 1);
        return [{ ...line, quantity: String((parseFloat(line.quantity) || 0) + n) }, ...copy];
      }
      return [{ variantId: v.id, label: labelOf(p, v), stock: v.stock, quantity: String(n) }, ...prev];
    });
    setFlash(v.id);
    setTimeout(() => setFlash((f) => (f === v.id ? null : f)), 900);
    setEntry("");
    inputRef.current?.focus();
  };

  const submitEntry = () => {
    const text = entry.trim();
    if (!text) return;
    const hit = byCode(text);
    if (hit) return add(hit.p, hit.v);
    if (results[active]) return add(results[active].p, results[active].v);
    if (looksLikeCode(text)) {
      setLinkCode(text);
      setEntry("");
      return;
    }
    toast.error("No hay productos con ese nombre");
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" && results.length) {
      e.preventDefault();
      setActive((a) => Math.min(results.length - 1, a + 1));
    } else if (e.key === "ArrowUp" && results.length) {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if ((e.metaKey || e.ctrlKey) && lines.length) void confirm();
      else submitEntry();
    }
  };

  const setQty = (id: string, q: string) => setLines((prev) => prev.map((l) => (l.variantId === id ? { ...l, quantity: q } : l)));
  const bump = (id: string, d: number) => setLines((prev) => prev.map((l) => (l.variantId === id ? { ...l, quantity: String(Math.max(0, (parseFloat(l.quantity) || 0) + d)) } : l)));

  /** Stock units a line adds (boxes × units per box) */
  const unitsOf = (l: Line) => (parseFloat(l.quantity) || 0) * (l.oc?.unitFactor ?? 1);
  const totals = useMemo(() => ({ products: lines.length, units: lines.reduce((s, l) => s + unitsOf(l), 0) }), [lines]);
  const shortLines = lines.filter((l) => l.oc && (parseFloat(l.quantity) || 0) < l.oc.ordered - l.oc.received);

  const confirm = async () => {
    const extra = lines.filter((l) => !l.oc).map((l) => ({ variantId: l.variantId, quantity: parseFloat(l.quantity) })).filter((i) => i.quantity > 0);
    const ocLines = lines.filter((l) => l.oc).map((l) => ({ itemId: l.oc!.itemId, quantity: Math.max(0, parseFloat(l.quantity) || 0) }));
    const ocArrives = ocLines.some((l) => l.quantity > 0);
    if (!extra.length && !ocArrives) return toast.warning("Agrega al menos un producto con cantidad");
    if (!branchId) return toast.warning("Elige la sucursal");
    setSaving(true);
    try {
      // 1. The purchase order: what arrived goes in, what didn't stays pending
      if (order && ocArrives) {
        const res = await fetch(`${API_URL}/purchase-orders/${order.id}/receive`, { method: "POST", headers: headers(), body: JSON.stringify({ lines: ocLines }) });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.message || "No se pudo recibir la orden");
        if (data.status === "PARTIAL") {
          toast.warning(`${order.number ?? "Orden"} recibida en parte`, { description: `Quedó pendiente lo que no llegó. La verás como "Recibida parcial" en Compras.`, duration: 8000 });
        } else {
          toast.success(`${order.number ?? "Orden"} recibida completa`, { description: "Inventario y kardex actualizados." });
        }
      }
      // 2. Products that came outside the order
      if (extra.length) {
        const res = await fetch(`${API_URL}/inventory/restock-bulk`, { method: "POST", headers: headers(), body: JSON.stringify({ branchId, items: extra }) });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.message || "No se pudo registrar la entrada");
        toast.success(`Entrada registrada: ${data.units} unidades de ${data.products} productos`);
      }
      setLines([]);
      setOrderId("");
      await load(branchId);
      inputRef.current?.focus();
    } catch (e: any) {
      toast.error(e?.message || "No se pudo registrar la entrada");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 px-4 py-4 font-sans md:py-6 lg:px-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <IconPackageImport size={24} className="text-primary" /> Ingreso de mercancía
          </h1>
          <p className="text-sm text-muted-foreground">Pasa la pistola por cada producto, pon cuántos llegaron y confirma. Si viene de una orden de compra, elígela abajo.</p>
        </div>
        <Button variant="outline" asChild className="gap-2">
          <Link href="/dashboard/inventario/compras">
            <IconTruckDelivery size={16} /> Órdenes de compra
          </Link>
        </Button>
      </div>

      {/* Receiving a purchase order */}
      <div className={cn("flex flex-col gap-3 rounded-2xl border p-4 shadow-xs sm:flex-row sm:items-center", order ? "border-primary/40 bg-primary/5" : "bg-card")}>
        <div className="flex items-center gap-2 text-sm font-medium">
          <IconFileInvoice size={18} className="text-primary" /> ¿Viene de una orden de compra?
        </div>
        <select
          value={orderId}
          onChange={(e) => chooseOrder(e.target.value)}
          className="h-10 min-w-0 flex-1 rounded-lg border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          aria-label="Orden de compra que llega"
        >
          <option value="">{orders.filter((o) => !branchId || o.branchId === branchId).length ? "No, es mercancía sin orden" : "No hay órdenes pendientes en esta sucursal"}</option>
          {orders.filter((o) => !branchId || o.branchId === branchId || o.id === orderId).map((o) => (
            <option key={o.id} value={o.id}>
              {o.number ?? o.id.slice(0, 8)} · {o.supplier?.name} · {new Date(o.createdAt).toLocaleDateString("es-VE")}{o.status === "PARTIAL" ? " · recibida a medias" : ""}
            </option>
          ))}
        </select>
        {order && (
          <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground" onClick={() => chooseOrder("")}>
            <IconX size={14} /> Quitar orden
          </Button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <div className="relative rounded-2xl border bg-card p-4 shadow-xs">
            <Label htmlFor="ingreso-entry" className="mb-2 flex items-center gap-2 text-sm font-medium">
              <IconBarcode size={18} className="text-primary" /> Pasa la pistola o escribe el producto
            </Label>
            <Input
              id="ingreso-entry"
              ref={inputRef}
              autoFocus
              value={entry}
              onChange={(e) => setEntry(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={loading ? "Cargando productos…" : "Ej.: 7591234567890 o crema dental"}
              disabled={loading}
              className="h-12 text-base"
              autoComplete="off"
            />
            {results.length > 0 && (
              <div role="listbox" className="absolute inset-x-4 top-[calc(100%-8px)] z-20 space-y-1 rounded-xl border bg-popover p-1.5 shadow-lg">
                {results.map((r, i) => (
                  <button
                    key={r.v.id}
                    type="button"
                    role="option"
                    aria-selected={i === active}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => add(r.p, r.v)}
                    className={cn("flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm", i === active ? "bg-primary/10" : "hover:bg-muted")}
                  >
                    <span className="truncate font-medium">{r.label}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{r.v.stock} en stock</span>
                  </button>
                ))}
              </div>
            )}
            <p className="mt-2 text-xs text-muted-foreground">Cada pasada suma 1. Si llegó una caja de 10, pásala una vez y escribe 10. Un código que Syncro no conoce te pregunta de qué producto es.</p>
          </div>

          <div className="overflow-hidden rounded-2xl border bg-card shadow-xs">
            {lines.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-6 py-14 text-center text-sm text-muted-foreground">
                <IconBarcode size={36} className="text-muted-foreground/50" />
                Aún no pasas ningún producto.
              </div>
            ) : (
              <ul className="divide-y">
                {lines.map((l) => (
                  <li key={l.variantId} className={cn("flex items-center gap-3 px-4 py-3 transition-colors", flash === l.variantId && "bg-primary/10")}>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 truncate text-sm font-medium">
                        {l.label}
                        {!l.oc && order && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">fuera de la orden</span>}
                      </p>
                      {l.oc ? (() => {
                        const pending = l.oc.ordered - l.oc.received;
                        const now = parseFloat(l.quantity) || 0;
                        const unit = unitInfo(l.oc.unit).short;
                        return (
                          <>
                            <p className="text-xs text-muted-foreground">
                              Pedido: {fmtQty(l.oc.ordered)} {unit}{l.oc.unitFactor > 1 && l.oc.unit !== "UNIDAD" ? ` de ${fmtQty(l.oc.unitFactor)}` : ""}
                              {l.oc.received > 0 && ` · ya llegaron ${fmtQty(l.oc.received)}`}
                              {" · "}hoy hay {fmtQty(l.stock)}, quedarán {fmtQty(l.stock + unitsOf(l))}
                            </p>
                            {now < pending ? (
                              <p className="flex items-center gap-1 text-xs font-semibold text-amber-700"><IconAlertTriangle size={13} /> Quedará pendiente {fmtQty(pending - now)} {unit}</p>
                            ) : (
                              <p className="flex items-center gap-1 text-xs font-medium text-emerald-700"><IconCircleCheck size={13} /> Completo</p>
                            )}
                          </>
                        );
                      })() : (
                        <p className="text-xs text-muted-foreground">
                          Hoy hay {l.stock} · quedarán {Math.round((l.stock + (parseFloat(l.quantity) || 0)) * 100) / 100}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="icon" className="size-8" onClick={() => bump(l.variantId, -1)} aria-label="Una menos">
                        <IconMinus size={14} />
                      </Button>
                      <Input
                        ref={(el) => { if (el) qtyRefs.current.set(l.variantId, el); else qtyRefs.current.delete(l.variantId); }}
                        value={l.quantity}
                        onChange={(e) => setQty(l.variantId, e.target.value.replace(",", "."))}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (e.metaKey || e.ctrlKey) void confirm(); else inputRef.current?.focus(); } }}
                        inputMode="decimal"
                        className="h-8 w-20 text-center font-semibold tabular-nums"
                        aria-label={`Cantidad que llegó de ${l.label}`}
                      />
                      {l.oc && l.oc.unit !== "UNIDAD" && <span className="w-12 text-xs text-muted-foreground">{unitInfo(l.oc.unit).short}</span>}
                      <Button variant="outline" size="icon" className="size-8" onClick={() => bump(l.variantId, 1)} aria-label="Una más">
                        <IconPlus size={14} />
                      </Button>
                    </div>
                    <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-destructive" onClick={() => setLines((p) => p.filter((x) => x.variantId !== l.variantId))} aria-label={`Quitar ${l.label}`}>
                      <IconTrash size={15} />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="h-fit space-y-4 rounded-2xl border bg-card p-5 shadow-xs lg:sticky lg:top-4">
          {branches.length > 1 && (
            <div className="space-y-1.5">
              <Label>Sucursal que recibe</Label>
              <Select value={branchId} onValueChange={setBranchId}>
                <SelectTrigger className="h-10"><SelectValue placeholder="Elige la sucursal" /></SelectTrigger>
                <SelectContent>
                  {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">Productos</span>
            <span className="text-lg font-semibold tabular-nums">{totals.products}</span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">Unidades</span>
            <span className="text-lg font-semibold tabular-nums">{Math.round(totals.units * 100) / 100}</span>
          </div>
          {order && shortLines.length > 0 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800">
              <p className="flex items-center gap-1 font-semibold"><IconAlertTriangle size={14} /> Llega menos de lo pedido</p>
              <p className="mt-1">{shortLines.length === 1 ? `${shortLines[0].label} quedará` : `${shortLines.length} productos quedarán`} pendiente{shortLines.length === 1 ? "" : "s"} en la orden, que pasará a "Recibida parcial".</p>
            </div>
          )}
          <Button className="h-11 w-full gap-2" disabled={saving || !lines.length} onClick={() => void confirm()}>
            {saving ? <IconLoader2 size={16} className="animate-spin" /> : <IconArrowRight size={16} />} {order ? `Recibir ${order.number ?? "orden"}` : "Confirmar entrada"}
          </Button>
          <p className="text-xs text-muted-foreground">Atajo: Ctrl + Enter. Suma el stock y queda en el kardex (Inventario → Movimientos){order ? "; la orden queda recibida y lo que llegó se carga a lo que le debes al proveedor" : ""}.</p>
        </div>
      </div>

      <LinkBarcodeDialog
        code={linkCode}
        products={products as any}
        onClose={() => { setLinkCode(null); inputRef.current?.focus(); }}
        onNewProduct={() => {
          setLinkCode(null);
          toast.info("Crea el producto con ese código y vuelve aquí para ingresarlo");
          router.push("/dashboard/productos/todos");
        }}
        onLinked={(productId, variantId, code) => {
          setLinkCode(null);
          setProducts((prev) => prev.map((p) => (p.id !== productId ? p : { ...p, variants: p.variants.map((v) => (v.id !== variantId ? v : { ...v, secondaryBarcodes: [...(v.secondaryBarcodes ?? []), code] })) })));
          const p = products.find((x) => x.id === productId);
          const v = p?.variants.find((x) => x.id === variantId);
          if (p && v) add(p, v);
        }}
      />
    </div>
  );
}
