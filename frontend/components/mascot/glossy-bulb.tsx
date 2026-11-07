"use client";

import { useId } from "react";

/**
 * Syncro's glossy light bulb (an idea). `lit` adds the warm glow and a gentle swing.
 * Used on the mascot's head and in the support chat.
 */
export function GlossyBulb({ size = 40, lit = true, className }: { size?: number; lit?: boolean; className?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const glass = `bulb-glass-${uid}`;
  const base = `bulb-base-${uid}`;
  const h = (size * 52) / 40;
  return (
    <span className={className} style={{ position: "relative", display: "inline-block", width: size, height: h }} aria-hidden>
      <style>{`
        @keyframes syncro-bulb { 0%,100% { transform: rotate(-8deg); } 50% { transform: rotate(8deg); } }
        @keyframes syncro-glow { 0%,100% { opacity: .55; transform: scale(1); } 50% { opacity: .9; transform: scale(1.15); } }
      `}</style>
      {lit && <span style={{ position: "absolute", inset: "0 0 25% 0", borderRadius: 9999, background: "#fcd34d", filter: "blur(8px)", animation: "syncro-glow 1.8s ease-in-out infinite" }} />}
      <svg viewBox="0 0 40 52" width={size} height={h} style={{ position: "relative", animation: lit ? "syncro-bulb 2.4s ease-in-out infinite" : undefined, transformOrigin: "50% 100%" }}>
        <defs>
          <radialGradient id={glass} cx="0.38" cy="0.32" r="0.75">
            <stop offset="0" stopColor={lit ? "#fffbe6" : "#ffffff"} />
            <stop offset="0.45" stopColor={lit ? "#ffe066" : "#eef2f6"} />
            <stop offset="1" stopColor={lit ? "#f5a623" : "#c9d2db"} />
          </radialGradient>
          <linearGradient id={base} x1="0" x2="1">
            <stop offset="0" stopColor="#9aa3ad" />
            <stop offset="0.45" stopColor="#f4f6f8" />
            <stop offset="1" stopColor="#8b939c" />
          </linearGradient>
        </defs>
        <path d="M20 2 C31 2 37 10 37 18 C37 25 32 28 29 33 L11 33 C8 28 3 25 3 18 C3 10 9 2 20 2 Z" fill={`url(#${glass})`} />
        <path d="M15 33 L15 22 Q20 17 25 22 L25 33" fill="none" stroke={lit ? "#f08c00" : "#9aa3ad"} strokeWidth="1.4" opacity=".7" />
        <ellipse cx="13" cy="11" rx="5" ry="3" fill="#fff" opacity=".85" transform="rotate(-30 13 11)" />
        <rect x="11" y="33" width="18" height="11" rx="2.5" fill={`url(#${base})`} />
        <path d="M11 37 H29 M11 40.5 H29" stroke="#7d858e" strokeWidth="1" opacity=".7" />
        <path d="M15 44 H25 L23 48 H17 Z" fill="#6b737c" />
      </svg>
    </span>
  );
}
