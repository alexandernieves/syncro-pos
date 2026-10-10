"use client";

import { useState } from "react";
import { IconLock, IconX } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

type CreditLimitOverrideProps = {
  /** The owner doesn't need the supervisor PIN. */
  needsPin: boolean;
  busy?: boolean;
  submitLabel: string;
  onSubmit: (amount: number, pin: string) => void;
  onCancel: () => void;
  className?: string;
};

/** Custom SyncroCredit limit: an amount plus the supervisor PIN when the user isn't the owner. */
export function CreditLimitOverride({ needsPin, busy, submitLabel, onSubmit, onCancel, className }: CreditLimitOverrideProps) {
  const [amount, setAmount] = useState("");
  const [pin, setPin] = useState("");
  const value = Number(amount);
  const ready = value > 0 && (!needsPin || pin.length >= 4);

  const submit = () => ready && !busy && onSubmit(value, pin);

  return (
    <div className={cn("space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3", className)}>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[11px] font-bold text-amber-700">
          <IconLock size={13} /> {needsPin ? "Otro límite (requiere PIN de supervisor)" : "Otro límite"}
        </span>
        <button type="button" onClick={onCancel} className="text-muted-foreground hover:text-foreground" title="Cancelar">
          <IconX size={14} />
        </button>
      </div>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">$</span>
          <input
            autoFocus
            type="number"
            min={1}
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="Monto"
            className="h-8 w-full rounded-lg border bg-card pl-5 pr-2 text-xs font-bold outline-none focus:border-amber-500"
          />
        </div>
        {needsPin && (
          <input
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="PIN"
            className="h-8 w-24 rounded-lg border bg-card px-2 text-center text-xs font-bold outline-none focus:border-amber-500"
          />
        )}
      </div>
      <button
        type="button"
        onClick={submit}
        disabled={!ready || busy}
        className="h-8 w-full rounded-lg bg-amber-600 text-[11px] font-bold text-white hover:bg-amber-700 disabled:opacity-40"
      >
        {busy ? "Guardando…" : submitLabel}
      </button>
    </div>
  );
}
