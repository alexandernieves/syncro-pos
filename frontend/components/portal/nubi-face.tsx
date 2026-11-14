"use client";

import { useEffect, useState } from "react";

export type NubiMood = "neutral" | "happy" | "sad" | "surprised" | "thinking";
type Face = NubiMood | "sleepy";
const FACES: Face[] = ["neutral", "happy", "sad", "surprised", "thinking", "sleepy"];

/**
 * Nubi standing still, but alive: blinks now and then like a person (every 2.5–5.5 s, sometimes
 * twice), shows the mood it's given, and when nothing happens for a while looks around or smiles
 * on its own. Light stills from public/nubi, cross-faded.
 */
export function NubiFace({ mood = "neutral", className = "", shadow = "drop-shadow(0 10px 12px rgba(90,30,5,0.35))" }: { mood?: NubiMood; className?: string; shadow?: string }) {
  const [blink, setBlink] = useState(false);
  const [idle, setIdle] = useState<NubiMood | null>(null);

  // Natural blinking (the happy squint has its eyes closed already)
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const next = () => {
      t = setTimeout(() => {
        setBlink(true);
        timers.push(setTimeout(() => setBlink(false), 120));
        if (Math.random() < 0.25) {
          timers.push(setTimeout(() => setBlink(true), 260));
          timers.push(setTimeout(() => setBlink(false), 380));
        }
        next();
      }, 2500 + Math.random() * 3000);
    };
    next();
    return () => { clearTimeout(t); timers.forEach(clearTimeout); };
  }, []);

  // Left alone, Nubi looks around or smiles for a moment
  useEffect(() => {
    setIdle(null);
    if (mood !== "neutral") return;
    let t: ReturnType<typeof setTimeout>;
    const next = () => {
      t = setTimeout(() => {
        setIdle(Math.random() < 0.5 ? "happy" : "thinking");
        t = setTimeout(() => { setIdle(null); next(); }, 1400);
      }, 6000 + Math.random() * 4000);
    };
    next();
    return () => clearTimeout(t);
  }, [mood]);

  const shown: NubiMood = mood === "neutral" ? (idle ?? "neutral") : mood;
  const face: Face = blink && shown !== "happy" ? "sleepy" : shown;

  return (
    <div className={`relative ${className}`} aria-hidden>
      {FACES.map((f) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={f}
          src={`/nubi/nubi-${f}.webp`}
          alt=""
          draggable={false}
          className="absolute inset-0 size-full object-contain"
          style={{ opacity: face === f ? 1 : 0, transition: f === "sleepy" || face === "sleepy" ? "none" : "opacity 180ms ease", filter: shadow }}
        />
      ))}
    </div>
  );
}
