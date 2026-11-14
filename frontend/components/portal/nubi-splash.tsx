"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Syncro Credit's start screen. Orange from edge to edge with SYNCRO / CREDIT in big letters:
 * Nubi drops in like a ball and bounces from letter to letter of SYNCRO, squashing on every
 * landing while the letter it hits gives way and lights up. Then CREDIT pops in, Nubi hops to the
 * middle, smiles, and the screen fades into the app. It keeps bouncing back and forth while the
 * app is still loading.
 *
 * Driven by requestAnimationFrame (position) + Web Animations (squash), no re-renders per frame.
 * Nubi is three light stills (public/nubi), not the 3D head, so opening the app stays fast.
 */
export const SPLASH_ORANGE = "#F26B3A";
const BONE = "#F7F5F0";
const TOP = "SYNCRO";
const BOTTOM = "CREDIT";
const DROP_MS = 560;
const HOP_MS = 300;
const HOP_H = 62;
const FINAL_MS = 540;
const HOLD_MS = 480;
const FADE_MS = 420;

/** The status bar follows what's on screen: orange on the splash and the login, bone elsewhere. */
export function syncThemeColor() {
  const orange = !!document.querySelector(".sc-splash:not([data-out]), [data-sc-orange]");
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", orange ? SPLASH_ORANGE : BONE);
}

type Pt = { x: number; y: number };

export function NubiSplash({ ready }: { ready: boolean }) {
  const readyRef = useRef(ready);
  readyRef.current = ready;
  const [out, setOut] = useState(false);
  const [gone, setGone] = useState(false);

  const wrap = useRef<HTMLDivElement>(null);
  const nubi = useRef<HTMLDivElement>(null);
  const stretch = useRef<HTMLDivElement>(null);
  const squash = useRef<HTMLDivElement>(null);
  const top = useRef<(HTMLSpanElement | null)[]>([]);
  const bottom = useRef<(HTMLSpanElement | null)[]>([]);
  const tag = useRef<HTMLParagraphElement>(null);
  const faces = useRef<Record<string, HTMLImageElement | null>>({});

  useEffect(() => {
    syncThemeColor();
    let cancelled = false;
    let raf = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const sleep = (ms: number) => new Promise<void>((r) => timers.push(setTimeout(r, ms)));
    const face = (f: "neutral" | "sleepy" | "happy") => {
      for (const [k, el] of Object.entries(faces.current)) if (el) el.style.opacity = k === f ? "1" : "0";
    };
    const finish = () => {
      if (cancelled) return;
      setOut(true);
      timers.push(setTimeout(() => setGone(true), FADE_MS));
    };
    const showAll = () => {
      [...top.current, ...bottom.current].forEach((el) => el && (el.style.opacity = "1"));
      if (tag.current) tag.current.style.opacity = "1";
    };

    const start = async () => {
      if (cancelled || !wrap.current || !nubi.current) return;
      const box = wrap.current.getBoundingClientRect();
      // Landing spot on each letter: its centre, on the cap line (Inter caps start ~14% below the box)
      const pts: Pt[] = top.current.map((el) => {
        const r = el!.getBoundingClientRect();
        const fs = parseFloat(getComputedStyle(el!).fontSize);
        return { x: r.left - box.left + r.width / 2, y: r.top - box.top + fs * 0.14 };
      });
      const last = pts.length - 1;
      const place = (p: Pt, sx = 1, sy = 1) => {
        nubi.current!.style.transform = `translate(${p.x}px, ${p.y}px)`;
        stretch.current!.style.transform = `scale(${sx}, ${sy})`;
      };
      nubi.current.style.opacity = "1";

      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        showAll();
        place({ x: (pts[0].x + pts[last].x) / 2, y: pts[0].y });
        face("happy");
        while (!cancelled && !readyRef.current) await sleep(150);
        await sleep(600);
        return finish();
      }

      // A ball's flight: a parabola between two letters (or a fall), stretched by its speed
      const fly = (a: Pt, b: Pt, dur: number, h: number, fall = false) => new Promise<void>((res) => {
        const t0 = performance.now();
        const step = (now: number) => {
          if (cancelled) return;
          const t = Math.min(1, (now - t0) / dur);
          const x = a.x + (b.x - a.x) * t;
          const y = fall ? a.y + (b.y - a.y) * t * t : a.y + (b.y - a.y) * t - 4 * h * t * (1 - t);
          const speed = fall ? t : Math.abs(2 * t - 1);
          const s = 0.13 * speed;
          place({ x, y }, 1 - s * 0.7, 1 + s);
          if (t < 1) raf = requestAnimationFrame(step);
          else { place(b); res(); }
        };
        raf = requestAnimationFrame(step);
      });

      const hit = (el: HTMLElement | null | undefined, strong = 1) => {
        if (!el) return;
        el.style.opacity = "1";
        el.animate(
          [
            { transform: "none" },
            { transform: `translateY(${7 * strong}px) scale(${1 + 0.1 * strong}, ${1 - 0.2 * strong})`, offset: 0.3 },
            { transform: "translateY(-3px) scale(0.97, 1.05)", offset: 0.68 },
            { transform: "none" },
          ],
          { duration: 340, easing: "ease-out" },
        );
      };
      const land = (strong = 1) => {
        squash.current?.animate(
          [
            { transform: "none" },
            { transform: `scale(${1 + 0.36 * strong}, ${1 - 0.32 * strong})`, offset: 0.25 },
            { transform: "scale(0.92, 1.1)", offset: 0.62 },
            { transform: "none" },
          ],
          { duration: 300, easing: "ease-out" },
        );
        face("sleepy"); // eyes squeezed on impact
        timers.push(setTimeout(() => face("neutral"), 130));
      };
      const revealBottom = () => {
        bottom.current.forEach((el, i) =>
          el?.animate(
            [
              { opacity: 0, transform: "translateY(34px) scale(0.85)" },
              { opacity: 1, transform: "translateY(-6px) scale(1.04)", offset: 0.65 },
              { opacity: 1, transform: "none" },
            ],
            { duration: 460, delay: i * 60, easing: "cubic-bezier(.2,.8,.3,1)", fill: "both" },
          ),
        );
        tag.current?.animate([{ opacity: 0, transform: "translateY(10px)" }, { opacity: 1, transform: "none" }], { duration: 420, delay: 420, fill: "both" });
      };

      // Drop from above the screen onto the S
      await fly({ x: pts[0].x, y: -box.top - 140 }, pts[0], DROP_MS, 0, true);
      land(1.15);
      hit(top.current[0], 1.2);
      await sleep(60);

      let i = 0, dir = 1, revealed = false;
      const startedAt = performance.now();
      while (!cancelled) {
        const atEnd = (dir === 1 && i === last) || (dir === -1 && i === 0);
        if (atEnd) {
          if (!revealed) { revealed = true; revealBottom(); }
          // ready: finish here; if loading takes ages, finish anyway after a while so it's never stuck
          if (readyRef.current || performance.now() - startedAt > 15000) break;
          dir = -dir;
        }
        await fly(pts[i], pts[i + dir], HOP_MS, HOP_H);
        i += dir;
        land();
        hit(top.current[i]);
        await sleep(30);
      }
      if (cancelled) return;
      if (!readyRef.current) { while (!cancelled && !readyRef.current) await sleep(150); }

      // Last big hop to the middle of the word, a smile, and into the app
      const mid = { x: (pts[0].x + pts[last].x) / 2, y: pts[0].y };
      await fly(pts[i], mid, FINAL_MS, 130);
      land(0.8);
      hit(top.current[Math.floor(last / 2)], 0.6);
      hit(top.current[Math.ceil(last / 2)], 0.6);
      timers.push(setTimeout(() => face("happy"), 140));
      await sleep(HOLD_MS);
      finish();
    };

    // Measure once the big letters are in their real font
    const go = () => timers.push(setTimeout(start, 180));
    if (document.fonts?.ready) {
      let started = false;
      const once = () => { if (!started) { started = true; go(); } };
      document.fonts.ready.then(once);
      timers.push(setTimeout(once, 900));
    } else go();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
    };
  }, []);

  useEffect(() => {
    if (gone) syncThemeColor();
  }, [gone]);

  if (gone) return null;

  const letter = "inline-block origin-bottom will-change-transform";
  return (
    <div
      className="sc-splash fixed inset-0 z-[300] overflow-hidden select-none"
      data-out={out ? "" : undefined}
      style={{ background: SPLASH_ORANGE, opacity: out ? 0 : 1, transition: `opacity ${FADE_MS}ms ease`, pointerEvents: out ? "none" : "auto" }}
      role="status"
      aria-label="Cargando Syncro Credit"
    >
      {/* soft light in the orange */}
      <div aria-hidden className="absolute -top-1/4 left-1/2 -translate-x-1/2 size-[140vw] max-w-[900px] max-h-[900px] rounded-full" style={{ background: "radial-gradient(circle, rgba(255,255,255,0.20) 0%, rgba(255,255,255,0) 62%)" }} />
      <div aria-hidden className="absolute -bottom-1/3 -right-1/4 size-[90vw] rounded-full" style={{ background: "radial-gradient(circle, rgba(140,40,10,0.22) 0%, rgba(140,40,10,0) 65%)" }} />

      <div className="absolute inset-0 flex flex-col items-center justify-center px-4" style={{ transform: out ? "scale(1.05)" : "none", transition: `transform ${FADE_MS}ms ease` }}>
        <div ref={wrap} className="relative text-center" style={{ fontWeight: 800, letterSpacing: "-0.045em", lineHeight: 0.92 }}>
          <div className="text-white" style={{ fontSize: "clamp(54px, 18vw, 96px)" }}>
            {TOP.split("").map((l, i) => (
              <span key={i} ref={(el) => { top.current[i] = el; }} className={letter} style={{ opacity: 0.32 }}>{l}</span>
            ))}
          </div>
          <div className="text-[#1A1815]" style={{ fontSize: "clamp(54px, 18vw, 96px)" }}>
            {BOTTOM.split("").map((l, i) => (
              <span key={i} ref={(el) => { bottom.current[i] = el; }} className={letter} style={{ opacity: 0 }}>{l}</span>
            ))}
          </div>
          <p ref={tag} className="mt-5 text-[15px] text-white/90" style={{ opacity: 0, fontWeight: 500, letterSpacing: "0" }}>
            Compra hoy, paga después
          </p>

          {/* Nubi: anchored by the bottom centre, so it sits on the letter it lands on */}
          <div ref={nubi} className="pointer-events-none absolute left-0 top-0" style={{ opacity: 0, transform: "translate(-200px,-400px)" }}>
            <div ref={stretch} className="origin-bottom" style={{ width: 60, height: 54, marginLeft: -30, marginTop: -52 }}>
              <div ref={squash} className="relative size-full origin-bottom">
                {(["neutral", "sleepy", "happy"] as const).map((f) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={f}
                    ref={(el) => { faces.current[f] = el; }}
                    src={`/nubi/nubi-${f}.webp`}
                    alt=""
                    draggable={false}
                    className="absolute inset-0 size-full object-contain"
                    style={{ opacity: f === "neutral" ? 1 : 0, filter: "drop-shadow(0 10px 12px rgba(90,30,5,0.35))" }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
