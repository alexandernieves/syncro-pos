"use client";

import dynamic from "next/dynamic";
import { Component, type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import type { PodiumCue } from "@/components/mascot/syncro-mascot-3d";

/** Syncro Credit levels: a client starts at 3 and climbs to 1 by paying on time. */
export const SC_LEVELS: Record<1 | 2 | 3, { name: string; from: number }> = {
  3: { name: "Chispa", from: 0 },
  2: { name: "Cometa", from: 500 },
  1: { name: "Galaxia", from: 1500 },
};

// eslint-disable-next-line @next/next/no-img-element
const Still = () => <img src="/nubi/nubi-happy.webp" alt="" draggable={false} className="absolute left-1/2 top-1/2 h-3/5 -translate-x-1/2 -translate-y-1/2 object-contain" />;
/** The thought cloud, kept with the component (it follows Nubi; the 3D loop moves it) */
const CLOUD_CSS = `
.sc-thought { position: absolute; left: 0; top: 0; will-change: transform; }
.sc-thought-cloud {
  position: absolute; left: 0; bottom: 0; transform: translateX(-50%); width: max-content; max-width: 220px;
  padding: 10px 14px; border-radius: 22px; background: #fff; text-align: center;
  filter: drop-shadow(0 8px 14px rgba(90, 30, 5, 0.22));
  transform-origin: 50% 100%;
  animation: sc-cloud-in 420ms cubic-bezier(.2,.9,.3,1.25) 160ms both, sc-cloud-float 3.2s ease-in-out 600ms infinite;
}
.sc-thought-puff { position: absolute; border-radius: 9999px; background: #fff; transform: translateX(-50%); }
.sc-thought-dot {
  position: absolute; border-radius: 9999px; background: #fff; transform: translate(-50%, -50%);
  box-shadow: 0 3px 8px rgba(90, 30, 5, 0.18);
  animation: sc-dot-in 260ms cubic-bezier(.2,.9,.3,1.4) both;
}
.sc-thought-out .sc-thought-cloud { animation: sc-cloud-out 380ms ease-in both; }
.sc-thought-out .sc-thought-dot { animation: sc-dot-out 300ms ease-in both; }
@keyframes sc-cloud-in { from { opacity: 0; transform: translateX(-50%) scale(0.4); } to { opacity: 1; transform: translateX(-50%) scale(1); } }
@keyframes sc-cloud-float { 0%, 100% { translate: 0 0; } 50% { translate: 0 -4px; } }
@keyframes sc-cloud-out { to { opacity: 0; transform: translateX(-50%) translateY(-14px) scale(0.85); } }
@keyframes sc-dot-in { from { opacity: 0; transform: translate(-50%, -50%) scale(0); } to { opacity: 1; transform: translate(-50%, -50%) scale(1); } }
@keyframes sc-dot-out { to { opacity: 0; transform: translate(-50%, -50%) scale(0); } }
`;

const SyncroMascot3D = dynamic(() => import("@/components/mascot/syncro-mascot-3d").then((m) => m.SyncroMascot3D), { ssr: false, loading: Still });

function canDraw3D() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}
class Safe3D extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { /* the still Nubi takes over */ }
  render() { return this.state.failed ? <Still /> : this.props.children; }
}

/**
 * Nubi on the level podium (2 · 1 · 3), standing on the client's step and alive: little bouncy
 * hops, now and then it jumps off, rolls out of the screen and back, or plays a prank (pretends to
 * have gone up a level, or drops to a 4th step and vanishes in a puff) with a speech bubble.
 */
export function NubiPodium({ level, className = "", bubbles = true }: { level: 1 | 2 | 3; className?: string; bubbles?: boolean }) {
  const [webgl, setWebgl] = useState<boolean | null>(null);
  // the thought: its text, and whether it's floating away
  const [bubble, setBubble] = useState<{ text: string; leaving: boolean } | null>(null);
  const hide = useRef<ReturnType<typeof setTimeout> | null>(null);
  const follow = useRef<HTMLDivElement>(null);
  useEffect(() => setWebgl(canDraw3D()), []);
  useEffect(() => () => { if (hide.current) clearTimeout(hide.current); }, []);

  const onCue = useCallback((c: PodiumCue) => {
    if (!bubbles) return;
    const up = level > 1 ? SC_LEVELS[(level - 1) as 1 | 2].name : "";
    const text: Record<PodiumCue, string | null> = {
      "prank-up": `¡Mira! ¡Subí a ${up}!`,
      "prank-up-laugh": "¡Jajaja, era broma! Paga a tiempo y subimos de verdad",
      "prank-down": "Si no pagas a tiempo… ¡te bajamos de nivel!",
      "prank-down-laugh": "¡Jaja! Mejor no lleguemos aquí, ¿verdad?",
      done: null,
    };
    if (hide.current) clearTimeout(hide.current);
    const say = text[c];
    if (say) {
      setBubble({ text: say, leaving: false });
      hide.current = setTimeout(() => {
        setBubble((b) => (b ? { ...b, leaving: true } : b));
        hide.current = setTimeout(() => setBubble(null), 420);
      }, 4600);
    } else {
      setBubble((b) => (b ? { ...b, leaving: true } : b));
      hide.current = setTimeout(() => setBubble(null), 420);
    }
  }, [bubbles, level]);

  return (
    <div className={`relative select-none ${className}`}>
      <style>{CLOUD_CSS}</style>
      {webgl ? (
        <Safe3D>
          <SyncroMascot3D outfit={`podium${level}`} noSleep onCue={onCue} follow={follow} />
        </Safe3D>
      ) : webgl === false ? <Still /> : null}
      {/* Laid exactly over the 3D canvas (which reaches 35% past the box): the frame loop keeps
          --cx/--cy (the cloud) and --nx/--ny (Nubi's head, from the cloud) up to date */}
      <div ref={follow} className="pointer-events-none absolute z-10" style={{ inset: "-35%" }} aria-live="polite">
        {bubble && (
          <div className={`sc-thought ${bubble.leaving ? "sc-thought-out" : ""}`} style={{ transform: "translate(var(--cx, 50%), var(--cy, 30%))" }}>
            {/* little bubbles from the cloud down to Nubi */}
            {[0.38, 0.62, 0.84].map((k, i) => (
              <span key={k} className="sc-thought-dot" style={{ width: 12 - i * 3.5, height: 12 - i * 3.5, left: `calc(var(--nx, 0px) * ${k})`, top: `calc(var(--ny, 40px) * ${k})`, animationDelay: `${(2 - i) * 70}ms` }} />
            ))}
            {/* the cloud */}
            <div className="sc-thought-cloud">
              <span className="sc-thought-puff" style={{ left: "14%", width: 34, height: 34, top: -14 }} />
              <span className="sc-thought-puff" style={{ left: "40%", width: 46, height: 46, top: -22 }} />
              <span className="sc-thought-puff" style={{ left: "70%", width: 32, height: 32, top: -12 }} />
              <p className="relative z-[1] text-[13px] font-semibold leading-snug text-zinc-900">{bubble.text}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
