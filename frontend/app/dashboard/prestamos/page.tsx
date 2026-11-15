"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  IconAlertTriangle, IconCash, IconCheck, IconChevronRight, IconCoins, IconPencil, IconPlus, IconReceipt2,
  IconRefresh, IconTrash, IconTrendingUp, IconX,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { useMyModules } from "@/lib/modules";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatCard, StatGrid } from "@/components/stat-card";
import { GymPage as Page, GymPageHeader as PageHeader, MemberAvatar } from "@/components/gym/gym-ui";
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
  installments: { id: string; installmentNumber: number; dueDate: string; amount: number; paidAmount: number; status: string; lateCharges?: number }[];
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
        <IconCash size={40} className="text-primary" />
        <h1 className="text-xl font-bold">Préstamos no está activo</h1>
        <p className="max-w-md text-sm text-muted-foreground">Este módulo permite publicar ofertas de préstamo en Syncro Credit y entregar el efectivo en caja con PIN. Pídelo en la Tienda de módulos.</p>
      </div>
    );
  }

  const statusChip = (l: Loan) => {
    const map: Record<string, [string, string]> = {
      REQUESTED: ["Por responder", "border-primary/30 bg-primary/10 text-primary"],
      APPROVED_PENDING_DISBURSEMENT: ["Aprobado · espera retirar", "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300"],
      PENDING: l.lateAmount > 0
        ? ["Con atraso", "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-300"]
        : ["Al día", "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"],
      PAID: ["Pagado", "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"],
      REJECTED: ["Rechazado", "text-muted-foreground"],
      CANCELLED: ["Cancelado por el cliente", "text-muted-foreground"],
    };
    const [t, c] = map[l.status] ?? [l.status, ""];
    return <Badge variant="outline" className={cn("rounded-full", c)}>{t}</Badge>;
  };

  const TABS: [Tab, string, number | undefined][] = [
    ["requests", "Solicitudes", pf?.pendingRequests || undefined],
    ["active", "Activos", pf?.activeLoans || undefined],
    ["offers", "Mis ofertas", offers.length || undefined],
    ["closed", "Cerrados", undefined],
  ];

  return (
    <Page>
      <PageHeader
        title="Préstamos"
        description="Tus ofertas se ven en Syncro Credit. Apruebas la solicitud, el cliente recibe un PIN y retira el efectivo en caja."
        actions={
          <>
            <Button variant="outline" className="gap-2" onClick={load}><IconRefresh size={16} /> Actualizar</Button>
            <Button className="gap-2" onClick={() => { setTab("offers"); setDraft({ ...EMPTY_OFFER }); }}><IconPlus size={16} /> Nueva oferta</Button>
          </>
        }
      />

      {/* Portfolio: same cards as the dashboard */}
      {!pf ? (
        <StatGrid>{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[172px] rounded-xl" />)}</StatGrid>
      ) : (
        <StatGrid>
          <StatCard
            label="Prestado"
            value={money(pf.lent)}
            icon={<IconCash size={20} />}
            title={`${pf.activeLoans} préstamo${pf.activeLoans === 1 ? "" : "s"} en curso`}
            hint="Efectivo entregado en caja"
            onClick={() => { setLoans(null); setTab("active"); }}
          />
          <StatCard
            label="Por cobrar"
            value={money(pf.toCollect)}
            icon={<IconReceipt2 size={20} />}
            tone="primary"
            title={`Cobrado ${money(pf.collected)}`}
            hint="Capital más intereses pendientes"
          />
          <StatCard
            label="Intereses ganados"
            value={money(pf.interestEarned)}
            icon={<IconTrendingUp size={20} />}
            tone="good"
            title="Lo que ya cobraste de interés"
            hint="Se suma con cada cuota pagada"
          />
          <StatCard
            label="Vencido"
            value={money(pf.late)}
            icon={<IconAlertTriangle size={20} />}
            tone={pf.late > 0 ? "bad" : "default"}
            title={pf.late > 0 ? "Cuotas sin pagar a tiempo" : "Todo al día"}
            hint={pf.pendingRequests ? `${pf.pendingRequests} solicitud${pf.pendingRequests === 1 ? "" : "es"} por responder` : "Sin solicitudes pendientes"}
            onClick={pf.late > 0 ? () => { setLoans(null); setTab("active"); } : undefined}
          />
        </StatGrid>
      )}

      <Tabs value={tab} onValueChange={(v) => { setLoans(null); setTab(v as Tab); }}>
        <TabsList>
          {TABS.map(([k, t, n]) => (
            <TabsTrigger key={k} value={k} className="gap-1.5">
              {t}
              {n ? <span className="rounded-full bg-primary/15 px-1.5 text-[11px] font-semibold text-primary tabular-nums">{n}</span> : null}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {tab === "offers" ? (
        !offers.length ? (
          <Card className="items-center gap-3 py-12 text-center">
            <IconCoins size={36} className="text-primary" />
            <div>
              <p className="font-semibold">Aún no tienes ofertas</p>
              <p className="text-sm text-muted-foreground">Crea una para aparecer en la pestaña Préstamos de Syncro Credit.</p>
            </div>
            <Button className="gap-2" onClick={() => setDraft({ ...EMPTY_OFFER })}><IconPlus size={16} /> Nueva oferta</Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-3">
            {offers.map((o) => (
              <Card key={o.id} className={cn("@container/card bg-gradient-to-t from-primary/5 to-card shadow-xs", !o.active && "opacity-60")}>
                <CardHeader>
                  <CardDescription>{o.name}</CardDescription>
                  <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                    {money(o.minAmount).replace(".00", "")} – {money(o.maxAmount).replace(".00", "")}
                  </CardTitle>
                  <CardAction><Switch checked={o.active} onCheckedChange={(v) => toggleOffer(o, v)} aria-label={o.active ? "Publicada" : "Pausada"} /></CardAction>
                </CardHeader>
                <CardFooter className="flex-col items-start gap-1.5 text-sm">
                  <div className="font-medium text-primary">{o.interestPct}% · {o.installments} cuota{o.installments > 1 ? "s" : ""} {freqText(o.frequencyDays)}</div>
                  <div className="text-muted-foreground">
                    {o.minLevel === 4 ? "Para todos los niveles" : `Desde nivel ${o.minLevel} · ${LEVELS[o.minLevel]}`} · {o.requests} solicitud{o.requests === 1 ? "" : "es"}
                    {!o.active && " · Pausada"}
                  </div>
                  <div className="-ml-2 mt-1 flex gap-1">
                    <Button size="sm" variant="ghost" className="gap-1" onClick={() => setDraft({ id: o.id, name: o.name, minAmount: String(o.minAmount), maxAmount: String(o.maxAmount), interestPct: String(o.interestPct), installments: String(o.installments), frequencyDays: String(o.frequencyDays), minLevel: String(o.minLevel) })}><IconPencil size={15} /> Editar</Button>
                    <Button size="sm" variant="ghost" className="gap-1 text-destructive hover:text-destructive" onClick={() => removeOffer(o)}><IconTrash size={15} /> Eliminar</Button>
                  </div>
                </CardFooter>
              </Card>
            ))}
          </div>
        )
      ) : (
        <Card className="gap-0 overflow-hidden py-0 shadow-xs">
          {loans === null ? (
            <div className="space-y-3 p-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
          ) : !loans.length ? (
            <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
              <IconCash size={32} className="text-muted-foreground/50" />
              <p className="font-medium">{tab === "requests" ? "No hay solicitudes por responder" : tab === "active" ? "No tienes préstamos en curso" : "Nada por aquí todavía"}</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                {tab === "requests" ? "Cuando un cliente pida un préstamo en Syncro Credit aparecerá aquí para que lo apruebes." : "Los préstamos aparecen aquí después de entregarse en caja."}
              </p>
            </CardContent>
          ) : (
            <div className="divide-y">
              {loans.map((l) => (
                <div key={l.id} className="flex flex-wrap items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40">
                  <button onClick={() => setOpen(l)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                    <MemberAvatar name={l.client.name} size={38} />
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{l.client.name} <span className="font-normal text-muted-foreground">· {l.client.documentId}</span></span>
                      <span className="block truncate text-xs text-muted-foreground">
                        Nivel {l.level} · {LEVELS[l.level]} · {l.offerName ?? "Préstamo"} · {day(l.createdAt)}
                        {l.status === "REQUESTED" && ` · límite disponible ${money(l.available)}`}
                      </span>
                    </span>
                  </button>
                  <div className="text-right">
                    <p className="font-semibold tabular-nums">{money(l.amount)}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">devuelve {money(l.totalToPay)}{l.status === "PENDING" ? ` · resta ${money(l.remainingBalance)}` : ""}</p>
                  </div>
                  <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
                    {statusChip(l)}
                    {l.status === "REQUESTED" && (
                      <>
                        <Button size="sm" variant="outline" className="gap-1 text-destructive hover:text-destructive" disabled={busy === l.id} onClick={() => setRejecting(l)}><IconX size={15} /> Rechazar</Button>
                        <Button size="sm" className="gap-1" disabled={busy === l.id || !l.fitsLimit} title={!l.fitsLimit ? "Pasa su límite: súbelo en Clientes" : undefined} onClick={() => approve(l)}><IconCheck size={15} /> Aprobar</Button>
                      </>
                    )}
                    {l.status === "APPROVED_PENDING_DISBURSEMENT" && (
                      <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" disabled={busy === l.id} onClick={() => setRejecting(l)}>Anular</Button>
                    )}
                    {l.status !== "REQUESTED" && l.status !== "APPROVED_PENDING_DISBURSEMENT" && (
                      <Button size="icon" variant="ghost" className="size-8" aria-label="Ver detalle" onClick={() => setOpen(l)}><IconChevronRight size={16} /></Button>
                    )}
                  </div>
                  {l.status === "REQUESTED" && !l.fitsLimit && (
                    <p className="w-full rounded-md bg-primary/5 px-3 py-1.5 text-right text-xs text-primary">
                      Pidió {money(l.amount)} y su límite disponible es {money(l.available)}: súbele el límite en Clientes para aprobarlo.
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Offer editor */}
      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="sm:max-w-lg">
          {draft && preview && (
            <>
              <DialogHeader>
                <DialogTitle>{draft.id ? "Editar oferta" : "Nueva oferta"}</DialogTitle>
                <DialogDescription>Así la verán los clientes en “Pedir préstamo”. El interés es por todo el préstamo (máximo 100%) y va aparte del límite del cliente.</DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1.5"><Label>Nombre</Label><Input maxLength={40} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Ej. Express" /></div>
                <div className="space-y-1.5"><Label>Monto mínimo ($)</Label><Input type="number" min={1} value={draft.minAmount} onChange={(e) => setDraft({ ...draft, minAmount: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Monto máximo ($)</Label><Input type="number" min={1} value={draft.maxAmount} onChange={(e) => setDraft({ ...draft, maxAmount: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Interés (%)</Label><Input type="number" min={0} max={100} value={draft.interestPct} onChange={(e) => setDraft({ ...draft, interestPct: e.target.value })} /></div>
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
                <div className="rounded-lg border bg-gradient-to-t from-primary/5 to-card p-2.5"><p className="text-xs text-muted-foreground">Prestado</p><p className="font-bold">{money(open.amount)}</p></div>
                <div className="rounded-lg border bg-gradient-to-t from-primary/5 to-card p-2.5"><p className="text-xs text-muted-foreground">Devuelve</p><p className="font-bold">{money(open.totalToPay)}</p></div>
                <div className="rounded-lg border bg-gradient-to-t from-primary/5 to-card p-2.5"><p className="text-xs text-muted-foreground">Resta</p><p className="font-bold">{money(open.remainingBalance)}</p></div>
              </div>
              {open.installments.length ? (
                <div className="divide-y rounded-lg border text-sm">
                  {open.installments.map((i) => {
                    const late = i.status === "PENDING" && new Date(i.dueDate) < new Date();
                    return (
                      <div key={i.id} className="flex items-center justify-between px-3 py-2">
                        <span>Cuota {i.installmentNumber} · {day(i.dueDate)}{(i.lateCharges ?? 0) > 0.004 && <span className="ml-1 text-xs text-destructive">· recargo {money(i.lateCharges ?? 0)}</span>}</span>
                        <span className={cn("font-semibold tabular-nums", i.status === "PAID" ? "text-emerald-600" : late ? "text-destructive" : "")}>{i.status === "PAID" ? "Pagada" : late ? `Vencida · ${money(i.amount - i.paidAmount)}` : money(i.amount - i.paidAmount)}</span>
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
    </Page>
  );
}
