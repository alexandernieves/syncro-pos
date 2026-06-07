"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        month_caption: "flex justify-center pt-1 relative items-center h-9",
        caption_label: "text-sm font-semibold text-foreground",
        nav: "space-x-1 flex items-center",
        button_previous: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-background hover:bg-muted text-foreground p-0 absolute left-1 top-0 z-10 rounded-lg transition-all"
        ),
        button_next: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-background hover:bg-muted text-foreground p-0 absolute right-1 top-0 z-10 rounded-lg transition-all"
        ),
        month_grid: "w-full border-collapse space-y-1",
        weekdays: "flex",
        weekday:
          "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem] uppercase tracking-wider opacity-60",
        week: "flex w-full mt-2",
        day: "h-9 w-9 text-center text-sm p-0 relative focus-within:relative focus-within:z-20",
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal relative rounded-lg aria-selected:opacity-100 hover:bg-emerald-500 hover:text-white focus:bg-emerald-500 focus:text-white transition-all duration-200"
        ),
        range_end: "range_end",
        selected:
          "[&_button]:bg-emerald-500 [&_button]:text-white [&_button]:hover:bg-emerald-600 [&_button]:focus:bg-emerald-500 [&_button]:font-semibold [&_button]:shadow-[0_0_12px_rgba(16,185,129,0.4)] bg-transparent",
        today: "[&_button]:border [&_button]:border-emerald-500/30 [&_button]:bg-emerald-500/10 [&_button]:text-emerald-500 [&_button]:dark:text-emerald-400 [&_button]:font-bold",
        outside:
          "outside text-muted-foreground/30",
        disabled: "[&_button]:text-muted-foreground/20 [&_button]:opacity-30 [&_button]:cursor-not-allowed",
        range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ ...props }) => props.orientation === "left" ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />,
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
