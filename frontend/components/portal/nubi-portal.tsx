"use client";

import { useEffect, useRef, useState } from "react";

/**
 * "Nubi's portal": the screen between the login and the account, both ways.
 *
 * enter (log in / account just activated): orange, Nubi bouncing like a ball with a greeting
 * while the account loads; once it's `ready`, Nubi squashes and pops like a bubble, and from
 * where it was a circle opens and grows until it uncovers the account underneath.
 *
 * leave (log out): the orange closes in a circle from the edges to the middle, Nubi pops in and
 * says goodbye, `onMid` swaps the account for the login behind it, and the screen fades away.
 *
 * Light stills (public/nubi) + one rAF for the circle, so it's smooth on any phone.
 */
const ORANGE = "#F26B3A";
const CY = 0.44; // circle centre, as a share of the height (where Nubi is)

export type PortalFx =
  | { mode: "enter"; title: string; subtitle: string }
  | { mode: "leave"; title: string; subtitle: string };

export function NubiPortal({ fx, ready = false, onMid, onDone }: { fx: PortalFx; ready?: boolean; onMid?: () => void; onDone: () => void }) {
  const shade = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<"in" | "wait" | "pop" | "bye" | "fade">(fx.mode === "enter" ? "wait" : "in");
  const [minDone, setMinDone] = useState(false);
  const [force, setForce] = useState(false);
  const cb = useRef({ onMid, onDone });
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);
  cb.current = { onMid, onDone };

  // the hole in the orange: 0 = all orange, max = all open
  const setHole = (r: number) => {
    const el = shade.current;
    if (!el) return;
    const g = `radial-gradient(circle at 50% ${CY * 100}%, transparent ${r}px, #000 ${r + 1}px)`;
    el.style.maskImage = g;
    el.style.webkitMaskImage = g;
    if (ring.current) {
      ring.current.style.width = ring.current.style.height = `${r * 2}px`;
      ring.current.style.opacity = r > 2 ? "1" : "0";
    }
  };
  const animateHole = (from: number, to: number, ms: number) => new Promise<void>((res) => {
    const t0 = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / ms);
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      setHole(from + (to - from) * e);
      if (t < 1) requestAnimationFrame(step);
      else res();
    };
    requestAnimationFrame(step);
  });
  const maxR = () => Math.hypot(window.innerWidth, window.innerHeight) * 0.9;

  // enter: a short minimum so the greeting is seen even when the account loads at once
  useEffect(() => {
    if (fx.mode !== "enter") return;
    setHole(0);
    const t = setTimeout(() => setMinDone(true), 1100);
    // never stuck: if the account doesn't answer, open anyway (the app shows its own state)
    const guard = setTimeout(() => setForce(true), 12000);
    return () => { clearTimeout(t); clearTimeout(guard); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (fx.mode !== "enter" || phase !== "wait" || !(ready || force) || !minDone) return;
    // (no cleanup here on purpose: switching to "pop" re-runs this effect, and cancelling then left
    // the open, invisible layer on top of the app, swallowing every tap)
    setPhase("pop");
    // Nubi pops, then the circle opens from where it was, and the layer goes away
    setTimeout(async () => {
      await animateHole(0, maxR(), 760);
      if (mounted.current) cb.current.onDone();
    }, 260);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, ready, minDone, force]);

  // leave: close the circle, say goodbye, swap to the login behind, fade
  useEffect(() => {
    if (fx.mode !== "leave") return;
    let alive = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    setHole(maxR());
    (async () => {
      await animateHole(maxR(), 0, 640);
      if (!alive) return;
      setPhase("bye");
      timers.push(setTimeout(() => cb.current.onMid?.(), 900));
      timers.push(setTimeout(() => alive && setPhase("fade"), 1300));
      timers.push(setTimeout(() => alive && cb.current.onDone(), 1750));
    })();
    return () => { alive = false; timers.forEach(clearTimeout); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showNubi = phase === "wait" || phase === "pop" || phase === "bye" || phase === "fade";
  const showText = phase === "wait" || phase === "bye" || phase === "fade";

  return (
    <div
      className="fixed inset-0 z-[260] select-none"
      style={{ opacity: phase === "fade" ? 0 : 1, transition: "opacity 420ms ease", pointerEvents: phase === "fade" || phase === "pop" ? "none" : "auto" }}
      role="status"
      aria-label={fx.title}
    >
      {/* the orange, with its circular hole */}
      <div ref={shade} className="absolute inset-0" style={{ background: ORANGE }}>
        <div aria-hidden className="absolute -top-1/4 left-1/2 -translate-x-1/2 size-[140vw] max-w-[900px] max-h-[900px] rounded-full" style={{ background: "radial-gradient(circle, rgba(255,255,255,0.20) 0%, rgba(255,255,255,0) 62%)" }} />
      </div>
      {/* soft light along the edge of the circle */}
      <div
        ref={ring}
        aria-hidden
        className="pointer-events-none absolute left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ top: `${CY * 100}%`, opacity: 0, boxShadow: "0 0 0 2px rgba(255,255,255,0.55), 0 0 40px 6px rgba(255,255,255,0.35)" }}
      />

      {/* Nubi */}
      <div className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center" style={{ top: `${CY * 100}%` }}>
        {showNubi && (
          <div className="relative h-[110px] w-[122px]">
            <div
              className="absolute inset-0 origin-bottom"
              style={{
                animation:
                  phase === "wait" ? "sc-portal-bounce 620ms cubic-bezier(.3,0,.7,1) infinite"
                  : phase === "pop" ? "sc-portal-pop 300ms ease-in both"
                  : "sc-portal-in 520ms cubic-bezier(.2,.9,.3,1.3) both",
                filter: "drop-shadow(0 12px 14px rgba(90,30,5,0.35))",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/nubi/nubi-happy.webp" alt="" draggable={false} className="size-full object-contain" />
            </div>
          </div>
        )}
        {phase === "wait" && (
          <div aria-hidden className="mt-1 h-2.5 w-20 rounded-[50%] bg-[#7a2a0c]" style={{ animation: "sc-portal-shadow 620ms cubic-bezier(.3,0,.7,1) infinite" }} />
        )}
      </div>

      {/* greeting */}
      <div className="absolute inset-x-0 px-6 text-center" style={{ top: `calc(${CY * 100}% + 92px)`, opacity: showText ? 1 : 0, transition: "opacity 220ms ease" }}>
        <p className="text-[28px] leading-tight text-white" style={{ fontWeight: 800, letterSpacing: "-0.03em" }}>{fx.title}</p>
        <p className="mt-2 text-[15px] font-medium text-white/85">
          {fx.subtitle}
          {phase === "wait" && (
            <span className="ml-0.5 inline-flex gap-0.5 align-middle">
              {[0, 1, 2].map((i) => <span key={i} className="inline-block size-1 rounded-full bg-white/85 animate-bounce" style={{ animationDelay: `${i * 140}ms` }} />)}
            </span>
          )}
        </p>
      </div>
    </div>
  );
}
