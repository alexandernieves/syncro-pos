"use client";

import { useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { IconBrandWhatsapp, IconDeviceFloppy, IconDeviceMobile, IconFileText, IconLoader2, IconPlus, IconRefresh, IconShieldCheck, IconSnowflake, IconTicket, IconWorld } from "@tabler/icons-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { gymApi } from "@/lib/gym";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PosTable } from "@/components/pos-table";
import { GymPage, GymPageHeader, PersonCell } from "@/components/gym/gym-ui";
import { WhatsAppPreview } from "@/components/gym/whatsapp-preview";
import { DAYS, MINUTES, OptionSelect, TIMES, type Unit } from "@/components/forms/option-select";

type NoticeKind = "CLASS_CANCELLED" | "CLASS_MOVED" | "WAITLIST_PROMOTED" | "TRIAL_BOOKED";
type Settings = {
  timeZone: string;
  booking: { portalEnabled: boolean; daysAhead: number; cancelHours: number; maxActive: number };
  notices: Record<NoticeKind, boolean> & { templates: Record<NoticeKind, string> };
  visits: { dayPassPrice: number; leadFromVisit: boolean };
  access: { graceDays: number; blockIfOwed: boolean; owedTolerance: number; reentryMinutes: number; requireSignatures: boolean };
  freeze: { minDays: number; maxTimes: number; fee: number; requireReason: boolean };
  renewal: { startFrom: "END" | "TODAY" | "END_IF_GRACE"; graceDays: number; earlyDays: number; earlyDiscountPct: number; enrollmentFee: number; reactivationFee: number; reactivationAfterDays: number };
};
type DocTemplate = { id: string; kind: string; title: string; body: string; required: boolean; version: number; isActive: boolean; _count: { signatures: number } };
const DOC_KINDS: [string, string][] = [["WAIVER", "Exoneración"], ["CONTRACT", "Contrato"], ["HEALTH", "Salud"], ["PHOTO", "Fotos y datos"], ["OTHER", "Otro"]];
type NoticeRow = {
  id: string;
  kind: NoticeKind;
  status: "SENT" | "FAILED" | "SKIPPED";
  error: string | null;
  text: string | null;
  createdAt: string;
  member: { id: string; memberNumber: number; client: { name: string } } | null;
};

const TIME_ZONES: [string, string][] = [
  ["America/Caracas", "Venezuela (Caracas)"],
  ["America/Bogota", "Colombia (Bogotá)"],
  ["America/Lima", "Perú (Lima)"],
  ["America/Panama", "Panamá"],
  ["America/Santo_Domingo", "República Dominicana"],
  ["America/Mexico_City", "México (Ciudad de México)"],
  ["America/Santiago", "Chile (Santiago)"],
  ["America/Argentina/Buenos_Aires", "Argentina (Buenos Aires)"],
  ["America/New_York", "Estados Unidos (Este)"],
  ["Europe/Madrid", "España (Madrid)"],
];

const NOTICES: { kind: NoticeKind; title: string; when: string; placeholders: [string, string][]; sample: Record<string, string> }[] = [
  {
    kind: "CLASS_CANCELLED",
    title: "Clase cancelada",
    when: "Cuando cancelas una sesión, a todos los anotados y en espera.",
    placeholders: [["{nombre}", "Nombre"], ["{clase}", "Clase"], ["{fecha}", "Fecha y hora"], ["{motivo}", "Motivo"], ["{gimnasio}", "Gimnasio"]],
    sample: { nombre: "Laura", clase: "Spinning", fecha: "martes, 13 de octubre, 9:00 a. m.", motivo: " Motivo: mantenimiento de bicicletas.", gimnasio: "" },
  },
  {
    kind: "CLASS_MOVED",
    title: "Cambio de horario",
    when: "Cuando arrastras una sesión a otra hora en el horario.",
    placeholders: [["{nombre}", "Nombre"], ["{clase}", "Clase"], ["{fecha}", "Nueva fecha"], ["{antes}", "Horario anterior"], ["{gimnasio}", "Gimnasio"]],
    sample: { nombre: "Laura", clase: "Yoga", fecha: "jueves, 15 de octubre, 7:00 p. m.", antes: "jueves, 15 de octubre, 6:30 p. m.", gimnasio: "" },
  },
  {
    kind: "WAITLIST_PROMOTED",
    title: "Cupo desde la lista de espera",
    when: "Cuando alguien cancela y el primero en espera toma el cupo.",
    placeholders: [["{nombre}", "Nombre"], ["{clase}", "Clase"], ["{fecha}", "Fecha y hora"], ["{gimnasio}", "Gimnasio"]],
    sample: { nombre: "Carlos", clase: "Crossfit", fecha: "lunes, 12 de octubre, 7:00 p. m.", gimnasio: "" },
  },
  {
    kind: "TRIAL_BOOKED",
    title: "Clase de prueba",
    when: "Cuando le agendas una clase de prueba a un prospecto.",
    placeholders: [["{nombre}", "Nombre"], ["{clase}", "Clase"], ["{fecha}", "Fecha y hora"], ["{gimnasio}", "Gimnasio"]],
    sample: { nombre: "Andrés", clase: "Funcional", fecha: "miércoles, 14 de octubre, 6:00 p. m.", gimnasio: "" },
  },
];

const KIND_LABEL: Record<NoticeKind, string> = { CLASS_CANCELLED: "Clase cancelada", CLASS_MOVED: "Cambio de horario", WAITLIST_PROMOTED: "Cupo liberado", TRIAL_BOOKED: "Clase de prueba" };
const STATUS_BADGE: Record<NoticeRow["status"], { label: string; cls: string }> = {
  SENT: { label: "Enviado", cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700" },
  FAILED: { label: "Falló", cls: "border-rose-500/30 bg-rose-500/10 text-rose-700" },
  SKIPPED: { label: "No enviado", cls: "text-muted-foreground" },
};

/** A setting picked from sensible options (or a custom value inside its range): no free typing. */
function NumberField({ label, hint, value, onChange, options, unit, min, max, zeroLabel }: { label: string; hint: string; value: number; onChange: (v: number) => void; options: number[]; unit: Unit; min: number; max: number; zeroLabel?: string }) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">{label}</p>
      <OptionSelect value={value} onChange={onChange} options={options} unit={unit} min={min} max={max} zeroLabel={zeroLabel} className="max-w-56" />
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function MoneyField({ label, hint, value, onChange, options, max = 500, zeroLabel = "Gratis" }: { label: string; hint: string; value: number; onChange: (v: number) => void; options: number[]; max?: number; zeroLabel?: string }) {
  return <NumberField label={label} hint={hint} value={value} onChange={onChange} options={options} unit="money" min={0} max={max} zeroLabel={zeroLabel} />;
}

function SwitchField({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start justify-between gap-4">
      <span className="space-y-1">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

/** Contracts and consents: versioned texts the members sign at reception or in their app. */
function DocumentsCard() {
  const [docs, setDocs] = useState<DocTemplate[] | null>(null);
  const [starters, setStarters] = useState<{ kind: string; title: string; body: string }[]>([]);
  const [draft, setDraft] = useState<Partial<DocTemplate> | null>(null);
  const [saving, setSaving] = useState(false);
  const load = () => gymApi<DocTemplate[]>("/documents").then(setDocs).catch(() => setDocs([]));
  useEffect(() => { load(); gymApi<typeof starters>("/documents/starters").then(setStarters).catch(() => {}); }, []);
  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const body = { kind: draft.kind, title: draft.title, body: draft.body, required: draft.required, isActive: draft.isActive };
      const before = docs?.find((d) => d.id === draft.id);
      const saved = await gymApi<DocTemplate>(draft.id ? `/documents/${draft.id}` : "/documents", { method: draft.id ? "PUT" : "POST", json: body });
      toast.success(before && saved.version > before.version ? `Guardado como versión ${saved.version}: los socios deberán firmarlo de nuevo` : "Documento guardado");
      setDraft(null);
      load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };
  const unused = starters.filter((st) => !docs?.some((d) => d.title === st.title));
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1.5">
            <CardTitle className="flex items-center gap-2"><IconFileText size={18} className="text-muted-foreground" /> Contratos y consentimientos</CardTitle>
            <CardDescription>Los socios los firman en la pantalla de recepción. Si cambias el texto, se pide una firma nueva.</CardDescription>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setDraft({ kind: "OTHER", title: "", body: "", required: true, isActive: true })}><IconPlus size={14} /> Nuevo documento</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {docs?.map((d) => (
          <div key={d.id} className={cn("flex items-center gap-3 rounded-xl bg-muted/40 p-3", !d.isActive && "opacity-60")}>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-background text-muted-foreground"><IconFileText size={18} /></span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{d.title}</p>
              <p className="text-xs text-muted-foreground">{DOC_KINDS.find(([k]) => k === d.kind)?.[1]} · versión {d.version} · {d._count.signatures} {d._count.signatures === 1 ? "firma" : "firmas"} · {d.required ? "obligatorio" : "opcional"}{d.isActive ? "" : " · desactivado"}</p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setDraft(d)}>Editar</Button>
          </div>
        ))}
        {docs && !docs.length && <p className="text-sm text-muted-foreground">Todavía no tienes documentos. Empieza con una plantilla:</p>}
        {unused.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {unused.map((st) => (
              <button key={st.title} type="button" onClick={() => setDraft({ ...st, required: true, isActive: true })} className="flex items-center gap-1.5 rounded-full border border-dashed px-3 py-1.5 text-xs text-muted-foreground hover:border-primary hover:text-primary">
                <IconPlus size={12} /> {st.title}
              </button>
            ))}
          </div>
        )}
      </CardContent>
      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Editar documento" : "Nuevo documento"}</DialogTitle>
            <DialogDescription>Usa {"{nombre}"}, {"{cedula}"}, {"{plan}"}, {"{fecha}"} y {"{gimnasio}"}: se completan con los datos del socio al firmar.</DialogDescription>
          </DialogHeader>
          {draft && (
            <div className="grid gap-3">
              <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
                <Input value={draft.title ?? ""} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Título" />
                <select value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value })} className="h-9 rounded-md border bg-background px-2 text-sm">
                  {DOC_KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
              </div>
              <textarea value={draft.body ?? ""} onChange={(e) => setDraft({ ...draft, body: e.target.value })} rows={14} className="w-full resize-y rounded-lg border bg-background px-3 py-2 text-sm leading-relaxed outline-none focus:border-primary" />
              <SwitchField label="Obligatorio" hint="Todos los socios deben firmarlo. En recepción verás quién falta." checked={!!draft.required} onChange={(v) => setDraft({ ...draft, required: v })} />
              {draft.id && <SwitchField label="Activo" hint="Desactívalo para dejar de pedirlo; las firmas anteriores se guardan." checked={!!draft.isActive} onChange={(v) => setDraft({ ...draft, isActive: v })} />}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>Cancelar</Button>
            <Button onClick={save} disabled={saving || !draft?.title?.trim() || !draft?.body?.trim()} className="gap-2">{saving && <IconLoader2 size={16} className="animate-spin" />} Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export default function GymSettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saved, setSaved] = useState("");
  const [saving, setSaving] = useState(false);
  const [log, setLog] = useState<NoticeRow[] | null>(null);
  const [businessName, setBusinessName] = useState("tu gimnasio");

  useEffect(() => {
    gymApi<Settings>("/settings").then((s) => { setSettings(s); setSaved(JSON.stringify(pick(s))); }).catch((e) => toast.error(e.message));
    gymApi<NoticeRow[]>("/notifications").then(setLog).catch(() => setLog([]));
    try { setBusinessName(localStorage.getItem("businessName") || "tu gimnasio"); } catch {}
  }, []);

  const pick = (s: Settings) => ({ timeZone: s.timeZone, booking: s.booking, notices: s.notices, visits: s.visits, access: s.access, freeze: s.freeze, renewal: s.renewal });
  const dirty = !!settings && JSON.stringify(pick(settings)) !== saved;
  const setBooking = (patch: Partial<Settings["booking"]>) => setSettings((s) => (s ? { ...s, booking: { ...s.booking, ...patch } } : s));
  const setSection = <K extends "access" | "freeze" | "renewal">(key: K, patch: Partial<Settings[K]>) => setSettings((s) => (s ? { ...s, [key]: { ...s[key], ...patch } } : s));
  const setVisits = (patch: Partial<Settings["visits"]>) => setSettings((s) => (s ? { ...s, visits: { ...s.visits, ...patch } } : s));
  const setNotice = (kind: NoticeKind, on: boolean) => setSettings((s) => (s ? { ...s, notices: { ...s.notices, [kind]: on } } : s));
  const setTemplate = (kind: NoticeKind, text: string) => setSettings((s) => (s ? { ...s, notices: { ...s.notices, templates: { ...s.notices.templates, [kind]: text } } } : s));

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const next = await gymApi<Settings>("/settings", { method: "PUT", json: pick(settings) });
      setSettings(next);
      setSaved(JSON.stringify(pick(next)));
      toast.success("Ajustes guardados");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const columns = useMemo<ColumnDef<NoticeRow>[]>(
    () => [
      { id: "member", header: "Socio", accessorFn: (r) => r.member?.client.name ?? "", cell: ({ row }) => (row.original.member ? <PersonCell name={row.original.member.client.name} sub={`N.º ${row.original.member.memberNumber}`} /> : "—") },
      { id: "kind", header: "Aviso", accessorFn: (r) => KIND_LABEL[r.kind], cell: ({ getValue }) => <span>{getValue<string>()}</span> },
      {
        id: "status",
        header: "Estado",
        accessorFn: (r) => STATUS_BADGE[r.status].label,
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <Badge variant="outline" className={STATUS_BADGE[row.original.status].cls}>{STATUS_BADGE[row.original.status].label}</Badge>
            {row.original.error && <p className="text-xs text-muted-foreground">{row.original.error}</p>}
          </div>
        ),
      },
      { id: "date", header: "Fecha", accessorFn: (r) => r.createdAt, cell: ({ getValue }) => <span className="text-muted-foreground tabular-nums">{new Date(getValue<string>()).toLocaleString("es-VE", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</span> },
    ],
    [],
  );

  if (!settings) {
    return (
      <GymPage>
        <GymPageHeader title="Ajustes del gimnasio" description="Reglas de acceso, reservas, renovaciones, documentos y avisos a tus socios." />
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
      </GymPage>
    );
  }
  const b = settings.booking;

  return (
    <GymPage>
      <GymPageHeader
        title="Ajustes del gimnasio"
        description="Reglas de acceso, reservas, renovaciones, documentos y avisos a tus socios."
        actions={
          <Button onClick={save} disabled={!dirty || saving} className="gap-2">
            {saving ? <IconLoader2 size={16} className="animate-spin" /> : <IconDeviceFloppy size={16} />} {dirty ? "Guardar cambios" : "Guardado"}
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><IconWorld size={18} className="text-muted-foreground" /> General</CardTitle>
          <CardDescription>El horario de clases, los vencimientos y los recordatorios usan esta zona horaria.</CardDescription>
        </CardHeader>
        <CardContent>
          <label className="flex max-w-sm flex-col gap-1.5 text-sm font-medium">
            Zona horaria
            <select value={settings.timeZone} onChange={(e) => setSettings({ ...settings, timeZone: e.target.value })} className="h-9 rounded-md border bg-background px-2 text-sm font-normal">
              {TIME_ZONES.map(([tz, label]) => <option key={tz} value={tz}>{label}</option>)}
            </select>
          </label>
        </CardContent>
      </Card>


      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><IconShieldCheck size={18} className="text-muted-foreground" /> Acceso en la entrada</CardTitle>
          <CardDescription>Reglas para todos los planes. Los horarios y límites de entradas se configuran en cada plan.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2">
          <NumberField label="Días de gracia" value={settings.access.graceDays} onChange={(v) => setSection("access", { graceDays: v })} hint="Después de vencer puede seguir entrando estos días, con aviso de renovar." options={[0, 1, 2, 3, 5, 7, 10, 15]} unit={DAYS} min={0} max={30} zeroLabel="Sin días de gracia" />
          <NumberField label="Tiempo entre entradas" value={settings.access.reentryMinutes} onChange={(v) => setSection("access", { reentryMinutes: v })} hint="Evita que dos personas usen la misma membresía: tras entrar, debe pasar este tiempo para volver a entrar." options={[0, 15, 30, 45, 60, 90, 120, 180]} unit={MINUTES} min={0} max={600} zeroLabel="Sin revisar" />
          <SwitchField label="Bloquear si debe dinero" hint="Si está apagado, recepción solo ve un aviso de la deuda." checked={settings.access.blockIfOwed} onChange={(v) => setSection("access", { blockIfOwed: v })} />
          {settings.access.blockIfOwed ? <MoneyField label="Deuda tolerada" hint="Puede entrar si debe hasta este monto." value={settings.access.owedTolerance} onChange={(v) => setSection("access", { owedTolerance: v })} options={[0, 1, 2, 5, 10, 20]} max={1000} zeroLabel="Nada ($0.00)" /> : <span />}
          <SwitchField label="Exigir documentos firmados" hint="No entra hasta firmar los documentos obligatorios. Si está apagado, solo se avisa." checked={settings.access.requireSignatures} onChange={(v) => setSection("access", { requireSignatures: v })} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><IconSnowflake size={18} className="text-muted-foreground" /> Congelamiento</CardTitle>
          <CardDescription>Los días que se pueden congelar se definen en cada plan. Se puede programar con fecha de regreso y se reactiva solo.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2">
          <NumberField label="Mínimo por congelamiento" value={settings.freeze.minDays} onChange={(v) => setSection("freeze", { minDays: v })} hint="Congelamientos más cortos no se aceptan." options={[1, 3, 5, 7, 10, 14, 15, 30]} unit={DAYS} min={1} max={90} />
          <NumberField label="Veces por membresía" value={settings.freeze.maxTimes} onChange={(v) => setSection("freeze", { maxTimes: v })} hint="El máximo de días lo pone cada plan." options={[0, 1, 2, 3, 4, 6]} unit={TIMES} min={0} max={12} zeroLabel="Sin límite" />
          <MoneyField label="Costo por congelar" hint="Se suma a lo que debe el socio." value={settings.freeze.fee} onChange={(v) => setSection("freeze", { fee: v })} options={[0, 1, 2, 3, 5, 10]} />
          <SwitchField label="Pedir motivo" hint="Viaje, lesión, trabajo… queda en la ficha del socio." checked={settings.freeze.requireReason} onChange={(v) => setSection("freeze", { requireReason: v })} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><IconRefresh size={18} className="text-muted-foreground" /> Renovaciones e inscripción</CardTitle>
          <CardDescription>Se aplican solas al vender un plan; recepción ve el detalle antes de cobrar.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <p className="text-sm font-medium">Si renueva después de vencer, el plan nuevo empieza…</p>
            <div className="flex flex-wrap gap-1.5">
              {([["END_IF_GRACE", "Desde el vencimiento si vuelve a tiempo"], ["TODAY", "El día que paga"], ["END", "Siempre desde el vencimiento"]] as const).map(([k, l]) => (
                <button key={k} type="button" onClick={() => setSection("renewal", { startFrom: k })} className={cn("rounded-full border px-3 py-1.5 text-xs", settings.renewal.startFrom === k ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground")}>{l}</button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Quien renueva antes de vencer nunca pierde días: el plan nuevo empieza cuando termina el actual.</p>
          </div>
          {settings.renewal.startFrom === "END_IF_GRACE" && <NumberField label="Volver a tiempo" value={settings.renewal.graceDays} onChange={(v) => setSection("renewal", { graceDays: v })} hint="Hasta cuántos días después de vencer se mantiene la fecha." options={[0, 1, 2, 3, 5, 7, 10, 15, 30]} unit={DAYS} min={0} max={60} zeroLabel="Solo el mismo día" />}
          <NumberField label="Descuento por renovar antes" value={settings.renewal.earlyDiscountPct} onChange={(v) => setSection("renewal", { earlyDiscountPct: v })} hint="Se aplica solo si renueva con la anticipación indicada." options={[0, 5, 10, 15, 20, 25, 30]} unit="percent" min={0} max={50} zeroLabel="Sin descuento" />
          <NumberField label="Para el descuento, renovar con" value={settings.renewal.earlyDays} onChange={(v) => setSection("renewal", { earlyDays: v })} hint="Cuántos días antes de vencer debe renovar como mínimo." options={[1, 3, 5, 7, 10, 15, 30]} unit={DAYS} min={1} max={60} />
          <MoneyField label="Inscripción" hint="Cobro único la primera vez que alguien compra un plan." value={settings.renewal.enrollmentFee} onChange={(v) => setSection("renewal", { enrollmentFee: v })} options={[0, 5, 10, 15, 20, 25, 30]} max={1000} zeroLabel="Sin inscripción" />
          <MoneyField label="Reinscripción" hint="Para quien vuelve después de mucho tiempo vencido." value={settings.renewal.reactivationFee} onChange={(v) => setSection("renewal", { reactivationFee: v })} options={[0, 5, 8, 10, 15, 20, 25]} max={1000} zeroLabel="Sin reinscripción" />
          <NumberField label="Se cobra la reinscripción después de" value={settings.renewal.reactivationAfterDays} onChange={(v) => setSection("renewal", { reactivationAfterDays: v })} hint="Antes de eso solo paga el plan." options={[15, 30, 45, 60, 90, 180, 365]} unit={DAYS} min={1} max={365} />
        </CardContent>
      </Card>

      <DocumentsCard />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><IconTicket size={18} className="text-muted-foreground" /> Visitas y pases</CardTitle>
          <CardDescription>Para quien entra sin membresía: invitados de socios, pases de día y visitas.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2">
          <MoneyField label="Precio del pase de día" hint="También se cobra a un invitado cuando el socio ya usó sus pases gratis del mes (se configuran en cada plan)." value={settings.visits.dayPassPrice} onChange={(v) => setVisits({ dayPassPrice: v })} options={[1, 2, 3, 5, 7, 10, 15]} zeroLabel="Gratis" />
          <label className="flex items-start justify-between gap-4">
            <span className="space-y-1">
              <span className="block text-sm font-medium">Guardar como prospecto</span>
              <span className="block text-xs text-muted-foreground">Los invitados y pases de día con WhatsApp quedan como prospectos para invitarlos a inscribirse.</span>
            </span>
            <Switch checked={settings.visits.leadFromVisit} onCheckedChange={(v) => setVisits({ leadFromVisit: v })} />
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><IconBrandWhatsapp size={18} className="text-muted-foreground" /> Avisos de clases por WhatsApp</CardTitle>
          <CardDescription>Se envían solos desde el WhatsApp del negocio, de uno en uno y espaciados para cuidar tu número.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {NOTICES.map((n) => {
            const on = settings.notices[n.kind];
            return (
              <div key={n.kind} className={cn("space-y-3 rounded-xl bg-muted/40 p-4", !on && "opacity-70")}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{n.title}</p>
                    <p className="text-xs text-muted-foreground">{n.when}</p>
                  </div>
                  <Switch checked={on} onCheckedChange={(v) => setNotice(n.kind, v)} />
                </div>
                <textarea
                  value={settings.notices.templates[n.kind]}
                  onChange={(e) => setTemplate(n.kind, e.target.value)}
                  rows={4}
                  disabled={!on}
                  className="w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary disabled:opacity-60"
                />
                <div className="flex flex-wrap gap-1">
                  {n.placeholders.map(([token, label]) => (
                    <button key={token} type="button" disabled={!on} onClick={() => setTemplate(n.kind, `${settings.notices.templates[n.kind]} ${token}`)} className="rounded-full border bg-background px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-50" title={`Insertar ${label.toLowerCase()}`}>
                      {token}
                    </button>
                  ))}
                </div>
                <WhatsAppPreview text={settings.notices.templates[n.kind]} vars={{ ...n.sample, gimnasio: businessName }} />
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card className="gap-4">
        <CardHeader>
          <CardTitle>Últimos avisos</CardTitle>
          <CardDescription>Los 100 más recientes. Un aviso queda sin enviar si el socio no tiene WhatsApp o si el del negocio estaba desconectado.</CardDescription>
        </CardHeader>
        <CardContent>
          <PosTable columns={columns} data={log ?? []} loading={!log} searchPlaceholder="Buscar socio…" getRowId={(r) => r.id} emptyMessage="Todavía no se ha enviado ningún aviso." skeletonRows={3} />
        </CardContent>
      </Card>
    </GymPage>
  );
}
