"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { XmasSleigh } from "@/components/xmas/xmas-snow";

const LIGHTS: [number, number][] = [
  [72, 60], [96, 66], [64, 88], [86, 94], [108, 86],
  [56, 118], [78, 124], [100, 122], [118, 114], [70, 106], [94, 108],
];
const LIGHT_COLORS = ["#FF5A5F", "#FFD166", "#5BC8F5", "#FF9F68", "#B9F18C"];
const STARS: [number, number, number][] = [[18, 14, 1.2], [44, 30, 0.9], [150, 10, 1.1], [236, 22, 1.3], [210, 46, 0.8], [120, 26, 0.9], [252, 54, 1]];

/**
 * The Christmas corner of the menu: snowy ground, a tree with twinkling lights and a star,
 * presents, and Santa waving with his sack. It fills the free space of the menu and hides
 * itself when there is too little room.
 */
export function XmasScene({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [tall, setTall] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setTall(e.contentRect.height));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={ref} aria-hidden className={cn("pointer-events-none relative min-h-0 flex-1 overflow-hidden", className)}>
      {/* The sleigh crosses the sky of this corner now and then, where nothing is written */}
      {tall >= 84 && <XmasSleigh className="top-1" />}
      {tall >= 84 && (
        <svg className="absolute inset-x-0 bottom-0 mx-auto h-full max-h-[200px] w-full" viewBox="0 0 260 172" preserveAspectRatio="xMidYMax meet">
          <defs>
            <radialGradient id="xs-star" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FFF4C2" />
              <stop offset="100%" stopColor="#FFD166" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="xs-tree" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#3AA066" />
              <stop offset="100%" stopColor="#1B6A42" />
            </linearGradient>
          </defs>

          {/* Twinkling stars in the sky */}
          {STARS.map(([x, y, r], i) => (
            <circle key={i} className="xmas-twinkle" style={{ animationDelay: `${i * -0.6}s` }} cx={x} cy={y} r={r} fill="#FFF6D8" />
          ))}

          {/* Snowy ground: a far hill and the near one */}
          <ellipse cx="178" cy="176" rx="78" ry="42" fill="#CFE1D6" opacity="0.5" />
          <ellipse cx="130" cy="184" rx="128" ry="36" fill="#F2F7F3" />

          {/* Tree */}
          <rect x="79" y="134" width="12" height="14" rx="2" fill="#6B4226" />
          <path d="M85 74 L127 136 Q85 145 43 136 Z" fill="url(#xs-tree)" />
          <path d="M85 52 L117 104 Q85 112 53 104 Z" fill="url(#xs-tree)" />
          <path d="M85 32 L106 72 Q85 79 64 72 Z" fill="url(#xs-tree)" />
          {/* Gold garland on the tree */}
          <path d="M62 86 Q86 98 110 84" stroke="#E9C46A" strokeWidth="1.6" fill="none" />
          <path d="M52 116 Q86 132 120 112" stroke="#E9C46A" strokeWidth="1.6" fill="none" />
          {/* Ornaments */}
          <circle cx="80" cy="78" r="3.4" fill="#D93A3A" />
          <circle cx="102" cy="100" r="3.4" fill="#FFD166" />
          <circle cx="66" cy="128" r="3.6" fill="#D93A3A" />
          <circle cx="110" cy="130" r="3.4" fill="#F4F6F9" />
          {/* Lights */}
          {LIGHTS.map(([x, y], i) => (
            <circle key={i} className="xmas-light" style={{ animationDelay: `${(i % 6) * -0.35}s` }} cx={x} cy={y} r="2.1" fill={LIGHT_COLORS[i % LIGHT_COLORS.length]} />
          ))}
          {/* Star on top, with a glow */}
          <circle className="xmas-twinkle" cx="85" cy="30" r="13" fill="url(#xs-star)" />
          <path d="M85 20 L88 27.5 L96 28 L90 33 L92 41 L85 36.5 L78 41 L80 33 L74 28 L82 27.5 Z" fill="#FFD166" stroke="#F2B53A" strokeWidth="0.8" strokeLinejoin="round" />

          {/* Presents */}
          <rect x="46" y="140" width="20" height="15" rx="1.5" fill="#C8262C" />
          <rect x="54" y="140" width="4" height="15" fill="#FFD166" />
          <path d="M56 140 q-6 -7 -8 -1 q3 2 8 1 q6 -7 8 -1 q-3 2 -8 1" fill="#FFD166" />
          <rect x="98" y="143" width="17" height="12" rx="1.5" fill="#2F6FD6" />
          <rect x="105" y="143" width="3.5" height="12" fill="#F4F6F9" />
          <rect x="116" y="146" width="12" height="9" rx="1.2" fill="#2E8B57" />
          <rect x="121" y="146" width="2.6" height="9" fill="#FFD166" />

          {/* Santa */}
          <g>
            {/* Sack */}
            <path d="M146 150 q-10 -2 -8 -18 q2 -12 12 -14 q-3 -4 2 -6 q4 1 3 6 q11 4 10 17 q-1 14 -12 15 z" fill="#8C5A3C" />
            <path d="M149 118 q3 2 6 0" stroke="#5E3A26" strokeWidth="1.6" fill="none" />
            {/* Boots */}
            <rect x="172" y="146" width="15" height="8" rx="3.5" fill="#2B2422" />
            <rect x="191" y="146" width="15" height="8" rx="3.5" fill="#2B2422" />
            {/* Body */}
            <ellipse cx="189" cy="124" rx="23" ry="24" fill="#D42F2F" />
            <rect x="186" y="101" width="6.5" height="44" rx="3" fill="#FFF8EE" />
            <rect x="166.5" y="139" width="45" height="7.5" rx="3.75" fill="#FFF8EE" />
            <rect x="166.5" y="121" width="45" height="7" fill="#2B2422" />
            <rect x="184" y="119.5" width="10.5" height="10" rx="1.5" fill="none" stroke="#FFD166" strokeWidth="2" />
            {/* Arm holding the sack */}
            <path d="M171 106 Q 162 116 158 124" stroke="#D42F2F" strokeWidth="8.5" strokeLinecap="round" fill="none" />
            <circle cx="157" cy="126" r="4.6" fill="#2B2422" />
            {/* Waving arm */}
            <g className="xmas-wave" style={{ transformOrigin: "206px 106px" }}>
              <path d="M206 106 Q 216 96 220 84" stroke="#D42F2F" strokeWidth="8.5" strokeLinecap="round" fill="none" />
              <rect x="214.5" y="83" width="11" height="4.5" rx="2.2" fill="#FFF8EE" transform="rotate(-20 220 85)" />
              <circle cx="221.5" cy="78.5" r="4.8" fill="#2B2422" />
            </g>
            {/* Head */}
            <circle cx="189" cy="87" r="13" fill="#F6C9A6" />
            <circle cx="181" cy="90" r="2.6" fill="#F29B9B" opacity="0.7" />
            <circle cx="197" cy="90" r="2.6" fill="#F29B9B" opacity="0.7" />
            <circle cx="184.5" cy="84.5" r="1.5" fill="#2B1B17" />
            <circle cx="193.5" cy="84.5" r="1.5" fill="#2B1B17" />
            {/* Beard and moustache */}
            <path d="M175 90 q-1 14 8 19 q6 4 12 0 q9 -5 8 -19 q-4 6 -14 6 q-10 0 -14 -6z" fill="#FFFFFF" />
            <ellipse cx="185" cy="93" rx="5" ry="2.8" fill="#FFFFFF" />
            <ellipse cx="193" cy="93" rx="5" ry="2.8" fill="#FFFFFF" />
            <circle cx="189" cy="90.5" r="2.6" fill="#E8907A" />
            {/* Hat */}
            <path d="M176 80 Q 177 64 192 61 Q 206 59 213 70 L207 74 Q 202 68 196 70 Q 202 75 203 80 Z" fill="#D42F2F" />
            <rect x="174.5" y="76.5" width="29" height="7" rx="3.5" fill="#FFF8EE" />
            <circle cx="211" cy="72.5" r="4.6" fill="#FFF8EE" />
          </g>
        </svg>
      )}
    </div>
  );
}
