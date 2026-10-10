"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  IconChevronLeft, IconChevronRight, IconCircleCheckFilled, IconSearch, IconUser, IconUserPlus, IconWifiOff, IconX,
} from "@tabler/icons-react";
import { API_URL } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export type DirectoryClient = {
  id: string;
  name: string;
  documentId?: string | null;
  phone?: string | null;
  email?: string | null;
  walletBalance?: number;
  creditLimit?: number;
  currentDebt?: number;
  creditScore?: number;
  downPaymentPercentage?: number;
  hasAccount?: boolean;
  isSuspended?: boolean;
  purchasesCount?: number;
  lastPurchaseAt?: string | null;
  totalSpent?: number;
};

const FILTERS: [string, string][] = [
  ["", "Todos"],
  ["recent", "Compraron en 30 días"],
  ["inactive", "Sin compras en 30 días"],
  ["debt", "Con deuda"],
  ["credit", "Con crédito"],
  ["wallet", "Con saldo a favor"],
  ["account", "Con cuenta Syncro"],
];
const SORTS: [string, string][] = [["name", "Nombre (A-Z)"], ["newest", "Más recientes"], ["debt", "Mayor deuda"]];
const PAGE_SIZE = 20;

type ClientPickerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedClientId: string;
  /** null = consumidor final */
  onSelect: (client: DirectoryClient | null) => void;
  onCreateNew: () => void;
  /** Clients already in the device, used when there is no connection. */
  offlineClients: DirectoryClient[];
};

const fold = (v: string) => v.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Client search for the POS: server-side search, filters and pagination for thousands of clients. */
export function ClientPicker({ open, onOpenChange, selectedClientId, onSelect, onCreateNew, offlineClients }: ClientPickerProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState("name");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: DirectoryClient[]; total: number; totalPages: number }>({ items: [], total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(false);
  const [offline, setOffline] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestId = useRef(0);

  const load = useCallback(async (q: string, f: string, s: string, p: number) => {
    const id = ++requestId.current;
    setLoading(true);
    try {
      if (!navigator.onLine) throw new Error("offline");
      const params = new URLSearchParams({ q, filter: f, sort: s, page: String(p), pageSize: String(PAGE_SIZE) });
      const res = await fetch(`${API_URL}/clients/directory?${params}`, { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });
      if (!res.ok) throw new Error("request");
      const json = await res.json();
      if (id !== requestId.current) return; // a newer search already started
      setOffline(false);
      setData({ items: json.items, total: json.total, totalPages: json.totalPages });
    } catch {
      if (id !== requestId.current) return;
      // Without connection: search the clients saved on this device
      setOffline(true);
      const terms = fold(q).split(/\s+/).filter(Boolean);
      const matches = offlineClients.filter((c) => {
        const haystack = fold(`${c.name} ${c.documentId ?? ""} ${c.phone ?? ""} ${c.email ?? ""}`);
        return terms.every((t) => haystack.includes(t));
      });
      const totalPages = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
      setData({ items: matches.slice((p - 1) * PAGE_SIZE, p * PAGE_SIZE), total: matches.length, totalPages });
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [offlineClients]);

  // Debounced search while typing; immediate for filters, sort and page
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => load(query, filter, sort, page), query ? 250 : 0);
    return () => clearTimeout(timer);
  }, [open, query, filter, sort, page, load]);

  useEffect(() => {
    if (open) {
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
      setPage(1);
    }
  }, [open]);

  const choose = (client: DirectoryClient | null) => {
    onSelect(client);
    onOpenChange(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, data.items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && data.items[active]) {
      e.preventDefault();
      choose(data.items[active]);
    }
  };

  const from = data.total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, data.total);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden rounded-3xl border border-[#D8D4CB] bg-[#FAF7F2] p-0 sm:max-w-4xl [&>button]:hidden">
        <div className="flex items-start justify-between gap-4 px-6 pt-5">
          <DialogHeader className="space-y-0.5 text-left">
            <DialogTitle className="text-base font-bold text-[#16140F]">Seleccionar cliente</DialogTitle>
            <DialogDescription className="text-xs text-[#6B665C]">Busca por nombre, cédula o RIF, teléfono o correo. No hace falta escribir tildes.</DialogDescription>
          </DialogHeader>
          <Button variant="ghost" size="icon" className="-mr-2 size-8 rounded-full text-[#6B665C] hover:bg-black/5" onClick={() => onOpenChange(false)} aria-label="Cerrar">
            <IconX size={16} />
          </Button>
        </div>

        {/* Search + actions */}
        <div className="flex flex-col gap-3 px-6 pt-4 sm:flex-row">
          <div className="relative flex-1">
            <IconSearch size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9A9488]" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => { setQuery(e.target.value); setPage(1); setActive(0); }}
              onKeyDown={onKeyDown}
              placeholder="Ej: maria rodriguez, V-12345678 o 0414 555 1234"
              className="h-11 w-full rounded-xl border border-[#DAD5CC] bg-white pl-10 pr-9 text-sm text-[#16140F] outline-none placeholder:text-[#9A9488] focus:border-primary/60 focus:ring-2 focus:ring-primary/15"
              aria-label="Buscar cliente"
            />
            {query && (
              <button type="button" onClick={() => { setQuery(""); inputRef.current?.focus(); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-[#9A9488] hover:bg-black/5" aria-label="Limpiar búsqueda">
                <IconX size={14} />
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="h-11 gap-2 rounded-xl border-[#DAD5CC] bg-white text-xs font-semibold" onClick={() => choose(null)}>
              <IconUser size={16} /> Consumidor final
            </Button>
            <Button className="h-11 gap-2 rounded-xl text-xs font-semibold" onClick={() => { onOpenChange(false); onCreateNew(); }}>
              <IconUserPlus size={16} /> Nuevo cliente
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 px-6 pt-3">
          {FILTERS.map(([value, label]) => (
            <button
              key={value || "all"}
              type="button"
              disabled={offline && value !== ""}
              onClick={() => { setFilter(value); setPage(1); setActive(0); }}
              className={cn(
                "h-7 rounded-full border px-3 text-xs font-medium transition-colors disabled:opacity-40",
                filter === value ? "border-primary/40 bg-primary/10 text-primary" : "border-[#DAD5CC] bg-white text-[#6B665C] hover:text-[#16140F]",
              )}
            >
              {label}
            </button>
          ))}
          <select
            value={sort}
            onChange={(e) => { setSort(e.target.value); setPage(1); }}
            disabled={offline}
            className="ml-auto h-7 rounded-full border border-[#DAD5CC] bg-white px-3 text-xs text-[#16140F] outline-none"
            aria-label="Ordenar"
          >
            {SORTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>

        {offline && (
          <p className="mx-6 mt-3 flex items-center gap-2 rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-800">
            <IconWifiOff size={14} /> Sin conexión: buscando en los clientes guardados en este equipo.
          </p>
        )}

        {/* Table */}
        <div className="mx-6 mt-4 min-h-0 flex-1 overflow-auto rounded-2xl border border-[#E2DED5] bg-white">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-[#F4F2EC] text-left text-xs text-[#6B665C]">
              <tr>
                <th className="px-4 py-2.5 font-medium">Cliente</th>
                <th className="px-4 py-2.5 font-medium">Cédula / RIF</th>
                <th className="hidden px-4 py-2.5 font-medium md:table-cell">Teléfono</th>
                <th className="px-4 py-2.5 text-right font-medium">Compras</th>
                <th className="hidden px-4 py-2.5 font-medium sm:table-cell">Última compra</th>
                <th className="px-4 py-2.5 text-right font-medium">Deuda</th>
              </tr>
            </thead>
            <tbody>
              {loading && data.items.length === 0 && Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-t border-[#F0EDE6]"><td colSpan={6} className="px-4 py-3"><div className="h-4 w-full animate-pulse rounded bg-[#F0EDE6]" /></td></tr>
              ))}
              {!loading && data.items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <p className="font-medium text-[#16140F]">No encontramos clientes{query ? ` para “${query}”` : ""}</p>
                    <p className="mt-1 text-xs text-[#6B665C]">Prueba con otra parte del nombre, la cédula o el teléfono, o regístralo como cliente nuevo.</p>
                  </td>
                </tr>
              )}
              {data.items.map((client, i) => {
                const selected = client.id === selectedClientId;
                return (
                  <tr
                    key={client.id}
                    onClick={() => choose(client)}
                    onMouseEnter={() => setActive(i)}
                    className={cn("cursor-pointer border-t border-[#F0EDE6] transition-colors", i === active ? "bg-primary/[0.06]" : "hover:bg-[#FAF7F2]", loading && "opacity-60")}
                    aria-selected={selected}
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#F0EDE6] text-xs font-semibold text-[#6B665C]">
                          {client.name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <p className="flex items-center gap-1.5 truncate font-medium text-[#16140F]">
                            {client.name}
                            {selected && <IconCircleCheckFilled size={14} className="shrink-0 text-emerald-500" />}
                          </p>
                          {client.email && <p className="truncate text-[11px] text-[#9A9488]">{client.email}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-[#3D3A33]">{client.documentId || <span className="font-sans text-[#B5AFA3]">Sin documento</span>}</td>
                    <td className="hidden px-4 py-2.5 text-xs text-[#3D3A33] md:table-cell">{client.phone || "—"}</td>
                    <td className="px-4 py-2.5 text-right text-xs tabular-nums">
                      <span className="font-medium text-[#16140F]">{client.purchasesCount ?? 0}</span>
                      {(client.totalSpent ?? 0) > 0 && <span className="block text-[11px] text-[#9A9488]">${(client.totalSpent ?? 0).toFixed(2)}</span>}
                    </td>
                    <td className="hidden px-4 py-2.5 text-xs text-[#6B665C] sm:table-cell">
                      {client.lastPurchaseAt ? format(new Date(client.lastPurchaseAt), "d MMM yyyy", { locale: es }) : "Nunca"}
                    </td>
                    <td className={cn("px-4 py-2.5 text-right text-xs font-semibold tabular-nums", (client.currentDebt ?? 0) > 0 ? "text-rose-600" : "text-[#B5AFA3]")}>
                      {(client.currentDebt ?? 0) > 0 ? `$${(client.currentDebt ?? 0).toFixed(2)}` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 text-xs text-[#6B665C]">
          <span>{data.total === 0 ? "0 clientes" : `${from}–${to} de ${data.total.toLocaleString("es-VE")} clientes`}</span>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline">Usa ↑ ↓ y Enter para elegir</span>
            <Button variant="outline" size="icon" className="size-8 rounded-lg border-[#DAD5CC] bg-white" disabled={page <= 1 || loading} onClick={() => { setPage((p) => p - 1); setActive(0); }} aria-label="Página anterior">
              <IconChevronLeft size={15} />
            </Button>
            <span className="tabular-nums">Página {page} de {data.totalPages}</span>
            <Button variant="outline" size="icon" className="size-8 rounded-lg border-[#DAD5CC] bg-white" disabled={page >= data.totalPages || loading} onClick={() => { setPage((p) => p + 1); setActive(0); }} aria-label="Página siguiente">
              <IconChevronRight size={15} />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
