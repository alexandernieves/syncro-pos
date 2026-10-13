"use client";

import { useEffect, useState } from "react";
import { IconCheck, IconLoader2, IconRefresh } from "@tabler/icons-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/context/CurrencyContext";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const pesos = (n: number) => n.toLocaleString("es-VE", { maximumFractionDigits: 2 });

/**
 * Peso rate for branches in Táchira: the official TRM, or the business's own rate
 * (the one used at the Cúcuta border), which wins while it's set.
 */
export function CopRateButton() {
  const { copRate, copTrm, copManual, copDate, setCopRate, syncBcvDashboard } = useCurrency();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setText(copManual ? String(copManual) : ""); }, [open, copManual]);

  const value = Number(text.replace(/\./g, "").replace(",", "."));
  const valid = /^\d{3,6}([.,]\d{1,2})?$/.test(text.trim()) && value >= 100 && value <= 100000;
  const error = text.trim() && !valid ? "Escribe cuántos pesos vale un dólar: entre 100 y 100.000" : "";

  const save = async (manual: number | null) => {
    setBusy(true);
    const ok = await setCopRate(manual);
    setBusy(false);
    if (!ok) return toast.error("No se pudo guardar la tasa del peso");
    toast.success(manual ? `Tasa propia: ${pesos(manual)} pesos por dólar` : "Usando la TRM oficial");
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="h-9 gap-2 rounded-md border-border/40 bg-muted/20 px-3 text-[12px] font-semibold shadow-none hover:bg-muted/40">
          <span>COP: {copRate > 0 ? pesos(copRate) : "sin tasa"}</span>
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{copManual ? "Propia" : "TRM"}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-4 p-4">
        <div>
          <p className="text-sm font-semibold">Tasa del peso colombiano</p>
          <p className="mt-1 text-xs text-muted-foreground">Pesos por cada dólar. Se usa en las sucursales del Táchira para cobrar, dar vuelto y cuadrar la caja en COP.</p>
        </div>

        <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2.5">
          <div>
            <p className="text-xs text-muted-foreground">TRM oficial de Colombia</p>
            <p className="text-sm font-semibold tabular-nums">{copTrm > 0 ? `${pesos(copTrm)} por dólar` : "Sin consultar"}</p>
            {copDate && <p className="text-[11px] text-muted-foreground">Vigente desde {copDate}</p>}
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="gap-1.5"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const ok = await syncBcvDashboard();
              setBusy(false);
              if (ok) toast.success("Tasas actualizadas");
              else toast.error("No se pudo consultar la tasa");
            }}
          >
            <IconRefresh size={14} className={cn(busy && "animate-spin")} /> Actualizar
          </Button>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-medium">Tasa propia (opcional)</p>
          <div className={cn("flex h-9 items-center overflow-hidden rounded-md border bg-background focus-within:border-ring", error && "border-destructive")}>
            <input
              inputMode="decimal"
              value={text}
              onChange={(e) => setText(e.target.value.replace(/[^\d.,]/g, "").slice(0, 9))}
              onKeyDown={(e) => { if (e.key === "Enter" && valid) save(value); }}
              placeholder={copTrm > 0 ? String(Math.round(copTrm)) : "3800"}
              className="min-w-0 flex-1 bg-transparent px-3 text-sm tabular-nums outline-none"
            />
            <span className="pr-3 text-xs text-muted-foreground">COP por dólar</span>
          </div>
          <p className={cn("text-[11px]", error ? "text-destructive" : "text-muted-foreground")}>{error || "Si en la frontera trabajas con otra tasa, escríbela. Manda sobre la TRM hasta que la quites."}</p>
        </div>

        <div className="flex justify-between gap-2">
          <Button size="sm" variant="ghost" disabled={busy || !copManual} onClick={() => save(null)}>Usar la TRM</Button>
          <Button size="sm" className="gap-1.5" disabled={busy || !valid} onClick={() => save(value)}>
            {busy ? <IconLoader2 size={14} className="animate-spin" /> : <IconCheck size={14} />} Guardar tasa propia
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
