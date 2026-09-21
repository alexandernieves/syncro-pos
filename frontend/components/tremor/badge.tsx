import React from "react";
import { cn } from "@/lib/utils";

export interface TremorBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "neutral" | "success" | "warning" | "error" | "brand";
  icon?: React.ComponentType<{ className?: string }>;
}

export function TremorBadge({
  children,
  className,
  variant = "default",
  icon: Icon,
  ...props
}: TremorBadgeProps) {
  const variantStyles = {
    default:
      "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30",
    neutral:
      "bg-zinc-500/10 text-zinc-700 dark:text-zinc-300 border-zinc-500/30",
    success:
      "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    warning:
      "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
    error:
      "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30",
    brand:
      "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border transition-colors",
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {Icon && <Icon className="size-3.5 shrink-0" />}
      {children}
    </span>
  );
}
