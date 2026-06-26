"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";

// Detects the audio MIME type by checking the magic bytes of the base64 string
function getAudioMimeType(base64: string): string {
  if (!base64) return "audio/ogg";
  
  // Strip data URL prefix if present
  const clean = base64.startsWith("data:") ? base64.split(",")[1] : base64;
  
  // EBML/WebM container header (magic bytes: 1A 45 DF A3) starts with GkX in base64
  if (clean.startsWith("GkX")) return "audio/webm";
  // Ogg container header (magic bytes: OggS) starts with T2dn in base64
  if (clean.startsWith("T2dn")) return "audio/ogg";
  // WAV container header (magic bytes: RIFF) starts with UklGR in base64
  if (clean.startsWith("UklGR")) return "audio/wav";
  // MP3 frame sync / ID3 starts with SUQz or /+M
  if (clean.startsWith("SUQz") || clean.startsWith("/+M")) return "audio/mpeg";
  
  return "audio/ogg"; // Fallback default
}

interface WhatsAppAudioPlayerProps {
  src: string;
  isAgent?: boolean;
  isMe?: boolean;
  timestamp?: string;
  isRead?: boolean;
  status?: string; // "READ", "DELIVERED", "SENT"
  senderAvatar?: string | null;
  senderFallback?: string;
}

export function WhatsAppAudioPlayer({
  src,
  isAgent = false,
  isMe = false,
  timestamp,
  isRead = false,
  status = "SENT",
  senderAvatar,
  senderFallback,
}: WhatsAppAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playPromiseRef = useRef<Promise<void> | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [hasError, setHasError] = useState(false);

  // Unify the me/agent sender state
  const isSenderMe = isMe || isAgent;

  // Stable soundwave bar heights (36 bars)
  const barHeights = [
    6, 10, 16, 12, 8, 14, 20, 24, 18, 14, 10, 8, 12, 16, 22, 26, 18, 14,
    10, 12, 16, 20, 24, 16, 12, 8, 10, 14, 18, 22, 16, 12, 8, 10, 12, 8
  ];

  // Resolve source URL/Base64 data
  let resolvedSrc = src;
  if (src && !src.startsWith("data:") && !src.startsWith("http://") && !src.startsWith("https://")) {
    const mime = getAudioMimeType(src);
    resolvedSrc = `data:${mime};base64,${src}`;
  }

  // Effect to apply playback rate
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  const togglePlay = async () => {
    if (!audioRef.current || !resolvedSrc || hasError) return;

    if (isPlaying) {
      if (playPromiseRef.current) {
        await playPromiseRef.current.catch(() => {});
      }
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      try {
        setHasError(false);
        playPromiseRef.current = audioRef.current.play();
        setIsPlaying(true);
        await playPromiseRef.current;
      } catch (err) {
        console.error("Playback failed:", err);
        setIsPlaying(false);
        setHasError(true);
      } finally {
        playPromiseRef.current = null;
      }
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration || 0);
      setHasError(false);
    }
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setCurrentTime(val);
    if (audioRef.current) {
      audioRef.current.currentTime = val;
    }
  };

  const cyclePlaybackRate = (e: React.MouseEvent) => {
    e.stopPropagation();
    const rates = [1, 1.5, 2];
    const nextIndex = (rates.indexOf(playbackRate) + 1) % rates.length;
    setPlaybackRate(rates[nextIndex]);
  };

  const formatTime = (time: number) => {
    if (isNaN(time) || time === Infinity || time === 0) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex items-center gap-3.5 py-1.5 w-full min-w-[245px] max-w-[310px] md:min-w-[260px] select-none">
      <audio
        ref={audioRef}
        src={resolvedSrc}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleAudioEnded}
        onError={() => setHasError(true)}
        className="hidden"
      />

      {/* Play/Pause Button (No background circle, WhatsApp style) */}
      <button
        onClick={togglePlay}
        disabled={hasError}
        className={`size-6 flex items-center justify-center transition-transform active:scale-90 shrink-0 cursor-pointer ${
          isSenderMe
            ? "text-white hover:text-emerald-100/90"
            : "text-zinc-600 dark:text-zinc-350 hover:text-zinc-800 dark:hover:text-white"
        } ${hasError ? "opacity-40 cursor-not-allowed" : ""}`}
      >
        {hasError ? (
          <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        ) : isPlaying ? (
          // Pause Icon
          <svg className="size-5 fill-current" viewBox="0 0 24 24">
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
          </svg>
        ) : (
          // Play Icon
          <svg className="size-5 fill-current translate-x-[1px]" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      {/* Waveform and Progress */}
      <div className="flex-1 flex flex-col justify-center min-w-0">
        <div className="relative flex items-center gap-[2px] h-6 w-full cursor-pointer">
          {barHeights.map((height, index) => {
            const barProgressPct = (index / barHeights.length) * 100;
            const isPlayed = progressPct >= barProgressPct;
            
            return (
              <div
                key={index}
                style={{ height: `${height}px` }}
                className={`w-[2.2px] rounded-full transition-colors duration-75 flex-1 max-w-[3.5px] ${
                  isPlayed
                    ? "bg-sky-400 dark:bg-sky-400" // Played (WhatsApp Blue)
                    : isSenderMe
                    ? "bg-white/40 dark:bg-white/20" // Sent, unplayed (blends with green)
                    : "bg-zinc-300 dark:bg-zinc-700" // Received, unplayed (gray)
                }`}
              />
            );
          })}

          {/* Blue Scrubber Handle Dot */}
          {progressPct > 0 && !hasError && (
            <div
              style={{ left: `calc(${progressPct}% - 6px)` }}
              className="absolute size-3 rounded-full bg-sky-400 border border-white dark:border-zinc-900 shadow-xs pointer-events-none z-10"
            />
          )}

          {/* Invisible range slider overlay for seeking */}
          <input
            type="range"
            min="0"
            max={duration || 1}
            step="0.05"
            value={currentTime}
            onChange={handleSeek}
            disabled={hasError}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-20 disabled:cursor-not-allowed"
          />
        </div>

        {/* Info Row: Duration on left, Timestamp/Checks on right */}
        <div className="flex justify-between items-center mt-1 text-[10px] font-medium leading-none select-none">
          <span className={isSenderMe ? "text-emerald-100/90" : "text-zinc-500 dark:text-zinc-400"}>
            {formatTime(currentTime || duration)}
          </span>
          <div className="flex items-center gap-1.5">
            {timestamp && (
              <span className={isSenderMe ? "text-emerald-100/90" : "text-zinc-500 dark:text-zinc-400"}>
                {timestamp}
              </span>
            )}
            {isSenderMe && (
              <span className="flex items-center">
                {status === "READ" || isRead ? (
                  // Double blue check
                  <svg className="size-3.5 text-sky-300 fill-current" viewBox="0 0 24 24">
                    <path d="M0.41 13.41L6 19l1.41-1.41L1.83 12M22.24 5.58L11.66 16.17l-4.17-4.17L6.08 13.41l5.58 5.58L23.66 7M18 7l-1.41-1.41-6.34 6.34 1.41 1.41L18 7z" />
                  </svg>
                ) : status === "DELIVERED" ? (
                  // Double gray check
                  <svg className="size-3.5 text-emerald-200/70 fill-current" viewBox="0 0 24 24">
                    <path d="M0.41 13.41L6 19l1.41-1.41L1.83 12M22.24 5.58L11.66 16.17l-4.17-4.17L6.08 13.41l5.58 5.58L23.66 7M18 7l-1.41-1.41-6.34 6.34 1.41 1.41L18 7z" />
                  </svg>
                ) : (
                  // Single gray check
                  <svg className="size-3.5 text-emerald-200/70 fill-current" viewBox="0 0 24 24">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                  </svg>
                )}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Speed control bubble (Cycles 1x -> 1.5x -> 2x) */}
      {!hasError && isPlaying && (
        <button
          onClick={cyclePlaybackRate}
          className={`text-[9px] font-bold px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 hover:bg-black/15 dark:hover:bg-white/20 transition-colors shrink-0 ${
            isSenderMe ? "text-white" : "text-zinc-600 dark:text-zinc-350"
          }`}
        >
          {playbackRate}x
        </button>
      )}

      {/* Right side: Contact Avatar with Microphone Badge overlay */}
      <div className="relative shrink-0 select-none">
        <div className={`size-9 rounded-full flex items-center justify-center text-xs font-bold border overflow-hidden shrink-0 ${
          isSenderMe
            ? "bg-emerald-500/20 text-white border-emerald-400/20"
            : "bg-zinc-100 dark:bg-zinc-900 text-zinc-650 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800"
        }`}>
          {senderAvatar ? (
            <img src={senderAvatar} alt="Avatar" className="size-full object-cover" />
          ) : (
            senderFallback || (
              <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            )
          )}
        </div>

        {/* Microphone Badge overlay */}
        <div className={`absolute -bottom-0.5 -left-0.5 size-4 rounded-full flex items-center justify-center border shadow-xs ${
          isSenderMe
            ? "bg-emerald-600 border-emerald-500"
            : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
        }`}>
          <svg
            className={`size-2.5 ${
              isRead || isSenderMe
                ? "text-sky-400" // Played/Read or Sent (blue)
                : "text-zinc-400 dark:text-zinc-500" // Unplayed received (gray)
            } fill-current`}
            viewBox="0 0 24 24"
          >
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" />
          </svg>
        </div>
      </div>
    </div>
  );
}
