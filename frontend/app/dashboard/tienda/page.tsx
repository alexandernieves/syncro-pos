"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  IconApps,
  IconArrowLeft,
  IconArrowRight,
  IconBarbell,
  IconCheck,
  IconCircleCheck,
  IconClockHour4,
  IconLoader2,
  IconMessageCircle,
  IconPuzzle,
  IconSparkles,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { refreshMyModules, trialDaysLeft, useMyModules } from "@/lib/modules";
import { RequestThread } from "@/components/chat/request-thread";

type CatalogModule = { code: string; name: string; trade: string; summary: string; highlights: string[]; features: { key: string; label: string; description?: string }[] };
type RequestEvent = { id: string; status: string; note: string | null; byRole: string | null; createdAt: string };
type ModuleRequest = { id: string; kind: string; moduleCode: string | null; title: string; trade: string | null; problem: string; status: string; createdAt: string; events: RequestEvent[] };

const ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = { gym: IconBarbell };
const OPEN_ROUTE: Record<string, string> = { gym: "/dashboard/gimnasio" };

const STEPS = [
  { key: "REQUESTED", label: "Recibida" },
  { key: "IN_REVIEW", label: "En revisión" },
  { key: "BUILDING", label: "En construcción" },
  { key: "READY", label: "Lista para probar" },
  { key: "DONE", label: "Entregada" },
];
const STATUS_LABEL: Record<string, string> = Object.fromEntries([...STEPS.map((s) => [s.key, s.label]), ["REJECTED", "No procede por ahora"]]);

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(path, init);
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(Array.isArray(body?.message) ? body.message.join(", ") : body?.message || "No se pudo completar");
  return body as T;
}

const shortDate = (d: string) => new Date(d).toLocaleDateString("es-VE", { day: "numeric", month: "short" });

function businessId(): string | null {
  try {
    const pwa = window.matchMedia("(display-mode: standalone)").matches;
    return JSON.parse((pwa ? sessionStorage.getItem("user") : localStorage.getItem("user")) || "null")?.businessId ?? null;
  } catch {
    return null;
  }
}

function isOwner() {
  try {
    const pwa = window.matchMedia("(display-mode: standalone)").matches;
    const u = JSON.parse((pwa ? sessionStorage.getItem("user") : localStorage.getItem("user")) || "null");
    return u?.role === "ownerpos" || u?.role === "owner";
  } catch {
    return false;
  }
}

/** Step tracker of a request, as the business sees it. */
function Timeline({ r }: { r: ModuleRequest }) {
  if (r.status === "REJECTED") {
    const last = r.events[r.events.length - 1];
    return <p className="rounded-lg bg-muted/60 px-3 py-2 text-sm">No procede por ahora{last?.note ? `: ${last.note}` : "."} Escríbenos si quieres conversarlo.</p>;
  }
  const at = Math.max(0, STEPS.findIndex((s) => s.key === r.status));
  return (
    <ol className="grid grid-cols-5 gap-1">
      {STEPS.map((s, i) => {
        const done = i <= at;
        const event = [...r.events].reverse().find((e) => e.status === s.key);
        return (
          <li key={s.key} className="min-w-0">
            <div className={cn("h-1.5 rounded-full", done ? "bg-primary" : "bg-muted")} />
            <p className={cn("mt-1.5 truncate text-[11px]", i === at ? "font-semibold text-foreground" : done ? "text-foreground" : "text-muted-foreground")}>{s.label}</p>
            {event && <p className="text-[10px] text-muted-foreground">{shortDate(event.createdAt)}</p>}
          </li>
        );
      })}
    </ol>
  );
}

export default function ModuleStorePage() {
  const mine = useMyModules();
  const [catalog, setCatalog] = useState<CatalogModule[] | null>(null);
  const [requests, setRequests] = useState<ModuleRequest[] | null>(null);
  const [owner, setOwner] = useState(false);
  const [asking, setAsking] = useState<CatalogModule | null>(null);
  const [custom, setCustom] = useState(false);
  const [talking, setTalking] = useState<string | null>(null);
  const [bizId, setBizId] = useState<string | null>(null);

  const load = useCallback(() => {
    api<CatalogModule[]>("/modules/catalog").then(setCatalog).catch((e) => { toast.error(e.message); setCatalog([]); });
    api<ModuleRequest[]>("/modules/requests").then(setRequests).catch(() => setRequests([]));
    refreshMyModules();
  }, []);
  useEffect(() => { setOwner(isOwner()); setBizId(businessId()); load(); }, [load]);

  const myModule = (code: string) => mine?.find((m) => m.code === code);
  const openRequest = (code: string) => requests?.find((r) => r.kind === "CATALOG" && r.moduleCode === code && !["DONE", "REJECTED"].includes(r.status));
  const active = (mine ?? []).filter((m) => m.usable);

  return (
    <div className="flex flex-col gap-8 p-4 lg:p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight"><IconApps size={26} className="text-primary" /> Tienda de módulos</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Funciones hechas para tu tipo de negocio, además del punto de venta. Si lo que necesitas no está aquí, cuéntanos y lo construimos a tu medida.
          </p>
        </div>
        <Badge variant="outline" className="border-emerald-600/30 bg-emerald-600/10 text-emerald-700">Gratis por ahora</Badge>
      </div>

      {!owner && (
        <p className="rounded-xl bg-muted/60 px-4 py-3 text-sm">Solo el dueño del negocio puede solicitar módulos. Puedes ver lo que hay disponible.</p>
      )}

      {active.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold">Tus módulos</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {active.map((m) => {
              const Icon = ICONS[m.code] ?? IconPuzzle;
              const left = m.status === "TRIAL" ? trialDaysLeft(m) : null;
              return (
                <div key={m.code} className="flex items-center gap-3 rounded-xl border bg-card p-4">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon size={22} /></span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{m.name}</p>
                    <p className="text-xs text-muted-foreground">{left !== null ? (left >= 0 ? `En prueba · ${left} ${left === 1 ? "día" : "días"}` : "Prueba terminada") : "Activo"} · {m.features.length} funciones</p>
                  </div>
                  {OPEN_ROUTE[m.code] && <Button asChild size="sm" variant="outline"><Link href={OPEN_ROUTE[m.code]}>Abrir</Link></Button>}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Módulos disponibles</h2>
        {!catalog ? (
          <div className="flex justify-center py-10 text-muted-foreground"><IconLoader2 className="animate-spin" /></div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {catalog.map((m) => {
              const Icon = ICONS[m.code] ?? IconPuzzle;
              const have = myModule(m.code);
              const pending = openRequest(m.code);
              return (
                <article key={m.code} className="flex flex-col rounded-2xl border bg-card p-5 shadow-xs">
                  <div className="flex items-start gap-3">
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon size={26} /></span>
                    <div className="min-w-0">
                      <h3 className="text-lg font-semibold">{m.name}</h3>
                      <p className="text-xs text-muted-foreground">Para {m.trade.toLowerCase()}</p>
                    </div>
                  </div>
                  <p className="mt-3 text-sm">{m.summary}</p>
                  <ul className="mt-3 grid gap-1.5 text-sm sm:grid-cols-2">
                    {m.highlights.map((h) => (
                      <li key={h} className="flex items-start gap-2"><IconCheck size={16} className="mt-0.5 shrink-0 text-emerald-600" /> {h}</li>
                    ))}
                  </ul>
                  <div className="mt-5 flex flex-wrap items-center gap-2 border-t pt-4">
                    {have?.usable ? (
                      <>
                        <Badge variant="outline" className="border-emerald-600/30 bg-emerald-600/10 text-emerald-700"><IconCircleCheck size={14} /> Ya lo tienes</Badge>
                        {OPEN_ROUTE[m.code] && <Button asChild size="sm"><Link href={OPEN_ROUTE[m.code]}>Abrir</Link></Button>}
                      </>
                    ) : pending ? (
                      <Badge variant="outline" className="border-blue-600/30 bg-blue-600/10 text-blue-700"><IconClockHour4 size={14} /> Solicitado · {STATUS_LABEL[pending.status]}</Badge>
                    ) : (
                      <Button onClick={() => setAsking(m)} disabled={!owner}>Solicitar módulo</Button>
                    )}
                    <span className="ml-auto text-xs text-muted-foreground">Lo adaptamos a cómo trabaja tu negocio</span>
                  </div>
                </article>
              );
            })}

            <article className="flex flex-col justify-between rounded-2xl border border-dashed bg-muted/30 p-5">
              <div>
                <span className="flex size-12 items-center justify-center rounded-xl bg-background text-primary shadow-xs"><IconSparkles size={26} /></span>
                <h3 className="mt-3 text-lg font-semibold">¿Tu negocio necesita algo distinto?</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Farmacia, ferretería, cafetería, taller… Cuéntanos cómo trabajas y qué te gustaría resolver. Nuestro equipo lo diseña contigo y te avisa por el chat de soporte en cada paso.
                </p>
              </div>
              <div className="mt-5">
                <Button variant="outline" onClick={() => setCustom(true)} disabled={!owner}>Pedir un módulo a la medida</Button>
              </div>
            </article>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Tus solicitudes</h2>
          <Button asChild variant="ghost" size="sm"><Link href="/dashboard/soporte"><IconMessageCircle size={16} /> Hablar con soporte</Link></Button>
        </div>
        {!requests ? null : !requests.length ? (
          <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">Todavía no has hecho solicitudes.</p>
        ) : (
          <div className="space-y-3">
            {requests.map((r) => (
              <div key={r.id} className="space-y-3 rounded-xl border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold">{r.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.kind === "CATALOG" ? "Módulo del catálogo" : r.kind === "CUSTOM_FEATURE" ? "Función nueva" : "Módulo a la medida"} · enviada el {shortDate(r.createdAt)}
                    </p>
                  </div>
                  <Badge variant="outline">{STATUS_LABEL[r.status] ?? r.status}</Badge>
                </div>
                <Timeline r={r} />
                <Button size="sm" variant="ghost" className="-ml-2" onClick={() => setTalking(talking === r.id ? null : r.id)}>
                  <IconMessageCircle size={16} /> {talking === r.id ? "Ocultar conversación" : "Conversar sobre esta solicitud"}
                </Button>
                {talking === r.id && bizId && <RequestThread businessId={bizId} requestId={r.id} audience="business" />}
                {(() => {
                  const note = [...r.events].reverse().find((e) => e.note && e.byRole === "syncro");
                  return note ? <p className="rounded-lg bg-muted/60 px-3 py-2 text-sm"><span className="font-medium">Syncro:</span> {note.note}</p> : null;
                })()}
              </div>
            ))}
          </div>
        )}
      </section>

      {asking && <CatalogRequestDialog mod={asking} onClose={() => setAsking(null)} onDone={load} />}
      {custom && <CustomRequestDialog onClose={() => setCustom(false)} onDone={load} />}
    </div>
  );
}

function CatalogRequestDialog({ mod, onClose, onDone }: { mod: CatalogModule; onClose: () => void; onDone: () => void }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/modules/requests", { method: "POST", body: JSON.stringify({ kind: "CATALOG", moduleCode: mod.code, problem: note.trim() || undefined }) });
      toast.success(`Solicitaste ${mod.name}. Te avisaremos por el chat de soporte.`);
      onDone();
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Solicitar el módulo {mod.name}</DialogTitle>
            <DialogDescription>Lo revisamos y te lo activamos. Si quieres que funcione distinto en algo, cuéntanos aquí.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="cat-note">¿Algo que debamos saber? (opcional)</Label>
            <textarea id="cat-note" rows={4} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej.: tenemos dos sedes, cobramos por semana, usamos huella en la puerta…" className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40" autoFocus />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancelar</Button>
            <Button type="submit" disabled={busy}>{busy && <IconLoader2 size={16} className="animate-spin" />} Enviar solicitud</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const TRADES = ["Farmacia", "Ferretería", "Cafetería o restaurante", "Panadería", "Taller", "Tienda de ropa", "Clínica o consultorio", "Licorería", "Otro"];

/** Three short steps so the owner can describe what they need without a blank page. */
function CustomRequestDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ trade: "", otherTrade: "", title: "", problem: "", currentProcess: "", extra: "" });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const trade = form.trade === "Otro" ? form.otherTrade.trim() : form.trade;

  const canNext = step === 0 ? !!trade && form.title.trim().length > 2 : step === 1 ? form.problem.trim().length > 9 : true;

  const submit = async () => {
    setBusy(true);
    try {
      await api("/modules/requests", { method: "POST", body: JSON.stringify({ kind: "CUSTOM_MODULE", trade, title: form.title, problem: form.problem, currentProcess: form.currentProcess, extra: form.extra }) });
      toast.success("Recibimos tu solicitud. Te escribiremos por el chat de soporte.");
      onDone();
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Pide un módulo a la medida</DialogTitle>
          <DialogDescription>Paso {step + 1} de 3 · {["Tu negocio", "Lo que necesitas", "Detalles y envío"][step]}</DialogDescription>
        </DialogHeader>
        <div className="flex gap-1">{[0, 1, 2].map((i) => <div key={i} className={cn("h-1 flex-1 rounded-full", i <= step ? "bg-primary" : "bg-muted")} />)}</div>

        {step === 0 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>¿A qué se dedica tu negocio?</Label>
              <div className="flex flex-wrap gap-1.5">
                {TRADES.map((t) => (
                  <button key={t} type="button" onClick={() => set("trade", t)} className={cn("rounded-full border px-3 py-1.5 text-sm transition", form.trade === t ? "border-primary bg-primary/10 font-medium text-primary" : "hover:bg-muted")}>{t}</button>
                ))}
              </div>
              {form.trade === "Otro" && <Input value={form.otherTrade} onChange={(e) => set("otherTrade", e.target.value)} placeholder="Escribe el rubro" autoFocus />}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cr-title">Ponle un nombre corto</Label>
              <Input id="cr-title" value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Ej.: Control de recetas, Órdenes de taller, Pedidos por mesa" maxLength={120} />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="cr-problem">¿Qué quieres resolver?</Label>
              <textarea id="cr-problem" rows={4} value={form.problem} onChange={(e) => set("problem", e.target.value)} placeholder="Ej.: perdemos el control de qué medicinas vencen y cuáles se venden con récipe…" className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cr-process">¿Cómo lo haces hoy? (opcional)</Label>
              <textarea id="cr-process" rows={3} value={form.currentProcess} onChange={(e) => set("currentProcess", e.target.value)} placeholder="Ej.: en un cuaderno, en Excel, de memoria…" className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40" />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="cr-extra">¿Algo más? (opcional)</Label>
              <textarea id="cr-extra" rows={3} value={form.extra} onChange={(e) => set("extra", e.target.value)} placeholder="Cuántas personas lo usarían, si tienes sucursales, para cuándo lo necesitas…" className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40" autoFocus />
            </div>
            <div className="space-y-1 rounded-xl bg-muted/50 px-4 py-3 text-sm">
              <p><span className="text-muted-foreground">Rubro:</span> {trade}</p>
              <p><span className="text-muted-foreground">Módulo:</span> {form.title}</p>
              <p className="line-clamp-3"><span className="text-muted-foreground">Qué resolver:</span> {form.problem}</p>
            </div>
            <p className="text-xs text-muted-foreground">Te escribiremos por el chat de soporte para entender mejor tu forma de trabajar. Puedes mandarnos fotos o notas de voz por ahí.</p>
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="ghost" onClick={() => (step ? setStep(step - 1) : onClose())} disabled={busy}>
            {step ? <><IconArrowLeft size={16} /> Atrás</> : "Cancelar"}
          </Button>
          {step < 2 ? (
            <Button type="button" onClick={() => setStep(step + 1)} disabled={!canNext}>Siguiente <IconArrowRight size={16} /></Button>
          ) : (
            <Button type="button" onClick={submit} disabled={busy}>{busy && <IconLoader2 size={16} className="animate-spin" />} Enviar solicitud</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
