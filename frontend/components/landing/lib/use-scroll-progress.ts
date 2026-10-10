"use client";

import { useEffect, useRef, useState } from "react";

/**
 * How far an element has travelled through the viewport, 0 → 1.
 *
 * 0 = its top edge is just entering from the bottom, 1 = its bottom edge has
 * just left through the top. Read on every frame the page actually scrolls,
 * so anything driven by it tracks the scroll itself rather than a timer.
 */
export function useScrollProgress(ref: React.RefObject<HTMLElement | null>) {
  const [progress, setProgress] = useState(0);
  const frame = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof window === "undefined") return;

    const measure = () => {
      frame.current = 0;
      const rect = el.getBoundingClientRect();
      // Total distance this element travels past the viewport.
      const span = rect.height + window.innerHeight;
      const travelled = window.innerHeight - rect.top;
      const next = Math.min(1, Math.max(0, travelled / span));
      setProgress(next);
    };

    const onScroll = () => {
      if (frame.current) return;
      frame.current = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [ref]);

  return progress;
}

/** Maps a slice of 0→1 progress onto its own 0→1 range, clamped. */
export function slice(progress: number, start: number, end: number) {
  if (end <= start) return progress >= end ? 1 : 0;
  return Math.min(1, Math.max(0, (progress - start) / (end - start)));
}

/** Smooth in and out, so nothing starts or stops abruptly. */
export function easeInOut(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** Linear blend between two numbers. */
export function mix(from: number, to: number, t: number) {
  return from + (to - from) * t;
}
