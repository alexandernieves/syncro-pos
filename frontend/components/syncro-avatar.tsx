"use client";

import { cn } from "@/lib/utils";

export type AvatarPose = "idle" | "wave" | "point" | "think" | "celebrate";

/**
 * Syncro, the character of the Syncro team: a soft round robot with a screen face, the brand's
 * orange in its eyes, antenna and chest badge. It blinks; some poses move an arm.
 *
 * Original design for Syncro (not based on any existing character).
 */
export function SyncroAvatar({ pose = "idle", size = 64, className, title = "Syncro" }: { pose?: AvatarPose; size?: number; className?: string; title?: string }) {
  const arm = (side: "left" | "right") => {
    // Shoulder pivots, on the sides of the body
    const px = side === "left" ? 33 : 87;
    const py = 78;
    let angle = side === "left" ? 22 : -22;
    let wave = false;
    if (pose === "wave" && side === "right") { angle = -150; wave = true; }
    if (pose === "point" && side === "right") angle = -100;
    if (pose === "celebrate") angle = side === "left" ? 155 : -155;
    if (pose === "think" && side === "right") angle = -135;
    return (
      <g transform={`rotate(${angle} ${px} ${py})`}>
        {wave && <animateTransform attributeName="transform" type="rotate" values={`-150 ${px} ${py};-118 ${px} ${py};-150 ${px} ${py}`} dur="1.1s" repeatCount="indefinite" />}
        <rect x={px - 6} y={py - 3} width="12" height="30" rx="6" fill="url(#syncro-shell)" stroke="#D8D2C9" strokeWidth="1.2" />
        <circle cx={px} cy={py + 27} r="5.5" fill="#F4F1EC" stroke="#D8D2C9" strokeWidth="1.2" />
      </g>
    );
  };

  return (
    <svg
      viewBox="0 0 120 140"
      width={size}
      height={(size * 140) / 120}
      role="img"
      aria-label={title}
      className={cn("shrink-0 overflow-visible", className)}
    >
      <style>{`
        @keyframes syncro-blink { 0%, 92%, 100% { transform: scaleY(1); } 95% { transform: scaleY(0.1); } }
        @keyframes syncro-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-2px); } }
        @keyframes syncro-dot { 0%, 100% { opacity: .25; } 50% { opacity: 1; } }
        .syncro-eye { transform-box: fill-box; transform-origin: center; animation: syncro-blink 4.5s infinite; }
        .syncro-body { animation: syncro-float 3.2s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .syncro-eye, .syncro-body { animation: none; } }
      `}</style>
      <defs>
        <linearGradient id="syncro-shell" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#ECE7E0" />
        </linearGradient>
        <radialGradient id="syncro-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#FFB48F" />
          <stop offset="1" stopColor="#F26B3A" />
        </radialGradient>
      </defs>

      {/* Shadow on the floor */}
      <ellipse cx="60" cy="133" rx="28" ry="4.5" fill="#000" opacity="0.08" />

      <g className="syncro-body">
        {/* Arms behind the body */}
        {arm("left")}
        {arm("right")}

        {/* Feet */}
        <ellipse cx="47" cy="126" rx="10" ry="6" fill="#F4F1EC" stroke="#D8D2C9" strokeWidth="1.2" />
        <ellipse cx="73" cy="126" rx="10" ry="6" fill="#F4F1EC" stroke="#D8D2C9" strokeWidth="1.2" />

        {/* Body */}
        <rect x="30" y="64" width="60" height="62" rx="28" fill="url(#syncro-shell)" stroke="#D8D2C9" strokeWidth="1.4" />
        {/* Chest badge with the S */}
        <circle cx="60" cy="94" r="11" fill="#F26B3A" />
        <text x="60" y="99" textAnchor="middle" fontSize="14" fontWeight="800" fill="#fff" fontFamily="ui-sans-serif, system-ui, sans-serif">S</text>

        {/* Antenna */}
        <line x1="60" y1="16" x2="60" y2="6" stroke="#CFC8BE" strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="60" cy="5" r="4" fill="url(#syncro-glow)" />

        {/* Head */}
        <rect x="20" y="15" width="80" height="54" rx="26" fill="url(#syncro-shell)" stroke="#D8D2C9" strokeWidth="1.4" />
        {/* Side lights */}
        <circle cx="20" cy="42" r="5" fill="#F4F1EC" stroke="#D8D2C9" strokeWidth="1.2" />
        <circle cx="100" cy="42" r="5" fill="#F4F1EC" stroke="#D8D2C9" strokeWidth="1.2" />

        {/* Screen face */}
        <rect x="31" y="26" width="58" height="32" rx="16" fill="#2B2724" />
        <g transform={pose === "think" ? "translate(3 -3)" : undefined}>
          <ellipse className="syncro-eye" cx="50" cy="41" rx="4.6" ry="6" fill="#F26B3A" />
          <ellipse className="syncro-eye" cx="70" cy="41" rx="4.6" ry="6" fill="#F26B3A" />
        </g>
        {pose === "celebrate" || pose === "wave" ? (
          <path d="M53 50 Q60 55.5 67 50" fill="none" stroke="#F26B3A" strokeWidth="2.2" strokeLinecap="round" />
        ) : pose === "think" ? (
          <path d="M55 51.5 L65 51.5" fill="none" stroke="#F26B3A" strokeWidth="2.2" strokeLinecap="round" />
        ) : (
          <path d="M54.5 50.5 Q60 53.5 65.5 50.5" fill="none" stroke="#F26B3A" strokeWidth="2.2" strokeLinecap="round" />
        )}
      </g>

      {/* Thinking dots */}
      {pose === "think" && (
        <g fill="#F26B3A">
          <circle cx="104" cy="14" r="2.6" style={{ animation: "syncro-dot 1.2s infinite" }} />
          <circle cx="111" cy="8" r="2.6" style={{ animation: "syncro-dot 1.2s .2s infinite" }} />
          <circle cx="118" cy="2" r="2.6" style={{ animation: "syncro-dot 1.2s .4s infinite" }} />
        </g>
      )}
    </svg>
  );
}

/** Round badge with Syncro's face, for chat headers and message bubbles. */
export function SyncroBadge({ size = 36, online, className }: { size?: number; online?: boolean; className?: string }) {
  return (
    <span className={cn("relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-b from-[#FFF7F2] to-[#FBE3D6] ring-1 ring-primary/20", className)} style={{ width: size, height: size }}>
      <svg viewBox="16 6 88 70" width={size * 0.86} height={size * 0.86} aria-hidden>
        <line x1="60" y1="16" x2="60" y2="8" stroke="#CFC8BE" strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="60" cy="7" r="4" fill="#F26B3A" />
        <rect x="20" y="15" width="80" height="54" rx="26" fill="#fff" stroke="#D8D2C9" strokeWidth="1.6" />
        <rect x="31" y="26" width="58" height="32" rx="16" fill="#2B2724" />
        <ellipse cx="50" cy="41" rx="4.6" ry="6" fill="#F26B3A" />
        <ellipse cx="70" cy="41" rx="4.6" ry="6" fill="#F26B3A" />
        <path d="M54.5 50.5 Q60 53.5 65.5 50.5" fill="none" stroke="#F26B3A" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
      {online !== undefined && (
        <span className={cn("absolute bottom-0 right-0 size-2.5 rounded-full ring-2 ring-background", online ? "bg-emerald-500" : "bg-muted-foreground/40")} />
      )}
    </span>
  );
}
