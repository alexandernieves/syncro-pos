"use client";

import dynamic from "next/dynamic";
import { useEffect, useId, useState } from "react";
import { cn } from "@/lib/utils";
import type { MascotEmotion, MascotPose } from "@/components/mascot/syncro-mascot-3d";

export type AvatarPose = MascotPose;
export type AvatarEmotion = MascotEmotion;

// three.js is heavy: load it only in the browser and only where the mascot shows up
const SyncroMascot3D = dynamic(() => import("@/components/mascot/syncro-mascot-3d").then((m) => m.SyncroMascot3D), { ssr: false, loading: () => null });

let webglSupport: boolean | null = null;
function hasWebGL() {
  if (webglSupport !== null) return webglSupport;
  try {
    const c = document.createElement("canvas");
    webglSupport = !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    webglSupport = false;
  }
  return webglSupport;
}

/**
 * Syncro, the mascot of the Syncro team: a glazed-white head with two black bead eyes, in 3D.
 * It floats, blinks, follows the cursor and shows emotions with its eyes and a soft tint.
 * Without WebGL it falls back to a flat face. Original design for Syncro.
 */
export function SyncroAvatar({
  pose = "idle",
  size = 64,
  emotion,
  festive,
  className,
  title = "Syncro",
}: {
  pose?: AvatarPose;
  size?: number;
  /** Fixed feeling; without it Syncro reacts on its own (hover, clicks, idle). */
  emotion?: AvatarEmotion;
  /** Santa hat and beard */
  festive?: boolean;
  className?: string;
  title?: string;
}) {
  const [webgl, setWebgl] = useState<boolean | null>(null);
  useEffect(() => setWebgl(hasWebGL()), []);

  return (
    <div role="img" aria-label={title} className={cn("relative shrink-0", className)} style={{ width: size, height: size }}>
      {webgl ? (
        <SyncroMascot3D pose={pose} emotion={emotion} festive={festive} />
      ) : webgl === false ? (
        <SyncroFace className="absolute inset-x-0 bottom-0 m-auto" size={size} />
      ) : null}
      {pose === "think" && (
        <span className="pointer-events-none absolute -right-1 top-0 flex items-end gap-0.5" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span key={i} className="animate-pulse rounded-full bg-primary/70" style={{ width: 3 + i * 1.5, height: 3 + i * 1.5, animationDelay: `${i * 0.2}s` }} />
          ))}
        </span>
      )}
    </div>
  );
}

/** Syncro's face drawn flat (glazed white with two black beads). Cheap: used for small badges. */
export function SyncroFace({ size = 36, className }: { size?: number; className?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const skin = `syncro-skin-${uid}`;
  const bead = `syncro-bead-${uid}`;
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} aria-hidden>
      <defs>
        <radialGradient id={skin} cx="0.38" cy="0.3" r="0.78">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="0.55" stopColor="#EEF1F4" />
          <stop offset="1" stopColor="#BFC6CE" />
        </radialGradient>
        <radialGradient id={bead} cx="0.35" cy="0.3" r="0.75">
          <stop offset="0" stopColor="#4A4A50" />
          <stop offset="0.45" stopColor="#0B0B0D" />
          <stop offset="1" stopColor="#000" />
        </radialGradient>
      </defs>
      <path d="M50 10 C76 10 94 28 94 54 C94 78 74 92 50 92 C26 92 6 78 6 54 C6 28 24 10 50 10 Z" fill={`url(#${skin})`} />
      <ellipse cx="31" cy="26" rx="13" ry="5.5" fill="#fff" opacity="0.95" transform="rotate(-24 31 26)" />
      <ellipse cx="34" cy="48" rx="7.2" ry="8.6" fill={`url(#${bead})`} />
      <ellipse cx="66" cy="48" rx="7.2" ry="8.6" fill={`url(#${bead})`} />
      <circle cx="31.6" cy="44.6" r="2" fill="#fff" opacity="0.85" />
      <circle cx="63.6" cy="44.6" r="2" fill="#fff" opacity="0.85" />
    </svg>
  );
}

/** Round badge with Syncro's face, for chat headers and message bubbles. */
export function SyncroBadge({ size = 36, online, className }: { size?: number; online?: boolean; className?: string }) {
  return (
    <span className={cn("relative inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-[#F3F5F7] to-[#DDE2E7] ring-1 ring-black/5", className)} style={{ width: size, height: size }}>
      <SyncroFace size={size * 0.86} />
      {online !== undefined && (
        <span className={cn("absolute bottom-0 right-0 size-2.5 rounded-full ring-2 ring-background", online ? "bg-emerald-500" : "bg-muted-foreground/40")} />
      )}
    </span>
  );
}
