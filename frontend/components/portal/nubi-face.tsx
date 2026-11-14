"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { MascotEmotion } from "@/components/mascot/syncro-mascot-3d";

export type NubiMood = "neutral" | "happy" | "sad" | "surprised" | "thinking";

/** Shown while the 3D head loads (and if WebGL isn't available): the same Nubi, still. */
// eslint-disable-next-line @next/next/no-img-element
const Still = () => <img src="/nubi/nubi-neutral.webp" alt="" draggable={false} className="absolute inset-0 size-full object-contain" style={{ filter: "drop-shadow(0 10px 12px rgba(90,30,5,0.35))" }} />;

// The same 3D Nubi as the dashboard: its face morphs from one emotion to the next, blinks and
// looks around by itself. Loaded only here, so the rest of the PWA doesn't carry three.js.
const SyncroMascot3D = dynamic(() => import("@/components/mascot/syncro-mascot-3d").then((m) => m.SyncroMascot3D), { ssr: false, loading: Still });

// Spontaneous moods while nothing happens in the form
const SPONTANEOUS: MascotEmotion[] = ["happy", "surprised", "thinking", "happy", "surprised"];

/**
 * Nubi in the login. Greets happy, then surprised, then lives on its own like in the dashboard
 * (blinks, looks around, now and then another mood), and reacts to the form through `mood`
 * (thinking while checking, sad on a mistake, happy when it knows you). The 3D head blends the
 * expressions, so every change is smooth.
 */
export function NubiFace({ mood = "neutral", className = "" }: { mood?: NubiMood; className?: string }) {
  const [own, setOwn] = useState<MascotEmotion | undefined>("happy");

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    let alive = true;
    const at = (ms: number, f: () => void) => timers.push(setTimeout(() => alive && f(), ms));
    const next = (delay: number) => at(delay, () => {
      setOwn(SPONTANEOUS[Math.floor(Math.random() * SPONTANEOUS.length)]);
      at(1400 + Math.random() * 900, () => { setOwn(undefined); next(4500 + Math.random() * 4500); });
    });
    // Greeting once it's actually seen (the start screen may still be on top): happy → surprised → on its own
    const greet = () => {
      if (document.querySelector(".sc-splash")) return at(200, greet);
      setOwn("happy");
      at(1900, () => setOwn("surprised"));
      at(3200, () => setOwn(undefined));
      next(7500);
    };
    greet();
    return () => { alive = false; timers.forEach(clearTimeout); };
  }, []);

  // What the form says wins; otherwise its own mood (undefined = alive by itself)
  const emotion: MascotEmotion | undefined = mood !== "neutral" ? mood : own;

  return (
    <div className={`relative ${className}`} aria-hidden style={{ filter: "drop-shadow(0 10px 12px rgba(90,30,5,0.30))" }}>
      <SyncroMascot3D emotion={emotion} />
    </div>
  );
}
