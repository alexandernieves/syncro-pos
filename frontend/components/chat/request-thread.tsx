"use client";

import { useEffect, useRef, useState } from "react";
import { IconLoader2, IconSend } from "@tabler/icons-react";
import type { Socket } from "socket.io-client";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { connectSocket } from "@/lib/socket";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChatCard } from "@/components/chat/chat-card";

type Msg = {
  id?: string;
  conversationId: string;
  senderId: string;
  text?: string | null;
  type: string;
  fileUrl?: string | null;
  meta?: Record<string, unknown> | null;
  requestId?: string | null;
  createdAt: string;
  sender?: { name: string | null; role: string } | null;
};

const token = () => {
  try {
    const pwa = window.matchMedia("(display-mode: standalone)").matches;
    return pwa ? sessionStorage.getItem("token") : localStorage.getItem("token");
  } catch {
    return null;
  }
};

/**
 * The conversation about one module request. Lives in the same support chat (so nothing gets
 * lost), but shows only the messages tied to this request and sends new ones tied to it.
 */
export function RequestThread({ businessId, requestId, audience }: { businessId: string; requestId: string; audience: "business" | "support" }) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[] | null>(null);
  const [text, setText] = useState("");
  const socketRef = useRef<Socket | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await apiFetch(`/chat/business/${businessId}`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (!alive) return;
        setConversationId(data.id);
        setMessages((data.messages ?? []).filter((m: Msg) => m.requestId === requestId));
        const t = token();
        if (!t) return;
        const socket = connectSocket({ auth: { token: t } });
        socketRef.current = socket;
        socket.on("connect", () => {
          socket.emit("joinConversation", data.id);
          socket.emit("markAsRead", { conversationId: data.id });
        });
        socket.on("newMessage", (m: Msg) => {
          if (m.requestId !== requestId) return;
          setMessages((prev) => (prev?.some((x) => x.id && x.id === m.id) ? prev : [...(prev ?? []), m]));
          socket.emit("markAsRead", { conversationId: data.id });
        });
      } catch {
        if (alive) { setMessages([]); toast.error("No se pudo cargar la conversación"); }
      }
    })();
    return () => { alive = false; socketRef.current?.disconnect(); socketRef.current = null; };
  }, [businessId, requestId]);

  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [messages?.length]);

  const send = () => {
    const t = text.trim();
    if (!t || !conversationId) return;
    if (!socketRef.current?.connected) { toast.error("Sin conexión. Intenta de nuevo en un momento."); return; }
    socketRef.current.emit("sendMessage", { conversationId, text: t, type: "TEXT", requestId });
    setText("");
  };

  const fromSupport = (m: Msg) => m.sender?.role === "syncropos";

  return (
    <div className="overflow-hidden rounded-xl border">
      <div className="max-h-80 min-h-24 space-y-2 overflow-y-auto bg-muted/20 p-3">
        {!messages ? (
          <div className="flex justify-center py-6 text-muted-foreground"><IconLoader2 className="animate-spin" /></div>
        ) : !messages.length ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{audience === "support" ? "Escríbele al negocio sobre esta solicitud." : "Escríbenos sobre esta solicitud: dudas, fotos de cómo trabajas hoy, ideas…"}</p>
        ) : (
          messages.map((m, i) => {
            const mine = audience === "support" ? fromSupport(m) : !fromSupport(m);
            const syncro = fromSupport(m);
            return (
              <div key={m.id ?? i} className={cn("flex max-w-[85%] flex-col", mine ? "ml-auto items-end" : "items-start")}>
                <span className={cn("mb-0.5 text-[10px]", syncro ? "font-medium text-primary" : "text-muted-foreground")}>{syncro ? "Equipo Syncro" : m.sender?.name ?? "Negocio"}</span>
                <div className={cn("rounded-2xl border px-3 py-2 text-sm", syncro ? "border-primary/30 bg-primary/10" : "bg-card")}>
                  {m.type === "CARD" && m.meta ? <ChatCard meta={m.meta} text={m.text} audience={audience} /> : <span className="whitespace-pre-wrap">{m.text}</span>}
                  <p className="mt-1 text-right text-[10px] text-muted-foreground">{new Date(m.createdAt).toLocaleString("es-VE", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</p>
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>
      <div className="flex items-center gap-2 border-t p-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder={audience === "support" ? "Responder sobre esta solicitud…" : "Escribe sobre esta solicitud…"}
          className="h-9"
        />
        <Button size="icon" className="size-9 shrink-0" onClick={send} disabled={!text.trim() || !conversationId} aria-label="Enviar"><IconSend size={16} /></Button>
      </div>
    </div>
  );
}
