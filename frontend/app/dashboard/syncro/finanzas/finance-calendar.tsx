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

export function FinanceDate({ label, name = "date", defaultValue = "", min, max }: {
  label: string; name?: string; defaultValue?: string; min?: string; max?: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(defaultValue);

  return <div className="min-w-40 space-y-1.5">
    <label htmlFor={id} className="block text-sm font-medium">{label}</label>
    <input type="hidden" name={name} value={value} />
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button id={id} type="button" variant="outline" className="h-11 w-full justify-start rounded-xl bg-background font-normal">
          <CalendarDays className="text-muted-foreground" /> {value ? readableDate(value) : "Elegir fecha"}
          <ChevronDown className="ml-auto text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar locale={es} mode="single" defaultMonth={value ? calendarDate(value) : undefined}
          selected={value ? calendarDate(value) : undefined}
          disabled={day => Boolean((min && dateKey(day) < min) || (max && dateKey(day) > max))}
          onSelect={day => {
            if (day) {
              setValue(dateKey(day));
              setOpen(false);
            }
          }} />
      </PopoverContent>
    </Popover>
  </div>;
}
