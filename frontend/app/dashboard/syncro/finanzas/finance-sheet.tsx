"use client";

import type { ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { XIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Adaptive Sheet (inspired by 21st.dev Adaptive Sheet):
 * - On mobile / PWA: rises from the bottom as a native-style sheet with grabber and safe-area padding.
 * - On desktop: presents as a centered modal dialog.
 */
export function FinanceSheet({
  open,
  onOpenChange,
  mobile = false,
  title,
  description,
  children,
  trigger,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mobile?: boolean;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  trigger?: ReactNode;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger>}
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-[58] bg-black/55 backdrop-blur-[3px]",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-200",
          )}
        />
        <DialogPrimitive.Content
          data-finance-workspace=""
          data-finance-mobile={mobile ? "" : undefined}
          className={cn(
            "fixed z-[60] flex w-full flex-col border bg-background shadow-2xl outline-none duration-200",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            // Mobile-first bottom sheet geometry
            "inset-x-0 bottom-0 max-h-[90dvh] rounded-t-[28px] border-b-0",
            "data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom",
            // Desktop centered modal (only when not forced mobile PWA)
            !mobile && [
              "sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-h-[85dvh] sm:max-w-lg",
              "sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:border",
              "sm:data-[state=open]:slide-in-from-bottom-0 sm:data-[state=closed]:slide-out-to-bottom-0",
              "sm:data-[state=open]:fade-in-0 sm:data-[state=closed]:fade-out-0",
              "sm:data-[state=open]:zoom-in-95 sm:data-[state=closed]:zoom-out-95",
            ],
            // When in mobile PWA shell, constrain width to match the max-w-md container
            mobile && "mx-auto max-w-md",
          )}
        >
          {/* Native-style drag grabber on mobile */}
          <div className={cn("flex justify-center pt-3 pb-1", !mobile && "sm:hidden")} aria-hidden>
            <span className="h-1.5 w-11 rounded-full bg-muted-foreground/25" />
          </div>

          <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-2 sm:pt-5">
            <div className="space-y-1 text-left">
              <DialogPrimitive.Title className="text-lg font-bold tracking-tight leading-snug">
                {title}
              </DialogPrimitive.Title>
              {description && (
                <DialogPrimitive.Description className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
                  {description}
                </DialogPrimitive.Description>
              )}
            </div>
            <DialogPrimitive.Close className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted/70 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
              <XIcon className="size-4" />
              <span className="sr-only">Cerrar</span>
            </DialogPrimitive.Close>
          </div>

          <div className="flex-1 overflow-y-auto overscroll-y-contain px-5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-1">
            {children}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
