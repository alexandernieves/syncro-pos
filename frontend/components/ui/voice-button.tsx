"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, Square, Play, Pause, Send, Trash2, Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type VoiceButtonState = "idle" | "recording" | "preview" | "processing" | "success" | "error";

interface VoiceButtonProps {
  state: VoiceButtonState;
  onStart: () => void;
  onStop: () => void;
  onResume: () => void;
  onSend: () => void;
  onDiscard: () => void;
  audioPreviewUrl?: string | null;
  className?: string;
}

export function VoiceButton({
  state,
  onStart,
  onStop,
  onResume,
  onSend,
  onDiscard,
  audioPreviewUrl,
  className,
}: VoiceButtonProps) {
  const [volumes, setVolumes] = useState<number[]>(Array(40).fill(3));
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const [duration, setDuration] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Timer logic
  useEffect(() => {
    if (state === "recording") {
      timerRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    } else if (state === "idle") {
      setDuration(0);
      if (timerRef.current) clearInterval(timerRef.current);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [state]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Live Waveform Logic
  useEffect(() => {
    if (state === "recording") {
      const initAudio = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const audioContext = new AudioContext();
          const analyser = audioContext.createAnalyser();
          const source = audioContext.createMediaStreamSource(stream);
          
          analyser.fftSize = 128;
          source.connect(analyser);
          
          audioContextRef.current = audioContext;
          analyserRef.current = analyser;

          const updateWaveform = () => {
            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            analyser.getByteFrequencyData(dataArray);
            
            // Denser bars (40 instead of 20)
            const newVolumes = Array.from({ length: 40 }, (_, i) => {
              const val = dataArray[i % dataArray.length];
              return Math.max(3, (val / 255) * 24);
            });
            
            setVolumes(newVolumes);
            animationFrameRef.current = requestAnimationFrame(updateWaveform);
          };
          
          updateWaveform();
        } catch (err) {
          console.error("Audio recording error:", err);
        }
      };
      initAudio();
    } else {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close();
      }
      setVolumes(Array(40).fill(3));
    }

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close();
      }
    };
  }, [state]);

  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (state === "idle") {
      setIsPreviewPlaying(false);
    }
  }, [state]);

  const togglePreview = () => {
    if (!audioRef.current) return;
    if (isPreviewPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPreviewPlaying(!isPreviewPlaying);
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <AnimatePresence mode="wait">
        {state === "idle" ? (
          <motion.div key="idle-btn" layout>
            <Button
              size="icon"
              variant="ghost"
              className="rounded-full size-10 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
              onClick={onStart}
            >
              <Mic size={20} />
            </Button>
          </motion.div>
        ) : (
          <motion.div
            key="active-bar"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="flex-1 flex items-center bg-card border rounded-full px-2 h-11 gap-2 shadow-sm"
          >
            {/* DISCARD */}
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full size-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              onClick={onDiscard}
            >
              <Trash2 size={16} />
            </Button>

            {/* STATUS & TIMER */}
            <div className="flex items-center gap-1.5 px-1 min-w-[55px]">
              {state === "recording" && (
                <div className="size-1.5 rounded-full bg-red-500 animate-pulse" />
              )}
              <span className="text-[13px] font-medium font-mono tabular-nums">
                {formatTime(duration)}
              </span>
            </div>

            {/* WAVEFORM */}
            <div className="flex-1 flex items-center justify-center gap-[2px] h-5 overflow-hidden">
              {volumes.map((vol, i) => (
                <motion.div
                  key={i}
                  animate={{ height: vol }}
                  className={cn(
                    "w-[2px] rounded-full",
                    state === "recording" ? "bg-muted-foreground/30" : "bg-primary"
                  )}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                />
              ))}
            </div>

            {/* CONTROLS */}
            <div className="flex items-center gap-1">
              {state === "recording" && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full size-8 text-muted-foreground hover:bg-muted"
                  onClick={onStop}
                >
                  <Square size={14} fill="currentColor" />
                </Button>
              )}
              
              {state === "preview" && audioPreviewUrl && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full size-8 text-primary hover:bg-primary/10"
                    onClick={togglePreview}
                  >
                    {isPreviewPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" className="ml-0.5" />}
                  </Button>
                  
                  {/* RESUME RECORDING BUTTON */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full size-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
                    onClick={() => {
                      if (isPreviewPlaying) togglePreview(); // Stop audio before resuming
                      onResume();
                    }}
                  >
                    <Mic size={16} />
                  </Button>

                  <audio 
                    ref={audioRef} 
                    src={audioPreviewUrl} 
                    onEnded={() => setIsPreviewPlaying(false)}
                    className="hidden" 
                  />
                </>
              )}

              <Button
                size="icon"
                variant="default"
                className={cn(
                  "rounded-full size-8 transition-all shadow-sm",
                  state === "preview" || state === "recording" ? "bg-primary hover:bg-primary/90" : "bg-muted"
                )}
                onClick={() => {
                  if (state === "recording") {
                    onStop();
                    setTimeout(onSend, 100); 
                  } else if (state === "preview") {
                    onSend();
                  }
                }}
                disabled={state === "processing"}
              >
                {state === "processing" ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Send size={14} className="ml-0.5" />
                )}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
