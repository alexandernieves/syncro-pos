"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { API_URL } from "@/lib/constants";
import {
  IconSend,
  IconMicrophone,
  IconCheck,
  IconTrash,
  IconSparkles,
  IconLoader2,
  IconVolume,
  IconVolumeOff,
  IconVideo,
  IconX,
  IconPlus,
  IconDeviceFloppy,
  IconHistory,
  IconCopy,
  IconAlertTriangle,
  IconThumbUp,
  IconThumbDown,
} from "@tabler/icons-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Orb, AgentState } from "@/components/ui/orb";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useThemeConfig } from "@/components/active-theme";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { BarVisualizer } from "@/components/ui/bar-visualizer";

const API = API_URL;

interface TypewriterProps {
  text: string;
  speed?: number;
  onChar?: () => void;
  onComplete?: () => void;
}

const renderFormattedText = (text: string) => {
  if (!text) return "";
  
  const lines = text.split("\n");
  
  return lines.map((line, lineIdx) => {
    const isBulletList = line.startsWith("- ") || line.startsWith("* ");
    const isNumberedList = /^\d+\.\s/.test(line);
    
    let cleanLine = line;
    let listPrefix = "";
    if (isBulletList) {
      cleanLine = line.substring(2);
      listPrefix = "• ";
    } else if (isNumberedList) {
      const match = line.match(/^(\d+\.)\s/);
      if (match) {
        listPrefix = match[1] + " ";
        cleanLine = line.substring(match[0].length);
      }
    }

    const parts: React.ReactNode[] = [];
    let currentText = cleanLine;
    let keyIndex = 0;

    while (currentText.length > 0) {
      const boldMatch = currentText.match(/\*\*(.*?)\*\*/);
      const italicMatch = currentText.match(/\*(.*?)\*/);
      const underlineMatch = currentText.match(/__(.*?)__/);
      const codeMatch = currentText.match(/`(.*?)`/);

      let firstMatch: any = null;
      let matchType = ""; 
      let minIndex = currentText.length;

      if (boldMatch && boldMatch.index !== undefined && boldMatch.index < minIndex) {
        minIndex = boldMatch.index;
        firstMatch = boldMatch;
        matchType = "bold";
      }
      if (italicMatch && italicMatch.index !== undefined && italicMatch.index < minIndex) {
        minIndex = italicMatch.index;
        firstMatch = italicMatch;
        matchType = "italic";
      }
      if (underlineMatch && underlineMatch.index !== undefined && underlineMatch.index < minIndex) {
        minIndex = underlineMatch.index;
        firstMatch = underlineMatch;
        matchType = "underline";
      }
      if (codeMatch && codeMatch.index !== undefined && codeMatch.index < minIndex) {
        minIndex = codeMatch.index;
        firstMatch = codeMatch;
        matchType = "code";
      }

      if (firstMatch) {
        if (minIndex > 0) {
          parts.push(currentText.substring(0, minIndex));
        }

        const matchText = firstMatch[1];
        const matchFull = firstMatch[0];

        if (matchType === "bold") {
          parts.push(<strong key={keyIndex++} className="font-extrabold text-foreground">{matchText}</strong>);
        } else if (matchType === "italic") {
          parts.push(<em key={keyIndex++} className="italic">{matchText}</em>);
        } else if (matchType === "underline") {
          parts.push(<u key={keyIndex++} className="underline">{matchText}</u>);
        } else if (matchType === "code") {
          parts.push(<code key={keyIndex++} className="bg-muted px-1.5 py-0.5 rounded text-[11px] font-mono text-primary font-bold">{matchText}</code>);
        }

        currentText = currentText.substring(minIndex + matchFull.length);
      } else {
        parts.push(currentText);
        break;
      }
    }

    if (isBulletList || isNumberedList) {
      return (
        <div key={lineIdx} className={cn("flex items-start gap-1.5 pl-3 py-0.5 leading-relaxed", lineIdx > 0 && "mt-1")}>
          <span className="font-bold text-primary/85 shrink-0 select-none">{listPrefix}</span>
          <div className="flex-1">{parts}</div>
        </div>
      );
    }

    return (
      <p key={lineIdx} className={cn("leading-relaxed min-h-[1.25rem]", lineIdx > 0 && "mt-1.5")}>
        {parts}
      </p>
    );
  });
};

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
    const interval = setInterval(() => {
      setDisplayedText((prev) => prev + text.charAt(index));
      index++;
      onCharRef.current?.();
      if (index >= text.length) {
        clearInterval(interval);
        onCompleteRef.current?.();
      }
    }, speed);
    return () => clearInterval(interval);
  }, [text, speed]);

  return <div className="space-y-1 text-sm">{renderFormattedText(displayedText)}</div>;
};

export default function AdsCopilotPage() {
  const { activeTheme } = useThemeConfig();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const isPwa = window.matchMedia("(display-mode: standalone)").matches;
      const userStr = isPwa ? sessionStorage.getItem("user") : localStorage.getItem("user");
      if (userStr) {
        setUser(JSON.parse(userStr));
      }
    }
  }, []);

  const getOrbColors = (theme: string): [string, string] => {
    const themeName = theme?.replace("-scaled", "") || "default";
    switch (themeName) {
      case "blue":
        return ["#2563eb", "#60a5fa"];
      case "green":
        return ["#65a30d", "#a3e635"];
      case "amber":
        return ["#d97706", "#fbbf24"];
      case "mono":
        return ["#4b5563", "#9ca3af"];
      default:
        return ["#2563eb", "#60a5fa"];
    }
  };

  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<any[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>("");
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState("");
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [commentingMsgId, setCommentingMsgId] = useState<string | null>(null);
  const [feedbackComment, setFeedbackComment] = useState("");

  // Screen sharing states
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [autopilotEnabled, setAutopilotEnabled] = useState(false);
  const [alerts, setAlerts] = useState<string[]>([]);

  // Voice States
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [voiceListening, setVoiceListening] = useState(false);
  const [speechRecognition, setSpeechRecognition] = useState<any>(null);
  const [micMediaStream, setMicMediaStream] = useState<MediaStream | null>(null);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceName, setSelectedVoiceName] = useState<string>("default");

  // References
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const autopilotTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastScreenDataRef = useRef<Uint8ClampedArray | null>(null);
  const sameScreenCountRef = useRef<number>(0);

  // Orb State mapper
  const orbState: AgentState = isAiThinking
    ? "thinking"
    : voiceListening
      ? "listening"
      : aiSpeaking
        ? "talking"
        : null;

  useEffect(() => {
    setMounted(true);
    requestNotificationPermission();
    fetchSessions();
    return () => {
      stopScreenSharing();
      stopVoiceListening(null, null, "keep");
      if (autopilotTimerRef.current) clearInterval(autopilotTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    const updateVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      const spanishVoices = voices.filter(v => v.lang.startsWith("es"));
      setAvailableVoices(spanishVoices);

      const savedVoice = localStorage.getItem("syncro_ads_tts_voice");
      if (savedVoice) {
        setSelectedVoiceName(savedVoice);
      } else {
        const colombianVoice = spanishVoices.find(v => v.lang.toLowerCase().includes("co"));
        if (colombianVoice) {
          setSelectedVoiceName(colombianVoice.name);
          localStorage.setItem("syncro_ads_tts_voice", colombianVoice.name);
        } else {
          setSelectedVoiceName("default");
        }
      }
    };

    updateVoices();
    window.speechSynthesis.onvoiceschanged = updateVoices;

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  useEffect(() => {
    if (selectedVoiceName && selectedVoiceName !== "default") {
      localStorage.setItem("syncro_ads_tts_voice", selectedVoiceName);
    }
  }, [selectedVoiceName]);

  const requestNotificationPermission = async () => {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        await Notification.requestPermission();
      }
    }
  };

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const branchId = localStorage.getItem("currentBranchId") || "";
      const res = await fetch(`${API}/ai-agent/sessions?type=ADS_COPILOT${branchId ? `&branchId=${branchId}` : ""}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSessions(data || []);
        if (data.length > 0) {
          const firstSession = data[0].id;
          setActiveSessionId(firstSession);
          fetchHistory(firstSession);
        } else {
          // Create default first session
          createNewSession();
        }
      }
    } catch {
      toast.error("Error cargando sesiones del copiloto");
    } finally {
      setLoading(false);
    }
  };

  const createNewSession = async () => {
    try {
      const token = localStorage.getItem("token");
      const branchId = localStorage.getItem("currentBranchId") || "";
      const res = await fetch(`${API}/ai-agent/sessions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ 
          title: "Copiloto Ads " + new Date().toLocaleDateString(), 
          type: "ADS_COPILOT",
          branchId: branchId || null
        })
      });
      if (res.ok) {
        const newSession = await res.json();
        setSessions(prev => [newSession, ...prev]);
        setActiveSessionId(newSession.id);
        setMessages([]);
      }
    } catch {
      toast.error("Error al crear sesión");
    }
  };

  const fetchHistory = async (sessId: string) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/ai-agent/history?sessionId=${sessId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data || []);
        setTimeout(scrollToBottom, 200);
      }
    } catch {
      toast.error("Error al cargar historial");
    }
  };

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
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
          setMessages((prev) =>
            prev.map(m => {
              if (m.id === msgId) {
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
          setMessages((prev) =>
            prev.map(m => {
              if (m.id === msgId) {
                return { ...m, actionConfirmed: false };
              }
              return m;
            })
          );
        } else {
          toast.error(data.message);
        }
      } else {
        toast.error("Error al revertir la acción.");
      }
    } catch (err) {
      toast.error("Error de conexión al revertir la acción.");
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

      const msgIndex = messages.findIndex(m => m.id === msgId);
      if (msgIndex === -1) return;
      const responseMsg = messages[msgIndex];

      let promptText = "";
      for (let i = msgIndex - 1; i >= 0; i--) {
        if (messages[i].role === "user") {
          promptText = messages[i].content;
          break;
        }
      }
      if (!promptText) promptText = "Consulta general de Ads Copilot";

      const res = await fetch(`${API}/ai-agent/feedback`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          messageId: msgId.startsWith("temp-") ? undefined : msgId,
          prompt: promptText,
          response: responseMsg.content,
          rating,
          comment: comment || ""
        })
      });

      if (res.ok) {
        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, rating, comment } : m));
        toast.success(rating === "LIKE" ? "¡Gracias por calificar la respuesta!" : "¡Gracias por tu comentario para ayudarnos a mejorar!");
      } else {
        toast.error("No se pudo enviar la calificación.");
      }
    } catch {
      toast.error("Error de conexión al enviar feedback.");
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
        body: JSON.stringify({ msgId })
      });

      if (res.ok) {
        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, actionConfirmed: 'dismissed' } : m));
      }
    } catch {
      toast.error("Error al cancelar acción");
    }
  };

  // ── SCREEN SHARING & CAPTURE ──────────────────────────────────────────────

  const startScreenSharing = async () => {
    try {
      lastScreenDataRef.current = null;
      sameScreenCountRef.current = 0;
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: "browser",
        },
        audio: false // We only need screens for Vision RAG here
      });

      setScreenStream(stream);

      toast.success("Pantalla vinculada con éxito. Asegúrate de mostrar tu pestaña de Meta Ads Manager");

      // Auto stop sharing listener if track ends
      stream.getVideoTracks()[0].onended = () => {
        stopScreenSharing();
      };
    } catch (err: any) {
      toast.error("No se pudo iniciar la compartición de pantalla: " + err.message);
    }
  };

  // Bind screenStream to the video element after it mounts in the DOM
  useEffect(() => {
    if (screenStream && videoRef.current) {
      videoRef.current.srcObject = screenStream;
    }
  }, [screenStream]);

  const stopScreenSharing = () => {
    if (screenStream) {
      screenStream.getTracks().forEach(t => t.stop());
      setScreenStream(null);
    }
    setAutopilotEnabled(false);
    lastScreenDataRef.current = null;
    sameScreenCountRef.current = 0;
    toast.info("Pantalla desvinculada");
  };

  const captureScreenshot = (): string | null => {
    if (!videoRef.current || !screenStream) return null;
    try {
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth || 1280;
      canvas.height = videoRef.current.videoHeight || 720;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL("image/jpeg", 0.7);
      }
    } catch (e) {
      console.error("Failed to capture screenshot", e);
    }
    return null;
  };

  // Helper to detect if screen content has changed using pixel analysis
  const hasScreenChanged = (): boolean => {
    if (!videoRef.current) return false;
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 32;
      canvas.height = 32;
      const ctx = canvas.getContext("2d");
      if (!ctx) return false;
      ctx.drawImage(videoRef.current, 0, 0, 32, 32);
      const imgData = ctx.getImageData(0, 0, 32, 32).data;
      
      if (!lastScreenDataRef.current) {
        lastScreenDataRef.current = imgData;
        return true;
      }
      
      let diff = 0;
      for (let i = 0; i < imgData.length; i += 4) {
        const rDiff = Math.abs(imgData[i] - lastScreenDataRef.current[i]);
        const gDiff = Math.abs(imgData[i+1] - lastScreenDataRef.current[i+1]);
        const bDiff = Math.abs(imgData[i+2] - lastScreenDataRef.current[i+2]);
        if (rDiff > 15 || gDiff > 15 || bDiff > 15) {
          diff++;
        }
      }
      
      lastScreenDataRef.current = imgData;
      // If more than 2% of the pixels changed, we assume screen changed
      const threshold = (32 * 32) * 0.02; // ~20 pixels
      return diff > threshold;
    } catch {
      return true; // Default to true on error to continue
    }
  };

  // Autopilot interval handler
  useEffect(() => {
    if (autopilotEnabled && screenStream) {
      autopilotTimerRef.current = setInterval(() => {
        runAutopilotAudit();
      }, 25000); // Audit screen every 25 seconds
    } else {
      if (autopilotTimerRef.current) {
        clearInterval(autopilotTimerRef.current);
        autopilotTimerRef.current = null;
      }
    }
    return () => {
      if (autopilotTimerRef.current) clearInterval(autopilotTimerRef.current);
    };
  }, [autopilotEnabled, screenStream, activeSessionId]);

  const runAutopilotAudit = async () => {
    if (!screenStream || isAiThinking) return;

    const changed = hasScreenChanged();
    let auditMessage = "Analiza mi pantalla actual de Meta Ads Manager. Si detectas alguna inconsistencia o error según las lecciones de mis videos de entrenamiento, indícalo detalladamente iniciando la frase con '[ALERTA]'. Si todo está correcto, mantén el silencio.";

    if (!changed) {
      sameScreenCountRef.current += 1;
      
      // If same screen for 3 laps (sameScreenCountRef.current >= 2), pause autopilot due to inactivity
      if (sameScreenCountRef.current >= 2) {
        setAutopilotEnabled(false);
        toast.warning("Monitoreo en piloto pausado automáticamente por inactividad.");
        return;
      }
      
      // If same screen for 2nd lap, ask the AI to prompt the user to move
      auditMessage = "Sigues en la misma pantalla anterior de Meta Ads Manager. Recuerda amablemente al usuario que si desea continuar con el análisis en vivo puede desplazarse a otra sección o pestaña, e indícales que estás listo para analizar cualquier cambio. No repitas el análisis de la pantalla anterior, sé dinámico, cordial y muy breve.";
    } else {
      sameScreenCountRef.current = 0;
    }

    const screenshot = captureScreenshot();
    if (!screenshot) return;

    setIsAiThinking(true);
    try {
      const token = localStorage.getItem("token");
      const branchId = localStorage.getItem("currentBranchId") || "";
      const res = await fetch(`${API}/ai-agent/ads-copilot/chat-stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          message: auditMessage,
          sessionId: activeSessionId,
          screenshot,
          branchId: branchId || null
        })
      });

      if (res.ok) {
        const reader = res.body?.getReader();
        if (!reader) return;

        const decoder = new TextDecoder();
        let assistantText = "";
        const placeholderId = `temp-ai-auto-${Date.now()}`;

        setMessages((prev) => [
          ...prev,
          { id: placeholderId, role: "assistant", content: "" }
        ]);

        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith("data: ")) {
              try {
                const parsed = JSON.parse(trimmed.slice(6));
                if (parsed.chunk) {
                  assistantText += parsed.chunk;
                  setMessages(prev => prev.map(m => m.id === placeholderId ? { ...m, content: assistantText } : m));
                }
                if (parsed.done) {
                  setMessages(prev => prev.map(m => m.id === placeholderId ? { ...m, content: parsed.message, id: parsed.id, action: parsed.action } : m));
                  handleAiResponseCompletion(parsed.message);
                }
              } catch {}
            }
          }
        }
      }
    } catch (e) {
      console.warn("Autopilot request failed", e);
    } finally {
      setIsAiThinking(false);
    }
  };

  // ── CHAT MANEJO ───────────────────────────────────────────────────────────

  const handleSend = async (overrideText?: string) => {
    const text = overrideText !== undefined ? overrideText : inputText;
    if (!text.trim()) return;

    if (overrideText === undefined) {
      setInputText("");
    }

    // Stop speaking immediately
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setAiSpeaking(false);

    // Save temporary user message
    const tempUserMsg = {
      id: `temp-usr-${Date.now()}`,
      role: "user",
      content: text,
      createdAt: new Date().toISOString()
    };
    setMessages(prev => [...prev, tempUserMsg]);
    setIsAiThinking(true);
    setTimeout(scrollToBottom, 50);

    const screenshot = captureScreenshot();

    try {
      const token = localStorage.getItem("token");
      const branchId = localStorage.getItem("currentBranchId") || "";
      const res = await fetch(`${API}/ai-agent/ads-copilot/chat-stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          message: text,
          sessionId: activeSessionId,
          screenshot,
          branchId: branchId || null
        })
      });

      if (res.ok) {
        const reader = res.body?.getReader();
        if (!reader) throw new Error("No body");

        const decoder = new TextDecoder();
        let assistantText = "";
        const placeholderId = `temp-ai-${Date.now()}`;

        setMessages((prev) => [
          ...prev,
          { id: placeholderId, role: "assistant", content: "" }
        ]);

        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith("data: ")) {
              try {
                const parsed = JSON.parse(trimmed.slice(6));
                if (parsed.chunk) {
                  assistantText += parsed.chunk;
                  setMessages(prev => prev.map(m => m.id === placeholderId ? { ...m, content: assistantText } : m));
                  setTimeout(scrollToBottom, 30);
                }
                if (parsed.done) {
                  setMessages(prev => prev.map(m => m.id === placeholderId ? { ...m, content: parsed.message, id: parsed.id, action: parsed.action } : m));
                  handleAiResponseCompletion(parsed.message);
                }
              } catch {}
            }
          }
        }
      }
    } catch {
      toast.error("Error al enviar mensaje");
    } finally {
      setIsAiThinking(false);
      setTimeout(scrollToBottom, 100);
    }
  };

  const handleAiResponseCompletion = (responseText: string) => {
    // 1. Process Desktop alert triggers if contains [ALERTA]
    if (responseText.includes("[ALERTA]")) {
      const cleanAlert = responseText
        .replace(/\[ALERTA\]/g, "")
        .replace(/\*+/g, "")
        .trim();
      
      setAlerts(prev => [cleanAlert.substring(0, 100) + "...", ...prev]);

      if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
        new Notification("Alerta del Copiloto Ads", {
          body: cleanAlert,
          icon: "/syncro.png"
        });
      }
    }

    // 2. TTS Voice response if enabled
    if (voiceEnabled && responseText) {
      speakText(responseText);
    }
  };

  const speakText = (text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();

    // Clean markdown and alert tags
    const cleanedText = text
      .replace(/\[ALERTA\]/gi, "Alerta.")
      .replace(/[\u{1F300}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F1E6}-\u{1F1FF}]/gu, "")
      .replace(/\*+/g, "")
      .replace(/```[\s\S]*?```/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (!cleanedText) return;

    const utterance = new SpeechSynthesisUtterance(cleanedText);
    utterance.lang = "es-VE";
    utterance.rate = 1.05;
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    let chosenVoice: SpeechSynthesisVoice | null = null;

    if (selectedVoiceName && selectedVoiceName !== "default") {
      chosenVoice = voices.find(v => v.name === selectedVoiceName) || null;
    }

    if (!chosenVoice) {
      const preferredNames = ["colombia", "google español", "siri", "monica", "paulina", "jorge"];
      chosenVoice = voices.find(v => v.lang.startsWith("es") && preferredNames.some(name => v.name.toLowerCase().includes(name))) || null;
      if (!chosenVoice) {
        chosenVoice = voices.find(v => v.lang.startsWith("es")) || voices[0] || null;
      }
    }

    if (chosenVoice) {
      utterance.voice = chosenVoice;
      utterance.lang = chosenVoice.lang;
    }

    utterance.onstart = () => setAiSpeaking(true);
    utterance.onend = () => setAiSpeaking(false);
    utterance.onerror = () => setAiSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  const playVoicePreview = (voiceName: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();

    const voices = window.speechSynthesis.getVoices();
    let chosenVoice: SpeechSynthesisVoice | null = null;
    if (voiceName !== "default") {
      chosenVoice = voices.find(v => v.name === voiceName) || null;
    } else {
      const preferredNames = ["colombia", "google español", "siri", "monica", "paulina", "jorge"];
      chosenVoice = voices.find(v => v.lang.startsWith("es") && preferredNames.some(name => v.name.toLowerCase().includes(name))) || null;
      if (!chosenVoice) {
        chosenVoice = voices.find(v => v.lang.startsWith("es")) || voices[0] || null;
      }
    }

    if (!chosenVoice) return;

    const isColombian = chosenVoice.lang.toLowerCase().includes("co");
    const text = isColombian
      ? "Hola, esta es una prueba de mi voz con acento colombiano."
      : `Hola, esta es una prueba de mi voz en español, llamada ${chosenVoice.name}.`;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = chosenVoice;
    utterance.lang = chosenVoice.lang;
    utterance.rate = 1.05;
    utterance.pitch = 1.0;

    utterance.onstart = () => setAiSpeaking(true);
    utterance.onend = () => setAiSpeaking(false);
    utterance.onerror = () => setAiSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  // ── VOICE MICROPHONE LISTENING ──────────────────────────────────────────

  const startVoiceListening = async () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("El reconocimiento de voz no es compatible con este navegador.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicMediaStream(stream);

      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = "es-VE";

      recognition.onstart = () => {
        setVoiceListening(true);
        toast.info("Micrófono activo. Háblale al copiloto...");
      };

      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0].transcript)
          .join("");
        setInputText(transcript);
      };

      recognition.onerror = () => {
        stopVoiceListening(stream, recognition, "discard");
      };

      recognition.onend = () => {
        // Stop listening and keep the transcribed text in the input box for manual editing/sending
        stopVoiceListening(stream, recognition, "keep");
      };

      setSpeechRecognition(recognition);
      recognition.start();
    } catch {
      toast.error("No se pudo acceder al micrófono");
    }
  };

  const stopVoiceListening = (
    stream?: MediaStream | null, 
    recognition?: any, 
    action: "send" | "discard" | "keep" = "keep"
  ) => {
    const activeStream = stream || micMediaStream;
    if (activeStream) {
      activeStream.getTracks().forEach(t => t.stop());
      setMicMediaStream(null);
    }

    const activeRec = recognition || speechRecognition;
    if (activeRec) {
      try {
        activeRec.onend = null;
        activeRec.stop();
      } catch {}
      setSpeechRecognition(null);
    }

    setVoiceListening(false);

    if (action === "send") {
      const text = inputText.trim();
      if (text) {
        handleSend(text);
      }
      setInputText("");
    } else if (action === "discard") {
      setInputText("");
    }
  };

  const handleCopy = (text: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      toast.success("Copiado al portapapeles");
    }
  };

  const handleClearHistory = async () => {
    if (confirm("¿Estás seguro de que quieres vaciar la conversación?")) {
      try {
        const token = localStorage.getItem("token");
        await fetch(`${API}/ai-agent/history?sessionId=${activeSessionId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` }
        });
        setMessages([]);
        toast.success("Historial vaciado");
      } catch {
        toast.error("Error al borrar historial");
      }
    }
  };

  const handleDeleteSession = async (e: React.MouseEvent, sId: string) => {
    e.stopPropagation();
    if (!confirm("¿Estás seguro de que deseas eliminar este chat permanentemente?")) return;
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/ai-agent/sessions?sessionId=${sId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        toast.success("Chat eliminado correctamente.");
        const updatedSessions = sessions.filter(s => s.id !== sId);
        setSessions(updatedSessions);
        if (activeSessionId === sId) {
          if (updatedSessions.length > 0) {
            const nextSession = updatedSessions[0].id;
            setActiveSessionId(nextSession);
            fetchHistory(nextSession);
          } else {
            createNewSession();
          }
        }
      } else {
        toast.error("Error al eliminar chat");
      }
    } catch {
      toast.error("Error al eliminar chat");
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-var(--header-height)-12px)] overflow-hidden bg-background">
      
      {/* SECCIÓN IZQUIERDA: SIDEBAR DE SESIONES + CHAT */}
      <div className="flex-1 flex h-full overflow-hidden border-r">
        
        {/* SIDEBAR DE SESIONES */}
        <aside className="w-[240px] shrink-0 border-r flex flex-col bg-muted/20 hidden md:flex">
          {/* Header del sidebar */}
          <div className="px-4 py-4 border-b flex items-center justify-between bg-background">
            <div className="flex items-center gap-3">
              <div className="size-8 rounded-lg overflow-hidden bg-muted flex items-center justify-center border shrink-0">
                <img src="/syncro.png" alt="Syncro Logo" className="size-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-xs truncate">Historial Ads</p>
                <p className="text-[10px] text-muted-foreground font-semibold">Sesiones de chat</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 hover:bg-muted text-muted-foreground"
              onClick={createNewSession}
              title="Nueva Sesión"
            >
              <IconPlus size={15} />
            </Button>
          </div>

          {/* Listado de Sesiones */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {loading ? (
              Array.from({ length: 4 }).map((_, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-transparent animate-pulse select-none"
                >
                  <div className="size-3.5 rounded-full bg-muted-foreground/15" />
                  <div className="h-3 bg-muted-foreground/15 rounded-md w-2/3" />
                </div>
              ))
            ) : (
              sessions.map((sess) => {
                const isActive = sess.id === activeSessionId;
                return (
                  <div
                    key={sess.id}
                    onClick={() => {
                      setActiveSessionId(sess.id);
                      fetchHistory(sess.id);
                    }}
                    className={cn(
                      "flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer transition-colors border text-xs group relative",
                      isActive
                        ? "bg-primary/10 border-primary/20 text-primary font-bold shadow-xs"
                        : "hover:bg-muted/40 border-transparent text-muted-foreground"
                    )}
                  >
                    <IconHistory size={14} className={isActive ? "text-primary" : "text-muted-foreground"} />
                    <span className="truncate flex-1 pr-12">{sess.title}</span>
                    {isActive && (
                      <Badge variant="secondary" className="bg-primary/15 text-primary text-[8px] px-1 font-bold absolute right-7 top-1/2 -translate-y-1/2">
                        Activo
                      </Badge>
                    )}
                    <button
                      onClick={(e) => handleDeleteSession(e, sess.id)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity size-5 flex items-center justify-center rounded-md hover:bg-muted"
                      title="Eliminar sesión"
                    >
                      <IconTrash size={12} />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* CONTENEDOR DEL CHAT ACTIVO */}
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          
          {/* Header de conversación */}
          <div className="px-6 py-4 border-b flex items-center justify-between bg-muted/10 shrink-0">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl overflow-hidden bg-muted flex items-center justify-center border shrink-0">
                <img src="/syncro.png" alt="Syncro Logo" className="size-full object-cover rounded-xl" />
              </div>
              <div>
                <h2 className="font-bold text-sm">Meta Ads Copilot</h2>
                <p className="text-[11px] text-emerald-600 dark:text-emerald-500 font-bold uppercase tracking-wider flex items-center gap-1.5 select-none">
                  <span className="size-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                  Monitoreando campaña en vivo
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={handleClearHistory} title="Vaciar Historial" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                <IconTrash size={16} />
              </Button>
              <Button variant="ghost" size="icon" onClick={createNewSession} title="Nuevo Chat" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                <IconPlus size={16} />
              </Button>
            </div>
          </div>

          {/* Mensajes */}
          <div className="flex-1 min-h-0 relative flex flex-col bg-muted/10">
            {/* Geometric background with dot grid */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/3 via-background to-secondary/5" />
              {/* Dot grid */}
              <svg className="absolute inset-0 w-full h-full opacity-[0.035] dark:opacity-[0.06]" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <pattern id="ads-dot-grid" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
                    <circle cx="12" cy="12" r="1.5" fill="currentColor" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#ads-dot-grid)" />
              </svg>
            </div>

            <ScrollArea className="flex-1 h-full">
              <div className="px-5 py-4 flex flex-col gap-3 relative">
                {loading ? (
                  <div className="flex flex-col gap-5 py-4 w-full select-none">
                    {/* Skeleton 1: AI Message */}
                    <div className="self-start w-[75%] animate-pulse flex flex-col gap-2">
                      <div className="h-3 w-28 bg-muted-foreground/20 rounded-md mb-1" />
                      <div className="px-4 py-3.5 rounded-2xl bg-muted/40 dark:bg-muted/10 rounded-tl-none border border-primary/10 flex flex-col gap-2.5">
                        <div className="h-4 w-full bg-muted-foreground/15 rounded-lg" />
                        <div className="h-4 w-[90%] bg-muted-foreground/15 rounded-lg" />
                        <div className="h-4 w-[65%] bg-muted-foreground/15 rounded-lg" />
                      </div>
                      {/* Sub-actions skeletons */}
                      <div className="flex gap-2 mt-1">
                        <div className="h-5 w-6 bg-muted-foreground/15 rounded-md" />
                        <div className="h-5 w-6 bg-muted-foreground/15 rounded-md" />
                        <div className="h-5 w-6 bg-muted-foreground/15 rounded-md" />
                      </div>
                    </div>

                    {/* Skeleton 2: User Message */}
                    <div className="self-end w-[45%] animate-pulse flex flex-col items-end gap-2">
                      <div className="px-4 py-3 rounded-2xl bg-muted-foreground/10 rounded-tr-none border border-transparent w-full flex flex-col gap-2">
                        <div className="h-4 w-[85%] bg-muted-foreground/15 rounded-lg ml-auto" />
                        <div className="h-4 w-[60%] bg-muted-foreground/15 rounded-lg ml-auto" />
                      </div>
                    </div>

                    {/* Skeleton 3: AI Message with card suggestion placeholder */}
                    <div className="self-start w-[80%] animate-pulse flex flex-col gap-2">
                      <div className="h-3 w-24 bg-muted-foreground/20 rounded-md mb-1" />
                      <div className="px-4 py-3.5 rounded-2xl bg-muted/40 dark:bg-muted/10 rounded-tl-none border border-primary/10 flex flex-col gap-3">
                        <div className="h-4 w-[95%] bg-muted-foreground/15 rounded-lg" />
                        <div className="h-4 w-[80%] bg-muted-foreground/15 rounded-lg" />
                        
                        {/* Suggestion Card Skeleton */}
                        <div className="mt-2 p-3.5 rounded-xl border border-primary/10 bg-background/50 flex flex-col gap-2.5">
                          <div className="h-4 w-[40%] bg-primary/15 rounded-md" />
                          <div className="h-3 w-[85%] bg-muted-foreground/10 rounded-sm" />
                          <div className="h-3 w-[70%] bg-muted-foreground/10 rounded-sm" />
                          <div className="flex gap-2.5 mt-2">
                            <div className="h-7 w-20 bg-emerald-500/20 rounded-lg" />
                            <div className="h-7 w-20 bg-muted-foreground/15 rounded-lg" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center mt-20 gap-4 text-center px-4 max-w-sm mx-auto">
                    <div className="size-16 rounded-xl overflow-hidden bg-muted flex items-center justify-center border shrink-0">
                      <img src="/syncro.png" alt="Syncro Logo" className="size-full object-cover rounded-xl" />
                    </div>
                    <div className="space-y-1">
                      <p className="font-bold text-sm">¡Hola! Soy tu Copiloto de Meta Ads</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Vincula tu pantalla del Ads Manager y pregúntame dudas de configuración o métricas en base a tus videos.
                      </p>
                    </div>
                  </div>
                ) : (
                  <AnimatePresence initial={false}>
                    {messages.map((msg, idx) => {
                      const isMe = msg.role === "user";
                      return (
                        <motion.div
                          key={msg.id || idx}
                          initial={{ scale: 0.5, opacity: 0, y: 20 }}
                          animate={{ scale: 1, opacity: 1, y: 0 }}
                          exit={{ scale: 0.8, opacity: 0 }}
                          transition={{ type: "spring", stiffness: 400, damping: 25 }}
                          className={cn("flex flex-col max-w-[80%] overflow-visible pb-2.5", isMe ? "self-end items-end" : "self-start items-start")}
                        >
                          <div className={cn(
                            "px-4 py-2.5 rounded-2xl shadow-sm text-sm relative border",
                            isMe
                              ? "bg-primary border-primary/20 text-primary-foreground rounded-tr-none"
                              : "bg-primary/5 dark:bg-primary/10 border-primary/20 text-foreground rounded-tl-none shadow-md backdrop-blur-xs"
                          )}>
                            {!isMe && (
                              <div className="flex items-center gap-1.5 mb-1 text-[10px] font-bold text-primary uppercase tracking-wider">
                                <span>Meta Ads Copilot</span>
                              </div>
                            )}

                            {msg.role === "assistant" && msg.isNew ? (
                              <Typewriter
                                text={msg.content}
                                onChar={scrollToBottom}
                                onComplete={() => {
                                  setMessages((prev) =>
                                    prev.map((m) => m.id === msg.id ? { ...m, isNew: false } : m)
                                  );
                                }}
                              />
                            ) : (
                              <div className="space-y-1 text-sm">{renderFormattedText(msg.content)}</div>
                            )}

                            {/* Action confirmable card */}
                            {msg.action && !msg.isNew && (
                              <div className="mt-3 p-3.5 rounded-xl border border-primary/20 bg-card/65 backdrop-blur-xs space-y-3 max-w-[280px] shadow-lg text-foreground">
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
                                    </div>
                                  )}
                                </div>
                                {msg.actionConfirmed === true ? (
                                  <div className="space-y-2">
                                    <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center gap-1.5">
                                      <IconCheck size={14} className="text-emerald-600" />
                                      <span className="text-[10px] font-bold text-emerald-600">Acción ejecutada</span>
                                    </div>
                                    {(msg.action.type === 'register_expense' || msg.action.type === 'register_income') && (
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
                                ) : msg.actionConfirmed === 'dismissed' ? (
                                  <div className="p-2 rounded-lg bg-muted/30 border border-muted/50 flex items-center justify-center gap-1.5">
                                    <span className="text-[10px] font-bold text-muted-foreground">Acción cancelada</span>
                                  </div>
                                ) : (
                                  <div className="flex gap-2 pt-1">
                                    <Button
                                      size="sm"
                                      onClick={() => handleConfirmAction(msg.id, msg.action)}
                                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px] py-1 h-8 rounded-lg shadow-sm border-none"
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
                          </div>

                          {/* Feedback Bar */}
                          {!isMe && !msg.isNew && (
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
                            <div className="flex items-center gap-1.5 mt-2 ml-1 w-full max-w-[260px] animate-in fade-in slide-in-from-top-1 duration-200 text-foreground">
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
                    {isAiThinking && (
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
                )}
                <div ref={scrollRef} />
              </div>
            </ScrollArea>
          </div>

          {/* Input Bar */}
          <div className="px-4 py-3 border-t bg-background/80 backdrop-blur-sm shrink-0 flex flex-col gap-1.5">
            <div className="flex items-center gap-2 w-full">
              {voiceListening ? (
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
                    onClick={() => stopVoiceListening(micMediaStream, speechRecognition, "discard")}
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
                      {inputText || "Habla ahora..."}
                    </span>
                  </div>

                  {/* BAR VISUALIZER IN THE INPUT FIELD */}
                  <div className="w-28 h-6 overflow-hidden shrink-0 flex items-center justify-center">
                    <BarVisualizer
                      state="listening"
                      barCount={10}
                      mediaStream={micMediaStream}
                      centerAlign={true}
                      minHeight={15}
                      maxHeight={90}
                    />
                  </div>

                  {/* SEND BUTTON */}
                  <Button
                    size="icon"
                    className="rounded-full size-8 bg-primary hover:opacity-90 shrink-0 shadow-sm"
                    onClick={() => stopVoiceListening(micMediaStream, speechRecognition, "send")}
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
                      className="flex-1 min-w-0 bg-transparent border-none outline-none focus:outline-none focus:ring-0 px-1 py-1 text-sm text-foreground placeholder:text-primary/40 placeholder:font-medium"
                      placeholder="Pregúntame sobre tus campañas, presupuestos, públicos..."
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSend()}
                      disabled={isAiThinking}
                    />

                    {/* Microphone Trigger Button */}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={startVoiceListening}
                      disabled={isAiThinking}
                      className="shrink-0 size-8 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-full active:scale-95 transition-all"
                      title="Preguntar por voz"
                    >
                      <IconMicrophone size={18} />
                    </Button>
                  </div>

                  <Button
                    size="icon"
                    disabled={!inputText.trim() || isAiThinking}
                    className="shrink-0 size-10 rounded-full bg-primary hover:opacity-90 disabled:bg-muted disabled:text-muted-foreground shadow-lg shadow-primary/10 transition-all hover:scale-105 active:scale-95"
                    onClick={() => handleSend()}
                  >
                    {isAiThinking ? (
                      <IconLoader2 className="animate-spin" size={18} />
                    ) : (
                      <IconSend size={18} />
                    )}
                  </Button>
                </>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground/60 text-center w-full mt-0.5 tracking-tight font-medium">
              es una IA y puede cometer errores porfavor califique
            </p>
          </div>
        </div>
      </div>

      {/* SECCIÓN DERECHA: STREAM PANTALLA Y CONTROLES */}
      <div className="w-full lg:w-[380px] shrink-0 border-l h-full flex flex-col overflow-y-auto bg-muted/10 p-6 gap-6">
        
        {/* Stream de pantalla */}
        <Card className="overflow-hidden border-border bg-card">
          <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-sm font-bold">Pantalla Compartida</CardTitle>
              <CardDescription className="text-[11px]">Meta Ads Manager Stream</CardDescription>
            </div>
            {!screenStream ? (
              <Button size="sm" onClick={startScreenSharing} className="bg-primary hover:bg-primary/90 text-primary-foreground text-[11px] h-7 gap-1 px-2.5">
                <IconVideo size={13} /> Compartir
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={stopScreenSharing} className="text-destructive border-destructive/20 hover:bg-destructive/10 text-[11px] h-7 gap-1 px-2.5">
                <IconX size={13} /> Detener
              </Button>
            )}
          </CardHeader>
          <CardContent className="p-0 border-t aspect-video bg-black flex items-center justify-center text-center relative group">
            {screenStream ? (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted 
                className="w-full h-full object-cover" 
              />
            ) : (
              <div className="flex flex-col items-center gap-2 p-6">
                <IconVideo className="text-muted-foreground animate-pulse" size={28} />
                <p className="text-xs text-muted-foreground max-w-[200px] leading-relaxed">
                  Pantalla desconectada. Vincula la pestaña del Ads Manager para que la IA la analice.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Orb Visualizer & Autopiloto */}
        <Card className="border-border bg-card">
          <CardContent className="p-6 flex flex-col gap-6 items-center">
            {/* AI Interactive Orb */}
            <div className="size-28 flex items-center justify-center relative">
              <Orb agentState={orbState} colors={getOrbColors(activeTheme)} />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="text-[10px] font-bold uppercase tracking-wider text-primary/60 dark:text-primary/40">
                  {orbState === "thinking" ? "Pensando" : orbState === "listening" ? "Escuchando" : orbState === "talking" ? "Hablando" : "Copiloto"}
                </span>
              </div>
            </div>

            {/* Controls */}
            <div className="w-full flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-bold flex items-center gap-1.5">
                    Monitoreo Activo (Piloto)
                  </Label>
                  <p className="text-[10px] text-muted-foreground">La IA analiza tu pantalla cada 25s</p>
                </div>
                <Switch 
                  checked={autopilotEnabled}
                  onCheckedChange={setAutopilotEnabled}
                  disabled={!screenStream}
                />
              </div>

              <div className="flex flex-col gap-3 border-t pt-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-bold flex items-center gap-1.5">
                      Respuestas por Voz (TTS)
                    </Label>
                    <p className="text-[10px] text-muted-foreground">Escucha los consejos en tiempo real</p>
                  </div>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    onClick={() => setVoiceEnabled(!voiceEnabled)} 
                    className={`h-9 w-9 rounded-lg ${voiceEnabled ? "border-primary/20 bg-primary/10 text-primary" : "text-muted-foreground"}`}
                  >
                    {voiceEnabled ? <IconVolume size={18} /> : <IconVolumeOff size={18} />}
                  </Button>
                </div>
                {voiceEnabled && (
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Seleccionar Voz</Label>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <Select 
                          value={selectedVoiceName} 
                          onValueChange={(val) => {
                            setSelectedVoiceName(val);
                            playVoicePreview(val);
                          }}
                        >
                          <SelectTrigger className="w-full h-8 text-xs bg-background/50 border-primary/20 focus:ring-1 focus:ring-primary/30">
                            <SelectValue placeholder="Voz por defecto" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="default" className="text-xs">
                              Voz por defecto del sistema
                            </SelectItem>
                            {availableVoices.map((voice) => {
                              const isColombian = voice.lang.toLowerCase().includes("co");
                              return (
                                <SelectItem key={voice.name} value={voice.name} className="text-xs">
                                  {voice.name} ({voice.lang}) {isColombian ? "🇨🇴" : ""}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 border-primary/20 bg-background/50 text-muted-foreground hover:text-primary shrink-0"
                        onClick={() => playVoicePreview(selectedVoiceName)}
                        title="Probar voz seleccionada"
                      >
                        <IconVolume size={14} />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Alerts panel */}
        <Card className="border-border bg-card flex-1 flex flex-col min-h-[200px]">
          <CardHeader className="p-4 border-b shrink-0 flex flex-row items-center gap-2">
            <IconAlertTriangle className="text-amber-500" size={18} />
            <CardTitle className="text-xs font-bold uppercase tracking-wider">Alertas y Correcciones</CardTitle>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-y-auto min-h-0 divide-y divide-border">
            {alerts.length === 0 ? (
              <p className="text-xs text-muted-foreground italic p-6 text-center leading-relaxed">
                Sin alertas activas. Tu configuración en Meta Ads cumple con las lecciones aprendidas.
              </p>
            ) : (
              alerts.map((alert, idx) => (
                <div key={idx} className="p-4 flex gap-3 hover:bg-muted/10 transition-colors">
                  <IconAlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={15} />
                  <p className="text-[11px] text-foreground/80 leading-relaxed">{alert}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
