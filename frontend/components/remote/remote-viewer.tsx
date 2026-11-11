"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { IconAppWindow, IconChevronDown, IconDeviceDesktop, IconLoader2, IconMicrophone, IconMicrophoneOff, IconPointer, IconX } from "@tabler/icons-react";
import type { Socket } from "socket.io-client";
import { toast } from "sonner";
import { connectSocket } from "@/lib/socket";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SyncroAvatar } from "@/components/syncro-avatar";
import { type RemoteInput, connectionRoute, getIceServers, lowLatency, openMic, playVoice, socketSession } from "@/components/remote/remote-protocol";

type State = "idle" | "waiting" | "connecting" | "live";

/**
 * Live assistance from Syncro central: asks the business for its screen, shows it, and, when the
 * business allows it, sends clicks, scroll and keys. The pointer is always shown to the business.
 */
export function RemoteViewer({ businessId, businessName }: { businessId: string; businessName: string }) {
  const [state, setState] = useState<State>("idle");
  const [control, setControl] = useState(false);
  /** What is being shared: Syncro's window or the whole computer */
  const [scope, setScope] = useState<"window" | "screen">("window");
  const [mic, setMic] = useState<"on" | "off" | "none">("none");
  const micRef = useRef<MediaStream | null>(null);
  const voiceRef = useRef<HTMLAudioElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  // The connection is created once the ICE servers arrive; signals wait for it
  const pcWait = useRef<Promise<RTCPeerConnection> | null>(null);
  const [route, setRoute] = useState<"direct" | "relay" | null>(null);
  const sessionRef = useRef<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const channels = useRef<{ pointer?: RTCDataChannel; input?: RTCDataChannel }>({});
  const pending = useRef<{ x: number; y: number } | null>(null);
  const frame = useRef(0);
  const lastSocketMove = useRef(0);

  const cleanup = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
    pcWait.current = null;
    channels.current = {};
    micRef.current?.getTracks().forEach((t) => t.stop());
    micRef.current = null;
    setMic("none");
    cancelAnimationFrame(frame.current);
    sessionRef.current = null;
    socketRef.current?.disconnect();
    socketRef.current = null;
    setState("idle");
    setControl(false);
  }, []);

  useEffect(() => () => {
    if (sessionRef.current) socketRef.current?.emit("remote:end", { sessionId: sessionRef.current });
    cleanup();
  }, [cleanup]);

  const start = (want: "window" | "screen") => {
    const { token } = socketSession();
    if (!token) return;
    setScope(want);
    setState("waiting");
    const socket = connectSocket({ auth: { token } });
    socketRef.current = socket;
    socket.on("connect", () => {
      void getIceServers();
      socket.emit("remote:request", { businessId, scope: want }, (r: { sessionId?: string; error?: string }) => {
        if (!r?.sessionId) { toast.error(r?.error || "No se pudo pedir la conexión"); cleanup(); return; }
        sessionRef.current = r.sessionId;
      });
    });
    socket.on("remote:declined", () => { toast(`${businessName} no aceptó la asistencia en vivo`); cleanup(); });
    socket.on("remote:ended", ({ reason }: { reason: string }) => { toast(`Asistencia terminada: ${reason}`); cleanup(); });
    socket.on("remote:control", ({ control: c }: { control: boolean }) => {
      setControl(c);
      toast(c ? `${businessName} te dio el control` : `${businessName} te quitó el control. Puedes seguir señalando.`);
    });
    socket.on("remote:started", async ({ control: c, scope: got }: { control: boolean; scope?: "window" | "screen" }) => {
      setControl(c);
      const shared = got === "screen" ? "screen" : "window";
      if (want === "screen" && shared === "window") toast(`${businessName} compartió solo Syncro (necesita la app de escritorio para compartir toda la computadora)`);
      setScope(shared);
      setState("connecting");
      setRoute(null);
      let ready!: (pc: RTCPeerConnection) => void;
      pcWait.current = new Promise((r) => { ready = r; });
      const iceServers = await getIceServers();
      const pc = new RTCPeerConnection({ iceServers });
      pcRef.current = pc;
      ready(pc);
      pc.ondatachannel = (e) => {
        if (e.channel.label === "pointer" || e.channel.label === "input") channels.current[e.channel.label] = e.channel;
      };
      // Syncro's microphone, to explain while helping
      openMic().then((m) => {
        if (pcRef.current !== pc) { m?.getTracks().forEach((t) => t.stop()); return; }
        micRef.current = m;
        if (!m) { toast("No pudimos usar tu micrófono: el negocio no te escuchará."); return; }
        setMic("on");
        void attachMic(pc);
      });
      pc.ontrack = (e) => {
        if (e.track.kind === "audio") { playVoice(e.track, voiceRef.current); return; }
        lowLatency(e.receiver);
        if (videoRef.current) videoRef.current.srcObject = e.streams[0];
        setState("live");
        setTimeout(() => surfaceRef.current?.focus(), 50);
      };
      pc.onicecandidate = (e) => { if (e.candidate && sessionRef.current) socket.emit("remote:signal", { sessionId: sessionRef.current, data: { type: "candidate", candidate: e.candidate.toJSON() } }); };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed") toast.error("No se pudo establecer la conexión de video. Puede ser la red del negocio.");
        if (pc.connectionState === "connected") void connectionRoute(pc).then(setRoute);
      };
    });
    socket.on("remote:signal", async ({ data }: { data: { type: string; sdp?: string; candidate?: RTCIceCandidateInit } }) => {
      const pc = pcRef.current ?? (await pcWait.current);
      if (!pc || !sessionRef.current) return;
      try {
        if (data.type === "offer" && data.sdp) {
          await pc.setRemoteDescription({ type: "offer", sdp: data.sdp });
          // Answer "send and receive" on the voice line even if the mic isn't ready yet, so it can
          // be plugged in later without renegotiating
          for (const t of pc.getTransceivers()) if (t.receiver.track?.kind === "audio") t.direction = "sendrecv";
          await attachMic(pc);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit("remote:signal", { sessionId: sessionRef.current, data: { type: "answer", sdp: answer.sdp } });
        } else if (data.type === "candidate" && data.candidate) {
          await pc.addIceCandidate(data.candidate);
        }
      } catch {
        // stale signal
      }
    });
  };

  /** Puts the microphone on the voice line the business offered (whichever comes first: mic or offer). */
  const attachMic = async (pc: RTCPeerConnection) => {
    const track = micRef.current?.getAudioTracks()[0];
    const t = pc.getTransceivers().find((x) => x.receiver.track?.kind === "audio");
    if (!track || !t || t.sender.track) return;
    await t.sender.replaceTrack(track).catch(() => undefined);
  };

  const toggleMic = () => {
    const track = micRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMic(track.enabled ? "on" : "off");
  };

  const end = () => {
    if (sessionRef.current) socketRef.current?.emit("remote:end", { sessionId: sessionRef.current });
    cleanup();
  };

  /** Where the pointer is on the shared picture (0–1), leaving out the black bars of the video. */
  const point = (e: React.MouseEvent | React.WheelEvent) => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return null;
    const box = video.getBoundingClientRect();
    const scale = Math.min(box.width / video.videoWidth, box.height / video.videoHeight);
    const w = video.videoWidth * scale;
    const h = video.videoHeight * scale;
    const x = (e.clientX - box.left - (box.width - w) / 2) / w;
    const y = (e.clientY - box.top - (box.height - h) / 2) / h;
    if (x < 0 || y < 0 || x > 1 || y > 1) return null;
    return { x, y };
  };

  /** Clicks and keys: straight to the business when the direct channel is open, else via the server. */
  const send = (event: RemoteInput) => {
    const ch = channels.current.input;
    if (ch?.readyState === "open") ch.send(JSON.stringify(event));
    else if (sessionRef.current) socketRef.current?.emit("remote:input", { sessionId: sessionRef.current, event });
  };

  /** The pointer goes out once per screen frame with its latest position. */
  const queuePointer = (p: { x: number; y: number }) => {
    pending.current = p;
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      const at = pending.current;
      if (!at || !sessionRef.current) return;
      const ch = channels.current.pointer;
      if (ch?.readyState === "open") {
        ch.send(JSON.stringify(at));
        if (control) send({ kind: "move", ...at });
      } else {
        const now = Date.now();
        if (now - lastSocketMove.current < 40) return;
        lastSocketMove.current = now;
        socketRef.current?.emit("remote:pointer", { sessionId: sessionRef.current, ...at });
        if (control) send({ kind: "move", ...at });
      }
    });
  };
  const button = (b: number) => (b === 2 ? "right" : b === 1 ? "middle" : "left") as "left" | "right" | "middle";

  if (state === "idle") {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" title="Ver la pantalla del negocio y ayudarle en vivo">
            <IconDeviceDesktop size={16} /> Ver pantalla <IconChevronDown size={14} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuItem onSelect={() => start("window")} className="items-start gap-2 py-2">
            <IconAppWindow size={18} className="mt-0.5 text-primary" />
            <span><span className="block font-medium">Solo Syncro</span><span className="block text-xs text-muted-foreground">Su ventana de Syncro. Funciona en el navegador y en la app.</span></span>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => start("screen")} className="items-start gap-2 py-2">
            <IconDeviceDesktop size={18} className="mt-0.5 text-primary" />
            <span><span className="block font-medium">Toda la computadora</span><span className="block text-xs text-muted-foreground">Ver y controlar cualquier programa, como AnyDesk. Necesita la app de escritorio.</span></span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-stone-950/95 backdrop-blur-sm">
      <div className="flex items-center gap-3 border-b border-white/10 px-4 py-2.5 text-white">
        <IconDeviceDesktop size={18} className="text-primary" />
        <p className="font-medium">{businessName}</p>
        <span className={cn("rounded-full px-2.5 py-0.5 text-xs", state === "live" ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-white/70")}>
          {state === "waiting" ? "Esperando que acepte…" : state === "connecting" ? "Conectando…" : "En vivo"}
        </span>
        {state === "live" && <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs text-white/70">{scope === "screen" ? "Toda la computadora" : "Solo Syncro"}</span>}
        {state === "live" && route && (
          <span title={route === "relay" ? "Las dos redes no se ven directamente: el video pasa cifrado por el servidor de Syncro" : "Conexión directa entre las dos computadoras"} className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs text-white/70">
            {route === "relay" ? "Por el servidor de Syncro" : "Directa"}
          </span>
        )}
        {state === "live" && (
          <span className={cn("flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs", control ? "bg-primary/25 text-orange-200" : "bg-white/10 text-white/70")}>
            <IconPointer size={13} /> {control ? "Tienes el control: clic, rueda y teclado" : "Solo puedes señalar"}
          </span>
        )}
        {mic !== "none" && (
          <Button size="sm" variant={mic === "on" ? "secondary" : "destructive"} className="ml-auto" onClick={toggleMic} title={mic === "on" ? "Silenciar tu micrófono" : "Activar tu micrófono"}>
            {mic === "on" ? <IconMicrophone size={16} /> : <IconMicrophoneOff size={16} />} {mic === "on" ? "Micrófono" : "Silenciado"}
          </Button>
        )}
        <Button size="sm" variant="secondary" className={mic === "none" ? "ml-auto" : undefined} onClick={end}><IconX size={16} /> Terminar</Button>
      </div>

      <audio ref={voiceRef} autoPlay hidden />
      <div className="relative min-h-0 flex-1">
        {state !== "live" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center text-white">
            <SyncroAvatar pose={state === "waiting" ? "think" : "point"} size={200} />
            <p className="text-lg font-medium">{state === "waiting" ? `Le pedimos permiso a ${businessName}` : "Conectando con su pantalla…"}</p>
            <p className="max-w-sm text-sm text-white/60">{state === "waiting" ? "Le aparece un aviso para aceptar. Si no lo ve, pídele por el chat que abra Syncro." : "Unos segundos."}</p>
            <IconLoader2 className="animate-spin text-white/60" />
          </div>
        )}
        <video ref={videoRef} autoPlay playsInline muted className={cn("h-full w-full object-contain", state !== "live" && "invisible")} />
        {state === "live" && (
          <div
            ref={surfaceRef}
            tabIndex={0}
            aria-label={`Pantalla de ${businessName}`}
            className={cn("absolute inset-0 outline-none", control ? "cursor-default" : "cursor-crosshair")}
            onContextMenu={(e) => e.preventDefault()}
            onMouseMove={(e) => {
              const p = point(e);
              if (p) queuePointer(p);
            }}
            onMouseDown={(e) => { surfaceRef.current?.focus(); const p = point(e); if (p && control) send({ kind: "down", ...p, button: button(e.button) }); }}
            onMouseUp={(e) => { const p = point(e); if (p && control) send({ kind: "up", ...p, button: button(e.button) }); }}
            onWheel={(e) => { const p = point(e); if (p && control) send({ kind: "wheel", ...p, deltaX: e.deltaX, deltaY: e.deltaY }); }}
            onKeyDown={(e) => {
              if (!control) return;
              e.preventDefault();
              const modifiers = (["shift", "control", "alt", "meta"] as const).filter((m) => (m === "shift" ? e.shiftKey : m === "control" ? e.ctrlKey : m === "alt" ? e.altKey : e.metaKey));
              if (["Shift", "Control", "Alt", "Meta"].includes(e.key)) return;
              send({ kind: "key", key: e.key, modifiers });
            }}
          />
        )}
      </div>
      {state === "live" && (
        <p className="border-t border-white/10 px-4 py-1.5 text-center text-xs text-white/50">
          Haz clic en la pantalla para escribir. El negocio ve tu puntero con tu nombre y puede quitarte el control o terminar cuando quiera.
        </p>
      )}
    </div>
  );
}
