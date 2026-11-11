"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { IconMicrophone, IconMicrophoneOff } from "@tabler/icons-react";
import type { Socket } from "socket.io-client";
import { toast } from "sonner";
import { connectSocket } from "@/lib/socket";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SyncroAvatar } from "@/components/syncro-avatar";
import { type RemoteInput, getIceServers, openMic, playVoice, preferFastCodecs, socketSession, tuneSender } from "@/components/remote/remote-protocol";

type Perms = { supported: boolean; screen: string; accessibility: boolean };
type RemoteDesktopBridge = {
  status: () => Promise<Perms | null>;
  permissions: (which: "screen" | "accessibility") => Promise<Perms | null>;
  start: (opts: { control: boolean; name: string }) => Promise<{ ok: boolean }>;
  control: (on: boolean) => void;
  input: (ev: RemoteInput) => void;
  stop: () => void;
  onStopped: (cb: () => void) => () => void;
};
type DesktopBridge = { isDesktop?: boolean; platform?: string; remoteInput?: (ev: Record<string, unknown>) => void; remoteDesktop?: RemoteDesktopBridge };
type Scope = "window" | "screen";
const desktop = () => (typeof window !== "undefined" ? ((window as unknown as { electron?: DesktopBridge }).electron ?? null) : null);

// Electron key names for keys that aren't a single character
const ELECTRON_KEYS: Record<string, string> = {
  Enter: "Enter", Backspace: "Backspace", Tab: "Tab", Escape: "Escape", Delete: "Delete", Home: "Home", End: "End",
  PageUp: "PageUp", PageDown: "PageDown", ArrowUp: "Up", ArrowDown: "Down", ArrowLeft: "Left", ArrowRight: "Right", " ": "Space",
};

/**
 * Turns the Syncro team's pointer position (0–1 of the shared picture) into a point of this page.
 * The desktop app shares the whole window, title bar included; the browser shares just the page.
 */
function toPage(x: number, y: number) {
  if (desktop()?.isDesktop) {
    // Side borders (Windows) and the title bar above the page (both systems)
    const border = (window.outerWidth - window.innerWidth) / 2;
    const titleBar = window.outerHeight - window.innerHeight - border;
    return { x: Math.round(x * window.outerWidth - border), y: Math.round(y * window.outerHeight - titleBar) };
  }
  return { x: Math.round(x * window.innerWidth), y: Math.round(y * window.innerHeight) };
}

const isField = (el: Element | null): el is HTMLInputElement | HTMLTextAreaElement =>
  !!el && (el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && !["checkbox", "radio", "button", "submit", "file", "range", "color"].includes(el.type)));

function setFieldValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  // React only notices the change through the native setter
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

/** In the browser there is no way to send real input: act on the page's elements instead. */
function browserInput(ev: RemoteInput) {
  if (ev.kind === "down" || ev.kind === "up" || ev.kind === "move") {
    const p = toPage(ev.x, ev.y);
    const el = document.elementFromPoint(p.x, p.y) as HTMLElement | null;
    if (!el) return;
    const opts = { bubbles: true, cancelable: true, clientX: p.x, clientY: p.y, button: ev.kind === "move" ? 0 : ev.button === "right" ? 2 : 0 };
    if (ev.kind === "move") { el.dispatchEvent(new PointerEvent("pointermove", opts)); return; }
    el.dispatchEvent(new PointerEvent(ev.kind === "down" ? "pointerdown" : "pointerup", opts));
    el.dispatchEvent(new MouseEvent(ev.kind === "down" ? "mousedown" : "mouseup", opts));
    if (ev.kind === "down") {
      const focusable = el.closest("input, textarea, select, button, a, [tabindex], [contenteditable]") as HTMLElement | null;
      focusable?.focus();
    } else if (ev.button === "left") {
      el.click();
    } else if (ev.button === "right") {
      el.dispatchEvent(new MouseEvent("contextmenu", opts));
    }
    return;
  }
  if (ev.kind === "wheel") {
    const p = toPage(ev.x, ev.y);
    let el = document.elementFromPoint(p.x, p.y) as HTMLElement | null;
    while (el && el !== document.body && !(el.scrollHeight > el.clientHeight && /(auto|scroll)/.test(getComputedStyle(el).overflowY))) el = el.parentElement;
    (el && el !== document.body ? el : document.scrollingElement)?.scrollBy({ left: ev.deltaX, top: ev.deltaY });
    return;
  }
  if (ev.kind === "key") {
    const target = (document.activeElement as HTMLElement | null) ?? document.body;
    const init = { key: ev.key, bubbles: true, cancelable: true, shiftKey: !!ev.modifiers?.includes("shift"), ctrlKey: !!ev.modifiers?.includes("control"), altKey: !!ev.modifiers?.includes("alt"), metaKey: !!ev.modifiers?.includes("meta") };
    const notCancelled = target.dispatchEvent(new KeyboardEvent("keydown", init));
    if (notCancelled && isField(target)) {
      const start = target.selectionStart ?? target.value.length;
      const end = target.selectionEnd ?? start;
      if (ev.key.length === 1 && !init.ctrlKey && !init.metaKey) {
        setFieldValue(target, target.value.slice(0, start) + ev.key + target.value.slice(end));
        target.setSelectionRange?.(start + 1, start + 1);
      } else if (ev.key === "Backspace") {
        const from = start === end ? Math.max(0, start - 1) : start;
        setFieldValue(target, target.value.slice(0, from) + target.value.slice(end));
        target.setSelectionRange?.(from, from);
      } else if (ev.key === "Enter" && target instanceof HTMLInputElement) {
        target.form?.requestSubmit();
      }
    }
    if (notCancelled && ev.key === "Tab") {
      const all = Array.from(document.querySelectorAll<HTMLElement>("input, textarea, select, button, a[href], [tabindex]:not([tabindex='-1'])")).filter((e) => !e.hasAttribute("disabled") && e.offsetParent);
      const i = all.indexOf(target);
      all[(i + (init.shiftKey ? -1 : 1) + all.length) % all.length]?.focus();
    }
    target.dispatchEvent(new KeyboardEvent("keyup", init));
  }
}

/** In the desktop app: real mouse and keyboard events, but only inside Syncro's window. */
function desktopInput(ev: RemoteInput, send: (e: Record<string, unknown>) => void) {
  if (ev.kind === "move" || ev.kind === "down" || ev.kind === "up") {
    const p = toPage(ev.x, ev.y);
    if (ev.kind === "move") send({ type: "mouseMove", x: p.x, y: p.y });
    else send({ type: ev.kind === "down" ? "mouseDown" : "mouseUp", x: p.x, y: p.y, button: ev.button, clickCount: 1 });
    return;
  }
  if (ev.kind === "wheel") {
    const p = toPage(ev.x, ev.y);
    send({ type: "mouseWheel", x: p.x, y: p.y, deltaX: -ev.deltaX, deltaY: -ev.deltaY });
    return;
  }
  if (ev.kind !== "key") return;
  const keyCode = ELECTRON_KEYS[ev.key] ?? (ev.key.length === 1 ? ev.key : null);
  if (!keyCode) return;
  const modifiers = ev.modifiers ?? [];
  send({ type: "keyDown", keyCode, modifiers });
  if (ev.key.length === 1 && !modifiers.includes("control") && !modifiers.includes("meta")) send({ type: "char", keyCode: ev.key, modifiers });
  send({ type: "keyUp", keyCode, modifiers });
}

/**
 * The business side of live assistance: asks for permission, shares Syncro's screen, shows a
 * banner the whole time (with Terminar and the control switch), shows Syncro's pointer, and runs
 * Syncro's clicks and keys when allowed.
 */
export function RemoteAssistHost() {
  const [incoming, setIncoming] = useState<{ sessionId: string; adminName: string; scope: Scope } | null>(null);
  /** macOS permissions for the whole computer (null = not asked / not the desktop app) */
  const [perms, setPerms] = useState<Perms | null>(null);
  const [allowControl, setAllowControl] = useState(true);
  const [allowVoice, setAllowVoice] = useState(true);
  const [mic, setMic] = useState<"on" | "off" | "none">("none");
  const micRef = useRef<MediaStream | null>(null);
  const voiceRef = useRef<HTMLAudioElement>(null);
  const [active, setActive] = useState<{ sessionId: string; adminName: string; control: boolean; scope: Scope } | null>(null);
  const pointerRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const activeRef = useRef(active);
  useEffect(() => { activeRef.current = active; }, [active]);

  const stop = useCallback((notify: boolean) => {
    const a = activeRef.current;
    if (notify && a) socketRef.current?.emit("remote:end", { sessionId: a.sessionId });
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    micRef.current?.getTracks().forEach((t) => t.stop());
    micRef.current = null;
    setMic("none");
    if (voiceRef.current) voiceRef.current.srcObject = null;
    pcRef.current?.close();
    pcRef.current = null;
    if (a?.scope === "screen") desktop()?.remoteDesktop?.stop();
    setActive(null);
  }, []);

  /** Syncro's pointer moves straight on the DOM, without re-rendering, so it keeps up every frame. */
  const movePointer = useCallback((p: { x: number; y: number }) => {
    const el = pointerRef.current;
    if (!el || activeRef.current?.scope === "screen") return; // the real pointer moves instead
    const at = toPage(p.x, p.y);
    el.style.transform = `translate(${at.x}px, ${at.y}px)`;
    el.style.opacity = "1";
  }, []);

  /** Clicks and keys run only while the business allows control (it decides, here on its side). */
  const runInput = useCallback((ev: RemoteInput) => {
    if (!activeRef.current?.control) return;
    const bridge = desktop();
    if (activeRef.current.scope === "screen") { bridge?.remoteDesktop?.input(ev); return; }
    if (bridge?.remoteInput) desktopInput(ev, bridge.remoteInput);
    else browserInput(ev);
  }, []);

  useEffect(() => {
    const s = socketSession();
    if (!s.token || !s.businessId || s.role === "syncropos" || s.role === "client") return;
    const socket = connectSocket({ auth: { token: s.token }, reconnection: true, reconnectionAttempts: Infinity, reconnectionDelay: 2000 });
    socketRef.current = socket;
    socket.on("remote:incoming", (d: { sessionId: string; adminName: string; scope?: Scope }) => {
      setAllowControl(true);
      setAllowVoice(true);
      setIncoming({ ...d, scope: d.scope === "screen" ? "screen" : "window" });
      if (d.scope === "screen") void desktop()?.remoteDesktop?.status().then(setPerms);
    });
    socket.on("remote:closed", ({ sessionId }: { sessionId: string }) => setIncoming((cur) => (cur?.sessionId === sessionId ? null : cur)));
    socket.on("remote:ended", ({ reason, by }: { reason: string; by?: string }) => {
      stop(false);
      toast(by === "business" ? "Terminaste la asistencia en vivo" : `Asistencia en vivo terminada: ${reason}`);
    });
    // Fallback path through the server, used until the direct channels open
    socket.on("remote:pointer", (p: { x: number; y: number }) => movePointer(p));
    socket.on("remote:input", (ev: RemoteInput) => runInput(ev));
    socket.on("remote:signal", async ({ data }: { data: { type: string; sdp?: string; candidate?: RTCIceCandidateInit } }) => {
      const pc = pcRef.current;
      if (!pc) return;
      try {
        if (data.type === "answer" && data.sdp) await pc.setRemoteDescription({ type: "answer", sdp: data.sdp });
        else if (data.type === "candidate" && data.candidate) await pc.addIceCandidate(data.candidate);
      } catch {
        // a late candidate after the session closed
      }
    });
    // "Detener" on the bar that stays on top of every app
    const offStopped = desktop()?.remoteDesktop?.onStopped(() => { stop(true); toast("Detuviste la asistencia en vivo"); });
    return () => { offStopped?.(); stop(true); socket.disconnect(); };
  }, [stop, movePointer, runInput]);

  // Back from System Settings: check the permissions again
  useEffect(() => {
    if (incoming?.scope !== "screen") return;
    const again = () => void desktop()?.remoteDesktop?.status().then(setPerms);
    window.addEventListener("focus", again);
    return () => window.removeEventListener("focus", again);
  }, [incoming?.scope]);

  const accept = async (scope: Scope) => {
    const req = incoming;
    if (!req) return;
    setIncoming(null);
    const bridge = desktop()?.remoteDesktop;
    if (scope === "screen") {
      // Before the share: the app then gives the whole screen and shows the bar on top of every app
      const ok = await bridge?.start({ control: allowControl, name: req.adminName }).catch(() => null);
      if (!ok?.ok) { socketRef.current?.emit("remote:respond", { sessionId: req.sessionId, accept: false }); toast.error("No se pudo compartir la computadora"); return; }
    }
    let stream: MediaStream;
    try {
      // The desktop app answers with its own window; the browser asks which tab, suggesting this one
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 30, max: 30 }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
        preferCurrentTab: true,
        selfBrowserSurface: "include",
      } as DisplayMediaStreamOptions);
    } catch {
      if (scope === "screen") bridge?.stop();
      socketRef.current?.emit("remote:respond", { sessionId: req.sessionId, accept: false });
      toast.error(scope === "screen" && desktop()?.platform === "darwin" ? "No se pudo compartir la pantalla. Revisa el permiso de Grabación de pantalla para Syncro POS." : "No se pudo compartir la pantalla");
      return;
    }
    // Voice: the business's microphone, if it agreed to talk
    const [micStream, iceServers] = await Promise.all([allowVoice ? openMic() : Promise.resolve(null), getIceServers()]);
    if (allowVoice && !micStream) toast("No pudimos usar tu micrófono. Igual escucharás a Syncro.");
    const answer: { ok?: boolean; error?: string } = await new Promise((resolve) => socketRef.current?.emit("remote:respond", { sessionId: req.sessionId, accept: true, control: allowControl, scope }, resolve));
    if (!answer?.ok) {
      if (scope === "screen") bridge?.stop();
      stream.getTracks().forEach((t) => t.stop());
      micStream?.getTracks().forEach((t) => t.stop());
      toast.error(answer?.error || "La solicitud ya no está disponible");
      return;
    }
    streamRef.current = stream;
    const pc = new RTCPeerConnection({ iceServers });
    pcRef.current = pc;
    stream.getTracks().forEach((t) => {
      // Keep the frame rate up when the network tightens: it feels live, and the text stays legible
      if ("contentHint" in t) t.contentHint = "motion";
      const sender = pc.addTrack(t, stream);
      t.onended = () => stop(true);
      void tuneSender(sender);
    });
    // Two-way voice: always ready to hear Syncro; sends this side's microphone when there is one
    micRef.current = micStream;
    const micTrack = micStream?.getAudioTracks()[0] ?? null;
    pc.addTransceiver(micTrack ?? "audio", { direction: "sendrecv", streams: micStream ? [micStream] : [] });
    setMic(micTrack ? "on" : "none");
    pc.ontrack = (e) => { if (e.track.kind === "audio") playVoice(e.track, voiceRef.current); };
    preferFastCodecs(pc);
    // Direct channels between both computers: the pointer (latest wins, no retries) and the
    // clicks and keys (in order, never lost). Faster than going through the server.
    const pointerCh = pc.createDataChannel("pointer", { ordered: false, maxRetransmits: 0 });
    pointerCh.onmessage = (e) => { try { movePointer(JSON.parse(e.data)); } catch { /* ignore */ } };
    const inputCh = pc.createDataChannel("input", { ordered: true });
    inputCh.onmessage = (e) => { try { runInput(JSON.parse(e.data)); } catch { /* ignore */ } };
    pc.onicecandidate = (e) => { if (e.candidate) socketRef.current?.emit("remote:signal", { sessionId: req.sessionId, data: { type: "candidate", candidate: e.candidate.toJSON() } }); };
    pc.onconnectionstatechange = () => { if (pc.connectionState === "failed") { toast.error("Se perdió la conexión con Syncro"); stop(true); } };
    setActive({ sessionId: req.sessionId, adminName: req.adminName, control: allowControl, scope });
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socketRef.current?.emit("remote:signal", { sessionId: req.sessionId, data: { type: "offer", sdp: offer.sdp } });
  };

  /** The desktop app can share and control the whole computer; a browser only Syncro's page */
  const canWhole = !!desktop()?.remoteDesktop && (desktop()?.platform === "darwin" || desktop()?.platform === "win32");
  const wholeComputer = incoming?.scope === "screen" && canWhole;

  const toggleMic = () => {
    const track = micRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMic(track.enabled ? "on" : "off");
  };

  const decline = () => {
    if (incoming) socketRef.current?.emit("remote:respond", { sessionId: incoming.sessionId, accept: false });
    setIncoming(null);
  };

  const toggleControl = () => {
    if (!active) return;
    const control = !active.control;
    setActive({ ...active, control });
    if (active.scope === "screen") desktop()?.remoteDesktop?.control(control);
    socketRef.current?.emit("remote:control", { sessionId: active.sessionId, control });
  };

  return (
    <>
      <audio ref={voiceRef} autoPlay hidden />
      <Dialog open={!!incoming} onOpenChange={(o) => { if (!o) decline(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader className="items-center text-center">
            <SyncroAvatar pose="point" size={150} />
            <DialogTitle>{incoming?.adminName} quiere ayudarte en vivo</DialogTitle>
            <DialogDescription>
              {wholeComputer
                ? "Pide ver y usar toda tu computadora (no solo Syncro) mientras dure la ayuda. Verás una barra roja arriba con el botón Detener. Puedes terminar cuando quieras."
                : "Verá tu pantalla de Syncro mientras dure la ayuda. Solo esta ventana, no el resto de tu computadora. Puedes terminar cuando quieras."}
            </DialogDescription>
          </DialogHeader>
          {incoming?.scope === "screen" && !canWhole && (
            <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
              Para compartir toda la computadora necesitas la <b>app de escritorio de Syncro</b>. Desde aquí puedes compartir solo la pantalla de Syncro.
            </p>
          )}
          {wholeComputer && desktop()?.platform === "darwin" && perms && (perms.screen !== "granted" || !perms.accessibility) && (
            <div className="flex flex-col gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
              <p className="font-medium">La Mac pide dos permisos para Syncro POS (solo la primera vez):</p>
              <div className="flex flex-wrap gap-2">
                {perms.screen !== "granted" && <Button size="sm" variant="outline" onClick={() => void desktop()?.remoteDesktop?.permissions("screen").then(setPerms)}>1. Grabación de pantalla</Button>}
                {!perms.accessibility && <Button size="sm" variant="outline" onClick={() => void desktop()?.remoteDesktop?.permissions("accessibility").then(setPerms)}>2. Accesibilidad</Button>}
              </div>
              <p className="text-xs text-muted-foreground">Activa Syncro POS en cada uno. Si te lo pide, cierra y vuelve a abrir Syncro y acepta de nuevo.</p>
            </div>
          )}
          <label className="flex items-start gap-2.5 rounded-xl bg-muted/50 p-3 text-sm">
            <Checkbox checked={allowControl} onCheckedChange={(v) => setAllowControl(v === true)} className="mt-0.5" />
            <span>
              <span className="font-medium">Permitir que use el mouse y el teclado</span>
              <span className="block text-muted-foreground">Para cargar tus productos o configurar por ti. Lo puedes quitar en cualquier momento.</span>
            </span>
          </label>
          <label className="flex items-start gap-2.5 rounded-xl bg-muted/50 p-3 text-sm">
            <Checkbox checked={allowVoice} onCheckedChange={(v) => setAllowVoice(v === true)} className="mt-0.5" />
            <span>
              <span className="font-medium">Hablar por voz</span>
              <span className="block text-muted-foreground">Usa tu micrófono para conversar mientras te explica. Puedes silenciarte cuando quieras.</span>
            </span>
          </label>
          <DialogFooter className="flex-wrap gap-2 sm:justify-center">
            <Button variant="outline" onClick={decline}>Ahora no</Button>
            {wholeComputer && <Button variant="outline" onClick={() => void accept("window")}>Solo Syncro</Button>}
            <Button onClick={() => void accept(wholeComputer ? "screen" : "window")} autoFocus>{wholeComputer ? "Permitir toda la computadora" : "Aceptar y compartir"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {active && (
        <>
          <div className="fixed inset-x-0 top-0 z-[100] flex flex-wrap items-center justify-center gap-3 bg-primary px-4 py-1.5 text-sm text-primary-foreground shadow-md">
            <span className="flex items-center gap-2 font-medium">
              <span className="size-2 animate-pulse rounded-full bg-white" />
              {active.adminName} (Syncro) está viendo {active.scope === "screen" ? "toda tu computadora" : "tu pantalla"}{active.control ? " y puede usar el mouse" : ""}
            </span>
            {mic !== "none" && (
              <button type="button" onClick={toggleMic} className="flex items-center gap-1 rounded-md bg-white/15 px-2.5 py-0.5 text-xs font-medium hover:bg-white/25" title={mic === "on" ? "Silenciar tu micrófono" : "Activar tu micrófono"}>
                {mic === "on" ? <IconMicrophone size={14} /> : <IconMicrophoneOff size={14} />} {mic === "on" ? "Silenciar" : "Micrófono apagado"}
              </button>
            )}
            <button type="button" onClick={toggleControl} className="rounded-md bg-white/15 px-2.5 py-0.5 text-xs font-medium hover:bg-white/25">
              {active.control ? "Quitar el control" : "Permitir el control"}
            </button>
            <button type="button" onClick={() => stop(true)} className="rounded-md bg-white px-2.5 py-0.5 text-xs font-semibold text-primary hover:bg-white/90">
              Terminar
            </button>
          </div>
          {(
            <div ref={pointerRef} className="pointer-events-none fixed left-0 top-0 z-[101] opacity-0 will-change-transform">
              <svg width="22" height="22" viewBox="0 0 24 24" className="drop-shadow" aria-hidden>
                <path d="M3 2 L20 11 L12 13 L9 21 Z" fill="#F26B3A" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
              </svg>
              <span className={cn("ml-4 -mt-1 inline-block rounded-full bg-primary px-2 py-0.5 text-[11px] font-medium text-primary-foreground shadow")}>{active.adminName}</span>
            </div>
          )}
        </>
      )}
    </>
  );
}
