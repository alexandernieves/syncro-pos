"use client";

/**
 * Layout and reveal primitives.
 *
 * Reveals use framer-motion's viewport trigger, which is built on
 * IntersectionObserver and therefore measures real rects. That matters here:
 * the page scrolls with an eased transform, so anything keyed to
 * `window.scrollY` would fire at the wrong moment.
 */

import { motion, type Variants } from "framer-motion";
import type { ReactNode } from "react";

const EASE = [0.22, 1, 0.36, 1] as const;

export const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } },
};

export const riseIn: Variants = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { duration: 0.65, ease: EASE } },
};

export function Reveal({
  children,
  className,
  amount = 0.3,
}: {
  children: ReactNode;
  className?: string;
  amount?: number;
}) {
  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function Item({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div variants={riseIn} className={className}>
      {children}
    </motion.div>
  );
}

/**
 * One narrative beat. `scene` ties the block to its camera keyframe; the
 * scroll engine reads these in order.
 */
export function Section({
  id,
  scene,
  children,
  className = "",
  tone = "paper",
  center = false,
}: {
  id: string;
  scene: number;
  children: ReactNode;
  className?: string;
  tone?: "paper" | "deep" | "none";
  center?: boolean;
}) {
  const bg =
    tone === "deep" ? "bg-[#EBE6DC]" : tone === "paper" ? "bg-[#F4F1EA]" : "";
  return (
    <section
      id={id}
      data-scene={scene}
      className={`relative flex min-h-[100svh] w-full ${
        center ? "items-center justify-center" : "items-center"
      } ${bg} ${className}`}
    >
      <div className="mx-auto w-full max-w-[1240px] px-5 sm:px-8">{children}</div>
    </section>
  );
}

/** Small caps label with a rule, used to open every section. */
export function Eyebrow({
  children,
  tone = "green",
}: {
  children: ReactNode;
  tone?: "green" | "clay" | "muted";
}) {
  const color =
    tone === "clay"
      ? "text-[#B33C2A]"
      : tone === "muted"
        ? "text-[#8C8577]"
        : "text-[#0E7A46]";
  return (
    <span
      className={`inline-flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.22em] ${color}`}
    >
      <span className="h-px w-7 bg-current" />
      {children}
    </span>
  );
}

export function H2({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h2
      className={`text-[clamp(1.8rem,4vw,2.9rem)] font-extrabold leading-[1.06] tracking-[-0.025em] text-[#16140F] ${className}`}
    >
      {children}
    </h2>
  );
}

export function Lead({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p className={`text-[15px] leading-relaxed text-[#5A5449] ${className}`}>
      {children}
    </p>
  );
}

/**
 * Softens the paper behind a text column where the 3D stage sits on the same
 * pixels. Solid paper at the copy edge, fully clear well before the middle, so
 * the rig is never veiled.
 */
export function Scrim({ from = "left" }: { from?: "left" | "right" }) {
  const dir = from === "left" ? "to right" : "to left";
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10"
      style={{
        background: `linear-gradient(${dir}, #F4F1EA 0%, rgba(244,241,234,0.95) 26%, rgba(244,241,234,0.55) 40%, rgba(244,241,234,0) 54%)`,
      }}
    />
  );
}

/** Flat bordered card. No shadow stacks, no gradient fills. */
export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-[#DED8CB] bg-white p-5 ${className}`}
    >
      {children}
    </div>
  );
}
