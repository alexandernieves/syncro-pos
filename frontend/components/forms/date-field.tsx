"use client";

import { useMemo, useState } from "react";
import { DayPicker } from "react-day-picker";
import { es } from "react-day-picker/locale";
import { IconCalendarEvent, IconChevronDown, IconChevronLeft, IconChevronRight, IconX } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/** "AAAA-MM-DD" ↔ local Date (never UTC midnight, which lands on the day before in America). */
export const parseDay = (v?: string | null) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v || "");
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : undefined;
};
export const toDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };

export type DatePreset = { label: string; days: number };
export const FUTURE_PRESETS: DatePreset[] = [
  { label: "Hoy", days: 0 },
  { label: "Mañana", days: 1 },
  { label: "En 3 días", days: 3 },
  { label: "En una semana", days: 7 },
];

/**
 * Date picker in the platform's style: a button with the date in words and a calendar
 * in Spanish. `value` and `onChange` use "AAAA-MM-DD" ("" when empty).
 */
export function DateField({
  value,
  onChange,
  min,
  max,
  placeholder = "Elegir fecha",
  presets,
  yearPicker,
  clearable,
  openAt,
  size = "default",
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  placeholder?: string;
  /** Quick choices next to the calendar (relative to today). */
  presets?: DatePreset[];
  /** Month and year dropdowns, for dates far away (birthdays, purchase dates). */
  yearPicker?: { from: number; to: number };
  clearable?: boolean;
  /** Month the calendar opens on when there's no date yet ("AAAA-MM-DD"). */
  openAt?: string;
  size?: "default" | "sm";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = parseDay(value);
  const minDate = parseDay(min);
  const maxDate = parseDay(max);
  const [month, setMonth] = useState<Date>(selected ?? parseDay(openAt) ?? minDate ?? new Date());

  const label = selected
    ? selected.toLocaleDateString("es-VE", { weekday: size === "sm" ? undefined : "short", day: "numeric", month: "short", year: "numeric" }).replace(/\./g, "")
    : placeholder;
  const disabled = useMemo(() => [...(minDate ? [{ before: minDate }] : []), ...(maxDate ? [{ after: maxDate }] : [])], [min, max]); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (d?: Date) => {
    if (!d) return;
    onChange(toDay(d));
    setOpen(false);
  };
  const presetOk = (p: DatePreset) => {
    const d = addDays(startOfToday(), p.days);
    return (!minDate || d >= minDate) && (!maxDate || d <= maxDate);
  };

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) setMonth(selected ?? parseDay(openAt) ?? minDate ?? new Date()); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex w-full items-center gap-2 rounded-md border bg-background text-left shadow-xs outline-none transition hover:bg-muted/40 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
            size === "sm" ? "h-7 rounded-full px-2.5 text-xs" : "h-9 px-3 text-sm",
            className,
          )}
        >
          <IconCalendarEvent size={size === "sm" ? 13 : 16} className="shrink-0 text-muted-foreground" />
          <span className={cn("min-w-0 flex-1 truncate first-letter:uppercase", !selected && "text-muted-foreground")}>{label}</span>
          {clearable && selected ? (
            <span role="button" tabIndex={-1} onClick={(e) => { e.stopPropagation(); onChange(""); }} className="rounded p-0.5 text-muted-foreground hover:text-foreground" title="Borrar fecha">
              <IconX size={14} />
            </span>
          ) : (
            <IconChevronDown size={14} className="shrink-0 text-muted-foreground" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <div className="flex">
          {!!presets?.length && (
            <div className="flex w-36 flex-col gap-1 border-r p-2">
              {presets.filter(presetOk).map((p) => {
                const d = addDays(startOfToday(), p.days);
                const active = selected && toDay(selected) === toDay(d);
                return (
                  <button key={p.label} type="button" onClick={() => pick(d)} className={cn("rounded-md px-2.5 py-1.5 text-left text-sm transition", active ? "bg-primary/10 font-semibold text-primary" : "hover:bg-muted")}>
                    {p.label}
                    <span className="block text-[11px] font-normal text-muted-foreground">{d.toLocaleDateString("es-VE", { weekday: "short", day: "numeric", month: "short" }).replace(/\./g, "")}</span>
                  </button>
                );
              })}
            </div>
          )}
          <DayPicker
            mode="single"
            locale={es}
            weekStartsOn={1}
            selected={selected}
            onSelect={pick}
            month={month}
            onMonthChange={setMonth}
            disabled={disabled}
            showOutsideDays
            fixedWeeks
            captionLayout={yearPicker ? "dropdown" : "label"}
            startMonth={yearPicker ? new Date(yearPicker.from, 0) : undefined}
            endMonth={yearPicker ? new Date(yearPicker.to, 11) : undefined}
            className="p-3"
            classNames={{
              months: "relative",
              month: "space-y-3",
              month_caption: "flex h-8 items-center justify-center px-9",
              caption_label: "flex items-center text-sm font-semibold first-letter:uppercase",
              dropdowns: "flex items-center gap-1.5",
              dropdown_root: "relative rounded-md border bg-background px-2 py-1 text-sm font-medium has-focus:border-ring",
              dropdown: "absolute inset-0 cursor-pointer opacity-0",
              nav: "absolute inset-x-0 top-0 flex h-8 items-center justify-between",
              button_previous: "flex size-8 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-30",
              button_next: "flex size-8 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-30",
              month_grid: "border-collapse",
              weekdays: "flex",
              weekday: "w-9 text-center text-[11px] font-medium text-muted-foreground",
              week: "mt-1 flex",
              day: "size-9 p-0 text-center text-sm",
              day_button: "size-9 rounded-lg transition hover:bg-muted disabled:pointer-events-none",
              selected: "[&>button]:bg-primary [&>button]:font-semibold [&>button]:text-primary-foreground [&>button]:hover:bg-primary",
              today: "[&>button]:font-bold [&>button]:text-primary",
              outside: "text-muted-foreground/40",
              disabled: "text-muted-foreground/30",
            }}
            components={{
              Chevron: ({ orientation }) => (orientation === "left" ? <IconChevronLeft size={16} /> : orientation === "right" ? <IconChevronRight size={16} /> : <IconChevronDown size={12} className="ml-1 inline" />),
            }}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
