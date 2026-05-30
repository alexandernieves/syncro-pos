"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { API_URL } from "@/lib/constants";
import { IconX } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Orb, AgentState } from "@/components/ui/orb";
import { useThemeConfig } from "@/components/active-theme";
import { toast } from "sonner";

const API = API_URL;

const getOrbColors = (theme: string): [string, string] => {
  const themeName = theme?.replace("-scaled", "") || "default";
  switch (themeName) {
    case "blue": return ["#2563eb", "#60a5fa"];
    case "green": return ["#65a30d", "#a3e635"];
    case "amber": return ["#d97706", "#fbbf24"];
    case "mono": return ["#4b5563", "#9ca3af"];
    default: return ["#4b5563", "#9ca3af"];
  }
};

const cleanTextForSpeech = (text: string) => {
  if (!text) return "";
  let clean = text.replace(/[*#_`]/g, "");
  clean = clean.replace(/```[\s\S]*?```/g, "");
  clean = clean.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  clean = clean.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '');
  return clean.trim();
};

const getBestSpanishVoice = () => {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
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

export default function VoiceAiPage() {
  const router = useRouter();
  const { activeTheme } = useThemeConfig();
  
  const [status, setStatus] = useState<"idle" | "listening" | "thinking" | "speaking">("idle");
  const [transcript, setTranscript] = useState("");
  const transcriptRef = useRef("");
  
  const activeRef = useRef(true);
  const recognitionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Map to Orb AgentState
  const agentState: AgentState = 
    status === "thinking" ? "thinking" :
    status === "listening" ? "listening" :
    status === "speaking" ? "talking" : null;

  useEffect(() => {
    // Preload voices
    if (typeof window !== "undefined" && window.speechSynthesis) {
      const load = () => { window.speechSynthesis.getVoices(); };
      load();
      window.speechSynthesis.addEventListener("voiceschanged", load);
      return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
    }
  }, []);

  useEffect(() => {
    // Start loop on mount
    activeRef.current = true;
    startLoop();

    return () => {
      activeRef.current = false;
      stopAll();
    };
  }, []);

  const stopAll = () => {
    if (recognitionRef.current) {
      try { recognitionRef.current.onend = null; recognitionRef.current.stop(); } catch (e) {}
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  };

  const startLoop = () => {
    if (!activeRef.current) return;
    
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("La entrada por voz no es compatible con este navegador.");
      router.push('/dashboard/soporte');
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "es-VE";

    setStatus("listening");
    setTranscript("");
    transcriptRef.current = "";

    // ── Barge-in Handling ──
    // If the user starts speaking, immediately stop any ongoing AI audio.
    const handleBargeIn = () => {
      if (status === "speaking") {
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current = null;
        }
        if (typeof window !== "undefined" && window.speechSynthesis) {
          window.speechSynthesis.cancel();
        }
        setStatus("listening");
      }
    };

    recognition.onspeechstart = () => {
      handleBargeIn();
    };

    recognition.onresult = (event: any) => {
      handleBargeIn();
      const txt = Array.from(event.results)
        .map((r: any) => r[0].transcript)
        .join("");
      transcriptRef.current = txt;
      setTranscript(txt);
    };

    recognition.onerror = (event: any) => {
      if (event.error === "aborted" || !activeRef.current) return;
      if (activeRef.current) {
        setTimeout(() => startLoop(), 800);
      }
    };

    recognition.onend = async () => {
      if (!activeRef.current) return;
      
      const txt = transcriptRef.current;
      transcriptRef.current = "";
      setTranscript("");

      if (!txt.trim()) {
        setTimeout(() => startLoop(), 400);
        return;
      }

      setStatus("thinking");

      try {
        const isPwa = typeof window !== "undefined" && window.matchMedia("(display-mode: standalone)").matches;
        const token = isPwa ? sessionStorage.getItem("token") : localStorage.getItem("token");

        // Send to backend (using 'default' session or a specific voice session if needed)
        const res = await fetch(`${API}/ai-agent/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ message: txt, sessionId: "voice-session-active" }),
        });

        if (!res.ok) throw new Error("AI error");
        const data = await res.json();

        setStatus("speaking");

        await new Promise<void>((resolve) => {
          if (!activeRef.current) { resolve(); return; }

          const tryElevenLabs = async () => {
            try {
              const cleaned = cleanTextForSpeech(data.message);
              const ttsRes = await fetch(`${API}/ai-agent/tts`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ text: cleaned }),
              });

              if (!ttsRes.ok) throw new Error("TTS failed");
              const blob = await ttsRes.blob();
              const url = URL.createObjectURL(blob);
              const audio = new Audio(url);
              audioRef.current = audio;
              
              audio.onended = () => resolve();
              audio.onerror = () => fallbackTts();
              audio.play();
            } catch {
              fallbackTts();
            }
          };

          const fallbackTts = () => {
            if (typeof window === "undefined" || !window.speechSynthesis) { resolve(); return; }
            window.speechSynthesis.cancel();
            const cleaned = cleanTextForSpeech(data.message);
            const utterance = new SpeechSynthesisUtterance(cleaned);
            utterance.lang = "es-VE";
            utterance.rate = 1.05;
            utterance.pitch = 1.02;
            const voice = getBestSpanishVoice();
            if (voice) utterance.voice = voice;
            utterance.onend = () => resolve();
            utterance.onerror = () => resolve();
            window.speechSynthesis.speak(utterance);
          };

          tryElevenLabs();
        });

      } catch (err) {
        toast.error("Error en modo voz");
      }

      if (activeRef.current) {
        setTimeout(() => startLoop(), 600);
      }
    };

    try {
      recognition.start();
    } catch (e) {
      setTimeout(() => startLoop(), 800);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-background/90 backdrop-blur-xl flex flex-col items-center justify-center overflow-hidden">
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-6 right-6 size-12 rounded-full bg-foreground/5 hover:bg-foreground/10 text-foreground"
        onClick={() => {
          activeRef.current = false;
          stopAll();
          router.push('/dashboard/soporte');
        }}
      >
        <IconX size={24} />
      </Button>

      <div className="absolute top-8 left-0 right-0 flex justify-center">
        <h2 className="text-sm font-medium tracking-widest uppercase text-muted-foreground/60">
          {status === "listening" ? "Escuchando..." : status === "thinking" ? "Pensando..." : status === "speaking" ? "Hablando..." : "Iniciando..."}
        </h2>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-md mx-auto px-6">
        <div className="relative size-64 mb-12 flex items-center justify-center">
          <Orb 
            agentState={agentState} 
            colors={getOrbColors(activeTheme || 'default')} 
          />
        </div>

        <div className="h-24 w-full flex items-center justify-center px-4">
          <p className="text-xl md:text-2xl font-light text-center text-foreground/80 leading-relaxed transition-all duration-300">
            {transcript || (status === "listening" ? "Te escucho..." : "")}
          </p>
        </div>
      </div>
    </div>
  );
}
