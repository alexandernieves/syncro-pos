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
  IconPower,
  IconTrash,
  IconSparkles,
  IconClock,
  IconLoader2,
  IconVolume,
  IconVolumeOff,
  IconX,
  IconHistory,
  IconPlus,
  IconThumbUp,
  IconThumbDown,
  IconCopy,
  IconBell,
  IconPin,
  IconPinFilled,
  IconArchive,
  IconArchiveOff,
  IconInbox,
} from "@tabler/icons-react";
import Link from "next/link";
import { ModeSwitcher } from "@/components/mode-switcher";
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
import { WhatsAppAudioPlayer } from "@/components/ui/whatsapp-audio-player";
import { motion, AnimatePresence } from "framer-motion";
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from "@/components/ui/popover";
import { Orb, AgentState } from "@/components/ui/orb";
import { useThemeConfig } from "@/components/active-theme";
import { BarVisualizer } from "@/components/ui/bar-visualizer";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const EMOJI_CATEGORIES = [
  { label: "Caras", emojis: ["😀", "😃", "😄", "😁", "😅", "😂", "🤣", "😊", "😇", "🙂", "🙃", "😉", "😌", "😍", "🥰", "😘", "😗", "😙", "😚", "😋", "😛", "😝", "😜", "🤪", "🤨", "🧐", "🤓", "😎", "🤩", "🥳", "😏", "😒", "😞", "😔", "😟", "😕", "🙁", "☹️", "😣", "😖", "😫", "😩", "🥺", "😢", "😭", "😤", "😠", "😡", "🤬", "🤯", "😳", "🥵", "🥶", "😱", "😨", "😰", "😥", "😓", "🤗", "🤔", "🤭", "🤫", "🤥", "😶", "😐", "😑", "😬", "🙄", "😯", "😦", "😧", "😮", "😲", "🥱", "😴", "🤤", "😪", "😵", "🤐", "🥴", "🤢", "🤮", "🤧", "😷", "🤒", "🤕"] },
  { label: "Gestos", emojis: ["👋", "🤚", "🖐", "✋", "🖖", "👌", "🤏", "✌️", "🤞", "🤟", "🤘", "🤙", "👈", "👉", "👆", "🖕", "👇", "☝️", "👍", "👎", "✊", "👊", "🤛", "🤜", "👏", "🙌", "👐", "🤲", "🤝", "🙏", "✍️", "💅", "🤳", "💪", "🦾"] },
  { label: "Corazones", emojis: ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "❤️‍🔥", "❤️‍🩹", "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💟"] },
];

const API = API_URL;

const getOrbColors = (theme: string): [string, string] => {
  const themeName = theme?.replace("-scaled", "") || "default";
  switch (themeName) {
    case "blue":
      return ["#2563eb", "#60a5fa"]; // Blue 600, Blue 400
    case "green":
      return ["#65a30d", "#a3e635"]; // Lime 600, Lime 400
    case "amber":
      return ["#d97706", "#fbbf24"]; // Amber 600, Amber 400
    case "mono":
      return ["#4b5563", "#9ca3af"]; // Gray 600, Gray 400
    default:
      return ["#4b5563", "#9ca3af"]; // Default Neutral 600, 400
  }
};

interface TypewriterProps {
  text: string;
  speed?: number;
  onChar?: () => void;
  onComplete?: () => void;
}

const Typewriter = ({ text, speed = 8, onChar, onComplete }: TypewriterProps) => {
  const [displayedText, setDisplayedText] = useState("");
  const onCharRef = useRef(onChar);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCharRef.current = onChar;
    onCompleteRef.current = onComplete;
  }, [onChar, onComplete]);

  useEffect(() => {
    let index = 0;
    setDisplayedText("");

    if (!text) {
      onCompleteRef.current?.();
      return;
    }

    const interval = setInterval(() => {
      setDisplayedText((prev) => {
        const next = prev + text.charAt(index);
        index++;
        if (index >= text.length) {
          clearInterval(interval);
          setTimeout(() => {
            onCompleteRef.current?.();
          }, 50);
        }
        if (onCharRef.current) {
          onCharRef.current();
        }
        return next;
      });
    }, speed);

    return () => clearInterval(interval);
  }, [text, speed]);

  return <span className="whitespace-pre-line leading-relaxed">{displayedText}</span>;
};

const IconElevenLabs = ({ className, size = 18 }: { className?: string; size?: number }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="currentColor"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M4.6035 0v24h4.9317V0zm9.8613 0v24h4.9317V0z" />
  </svg>
);

export default function SupportChatPage() {
  const { activeTheme } = useThemeConfig();
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
  const [viewportHeight, setViewportHeight] = useState("100dvh");
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>("default");

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  // AI Agent States
  const [chatType, setChatType] = useState<"human" | "ai">("human");
  const [aiMessages, setAiMessages] = useState<any[]>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiInputText, setAiInputText] = useState("");
  const [aiVoiceState, setAiVoiceState] = useState<"idle" | "listening">("idle");
  const [speechRecognition, setSpeechRecognition] = useState<any>(null);
  const [aiMediaStream, setAiMediaStream] = useState<MediaStream | null>(null);
  const [aiVoiceResponseEnabled, setAiVoiceResponseEnabled] = useState(true);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Sessions Management
  const [sessionId, setSessionId] = useState<string>("default");
  const [sessions, setSessions] = useState<any[]>([]);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyTab, setHistoryTab] = useState<"active" | "archived">("active");
  const [commentingMsgId, setCommentingMsgId] = useState<string | null>(null);
  const [feedbackComment, setFeedbackComment] = useState("");

  // Map loading/recording state to ElevenLabs AgentState
  const aiAgentState: AgentState = isAiLoading
    ? "thinking"
    : aiVoiceState === "listening"
      ? "listening"
      : aiSpeaking
        ? "talking"
        : null;

  const [quickActions, setQuickActions] = useState<Array<{ label: string; text: string }>>([
    { label: "¿Cómo hago el cuadre de caja?", text: "¿Cómo hago el cuadre de caja paso a paso?" },
    { label: "Ver mi turno activo", text: "Ver mi turno activo de hoy" },
    { label: "Registrar un egreso", text: "Quiero registrar un egreso para el negocio" },
    { label: "¿Cuánto vendí hoy?", text: "¿Cuánto he vendido hoy en total?" },
  ]);

  useEffect(() => {
    const lastRoute = localStorage.getItem("syncro_last_visited_dashboard_route") || "";
    if (lastRoute.includes("/productos") || lastRoute.includes("/inventario")) {
      setQuickActions([
        { label: "📦 Bajo Stock", text: "¿Qué productos tienen bajo stock?" },
        { label: "💰 Valor del Inventario", text: "¿Cuál es el valor total de mi inventario actual?" },
        { label: "🔥 Productos Más Vendidos", text: "¿Qué producto se vende más rápido y cuál es el top de ventas?" },
      ]);
    } else if (lastRoute.includes("/proveedores") || lastRoute.includes("/compras")) {
      setQuickActions([
        { label: "📝 Sugerir Orden de Compra", text: "Generar propuesta de orden de compra inteligente" },
        { label: "🚚 Facturas Pendientes", text: "¿Qué proveedores tienen facturas pendientes de pago?" },
        { label: "📊 Compras del Mes", text: "Ver resumen de compras de este mes" },
      ]);
    } else if (lastRoute.includes("/ventas") || lastRoute.includes("/facturas")) {
      setQuickActions([
        { label: "🎟️ Ticket Promedio", text: "¿Cuál es el ticket de venta promedio hoy?" },
        { label: "💳 Ventas por Transferencia", text: "¿Cuántas ventas se hicieron por transferencia y en efectivo hoy?" },
        { label: "⏱️ Últimas Ventas", text: "Ver las últimas transacciones de venta registradas" },
      ]);
    } else if (lastRoute.includes("/caja") || lastRoute.includes("/turnos") || lastRoute.includes("/contabilidad")) {
      setQuickActions([
        { label: "🔑 Cuadre Paso a Paso", text: "¿Cómo hago el cuadre de caja paso a paso?" },
        { label: "⏳ Ver Turno Activo", text: "Ver estado del turno activo de hoy" },
        { label: "💸 Registrar Egreso", text: "Quiero registrar un egreso para el negocio" },
      ]);
    }
  }, []);

  const resetScroll = () => {
    if (typeof window !== "undefined") {
      window.scrollTo(0, 0);
      if (document.body) document.body.scrollTop = 0;
      if (document.documentElement) document.documentElement.scrollTop = 0;
    }
  };

  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined") {
      const isMobile = window.matchMedia("(max-width: 1023px)").matches || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      const standalone = window.matchMedia("(display-mode: standalone)").matches;

      const useViewportResizing = standalone || isMobile;
      setIsStandalone(useViewportResizing);

      if (useViewportResizing) {
        document.documentElement.classList.add("pwa-standalone");
        document.body.classList.add("pwa-standalone");
      }

      const handleResize = () => {
        if (window.visualViewport) {
          const height = `${window.visualViewport.height}px`;
          setViewportHeight(height);

          if (useViewportResizing) {
            if (document.documentElement) {
              document.documentElement.style.height = height;
              document.documentElement.style.setProperty('overflow', 'hidden', 'important');
            }
            if (document.body) {
              document.body.style.height = height;
              document.body.style.setProperty('overflow', 'hidden', 'important');
            }
          }
          resetScroll();
        }
      };

      const handleScroll = () => {
        resetScroll();
      };

      if (window.visualViewport) {
        window.visualViewport.addEventListener("resize", handleResize);
        window.visualViewport.addEventListener("scroll", handleScroll);
        handleResize();
      }

      // Listen for window scrolls to instantly counter panned/scrolled layout viewports
      window.addEventListener("scroll", handleScroll, { passive: true });

      return () => {
        document.documentElement.classList.remove("pwa-standalone");
        document.body.classList.remove("pwa-standalone");
        if (document.documentElement) {
          document.documentElement.style.height = "";
          document.documentElement.style.overflow = "";
        }
        if (document.body) {
          document.body.style.height = "";
          document.body.style.overflow = "";
        }
        if (window.visualViewport) {
          window.visualViewport.removeEventListener("resize", handleResize);
          window.visualViewport.removeEventListener("scroll", handleScroll);
        }
        window.removeEventListener("scroll", handleScroll);
      };
    }
  }, []);

  // Pre-load browser speech synthesis voices so they are available on first use
  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    // Some browsers load voices asynchronously; trigger + listen for voiceschanged
    const load = () => { window.speechSynthesis.getVoices(); };
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", load);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (aiMediaStream) {
        aiMediaStream.getTracks().forEach(track => track.stop());
      }
      if (speechRecognition) {
        try {
          speechRecognition.onend = null;
          speechRecognition.stop();
        } catch (e) { }
      }
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, [aiMediaStream, speechRecognition]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
    document.cookie = "token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC; SameSite=Lax";
    window.location.href = "/";
  };

  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  const handleRequestNotificationPermission = async () => {
    if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) {
      toast.error("Tu dispositivo no es compatible con notificaciones push.");
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      
      if (permission === "granted") {
        toast.success("¡Permiso concedido!");
        
        const registration = await navigator.serviceWorker.ready;
        const res = await fetch(`${API}/push/vapid-key`);
        if (!res.ok) throw new Error("No VAPID key");
        const data = await res.json();
        const publicKey = data.publicKey;

        if (publicKey) {
          const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey)
          });

          await fetch(`${API}/push/subscribe`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: user?.id, subscription }),
          });
          toast.success("Notificaciones activadas con éxito.");
        }
      } else {
        toast.error("Permiso de notificaciones denegado.");
      }
    } catch (e: any) {
      console.error(e);
      toast.error("Error al activar notificaciones: " + e.message);
    }
  };

  usePushNotifications(user?.id ?? null);


  // Role guard: support team has their own chat panel
  useEffect(() => {
    const isPwa = typeof window !== "undefined" && window.matchMedia("(display-mode: standalone)").matches;
    const userStr = isPwa ? sessionStorage.getItem("user") : localStorage.getItem("user");
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

  // Fetch AI history when chatType changes to "ai"
  useEffect(() => {
    if (chatType === "ai") {
      fetchSessions().then((fetchedSessions) => {
        if (fetchedSessions && fetchedSessions.length > 0) {
          const latestSessionId = fetchedSessions[0].id;
          setSessionId(latestSessionId);
          fetchAiHistory(latestSessionId);
        } else {
          // If no sessions exist, generate a new random session ID
          const newSessionId = `session-${Date.now()}`;
          setSessionId(newSessionId);
          setAiMessages([]);
        }
      });
    }
  }, [chatType]);

  const fetchSessions = async () => {
    try {
      const isPwa = typeof window !== "undefined" && window.matchMedia("(display-mode: standalone)").matches;
      const token = isPwa ? sessionStorage.getItem("token") : localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };

      const res = await fetch(`${API}/ai-agent/sessions`, { headers });
      if (res.ok) {
        const data = await res.json();
        setSessions(data || []);
        return data;
      }
    } catch {
      console.error("Error al cargar sesiones");
    }
    return null;
  };

  const fetchAiHistory = async (id: string = sessionId) => {
    try {
      const isPwa = typeof window !== "undefined" && window.matchMedia("(display-mode: standalone)").matches;
      const token = isPwa ? sessionStorage.getItem("token") : localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };

      const res = await fetch(`${API}/ai-agent/history?sessionId=${id}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setAiMessages(data || []);
        setTimeout(scrollToBottom, 200);
      }
    } catch {
      toast.error("Error al cargar historial del Asistente IA");
    }
  };

  const handleSendAi = async (textToSend?: string) => {
    const text = textToSend !== undefined ? textToSend : aiInputText;
    if (!text.trim()) return;

    // Stop any active AI speech immediately when the user sends a new message
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setAiSpeaking(false);

    if (textToSend === undefined) {
      setAiInputText("");
    }

    const tempUserMsg = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };
    setAiMessages((prev) => [...prev, tempUserMsg]);
    setIsAiLoading(true);
    setTimeout(scrollToBottom, 50);

    try {
      const isPwa = typeof window !== "undefined" && window.matchMedia("(display-mode: standalone)").matches;
      const token = isPwa ? sessionStorage.getItem("token") : localStorage.getItem("token");
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      };

      const res = await fetch(`${API}/ai-agent/chat-stream`, {
        method: "POST",
        headers,
        body: JSON.stringify({ message: text, sessionId }),
      });

      if (res.ok) {
        const reader = res.body?.getReader();
        if (!reader) {
          throw new Error("No readable stream in response");
        }

        const decoder = new TextDecoder();
        let assistantText = "";
        const placeholderId = `temp-ai-${Date.now()}`;

        // Create the initial placeholder bubble
        const tempAiMsg = {
          id: placeholderId,
          role: "assistant",
          content: "",
          action: null,
          createdAt: new Date().toISOString(),
          isNew: false, // Turn off typewriter since we stream live!
        };
        setAiMessages((prev) => [...prev, tempAiMsg]);

        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || ""; // Keep the last incomplete line

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            if (trimmed.startsWith("data: ")) {
              try {
                const parsed = JSON.parse(trimmed.slice(6));
                if (parsed.chunk) {
                  assistantText += parsed.chunk;
                  setAiMessages((prev) =>
                    prev.map((m) =>
                      m.id === placeholderId ? { ...m, content: assistantText } : m
                    )
                  );
                  setTimeout(scrollToBottom, 30);
                }
                if (parsed.done) {
                  const savedId = parsed.id || placeholderId;
                  setAiMessages((prev) =>
                    prev.map((m) =>
                      m.id === placeholderId
                        ? { ...m, id: savedId, content: parsed.message, action: parsed.action }
                        : m
                    )
                  );
                  
                  // Speak response if voice response is enabled
                  if (aiVoiceResponseEnabled && parsed.message) {
                    playAiVoiceResponse(parsed.message);
                  }
                }
              } catch (e) {
                // Ignore parsing errors for partial lines
              }
            }
          }
        }
      } else {
        toast.error("El Asistente IA no pudo responder.");
      }
    } catch {
      toast.error("Error de conexión con el Asistente IA");
    } finally {
      setIsAiLoading(false);
      setTimeout(scrollToBottom, 100);
    }
  };

  const handleCopy = (text: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      toast.success("¡Texto copiado al portapapeles!");
    } else {
      toast.error("Tu navegador no soporta la copia automática.");
    }
  };

  const handleFeedback = async (msgId: string, rating: "LIKE" | "DISLIKE", comment?: string) => {
    try {
      const isPwa = typeof window !== "undefined" && window.matchMedia("(display-mode: standalone)").matches;
      const token = isPwa ? sessionStorage.getItem("token") : localStorage.getItem("token");
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      };

      const msgIndex = aiMessages.findIndex(m => m.id === msgId);
      if (msgIndex === -1) return;
      const responseMsg = aiMessages[msgIndex];

      let promptText = "";
      for (let i = msgIndex - 1; i >= 0; i--) {
        if (aiMessages[i].role === "user") {
          promptText = aiMessages[i].content;
          break;
        }
      }
      if (!promptText) promptText = "Consulta general de soporte";

      const res = await fetch(`${API}/ai-agent/feedback`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          messageId: msgId.startsWith("temp-") ? undefined : msgId,
          prompt: promptText,
          response: responseMsg.content,
          rating,
          comment
        })
      });

      if (res.ok) {
        setAiMessages(prev => prev.map(m => m.id === msgId ? { ...m, rating, comment } : m));
        toast.success(rating === "LIKE" ? "¡Gracias por calificar la respuesta!" : "¡Gracias por tu comentario para ayudarnos a mejorar!");
      } else {
        toast.error("No se pudo enviar la calificación.");
      }
    } catch {
      toast.error("Error de conexión al enviar feedback.");
    }
  };


  // ── End Voice Mode ───────────────────────────────────────────────────────────

  const startAiVoice = async () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("La entrada por voz no es compatible con este navegador. Por favor usa Google Chrome o Safari.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setAiMediaStream(stream);

      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = "es-VE";

      recognition.onstart = () => {
        setAiVoiceState("listening");
        toast.info("Escuchando por voz...");
      };

      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0])
          .map((result: any) => result.transcript)
          .join("");

        setAiInputText(transcript);
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        if (event.error !== "no-speech") {
          toast.error("Error al reconocer la voz.");
        }
        stopAiVoice(stream, recognition, false);
      };

      recognition.onend = () => {
        setTimeout(() => {
          stopAiVoice(stream, recognition, false); // CHANGED: Do NOT auto-send! Keep in input for editing
        }, 300);
      };

      setSpeechRecognition(recognition);
      recognition.start();
    } catch (err) {
      toast.error("No se pudo acceder al micrófono");
    }
  };

  const stopAiVoice = (stream?: MediaStream | null, recognition?: any, shouldSend = false) => {
    const activeStream = stream !== undefined ? stream : aiMediaStream;
    if (activeStream) {
      activeStream.getTracks().forEach(track => track.stop());
      setAiMediaStream(null);
    }

    const activeRec = recognition !== undefined ? recognition : speechRecognition;
    if (activeRec) {
      try {
        activeRec.onend = null;
        activeRec.stop();
      } catch (e) { }
      setSpeechRecognition(null);
    }

    setAiVoiceState("idle");

    if (shouldSend) {
      setAiInputText(prev => {
        const text = prev.trim();
        if (text) {
          handleSendAi(text);
        }
        return "";
      });
    }
  };

  const cleanTextForSpeech = (text: string): string => {
    if (!text) return "";
    return text
      .replace(/[\u{1F300}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F1E6}-\u{1F1FF}\u{1F191}-\u{1F251}\u{1F004}\u{1F0CF}\u{1F170}-\u{1F171}\u{1F17E}-\u{1F17F}\u{1F18E}\u{3030}\u{2B50}\u{2B55}\u{2934}-\u{2935}\u{2B05}-\u{2B07}\u{2b1b}\u{2b1c}\u{3297}\u{3299}\u{303d}\u{00a9}\u{00ae}\u{2122}\u{23f3}\u{24c2}\u{23e9}-\u{23ef}\u{25b6}\u{23f8}-\u{23fa}]/gu, "")
      .replace(/\*+/g, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/```action[\s\S]*?```/g, "")
      .replace(/```[\s\S]*?```/g, "")
      .replace(/\s+/g, " ")
      .trim();
  };

  const getBestSpanishVoice = () => {
    if (typeof window === "undefined" || !window.speechSynthesis) return null;
    const voices = window.speechSynthesis.getVoices();
    // Prioritize natural premium Spanish voices (Google, Siri, Mónica, Paulina, etc.)
    const preferredNames = ["google español", "siri", "monica", "paulina", "marisol", "jorge"];
    let spanishVoice = null;
    for (const name of preferredNames) {
      spanishVoice = voices.find(v => v.lang.startsWith("es") && v.name.toLowerCase().includes(name));
      if (spanishVoice) break;
    }
    if (!spanishVoice) {
      spanishVoice = voices.find(v => v.lang.startsWith("es")) || voices[0] || null;
    }
    return spanishVoice;
  };

  const speakBrowserTts = (text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();

    const cleaned = cleanTextForSpeech(text);
    if (!cleaned) return;

    const utterance = new SpeechSynthesisUtterance(cleaned);
    utterance.lang = "es-VE";
    
    // Tweak properties for a more natural, slightly energetic voice
    utterance.rate = 1.05;
    utterance.pitch = 1.02;

    const voice = getBestSpanishVoice();
    if (voice) {
      utterance.voice = voice;
    }

    utterance.onstart = () => {
      setAiSpeaking(true);
    };
    utterance.onend = () => {
      setAiSpeaking(false);
    };
    utterance.onerror = () => {
      setAiSpeaking(false);
    };
    window.speechSynthesis.speak(utterance);
  };

  const playAiVoiceResponse = async (text: string) => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    const cleaned = cleanTextForSpeech(text);
    if (!cleaned) return;

    try {
      const isPwa = typeof window !== "undefined" && window.matchMedia("(display-mode: standalone)").matches;
      const token = isPwa ? sessionStorage.getItem("token") : localStorage.getItem("token");

      const res = await fetch(`${API}/ai-agent/tts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ text: cleaned }),
      });

      if (!res.ok) {
        throw new Error("ElevenLabs TTS endpoint failed");
      }

      const blob = await res.blob();
      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onplay = () => {
        setAiSpeaking(true);
      };
      audio.onended = () => {
        setAiSpeaking(false);
      };
      audio.onerror = () => {
        setAiSpeaking(false);
        speakBrowserTts(cleaned);
      };

      audio.play();
    } catch (err) {
      console.warn("ElevenLabs TTS failed, falling back to browser SpeechSynthesis:", err);
      speakBrowserTts(cleaned);
    }
  };

  const handleConfirmAction = async (msgId: string, action: any) => {
    try {
      const isPwa = typeof window !== "undefined" && window.matchMedia("(display-mode: standalone)").matches;
      const token = isPwa ? sessionStorage.getItem("token") : localStorage.getItem("token");
      const currentBranchId = localStorage.getItem("currentBranchId") || user?.branchIds?.[0] || "";
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      };

      const res = await fetch(`${API}/ai-agent/confirm-action`, {
        method: "POST",
        headers,
        body: JSON.stringify({ action, branchId: currentBranchId, msgId }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          toast.success(data.message);
          setAiMessages((prev) =>
            prev.map(m => {
              if (m.id === msgId || (m.action && m.action.label === action.label)) {
                return { ...m, actionConfirmed: true };
              }
              return m;
            })
          );
        } else {
          toast.error(data.message);
        }
      } else {
        toast.error("Error al ejecutar la acción.");
      }
    } catch (err) {
      toast.error("Error de conexión al confirmar la acción.");
    }
  };

  const handleUndoAction = async (msgId: string) => {
    try {
      const isPwa = typeof window !== "undefined" && window.matchMedia("(display-mode: standalone)").matches;
      const token = isPwa ? sessionStorage.getItem("token") : localStorage.getItem("token");
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      };

      const res = await fetch(`${API}/ai-agent/undo-action`, {
        method: "POST",
        headers,
        body: JSON.stringify({ msgId }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          toast.success(data.message);
          setAiMessages((prev) =>
            prev.map(m => m.id === msgId ? { ...m, actionConfirmed: false } : m)
          );
        } else {
          toast.error(data.message);
        }
      } else {
        toast.error("Error al deshacer el registro.");
      }
    } catch (err) {
      toast.error("Error de conexión al deshacer el registro.");
    }
  };

  const handleDismissAction = async (msgId: string) => {
    try {
      const isPwa = typeof window !== "undefined" && window.matchMedia("(display-mode: standalone)").matches;
      const token = isPwa ? sessionStorage.getItem("token") : localStorage.getItem("token");
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      };

      const res = await fetch(`${API}/ai-agent/dismiss-action`, {
        method: "POST",
        headers,
        body: JSON.stringify({ msgId }),
      });

      if (res.ok) {
        setAiMessages((prev) =>
          prev.map((m) => m.id === msgId ? { ...m, actionConfirmed: 'dismissed' } : m)
        );
        toast.info("Acción sugerida cancelada.");
      } else {
        setAiMessages((prev) =>
          prev.map((m) => m.id === msgId ? { ...m, actionConfirmed: 'dismissed' } : m)
        );
        toast.info("Acción sugerida cancelada.");
      }
    } catch {
      setAiMessages((prev) =>
        prev.map((m) => m.id === msgId ? { ...m, actionConfirmed: 'dismissed' } : m)
      );
      toast.info("Acción sugerida cancelada.");
    }
  };

  const handleClearAiHistory = async () => {
    try {
      const isPwa = typeof window !== "undefined" && window.matchMedia("(display-mode: standalone)").matches;
      const token = isPwa ? sessionStorage.getItem("token") : localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };

      const res = await fetch(`${API}/ai-agent/history?sessionId=${sessionId}`, { method: "DELETE", headers });
      if (res.ok) {
        setAiMessages([]);
        toast.success("Historial del chat actual borrado.");
        fetchSessions();
      }
    } catch {
      toast.error("Error al borrar historial");
    }
  };

  const handlePinSession = async (sId: string, isPinned: boolean) => {
    try {
      const isPwa = typeof window !== "undefined" && window.matchMedia("(display-mode: standalone)").matches;
      const token = isPwa ? sessionStorage.getItem("token") : localStorage.getItem("token");
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      };

      const res = await fetch(`${API}/ai-agent/sessions/pin`, {
        method: "POST",
        headers,
        body: JSON.stringify({ sessionId: sId, isPinned })
      });
      if (res.ok) {
        toast.success(isPinned ? "Conversación pineada" : "Conversación despineada");
        fetchSessions();
      }
    } catch {
      toast.error("Error al modificar estado de pin");
    }
  };

  const handleArchiveSession = async (sId: string, isArchived: boolean) => {
    try {
      const isPwa = typeof window !== "undefined" && window.matchMedia("(display-mode: standalone)").matches;
      const token = isPwa ? sessionStorage.getItem("token") : localStorage.getItem("token");
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      };

      const res = await fetch(`${API}/ai-agent/sessions/archive`, {
        method: "POST",
        headers,
        body: JSON.stringify({ sessionId: sId, isArchived })
      });
      if (res.ok) {
        toast.success(isArchived ? "Conversación archivada" : "Conversación desarchivada");
        fetchSessions();
      }
    } catch {
      toast.error("Error al archivar conversación");
    }
  };

  const handleDeleteSession = async (sId: string) => {
    if (!confirm("¿Estás seguro de que deseas eliminar este chat permanentemente?")) return;
    try {
      const isPwa = typeof window !== "undefined" && window.matchMedia("(display-mode: standalone)").matches;
      const token = isPwa ? sessionStorage.getItem("token") : localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };

      const res = await fetch(`${API}/ai-agent/sessions?sessionId=${sId}`, { method: "DELETE", headers });
      if (res.ok) {
        toast.success("Chat eliminado correctamente.");
        const updated = await fetchSessions();
        if (sessionId === sId) {
          if (updated && updated.length > 0) {
            const firstActive = updated.find((s: any) => !s.isArchived);
            if (firstActive) {
              setSessionId(firstActive.id);
              setAiMessages([]);
              fetchAiHistory(firstActive.id);
            } else {
              setSessionId(updated[0].id);
              setAiMessages([]);
              fetchAiHistory(updated[0].id);
            }
          } else {
            const newId = `session-${Date.now()}`;
            setSessionId(newId);
            setAiMessages([]);
          }
        }
      }
    } catch {
      toast.error("Error al eliminar chat");
    }
  };

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
    const isPwa = typeof window !== "undefined" && window.matchMedia("(display-mode: standalone)").matches;
    const userStr = isPwa ? sessionStorage.getItem("user") : localStorage.getItem("user");
    const storedUser = JSON.parse(userStr || "{}");
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

  const renderContent = (msg: any, isMe: boolean) => {
    if (msg.type === "IMAGE") return <img src={msg.fileUrl} alt="" className="rounded-xl max-w-xs" />;
    if (msg.type === "VIDEO") return <video src={msg.fileUrl} controls className="rounded-xl max-w-xs" />;
    if (msg.type === "AUDIO" || msg.type === "audio") {
      const timestamp = new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      return (
        <WhatsAppAudioPlayer
          src={msg.fileUrl}
          isMe={isMe}
          timestamp={timestamp}
          isRead={msg.isRead}
          senderAvatar={!isMe ? "/syncro.png" : undefined}
          senderFallback={!isMe ? "SP" : undefined}
        />
      );
    }
    return <span className="leading-relaxed">{msg.text}</span>;
  };

  const addEmoji = (emoji: string) => {
    handleInputChange(inputText + emoji);
  };

  return (
    <>
      <div
        style={isStandalone ? { height: viewportHeight } : {}}
        className={cn(
          "flex bg-background w-full overflow-hidden",
          isStandalone
            ? "fixed top-0 left-0 right-0"
            : "h-[calc(100vh-var(--header-height,60px))]"
        )}>

        <div className="flex w-full h-full">

          {/* ── LEFT SIDEBAR ─────────────────────────────── */}
          <aside className={cn(
            "shrink-0 border-r flex flex-col bg-muted/20",
            isStandalone
              ? mobileView === "list" ? "flex w-full" : "hidden"
              : "w-[300px] hidden md:flex"
          )}>
            {/* Sidebar header */}
            <div className="px-4 py-4 border-b flex items-center justify-between bg-background">
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-xl bg-primary/10 flex items-center justify-center">
                  <IconHeadset size={20} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">Syncro Soporte</p>
                  <p className="text-[11px] text-muted-foreground">Canal de ayuda</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <ModeSwitcher />
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 rounded-lg"
                  onClick={handleLogout}
                  title="Cerrar sesión"
                >
                  <IconPower size={18} />
                </Button>
              </div>
            </div>

            {/* Single conversation item */}
            <div className="flex-1 p-2 space-y-1.5">
              {/* Soporte Humano */}
              <div
                onClick={() => {
                  setChatType("human");
                  setMobileView("chat");
                }}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors border",
                  chatType === "human"
                    ? "bg-primary/10 border-primary/20 text-primary"
                    : "hover:bg-muted/40 border-transparent text-muted-foreground"
                )}
              >
                <div className="relative">
                  <Avatar className="size-10">
                    <AvatarImage src="/syncro.png" />
                    <AvatarFallback className="bg-primary text-primary-foreground font-bold text-xs">SP</AvatarFallback>
                  </Avatar>
                  <span className={cn(
                    "absolute bottom-0 right-0 size-2.5 rounded-full border-2 border-background transition-colors duration-300",
                    isOtherOnline ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-muted-foreground/30"
                  )} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn("font-bold text-xs truncate", chatType === "human" ? "text-foreground" : "text-muted-foreground")}>Soporte Humano</p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {messages.at(-1)?.text ?? "Inicia una conversación..."}
                  </p>
                </div>
                {chatType === "human" && (
                  <Badge variant="secondary" className="bg-primary/15 text-primary text-[9px] shrink-0 font-bold">
                    Activo
                  </Badge>
                )}
              </div>

              {/* Asistente IA */}
              <div
                onClick={() => {
                  setChatType("ai");
                  setMobileView("chat");
                }}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors border",
                  chatType === "ai"
                    ? "bg-primary/10 border-primary/20 text-primary shadow-xs"
                    : "hover:bg-muted/40 border-transparent text-muted-foreground"
                )}
              >
                <div className="relative">
                  <div className="size-10 rounded-full overflow-hidden bg-primary/5 flex items-center justify-center shadow-md">
                    <Orb
                      className="size-10"
                      agentState={chatType === "ai" ? aiAgentState : null}
                      colors={getOrbColors(activeTheme)}
                    />
                  </div>
                  <span className="absolute bottom-0 right-0 size-2.5 rounded-full border-2 border-background bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn("font-bold text-xs truncate", chatType === "ai" ? "text-primary" : "text-muted-foreground")}>Syncro IA</p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    Cierre, ingresos y egresos
                  </p>
                </div>
                {chatType === "ai" && (
                  <Badge variant="secondary" className="bg-primary/15 text-primary text-[9px] shrink-0 font-bold">
                    IA
                  </Badge>
                )}
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
            "flex flex-col min-w-0",
            isStandalone
              ? mobileView === "chat" ? "flex flex-1" : "hidden"
              : "flex-1"
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
                {chatType === "human" ? (
                  <>
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
                                  : (() => {
                                    try {
                                      if (!otherLastSeen) return "Desconectado";
                                      const d = new Date(otherLastSeen);
                                      if (isNaN(d.getTime())) return "Desconectado";
                                      return `Últ. vez ${formatDistanceToNow(d, { addSuffix: true, locale: es })}`;
                                    } catch (e) {
                                      return "Desconectado";
                                    }
                                  })()
                                }
                              </span>
                            </>
                          )
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="size-9 rounded-full overflow-hidden bg-primary/5 flex items-center justify-center shadow-md">
                      <Orb
                        className="size-9"
                        agentState={aiAgentState}
                        colors={getOrbColors(activeTheme)}
                      />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-primary flex items-center gap-1">
                        Syncro IA <IconSparkles size={12} className="text-primary animate-pulse" />
                      </p>
                      <div className="flex items-center gap-1.5 h-4">
                        <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[10px] text-muted-foreground font-medium">Asistente Virtual Activo</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
              <div className="flex items-center gap-1">
                {chatType === "human" ? (
                  <>
                    <Button variant="ghost" size="icon" className="size-8 text-muted-foreground"><IconPhone size={16} /></Button>
                    <Button variant="ghost" size="icon" className="size-8 text-muted-foreground"><IconVideo size={16} /></Button>
                    <Button variant="ghost" size="icon" className="size-8 text-muted-foreground"><IconSearch size={16} /></Button>
                    <Button variant="ghost" size="icon" className="size-8 text-muted-foreground"><IconDotsVertical size={16} /></Button>
                  </>
                ) : (
                  <>
                    {/* Dialog is rendered outside, with manual open state via isHistoryModalOpen */}
                    <Dialog open={isHistoryModalOpen} onOpenChange={setIsHistoryModalOpen}>
                      <DialogContent className="max-w-md w-[90vw] bg-background/95 backdrop-blur-md border-border">
                        <DialogHeader>
                          <DialogTitle className="flex items-center justify-between">
                            Historial de Conversaciones
                            <Button
                              variant="default"
                              size="sm"
                              className="h-8 gap-1 rounded-lg"
                              onClick={() => {
                                setSessionId(`session-${Date.now()}`);
                                setAiMessages([]);
                                setIsHistoryModalOpen(false);
                              }}
                            >
                              <IconPlus size={14} /> Nuevo Chat
                            </Button>
                          </DialogTitle>
                        </DialogHeader>

                        {/* Tabs Container */}
                        <div className="flex border-b border-border mt-3 mb-2">
                          <button
                            onClick={() => setHistoryTab("active")}
                            className={cn(
                              "flex-1 pb-2 text-xs font-bold transition-all border-b-2 text-center",
                              historyTab === "active"
                                ? "border-primary text-primary"
                                : "border-transparent text-muted-foreground hover:text-foreground"
                            )}
                          >
                            Chats Activos
                          </button>
                          <button
                            onClick={() => setHistoryTab("archived")}
                            className={cn(
                              "flex-1 pb-2 text-xs font-bold transition-all border-b-2 text-center",
                              historyTab === "archived"
                                ? "border-primary text-primary"
                                : "border-transparent text-muted-foreground hover:text-foreground"
                            )}
                          >
                            Chats Archivados
                          </button>
                        </div>

                        <ScrollArea className="max-h-[60vh] mt-2 pr-3">
                          {sessions.filter(s => historyTab === "active" ? !s.isArchived : s.isArchived).length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                              {historyTab === "active" ? (
                                <>
                                  <IconMessageCircle size={32} className="mb-2 opacity-20" />
                                  <p className="text-sm">No hay chats activos anteriores.</p>
                                </>
                              ) : (
                                <>
                                  <IconInbox size={32} className="mb-2 opacity-20" />
                                  <p className="text-sm">No hay chats archivados.</p>
                                </>
                              )}
                            </div>
                          ) : (
                            <div className="flex flex-col gap-2">
                              {sessions
                                .filter(s => historyTab === "active" ? !s.isArchived : s.isArchived)
                                .map(s => (
                                  <div
                                    key={s.id}
                                    className={cn(
                                      "group relative flex items-center justify-between p-3 rounded-xl border transition-all text-sm",
                                      sessionId === s.id
                                        ? "bg-primary/10 border-primary/20 text-foreground"
                                        : "bg-background border-border hover:bg-muted text-muted-foreground"
                                    )}
                                  >
                                    <button
                                      onClick={() => {
                                        setSessionId(s.id);
                                        setAiMessages([]);
                                        fetchAiHistory(s.id);
                                        setIsHistoryModalOpen(false);
                                      }}
                                      className="flex-1 text-left min-w-0 pr-2"
                                    >
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        {s.isPinned && (
                                          <IconPinFilled size={12} className="text-primary shrink-0 rotate-45" />
                                        )}
                                        <span className="font-semibold text-foreground line-clamp-1">{s.title}</span>
                                      </div>
                                      <span className="text-[10px] text-muted-foreground block mt-1">
                                        {format(new Date(s.createdAt), "dd MMM yyyy, h:mm a", { locale: es })}
                                      </span>
                                    </button>

                                    {/* Action Buttons Row */}
                                    <div className="flex items-center gap-1 shrink-0">
                                      {/* Pin/Unpin */}
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handlePinSession(s.id, !s.isPinned);
                                        }}
                                        title={s.isPinned ? "Despinear chat" : "Pinear chat"}
                                        className={cn(
                                          "p-1.5 rounded-lg transition-all hover:bg-primary/15 active:scale-90",
                                          s.isPinned ? "text-primary bg-primary/10" : "text-muted-foreground/60 hover:text-primary"
                                        )}
                                      >
                                        {s.isPinned ? <IconPinFilled size={14} className="rotate-45" /> : <IconPin size={14} />}
                                      </button>

                                      {/* Archive/Unarchive */}
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleArchiveSession(s.id, !s.isArchived);
                                        }}
                                        title={s.isArchived ? "Mover a activos" : "Archivar chat"}
                                        className="p-1.5 rounded-lg text-muted-foreground/60 transition-all hover:bg-primary/15 hover:text-primary active:scale-90"
                                      >
                                        {s.isArchived ? <IconArchiveOff size={14} /> : <IconArchive size={14} />}
                                      </button>

                                      {/* Delete */}
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeleteSession(s.id);
                                        }}
                                        title="Eliminar chat"
                                        className="p-1.5 rounded-lg text-muted-foreground/60 transition-all hover:bg-rose-500/10 hover:text-rose-500 active:scale-90"
                                      >
                                        <IconTrash size={14} />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                            </div>
                          )}
                        </ScrollArea>
                      </DialogContent>
                    </Dialog>

                    <Button variant="ghost" size="icon" className="size-8 text-muted-foreground"><IconSearch size={16} /></Button>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8 text-muted-foreground rounded-lg hover:bg-muted active:scale-95 transition-all">
                          <IconDotsVertical size={16} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56 bg-background/95 backdrop-blur-md border border-border rounded-xl p-1.5 shadow-xl">
                        
                        <DropdownMenuItem asChild>
                          <Link href="/dashboard/soporte/voz" className="flex items-center gap-2.5 px-3 py-2 text-sm font-semibold rounded-lg cursor-pointer text-muted-foreground hover:text-foreground">
                            <IconMicrophone size={16} className="text-primary" />
                            <span>Modo Voz (Tiempo real)</span>
                          </Link>
                        </DropdownMenuItem>

                        <DropdownMenuItem 
                          onClick={() => setIsHistoryModalOpen(true)}
                          className="flex items-center gap-2.5 px-3 py-2 text-sm font-semibold rounded-lg cursor-pointer text-muted-foreground hover:text-foreground"
                        >
                          <IconHistory size={16} className="text-primary" />
                          <span>Historial de Chats</span>
                        </DropdownMenuItem>

                        <DropdownMenuItem 
                          onClick={() => {
                            const nextVal = !aiVoiceResponseEnabled;
                            setAiVoiceResponseEnabled(nextVal);
                            toast.success(nextVal ? "Respuestas por voz activadas" : "Respuestas por voz desactivadas");
                            if (!nextVal) {
                              if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
                              if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
                              setAiSpeaking(false);
                            }
                          }}
                          className="flex items-center justify-between px-3 py-2 text-sm font-semibold rounded-lg cursor-pointer text-muted-foreground hover:text-foreground"
                        >
                          <div className="flex items-center gap-2.5">
                            {aiVoiceResponseEnabled ? <IconVolume size={16} className="text-primary" /> : <IconVolumeOff size={16} className="text-primary" />}
                            <span>Respuesta por Voz</span>
                          </div>
                          <Badge variant="outline" className={cn("border-none text-[9px] font-black uppercase px-2 py-0.5 rounded-md", aiVoiceResponseEnabled ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground")}>
                            {aiVoiceResponseEnabled ? "ON" : "OFF"}
                          </Badge>
                        </DropdownMenuItem>

                        <div className="h-px bg-border my-1" />

                        <DropdownMenuItem 
                          onClick={handleClearAiHistory}
                          className="flex items-center gap-2.5 px-3 py-2 text-sm font-semibold rounded-lg cursor-pointer text-rose-500 hover:bg-rose-500/10 focus:bg-rose-500/10 focus:text-rose-500"
                        >
                          <IconTrash size={16} />
                          <span>Borrar historial</span>
                        </DropdownMenuItem>

                      </DropdownMenuContent>
                    </DropdownMenu>
                  </>
                )}
              </div>
            </div>

            {/* Messages scroll area with original Shadcn-style background */}
            <div className="flex-1 relative overflow-hidden flex flex-col">

              {/* Push notification invitation banner */}
              {chatType === "ai" && mounted && notificationPermission === "default" && (
                <div className="mx-5 mt-3 p-3 flex items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 backdrop-blur-md shadow-lg shrink-0 z-20">
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <IconBell size={16} className="text-primary animate-bounce" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground">¿Deseas recibir avisos de la IA?</p>
                      <p className="text-[10px] text-muted-foreground">Te enviaremos una notificación cuando la IA responda si sales de la app.</p>
                    </div>
                  </div>
                  <Button 
                    size="sm" 
                    onClick={handleRequestNotificationPermission} 
                    className="h-8 text-[11px] font-black uppercase tracking-wider px-3 bg-primary text-primary-foreground hover:bg-primary/95 shrink-0 rounded-lg active:scale-95 transition-all"
                  >
                    Activar
                  </Button>
                </div>
              )}

              {/* ── VOICE MODE OVERLAY ── */}


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

              <ScrollArea className="flex-1 h-full">
                <div className="px-5 py-4 flex flex-col gap-3 relative">
                  {/* Date chip */}
                  <div className="self-center mb-4">
                    <span className="text-[10px] font-medium px-3 py-1 rounded-full bg-muted/80 backdrop-blur-sm text-muted-foreground border">
                      Hoy
                    </span>
                  </div>

                  {/* Welcome message */}
                  {chatType === "human" && messages.length === 0 && (
                    <div className="self-center mt-8 flex flex-col items-center gap-3 text-center max-w-xs">
                      <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                        <IconMessageCircle size={32} className="text-primary/60" />
                      </div>
                      <p className="text-sm font-semibold">¡Hola! ¿En qué te ayudamos?</p>
                    </div>
                  )}

                  {chatType === "ai" && aiMessages.length === 0 && (
                    <div className="self-center mt-8 flex flex-col items-center gap-5 text-center max-w-sm px-4">
                      {/* ElevenLabs Real WebGL Orb */}
                      <div className="relative size-44 flex items-center justify-center">
                        <Orb
                          className="size-44"
                          agentState={aiAgentState}
                          colors={getOrbColors(activeTheme)}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <h3 className="text-md font-bold tracking-tight">¡Hola! Soy Syncro IA</h3>
                        <p className="text-xs text-muted-foreground leading-normal max-w-[280px]">
                          Te ayudo con el <strong>cuadre y cierre de caja</strong>, registro de ingresos y egresos, y te muestro el estado financiero en tiempo real.
                        </p>
                      </div>
                    </div>
                  )}

                  <AnimatePresence initial={false}>
                    {(chatType === "human" ? messages : aiMessages).map((msg, i) => {
                      const isMe = chatType === "human" ? (msg.senderId === user?.id) : (msg.role === "user");
                      return (
                        <motion.div
                          key={msg.id || i}
                          initial={{ scale: 0.5, opacity: 0, y: 20 }}
                          animate={{ scale: 1, opacity: 1, y: 0 }}
                          exit={{ scale: 0.8, opacity: 0 }}
                          transition={{ type: "spring", stiffness: 400, damping: 25 }}
                          className={cn("flex flex-col max-w-[80%] overflow-visible pb-2.5", isMe ? "self-end items-end" : "self-start items-start")}
                        >
                          <div className={cn(
                            "px-4 py-2.5 rounded-2xl shadow-sm text-sm relative border",
                            isMe
                              ? "bg-primary border-primary/20 text-white rounded-tr-none"
                              : chatType === "ai"
                                ? "bg-primary/5 dark:bg-primary/10 border-primary/20 text-foreground rounded-tl-none shadow-md backdrop-blur-xs"
                                : "bg-card border-border text-foreground rounded-tl-none"
                          )}>
                            {chatType === "ai" && !isMe && (
                              <div className="flex items-center gap-1.5 mb-1 text-[10px] font-bold text-primary uppercase tracking-wider">
                                <IconSparkles size={11} className="animate-pulse" />
                                <span>Syncro IA</span>
                              </div>
                            )}
                            {chatType === "human" ? (
                              renderContent(msg, isMe)
                            ) : msg.role === "assistant" && msg.isNew ? (
                              <Typewriter
                                text={msg.content}
                                onChar={scrollToBottom}
                                onComplete={() => {
                                  setAiMessages((prev) =>
                                    prev.map((m) => m.id === msg.id ? { ...m, isNew: false } : m)
                                  );
                                }}
                              />
                            ) : (
                              <span className="whitespace-pre-line leading-relaxed">{msg.content}</span>
                            )}

                            {/* Action confirmable card */}
                            {chatType === "ai" && !isMe && msg.action && !msg.isNew && (
                              <div className="mt-3 p-3.5 rounded-xl border border-primary/20 bg-card/65 backdrop-blur-xs space-y-3 max-w-[280px] shadow-lg">
                                <div className="flex items-center gap-2">
                                  <div className="size-6 rounded-lg bg-primary/10 flex items-center justify-center">
                                    <IconSparkles size={13} className="text-primary animate-pulse" />
                                  </div>
                                  <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Acción sugerida</span>
                                </div>
                                <div className="space-y-1.5 text-xs text-muted-foreground leading-normal">
                                  <p className="font-extrabold text-foreground tracking-tight">{msg.action.label}</p>
                                  <div className="h-px bg-muted/40 my-1" />
                                  <p className="flex justify-between">
                                    <span>Operación:</span>
                                    <span className="font-bold text-foreground">
                                      {msg.action.type === 'register_expense' ? 'Egreso (-)' : 
                                       msg.action.type === 'register_income' ? 'Ingreso (+)' : 
                                       msg.action.type === 'close_shift' ? 'Cierre de Turno' : 
                                       msg.action.type === 'create_category' ? 'Crear Categoría' :
                                       msg.action.type === 'create_supplier' ? 'Crear Proveedor' :
                                       msg.action.type === 'edit_product' ? 'Editar Producto' : 
                                       msg.action.type === 'reconcile_inventory' ? 'Auditoría de Inventario' : 'Orden de Compra'}
                                    </span>
                                  </p>
                                  {msg.action.data?.amount && (
                                    <p className="flex justify-between">
                                      <span>Monto:</span>
                                      <span className="font-extrabold text-emerald-600">${msg.action.data.amount.toFixed(2)}</span>
                                    </p>
                                  )}
                                  {msg.action.data?.category && (
                                    <p className="flex justify-between">
                                      <span>Categoría:</span>
                                      <span className="font-semibold text-foreground uppercase text-[10px]">{msg.action.data.category.replace('_', ' ')}</span>
                                    </p>
                                  )}
                                  {msg.action.type === 'create_purchase_order' && msg.action.data?.items && (
                                    <p className="flex justify-between">
                                      <span>Artículos:</span>
                                      <span className="font-semibold text-foreground uppercase text-[10px]">{msg.action.data.items.length} items</span>
                                    </p>
                                  )}
                                  {msg.action.type === 'create_category' && (
                                    <>
                                      <p className="flex justify-between">
                                        <span>Nombre:</span>
                                        <span className="font-semibold text-foreground">{msg.action.data.name}</span>
                                      </p>
                                      {msg.action.data.description && (
                                        <p className="text-[10px] text-muted-foreground text-left mt-1 italic">
                                          {msg.action.data.description}
                                        </p>
                                      )}
                                    </>
                                  )}
                                  {msg.action.type === 'create_supplier' && (
                                    <>
                                      <p className="flex justify-between">
                                        <span>Nombre:</span>
                                        <span className="font-semibold text-foreground">{msg.action.data.name}</span>
                                      </p>
                                      {msg.action.data.contactName && (
                                        <p className="flex justify-between">
                                          <span>Contacto:</span>
                                          <span className="font-semibold text-foreground">{msg.action.data.contactName}</span>
                                        </p>
                                      )}
                                      {msg.action.data.phone && (
                                        <p className="flex justify-between">
                                          <span>Teléfono:</span>
                                          <span className="font-semibold text-foreground">{msg.action.data.phone}</span>
                                        </p>
                                      )}
                                    </>
                                  )}
                                  {msg.action.type === 'edit_product' && (
                                    <div className="space-y-1 mt-1 border-t border-dashed pt-1">
                                      {msg.action.data.name && (
                                        <p className="flex justify-between">
                                          <span>Nombre:</span>
                                          <span className="font-semibold text-foreground truncate max-w-[120px]">{msg.action.data.name}</span>
                                        </p>
                                      )}
                                      {msg.action.data.price !== undefined && (
                                        <p className="flex justify-between">
                                          <span>Precio:</span>
                                          <span className="font-semibold text-foreground">${Number(msg.action.data.price).toFixed(2)}</span>
                                        </p>
                                      )}
                                      {msg.action.data.cost !== undefined && (
                                        <p className="flex justify-between">
                                          <span>Costo:</span>
                                          <span className="font-semibold text-foreground">${Number(msg.action.data.cost).toFixed(2)}</span>
                                        </p>
                                      )}
                                      {msg.action.data.stock !== undefined && (
                                        <p className="flex justify-between">
                                          <span>Stock:</span>
                                          <span className="font-semibold text-foreground">{msg.action.data.stock}</span>
                                        </p>
                                      )}
                                      {msg.action.data.barcode && (
                                        <p className="flex justify-between">
                                          <span>Barras:</span>
                                          <span className="font-semibold text-foreground">{msg.action.data.barcode}</span>
                                        </p>
                                      )}
                                      {msg.action.data.imageSearchQuery && (
                                        <p className="flex justify-between">
                                          <span>Buscar Imagen:</span>
                                          <span className="font-semibold text-primary italic truncate max-w-[120px]">{msg.action.data.imageSearchQuery}</span>
                                        </p>
                                      )}
                                    </div>
                                  )}
                                  {msg.action.type === 'close_shift' && (
                                    <>
                                      <p className="flex justify-between">
                                        <span>Efectivo Reportado:</span>
                                        <span className="font-bold text-foreground">${msg.action.data.reportedCash?.toFixed(2)}</span>
                                      </p>
                                      {msg.actionConfirmed && (
                                        <>
                                          <p className="flex justify-between">
                                            <span>Efectivo Esperado:</span>
                                            <span className="font-bold text-foreground">${msg.action.data.expectedCash?.toFixed(2)}</span>
                                          </p>
                                          <p className="flex justify-between">
                                            <span>Diferencia:</span>
                                            <span className={`font-bold ${msg.action.data.reportedCash - msg.action.data.expectedCash < 0 ? 'text-rose-500' : msg.action.data.reportedCash - msg.action.data.expectedCash > 0 ? 'text-emerald-500' : 'text-foreground'}`}>
                                              ${(msg.action.data.reportedCash - msg.action.data.expectedCash).toFixed(2)}
                                            </span>
                                          </p>
                                        </>
                                      )}
                                    </>
                                  )}
                                  {msg.action.type === 'reconcile_inventory' && msg.action.data?.items && (
                                    <div className="space-y-1.5 mt-1 border-t border-dashed border-border/40 pt-2 max-h-[150px] overflow-y-auto pr-1">
                                      <p className="text-[10px] font-bold text-foreground mb-1 uppercase tracking-wider">Productos Contados:</p>
                                      {msg.action.data.items.map((item: any, idx: number) => (
                                        <div key={idx} className="flex justify-between items-center text-[11px] py-1 border-b border-muted/20 last:border-0">
                                          <span className="text-muted-foreground truncate max-w-[150px]" title={item.name}>{item.name}</span>
                                          <span className="font-bold text-foreground bg-primary/10 px-1.5 py-0.5 rounded text-[10px]">{item.quantity} u</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                {msg.actionConfirmed === true ? (
                                  <div className="space-y-2">
                                    <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center gap-1.5">
                                      <IconCheck size={14} className="text-emerald-600" />
                                      <span className="text-[10px] font-bold text-emerald-600">Acción ejecutada</span>
                                    </div>
                                    {(msg.action?.type === 'register_expense' || msg.action?.type === 'register_income') && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleUndoAction(msg.id)}
                                        className="w-full text-[10px] font-bold border-rose-500/20 text-rose-600 hover:bg-rose-500/5 hover:text-rose-700 h-8 rounded-lg shadow-sm"
                                      >
                                        Deshacer registro
                                      </Button>
                                    )}
                                  </div>
                                ) : (msg.actionConfirmed === 'dismissed' || msg.actionConfirmed === null) ? (
                                  <div className="p-2 rounded-lg bg-muted/30 border border-muted/50 flex items-center justify-center gap-1.5">
                                    <span className="text-[10px] font-bold text-muted-foreground">Acción cancelada</span>
                                  </div>
                                ) : (
                                  <div className="flex gap-2 pt-1">
                                    <Button
                                      size="sm"
                                      onClick={() => handleConfirmAction(msg.id, msg.action)}
                                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px] py-1 h-8 rounded-lg shadow-sm"
                                    >
                                      Confirmar
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleDismissAction(msg.id)}
                                      className="flex-1 border-rose-500/20 text-rose-600 hover:bg-rose-500/5 hover:text-rose-700 font-semibold text-[11px] py-1 h-8 rounded-lg"
                                    >
                                      Cancelar
                                    </Button>
                                  </div>
                                )}
                              </div>
                            )}

                            {msg.type !== "AUDIO" && msg.type !== "audio" && (
                              <div className={cn("flex items-center gap-1 mt-1.5 text-[9px]", isMe ? "text-white/60 justify-end" : "text-muted-foreground")}>
                                {(() => {
                                  try {
                                    const d = new Date(msg.createdAt || Date.now());
                                    if (isNaN(d.getTime())) return "";
                                    return format(d, 'hh:mm a');
                                  } catch (e) {
                                    return "";
                                  }
                                })()}
                                {isMe && chatType === "human" && <IconChecks size={12} className={msg.isRead ? "text-sky-400" : "text-white/40"} />}
                              </div>
                            )}
                          </div>

                          {/* Feedback Bar */}
                          {chatType === "ai" && !isMe && !msg.isNew && (
                            <div className="flex items-center gap-1.5 mt-1.5 px-1 text-muted-foreground/60 transition-all select-none overflow-visible">
                              {/* Like Button */}
                              <button
                                onClick={() => handleFeedback(msg.id, "LIKE")}
                                className={cn(
                                  "hover:text-emerald-500 active:scale-95 transition-all flex items-center justify-center rounded-lg hover:bg-emerald-500/10 h-6 w-6 shrink-0 transition-colors",
                                  msg.rating === "LIKE" && "text-emerald-500 bg-emerald-500/10"
                                )}
                                title="Me gusta"
                              >
                                <IconThumbUp size={14} className={cn(msg.rating === "LIKE" && "fill-emerald-500/10")} />
                              </button>

                              {/* Dislike Button */}
                              <button
                                onClick={() => {
                                  if (msg.rating === "DISLIKE") {
                                    handleFeedback(msg.id, "LIKE");
                                  } else {
                                    setCommentingMsgId(msg.id);
                                    setFeedbackComment("");
                                  }
                                }}
                                className={cn(
                                  "hover:text-rose-500 active:scale-95 transition-all flex items-center justify-center rounded-lg hover:bg-rose-500/10 h-6 w-6 shrink-0 transition-colors",
                                  msg.rating === "DISLIKE" && "text-rose-500 bg-rose-500/10"
                                )}
                                title="No me gusta"
                              >
                                <IconThumbDown size={14} className={cn(msg.rating === "DISLIKE" && "fill-rose-500/10")} />
                              </button>

                              {/* Copy Button */}
                              <button
                                onClick={() => handleCopy(msg.content)}
                                className="hover:text-primary active:scale-95 transition-all flex items-center justify-center rounded-lg hover:bg-primary/10 h-6 w-6 shrink-0 transition-colors"
                                title="Copiar respuesta"
                              >
                                <IconCopy size={14} />
                              </button>
                            </div>
                          )}

                          {/* Inline Comment Box for Dislike */}
                          {commentingMsgId === msg.id && (
                            <div className="flex items-center gap-1.5 mt-2 ml-1 w-full max-w-[260px] animate-in fade-in slide-in-from-top-1 duration-200">
                              <input
                                type="text"
                                placeholder="¿Cómo podemos mejorar? (Opcional)..."
                                className="flex-1 bg-muted/70 dark:bg-muted/30 border border-border rounded-lg px-2.5 py-1 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary/20"
                                value={feedbackComment}
                                onChange={(e) => setFeedbackComment(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    handleFeedback(msg.id, "DISLIKE", feedbackComment);
                                    setCommentingMsgId(null);
                                  }
                                }}
                                autoFocus
                              />
                              <Button
                                size="sm"
                                className="h-7 text-[10px] px-2 rounded-lg font-bold bg-primary hover:opacity-90 text-white"
                                onClick={() => {
                                  handleFeedback(msg.id, "DISLIKE", feedbackComment);
                                  setCommentingMsgId(null);
                                }}
                              >
                                Enviar
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-[10px] px-2 rounded-lg text-muted-foreground hover:bg-muted"
                                onClick={() => setCommentingMsgId(null)}
                              >
                                Cancelar
                              </Button>
                            </div>
                          )}
                        </motion.div>
                      );
                    })}
                    {isAiLoading && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="self-start flex flex-col max-w-[80%]"
                      >
                        <div className="px-4 py-3.5 rounded-2xl shadow-sm text-sm bg-primary/5 dark:bg-primary/10 border border-primary/20 rounded-tl-none flex flex-col gap-2">
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-primary uppercase tracking-wider">
                            <IconSparkles size={11} className="animate-pulse text-primary" />
                            <span>Pensando...</span>
                          </div>
                          {/* Audio visualizer waveform */}
                          <div className="flex items-end gap-1 h-6 px-1 mt-1">
                            <span className="w-1 bg-primary/80 animate-bounce [animation-delay:-0.3s] h-3 rounded-full" />
                            <span className="w-1 bg-primary/80 animate-bounce [animation-delay:-0.15s] h-5 rounded-full" />
                            <span className="w-1 bg-primary/80 animate-bounce [animation-delay:-0.45s] h-6 rounded-full" />
                            <span className="w-1 bg-primary/80 animate-bounce [animation-delay:-0.6s] h-4 rounded-full" />
                            <span className="w-1 bg-primary/80 animate-bounce [animation-delay:-0.75s] h-2 rounded-full" />
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <div ref={scrollRef} />
                </div>
              </ScrollArea>
            </div>

            {/* Input bar */}

            <div className="px-4 py-3 border-t bg-background/80 backdrop-blur-sm shrink-0 flex flex-col gap-1.5">
              <div className="flex items-center gap-2 w-full">
                {chatType === "human" ? (
                  <>
                    {voiceState === "idle" ? (
                      <div className="flex-1 flex items-center bg-muted/50 rounded-full px-2 py-1 border border-transparent focus-within:border-primary/10 focus-within:bg-background/80 focus-within:ring-1 focus-within:ring-primary/10 transition-all">
                        {/* Emoji Button */}
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground size-8 rounded-full hover:bg-muted active:scale-95">
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

                        {/* Text Input */}
                        <input
                          type="text"
                          className="flex-1 min-w-0 bg-transparent border-none outline-none focus:outline-none focus:ring-0 px-2 py-1 text-sm text-foreground placeholder:text-muted-foreground"
                          placeholder={uploading ? "Subiendo archivo..." : "Escribe un mensaje..."}
                          value={inputText}
                          onChange={(e) => handleInputChange(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleSend()}
                          onFocus={() => {
                            setTimeout(resetScroll, 50);
                            setTimeout(resetScroll, 150);
                          }}
                          disabled={uploading}
                        />

                        {/* Attachment Clip */}
                        <div className="relative shrink-0">
                          <Button variant="ghost" size="icon" className="text-muted-foreground size-8 rounded-full hover:bg-muted active:scale-95">
                            <IconPaperclip size={20} />
                          </Button>
                          <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleFileUpload} accept="image/*,video/*" />
                        </div>
                      </div>
                    ) : null}

                    {inputText.trim() && voiceState === "idle" ? (
                      <Button
                        size="icon"
                        className="shrink-0 size-10 rounded-full bg-primary shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95"
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
                  </>
                ) : (
                  <>
                    {aiVoiceState === "listening" ? (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        className="flex-1 flex items-center bg-card border border-primary/20 rounded-full px-3 h-11 gap-2 shadow-md"
                      >
                        {/* DISCARD BUTTON */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="rounded-full size-8 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 shrink-0"
                          onClick={() => stopAiVoice(aiMediaStream, speechRecognition, false)}
                        >
                          <IconTrash size={16} />
                        </Button>

                        {/* PULSING RECORDING STATUS & LIVE PREVIEW TEXT */}
                        <div className="flex-1 flex items-center min-w-0 gap-3">
                          <div className="flex items-center gap-1.5 shrink-0 px-1 border-r pr-2 border-muted">
                            <span className="size-2 rounded-full bg-rose-500 animate-pulse" />
                            <span className="text-[10px] font-bold text-rose-500 uppercase tracking-widest">Escuchando</span>
                          </div>

                          {/* REAL-TIME PREVIEW TEXT */}
                          <span className="text-xs text-foreground font-medium truncate flex-1 italic placeholder:text-muted-foreground">
                            {aiInputText || "Habla ahora..."}
                          </span>
                        </div>

                        {/* BAR VISUALIZER IN THE INPUT FIELD */}
                        <div className="w-28 h-6 overflow-hidden shrink-0 flex items-center justify-center">
                          <BarVisualizer
                            state="listening"
                            barCount={10}
                            mediaStream={aiMediaStream}
                            centerAlign={true}
                            minHeight={15}
                            maxHeight={90}
                          />
                        </div>

                        {/* SEND BUTTON */}
                        <Button
                          size="icon"
                          className="rounded-full size-8 bg-primary hover:opacity-90 shrink-0 shadow-sm"
                          onClick={() => stopAiVoice(aiMediaStream, speechRecognition, true)}
                        >
                          <IconSend size={14} />
                        </Button>
                      </motion.div>
                    ) : (
                      <>
                        <div className="flex-1 flex items-center bg-primary/5 hover:bg-primary/10 focus-within:bg-background rounded-full px-4 py-1.5 border border-primary/10 focus-within:border-primary/30 focus-within:ring-1 focus-within:ring-primary/30 transition-all">
                          {/* Text Input for AI */}
                          <input
                            type="text"
                            className="flex-1 min-w-0 bg-transparent border-none outline-none focus:outline-none focus:ring-0 px-1 py-1 text-sm text-foreground placeholder:text-primary/40"
                            placeholder="Pregúntame sobre el cuadre de caja, egresos, ventas..."
                            value={aiInputText}
                            onChange={(e) => setAiInputText(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleSendAi()}
                            onFocus={() => {
                              setTimeout(resetScroll, 50);
                              setTimeout(resetScroll, 150);
                            }}
                            disabled={isAiLoading}
                          />

                          {/* Microphone Trigger Button */}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={startAiVoice}
                            disabled={isAiLoading}
                            className="shrink-0 size-8 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-full active:scale-95 transition-all"
                            title="Preguntar por voz"
                          >
                            <IconMicrophone size={18} />
                          </Button>
                        </div>

                        <Button
                          size="icon"
                          disabled={!aiInputText.trim() || isAiLoading}
                          className="shrink-0 size-10 rounded-full bg-primary hover:opacity-90 disabled:bg-muted disabled:text-muted-foreground shadow-lg shadow-primary/10 transition-all hover:scale-105 active:scale-95"
                          onClick={() => handleSendAi()}
                        >
                          {isAiLoading ? (
                            <IconLoader2 className="animate-spin" size={18} />
                          ) : (
                            <IconSend size={18} />
                          )}
                        </Button>
                      </>
                    )}
                  </>
                )}
              </div>
              {chatType === "ai" && (
                <p className="text-[10px] text-muted-foreground/60 text-center w-full mt-0.5 tracking-tight font-medium">
                  es una IA y puede cometer errores porfavor califique
                </p>
              )}
            </div>
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
