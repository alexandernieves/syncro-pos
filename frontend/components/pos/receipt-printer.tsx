"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconPrinter, IconPlus, IconVolume, IconVolumeOff, IconCircleCheckFilled } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { InvoiceDocument } from "@/components/invoice/invoice-document";
import type { InvoiceDesign } from "@/lib/invoice/design";
import { printInvoice } from "@/lib/invoice/render";
import { type InvoiceBusiness, type InvoiceData, invoiceNumber } from "@/lib/invoice/types";

export type ReceiptData = InvoiceData;

/** Printing sound; the paper takes exactly as long as this audio. */
const TICKET_SOUND = "/media/ticket.mp3";
/** Used until the audio duration is known, or if it cannot load. */
const DEFAULT_PRINT_MS = 3600;
const SOUND_KEY = "syncro-receipt-sound";
/**
 * Receipts that already came out of the printer in this session. A screen can unmount and mount
 * the printer again (sending it by WhatsApp, a side panel that redraws): it shows the paper
 * already printed, without the sound.
 */
const printed = new Set<string>();

// ── Component ────────────────────────────────────────────────────────────────

type ReceiptPrinterProps = {
  receipt: ReceiptData | null;
  /** Invoice design from Configuración → Factura. */
  design: InvoiceDesign;
  business: InvoiceBusiness;
  /** "Nueva venta": closes everything so the next customer can be served. */
  onDone: () => void;
  /** Text of the closing button (the POS says "Nueva venta"). */
  doneLabel?: string;
  /** Extra buttons next to "Imprimir" (for example, send by WhatsApp). */
  extraActions?: React.ReactNode;
};

/** Animated receipt that comes out of a printer after a sale, with printer and cash register sounds. */
export function ReceiptPrinter({ receipt, design, business, onDone, doneLabel = "Nueva venta", extraActions }: ReceiptPrinterProps) {
  const receiptKey = receipt ? invoiceNumber(receipt) : null;
  const [finished, setFinished] = useState(() => !!receiptKey && printed.has(receiptKey));
  // Whether this receipt is printing now (paper animation) or was printed before
  const [animate, setAnimate] = useState(() => !receiptKey || !printed.has(receiptKey));
  const [soundOn, setSoundOn] = useState(true);
  const ticketAudioRef = useRef<HTMLAudioElement | null>(null);
  const [printMs, setPrintMs] = useState(DEFAULT_PRINT_MS);
  const doneRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    try {
      setSoundOn(localStorage.getItem(SOUND_KEY) !== "off");
    } catch {
      // Storage unavailable: keep sound on.
    }
    // Preload the printing sound and match the animation to its length.
    const audio = new Audio(TICKET_SOUND);
    audio.preload = "auto";
    audio.addEventListener("loadedmetadata", () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0.5) setPrintMs(Math.round(audio.duration * 1000));
    });
    ticketAudioRef.current = audio;
    return () => {
      audio.pause();
      ticketAudioRef.current = null;
    };
  }, []);

  // The paper and the sound only for a receipt that hasn't come out yet
  useEffect(() => {
    if (!receiptKey) return;
    if (printed.has(receiptKey)) {
      setAnimate(false);
      setFinished(true);
      return;
    }
    printed.add(receiptKey);
    setAnimate(true);
    setFinished(false);
    let soundAllowed = true;
    try {
      soundAllowed = localStorage.getItem(SOUND_KEY) !== "off";
    } catch {}
    if (soundAllowed) {
      const ticket = ticketAudioRef.current;
      if (ticket) {
        ticket.currentTime = 0;
        // Autoplay may be blocked; the sale button click usually allows it.
        void ticket.play().catch(() => {});
      }
    }
    const timer = setTimeout(() => setFinished(true), printMs + 150);
    return () => {
      clearTimeout(timer);
      ticketAudioRef.current?.pause();
    };
    // printMs is read when the ticket starts; a later change must not restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receiptKey]);

  useEffect(() => {
    if (finished) doneRef.current?.focus();
  }, [finished]);

  useEffect(() => {
    if (!receipt || !finished) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === "Escape") {
        e.preventDefault();
        onDone();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [receipt, finished, onDone]);

  if (!receipt) return null;

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    try {
      localStorage.setItem(SOUND_KEY, next ? "on" : "off");
    } catch {}
  };

  // Drawn on the body so the backdrop covers the whole screen even when opened from a side panel
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/60 backdrop-blur-sm px-4 py-8" style={{ pointerEvents: "auto" }} role="dialog" aria-modal="true" aria-label="Recibo de la venta">
      <style>{`
        @keyframes rp-feed { 0% { transform: translateY(-100%); } 100% { transform: translateY(0); } }
        @keyframes rp-led { 0%,100% { opacity: 1; } 50% { opacity: .25; } }
        @keyframes rp-burst {
          0% { transform: translate(0, 0) rotate(0) scale(.6); opacity: 1; }
          55% { transform: translate(var(--dx), var(--dy)) rotate(calc(var(--r) * .6)) scale(1); opacity: 1; }
          100% { transform: translate(calc(var(--dx) * 1.15), calc(var(--dy) + 170px)) rotate(var(--r)) scale(1); opacity: 0; }
        }
        .rp-paper { animation: rp-feed ${printMs}ms steps(${Math.round(printMs / 60)}, end) forwards; }
        @media (prefers-reduced-motion: reduce) { .rp-paper { animation: none; } }
      `}</style>

      <div className="relative w-full max-w-[380px]">
        {/* Printer */}
        <div className="relative z-20 -mx-3 h-16 rounded-2xl bg-gradient-to-b from-zinc-700 to-zinc-900 shadow-2xl">
          <div className="absolute left-4 top-1/2 flex -translate-y-1/2 items-center gap-2">
            <span className="size-2 rounded-full bg-emerald-400" style={{ animation: finished ? "none" : "rp-led .5s infinite" }} />
            <span className="text-[10px] font-semibold text-zinc-400">{finished ? "Listo" : "Imprimiendo"}</span>
          </div>
          <button type="button" onClick={toggleSound} className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white" title={soundOn ? "Silenciar sonido" : "Activar sonido"} aria-label={soundOn ? "Silenciar sonido" : "Activar sonido"}>
            {soundOn ? <IconVolume size={16} /> : <IconVolumeOff size={16} />}
          </button>
          <div className="absolute inset-x-6 bottom-2 h-1.5 rounded-full bg-black shadow-[inset_0_1px_2px_rgba(0,0,0,.8)]" />
        </div>

        {/* Paper coming out of the slot */}
        <div className="relative z-30 -mt-[11px] overflow-hidden px-5 pb-3">
          {/* Shadow the slot casts on the paper */}
          <div className="pointer-events-none absolute inset-x-5 top-0 z-10 h-5 bg-gradient-to-b from-black/35 via-black/10 to-transparent" />
          <div className={`${animate ? "rp-paper " : ""}relative bg-white px-6 pb-8 pt-8 text-[11px] leading-relaxed text-zinc-900 shadow-[0_26px_40px_-20px_rgba(50,50,120,.45),0_2px_8px_rgba(50,50,120,.12)]`}>
            <div className="flex flex-col items-center gap-1 text-center">
              <IconCircleCheckFilled className="size-9 text-emerald-500" />
              <p className="font-sans text-base font-black tracking-tight">{receipt.pending ? "Venta guardada" : "¡Venta registrada!"}</p>
              {receipt.pending && <p className="font-sans text-[10px] text-amber-600">Se sincronizará al recuperar la conexión</p>}
            </div>

            <div className="mt-4">
              {design.paper === "a4" ? (
                // Letter size: shown reduced so the whole page fits the paper strip
                <div style={{ width: 620, zoom: 0.46 }}>
                  <InvoiceDocument data={receipt} design={design} business={business} />
                </div>
              ) : (
                <InvoiceDocument data={receipt} design={design} business={business} ink="thermal" />
              )}
            </div>

            {/* Torn paper edge */}
            <div
              className="absolute inset-x-0 -bottom-2 h-3"
              style={{ background: "linear-gradient(-45deg, transparent 6px, white 0) 0 0/12px 12px, linear-gradient(45deg, transparent 6px, white 0) 0 0/12px 12px" }}
            />
          </div>
        </div>

        {/* Confetti burst from the slot when the ticket is done */}
        {finished && (
          <div className="pointer-events-none absolute left-1/2 top-[53px] z-40 h-0 w-0" aria-hidden="true">
            {Array.from({ length: 40 }).map((_, i) => {
              const angle = (-160 + (i * 140) / 39) * (Math.PI / 180); // fan upward and to the sides
              const power = 90 + ((i * 53) % 110);
              return (
                <span
                  key={i}
                  className="absolute block rounded-[2px]"
                  style={{
                    width: i % 3 === 0 ? 6 : 8,
                    height: i % 3 === 0 ? 10 : 5,
                    background: ["#E4572E", "#10B981", "#3B82F6", "#F59E0B", "#A855F7", "#EC4899"][i % 6],
                    ["--dx" as string]: `${Math.cos(angle) * power}px`,
                    ["--dy" as string]: `${Math.sin(angle) * power}px`,
                    ["--r" as string]: `${(i % 2 ? 1 : -1) * (360 + i * 25)}deg`,
                    animation: `rp-burst ${0.9 + (i % 5) * 0.12}s cubic-bezier(.15,.7,.3,1) forwards`,
                  }}
                />
              );
            })}
          </div>
        )}

        <div className={`mt-4 flex gap-2 transition-all duration-300 ${finished ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0"}`}>
          {extraActions}
          <Button variant="outline" className="h-12 flex-1 gap-2 rounded-xl bg-background font-semibold" onClick={() => printInvoice(receipt, design, business)}>
            <IconPrinter size={18} /> Imprimir en impresora
          </Button>
          <Button ref={doneRef} className="h-12 flex-1 gap-2 rounded-xl bg-emerald-600 font-bold text-white hover:bg-emerald-500" onClick={onDone}>
            {doneLabel === "Nueva venta" ? <IconPlus size={18} /> : <IconCircleCheckFilled size={18} />} {doneLabel}
          </Button>
        </div>
        {finished && <p className="mt-3 text-center text-[11px] text-white/70">{doneLabel === "Nueva venta" ? "Presiona Enter para empezar una nueva venta" : "Presiona Enter para cerrar"}</p>}
      </div>
    </div>,
    document.body,
  );
}
