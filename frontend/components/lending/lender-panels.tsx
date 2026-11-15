"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { IconAlertTriangle, IconDeviceFloppy, IconSend, IconStar, IconStarFilled, IconTrophy } from "@tabler/icons-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/**
 * The lender's side of the P2P market (Préstamos): its table by level, the client's reputation,
 * the chat per loan, rating the client and one client's own limit.
 */
const LEVELS: Record<number, string> = { 4: "Chispa", 3: "Cometa", 2: "Órbita", 1: "Galaxia" };
const money = (n: number) => `$${(Number(n) || 0).toFixed(2)}`;
async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(path, init);
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(Array.isArray(body?.message) ? body.message.join(", ") : body?.message || "No se pudo completar");
  return body as T;
}
const send = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });

export type Reputation = {
  level: number; levelName: string; stars: number; reviews: number; positive: number;
  paidInstallments: number; onTimePct: number | null; activeOnPlatform: number; lateAnywhere: boolean;
};

export function Stars({ value, size = 13, className }: { value: number; size?: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-px text-amber-500", className)} aria-label={`${value} de 5 estrellas`}>
      {[1, 2, 3, 4, 5].map((i) => (i <= Math.round(value) ? <IconStarFilled key={i} size={size} /> : <IconStar key={i} size={size} className="text-muted-foreground/40" />))}
    </span>
  );
}

/** "★ 4.5 (8) · 96% a tiempo · 2 préstamos en Syncro · ⚠ atrasado en otro comercio" */
export function ClientRepLine({ r }: { r?: Reputation | null }) {
  if (!r) return null;
  return (
    <span className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
      {r.reviews > 0 ? (
        <span className="inline-flex items-center gap-1"><IconStarFilled size={12} className="text-amber-500" /><b className="text-foreground">{r.stars.toFixed(1)}</b> ({r.reviews})</span>
      ) : (
        <span>Sin calificaciones</span>
      )}
      <span>·</span>
      <span>{r.onTimePct == null ? "Sin pagos todavía" : `${r.onTimePct}% a tiempo (${r.paidInstallments} cuotas)`}</span>
      <span>·</span>
      <span>{r.activeOnPlatform} préstamo{r.activeOnPlatform === 1 ? "" : "s"} abierto{r.activeOnPlatform === 1 ? "" : "s"} en Syncro</span>
      {r.lateAnywhere && (
        <span className="inline-flex items-center gap-1 font-medium text-destructive"><IconAlertTriangle size={12} /> Atrasado en la plataforma</span>
      )}
    </span>
  );
}

/** Préstamos → Ajustes: how much this lender lends by level (and Syncro's caps, read-only) */
export function LenderSettingsPanel() {
  const [data, setData] = useState<any | null>(null);
  const [limits, setLimits] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    call<any>("/lending/settings")
      .then((d) => {
        setData(d);
        setLimits(Object.fromEntries([4, 3, 2, 1].map((l) => [l, String(d.levelLimits[l])])));
      })
      .catch((e) => toast.error(e.message));
  }, []);
  const save = async () => {
    setSaving(true);
    try {
      const r = await call<any>("/lending/settings", send("PUT", { levelLimits: Object.fromEntries(Object.entries(limits).map(([k, v]) => [k, Number(v) || 0])) }));
      setLimits(Object.fromEntries([4, 3, 2, 1].map((l) => [l, String(r.levelLimits[l])])));
      toast.success("Límites guardados. Ya se aplican en la app.");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };
  if (!data) return <Skeleton className="h-80 rounded-xl" />;
  const rep = data.reputation;
  return (
    <div className="grid gap-4 @5xl/main:grid-cols-[1.4fr_1fr]">
      <Card className="shadow-xs">
        <CardHeader>
          <CardTitle className="text-base">Cuánto prestas según el nivel</CardTitle>
          <CardDescription>
            Lo máximo que un cliente puede deberte según su nivel en Syncro. El nivel lo gana pagando a tiempo en cualquier comercio, así que cuando sube, tu límite para él sube solo. El interés va aparte.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          <div className="divide-y rounded-lg border">
            {[4, 3, 2, 1].map((l) => (
              <div key={l} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="flex items-center gap-3">
                  <span className="grid size-8 place-items-center rounded-full bg-primary/10 text-sm font-bold text-primary">{l}</span>
                  <div>
                    <p className="text-sm font-semibold">{LEVELS[l]}</p>
                    <p className="text-xs text-muted-foreground">{l === 4 ? "Clientes nuevos" : `Pagó a tiempo $${data.levelAt[l]} o más`}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm text-muted-foreground">$</span>
                  <Input type="number" min={0} value={limits[l] ?? ""} onChange={(e) => setLimits((p) => ({ ...p, [l]: e.target.value }))} className="w-28 text-right font-mono font-bold" aria-label={`Límite para nivel ${LEVELS[l]}`} />
                </div>
              </div>
            ))}
          </div>
          <p className="pt-2 text-xs text-muted-foreground">Un nivel mejor nunca recibe menos que el anterior: si pones menos, se ajusta al guardar. A un cliente puntual puedes darle su propio límite desde el detalle de su préstamo.</p>
          <div className="flex justify-end pt-2">
            <Button className="gap-2" onClick={save} disabled={saving}><IconDeviceFloppy size={16} />{saving ? "Guardando…" : "Guardar límites"}</Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4">
        <Card className="bg-gradient-to-t from-primary/5 to-card shadow-xs">
          <CardHeader>
            <CardDescription>Tu reputación en Syncro Credit</CardDescription>
            <CardTitle className="flex items-center gap-2 text-3xl font-semibold tabular-nums">
              {rep?.reviews ? rep.stars.toFixed(1) : "—"}
              {rep?.reviews ? <Stars value={rep.stars} size={18} /> : null}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="text-muted-foreground">{rep?.reviews ? `${rep.reviews} calificaci${rep.reviews === 1 ? "ón" : "ones"} · ${rep.positive}% positivas` : "Aún no tienes calificaciones"}</p>
            <p className="text-muted-foreground">{rep?.delivered ?? 0} préstamo{(rep?.delivered ?? 0) === 1 ? "" : "s"} entregado{(rep?.delivered ?? 0) === 1 ? "" : "s"}{rep?.responseMins != null ? ` · respondes en ~${rep.responseMins < 60 ? `${Math.max(1, rep.responseMins)} min` : `${Math.round(rep.responseMins / 60)} h`}` : ""}</p>
            <p className="pt-1 text-xs text-muted-foreground">Los clientes ven esto en tus anuncios. Responder rápido y entregar a tiempo te sube la reputación.</p>
          </CardContent>
        </Card>
        <Card className="shadow-xs">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><IconTrophy size={18} className="text-primary" /> Topes de Syncro</CardTitle>
            <CardDescription>Iguales para todos los prestamistas: lo máximo que una persona puede deber sumando todos los comercios.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="divide-y rounded-lg border text-sm">
              {[4, 3, 2, 1].map((l) => (
                <div key={l} className="flex items-center justify-between px-3 py-2">
                  <span>{LEVELS[l]}</span>
                  <span className="tabular-nums text-muted-foreground">hasta <b className="text-foreground">${data.caps.levels[l].maxDebt}</b> · {data.caps.levels[l].maxActive} a la vez</span>
                </div>
              ))}
            </div>
            {data.caps.blockIfLate && <p className="pt-2 text-xs text-muted-foreground">Quien esté atrasado con cualquier comercio no puede pedir préstamos hasta ponerse al día.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/** The chat with the client about one loan */
export function LoanChatDialog({ loan, onClose }: { loan: { id: string; amount: number; client: { name: string } } | null; onClose: () => void }) {
  const [data, setData] = useState<any | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const end = useRef<HTMLDivElement | null>(null);
  const count = useRef(0);
  const load = useCallback(async () => {
    if (!loan) return;
    try { setData(await call<any>(`/lending/loans/${loan.id}/messages`)); } catch { /* keep */ }
  }, [loan]);
  useEffect(() => {
    if (!loan) return;
    setData(null);
    count.current = 0;
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [loan, load]);
  useEffect(() => {
    const n = data?.messages?.length ?? 0;
    if (n !== count.current) { count.current = n; end.current?.scrollIntoView({ behavior: "smooth" }); }
  }, [data]);
  const submit = async () => {
    const t = text.trim();
    if (!t || !loan || sending) return;
    setSending(true);
    try {
      await call(`/lending/loans/${loan.id}/messages`, send("POST", { text: t }));
      setText("");
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSending(false);
    }
  };
  return (
    <Dialog open={!!loan} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex h-[min(640px,85vh)] flex-col gap-0 p-0 sm:max-w-md">
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle>{loan?.client.name}</DialogTitle>
          <DialogDescription>Préstamo de {money(loan?.amount ?? 0)} · el cliente lo ve en su app</DialogDescription>
        </DialogHeader>
        <div className="flex-1 space-y-2 overflow-y-auto bg-muted/30 px-4 py-4">
          {!data && <Skeleton className="mx-auto h-6 w-32 rounded-full" />}
          {data?.messages?.length === 0 && <p className="pt-8 text-center text-sm text-muted-foreground">Aún no hay mensajes. Escribe para coordinar la entrega o el pago.</p>}
          {data?.messages?.map((m: any) => (
            <div key={m.id} className={cn("flex", m.fromClient ? "justify-start" : "justify-end")}>
              <div className={cn("max-w-[80%] rounded-2xl px-3.5 py-2 text-sm", m.fromClient ? "rounded-bl-md border bg-card" : "rounded-br-md bg-primary text-primary-foreground")}>
                <p className="whitespace-pre-wrap break-words">{m.text}</p>
                <p className={cn("mt-0.5 text-right text-[10.5px]", m.fromClient ? "text-muted-foreground" : "text-primary-foreground/75")}>
                  {new Date(m.createdAt).toLocaleString("es-VE", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                  {!m.fromClient && m.readAt ? " · Visto" : ""}
                </p>
              </div>
            </div>
          ))}
          <div ref={end} />
        </div>
        <div className="flex items-end gap-2 border-t p-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 1000))}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
            rows={1}
            placeholder="Escribe un mensaje"
            aria-label="Mensaje"
            className="max-h-28 min-h-10 flex-1 resize-none rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <Button size="icon" onClick={submit} disabled={sending || !text.trim()} aria-label="Enviar"><IconSend size={17} /></Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Rate the client (after the cash was handed over); editable */
export function ReviewClientBox({ loanId, initial, theirs, onSaved }: { loanId: string; initial?: { stars: number; comment: string | null } | null; theirs?: { stars: number; comment: string | null } | null; onSaved?: () => void }) {
  const [stars, setStars] = useState(initial?.stars ?? 0);
  const [comment, setComment] = useState(initial?.comment ?? "");
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      await call(`/lending/loans/${loanId}/review`, send("POST", { stars, comment }));
      toast.success("Calificación guardada");
      onSaved?.();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="space-y-2 rounded-lg border p-3">
      {theirs && (
        <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">
          <p className="flex items-center gap-2 text-xs text-muted-foreground">El cliente te calificó <Stars value={theirs.stars} size={12} /></p>
          {theirs.comment && <p className="mt-0.5">“{theirs.comment}”</p>}
        </div>
      )}
      <p className="text-sm font-medium">{initial ? "Tu calificación al cliente" : "Califica al cliente"}</p>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <button key={i} type="button" aria-label={`${i} estrella${i > 1 ? "s" : ""}`} onClick={() => setStars(i)}>
            {i <= stars ? <IconStarFilled size={24} className="text-amber-500" /> : <IconStar size={24} className="text-muted-foreground/40" />}
          </button>
        ))}
      </div>
      <Input value={comment} maxLength={400} onChange={(e) => setComment(e.target.value)} placeholder="Comentario (opcional): ¿pagó a tiempo? ¿fue amable?" />
      <div className="flex justify-end"><Button size="sm" onClick={save} disabled={!stars || saving}>{saving ? "Guardando…" : "Guardar calificación"}</Button></div>
    </div>
  );
}

/** This client's own limit with this lender (empty = by the table of its level) */
export function ClientLimitBox({ clientId, current, byLevel, onSaved }: { clientId: string; current: number | null | undefined; byLevel: number; onSaved?: () => void }) {
  const [value, setValue] = useState(current == null ? "" : String(current));
  const [saving, setSaving] = useState(false);
  const save = async (v: string) => {
    setSaving(true);
    try {
      await call(`/lending/clients/${clientId}/limit`, send("PUT", { limit: v === "" ? null : Number(v) }));
      toast.success(v === "" ? "Vuelve a usar el límite de su nivel" : "Límite del cliente guardado");
      onSaved?.();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
      <div>
        <p className="text-sm font-medium">Límite para este cliente</p>
        <p className="text-xs text-muted-foreground">Vacío = el de su nivel ({money(byLevel)}).</p>
      </div>
      <div className="flex items-center gap-1.5">
        <Input type="number" min={0} value={value} placeholder={String(byLevel)} onChange={(e) => setValue(e.target.value)} className="w-24 text-right font-mono font-bold" aria-label="Límite del cliente" />
        <Button size="sm" variant="outline" disabled={saving} onClick={() => save(value)}>Guardar</Button>
        {current != null && <Button size="sm" variant="ghost" disabled={saving} onClick={() => { setValue(""); save(""); }}>Quitar</Button>}
      </div>
    </div>
  );
}
