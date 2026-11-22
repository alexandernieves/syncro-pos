"use client";

import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function NubiTabBar({ label, children, raised = true }: {
  label: string;
  children: ReactNode;
  raised?: boolean;
}) {
  const filterId = "nubi-tabs-" + useId().replace(/[^a-zA-Z0-9_-]/g, "");

  return <nav aria-label={label} className="fixed inset-x-6 bottom-[max(1.5rem,calc(env(safe-area-inset-bottom)+0.5rem))] z-50 mx-auto h-16 max-w-sm drop-shadow-[0_8px_20px_rgba(139,92,26,0.12)] motion-safe:animate-in motion-safe:slide-in-from-bottom motion-safe:duration-300">
    {raised && <svg aria-hidden="true" className="absolute size-0">
      <defs>
        <filter id={filterId}>
          <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur" />
          <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -9" result="goo" />
          <feComposite in="SourceGraphic" in2="goo" operator="atop" />
        </filter>
      </defs>
    </svg>}
    <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={raised ? { filter: `url(#${filterId})` } : undefined}>
      <div className="absolute inset-0 rounded-full bg-white" />
      {raised && <div className="absolute -top-[30px] left-1/2 size-[84px] -translate-x-1/2 rounded-full bg-white" />}
    </div>
    <div className="absolute inset-0 flex items-center justify-around px-3 sm:px-4">{children}</div>
  </nav>;
}

export function nubiTabClass(active: boolean) {
  return cn(
    "flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-full px-0.5 text-center text-[9px] font-bold leading-tight transition-colors duration-300 focus-visible:outline-2 focus-visible:outline-primary",
    active ? "font-extrabold text-amber-500" : "text-zinc-500 hover:text-zinc-700",
  );
}

export const nubiCenterSlotClass = "relative flex h-full w-[84px] shrink-0 items-center justify-center";

export function nubiCenterTabClass(active: boolean) {
  return cn(
    "absolute -top-[34px] z-10 flex size-[72px] flex-col items-center justify-center rounded-full shadow-md transition-all duration-300 active:scale-95 focus-visible:outline-2 focus-visible:outline-primary",
    active ? "scale-105 border-none bg-amber-400 text-white shadow-amber-400/35"
      : "border border-amber-200 bg-amber-50 text-amber-700 shadow-zinc-200 hover:bg-amber-100/40",
  );
}
