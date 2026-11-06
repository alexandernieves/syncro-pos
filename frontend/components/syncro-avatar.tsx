"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

export type AvatarPose = "idle" | "wave" | "point" | "think" | "celebrate";

/**
 * Syncro, the character of the Syncro team: a soft, inflatable-looking robot with a screen face,
 * the brand's orange in its eyes, antenna and chest badge. Drawn with volume (light from the upper
 * left, soft shadows where parts meet) so it reads like a 3D render. Static for now: poses only
 * change the arms and the face.
 *
 * Original design for Syncro (not based on any existing character).
 */
export function SyncroAvatar({ pose = "idle", size = 64, className, title = "Syncro" }: { pose?: AvatarPose; size?: number; className?: string; title?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const id = (name: string) => `syncro-${name}-${uid}`;
  const url = (name: string) => `url(#${id(name)})`;

  /** Shoulder angle per side; 0 = hanging straight down. Negative opens the arm outwards. */
  const angle = (side: "left" | "right") => {
    if (pose === "celebrate") return -150;
    if (side === "right" && pose === "wave") return -145;
    if (side === "right" && pose === "point") return -92;
    if (side === "right" && pose === "think") return -128;
    return -11;
  };

  /** One arm drawn hanging down from its shoulder at (0,0). The left one is mirrored. */
  const arm = (side: "left" | "right") => {
    const left = side === "left";
    const limb = url(left ? "limbL" : "limbR");
    const px = left ? 54 : 146;
    return (
      <g transform={`translate(${px} 114) ${left ? "scale(-1 1)" : ""} rotate(${angle(side)})`}>
        {/* Upper arm */}
        <rect x="-13" y="-10" width="26" height="52" rx="13" fill={limb} />
        {/* Elbow: soft crease */}
        <ellipse cx="0" cy="40" rx="13.5" ry="4" fill={url("crease")} />
        {/* Forearm, a little fuller than the upper arm */}
        <path d="M-14 38 C-17 52 -16.5 68 -13 80 Q0 85 13 80 C16.5 68 17 52 14 38 Q0 34 -14 38 Z" fill={limb} />
        <path d="M-9 46 C-10.5 58 -10 68 -8 75" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity={left ? 0 : 0.7} filter={url("soft")} />
        <path d="M9 46 C10.5 58 10 68 8 75" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity={left ? 0.7 : 0} filter={url("soft")} />
        {/* Wrist crease */}
        <ellipse cx="0" cy="80" rx="12.5" ry="3.2" fill={url("crease")} />
        {/* Hand: three plump fingers tucked under the palm, thumb on the inner side */}
        <g>
          <rect x="-13.5" y="88" width="9" height="21" rx="4.5" fill={limb} transform="rotate(8 -9 88)" />
          <rect x="-4.5" y="90" width="9" height="22" rx="4.5" fill={limb} />
          <rect x="4.5" y="88" width="9" height="19" rx="4.5" fill={limb} transform="rotate(-8 9 88)" />
          <rect x="-21" y="80" width="9" height="17" rx="4.5" fill={limb} transform="rotate(30 -16.5 82)" />
          <ellipse cx="0" cy="90" rx="14.5" ry="12" fill={limb} />
          <ellipse cx="0" cy="83" rx="12" ry="2.6" fill={url("crease")} opacity="0.6" />
        </g>
      </g>
    );
  };

  const happy = pose === "celebrate" || pose === "wave";

  return (
    <svg
      viewBox="0 0 200 240"
      width={size}
      height={size * 1.2}
      role="img"
      aria-label={title}
      className={cn("shrink-0 overflow-visible", className)}
    >
      <defs>
        {/* Soft white vinyl, lit from the upper left */}
        <radialGradient id={id("shell")} cx="0.36" cy="0.28" r="0.82">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="0.45" stopColor="#F7F4F0" />
          <stop offset="0.8" stopColor="#E4DED6" />
          <stop offset="1" stopColor="#CFC7BC" />
        </radialGradient>
        {/* Limbs are cylinders: bright stripe on the lit side */}
        <linearGradient id={id("limbR")} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#D6CFC5" />
          <stop offset="0.3" stopColor="#FFFFFF" />
          <stop offset="0.62" stopColor="#F1EDE7" />
          <stop offset="1" stopColor="#C9C1B5" />
        </linearGradient>
        <linearGradient id={id("limbL")} x1="1" y1="0" x2="0" y2="0">
          <stop offset="0" stopColor="#D6CFC5" />
          <stop offset="0.3" stopColor="#FFFFFF" />
          <stop offset="0.62" stopColor="#F1EDE7" />
          <stop offset="1" stopColor="#C9C1B5" />
        </linearGradient>
        <radialGradient id={id("crease")} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#A89F93" stopOpacity="0.55" />
          <stop offset="1" stopColor="#A89F93" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id("ao")} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#5C5248" stopOpacity="0.35" />
          <stop offset="1" stopColor="#5C5248" stopOpacity="0" />
        </radialGradient>
        {/* Dark glass of the screen face */}
        <radialGradient id={id("screen")} cx="0.4" cy="0.3" r="0.9">
          <stop offset="0" stopColor="#3D3631" />
          <stop offset="0.7" stopColor="#221E1B" />
          <stop offset="1" stopColor="#161311" />
        </radialGradient>
        <linearGradient id={id("bezel")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#CFC7BC" />
          <stop offset="1" stopColor="#F7F4F0" />
        </linearGradient>
        <radialGradient id={id("orange")} cx="0.38" cy="0.32" r="0.75">
          <stop offset="0" stopColor="#FFC3A3" />
          <stop offset="0.45" stopColor="#F5804F" />
          <stop offset="1" stopColor="#D2521F" />
        </radialGradient>
        <radialGradient id={id("eye")} cx="0.5" cy="0.4" r="0.6">
          <stop offset="0" stopColor="#FFD9C4" />
          <stop offset="0.5" stopColor="#FF8A57" />
          <stop offset="1" stopColor="#F26B3A" />
        </radialGradient>
        <filter id={id("soft")} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.2" />
        </filter>
        <filter id={id("blur")} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4.5" />
        </filter>
        <filter id={id("glow")} x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>

      {/* Contact shadow on the floor */}
      <ellipse cx="100" cy="229" rx="52" ry="7" fill="#3A322B" opacity="0.18" filter={url("soft")} />
      <ellipse cx="100" cy="228" rx="36" ry="3.5" fill="#3A322B" opacity="0.22" filter={url("soft")} />

      {/* Legs: short and plump, with a knee crease and rounded feet */}
      {[83, 117].map((x) => (
        <g key={x}>
          <rect x={x - 15} y="166" width="30" height="54" rx="15" fill={url(x < 100 ? "limbL" : "limbR")} />
          <ellipse cx={x} cy="197" rx="14" ry="3.4" fill={url("crease")} />
          <ellipse cx={x + (x < 100 ? -2 : 2)} cy="219" rx="18" ry="9" fill={url("shell")} />
          <path d={`M${x - 16} 221 Q${x} 229 ${x + 16} 221`} fill="none" stroke="#B9B0A4" strokeWidth="1.2" opacity="0.7" />
        </g>
      ))}

      {/* Body: a soft rounded egg, widest at the belly */}
      <ellipse cx="100" cy="181" rx="44" ry="10" fill={url("ao")} />
      <path d="M100 90 C140 90 162 118 162 150 C162 182 138 196 100 196 C62 196 38 182 38 150 C38 118 60 90 100 90 Z" fill={url("shell")} />
      {/* Belly: a fuller curve catching light lower down */}
      <ellipse cx="94" cy="160" rx="34" ry="24" fill="#fff" opacity="0.55" filter={url("blur")} />
      {/* Panel seam across the chest */}
      <path d="M50 124 Q100 136 150 124" fill="none" stroke="#C9C1B5" strokeWidth="1.1" opacity="0.8" />
      <path d="M50 125.5 Q100 137.5 150 125.5" fill="none" stroke="#fff" strokeWidth="1" opacity="0.8" />
      {/* Body highlight */}
      <ellipse cx="74" cy="112" rx="15" ry="7" fill="#fff" opacity="0.95" filter={url("soft")} transform="rotate(-25 74 112)" />

      {/* Chest badge with the S, sunk into the vinyl */}
      <circle cx="122" cy="113" r="12.5" fill="#B9B0A4" opacity="0.5" filter={url("soft")} />
      <circle cx="122" cy="112" r="11.5" fill={url("bezel")} />
      <circle cx="122" cy="112" r="9.5" fill={url("orange")} />
      <text x="122" y="116.6" textAnchor="middle" fontSize="13" fontWeight="800" fill="#fff" fontFamily="ui-sans-serif, system-ui, sans-serif">S</text>
      <ellipse cx="118.5" cy="107.5" rx="3.5" ry="1.8" fill="#fff" opacity="0.6" />

      {/* Shadow the arms cast on the sides of the body */}
      {angle("left") > -60 && <ellipse cx="54" cy="150" rx="10" ry="30" fill={url("ao")} />}
      {angle("right") > -60 && <ellipse cx="146" cy="150" rx="10" ry="30" fill={url("ao")} />}

      {arm("left")}
      {arm("right")}

      {/* Head shadow on the shoulders */}
      <ellipse cx="100" cy="95" rx="46" ry="9" fill={url("ao")} />

      {/* Antenna */}
      <rect x="97.5" y="8" width="5" height="20" rx="2.5" fill={url("limbR")} />
      <circle cx="100" cy="8" r="9" fill="#F26B3A" opacity="0.35" filter={url("glow")} />
      <circle cx="100" cy="8" r="6.5" fill={url("orange")} />
      <circle cx="98" cy="6" r="1.8" fill="#fff" opacity="0.8" />

      {/* Head: rounded helmet with ear pods */}
      {[44, 156].map((x) => (
        <g key={x}>
          <ellipse cx={x} cy="62" rx="9" ry="13" fill={url("shell")} />
          <ellipse cx={x} cy="62" rx="4" ry="6.5" fill={url("orange")} opacity="0.9" />
        </g>
      ))}
      <rect x="46" y="22" width="108" height="78" rx="38" fill={url("shell")} />
      <ellipse cx="72" cy="34" rx="18" ry="7" fill="#fff" filter={url("soft")} transform="rotate(-18 72 34)" />

      {/* Screen face: bezel, dark glass, reflection */}
      <rect x="57" y="40" width="86" height="48" rx="24" fill={url("bezel")} />
      <rect x="60" y="43" width="80" height="42" rx="21" fill={url("screen")} />
      <path d="M72 48 Q100 44 128 48 Q112 52 74 55 Z" fill="#fff" opacity="0.12" />

      {/* Eyes and mouth glow on the screen */}
      <g transform={pose === "think" ? "translate(4 -3)" : undefined}>
        {happy ? (
          <g fill="none" stroke={url("eye")} strokeWidth="4.5" strokeLinecap="round">
            <path d="M80 65 Q86 57 92 65" />
            <path d="M108 65 Q114 57 120 65" />
          </g>
        ) : (
          <g>
            <ellipse cx="86" cy="62" rx="7" ry="9" fill="#F26B3A" opacity="0.5" filter={url("glow")} />
            <ellipse cx="114" cy="62" rx="7" ry="9" fill="#F26B3A" opacity="0.5" filter={url("glow")} />
            <ellipse cx="86" cy="62" rx="5.6" ry="7.6" fill={url("eye")} />
            <ellipse cx="114" cy="62" rx="5.6" ry="7.6" fill={url("eye")} />
            <circle cx="84.2" cy="59" r="1.7" fill="#fff" opacity="0.85" />
            <circle cx="112.2" cy="59" r="1.7" fill="#fff" opacity="0.85" />
          </g>
        )}
      </g>
      {happy ? (
        <path d="M91 74 Q100 81 109 74" fill="none" stroke={url("eye")} strokeWidth="3" strokeLinecap="round" />
      ) : pose === "think" ? (
        <path d="M95 76 L106 75" fill="none" stroke={url("eye")} strokeWidth="3" strokeLinecap="round" />
      ) : (
        <path d="M93 74.5 Q100 78.5 107 74.5" fill="none" stroke={url("eye")} strokeWidth="3" strokeLinecap="round" />
      )}

      {/* Thinking dots */}
      {pose === "think" && (
        <g fill={url("orange")}>
          <circle cx="166" cy="24" r="4" />
          <circle cx="178" cy="14" r="4.5" />
          <circle cx="191" cy="4" r="5" />
        </g>
      )}
    </svg>
  );
}

/** Round badge with Syncro's face, for chat headers and message bubbles. */
export function SyncroBadge({ size = 36, online, className }: { size?: number; online?: boolean; className?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const id = (name: string) => `syncro-b-${name}-${uid}`;
  return (
    <span className={cn("relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-b from-[#FFF7F2] to-[#FBE3D6] ring-1 ring-primary/20", className)} style={{ width: size, height: size }}>
      <svg viewBox="34 0 132 108" width={size * 0.9} height={size * 0.9} aria-hidden>
        <defs>
          <radialGradient id={id("shell")} cx="0.36" cy="0.28" r="0.82">
            <stop offset="0" stopColor="#FFFFFF" />
            <stop offset="0.5" stopColor="#F5F1EC" />
            <stop offset="1" stopColor="#D3CBC0" />
          </radialGradient>
          <radialGradient id={id("screen")} cx="0.4" cy="0.3" r="0.9">
            <stop offset="0" stopColor="#3D3631" />
            <stop offset="1" stopColor="#181513" />
          </radialGradient>
        </defs>
        <rect x="97.5" y="8" width="5" height="20" rx="2.5" fill="#E2DBD2" />
        <circle cx="100" cy="8" r="6.5" fill="#F26B3A" />
        <ellipse cx="44" cy="62" rx="9" ry="13" fill={`url(#${id("shell")})`} />
        <ellipse cx="156" cy="62" rx="9" ry="13" fill={`url(#${id("shell")})`} />
        <rect x="46" y="22" width="108" height="78" rx="38" fill={`url(#${id("shell")})`} />
        <rect x="57" y="40" width="86" height="48" rx="24" fill="#E4DED6" />
        <rect x="60" y="43" width="80" height="42" rx="21" fill={`url(#${id("screen")})`} />
        <ellipse cx="86" cy="62" rx="5.6" ry="7.6" fill="#FF8A57" />
        <ellipse cx="114" cy="62" rx="5.6" ry="7.6" fill="#FF8A57" />
        <path d="M93 74.5 Q100 78.5 107 74.5" fill="none" stroke="#FF8A57" strokeWidth="3" strokeLinecap="round" />
      </svg>
      {online !== undefined && (
        <span className={cn("absolute bottom-0 right-0 size-2.5 rounded-full ring-2 ring-background", online ? "bg-emerald-500" : "bg-muted-foreground/40")} />
      )}
    </span>
  );
}
