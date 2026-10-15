"use client";

import { useEffect, useState } from "react";
import { IconDownload, IconLoader2, IconRefresh } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

type UpdateStatus = { state: "idle" | "downloading" | "ready" | "error"; version?: string; percent?: number; current?: string };

type DesktopBridge = {
  updateStatus?: () => Promise<UpdateStatus | null>;
  onUpdateStatus?: (cb: (s: UpdateStatus) => void) => () => void;
  onUpdateDownloaded?: (cb: (info: { version?: string }) => void) => () => void;
  installUpdate?: () => void;
  checkUpdates?: () => void;
};

const bridge = () => (typeof window === "undefined" ? undefined : (window as unknown as { electron?: DesktopBridge }).electron);

/**
 * Only in the desktop app: a new version downloads in the background and this badge
 * appears when it's ready. "Actualizar" closes the app and opens it again on the new version.
 */
export function DesktopUpdateBadge({ className }: { className?: string }) {
  const [status, setStatus] = useState<UpdateStatus>({ state: "idle" });
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    const e = bridge();
    if (!e) return;
    if (e.onUpdateStatus) {
      e.updateStatus?.().then((s) => s && setStatus(s)).catch(() => {});
      return e.onUpdateStatus(setStatus);
    }
    // Apps from before the badge only say when the download is done
    return e.onUpdateDownloaded?.((info) => setStatus({ state: "ready", version: info?.version }));
  }, []);

  if (status.state === "downloading") {
    return (
      <span className={cn("hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium text-muted-foreground sm:inline-flex", className)} title={`Descargando la versión ${status.version ?? "nueva"}`}>
        <IconLoader2 size={13} className="animate-spin" />
        Descargando actualización{status.percent ? ` ${status.percent}%` : "…"}
      </span>
    );
  }

  if (status.state === "error") {
    const e = bridge();
    return (
      <button
        type="button"
        onClick={() => e?.checkUpdates?.()}
        title="La actualización no se pudo descargar. Pulsa para intentarlo de nuevo."
        className={cn("hidden h-8 items-center gap-1.5 rounded-full border px-3 text-[11px] font-medium text-muted-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary sm:inline-flex", className)}
      >
        <IconRefresh size={13} />
        No se pudo actualizar · reintentar
      </button>
    );
  }

  if (status.state !== "ready") return null;

  return (
    <button
      type="button"
      disabled={installing}
      onClick={() => {
        setInstalling(true);
        bridge()?.installUpdate?.();
      }}
      title="Cierra la app y la abre de nuevo con la versión nueva"
      className={cn(
        "relative inline-flex h-8 items-center gap-1.5 rounded-full bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-sm outline-none transition hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-70",
        className,
      )}
    >
      <span aria-hidden className="absolute -right-0.5 -top-0.5 flex size-2.5">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60 motion-reduce:animate-none" />
        <span className="relative inline-flex size-2.5 rounded-full border-2 border-background bg-primary" />
      </span>
      {installing ? <IconRefresh size={14} className="animate-spin" /> : <IconDownload size={14} />}
      {installing ? "Reiniciando…" : <>Actualizar a {status.version ? `v${status.version}` : "la versión nueva"}</>}
    </button>
  );
}

/** Only in the desktop app: the installed version, for the sidebar footer. */
export function DesktopVersion({ className }: { className?: string }) {
  const [version, setVersion] = useState<string | null>(null);
  useEffect(() => {
    bridge()?.updateStatus?.().then((s) => s?.current && setVersion(s.current)).catch(() => {});
  }, []);
  if (!version) return null;
  return <p className={cn("px-2 pb-1 text-[10px] text-muted-foreground/80 tabular-nums group-data-[collapsible=icon]:hidden", className)}>Syncro POS v{version}</p>;
}
