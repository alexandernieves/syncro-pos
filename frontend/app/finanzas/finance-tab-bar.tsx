"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
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
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const bar = (
    <nav
      aria-label={label}
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 border-t border-zinc-900/[0.08] bg-[#FCFBF8]/95 backdrop-blur-xl",
        "pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[0_-6px_24px_-8px_rgba(24,24,27,0.08)]",
        "after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-[80px] after:bg-[#FCFBF8] after:content-['']",
        "dark:border-white/10 dark:bg-zinc-950/95 dark:after:bg-zinc-950",
      )}
    >
      <div className="mx-auto flex w-full max-w-md items-stretch justify-between px-1.5">
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
                "relative flex min-h-[58px] min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 py-2 transition-transform duration-150 active:scale-95 focus-visible:outline-2 focus-visible:outline-primary",
                active
                  ? "text-[#F26B3A]"
                  : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200",
              )}
            >
              {active && (
                <>
                  <motion.span
                    layoutId="finance-tabbar-top-line"
                    transition={{ type: "spring", stiffness: 500, damping: 36 }}
                    className="absolute inset-x-3 top-0 h-[2.5px] rounded-b-full bg-[#F26B3A]"
                  />
                  <motion.span
                    layoutId="finance-tabbar-glow"
                    transition={{ type: "spring", stiffness: 460, damping: 34 }}
                    className="pointer-events-none absolute inset-x-2 inset-y-1.5 rounded-2xl bg-[#F26B3A]/[0.09] dark:bg-[#F26B3A]/15"
                  />
                </>
              )}
              <Icon
                className={cn("relative z-10 size-[20px] transition-transform duration-200", active && "scale-105")}
                strokeWidth={active ? 2.4 : 1.85}
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

  return mounted ? createPortal(bar, document.body) : bar;
}
