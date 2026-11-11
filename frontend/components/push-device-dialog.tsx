"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { IconBell, IconBellOff, IconCheck, IconDeviceDesktop, IconDeviceMobile, IconLoader2, IconSend, IconShare2 } from "@tabler/icons-react";
import { apiFetch } from "@/lib/api";
import { ensurePushSubscription, isDesktopApp, pushSupported, type PushState } from "@/hooks/usePushNotifications";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Device = "desktop-app" | "ios-browser" | "browser" | "none";

/** What kind of device this is, for the right advice. */
function detect(): Device {
  if (typeof window === "undefined") return "none";
  if (isDesktopApp()) return "desktop-app";
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true;
  if (ios && !standalone) return "ios-browser";
  return pushSupported() ? "browser" : "none";
}

const STATUS: Record<PushState, { text: string; ok: boolean }> = {
  on: { text: "Este dispositivo recibe notificaciones, aunque Syncro esté cerrado.", ok: true },
  default: { text: "Todavía no activas las notificaciones en este dispositivo.", ok: false },
  denied: { text: "Las notificaciones están bloqueadas en este navegador.", ok: false },
  unsupported: { text: "Este navegador no puede recibir notificaciones.", ok: false },
  "off-server": { text: "El servidor no tiene las notificaciones configuradas.", ok: false },
  error: { text: "No se pudo comprobar. Revisa tu conexión e intenta de nuevo.", ok: false },
};

/**
 * "Notificaciones de este dispositivo" (user menu): whether this computer or phone gets the
 * support messages and notices with Syncro closed or the screen locked, a button to turn them on
 * and one to send a test.
 */
export function PushDeviceDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [device, setDevice] = useState<Device>("none");
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState<"on" | "test" | null>(null);

  const check = useCallback(async () => {
    const d = detect();
    setDevice(d);
    if (d === "browser") setState(await ensurePushSubscription());
    else setState(null);
  }, []);

  useEffect(() => {
    if (open) void check();
  }, [open, check]);

  const turnOn = async () => {
    setBusy("on");
    try {
      const s = await ensurePushSubscription({ ask: true });
      setState(s);
      if (s === "on") toast.success("Notificaciones activadas en este dispositivo");
    } finally {
      setBusy(null);
    }
  };

  const test = async () => {
    setBusy("test");
    try {
      if (device === "desktop-app") {
        // The app shows its own notices (it has no web push)
        if ("Notification" in window && Notification.permission === "default") await Notification.requestPermission();
        const n = new Notification("🔔 Prueba de Syncro", { body: "Así te llegarán los mensajes de soporte, aunque tengas la ventana cerrada.", icon: "/syncro.png" });
        n.onclick = () => (window as any).electron?.showWindow?.();
        toast.success("Notificación de prueba enviada", { description: "Si no la ves, revisa Ajustes del Sistema → Notificaciones → Syncro POS." });
        return;
      }
      const res = await apiFetch("/push/test", { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message || "No se pudo enviar");
      if (!data.configured) toast.error("El servidor no tiene las notificaciones configuradas");
      else if (!data.devices) toast.error("No hay dispositivos activados en tu cuenta", { description: "Presiona Activar en este dispositivo primero." });
      else toast.success(`Prueba enviada a ${data.devices} dispositivo${data.devices === 1 ? "" : "s"}`, { description: "Debe aparecer en unos segundos, también con la pantalla bloqueada." });
    } catch (e: any) {
      toast.error(e?.message || "No se pudo enviar la prueba");
    } finally {
      setBusy(null);
    }
  };

  const status = state ? STATUS[state] : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><IconBell size={20} className="text-primary" /> Notificaciones de este dispositivo</DialogTitle>
          <DialogDescription>Para que los mensajes de soporte y los avisos te lleguen aunque Syncro esté cerrado o el teléfono bloqueado.</DialogDescription>
        </DialogHeader>

        {device === "desktop-app" && (
          <div className="flex flex-col gap-3 text-sm">
            <div className="flex gap-3 rounded-lg border bg-muted/30 p-3">
              <IconDeviceDesktop size={20} className="mt-0.5 shrink-0 text-primary" />
              <div>
                <p className="font-semibold">App de escritorio</p>
                <p className="text-muted-foreground">
                  Te avisa mientras la app esté abierta. Si cierras la ventana, Syncro sigue funcionando en el Dock (en Windows, junto al reloj) y te sigue avisando.
                  Para que no se pierda nada, activa <b>Syncro → Abrir al encender la computadora</b> en el menú de arriba.
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Si no te aparecen: Ajustes del Sistema → Notificaciones → Syncro POS → Permitir notificaciones.</p>
          </div>
        )}

        {device === "ios-browser" && (
          <div className="flex gap-3 rounded-lg border bg-muted/30 p-3 text-sm">
            <IconDeviceMobile size={20} className="mt-0.5 shrink-0 text-primary" />
            <div className="flex flex-col gap-1.5">
              <p className="font-semibold">En iPhone hay un paso más</p>
              <ol className="list-decimal space-y-1 pl-4 text-muted-foreground">
                <li>Abre Syncro en <b>Safari</b>.</li>
                <li>Toca <IconShare2 size={14} className="inline align-text-bottom" /> <b>Compartir</b> → <b>Agregar a pantalla de inicio</b>.</li>
                <li>Abre Syncro desde ese ícono, inicia sesión y vuelve aquí para presionar <b>Activar</b>.</li>
              </ol>
              <p className="text-xs text-muted-foreground">Necesita iOS 16.4 o más nuevo. Apple solo permite notificaciones así.</p>
            </div>
          </div>
        )}

        {device === "none" && (
          <p className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">Este navegador no puede recibir notificaciones. Usa Google Chrome, Edge o Safari actualizado.</p>
        )}

        {device === "browser" && (
          <div className="flex flex-col gap-3 text-sm">
            <div className="flex items-start gap-3 rounded-lg border p-3">
              {status?.ok ? <IconCheck size={20} className="mt-0.5 shrink-0 text-emerald-600" /> : <IconBellOff size={20} className="mt-0.5 shrink-0 text-muted-foreground" />}
              <div>
                <p className="font-semibold">{state ? (status!.ok ? "Activadas" : "Desactivadas") : "Comprobando…"}</p>
                {status && <p className="text-muted-foreground">{status.text}</p>}
                {state === "denied" && (
                  <p className="mt-1 text-xs text-muted-foreground">Haz clic en el ícono a la izquierda de la dirección (el candado), entra en Notificaciones, elige Permitir y recarga la página.</p>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              En la Mac, Chrome solo avisa si está abierto (aunque sea sin ventanas). En Android llegan aunque el teléfono esté bloqueado.
              Si no aparecen, revisa los ajustes de notificaciones del sistema para Chrome o Safari.
            </p>
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-2 pt-1">
          {device === "browser" && state !== "on" && state !== "denied" && (
            <Button className="gap-2" onClick={() => void turnOn()} disabled={!!busy}>
              {busy === "on" ? <IconLoader2 size={16} className="animate-spin" /> : <IconBell size={16} />} Activar
            </Button>
          )}
          {(device === "desktop-app" || (device === "browser" && state === "on")) && (
            <Button variant="outline" className="gap-2" onClick={() => void test()} disabled={!!busy}>
              {busy === "test" ? <IconLoader2 size={16} className="animate-spin" /> : <IconSend size={16} />} Enviar prueba
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
