"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { IconCash, IconCheck, IconPencil, IconPlus, IconRefresh, IconTrash, IconX } from "@tabler/icons-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { useMyModules } from "@/lib/modules";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/**
 * Préstamos (module "loans"). The lender publishes offers that show up in the Syncro Credit app,
 * answers the requests (approve → the client gets a PIN; the cash is handed over at the POS with
 * it) and follows its portfolio.
 */
type Offer = { id: string; name: string; minAmount: number; maxAmount: number; interestPct: number; installments: number; frequencyDays: number; minLevel: number; active: boolean; requests: number };
type Loan = {
  id: string; status: string; amount: number; totalToPay: number; remainingBalance: number; installmentsCount: number; frequencyDays: number | null;
  createdAt: string; decidedAt: string | null; disbursedAt: string | null; offerName: string | null; level: number; lateAmount: number;
  available: number; fitsLimit: boolean; rejectReason: string | null;
  client: { id: string; name: string; documentId: string | null; phone: string | null; creditLimit: number; currentDebt: number };
  installments: { id: string; installmentNumber: number; dueDate: string; amount: number; paidAmount: number; status: string }[];
};
type Portfolio = { lent: number; toCollect: number; collected: number; interestEarned: number; late: number; activeLoans: number; pendingRequests: number };

const LEVELS: Record<number, string> = { 4: "Chispa", 3: "Cometa", 2: "Órbita", 1: "Galaxia" };
const FREQ: Record<number, string> = { 7: "semanales", 15: "quincenales", 30: "mensuales" };
const money = (n: number) => `$${(Number(n) || 0).toFixed(2)}`;
const day = (d: string) => new Date(d).toLocaleDateString("es-VE", { day: "numeric", month: "short" });
const freqText = (d: number) => FREQ[d] ?? `cada ${d} días`;
const json = (body: unknown): RequestInit => ({ method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });
async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(path, init);
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(Array.isArray(body?.message) ? body.message.join(", ") : body?.message || "No se pudo completar");
  return body as T;
}

type Tab = "requests" | "active" | "offers" | "closed";
const EMPTY_OFFER = { name: "", minAmount: "20", maxAmount: "50", interestPct: "10", installments: "2", frequencyDays: "7", minLevel: "4" };

export default function PrestamosPage() {
  const mods = useMyModules();
  const enabled = !!mods?.find((m) => m.code === "loans")?.usable;
  const [tab, setTab] = useState<Tab>("requests");
  const [loans, setLoans] = useState<Loan[] | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [pf, setPf] = useState<Portfolio | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [draft, setDraft] = useState<(typeof EMPTY_OFFER & { id?: string }) | null>(null);
  const [rejecting, setRejecting] = useState<Loan | null>(null);
  const [reason, setReason] = useState("");
  const [open, setOpen] = useState<Loan | null>(null);

  const load = useCallback(async () => {
    try {
      const status = tab === "offers" ? null : tab === "requests" ? "requests" : tab === "active" ? "active" : "closed";
      const [o, p, l, approved] = await Promise.all([
        call<Offer[]>("/lending/offers"),
        call<Portfolio>("/lending/portfolio"),
        status ? call<Loan[]>(`/lending/loans?status=${status}`) : Promise.resolve([] as Loan[]),
        tab === "requests" ? call<Loan[]>("/lending/loans?status=approved") : Promise.resolve([] as Loan[]),
      ]);
      setOffers(o);
      setPf(p);
      setLoans([...approved, ...l]);
    } catch (e: any) {
      toast.error(e.message);
      setLoans([]);
    }
  }, [tab]);
  useEffect(() => { if (enabled) load(); }, [enabled, load]);
  useEffect(() => {
    if (!enabled || tab !== "requests") return;
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [enabled, tab, load]);

  const approve = async (l: Loan) => {
    setBusy(l.id);
    try {
      await call(`/lending/loans/${l.id}/approve`, { method: "POST" });
      toast.success(`Aprobado. ${l.client.name} ya tiene su PIN para retirar ${money(l.amount)} en caja.`);
      load();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(null); }
  };
  const reject = async () => {
    if (!rejecting) return;
    setBusy(rejecting.id);
    try {
      await call(`/lending/loans/${rejecting.id}/reject`, json({ reason }));
      toast.success("Solicitud rechazada");
      setRejecting(null);
      setReason("");
      load();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(null); }
  };

  const saveOffer = async () => {
    if (!draft) return;
    const body = Object.fromEntries(Object.entries(draft).map(([k, v]) => [k, k === "name" || k === "id" ? v : Number(v)]));
    try {
      if (draft.id) await call(`/lending/offers/${draft.id}`, { ...json(body), method: "PUT" });
      else await call("/lending/offers", json(body));
      toast.success(draft.id ? "Oferta actualizada" : "Oferta publicada en Syncro Credit");
      setDraft(null);
      load();
    } catch (e: any) { toast.error(e.message); }
  };
  const toggleOffer = async (o: Offer, active: boolean) => {
    setOffers((l) => l.map((x) => (x.id === o.id ? { ...x, active } : x)));
    try { await call(`/lending/offers/${o.id}`, { ...json({ onlyActive: active }), method: "PUT" }); } catch (e: any) { toast.error(e.message); load(); }
  };
  const removeOffer = async (o: Offer) => {
    try {
      const r = await call<{ paused: boolean }>(`/lending/offers/${o.id}`, { method: "DELETE" });
      toast.success(r.paused ? "Tenía préstamos: quedó pausada" : "Oferta eliminada");
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  const preview = useMemo(() => {
    if (!draft) return null;
    const a = Number(draft.minAmount) || 0, b = Number(draft.maxAmount) || 0, i = Number(draft.interestPct) || 0, n = Math.max(1, Number(draft.installments) || 1);
    const tot = (x: number) => x * (1 + i / 100);
    return { a, b, ta: tot(a), tb: tot(b), ea: tot(a) / n, eb: tot(b) / n, n, f: Number(draft.frequencyDays) || 7 };
  }, [draft]);

  if (mods && !enabled) {
    return (
      <div className="flex flex-col items-center gap-3 p-16 text-center">
        <IconCash size={40} className="text-muted-foreground" />
        <h1 className="text-xl font-bold">Préstamos no está activo</h1>
        <p className="max-w-md text-sm text-muted-foreground">Este módulo permite publicar ofertas de préstamo en Syncro Credit y entregar el efectivo en caja con PIN. Pídelo en la Tienda de módulos.</p>
      </div>
    );
  }

  const statusChip = (l: Loan) => {
    const map: Record<string, [string, string]> = {
      REQUESTED: ["Por responder", "bg-amber-100 text-amber-800"],
      APPROVED_PENDING_DISBURSEMENT: ["Aprobado · espera retirar", "bg-blue-100 text-blue-800"],
      PENDING: [l.lateAmount > 0 ? "Con atraso" : "Al día", l.lateAmount > 0 ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"],
      PAID: ["Pagado", "bg-green-100 text-green-700"],
      REJECTED: ["Rechazado", "bg-muted text-muted-foreground"],
      CANCELLED: ["Cancelado por el cliente", "bg-muted text-muted-foreground"],
    };
    const [t, c] = map[l.status] ?? [l.status, "bg-muted"];
    return <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", c)}>{t}</span>;
  };

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Préstamos</h1>
          <p className="text-sm text-muted-foreground">Tus ofertas se ven en Syncro Credit. Apruebas la solicitud, el cliente recibe un PIN y retira el efectivo en caja.</p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={load}><IconRefresh size={16} /> Actualizar</Button>
      </div>

      {pf && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {[
            { k: "Prestado", v: money(pf.lent) },
            { k: "Por cobrar", v: money(pf.toCollect) },
            { k: "Cobrado", v: money(pf.collected) },
            { k: "Intereses ganados", v: money(pf.interestEarned), c: "text-green-700" },
            { k: "Vencido", v: money(pf.late), c: pf.late > 0 ? "text-red-600" : "" },
          ].map((x) => (
            <Card key={x.k}><CardContent className="p-4"><p className="text-xs text-muted-foreground">{x.k}</p><p className={cn("text-xl font-bold tabular-nums", x.c)}>{x.v}</p></CardContent></Card>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {([["requests", `Solicitudes${pf?.pendingRequests ? ` · ${pf.pendingRequests}` : ""}`], ["active", "Préstamos activos"], ["offers", "Mis ofertas"], ["closed", "Cerrados"]] as [Tab, string][]).map(([k, t]) => (
          <Button key={k} size="sm" variant={tab === k ? "default" : "outline"} onClick={() => { setLoans(null); setTab(k); }}>{t}</Button>
        ))}
      </div>

      {tab === "offers" ? (
        <div className="flex flex-col gap-3">
          <div className="flex justify-end"><Button className="gap-2" onClick={() => setDraft({ ...EMPTY_OFFER })}><IconPlus size={16} /> Nueva oferta</Button></div>
          {!offers.length ? (
            <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">Aún no tienes ofertas. Crea una para aparecer en “Pedir préstamo” de Syncro Credit.</CardContent></Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {offers.map((o) => (
                <Card key={o.id} className={cn(!o.active && "opacity-60")}>
                  <CardContent className="flex flex-col gap-2 p-4">
                    <div className="flex items-center justify-between"><p className="font-semibold">{o.name}</p><Switch checked={o.active} onCheckedChange={(v) => toggleOffer(o, v)} aria-label="Publicada" /></div>
                    <p className="text-2xl font-bold tabular-nums">{money(o.minAmount).replace(".00", "")} – {money(o.maxAmount).replace(".00", "")}</p>
                    <p className="text-sm text-muted-foreground">{o.interestPct}% · {o.installments} cuota{o.installments > 1 ? "s" : ""} {freqText(o.frequencyDays)}</p>
                    <p className="text-xs text-muted-foreground">{o.minLevel === 4 ? "Para todos los niveles" : `Desde nivel ${o.minLevel} · ${LEVELS[o.minLevel]}`} · {o.requests} solicitud{o.requests === 1 ? "" : "es"}</p>
                    <div className="mt-1 flex gap-1">
                      <Button size="sm" variant="ghost" className="gap-1" onClick={() => setDraft({ id: o.id, name: o.name, minAmount: String(o.minAmount), maxAmount: String(o.maxAmount), interestPct: String(o.interestPct), installments: String(o.installments), frequencyDays: String(o.frequencyDays), minLevel: String(o.minLevel) })}><IconPencil size={15} /> Editar</Button>
                      <Button size="sm" variant="ghost" className="gap-1 text-destructive" onClick={() => removeOffer(o)}><IconTrash size={15} /> Eliminar</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            {loans === null ? (
              <p className="p-10 text-center text-sm text-muted-foreground">Cargando…</p>
            ) : !loans.length ? (
              <p className="p-10 text-center text-sm text-muted-foreground">{tab === "requests" ? "No hay solicitudes por responder." : "Nada por aquí."}</p>
            ) : (
              <div className="divide-y">
                {loans.map((l) => (
                  <div key={l.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <button onClick={() => setOpen(l)} className="min-w-0 flex-1 text-left">
                      <p className="font-semibold">{l.client.name} <span className="font-normal text-muted-foreground">· {l.client.documentId}</span></p>
                      <p className="text-xs text-muted-foreground">
                        Nivel {l.level} · {LEVELS[l.level]} · {l.offerName ?? "Préstamo"} · {day(l.createdAt)}
                        {l.status === "REQUESTED" && ` · límite disponible ${money(l.available)}`}
                      </p>
                    </button>
                    <div className="text-right">
                      <p className="font-bold tabular-nums">{money(l.amount)}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">devuelve {money(l.totalToPay)}{l.status === "PENDING" ? ` · resta ${money(l.remainingBalance)}` : ""}</p>
                    </div>
                    <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
                      {statusChip(l)}
                      {l.status === "REQUESTED" && (
                        <>
                          <Button size="sm" variant="outline" className="gap-1 text-destructive" disabled={busy === l.id} onClick={() => setRejecting(l)}><IconX size={15} /> Rechazar</Button>
                          <Button size="sm" className="gap-1 bg-green-600 hover:bg-green-700" disabled={busy === l.id || !l.fitsLimit} title={!l.fitsLimit ? "Pasa su límite: súbelo en Clientes" : undefined} onClick={() => approve(l)}><IconCheck size={15} /> Aprobar</Button>
                        </>
                      )}
                      {l.status === "APPROVED_PENDING_DISBURSEMENT" && (
                        <Button size="sm" variant="outline" className="text-destructive" disabled={busy === l.id} onClick={() => setRejecting(l)}>Anular</Button>
                      )}
                    </div>
                    {l.status === "REQUESTED" && !l.fitsLimit && (
                      <p className="w-full text-right text-xs text-amber-700">El préstamo suma {money(l.totalToPay)} y su límite disponible es {money(l.available)}: súbele el límite en Clientes para aprobarlo.</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Offer editor */}
      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="sm:max-w-lg">
          {draft && preview && (
            <>
              <DialogHeader>
                <DialogTitle>{draft.id ? "Editar oferta" : "Nueva oferta"}</DialogTitle>
                <DialogDescription>Así la verán los clientes en “Pedir préstamo”. El interés es por todo el préstamo.</DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1.5"><Label>Nombre</Label><Input maxLength={40} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Ej. Express" /></div>
                <div className="space-y-1.5"><Label>Monto mínimo ($)</Label><Input type="number" min={1} value={draft.minAmount} onChange={(e) => setDraft({ ...draft, minAmount: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Monto máximo ($)</Label><Input type="number" min={1} value={draft.maxAmount} onChange={(e) => setDraft({ ...draft, maxAmount: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Interés (%)</Label><Input type="number" min={0} value={draft.interestPct} onChange={(e) => setDraft({ ...draft, interestPct: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Cuotas</Label><Input type="number" min={1} max={52} value={draft.installments} onChange={(e) => setDraft({ ...draft, installments: e.target.value })} /></div>
                <div className="space-y-1.5">
                  <Label>Cada cuánto</Label>
                  <div className="flex gap-1">
                    {[7, 15, 30].map((d) => <Button key={d} type="button" size="sm" variant={Number(draft.frequencyDays) === d ? "default" : "outline"} onClick={() => setDraft({ ...draft, frequencyDays: String(d) })}>{d} d</Button>)}
                    <Input type="number" min={1} max={90} className="w-16" value={draft.frequencyDays} onChange={(e) => setDraft({ ...draft, frequencyDays: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Nivel mínimo</Label>
                  <div className="flex flex-wrap gap-1">
                    {[4, 3, 2, 1].map((n) => <Button key={n} type="button" size="sm" variant={Number(draft.minLevel) === n ? "default" : "outline"} onClick={() => setDraft({ ...draft, minLevel: String(n) })}>{LEVELS[n]}</Button>)}
                  </div>
                </div>
              </div>
              <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                Ejemplo: quien pide {money(preview.a)} devuelve {money(preview.ta)} en {preview.n} cuota{preview.n > 1 ? "s" : ""} de {money(preview.ea)}; quien pide {money(preview.b)} devuelve {money(preview.tb)} ({money(preview.eb)} cada {preview.f} días).
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDraft(null)}>Cancelar</Button>
                <Button onClick={saveOffer}>{draft.id ? "Guardar" : "Publicar oferta"}</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Loan detail */}
      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="sm:max-w-lg">
          {open && (
            <>
              <DialogHeader>
                <DialogTitle>{open.client.name}</DialogTitle>
                <DialogDescription>{open.client.documentId}{open.client.phone ? ` · ${open.client.phone}` : ""} · Nivel {open.level} {LEVELS[open.level]}</DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="rounded-lg border p-2"><p className="text-xs text-muted-foreground">Prestado</p><p className="font-bold">{money(open.amount)}</p></div>
                <div className="rounded-lg border p-2"><p className="text-xs text-muted-foreground">Devuelve</p><p className="font-bold">{money(open.totalToPay)}</p></div>
                <div className="rounded-lg border p-2"><p className="text-xs text-muted-foreground">Resta</p><p className="font-bold">{money(open.remainingBalance)}</p></div>
              </div>
              {open.installments.length ? (
                <div className="divide-y rounded-lg border text-sm">
                  {open.installments.map((i) => {
                    const late = i.status === "PENDING" && new Date(i.dueDate) < new Date();
                    return (
                      <div key={i.id} className="flex items-center justify-between px-3 py-2">
                        <span>Cuota {i.installmentNumber} · {day(i.dueDate)}</span>
                        <span className={cn("font-semibold tabular-nums", i.status === "PAID" ? "text-green-700" : late ? "text-red-600" : "")}>{i.status === "PAID" ? "Pagada" : late ? `Vencida · ${money(i.amount - i.paidAmount)}` : money(i.amount - i.paidAmount)}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Las cuotas empiezan cuando se entrega el efectivo en caja.</p>
              )}
              {open.rejectReason && <p className="text-sm text-muted-foreground">Motivo: {open.rejectReason}</p>}
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!rejecting} onOpenChange={(o) => !o && setRejecting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{rejecting?.status === "REQUESTED" ? "¿Rechazar la solicitud?" : "¿Anular el préstamo aprobado?"}</AlertDialogTitle>
            <AlertDialogDescription>{rejecting?.client.name} lo verá en su app. Puedes dejarle un motivo (opcional).</AlertDialogDescription>
          </AlertDialogHeader>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder="Ej. Necesitas pagar tu préstamo anterior" />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={(e) => { e.preventDefault(); reject(); }}>Rechazar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
