"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { IconLoader2, IconSearch, IconShoppingBag, IconX } from "@tabler/icons-react";
import { apiFetch } from "@/lib/api";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type AutoBag = { enabled: boolean; variantId: string | null; productId: string | null; name: string | null };
export const NO_AUTO_BAG: AutoBag = { enabled: false, variantId: null, productId: null, name: null };

export const readAutoBag = (raw: any): AutoBag => ({
  enabled: raw?.enabled === true && typeof raw?.variantId === "string",
  variantId: typeof raw?.variantId === "string" ? raw.variantId : null,
  productId: typeof raw?.productId === "string" ? raw.productId : null,
  name: typeof raw?.name === "string" ? raw.name : null,
});

const plain = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
type Row = { variantId: string; productId: string; name: string; price: number; hay: string };

/**
 * Configuración → Punto de venta → "Bolsa automática": a product (the customer's bag) that the
 * POS adds by itself, 1 unit, as soon as the ticket gets its first product. The cashier can
 * still raise, lower or remove it.
 */
export function AutoBagSettings({ value, onChange }: { value: AutoBag; onChange: (v: AutoBag) => void }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [picking, setPicking] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Products load only when they're needed (switch on and choosing)
  useEffect(() => {
    if (!(value.enabled && (picking || !value.variantId)) || rows) return;
    void (async () => {
      try {
        const branchId = localStorage.getItem("currentBranchId") || "";
        const res = await apiFetch(`/products${branchId ? `?branchId=${branchId}` : ""}`);
        const data = res.ok ? await res.json() : [];
        const list: any[] = Array.isArray(data) ? data : data?.data ?? [];
        setRows(
          list.flatMap((p) =>
            (p.variants ?? []).map((v: any) => {
              const name = p.name + (v.name && !["Principal", "Única", "Unica", "Default"].includes(v.name) ? ` (${v.name})` : "");
              return { variantId: v.id, productId: p.id, name, price: Number(v.price) || 0, hay: plain(`${name} ${v.sku ?? ""} ${v.barcode ?? ""}`) };
            }),
          ),
        );
      } catch {
        setRows([]);
      }
    })();
  }, [value.enabled, value.variantId, picking, rows]);

  const shown = useMemo(() => {
    if (!rows) return [];
    const words = plain(query).split(/\s+/).filter(Boolean);
    // With nothing typed, bags first
    const list = words.length ? rows.filter((r) => words.every((w) => r.hay.includes(w))) : rows.filter((r) => /bolsa|empaque|funda/.test(r.hay));
    return list.slice(0, 8);
  }, [rows, query]);

  useEffect(() => setActive(0), [query]);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-row="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const choose = (r: Row) => {
    onChange({ enabled: true, variantId: r.variantId, productId: r.productId, name: r.name });
    setPicking(false);
    setQuery("");
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, shown.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter" && shown[active]) { e.preventDefault(); choose(shown[active]); }
    else if (e.key === "Escape" && value.variantId) { e.preventDefault(); setPicking(false); }
  };

  const choosing = value.enabled && (picking || !value.variantId);
  useEffect(() => {
    if (choosing) setTimeout(() => inputRef.current?.focus(), 50);
  }, [choosing]);

  return (
    <div className="flex flex-col gap-3 py-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-medium"><IconShoppingBag size={16} className="text-primary" /> Agregar bolsa automáticamente</p>
          <p className="text-xs text-muted-foreground">Al agregar el primer producto al ticket, se agrega 1 bolsa. El cajero puede subir, bajar o quitarla.</p>
        </div>
        <Switch
          checked={value.enabled}
          onCheckedChange={(on) => onChange({ ...value, enabled: on })}
          aria-label="Agregar bolsa automáticamente"
        />
      </div>

      {value.enabled && value.variantId && !picking && (
        <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 p-3">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Producto que se agrega</p>
            <p className="truncate text-sm font-semibold">{value.name}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setPicking(true)}>Cambiar</Button>
        </div>
      )}

      {choosing && (
        <div className="flex flex-col gap-2 rounded-lg border p-3">
          <div className="relative">
            <IconSearch size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKey}
              placeholder="Busca el producto de la bolsa (nombre o código)"
              className="pl-9"
              aria-label="Buscar el producto de la bolsa"
            />
            {value.variantId && (
              <button type="button" onClick={() => setPicking(false)} aria-label="Cancelar" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted">
                <IconX size={14} />
              </button>
            )}
          </div>
          {!rows ? (
            <p className="flex items-center gap-2 p-2 text-xs text-muted-foreground"><IconLoader2 size={14} className="animate-spin" /> Cargando productos…</p>
          ) : shown.length === 0 ? (
            <p className="p-2 text-xs text-muted-foreground">
              {query ? "No hay productos con ese nombre." : "Escribe para buscar."} ¿Aún no tienes la bolsa como producto?{" "}
              <Link href="/dashboard/productos/nuevo" className="font-semibold text-primary underline-offset-2 hover:underline">Créala aquí</Link> con su precio (puede ser $0 si la regalas).
            </p>
          ) : (
            <div ref={listRef} role="listbox" aria-label="Productos" className="flex max-h-64 flex-col overflow-y-auto">
              {shown.map((r, i) => (
                <button
                  key={r.variantId}
                  type="button"
                  role="option"
                  aria-selected={i === active}
                  data-row={i}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(r)}
                  className={cn("flex items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm", i === active ? "bg-primary/10 text-foreground" : "hover:bg-muted")}
                >
                  <span className="truncate">{r.name}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">${r.price.toFixed(2)}</span>
                </button>
              ))}
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">↑ ↓ para moverte · Enter para elegir</p>
        </div>
      )}
    </div>
  );
}
