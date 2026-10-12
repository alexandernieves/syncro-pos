"use client";

import { useEffect, useMemo, useState } from "react";
import { IconBrandWhatsapp, IconCircleCheckFilled, IconCircleXFilled, IconDeviceFloppy, IconLoader2, IconSend } from "@tabler/icons-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { API_URL } from "@/lib/constants";
import { gymApi, shortDate } from "@/lib/gym";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { StatCard, StatGrid } from "@/components/stat-card";
import { GymPage, GymPageHeader } from "@/components/gym/gym-ui";
import { WhatsAppPreview } from "@/components/gym/whatsapp-preview";
import { OptionSelect } from "@/components/forms/option-select";

type Kind = "BEFORE" | "EXPIRY" | "AFTER";
type Settings = {
  timeZone: string;
  reminders: { enabled: boolean; daysBefore: number; onExpiry: boolean; afterDays: number; hour: number; templates: Record<Kind, string> };
};
type Pending = { membershipId: string; memberId: string; name: string; planName: string; endDate: string; kind: Kind };
type LogRow = {
  id: string;
  kind: Kind;
  status: "SENT" | "FAILED";
  error: string | null;
  manual: boolean;
  createdAt: string;
  member: { id: string; memberNumber: number; client: { name: string } };
  membership: { planName: string; endDate: string };
};

const KIND_LABEL: Record<Kind, string> = { BEFORE: "Vence pronto", EXPIRY: "Vence hoy", AFTER: "Ya venció" };
const PLACEHOLDERS: [string, string][] = [["{nombre}", "Nombre"], ["{plan}", "Plan"], ["{fecha}", "Fecha de vencimiento"], ["{dias}", "Días"], ["{gimnasio}", "Gimnasio"]];
const hourLabel = (h: number) => `${h % 12 === 0 ? 12 : h % 12}:00 ${h < 12 ? "a. m." : "p. m."}`;

function Preview({ text, businessName, days }: { text: string; businessName: string; days: number }) {
  return <WhatsAppPreview text={text} vars={{ nombre: "Laura", plan: "Mensual", fecha: "13 de octubre", dias: String(days), gimnasio: businessName }} />;
}

export default function GymRemindersPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saved, setSaved] = useState("");
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState<Pending[] | null>(null);
  const [log, setLog] = useState<LogRow[] | null>(null);
  const [running, setRunning] = useState(false);
  const [businessName, setBusinessName] = useState("tu gimnasio");

  const loadLists = () => {
    gymApi<Pending[]>("/reminders/pending").then(setPending).catch(() => setPending([]));
    gymApi<LogRow[]>("/reminders").then(setLog).catch(() => setLog([]));
  };

  useEffect(() => {
    gymApi<Settings>("/settings").then((s) => { setSettings(s); setSaved(JSON.stringify(s)); }).catch((e) => toast.error(e.message));
    loadLists();
    try { setBusinessName(localStorage.getItem("businessName") || "tu gimnasio"); } catch {}
    fetch(`${API_URL}/settings`, { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data?.businessName && setBusinessName(data.businessName))
      .catch(() => {});
  }, []);

  const dirty = useMemo(() => settings && JSON.stringify(settings) !== saved, [settings, saved]);

  if (!settings) {
    return <div className="space-y-3 p-6"><Skeleton className="h-10 w-64" /><Skeleton className="h-64" /></div>;
  }
  const r = settings.reminders;
  const setR = (patch: Partial<Settings["reminders"]>) => setSettings((s) => (s ? { ...s, reminders: { ...s.reminders, ...patch } } : s));
  const setTemplate = (kind: Kind, value: string) => setR({ templates: { ...r.templates, [kind]: value } });

  const save = async () => {
    setSaving(true);
    try {
      const next = await gymApi<Settings>("/settings", { method: "PUT", json: { reminders: settings.reminders } });
      setSettings(next);
      setSaved(JSON.stringify(next));
      toast.success(next.reminders.enabled ? "Recordatorios automáticos activados" : "Configuración guardada");
      loadLists();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const runNow = async () => {
    setRunning(true);
    try {
      const res = await gymApi<{ sent: number; failed: number; skipped?: string }>("/reminders/run", { method: "POST" });
      if (res.skipped === "whatsapp") toast.error("El WhatsApp del negocio no está conectado. Conéctalo en el módulo de chat.");
      else toast.success(`${res.sent} recordatorios enviados${res.failed ? `, ${res.failed} fallaron` : ""}`);
      loadLists();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRunning(false);
    }
  };

  const kinds: { kind: Kind; title: string; enabled: boolean; days: number; control: React.ReactNode }[] = [
    {
      kind: "BEFORE",
      title: "Antes de vencer",
      enabled: r.daysBefore > 0,
      days: r.daysBefore || 3,
      control: (
        <div className="flex items-center gap-2 text-sm">
          <OptionSelect value={r.daysBefore} onChange={(v) => setR({ daysBefore: v })} options={[0, 1, 2, 3, 5, 7]} unit={{ one: "día antes", many: "días antes" }} min={0} max={30} zeroLabel="No enviar" className="h-8 min-w-32" />
        </div>
      ),
    },
    { kind: "EXPIRY", title: "El día que vence", enabled: r.onExpiry, days: 0, control: <Switch checked={r.onExpiry} onCheckedChange={(v) => setR({ onExpiry: v })} /> },
    {
      kind: "AFTER",
      title: "Si no renovó",
      enabled: r.afterDays > 0,
      days: r.afterDays || 3,
      control: (
        <div className="flex items-center gap-2 text-sm">
          <OptionSelect value={r.afterDays} onChange={(v) => setR({ afterDays: v })} options={[0, 1, 2, 3, 5, 7, 15, 30]} unit={{ one: "día después", many: "días después" }} min={0} max={60} zeroLabel="No enviar" className="h-8 min-w-36" />
        </div>
      ),
    },
  ];

  return (
    <GymPage>
      <GymPageHeader
        title="Recordatorios por WhatsApp"
        description="Avisa a tus socios antes y después de que venza su membresía, desde el WhatsApp del negocio."
        actions={
          <Button onClick={save} disabled={!dirty || saving} className="gap-2">
            {saving ? <IconLoader2 size={16} className="animate-spin" /> : <IconDeviceFloppy size={16} />} {dirty ? "Guardar cambios" : "Guardado"}
          </Button>
        }
      />
      <StatGrid cols={3}>
        <StatCard label="Envío automático" value={r.enabled ? "Activo" : "Apagado"} tone={r.enabled ? "good" : "default"} icon={<IconBrandWhatsapp size={20} />} title={r.enabled ? `Todos los días desde las ${hourLabel(r.hour)}` : "Solo envíos a mano"} hint="Desde el WhatsApp del negocio" />
        <StatCard label="Por enviar ahora" value={pending?.length ?? "—"} tone={pending?.length ? "warn" : "default"} icon={<IconSend size={20} />} title="Según la configuración guardada" hint="Puedes enviarlos con «Enviar ahora»" />
        <StatCard label="Enviados" value={log ? log.filter((l) => l.status === "SENT").length : "—"} icon={<IconCircleCheckFilled size={20} />} title={log?.some((l) => l.status === "FAILED") ? `${log.filter((l) => l.status === "FAILED").length} fallaron` : "Sin errores"} hint="Últimos 100 recordatorios" />
      </StatGrid>

      <Card className="gap-0 py-0">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="flex items-center gap-3">
            <span className={cn("flex size-11 items-center justify-center rounded-xl", r.enabled ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground")}><IconBrandWhatsapp size={24} /></span>
            <div>
              <p className="font-semibold">Envío automático</p>
              <p className="text-sm text-muted-foreground">{r.enabled ? `Se envían todos los días a partir de las ${hourLabel(r.hour)}.` : "Apagado. Puedes enviarlos a mano cuando quieras."}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              Desde las
              <select value={r.hour} onChange={(e) => setR({ hour: Number(e.target.value) })} className="h-9 rounded-md border bg-background px-2 text-sm">
                {Array.from({ length: 15 }, (_, i) => i + 7).map((h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
              </select>
            </label>
            <Switch checked={r.enabled} onCheckedChange={(v) => setR({ enabled: v })} />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-3">
        {kinds.map(({ kind, title, enabled, days, control }) => (
          <Card key={kind} className={cn("gap-0 py-0", !enabled && "opacity-70")}>
            <CardContent className="space-y-3 p-5">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold">{title}</p>
                {control}
              </div>
              <textarea
                value={r.templates[kind]}
                onChange={(e) => setTemplate(kind, e.target.value)}
                rows={4}
                disabled={!enabled}
                className="w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary disabled:opacity-60"
              />
              <div className="flex flex-wrap gap-1">
                {PLACEHOLDERS.map(([token, label]) => (
                  <button key={token} type="button" disabled={!enabled} onClick={() => setTemplate(kind, `${r.templates[kind]} ${token}`)} className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-50" title={`Insertar ${label.toLowerCase()}`}>
                    {token}
                  </button>
                ))}
              </div>
              <Preview text={r.templates[kind]} businessName={businessName} days={days} />
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="-mt-2 text-xs text-muted-foreground">Para apagar un aviso, elige que no se envíe. El texto entre *asteriscos* se ve en negrita en WhatsApp. Los mensajes salen de a uno y espaciados para cuidar tu número.</p>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="gap-0 py-0">
          <CardContent className="p-0">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div>
                <p className="font-semibold">Por enviar ahora</p>
                <p className="text-xs text-muted-foreground">Según la configuración guardada.</p>
              </div>
              <Button size="sm" className="gap-1.5" disabled={running || !pending?.length || !!dirty} onClick={runNow} title={dirty ? "Guarda los cambios primero" : undefined}>
                {running ? <IconLoader2 size={14} className="animate-spin" /> : <IconSend size={14} />} Enviar ahora
              </Button>
            </div>
            {!pending ? (
              <div className="p-4"><Skeleton className="h-10" /></div>
            ) : pending.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">No hay recordatorios pendientes.</p>
            ) : (
              <div className="divide-y">
                {pending.map((p) => (
                  <div key={p.membershipId + p.kind} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{p.name}</span>
                      <span className="block text-xs text-muted-foreground">{p.planName} · vence {shortDate(p.endDate)}</span>
                    </span>
                    <span className="shrink-0 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-700">{KIND_LABEL[p.kind]}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="gap-0 py-0">
          <CardContent className="p-0">
            <div className="border-b px-4 py-3">
              <p className="font-semibold">Enviados</p>
              <p className="text-xs text-muted-foreground">Los últimos 100 recordatorios.</p>
            </div>
            {!log ? (
              <div className="p-4"><Skeleton className="h-10" /></div>
            ) : log.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">Aún no se ha enviado ningún recordatorio.</p>
            ) : (
              <div className="max-h-[420px] divide-y overflow-y-auto">
                {log.map((l) => (
                  <div key={l.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                    {l.status === "SENT" ? <IconCircleCheckFilled size={18} className="shrink-0 text-emerald-600" /> : <IconCircleXFilled size={18} className="shrink-0 text-rose-600" />}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{l.member.client.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {KIND_LABEL[l.kind]}{l.manual ? " · a mano" : ""}{l.status === "FAILED" && l.error ? ` · ${l.error}` : ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">{new Date(l.createdAt).toLocaleString("es-VE", { dateStyle: "short", timeStyle: "short" })}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </GymPage>
  );
}
