"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { API_URL } from "@/lib/constants";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { IconCheck, IconExternalLink, IconPhoto, IconReceipt, IconRefresh, IconSearch, IconX } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

/**
 * Clientes → Comprobantes de pago. What the Syncro Credit clients send from the app when they pay
 * an installment by pago móvil (or another method): the business sees the receipt, approves it
 * (the payment is applied to the client's installments and the app shows it as approved) or
 * rejects it. Keyboard: ↑/↓ moves through the list, Enter opens the receipt.
 */
type Status = "PENDING" | "APPROVED" | "REJECTED";
type Submission = {
  id: string;
  amount: number;
  referenceNumber: string | null;
  receiptUrl: string;
  status: Status;
  createdAt: string;
  updatedAt: string;
  client: { id: string; name: string; documentId: string | null; phone: string | null; currentDebt?: number };
};

const FILTERS: { id: Status; label: string }[] = [
  { id: "PENDING", label: "Por revisar" },
  { id: "APPROVED", label: "Aprobados" },
  { id: "REJECTED", label: "Rechazados" },
];
const STATUS_UI: Record<Status, { label: string; cls: string }> = {
  PENDING: { label: "Por revisar", cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
  APPROVED: { label: "Aprobado", cls: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  REJECTED: { label: "Rechazado", cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
};

const receiptSrc = (u: string) => (!u ? "" : u.startsWith("http") ? u : `${API_URL.replace(/\/api\/?$/, "")}${u}`);
const money = (n: number) => `$${(Number(n) || 0).toFixed(2)}`;
const when = (d: string) => new Date(d).toLocaleString("es-VE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default function ComprobantesPage() {
  const [items, setItems] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Status>("PENDING");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Submission | null>(null);
  const [confirm, setConfirm] = useState<"approve" | "reject" | null>(null);
  const [busy, setBusy] = useState(false);
  const [cursor, setCursor] = useState(0);
  const rows = useRef<(HTMLButtonElement | null)[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/clients/submissions`, { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });
      if (res.ok) setItems(await res.json());
      else toast.error("No se pudieron cargar los comprobantes");
    } catch {
      toast.error("Error de conexión");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // new receipts arrive while the page is open
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  const counts = useMemo(() => ({
    PENDING: items.filter((i) => i.status === "PENDING").length,
    APPROVED: items.filter((i) => i.status === "APPROVED").length,
    REJECTED: items.filter((i) => i.status === "REJECTED").length,
  }), [items]);

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return items.filter((i) => i.status === filter && (!term
      || i.client.name.toLowerCase().includes(term)
      || (i.client.documentId || "").toLowerCase().includes(term)
      || (i.referenceNumber || "").toLowerCase().includes(term)
      || String(i.amount).includes(term)));
  }, [items, filter, q]);

  useEffect(() => { setCursor(0); }, [filter, q]);

  const decide = async (action: "approve" | "reject") => {
    if (!open) return;
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/clients/submissions/${open.id}/${action}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      if (res.ok) {
        toast.success(action === "approve" ? `Pago de ${money(open.amount)} aprobado y aplicado a ${open.client.name}` : "Comprobante rechazado");
        setConfirm(null);
        setOpen(null);
        await load();
      } else {
        const e = await res.json().catch(() => ({}));
        toast.error(e.message || "No se pudo procesar");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setBusy(false);
    }
  };

  const onListKey = (e: React.KeyboardEvent) => {
    if (!list.length) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const n = Math.max(0, Math.min(list.length - 1, cursor + (e.key === "ArrowDown" ? 1 : -1)));
      setCursor(n);
      rows.current[n]?.focus();
    }
  };

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Comprobantes de pago</h1>
          <p className="text-sm text-muted-foreground">Lo que tus clientes envían desde Syncro Credit al pagar sus cuotas. Revisa el comprobante y apruébalo para aplicar el pago.</p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={load} disabled={loading}>
          <IconRefresh size={16} className={cn(loading && "animate-spin")} /> Actualizar
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <Button key={f.id} size="sm" variant={filter === f.id ? "default" : "outline"} onClick={() => setFilter(f.id)} className="gap-2">
            {f.label}
            <span className={cn("rounded-full px-1.5 text-[11px] font-bold", filter === f.id ? "bg-white/25" : "bg-muted")}>{counts[f.id]}</span>
          </Button>
        ))}
        <div className="relative ml-auto w-full sm:w-72">
          <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cliente, cédula, referencia o monto" className="pl-9" />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading && !items.length ? (
            <div className="p-10 text-center text-sm text-muted-foreground">Cargando…</div>
          ) : !list.length ? (
            <div className="flex flex-col items-center gap-2 p-12 text-center">
              <div className="grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground"><IconReceipt size={24} /></div>
              <p className="font-semibold">{filter === "PENDING" ? "No hay comprobantes por revisar" : "Nada por aquí"}</p>
              <p className="max-w-sm text-xs text-muted-foreground">Cuando un cliente pague una cuota desde la app y suba su comprobante, aparecerá aquí.</p>
            </div>
          ) : (
            <div role="listbox" aria-label="Comprobantes" onKeyDown={onListKey} className="divide-y">
              {list.map((s, i) => (
                <button
                  key={s.id}
                  ref={(el) => { rows.current[i] = el; }}
                  role="option"
                  aria-selected={i === cursor}
                  tabIndex={i === cursor ? 0 : -1}
                  onFocus={() => setCursor(i)}
                  onClick={() => setOpen(s)}
                  className="flex w-full items-center gap-4 px-4 py-3 text-left transition hover:bg-muted/50 focus-visible:bg-muted/60 focus-visible:outline-none"
                >
                  <div className="size-12 shrink-0 overflow-hidden rounded-lg border bg-muted">
                    {s.receiptUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={receiptSrc(s.receiptUrl)} alt="" className="size-full object-cover" loading="lazy" />
                    ) : (
                      <div className="grid size-full place-items-center text-muted-foreground"><IconPhoto size={18} /></div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{s.client.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {s.client.documentId || "Sin cédula"} · Ref. {s.referenceNumber || "no indicada"} · {when(s.createdAt)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-bold tabular-nums">{money(s.amount)}</p>
                    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", STATUS_UI[s.status].cls)}>{STATUS_UI[s.status].label}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* The receipt, big, with the decision */}
      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="sm:max-w-3xl">
          {open && (
            <>
              <DialogHeader>
                <DialogTitle>Comprobante de {open.client.name}</DialogTitle>
                <DialogDescription>Enviado desde Syncro Credit el {when(open.createdAt)}</DialogDescription>
              </DialogHeader>
              <div className="grid gap-5 md:grid-cols-[1fr_260px]">
                <div className="relative flex min-h-64 items-center justify-center overflow-hidden rounded-xl border bg-muted/40">
                  {open.receiptUrl ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={receiptSrc(open.receiptUrl)} alt="Comprobante de pago" className="max-h-[60vh] w-full object-contain" />
                      <a href={receiptSrc(open.receiptUrl)} target="_blank" rel="noreferrer" className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md bg-black/60 px-2 py-1 text-xs font-semibold text-white hover:bg-black/80">
                        <IconExternalLink size={13} /> Abrir
                      </a>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">El cliente no adjuntó imagen</p>
                  )}
                </div>
                <div className="flex flex-col gap-3">
                  <div className="rounded-xl border p-4">
                    <p className="text-xs text-muted-foreground">Monto reportado</p>
                    <p className="text-3xl font-bold tabular-nums">{money(open.amount)}</p>
                    <span className={cn("mt-2 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold", STATUS_UI[open.status].cls)}>{STATUS_UI[open.status].label}</span>
                  </div>
                  <dl className="space-y-2 rounded-xl border p-4 text-sm">
                    <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Referencia</dt><dd className="font-mono font-semibold">{open.referenceNumber || "No indicada"}</dd></div>
                    <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Cédula</dt><dd className="font-semibold">{open.client.documentId || "—"}</dd></div>
                    <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Teléfono</dt><dd className="font-semibold">{open.client.phone || "—"}</dd></div>
                    {typeof open.client.currentDebt === "number" && (
                      <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Deuda actual</dt><dd className="font-semibold tabular-nums">{money(open.client.currentDebt)}</dd></div>
                    )}
                  </dl>
                  {open.status === "PENDING" ? (
                    <div className="mt-auto flex flex-col gap-2">
                      <Button className="gap-2 bg-green-600 hover:bg-green-700" onClick={() => setConfirm("approve")} autoFocus>
                        <IconCheck size={16} /> Aprobar pago
                      </Button>
                      <Button variant="outline" className="gap-2 text-red-600 hover:text-red-700" onClick={() => setConfirm("reject")}>
                        <IconX size={16} /> Rechazar
                      </Button>
                      <p className="text-[11px] text-muted-foreground">Verifica en tu banco que el pago llegó antes de aprobarlo.</p>
                    </div>
                  ) : (
                    <p className="mt-auto text-xs text-muted-foreground">
                      {open.status === "APPROVED" ? "Aprobado" : "Rechazado"} el {when(open.updatedAt)}.
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm === "approve" ? "¿Aprobar este pago?" : "¿Rechazar este comprobante?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === "approve"
                ? `Se registra el abono de ${money(open?.amount || 0)} a ${open?.client.name}: se descuenta de sus cuotas y en su app aparecerá como aprobado.`
                : `${open?.client.name} verá en su app que el comprobante fue rechazado y podrá enviar otro.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => { e.preventDefault(); if (confirm) decide(confirm); }}
              className={confirm === "reject" ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"}
            >
              {busy ? "Procesando…" : confirm === "approve" ? "Sí, aprobar" : "Sí, rechazar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
