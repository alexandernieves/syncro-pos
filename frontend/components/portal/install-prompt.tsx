"use client";

import { useEffect, useState } from "react";
import { IconDownload, IconShare2, IconSquarePlus, IconX } from "@tabler/icons-react";

/**
 * "Instala Syncro Credit": a card above the tab bar.
 * - Android / desktop Chrome: the browser's own install (beforeinstallprompt) with one tap.
 * - iPhone / iPad in Safari: the two steps (Compartir → Agregar a inicio), Safari has no button.
 * - iPhone in another browser: open it in Safari (only Safari installs on iOS).
 * Hidden once installed (or opened from the home screen); closing it hides it for 14 days.
 */
const KEY = "sc-install-dismissed";
const QUIET_DAYS = 14;

type Mode = "prompt" | "ios-safari" | "ios-other" | null;

export function InstallPrompt() {
    const [mode, setMode] = useState<Mode>(null);
    const [evt, setEvt] = useState<any>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true;
        if (standalone) return;
        try {
            const at = Number(localStorage.getItem(KEY) || 0);
            if (at && Date.now() - at < QUIET_DAYS * 86400000) return;
        } catch { /* private mode: show it */ }

        const ua = navigator.userAgent;
        const ios = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
        let t: ReturnType<typeof setTimeout> | undefined;
        if (ios) {
            const otherBrowser = /CriOS|FxiOS|EdgiOS|OPiOS|GSA\//i.test(ua);
            // a moment after opening, not on top of the first look
            t = setTimeout(() => setMode(otherBrowser ? "ios-other" : "ios-safari"), 3500);
            return () => clearTimeout(t);
        }
        const onPrompt = (e: Event) => {
            e.preventDefault?.();
            (window as any).__scInstall = null;
            setEvt(e);
            t = setTimeout(() => setMode("prompt"), 2500);
        };
        // it may have come before this card existed (the layout keeps it)
        const early = (window as any).__scInstall;
        if (early) onPrompt(early);
        const onInstalled = () => setMode(null);
        window.addEventListener("beforeinstallprompt", onPrompt);
        window.addEventListener("appinstalled", onInstalled);
        return () => {
            window.removeEventListener("beforeinstallprompt", onPrompt);
            window.removeEventListener("appinstalled", onInstalled);
            if (t) clearTimeout(t);
        };
    }, []);

    const dismiss = () => {
        setMode(null);
        try { localStorage.setItem(KEY, String(Date.now())); } catch { /* private mode */ }
    };
    const install = async () => {
        if (!evt) return;
        setBusy(true);
        try {
            evt.prompt();
            const choice = await evt.userChoice;
            if (choice?.outcome === "accepted") setMode(null);
            else dismiss();
        } catch {
            dismiss();
        } finally {
            setEvt(null);
            setBusy(false);
        }
    };

    if (!mode) return null;
    return (
        <div className="fixed inset-x-0 z-[150] flex justify-center px-4 animate-in slide-in-from-bottom-4 fade-in duration-300" style={{ bottom: "calc(env(safe-area-inset-bottom) + 104px)" }}>
            <div className="relative w-full max-w-md rounded-[22px] border border-zinc-200 bg-white p-4 shadow-[0_18px_40px_-12px_rgba(90,30,5,0.35)]">
                <button onClick={dismiss} aria-label="Cerrar aviso de instalación" className="absolute right-2.5 top-2.5 grid size-8 place-items-center rounded-full text-zinc-400 hover:bg-zinc-100">
                    <IconX size={16} />
                </button>
                <div className="flex items-start gap-3 pr-6">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/sc-icon-192.png" alt="" className="size-12 shrink-0 rounded-[14px] shadow-sm" />
                    <div className="min-w-0">
                        <p className="text-[15px] font-bold text-zinc-900">Instala Syncro Credit</p>
                        {mode === "prompt" && <p className="mt-0.5 text-[13px] leading-snug text-zinc-500">Tenla en tu pantalla de inicio y ábrela como una app, sin buscar la página.</p>}
                        {mode === "ios-other" && <p className="mt-0.5 text-[13px] leading-snug text-zinc-500">En iPhone se instala desde <b className="text-zinc-700">Safari</b>. Abre esta página en Safari y sigue los pasos.</p>}
                        {mode === "ios-safari" && (
                            <ol className="mt-1.5 space-y-1.5 text-[13px] text-zinc-600">
                                <li className="flex items-start gap-2">
                                    <span className="mt-px grid size-5 shrink-0 place-items-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">1</span>
                                    <span>Toca <IconShare2 size={16} className="inline align-[-3px] text-[#0A84FF]" /> <b className="text-zinc-800">Compartir</b> en Safari</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="mt-px grid size-5 shrink-0 place-items-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">2</span>
                                    <span>Elige <IconSquarePlus size={16} className="inline align-[-3px] text-zinc-700" /> <b className="text-zinc-800">Agregar a inicio</b></span>
                                </li>
                            </ol>
                        )}
                    </div>
                </div>
                {mode === "prompt" && (
                    <div className="mt-3 flex gap-2">
                        <button onClick={dismiss} className="h-11 flex-1 rounded-full text-[14px] font-semibold text-zinc-500">Ahora no</button>
                        <button onClick={install} disabled={busy} className="inline-flex h-11 flex-[1.4] items-center justify-center gap-1.5 rounded-full bg-primary text-[14px] font-bold text-white transition active:scale-[0.98] disabled:opacity-60">
                            <IconDownload size={17} /> Instalar
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
