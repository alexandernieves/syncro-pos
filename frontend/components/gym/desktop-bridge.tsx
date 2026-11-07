"use client";

import { useCallback, useEffect, useState } from "react";
import { IconAlertTriangle, IconCheck, IconChevronDown, IconDeviceDesktop, IconLoader2, IconPlayerPlay, IconPower, IconSettings, IconX } from "@tabler/icons-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { API_URL } from "@/lib/constants";
import { gymApi } from "@/lib/gym";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/gym/confirm-dialog";

/** What the desktop app tells about the bridge it runs (desktop/src/gym-bridge-host.js). */
export type BridgeState = {
  available: true;
  configured: boolean;
  enabled: boolean;
  running: boolean;
  deviceId: string | null;
  deviceName: string | null;
  host: string;
  user: string;
  doorNo: number;
  hasPass: boolean;
  startsWithComputer: boolean;
  status: { deviceOnline?: boolean; syncroOnline?: boolean; usersOnDevice?: number | null; lastError?: string | null; lastRosterSync?: string | null; lastEventAt?: string | null } | null;
  log: string[];
  appVersion: string;
};
type Step = { label: string; ok: boolean; detail: string };
type BridgeApi = {
  get: () => Promise<BridgeState | null>;
  test: (input: { host: string; user: string; pass: string }) => Promise<{ ok: boolean; steps: Step[] } | null>;
  save: (input: Record<string, unknown>) => Promise<{ ok: boolean; error?: string; state?: BridgeState }>;
  stop: () => Promise<BridgeState | null>;
  resume: () => Promise<BridgeState | null>;
  onStatus: (cb: (s: BridgeState) => void) => () => void;
};
type ReaderOption = { id: string; name: string; doorNo: number; online: boolean };

const electron = () => (typeof window === "undefined" ? undefined : (window as unknown as { electron?: { isDesktop?: boolean; gymBridge?: BridgeApi } }).electron);
export const bridgeApi = () => electron()?.gymBridge;

/** The bridge state in this desktop app (null in a browser or an older app). */
export function useDesktopBridge() {
  const [state, setState] = useState<BridgeState | null>(null);
  useEffect(() => {
    const api = bridgeApi();
    if (!api) return;
    api.get().then(setState).catch(() => undefined);
    return api.onStatus(setState);
  }, []);
  return state;
}

function health(s: BridgeState) {
  if (!s.enabled) return { label: "Apagado", cls: "border-muted-foreground/30 bg-muted text-muted-foreground" };
  if (!s.status) return { label: "Conectando…", cls: "border-blue-500/30 bg-blue-500/10 text-blue-700" };
  if (!s.status.syncroOnline) return { label: "Sin conexión con Syncro", cls: "border-rose-500/30 bg-rose-500/10 text-rose-700" };
  if (!s.status.deviceOnline) return { label: "El lector no responde", cls: "border-amber-500/30 bg-amber-500/10 text-amber-800" };
  return { label: "Funcionando", cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700" };
}

/**
 * "This computer is the bridge": the reception computer runs the face reader's bridge inside
 * the Syncro desktop app. No server, no terminal, no key to copy.
 */
export function DesktopBridgeCard({ readers, setupFor, onSetupClose, onChanged }: {
  readers: ReaderOption[];
  /** Opens the setup right after creating a reader, with its fresh key. */
  setupFor?: { deviceId: string; key: string } | null;
  onSetupClose?: () => void;
  onChanged: () => void;
}) {
  const isDesktop = !!electron()?.isDesktop;
  const api = bridgeApi();
  const state = useDesktopBridge();
  const [setup, setSetup] = useState<{ deviceId?: string; key?: string } | null>(null);
  const [showLog, setShowLog] = useState(false);
  const [confirmStop, setConfirmStop] = useState(false);

  useEffect(() => { if (setupFor) setSetup(setupFor); }, [setupFor]);
  const close = () => { setSetup(null); onSetupClose?.(); };

  if (!isDesktop) {
    return (
      <Card className="gap-0 py-0">
        <CardContent className="flex gap-3 py-4 text-sm">
          <IconDeviceDesktop size={20} className="mt-0.5 shrink-0 text-primary" />
          <p className="text-muted-foreground"><span className="font-medium text-foreground">La forma más fácil de conectar el lector:</span> abre esta pantalla en la <strong>app de escritorio de Syncro</strong> en la computadora de recepción y toca «Usar esta computadora». Esa computadora hace de puente: arranca sola y no necesita servidor ni terminal.</p>
        </CardContent>
      </Card>
    );
  }
  if (!api) {
    return (
      <Card className="gap-0 py-0">
        <CardContent className="flex gap-3 py-4 text-sm">
          <IconAlertTriangle size={20} className="mt-0.5 shrink-0 text-amber-600" />
          <p className="text-muted-foreground"><span className="font-medium text-foreground">Actualiza la app de escritorio</span> para usar esta computadora como puente del lector facial. Ciérrala y vuelve a abrirla, o usa el aviso de actualización.</p>
        </CardContent>
      </Card>
    );
  }
  if (!state) return null;

  const h = health(state);
  const active = state.configured && state.enabled;
  const resume = async () => { await api.resume(); toast.success("Puente encendido en esta computadora"); onChanged(); };

  return (
    <Card className={cn("gap-0 py-0", active && "ring-1 ring-primary/20")}>
      <CardContent className="space-y-3 py-4">
        <div className="flex flex-wrap items-start gap-3">
          <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl", active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}><IconDeviceDesktop size={22} /></span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold">Puente en esta computadora</p>
              {state.configured && <Badge variant="outline" className={cn("gap-1.5", h.cls)}><span className="size-1.5 rounded-full bg-current" />{h.label}</Badge>}
            </div>
            {state.configured ? (
              <p className="text-sm text-muted-foreground">{state.deviceName} · lector en {state.host.replace(/^https?:\/\//, "")}{active && state.status?.usersOnDevice != null ? ` · ${state.status.usersOnDevice} personas cargadas` : ""}</p>
            ) : (
              <p className="text-sm text-muted-foreground">Esta computadora conecta el lector con Syncro mientras esté encendida: arranca sola al prenderla, no deja que se suspenda y sigue funcionando con la ventana cerrada (queda junto al reloj).</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {!state.configured && <Button size="sm" className="gap-1.5" disabled={!readers.length} title={readers.length ? undefined : "Primero agrega el lector"} onClick={() => setSetup({})}><IconPlayerPlay size={14} /> Usar esta computadora</Button>}
            {state.configured && !state.enabled && <Button size="sm" className="gap-1.5" onClick={resume}><IconPower size={14} /> Encender</Button>}
            {state.configured && <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setSetup({ deviceId: state.deviceId ?? undefined })}><IconSettings size={14} /> Cambiar datos</Button>}
            {active && <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => setConfirmStop(true)}><IconPower size={14} /> Apagar</Button>}
          </div>
        </div>
        {active && (
          <>
            {state.status?.lastError && <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-700">{state.status.lastError}</p>}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">{state.startsWithComputer ? <IconCheck size={13} className="text-emerald-600" /> : <IconX size={13} />} {state.startsWithComputer ? "Arranca solo al encender la computadora" : "No arranca solo con la computadora"}</span>
              <span>App {state.appVersion}</span>
              <button type="button" className="ml-auto flex items-center gap-1 hover:text-foreground" onClick={() => setShowLog((v) => !v)}>Actividad <IconChevronDown size={13} className={cn("transition", showLog && "rotate-180")} /></button>
            </div>
            {showLog && (
              <pre className="max-h-56 overflow-y-auto rounded-lg bg-zinc-950 p-3 font-mono text-[11px] leading-relaxed text-zinc-200">
                {state.log.length ? state.log.map((l) => l.replace(/^(\d{4}-\d\d-\d\d)T(\d\d:\d\d:\d\d)\.\d+Z/, (_, d, t) => `${d} ${t}`)).join("\n") : "Todavía no hay actividad."}
              </pre>
            )}
          </>
        )}
      </CardContent>

      <BridgeSetupDialog open={!!setup} preset={setup} state={state} readers={readers} onClose={close} onDone={() => { close(); onChanged(); }} />
      <ConfirmDialog
        open={confirmStop}
        danger
        title="¿Apagar el puente en esta computadora?"
        description="El lector sigue dejando entrar con las fechas que ya tiene, pero las entradas, renovaciones y bloqueos dejan de sincronizarse con Syncro."
        confirmLabel="Apagar"
        onConfirm={async () => { await api.stop(); toast.success("Puente apagado"); onChanged(); }}
        onClose={() => setConfirmStop(false)}
      />
    </Card>
  );
}

function BridgeSetupDialog({ open, preset, state, readers, onClose, onDone }: {
  open: boolean;
  preset: { deviceId?: string; key?: string } | null;
  state: BridgeState;
  readers: ReaderOption[];
  onClose: () => void;
  onDone: () => void;
}) {
  const api = bridgeApi()!;
  const [f, setF] = useState({ deviceId: "", host: "", user: "admin", pass: "" });
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [busy, setBusy] = useState<"test" | "save" | null>(null);
  const [takeOver, setTakeOver] = useState(false);

  useEffect(() => {
    if (!open) return;
    const deviceId = preset?.deviceId ?? state.deviceId ?? readers[0]?.id ?? "";
    setF({ deviceId, host: state.host.replace(/^http:\/\//, ""), user: state.user || "admin", pass: "" });
    setSteps(null);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const reader = readers.find((r) => r.id === f.deviceId);
  const keepPass = state.hasPass && `http://${f.host.replace(/^https?:\/\//, "")}` === state.host;
  // A key is needed unless this computer already has the one for this reader
  const needsKey = !preset?.key && !(state.configured && state.deviceId === f.deviceId);

  const test = useCallback(async () => {
    setBusy("test");
    try {
      const r = await api.test({ host: f.host, user: f.user, pass: f.pass });
      setSteps(r?.steps ?? []);
      return !!r?.ok;
    } finally {
      setBusy(null);
    }
  }, [api, f]);

  const save = async (confirmed = false) => {
    if (!reader) return;
    // The reader is connected from somewhere else: taking it over disconnects that one
    if (needsKey && reader.online && !confirmed) return setTakeOver(true);
    if (!(await test())) return;
    setBusy("save");
    try {
      const key = preset?.key ?? (needsKey ? (await gymApi<{ key: string }>(`/devices/${reader.id}/key`, { method: "POST" })).key : undefined);
      const r = await api.save({
        deviceId: reader.id,
        deviceName: reader.name,
        doorNo: reader.doorNo,
        syncroUrl: new URL(API_URL, window.location.origin).href,
        key,
        host: f.host,
        user: f.user,
        pass: f.pass,
      });
      if (!r.ok) throw new Error(r.error || "No se pudo guardar");
      toast.success("Listo: esta computadora conecta el lector", { description: "En unos segundos aparece conectado y empieza a cargar a los socios." });
      onDone();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Usar esta computadora como puente</DialogTitle>
          <DialogDescription>El lector y esta computadora deben estar en la misma red. Los datos se guardan cifrados en esta computadora.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {readers.length > 1 && !preset?.key ? (
            <div className="space-y-1.5">
              <Label>Lector</Label>
              <Select value={f.deviceId} onValueChange={(v) => setF({ ...f, deviceId: v })}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Elige el lector" /></SelectTrigger>
                <SelectContent>{readers.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          ) : (
            <p className="text-sm">Lector: <span className="font-medium">{reader?.name ?? "—"}</span></p>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="bridge-host">IP del lector</Label>
            <Input id="bridge-host" value={f.host} onChange={(e) => setF({ ...f, host: e.target.value })} placeholder="192.168.1.50" inputMode="url" autoComplete="off" />
            <p className="text-xs text-muted-foreground">La que le pusiste fija al lector. Si no la sabes, aparece en el menú del lector (Red).</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="bridge-user">Usuario del lector</Label>
              <Input id="bridge-user" value={f.user} onChange={(e) => setF({ ...f, user: e.target.value })} autoComplete="off" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bridge-pass">Clave del lector</Label>
              <Input id="bridge-pass" type="password" value={f.pass} onChange={(e) => setF({ ...f, pass: e.target.value })} placeholder={keepPass ? "Deja vacío para mantenerla" : ""} autoComplete="new-password" />
            </div>
          </div>
          {steps && (
            <ul className="space-y-1.5 rounded-xl bg-muted/50 p-3 text-sm">
              {steps.map((s) => (
                <li key={s.label} className="flex gap-2">
                  {s.ok ? <IconCheck size={16} className="mt-0.5 shrink-0 text-emerald-600" /> : <IconX size={16} className="mt-0.5 shrink-0 text-rose-600" />}
                  <span><span className="font-medium">{s.label}</span>{s.detail ? <span className="text-muted-foreground"> · {s.detail}</span> : null}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" disabled={!!busy || !f.host.trim()} onClick={() => void test()}>{busy === "test" && <IconLoader2 size={16} className="animate-spin" />} Probar conexión</Button>
          <Button disabled={!!busy || !f.host.trim() || !f.user.trim() || (!f.pass && !keepPass) || !reader} onClick={() => void save()}>{busy === "save" && <IconLoader2 size={16} className="animate-spin" />} Guardar y conectar</Button>
        </DialogFooter>
      </DialogContent>
      <ConfirmDialog
        open={takeOver}
        danger
        title={`${reader?.name ?? "El lector"} está conectado desde otro equipo`}
        description="Si lo conectas desde esta computadora, el otro equipo deja de funcionar como puente (se le cambia la clave). Hazlo si vas a reemplazarlo."
        confirmLabel="Usar esta computadora"
        onConfirm={() => save(true)}
        onClose={() => setTakeOver(false)}
      />
    </Dialog>
  );
}
