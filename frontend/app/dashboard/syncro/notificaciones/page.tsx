"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { IconAlertTriangle, IconBell, IconBellRinging, IconCheck, IconDeviceDesktop, IconLoader2, IconRestore, IconSearch, IconSend, IconTestPipe, IconUsers, IconBuildingStore } from "@tabler/icons-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { PosTable } from "@/components/pos-table";
import { useRequireSyncroAdmin } from "@/hooks/use-require-syncro-admin";
import { ensurePushSubscription } from "@/hooks/usePushNotifications";
import { adminApi, dateTime, STATUS_CLASS, STATUS_LABEL } from "@/lib/syncro-admin";

type Automation = {
  key: string; label: string; when: string; vars: string[]; fixedText: boolean; enabled: boolean;
  title: string; body: string; url: string | null; defaults: { title: string; body: string; url: string | null };
  sent: number; lastSent: string | null;
};
type Campaign = {
  id: string; kind: "MANUAL" | "AUTO"; trigger: string | null; title: string; body: string; url: string | null;
  audience: { mode: "all" | "selected"; businessIds?: string[]; who: "owners" | "team" } | null;
  recipients: number; reached: number; devices: number; createdAt: string;
};
type Overview = { configured: boolean; devices: number; people: number; businesses: number; automations: Automation[]; campaigns: Campaign[] };
type Business = { id: string; name: string; status: string; email: string | null; owners: number; team: number; ownerDevices: number; teamDevices: number };
type Detail = Campaign & { deliveries: { id: string; status: string; sentAt: string | null; name: string; email: string | null; business: string | null }[] };

/** Screens a notification can open when tapped. */
const LINKS: { value: string; label: string }[] = [
  { value: "/dashboard", label: "Inicio" },
  { value: "/dashboard/soporte", label: "Soporte" },
  { value: "/dashboard/tienda", label: "Tienda de módulos" },
  { value: "/dashboard/facturacion", label: "Suscripción y facturación" },
  { value: "/dashboard/configuracion", label: "Configuración" },
  { value: "/pos", label: "Punto de venta" },
  { value: "none", label: "No abrir nada" },
  { value: "custom", label: "Otro enlace…" },
];
const VAR_LABEL: Record<string, string> = { nombre: "Nombre", negocio: "Negocio", solicitud: "Solicitud", estado: "Estado", cuando: "Cuándo vence", fecha: "Fecha" };
const SAMPLE: Record<string, string> = { nombre: "María", negocio: "Bodega La Esquina", solicitud: "Módulo de delivery", estado: "En revisión", cuando: "en 3 días", fecha: "15 de noviembre" };
const fillSample = (t: string) => t.replace(/\{(\w+)\}/g, (_, k: string) => SAMPLE[k] ?? "").replace(/\s+([,.!?])/g, "$1").replace(/,([!?.])/g, "$1");

export default function PushNotificationsPage() {
  useRequireSyncroAdmin();
  const [data, setData] = useState<Overview | null>(null);
  const [tab, setTab] = useState("send");
  const [detail, setDetail] = useState<string | null>(null);

  const load = useCallback(() => {
    adminApi<Overview>("/push").then(setData).catch((e) => toast.error(e.message));
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Notificaciones push</h1>
        <p className="text-sm text-muted-foreground">Avisos que les llegan a los comercios en su computadora o celular, aunque tengan Syncro cerrado.</p>
      </div>

      {data && !data.configured && (
        <div className="flex gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-900">
          <IconAlertTriangle size={20} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">El servidor todavía no puede enviar notificaciones push</p>
            <p>Faltan las claves VAPID en <code>backend.env</code>. Mientras tanto, los avisos solo aparecen en las pantallas que estén abiertas y en la campana.</p>
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat icon={IconDeviceDesktop} label="Dispositivos activos" value={data?.devices} />
        <Stat icon={IconUsers} label="Personas con notificaciones" value={data?.people} />
        <Stat icon={IconBuildingStore} label="Comercios alcanzables" value={data?.businesses} />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="send"><IconSend size={16} /> Enviar</TabsTrigger>
          <TabsTrigger value="auto"><IconBellRinging size={16} /> Automáticas</TabsTrigger>
          <TabsTrigger value="history"><IconBell size={16} /> Historial</TabsTrigger>
        </TabsList>
        <TabsContent value="send" className="mt-4">
          <Compose onSent={() => { load(); setTab("history"); }} />
        </TabsContent>
        <TabsContent value="auto" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-2">
            {data?.automations.map((a) => <AutomationCard key={a.key} automation={a} onSaved={load} />)}
            {!data && <p className="text-sm text-muted-foreground">Cargando…</p>}
          </div>
        </TabsContent>
        <TabsContent value="history" className="mt-4">
          <History campaigns={data?.campaigns} automations={data?.automations ?? []} onOpen={setDetail} />
        </TabsContent>
      </Tabs>

      <CampaignSheet id={detail} automations={data?.automations ?? []} onClose={() => setDetail(null)} />
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof IconBell; label: string; value: number | undefined }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3">
      <span className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary"><Icon size={20} /></span>
      <div>
        <p className="text-2xl font-semibold tabular-nums">{value ?? "—"}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

/** What the notification looks like on a computer. */
function Preview({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border bg-background/80 p-3 shadow-lg backdrop-blur">
      <div className="flex gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/syncro.png" alt="" className="size-10 shrink-0 rounded-lg object-contain" />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="truncate text-sm font-semibold">{fillSample(title) || "Título de la notificación"}</p>
            <span className="shrink-0 text-[11px] text-muted-foreground">ahora</span>
          </div>
          <p className="line-clamp-3 text-sm text-muted-foreground">{fillSample(body) || "El mensaje aparece aquí."}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">Syncro · {typeof window !== "undefined" ? window.location.host : ""}</p>
        </div>
      </div>
    </div>
  );
}

/** Title, message and link, with buttons that drop a {variable} where the cursor is. */
function MessageFields({ title, body, link, custom, vars, onChange, idPrefix }: {
  title: string; body: string; link: string; custom: string; vars: string[]; idPrefix: string;
  onChange: (p: Partial<{ title: string; body: string; link: string; custom: string }>) => void;
}) {
  const last = useRef<{ field: "title" | "body"; el: HTMLInputElement | HTMLTextAreaElement } | null>(null);
  const insert = (v: string) => {
    const tag = `{${v}}`;
    const target = last.current ?? { field: "body" as const, el: null as unknown as HTMLTextAreaElement };
    const value = target.field === "title" ? title : body;
    const at = target.el?.selectionStart ?? value.length;
    const end = target.el?.selectionEnd ?? at;
    const next = value.slice(0, at) + tag + value.slice(end);
    onChange({ [target.field]: next });
    requestAnimationFrame(() => {
      target.el?.focus();
      target.el?.setSelectionRange(at + tag.length, at + tag.length);
    });
  };
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <div className="flex justify-between"><Label htmlFor={`${idPrefix}-title`}>Título</Label><span className="text-xs tabular-nums text-muted-foreground">{title.length}/80</span></div>
        <Input id={`${idPrefix}-title`} value={title} maxLength={80} placeholder="Ej.: ¡Nueva función en Syncro! 🎉" onFocus={(e) => (last.current = { field: "title", el: e.currentTarget })} onChange={(e) => onChange({ title: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <div className="flex justify-between"><Label htmlFor={`${idPrefix}-body`}>Mensaje</Label><span className="text-xs tabular-nums text-muted-foreground">{body.length}/300</span></div>
        <textarea id={`${idPrefix}-body`} rows={3} value={body} maxLength={300} placeholder="Ej.: Hola {nombre}, este mes tienes 20% de descuento en el plan Pro." onFocus={(e) => (last.current = { field: "body", el: e.currentTarget })} onChange={(e) => onChange({ body: e.target.value })} className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40" />
      </div>
      {vars.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-muted-foreground">Personalizar:</span>
          {vars.map((v) => (
            <button key={v} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => insert(v)} className="rounded-full border px-2.5 py-1 font-medium hover:bg-muted">+ {VAR_LABEL[v] ?? v}</button>
          ))}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Al tocarla abre</Label>
          <Select value={link} onValueChange={(v) => onChange({ link: v })}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>{LINKS.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        {link === "custom" && (
          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-url`}>Enlace</Label>
            <Input id={`${idPrefix}-url`} value={custom} placeholder="/dashboard/productos o https://…" onChange={(e) => onChange({ custom: e.target.value })} />
          </div>
        )}
      </div>
    </div>
  );
}

const urlOf = (link: string, custom: string) => (link === "none" ? "" : link === "custom" ? custom.trim() : link);
const linkOf = (url: string | null) => (!url ? { link: "none", custom: "" } : LINKS.some((l) => l.value === url) ? { link: url, custom: "" } : { link: "custom", custom: url });

async function sendTest(title: string, body: string, url: string) {
  // The person testing needs this device registered to see it outside the app
  await ensurePushSubscription({ ask: true });
  const r = await adminApi<{ devices: number; configured: boolean }>("/push/test", { method: "POST", body: JSON.stringify({ title, body, url }) });
  if (!r.configured) toast.message("Prueba mostrada solo en esta pantalla", { description: "El servidor aún no tiene las claves para enviar push." });
  else if (r.devices) toast.success(`Prueba enviada a ${r.devices} ${r.devices === 1 ? "dispositivo tuyo" : "dispositivos tuyos"}`);
  else toast.message("Prueba mostrada en esta pantalla", { description: "Este navegador no tiene las notificaciones activadas." });
}

/* ───────────────────────── Enviar ───────────────────────── */

function Compose({ onSent }: { onSent: () => void }) {
  const [msg, setMsg] = useState({ title: "", body: "", link: "/dashboard", custom: "" });
  const [mode, setMode] = useState<"all" | "selected">("all");
  const [who, setWho] = useState<"owners" | "team">("owners");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [businesses, setBusinesses] = useState<Business[] | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("ALL");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState<"send" | "test" | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => { adminApi<Business[]>("/push/audience").then(setBusinesses).catch((e) => toast.error(e.message)); }, []);

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (businesses ?? []).filter((b) => (status === "ALL" || b.status === status) && (!term || b.name.toLowerCase().includes(term) || (b.email ?? "").toLowerCase().includes(term)));
  }, [businesses, q, status]);

  const targets = mode === "all" ? businesses ?? [] : (businesses ?? []).filter((b) => picked.has(b.id));
  const people = targets.reduce((s, b) => s + (who === "owners" ? b.owners : b.team), 0);
  const devices = targets.reduce((s, b) => s + (who === "owners" ? b.ownerDevices : b.teamDevices), 0);
  const url = urlOf(msg.link, msg.custom);
  const ready = msg.title.trim() && msg.body.trim() && people > 0 && (msg.link !== "custom" || url);

  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const allShown = shown.length > 0 && shown.every((b) => picked.has(b.id));
  const toggleShown = () => setPicked((s) => { const n = new Set(s); shown.forEach((b) => (allShown ? n.delete(b.id) : n.add(b.id))); return n; });

  const send = async () => {
    setBusy("send");
    try {
      const r = await adminApi<Campaign & { pending: number; configured: boolean }>("/push/send", {
        method: "POST",
        body: JSON.stringify({ title: msg.title, body: msg.body, url, mode, businessIds: [...picked], who }),
      });
      toast.success(`Notificación enviada a ${r.recipients} ${r.recipients === 1 ? "persona" : "personas"}`, {
        description: r.pending ? `${r.reached} la recibieron ya; ${r.pending} la verán al activar las notificaciones.` : "Todas la recibieron en su dispositivo.",
      });
      setMsg({ title: "", body: "", link: "/dashboard", custom: "" });
      setPicked(new Set());
      setConfirm(false);
      onSent();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const test = async () => {
    setBusy("test");
    try { await sendTest(msg.title, msg.body, url); } catch (e) { toast.error((e as Error).message); } finally { setBusy(null); }
  };

  /* Arrows move through the list of businesses; Space or Enter checks the one in focus. */
  const onListKey = (e: React.KeyboardEvent) => {
    const rows = [...(listRef.current?.querySelectorAll<HTMLElement>("[data-row]") ?? [])];
    const i = rows.indexOf(document.activeElement as HTMLElement);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      e.stopPropagation();
      rows[Math.max(0, Math.min(rows.length - 1, i + (e.key === "ArrowDown" ? 1 : -1)))]?.focus();
    } else if ((e.key === "Enter" || e.key === " ") && i >= 0) {
      e.preventDefault();
      e.stopPropagation();
      toggle(rows[i].dataset.row!);
    }
  };

  const seg = (on: boolean) => cn("flex-1 rounded-md px-3 py-2 text-sm transition", on ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground");

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-6">
        <section className="space-y-4 rounded-xl border bg-card p-5">
          <p className="font-semibold">Mensaje</p>
          <MessageFields idPrefix="push" {...msg} vars={["nombre", "negocio"]} onChange={(p) => setMsg((m) => ({ ...m, ...p }))} />
        </section>

        <section className="space-y-4 rounded-xl border bg-card p-5">
          <p className="font-semibold">¿A quién?</p>
          <div className="flex rounded-lg border bg-muted/40 p-0.5">
            <button type="button" className={seg(mode === "all")} onClick={() => setMode("all")}>Todos los comercios</button>
            <button type="button" className={seg(mode === "selected")} onClick={() => setMode("selected")}>Elegir comercios {picked.size > 0 && <span className="tabular-nums text-primary">· {picked.size}</span>}</button>
          </div>
          <div className="flex rounded-lg border bg-muted/40 p-0.5">
            <button type="button" className={seg(who === "owners")} onClick={() => setWho("owners")}>Solo los dueños</button>
            <button type="button" className={seg(who === "team")} onClick={() => setWho("team")}>Todo el equipo (cajeros y empleados)</button>
          </div>

          {mode === "selected" && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <div className="relative min-w-48 flex-1">
                  <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar comercio o correo…" className="pl-9" />
                </div>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Todos los estados</SelectItem>
                    {Object.entries(STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2"><Checkbox checked={allShown} onCheckedChange={toggleShown} /> Seleccionar {q || status !== "ALL" ? "los que se ven" : "todos"} ({shown.length})</label>
                {picked.size > 0 && <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => setPicked(new Set())}>Quitar selección</button>}
              </div>
              <div ref={listRef} onKeyDown={onListKey} data-kbd-zone className="max-h-80 divide-y overflow-y-auto rounded-lg border">
                {!businesses && <p className="p-4 text-sm text-muted-foreground">Cargando comercios…</p>}
                {businesses && !shown.length && <p className="p-4 text-sm text-muted-foreground">Ningún comercio coincide.</p>}
                {shown.map((b) => {
                  const on = picked.has(b.id);
                  const d = who === "owners" ? b.ownerDevices : b.teamDevices;
                  return (
                    <div key={b.id} data-row={b.id} tabIndex={0} role="checkbox" aria-checked={on} onClick={() => toggle(b.id)} className={cn("flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm outline-none transition hover:bg-muted/60 focus-visible:bg-primary/10", on && "bg-primary/5")}>
                      <Checkbox checked={on} tabIndex={-1} className="pointer-events-none" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{b.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{b.email ?? "Sin correo"} · {who === "owners" ? b.owners : b.team} {(who === "owners" ? b.owners : b.team) === 1 ? "persona" : "personas"}</p>
                      </div>
                      <Badge variant="outline" className={STATUS_CLASS[b.status]}>{STATUS_LABEL[b.status] ?? b.status}</Badge>
                      <span title="Dispositivos con notificaciones activas" className={cn("flex w-10 items-center justify-end gap-1 text-xs tabular-nums", d ? "text-emerald-700" : "text-muted-foreground")}><IconDeviceDesktop size={14} />{d}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
        <div className="space-y-3 rounded-xl border bg-gradient-to-br from-muted/60 to-muted/20 p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Vista previa</p>
          <Preview title={msg.title} body={msg.body} />
          {/\{\w+\}/.test(msg.title + msg.body) && <p className="text-xs text-muted-foreground">Cada persona ve su propio nombre y el de su negocio.</p>}
        </div>
        <div className="space-y-3 rounded-xl border bg-card p-5 text-sm">
          <p className="font-semibold">Alcance</p>
          <p><span className="text-2xl font-semibold tabular-nums">{people}</span> {people === 1 ? "persona" : "personas"} en <span className="font-medium tabular-nums">{targets.length}</span> {targets.length === 1 ? "comercio" : "comercios"}</p>
          <p className="text-muted-foreground">{devices} {devices === 1 ? "dispositivo la recibe" : "dispositivos la reciben"} al instante. Quien aún no tenga las notificaciones activadas la recibe al activarlas (durante 7 días), y también la ve en su campana.</p>
          <div className="flex flex-col gap-2 pt-1" data-kbd-actions>
            <Button data-kbd-primary disabled={!ready || !!busy} onClick={() => setConfirm(true)}><IconSend size={16} /> Enviar notificación</Button>
            <Button variant="outline" disabled={!msg.title.trim() || !msg.body.trim() || !!busy} onClick={test}>{busy === "test" ? <IconLoader2 size={16} className="animate-spin" /> : <IconTestPipe size={16} />} Enviarme una prueba</Button>
          </div>
        </div>
      </aside>

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Enviar a {people} {people === 1 ? "persona" : "personas"}?</AlertDialogTitle>
            <AlertDialogDescription>
              {mode === "all" ? "Todos los comercios" : targets.length === 1 ? targets[0].name : `${targets.length} comercios`} · {who === "owners" ? "solo los dueños" : "todo el equipo"}. Una notificación enviada no se puede retirar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Preview title={msg.title} body={msg.body} />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={busy === "send"} onClick={(e) => { e.preventDefault(); void send(); }}>{busy === "send" && <IconLoader2 size={16} className="animate-spin" />} Enviar ahora</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ───────────────────────── Automáticas ───────────────────────── */

function AutomationCard({ automation: a, onSaved }: { automation: Automation; onSaved: () => void }) {
  const [msg, setMsg] = useState({ title: a.title, body: a.body, ...linkOf(a.url) });
  const [busy, setBusy] = useState(false);
  useEffect(() => { setMsg({ title: a.title, body: a.body, ...linkOf(a.url) }); }, [a.title, a.body, a.url]);
  const url = urlOf(msg.link, msg.custom);
  const dirty = msg.title !== a.title || msg.body !== a.body || (url || null) !== (a.url || null);
  const isDefault = a.title === a.defaults.title && a.body === a.defaults.body && (a.url || null) === (a.defaults.url || null);

  const save = async (patch: Record<string, unknown>, ok: string) => {
    setBusy(true);
    try {
      await adminApi(`/push/automations/${a.key}`, { method: "PUT", body: JSON.stringify(patch) });
      toast.success(ok);
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={cn("space-y-4 rounded-xl border bg-card p-5 transition", !a.enabled && "opacity-70")}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{a.label}</p>
          <p className="text-sm text-muted-foreground">{a.when}</p>
          <p className="mt-1 text-xs text-muted-foreground">{a.sent ? `Enviada ${a.sent} ${a.sent === 1 ? "vez" : "veces"} · la última el ${dateTime(a.lastSent)}` : a.fixedText ? "Se envía con cada mensaje" : "Aún no se ha enviado"}</p>
        </div>
        <Switch checked={a.enabled} disabled={busy} onCheckedChange={(v) => save({ enabled: v }, v ? "Automatización activada" : "Automatización desactivada")} aria-label={a.enabled ? "Desactivar" : "Activar"} />
      </div>
      {a.fixedText ? (
        <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground">El título es «{a.title}» y el texto es el mismo mensaje del chat.</p>
      ) : (
        <>
          <MessageFields idPrefix={`auto-${a.key}`} {...msg} vars={a.vars} onChange={(p) => setMsg((m) => ({ ...m, ...p }))} />
          <Preview title={msg.title} body={msg.body} />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={!dirty || busy || !msg.title.trim() || !msg.body.trim()} onClick={() => save({ title: msg.title, body: msg.body, url }, "Texto guardado")}>{busy ? <IconLoader2 size={16} className="animate-spin" /> : <IconCheck size={16} />} Guardar</Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => sendTest(msg.title, msg.body, url).catch((e) => toast.error(e.message))}><IconTestPipe size={16} /> Probar</Button>
            {!isDefault && <Button size="sm" variant="ghost" disabled={busy} onClick={() => save({ title: a.defaults.title, body: a.defaults.body, url: a.defaults.url ?? "" }, "Texto original restaurado")}><IconRestore size={16} /> Texto original</Button>}
          </div>
        </>
      )}
    </section>
  );
}

/* ───────────────────────── Historial ───────────────────────── */

function audienceText(c: Campaign, automations: Automation[]) {
  if (c.kind === "AUTO") return automations.find((a) => a.key === c.trigger)?.label ?? "Automática";
  const n = c.audience?.businessIds?.length ?? 0;
  const place = c.audience?.mode === "all" ? "Todos los comercios" : n === 1 ? "1 comercio" : `${n} comercios`;
  return `${place} · ${c.audience?.who === "team" ? "todo el equipo" : "dueños"}`;
}

function History({ campaigns, automations, onOpen }: { campaigns: Campaign[] | undefined; automations: Automation[]; onOpen: (id: string) => void }) {
  const [kind, setKind] = useState("ALL");
  const rows = useMemo(() => (campaigns ?? []).filter((c) => kind === "ALL" || c.kind === kind), [campaigns, kind]);
  const columns: ColumnDef<Campaign>[] = [
    {
      id: "title", header: "Notificación", accessorFn: (c) => `${c.title} ${c.body}`,
      cell: ({ row: { original: c } }) => (
        <div className="min-w-0 max-w-md">
          <p className="truncate font-semibold">{c.title}</p>
          <p className="truncate text-xs text-muted-foreground">{c.body}</p>
        </div>
      ),
    },
    { id: "kind", header: "Tipo", accessorFn: (c) => c.kind, cell: ({ row: { original: c } }) => <Badge variant="outline" className={c.kind === "AUTO" ? "border-violet-600/30 bg-violet-600/10 text-violet-700" : "border-primary/30 bg-primary/10 text-primary"}>{c.kind === "AUTO" ? "Automática" : "Manual"}</Badge> },
    { id: "to", header: "Para", accessorFn: (c) => audienceText(c, automations) },
    { id: "reach", header: "Recibida", accessorFn: (c) => c.reached, cell: ({ row: { original: c } }) => <span className="tabular-nums">{c.reached}/{c.recipients}</span> },
    { id: "date", header: "Fecha", accessorFn: (c) => c.createdAt, cell: ({ row: { original: c } }) => dateTime(c.createdAt) },
  ];
  return (
    <PosTable
      columns={columns}
      data={rows}
      loading={!campaigns}
      getRowId={(c) => c.id}
      onRowClick={(c) => onOpen(c.id)}
      searchPlaceholder="Buscar notificación…"
      emptyMessage="Todavía no se ha enviado ninguna notificación."
      actions={
        <div className="flex rounded-lg border bg-muted/40 p-0.5">
          {[{ k: "ALL", l: "Todas" }, { k: "MANUAL", l: "Manuales" }, { k: "AUTO", l: "Automáticas" }].map((t) => (
            <button key={t.k} type="button" onClick={() => setKind(t.k)} className={cn("rounded-md px-3 py-1.5 text-sm transition", kind === t.k ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground")}>{t.l}</button>
          ))}
        </div>
      }
    />
  );
}

function CampaignSheet({ id, automations, onClose }: { id: string | null; automations: Automation[]; onClose: () => void }) {
  const [c, setC] = useState<Detail | null>(null);
  useEffect(() => {
    setC(null);
    if (id) adminApi<Detail>(`/push/campaigns/${id}`).then(setC).catch((e) => toast.error(e.message));
  }, [id]);
  return (
    <Sheet open={!!id} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-lg">
        <SheetHeader className="border-b px-6 py-5">
          <SheetTitle>{c?.title ?? "Notificación"}</SheetTitle>
          <SheetDescription>{c ? `${c.kind === "AUTO" ? "Automática" : "Manual"} · ${audienceText(c, automations)} · ${dateTime(c.createdAt)}` : "Cargando…"}</SheetDescription>
        </SheetHeader>
        {c && (
          <div className="space-y-5 px-6 py-5 text-sm">
            <Preview title={c.title} body={c.body} />
            {c.url && <p className="text-muted-foreground">Al tocarla abre <code>{c.url}</code></p>}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg border p-2"><p className="text-lg font-semibold tabular-nums">{c.recipients}</p><p className="text-xs text-muted-foreground">Personas</p></div>
              <div className="rounded-lg border p-2"><p className="text-lg font-semibold tabular-nums text-emerald-700">{c.reached}</p><p className="text-xs text-muted-foreground">La recibieron</p></div>
              <div className="rounded-lg border p-2"><p className="text-lg font-semibold tabular-nums">{c.devices}</p><p className="text-xs text-muted-foreground">Dispositivos</p></div>
            </div>
            <div className="divide-y rounded-lg border">
              {c.deliveries.map((d) => (
                <div key={d.id} className="flex items-center gap-3 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{d.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{[d.business, d.email].filter(Boolean).join(" · ")}</p>
                  </div>
                  {d.status === "SENT"
                    ? <Badge variant="outline" className="border-emerald-600/30 bg-emerald-600/10 text-emerald-700">Recibida{d.sentAt ? ` · ${dateTime(d.sentAt)}` : ""}</Badge>
                    : <Badge variant="outline" className="text-muted-foreground">Esperando que active las notificaciones</Badge>}
                </div>
              ))}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
