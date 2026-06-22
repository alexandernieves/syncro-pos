import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CategoriesService {
  constructor(
    private prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  private cacheKey(businessId?: string) {
    return `categories:all:${businessId || 'none'}`;
  }

  private async invalidate(businessId?: string) {
    try {
      await this.cacheManager.del(this.cacheKey(businessId));
      await this.cacheManager.del(this.cacheKey(undefined));
    } catch (err: any) {
      console.error('[Cache] Error invalidating categories cache:', err.message);
    }
  }

  async create(data: any) {
    const result = await this.prisma.category.create({ data });
    await this.invalidate(data.businessId);
    return result;
  }

  async findAll(businessId?: string) {
    const key = this.cacheKey(businessId);
    try {
      const cached = await this.cacheManager.get<any[]>(key);
      if (cached) {
        console.log(`[Cache] Categories cache hit: ${key}`);
        return cached;
      }
    } catch (err: any) {
      console.error('[Cache] Error reading categories cache:', err.message);
    }

    const where: any = {};
    if (businessId) {
      where.businessId = businessId;
    }
    const categories = await this.prisma.category.findMany({ where });

    try {
      await this.cacheManager.set(key, categories, 10 * 60 * 1000); // 10 min TTL
      console.log(`[Cache] Cached categories: ${key}`);
    } catch (err: any) {
      console.error('[Cache] Error writing categories cache:', err.message);
    }

    return categories;
  }

  async findOne(id: string, businessId?: string) {
    const where: any = { id };
    if (businessId) {
      where.businessId = businessId;
    }
    const category = await this.prisma.category.findFirst({ where });
    if (!category) throw new NotFoundException('Categoría no encontrada');
    return category;
  }

  async update(id: string, data: any, businessId?: string) {
    await this.findOne(id, businessId);
    const result = await this.prisma.category.update({ where: { id }, data });
    await this.invalidate(businessId);
    return result;
  }

  async remove(id: string, businessId?: string) {
    await this.findOne(id, businessId);
    const result = await this.prisma.category.delete({ where: { id } });
    await this.invalidate(businessId);
    return result;
  }
}
