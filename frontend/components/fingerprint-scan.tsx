"use client";

import { cn } from "@/lib/utils";

/**
 * A fingerprint drawn with lines, like on phones: grey at rest, and its lines fill in with the app's
 * colour one after another while the fingerprint is checked. Turns red and shakes on a failure,
 * shows a check when done.
 */
const LINES = [
  "M18.9 7a8 8 0 0 1 1.1 5v1a6 6 0 0 0 .8 3",
  "M8 11a4 4 0 0 1 8 0v1a10 10 0 0 0 2 6",
  "M12 11v2a14 14 0 0 0 2.5 8",
  "M8 15a18 18 0 0 0 1.8 6",
  "M4.9 19a22 22 0 0 1 -.9 -7v-1a8 8 0 0 1 12 -6.95",
];

export type ScanState = "idle" | "scanning" | "done" | "error";

export function FingerprintScan({ state, size = 120, className }: { state: ScanState; size?: number; className?: string }) {
  const filled = state === "done" ? 1 : 0;
  return (
    <div className={cn("relative grid place-items-center", className)} style={{ width: size, height: size }}>
      <style>{`
        @keyframes fp-fill { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } }
        @keyframes fp-pulse { 0%,100% { transform: scale(1); opacity: .9; } 50% { transform: scale(1.04); opacity: 1; } }
        @keyframes fp-shake { 0%,100% { transform: translateX(0); } 20%,60% { transform: translateX(-6px); } 40%,80% { transform: translateX(6px); } }
        @keyframes fp-ring { 0% { transform: scale(.85); opacity: .5; } 100% { transform: scale(1.35); opacity: 0; } }
      `}</style>
      {state === "scanning" && (
        <span className="absolute inset-0 rounded-full border-2 border-primary/40" style={{ animation: "fp-ring 1.6s ease-out infinite" }} />
      )}
      <span
        className={cn("absolute inset-0 rounded-full transition-colors duration-500", state === "error" ? "bg-rose-500/10" : state === "done" ? "bg-primary/15" : "bg-muted")}
      />
      <svg
        viewBox="0 0 24 24"
        width={size * 0.62}
        height={size * 0.62}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.6}
        style={{ position: "relative", animation: state === "error" ? "fp-shake .45s ease-in-out" : state === "idle" ? "fp-pulse 2.4s ease-in-out infinite" : undefined }}
        aria-hidden
      >
        {/* Grey lines underneath */}
        {LINES.map((d) => (
          <path key={`g${d}`} d={d} className={state === "error" ? "stroke-rose-400" : "stroke-muted-foreground/35"} />
        ))}
        {/* The same lines filling in with the app's colour, one after another */}
        {(state === "scanning" || state === "done") &&
          LINES.map((d, i) => (
            <path
              key={`c${d}-${state}`}
              d={d}
              pathLength={1}
              className="stroke-primary"
              style={{
                strokeDasharray: 1,
                strokeDashoffset: 1 - filled,
                animation: state === "scanning" ? `fp-fill .55s ease-out ${i * 0.32}s forwards` : state === "done" ? `fp-fill .25s ease-out ${i * 0.06}s both` : undefined,
              }}
            />
          ))}
      </svg>
      {state === "done" && (
        <span className="absolute -bottom-1 -right-1 grid size-9 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg animate-in zoom-in duration-300">
          <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M5 12l5 5l10 -10" />
          </svg>
        </span>
      )}
    </div>
  );
}
