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
          }))
        }
      },
      include: {
        variants: true
      }
    });
  }

  async quickCreate(data: { name: string, price: number, stock: number, branchId?: string }) {
    const sku = `QC-${Date.now()}`;
    return this.prisma.product.create({
      data: {
        name: data.name,
        variants: {
          create: [{
            name: 'Default',
            sku,
            price: data.price,
            stock: data.stock,
            inventory: {
              create: data.branchId ? [{
                branchId: data.branchId,
                quantity: data.stock
              }] : []
            }
          }]
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
                price: v.price,
                cost: v.cost,
                promoPrice: v.promoPrice,
                bulkPrice: v.bulkPrice,
                stock: v.stock,
                minStock: v.minStock,
              }
            });
          } else {
            await tx.productVariant.create({
              data: {
                ...v,
                productId: id
              }
            });
          }
        }
      }
      return updatedProduct;
    });
  }

  async remove(id: string) {
    return this.prisma.product.delete({ where: { id } });
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
    const variant = await this.prisma.productVariant.findUnique({
      where: { barcode }
    });
    return !variant;
  }
}
