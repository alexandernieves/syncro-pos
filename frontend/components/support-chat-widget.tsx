"use client";

import { MessageTicks, withDelivered } from "@/components/chat/message-ticks";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconApps, IconArrowsMaximize, IconCheck, IconChecks, IconArrowLeft, IconBookmark, IconBookmarkOff, IconLoader2, IconMessageCircle, IconPaperclip, IconSend, IconX } from "@tabler/icons-react";
import type { Socket } from "socket.io-client";
import { toast } from "sonner";
import { API_URL } from "@/lib/constants";
import { apiFetch } from "@/lib/api";
import { connectSocket } from "@/lib/socket";
import { cn } from "@/lib/utils";
import { ChatCard, type CardMeta } from "@/components/chat/chat-card";
import { useSupportUnread } from "@/components/support-notifier";
import { SyncroAvatar, SyncroBadge } from "@/components/syncro-avatar";
import { type MascotThought, useMascotSettings } from "@/lib/mascot";
import { GlossyBulb } from "@/components/mascot/glossy-bulb";

type Msg = {
  id?: string;
  conversationId: string;
  senderId: string;
  text?: string | null;
  type: string;
  fileUrl?: string | null;
  isRead?: boolean;
  deliveredAt?: string | null;
  meta?: CardMeta | null;
  createdAt: string;
  sender?: { name: string | null; role: string } | null;
};

type Dock = { side: "left" | "right"; top: number };
const DOCK_KEY = "syncro-chat-tab";
const INTRO_KEY = "syncro-chat-intro-seen";
const OPEN_FLAG = "__syncroChatWidgetOpen";

function session() {
  try {
    const pwa = window.matchMedia("(display-mode: standalone)").matches;
    const store = pwa ? sessionStorage : localStorage;
    const user = JSON.parse(store.getItem("user") || "null");
    return { token: store.getItem("token"), role: user?.role as string | undefined, businessId: user?.businessId as string | undefined };
  } catch {
    return { token: null, role: undefined, businessId: undefined };
  }
}

function readDock(fallback: Dock): Dock {
  try {
    const d = JSON.parse(localStorage.getItem(DOCK_KEY) || "null");
    if (d && (d.side === "left" || d.side === "right") && Number.isFinite(d.top)) return { side: d.side, top: Math.min(88, Math.max(12, d.top)) };
  } catch {
    // storage blocked
  }
  return fallback;
}

const time = (d: string) => new Date(d).toLocaleTimeString("es-VE", { hour: "numeric", minute: "2-digit" });
const day = (d: string) => {
  const date = new Date(d);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return "Hoy";
  const y = new Date(today);
  y.setDate(today.getDate() - 1);
  if (date.toDateString() === y.toDateString()) return "Ayer";
  return date.toLocaleDateString("es-VE", { weekday: "long", day: "numeric", month: "long" });
};

const STARTERS = [
  "Tengo un problema con una venta",
  "¿Cómo registro un producto?",
  "Necesito ayuda con el cierre de caja",
  "Quiero que me ayuden en vivo en mi pantalla",
];

/**
 * The support chat on the edge of every business screen: drag it anywhere, it shows unread
 * messages and opens a compact chat with the Syncro team without leaving what you're doing.
 */
export function SupportChatWidget({ placement = "right", defaultTop = 38 }: { placement?: "left" | "right"; defaultTop?: number }) {
  const pathname = usePathname();
  const unread = useSupportUnread();
  // When the mascot is on screen it is the button that opens this chat
  const mascot = useMascotSettings();
  const showTab = mascot !== null && !mascot.visible;
  const [enabled, setEnabled] = useState(false);
  const [dock, setDock] = useState<Dock>({ side: placement, top: defaultTop });
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const dragStart = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const [open, setOpen] = useState(false);
  /** Opened from the mascot (bottom-left) rather than from the side tab */
  const [fromMascot, setFromMascot] = useState(false);
  // "ideas": the history of thoughts saved with the mascot, in place of the support chat
  const [view, setView] = useState<"chat" | "ideas">("chat");
  const [ideas, setIdeas] = useState<MascotThought[] | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [intro, setIntro] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[] | null>(null);
  const [text, setText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [online, setOnline] = useState(false);
  const [typing, setTyping] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const openRef = useRef(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [pulse, setPulse] = useState(false);
  const prevUnread = useRef(0);

  // Business accounts only, and not on the full chat page
  const onChatPage = pathname?.replace(/\/+$/, "") === "/dashboard/soporte";
  useEffect(() => {
    const s = session();
    setEnabled(!!s.token && !!s.businessId && s.role !== "syncropos" && s.role !== "client");
    setDock(readDock({ side: placement, top: defaultTop }));
    try { setIntro(!localStorage.getItem(INTRO_KEY)); } catch { /* storage blocked */ }
  }, [placement, defaultTop]);

  useEffect(() => {
    openRef.current = open;
    (window as unknown as Record<string, boolean>)[OPEN_FLAG] = open;
    if (open) {
      setIntro(false);
      try { localStorage.setItem(INTRO_KEY, "1"); } catch { /* storage blocked */ }
    }
  }, [open]);

  // A soft bounce when a new message arrives
  useEffect(() => {
    if (unread > prevUnread.current) {
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 1600);
      prevUnread.current = unread;
      return () => clearTimeout(t);
    }
    prevUnread.current = unread;
  }, [unread]);

  const scrollToEnd = () => setTimeout(() => endRef.current?.scrollIntoView({ block: "end" }), 40);

  const markRead = useCallback(() => {
    if (conversationId) socketRef.current?.emit("markAsRead", { conversationId });
  }, [conversationId]);

  // Load the conversation and keep it live the first time the panel opens
  useEffect(() => {
    if (!open || messages !== null || !enabled) return;
    const { token, businessId } = session();
    if (!token || !businessId) return;
    (async () => {
      try {
        const res = await apiFetch(`/chat/business/${businessId}`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        setConversationId(data.id);
        setMessages(data.messages ?? []);
        scrollToEnd();
        const socket = connectSocket({ auth: { token }, reconnection: true, reconnectionAttempts: Infinity, reconnectionDelay: 2000 });
        socketRef.current = socket;
        socket.on("connect", () => {
          socket.emit("joinConversation", data.id);
          socket.emit("supportPresence", null, (r: { online?: boolean }) => setOnline(!!r?.online));
          if (openRef.current && !document.hidden) socket.emit("markAsRead", { conversationId: data.id });
        });
        socket.on("supportPresence", ({ online: o }: { online: boolean }) => setOnline(o));
        socket.on("newMessage", (m: Msg) => {
          if (m.conversationId !== data.id) return;
          setMessages((prev) => (prev?.some((x) => x.id && x.id === m.id) ? prev : [...(prev ?? []), m]));
          setTyping(false);
          scrollToEnd();
          if (openRef.current && !document.hidden && m.sender?.role === "syncropos") socket.emit("markAsRead", { conversationId: data.id });
        });
        socket.on("messagesRead", ({ bySupport }: { bySupport?: boolean }) => {
          if (bySupport) setMessages((prev) => prev?.map((m) => (m.sender?.role !== "syncropos" ? { ...m, isRead: true } : m)) ?? prev);
        });
        socket.on("messagesDelivered", ({ conversationId, ids, at }: { conversationId: string; ids: string[]; at: string }) => {
          if (conversationId === data.id) setMessages((prev) => (prev ? withDelivered(prev, ids, at) : prev));
        });
        socket.on("userTyping", ({ isTyping }: { isTyping: boolean }) => setTyping(isTyping));
      } catch {
        setMessages([]);
        toast.error("No se pudo abrir el chat de soporte");
      }
    })();
  }, [open, messages, enabled]);

  useEffect(() => () => { socketRef.current?.disconnect(); }, []);
  useEffect(() => {
    if (open) { markRead(); scrollToEnd(); setTimeout(() => inputRef.current?.focus(), 120); }
  }, [open, markRead]);

  // Open but in a background tab: read what arrived once the person comes back
  useEffect(() => {
    if (!open) return;
    const onVisible = () => { if (!document.hidden) markRead(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [open, markRead]);

  // The pop-up notice ("Ver") and other screens open it with an event
  useEffect(() => {
    const show = (e: Event) => {
      // Opened by tapping the mascot: the panel goes to the bottom-left corner
      setFromMascot((e as CustomEvent).detail?.from === "mascot");
      setOpen(true);
    };
    window.addEventListener("support-chat:open", show);
    return () => window.removeEventListener("support-chat:open", show);
  }, []);

  // Escape closes it
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!enabled || onChatPage) return null;

  const mascotOn = !!mascot?.visible;
  const showIdeas = async () => {
    setView("ideas");
    setExpanded(null);
    setIdeas(null);
    try {
      const res = await apiFetch("/mascot/thoughts/saved");
      setIdeas(res.ok ? await res.json() : []);
    } catch {
      setIdeas([]);
    }
  };
  const forget = async (id: string) => {
    setIdeas((list) => list?.filter((t) => t.id !== id) ?? list);
    await apiFetch(`/mascot/thoughts/${id}/saved`, { method: "PUT", body: JSON.stringify({ saved: false }) }).catch(() => undefined);
  };
  /** From the chat to the mascot's thought cloud */
  const shareThought = () => {
    setOpen(false);
    setView("chat");
    window.dispatchEvent(new Event("mascot:share"));
  };
  const continueIdea = (t: MascotThought) => {
    setOpen(false);
    setView("chat");
    window.dispatchEvent(new CustomEvent("mascot:open-thought", { detail: t }));
  };

  const send = (payload: { text?: string; type: string; fileUrl?: string }) => {
    if (!conversationId) return;
    if (!socketRef.current?.connected) {
      toast.error("Sin conexión. Reintentando…");
      socketRef.current?.connect();
      return;
    }
    socketRef.current.emit("sendMessage", { conversationId, ...payload });
  };
  const sendText = (value = text) => {
    const t = value.trim();
    if (!t) return;
    send({ text: t, type: "TEXT" });
    setText("");
    socketRef.current?.emit("typing", { conversationId, isTyping: false });
  };
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("folder", "chat");
      const { token } = session();
      const res = await fetch(`${API_URL}/upload`, { method: "POST", body: form, headers: token ? { Authorization: `Bearer ${token}` } : {} });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.url) throw new Error(body?.message || "No se pudo subir el archivo");
      send({ type: file.type.startsWith("video") ? "VIDEO" : "IMAGE", fileUrl: body.url });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploading(false);
    }
  };

  // ── Dragging: anywhere up and down, it snaps to the nearest edge on release ──
  const onPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragStart.current = { x: e.clientX, y: e.clientY, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const s = dragStart.current;
    if (!s) return;
    if (!s.moved && Math.abs(e.clientX - s.x) + Math.abs(e.clientY - s.y) < 6) return;
    s.moved = true;
    setDrag({ x: e.clientX, y: e.clientY });
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const s = dragStart.current;
    dragStart.current = null;
    if (!s?.moved) { setFromMascot(false); setOpen((o) => !o); setDrag(null); return; }
    const next: Dock = { side: e.clientX < window.innerWidth / 2 ? "left" : "right", top: Math.min(88, Math.max(12, (e.clientY / window.innerHeight) * 100)) };
    setDock(next);
    setDrag(null);
    try { localStorage.setItem(DOCK_KEY, JSON.stringify(next)); } catch { /* storage blocked */ }
  };

  const side = dock.side;
  const tabStyle: React.CSSProperties = drag
    ? { top: drag.y, left: drag.x, transform: "translate(-50%, -50%)" }
    : { top: `${dock.top}%`, [side]: 0, transform: "translateY(-50%)" };
  const fromSupport = (m: Msg) => m.sender?.role === "syncropos";

  return (
    <>
      {/* With the mascot hidden, a classic tab on the edge opens the chat */}
      {showTab && (
      <button
        type="button"
        aria-label={unread ? `Chat con Syncro, ${unread} sin leer` : "Chat con Syncro"}
        title="Chat con Equipo Syncro"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setFromMascot(false); setOpen((o) => !o); } }}
        style={tabStyle}
        className={cn(
          "group fixed z-40 flex touch-none select-none flex-col items-center gap-1.5 border bg-background/95 py-2.5 shadow-sm outline-none backdrop-blur transition-[padding,opacity,color,box-shadow] duration-200 hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
          unread ? "text-foreground" : "text-muted-foreground hover:text-foreground",
          drag ? "cursor-grabbing rounded-xl px-2 opacity-90 shadow-md" : side === "right" ? "cursor-grab rounded-l-xl border-r-0 pl-1.5 pr-1 hover:pl-2.5" : "cursor-grab rounded-r-xl border-l-0 pl-1 pr-1.5 hover:pr-2.5",
          open && !drag && "pointer-events-none opacity-0",
        )}
      >
        <span className={cn("relative", pulse && "animate-bounce")}>
          <IconMessageCircle size={15} className="text-primary" />
          {unread > 0 && (
            <span className="absolute -right-2.5 -top-2.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold tabular-nums text-primary-foreground ring-2 ring-background">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </span>
        <span className="rotate-180 text-[10px] font-medium [writing-mode:vertical-rl]">Soporte</span>
      </button>
      )}

      {/* First time: a short hint next to the tab */}
      {intro && showTab && !open && !drag && (
        <div
          style={{ top: `${dock.top}%`, [side]: 44, transform: "translateY(-50%)" }}
          className="fixed z-40 w-60 rounded-xl border bg-background p-3 text-sm shadow-lg"
          role="status"
        >
          <div className="flex items-start gap-2.5">
            <SyncroAvatar pose="wave" size={56} />
            <div>
              <p className="font-medium">¡Hola! Soy {mascot?.name || "Nubi"}</p>
              <p className="mt-0.5 text-muted-foreground">Escríbeme desde aquí, en cualquier pantalla. Arrastra la pestaña si te estorba.</p>
            </div>
          </div>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={() => setOpen(true)} className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground">Abrir chat</button>
            <button type="button" onClick={() => { setIntro(false); try { localStorage.setItem(INTRO_KEY, "1"); } catch { /* storage blocked */ } }} className="rounded-md px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted">Entendido</button>
          </div>
        </div>
      )}

      {/* The panel */}
      <div
        role="dialog"
        aria-label="Chat con Equipo Syncro"
        data-state={open ? "open" : "closed"}
        style={fromMascot ? { bottom: 16, left: 16 } : { top: `clamp(12px, calc(${dock.top}vh - 260px), calc(100vh - min(80vh, 640px) - 12px))`, [side]: 16 }}
        className={cn(
          "fixed z-50 flex h-[min(80vh,640px)] w-[calc(100vw-2rem)] max-w-[400px] flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl transition-all duration-300 ease-out motion-reduce:transition-none",
          fromMascot ? "origin-bottom-left" : side === "left" ? "origin-left" : "origin-right",
          open ? "translate-x-0 scale-100 opacity-100" : cn("pointer-events-none scale-95 opacity-0", fromMascot || side === "left" ? "-translate-x-6" : "translate-x-6"),
        )}
      >
        <div className="flex items-center gap-3 border-b px-4 py-3">
          <SyncroBadge size={38} online={online} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{mascot?.name || "Nubi"} <span className="font-normal text-muted-foreground">· Equipo Syncro</span></p>
            <p className="truncate text-xs text-muted-foreground">{typing ? "Escribiendo…" : online ? "En línea ahora" : "Te respondemos lun – vie, 8 a. m. a 6 p. m."}</p>
          </div>
          {mascotOn && (
            <button
              type="button"
              onClick={() => (view === "ideas" ? setView("chat") : void showIdeas())}
              className={cn("rounded-md p-1.5 hover:bg-muted hover:text-foreground", view === "ideas" ? "bg-primary/10 text-primary" : "text-muted-foreground")}
              aria-label={view === "ideas" ? "Volver al chat" : "Ideas guardadas"}
              title={view === "ideas" ? "Volver al chat" : `Ideas guardadas con ${mascot?.name || "Nubi"}`}
            >
              {view === "ideas" ? <IconArrowLeft size={16} /> : <IconBookmark size={16} />}
            </button>
          )}
          <Link href="/dashboard/soporte" onClick={() => setOpen(false)} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Abrir el chat completo" title="Abrir el chat completo"><IconArrowsMaximize size={16} /></Link>
          <button type="button" onClick={() => setOpen(false)} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Cerrar"><IconX size={16} /></button>
        </div>

        {view === "ideas" ? (
          <div className="min-h-0 flex-1 overflow-y-auto bg-muted/20 px-3 py-3">
            <p className="mb-3 px-1 text-sm font-semibold">Ideas guardadas</p>
            {ideas === null ? (
              <div className="flex justify-center py-16 text-muted-foreground"><IconLoader2 className="animate-spin" /></div>
            ) : !ideas.length ? (
              <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
                <GlossyBulb size={40} lit={false} />
                <p className="text-sm text-muted-foreground">Aún no guardas ideas. Cuando {mascot?.name || "Nubi"} piense algo útil, toca el marcador en su nube para guardarlo aquí.</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {ideas.map((t) => {
                  const open = expanded === t.id;
                  const msgs = t.messages ?? [];
                  return (
                    <li key={t.id} className="rounded-2xl border bg-background p-3 text-sm shadow-sm">
                      <button type="button" onClick={() => setExpanded(open ? null : t.id)} className="w-full text-left">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                          {t.topic === "user" ? "Tu pensamiento" : `${mascot?.name || "Nubi"} pensó`} · {new Date(t.updatedAt ?? t.createdAt).toLocaleDateString("es-VE", { day: "numeric", month: "short" })}
                        </p>
                        <p className={cn("mt-1 leading-relaxed", !open && "line-clamp-2")}>{t.text}</p>
                      </button>
                      {open && (
                        <div className="mt-2 space-y-1.5 border-t pt-2">
                          {msgs.slice(t.topic === "user" ? 1 : 1).map((m, i) => (
                            <p key={i} className={cn("rounded-xl px-2.5 py-1.5 text-[13px] leading-relaxed", m.role === "user" ? "ml-6 bg-primary/10" : "mr-6 bg-muted/60")}>{m.content}</p>
                          ))}
                          <div className="flex justify-end gap-2 pt-1">
                            <button type="button" onClick={() => forget(t.id)} className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted"><IconBookmarkOff size={13} /> Quitar</button>
                            <button type="button" onClick={() => continueIdea(t)} className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">Seguir pensando</button>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ) : (
        <div className="min-h-0 flex-1 overflow-y-auto bg-muted/20 px-3 py-3">
          {messages === null ? (
            <div className="flex justify-center py-16 text-muted-foreground"><IconLoader2 className="animate-spin" /></div>
          ) : !messages.length ? (
            <div className="space-y-3 px-1 py-4">
              <div className="flex items-end gap-3">
                <SyncroAvatar pose="wave" size={88} />
                <div className="rounded-2xl rounded-bl-sm border border-primary/30 bg-primary/10 p-3.5 text-sm">
                  <p className="font-semibold">¡Hola! Soy {mascot?.name || "Nubi"} 👋</p>
                  <p className="mt-1 text-muted-foreground">Junto al equipo te ayudo con lo que necesites: una duda, algo que no funciona o una idea para tu negocio. Puedes mandar fotos.</p>
                </div>
              </div>
              <p className="px-1 text-xs text-muted-foreground">Para empezar:</p>
              <div className="flex flex-col items-start gap-1.5">
                {STARTERS.map((s) => (
                  <button key={s} type="button" onClick={() => sendText(s)} className="rounded-full border bg-background px-3 py-1.5 text-left text-sm transition hover:border-primary/40 hover:bg-primary/5">{s}</button>
                ))}
                <Link href="/dashboard/tienda" onClick={() => setOpen(false)} className="flex items-center gap-1.5 rounded-full border bg-background px-3 py-1.5 text-sm transition hover:border-primary/40 hover:bg-primary/5"><IconApps size={14} className="text-primary" /> Quiero un módulo para mi negocio</Link>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {messages.map((m, i) => {
                const syncro = fromSupport(m);
                const newDay = i === 0 || new Date(messages[i - 1].createdAt).toDateString() !== new Date(m.createdAt).toDateString();
                return (
                  <div key={m.id ?? i} className="contents">
                    {newDay && <span className="my-1 self-center rounded-full border bg-background px-2.5 py-0.5 text-[10px] text-muted-foreground first-letter:uppercase">{day(m.createdAt)}</span>}
                    <div className={cn("flex max-w-[85%] flex-col", syncro ? "items-start self-start" : "items-end self-end")}>
                      <div className={cn("rounded-2xl border px-3 py-2 text-sm", syncro ? "rounded-tl-sm border-primary/30 bg-primary/10" : "rounded-tr-sm bg-card shadow-sm")}>
                        {syncro && <p className="mb-0.5 flex items-center gap-1 text-[10px] font-semibold text-primary"><SyncroBadge size={14} /> Syncro</p>}
                        {m.type === "CARD" && m.meta ? (
                          <ChatCard meta={m.meta} text={m.text} audience="business" />
                        ) : m.type === "IMAGE" ? (
                          <a href={m.fileUrl ?? "#"} target="_blank" rel="noreferrer"><img src={m.fileUrl ?? ""} alt="Imagen" className="max-w-[220px] rounded-lg" /></a>
                        ) : m.type === "VIDEO" ? (
                          <video src={m.fileUrl ?? ""} controls className="max-w-[220px] rounded-lg" />
                        ) : m.type === "AUDIO" || m.type === "audio" ? (
                          <audio src={m.fileUrl ?? ""} controls className="h-9 max-w-[220px]" />
                        ) : (
                          <span className="whitespace-pre-wrap break-words">{m.text}</span>
                        )}
                        <p className="mt-1 flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
                          {time(m.createdAt)}
                          {!syncro && <MessageTicks read={m.isRead} delivered={m.deliveredAt} />}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
              {typing && (
                <span className="flex items-center gap-1.5 self-start rounded-full bg-background px-2 py-1 text-xs text-muted-foreground">
                  <SyncroBadge size={22} /> Syncro está escribiendo…
                </span>
              )}
            </div>
          )}
          <div ref={endRef} />
        </div>
        )}

        {view === "chat" && (
        <div className="flex items-end gap-2 border-t p-2.5">
          <label className={cn("flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground", uploading && "pointer-events-none opacity-50")} aria-label="Adjuntar foto o video" title="Adjuntar foto o video">
            {uploading ? <IconLoader2 size={18} className="animate-spin" /> : <IconPaperclip size={18} />}
            <input type="file" className="sr-only" accept="image/*,video/*" onChange={onFile} />
          </label>
          {mascotOn && (
            <button
              type="button"
              onClick={shareThought}
              aria-label={`Compartirle un pensamiento a ${mascot?.name || "Nubi"}`}
              title={`¿No es para soporte? Compártele un pensamiento a ${mascot?.name || "Nubi"}`}
              className="-my-1 flex h-11 w-9 shrink-0 items-center justify-center rounded-md outline-none transition hover:scale-110 focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              <GlossyBulb size={30} />
            </button>
          )}
          <textarea
            ref={inputRef}
            rows={1}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (conversationId) socketRef.current?.emit("typing", { conversationId, isTyping: !!e.target.value });
            }}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendText(); } }}
            placeholder="Escribe tu mensaje…"
            className="max-h-28 min-h-9 flex-1 resize-none rounded-xl border bg-card px-3 py-2 text-sm outline-none focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/15"
          />
          <button type="button" onClick={() => sendText()} disabled={!text.trim() || !conversationId} className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition disabled:opacity-40" aria-label="Enviar">
            <IconSend size={16} />
          </button>
        </div>
        )}
      </div>
    </>
  );
}
