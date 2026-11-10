"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { IconArrowRight, IconBarcode, IconLoader2, IconMinus, IconPackageImport, IconPlus, IconTrash, IconTruckDelivery } from "@tabler/icons-react";
import { API_URL } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LinkBarcodeDialog } from "@/components/pos/link-barcode-dialog";
import { cn } from "@/lib/utils";

type Variant = { id: string; name: string; price: number; stock: number; sku: string; barcode?: string; secondaryBarcodes?: string[] };
type Product = { id: string; name: string; isWeighable?: boolean; variants: Variant[]; category?: { name: string } };
type Line = { variantId: string; label: string; stock: number; quantity: string };

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
 * Merchandise that arrives without a purchase order: scan each box (or type its name), set how
 * many came, confirm. A box with a barcode the shop doesn't know is linked to the product it
 * already has, so the scanner works at the till too. Purchase orders stay for when the supplier,
 * the cost and what is owed should be recorded.
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

  const headers = () => ({ Authorization: `Bearer ${localStorage.getItem("token") || ""}`, "Content-Type": "application/json" });

  const load = async (branch: string) => {
    try {
      const [pRes, bRes] = await Promise.all([
        fetch(`${API_URL}/products${branch ? `?branchId=${branch}` : ""}`, { headers: headers() }),
        fetch(`${API_URL}/branches`, { headers: headers() }),
      ]);
      if (pRes.ok) setProducts(await pRes.json());
      if (bRes.ok) setBranches(await bRes.json());
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

  const totals = useMemo(() => ({ products: lines.length, units: lines.reduce((s, l) => s + (parseFloat(l.quantity) || 0), 0) }), [lines]);

  const confirm = async () => {
    const items = lines.map((l) => ({ variantId: l.variantId, quantity: parseFloat(l.quantity) })).filter((i) => i.quantity > 0);
    if (!items.length) return toast.warning("Agrega al menos un producto con cantidad");
    if (!branchId) return toast.warning("Elige la sucursal");
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/inventory/restock-bulk`, { method: "POST", headers: headers(), body: JSON.stringify({ branchId, items }) });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message || "No se pudo registrar la entrada");
      toast.success(`Entrada registrada: ${data.units} unidades de ${data.products} productos`);
      setLines([]);
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
          <p className="text-sm text-muted-foreground">Para la mercancía que llega sin orden de compra: pasa la pistola por cada caja, pon cuántas llegaron y confirma.</p>
        </div>
        <Button variant="outline" asChild className="gap-2">
          <Link href="/dashboard/inventario/compras">
            <IconTruckDelivery size={16} /> Con orden de compra
          </Link>
        </Button>
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
                      <p className="truncate text-sm font-medium">{l.label}</p>
                      <p className="text-xs text-muted-foreground">
                        Hoy hay {l.stock} · quedarán {Math.round((l.stock + (parseFloat(l.quantity) || 0)) * 100) / 100}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="icon" className="size-8" onClick={() => bump(l.variantId, -1)} aria-label="Una menos">
                        <IconMinus size={14} />
                      </Button>
                      <Input value={l.quantity} onChange={(e) => setQty(l.variantId, e.target.value.replace(",", "."))} inputMode="decimal" className="h-8 w-20 text-center font-semibold tabular-nums" aria-label={`Cantidad de ${l.label}`} />
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
          <Button className="h-11 w-full gap-2" disabled={saving || !lines.length} onClick={() => void confirm()}>
            {saving ? <IconLoader2 size={16} className="animate-spin" /> : <IconArrowRight size={16} />} Confirmar entrada
          </Button>
          <p className="text-xs text-muted-foreground">Atajo: Ctrl + Enter. Suma el stock y queda en Inventario → Movimientos. Para registrar el costo y lo que le debes al proveedor, usa una orden de compra.</p>
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
