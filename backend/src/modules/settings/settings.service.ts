import { CATALOG_CODES, USABLE_STATUSES } from '../business-modules/catalog';
import { BadRequestException, Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeAlerts } from '../whatsapp/whatsapp-alerts.config';
import { cleanLateFees } from '../lending/late-fees';
import { isTheme, normalizeThemes, type ThemeId } from './themes';

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

  /** The business's logo (Business.logo): shown to its clients in Syncro Credit */
  async businessLogo(businessId: string) {
    const b = await this.prisma.business.findUnique({ where: { id: businessId }, select: { logo: true } });
    return b?.logo ?? null;
  }

  async updateSettings(updateData: any, businessId: string) {
    if (!businessId) throw new Error('Business ID is required');
    if (updateData?.businessLogo !== undefined) {
      const logo = updateData.businessLogo ? String(updateData.businessLogo).slice(0, 600) : null;
      if (logo && !/^(https?:\/\/|\/uploads\/)/.test(logo)) throw new Error('Logo no válido');
      await this.prisma.business.update({ where: { id: businessId }, data: { logo } });
    }

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
      'syncroCreditInitialLimit', 'syncroCreditMaxLimit', 'syncroCreditLimitStep',
      'syncroCreditVisible', 'syncroCreditPromoTitle', 'syncroCreditPromoText', 'syncroCreditRate', 'syncroCreditRateCustom', 'syncroCreditLateFees',
      'salesGoal', 'showSalesGoal', 'showNetMargin',
      'exchangeRate', 'exchangeRateEur', 'bcvUpdateDate',
      'exchangeRateDashboard', 'exchangeRateDashboardEur', 'bcvUpdateDateDashboard',
      'exchangeRateCop', 'copRateManual', 'copUpdateDate',
      'whatsappBotEnabled', 'whatsappAuthorizedPhones', 'whatsappAlerts',
      'businessType', 'enabledModules', 'sidebarOrder',
      'blindShiftClose',
      'isSyncroVendor', 'syncroVendorStoreName', 'syncroVendorCategory',
      'syncroVendorPhone', 'syncroVendorBio', 'syncroAutoSync',
      'syncroShopSectionTitle', 'syncroShopLocation',
      'invoiceDesign', 'gymSettings', 'autoBag'
    ];

    const filteredData: any = {};
    for (const key of allowedFields) {
      if (updateData[key] !== undefined) {
        filteredData[key] = updateData[key];
      }
    }

    // Syncro Credit (PWA): sane installment rules and short texts for the app's card
    if (filteredData.syncroCreditFrequencyDays !== undefined) filteredData.syncroCreditFrequencyDays = Math.min(90, Math.max(1, Math.round(Number(filteredData.syncroCreditFrequencyDays) || 15)));
    if (filteredData.syncroCreditMaxInstallments !== undefined) filteredData.syncroCreditMaxInstallments = Math.min(24, Math.max(1, Math.round(Number(filteredData.syncroCreditMaxInstallments) || 3)));
    if (filteredData.syncroCreditVisible !== undefined) filteredData.syncroCreditVisible = !!filteredData.syncroCreditVisible;
    if (filteredData.syncroCreditRate !== undefined && !['usd', 'eur', 'cop', 'custom'].includes(filteredData.syncroCreditRate)) filteredData.syncroCreditRate = 'usd';
    if (filteredData.syncroCreditRateCustom !== undefined) {
      const n = Number(filteredData.syncroCreditRateCustom);
      filteredData.syncroCreditRateCustom = Number.isFinite(n) && n > 1 && n < 10000000 ? Math.round(n * 10000) / 10000 : null;
    }
    for (const [k, max] of [['syncroCreditPromoTitle', 40], ['syncroCreditPromoText', 90]] as const) {
      if (filteredData[k] !== undefined) filteredData[k] = String(filteredData[k] ?? '').trim().slice(0, max) || null;
    }

    // Late charges: clean values; turning them on stamps "since" so earlier late days are never charged
    if (filteredData.syncroCreditLateFees !== undefined) {
      const next = cleanLateFees(filteredData.syncroCreditLateFees);
      const prev = cleanLateFees((await this.prisma.setting.findFirst({ where: { businessId }, select: { syncroCreditLateFees: true } }))?.syncroCreditLateFees);
      next.since = next.enabled ? (prev.enabled && prev.since ? prev.since : new Date().toISOString()) : null;
      filteredData.syncroCreditLateFees = next;
    }

    // Avisos por WhatsApp: only a valid configuration is stored
    if (filteredData.whatsappAlerts !== undefined) filteredData.whatsappAlerts = normalizeAlerts(filteredData.whatsappAlerts);

    // Automatic bag: only a product of this business
    if (filteredData.autoBag !== undefined) filteredData.autoBag = await this.normalizeAutoBag(filteredData.autoBag, businessId);

    // Packaged modules (gym…) are turned on from Syncro central, never from the business's own switches
    if (Array.isArray(filteredData.enabledModules)) {
      const usable = await this.prisma.businessModule.findMany({ where: { businessId, status: { in: USABLE_STATUSES } }, select: { moduleCode: true } });
      filteredData.enabledModules = [
        ...filteredData.enabledModules.filter((m: unknown) => typeof m === 'string' && !CATALOG_CODES.includes(m)),
        ...usable.map((u) => u.moduleCode),
      ];
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

  /** POS automatic bag: { enabled, variantId, productId, name } with a variant that belongs to the business. */
  private async normalizeAutoBag(raw: any, businessId: string) {
    const enabled = raw?.enabled === true;
    const variantId = typeof raw?.variantId === 'string' ? raw.variantId : null;
    if (!variantId) return { enabled: false, variantId: null, productId: null, name: null };
    const v = await this.prisma.productVariant.findFirst({
      where: { id: variantId, product: { businessId } },
      select: { id: true, name: true, productId: true, product: { select: { name: true } } },
    });
    if (!v) throw new BadRequestException('Ese producto no es de tu negocio');
    const name = v.product.name + (v.name && !['Principal', 'Única', 'Unica', 'Default'].includes(v.name) ? ` (${v.name})` : '');
    return { enabled, variantId: v.id, productId: v.productId, name };
  }

  /**
   * Configuración → Temas "Guardar" (whole business or one branch, owners only) and the POS's
   * own theme button (only that person's POS). `theme: null` removes the override.
   */
  async saveTheme(businessId: string, userId: string, body: { scope?: string; branchId?: string; theme?: string | null }) {
    if (!businessId) throw new BadRequestException('Business ID is required');
    const scope = body?.scope;
    const theme: ThemeId | null = body?.theme == null ? null : isTheme(body.theme) ? body.theme : null;
    if (body?.theme != null && !theme) throw new BadRequestException('Ese tema no existe');

    let settings = await this.prisma.setting.findFirst({ where: { businessId }, select: { id: true, themes: true } });
    if (!settings) settings = await this.prisma.setting.create({ data: { businessId }, select: { id: true, themes: true } });
    const themes = normalizeThemes(settings.themes);

    if (scope === 'business') {
      themes.business = theme;
    } else if (scope === 'branch') {
      const branch = body.branchId ? await this.prisma.branch.findFirst({ where: { id: body.branchId, businessId }, select: { id: true } }) : null;
      if (!branch) throw new BadRequestException('Esa sucursal no es de tu negocio');
      if (theme) themes.branches[branch.id] = theme;
      else delete themes.branches[branch.id];
    } else if (scope === 'pos') {
      if (theme) themes.pos[userId] = theme;
      else delete themes.pos[userId];
    } else {
      throw new BadRequestException('Indica dónde guardar el tema');
    }

    await this.prisma.setting.update({ where: { id: settings.id }, data: { themes } });
    await this.invalidateSettingsCache(businessId);
    return themes;
  }

  async applyPreset(presetName: string, businessId: string) {
    if (!businessId) throw new Error('Business ID is required');

    const defaultModules = [
      'pos',
      'products',
      'inventory',
      'clients',
      'credit',
      'suppliers',
      'accounting',
      'reports',
      'historial',
      'whatsapp',
      'deliveries',
      'ai_agent'
    ];

    let modules = defaultModules;
    let businessType = 'GENERAL';

    const cleanPreset = (presetName || '').toUpperCase();
    if (cleanPreset === 'BODEGA' || cleanPreset === 'MINIMARKET') {
      businessType = 'BODEGA';
      modules = [
        'pos',
        'products',
        'inventory',
        'clients',
        'suppliers',
        'accounting',
        'reports',
        'historial'
      ];
    } else if (cleanPreset === 'MODA' || cleanPreset === 'ROPA' || cleanPreset === 'BOUTIQUE') {
      businessType = 'MODA';
      modules = [
        'pos',
        'products',
        'inventory',
        'clients',
        'credit',
        'whatsapp',
        'reports',
        'historial'
      ];
    }

    return this.updateSettings({
      businessType,
      enabledModules: modules
    }, businessId);
  }
}
