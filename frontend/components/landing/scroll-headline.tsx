"use client";

import { useEffect, useRef, useState } from "react";

import { easeInOut, mix, slice, useScrollProgress } from "./lib/use-scroll-progress";

export type HeadingLine = {
  text: string;
  /** Which edge the line travels in from. */
  from?: "left" | "right";
  /** Paints the line on a solid accent block that wipes in behind it. */
  mark?: boolean;
};

/**
 * A headline whose lines slide in from alternating edges as you scroll, with
 * the option to sit a line on an accent block that wipes in behind it — the
 * two moves the reference gif leans on.
 *
 * Every value is read off scroll position, so scrolling back up plays it in
 * reverse instead of leaving the headline stranded.
 */
export function SlideHeading({
  lines,
  className = "",
  markColor = "#F26B3A",
  as: Tag = "h2",
}: {
  lines: HeadingLine[];
  className?: string;
  markColor?: string;
  as?: "h1" | "h2";
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const progress = useScrollProgress(ref);
  const [still, setStill] = useState(false);

  useEffect(() => {
    setStill(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  // The whole headline plays out over the middle of its travel up the screen.
  const span = slice(progress, 0.16, 0.56);

  return (
    <div ref={ref} className="overflow-hidden">
      <Tag className={className}>
        {lines.map((line, i) => {
          const start = (i / lines.length) * 0.55;
          const t = still ? 1 : easeInOut(slice(span, start, start + 0.45));
          const fromLeft = (line.from ?? (i % 2 === 0 ? "left" : "right")) === "left";
          const shift = mix(fromLeft ? -55 : 55, 0, t);
          // The block finishes filling a beat after the line has landed.
          const fill = still ? 1 : easeInOut(slice(span, start + 0.3, start + 0.62));

          return (
            <span key={`${line.text}-${i}`} className="block">
              <span
                className="inline-block"
                style={{ transform: `translateX(${shift}px)`, opacity: t }}
              >
                {line.mark ? (
                  <span className="relative inline-block px-[0.18em]">
                    <span
                      aria-hidden
                      className="absolute inset-0 origin-left rounded-[0.08em]"
                      style={{ background: markColor, transform: `scaleX(${fill})` }}
                    />
                    <span
                      className="relative"
                      style={{ color: fill > 0.55 ? "#FFFFFF" : undefined, transition: "color 180ms" }}
                    >
                      {line.text}
                    </span>
                  </span>
                ) : (
                  line.text
                )}
              </span>
            </span>
          );
        })}
      </Tag>
    </div>
  );
}

/** The small pill label that sits above a heading, on its own accent block. */
export function Eyebrow({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={`inline-block rounded-full bg-[#F26B3A] px-3.5 py-1.5 text-xs font-bold   text-white ${className}`}
    >
      {children}
    </span>
  );
}
