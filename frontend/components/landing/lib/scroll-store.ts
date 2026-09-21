"use client";

/**
 * Shared scroll state between the DOM sections and the WebGL scene.
 *
 * This is deliberately a plain mutable object rather than React state: the
 * scene reads it 60 times a second inside `useFrame`, and routing that through
 * React would re-render the whole tree on every scroll tick. GSAP writes here,
 * Three.js reads from here, and React only subscribes to the coarse values it
 * actually needs to paint (active section, chosen vertical).
 */

import type { Vertical } from "./pos-model";

export interface ScrollState {
  /** 0..1 across the whole page. */
  progress: number;
  /** Continuous scene index, e.g. 2.4 means 40% of the way from scene 2 to 3. */
  scene: number;
  /** Signed scroll velocity, normalised roughly to -1..1. */
  velocity: number;
  /** Pointer in normalised device coordinates, for parallax. */
  pointerX: number;
  pointerY: number;
  /** Business type currently selected in the adaptive section. */
  vertical: Vertical;
  /** Lowered on weak devices to drop reflections and particle counts. */
  quality: "high" | "medium" | "low";
  /** True once the user has scrolled past the hero. */
  engaged: boolean;
}

export const scrollState: ScrollState = {
  progress: 0,
  scene: 0,
  velocity: 0,
  pointerX: 0,
  pointerY: 0,
  vertical: "bodega",
  quality: "high",
  engaged: false,
};

type Listener = (s: ScrollState) => void;
const listeners = new Set<Listener>();

export function subscribeScroll(fn: Listener) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function emitScroll() {
  listeners.forEach((fn) => fn(scrollState));
}

/* ------------------------------------------------------------------ */
/* Math helpers                                                        */
/* ------------------------------------------------------------------ */

export const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Frame-rate independent exponential smoothing. */
export const damp = (current: number, target: number, lambda: number, dt: number) =>
  lerp(current, target, 1 - Math.exp(-lambda * dt));

export const smoothstep = (t: number) => {
  const x = clamp(t);
  return x * x * (3 - 2 * x);
};

export const easeInOutCubic = (t: number) => {
  const x = clamp(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};

/**
 * Maps a global value onto a window, returning 0 before, 0..1 inside and 1
 * after. Used to stage individual scene elements within a scroll range.
 */
export function range(value: number, start: number, end: number) {
  if (end === start) return value >= end ? 1 : 0;
  return clamp((value - start) / (end - start));
}

/** Triangular window: ramps 0→1→0 so an element fades in and back out. */
export function bump(value: number, start: number, end: number, ramp = 0.25) {
  const t = range(value, start, end);
  return smoothstep(clamp(t / ramp)) * smoothstep(clamp((1 - t) / ramp));
}

/* ------------------------------------------------------------------ */
/* Device capability                                                   */
/* ------------------------------------------------------------------ */

export function detectQuality(): ScrollState["quality"] {
  if (typeof window === "undefined") return "high";

  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (reduced) return "low";

  const coarse = window.matchMedia?.("(pointer: coarse)").matches;
  const cores = navigator.hardwareConcurrency ?? 4;
  const narrow = window.innerWidth < 900;

  if (coarse || narrow || cores <= 4) return "low";
  if (cores <= 8) return "medium";
  return "high";
}

export function hasWebGL() {
  if (typeof window === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext("webgl2") || canvas.getContext("webgl"))
    );
  } catch {
    return false;
  }
}
