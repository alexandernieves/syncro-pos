"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Snow falling softly, drawn on a canvas behind the menu (never over the data). Light: about
 * 30 frames a second, it stops while the tab is hidden, and with "reduce motion" turned on in
 * the system it stays still.
 */
export function XmasSnow({ className, density = 0.00016 }: { className?: string; density?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    type Flake = { x: number; y: number; r: number; s: number; d: number; o: number };
    let w = 0;
    let h = 0;
    let flakes: Flake[] = [];
    const make = (y?: number): Flake => ({
      x: Math.random() * w,
      y: y ?? Math.random() * h,
      r: 0.7 + Math.random() * 1.9,
      s: 0.22 + Math.random() * 0.55,
      d: Math.random() * Math.PI * 2,
      o: 0.35 + Math.random() * 0.5,
    });

    const paint = () => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#ffffff";
      for (const f of flakes) {
        ctx.globalAlpha = f.o;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      flakes = Array.from({ length: Math.round(w * h * density) }, () => make());
      paint();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();
    if (still) return () => ro.disconnect();

    let raf = 0;
    let last = 0;
    const step = (t: number) => {
      raf = requestAnimationFrame(step);
      if (t - last < 33) return;
      const dt = last ? Math.min((t - last) / 16.7, 3) : 1;
      last = t;
      for (const f of flakes) {
        f.y += f.s * dt;
        f.d += 0.012 * dt;
        f.x += Math.sin(f.d) * 0.28 * dt;
        if (f.y > h + 4) Object.assign(f, make(-4));
        if (f.x < -4) f.x = w + 4;
        else if (f.x > w + 4) f.x = -4;
      }
      paint();
    };
    const onVisibility = () => {
      cancelAnimationFrame(raf);
      last = 0;
      if (!document.hidden) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [density]);

  return <canvas ref={ref} aria-hidden className={cn("pointer-events-none", className)} />;
}

/** Santa's sleigh crossing the sky now and then (a cream silhouette, at the top of the menu). */
export function XmasSleigh({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("xmas-sleigh pointer-events-none absolute", className)}>
      <svg viewBox="0 0 120 34" width="96" height="27" fill="#F6EFE2">
        {/* Reindeer: two, one ahead of the other */}
        {[0, 26].map((x) => (
          <g key={x} transform={`translate(${x} 0)`}>
            <path d="M8 18c3-3 9-4 14-2l2-5 2 1-1 5c2 1 2 3 1 4l-3 1 1 6h-2l-1-5h-6l-2 5h-2l1-6c-3-1-4-3-4-4z" />
            <path d="M22 11l-2-5M22 8l-3-1M24 10l1-5M25 7l2-1" stroke="#F6EFE2" strokeWidth="1.2" strokeLinecap="round" />
          </g>
        ))}
        {/* Reins */}
        <path d="M50 19 Q62 22 72 20" stroke="#F6EFE2" strokeWidth="0.9" fill="none" opacity="0.8" />
        {/* Sleigh with Santa */}
        <circle cx="86" cy="11" r="3.2" />
        <path d="M80 15h12l-1 6h-11z" />
        <path d="M74 20h30c4 0 6-2 6-5h2c0 4-3 8-8 8H78c-3 0-5-1-6-3z" />
        <path d="M76 26h32" stroke="#F6EFE2" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    </div>
  );
}
