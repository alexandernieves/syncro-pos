"use client";

import React, { useState, useRef, useEffect } from "react";
import { Play, Pause, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface AudioBubbleProps {
  url: string;
  isMe?: boolean;
}

export function AudioBubble({ url, isMe }: AudioBubbleProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [hasError, setHasError] = useState(false);
  const [mounted, setMounted] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playPromiseRef = useRef<Promise<void> | null>(null);
  
  // Stable random waveform
  const [waveformData, setWaveformData] = useState<number[]>([]);

  useEffect(() => {
    setMounted(true);
    setWaveformData(Array.from({ length: 35 }, () => Math.random() * 16 + 4));
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.playbackRate = playbackRate;
    }
    return () => {
      if (audio) {
        audio.pause();
      }
    };
  }, [playbackRate]);

  useEffect(() => {
    if (audioRef.current && url && mounted) {
      setHasError(false);
      audioRef.current.load();
    }
  }, [url, mounted]);

  const togglePlay = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!audioRef.current || !url || hasError) return;

    if (isPlaying) {
      // If there's a play promise, wait for it before pausing to avoid AbortError
      if (playPromiseRef.current) {
        await playPromiseRef.current.catch(() => {});
      }
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      try {
        playPromiseRef.current = audioRef.current.play();
        setIsPlaying(true);
        await playPromiseRef.current;
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.error("Playback error:", err);
          setHasError(true);
        }
        setIsPlaying(false);
      } finally {
        playPromiseRef.current = null;
      }
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current && audioRef.current.duration) {
      setProgress((audioRef.current.currentTime / audioRef.current.duration) * 100);
    }
  };

  const handleWaveformClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (!audioRef.current || !audioRef.current.duration || hasError) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    audioRef.current.currentTime = percentage * audioRef.current.duration;
    setProgress(percentage * 100);
  };

  const cyclePlaybackRate = (e: React.MouseEvent) => {
    e.stopPropagation();
    const rates = [1, 1.5, 2];
    const nextIndex = (rates.indexOf(playbackRate) + 1) % rates.length;
    setPlaybackRate(rates[nextIndex]);
  };

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) return <div className="h-16 w-[220px] bg-muted animate-pulse rounded-2xl" />;

  return (
    <div className={cn(
      "flex items-center gap-2.5 min-w-[200px] py-1 transition-all",
      hasError && "opacity-50"
    )} suppressHydrationWarning>
      <audio
        ref={audioRef}
        src={url}
        onTimeUpdate={handleTimeUpdate}
        onEnded={() => setIsPlaying(false)}
        onError={() => setHasError(true)}
        hidden
      />
      
      <button
        onClick={togglePlay}
        className={cn(
          "size-9 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95 shrink-0 shadow-sm",
          isMe ? "bg-white text-primary" : "bg-primary text-white"
        )}
      >
        {hasError ? (
          <AlertCircle size={16} />
        ) : isPlaying ? (
          <Pause size={16} fill="currentColor" />
        ) : (
          <Play size={16} fill="currentColor" className="ml-0.5" />
        )}
      </button>

      <div 
        className="flex-1 flex items-center gap-[3px] h-8 cursor-pointer relative"
        onClick={handleWaveformClick}
      >
        {waveformData.map((height, i) => {
          const barProgress = (i / waveformData.length) * 100;
          const isActive = progress > barProgress;
          
          return (
            <div
              key={i}
              className={cn(
                "w-[2px] rounded-full transition-all duration-300",
                isMe 
                  ? (isActive ? "bg-white/90" : "bg-white/30") 
                  : (isActive ? "bg-primary/90" : "bg-primary/20")
              )}
              style={{ 
                height: `${height}px`,
                transform: isActive ? 'scaleY(1.1)' : 'scaleY(1)'
              }}
            />
          );
        })}
      </div>

      {!hasError && (
        <button
          onClick={cyclePlaybackRate}
          className={cn(
            "h-6 min-w-[32px] rounded-md text-[10px] font-bold transition-colors select-none",
            isMe ? "bg-white/10 hover:bg-white/20 text-white" : "bg-primary/10 hover:bg-primary/20 text-primary"
          )}
        >
          {playbackRate}x
        </button>
      )}
    </div>
  );
}
