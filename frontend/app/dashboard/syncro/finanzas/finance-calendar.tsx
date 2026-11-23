"use client";

import { useId, useState } from "react";
import { es } from "react-day-picker/locale";
import { CalendarDays, ChevronDown } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export const calendarDate = (iso: string) => new Date(iso + "T12:00:00");
export const dateKey = (date: Date) =>
  [date.getFullYear(), date.getMonth() + 1, date.getDate()].map((value, index) => String(value).padStart(index === 0 ? 4 : 2, "0")).join("-");
export const readableDate = (iso: string) => new Intl.DateTimeFormat("es-VE", { dateStyle: "medium" }).format(calendarDate(iso));

function caracasDateKey(offsetDays = 0) {
  const now = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Caracas", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function FinanceDate({ label, name = "date", defaultValue = "", min, max }: {
  label: string; name?: string; defaultValue?: string; min?: string; max?: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(defaultValue);

  const todayIso = caracasDateKey(0);
  const yesterdayIso = caracasDateKey(-1);
  const canPickToday = (!min || todayIso >= min) && (!max || todayIso <= max);
  const canPickYesterday = (!min || yesterdayIso >= min) && (!max || yesterdayIso <= max);

  return (
    <div className="min-w-40 space-y-1.5">
      <label htmlFor={id} className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      <input type="hidden" name={name} value={value} />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            className="h-12 w-full justify-start rounded-2xl border-input/80 bg-background px-3.5 text-base font-medium shadow-2xs hover:border-primary/40 sm:text-sm"
          >
            <CalendarDays className="size-4 text-muted-foreground" />
            <span>{value ? readableDate(value) : "Elegir fecha"}</span>
            <ChevronDown className="ml-auto size-4 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="z-[70] w-auto rounded-2xl p-2 shadow-xl">
          {(canPickToday || canPickYesterday) && (
            <div className="mb-1.5 flex gap-1.5 border-b pb-2">
              {canPickToday && (
                <Button
                  type="button"
                  size="sm"
                  variant={value === todayIso ? "default" : "secondary"}
                  className="h-8 flex-1 rounded-full text-xs"
                  onClick={() => { setValue(todayIso); setOpen(false); }}
                >
                  Hoy
                </Button>
              )}
              {canPickYesterday && (
                <Button
                  type="button"
                  size="sm"
                  variant={value === yesterdayIso ? "default" : "secondary"}
                  className="h-8 flex-1 rounded-full text-xs"
                  onClick={() => { setValue(yesterdayIso); setOpen(false); }}
                >
                  Ayer
                </Button>
              )}
            </div>
          )}
          <Calendar
            locale={es}
            mode="single"
            defaultMonth={value ? calendarDate(value) : undefined}
            selected={value ? calendarDate(value) : undefined}
            disabled={day => Boolean((min && dateKey(day) < min) || (max && dateKey(day) > max))}
            onSelect={day => {
              if (day) {
                setValue(dateKey(day));
                setOpen(false);
              }
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
