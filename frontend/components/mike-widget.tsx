"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { io, Socket } from "socket.io-client";
import { apiFetch } from "@/lib/api";
import { API_URL } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { IconHeadset, IconSend, IconX } from "@tabler/icons-react";

interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  text?: string;
  type?: string;
  createdAt: string;
}

interface CursorPosition {
  x: number;
  y: number;
}

const CURSOR_IDLE_MS = 4000;

/**
 * Floating "Mike" support entry point for business-owner dashboards.
 * Reuses the existing Conversation/Message chat backend — this is just a
 * compact widget + a live cursor overlay on top of it, not a new chat system.
 */
export function MikeWidget() {
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [unread, setUnread] = useState(0);
  const [cursor, setCursor] = useState<CursorPosition | null>(null);
  const userIdRef = useRef<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const cursorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const userStr = localStorage.getItem("user");
    const token = localStorage.getItem("token");
    if (!userStr || !token) {
      setReady(true);
      return;
    }
    try {
      const user = JSON.parse(userStr);
      userIdRef.current = user.id;
      const isSyncroAdmin = user.role === "syncropos";
      setAllowed(!isSyncroAdmin && !!user.businessId);
    } catch {
      // ignore malformed local user
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready || !allowed) return;

    let cancelled = false;

    const init = async () => {
      const userStr = localStorage.getItem("user");
      if (!userStr) return;
      const user = JSON.parse(userStr);

      const res = await apiFetch(`/chat/business/${user.businessId}`);
      if (!res.ok || cancelled) return;
      const conv = await res.json();
      if (cancelled) return;
      setConversationId(conv.id);
      setMessages(conv.messages || []);

      const token = localStorage.getItem("token");
      const socket = io(API_URL, { auth: { token } });
      socketRef.current = socket;

      socket.on("connect", () => {
        socket.emit("joinConversation", conv.id);
      });

      socket.on("newMessage", (msg: ChatMessage) => {
        if (msg.conversationId !== conv.id) return;
        setMessages((prev) => [...prev, msg]);
        setOpen((currentlyOpen) => {
          if (!currentlyOpen) setUnread((n) => n + 1);
          return currentlyOpen;
        });
        setTimeout(() => {
          scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
        }, 80);
      });

      socket.on("mikeCursor", (pos: CursorPosition) => {
        setCursor(pos);
        if (cursorTimeoutRef.current) clearTimeout(cursorTimeoutRef.current);
        cursorTimeoutRef.current = setTimeout(() => setCursor(null), CURSOR_IDLE_MS);
      });

      socket.on("mikeCursorLeave", () => {
        setCursor(null);
        if (cursorTimeoutRef.current) clearTimeout(cursorTimeoutRef.current);
      });
    };

    init();

    return () => {
      cancelled = true;
      socketRef.current?.disconnect();
      socketRef.current = null;
      if (cursorTimeoutRef.current) clearTimeout(cursorTimeoutRef.current);
    };
  }, [ready, allowed]);

  useEffect(() => {
    if (open) {
      setUnread(0);
      setTimeout(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
      }, 50);
    }
  }, [open]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || !conversationId || !socketRef.current) return;
    socketRef.current.emit("sendMessage", { conversationId, text, type: "TEXT" });
    setInput("");
  };

  if (!ready || !allowed || pathname?.startsWith("/dashboard/soporte")) {
    return (
      <>
        {cursor && <MikeCursor position={cursor} />}
      </>
    );
  }

  return (
    <>
      {cursor && <MikeCursor position={cursor} />}

      {open && (
        <div className="fixed bottom-24 right-6 z-50 flex h-[28rem] w-80 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2.5">
              <Avatar className="size-8 border border-border">
                <AvatarFallback className="bg-foreground text-background text-xs font-semibold">
                  M
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-semibold text-foreground leading-tight">Mike</p>
                <p className="text-[11px] text-muted-foreground leading-tight">Soporte Syncro</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <IconX className="size-4" />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-2.5 overflow-y-auto px-4 py-3">
            {messages.length === 0 ? (
              <p className="mt-6 text-center text-xs text-muted-foreground">
                Escríbele a Mike si necesitas ayuda con cualquier parte del sistema.
              </p>
            ) : (
              messages.map((msg) => {
                const isMe = msg.senderId === userIdRef.current;
                return (
                  <div key={msg.id} className={cn("flex", isMe ? "justify-end" : "justify-start")}>
                    <div
                      className={cn(
                        "max-w-[80%] rounded-xl px-3 py-2 text-xs leading-relaxed",
                        isMe
                          ? "bg-foreground text-background"
                          : "bg-muted text-foreground"
                      )}
                    >
                      {msg.text}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="flex items-center gap-2 border-t border-border p-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSend();
              }}
              placeholder="Escribe tu pregunta..."
              className="h-9 flex-1 rounded-lg border border-input bg-background px-3 text-xs outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            />
            <Button size="icon" className="size-9 shrink-0" onClick={handleSend} disabled={!input.trim()}>
              <IconSend className="size-4" />
            </Button>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-50 flex size-14 items-center justify-center rounded-full bg-foreground text-background shadow-lg transition-transform hover:scale-105"
      >
        {unread > 0 && !open && (
          <span className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
        <IconHeadset className="size-6" />
      </button>
    </>
  );
}

function MikeCursor({ position }: { position: CursorPosition }) {
  return (
    <div
      className="pointer-events-none fixed z-[60] flex items-center gap-1.5 transition-[left,top] duration-150 ease-out"
      style={{ left: `${position.x}%`, top: `${position.y}%` }}
    >
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" className="drop-shadow">
        <path d="M2 2L18 9L10 11L8 18L2 2Z" fill="#33456b" stroke="white" strokeWidth="1" />
      </svg>
      <span className="rounded-md bg-[#33456b] px-1.5 py-0.5 text-[10px] font-medium text-white shadow">
        Mike
      </span>
    </div>
  );
}
