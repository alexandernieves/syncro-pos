"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  IconBuilding,
  IconCheck,
  IconChecks,
  IconLoader2,
  IconMessageCircle,
  IconMicrophone,
  IconPaperclip,
  IconPlayerStopFilled,
  IconRefresh,
  IconSearch,
  IconSend,
  IconUserCircle,
  IconX,
} from "@tabler/icons-react";
import type { Socket } from "socket.io-client";
import { toast } from "sonner";
import { API_URL } from "@/lib/constants";
import { apiFetch } from "@/lib/api";
import { connectSocket } from "@/lib/socket";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WhatsAppAudioPlayer } from "@/components/ui/whatsapp-audio-player";
import { BusinessSheet } from "@/components/syncro-admin/business-sheet";
import { ChatCard } from "@/components/chat/chat-card";
import { RemoteViewer } from "@/components/remote/remote-viewer";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useRequireSyncroAdmin } from "@/hooks/use-require-syncro-admin";
import { STATUS_CLASS, STATUS_LABEL } from "@/lib/syncro-admin";

type Conv = {
  id: string;
  businessId: string;
  lastMessage: string | null;
  updatedAt: string;
  lastMessageAt: string | null;
  unread: number;
  business: { id: string; name: string; email: string | null; phone: string | null; status: string } | null;
};
type Msg = {
  id?: string;
  conversationId: string;
  senderId: string;
  text?: string | null;
  type: string;
  fileUrl?: string | null;
  isRead?: boolean;
  createdAt: string;
  sender?: { id: string; name: string | null; role: string } | null;
  meta?: Record<string, unknown> | null;
  requestId?: string | null;
};

const getToken = () => {
  if (typeof window === "undefined") return null;
  const pwa = window.matchMedia("(display-mode: standalone)").matches;
  return pwa ? sessionStorage.getItem("token") : localStorage.getItem("token");
};

const initials = (name?: string | null) => (name ?? "??").trim().slice(0, 2).toUpperCase();

/** "10:24 a. m." today, "ayer", or "3 nov." */
function when(d: string | null | undefined) {
  if (!d) return "";
  const date = new Date(d);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return date.toLocaleTimeString("es-VE", { hour: "numeric", minute: "2-digit" });
  const y = new Date(today);
  y.setDate(today.getDate() - 1);
  if (date.toDateString() === y.toDateString()) return "Ayer";
  return date.toLocaleDateString("es-VE", { day: "numeric", month: "short" });
}

const dayLabel = (d: string) => {
  const date = new Date(d);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return "Hoy";
  const y = new Date(today);
  y.setDate(today.getDate() - 1);
  if (date.toDateString() === y.toDateString()) return "Ayer";
  return date.toLocaleDateString("es-VE", { weekday: "long", day: "numeric", month: "long" });
};

async function upload(file: File, folder: string) {
  const form = new FormData();
  form.append("file", file);
  form.append("folder", folder);
  const token = getToken();
  const res = await fetch(`${API_URL}/upload`, { method: "POST", body: form, headers: token ? { Authorization: `Bearer ${token}` } : {} });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.url) throw new Error("No se pudo subir el archivo");
  return body.url as string;
}

export default function SyncroAdminChatPage() {
  useRequireSyncroAdmin();
  const [conversations, setConversations] = useState<Conv[] | null>(null);
  const [active, setActive] = useState<Conv | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [text, setText] = useState("");
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [profileOf, setProfileOf] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const activeRef = useRef<Conv | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const discardRef = useRef(false);
  usePushNotifications(userId);

  useEffect(() => { activeRef.current = active; }, [active]);

  const fetchConversations = useCallback(async () => {
    try {
      const res = await apiFetch(`/chat/support/sync`);
      if (!res.ok) throw new Error();
      setConversations(await res.json());
    } catch {
      toast.error("No se pudieron cargar las conversaciones");
      setConversations((c) => c ?? []);
    }
  }, []);

  const scrollToEnd = () => setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }), 60);

  const markRead = (conversationId: string) => {
    socketRef.current?.emit("markAsRead", { conversationId });
    setConversations((list) => list?.map((c) => (c.id === conversationId ? { ...c, unread: 0 } : c)) ?? list);
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem("user") || sessionStorage.getItem("user");
      setUserId(raw ? JSON.parse(raw).id : null);
    } catch { /* ignore */ }
    fetchConversations();
    const token = getToken();
    if (!token) return;
    const socket = connectSocket({ auth: { token } });
    socketRef.current = socket;
    socket.on("newMessage", (msg: Msg) => {
      if (activeRef.current?.id === msg.conversationId) {
        setMessages((prev) => (prev.some((m) => m.id && m.id === msg.id) ? prev : [...prev, msg]));
        scrollToEnd();
        if (msg.sender?.role !== "syncropos") socket.emit("markAsRead", { conversationId: msg.conversationId });
      }
    });
    socket.on("messagesRead", ({ conversationId }: { conversationId: string }) => {
      if (activeRef.current?.id === conversationId) setMessages((prev) => prev.map((m) => (m.sender?.role === "syncropos" ? { ...m, isRead: true } : m)));
    });
    socket.on("conversationUpdated", () => fetchConversations());
    // Rejoin the open conversation after a reconnect
    socket.on("connect", () => { if (activeRef.current) socket.emit("joinConversation", activeRef.current.id); });
    return () => { socket.disconnect(); socketRef.current = null; };
  }, [fetchConversations]);

  // Show the Syncro cursor on the business's screen while a conversation is open (~15 fps)
  useEffect(() => {
    if (!active?.id) return;
    let last = 0;
    const move = (e: MouseEvent) => {
      const now = Date.now();
      if (now - last < 66) return;
      last = now;
      socketRef.current?.emit("cursorMove", { conversationId: active.id, x: (e.clientX / window.innerWidth) * 100, y: (e.clientY / window.innerHeight) * 100 });
    };
    window.addEventListener("mousemove", move);
    return () => {
      window.removeEventListener("mousemove", move);
      socketRef.current?.emit("cursorLeave", { conversationId: active.id });
    };
  }, [active?.id]);

  const open = async (conv: Conv) => {
    setActive(conv);
    setMessages([]);
    setLoadingMsgs(true);
    try {
      const res = await apiFetch(`/chat/business/${conv.businessId}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setMessages(data.messages ?? []);
      socketRef.current?.emit("joinConversation", conv.id);
      markRead(conv.id);
      scrollToEnd();
      setTimeout(() => inputRef.current?.focus(), 50);
    } catch {
      toast.error("No se pudieron cargar los mensajes");
    } finally {
      setLoadingMsgs(false);
    }
  };

  const send = (payload: { text?: string; type: string; fileUrl?: string }) => {
    if (!active) return;
    if (!socketRef.current?.connected) {
      toast.error("Sin conexión con el servidor. Reintentando…");
      socketRef.current?.connect();
      return;
    }
    socketRef.current.emit("sendMessage", { conversationId: active.id, ...payload });
  };

  const sendText = () => {
    const t = text.trim();
    if (!t) return;
    send({ text: t, type: "TEXT" });
    setText("");
    if (active) socketRef.current?.emit("typing", { conversationId: active.id, isTyping: false });
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !active) return;
    setUploading(true);
    try {
      const url = await upload(file, "chat");
      send({ type: file.type.startsWith("video") ? "VIDEO" : "IMAGE", fileUrl: url });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];
      discardRef.current = false;
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (discardRef.current || !chunksRef.current.length) return;
        setUploading(true);
        try {
          const url = await upload(new File([new Blob(chunksRef.current, { type: "audio/webm" })], "voice.webm", { type: "audio/webm" }), "chat/voice");
          send({ type: "AUDIO", fileUrl: url });
        } catch (err) {
          toast.error((err as Error).message);
        } finally {
          setUploading(false);
        }
      };
      recorder.start();
      setRecording(true);
    } catch {
      toast.error("No se pudo usar el micrófono");
    }
  };
  const stopRecording = (discard: boolean) => {
    discardRef.current = discard;
    recorderRef.current?.stop();
    setRecording(false);
  };

  const mine = (m: Msg) => (m.sender ? m.sender.role === "syncropos" : m.senderId === userId);

  const renderContent = (m: Msg, isMe: boolean) => {
    if (m.type === "CARD" && m.meta) return <ChatCard meta={m.meta} text={m.text} audience="support" />;
    if (m.type === "IMAGE") return <a href={m.fileUrl ?? "#"} target="_blank" rel="noreferrer"><img src={m.fileUrl ?? ""} alt="Imagen" className="max-w-xs rounded-xl" /></a>;
    if (m.type === "VIDEO") return <video src={m.fileUrl ?? ""} controls className="max-w-xs rounded-xl" />;
    if (m.type === "AUDIO" || m.type === "audio") {
      return <WhatsAppAudioPlayer src={m.fileUrl ?? ""} isMe={isMe} timestamp={when(m.createdAt)} isRead={m.isRead} senderFallback={!isMe ? initials(active?.business?.name) : undefined} />;
    }
    return <span className="whitespace-pre-wrap break-words leading-relaxed">{m.text}</span>;
  };

  const list = (conversations ?? [])
    .filter((c) => !onlyUnread || c.unread > 0)
    .filter((c) => `${c.business?.name ?? ""} ${c.business?.email ?? ""}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => new Date(b.lastMessageAt ?? 0).getTime() - new Date(a.lastMessageAt ?? 0).getTime() || (a.business?.name ?? "").localeCompare(b.business?.name ?? ""));
  const unreadTotal = (conversations ?? []).reduce((s, c) => s + c.unread, 0);

  return (
    <div className="flex h-[calc(100dvh-var(--header-height)-1rem)] min-h-[32rem] overflow-hidden bg-background">
      {/* Inbox */}
      <aside className={cn("flex w-full shrink-0 flex-col border-r md:w-[320px]", active && "hidden md:flex")}>
        <div className="space-y-3 border-b p-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold tracking-tight">Mensajería</h1>
              <p className="text-xs text-muted-foreground">{unreadTotal ? `${unreadTotal} sin leer` : "Todo leído"}</p>
            </div>
            <Button variant="ghost" size="icon" className="size-8" onClick={fetchConversations} aria-label="Actualizar"><IconRefresh size={16} /></Button>
          </div>
          <label className="relative block">
            <IconSearch size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar negocio…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
          <div className="flex rounded-lg border bg-muted/40 p-0.5 text-sm">
            {[{ k: false, l: "Todas" }, { k: true, l: `Sin leer${unreadTotal ? ` · ${unreadTotal}` : ""}` }].map((o) => (
              <button key={String(o.k)} type="button" onClick={() => setOnlyUnread(o.k)} className={cn("flex-1 rounded-md px-3 py-1.5 transition", onlyUnread === o.k ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground")}>{o.l}</button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {!conversations ? (
            <div className="flex justify-center py-12 text-muted-foreground"><IconLoader2 className="animate-spin" /></div>
          ) : !list.length ? (
            <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
              <IconMessageCircle size={22} className="text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{onlyUnread ? "No hay mensajes sin leer." : "No hay conversaciones."}</p>
            </div>
          ) : (
            <div className="space-y-1">
              {list.map((c) => {
                const isActive = active?.id === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => open(c)}
                    className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-ring", isActive ? "bg-muted" : "hover:bg-muted/60")}
                  >
                    <Avatar className="size-10"><AvatarFallback className="text-xs font-semibold">{initials(c.business?.name)}</AvatarFallback></Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className={cn("truncate text-sm", c.unread ? "font-semibold" : "font-medium")}>{c.business?.name ?? "Sin nombre"}</span>
                        <span className={cn("shrink-0 text-[11px]", c.unread ? "font-medium text-primary" : "text-muted-foreground")}>{when(c.lastMessageAt)}</span>
                      </div>
                      <div className="mt-0.5 flex items-center justify-between gap-2">
                        <p className={cn("truncate text-xs", c.unread ? "text-foreground" : "text-muted-foreground")}>{c.lastMessage ?? "Sin mensajes todavía"}</p>
                        {c.unread > 0 && <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">{c.unread}</span>}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 border-t px-4 py-2.5 text-xs text-muted-foreground">
          <IconBuilding size={13} /> {conversations?.length ?? 0} negocios
        </div>
      </aside>

      {/* Conversation */}
      {active ? (
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-3 border-b px-4 py-3">
            <Button variant="ghost" size="icon" className="size-8 md:hidden" onClick={() => setActive(null)} aria-label="Volver"><IconX size={16} /></Button>
            <Avatar className="size-9"><AvatarFallback className="text-xs font-semibold">{initials(active.business?.name)}</AvatarFallback></Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-semibold">{active.business?.name ?? "Negocio"}</p>
                {active.business?.status && <Badge variant="outline" className={cn("text-[10px]", STATUS_CLASS[active.business.status])}>{STATUS_LABEL[active.business.status]}</Badge>}
              </div>
              <p className="truncate text-xs text-muted-foreground">{[active.business?.email, active.business?.phone].filter(Boolean).join(" · ") || "Sin datos de contacto"}</p>
            </div>
            <RemoteViewer key={active.businessId} businessId={active.businessId} businessName={active.business?.name ?? "el negocio"} />
            <Button variant="outline" size="sm" onClick={() => setProfileOf(active.businessId)}><IconUserCircle size={16} /> Ver negocio</Button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto bg-muted/20 px-4 py-4 sm:px-6">
            {loadingMsgs ? (
              <div className="flex justify-center py-16 text-muted-foreground"><IconLoader2 className="animate-spin" /></div>
            ) : !messages.length ? (
              <div className="mx-auto mt-16 max-w-xs text-center">
                <IconMessageCircle size={28} className="mx-auto text-muted-foreground" />
                <p className="mt-2 text-sm font-medium">Aún no hay mensajes</p>
                <p className="text-xs text-muted-foreground">Escríbele a este negocio para empezar.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {messages.map((m, i) => {
                  const isMe = mine(m);
                  const newDay = i === 0 || new Date(messages[i - 1].createdAt).toDateString() !== new Date(m.createdAt).toDateString();
                  return (
                    <React.Fragment key={m.id ?? i}>
                      {newDay && <span className="my-2 self-center rounded-full border bg-background px-3 py-1 text-[11px] text-muted-foreground first-letter:uppercase">{dayLabel(m.createdAt)}</span>}
                      <div className={cn("flex max-w-[75%] flex-col", isMe ? "self-end items-end" : "self-start items-start")}>
                        <span className={cn("mb-1 text-[11px]", isMe ? "mr-1 font-medium text-primary" : "ml-1 text-muted-foreground")}>{isMe ? `Equipo Syncro${m.sender?.name ? ` · ${m.sender.name}` : ""}` : m.sender?.name ?? "Cliente"}</span>
                        <div className={cn("rounded-2xl px-4 py-2.5 text-sm shadow-sm", isMe ? "rounded-br-sm border border-primary/30 bg-primary/10" : "rounded-bl-sm border bg-card")}>
                          {renderContent(m, isMe)}
                          {m.type !== "AUDIO" && m.type !== "audio" && (
                            <div className={cn("mt-1 flex items-center gap-1 text-[10px]", isMe ? "justify-end text-muted-foreground" : "text-muted-foreground")}>
                              {new Date(m.createdAt).toLocaleTimeString("es-VE", { hour: "numeric", minute: "2-digit" })}
                              {isMe && (m.isRead ? <IconChecks size={12} className="text-sky-500" /> : <IconCheck size={12} />)}
                            </div>
                          )}
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            )}
            <div ref={endRef} />
          </div>

          <div className="flex items-center gap-2 border-t px-3 py-3">
            <label className={cn("flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground", (uploading || recording) && "pointer-events-none opacity-50")} aria-label="Adjuntar imagen o video">
              <IconPaperclip size={20} />
              <input type="file" className="sr-only" onChange={onFile} accept="image/*,video/*" />
            </label>

            {recording ? (
              <div className="flex h-10 flex-1 items-center gap-3 rounded-full border border-rose-600/30 bg-rose-600/10 px-4">
                <span className="size-2 animate-pulse rounded-full bg-rose-600" />
                <span className="flex-1 text-sm font-medium text-rose-700">Grabando nota de voz…</span>
                <Button variant="ghost" size="sm" className="h-7 text-rose-700" onClick={() => stopRecording(true)}>Descartar</Button>
              </div>
            ) : (
              <Input
                ref={inputRef}
                className="h-10 flex-1 rounded-full bg-card px-4"
                placeholder={uploading ? "Subiendo archivo…" : "Responder al negocio…"}
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  // The business sees "Escribiendo…"
                  if (active) socketRef.current?.emit("typing", { conversationId: active.id, isTyping: !!e.target.value });
                }}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendText(); } }}
                disabled={uploading}
              />
            )}

            {text.trim() ? (
              <Button size="icon" className="size-10 shrink-0 rounded-full" onClick={sendText} aria-label="Enviar"><IconSend size={18} /></Button>
            ) : recording ? (
              <Button size="icon" className="size-10 shrink-0 rounded-full" onClick={() => stopRecording(false)} aria-label="Enviar nota de voz"><IconPlayerStopFilled size={18} /></Button>
            ) : (
              <Button size="icon" variant="outline" className="size-10 shrink-0 rounded-full" onClick={startRecording} disabled={uploading} aria-label="Grabar nota de voz"><IconMicrophone size={18} /></Button>
            )}
          </div>
        </div>
      ) : (
        <div className="hidden flex-1 items-center justify-center md:flex">
          <div className="text-center">
            <IconMessageCircle size={36} className="mx-auto text-muted-foreground" />
            <h2 className="mt-3 text-lg font-semibold">Soporte a los negocios</h2>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">Elige una conversación a la izquierda para leerla y responder.</p>
          </div>
        </div>
      )}

      <BusinessSheet businessId={profileOf} onClose={() => setProfileOf(null)} onChanged={fetchConversations} />
    </div>
  );
}
