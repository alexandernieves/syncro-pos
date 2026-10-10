"use client";

import { useState } from "react";
import { Beef, Coffee, Croissant, Hamburger, Pill, Shirt, Store, Wrench } from "lucide-react";

/**
 * The vertical picker: choose a kind of business, see what we'd build for it.
 * Each one is shown as a panel in its own colour carrying its icon.
 */
type Business = {
  id: string;
  label: string;
  icon: typeof Store;
  color: string;
  line: string;
  modules: string[];
};

const BUSINESSES: Business[] = [
  {
    id: "bodega",
    label: "Bodega",
    icon: Store,
    color: "#67C480",
    line: "Don Luis conoce a cada cliente por su nombre. Su Syncro también.",
    modules: ["Fiado por cliente", "Pedidos por WhatsApp", "Precios por mayor", "Vencimientos", "Delivery del barrio"],
  },
  {
    id: "minimarket",
    label: "Minimarket",
    icon: Store,
    color: "#3B9AE8",
    line: "Varias cajas, varios turnos, y al cerrar todo cuadra.",
    modules: ["Turnos de caja", "Control por cajero", "Promos del día", "Compras a proveedores", "Arqueo al cierre"],
  },
  {
    id: "panaderia",
    label: "Panadería",
    icon: Croissant,
    color: "#EBB65C",
    line: "Lo que sale del horno, contado desde que sale.",
    modules: ["Producción del día", "Merma de horneo", "Pedidos por encargo", "Venta por peso", "Turno de madrugada"],
  },
  {
    id: "cafeteria",
    label: "Cafetería",
    icon: Coffee,
    color: "#B07F5C",
    line: "Comandas que no se pierden y propinas que sí se reparten.",
    modules: ["Comandas por mesa", "Combos y promos", "Propinas por turno", "Recetas e insumos", "Clientes de siempre"],
  },
  {
    id: "hamburgueseria",
    label: "Hamburguesería",
    icon: Hamburger,
    color: "#ED7250",
    line: "Pedidos que entran por todos lados y salen en orden.",
    modules: ["Pedidos para llevar", "Extras y al gusto", "Delivery propio", "Tiempos de cocina", "Combos del día"],
  },
  {
    id: "carniceria",
    label: "Carnicería",
    icon: Beef,
    color: "#DD5A4E",
    line: "Vendes por peso y el precio sale solo.",
    modules: ["Venta por peso", "Cortes y despiece", "Pedidos por encargo", "Cadena de frío", "Precios del día"],
  },
  {
    id: "farmacia",
    label: "Farmacia",
    icon: Pill,
    color: "#189881",
    line: "Cada lote con su fecha y cada receta con su registro.",
    modules: ["Lotes y vencimientos", "Recetas", "Genéricos equivalentes", "Convenios", "Delivery de medicinas"],
  },
  {
    id: "ferreteria",
    label: "Ferretería",
    icon: Wrench,
    color: "#7E97A6",
    line: "Miles de piezas, cada una en su lugar y con su precio.",
    modules: ["Catálogo por medidas", "Cotizaciones", "Crédito a contratistas", "Alertas de reposición", "Órdenes de compra"],
  },
  {
    id: "boutique",
    label: "Boutique",
    icon: Shirt,
    color: "#EE93BB",
    line: "Vende en tienda, en Instagram y en línea con el mismo inventario.",
    modules: ["Tallas y colores", "Tienda en línea", "Apartados", "Lista de deseos", "Programa de puntos"],
  },
];

export function Adapt() {
  const [id, setId] = useState(BUSINESSES[0].id);
  const b = BUSINESSES.find((x) => x.id === id) ?? BUSINESSES[0];

  return (
    <div className="mt-14 grid items-stretch gap-6 lg:grid-cols-[1.05fr_1fr]">
      <div className="relative min-h-[380px] overflow-hidden rounded-[32px] bg-[#E9E6DF]">
        {/* Every business is a panel in its own colour; they cross-fade as you
            switch, so the block never blinks between two flat colours. */}
        {BUSINESSES.map((x) => {
          const XIcon = x.icon;
          return (
            <div
              key={x.id}
              aria-hidden={x.id !== id}
              className={`absolute inset-0 grid place-items-center transition-opacity duration-700 ${
                x.id === id ? "opacity-100" : "opacity-0"
              }`}
              style={{ backgroundImage: `linear-gradient(150deg, ${x.color}, ${x.color}CC)` }}
            >
              <XIcon className="size-32 text-white/85 md:size-40" strokeWidth={1.2} />
            </div>
          );
        })}

        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-7 pt-24">
          <p className="max-w-sm text-lg font-semibold leading-snug text-white">{b.line}</p>
        </div>
      </div>

      <div className="flex flex-col justify-between rounded-[32px] border border-black/[0.06] bg-white p-7 shadow-[0_20px_50px_-30px_rgba(0,0,0,0.25)] md:p-9">
        <div>
          <p className="text-sm font-medium text-[#7A756A]">Elige tu tipo de negocio</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {BUSINESSES.map((x) => (
              <button
                key={x.id}
                onClick={() => setId(x.id)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  x.id === id
                    ? "bg-[#16140F] text-white"
                    : "bg-[#F3F1EC] text-[#16140F] hover:bg-[#E9E6DF]"
                }`}
              >
                {x.label}
              </button>
            ))}
          </div>

          <p className="mt-9 text-sm font-medium text-[#7A756A]">Lo que construimos para ti</p>
          <ul className="mt-3 divide-y divide-black/[0.06]">
            {b.modules.map((m, i) => (
              <li
                key={`${b.id}-${m}`}
                className="flex items-center gap-3 py-3 text-[15px] font-semibold animate-in fade-in slide-in-from-bottom-1"
                style={{ animationDelay: `${i * 60}ms`, animationFillMode: "backwards" }}
              >
                <span className="grid size-6 place-items-center rounded-full bg-[#F26B3A]/12 text-[#F26B3A]">
                  <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 8.5l3.2 3L13 4.5" />
                  </svg>
                </span>
                {m}
              </li>
            ))}
          </ul>
        </div>
        <p className="mt-6 text-sm text-[#7A756A]">
          ¿Tu negocio es distinto? Perfecto. Así trabajamos: a la medida.
        </p>
      </div>
    </div>
  );
}
