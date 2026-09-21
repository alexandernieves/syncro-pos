/**
 * Real photography and footage used across the landing.
 *
 * Every asset here is an actual photograph or video clip of a real shop, not a
 * generated image. They come from Pexels, whose licence allows commercial use
 * without attribution; the credits are kept anyway so the source of any frame
 * can be traced later.
 *
 * Note on the captions: the pain and the fix are written in the copy layer, and
 * the Syncro interface is composited beside the photo as real markup. Nothing
 * is painted into the photographs themselves — a shop that never used Syncro
 * should not appear to be running it.
 */

export interface ReelItem {
  id: string;
  kind: "photo" | "video";
  src: string;
  /** Still frame shown while a clip loads, and on devices that refuse autoplay. */
  poster?: string;
  alt: string;
  trade: string;
  pain: string;
  fix: string;
  credit: string;
}

const SHOPS = "/media/shops";
const CLIPS = "/media/clips";

export const REEL: ReelItem[] = [
  {
    id: "fiado",
    kind: "photo",
    src: `${SHOPS}/bodega-mostrador.jpg`,
    alt: "Bodeguero detrás del mostrador de su abasto, con plátanos colgando y estantes de enlatados",
    trade: "Bodega",
    pain: "El fiado se pierde.",
    fix: "Cada deuda con nombre, límite y fecha.",
    credit: "Pexels",
  },
  {
    id: "cola",
    kind: "video",
    src: `${CLIPS}/caja-pago.mp4`,
    poster: `${SHOPS}/minimarket-duenos.jpg`,
    alt: "Clientes pagando su compra en la caja de un comercio",
    trade: "Caja",
    pain: "La cola no avanza.",
    fix: "Cobras en segundos, en las dos monedas.",
    credit: "Pexels",
  },
  {
    id: "referencias",
    kind: "photo",
    src: `${SHOPS}/ferreteria-pasillo.jpg`,
    alt: "Pasillo de una ferretería con miles de herramientas y repuestos colgados",
    trade: "Ferretería",
    pain: "Nadie sabe el precio.",
    fix: "Mayor y detal, a mano de cualquier cajero.",
    credit: "Pexels",
  },
  {
    id: "quiebre",
    kind: "photo",
    src: `${SHOPS}/bodega-abarrotes.jpg`,
    alt: "Pared de abarrotes y golosinas en una tienda de esquina",
    trade: "Abastos",
    pain: "Se acabó y no lo viste.",
    fix: "Te avisa antes del quiebre.",
    credit: "Pexels",
  },
  {
    id: "arqueo",
    kind: "video",
    src: `${CLIPS}/supermercado.mp4`,
    poster: `${SHOPS}/minimarket-equipo.jpg`,
    alt: "Clientes recorriendo los pasillos de un supermercado",
    trade: "Minimarket",
    pain: "La caja no cuadra.",
    fix: "Arqueo ciego en cada turno.",
    credit: "Pexels",
  },
  {
    id: "cotizacion",
    kind: "photo",
    src: `${SHOPS}/ferreteria-taller.jpg`,
    alt: "Comerciante ordenando herramientas en su taller",
    trade: "Taller",
    pain: "Cotizas a mano.",
    fix: "Cotización lista en un minuto.",
    credit: "Pexels",
  },
  {
    id: "redes",
    kind: "photo",
    src: `${SHOPS}/boutique-online.jpg`,
    alt: "Comerciante gestionando pedidos de su tienda en línea entre cajas de envío",
    trade: "Boutique",
    pain: "El stock vive en tu cabeza.",
    fix: "Catálogo y apartados sincronizados.",
    credit: "Pexels",
  },
  {
    id: "margen",
    kind: "video",
    src: `${CLIPS}/mercado.mp4`,
    poster: `${SHOPS}/verduleria.jpg`,
    alt: "Interior de un mercado con puestos de comida",
    trade: "Mercado",
    pain: "No sabes qué deja ganancia.",
    fix: "Margen real por producto.",
    credit: "Pexels",
  },
  {
    id: "libertad",
    kind: "photo",
    src: `${SHOPS}/dueno-descanso.jpg`,
    alt: "Dueño de una tienda sentado a la entrada de su negocio",
    trade: "Dueño",
    pain: "No te puedes ir.",
    fix: "Tu negocio, en el teléfono.",
    credit: "Pexels",
  },
];

/** Pages of the printed catalogue Syncro generates from the shop's own stock. */
export interface CatalogProduct {
  name: string;
  unit: string;
  price: number;
  photo: string;
}

const P = "/media/products";

export const CATALOG_PRODUCTS: CatalogProduct[] = [
  { name: "Harina de trigo", unit: "1 kg", price: 1.35, photo: `${P}/harina.jpg` },
  { name: "Arroz blanco", unit: "1 kg", price: 1.6, photo: `${P}/arroz.jpg` },
  { name: "Pasta larga", unit: "500 g", price: 1.2, photo: `${P}/pasta.jpg` },
  { name: "Pasta corta", unit: "500 g", price: 1.25, photo: `${P}/pasta-corta.jpg` },
  { name: "Granos surtidos", unit: "por kg", price: 2.4, photo: `${P}/granos.jpg` },
  { name: "Café molido", unit: "500 g", price: 4.8, photo: `${P}/cafe.jpg` },
  { name: "Conservas", unit: "unidad", price: 2.9, photo: `${P}/conservas.jpg` },
  { name: "Verduras del día", unit: "por kg", price: 1.75, photo: `${P}/verduras.jpg` },
  { name: "Surtido del hogar", unit: "combo", price: 12.5, photo: `${P}/surtido.jpg` },
  { name: "Despensa básica", unit: "combo", price: 9.9, photo: `${P}/despensa.jpg` },
];
