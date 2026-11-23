"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeftRight,
  CalendarDays,
  House,
  Landmark,
  MessageCircle,
  PieChart,
  Receipt,
  TrendingDown,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { FinanceSection } from "@/lib/central-finance-navigation";

const tabIcons: Record<FinanceSection["tab"], LucideIcon> = {
  "Resumen": House,
  "Gastos": Receipt,
  "Presupuesto": CalendarDays,
  "Libro diario": ArrowLeftRight,
  "Estados financieros": PieChart,
  "Deudas": TrendingDown,
  "Fiscal": Landmark,
  "Nubi": MessageCircle,
};

type TabItem = {
  readonly slug: string;
  readonly title: string;
  readonly tab: FinanceSection["tab"];
};

function shortLabel(item: TabItem, personal: boolean): string {
  if (item.tab === "Resumen") return personal ? "Inicio" : "Resumen";
  if (item.tab === "Presupuesto") return "Plan";
  if (item.tab === "Libro diario") return "Diario";
  if (item.tab === "Estados financieros") return "Estados";
  return item.title;
}

export function FinanceTabBar({
  label,
  items,
  activeSlug,
  personal,
}: {
  label: string;
  items: ReadonlyArray<TabItem>;
  activeSlug: string;
  personal: boolean;
}) {
  return (
    <nav
      aria-label={label}
      className="pointer-events-none fixed inset-x-0 bottom-[max(0.75rem,calc(env(safe-area-inset-bottom)+0.35rem))] z-50 flex justify-center px-3"
    >
      <div
        className={cn(
          "pointer-events-auto flex w-full max-w-[420px] items-center justify-between gap-1 rounded-[26px] border border-zinc-900/[0.08] bg-white/90 p-1.5 backdrop-blur-xl",
          "shadow-[0_14px_34px_-10px_rgba(24,24,27,0.22),0_2px_8px_rgba(24,24,27,0.06)]",
          "dark:border-white/10 dark:bg-zinc-900/90",
        )}
      >
        {items.map(item => {
          const Icon = tabIcons[item.tab] ?? House;
          const active = activeSlug === item.slug;
          const text = shortLabel(item, personal);

          return (
            <Link
              key={item.slug}
              href={"/finanzas/" + item.slug}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex min-h-[52px] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-[20px] px-1 py-1.5 transition-transform duration-150 active:scale-95 focus-visible:outline-2 focus-visible:outline-primary",
                active
                  ? "text-[#F26B3A]"
                  : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200",
              )}
            >
              {active && (
                <motion.span
                  layoutId="finance-tabbar-pill"
                  transition={{ type: "spring", stiffness: 460, damping: 34 }}
                  className="absolute inset-0 rounded-[20px] bg-[#F26B3A]/12 dark:bg-[#F26B3A]/20"
                />
              )}
              <Icon
                className={cn("relative z-10 size-[20px] transition-transform duration-200", active && "scale-105")}
                strokeWidth={active ? 2.4 : 1.9}
                aria-hidden
              />
              <span
                className={cn(
                  "relative z-10 max-w-full truncate text-[10.5px] leading-none tracking-[-0.01em]",
                  active ? "font-bold" : "font-medium",
                )}
              >
                {text}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
