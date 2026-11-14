"use client";

import { useEffect, useState } from "react";

/**
 * Syncro Credit's start screen: Nubi drops in, floats and blinks while the app loads, and smiles
 * with a little hop once it's ready, then the screen fades away. It's in the static HTML, so it's
 * the very first thing the phone paints. Uses three light stills (public/nubi) instead of the 3D
 * head, so opening the app stays fast.
 */
const MIN_MS = 1700; // long enough to see Nubi land and blink once
const HAPPY_MS = 700;
const FADE_MS = 420;

type Face = "neutral" | "sleepy" | "happy";

export function NubiSplash({ ready }: { ready: boolean }) {
  const [phase, setPhase] = useState<"loading" | "happy" | "out" | "gone">("loading");
  const [face, setFace] = useState<Face>("neutral");
  const [minDone, setMinDone] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMinDone(true), MIN_MS);
    return () => clearTimeout(t);
  }, []);

  // Blinks while waiting: the first one right after landing, then every few seconds
  useEffect(() => {
    if (phase !== "loading") return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const blink = (at: number) => {
      timers.push(setTimeout(() => setFace("sleepy"), at));
      timers.push(setTimeout(() => setFace("neutral"), at + 140));
    };
    blink(950);
    const loop = setInterval(() => blink(0), 2600);
    return () => { timers.forEach(clearTimeout); clearInterval(loop); };
  }, [phase]);

  useEffect(() => {
    if (phase !== "loading" || !ready || !minDone) return;
    setFace("happy");
    setPhase("happy");
  }, [phase, ready, minDone]);

  // Smile and hop, then fade out
  useEffect(() => {
    if (phase === "happy") {
      const t = setTimeout(() => setPhase("out"), HAPPY_MS);
      return () => clearTimeout(t);
    }
    if (phase === "out") {
      const t = setTimeout(() => setPhase("gone"), FADE_MS);
      return () => clearTimeout(t);
    }
  }, [phase]);

  if (phase === "gone") return null;

  return (
    <div
      className="sc-splash fixed inset-0 z-[300] flex flex-col items-center justify-center bg-background select-none"
      style={{ opacity: phase === "out" ? 0 : 1, transition: `opacity ${FADE_MS}ms ease`, pointerEvents: phase === "out" ? "none" : "auto" }}
      role="status"
      aria-label="Cargando Syncro Credit"
    >
      <div className="relative flex flex-col items-center" style={{ transform: phase === "out" ? "scale(1.04)" : "none", transition: `transform ${FADE_MS}ms ease` }}>
        {/* warm glow behind Nubi */}
        <div
          aria-hidden
          className="absolute left-1/2 top-[70px] size-[260px] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(242,107,58,0.20) 0%, rgba(242,107,58,0.07) 45%, rgba(242,107,58,0) 70%)", animation: "sc-glow 3.2s ease-in-out infinite" }}
        />

        <div className="relative h-[150px] w-[168px]" style={{ animation: "sc-nubi-in 900ms cubic-bezier(.2,.8,.3,1) both" }}>
          <div
            className="absolute inset-0"
            style={{ animation: phase === "loading" ? "sc-nubi-bob 2.6s ease-in-out 900ms infinite" : "sc-hop 600ms ease-out both" }}
          >
            {(["neutral", "sleepy", "happy"] as Face[]).map((f) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={f}
                src={`/nubi/nubi-${f}.webp`}
                alt=""
                draggable={false}
                className="absolute inset-0 h-full w-full object-contain"
                style={{ opacity: face === f ? 1 : 0, filter: "drop-shadow(0 18px 22px rgba(60,40,20,0.16))" }}
              />
            ))}
          </div>
        </div>
        {/* soft shadow on the floor, smaller when Nubi floats up */}
        <div
          aria-hidden
          className="mt-3 h-3 w-24 rounded-[50%] bg-[#2A2723]"
          style={{ animation: "sc-shadow-bob 2.6s ease-in-out 900ms infinite", opacity: 0.2 }}
        />

        <div className="mt-7 text-center" style={{ animation: "sc-rise 600ms ease-out 500ms both" }}>
          <p className="text-[28px] font-bold leading-none tracking-[-0.03em] text-foreground">
            Syncro <span className="text-primary">Credit</span>
          </p>
          <p className="mt-2 text-[13px] font-medium text-muted-foreground">
            {phase === "loading" ? "Compra hoy, paga después" : "¡Listo!"}
          </p>
        </div>

        <div className="mt-6 h-1 w-28 overflow-hidden rounded-full bg-[#E5E1D9]" style={{ animation: "sc-rise 600ms ease-out 700ms both", visibility: phase === "loading" ? "visible" : "hidden" }}>
          <div className="h-full w-2/5 rounded-full bg-primary" style={{ animation: "sc-bar 1.1s ease-in-out infinite" }} />
        </div>
      </div>
    </div>
  );
}
