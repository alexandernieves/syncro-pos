"use client";

import { useEffect, useState } from "react";
import { IconCheck, IconChevronDown, IconPencil } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

export type Unit = { one: string; many: string } | "money" | "percent";

/** "5 días", "1 vez", "$3.00", "10 %": how a value reads with its unit. */
export function formatValue(v: number, unit: Unit, zeroLabel?: string) {
  if (v === 0 && zeroLabel) return zeroLabel;
  if (unit === "money") return `$${v.toFixed(2)}`;
  if (unit === "percent") return `${v} %`;
  return `${v} ${v === 1 ? unit.one : unit.many}`;
}

/**
 * Value picked from a short list of sensible options, with "Personalizado" for anything else
 * inside the allowed range. Replaces free number inputs where a typo (1000 days) makes no sense.
 */
export function OptionSelect({
  value,
  onChange,
  options,
  unit,
  min,
  max,
  step = 1,
  zeroLabel,
  className,
}: {
  value: number;
  onChange: (v: number) => void;
  options: number[];
  unit: Unit;
  /** Range accepted in "Personalizado". */
  min: number;
  max: number;
  /** 1 for whole numbers, 0.01 for money. */
  step?: number;
  /** Text for 0 (e.g. "Gratis", "Sin límite"). */
  zeroLabel?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(false);
  const [text, setText] = useState("");
  useEffect(() => { if (open) { setCustom(!options.includes(value)); setText(String(value)); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const money = unit === "money";
  const parsed = Number(text.replace(",", "."));
  const decimalsOk = money ? /^\d+([.,]\d{1,2})?$/.test(text.trim()) : /^\d+$/.test(text.trim());
  const valid = text.trim() !== "" && decimalsOk && parsed >= min && parsed <= max;
  const unitWord = unit === "money" ? "dólares" : unit === "percent" ? "%" : unit.many;
  const error = !text.trim() ? "" : !decimalsOk ? (money ? "Solo números, con hasta 2 decimales" : "Solo números enteros") : parsed < min || parsed > max ? `Entre ${formatValue(min, unit)} y ${formatValue(max, unit)}` : "";

  const pick = (v: number) => {
    onChange(v);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={cn("flex h-9 w-full min-w-36 items-center gap-2 rounded-md border bg-background px-3 text-left text-sm shadow-xs outline-none transition hover:bg-muted/40 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50", className)}>
          <span className="min-w-0 flex-1 truncate font-medium tabular-nums">{formatValue(value, unit, zeroLabel)}</span>
          {!options.includes(value) && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">Personalizado</span>}
          <IconChevronDown size={14} className="shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-60 p-1">
        <div className="max-h-64 overflow-y-auto">
          {options.map((o) => (
            <button key={o} type="button" onClick={() => pick(o)} className={cn("flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-sm tabular-nums hover:bg-muted", o === value && "font-semibold")}>
              {formatValue(o, unit, zeroLabel)}
              {o === value && <IconCheck size={14} className="text-emerald-600" />}
            </button>
          ))}
        </div>
        <div className="mt-1 border-t pt-1">
          {!custom ? (
            <button type="button" onClick={() => { setCustom(true); setText(options.includes(value) ? "" : String(value)); }} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-primary hover:bg-muted">
              <IconPencil size={14} /> Personalizado
            </button>
          ) : (
            <div className="space-y-2 p-2">
              <div className={cn("flex h-9 items-center overflow-hidden rounded-md border bg-background focus-within:border-ring", error && "border-destructive")}>
                {money && <span className="pl-2.5 text-sm text-muted-foreground">$</span>}
                <input
                  autoFocus
                  inputMode={money ? "decimal" : "numeric"}
                  value={text}
                  onChange={(e) => setText(e.target.value.replace(money ? /[^\d.,]/g : /\D/g, "").slice(0, 8))}
                  onKeyDown={(e) => { if (e.key === "Enter" && valid) { e.preventDefault(); pick(money ? Math.round(parsed * 100) / 100 : Math.round(parsed)); } }}
                  placeholder={money ? "0.00" : String(min)}
                  className="min-w-0 flex-1 bg-transparent px-2 text-sm tabular-nums outline-none"
                />
                <span className="pr-2.5 text-xs text-muted-foreground">{unitWord}</span>
              </div>
              <p className={cn("text-[11px]", error ? "text-destructive" : "text-muted-foreground")}>{error || `Entre ${formatValue(min, unit)} y ${formatValue(max, unit)}`}</p>
              <Button size="sm" className="w-full" disabled={!valid} onClick={() => pick(money ? Math.round(parsed * 100) / 100 : Math.round(parsed))}>Aplicar</Button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export const DAYS: Unit = { one: "día", many: "días" };
export const MINUTES: Unit = { one: "minuto", many: "minutos" };
export const TIMES: Unit = { one: "vez", many: "veces" };
