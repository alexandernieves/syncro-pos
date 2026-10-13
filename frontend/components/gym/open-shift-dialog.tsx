"use client";

import { useEffect, useRef, useState } from "react";
import { IconCashRegister, IconLoader2 } from "@tabler/icons-react";
import { toast } from "sonner";
import { API_URL } from "@/lib/constants";
import { registerShiftOpener } from "@/lib/gym";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCurrency } from "@/context/CurrencyContext";
import { type CashByCurrency, type Currency, CURRENCY_META, cashToUsd, formatMoney } from "@/lib/currency";
import { cn } from "@/lib/utils";

/**
 * When a gym charge finds the cash closed, asks for the opening amount, opens the same
 * shift the POS uses and lets the charge continue. Mounted once in the dashboard layout.
 */
export function OpenShiftHost() {
  const [open, setOpen] = useState(false);
  const { currencies, cashRates } = useCurrency();
  const [cash, setCash] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  useEffect(() => {
    registerShiftOpener(
      () =>
        new Promise<boolean>((resolve) => {
          resolver.current?.(false);
          resolver.current = resolve;
          setCash({});
          setOpen(true);
        }),
    );
    return () => registerShiftOpener(null);
  }, []);

  const finish = (ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setOpen(false);
  };

  const parsed: CashByCurrency = Object.fromEntries(Object.entries(cash).filter(([, v]) => v.trim() !== "").map(([c, v]) => [c, Number(v.replace(",", "."))]));
  const badFormat = Object.entries(cash).some(([, v]) => v.trim() !== "" && !/^\d+([.,]\d{1,2})?$/.test(v.trim()));
  const missingRate = Object.entries(parsed).some(([c, v]) => (v ?? 0) > 0 && !(cashRates[c as Currency] > 0));
  const totalUsd = cashToUsd(parsed, cashRates);

  const openShift = async () => {
    if (badFormat || missingRate) return;
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/shifts/open`, {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}`, "Content-Type": "application/json" },
        body: JSON.stringify({ openingCash: Object.keys(parsed).length ? parsed : { USD: 0 }, openingBalance: totalUsd, branchId: localStorage.getItem("currentBranchId") || "" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(Array.isArray(data.message) ? data.message[0] : data.message || "No se pudo abrir la caja");
      const parts = Object.entries(parsed).filter(([, v]) => (v ?? 0) > 0).map(([c, v]) => formatMoney(v!, c as Currency));
      toast.success(parts.length ? `Caja abierta con ${parts.join(" + ")}` : "Caja abierta con la gaveta vacía");
      finish(true);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && finish(false)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="items-start gap-3 sm:flex-row sm:text-left">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><IconCashRegister size={20} /></span>
          <div className="space-y-1.5">
            <DialogTitle>Abre la caja para cobrar</DialogTitle>
            <DialogDescription>No tienes un turno de caja abierto. Es la misma caja del punto de venta: lo que cobres en el gimnasio y en la tienda se cuadra junto al cerrar.</DialogDescription>
          </div>
        </DialogHeader>
        <div className="space-y-2">
          <p className="text-sm font-medium">Efectivo con el que abres la gaveta</p>
          <p className="text-xs text-muted-foreground">Cuenta los billetes de cada moneda. Deja en blanco la que no tengas.</p>
          <div className="space-y-1.5">
            {currencies.map((c) => {
              const v = cash[c] ?? "";
              const bad = v.trim() !== "" && !/^\d+([.,]\d{1,2})?$/.test(v.trim());
              const noRate = Number(v) > 0 && !(cashRates[c] > 0);
              return (
                <div key={c}>
                  <div className={cn("flex h-10 items-center overflow-hidden rounded-lg border bg-background focus-within:border-ring", (bad || noRate) && "border-destructive")}>
                    <span className="w-24 shrink-0 border-r bg-muted/40 px-3 py-2.5 text-xs font-semibold">{CURRENCY_META[c].label}</span>
                    <input
                      inputMode="decimal"
                      value={v}
                      onChange={(e) => setCash((x) => ({ ...x, [c]: e.target.value.replace(/[^\d.,]/g, "").slice(0, 12) }))}
                      placeholder="0"
                      className="min-w-0 flex-1 bg-transparent px-3 text-sm tabular-nums outline-none"
                    />
                    <span className="pr-3 text-xs text-muted-foreground">{CURRENCY_META[c].short}</span>
                  </div>
                  {bad && <p className="mt-1 text-[11px] text-destructive">Solo números, con hasta 2 decimales</p>}
                  {noRate && <p className="mt-1 text-[11px] text-destructive">Falta la tasa del peso: configúrala arriba en el botón COP</p>}
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm">
            <span className="text-muted-foreground">Total en dólares</span>
            <span className="font-semibold tabular-nums">{formatMoney(totalUsd, "USD")}</span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => finish(false)}>No cobrar ahora</Button>
          <Button className="gap-2" disabled={busy || badFormat || missingRate} onClick={openShift}>
            {busy && <IconLoader2 size={16} className="animate-spin" />} Abrir caja y cobrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
