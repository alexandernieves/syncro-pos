"use client";

import { useId, useState } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import type { OriginalMoney } from "./calculations";
import { Button } from "@/components/ui/button";

export type Quotes = Record<string, { rate: number; source: string; date?: string } | null>;
const currencies = [
  ["USD", "USD · Dólar"], ["VES", "VES · Bolívar"], ["COP", "COP · Peso colombiano"],
  ["EUR", "EUR · Euro"], ["USDT", "USDT · Tether"], ["other", "Otra moneda"],
] as const;

export function FinanceSelect({ label, name, options, defaultValue, value, onChange }: {
  label: string; name?: string; options: ReadonlyArray<readonly [string, string]>;
  defaultValue?: string; value?: string; onChange?: (value: string) => void;
}) {
  const id = useId();
  return <div className="min-w-36 space-y-1.5">
    <label className="block text-sm font-medium" htmlFor={id}>{label}</label>
    <Select name={name} defaultValue={defaultValue} value={value} required onValueChange={onChange}>
      <SelectTrigger id={id} className="w-full rounded-xl bg-background data-[size=default]:h-11"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
      <SelectContent className="z-[70]">{options.map(([key, title]) => <SelectItem key={key} value={key}>{title}</SelectItem>)}</SelectContent>
    </Select>
  </div>;
}

export function FinanceCheck({ label, name, checked, onChange }: {
  label: string; name?: string; checked?: boolean; onChange?: (value: boolean) => void;
}) {
  const id = useId();
  return <label htmlFor={id} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-2 text-sm font-medium hover:bg-muted">
    <Checkbox id={id} name={name} checked={checked} onCheckedChange={value => onChange?.(value === true)} className="size-5 rounded-md" />
    {label}
  </label>;
}

export function MoneyFields({ quotes, label, prefix = "", reference = true, initial, min = 0.01 }: {
  quotes: Quotes; label: string; prefix?: string; reference?: boolean; initial?: OriginalMoney; min?: number;
}) {
  const [currency, setCurrency] = useState(initial && currencies.some(row => row[0] === initial.currency) ? initial.currency : initial ? "other" : "USD");
  const [rate, setRate] = useState(initial ? initial.rate.toFixed(8) : "");
  const [entered, setEntered] = useState(initial ? String(initial.nativeCents / 100) : "");
  const quote = quotes[currency];
  const amountName = prefix ? prefix + "Amount" : "amount";
  return <div className="space-y-2 rounded-xl border bg-background/60 p-3">
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block space-y-1.5 text-sm font-medium"><span>{label}</span>
        <Input className="h-11 rounded-xl" name={amountName} type="number" inputMode="decimal" step="0.01" min={min} required value={entered} onChange={event => setEntered(event.target.value)} />
      </label>
      <FinanceSelect label="Moneda" name={prefix ? prefix + "Currency" : "currency"} options={currencies} value={currency} onChange={value => {
        setCurrency(value);
        setRate(quotes[value]?.rate.toFixed(8).replace(/\.?0+$/, "") ?? "");
      }} />
    </div>
    {currency === "other" && <label className="block space-y-1.5 text-sm font-medium"><span>Código de moneda</span>
      <Input className="h-11 rounded-xl uppercase" name={prefix ? prefix + "CurrencyCode" : "currencyCode"} pattern="[A-Za-z]{3}" maxLength={3} defaultValue={initial?.currency === currency ? undefined : initial?.currency} placeholder="Ej. GBP" required />
    </label>}
    {reference && currency !== "USD" && <>
      <label className="block space-y-1.5 text-sm font-medium"><span>Tasa aplicada por 1 USD</span>
        <Input className="h-11 rounded-xl" name={prefix ? prefix + "Rate" : "rate"} type="number" min="0.00000001" step="0.00000001" inputMode="decimal" required value={rate} onChange={event => setRate(event.target.value)} />
      </label>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {quote && <Button size="sm" type="button" variant="ghost" onClick={() => setRate(quote.rate.toFixed(8))}>Usar {quote.source}{quote.date ? ` · ${quote.date}` : ""}</Button>}
        {Number(rate) > 0 && Number(entered) > 0 && <span>Equivalente: {new Intl.NumberFormat("es-VE", { style: "currency", currency: "USD" }).format(Number(entered) / Number(rate))}</span>}
      </div>
    </>}
  </div>;
}
