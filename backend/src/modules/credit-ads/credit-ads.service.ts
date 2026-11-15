import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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
  constructor(private readonly prisma: PrismaService) {}

  private clean(body: any) {
    const data: any = {};
    if (body.headline !== undefined) data.headline = String(body.headline ?? '').trim().slice(0, 28) || null;
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
        product: { id: a.product.id, name: a.product.name, image: a.product.image, price: v?.price ?? null, promoPrice: v?.promoPrice ?? null },
        business: a.business,
        branch: branchOf.get(a.businessId) ?? null,
      };
    });
  }
}
