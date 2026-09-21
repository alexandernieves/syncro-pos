"use client";

/** Scenes 0-2: the promise, the way in, and the working till. */

import { motion } from "framer-motion";
import { IconArrowRight, IconArrowDown, IconHandFinger } from "@tabler/icons-react";

import { Section, Reveal, Item, Eyebrow, Scrim, H2, Lead } from "./primitives";
import { PosSimulator } from "./pos-simulator";
import type { CartLine, Vertical } from "../lib/pos-model";

/* ------------------------------------------------------------------ */
/* 0 · Hero                                                            */
/* ------------------------------------------------------------------ */

export function Hero({ onGo }: { onGo: (scene: number) => void }) {
  return (
    <Section id="inicio" scene={0} tone="none">
      <Scrim from="left" />
      <div className="grid items-center gap-10 lg:grid-cols-12">
        <Reveal className="lg:col-span-6 xl:col-span-5" amount={0.2}>
          <Item>
            <Eyebrow>Punto de venta adaptable</Eyebrow>
          </Item>

          <Item>
            <h1 className="mt-5 text-[clamp(2.1rem,5.6vw,4rem)] font-extrabold leading-[1.02] tracking-[-0.03em] text-[#16140F]">
              El software se adapta
              <br />
              a tu negocio.
              <br />
              <span className="text-[#0E7A46]">No al revés.</span>
            </h1>
          </Item>

          <Item>
            <Lead className="mt-5 max-w-lg">
              Syncro se arma a la medida de tu bodega, ferretería, minimarket o
              boutique. Y no se queda en cobrar: también te construye la página,
              el catálogo y las campañas para que entren clientes nuevos.
            </Lead>
          </Item>

          <Item>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <a
                href="/register"
                className="group flex items-center gap-2 rounded-lg bg-[#0E7A46] px-6 py-3.5 text-[15px] font-bold text-white transition-colors hover:bg-[#0A5733]"
              >
                Empezar gratis
                <IconArrowRight className="size-[18px] transition-transform group-hover:translate-x-1" />
              </a>
              <button
                onClick={() => onGo(2)}
                className="flex items-center gap-2 rounded-lg border border-[#DED8CB] bg-white px-6 py-3.5 text-[15px] font-semibold text-[#16140F] transition-colors hover:border-[#0E7A46]"
              >
                <IconHandFinger className="size-[18px] text-[#0E7A46]" />
                Probar la caja
              </button>
            </div>
          </Item>

          <Item>
            <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] font-medium text-[#8C8577]">
              {["Bodegas", "Ferreterías", "Minimarkets", "Boutiques", "Panaderías"].map(
                (t) => (
                  <span key={t} className="flex items-center gap-1.5">
                    <span className="size-1 rounded-full bg-[#0E7A46]" />
                    {t}
                  </span>
                )
              )}
            </div>
          </Item>
        </Reveal>
      </div>

      {/* the one cue that there is more below */}
      <button
        onClick={() => onGo(1)}
        className="absolute bottom-8 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-1.5 text-[#8C8577] transition-colors hover:text-[#16140F] sm:flex"
      >
        <span className="text-[10px] font-bold uppercase tracking-[0.24em]">
          Entra a la caja
        </span>
        <motion.span
          animate={{ y: [0, 5, 0] }}
          transition={{ duration: 1.9, repeat: Infinity, ease: "easeInOut" }}
        >
          <IconArrowDown className="size-4" />
        </motion.span>
      </button>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* 1 · Into the screen                                                 */
/* ------------------------------------------------------------------ */

/**
 * A deliberately empty beat. The camera is pushing through the bezel here, so
 * the copy stays small and high: anything in the middle of the frame would be
 * in the way of the one thing this section exists to show.
 */
export function Dive() {
  return (
    <Section id="entrar" scene={1} tone="none">
      {/*
        The camera is passing through the bezel across this beat, so the screen
        owns the whole frame. The words sit in a solid card pinned to the
        bottom: anything floating in the middle lands on top of the interface
        and both become unreadable.
      */}
      <div className="pointer-events-none absolute inset-x-0 bottom-10 flex justify-center px-5">
        <Reveal amount={0.3}>
          <Item>
            <div className="pointer-events-auto max-w-xl rounded-xl border border-[#DED8CB] bg-[#F4F1EA] px-6 py-5 text-center">
              <Eyebrow tone="muted">Acércate</Eyebrow>
              <H2 className="mt-3 text-[clamp(1.4rem,2.6vw,2rem)]">
                Esto es lo que tu cajero ve todo el día.
              </H2>
              <Lead className="mt-2 text-[14px]">
                Sigue bajando. No te vas a ir de esta pantalla, te vas a meter en
                ella.
              </Lead>
            </div>
          </Item>
        </Reveal>
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* 2 · The working till                                                */
/* ------------------------------------------------------------------ */

export function Simulator({
  vertical,
  lines,
  justAdded,
  onAdd,
  onRemove,
  onClear,
}: {
  vertical: Vertical;
  lines: CartLine[];
  justAdded: string | null;
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}) {
  return (
    <Section id="probar" scene={2} tone="deep" className="py-24">
      <div className="flex flex-col items-center">
        <Reveal className="mb-8 max-w-2xl text-center" amount={0.2}>
          <Item className="flex justify-center">
            <Eyebrow>Estás dentro</Eyebrow>
          </Item>
          <Item>
            <H2 className="mt-4">Dale, cobra una venta.</H2>
          </Item>
          <Item>
            <Lead className="mx-auto mt-3 max-w-lg">
              Toca los productos, mira cómo se arma el ticket en dólares y en
              bolívares al mismo tiempo, y cierra la venta. Esto es el sistema
              de verdad, no un video.
            </Lead>
          </Item>
        </Reveal>

        <Reveal className="w-full" amount={0.1}>
          <Item>
            <PosSimulator
              vertical={vertical}
              lines={lines}
              justAdded={justAdded}
              onAdd={onAdd}
              onRemove={onRemove}
              onClear={onClear}
            />
          </Item>
        </Reveal>
      </div>
    </Section>
  );
}
