"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { API_URL } from "@/lib/constants";
import { IconX, IconVolumeOff, IconVideo, IconWorld } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Orb, AgentState } from "@/components/ui/orb";
import { useThemeConfig } from "@/components/active-theme";
import { ShimmeringText } from "@/components/ui/shimmering-text";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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
  const bargeInRecogRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const resolveSpeakingRef = useRef<(() => void) | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isInterruptedRef = useRef(false);
  const currentAiTextRef = useRef("");

  // Parameter states from parent dashboard chat page
  const [sessionId, setSessionId] = useState("default");
  const [adsMode, setAdsMode] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("syncro_ads_mode") === "true";
    }
    return false;
  });
  const [webSearchEnabled, setWebSearchEnabled] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("syncro_web_search") === "true";
    }
    return false;
  });

  // Refs for SpeechRecognition loop closure prevention
  const adsModeRef = useRef(adsMode);
  const webSearchEnabledRef = useRef(webSearchEnabled);
  const sessionIdRef = useRef("default");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const sId = params.get("sessionId") || "default";
      
      const adsParam = params.get("adsMode");
      const webParam = params.get("webSearch");

      let isAds = adsMode;
      if (adsParam !== null) {
        isAds = adsParam === "true";
        localStorage.setItem("syncro_ads_mode", isAds ? "true" : "false");
      }
      
      let isWeb = webSearchEnabled;
      if (webParam !== null) {
        isWeb = webParam === "true";
        localStorage.setItem("syncro_web_search", isWeb ? "true" : "false");
      }

      setSessionId(sId);
      setAdsMode(isAds);
      setWebSearchEnabled(isWeb);
      
      sessionIdRef.current = sId;
      adsModeRef.current = isAds;
      webSearchEnabledRef.current = isWeb;
    }
  }, []);

  useEffect(() => {
    adsModeRef.current = adsMode;
    if (typeof window !== "undefined") {
      localStorage.setItem("syncro_ads_mode", adsMode ? "true" : "false");
    }
  }, [adsMode]);

  useEffect(() => {
    webSearchEnabledRef.current = webSearchEnabled;
    if (typeof window !== "undefined") {
      localStorage.setItem("syncro_web_search", webSearchEnabled ? "true" : "false");
    }
  }, [webSearchEnabled]);

  const silenceActiveSpeech = () => {
    if (audioRef.current) {
      try { 
        audioRef.current.onended = null;
        audioRef.current.onerror = null;
        audioRef.current.pause(); 
      } catch (e) {}
      audioRef.current = null;
    }
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (resolveSpeakingRef.current) {
      resolveSpeakingRef.current();
    }
  };

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
      try { 
        recognitionRef.current.onend = null; 
        recognitionRef.current.onerror = null;
        recognitionRef.current.abort(); 
      } catch (e) {}
    }
    if (bargeInRecogRef.current) {
      try { 
        bargeInRecogRef.current.onend = null; 
        bargeInRecogRef.current.onerror = null;
        bargeInRecogRef.current.abort(); 
      } catch (e) {}
    }
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
    }
    if (audioRef.current) {
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  };

  const startBargeInRecognition = () => {
    if (!activeRef.current) return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    if (bargeInRecogRef.current) {
      try { bargeInRecogRef.current.onend = null; bargeInRecogRef.current.stop(); } catch (e) {}
    }

    const recog = new SpeechRecognition();
    bargeInRecogRef.current = recog;
    recog.continuous = true;
    recog.interimResults = true;
    recog.lang = "es-VE";

    // We do NOT use onspeechstart to avoid interrupting on background noise/speaker echoes.
    // We only use onresult to check for recognized words.
    recog.onresult = (event: any) => {
      let interimTranscript = "";
      let finalTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      const txt = (finalTranscript || interimTranscript).trim();
      if (!txt) return;

      // Verify if the recognized speech contains words NOT spoken by the AI (real user voice)
      const aiText = currentAiTextRef.current || "";
      const cleanTranscript = txt.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "").trim();
      const cleanAi = aiText.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "").trim();
      
      const recognizedWords = cleanTranscript.split(/\s+/).filter((w: string) => w.length >= 2);
      if (recognizedWords.length === 0) return;
      
      const aiWords = cleanAi.split(/\s+/);
      const foreignWords = recognizedWords.filter((w: string) => {
        return !aiWords.some(aw => aw === w || aw.startsWith(w) || w.startsWith(aw));
      });

      // Filter out common short noise particles and filler sounds in Spanish
      const SPANISH_NOISE_FILLERS = new Set([
        "eh", "ah", "oh", "uh", "el", "la", "los", "las", 
        "un", "una", "unos", "unas", "de", "del", "y", "o", "u"
      ]);
      const meaningfulForeignWords = foreignWords.filter((w: string) => !SPANISH_NOISE_FILLERS.has(w));

      // Trigger interruption if the user said a phrase with at least 2 words,
      // or at least one meaningful word that is reasonably long (length >= 4) to filter out brief noise sounds.
      const shouldInterrupt = 
        meaningfulForeignWords.length >= 2 || 
        meaningfulForeignWords.some(w => w.length >= 4);

      if (shouldInterrupt) {
        // Interruption confirmed!
        isInterruptedRef.current = true;
        silenceActiveSpeech();
        setStatus("listening");
        
        // Wait for the barge-in recognition instance to completely stop before starting the main loop
        recog.onresult = null; // remove result listener to avoid duplicate triggers
        recog.onend = () => {
          bargeInRecogRef.current = null;
          startLoop();
        };
        try { 
          recog.stop(); 
        } catch (e) {
          bargeInRecogRef.current = null;
          startLoop();
        }
      }
    };

    try {
      recog.start();
    } catch (e) {}
  };

  const startLoop = () => {
    if (!activeRef.current) return;
    
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("La entrada por voz no es compatible con este navegador.");
      router.push('/dashboard/soporte');
      return;
    }

    if (bargeInRecogRef.current) {
      try { bargeInRecogRef.current.onend = null; bargeInRecogRef.current.stop(); } catch (e) {}
      bargeInRecogRef.current = null;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.continuous = true; // Continuous listening to allow long statements
    recognition.interimResults = true;
    recognition.lang = "es-VE";

    setStatus("listening");
    setTranscript("");
    transcriptRef.current = "";

    recognition.onresult = (event: any) => {
      let interimTranscript = "";
      let finalTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      const txt = (finalTranscript || interimTranscript).trim();
      if (txt) {
        transcriptRef.current = txt;
        setTranscript(txt);

        // Reset silence timer on every speech feedback
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
        }

        // 3.0 seconds silence timeout to allow long sentences and thinking pauses
        silenceTimerRef.current = setTimeout(() => {
          try {
            recognition.stop();
          } catch (e) {}
        }, 3000);
      }
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

        // Send to backend with active session and ads parameters
        const res = await fetch(`${API}/ai-agent/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ 
            message: txt, 
            sessionId: sessionIdRef.current,
            isAdsMode: adsModeRef.current,
            webSearch: adsModeRef.current && webSearchEnabledRef.current
          }),
        });

        if (!res.ok) throw new Error("AI error");
        const data = await res.json();

        currentAiTextRef.current = data.message;

        setStatus("speaking");

        // Start active barge-in microphone listening during playback
        startBargeInRecognition();

        await new Promise<void>((resolve) => {
          resolveSpeakingRef.current = resolve;
          const onResolve = () => {
            resolveSpeakingRef.current = null;
            resolve();
          };
          if (!activeRef.current) { onResolve(); return; }

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
              
              audio.onended = () => onResolve();
              audio.onerror = () => fallbackTts();
              audio.play();
            } catch {
              fallbackTts();
            }
          };

          const fallbackTts = () => {
            if (typeof window === "undefined" || !window.speechSynthesis) { onResolve(); return; }
            window.speechSynthesis.cancel();
            const cleaned = cleanTextForSpeech(data.message);
            const utterance = new SpeechSynthesisUtterance(cleaned);
            utterance.lang = "es-VE";
            utterance.rate = 1.05;
            utterance.pitch = 1.02;
            const voice = getBestSpanishVoice();
            if (voice) utterance.voice = voice;
            utterance.onend = () => onResolve();
            utterance.onerror = () => onResolve();
            window.speechSynthesis.speak(utterance);
          };

          tryElevenLabs();
        });

      } catch (err) {
        toast.error("Error en modo voz");
      }

      // Stop barge-in listener when natural playback ends
      if (bargeInRecogRef.current) {
        try {
          bargeInRecogRef.current.onend = null;
          bargeInRecogRef.current.stop();
        } catch (e) {}
        bargeInRecogRef.current = null;
      }

      if (activeRef.current) {
        if (isInterruptedRef.current) {
          isInterruptedRef.current = false;
          return;
        }
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
        className="absolute top-6 right-6 size-12 rounded-full bg-foreground/5 hover:bg-foreground/10 text-foreground z-50"
        onClick={() => {
          activeRef.current = false;
          stopAll();
          router.push(`/dashboard/soporte?sessionId=${sessionId}&adsMode=${adsMode}&webSearch=${webSearchEnabled}`);
        }}
      >
        <IconX size={24} />
      </Button>

      <div className="absolute top-8 left-0 right-0 flex justify-center pointer-events-none">
        <h2 className="text-sm font-medium tracking-widest uppercase text-muted-foreground/60 flex justify-center">
          {status === "listening" ? (
            <ShimmeringText text="Escuchando..." className="text-muted-foreground/60" />
          ) : status === "thinking" ? (
            <ShimmeringText text={adsMode && webSearchEnabled ? "Navegando en internet..." : "Pensando..."} className="text-primary" />
          ) : status === "speaking" ? (
            "Hablando..."
          ) : (
            "Iniciando..."
          )}
        </h2>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-md mx-auto px-6">
        <div className="relative size-64 mb-12 flex items-center justify-center flex-col">
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

      {/* Voice controls bar */}
      <div className="absolute bottom-10 left-0 right-0 flex justify-center gap-4 px-6 z-[110]">
        {/* Ads Mode Button */}
        <Button
          variant={adsMode ? "default" : "outline"}
          onClick={() => {
            silenceActiveSpeech();
            setAdsMode(prev => !prev);
            toast(adsMode ? "Modo Ads desactivado" : "Modo Ads activado");
          }}
          className={cn(
            "rounded-full h-11 px-5 flex items-center gap-2 border text-xs font-semibold transition-all active:scale-95",
            adsMode 
              ? "bg-primary border-primary text-primary-foreground shadow-lg shadow-primary/20"
              : "bg-background/50 border-border text-foreground hover:bg-muted"
          )}
        >
          <IconVideo size={16} />
          <span>Modo Ads: {adsMode ? "ON" : "OFF"}</span>
        </Button>

        {/* Web Search Button (only visible if adsMode is true) */}
        {adsMode && (
          <Button
            variant={webSearchEnabled ? "default" : "outline"}
            onClick={() => {
              silenceActiveSpeech();
              setWebSearchEnabled(prev => !prev);
              toast(webSearchEnabled ? "Búsqueda web desactivada" : "🌐 Búsqueda web activada");
            }}
            className={cn(
              "rounded-full h-11 px-5 flex items-center gap-2 border text-xs font-semibold transition-all active:scale-95",
              webSearchEnabled
                ? "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/20"
                : "bg-background/50 border-border text-foreground hover:bg-muted"
            )}
          >
            <IconWorld size={16} />
            <span>Navegación: {webSearchEnabled ? "ON" : "OFF"}</span>
          </Button>
        )}
      </div>
    </div>
  );
}
