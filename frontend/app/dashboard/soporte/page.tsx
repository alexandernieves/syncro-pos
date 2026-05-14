"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  IconSend,
  IconMicrophone,
  IconPaperclip,
  IconCheck,
  IconChecks,
  IconMoodSmile,
  IconDotsVertical,
  IconPhone,
  IconVideo,
  IconSearch,
  IconMessageCircle,
  IconHeadset,
} from "@tabler/icons-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { io, Socket } from "socket.io-client";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { PWAInstallButton } from "@/components/pwa-install-button";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000";

export default function SupportChatPage() {
  const [messages, setMessages] = useState<any[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [inputText, setInputText] = useState("");
  const [conversation, setConversation] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  usePushNotifications(user?.id ?? null);
  
  useEffect(() => {
    console.log("[DEBUG] SupportChatPage component mounted. API:", API);
  }, []);

  // Role guard: support team has their own chat panel
  useEffect(() => {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      const u = JSON.parse(userStr);
      if (u.role === "syncropos") {
        window.location.replace("/dashboard/syncro/chat");
        return;
      }
      setUser(u);
      if (u.businessId) fetchConversation(u.businessId);
    }
  }, []);

  const fetchConversation = async (businessId: string) => {
    try {
      const res = await fetch(`${API}/chat/business/${businessId}`);
      if (res.ok) {
        const data = await res.json();
        setConversation(data);
        setMessages(data.messages || []);
        initSocket(data.id);
        setTimeout(scrollToBottom, 200);
      }
    } catch {
      toast.error("Error al conectar con soporte");
    }
  };

  const initSocket = (convId: string) => {
    const storedUserStr = localStorage.getItem("user");
    console.log("[DEBUG] Raw user from localStorage:", storedUserStr);
    const storedUser = JSON.parse(storedUserStr || "{}");
    
    if (!storedUser.id) {
      console.error("[DEBUG] No user ID found in localStorage. Cannot init socket.");
      return;
    }

    const socketUrl = API;
    console.log("[DEBUG] Initializing socket. URL:", socketUrl + "/chat", "User ID:", storedUser.id);
    
    if (socketRef.current) {
      console.log("[DEBUG] Cleaning up existing socket connection");
      socketRef.current.disconnect();
    }

    socketRef.current = io(socketUrl + "/chat", {
      transports: ["websocket", "polling"],
      query: { userId: storedUser.id },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    });
    
    socketRef.current.on("connect", () => {
      console.log("[DEBUG] Socket CONNECTED successfully. ID:", socketRef.current?.id);
      setIsConnected(true);
      socketRef.current?.emit("joinConversation", convId);
    });

    socketRef.current.on("disconnect", (reason) => {
      console.log("[DEBUG] Socket DISCONNECTED. Reason:", reason);
      setIsConnected(false);
    });

    socketRef.current.on("connect_error", (err) => {
      console.error("[DEBUG] Socket CONNECTION ERROR:", err.message);
      console.error("[DEBUG] Full error details:", {
        message: err.message,
        name: err.name,
        stack: err.stack,
        socketId: socketRef.current?.id,
        url: socketUrl
      });
      setIsConnected(false);
    });

    socketRef.current.on("newMessage", (msg: any) => {
      setMessages((prev) => {
        if (prev.some(m => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      setTimeout(scrollToBottom, 100);
    });
  };

  const scrollToBottom = () => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSend = () => {
    if (!inputText.trim()) return;

    if (!socketRef.current || !socketRef.current.connected || !conversation) {
      toast.error("Sin conexión al servidor. Reintentando...");
      if (user?.businessId) fetchConversation(user.businessId);
      return;
    }
    
    const msgData = {
      conversationId: conversation.id,
      senderId: user.id,
      text: inputText,
      type: "TEXT",
    };

    console.log("Emitting sendMessage:", msgData);
    socketRef.current.emit("sendMessage", msgData);
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
        conversationId: conversation.id,
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
          conversationId: conversation.id,
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

  return (
    <div className="flex h-[calc(100vh-var(--header-height,60px))] overflow-hidden bg-background">

      {/* ── LEFT SIDEBAR ─────────────────────────────── */}
      <aside className="w-[300px] shrink-0 border-r flex flex-col bg-muted/20">
        {/* Sidebar header */}
        <div className="px-4 py-4 border-b flex items-center gap-3 bg-background">
          <div className="size-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <IconHeadset size={20} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">Syncro Soporte</p>
            <p className="text-[11px] text-muted-foreground">Canal de ayuda</p>
          </div>
        </div>

        {/* Single conversation item */}
        <div className="flex-1 p-2">
          <div className={cn(
            "flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer transition-colors",
            "bg-primary/10 border border-primary/20"
          )}>
            <div className="relative">
              <Avatar className="size-11">
                <AvatarImage src="/syncro.png" />
                <AvatarFallback className="bg-primary text-primary-foreground font-bold text-sm">SP</AvatarFallback>
              </Avatar>
              <span className="absolute bottom-0 right-0 size-3 rounded-full bg-emerald-500 border-2 border-background" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">Soporte Syncro POS</p>
              <p className="text-[11px] text-muted-foreground truncate">
                {messages.at(-1)?.text ?? "Inicia una conversación..."}
              </p>
            </div>
            <Badge variant="secondary" className="bg-primary/15 text-primary text-[10px] shrink-0">
              Activo
            </Badge>
          </div>
        </div>

        {/* Info block */}
        <div className="p-4 border-t">
          <div className="rounded-xl bg-muted/40 p-3 space-y-1">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Horario de atención</p>
            <p className="text-xs text-foreground font-medium">Lun – Vie · 8am – 6pm</p>
            <p className="text-[10px] text-muted-foreground">Respuesta típica en minutos</p>
            <PWAInstallButton />
          </div>
        </div>
      </aside>

      {/* ── MAIN CHAT AREA ───────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Chat header */}
        <div className="flex items-center justify-between px-5 py-3 border-b bg-background/80 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-3">
            <Avatar className="size-9">
              <AvatarImage src="/syncro.png" />
              <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">SP</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold text-sm">Soporte Syncro POS</p>
              <p className={cn(
                "text-[11px] font-medium flex items-center gap-1",
                isConnected ? "text-emerald-500" : "text-amber-500"
              )}>
                <span className={cn(
                  "size-1.5 rounded-full inline-block",
                  isConnected ? "bg-emerald-500" : "bg-amber-500 animate-pulse"
                )} />
                {isConnected ? "En línea" : "Conectando..."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="size-8 text-muted-foreground"><IconSearch size={16} /></Button>
            <Button variant="ghost" size="icon" className="size-8 text-muted-foreground"><IconDotsVertical size={16} /></Button>
          </div>
        </div>

        {/* Messages scroll area with original Shadcn-style background */}
        <div className="flex-1 relative overflow-hidden">
          {/* ── Original geometric background ── */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/3 via-background to-secondary/5" />
            {/* Dot grid */}
            <svg className="absolute inset-0 w-full h-full opacity-[0.035] dark:opacity-[0.06]" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="dot-grid" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
                  <circle cx="12" cy="12" r="1.5" fill="currentColor" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#dot-grid)" />
            </svg>
            {/* Decorative blobs */}
            <div className="absolute top-1/4 left-1/3 size-64 rounded-full bg-primary/5 blur-3xl" />
            <div className="absolute bottom-1/4 right-1/4 size-48 rounded-full bg-secondary/8 blur-3xl" />
          </div>

          <ScrollArea className="h-full">
            <div className="px-5 py-4 flex flex-col gap-2 relative">
              {/* Date chip */}
              <div className="self-center">
                <span className="text-[10px] font-medium px-3 py-1 rounded-full bg-muted/80 backdrop-blur-sm text-muted-foreground border">
                  Hoy
                </span>
              </div>

              {/* Welcome message when empty */}
              {messages.length === 0 && (
                <div className="self-center mt-8 flex flex-col items-center gap-3 text-center max-w-xs">
                  <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <IconMessageCircle size={32} className="text-primary/60" />
                  </div>
                  <p className="text-sm font-semibold">¡Hola! ¿En qué te ayudamos?</p>
                  <p className="text-xs text-muted-foreground">Nuestro equipo de soporte está disponible para resolver cualquier duda sobre Syncro POS.</p>
                </div>
              )}

              {messages.map((msg, i) => {
                const isMe = msg.senderId === user?.id;
                return (
                  <div key={msg.id || i} className={cn("flex flex-col max-w-[72%]", isMe ? "self-end items-end" : "self-start items-start")}>
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
        <div className="px-4 py-3 border-t bg-background/80 backdrop-blur-sm shrink-0 flex items-center gap-2">
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
              <span className="text-xs font-semibold text-red-500 flex-1">Grabando nota de voz...</span>
              <Button variant="ghost" size="sm" className="text-red-500 text-xs h-6 px-2" onClick={stopRecording}>Cancelar</Button>
            </div>
          ) : (
            <Input
              className="flex-1 h-10 rounded-full bg-muted/50 border-none focus-visible:ring-1 focus-visible:ring-primary/30 px-4 text-sm"
              placeholder={uploading ? "Subiendo archivo..." : "Escribe un mensaje..."}
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
    </div>
  );
}
