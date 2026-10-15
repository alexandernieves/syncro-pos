"use client";

import { useEffect, useState } from "react";
import { IconDownload, IconLoader2, IconRefresh } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

type UpdateStatus = { state: "idle" | "available" | "downloading" | "installing" | "ready" | "error"; version?: string; percent?: number; current?: string };

type DesktopBridge = {
  updateStatus?: () => Promise<UpdateStatus | null>;
  onUpdateStatus?: (cb: (s: UpdateStatus) => void) => () => void;
  onUpdateDownloaded?: (cb: (info: { version?: string }) => void) => () => void;
  installUpdate?: () => void;
  checkUpdates?: () => void;
};

const bridge = () => (typeof window === "undefined" ? undefined : (window as unknown as { electron?: DesktopBridge }).electron);

/**
 * Only in the desktop app: a floating badge when a new version is out. One click downloads it,
 * installs it and reopens the app; the badge itself shows each step.
 */
export function DesktopUpdateBadge() {
  const [status, setStatus] = useState<UpdateStatus>({ state: "idle" });
  const [clicked, setClicked] = useState(false);

  useEffect(() => {
    const e = bridge();
    if (!e) return;
    if (e.onUpdateStatus) {
      e.updateStatus?.().then((s) => s && setStatus(s)).catch(() => {});
      return e.onUpdateStatus((s) => {
        setStatus(s);
        if (s.state === "error" || s.state === "available") setClicked(false);
      });
    }
    // Apps from before the badge only say when the download is done
    return e.onUpdateDownloaded?.((info) => setStatus({ state: "ready", version: info?.version }));
  }, []);

  if (status.state === "idle") return null;

  const version = status.version ? `v${status.version}` : "";
  const busy = status.state === "downloading" || status.state === "installing" || (clicked && status.state === "ready");
  const percent = status.state === "downloading" ? Math.max(0, Math.min(100, status.percent ?? 0)) : status.state === "installing" || busy ? 100 : 0;

  const start = () => {
    if (busy) return;
    setClicked(true);
    bridge()?.installUpdate?.();
  };

  const label =
    status.state === "downloading"
      ? `Descargando ${version} · ${percent}%`
      : status.state === "installing" || (clicked && status.state === "ready")
        ? "Instalando… la app se va a reabrir"
        : status.state === "error"
          ? "No se pudo actualizar · reintentar"
          : `Nueva versión ${version} · actualizar`;

  const Icon = status.state === "downloading" || status.state === "installing" || busy ? IconLoader2 : status.state === "error" ? IconRefresh : IconDownload;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] print:hidden">
      <button
        type="button"
        onClick={start}
        disabled={busy}
        aria-live="polite"
        title={status.state === "error" ? "La actualización falló. Pulsa para intentarlo de nuevo." : "Descarga la versión nueva, la instala y vuelve a abrir la app"}
        className={cn(
          "pointer-events-auto relative flex h-10 min-w-[230px] items-center gap-2 overflow-hidden rounded-full border pl-3 pr-4 text-xs font-semibold shadow-lg outline-none transition focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-default",
          status.state === "error" ? "border-border bg-background text-foreground hover:bg-muted" : "border-primary/40 bg-background text-foreground hover:border-primary",
        )}
      >
        {/* The fill grows with the download */}
        <span aria-hidden className="absolute inset-y-0 left-0 bg-primary/15 transition-[width] duration-300 ease-out" style={{ width: `${percent}%` }} />
        {status.state === "available" && (
          <span aria-hidden className="absolute right-2 top-2 flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60 motion-reduce:animate-none" />
            <span className="relative inline-flex size-2 rounded-full bg-primary" />
          </span>
        )}
        <span className={cn("relative flex size-6 shrink-0 items-center justify-center rounded-full", status.state === "error" ? "bg-muted" : "bg-primary text-primary-foreground")}>
          <Icon size={14} className={cn(Icon === IconLoader2 && "animate-spin")} />
        </span>
        <span className="relative tabular-nums">{label}</span>
      </button>
    </div>
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
