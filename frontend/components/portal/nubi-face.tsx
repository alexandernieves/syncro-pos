"use client";

import dynamic from "next/dynamic";
import { Component, type ReactNode, useEffect, useRef, useState } from "react";
import type { MascotEmotion } from "@/components/mascot/syncro-mascot-3d";

export type NubiMood = "neutral" | "happy" | "sad" | "surprised" | "thinking" | "angry";
/** Ask Nubi to roll: bump `n` each time; `dir` 1 = forward (to the right), -1 = back. */
export type NubiRoll = { n: number; dir: 1 | -1 };

/** Shown while the 3D head loads (and if WebGL isn't available): the same Nubi, still. */
// eslint-disable-next-line @next/next/no-img-element
const Still = () => <img src="/nubi/nubi-neutral.webp" alt="" draggable={false} className="absolute inset-0 size-full object-contain" />;

// The same 3D Nubi as the dashboard: its face morphs from one emotion to the next, blinks and
// looks around by itself. Loaded only here, so the rest of the PWA doesn't carry three.js.
const SyncroMascot3D = dynamic(() => import("@/components/mascot/syncro-mascot-3d").then((m) => m.SyncroMascot3D), { ssr: false, loading: Still });

/** Whether this phone can draw the 3D head (WebGL off, blocked or out of memory → still Nubi). */
function canDraw3D() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

/** If the 3D head fails anyway, show the still Nubi instead of taking the whole app down. */
class Safe3D extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { /* the still Nubi takes over */ }
  render() { return this.state.failed ? <Still /> : this.props.children; }
}

// Spontaneous moods while nothing happens in the form: every emotion but sleeping (on a phone
// there's no mouse to wake it up, so it would just look asleep)
const SPONTANEOUS: MascotEmotion[] = ["happy", "surprised", "thinking", "happy", "angry", "surprised", "sad", "happy"];

const SPEED = 560; // px per second while rolling

/**
 * Nubi in the login. Greets happy, then surprised, then lives on its own like in the dashboard,
 * and reacts to the form through `mood`. It also carries the user between the login steps: on
 * every `roll` it rolls (really rolling: it turns as much as the distance it covers), leaves by
 * one side and comes back by the other, keeps going round while `busy` (that's the loading
 * sign), and glides to a stop in the middle, upright.
 */
export function NubiFace({ mood = "neutral", className = "", roll, busy = false }: { mood?: NubiMood; className?: string; roll?: NubiRoll; busy?: boolean }) {
  const [own, setOwn] = useState<MascotEmotion | undefined>("happy");
  const [webgl, setWebgl] = useState<boolean | null>(null);
  useEffect(() => setWebgl(canDraw3D()), []);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    let alive = true;
    const at = (ms: number, f: () => void) => timers.push(setTimeout(() => alive && f(), ms));
    const next = (delay: number) => at(delay, () => {
      const m = SPONTANEOUS[Math.floor(Math.random() * SPONTANEOUS.length)];
      setOwn(m);
      // the gloomy ones are short
      const hold = m === "angry" || m === "sad" ? 1100 : 1500 + Math.random() * 800;
      at(hold, () => { setOwn(undefined); next(4000 + Math.random() * 4000); });
    });
    // Greeting once it's actually seen (the start screen may still be on top): happy → surprised → on its own
    const greet = () => {
      if (document.querySelector(".sc-splash")) return at(200, greet);
      setOwn("happy");
      at(1900, () => setOwn("surprised"));
      at(3200, () => setOwn(undefined));
      next(7000);
    };
    greet();
    return () => { alive = false; timers.forEach(clearTimeout); };
  }, []);

  // ── Rolling ────────────────────────────────────────────────────────────────
  const move = useRef<HTMLDivElement>(null);
  const spin = useRef<HTMLDivElement>(null);
  const busyRef = useRef(busy);
  busyRef.current = busy;
  const st = useRef({ x: 0, angle: 0, v: 0, dir: 1 as 1 | -1, wrapped: false, running: false, pending: false, raf: 0 });

  useEffect(() => {
    if (!roll || roll.n === 0) return;
    const s = st.current;
    s.dir = roll.dir;
    s.wrapped = false; // every roll goes all the way round at least once
    if (s.running) { s.pending = true; return; } // the running loop takes the new roll
    s.running = true;
    const size = move.current?.offsetWidth || 84;
    const circ = Math.PI * size;
    let last = performance.now();
    let settle: { from: number; a0: number; a1: number; t0: number; dur: number } | null = null;
    const apply = () => {
      if (move.current) move.current.style.transform = `translateX(${s.x}px)`;
      if (spin.current) spin.current.style.transform = `rotate(${s.angle}deg)`;
    };
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      // a new roll while gliding to a stop: keep rolling
      if (settle && s.pending) settle = null;
      s.pending = false;
      if (!settle) {
        const edge = window.innerWidth / 2 + size;
        s.v = Math.min(SPEED, s.v + SPEED * dt * 2.5); // gentle start
        const dx = s.dir * s.v * dt;
        s.x += dx;
        s.angle += (dx / circ) * 360;
        if (s.dir > 0 && s.x > edge) { s.x = -edge; s.wrapped = true; }
        if (s.dir < 0 && s.x < -edge) { s.x = edge; s.wrapped = true; }
        // Back in on the other side and nothing left to wait for: glide to the middle
        const comingIn = s.dir > 0 ? s.x < 0 : s.x > 0;
        if (s.wrapped && comingIn && !busyRef.current) {
          const d = Math.abs(s.x);
          const rollDeg = (d / circ) * 360 * s.dir;
          // land upright: round the turn to a whole revolution in the same direction
          const target = s.dir > 0 ? Math.ceil((s.angle + rollDeg) / 360) * 360 : Math.floor((s.angle + rollDeg) / 360) * 360;
          settle = { from: s.x, a0: s.angle, a1: target, t0: now, dur: Math.max(260, ((3 * d) / Math.max(s.v, 1)) * 1000) };
        }
      } else {
        const t = Math.min(1, (now - settle.t0) / settle.dur);
        const e = 1 - Math.pow(1 - t, 3); // eases out from the rolling speed
        s.x = settle.from * (1 - e);
        s.angle = settle.a0 + (settle.a1 - settle.a0) * e;
        if (t >= 1) {
          s.x = 0;
          s.angle = 0;
          s.v = 0;
          s.running = false;
          apply();
          return;
        }
      }
      apply();
      s.raf = requestAnimationFrame(step);
    };
    s.raf = requestAnimationFrame(step);
  }, [roll]);

  useEffect(() => () => cancelAnimationFrame(st.current.raf), []);

  // What the form says wins; otherwise its own mood (undefined = alive by itself)
  const emotion: MascotEmotion | undefined = mood !== "neutral" ? mood : own;

  return (
    // the shadow sits on the box that doesn't turn, so it stays under Nubi while it rolls
    <div className={`relative ${className}`} aria-hidden style={{ filter: "drop-shadow(0 10px 12px rgba(90,30,5,0.30))" }}>
      <div ref={move} className="absolute inset-0 will-change-transform">
        <div ref={spin} className="absolute inset-0 will-change-transform">
          {webgl ? (
            <Safe3D>
              <SyncroMascot3D emotion={emotion} noSleep />
            </Safe3D>
          ) : (
            <Still />
          )}
        </div>
      </div>
    </div>
  );
}
