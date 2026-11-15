/**
 * Removes the background of a product photo (catalog style: the product on a plain, mostly
 * uniform backdrop). No AI service, no third parties: the backdrop colour is read from the
 * picture's border, everything connected to the border that looks like it becomes transparent
 * (so white parts INSIDE the product, like a label, stay), the edge is softened and cleaned of
 * the backdrop's tint, and the result is trimmed to the product.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const sharp = require('sharp');

export class CutoutError extends Error {}

export async function removeBackground(input: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(input)
    .rotate()
    .resize({ width: 1000, height: 1000, fit: 'inside', withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const W: number = info.width;
  const H: number = info.height;
  const px = data as Buffer; // RGBA
  const N = W * H;

  // 1) Backdrop colour: the median of the border pixels
  const border: number[] = [];
  for (let x = 0; x < W; x++) { border.push(x, (H - 1) * W + x); }
  for (let y = 1; y < H - 1; y++) { border.push(y * W, y * W + W - 1); }
  const transparentBorder = border.filter((i) => px[i * 4 + 3] < 20).length / border.length;
  const median = (c: number) => {
    const v = border.filter((i) => px[i * 4 + 3] >= 20).map((i) => px[i * 4 + c]).sort((a, b) => a - b);
    return v.length ? v[Math.floor(v.length / 2)] : 255;
  };
  const bg = [median(0), median(1), median(2)];
  const dist = (i: number) => {
    const o = i * 4;
    const dr = px[o] - bg[0], dg = px[o + 1] - bg[1], db = px[o + 2] - bg[2];
    return Math.sqrt(dr * dr + dg * dg + db * db);
  };

  // 2) Flood fill from the border over everything close to the backdrop colour
  const T = 42;
  const isBg = new Uint8Array(N);
  const queue = new Int32Array(N);
  let head = 0;
  let tail = 0;
  const seed = (i: number) => {
    if (isBg[i]) return;
    if (px[i * 4 + 3] < 20 || dist(i) < T) { isBg[i] = 1; queue[tail++] = i; }
  };
  border.forEach(seed);
  while (head < tail) {
    const i = queue[head++];
    const x = i % W, y = (i / W) | 0;
    if (x > 0) seed(i - 1);
    if (x < W - 1) seed(i + 1);
    if (y > 0) seed(i - W);
    if (y < H - 1) seed(i + W);
  }
  const bgShare = tail / N;
  if (transparentBorder < 0.5 && (bgShare < 0.04 || bgShare > 0.97)) {
    throw new CutoutError('No se pudo separar el fondo de esta foto (el fondo no es de un solo color).');
  }

  // 3) Transparent backdrop; soft, de-tinted edge (2 px ring around the product)
  const near = (i: number, r: number) => {
    const x = i % W, y = (i / W) | 0;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
      if (isBg[yy * W + xx]) return true;
    }
    return false;
  };
  for (let i = 0; i < N; i++) {
    const o = i * 4;
    if (isBg[i]) { px[o + 3] = 0; continue; }
    if (!near(i, 2)) continue;
    const a = Math.max(0, Math.min(1, (dist(i) - T * 0.55) / (T * 1.1)));
    px[o + 3] = Math.min(px[o + 3], Math.round(a * 255));
    if (a > 0.02 && a < 1) {
      // take the backdrop's tint out of the half-covered edge pixels
      for (let c = 0; c < 3; c++) px[o + c] = Math.max(0, Math.min(255, Math.round((px[o + c] - (1 - a) * bg[c]) / a)));
    }
  }

  // 3b) The floor shadow (very light grey under the product, touching the backdrop) would show as a
  //     pale stain on a coloured card: it becomes a soft, see-through dark shadow instead. Only in
  //     the lower part of the product, so light-coloured products themselves are left alone.
  let bx0 = W, by0 = H, bx1 = -1, by1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (px[(y * W + x) * 4 + 3] > 12) { if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y; }
  }
  if (bx1 >= 0) {
    const bgLum = (bg[0] + bg[1] + bg[2]) / 3;
    const floorY = by0 + (by1 - by0) * 0.55;
    const RANGE = 48;
    const isShadow = new Uint8Array(N);
    head = 0; tail = 0;
    const shadowy = (i: number) => {
      const o = i * 4;
      if (isBg[i] || isShadow[i] || px[o + 3] < 12) return false;
      if ((i / W | 0) < floorY) return false;
      const r = px[o], g = px[o + 1], b = px[o + 2];
      const chroma = Math.max(r, g, b) - Math.min(r, g, b);
      const lum = (r + g + b) / 3;
      return chroma < 34 && bgLum - lum < RANGE && bgLum - lum > -6;
    };
    for (let i = 0; i < N; i++) {
      if (!isBg[i]) continue;
      const x = i % W;
      for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) {
        if (j >= 0 && j < N && shadowy(j)) { isShadow[j] = 1; queue[tail++] = j; }
      }
    }
    while (head < tail) {
      const i = queue[head++];
      const x = i % W;
      for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) {
        if (j >= 0 && j < N && shadowy(j)) { isShadow[j] = 1; queue[tail++] = j; }
      }
    }
    for (let i = 0; i < N; i++) {
      if (!isShadow[i]) continue;
      const o = i * 4;
      const lum = (px[o] + px[o + 1] + px[o + 2]) / 3;
      const k = Math.max(0, Math.min(1, (bgLum - lum) / RANGE));
      px[o] = 52; px[o + 1] = 38; px[o + 2] = 28;
      px[o + 3] = Math.round(Math.pow(k, 1.2) * 0.7 * 255);
    }
  }

  // 4) Trim to the product (with a little air around it)
  let minX = W, minY = H, maxX = -1, maxY = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (px[(y * W + x) * 4 + 3] > 12) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  }
  if (maxX < 0) throw new CutoutError('No quedó nada del producto al quitar el fondo.');
  const pad = Math.round(Math.max(maxX - minX, maxY - minY) * 0.04);
  const left = Math.max(0, minX - pad), top = Math.max(0, minY - pad);
  const width = Math.min(W - left, maxX - minX + 1 + pad * 2), height = Math.min(H - top, maxY - minY + 1 + pad * 2);
  return sharp(px, { raw: { width: W, height: H, channels: 4 } }).extract({ left, top, width, height }).png().toBuffer();
}

/** Only real image URLs on the internet (no internal addresses) */
export function safeImageUrl(u: string) {
  try {
    const url = new URL(u);
    if (!/^https?:$/.test(url.protocol)) return false;
    const h = url.hostname;
    if (h === 'localhost' || /^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h)) return false;
    return true;
  } catch {
    return false;
  }
}
