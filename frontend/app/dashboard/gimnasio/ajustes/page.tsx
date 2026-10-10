"use client";

import { useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { IconBrandWhatsapp, IconDeviceFloppy, IconDeviceMobile, IconLoader2, IconTicket, IconWorld } from "@tabler/icons-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { gymApi } from "@/lib/gym";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { PosTable } from "@/components/pos-table";
import { GymPage, GymPageHeader, PersonCell } from "@/components/gym/gym-ui";
import { WhatsAppPreview } from "@/components/gym/whatsapp-preview";

type NoticeKind = "CLASS_CANCELLED" | "CLASS_MOVED" | "WAITLIST_PROMOTED" | "TRIAL_BOOKED";
type Settings = {
  timeZone: string;
  booking: { portalEnabled: boolean; daysAhead: number; cancelHours: number; maxActive: number };
  notices: Record<NoticeKind, boolean> & { templates: Record<NoticeKind, string> };
  visits: { dayPassPrice: number; leadFromVisit: boolean };
};
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

function NumberField({ label, hint, value, min, max, suffix, onChange }: { label: string; hint: string; value: number; min: number; max: number; suffix: string; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">{label}</p>
      <div className="flex items-center gap-2">
        <Input type="number" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="h-9 w-20 text-center tabular-nums" />
        <span className="text-sm text-muted-foreground">{suffix}</span>
      </div>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
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

  const pick = (s: Settings) => ({ timeZone: s.timeZone, booking: s.booking, notices: s.notices, visits: s.visits });
  const dirty = !!settings && JSON.stringify(pick(settings)) !== saved;
  const setBooking = (patch: Partial<Settings["booking"]>) => setSettings((s) => (s ? { ...s, booking: { ...s.booking, ...patch } } : s));
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
        <GymPageHeader title="Ajustes del gimnasio" description="Reglas de reservas y avisos a tus socios." />
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
      </GymPage>
    );
  }
  const b = settings.booking;

  return (
    <GymPage>
      <GymPageHeader
        title="Ajustes del gimnasio"
        description="Reglas de reservas y avisos a tus socios."
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
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1.5">
              <CardTitle className="flex items-center gap-2"><IconDeviceMobile size={18} className="text-muted-foreground" /> Reservas desde la app del socio</CardTitle>
              <CardDescription>Tus socios reservan y cancelan clases desde su app de Syncro. En recepción siempre puedes anotarlos sin estas reglas.</CardDescription>
            </div>
            <label className="flex items-center gap-2 text-sm font-medium">
              {b.portalEnabled ? "Activadas" : "Desactivadas"}
              <Switch checked={b.portalEnabled} onCheckedChange={(v) => setBooking({ portalEnabled: v })} />
            </label>
          </div>
        </CardHeader>
        <CardContent className={cn("grid gap-6 sm:grid-cols-3", !b.portalEnabled && "pointer-events-none opacity-50")}>
          <NumberField label="Anticipación" suffix={b.daysAhead === 1 ? "día" : "días"} min={1} max={30} value={b.daysAhead} onChange={(v) => setBooking({ daysAhead: v })} hint="Hasta cuántos días antes pueden reservar." />
          <NumberField label="Cancelar hasta" suffix={b.cancelHours === 1 ? "hora antes" : "horas antes"} min={0} max={72} value={b.cancelHours} onChange={(v) => setBooking({ cancelHours: v })} hint="Después de eso deben avisar en recepción. Con 0 pueden cancelar hasta que empiece." />
          <NumberField label="Reservas a la vez" suffix="por socio" min={0} max={50} value={b.maxActive} onChange={(v) => setBooking({ maxActive: v })} hint="Clases futuras que puede tener reservadas. Con 0 no hay límite." />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><IconTicket size={18} className="text-muted-foreground" /> Visitas y pases</CardTitle>
          <CardDescription>Para quien entra sin membresía: invitados de socios, pases de día y visitas.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-1.5">
            <p className="text-sm font-medium">Precio del pase de día</p>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">$</span>
              <Input value={settings.visits.dayPassPrice} onChange={(e) => setVisits({ dayPassPrice: Number(e.target.value.replace(/[^\d.]/g, "")) || 0 })} className="h-9 w-24 text-right tabular-nums" inputMode="decimal" />
            </div>
            <p className="text-xs text-muted-foreground">También se cobra a un invitado cuando el socio ya usó sus pases gratis del mes (se configuran en cada plan).</p>
          </div>
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
