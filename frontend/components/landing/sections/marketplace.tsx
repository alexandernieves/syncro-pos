"use client";

/**
 * The marketplace every Syncro shop lands in automatically.
 *
 * Both surfaces are built in HTML rather than as images: they stay sharp at
 * any density, they read correctly to a screen reader, and the shop cards pull
 * the same real photographs the reel uses, so the storefront looks like the
 * shops the reader just scrolled past.
 */

import {
  IconSearch,
  IconMapPin,
  IconStarFilled,
  IconTruckDelivery,
  IconDeviceMobile,
  IconWorldWww,
  IconBolt,
  IconCheck,
} from "@tabler/icons-react";

import { Section, Reveal, Item, Eyebrow, H2, Lead } from "./primitives";

const SHOPS = [
  {
    name: "Bodega La Esquina",
    photo: "/media/shops/bodega-mostrador.jpg",
    tag: "Abarrotes",
    rating: "4,8",
    distance: "A 3 min",
  },
  {
    name: "Ferretería El Tornillo",
    photo: "/media/shops/ferreteria-pasillo.jpg",
    tag: "Ferretería",
    rating: "4,7",
    distance: "A 8 min",
  },
  {
    name: "Minimercado El Sol",
    photo: "/media/shops/bodega-abarrotes.jpg",
    tag: "Minimarket",
    rating: "4,9",
    distance: "A 5 min",
  },
  {
    name: "Verdulería Doña Ana",
    photo: "/media/shops/verduleria.jpg",
    tag: "Frutas y verduras",
    rating: "4,6",
    distance: "A 2 min",
  },
];

const POINTS = [
  {
    icon: IconBolt,
    title: "Te publica solo",
    body: "Cargas un producto en tu caja y ese mismo día aparece en la tienda.",
  },
  {
    icon: IconMapPin,
    title: "Te encuentra el de la cuadra",
    body: "El cliente busca por cercanía y tu negocio sale antes que el de lejos.",
  },
  {
    icon: IconTruckDelivery,
    title: "Retiro o delivery",
    body: "El pedido entra por la tienda y sale por tu mostrador, sin comisiones ocultas.",
  },
];

function WebStore() {
  return (
    <div className="overflow-hidden rounded-xl border border-[#DED8CB] bg-white shadow-[0_24px_60px_-40px_rgba(22,20,15,0.5)]">
      {/* browser chrome */}
      <div className="flex items-center gap-1.5 border-b border-[#EBE6DC] bg-[#F7F5F0] px-3 py-2">
        <span className="size-2 rounded-full bg-[#D9D4C8]" />
        <span className="size-2 rounded-full bg-[#D9D4C8]" />
        <span className="size-2 rounded-full bg-[#D9D4C8]" />
        <span className="ml-2 truncate font-mono text-[10px] text-[#8C8577]">
          tienda.syncro.shop
        </span>
      </div>

      <div className="border-b border-[#EBE6DC] px-4 py-3">
        <div className="flex items-center gap-2 rounded-lg border border-[#DED8CB] px-3 py-2">
          <IconSearch className="size-4 shrink-0 text-[#8C8577]" />
          <span className="text-[12px] text-[#8C8577]">
            Harina, cemento, pañales…
          </span>
          <span className="ml-auto flex items-center gap-1 text-[11px] font-semibold text-[#0E7A46]">
            <IconMapPin className="size-3.5" />
            Cerca de mí
          </span>
        </div>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {["Todo", "Abarrotes", "Ferretería", "Panadería", "Farmacia"].map((c, i) => (
            <span
              key={c}
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                i === 0
                  ? "bg-[#16140F] text-white"
                  : "border border-[#DED8CB] text-[#5A5449]"
              }`}
            >
              {c}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 p-3">
        {SHOPS.map((s) => (
          <article key={s.name} className="overflow-hidden rounded-lg border border-[#EBE6DC]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={s.photo}
              alt=""
              loading="lazy"
              className="h-20 w-full object-cover"
            />
            <div className="p-2.5">
              <p className="truncate text-[12px] font-bold text-[#16140F]">{s.name}</p>
              <p className="mt-0.5 text-[10px] text-[#8C8577]">{s.tag}</p>
              <p className="mt-1.5 flex items-center gap-2 text-[10px] font-semibold text-[#5A5449]">
                <span className="flex items-center gap-0.5 text-[#C2820F]">
                  <IconStarFilled className="size-2.5" />
                  {s.rating}
                </span>
                <span className="text-[#8C8577]">{s.distance}</span>
              </p>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function PhoneStore() {
  return (
    <div className="w-[190px] overflow-hidden rounded-[26px] border-[7px] border-[#16140F] bg-white shadow-[0_24px_50px_-24px_rgba(22,20,15,0.55)]">
      <div className="flex items-center justify-between bg-[#16140F] px-4 pb-2 pt-1.5">
        <span className="text-[9px] font-semibold text-white/70">9:41</span>
        <span className="h-1 w-8 rounded-full bg-white/20" />
        <span className="text-[9px] font-semibold text-white/70">100%</span>
      </div>

      <div className="px-3 py-3">
        <p className="text-[13px] font-extrabold text-[#16140F]">Cerca de ti</p>
        <p className="mt-0.5 text-[10px] text-[#8C8577]">14 negocios abiertos ahora</p>

        <div className="mt-2.5 space-y-2">
          {SHOPS.slice(0, 3).map((s) => (
            <div
              key={s.name}
              className="flex items-center gap-2 rounded-lg border border-[#EBE6DC] p-1.5"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={s.photo}
                alt=""
                loading="lazy"
                className="size-9 shrink-0 rounded-md object-cover"
              />
              <span className="min-w-0">
                <span className="block truncate text-[10.5px] font-bold text-[#16140F]">
                  {s.name}
                </span>
                <span className="block text-[9px] text-[#8C8577]">
                  {s.tag} · {s.distance}
                </span>
              </span>
            </div>
          ))}
        </div>

        <div className="mt-3 rounded-lg bg-[#0E7A46] px-3 py-2 text-center text-[11px] font-bold text-white">
          Pedir a la bodega
        </div>
      </div>
    </div>
  );
}

export function Marketplace() {
  return (
    <Section id="tienda" scene={6} className="py-24">
      <div className="grid items-center gap-10 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <Reveal amount={0.2}>
            <Item>
              <Eyebrow>Incluido, sin costo aparte</Eyebrow>
            </Item>
            <Item>
              <H2 className="mt-4">
                Una tienda donde ya estás,
                <br />
                sin haber hecho nada.
              </H2>
            </Item>
            <Item>
              <Lead className="mt-4 max-w-lg">
                Syncro publica automáticamente a todos sus negocios en una misma
                tienda, web y app. El cliente busca lo que necesita, ve quién lo
                tiene cerca y te compra a ti. Tú no montas nada.
              </Lead>
            </Item>

            <div className="mt-7 space-y-2.5">
              {POINTS.map((pt) => (
                <Item key={pt.title}>
                  <div className="flex gap-3 rounded-lg border border-[#DED8CB] bg-white p-3.5">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-[#E3F0E7] text-[#0E7A46]">
                      <pt.icon className="size-4" />
                    </span>
                    <div>
                      <h3 className="text-[13.5px] font-bold leading-tight text-[#16140F]">
                        {pt.title}
                      </h3>
                      <p className="mt-1 text-[12.5px] leading-snug text-[#5A5449]">
                        {pt.body}
                      </p>
                    </div>
                  </div>
                </Item>
              ))}
            </div>

            <Item>
              <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] font-semibold text-[#5A5449]">
                <span className="flex items-center gap-1.5">
                  <IconWorldWww className="size-4 text-[#0E7A46]" />
                  Tienda web
                </span>
                <span className="flex items-center gap-1.5">
                  <IconDeviceMobile className="size-4 text-[#0E7A46]" />
                  App para el cliente
                </span>
                <span className="flex items-center gap-1.5">
                  <IconCheck className="size-4 text-[#0E7A46]" />
                  Tu inventario real
                </span>
              </div>
            </Item>
          </Reveal>
        </div>

        <div className="lg:col-span-7">
          <Reveal amount={0.1}>
            <Item>
              <div className="relative pb-16 pr-6 sm:pb-20 sm:pr-10">
                <WebStore />
                <div className="absolute -bottom-2 right-0 sm:-right-2">
                  <PhoneStore />
                </div>
              </div>
            </Item>
          </Reveal>
        </div>
      </div>
    </Section>
  );
}
