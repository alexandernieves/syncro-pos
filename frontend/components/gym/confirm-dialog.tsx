"use client";

import { useEffect, useState } from "react";
import { IconAlertTriangle, IconLoader2 } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type ReasonField = {
  label: string;
  placeholder?: string;
  /** Quick answers the user can tap instead of typing. */
  suggestions?: string[];
  required?: boolean;
};

/**
 * Confirmation in the platform's style (instead of the browser's confirm/prompt).
 * Optionally asks for a reason, with quick suggestions.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  details,
  confirmLabel,
  danger,
  reason,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description?: React.ReactNode;
  /** Extra information shown in a soft box (who is affected, what happens next). */
  details?: React.ReactNode;
  confirmLabel: string;
  danger?: boolean;
  reason?: ReasonField;
  onConfirm: (reason: string) => Promise<unknown> | void;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setText(""); setBusy(false); } }, [open]);

  const missing = !!reason?.required && !text.trim();
  const submit = async () => {
    if (missing) return;
    setBusy(true);
    try {
      await onConfirm(text.trim());
      onClose();
    } catch {
      // The caller shows the error; keep the dialog open to retry
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="items-start gap-3 sm:flex-row sm:text-left">
          <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-full", danger ? "bg-rose-500/10 text-rose-600" : "bg-primary/10 text-primary")}>
            <IconAlertTriangle size={20} />
          </span>
          <div className="space-y-1.5">
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </div>
        </DialogHeader>

        {details && <div className="rounded-xl bg-muted/50 px-4 py-3 text-sm">{details}</div>}

        {reason && (
          <div className="space-y-2">
            <p className="text-sm font-medium">{reason.label}</p>
            {!!reason.suggestions?.length && (
              <div className="flex flex-wrap gap-1.5">
                {reason.suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setText(s)}
                    className={cn("rounded-full border px-3 py-1 text-xs transition", text === s ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground")}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            <textarea
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(); }}
              rows={2}
              placeholder={reason.placeholder}
              className="w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Volver</Button>
          <Button onClick={submit} disabled={busy || missing} className={cn("gap-2", danger && "bg-rose-600 text-white hover:bg-rose-700")}>
            {busy && <IconLoader2 size={16} className="animate-spin" />} {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
