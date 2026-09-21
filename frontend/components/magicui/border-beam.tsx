"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface BorderBeamProps {
  className?: string;
  size?: number;
  duration?: number;
  borderWidth?: number;
  colorFrom?: string;
  colorTo?: string;
}

export function BorderBeam({
  className,
  duration = 6,
  borderWidth = 2,
  colorFrom = "#2563eb",
  colorTo = "#06b6d4",
}: BorderBeamProps) {
  const gradId = React.useId();

  return (
    <svg
      className={cn("pointer-events-none absolute inset-0 size-full rounded-[inherit]", className)}
      style={{ overflow: "visible" }}
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={colorFrom} stopOpacity="0" />
          <stop offset="50%" stopColor={colorTo} stopOpacity="1" />
          <stop offset="100%" stopColor={colorFrom} stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect
        width="100%"
        height="100%"
        rx="14"
        fill="none"
        stroke={`url(#${gradId})`}
        strokeWidth={borderWidth}
        strokeDasharray="160 500"
      >
        <animate
          attributeName="stroke-dashoffset"
          values="0; -660"
          dur={`${duration}s`}
          repeatCount="indefinite"
        />
      </rect>
    </svg>
  );
}
