"use client";

/** Scenes 4-9: the trade selector, the catalogue, growth, reach and the close. */

import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import {
  IconArrowRight,
  IconCheck,
  IconPlus,
  IconWorldWww,
  IconBrandWhatsapp,
  IconTargetArrow,
  IconUsersGroup,
  IconQrcode,
  IconPhoto,
  IconCurrencyDollar,
  IconLanguage,
  IconReceiptTax,
  IconClock24,
} from "@tabler/icons-react";

import { Section, Reveal, Item, Eyebrow, Scrim, H2, Lead, Card } from "./primitives";
import {
  VERTICALS,
  VERTICAL_ORDER,
  BASE_MODULES,
  money,
  type Vertical,
} from "../lib/pos-model";
import { VERTICAL_ACCENT } from "../lib/palette";

/* ------------------------------------------------------------------ */
/* 4 · Built around your trade                                         */
/* ------------------------------------------------------------------ */

export function Adapt({
  vertical,
  onChange,
}: {
  vertical: Vertical;
  onChange: (v: Vertical) => void;
}) {
  const p = VERTICALS[vertical];
  const accent = VERTICAL_ACCENT[vertical];

  const swap = { duration: 0.34, ease: [0.22, 1, 0.36, 1] as const };

  return (
    <Section id="adapta" scene={4} tone="deep" className="py-24">
      <Reveal className="mb-9 max-w-2xl" amount={0.2}>
        <Item>
          <Eyebrow>Diferencia número uno</Eyebrow>
        </Item>
        <Item>
          <H2 className="mt-4">Elige tu rubro y mira cómo se rearma.</H2>
        </Item>
        <Item>
          <Lead className="mt-4">
            Los demás te entregan el mismo programa a todos y tú te acomodas.
            Syncro monta solo los módulos que tu negocio necesita. Cambia el
            rubro aquí y la caja de arriba cambia contigo.
          </Lead>
        </Item>
      </Reveal>

      <Reveal amount={0.15}>
        <Item>
          {/* The selected pill is one element that slides between tabs rather
              than four that fade — the eye follows a single moving object far
              more readily than a crossfade. */}
          <div className="flex flex-wrap gap-2">
            {VERTICAL_ORDER.map((v) => {
              const on = v === vertical;
              return (
                <motion.button
                  key={v}
                  onClick={() => onChange(v)}
                  whileTap={{ scale: 0.96 }}
                  className={`relative rounded-lg border px-5 py-2.5 text-[14px] font-bold transition-colors ${
                    on
                      ? "border-[#16140F] text-white"
                      : "border-[#DED8CB] bg-white text-[#5A5449] hover:border-[#8C8577]"
                  }`}
                >
                  {on && (
                    <motion.span
                      layoutId="rubro-pill"
                      className="absolute inset-0 rounded-lg bg-[#16140F]"
                      transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    />
                  )}
                  <span className="relative z-10">{VERTICALS[v].label}</span>
                </motion.button>
              );
            })}
          </div>
        </Item>

        <div className="mt-5 grid items-start gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#8C8577]">
              Tu caso
            </span>
            <AnimatePresence mode="wait">
              <motion.div
                key={vertical}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={swap}
              >
                <h3 className="mt-2.5 text-xl font-extrabold text-[#16140F]">
                  {p.label}
                </h3>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-[#5A5449]">
                  {p.tagline}
                </p>
                <p className="mt-4 border-l-2 border-[#B33C2A] pl-3 text-[13px] leading-snug text-[#5A5449]">
                  {p.pain}
                </p>
              </motion.div>
            </AnimatePresence>
          </Card>

          <Card className="lg:col-span-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#8C8577]">
              Lo que se activa
            </span>
            {/* `popLayout` lets the outgoing chips leave the flow immediately,
                so the survivors slide into their new slots instead of jumping
                once the exit finishes. */}
            <motion.div layout className="mt-3 grid gap-2 sm:grid-cols-2">
              {BASE_MODULES.map((m) => (
                <motion.div
                  layout
                  key={m}
                  className="flex items-center gap-2.5 rounded-lg border border-[#EBE6DC] bg-[#F7F5F0] px-3.5 py-2.5"
                >
                  <IconCheck className="size-4 shrink-0 text-[#8C8577]" />
                  <span className="text-[13px] font-semibold text-[#5A5449]">{m}</span>
                  <span className="ml-auto text-[9px] font-bold uppercase tracking-wider text-[#8C8577]">
                    Base
                  </span>
                </motion.div>
              ))}
              <AnimatePresence mode="popLayout" initial={false}>
                {p.modules.map((m, i) => (
                  <motion.div
                    layout
                    key={m}
                    initial={{ opacity: 0, y: 12, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.96 }}
                    transition={{ ...swap, delay: i * 0.055 }}
                    className="flex items-center gap-2.5 rounded-lg border bg-white px-3.5 py-2.5"
                    style={{ borderColor: accent }}
                  >
                    <IconPlus className="size-4 shrink-0" style={{ color: accent }} />
                    <span className="text-[13px] font-bold text-[#16140F]">{m}</span>
                    <span
                      className="ml-auto text-[9px] font-bold uppercase tracking-wider"
                      style={{ color: accent }}
                    >
                      A medida
                    </span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
            <p className="mt-4 border-t border-[#EBE6DC] pt-3 text-[12.5px] text-[#8C8577]">
              Sigue cobrando aunque se caiga el internet. ¿Falta algo para tu
              rubro? Se construye y se te entrega.
            </p>
          </Card>
        </div>
      </Reveal>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* 5 · The catalogue it prints for you                                 */
/* ------------------------------------------------------------------ */

/**
 * Loaded on demand: the book builds its page textures from real product
 * photographs, and there is no reason to pay for that before the reader has
 * scrolled anywhere near it.
 */
const CatalogBook = dynamic(() => import("../scene/catalog-book"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[58svh] min-h-[380px] items-center justify-center text-[13px] text-[#8C8577]">
      Armando el catálogo…
    </div>
  ),
});

export function Catalog({ vertical }: { vertical: Vertical }) {
  const p = VERTICALS[vertical];
  return (
    <Section id="catalogo" scene={5} className="py-20">
      <div className="grid items-center gap-8 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <Reveal amount={0.2}>
            <Item>
              <Eyebrow>Sale de tu propio inventario</Eyebrow>
            </Item>
            <Item>
              <H2 className="mt-4">Tu catálogo, armado solo.</H2>
            </Item>
            <Item>
              <Lead className="mt-4">
                Syncro toma los productos que ya cargaste, les pone precio en las
                dos monedas y arma el catálogo de la semana. Lo hojeas, lo
                mandas por WhatsApp y lo publicas en tu tienda en línea.
              </Lead>
            </Item>
            <Item>
              <ul className="mt-5 space-y-2">
                {[
                  "Se actualiza cuando cambias un precio",
                  "Listo para imprimir o para mandar",
                  "Con el nombre y los datos de tu negocio",
                ].map((t) => (
                  <li
                    key={t}
                    className="flex items-start gap-2.5 text-[13.5px] text-[#5A5449]"
                  >
                    <IconCheck className="mt-0.5 size-4 shrink-0 text-[#0E7A46]" />
                    {t}
                  </li>
                ))}
              </ul>
            </Item>
            <Item>
              <p className="mt-5 text-[12px] text-[#8C8577]">
                Hojéalo con los botones. Portada de {p.store}.
              </p>
            </Item>
          </Reveal>
        </div>

        <div className="lg:col-span-8">
          <CatalogBook store={p.store} />
        </div>
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* 7 · The growth engine                                               */
/* ------------------------------------------------------------------ */

const GROWTH = [
  {
    icon: IconWorldWww,
    title: "Tu página, publicada sola",
    body: "Syncro toma tus productos y arma tu tienda en línea. Sin diseñador ni programador.",
  },
  {
    icon: IconBrandWhatsapp,
    title: "Catálogo por WhatsApp",
    body: "Manda tu lista de precios actualizada a todos tus clientes en un toque.",
  },
  {
    icon: IconTargetArrow,
    title: "Campañas de anuncios",
    body: "Crea el anuncio desde el mismo sistema y sal frente a la gente de tu zona.",
  },
  {
    icon: IconUsersGroup,
    title: "Clientes que vuelven",
    body: "Syncro sabe quién compró, qué se llevó y cuándo toca recordárselo.",
  },
  {
    icon: IconQrcode,
    title: "QR en el mostrador",
    body: "El cliente escanea, ve tu catálogo y pide desde el teléfono mientras espera.",
  },
  {
    icon: IconPhoto,
    title: "Piezas listas para publicar",
    body: "Promos y novedades en formato de publicación, con tu marca. Apruebas y sale.",
  },
];

/** Storefront preview, built in HTML so it stays crisp at any size. */
function StorefrontMock({ vertical }: { vertical: Vertical }) {
  const p = VERTICALS[vertical];
  return (
    <div className="overflow-hidden rounded-xl border border-[#DED8CB] bg-white">
      <div className="flex items-center gap-1.5 border-b border-[#EBE6DC] bg-[#F7F5F0] px-3 py-2">
        <span className="size-2 rounded-full bg-[#D9D4C8]" />
        <span className="size-2 rounded-full bg-[#D9D4C8]" />
        <span className="size-2 rounded-full bg-[#D9D4C8]" />
        <span className="ml-2 truncate font-mono text-[10px] text-[#8C8577]">
          tutienda.syncro.shop
        </span>
      </div>
      <div className="bg-[#0E7A46] px-5 py-6">
        <p className="text-[18px] font-extrabold leading-tight text-white">{p.store}</p>
        <p className="mt-1 text-[12px] text-white/80">Pide por WhatsApp y retira hoy</p>
        <span className="mt-3 inline-block rounded-md bg-white px-3 py-1.5 text-[11px] font-bold text-[#16140F]">
          Ver catálogo
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 p-3">
        {p.catalog.slice(0, 6).map((it) => (
          <div key={it.id} className="rounded-md border border-[#EBE6DC] p-2">
            <div className="h-9 rounded bg-[#EBE6DC]" />
            <p className="mt-1.5 truncate text-[10px] font-semibold text-[#16140F]">
              {it.name}
            </p>
            <p className="font-mono text-[10px] font-bold text-[#0E7A46]">
              $ {money(it.price)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/** The broadcast as it lands in a customer's chat. */
function ChatMock({ vertical }: { vertical: Vertical }) {
  const p = VERTICALS[vertical];
  const thread: [string, boolean][] = [
    ["¡Llegó mercancía nueva!", false],
    ["Mira el catálogo de esta semana", false],
    ["¿Cuánto cuesta el combo?", true],
    ["$ 12,50 y te lo aparto hoy", false],
  ];
  return (
    <div className="overflow-hidden rounded-xl border border-[#DED8CB] bg-white">
      <div className="flex items-center gap-2.5 border-b border-[#EBE6DC] px-4 py-3">
        <span className="flex size-8 items-center justify-center rounded-full bg-[#0E7A46] text-[11px] font-bold text-white">
          {p.store.slice(0, 1)}
        </span>
        <span>
          <span className="block text-[13px] font-bold text-[#16140F]">{p.store}</span>
          <span className="block text-[11px] text-[#8C8577]">en línea</span>
        </span>
      </div>
      <div className="space-y-2 bg-[#F7F5F0] p-3.5">
        {thread.map(([text, mine], i) => (
          <div key={i} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
            <span
              className={`max-w-[80%] rounded-lg px-3 py-2 text-[12px] leading-snug ${
                mine
                  ? "bg-[#E3F0E7] text-[#0A5733]"
                  : "border border-[#EBE6DC] bg-white text-[#16140F]"
              }`}
            >
              {text}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Growth({ vertical }: { vertical: Vertical }) {
  return (
    <Section id="crecer" scene={7} className="py-24">
      <div className="grid gap-10 lg:grid-cols-12">
        <div className="lg:col-span-6">
          <Reveal amount={0.2}>
            <Item>
              <Eyebrow>Diferencia número dos</Eyebrow>
            </Item>
            <Item>
              <H2 className="mt-4">
                Un POS te dice cuánto vendiste.
                <br />
                <span className="text-[#0E7A46]">
                  Syncro te consigue a quién venderle.
                </span>
              </H2>
            </Item>
            <Item>
              <Lead className="mt-4 max-w-lg">
                Ningún sistema de punto de venta hace esto. Syncro trae adentro
                las herramientas de marketing que hoy tendrías que contratar
                aparte, conectadas con tu inventario real.
              </Lead>
            </Item>

            <div className="mt-7 grid gap-2.5 sm:grid-cols-2">
              {GROWTH.map((g) => (
                <Item key={g.title}>
                  <div className="flex h-full gap-3 rounded-lg border border-[#DED8CB] bg-white p-3.5">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-[#E3F0E7] text-[#0E7A46]">
                      <g.icon className="size-4" />
                    </span>
                    <div>
                      <h3 className="text-[13px] font-bold leading-tight text-[#16140F]">
                        {g.title}
                      </h3>
                      <p className="mt-1 text-[12px] leading-snug text-[#5A5449]">
                        {g.body}
                      </p>
                    </div>
                  </div>
                </Item>
              ))}
            </div>
          </Reveal>
        </div>

        <div className="lg:col-span-6">
          <Reveal className="space-y-4" amount={0.1}>
            <Item>
              <StorefrontMock vertical={vertical} />
            </Item>
            <Item>
              <ChatMock vertical={vertical} />
            </Item>
          </Reveal>
        </div>
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* 8 · Reach                                                           */
/* ------------------------------------------------------------------ */

const COUNTRIES = [
  { name: "Venezuela", currency: "USD · VES", tax: "IVA 16%" },
  { name: "Colombia", currency: "COP", tax: "IVA 19%" },
  { name: "México", currency: "MXN", tax: "IVA 16%" },
  { name: "Perú", currency: "PEN", tax: "IGV 18%" },
  { name: "España", currency: "EUR", tax: "IVA 21%" },
  { name: "Estados Unidos", currency: "USD", tax: "Sales tax" },
];

const GLOBAL_FEATURES = [
  { icon: IconCurrencyDollar, label: "Multimoneda con tasa del día" },
  { icon: IconReceiptTax, label: "Impuestos por país" },
  { icon: IconLanguage, label: "Interfaz en varios idiomas" },
  { icon: IconClock24, label: "Zonas horarias y turnos locales" },
];

export function World() {
  return (
    <Section id="mundo" scene={8} tone="none">
      <Scrim from="left" />
      <div className="grid gap-10 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <Reveal amount={0.2}>
            <Item>
              <Eyebrow>Diferencia número tres</Eyebrow>
            </Item>
            <Item>
              <H2 className="mt-4">Pensado para cruzar fronteras.</H2>
            </Item>
            <Item>
              <Lead className="mt-4 max-w-lg">
                La moneda, el impuesto y el idioma son configuración, no una
                versión distinta del programa. El mismo Syncro funciona en tu
                cuadra y en otro país.
              </Lead>
            </Item>

            <Item>
              <div className="mt-6 grid gap-2 sm:grid-cols-2">
                {GLOBAL_FEATURES.map((f) => (
                  <div
                    key={f.label}
                    className="flex items-center gap-2.5 rounded-lg border border-[#DED8CB] bg-white px-3.5 py-2.5"
                  >
                    <f.icon className="size-[17px] shrink-0 text-[#0E7A46]" />
                    <span className="text-[12.5px] font-semibold text-[#16140F]">
                      {f.label}
                    </span>
                  </div>
                ))}
              </div>
            </Item>

            <Item>
              <div className="mt-5 overflow-hidden rounded-lg border border-[#DED8CB] bg-white">
                <div className="grid grid-cols-3 border-b border-[#EBE6DC] bg-[#F7F5F0] px-4 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#8C8577]">
                  <span>País</span>
                  <span>Moneda</span>
                  <span>Impuesto</span>
                </div>
                {COUNTRIES.map((c) => (
                  <div
                    key={c.name}
                    className="grid grid-cols-3 border-b border-[#EBE6DC] px-4 py-2.5 text-[12.5px] last:border-0"
                  >
                    <span className="font-semibold text-[#16140F]">{c.name}</span>
                    <span className="font-mono text-[#0E7A46]">{c.currency}</span>
                    <span className="text-[#8C8577]">{c.tax}</span>
                  </div>
                ))}
              </div>
            </Item>
          </Reveal>
        </div>
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* 9 · Close                                                           */
/* ------------------------------------------------------------------ */

const STEPS = [
  {
    n: "01",
    title: "Cuéntanos tu rubro",
    body: "Nos dices qué vendes y cómo trabajas hoy, aunque sea con cuaderno.",
  },
  {
    n: "02",
    title: "Armamos tu Syncro",
    body: "Cargamos tus productos y activamos los módulos que te hacen falta.",
  },
  {
    n: "03",
    title: "Vendes y creces",
    body: "Cobras desde el primer día y encendemos tu página y tus campañas.",
  },
];

export function Close({ vertical }: { vertical: Vertical }) {
  const p = VERTICALS[vertical];
  return (
    <Section id="empezar" scene={9} tone="deep" className="py-24">
      <div className="flex flex-col items-center">
        <Reveal className="max-w-2xl text-center" amount={0.2}>
          <Item className="flex justify-center">
            <Eyebrow>Fase piloto abierta</Eyebrow>
          </Item>
          <Item>
            <h2 className="mt-4 text-[clamp(2rem,4.8vw,3.3rem)] font-extrabold leading-[1.04] tracking-[-0.03em] text-[#16140F]">
              Deja de acomodarte
              <br />
              al sistema de otro.
            </h2>
          </Item>
          <Item>
            <Lead className="mx-auto mt-4 max-w-lg">
              Monta tu {p.label.toLowerCase()} en Syncro sin costo durante el
              piloto. Sin tarjeta, sin permanencia y con tus datos migrados por
              nosotros.
            </Lead>
          </Item>
          <Item>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <a
                href="/register"
                className="group flex items-center gap-2 rounded-lg bg-[#0E7A46] px-7 py-3.5 text-[15px] font-bold text-white transition-colors hover:bg-[#0A5733]"
              >
                Crear mi cuenta gratis
                <IconArrowRight className="size-[18px] transition-transform group-hover:translate-x-1" />
              </a>
              <a
                href="/login"
                className="rounded-lg border border-[#DED8CB] bg-white px-7 py-3.5 text-[15px] font-semibold text-[#16140F] transition-colors hover:border-[#0E7A46]"
              >
                Ya tengo cuenta
              </a>
            </div>
          </Item>
          <Item>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[12px] text-[#8C8577]">
              {["Sin tarjeta de crédito", "Sin permanencia", "Migramos tus datos"].map(
                (t) => (
                  <span key={t} className="flex items-center gap-1.5">
                    <IconCheck className="size-3.5 text-[#0E7A46]" />
                    {t}
                  </span>
                )
              )}
            </div>
          </Item>
        </Reveal>

        <Reveal className="mt-12 w-full max-w-4xl" amount={0.15}>
          <div className="grid gap-3 sm:grid-cols-3">
            {STEPS.map((s) => (
              <Item key={s.n}>
                <Card className="h-full">
                  <span className="font-mono text-[11px] font-bold tracking-widest text-[#0E7A46]">
                    {s.n}
                  </span>
                  <h3 className="mt-2 text-[15px] font-bold text-[#16140F]">
                    {s.title}
                  </h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-[#5A5449]">
                    {s.body}
                  </p>
                </Card>
              </Item>
            ))}
          </div>
        </Reveal>

        <footer className="mt-16 w-full border-t border-[#DED8CB] pt-7">
          <div className="flex flex-col items-center justify-between gap-4 text-[12px] text-[#8C8577] sm:flex-row">
            <div className="flex items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/syncro.png" alt="" className="size-6 rounded-md" />
              <span className="font-bold tracking-wide text-[#5A5449]">SYNCRO POS</span>
            </div>
            <span>
              © {new Date().getFullYear()} Syncro Technologies · Hecho para
              comerciantes
            </span>
            <div className="flex items-center gap-4">
              <a href="/login" className="transition-colors hover:text-[#16140F]">
                Entrar
              </a>
              <a href="/register" className="transition-colors hover:text-[#16140F]">
                Crear cuenta
              </a>
            </div>
          </div>
        </footer>
      </div>
    </Section>
  );
}
