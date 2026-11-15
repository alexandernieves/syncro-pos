"use client";

import { useEffect, useRef, useState } from "react";
import { IconCash, IconMinus, IconPlus } from "@tabler/icons-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { useMyModules } from "@/lib/modules";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/**
 * POS → Préstamo: the client shows the PIN of an approved loan; the cashier types it, counts the
 * bills and hands the cash over. It leaves the open shift's drawer as a cash movement (not a sale)
 * and the installments start. Only when the business has the "loans" module.
 */
type Info = { id: string; amount: number; totalToPay: number; installments: number; each: number; frequencyDays: number; client: { name: string; documentId: string | null; phone: string | null } };
const BILLS = [100, 50, 20, 10, 5, 1];
const money = (n: number) => `$${(Number(n) || 0).toFixed(2)}`;

export function LoanDisburseButton({ shiftOpen }: { shiftOpen: boolean }) {
  const mods = useMyModules();
  const [open, setOpen] = useState(false);
  if (!mods?.find((m) => m.code === "loans")?.usable) return null;
  return (
    <>
      <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-lg border-[#DAD5CC] bg-[#FAF7F2] px-2.5 text-xs font-bold text-[#16140F] hover:bg-[#F5F1E8]" onClick={() => setOpen(true)}>
        <IconCash size={14} className="text-primary" /> Préstamo
      </Button>
      {open && <LoanDisburseDialog shiftOpen={shiftOpen} onClose={() => setOpen(false)} />}
    </>
  );
}

function LoanDisburseDialog({ shiftOpen, onClose }: { shiftOpen: boolean; onClose: () => void }) {
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [info, setInfo] = useState<Info | null>(null);
  const [bills, setBills] = useState<Record<number, number>>({});
  const [busy, setBusy] = useState(false);
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const pin = digits.join("");
  const sum = Object.entries(bills).reduce((a, [v, n]) => a + Number(v) * n, 0);

  useEffect(() => { refs.current[0]?.focus(); }, []);

  const lookup = async (p: string) => {
    setBusy(true);
    try {
      const res = await apiFetch(`/lending/pin/${p}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || "PIN no válido");
      setInfo(body);
      // the fewest bills that add up to the loan, as a start
      let left = body.amount;
      const start: Record<number, number> = {};
      for (const b of BILLS) { const n = Math.floor(left / b + 1e-9); if (n > 0) { start[b] = n; left = Math.round((left - n * b) * 100) / 100; } }
      setBills(start);
    } catch (e: any) {
      toast.error(e.message);
      setDigits(["", "", "", "", "", ""]);
      refs.current[0]?.focus();
    } finally {
      setBusy(false);
    }
  };

  const setDigit = (i: number, v: string) => {
    const clean = v.replace(/\D/g, "");
    if (clean.length > 1) {
      const all = clean.slice(0, 6).split("");
      const next = [...all, "", "", "", "", "", ""].slice(0, 6);
      setDigits(next);
      if (all.length === 6) lookup(all.join(""));
      return;
    }
    const next = [...digits];
    next[i] = clean;
    setDigits(next);
    if (clean && i < 5) refs.current[i + 1]?.focus();
    if (next.every((d) => d)) lookup(next.join(""));
  };

  const disburse = async () => {
    if (!info) return;
    setBusy(true);
    try {
      const res = await apiFetch(`/lending/pin/${pin}/disburse`, { method: "POST", body: JSON.stringify({ bills }), headers: { "Content-Type": "application/json" } });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || "No se pudo entregar");
      toast.success(`Entregaste ${money(info.amount)} a ${info.client.name}. ${body.installments} cuota${body.installments > 1 ? "s" : ""} de ${money(body.each)}.`);
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Entregar préstamo</DialogTitle>
          <DialogDescription>Escribe el PIN que el cliente tiene en su app de Syncro Credit.</DialogDescription>
        </DialogHeader>
        {!shiftOpen && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">Abre tu turno de caja para poder entregar efectivo.</p>}
        <div className="flex justify-center gap-2">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => { refs.current[i] = el; }}
              value={d}
              inputMode="numeric"
              aria-label={`Dígito ${i + 1} del PIN`}
              disabled={!!info || busy}
              onChange={(e) => setDigit(i, e.target.value)}
              onKeyDown={(e) => { if (e.key === "Backspace" && !d && i > 0) refs.current[i - 1]?.focus(); }}
              className="h-12 w-11 rounded-xl border-2 border-[#FACBB4] bg-white text-center text-xl font-bold outline-none focus:border-primary"
            />
          ))}
        </div>

        {info && (
          <div className="space-y-3">
            <div className="flex items-start justify-between rounded-xl border p-3">
              <div>
                <p className="font-semibold">{info.client.name}</p>
                <p className="text-xs text-muted-foreground">{info.client.documentId}{info.client.phone ? ` · ${info.client.phone}` : ""}</p>
                <p className="mt-1 text-xs text-muted-foreground">Devuelve {money(info.totalToPay)} en {info.installments} cuota{info.installments > 1 ? "s" : ""} de {money(info.each)} cada {info.frequencyDays} días</p>
              </div>
              <p className="text-2xl font-bold tabular-nums">{money(info.amount)}</p>
            </div>
            <div>
              <p className="mb-1.5 text-xs font-semibold text-muted-foreground">Billetes que entregas</p>
              <div className="grid grid-cols-3 gap-2">
                {BILLS.map((b) => {
                  const n = bills[b] || 0;
                  return (
                    <div key={b} className={cn("flex items-center justify-between rounded-xl border px-2 py-1.5", n ? "border-green-400 bg-green-50" : "")}>
                      <button type="button" aria-label={`Quitar billete de ${b}`} className="grid size-7 place-items-center rounded-lg hover:bg-muted" onClick={() => setBills((x) => ({ ...x, [b]: Math.max(0, (x[b] || 0) - 1) }))}><IconMinus size={14} /></button>
                      <span className="text-center text-sm font-bold tabular-nums">${b}{n ? <span className="text-green-700"> ×{n}</span> : null}</span>
                      <button type="button" aria-label={`Agregar billete de ${b}`} className="grid size-7 place-items-center rounded-lg hover:bg-muted" onClick={() => setBills((x) => ({ ...x, [b]: (x[b] || 0) + 1 }))}><IconPlus size={14} /></button>
                    </div>
                  );
                })}
              </div>
              <p className={cn("mt-2 text-sm font-semibold", Math.abs(sum - info.amount) < 0.005 ? "text-green-700" : "text-red-600")}>
                Billetes: {money(sum)} de {money(info.amount)}
              </p>
            </div>
            <Button className="h-11 w-full text-base" disabled={busy || !shiftOpen || Math.abs(sum - info.amount) > 0.005} onClick={disburse}>
              {busy ? "Entregando…" : `Entregar ${money(info.amount)} y activar cuotas`}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
