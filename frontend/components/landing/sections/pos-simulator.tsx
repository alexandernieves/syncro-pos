"use client";

/**
 * The working point of sale.
 *
 * This is the same interface the camera just flew into, rebuilt in HTML so it
 * can actually be used: tap a product, watch the line appear, watch both
 * currencies move, charge the sale and take the receipt. It reads its cart
 * from the page, which is the same cart painted onto the 3D display, so the
 * hand-off between WebGL and the DOM has nothing to reconcile.
 */

import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { motion, AnimatePresence } from "framer-motion";
import {
  IconMinus,
  IconTrash,
  IconCheck,
  IconRotateClockwise,
  IconPrinter,
} from "@tabler/icons-react";

import {
  VERTICALS,
  money,
  totalsOf,
  formatQty,
  RATE,
  type CartLine,
  type Vertical,
} from "../lib/pos-model";

type Stage = "selling" | "paid";

const METHODS = ["Efectivo", "Pago móvil", "Tarjeta", "Fiado"] as const;

export function PosSimulator({
  vertical,
  lines,
  onAdd,
  onRemove,
  onClear,
  justAdded,
}: {
  vertical: Vertical;
  lines: CartLine[];
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  justAdded: string | null;
}) {
  const profile = VERTICALS[vertical];
  const t = totalsOf(lines);
  const [stage, setStage] = useState<Stage>("selling");
  const [method, setMethod] = useState<(typeof METHODS)[number]>("Pago móvil");
  const receiptRef = useRef<HTMLDivElement>(null);

  // Reset the till if the shop type changes under us.
  useEffect(() => setStage("selling"), [vertical]);

  const charge = () => {
    if (lines.length === 0) return;
    setStage("paid");
  };

  // The slip feeding out of the printer is the one moment that wants a real
  // timeline rather than a CSS transition: it has to unroll, then settle.
  useEffect(() => {
    if (stage !== "paid" || !receiptRef.current) return;
    const el = receiptRef.current;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        el,
        { yPercent: -100, opacity: 0 },
        { yPercent: 0, opacity: 1, duration: 0.75, ease: "power3.out" }
      );
      gsap.fromTo(
        el.querySelectorAll("[data-slip-line]"),
        { opacity: 0, y: -6 },
        { opacity: 1, y: 0, duration: 0.3, stagger: 0.045, delay: 0.25 }
      );
    }, el);
    return () => ctx.revert();
  }, [stage]);

  return (
    <div className="mx-auto w-full max-w-[1180px]">
      {/* device shell — the same graphite bezel the camera came through */}
      <div className="rounded-[20px] bg-[#2B2925] p-2 shadow-[0_30px_80px_-30px_rgba(22,20,15,0.45)] sm:rounded-[26px] sm:p-3">
        <div className="overflow-hidden rounded-[12px] bg-white sm:rounded-[16px]">
          {/* top bar */}
          <div className="flex items-center gap-3 border-b border-[#DED8CB] px-4 py-3 sm:px-5">
            <span className="flex size-6 items-center justify-center rounded-md bg-[#0E7A46] text-[11px] font-extrabold text-white">
              S
            </span>
            <span className="text-[13px] font-extrabold tracking-wide text-[#16140F]">
              SYNCRO
            </span>
            <span className="hidden text-[13px] text-[#8C8577] sm:inline">
              {profile.store}
            </span>
            <span className="ml-auto flex items-center gap-1.5 text-[12px] font-semibold text-[#5A5449]">
              <span className="size-[7px] animate-pulse rounded-full bg-[#0E7A46]" />
              En línea
            </span>
            <span className="font-mono text-[12px] text-[#5A5449]">14:32</span>
          </div>

          <div className="flex flex-col lg:flex-row">
            {/* ---------------- sale ---------------- */}
            <div className="relative flex-1 lg:w-[61.7%]">
              <div className="px-4 pt-3 sm:px-5">
                <div className="grid grid-cols-[48px_1fr_auto] gap-3 border-b border-[#EBE6DC] pb-2 text-[11px] font-bold tracking-wide text-[#8C8577]">
                  <span>CANT</span>
                  <span>PRODUCTO</span>
                  <span>IMPORTE</span>
                </div>

                <div className="min-h-[210px] divide-y divide-[#EBE6DC]">
                  <AnimatePresence initial={false}>
                    {lines.map((line) => (
                      <motion.div
                        key={line.id}
                        layout
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.22 }}
                        className={`group grid grid-cols-[48px_1fr_auto] items-center gap-3 py-2.5 ${
                          justAdded === line.id ? "bg-[#E3F0E7]" : ""
                        }`}
                      >
                        <span className="font-mono text-[15px] font-semibold text-[#16140F]">
                          {formatQty(line)}
                        </span>
                        <span>
                          <span className="block text-[14px] font-semibold leading-tight text-[#16140F]">
                            {line.name}
                          </span>
                          <span className="text-[12px] text-[#8C8577]">
                            {line.unit} · $ {money(line.price)}
                          </span>
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="font-mono text-[15px] font-bold text-[#16140F]">
                            $ {money(line.price * line.qty)}
                          </span>
                          <button
                            onClick={() => onRemove(line.id)}
                            aria-label={`Quitar ${line.name}`}
                            className="flex size-6 items-center justify-center rounded-md border border-[#DED8CB] text-[#8C8577] transition-colors hover:border-[#B33C2A] hover:text-[#B33C2A]"
                          >
                            <IconMinus className="size-3.5" />
                          </button>
                        </span>
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  {lines.length === 0 && (
                    <div className="flex min-h-[210px] flex-col items-center justify-center text-center">
                      <p className="text-[14px] font-semibold text-[#16140F]">
                        Caja abierta
                      </p>
                      <p className="mt-1 text-[13px] text-[#8C8577]">
                        Toca un producto de abajo para empezar la venta.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* quick picks */}
              <div className="border-t border-[#DED8CB] px-4 pb-4 pt-3 sm:px-5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold tracking-wide text-[#8C8577]">
                    MÁS VENDIDOS
                  </span>
                  {lines.length > 0 && stage === "selling" && (
                    <button
                      onClick={onClear}
                      className="flex items-center gap-1.5 text-[11px] font-semibold text-[#8C8577] transition-colors hover:text-[#B33C2A]"
                    >
                      <IconTrash className="size-3.5" />
                      Vaciar
                    </button>
                  )}
                </div>

                <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  {profile.catalog.slice(0, 8).map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setStage("selling");
                        onAdd(p.id);
                      }}
                      className="rounded-lg border border-[#DED8CB] bg-white px-3 py-2.5 text-left transition-all hover:-translate-y-px hover:border-[#0E7A46] active:translate-y-0"
                    >
                      <span className="block truncate text-[13px] font-semibold text-[#16140F]">
                        {p.name}
                      </span>
                      <span className="block text-[11px] text-[#8C8577]">{p.unit}</span>
                      <span className="mt-1 block font-mono text-[14px] font-bold text-[#0E7A46]">
                        $ {money(p.price)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* ---------------- totals ---------------- */}
            <div className="relative border-t border-[#DED8CB] bg-[#F7F5F0] p-4 sm:p-5 lg:w-[38.3%] lg:border-l lg:border-t-0">
              <div className="flex justify-between text-[13px]">
                <span className="text-[#5A5449]">Subtotal</span>
                <span className="font-mono font-semibold text-[#16140F]">
                  $ {money(t.subtotal)}
                </span>
              </div>
              <div className="mt-1.5 flex justify-between text-[13px]">
                <span className="text-[#5A5449]">IVA 16%</span>
                <span className="font-mono font-semibold text-[#16140F]">
                  $ {money(t.iva)}
                </span>
              </div>

              <div className="my-3 h-px bg-[#DED8CB]" />

              <span className="text-[10px] font-bold tracking-wider text-[#8C8577]">
                TOTAL A PAGAR
              </span>
              <div className="mt-1 text-[34px] font-extrabold leading-none tracking-tight text-[#16140F] tabular-nums sm:text-[40px]">
                $ {money(t.total)}
              </div>
              <div className="mt-2 text-[19px] font-bold text-[#0E7A46] tabular-nums">
                Bs {money(t.bs)}
              </div>
              <div className="mt-1 text-[11px] text-[#8C8577]">
                Tasa del día · 1 USD = {money(RATE)} Bs
              </div>

              <div className="mt-4 space-y-1.5">
                {METHODS.map((m) => (
                  <button
                    key={m}
                    onClick={() => setMethod(m)}
                    className={`flex w-full items-center rounded-lg border px-3 py-2 text-[13px] font-semibold transition-colors ${
                      method === m
                        ? "border-[#0E7A46] bg-[#E3F0E7] text-[#0A5733]"
                        : "border-[#DED8CB] bg-white text-[#5A5449] hover:border-[#8C8577]"
                    }`}
                  >
                    {m}
                    {method === m && <IconCheck className="ml-auto size-4" />}
                  </button>
                ))}
              </div>

              <button
                onClick={charge}
                disabled={lines.length === 0}
                className="mt-4 w-full rounded-lg bg-[#0E7A46] py-3.5 text-[15px] font-extrabold text-white transition-colors hover:bg-[#0A5733] disabled:cursor-not-allowed disabled:bg-[#C7C2B7]"
              >
                COBRAR · F12
              </button>

              {/* ---------------- paid ---------------- */}
              <AnimatePresence>
                {stage === "paid" && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 z-10 flex flex-col items-center justify-start overflow-hidden bg-[#F7F5F0] p-5"
                  >
                    <div className="flex items-center gap-2 text-[#0E7A46]">
                      <IconCheck className="size-5" />
                      <span className="text-[15px] font-extrabold">Venta registrada</span>
                    </div>
                    <p className="mt-1 text-center text-[12px] text-[#8C8577]">
                      Cobrado con {method.toLowerCase()}
                    </p>

                    <div
                      ref={receiptRef}
                      className="mt-4 w-full max-w-[230px] rounded-sm bg-white px-4 py-4 shadow-[0_10px_24px_-12px_rgba(22,20,15,0.4)]"
                    >
                      <div
                        data-slip-line
                        className="text-center text-[11px] font-extrabold tracking-wide text-[#16140F]"
                      >
                        {profile.store.toUpperCase()}
                      </div>
                      <div
                        data-slip-line
                        className="mt-0.5 text-center font-mono text-[9px] text-[#8C8577]"
                      >
                        RIF J-40512233-8
                      </div>
                      <div className="my-2 border-t border-dashed border-[#C7C2B7]" />
                      {lines.slice(0, 4).map((l) => (
                        <div
                          key={l.id}
                          data-slip-line
                          className="flex justify-between font-mono text-[10px] text-[#16140F]"
                        >
                          <span className="truncate pr-2">
                            {formatQty(l)}x {l.name}
                          </span>
                          <span>{money(l.price * l.qty)}</span>
                        </div>
                      ))}
                      {lines.length > 4 && (
                        <div
                          data-slip-line
                          className="font-mono text-[10px] text-[#8C8577]"
                        >
                          +{lines.length - 4} más
                        </div>
                      )}
                      <div className="my-2 border-t border-dashed border-[#C7C2B7]" />
                      <div
                        data-slip-line
                        className="flex justify-between font-mono text-[12px] font-extrabold text-[#16140F]"
                      >
                        <span>TOTAL $</span>
                        <span>{money(t.total)}</span>
                      </div>
                      <div
                        data-slip-line
                        className="flex justify-between font-mono text-[11px] font-bold text-[#0E7A46]"
                      >
                        <span>TOTAL Bs</span>
                        <span>{money(t.bs)}</span>
                      </div>
                      <div
                        data-slip-line
                        className="mt-2 flex items-center justify-center gap-1 text-[9px] text-[#8C8577]"
                      >
                        <IconPrinter className="size-3" />
                        Emitido con SYNCRO POS
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        onClear();
                        setStage("selling");
                      }}
                      className="mt-auto flex items-center gap-2 rounded-lg border border-[#DED8CB] bg-white px-4 py-2.5 text-[13px] font-bold text-[#16140F] transition-colors hover:border-[#0E7A46]"
                    >
                      <IconRotateClockwise className="size-4" />
                      Nueva venta
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
