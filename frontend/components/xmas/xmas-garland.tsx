"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/** Bauble colours: [light, dark] of a glossy gradient. */
const BAUBLES: [string, string][] = [
  ["#F25C5C", "#A11D22"], // red
  ["#FFD978", "#C08A22"], // gold
  ["#4DBB80", "#1B6B43"], // green
  ["#F4F6F9", "#A9B2BF"], // silver
];
const THREADS = [5, 10, 7, 12, 6, 9, 11, 8];
const SIZES = [15, 13, 16, 14, 13, 15];

/**
 * A garland across the empty part of the top bar, with baubles hanging and swinging a little.
 * It only takes the free space between the menu button and the controls on the right.
 */
export function XmasGarland({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const count = width < 120 ? 0 : Math.min(18, Math.max(3, Math.floor(width / 46)));
  const sag = 9;
  const yAt = (t: number) => 3 + sag * 4 * t * (1 - t);

  return (
    <div ref={ref} aria-hidden className={cn("pointer-events-none relative h-full min-w-0 overflow-hidden", className)}>
      {count > 0 && (
        <>
          <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${width} 48`} preserveAspectRatio="none">
            <path
              d={`M0 3 Q ${width / 2} ${3 + sag * 2} ${width} 3`}
              stroke="#2E7A4E"
              strokeWidth="2.2"
              fill="none"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d={`M0 4 Q ${width / 2} ${4 + sag * 2} ${width} 4`}
              stroke="#E8C25A"
              strokeWidth="1"
              strokeDasharray="2 5"
              fill="none"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          {Array.from({ length: count }, (_, i) => {
            const t = (i + 0.5) / count;
            const [light, dark] = BAUBLES[i % BAUBLES.length];
            const thread = THREADS[i % THREADS.length];
            const size = SIZES[i % SIZES.length];
            const id = `xb-${i}`;
            return (
              <div
                key={i}
                className="xmas-bauble absolute"
                style={{ left: `calc(${t * 100}% - ${size / 2}px)`, top: yAt(t), animationDelay: `${(i % 5) * -0.7}s`, animationDuration: `${3.2 + (i % 4) * 0.45}s` }}
              >
                <svg width={size} height={thread + size + 3} viewBox={`0 0 ${size} ${thread + size + 3}`}>
                  <defs>
                    <radialGradient id={id} cx="35%" cy="30%" r="75%">
                      <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
                      <stop offset="18%" stopColor={light} />
                      <stop offset="100%" stopColor={dark} />
                    </radialGradient>
                  </defs>
                  <line x1={size / 2} y1="0" x2={size / 2} y2={thread} stroke="#8E7A55" strokeWidth="0.8" />
                  <rect x={size / 2 - 2.5} y={thread} width="5" height="3.2" rx="0.8" fill="#C9A24A" />
                  <circle cx={size / 2} cy={thread + 3 + size / 2 - 0.5} r={size / 2 - 0.5} fill={`url(#${id})`} />
                </svg>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
