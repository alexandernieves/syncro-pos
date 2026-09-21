"use client";

/** Top bar, section rail and reading progress. */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { IconArrowRight, IconMenu2, IconX } from "@tabler/icons-react";

export const SECTIONS = [
  { id: "inicio", label: "Inicio" },
  { id: "entrar", label: "La caja" },
  { id: "probar", label: "Pruébalo" },
  { id: "comercios", label: "Comercios" },
  { id: "adapta", label: "Tu rubro" },
  { id: "catalogo", label: "Catálogo" },
  { id: "tienda", label: "Tienda" },
  { id: "crecer", label: "Vender más" },
  { id: "mundo", label: "Sin fronteras" },
  { id: "empezar", label: "Empezar" },
] as const;

/** Items shown in the desktop bar, by scene index. */
const NAV_SCENES = [2, 3, 4, 5, 6, 7, 8];

export function TopBar({
  active,
  onGo,
}: {
  active: number;
  onGo: (scene: number) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 border-b border-[#DED8CB] bg-[#F4F1EA]/92 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between px-5 sm:px-8">
          <button
            onClick={() => onGo(0)}
            className="flex items-center gap-2.5"
            aria-label="Ir al inicio"
          >
            <span className="flex size-8 items-center justify-center overflow-hidden rounded-lg border border-[#DED8CB] bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/syncro.png" alt="" className="size-full object-cover" />
            </span>
            <span className="flex flex-col text-left leading-none">
              <span className="text-[13px] font-extrabold tracking-[0.16em] text-[#16140F]">
                SYNCRO
              </span>
              <span className="mt-[3px] text-[9px] font-semibold tracking-[0.2em] text-[#8C8577]">
                PUNTO DE VENTA
              </span>
            </span>
          </button>

          <nav className="hidden items-center gap-0.5 lg:flex">
            {NAV_SCENES.map((s) => (
              <button
                key={s}
                onClick={() => onGo(s)}
                className={`rounded-md px-3 py-2 text-[13px] font-semibold transition-colors ${
                  active === s
                    ? "text-[#16140F]"
                    : "text-[#8C8577] hover:text-[#16140F]"
                }`}
              >
                {SECTIONS[s].label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <a
              href="/login"
              className="hidden rounded-md px-3 py-2 text-[13px] font-semibold text-[#5A5449] transition-colors hover:text-[#16140F] sm:block"
            >
              Entrar
            </a>
            <a
              href="/register"
              className="group hidden items-center gap-1.5 rounded-lg bg-[#0E7A46] px-4 py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-[#0A5733] sm:flex"
            >
              Probar gratis
              <IconArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </a>
            <button
              onClick={() => setOpen((v) => !v)}
              className="rounded-md border border-[#DED8CB] p-2 text-[#16140F] lg:hidden"
              aria-label="Abrir menú"
            >
              {open ? <IconX className="size-5" /> : <IconMenu2 className="size-5" />}
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed inset-x-0 top-16 z-50 border-b border-[#DED8CB] bg-[#F4F1EA] p-4 lg:hidden"
          >
            {SECTIONS.map((s, i) => (
              <button
                key={s.id}
                onClick={() => {
                  onGo(i);
                  setOpen(false);
                }}
                className="block w-full rounded-md px-4 py-3 text-left text-sm font-semibold text-[#5A5449] hover:bg-white"
              >
                {s.label}
              </button>
            ))}
            <a
              href="/register"
              className="mt-2 flex items-center justify-center gap-2 rounded-lg bg-[#0E7A46] px-4 py-3 text-sm font-bold text-white"
            >
              Probar gratis <IconArrowRight className="size-4" />
            </a>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export function SectionRail({
  active,
  onGo,
}: {
  active: number;
  onGo: (scene: number) => void;
}) {
  return (
    <div className="pointer-events-none fixed right-6 top-1/2 z-40 hidden -translate-y-1/2 flex-col items-end gap-2.5 xl:flex">
      {SECTIONS.map((s, i) => (
        <button
          key={s.id}
          onClick={() => onGo(i)}
          className="pointer-events-auto group flex items-center gap-3"
          aria-label={s.label}
        >
          <span
            className={`text-[11px] font-semibold transition-opacity duration-300 ${
              active === i
                ? "text-[#16140F] opacity-100"
                : "text-[#8C8577] opacity-0 group-hover:opacity-100"
            }`}
          >
            {s.label}
          </span>
          <span
            className={`block rounded-full transition-all duration-400 ${
              active === i ? "h-5 w-[3px] bg-[#0E7A46]" : "size-[3px] bg-[#C7C2B7]"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

export function ProgressLine({ progress }: { progress: number }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[2px]">
      <div
        className="h-full bg-[#0E7A46]"
        style={{ width: `${Math.round(progress * 100)}%` }}
      />
    </div>
  );
}
