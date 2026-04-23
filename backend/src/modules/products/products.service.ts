import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async create(data: any) {
    const { variants, ...productData } = data;
    
    return this.prisma.product.create({
      data: {
        ...productData,
        variants: {
          create: variants.map((v: any) => ({
            name: v.name,
            sku: v.sku,
            barcode: v.barcode,
            secondaryBarcodes: v.secondaryBarcodes || [],
            price: v.price,
            cost: v.cost,
            promoPrice: v.promoPrice,
            bulkPrice: v.bulkPrice,
            stock: v.stock,
            minStock: v.minStock,
            inventory: {
              create: v.branchId ? [{
                branchId: v.branchId,
                quantity: v.stock
              }] : []
            }
          } as any))
        }
      },
      include: {
        variants: true
      }
    });
  }

  async quickCreate(data: { name: string, price: number, stock: number, barcodes: string[], branchId?: string }) {
    console.log('[QuickCreate] Incoming Data:', data);
    const sku = `QC-${Date.now()}`;
    const barcodes = data.barcodes || [];
    const primary = barcodes[0] || null;
    const secondary = barcodes.slice(1);

    console.log('[QuickCreate] Assigned Barcodes:', { primary, secondary });

    return this.prisma.product.create({
      data: {
        name: data.name,
        variants: {
          create: [{
            name: 'Default',
            sku,
            barcode: primary,
            secondaryBarcodes: secondary,
            price: data.price,
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

  async findAll() {
    const products = await this.prisma.product.findMany({
      include: {
        category: true,
        variants: {
          include: {
            inventory: true
          }
        }
      }
    });

    return products.map(p => {
      const totalStock = p.variants.reduce((acc, v) => acc + v.stock, 0);
      const alerts = p.variants.map(v => {
        if (v.stock === 0) return 'CRITICAL';
        if (v.stock < v.minStock) return 'LOW';
        return 'OK';
      });

      return {
        ...p,
        totalStock,
        status: alerts.includes('CRITICAL') ? 'CRITICAL' : alerts.includes('LOW') ? 'LOW' : 'NORMAL'
      };
    });
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
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

  async update(id: string, data: any) {
    const { variants, ...productData } = data;

    return this.prisma.$transaction(async (tx) => {
      const updatedProduct = await tx.product.update({
        where: { id },
        data: productData,
      });

      if (variants) {
        for (const v of variants) {
          if (v.id) {
            await tx.productVariant.update({
              where: { id: v.id },
              data: {
                name: v.name,
                sku: v.sku,
                barcode: v.barcode,
                secondaryBarcodes: v.secondaryBarcodes || [],
                price: v.price,
                cost: v.cost,
                promoPrice: v.promoPrice,
                bulkPrice: v.bulkPrice,
                stock: v.stock,
                minStock: v.minStock,
              } as any
            });
          } else {
            await tx.productVariant.create({
              data: {
                ...v,
                productId: id
              } as any
            });
          }
        }
      }
      return updatedProduct;
    });
  }

  async remove(id: string) {
    console.log('[ProductsService] Attempting to remove product ID:', id);
    try {
      const result = await this.prisma.product.delete({ where: { id } });
      console.log('[ProductsService] Successfully removed product:', result.name);
      return result;
    } catch (error) {
      console.error('[ProductsService] Error deleting product:', error.message);
      if (error.code === 'P2003') {
        throw new BadRequestException('Este producto tiene historial de ventas o movimientos de inventario y no puede ser eliminado por razones de auditoría.');
      }
      throw error;
    }
  }

  async getStats(id: string) {
    const product = await this.findOne(id);
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


  async validateBarcode(barcode: string) {
    const variant = await (this.prisma.productVariant as any).findFirst({
      where: {
        OR: [
          { barcode: barcode },
          { secondaryBarcodes: { has: barcode } }
        ]
      }
    });
    return !variant;
  }

  async getWaitlist() {
    return (this.prisma.productWaitlist as any).findMany({
      where: { status: 'PENDING' },
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
