/**
 * Procedural canvas textures for the WebGL stage.
 *
 * Everything is drawn at runtime with the 2D canvas API: no downloads, so the
 * page renders identically offline and inside the Electron build. The screen
 * painter deliberately mirrors the HTML simulator pixel for pixel, because the
 * scroll dives from one into the other and any difference would show.
 */

import { C } from "./palette";
import {
  VERTICALS,
  money,
  totalsOf,
  formatQty,
  RATE,
  type CartLine,
  type Vertical,
} from "./pos-model";

const FONT = `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
const MONO = `ui-monospace, SFMono-Regular, Menlo, monospace`;

function makeCanvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/* ------------------------------------------------------------------ */
/* POS screen                                                          */
/* ------------------------------------------------------------------ */

/** Screen geometry. The simulator uses these same ratios. */
export const SCREEN = {
  w: 1200,
  h: 750,
  bar: 64,
  /** Where the totals panel starts, as a fraction of the width. */
  split: 0.617,
  row: 68,
  /** Rows of the sale before it starts scrolling. */
  maxRows: 5,
  /** Top of the quick-pick grid, as a fraction of the height. */
  gridTop: 0.613,
} as const;

export interface ScreenState {
  vertical: Vertical;
  lines: CartLine[];
  /** Seconds since mount, for the caret and the connection dot. */
  time: number;
  /** Index of the line that was just rung up, highlighted. */
  justAdded?: string | null;
}

export class ScreenPainter {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor() {
    this.canvas = makeCanvas(SCREEN.w, SCREEN.h);
    this.ctx = this.canvas.getContext("2d")!;
  }

  paint(state: ScreenState) {
    const ctx = this.ctx;
    const { w, h, bar, split, row } = SCREEN;
    const splitX = Math.round(w * split);

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = C.screenBg;
    ctx.fillRect(0, 0, w, h);
    ctx.textBaseline = "middle";

    this.topBar(state, splitX);

    /* ---- cart ---- */
    ctx.fillStyle = C.muted;
    ctx.font = `700 12px ${FONT}`;
    ctx.fillText("CANT", 34, bar + 26);
    ctx.fillText("PRODUCTO", 110, bar + 26);
    ctx.textAlign = "right";
    ctx.fillText("IMPORTE", splitX - 34, bar + 26);
    ctx.textAlign = "left";

    ctx.fillStyle = C.lineSoft;
    ctx.fillRect(28, bar + 44, splitX - 56, 1);

    const top = bar + 45;
    const visible = state.lines.slice(-SCREEN.maxRows);

    visible.forEach((line, i) => {
      const y = top + i * row;
      const hot = state.justAdded === line.id;

      if (hot) {
        ctx.fillStyle = C.greenSoft;
        ctx.fillRect(28, y, splitX - 56, row);
        ctx.fillStyle = C.green;
        ctx.fillRect(28, y, 3, row);
      }

      ctx.fillStyle = C.ink;
      ctx.font = `600 16px ${MONO}`;
      ctx.fillText(formatQty(line), 38, y + row / 2);

      ctx.fillStyle = C.ink;
      ctx.font = `600 16px ${FONT}`;
      ctx.fillText(line.name, 110, y + row / 2 - 9);

      ctx.fillStyle = C.muted;
      ctx.font = `500 12px ${FONT}`;
      ctx.fillText(`${line.unit} · $ ${money(line.price)}`, 110, y + row / 2 + 11);

      ctx.textAlign = "right";
      ctx.fillStyle = C.ink;
      ctx.font = `700 17px ${MONO}`;
      ctx.fillText(`$ ${money(line.price * line.qty)}`, splitX - 34, y + row / 2);
      ctx.textAlign = "left";

      ctx.fillStyle = C.lineSoft;
      ctx.fillRect(28, y + row, splitX - 56, 1);
    });

    if (visible.length === 0) {
      ctx.fillStyle = C.muted;
      ctx.font = `500 15px ${FONT}`;
      const caret = Math.sin(state.time * 5) > 0 ? "|" : "";
      ctx.fillText(`Escanea o toca un producto ${caret}`, 38, top + 34);
    }

    this.quickGrid(state, splitX);

    this.totalsPanel(state, splitX);
  }

  /**
   * The favourites grid every counter POS has. It exists here mainly so the
   * 3D display and the clickable simulator show the same furniture at the
   * moment the camera passes through the glass.
   */
  private quickGrid(state: ScreenState, splitX: number) {
    const ctx = this.ctx;
    const { h } = SCREEN;
    const gridY = Math.round(h * SCREEN.gridTop);
    const catalog = VERTICALS[state.vertical].catalog.slice(0, 8);

    ctx.fillStyle = C.line;
    ctx.fillRect(28, gridY - 26, splitX - 56, 1);
    ctx.fillStyle = C.muted;
    ctx.font = `700 11px ${FONT}`;
    ctx.fillText("MÁS VENDIDOS", 34, gridY - 44);

    const cols = 4;
    const gap = 10;
    const usable = splitX - 56;
    const tw = (usable - gap * (cols - 1)) / cols;
    const th = 92;

    catalog.forEach((prod, i) => {
      const x = 28 + (i % cols) * (tw + gap);
      const y = gridY + Math.floor(i / cols) * (th + gap);

      ctx.fillStyle = C.surface;
      roundRect(ctx, x, y, tw, th, 8);
      ctx.fill();
      ctx.strokeStyle = C.line;
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = C.ink;
      ctx.font = `600 13px ${FONT}`;
      const name = prod.name.length > 16 ? prod.name.slice(0, 15) + "…" : prod.name;
      ctx.fillText(name, x + 12, y + 30);

      ctx.fillStyle = C.muted;
      ctx.font = `500 11px ${FONT}`;
      ctx.fillText(prod.unit, x + 12, y + 50);

      ctx.fillStyle = C.green;
      ctx.font = `700 15px ${MONO}`;
      ctx.fillText(`$ ${money(prod.price)}`, x + 12, y + 72);
    });
  }

  private topBar(state: ScreenState, splitX: number) {
    const ctx = this.ctx;
    const { w, bar } = SCREEN;
    const p = VERTICALS[state.vertical];

    ctx.fillStyle = C.surface;
    ctx.fillRect(0, 0, w, bar);
    ctx.fillStyle = C.line;
    ctx.fillRect(0, bar - 1, w, 1);

    ctx.fillStyle = C.green;
    roundRect(ctx, 28, 20, 24, 24, 7);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = `800 14px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillText("S", 40, 33);
    ctx.textAlign = "left";

    ctx.fillStyle = C.ink;
    ctx.font = `800 15px ${FONT}`;
    ctx.fillText("SYNCRO", 62, 32);

    ctx.fillStyle = C.muted;
    ctx.font = `500 14px ${FONT}`;
    ctx.fillText(p.store, 142, 32);

    // connection + clock
    const blink = 0.5 + 0.5 * Math.sin(state.time * 3);
    ctx.fillStyle = C.green;
    ctx.globalAlpha = 0.45 + blink * 0.55;
    ctx.beginPath();
    ctx.arc(w - 196, 32, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.fillStyle = C.body;
    ctx.font = `600 13px ${FONT}`;
    ctx.fillText("En línea", w - 182, 32);

    const mins = Math.floor(state.time * 2) % 60;
    ctx.fillStyle = C.body;
    ctx.font = `600 14px ${MONO}`;
    ctx.fillText(`14:${String(mins).padStart(2, "0")}`, w - 92, 32);
  }

  private totalsPanel(state: ScreenState, splitX: number) {
    const ctx = this.ctx;
    const { w, h, bar } = SCREEN;
    const t = totalsOf(state.lines);
    const px = splitX + 32;
    const right = w - 32;

    ctx.fillStyle = C.screenPanel;
    ctx.fillRect(splitX, bar, w - splitX, h - bar);
    ctx.fillStyle = C.line;
    ctx.fillRect(splitX, bar, 1, h - bar);

    ctx.fillStyle = C.body;
    ctx.font = `500 14px ${FONT}`;
    ctx.fillText("Subtotal", px, bar + 40);
    ctx.fillText("IVA 16%", px, bar + 70);
    ctx.textAlign = "right";
    ctx.fillStyle = C.ink;
    ctx.font = `600 14px ${MONO}`;
    ctx.fillText(`$ ${money(t.subtotal)}`, right, bar + 40);
    ctx.fillText(`$ ${money(t.iva)}`, right, bar + 70);
    ctx.textAlign = "left";

    ctx.fillStyle = C.line;
    ctx.fillRect(px, bar + 92, right - px, 1);

    ctx.fillStyle = C.muted;
    ctx.font = `700 11px ${FONT}`;
    ctx.fillText("TOTAL A PAGAR", px, bar + 118);

    ctx.fillStyle = C.ink;
    ctx.font = `800 46px ${FONT}`;
    ctx.fillText(`$ ${money(t.total)}`, px, bar + 156);

    ctx.fillStyle = C.green;
    ctx.font = `700 24px ${FONT}`;
    ctx.fillText(`Bs ${money(t.bs)}`, px, bar + 196);

    ctx.fillStyle = C.muted;
    ctx.font = `500 12px ${FONT}`;
    ctx.fillText(`Tasa del día · 1 USD = ${money(RATE)} Bs`, px, bar + 222);

    // payment methods
    const methods = ["Efectivo", "Pago móvil", "Tarjeta", "Fiado"];
    methods.forEach((m, i) => {
      const y = bar + 252 + i * 48;
      const sel = i === 1;
      ctx.fillStyle = sel ? C.greenSoft : C.surface;
      roundRect(ctx, px, y, right - px, 38, 8);
      ctx.fill();
      ctx.strokeStyle = sel ? C.green : C.line;
      ctx.lineWidth = sel ? 1.5 : 1;
      ctx.stroke();
      ctx.fillStyle = sel ? C.greenInk : C.body;
      ctx.font = `600 15px ${FONT}`;
      ctx.fillText(m, px + 16, y + 19);
    });

    // charge
    ctx.fillStyle = C.green;
    roundRect(ctx, px, h - 84, right - px, 56, 10);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = `800 19px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillText("COBRAR · F12", (px + right) / 2, h - 56);
    ctx.textAlign = "left";
  }
}

/* ------------------------------------------------------------------ */
/* Material maps                                                       */
/* ------------------------------------------------------------------ */

/** Fine brushed grain, used as a roughness map on the stand. */
export function brushedMetalMap(size = 512) {
  const c = makeCanvas(size, size);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#9a9a9a";
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < size * 12; i++) {
    const y = Math.random() * size;
    const x = Math.random() * size;
    const len = 20 + Math.random() * 140;
    const v = 140 + Math.random() * 80;
    ctx.strokeStyle = `rgba(${v},${v},${v},0.18)`;
    ctx.lineWidth = Math.random() < 0.8 ? 1 : 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len, y + (Math.random() - 0.5) * 1.5);
    ctx.stroke();
  }
  return c;
}

/** Subtle speckle for moulded plastic. */
export function softPlasticMap(size = 512) {
  const c = makeCanvas(size, size);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#6e6e6e";
  ctx.fillRect(0, 0, size, size);
  const img = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 34;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** Thermal receipt, printed on real-looking paper. */
export function receiptMap(vertical: Vertical, lines: CartLine[]) {
  const w = 420;
  const h = 1024;
  const c = makeCanvas(w, h);
  const ctx = c.getContext("2d")!;
  const p = VERTICALS[vertical];

  ctx.fillStyle = "#FBFAF6";
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 2200; i++) {
    ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.025})`;
    ctx.fillRect(Math.random() * w, Math.random() * h, 1, 1);
  }

  ctx.textBaseline = "middle";
  ctx.fillStyle = "#1a1a1a";
  ctx.textAlign = "center";
  ctx.font = `800 28px ${FONT}`;
  ctx.fillText(p.store.toUpperCase(), w / 2, 64);
  ctx.font = `500 15px ${MONO}`;
  ctx.fillStyle = "#4a4a4a";
  ctx.fillText("RIF J-40512233-8", w / 2, 92);
  ctx.fillText("FACTURA DE VENTA", w / 2, 116);
  ctx.textAlign = "left";

  ctx.strokeStyle = "#b9b9b9";
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.moveTo(28, 140);
  ctx.lineTo(w - 28, 140);
  ctx.stroke();
  ctx.setLineDash([]);

  let y = 174;
  lines.slice(0, 6).forEach((it) => {
    ctx.fillStyle = "#1a1a1a";
    ctx.font = `500 16px ${MONO}`;
    ctx.fillText(it.name.slice(0, 22), 28, y);
    ctx.font = `500 14px ${MONO}`;
    ctx.fillStyle = "#555";
    ctx.fillText(`${formatQty(it)} x ${money(it.price)}`, 28, y + 20);
    ctx.textAlign = "right";
    ctx.fillStyle = "#1a1a1a";
    ctx.font = `700 16px ${MONO}`;
    ctx.fillText(money(it.price * it.qty), w - 28, y + 10);
    ctx.textAlign = "left";
    y += 54;
  });

  ctx.strokeStyle = "#b9b9b9";
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.moveTo(28, y);
  ctx.lineTo(w - 28, y);
  ctx.stroke();
  ctx.setLineDash([]);

  const t = totalsOf(lines);
  y += 40;
  ctx.font = `500 16px ${MONO}`;
  ctx.fillStyle = "#333";
  ctx.fillText("SUBTOTAL", 28, y);
  ctx.textAlign = "right";
  ctx.fillText(money(t.subtotal), w - 28, y);
  ctx.textAlign = "left";
  y += 26;
  ctx.fillText("IVA 16%", 28, y);
  ctx.textAlign = "right";
  ctx.fillText(money(t.iva), w - 28, y);
  ctx.textAlign = "left";

  y += 44;
  ctx.fillStyle = "#000";
  ctx.font = `800 25px ${MONO}`;
  ctx.fillText("TOTAL $", 28, y);
  ctx.textAlign = "right";
  ctx.fillText(money(t.total), w - 28, y);
  ctx.textAlign = "left";

  y += 32;
  ctx.font = `700 19px ${MONO}`;
  ctx.fillStyle = "#222";
  ctx.fillText("TOTAL Bs", 28, y);
  ctx.textAlign = "right";
  ctx.fillText(money(t.bs), w - 28, y);
  ctx.textAlign = "left";

  y += 50;
  let bx = 40;
  while (bx < w - 40) {
    const bw = 1 + Math.floor(Math.random() * 4);
    ctx.fillStyle = "#141414";
    ctx.fillRect(bx, y, bw, 58);
    bx += bw + 1 + Math.floor(Math.random() * 4);
  }

  ctx.textAlign = "center";
  ctx.fillStyle = "#666";
  ctx.font = `600 14px ${FONT}`;
  ctx.fillText("Gracias por su compra", w / 2, y + 92);
  ctx.fillText("Emitido con SYNCRO POS", w / 2, y + 114);
  ctx.textAlign = "left";

  return c;
}

/**
 * Packaging for the stock sitting on the counter. Kept to plain kraft and
 * white card with one flat band — grocery packaging, not a neon prop.
 */
export function productLabelMap(title: string, sub: string, band: string) {
  const w = 512;
  const h = 512;
  const c = makeCanvas(w, h);
  const ctx = c.getContext("2d")!;

  ctx.fillStyle = "#EFE9DC";
  ctx.fillRect(0, 0, w, h);

  // faint card grain
  for (let i = 0; i < 5000; i++) {
    ctx.fillStyle = `rgba(120,100,70,${Math.random() * 0.05})`;
    ctx.fillRect(Math.random() * w, Math.random() * h, 2, 1);
  }

  ctx.fillStyle = band;
  ctx.fillRect(0, 96, w, 78);

  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffffff";
  ctx.font = `800 40px ${FONT}`;
  ctx.fillText(title.slice(0, 14), 34, 136);

  ctx.fillStyle = "#3B352A";
  ctx.font = `600 24px ${FONT}`;
  ctx.fillText(sub, 34, 214);

  ctx.fillStyle = "#8C8577";
  ctx.font = `500 18px ${FONT}`;
  ctx.fillText("CONT. NETO 1 kg", 34, 250);

  // barcode block
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(34, 336, w - 68, 124);
  let bx = 52;
  while (bx < w - 72) {
    const bw = 1 + Math.floor(Math.random() * 5);
    ctx.fillStyle = "#141414";
    ctx.fillRect(bx, 352, bw, 70);
    bx += bw + 2 + Math.floor(Math.random() * 4);
  }
  ctx.fillStyle = "#141414";
  ctx.font = `600 18px ${MONO}`;
  ctx.textAlign = "center";
  ctx.fillText("7 591234 567890", w / 2, 440);
  ctx.textAlign = "left";

  return c;
}
