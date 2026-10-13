"use client";

import { useEffect, useRef, useState } from "react";
import { IconCheck, IconChevronDown, IconLock, IconPencil } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

export type Choice = { value: string; label: string; hint?: string; locked?: boolean };

/**
 * Dropdown with "Personalizado" first (write your own) and then the usual options.
 * `value` is "CUSTOM" when the person wrote one; `customLabel` holds what they wrote.
 * Arrows move through the list, Enter picks.
 */
export function ChoiceSelect({
  value,
  customLabel,
  onChange,
  options,
  placeholder = "Elegir",
  customPlaceholder = "Escribe cuál",
  className,
}: {
  value: string;
  customLabel?: string;
  onChange: (value: string, customLabel?: string) => void;
  options: Choice[];
  placeholder?: string;
  customPlaceholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [writing, setWriting] = useState(false);
  const [text, setText] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    setWriting(value === "CUSTOM");
    setText(value === "CUSTOM" ? customLabel ?? "" : "");
    setActive(Math.max(0, options.findIndex((o) => o.value === value) + 1));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const current = value === "CUSTOM" ? customLabel : options.find((o) => o.value === value)?.label;
  const pick = (v: string) => { onChange(v); setOpen(false); };
  const apply = () => { const t = text.trim().replace(/\s+/g, " "); if (t.length < 2) return; onChange("CUSTOM", t.slice(0, 60)); setOpen(false); };
  // 0 = "Personalizado", 1… = the options
  const total = options.length + 1;
  const onListKey = (e: React.KeyboardEvent) => {
    if (writing) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const next = (active + (e.key === "ArrowDown" ? 1 : total - 1)) % total;
      setActive(next);
      listRef.current?.querySelectorAll<HTMLElement>("[data-choice]")[next]?.scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (active === 0) setWriting(true);
      else pick(options[active - 1].value);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={cn("flex h-10 w-full items-center gap-2 rounded-md border bg-background px-3 text-left text-sm shadow-xs outline-none transition hover:bg-muted/40 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50", className)}>
          <span className={cn("min-w-0 flex-1 truncate", !current && "text-muted-foreground")}>{current || placeholder}</span>
          {value === "CUSTOM" && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">Personalizado</span>}
          <IconChevronDown size={14} className="shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-64 p-1" onKeyDown={onListKey} onOpenAutoFocus={(e) => { e.preventDefault(); listRef.current?.focus(); }}>
        <div ref={listRef} tabIndex={-1} className="max-h-72 overflow-y-auto outline-none">
          {writing ? (
            <div className="space-y-2 p-2">
              <input
                autoFocus
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, 60))}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); apply(); } if (e.key === "Escape") { e.stopPropagation(); setWriting(false); } }}
                placeholder={customPlaceholder}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-ring"
              />
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" className="flex-1" onClick={() => setWriting(false)}>Volver</Button>
                <Button size="sm" className="flex-1" disabled={text.trim().length < 2} onClick={apply}>Usar</Button>
              </div>
            </div>
          ) : (
            <>
              <button type="button" data-choice onMouseEnter={() => setActive(0)} onClick={() => setWriting(true)} className={cn("flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-primary", active === 0 && "bg-muted")}>
                <IconPencil size={14} /> Personalizado…
              </button>
              <div className="my-1 border-t" />
              {options.map((o, i) => (
                <button key={o.value} type="button" data-choice onMouseEnter={() => setActive(i + 1)} onClick={() => pick(o.value)} className={cn("flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm", active === i + 1 && "bg-muted", o.value === value && "font-semibold")}>
                  {o.locked && <IconLock size={12} className="shrink-0 text-muted-foreground" />}
                  <span className="min-w-0 flex-1 truncate">{o.label}{o.hint && <span className="block text-[11px] font-normal text-muted-foreground">{o.hint}</span>}</span>
                  {o.value === value && <IconCheck size={14} className="shrink-0 text-emerald-600" />}
                </button>
              ))}
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
