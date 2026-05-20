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
  IconPhone,
  IconVideo,
  IconSearch,
  IconMessageCircle,
  IconHeadset,
  IconArrowLeft,
} from "@tabler/icons-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { io, Socket } from "socket.io-client";
import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { PWAInstallButton } from "@/components/pwa-install-button";
import { VoiceButton, VoiceButtonState } from "@/components/ui/voice-button";
import { AudioBubble } from "@/components/ui/audio-bubble";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from "@/components/ui/popover";

const EMOJI_CATEGORIES = [
  { label: "Caras", emojis: ["😀", "😃", "😄", "😁", "😅", "😂", "🤣", "😊", "😇", "🙂", "🙃", "😉", "😌", "😍", "🥰", "😘", "😗", "😙", "😚", "😋", "😛", "😝", "😜", "🤪", "🤨", "🧐", "🤓", "😎", "🤩", "🥳", "😏", "😒", "😞", "😔", "😟", "😕", "🙁", "☹️", "😣", "😖", "😫", "😩", "🥺", "😢", "😭", "😤", "😠", "😡", "🤬", "🤯", "😳", "🥵", "🥶", "😱", "😨", "😰", "😥", "😓", "🤗", "🤔", "🤭", "🤫", "🤥", "😶", "😐", "😑", "😬", "🙄", "😯", "😦", "😧", "😮", "😲", "🥱", "😴", "🤤", "😪", "😵", "🤐", "🥴", "🤢", "🤮", "🤧", "😷", "🤒", "🤕"] },
  { label: "Gestos", emojis: ["👋", "🤚", "🖐", "✋", "🖖", "👌", "🤏", "✌️", "🤞", "🤟", "🤘", "🤙", "👈", "👉", "👆", "🖕", "👇", "☝️", "👍", "👎", "✊", "👊", "🤛", "🤜", "👏", "🙌", "👐", "🤲", "🤝", "🙏", "✍️", "💅", "🤳", "💪", "🦾"] },
  { label: "Corazones", emojis: ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "❤️‍🔥", "❤️‍🩹", "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💟"] },
];

const API = API_URL;

export default function SupportChatPage() {
  const [messages, setMessages] = useState<any[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [inputText, setInputText] = useState("");
  const [conversation, setConversation] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [voiceState, setVoiceState] = useState<VoiceButtonState>("idle");
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const [otherLastSeen, setOtherLastSeen] = useState<string | null>(null);
  const [isOtherOnline, setIsOtherOnline] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [mounted, setMounted] = useState(false);
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");
  const [isStandalone, setIsStandalone] = useState(false);
  
  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined") {
      setIsStandalone(
        window.matchMedia("(display-mode: standalone)").matches ||
        window.location.search.includes("pwa=true") ||
        localStorage.getItem("is_pwa") === "true"
      );
    }
  }, []);

  usePushNotifications(user?.id ?? null);
  

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
        
        // Find other participant for status/lastSeen
        const other = data.participants?.find((p: any) => p.userId !== user?.id);
        if (other?.user) {
          setOtherLastSeen(other.user.lastSeen);
        }

        initSocket(data.id);
        setTimeout(scrollToBottom, 200);
      }
    } catch {
      toast.error("Error al conectar con soporte");
    }
  };

  const initSocket = (convId: string) => {
    const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
    if (!storedUser.id) return;

    const socketUrl = API;
    if (socketRef.current) socketRef.current.disconnect();

    socketRef.current = io(socketUrl, {
      transports: ["websocket", "polling"],
      query: { userId: storedUser.id },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    });
    
    socketRef.current.on("connect", () => {
      setIsConnected(true);
      socketRef.current?.emit("joinConversation", convId);
      // Mark as read when entering
      socketRef.current?.emit("markAsRead", { 
        conversationId: convId, 
        userId: storedUser.id 
      });
    });

    socketRef.current.on("disconnect", () => {
      setIsConnected(false);
    });

    socketRef.current.on("connect_error", () => {
      setIsConnected(false);
    });

    socketRef.current.on("newMessage", (msg: any) => {
      setMessages((prev) => {
        if (prev.some(m => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      
      // If we are the receiver and the chat is open, mark as read immediately
      if (msg.senderId !== storedUser.id) {
        socketRef.current?.emit("markAsRead", { 
          conversationId: convId, 
          userId: storedUser.id 
        });
      }
      setTimeout(scrollToBottom, 100);
    });

    socketRef.current.on("messagesRead", ({ conversationId }: { conversationId: string }) => {
      setMessages((prev) => 
        prev.map(m => ({ ...m, isRead: true }))
      );
    });

    socketRef.current.on("userTyping", ({ userId, isTyping }: { userId: string, isTyping: boolean }) => {
      if (userId !== storedUser.id) {
        setIsOtherTyping(isTyping);
      }
    });

    socketRef.current.on("userPresence", ({ userId, status }: { userId: string, status: string }) => {
      if (userId !== storedUser.id) {
        setIsOtherOnline(status === 'online');
      }
    });
  };

  const scrollToBottom = () => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleInputChange = (val: string) => {
    setInputText(val);
    
    if (!socketRef.current || !conversation) return;

    // Emit typing: true
    socketRef.current.emit('typing', { 
      conversationId: conversation.id, 
      isTyping: true 
    });

    // Clear existing timeout
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    // Set timeout to emit typing: false
    typingTimeoutRef.current = setTimeout(() => {
      socketRef.current?.emit('typing', { 
        conversationId: conversation.id, 
        isTyping: false 
      });
    }, 2000);
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
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
          // Update preview whenever we get data
          const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
          setAudioBlob(blob);
          setAudioPreviewUrl(URL.createObjectURL(blob));
        }
      };

      recorder.start(1000); // Collect data every second to keep preview updated
      setVoiceState("recording");
    } catch {
      toast.error("No se pudo acceder al micrófono");
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.pause();
      setVoiceState("preview");
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "paused") {
      mediaRecorderRef.current.resume();
      setVoiceState("recording");
    }
  };

  const stopAndSendRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.onstop = () => {
        sendVoiceNote(); // Send once stopped
      };
      mediaRecorderRef.current.stop();
    }
  };

  const sendVoiceNote = async () => {
    if (!audioBlob || !conversation) return;
    setVoiceState("processing");
    const file = new File([audioBlob], "voice.webm", { type: "audio/webm" });
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", "chat/voice");
    try {
      const res = await fetch(`${API}/upload`, { method: "POST", body: formData });
      const { url } = await res.json();
      socketRef.current?.emit("sendMessage", {
        conversationId: conversation.id,
        senderId: user.id,
        type: "AUDIO",
        fileUrl: url,
      });
      setVoiceState("success");
      setTimeout(() => {
        setVoiceState("idle");
        setAudioPreviewUrl(null);
        setAudioBlob(null);
      }, 1000);
    } catch {
      toast.error("Error al enviar audio");
      setVoiceState("error");
    }
  };

  const discardRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setAudioPreviewUrl(null);
    setAudioBlob(null);
    setVoiceState("idle");
  };

  const renderContent = (msg: any) => {
    if (msg.type === "IMAGE") return <img src={msg.fileUrl} alt="" className="rounded-xl max-w-xs" />;
    if (msg.type === "VIDEO") return <video src={msg.fileUrl} controls className="rounded-xl max-w-xs" />;
    if (msg.type === "AUDIO") return <AudioBubble url={msg.fileUrl} isMe={msg.senderId === user?.id} />;
    return <span className="leading-relaxed">{msg.text}</span>;
  };

  const addEmoji = (emoji: string) => {
    handleInputChange(inputText + emoji);
  };

  return (
    <>
    <div className={cn(
      "flex overflow-hidden bg-background",
      isStandalone ? "h-screen w-screen" : "h-[calc(100vh-var(--header-height,60px))]"
    )}>

      {/* ── LEFT SIDEBAR ─────────────────────────────── */}
      <aside className={cn(
        "w-full md:w-[300px] shrink-0 border-r flex flex-col bg-muted/20",
        mobileView === "list" ? "flex" : "hidden md:flex"
      )}>
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
          <div 
            onClick={() => setMobileView("chat")}
            className={cn(
              "flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer transition-colors",
              "bg-primary/10 border border-primary/20"
            )}
          >
            <div className="relative">
              <Avatar className="size-11">
                <AvatarImage src="/syncro.png" />
                <AvatarFallback className="bg-primary text-primary-foreground font-bold text-sm">SP</AvatarFallback>
              </Avatar>
              <span className={cn(
                "absolute bottom-0 right-0 size-3 rounded-full border-2 border-background transition-colors duration-300",
                isOtherOnline ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-muted-foreground/30"
              )} />
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
      <div className={cn(
        "flex-1 flex flex-col min-w-0",
        mobileView === "chat" ? "flex" : "hidden md:flex"
      )}>

        {/* Chat header */}
        <div className="flex items-center justify-between px-5 py-3 border-b bg-background/80 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden size-8 -ml-2 mr-1 text-muted-foreground"
              onClick={() => setMobileView("list")}
            >
              <IconArrowLeft size={20} />
            </Button>
            <Avatar className="size-9">
              <AvatarImage src="/syncro.png" />
              <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">SP</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold text-sm">
                Soporte Syncro POS
              </p>
              <div className="flex items-center gap-1.5 h-4">
                {mounted && (
                  isOtherTyping ? (
                    <span className="text-[11px] text-primary font-medium animate-pulse">
                      Escribiendo...
                    </span>
                  ) : (
                    <>
                      <span className={cn(
                        "size-2 rounded-full",
                        isOtherOnline ? "bg-emerald-500" : "bg-muted-foreground/30"
                      )} />
                      <span className="text-[11px] text-muted-foreground font-medium">
                        {isOtherOnline 
                          ? "En línea" 
                          : otherLastSeen 
                            ? `Últ. vez ${formatDistanceToNow(new Date(otherLastSeen), { addSuffix: true, locale: es })}`
                            : "Desconectado"
                        }
                      </span>
                    </>
                  )
                )}
              </div>
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
          </div>

          <ScrollArea className="h-full">
            <div className="px-5 py-4 flex flex-col gap-3 relative" style={{ filter: 'url(#gooey-effect)' }}>
              {/* Date chip */}
              <div className="self-center mb-4">
                <span className="text-[10px] font-medium px-3 py-1 rounded-full bg-muted/80 backdrop-blur-sm text-muted-foreground border">
                  Hoy
                </span>
              </div>

              {/* Welcome message */}
              {messages.length === 0 && (
                <div className="self-center mt-8 flex flex-col items-center gap-3 text-center max-w-xs">
                  <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <IconMessageCircle size={32} className="text-primary/60" />
                  </div>
                  <p className="text-sm font-semibold">¡Hola! ¿En qué te ayudamos?</p>
                </div>
              )}

              <AnimatePresence initial={false}>
                {messages.map((msg, i) => {
                  const isMe = msg.senderId === user?.id;
                  return (
                    <motion.div 
                      key={msg.id || i} 
                      initial={{ scale: 0.5, opacity: 0, y: 20 }}
                      animate={{ scale: 1, opacity: 1, y: 0 }}
                      exit={{ scale: 0.8, opacity: 0 }}
                      transition={{ type: "spring", stiffness: 400, damping: 25 }}
                      className={cn("flex flex-col max-w-[80%]", isMe ? "self-end items-end" : "self-start items-start")}
                    >
                      <div className={cn(
                        "px-4 py-2.5 rounded-2xl shadow-sm text-sm relative",
                        isMe
                          ? "bg-primary text-white rounded-tr-none"
                          : "bg-card border rounded-tl-none"
                      )}>
                        {renderContent(msg)}
                        <div className={cn("flex items-center gap-1 mt-1 text-[10px]", isMe ? "text-white/60 justify-end" : "text-muted-foreground")}>
                          {format(new Date(msg.createdAt), 'hh:mm a')}
                          {isMe && <IconChecks size={12} className={msg.isRead ? "text-sky-400" : "text-white/40"} />}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
              <div ref={scrollRef} />
            </div>
          </ScrollArea>
        </div>

        {/* Input bar */}
        <div className="px-4 py-3 border-t bg-background/80 backdrop-blur-sm shrink-0 flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground size-9 hover:bg-primary/10 hover:text-primary transition-colors">
                <IconMoodSmile size={20} />
              </Button>
            </PopoverTrigger>
            <PopoverContent side="top" align="start" className="w-[320px] p-0 border-none shadow-2xl rounded-2xl bg-popover/95 backdrop-blur-md overflow-hidden">
              <div className="flex flex-col h-[350px]">
                <div className="px-4 py-3 border-b bg-muted/30">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Emojis</p>
                </div>
                <ScrollArea className="flex-1">
                  <div className="p-3 space-y-4">
                    {EMOJI_CATEGORIES.map((cat) => (
                      <div key={cat.label} className="space-y-2">
                        <p className="text-[10px] font-bold text-muted-foreground px-1 uppercase">{cat.label}</p>
                        <div className="grid grid-cols-8 gap-1">
                          {cat.emojis.map((emoji) => (
                            <button
                              key={emoji}
                              onClick={() => addEmoji(emoji)}
                              className="size-8 flex items-center justify-center rounded-lg hover:bg-muted text-lg transition-all active:scale-90"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </PopoverContent>
          </Popover>
          <div className="relative shrink-0">
            <Button variant="ghost" size="icon" className="text-muted-foreground size-9">
              <IconPaperclip size={20} />
            </Button>
            <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleFileUpload} accept="image/*,video/*" />
          </div>

          {voiceState === "idle" ? (
            <Input
              className="flex-1 h-10 rounded-full bg-muted/50 border-none focus-visible:ring-1 focus-visible:ring-primary/30 px-4 text-sm"
              placeholder={uploading ? "Subiendo archivo..." : "Escribe un mensaje..."}
              value={inputText}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              disabled={uploading}
            />
          ) : null}

          {inputText.trim() && voiceState === "idle" ? (
            <Button
              size="icon"
              className="shrink-0 size-10 rounded-full bg-primary shadow-lg shadow-primary/20 transition-all"
              onClick={handleSend}
            >
              <IconSend size={18} />
            </Button>
          ) : (
            <VoiceButton
              state={voiceState}
              onStart={startRecording}
              onStop={pauseRecording}
              onResume={resumeRecording}
              onSend={stopAndSendRecording}
              onDiscard={discardRecording}
              audioPreviewUrl={audioPreviewUrl}
              className={cn("shrink-0 transition-all duration-300", voiceState !== "idle" && "flex-1")}
            />
          )}
        </div>
      </div>
    </div>
      {/* Gooey Filter Definition - Refined for sharp edges */}
      <svg className="absolute h-0 w-0" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="gooey-effect" colorInterpolationFilters="sRGB">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
            <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -9" result="goo" />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>
        </defs>
      </svg>
    </>
  );
}
