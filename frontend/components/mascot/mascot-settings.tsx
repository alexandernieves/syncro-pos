"use client";

import { useEffect, useState } from "react";
import { IconBrain, IconLoader2, IconSparkles, IconTrash } from "@tabler/icons-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { SyncroAvatar } from "@/components/syncro-avatar";
import { type MascotSettings, isChristmasSeason, saveMascotSettings, useMascotSettings } from "@/lib/mascot";

const LEVELS = [
  { value: "less", label: "Menos" },
  { value: "default", label: "Predeterminado" },
  { value: "more", label: "Más" },
];

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-base font-semibold">{title}</h3>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      <div className="divide-y rounded-2xl border bg-card">{children}</div>
    </section>
  );
}

function Row({ title, description, children, htmlFor }: { title: string; description?: string; children: React.ReactNode; htmlFor?: string }) {
  return (
    <div className="flex items-center justify-between gap-6 px-5 py-4">
      <label htmlFor={htmlFor} className="min-w-0">
        <span className="block text-sm font-medium">{title}</span>
        {description && <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span>}
      </label>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Choice({ id, value, options, onChange }: { id: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} className="w-44 rounded-full"><SelectValue /></SelectTrigger>
      <SelectContent>{options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
    </Select>
  );
}

/**
 * Configuración → Mascota: show or hide Syncro, let it roam, its ideas and how often, its
 * personality (like ChatGPT's personalization), custom instructions and its memory.
 */
export function MascotSettingsPanel() {
  const settings = useMascotSettings();
  const [texts, setTexts] = useState({ name: "", instructions: "", aboutMe: "" });
  const [memory, setMemory] = useState<string[] | null>(null);
  const [savingTexts, setSavingTexts] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    if (settings) setTexts({ name: settings.name, instructions: settings.instructions, aboutMe: settings.aboutMe });
    // Only when they first load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings === null]);

  useEffect(() => {
    apiFetch("/mascot/memory").then(async (r) => setMemory(r.ok ? await r.json() : [])).catch(() => setMemory([]));
  }, []);

  if (!settings) {
    return <div className="flex justify-center py-20 text-muted-foreground"><IconLoader2 className="animate-spin" /></div>;
  }

  const save = async (patch: Partial<MascotSettings>, message?: string) => {
    try {
      await saveMascotSettings(patch);
      if (message) toast.success(message);
    } catch {
      toast.error("No se pudo guardar. Intenta de nuevo.");
    }
  };

  const textsChanged = texts.name !== settings.name || texts.instructions !== settings.instructions || texts.aboutMe !== settings.aboutMe;
  const saveTexts = async () => {
    setSavingTexts(true);
    await save({ name: texts.name.trim() || "Syncro", instructions: texts.instructions, aboutMe: texts.aboutMe }, "Listo, ya lo tengo en cuenta");
    setSavingTexts(false);
  };

  const clearMemory = async () => {
    setConfirmClear(false);
    const res = await apiFetch("/mascot/memory", { method: "DELETE" }).catch(() => null);
    if (res?.ok) { setMemory([]); toast.success("Memoria borrada"); } else toast.error("No se pudo borrar");
  };

  const name = settings.name || "Syncro";

  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-10">
      {/* Who it is */}
      <div className="flex items-center gap-5 rounded-3xl border bg-gradient-to-br from-card to-muted/40 p-5">
        <button type="button" onClick={() => setPreview((p) => !p)} className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-primary" title="Tócalo">
          <SyncroAvatar size={110} emotion={preview ? "happy" : undefined} festive={preview && isChristmasSeason()} />
        </button>
        <div className="min-w-0">
          <h2 className="text-xl font-semibold">{name}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Tu compañero en Syncro. Pasea por la pantalla, se le prende el bombillo cuando tiene una idea sobre tu negocio (ventas, gastos, inventario, clientes) y puedes contestarle. Al tocarlo abres el chat con el Equipo Syncro.
          </p>
        </div>
      </div>

      <Section title="En tu pantalla">
        <Row title={`Mostrar a ${name}`} description="Si lo apagas, el chat de soporte vuelve a ser una pestaña en el borde." htmlFor="m-visible">
          <Switch id="m-visible" checked={settings.visible} onCheckedChange={(v) => save({ visible: v })} />
        </Row>
        <Row title="Que pasee por la pantalla" description="Puedes dejarlo en cualquier parte de la página (se achica entre tarjetas y salta por encima). Apagado, siempre vuelve al marco de la pantalla." htmlFor="m-roam">
          <Switch id="m-roam" checked={settings.roam} disabled={!settings.visible} onCheckedChange={(v) => save({ roam: v })} />
        </Row>
        <Row title="Decoraciones de temporada" description="De vez en cuando se pone gorro y barba de Navidad, y lo que traiga cada fecha." htmlFor="m-festive">
          <Switch id="m-festive" checked={settings.festive} disabled={!settings.visible} onCheckedChange={(v) => save({ festive: v })} />
        </Row>
      </Section>

      <Section title="Ideas sobre tu negocio" description={`${name} mira tus ventas, gastos, inventario y clientes, y te avisa con un bombillo. Si es importante y no lo abres, te lo dice solo.`}>
        <Row title="Tener ideas" htmlFor="m-ideas">
          <Switch id="m-ideas" checked={settings.ideas} disabled={!settings.visible} onCheckedChange={(v) => save({ ideas: v })} />
        </Row>
        <Row title="Frecuencia" description="Cada cuánto puede prenderse el bombillo." htmlFor="m-frequency">
          <Choice id="m-frequency" value={settings.frequency} onChange={(v) => save({ frequency: v as MascotSettings["frequency"] })} options={[
            { value: "few", label: "Pocas (cada 4 h)" },
            { value: "normal", label: "Normal (hora y media)" },
            { value: "many", label: "Muchas (media hora)" },
          ]} />
        </Row>
      </Section>

      <Section title="Personalidad" description="Cómo te habla. No cambia lo que sabe, solo su forma de decirlo.">
        <Row title="Estilo y tono principales" htmlFor="m-tone">
          <Choice id="m-tone" value={settings.tone} onChange={(v) => save({ tone: v as MascotSettings["tone"] })} options={[
            { value: "default", label: "Predeterminado" },
            { value: "professional", label: "Profesional" },
            { value: "friendly", label: "Amigable" },
            { value: "direct", label: "Directo" },
            { value: "playful", label: "Divertido" },
          ]} />
        </Row>
        <Row title="Calidez" htmlFor="m-warmth"><Choice id="m-warmth" value={settings.warmth} options={LEVELS} onChange={(v) => save({ warmth: v as MascotSettings["warmth"] })} /></Row>
        <Row title="Entusiasmo" htmlFor="m-enthusiasm"><Choice id="m-enthusiasm" value={settings.enthusiasm} options={LEVELS} onChange={(v) => save({ enthusiasm: v as MascotSettings["enthusiasm"] })} /></Row>
        <Row title="Emoji" htmlFor="m-emoji"><Choice id="m-emoji" value={settings.emoji} options={LEVELS} onChange={(v) => save({ emoji: v as MascotSettings["emoji"] })} /></Row>
        <Row title="Largo de las respuestas" htmlFor="m-length">
          <Choice id="m-length" value={settings.length} onChange={(v) => save({ length: v as MascotSettings["length"] })} options={[
            { value: "short", label: "Breve" },
            { value: "default", label: "Predeterminado" },
            { value: "detailed", label: "Detallado" },
          ]} />
        </Row>
      </Section>

      <Section title="Instrucciones personalizadas" description={`Dale a ${name} contexto que siempre tenga presente.`}>
        <div className="space-y-4 px-5 py-4">
          <div className="space-y-1.5">
            <label htmlFor="m-name" className="text-sm font-medium">Nombre</label>
            <Input id="m-name" value={texts.name} maxLength={24} onChange={(e) => setTexts((t) => ({ ...t, name: e.target.value }))} className="max-w-xs" />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="m-about" className="text-sm font-medium">Sobre ti y tu negocio</label>
            <textarea id="m-about" rows={3} maxLength={1500} value={texts.aboutMe} onChange={(e) => setTexts((t) => ({ ...t, aboutMe: e.target.value }))} placeholder="Ej.: Tengo una ferretería en Valencia, abrimos de lunes a sábado, mi meta es vender $10.000 al mes." className="w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40" />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="m-instructions" className="text-sm font-medium">¿Cómo quieres que te hable?</label>
            <textarea id="m-instructions" rows={3} maxLength={1500} value={texts.instructions} onChange={(e) => setTexts((t) => ({ ...t, instructions: e.target.value }))} placeholder="Ej.: Avísame siempre que un producto se esté agotando. No me hables de clientes, eso lo lleva mi socio." className="w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40" />
          </div>
          <div className="flex justify-end">
            <Button onClick={saveTexts} disabled={!textsChanged || savingTexts}>{savingTexts && <IconLoader2 size={16} className="animate-spin" />} Guardar</Button>
          </div>
        </div>
      </Section>

      <Section title="Memoria" description={`${name} puede recordar lo que le cuentas en sus conversaciones para ayudarte mejor.`}>
        <Row title="Habilitar memoria" description="Recuerda datos útiles que le das al responderle (no tus contraseñas ni datos de pago)." htmlFor="m-memory">
          <Switch id="m-memory" checked={settings.memory} onCheckedChange={(v) => save({ memory: v })} />
        </Row>
        <div className="px-5 py-4">
          <p className="mb-2 flex items-center gap-1.5 text-sm font-medium"><IconBrain size={16} className="text-primary" /> Lo que recuerda</p>
          {memory === null ? (
            <IconLoader2 size={16} className="animate-spin text-muted-foreground" />
          ) : memory.length ? (
            <ul className="space-y-1.5">
              {memory.map((m, i) => <li key={i} className="rounded-lg bg-muted/50 px-3 py-1.5 text-sm">{m}</li>)}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Todavía nada. Respóndele a sus ideas y irá aprendiendo de tu negocio.</p>
          )}
          <div className="mt-3 flex justify-end">
            <Button variant="outline" size="sm" onClick={() => setConfirmClear(true)} className={cn("text-destructive")}>
              <IconTrash size={15} /> Borrar memoria y conversaciones
            </Button>
          </div>
        </div>
      </Section>

      <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground"><IconSparkles size={14} /> {name} usa inteligencia artificial. Revisa las cifras importantes antes de decidir.</p>

      <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Borrar la memoria de {name}?</AlertDialogTitle>
            <AlertDialogDescription>Olvidará lo que le contaste y sus ideas anteriores. Tus datos del negocio no se tocan.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={clearMemory}>Borrar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
