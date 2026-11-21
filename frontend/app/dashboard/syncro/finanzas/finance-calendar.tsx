"use client";

import { useId, useRef, useState } from "react";
import { es } from "react-day-picker/locale";
import { CalendarDays } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export const calendarDate = (iso: string) => new Date(iso + "T12:00:00");
export const dateKey = (date: Date) =>
  [date.getFullYear(), date.getMonth() + 1, date.getDate()].map((value, index) => String(value).padStart(index === 0 ? 4 : 2, "0")).join("-");
export const readableDate = (iso: string) => new Intl.DateTimeFormat("es-VE", { dateStyle: "medium" }).format(calendarDate(iso));

export function FinanceDate({ label, name = "date", defaultValue, min, max }: {
  label: string; name?: string; defaultValue?: string; min?: string; max?: string;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);

  return <div>
    <label htmlFor={id} className="block">{label}</label>
    <div className="flex gap-1">
      <Input ref={input} id={id} type="date" name={name} defaultValue={defaultValue} min={min} max={max} required />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild><Button type="button" variant="outline" size="icon" aria-label={`Abrir calendario de ${label.toLowerCase()}`}><CalendarDays /></Button></PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar locale={es} mode="single" defaultMonth={input.current?.value ? calendarDate(input.current.value) : undefined}
            selected={input.current?.value ? calendarDate(input.current.value) : undefined}
            disabled={day => Boolean((min && dateKey(day) < min) || (max && dateKey(day) > max))}
            onSelect={day => {
              if (input.current && day) {
                input.current.value = dateKey(day);
                setOpen(false);
              }
            }} />
        </PopoverContent>
      </Popover>
    </div>
  </div>;
}
