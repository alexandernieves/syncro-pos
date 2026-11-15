import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { UploadService } from '../upload/upload.service';
import { CutoutError, removeBackground, safeImageUrl } from './cutout';

/** Backgrounds an ad can wear (the PWA draws each one); keep in sync with the frontend. */
export const AD_THEMES = ['sunset', 'mint', 'sky', 'lavender', 'lemon', 'berry', 'sand', 'night'] as const;

const productSelect = {
  id: true,
  name: true,
  image: true,
  businessId: true,
  variants: { select: { price: true, promoPrice: true }, take: 1 },
} as const;

/**
 * Syncro Credit "Para ti": product ads picked from Syncro Central. The products always come from
 * the catalog of the business the ad belongs to (checked on every write).
 */
@Injectable()
export class CreditAdsService {
  constructor(private readonly prisma: PrismaService, private readonly upload: UploadService) {}

  /** The bytes of a product photo: our own uploads from disk, anything else from the internet */
  private async loadImage(src: string): Promise<Buffer> {
    const own = src.match(/\/uploads\/(.+)$/);
    if (own && (src.startsWith('/') || (process.env.API_URL && src.startsWith(process.env.API_URL)) || /\/\/(localhost|127\.0\.0\.1)[:/]/.test(src))) {
      const root = path.join(process.cwd(), 'uploads');
      const file = path.join(root, path.normalize(decodeURIComponent(own[1])));
      if (file.startsWith(root + path.sep) && fs.existsSync(file)) return fs.readFileSync(file);
    }
    if (!safeImageUrl(src)) throw new BadRequestException('La foto del producto no tiene una dirección válida');
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12_000);
    try {
      const r = await fetch(src, { signal: ctrl.signal });
      if (!r.ok || !(r.headers.get('content-type') || '').startsWith('image/')) throw new BadRequestException('No se pudo descargar la foto del producto');
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length > 12 * 1024 * 1024) throw new BadRequestException('La foto es demasiado grande');
      return buf;
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      throw new BadRequestException('No se pudo descargar la foto del producto');
    } finally {
      clearTimeout(timer);
    }
  }

  /** Background removed from the product's photo, uploaded as the ad's own image */
  async cutout(productId: string) {
    const product = await this.prisma.product.findUnique({ where: { id: productId }, select: { image: true } });
    if (!product?.image) throw new BadRequestException('Este producto no tiene foto');
    let png: Buffer;
    try {
      png = await removeBackground(await this.loadImage(product.image));
    } catch (e: any) {
      if (e instanceof CutoutError) throw new BadRequestException(e.message);
      throw e;
    }
    const url = await this.upload.uploadFile({ buffer: png, mimetype: 'image/png', originalname: 'producto-sin-fondo.png' } as any, 'syncro-credit-ads');
    return { url };
  }

  private clean(body: any) {
    const data: any = {};
    if (body.headline !== undefined) data.headline = String(body.headline ?? '').trim().slice(0, 28) || null;
    if (body.image !== undefined) {
      const img = body.image ? String(body.image).slice(0, 600) : null;
      if (img && !/^(https?:\/\/|\/uploads\/)/.test(img)) throw new BadRequestException('Foto no válida');
      data.image = img;
    }
    if (body.theme !== undefined) {
      if (!AD_THEMES.includes(body.theme)) throw new BadRequestException('Fondo no válido');
      data.theme = body.theme;
    }
    if (body.active !== undefined) data.active = !!body.active;
    if (body.sortOrder !== undefined) data.sortOrder = Math.round(Number(body.sortOrder) || 0);
    if (body.endsAt !== undefined) data.endsAt = body.endsAt ? new Date(body.endsAt) : null;
    return data;
  }

  list() {
    return this.prisma.syncroCreditAd.findMany({
      orderBy: [{ active: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'desc' }],
      include: { business: { select: { id: true, name: true } }, product: { select: productSelect } },
    });
  }

  /** Products of one business to choose from (with a photo first: ads need one to look right) */
  async searchProducts(businessId: string, q = '') {
    if (!businessId) throw new BadRequestException('Elige un comercio');
    const products = await this.prisma.product.findMany({
      where: { businessId, ...(q.trim() ? { name: { contains: q.trim(), mode: 'insensitive' } } : {}) },
      select: productSelect,
      orderBy: { name: 'asc' },
      take: 60,
    });
    return products.sort((a, b) => Number(!!b.image) - Number(!!a.image));
  }

  async create(body: any) {
    const { businessId, productId } = body || {};
    const product = await this.prisma.product.findFirst({ where: { id: productId, businessId }, select: { id: true } });
    if (!product) throw new BadRequestException('El producto no es del catálogo de ese comercio');
    const last = await this.prisma.syncroCreditAd.aggregate({ _max: { sortOrder: true } });
    return this.prisma.syncroCreditAd.create({
      data: { businessId, productId, sortOrder: (last._max.sortOrder ?? 0) + 1, theme: 'sunset', ...this.clean(body) },
    });
  }

  async update(id: string, body: any) {
    const ad = await this.prisma.syncroCreditAd.findUnique({ where: { id } });
    if (!ad) throw new NotFoundException('Anuncio no encontrado');
    return this.prisma.syncroCreditAd.update({ where: { id }, data: this.clean(body) });
  }

  async remove(id: string) {
    await this.prisma.syncroCreditAd.delete({ where: { id } }).catch(() => { throw new NotFoundException('Anuncio no encontrado'); });
    return { ok: true };
  }

  /** For the PWA: active, not expired, from businesses present in Syncro Credit */
  async forPortal() {
    const now = new Date();
    const hidden = await this.prisma.setting.findMany({ where: { syncroCreditVisible: false, businessId: { not: null } }, select: { businessId: true } });
    const ads = await this.prisma.syncroCreditAd.findMany({
      where: {
        active: true,
        OR: [{ endsAt: null }, { endsAt: { gt: now } }],
        businessId: { notIn: hidden.map((h) => h.businessId as string) },
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      take: 12,
      include: { business: { select: { id: true, name: true } }, product: { select: productSelect } },
    });
    const branches = await this.prisma.branch.findMany({
      where: { businessId: { in: [...new Set(ads.map((a) => a.businessId))] }, isMain: true },
      include: { business: { select: { id: true, name: true, logo: true } } },
    });
    const branchOf = new Map(branches.map((b) => [b.businessId, b]));
    return ads.map((a) => {
      const v = a.product.variants[0];
      return {
        id: a.id,
        theme: a.theme,
        headline: a.headline,
        product: { id: a.product.id, name: a.product.name, image: a.image || a.product.image, price: v?.price ?? null, promoPrice: v?.promoPrice ?? null },
        business: a.business,
        branch: branchOf.get(a.businessId) ?? null,
      };
    });
  }
}
