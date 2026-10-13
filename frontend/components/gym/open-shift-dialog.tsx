"use client";

import { useEffect, useRef, useState } from "react";
import { IconCashRegister, IconLoader2 } from "@tabler/icons-react";
import { toast } from "sonner";
import { API_URL } from "@/lib/constants";
import { registerShiftOpener } from "@/lib/gym";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { OptionSelect } from "@/components/forms/option-select";

/**
 * When a gym charge finds the cash closed, asks for the opening amount, opens the same
 * shift the POS uses and lets the charge continue. Mounted once in the dashboard layout.
 */
export function OpenShiftHost() {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  useEffect(() => {
    registerShiftOpener(
      () =>
        new Promise<boolean>((resolve) => {
          resolver.current?.(false);
          resolver.current = resolve;
          setAmount(null);
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

  const openShift = async () => {
    if (amount === null) return;
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/shifts/open`, {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}`, "Content-Type": "application/json" },
        body: JSON.stringify({ openingBalance: amount, branchId: localStorage.getItem("currentBranchId") || "" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(Array.isArray(data.message) ? data.message[0] : data.message || "No se pudo abrir la caja");
      toast.success(`Caja abierta con $${amount.toFixed(2)}`);
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
        <div className="space-y-1.5">
          <p className="text-sm font-medium">Efectivo con el que abres la gaveta</p>
          <OptionSelect value={amount} onChange={setAmount} options={[0, 10, 20, 50, 100]} unit="money" min={0} max={10000} step={0.01} zeroLabel="$0.00 · gaveta vacía" placeholder="Elegir monto" />
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => finish(false)}>No cobrar ahora</Button>
          <Button className="gap-2" disabled={busy || amount === null} onClick={openShift}>
            {busy && <IconLoader2 size={16} className="animate-spin" />} Abrir caja y cobrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
