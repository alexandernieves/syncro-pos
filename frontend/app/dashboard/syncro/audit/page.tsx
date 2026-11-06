"use client";

import { useCallback, useEffect, useState } from "react";
import { IconChevronLeft, IconChevronRight, IconLoader2, IconSearch, IconX } from "@tabler/icons-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useRequireSyncroAdmin } from "@/hooks/use-require-syncro-admin";
import { type AdminBusiness, type AuditEntry, ROLE_LABEL, actionLabel, adminApi, dateTime } from "@/lib/syncro-admin";

type Page = { total: number; page: number; pageSize: number; items: AuditEntry[]; actions: { action: string; count: number }[] };

const empty = { search: "", businessId: "", action: "", from: "", to: "" };

/** The details are stored as JSON text; show them as label: value pairs. */
function Details({ raw }: { raw: string | null }) {
  if (!raw) return <p className="text-sm text-muted-foreground">Sin detalles.</p>;
  let parsed: unknown = raw;
  try { parsed = JSON.parse(raw); } catch { /* plain text */ }
  if (!parsed || typeof parsed !== "object") return <p className="whitespace-pre-wrap break-words text-sm">{String(parsed)}</p>;
  return (
    <dl className="divide-y rounded-xl border text-sm">
      {Object.entries(parsed as Record<string, unknown>).map(([k, v]) => (
        <div key={k} className="grid grid-cols-[8rem_1fr] gap-3 px-3 py-2">
          <dt className="truncate text-muted-foreground">{k}</dt>
          <dd className="min-w-0 whitespace-pre-wrap break-words">{typeof v === "object" ? JSON.stringify(v, null, 2) : String(v)}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function GlobalAuditPage() {
  useRequireSyncroAdmin();
  const [filters, setFilters] = useState(empty);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page | null>(null);
  const [loading, setLoading] = useState(true);
  const [businesses, setBusinesses] = useState<AdminBusiness[]>([]);
  const [open, setOpen] = useState<AuditEntry | null>(null);

  useEffect(() => {
    adminApi<AdminBusiness[]>("/businesses").then(setBusinesses).catch(() => {});
  }, []);

  // Typing waits a moment before searching
  useEffect(() => {
    const t = setTimeout(() => { setFilters((f) => (f.search === search ? f : { ...f, search })); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: "25" });
    Object.entries(filters).forEach(([k, v]) => v && params.set(k, v));
    adminApi<Page>(`/audit?${params}`)
      .then(setData)
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [filters, page]);
  useEffect(() => { load(); }, [load]);

  const set = (k: keyof typeof empty, v: string) => { setFilters((f) => ({ ...f, [k]: v })); setPage(1); };
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const filtered = Object.values(filters).some(Boolean);

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Auditoría global</h1>
        <p className="text-sm text-muted-foreground">Todo lo que pasa en Syncro: inicios de sesión, cambios en productos, acciones del equipo de Syncro y más, de todos los negocios.</p>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="relative min-w-56 flex-1">
          <IconSearch size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar persona, correo, negocio o detalle…" className="pl-9" />
        </label>
        <select value={filters.businessId} onChange={(e) => set("businessId", e.target.value)} className="h-9 max-w-56 rounded-md border bg-background px-2 text-sm" aria-label="Negocio">
          <option value="">Todos los negocios</option>
          {businesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select value={filters.action} onChange={(e) => set("action", e.target.value)} className="h-9 max-w-64 rounded-md border bg-background px-2 text-sm" aria-label="Acción">
          <option value="">Todas las acciones</option>
          {(data?.actions ?? []).map((a) => <option key={a.action} value={a.action}>{actionLabel(a.action)} ({a.count})</option>)}
        </select>
        <div className="flex items-center gap-1.5">
          <Input type="date" value={filters.from} onChange={(e) => set("from", e.target.value)} className="w-40" aria-label="Desde" />
          <span className="text-sm text-muted-foreground">a</span>
          <Input type="date" value={filters.to} onChange={(e) => set("to", e.target.value)} className="w-40" aria-label="Hasta" />
        </div>
        {filtered && (
          <Button variant="ghost" onClick={() => { setFilters(empty); setSearch(""); setPage(1); }}><IconX size={16} /> Limpiar</Button>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Fecha</th>
                <th className="px-4 py-2.5 font-medium">Acción</th>
                <th className="px-4 py-2.5 font-medium">Persona</th>
                <th className="px-4 py-2.5 font-medium">Negocio</th>
                <th className="px-4 py-2.5 font-medium">IP</th>
              </tr>
            </thead>
            <tbody className={cn("divide-y", loading && data && "opacity-60")}>
              {!data && loading && (
                <tr><td colSpan={5} className="py-16 text-center text-muted-foreground"><IconLoader2 className="mx-auto animate-spin" /></td></tr>
              )}
              {data && !data.items.length && (
                <tr><td colSpan={5} className="py-16 text-center text-muted-foreground">{filtered ? "Nada coincide con estos filtros." : "Todavía no hay actividad registrada."}</td></tr>
              )}
              {data?.items.map((a) => (
                <tr
                  key={a.id}
                  tabIndex={0}
                  onClick={() => setOpen(a)}
                  onKeyDown={(e) => { if (e.key === "Enter") setOpen(a); }}
                  className="cursor-pointer outline-none transition-colors hover:bg-muted/40 focus-visible:bg-muted/60"
                >
                  <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-muted-foreground">{dateTime(a.createdAt)}</td>
                  <td className="px-4 py-2.5">
                    <span className={cn(a.action === "LOGIN_FAILED" && "font-medium text-rose-700", a.action.startsWith("SYNCRO_") && "font-medium text-primary")}>{actionLabel(a.action)}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <p className="truncate">{a.user?.name || a.user?.email || "Desconocido"}</p>
                    {a.user?.role && <p className="text-xs text-muted-foreground">{ROLE_LABEL[a.user.role] ?? a.user.role}</p>}
                  </td>
                  <td className="px-4 py-2.5">{a.business?.name ?? <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{a.ipAddress ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between gap-2 border-t px-4 py-2.5 text-sm">
          <span className="text-muted-foreground">{data ? `${data.total.toLocaleString("es-VE")} registro(s)` : ""}</span>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Página {page} de {pages}</span>
            <Button size="icon" variant="outline" className="size-8" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)} aria-label="Página anterior"><IconChevronLeft size={16} /></Button>
            <Button size="icon" variant="outline" className="size-8" disabled={page >= pages || loading} onClick={() => setPage((p) => p + 1)} aria-label="Página siguiente"><IconChevronRight size={16} /></Button>
          </div>
        </div>
      </div>

      <Sheet open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-lg">
          {open && (
            <>
              <SheetHeader className="border-b">
                <SheetTitle>{actionLabel(open.action)}</SheetTitle>
                <SheetDescription>{dateTime(open.createdAt)}</SheetDescription>
              </SheetHeader>
              <div className="space-y-4 p-4 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-muted/50 px-3 py-2.5"><p className="text-xs text-muted-foreground">Persona</p><p className="font-medium">{open.user?.name || "—"}</p><p className="truncate text-xs text-muted-foreground">{open.user?.email}</p></div>
                  <div className="rounded-xl bg-muted/50 px-3 py-2.5"><p className="text-xs text-muted-foreground">Negocio</p><p className="font-medium">{open.business?.name ?? "—"}</p></div>
                  <div className="rounded-xl bg-muted/50 px-3 py-2.5"><p className="text-xs text-muted-foreground">Sobre</p><p className="font-medium">{open.entity}</p>{open.entityId && <p className="truncate font-mono text-xs text-muted-foreground">{open.entityId}</p>}</div>
                  <div className="rounded-xl bg-muted/50 px-3 py-2.5"><p className="text-xs text-muted-foreground">Dirección IP</p><p className="font-mono">{open.ipAddress ?? "—"}</p></div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2"><p className="font-medium">Detalles</p><Badge variant="outline" className="font-mono text-[10px]">{open.action}</Badge></div>
                  <Details raw={open.details} />
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
