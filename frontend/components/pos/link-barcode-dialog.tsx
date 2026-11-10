"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { IconBarcode, IconLoader2, IconPlus, IconSearch } from "@tabler/icons-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { API_URL } from "@/lib/constants";

type Variant = { id: string; name: string; price: number; stock: number; sku: string; barcode?: string; secondaryBarcodes?: string[] };
type Product = { id: string; name: string; variants: Variant[]; category?: { name: string } };

const plain = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * The scanner read a code the shop doesn't know. Most of the time it's a product it already has
 * (the same toothpaste in a new box, or two butters of the same brand with different codes):
 * the cashier finds it here and the code is linked to it. From then on the scanner recognises it
 * and every code sells from the same stock. If it really is a new product, it goes to the old
 * "lista de espera" form.
 */
export function LinkBarcodeDialog({
  code,
  products,
  onClose,
  onLinked,
  onNewProduct,
}: {
  /** The code that was read; null closes the dialog */
  code: string | null;
  products: Product[];
  onClose: () => void;
  onLinked: (productId: string, variantId: string, code: string) => void;
  onNewProduct: (code: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [saving, setSaving] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (code) {
      setQuery("");
      setActive(0);
      setSaving(null);
    }
  }, [code]);

  const rows = useMemo(() => {
    const words = plain(query).split(/\s+/).filter(Boolean);
    const all = products.flatMap((p) =>
      (p.variants ?? []).map((v) => ({
        product: p,
        variant: v,
        label: p.name + (v.name && !["Principal", "Única", "Unica", "Default"].includes(v.name) ? ` · ${v.name}` : ""),
        hay: plain(`${p.name} ${v.name} ${v.sku} ${p.category?.name ?? ""}`),
      })),
    );
    if (!words.length) return [];
    return all.filter((r) => words.every((w) => r.hay.includes(w))).slice(0, 8);
  }, [products, query]);

  useEffect(() => setActive(0), [query]);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-row="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const link = async (i: number) => {
    const row = rows[i];
    if (!row || !code || saving) return;
    setSaving(row.variant.id);
    try {
      const token = localStorage.getItem("token") || "";
      const res = await fetch(`${API_URL}/products/variants/${row.variant.id}/barcodes`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ barcode: code }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message || "No se pudo vincular el código");
      toast.success(`Código vinculado a ${row.label}`, { description: "La próxima vez la pistola lo reconoce sola, y se descuenta del mismo stock." });
      onLinked(row.product.id, row.variant.id, code);
    } catch (e: any) {
      toast.error(e?.message || "No se pudo vincular el código");
      setSaving(null);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(rows.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (rows.length) void link(active);
    }
  };

  return (
    <Dialog open={!!code} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[480px]" onKeyDown={onKeyDown}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <IconBarcode className="text-primary" /> Código nuevo
          </DialogTitle>
          <DialogDescription>
            La pistola leyó <strong className="font-mono text-foreground">{code}</strong>. Si es un producto que ya tienes (otra caja con otro código), búscalo
            y queda vinculado: desde ahora se reconoce solo y vende del mismo stock.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="¿Qué producto es? Ej.: crema dental" className="h-11 pl-9" aria-label="Buscar el producto" />
        </div>

        <div ref={listRef} role="listbox" aria-label="Productos" className="max-h-72 space-y-1 overflow-y-auto">
          {query && !rows.length && <p className="px-1 py-6 text-center text-sm text-muted-foreground">No hay productos con ese nombre.</p>}
          {!query && <p className="px-1 py-6 text-center text-sm text-muted-foreground">Escribe el nombre y elige con las flechas y Enter.</p>}
          {rows.map((r, i) => (
            <button
              key={r.variant.id}
              type="button"
              role="option"
              aria-selected={i === active}
              data-row={i}
              onMouseEnter={() => setActive(i)}
              onClick={() => void link(i)}
              disabled={!!saving}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors",
                i === active ? "border-primary/50 bg-primary/5" : "border-transparent hover:bg-muted",
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{r.label}</p>
                <p className="text-xs text-muted-foreground">
                  ${r.variant.price.toFixed(2)} · {r.variant.stock} en stock · {1 + (r.variant.secondaryBarcodes?.length ?? 0) - (r.variant.barcode ? 0 : 1)} código(s)
                </p>
              </div>
              {saving === r.variant.id ? <IconLoader2 className="size-4 animate-spin text-primary" /> : i === active && <span className="shrink-0 text-xs font-medium text-primary">Enter para vincular</span>}
            </button>
          ))}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="outline" onClick={() => code && onNewProduct(code)} disabled={!!saving}>
            <IconPlus className="size-4" /> Es un producto nuevo
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={!!saving}>
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
