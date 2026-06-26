import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SettingsService {
  constructor(
    private prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  private cacheKey(businessId: string) {
    return `settings:${businessId}`;
  }

  async invalidateSettingsCache(businessId: string) {
    try {
      await this.cacheManager.del(this.cacheKey(businessId));
      console.log(`[Cache] Evicted settings cache for business: ${businessId}`);
    } catch (err: any) {
      console.error('[Cache] Error invalidating settings cache:', err.message);
    }
  }

  async getSettings(businessId: string) {
    if (!businessId) return null;

    const key = this.cacheKey(businessId);
    try {
      const cached = await this.cacheManager.get<any>(key);
      if (cached) {
        console.log(`[Cache] Settings cache hit: ${key}`);
        return cached;
      }
    } catch (err: any) {
      console.error('[Cache] Error reading settings cache:', err.message);
    }
    
    let settings = await this.prisma.setting.findFirst({
      where: { businessId }
    });

    if (!settings) {
      console.log(`Settings: Initializing default settings for business ${businessId}`);
      settings = await this.prisma.setting.create({
        data: { businessId }
      });
    }

    try {
      // Settings rarely change — cache for 15 minutes
      await this.cacheManager.set(key, settings, 15 * 60 * 1000);
      console.log(`[Cache] Cached settings: ${key}`);
    } catch (err: any) {
      console.error('[Cache] Error writing settings cache:', err.message);
    }

    return settings;
  }

  async updateSettings(updateData: any, businessId: string) {
    if (!businessId) throw new Error('Business ID is required');

    // Always fetch from DB directly (not cache) so we have the correct settings.id
    let settings = await this.prisma.setting.findFirst({ where: { businessId } });
    if (!settings) {
      settings = await this.prisma.setting.create({ data: { businessId } });
    }
    
    // Lista de campos permitidos en el modelo Setting para evitar errores de Prisma
    const allowedFields = [
      'businessName', 'businessAddress', 'businessPhone', 'businessEmail', 'businessIcon',
      'ruc', 'address', 'phone', 'email', 'website', 'country', 'currency',
      'taxRate', 'taxEnabled', 'igtfRate', 'receiptFooter',
      'pagoMovilBank', 'pagoMovilId', 'pagoMovilPhone', 'pagoMovilEnabled',
      'binanceId', 'binanceEmail', 'binanceEnabled',
      'zinliEmail', 'zinliEnabled',
      'paypalEmail', 'paypalEnabled',
      'requireClient', 'printOnSale', 'lowStockAlert', 'allowNegativeStock',
      'defaultPrinter', 'paperWidth', 'copiesPerSale',
      'paymentMethods', 'discountPin', 'pinPermissions',
      'syncroCreditMaxInstallments', 'syncroCreditFrequencyDays',
      'salesGoal', 'showSalesGoal', 'showNetMargin',
      'exchangeRate', 'exchangeRateEur', 'bcvUpdateDate',
      'exchangeRateDashboard', 'exchangeRateDashboardEur', 'bcvUpdateDateDashboard',
      'whatsappBotEnabled', 'whatsappAuthorizedPhones'
    ];

    const filteredData: any = {};
    for (const key of allowedFields) {
      if (updateData[key] !== undefined) {
        filteredData[key] = updateData[key];
      }
    }

    try {
      const result = await this.prisma.setting.update({
        where: { id: settings.id },
        data: filteredData
      });
      // Invalidate cache immediately so next GET returns fresh data
      await this.invalidateSettingsCache(businessId);
      console.log(`[Settings] Updated fields for business ${businessId}:`, Object.keys(filteredData));
      return result;
    } catch (error) {
      console.error("ERROR AL ACTUALIZAR CONFIGURACIÓN:", error);
      throw error;
    }
  }
}
