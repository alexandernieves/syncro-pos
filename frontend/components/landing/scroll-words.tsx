"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { slice, useScrollProgress } from "./lib/use-scroll-progress";

/**
 * A headline that fills in word by word as you scroll through it — the way the
 * reference gif brings its big statements in. Words start faint and settle to
 * full contrast, each one keyed to its own slice of the scroll.
 *
 * `accentFrom` marks the word index where the accent colour takes over, so a
 * phrase can still carry the orange tail the rest of the page uses.
 */
export function ScrollWords({
  text,
  className = "",
  accentFrom,
  as: Tag = "h2",
}: {
  text: string;
  className?: string;
  accentFrom?: number;
  as?: "h1" | "h2" | "p";
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const progress = useScrollProgress(ref);
  const [still, setStill] = useState(false);

  useEffect(() => {
    setStill(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  const words = text.split(" ");
  // The whole phrase lands over the middle of its travel through the viewport.
  const span = slice(progress, 0.18, 0.62);

  return (
    <div ref={ref}>
      <Tag className={className}>
        {words.map((word, i) => {
          const start = i / words.length;
          const on = still ? 1 : slice(span, start * 0.85, start * 0.85 + 0.2);
          const accent = accentFrom !== undefined && i >= accentFrom;
          return (
            <span
              key={`${word}-${i}`}
              className="inline-block"
              style={{
                opacity: 0.12 + on * 0.88,
                color: accent ? "#F26B3A" : undefined,
                transform: `translateY(${(1 - on) * 12}px)`,
                transition: "none",
              }}
            >
              {word}
              {i < words.length - 1 ? " " : ""}
            </span>
          );
        })}
      </Tag>
    </div>
  );
}

/** Wraps children so they rise and fade with their own scroll travel. */
export function ScrollRise({
  children,
  className = "",
  from = 0.2,
  to = 0.55,
}: {
  children: ReactNode;
  className?: string;
  from?: number;
  to?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const progress = useScrollProgress(ref);
  const [still, setStill] = useState(false);

  useEffect(() => {
    setStill(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  const on = still ? 1 : slice(progress, from, to);

  return (
    <div
      ref={ref}
      className={className}
      style={{ opacity: on, transform: `translateY(${(1 - on) * 40}px)` }}
    >
      {children}
    </div>
  );
}
