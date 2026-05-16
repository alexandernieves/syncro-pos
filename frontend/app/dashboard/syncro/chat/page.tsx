"use client";

import React, { useState, useEffect, useRef } from "react";
import { API_URL } from "@/lib/constants"
import {
  IconSend,
  IconMicrophone,
  IconPaperclip,
  IconCheck,
  IconChecks,
  IconMoodSmile,
  IconDotsVertical,
  IconSearch,
  IconMessageCircle,
  IconBuilding,
  IconFilter,
  IconRefresh,
} from "@tabler/icons-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { io, Socket } from "socket.io-client";
import { usePushNotifications } from "@/hooks/usePushNotifications";

const API = process.env.NEXT_PUBLIC_API_URL || "${process.env.NEXT_PUBLIC_API_URL || `${API_URL}`}`;

export default function SyncroAdminChatPage() {
  const [conversations, setConversations] = useState<any[]>([]);
  const [activeConv, setActiveConv] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [search, setSearch] = useState("");
  const socketRef = useRef<Socket | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  usePushNotifications(user?.id ?? null);

  useEffect(() => {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      const u = JSON.parse(userStr);
      setUser(u);
      fetchConversations();
      initSocket(u.id);
    }
  }, []);

  const fetchConversations = async () => {
    try {
      const res = await fetch(`${API}/chat/support/sync`);
      if (res.ok) setConversations(await res.json());
    } catch {
      toast.error("Error al cargar chats");
    }
  };

  const initSocket = (userId: string) => {
    const socketUrl = API;
    socketRef.current = io(socketUrl, { query: { userId } });
    socketRef.current.on("newMessage", (msg: any) => {
      setMessages((prev) => {
        if (prev.length && prev[0].conversationId === msg.conversationId) {
          return [...prev, msg];
        }
        return prev;
      });
      setTimeout(scrollToBottom, 100);
      fetchConversations();
    });
  };

  const selectConversation = async (conv: any) => {
    setActiveConv(conv);
    setMessages([]);
    try {
      const res = await fetch(`${API}/chat/business/${conv.businessId}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
        socketRef.current?.emit("joinConversation", conv.id);
        setTimeout(scrollToBottom, 150);
      }
    } catch {
      toast.error("Error al cargar mensajes");
    }
  };

  const scrollToBottom = () => scrollRef.current?.scrollIntoView({ behavior: "smooth" });

  const handleSend = () => {
    if (!inputText.trim() || !socketRef.current || !activeConv) return;
    socketRef.current.emit("sendMessage", {
      conversationId: activeConv.id,
      senderId: user.id,
      text: inputText,
      type: "TEXT",
    });
    setInputText("");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", "chat");
    try {
      const res = await fetch(`${API}/upload`, { method: "POST", body: formData });
      const { url } = await res.json();
      const type = file.type.startsWith("video") ? "VIDEO" : "IMAGE";
      socketRef.current?.emit("sendMessage", {
        conversationId: activeConv.id,
        senderId: user.id,
        type,
        fileUrl: url,
      });
    } catch {
      toast.error("Error al subir archivo");
    } finally {
      setUploading(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      recorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const file = new File([blob], "voice.webm", { type: "audio/webm" });
        const formData = new FormData();
        formData.append("file", file);
        formData.append("folder", "chat/voice");
        const res = await fetch(`${API}/upload`, { method: "POST", body: formData });
        const { url } = await res.json();
        socketRef.current?.emit("sendMessage", {
          conversationId: activeConv.id,
          senderId: user.id,
          type: "AUDIO",
          fileUrl: url,
        });
      };
      recorder.start();
      setIsRecording(true);
    } catch {
      toast.error("No se pudo acceder al micrófono");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const renderContent = (msg: any) => {
    if (msg.type === "IMAGE") return <img src={msg.fileUrl} alt="" className="rounded-xl max-w-xs" />;
    if (msg.type === "VIDEO") return <video src={msg.fileUrl} controls className="rounded-xl max-w-xs" />;
    if (msg.type === "AUDIO") return <audio src={msg.fileUrl} controls className="w-56" />;
    return <span className="leading-relaxed">{msg.text}</span>;
  };

  const filtered = conversations.filter((c) =>
    c.business?.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex h-[calc(100vh-var(--header-height,60px))] overflow-hidden bg-background">

      {/* ── LEFT SIDEBAR ─────────────────────────────── */}
      <aside className="w-[300px] shrink-0 border-r flex flex-col">
        {/* Sidebar header */}
        <div className="p-4 border-b space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold tracking-tight">Mensajería</h2>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Panel de soporte SaaS</p>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={fetchConversations}>
              <IconRefresh size={16} className="text-muted-foreground" />
            </Button>
          </div>
          <div className="relative">
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <Input 
              placeholder="Buscar negocio..." 
              className="pl-9 bg-muted/50 border-none h-9 text-sm rounded-xl focus-visible:ring-1 focus-visible:ring-primary/20"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Conversations list */}
        <ScrollArea className="flex-1">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center gap-2">
              <div className="size-12 rounded-xl bg-muted flex items-center justify-center">
                <IconMessageCircle size={22} className="text-muted-foreground" />
              </div>
              <p className="text-xs text-muted-foreground">No hay conversaciones aún</p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {filtered.map((conv) => {
                const initials = conv.business?.name?.substring(0, 2).toUpperCase() ?? "??";
                const isActive = activeConv?.id === conv.id;
                return (
                  <button
                    key={conv.id}
                    onClick={() => selectConversation(conv)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left",
                      isActive
                        ? "bg-primary/10 border border-primary/20"
                        : "hover:bg-muted/60"
                    )}
                  >
                    <div className="relative shrink-0">
                      <Avatar className="size-10">
                        <AvatarFallback className={cn(
                          "text-xs font-bold",
                          isActive ? "bg-primary text-primary-foreground" : "bg-muted-foreground/20"
                        )}>
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <span className="absolute bottom-0 right-0 size-2.5 rounded-full bg-emerald-500 border-2 border-background" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-sm font-semibold truncate">{conv.business?.name ?? "Sin nombre"}</span>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {new Date(conv.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                        {conv.lastMessage ?? "Sin mensajes aún"}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Footer stats */}
        <div className="p-3 border-t bg-muted/10 shrink-0">
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <IconBuilding size={13} />
            <span>{conversations.length} negocio{conversations.length !== 1 ? "s" : ""} activo{conversations.length !== 1 ? "s" : ""}</span>
          </div>
        </div>
      </aside>

      {/* ── MAIN CHAT AREA ───────────────────────────── */}
      {activeConv ? (
        <div className="flex-1 flex flex-col min-w-0">
          {/* Chat header */}
          <div className="flex items-center justify-between px-5 py-3 border-b bg-background/90 backdrop-blur-sm shrink-0">
            <div className="flex items-center gap-3">
              <Avatar className="size-9">
                <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                  {activeConv.business?.name?.substring(0, 2).toUpperCase() ?? "??"}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold text-sm">{activeConv.business?.name ?? "Cliente"}</p>
                <p className="text-[11px] text-emerald-500 font-medium flex items-center gap-1">
                  <span className="size-1.5 rounded-full bg-emerald-500 inline-block" />
                  OwnerPOS · En línea
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="size-8 text-muted-foreground"><IconSearch size={16} /></Button>
              <Button variant="ghost" size="icon" className="size-8 text-muted-foreground"><IconDotsVertical size={16} /></Button>
            </div>
          </div>

          {/* Messages area */}
          <div className="flex-1 relative overflow-hidden">
            {/* Original Shadcn-style background */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/3 via-background to-muted/20" />
              <svg className="absolute inset-0 w-full h-full opacity-[0.04] dark:opacity-[0.07]" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <pattern id="admin-dots" x="0" y="0" width="28" height="28" patternUnits="userSpaceOnUse">
                    <circle cx="14" cy="14" r="1.5" fill="currentColor" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#admin-dots)" />
              </svg>
              <div className="absolute top-1/3 right-1/4 size-72 rounded-full bg-primary/4 blur-3xl" />
              <div className="absolute bottom-1/4 left-1/3 size-56 rounded-full bg-secondary/6 blur-3xl" />
            </div>

            <ScrollArea className="h-full">
              <div className="px-6 py-4 flex flex-col gap-2 relative">
                <div className="self-center">
                  <span className="text-[10px] font-medium px-3 py-1 rounded-full bg-muted/80 backdrop-blur-sm text-muted-foreground border">
                    Conversación con {activeConv.business?.name}
                  </span>
                </div>

                {messages.length === 0 && (
                  <div className="self-center mt-8 flex flex-col items-center gap-3 text-center max-w-xs">
                    <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                      <IconMessageCircle size={32} className="text-primary/60" />
                    </div>
                    <p className="text-sm font-semibold text-muted-foreground">Aún no hay mensajes</p>
                    <p className="text-xs text-muted-foreground/70">Inicia la conversación con este cliente.</p>
                  </div>
                )}

                {messages.map((msg, i) => {
                  const isMe = msg.senderId === user?.id;
                  return (
                    <div key={msg.id || i} className={cn("flex flex-col max-w-[70%]", isMe ? "self-end items-end" : "self-start items-start")}>
                      {!isMe && (
                        <span className="text-[10px] text-muted-foreground mb-1 ml-1">{msg.sender?.name ?? "Cliente"}</span>
                      )}
                      <div className={cn(
                        "px-4 py-2.5 rounded-2xl shadow-sm text-sm",
                        isMe
                          ? "bg-primary text-primary-foreground rounded-br-sm"
                          : "bg-card border rounded-bl-sm"
                      )}>
                        {renderContent(msg)}
                        <div className={cn("flex items-center gap-1 mt-1 text-[10px]", isMe ? "text-primary-foreground/60 justify-end" : "text-muted-foreground")}>
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          {isMe && (msg.isRead ? <IconChecks size={12} className="text-blue-300" /> : <IconCheck size={12} />)}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={scrollRef} />
              </div>
            </ScrollArea>
          </div>

          {/* Input bar */}
          <div className="px-4 py-3 border-t bg-background/90 backdrop-blur-sm shrink-0 flex items-center gap-2">
            <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground size-9">
              <IconMoodSmile size={20} />
            </Button>
            <div className="relative shrink-0">
              <Button variant="ghost" size="icon" className="text-muted-foreground size-9">
                <IconPaperclip size={20} />
              </Button>
              <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleFileUpload} accept="image/*,video/*" />
            </div>

            {isRecording ? (
              <div className="flex-1 flex items-center gap-3 px-4 h-10 bg-red-500/10 rounded-full border border-red-500/20">
                <span className="size-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-xs font-semibold text-red-500 flex-1">Grabando respuesta de voz...</span>
                <Button variant="ghost" size="sm" className="text-red-500 text-xs h-6 px-2" onClick={stopRecording}>Cancelar</Button>
              </div>
            ) : (
              <Input
                className="flex-1 h-10 rounded-full bg-muted/50 border-none focus-visible:ring-1 focus-visible:ring-primary/30 px-4 text-sm"
                placeholder={uploading ? "Subiendo archivo..." : "Responder al cliente..."}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                disabled={uploading}
              />
            )}

            <Button
              size="icon"
              className={cn("shrink-0 size-10 rounded-full transition-all", inputText.trim() ? "bg-primary shadow-lg shadow-primary/20" : "bg-muted text-muted-foreground")}
              onClick={inputText.trim() ? handleSend : (isRecording ? stopRecording : startRecording)}
            >
              {inputText.trim() ? <IconSend size={18} /> : (isRecording ? <IconSend size={18} /> : <IconMicrophone size={18} />)}
            </Button>
          </div>
        </div>
      ) : (
        /* Empty state */
        <div className="flex-1 flex items-center justify-center bg-muted/5 relative">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/3 via-background to-muted/10" />
            <svg className="absolute inset-0 w-full h-full opacity-[0.04] dark:opacity-[0.06]" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="empty-dots" x="0" y="0" width="28" height="28" patternUnits="userSpaceOnUse">
                  <circle cx="14" cy="14" r="1.5" fill="currentColor" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#empty-dots)" />
            </svg>
          </div>
          <div className="text-center z-10">
            <div className="size-20 rounded-3xl bg-primary/10 flex items-center justify-center mx-auto mb-5 border border-primary/10">
              <IconMessageCircle size={38} className="text-primary/50" />
            </div>
            <h3 className="text-lg font-bold">Syncro Central · Mensajería</h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-xs">
              Selecciona un negocio del panel izquierdo para ver la conversación y brindar soporte.
            </p>
            <Badge variant="outline" className="mt-4 text-xs">
              {conversations.length} conversación{conversations.length !== 1 ? "es" : ""} disponible{conversations.length !== 1 ? "s" : ""}
            </Badge>
          </div>
        </div>
      )}
    </div>
  );
}
