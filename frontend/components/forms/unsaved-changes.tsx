"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { IconAlertTriangle, IconDeviceFloppy, IconLoader2 } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** Floating bar at the bottom while there are unsaved changes: follows the scroll. */
export function UnsavedChangesBar({ dirty, saving, onSave, onDiscard }: { dirty: boolean; saving: boolean; onSave: () => void; onDiscard: () => void }) {
  return (
    <>
    {/* Room at the end of the page so the bar never covers the last controls */}
    {dirty && <div className="h-16" aria-hidden />}
    <div
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-5 z-40 flex justify-center px-4 transition-all duration-300",
        dirty ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0",
      )}
      aria-hidden={!dirty}
    >
      <div className={cn("flex items-center gap-3 rounded-2xl bg-foreground py-2.5 pl-4 pr-2.5 text-background shadow-2xl", dirty && "pointer-events-auto")}>
        <span className="flex items-center gap-2 text-sm font-medium">
          <span className="size-2 rounded-full bg-amber-400" />
          Tienes cambios sin guardar
        </span>
        <Button size="sm" variant="ghost" className="text-background/80 hover:bg-background/10 hover:text-background" disabled={saving} onClick={onDiscard}>Descartar</Button>
        <Button size="sm" className="gap-1.5" disabled={saving} onClick={onSave}>
          {saving ? <IconLoader2 size={15} className="animate-spin" /> : <IconDeviceFloppy size={15} />} Guardar cambios
        </Button>
      </div>
    </div>
    </>
  );
}

/**
 * Stops leaving the page with unsaved changes: links in the app, the browser's back button
 * and closing or reloading the tab. Returns the dialog to render.
 * `save` must resolve to true when it saved.
 */
export function useUnsavedGuard(dirty: boolean, save: () => Promise<boolean>) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const dirtyRef = useRef(dirty);
  const leavingRef = useRef(false);
  dirtyRef.current = dirty;

  // Closing or reloading the tab
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current || leavingRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  // Clicks on links inside the app (sidebar, buttons that are links…)
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!dirtyRef.current || leavingRef.current || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
      const a = (e.target as HTMLElement)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin || (url.pathname === window.location.pathname && url.search === window.location.search)) return;
      e.preventDefault();
      e.stopPropagation();
      setPending(url.pathname + url.search + url.hash);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // Browser back button: keep an extra history entry while there are changes
  useEffect(() => {
    if (!dirty) return;
    history.pushState({ unsavedGuard: true }, "", window.location.href);
    const onPop = () => {
      if (!dirtyRef.current || leavingRef.current) return;
      history.pushState({ unsavedGuard: true }, "", window.location.href);
      setPending("__back__");
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [dirty]);

  const leave = useCallback(() => {
    const to = pending;
    setPending(null);
    leavingRef.current = true;
    if (to === "__back__") history.go(-2);
    else if (to) router.push(to);
    setTimeout(() => { leavingRef.current = false; }, 1500);
  }, [pending, router]);

  const dialog = (
    <Dialog open={!!pending} onOpenChange={(o) => !o && !saving && setPending(null)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="items-start gap-3 sm:flex-row sm:text-left">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-700"><IconAlertTriangle size={20} /></span>
          <div className="space-y-1.5">
            <DialogTitle>Tienes cambios sin guardar</DialogTitle>
            <DialogDescription>Si sales ahora, se pierden los cambios que hiciste en esta página.</DialogDescription>
          </div>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" className="text-rose-600" disabled={saving} onClick={leave}>Salir sin guardar</Button>
          <div className="flex gap-2">
            <Button variant="outline" disabled={saving} onClick={() => setPending(null)}>Seguir editando</Button>
            <Button
              className="gap-2"
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                const ok = await save().catch(() => false);
                setSaving(false);
                if (ok) leave();
              }}
            >
              {saving && <IconLoader2 size={16} className="animate-spin" />} Guardar y salir
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
  return dialog;
}
