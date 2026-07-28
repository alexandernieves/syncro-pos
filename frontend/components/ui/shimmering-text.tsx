"use client"

import React, { useMemo } from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

interface ShimmeringTextProps {
  text: string
  duration?: number
  delay?: number
  repeat?: boolean
  repeatDelay?: number
  className?: string
  startOnView?: boolean
  once?: boolean
  inViewMargin?: string
  spread?: number
  color?: string
  shimmerColor?: string
}

export function ShimmeringText({
  text,
  duration = 2,
  delay = 0,
  repeat = true,
  repeatDelay = 0.5,
  className,
  spread = 2,
  color,
  shimmerColor,
}: ShimmeringTextProps) {
  const baseColor = color || "var(--foreground, #ffffff)"
  const highlightColor = shimmerColor || "var(--primary, #3b82f6)"

  const style = useMemo(() => ({
    "--base-color": baseColor,
    "--shimmer-color": highlightColor,
    backgroundImage: `linear-gradient(90deg, var(--base-color) 0%, var(--base-color) 35%, var(--shimmer-color) 50%, var(--base-color) 65%, var(--base-color) 100%)`,
    backgroundSize: `${100 * spread}% 100%`,
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
    WebkitTextFillColor: "transparent",
    color: "transparent",
    display: "inline-block",
  } as React.CSSProperties), [baseColor, highlightColor, spread])

  return (
    <motion.span
      style={style}
      className={cn("select-none font-medium", className)}
      animate={{
        backgroundPosition: ["100% 0%", "-100% 0%"],
      }}
      transition={{
        duration,
        delay,
        ease: "linear",
        repeat: repeat ? Infinity : 0,
        repeatDelay,
      }}
    >
      {text}
    </motion.span>
  )
}
