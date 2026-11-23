"use client";

import { useId, useState } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import type { OriginalMoney } from "./calculations";
import { Button } from "@/components/ui/button";

export type Quotes = Record<string, { rate: number; source: string; date?: string } | null>;
const currencies = [
  ["USD", "USD · Dólar"], ["VES", "VES · Bolívar"], ["USDT", "USDT · Tether"],
  ["EUR", "EUR · Euro"], ["COP", "COP · Peso colombiano"], ["other", "Otra moneda"],
] as const;

const currencySymbols: Record<string, string> = {
  USD: "$",
  USDT: "₮",
  VES: "Bs",
  EUR: "€",
  COP: "COL$",
  other: "¤",
};

export function FinanceSelect({ label, name, options, defaultValue, value, onChange }: {
  label: string; name?: string; options: ReadonlyArray<readonly [string, string]>;
  defaultValue?: string; value?: string; onChange?: (value: string) => void;
}) {
  const id = useId();
  return (
    <div className="min-w-36 space-y-1.5">
      <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground" htmlFor={id}>
        {label}
      </label>
      <Select name={name} defaultValue={defaultValue} value={value} required onValueChange={onChange}>
        <SelectTrigger
          id={id}
          className="w-full rounded-2xl border-input/80 bg-background px-3.5 text-base font-medium shadow-2xs transition-colors hover:border-primary/40 data-[size=default]:h-12 sm:text-sm"
        >
          <SelectValue placeholder="Seleccionar" />
        </SelectTrigger>
        <SelectContent className="z-[70] rounded-2xl p-1">
          {options.map(([key, title]) => (
            <SelectItem key={key} value={key} className="rounded-xl py-2.5 text-base sm:py-2 sm:text-sm">
              {title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function FinanceCheck({ label, name, checked, defaultChecked, onChange }: {
  label: string; name?: string; checked?: boolean; defaultChecked?: boolean; onChange?: (value: boolean) => void;
}) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className="flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border border-input/70 bg-background/70 px-3.5 text-sm font-medium transition-colors hover:border-primary/40 hover:bg-muted/40"
    >
      <Checkbox
        id={id}
        name={name}
        checked={checked}
        defaultChecked={defaultChecked}
        onCheckedChange={value => onChange?.(value === true)}
        className="size-5 rounded-md"
      />
      <span>{label}</span>
    </label>
  );
}

/**
 * Grouped Currency + Amount Input (inspired by 21st.dev Currency Amount Input Group):
 * Joins currency selector and numeric input into a single tactile mobile-first control.
 */
export function MoneyFields({ quotes, label, prefix = "", reference = true, initial, min = 0.01 }: {
  quotes: Quotes; label: string; prefix?: string; reference?: boolean; initial?: OriginalMoney; min?: number;
}) {
  const [currency, setCurrency] = useState(
    initial && currencies.some(row => row[0] === initial.currency)
      ? initial.currency
      : initial ? "other" : "USD",
  );
  const [rate, setRate] = useState(initial ? initial.rate.toFixed(8).replace(/\.?0+$/, "") : "");
  const [entered, setEntered] = useState(initial ? String(initial.nativeCents / 100) : "");
  const quote = quotes[currency];
  const amountName = prefix ? prefix + "Amount" : "amount";
  const amountId = useId();
  const isUsd = currency === "USD";
  const isUsdt = currency === "USDT";

  function handleCurrencyChange(next: string) {
    setCurrency(next);
    if (next === "USDT") {
      setRate("1");
    } else if (quotes[next]?.rate) {
      setRate(quotes[next]!.rate.toFixed(8).replace(/\.?0+$/, ""));
    } else {
      setRate("");
    }
  }

  return (
    <div className="space-y-2.5 rounded-2xl border border-input/80 bg-muted/25 p-3">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={amountId} className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </label>
        {!isUsd && Number(rate) > 0 && Number(entered) > 0 && (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-primary">
            ≈ {new Intl.NumberFormat("es-VE", { style: "currency", currency: "USD" }).format(Number(entered) / Number(rate))}
          </span>
        )}
      </div>

      {/* Unified Currency + Amount Group */}
      <div className="flex h-12 items-stretch overflow-hidden rounded-2xl border border-input bg-background shadow-2xs transition-all focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
        <div className="flex shrink-0 items-center border-r border-input/70 bg-muted/35">
          <Select
            name={prefix ? prefix + "Currency" : "currency"}
            value={currency}
            required
            onValueChange={handleCurrencyChange}
          >
            <SelectTrigger
              aria-label="Moneda"
              className="h-full min-w-[84px] rounded-none border-0 bg-transparent px-3 text-sm font-bold shadow-none focus-visible:ring-0"
            >
              <SelectValue>{currency === "other" ? "Otra" : currency}</SelectValue>
            </SelectTrigger>
            <SelectContent className="z-[70] rounded-2xl p-1">
              {currencies.map(([key, title]) => (
                <SelectItem key={key} value={key} className="rounded-xl py-2.5 text-base sm:py-2 sm:text-sm">
                  {title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="relative flex flex-1 items-center">
          <span className="pointer-events-none select-none pl-3 text-sm font-semibold text-muted-foreground">
            {currencySymbols[currency] ?? "$"}
          </span>
          <Input
            id={amountId}
            className="h-full flex-1 rounded-none border-0 bg-transparent px-2 text-lg font-bold tabular-nums shadow-none focus-visible:ring-0"
            name={amountName}
            type="number"
            inputMode="decimal"
            step="0.01"
            min={min}
            placeholder="0.00"
            required
            value={entered}
            onChange={event => setEntered(event.target.value)}
          />
        </div>
      </div>

      {currency === "other" && (
        <label className="block space-y-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <span>Código ISO (3 letras)</span>
          <Input
            className="h-11 rounded-2xl bg-background uppercase"
            name={prefix ? prefix + "CurrencyCode" : "currencyCode"}
            pattern="[A-Za-z]{3}"
            maxLength={3}
            defaultValue={initial?.currency === currency ? undefined : initial?.currency}
            placeholder="Ej. GBP"
            required
          />
        </label>
      )}

      {reference && !isUsd && (
        <div className="space-y-1.5 pt-0.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              Tasa aplicada ({currency === "other" ? "moneda" : currency} por 1 USD)
            </span>
            {quote && !isUsdt && (
              <Button
                size="sm"
                type="button"
                variant="secondary"
                className="h-7 rounded-full px-2.5 text-[11px] font-semibold"
                onClick={() => setRate(quote.rate.toFixed(8).replace(/\.?0+$/, ""))}
              >
                Usar {quote.source}{quote.date ? ` · ${quote.date}` : ""}
              </Button>
            )}
          </div>
          <Input
            className="h-11 rounded-2xl bg-background tabular-nums"
            name={prefix ? prefix + "Rate" : "rate"}
            type="number"
            min="0.00000001"
            step="0.00000001"
            inputMode="decimal"
            placeholder={isUsdt ? "1" : "Ej. 50.00"}
            required
            value={rate || (isUsdt ? "1" : "")}
            onChange={event => setRate(event.target.value)}
          />
        </div>
      )}
    </div>
  );
}
