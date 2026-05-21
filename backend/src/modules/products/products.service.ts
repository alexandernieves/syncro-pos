import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HistoryService } from '../history/history.service';

@Injectable()
export class ProductsService {
  constructor(
    private prisma: PrismaService,
    private historyService: HistoryService,
  ) {}

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
      const stock = typeof v.stock === 'number' && !isNaN(v.stock) ? v.stock : parseInt(v.stock) || 0;
      const minStock = typeof v.minStock === 'number' && !isNaN(v.minStock) ? v.minStock : parseInt(v.minStock) || 0;

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

      return this.prisma.product.findUnique({
        where: { id: updatedProduct.id },
        include: { variants: true }
      });
    }

    // Original Flow: Create new product
    const finalSku = sku || `QC-${Date.now()}`;
    return this.prisma.product.create({
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
  }

  async findAll(businessId?: string, branchId?: string) {
    const where: any = {};
    if (businessId) {
      where.businessId = businessId;
    }
    const products = await this.prisma.product.findMany({
      where,
      include: {
        category: true,
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

    return products.map(p => {
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
  }

  async findOne(id: string, businessId?: string) {
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
    return product;
  }

  async update(id: string, data: any, userId?: string, businessId?: string) {
    await this.findOne(id, businessId);
    let { variants, ...productData } = data;
    delete productData.businessId;
    delete productData.id;

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

    return this.prisma.$transaction(async (tx) => {
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
          const stock = typeof v.stock === 'number' && !isNaN(v.stock) ? v.stock : parseInt(v.stock) || 0;
          const minStock = typeof v.minStock === 'number' && !isNaN(v.minStock) ? v.minStock : parseInt(v.minStock) || 0;

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
    const variantIds = product.variants.map(v => v.id);

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
}
