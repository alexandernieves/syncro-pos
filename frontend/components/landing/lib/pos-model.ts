/**
 * The point-of-sale model, shared by the WebGL screen and the HTML simulator.
 *
 * Both surfaces render from this one module. That is what makes the dive work:
 * the cart painted onto the 3D display and the cart you can actually click on
 * once the camera is inside it are the same object, so the hand-off between
 * WebGL and the DOM has nothing to reconcile.
 */

export type Vertical = "bodega" | "ferreteria" | "minimarket" | "boutique";

export interface Product {
  id: string;
  name: string;
  /** Unit shown under the name: "1 kg", "talla M", "6 m". */
  unit: string;
  price: number;
  /** Sold by weight, so quantities carry decimals. */
  weighed?: boolean;
}

export interface CartLine extends Product {
  qty: number;
}

export interface VerticalProfile {
  id: Vertical;
  label: string;
  store: string;
  tagline: string;
  /** What this trade struggles with before Syncro. */
  pain: string;
  /** Modules Syncro switches on for it beyond the common four. */
  modules: string[];
  catalog: Product[];
}

/** Rate used for the second currency line. Editable in the real product. */
export const RATE = 36.85;

export const IVA = 0.16;

export const BASE_MODULES = ["Ventas", "Inventario", "Clientes", "Caja"];

export const VERTICALS: Record<Vertical, VerticalProfile> = {
  bodega: {
    id: "bodega",
    label: "Bodega",
    store: "Bodega La Esquina",
    tagline: "Fiado bajo control y cuadre de caja al centavo",
    pain: "El cuaderno de fiado se pierde y nadie sabe cuánto le deben.",
    modules: ["Fiado y cobranza", "Doble moneda", "Arqueo ciego", "Peso integrado"],
    catalog: [
      { id: "harina", name: "Harina de maíz", unit: "1 kg", price: 1.35 },
      { id: "refresco", name: "Refresco", unit: "2 L", price: 2.1 },
      { id: "cafe", name: "Café molido", unit: "500 g", price: 4.8 },
      { id: "aceite", name: "Aceite vegetal", unit: "1 L", price: 3.25 },
      { id: "queso", name: "Queso blanco", unit: "por kg", price: 6.4, weighed: true },
      { id: "arroz", name: "Arroz blanco", unit: "1 kg", price: 1.6 },
      { id: "pasta", name: "Pasta larga", unit: "500 g", price: 1.2 },
      { id: "azucar", name: "Azúcar", unit: "1 kg", price: 1.45 },
    ],
  },
  ferreteria: {
    id: "ferreteria",
    label: "Ferretería",
    store: "Ferretería El Tornillo",
    tagline: "Miles de referencias, precio mayor y detal, despacho",
    pain: "Doce mil referencias y el precio real solo lo sabe el dueño.",
    modules: ["Precio mayor y detal", "Fracciones", "Cotizaciones", "Despacho"],
    catalog: [
      { id: "cemento", name: "Cemento gris", unit: "42,5 kg", price: 8.9 },
      { id: "tubo", name: 'Tubo PVC 1/2"', unit: "6 m", price: 3.4 },
      { id: "pintura", name: "Pintura caucho", unit: "galón", price: 14.5 },
      { id: "tornillo", name: 'Tornillo 3"', unit: "caja 100", price: 5.75 },
      { id: "guantes", name: "Guantes de carnaza", unit: "par", price: 2.2 },
      { id: "cable", name: "Cable THW 12", unit: "por metro", price: 0.95, weighed: true },
      { id: "silicon", name: "Silicón transparente", unit: "300 ml", price: 3.8 },
      { id: "broca", name: "Juego de brocas", unit: "13 pzas", price: 9.4 },
    ],
  },
  minimarket: {
    id: "minimarket",
    label: "Minimarket",
    store: "Minimercado El Sol",
    tagline: "Alta rotación, vencimientos y varias cajas a la vez",
    pain: "Producto vencido en anaquel y faltantes que nadie explica.",
    modules: ["Multicaja", "Vencimientos", "Combos y ofertas", "Balanza"],
    catalog: [
      { id: "leche", name: "Leche entera", unit: "1 L", price: 1.9 },
      { id: "pan", name: "Pan de sándwich", unit: "unidad", price: 2.6 },
      { id: "jamon", name: "Jamón de pierna", unit: "250 g", price: 4.15 },
      { id: "cereal", name: "Cereal integral", unit: "500 g", price: 5.3 },
      { id: "jugo", name: "Jugo de naranja", unit: "1,5 L", price: 2.85 },
      { id: "huevos", name: "Cartón de huevos", unit: "30 u", price: 4.6 },
      { id: "yogurt", name: "Yogurt bebible", unit: "1 L", price: 3.1 },
      { id: "tomate", name: "Tomate", unit: "por kg", price: 1.75, weighed: true },
    ],
  },
  boutique: {
    id: "boutique",
    label: "Boutique",
    store: "Boutique Alma",
    tagline: "Tallas, colores, apartados y venta por redes",
    pain: "Vende por redes y el inventario vive en la cabeza de alguien.",
    modules: ["Tallas y colores", "Apartados", "Catálogo en línea", "Venta por redes"],
    catalog: [
      { id: "blusa", name: "Blusa de lino", unit: "talla M", price: 18.0 },
      { id: "jean", name: "Jean slim", unit: "talla 32", price: 26.5 },
      { id: "vestido", name: "Vestido estampado", unit: "talla S", price: 32.0 },
      { id: "sandalias", name: "Sandalias de cuero", unit: "talla 37", price: 24.9 },
      { id: "bolso", name: "Bolso bandolera", unit: "unidad", price: 29.5 },
      { id: "franela", name: "Franela básica", unit: "talla L", price: 11.0 },
      { id: "correa", name: "Correa de cuero", unit: "unidad", price: 14.0 },
      { id: "pantalon", name: "Pantalón de vestir", unit: "talla 30", price: 28.0 },
    ],
  },
};

export const VERTICAL_ORDER: Vertical[] = [
  "bodega",
  "ferreteria",
  "minimarket",
  "boutique",
];

/* ------------------------------------------------------------------ */
/* Money                                                               */
/* ------------------------------------------------------------------ */

export function money(n: number, decimals = 2) {
  return n.toLocaleString("es-VE", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export interface Totals {
  subtotal: number;
  iva: number;
  total: number;
  bs: number;
  items: number;
}

export function totalsOf(lines: CartLine[]): Totals {
  const subtotal = lines.reduce((sum, l) => sum + l.price * l.qty, 0);
  const iva = subtotal * IVA;
  const total = subtotal + iva;
  return {
    subtotal,
    iva,
    total,
    bs: total * RATE,
    items: lines.reduce((n, l) => n + (l.weighed ? 1 : l.qty), 0),
  };
}

/** Adds one unit, or a plausible weight for anything sold by the kilo. */
export function addToCart(lines: CartLine[], product: Product): CartLine[] {
  const existing = lines.find((l) => l.id === product.id);
  const step = product.weighed ? 0.25 : 1;
  if (existing) {
    return lines.map((l) =>
      l.id === product.id ? { ...l, qty: +(l.qty + step).toFixed(2) } : l
    );
  }
  return [...lines, { ...product, qty: product.weighed ? 0.85 : 1 }];
}

export function removeFromCart(lines: CartLine[], id: string): CartLine[] {
  const existing = lines.find((l) => l.id === id);
  if (!existing) return lines;
  const step = existing.weighed ? 0.25 : 1;
  const next = +(existing.qty - step).toFixed(2);
  if (next <= 0) return lines.filter((l) => l.id !== id);
  return lines.map((l) => (l.id === id ? { ...l, qty: next } : l));
}

/** The cart the 3D screen shows before anyone has touched anything. */
export function openingCart(vertical: Vertical): CartLine[] {
  const c = VERTICALS[vertical].catalog;
  return [
    { ...c[0], qty: 3 },
    { ...c[1], qty: 2 },
    { ...c[2], qty: 1 },
    { ...c[3], qty: 2 },
  ];
}

export function formatQty(line: CartLine) {
  return line.weighed ? money(line.qty, 2) : String(line.qty);
}
