/**
 * Composes the printed catalogue pages that get wrapped onto the 3D book.
 *
 * Each page is drawn into a canvas: the real product photograph, then the name,
 * unit and price typed over it in the same design language as the rest of the
 * page. Syncro builds this from whatever stock the shop already has, so the
 * pages are generated rather than designed one by one.
 */

import { C } from "./palette";
import { CATALOG_PRODUCTS, type CatalogProduct } from "./media";
import { money } from "./pos-model";

const FONT = `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
const MONO = `ui-monospace, SFMono-Regular, Menlo, monospace`;

export const PAGE_PX = { w: 1024, h: 1365 };

function canvas() {
  const c = document.createElement("canvas");
  c.width = PAGE_PX.w;
  c.height = PAGE_PX.h;
  return c;
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Draws `img` filling the box, cropping the overflow like object-fit: cover. */
function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const scale = Math.max(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  ctx.restore();
}

async function productPage(p: CatalogProduct, index: number) {
  const c = canvas();
  const ctx = c.getContext("2d")!;
  const { w, h } = PAGE_PX;

  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, w, h);
  ctx.textBaseline = "middle";

  const img = await loadImage(p.photo);
  const photoH = Math.round(h * 0.58);
  if (img) {
    drawCover(ctx, img, 0, 0, w, photoH);
  } else {
    ctx.fillStyle = C.paperDeep;
    ctx.fillRect(0, 0, w, photoH);
  }

  ctx.fillStyle = C.line;
  ctx.fillRect(64, photoH + 64, w - 128, 1);

  ctx.fillStyle = C.muted;
  ctx.font = `700 22px ${FONT}`;
  ctx.fillText(`REFERENCIA ${String(index + 1).padStart(3, "0")}`, 64, photoH + 36);

  ctx.fillStyle = C.ink;
  ctx.font = `800 60px ${FONT}`;
  ctx.fillText(p.name, 64, photoH + 132);

  ctx.fillStyle = C.body;
  ctx.font = `500 30px ${FONT}`;
  ctx.fillText(p.unit, 64, photoH + 186);

  ctx.fillStyle = C.green;
  ctx.font = `800 84px ${FONT}`;
  ctx.fillText(`$ ${money(p.price)}`, 64, photoH + 280);

  ctx.fillStyle = C.muted;
  ctx.font = `600 26px ${MONO}`;
  ctx.fillText(`Bs ${money(p.price * 36.85)}`, 64, photoH + 344);

  // footer
  ctx.fillStyle = C.line;
  ctx.fillRect(64, h - 96, w - 128, 1);
  ctx.fillStyle = C.muted;
  ctx.font = `600 22px ${FONT}`;
  ctx.fillText("Catálogo generado con SYNCRO", 64, h - 58);
  ctx.textAlign = "right";
  ctx.fillText(String(index + 1), w - 64, h - 58);
  ctx.textAlign = "left";

  return c;
}

function coverPage(store: string, front: boolean) {
  const c = canvas();
  const ctx = c.getContext("2d")!;
  const { w, h } = PAGE_PX;

  ctx.fillStyle = C.green;
  ctx.fillRect(0, 0, w, h);
  ctx.textBaseline = "middle";

  if (front) {
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = `700 26px ${FONT}`;
    ctx.fillText("SYNCRO POS", 72, 120);

    ctx.fillStyle = "#FFFFFF";
    ctx.font = `800 104px ${FONT}`;
    ctx.fillText("Catálogo", 72, h / 2 - 110);
    ctx.fillText("de la", 72, h / 2 - 10);
    ctx.fillText("semana", 72, h / 2 + 90);

    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = `600 34px ${FONT}`;
    ctx.fillText(store, 72, h / 2 + 200);

    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = `500 24px ${FONT}`;
    ctx.fillText("Precios en dólares y bolívares", 72, h - 120);
  } else {
    ctx.fillStyle = "#FFFFFF";
    ctx.font = `800 58px ${FONT}`;
    ctx.fillText("Pide por", 72, h / 2 - 60);
    ctx.fillText("WhatsApp", 72, h / 2 + 10);
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.font = `500 28px ${FONT}`;
    ctx.fillText("y retira hoy en la tienda", 72, h / 2 + 90);
  }

  return c;
}

export interface CatalogSpread {
  front: HTMLCanvasElement;
  back: HTMLCanvasElement;
}

/**
 * Builds the leaves of the book. Each leaf carries two faces, so the products
 * are paired up and the covers bookend the run.
 */
export async function buildCatalog(store: string): Promise<CatalogSpread[]> {
  const products = CATALOG_PRODUCTS;
  const pages = await Promise.all(products.map((p, i) => productPage(p, i)));

  const leaves: CatalogSpread[] = [];
  leaves.push({ front: coverPage(store, true), back: pages[0] });
  for (let i = 1; i < pages.length - 1; i += 2) {
    leaves.push({ front: pages[i], back: pages[i + 1] ?? pages[i] });
  }
  leaves.push({
    front: pages[pages.length - 1],
    back: coverPage(store, false),
  });
  return leaves;
}
