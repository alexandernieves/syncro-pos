import { Inject, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HistoryService } from '../history/history.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

@Injectable()
export class ProductsService {
  constructor(
    private prisma: PrismaService,
    private historyService: HistoryService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  public async invalidateProductsCache(businessId?: string | null, productId?: string | null) {
    try {
      console.log(`[Cache] Invalidating products cache for business: ${businessId || 'all'}, product: ${productId || 'all'}`);
      let keys: string[] = [];

      // 1. Check traditional cache-manager store
      const store = (this.cacheManager as any).store;
      if (store && typeof (store as any).keys === 'function') {
        keys = await (store as any).keys();
      } 
      // 2. Check NestJS cache-manager v5 (Keyv wrapper stores)
      else if (Array.isArray((this.cacheManager as any).stores)) {
        for (const s of (this.cacheManager as any).stores) {
          if (typeof s.keys === 'function') {
            const storeKeys = await s.keys();
            keys.push(...storeKeys);
          } else if (s._store && typeof s._store.keys === 'function') {
            const mapKeys = Array.from(s._store.keys()) as string[];
            const prefix = (s.opts?.namespace || s._namespace || 'keyv') + ':';
            const cleaned = mapKeys.map(k => k.startsWith(prefix) ? k.substring(prefix.length) : k);
            keys.push(...cleaned);
          }
        }
      }

      if (keys.length > 0) {
        for (const key of keys) {
          if (key.startsWith('products:all:') || key.startsWith('products:one:')) {
            if (!businessId || key.includes(businessId) || (productId && key.includes(productId))) {
              await this.cacheManager.del(key);
              console.log(`[Cache] Evicted key: ${key}`);
            }
          }
        }
      } else {
        if (businessId) {
          await this.cacheManager.del(`products:all:${businessId}:none`);
          if (productId) {
            await this.cacheManager.del(`products:one:${productId}:${businessId}`);
            await this.cacheManager.del(`products:one:${productId}:none`);
          }
        }
      }
    } catch (err: any) {
      console.error('[Cache] Error invalidating cache:', err.message);
    }
  }

  async create(data: any, userId?: string) {
    let { variants, ...productData } = data;
    
    // Parse variants if it was sent as a string (e.g. multipart/form-data)
    if (typeof variants === 'string') {
      try {
        variants = JSON.parse(variants);
      } catch (e) {
        throw new BadRequestException('El formato de las variantes no es un JSON válido');
      }
    }

    if (!variants || !Array.isArray(variants)) {
      variants = [];
    }

    // Clean optional fields
    delete productData.id;
    if (productData.categoryId === '') productData.categoryId = null;
    if (productData.supplierId === '') productData.supplierId = null;
    if (productData.businessId === '') productData.businessId = null;

    const mappedVariants = variants.map((v: any, index: number) => {
      const price = typeof v.price === 'number' && !isNaN(v.price) ? v.price : Number(v.price) || 0;
      const cost = typeof v.cost === 'number' && !isNaN(v.cost) ? v.cost : (v.cost !== null && v.cost !== undefined && v.cost !== '') ? Number(v.cost) : null;
      const promoPrice = typeof v.promoPrice === 'number' && !isNaN(v.promoPrice) ? v.promoPrice : (v.promoPrice !== null && v.promoPrice !== undefined && v.promoPrice !== '') ? Number(v.promoPrice) : null;
      const bulkPrice = typeof v.bulkPrice === 'number' && !isNaN(v.bulkPrice) ? v.bulkPrice : (v.bulkPrice !== null && v.bulkPrice !== undefined && v.bulkPrice !== '') ? Number(v.bulkPrice) : null;
      // parseFloat, not parseInt: anything sold by weight or by the metre
      // arrives here with decimals, and parseInt would silently floor 0.85 kg
      // of cheese to zero stock.
      const stock = typeof v.stock === 'number' && !isNaN(v.stock) ? v.stock : parseFloat(v.stock) || 0;
      const minStock = typeof v.minStock === 'number' && !isNaN(v.minStock) ? v.minStock : parseFloat(v.minStock) || 0;

      return {
        name: v.name || `Variante ${index + 1}`,
        sku: v.sku || `SKU-${Date.now()}-${index}`,
        barcode: v.barcode || null,
        secondaryBarcodes: Array.isArray(v.secondaryBarcodes) ? v.secondaryBarcodes : [],
        price,
        cost: isNaN(cost as number) ? null : cost,
        promoPrice: isNaN(promoPrice as number) ? null : promoPrice,
        bulkPrice: isNaN(bulkPrice as number) ? null : bulkPrice,
        stock,
        minStock,
        inventory: {
          create: v.branchId ? [{
            branchId: v.branchId,
            quantity: stock
          }] : []
        }
      };
    });

    const product = await this.prisma.product.create({
      data: {
        ...productData,
        variants: {
          create: mappedVariants as any
        }
      },
      include: {
        variants: true
      }
    });

    if (userId) {
      try {
        await this.historyService.logAction({
          userId,
          action: 'CREATE_PRODUCT',
          entity: 'PRODUCT',
          entityId: product.id,
          details: { name: product.name, sku: product.variants[0]?.sku }
        });
      } catch (historyError) {
        console.error('[ProductsService] Failed to log action CREATE_PRODUCT:', historyError);
      }
    }

    await this.invalidateProductsCache(product.businessId);
    return product;
  }

  async quickCreate(data: { 
    name: string, 
    price: number, 
    cost?: number,
    stock: number, 
    barcodes: string[], 
    branchId?: string, 
    sku?: string,
    categoryName?: string,
    description?: string,
    isWeighable?: boolean,
    businessId?: string
  }) {
    console.log('[QuickCreate] Incoming Data:', data);
    const barcodes = data.barcodes || [];
    const primary = barcodes[0] || null;
    const secondary = barcodes.slice(1);
    const sku = data.sku || null;

    console.log('[QuickCreate] Assigned Barcodes:', { primary, secondary });

    let categoryId = null;
    if (data.categoryName && data.businessId) {
      const name = data.categoryName.trim();
      const businessId = data.businessId;
      let category = await this.prisma.category.findFirst({
        where: {
          name,
          businessId
        }
      });
      if (!category) {
        category = await this.prisma.category.create({
          data: {
            name,
            businessId
          }
        });
      }
      categoryId = category.id;
    }

    // Deduplication check: Find if a variant already exists with the same SKU or Barcode for this business
    let existingVariant = null;
    if (data.businessId) {
      existingVariant = await this.prisma.productVariant.findFirst({
        where: {
          product: {
            businessId: data.businessId
          },
          OR: [
            ...(sku ? [{ sku }] : []),
            ...(primary ? [{ barcode: primary }] : []),
            ...(primary ? [{ secondaryBarcodes: { has: primary } }] : [])
          ]
        },
        include: {
          product: true
        }
      });

      // If still not found, try matching by product name for this business
      if (!existingVariant) {
        const existingProduct = await this.prisma.product.findFirst({
          where: {
            name: data.name,
            businessId: data.businessId
          },
          include: {
            variants: true
          }
        });
        if (existingProduct && existingProduct.variants.length > 0) {
          existingVariant = existingProduct.variants[0];
          (existingVariant as any).product = existingProduct;
        }
      }
    }

    if (existingVariant) {
      console.log(`[QuickCreate] Found existing product/variant. Updating instead of creating:`, existingVariant.id);
      
      const updatedProduct = await this.prisma.product.update({
        where: { id: existingVariant.productId },
        data: {
          name: data.name,
          description: data.description || (existingVariant as any).product.description,
          isWeighable: data.isWeighable !== undefined ? !!data.isWeighable : (existingVariant as any).product.isWeighable,
          categoryId: categoryId || (existingVariant as any).product.categoryId
        }
      });

      const updatedVariant = await this.prisma.productVariant.update({
        where: { id: existingVariant.id },
        data: {
          price: data.price,
          cost: data.cost !== undefined ? data.cost : existingVariant.cost,
          stock: data.stock,
          sku: sku || existingVariant.sku,
          barcode: primary || existingVariant.barcode,
          secondaryBarcodes: secondary.length > 0 ? secondary : existingVariant.secondaryBarcodes
        }
      });

      if (data.branchId) {
        const existingInventory = await this.prisma.inventory.findFirst({
          where: {
            variantId: existingVariant.id,
            branchId: data.branchId
          }
        });

        if (existingInventory) {
          await this.prisma.inventory.update({
            where: { id: existingInventory.id },
            data: { quantity: data.stock }
          });
        } else {
          await this.prisma.inventory.create({
            data: {
              variantId: existingVariant.id,
              branchId: data.branchId,
              quantity: data.stock
            }
          });
        }
      }

      const result = await this.prisma.product.findUnique({
        where: { id: updatedProduct.id },
        include: { variants: true }
      });
      await this.invalidateProductsCache(data.businessId || result?.businessId);
      return result;
    }

    // Original Flow: Create new product
    const finalSku = sku || `QC-${Date.now()}`;
    const product = await this.prisma.product.create({
      data: {
        name: data.name,
        description: data.description || null,
        isWeighable: !!data.isWeighable,
        categoryId,
        businessId: data.businessId || null,
        variants: {
          create: [{
            name: 'Default',
            sku: finalSku,
            barcode: primary,
            secondaryBarcodes: secondary,
            price: data.price,
            cost: data.cost || null,
            stock: data.stock,
            inventory: {
              create: data.branchId ? [{
                branchId: data.branchId,
                quantity: data.stock
              }] : []
            }
          } as any]
        }
      },
      include: {
        variants: true
      }
    });

    await this.invalidateProductsCache(data.businessId || product.businessId);
    return product;
  }

  async findAll(businessId?: string, branchId?: string) {
    const cacheKey = `products:all:${businessId || 'none'}:${branchId || 'none'}`;
    try {
      const cached = await this.cacheManager.get<any[]>(cacheKey);
      if (cached) {
        console.log(`[Cache] Cache hit for key: ${cacheKey}`);
        return cached;
      }
    } catch (err: any) {
      console.error('[Cache] Error reading from cache store:', err.message);
    }

    const where: any = {};
    if (businessId) {
      where.businessId = businessId;
    }
    const products = await this.prisma.product.findMany({
      where,
      include: {
        category: true,
        syncroShopBranch: { select: { id: true, name: true } },
        variants: {
          include: {
            inventory: branchId ? {
              where: { branchId }
            } : true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const mapped = products.map(p => {
      // Calculate total stock across variants (filtered by branch if provided)
      const totalStock = p.variants.reduce((acc, v) => {
        let vStock = v.stock;
        if (branchId) {
          const branchInventory = v.inventory.find(inv => inv.branchId === branchId);
          if (branchInventory !== undefined) {
            vStock = branchInventory.quantity;
          }
        }
        return acc + vStock;
      }, 0);

      // Check for low stock alerts
      const alerts = p.variants.map(v => {
        let vStock = v.stock;
        if (branchId) {
          const branchInventory = v.inventory.find(inv => inv.branchId === branchId);
          if (branchInventory !== undefined) {
            vStock = branchInventory.quantity;
          }
        }
        
        if (vStock === 0) return 'CRITICAL';
        if (vStock < v.minStock) return 'LOW';
        return 'OK';
      });

      // Map variants to include branch-specific stock
      const mappedVariants = p.variants.map(v => {
        let vStock = v.stock;
        if (branchId) {
          const branchInventory = v.inventory.find(inv => inv.branchId === branchId);
          if (branchInventory !== undefined) {
            vStock = branchInventory.quantity;
          }
        }
        return {
          ...v,
          stock: vStock
        };
      });

      return {
        ...p,
        variants: mappedVariants,
        totalStock,
        status: alerts.includes('CRITICAL') ? 'CRITICAL' : alerts.includes('LOW') ? 'LOW' : 'NORMAL'
      };
    });

    try {
      await this.cacheManager.set(cacheKey, mapped, 5 * 60 * 1000);
      console.log(`[Cache] Cached products catalog listing: ${cacheKey}`);
    } catch (err: any) {
      console.error('[Cache] Error saving to cache store:', err.message);
    }

    return mapped;
  }

  async findOne(id: string, businessId?: string) {
    const cacheKey = `products:one:${id}:${businessId || 'none'}`;
    try {
      const cached = await this.cacheManager.get<any>(cacheKey);
      if (cached) {
        console.log(`[Cache] Cache hit for key: ${cacheKey}`);
        return cached;
      }
    } catch (err: any) {
      console.error('[Cache] Error reading from cache store:', err.message);
    }

    const where: any = { id };
    if (businessId) {
      where.businessId = businessId;
    }
    const product = await this.prisma.product.findFirst({
      where,
      include: {
        category: true,
        supplier: true,
        variants: {
          include: {
            inventory: {
              include: {
                branch: true
              }
            }
          }
        }
      }
    });
    if (!product) throw new NotFoundException('Producto no encontrado');

    try {
      await this.cacheManager.set(cacheKey, product, 5 * 60 * 1000);
      console.log(`[Cache] Cached product details: ${cacheKey}`);
    } catch (err: any) {
      console.error('[Cache] Error saving to cache store:', err.message);
    }

    return product;
  }

  async update(id: string, data: any, userId?: string, businessId?: string) {
    const existing = await this.findOne(id, businessId);
    let { variants, ...productData } = data;
    delete productData.businessId;
    delete productData.id;
    delete productData.images;

    // Syncro Shop fields go through the publication rules (origin branch, max featured).
    const { isPublishedOnSyncroShop, isFeaturedOnSyncroShop, syncroShopBranchId, branchId } = productData;
    delete productData.isPublishedOnSyncroShop;
    delete productData.isFeaturedOnSyncroShop;
    delete productData.syncroShopBranchId;
    delete productData.branchId;
    if (isPublishedOnSyncroShop !== undefined || isFeaturedOnSyncroShop !== undefined || syncroShopBranchId) {
      Object.assign(productData, await this.resolveSyncroShopChanges(
        existing,
        {
          published: isPublishedOnSyncroShop === undefined ? undefined : isPublishedOnSyncroShop === true || isPublishedOnSyncroShop === 'true',
          featured: isFeaturedOnSyncroShop === undefined ? undefined : isFeaturedOnSyncroShop === true || isFeaturedOnSyncroShop === 'true',
          branchId: syncroShopBranchId || branchId,
        },
        businessId || existing.businessId,
      ));
    }

    const specifications = this.normalizeSpecifications(productData.specifications);
    if (specifications !== undefined) productData.specifications = specifications;
    const landingBlocks = this.normalizeLandingBlocks(productData.landingBlocks);
    if (landingBlocks !== undefined) productData.landingBlocks = landingBlocks;

    if (productData.categoryId === '') productData.categoryId = null;
    if (productData.supplierId === '') productData.supplierId = null;

    // Parse variants if sent as a string (multipart/form-data)
    if (typeof variants === 'string') {
      try {
        variants = JSON.parse(variants);
      } catch (e) {
        throw new BadRequestException('El formato de las variantes no es un JSON válido');
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedProduct = await tx.product.update({
        where: { id },
        data: productData,
      });

      if (variants && Array.isArray(variants)) {
        for (const v of variants) {
          const price = typeof v.price === 'number' && !isNaN(v.price) ? v.price : Number(v.price) || 0;
          const cost = typeof v.cost === 'number' && !isNaN(v.cost) ? v.cost : (v.cost !== null && v.cost !== undefined && v.cost !== '') ? Number(v.cost) : null;
          const promoPrice = typeof v.promoPrice === 'number' && !isNaN(v.promoPrice) ? v.promoPrice : (v.promoPrice !== null && v.promoPrice !== undefined && v.promoPrice !== '') ? Number(v.promoPrice) : null;
          const bulkPrice = typeof v.bulkPrice === 'number' && !isNaN(v.bulkPrice) ? v.bulkPrice : (v.bulkPrice !== null && v.bulkPrice !== undefined && v.bulkPrice !== '') ? Number(v.bulkPrice) : null;
          const stock = typeof v.stock === 'number' && !isNaN(v.stock) ? v.stock : parseFloat(v.stock) || 0;
          const minStock = typeof v.minStock === 'number' && !isNaN(v.minStock) ? v.minStock : parseFloat(v.minStock) || 0;

          const variantData = {
            name: v.name,
            sku: v.sku,
            barcode: v.barcode || null,
            secondaryBarcodes: Array.isArray(v.secondaryBarcodes) ? v.secondaryBarcodes : [],
            price,
            cost: isNaN(cost as number) ? null : cost,
            promoPrice: isNaN(promoPrice as number) ? null : promoPrice,
            bulkPrice: isNaN(bulkPrice as number) ? null : bulkPrice,
            stock,
            minStock,
            ...(v.showOnSyncroShop !== undefined ? { showOnSyncroShop: Boolean(v.showOnSyncroShop) } : {}),
          };

          if (v.id) {
            await tx.productVariant.update({
              where: { id: v.id },
              data: variantData as any
            });
          } else {
            await tx.productVariant.create({
              data: {
                ...variantData,
                productId: id
              } as any
            });
          }
        }
      }

      if (userId) {
        try {
          await this.historyService.logAction({
            userId,
            action: 'UPDATE_PRODUCT',
            entity: 'PRODUCT',
            entityId: id,
            details: { name: updatedProduct.name }
          });
        } catch (historyError) {
          console.error('[ProductsService] Failed to log action UPDATE_PRODUCT:', historyError);
        }
      }

      return updatedProduct;
    });

    await this.invalidateProductsCache(businessId || updated.businessId, id);
    return updated;
  }

  async remove(id: string, userId?: string, businessId?: string) {
    console.log('[ProductsService] Attempting to remove product ID:', id);
    await this.findOne(id, businessId);
    try {
      const result = await this.prisma.product.delete({ where: { id } });
      console.log('[ProductsService] Successfully removed product:', result.name);

      if (userId) {
        try {
          await this.historyService.logAction({
            userId,
            action: 'DELETE_PRODUCT',
            entity: 'PRODUCT',
            entityId: id,
            details: { name: result.name }
          });
        } catch (historyError) {
          console.error('[ProductsService] Failed to log action DELETE_PRODUCT:', historyError);
        }
      }

      await this.invalidateProductsCache(businessId || result.businessId, id);
      return result;
    } catch (error: any) {
      console.error('[ProductsService] Error deleting product:', error.message);
      if (error.code === 'P2003') {
        throw new BadRequestException('Este producto tiene historial de ventas o movimientos de inventario y no puede ser eliminado por razones de auditoría.');
      }
      throw error;
    }
  }

  async getStats(id: string, businessId?: string) {
    const product = await this.findOne(id, businessId);
    const variantIds = product.variants.map((v: any) => v.id);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const salesInLast7Days = await this.prisma.saleItem.aggregate({
      where: {
        variantId: { in: variantIds },
        sale: { createdAt: { gte: sevenDaysAgo } }
      },
      _sum: {
        quantity: true
      }
    });

    const lastSaleItem = await this.prisma.saleItem.findFirst({
      where: { variantId: { in: variantIds } },
      include: { sale: true },
      orderBy: { sale: { createdAt: 'desc' } }
    });

    const totalSold = await this.prisma.saleItem.aggregate({
      where: { variantId: { in: variantIds } },
      _sum: { quantity: true }
    });

    return {
      productId: id,
      name: product.name,
      totalSoldLast7Days: salesInLast7Days._sum.quantity || 0,
      lastSale: lastSaleItem?.sale.createdAt.toISOString() || null,
      averagePrice: product.variants[0]?.price || 0,
      totalQuantitySold: totalSold._sum.quantity || 0
    };
  }

  async validateBarcode(barcode: string, businessId?: string) {
    const where: any = {
      OR: [
        { barcode: barcode },
        { secondaryBarcodes: { has: barcode } }
      ]
    };
    if (businessId) {
      where.product = { businessId };
    }
    const variant = await (this.prisma.productVariant as any).findFirst({
      where
    });
    return !variant;
  }

  async getWaitlist(businessId?: string) {
    const where: any = { status: 'PENDING' };
    if (businessId) {
      where.branch = { businessId };
    }
    return (this.prisma.productWaitlist as any).findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { branch: true }
    });
  }

  async addToWaitlist(data: { name: string, price: number, stock: number, barcode: string, userId: string, branchId?: string }) {
    try {
      return await (this.prisma.productWaitlist as any).create({
        data: {
          name: data.name,
          price: data.price,
          stock: data.stock,
          barcode: data.barcode,
          userId: data.userId,
          branchId: data.branchId,
          status: 'PENDING'
        }
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new BadRequestException('Este código de barras ya está registrado en la lista de espera.');
      }
      throw error;
    }
  }

  async removeFromWaitlist(id: string) {
    return (this.prisma.productWaitlist as any).delete({ where: { id } });
  }

  // ── Syncro Shop ────────────────────────────────────────────────────────────

  /**
   * Publishes, unpublishes or features a product in Syncro Shop.
   *
   * - Publishing stores the branch the user had selected: online orders are
   *   sold from that branch's stock (PLAN-SYNCRO-SHOP.md, R14).
   * - Only published products can be featured, and a business can feature at
   *   most MAX_FEATURED products (R10).
   */
  async setSyncroShopStatus(
    id: string,
    input: { published?: boolean; featured?: boolean; branchId?: string | null },
    businessId?: string,
  ) {
    if (!businessId) throw new BadRequestException('Falta el negocio del usuario');
    const product = await this.prisma.product.findFirst({ where: { id, businessId } });
    if (!product) throw new NotFoundException('Producto no encontrado');

    const data = await this.resolveSyncroShopChanges(product, input, businessId);
    const updated = await this.prisma.product.update({ where: { id }, data });
    await this.invalidateProductsCache(businessId, id);
    return updated;
  }

  /** Publishes or unpublishes several products at once from one branch. */
  async bulkSetSyncroShopPublished(
    productIds: string[],
    published: boolean,
    branchId: string | null | undefined,
    businessId?: string,
  ) {
    if (!businessId) throw new BadRequestException('Falta el negocio del usuario');
    if (!Array.isArray(productIds) || productIds.length === 0) {
      throw new BadRequestException('Selecciona al menos un producto');
    }

    if (!published) {
      const result = await this.prisma.product.updateMany({
        where: { id: { in: productIds }, businessId },
        data: { isPublishedOnSyncroShop: false, isFeaturedOnSyncroShop: false, syncroShopBranchId: null },
      });
      await this.invalidateProductsCache(businessId);
      return { updated: result.count };
    }

    const branch = await this.resolvePublicationBranch(branchId, businessId);
    // Products already published keep their original branch.
    const result = await this.prisma.product.updateMany({
      where: { id: { in: productIds }, businessId, isPublishedOnSyncroShop: false },
      data: { isPublishedOnSyncroShop: true, syncroShopBranchId: branch.id },
    });
    await this.invalidateProductsCache(businessId);
    return { updated: result.count, branch: { id: branch.id, name: branch.name } };
  }

  async getFeaturedCount(businessId?: string) {
    const count = await this.prisma.product.count({
      where: { businessId, isFeaturedOnSyncroShop: true, isPublishedOnSyncroShop: true },
    });
    return { count, max: ProductsService.MAX_FEATURED };
  }

  /** Replaces the product gallery (max MAX_IMAGES). The first image is the cover. */
  async setImages(id: string, urls: string[], businessId?: string) {
    if (!businessId) throw new BadRequestException('Falta el negocio del usuario');
    const product = await this.prisma.product.findFirst({ where: { id, businessId } });
    if (!product) throw new NotFoundException('Producto no encontrado');

    const clean = (Array.isArray(urls) ? urls : [])
      .map((u) => (typeof u === 'string' ? u.trim() : ''))
      .filter(Boolean);
    if (clean.length > ProductsService.MAX_IMAGES) {
      throw new BadRequestException(`Un producto puede tener máximo ${ProductsService.MAX_IMAGES} imágenes`);
    }

    await this.prisma.$transaction([
      this.prisma.productImage.deleteMany({ where: { productId: id } }),
      this.prisma.productImage.createMany({
        data: clean.map((url, position) => ({ productId: id, url, position })),
      }),
      this.prisma.product.update({ where: { id }, data: { image: clean[0] ?? null } }),
    ]);
    await this.invalidateProductsCache(businessId, id);
    return this.getImages(id, businessId);
  }

  async getImages(id: string, businessId?: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, businessId },
      select: { image: true, images: { orderBy: { position: 'asc' } } },
    });
    if (!product) throw new NotFoundException('Producto no encontrado');
    // Products created before the gallery existed only have the cover image.
    if (product.images.length === 0 && product.image) {
      return [{ id: null, url: product.image, position: 0 }];
    }
    return product.images;
  }

  static readonly MAX_FEATURED = 5;
  static readonly MAX_IMAGES = 5;

  private async resolvePublicationBranch(branchId: string | null | undefined, businessId: string) {
    const branch = branchId
      ? await this.prisma.branch.findFirst({ where: { id: branchId, businessId } })
      : await this.prisma.branch.findFirst({ where: { businessId }, orderBy: [{ isMain: 'desc' }, { createdAt: 'asc' }] });
    if (!branch) throw new BadRequestException('No se encontró la sucursal desde la que se publica el producto');
    return branch;
  }

  private async resolveSyncroShopChanges(
    product: { id: string; isPublishedOnSyncroShop: boolean; isFeaturedOnSyncroShop: boolean; syncroShopBranchId: string | null },
    input: { published?: boolean; featured?: boolean; branchId?: string | null },
    businessId: string,
  ) {
    const data: { isPublishedOnSyncroShop?: boolean; isFeaturedOnSyncroShop?: boolean; syncroShopBranchId?: string | null } = {};
    const published = input.published ?? product.isPublishedOnSyncroShop;

    if (!published) {
      return { isPublishedOnSyncroShop: false, isFeaturedOnSyncroShop: false, syncroShopBranchId: null };
    }

    if (!product.isPublishedOnSyncroShop || !product.syncroShopBranchId) {
      data.isPublishedOnSyncroShop = true;
      data.syncroShopBranchId = (await this.resolvePublicationBranch(input.branchId, businessId)).id;
    } else if (input.branchId && input.branchId !== product.syncroShopBranchId) {
      // Explicit change of origin branch (the UI asks for confirmation first).
      data.syncroShopBranchId = (await this.resolvePublicationBranch(input.branchId, businessId)).id;
    }

    if (input.featured !== undefined && input.featured !== product.isFeaturedOnSyncroShop) {
      if (input.featured) {
        const featuredCount = await this.prisma.product.count({
          where: { businessId, isFeaturedOnSyncroShop: true, isPublishedOnSyncroShop: true, id: { not: product.id } },
        });
        if (featuredCount >= ProductsService.MAX_FEATURED) {
          throw new BadRequestException(
            `Ya tienes ${ProductsService.MAX_FEATURED} productos destacados. Quita uno para destacar este.`,
          );
        }
      }
      data.isFeaturedOnSyncroShop = input.featured;
    }
    return data;
  }

  /** JSON fields may arrive as strings from multipart forms. */
  private parseJsonField(value: unknown, label: string) {
    if (typeof value !== 'string') return value;
    try {
      return JSON.parse(value);
    } catch {
      throw new BadRequestException(`${label} no tiene un formato válido`);
    }
  }

  /** Landing page blocks (R9). The storefront ignores malformed blocks; here we only bound size. */
  private normalizeLandingBlocks(value: unknown) {
    if (value === undefined) return undefined;
    if (value === null || value === '') return null;
    const raw = this.parseJsonField(value, 'El contenido de la página de venta');
    if (!Array.isArray(raw)) throw new BadRequestException('El contenido de la página de venta debe ser una lista de bloques');
    if (raw.length > 30) throw new BadRequestException('Máximo 30 bloques en la página de venta');
    if (JSON.stringify(raw).length > 200_000) throw new BadRequestException('El contenido de la página de venta es demasiado grande');
    return raw;
  }

  private normalizeSpecifications(value: unknown) {
    if (value === undefined) return undefined;
    if (value === null || value === '') return null;
    const raw = this.parseJsonField(value, 'Las especificaciones');
    if (!Array.isArray(raw)) throw new BadRequestException('Las especificaciones deben ser una lista');
    const specs = raw
      .map((s: any) => ({ label: String(s?.label ?? '').trim(), value: String(s?.value ?? '').trim() }))
      .filter((s) => s.label && s.value);
    if (specs.length > 30) throw new BadRequestException('Máximo 30 especificaciones por producto');
    return specs;
  }
}
