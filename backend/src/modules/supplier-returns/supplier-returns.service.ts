import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MovementType } from '@prisma/client';

@Injectable()
export class SupplierReturnsService {
  constructor(private prisma: PrismaService) {}

  async create(data: {
    supplierId: string;
    variantId: string;
    quantity: number;
    reason: string;
    branchId: string;
  }) {
    const { supplierId, variantId, quantity, reason, branchId } = data;

    // Validate supplier exists
    const supplier = await this.prisma.supplier.findUnique({
      where: { id: supplierId }
    });

    if (!supplier) {
      throw new NotFoundException('Proveedor no encontrado');
    }

    // Validate variant exists
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
      include: {
        product: true
      }
    });

    if (!variant) {
      throw new NotFoundException('Variante de producto no encontrada');
    }

    // Validate branch exists
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId }
    });

    if (!branch) {
      throw new NotFoundException('Sucursal no encontrada');
    }

    // Check if there's enough inventory to return
    const inventory = await this.prisma.inventory.findUnique({
      where: {
        variantId_branchId: {
          variantId,
          branchId
        }
      }
    });

    if (!inventory || inventory.quantity < quantity) {
      throw new BadRequestException('No hay suficiente inventario para devolver');
    }

    // Process return (transaction)
    const result = await this.prisma.$transaction(async (tx) => {
      // Create return record
      const supplierReturn = await tx.supplierReturn.create({
        data: {
          supplierId,
          variantId,
          quantity,
          reason
        },
        include: {
          supplier: true,
          variant: {
            include: {
              product: true
            }
          }
        }
      });

      // Update inventory (subtract returned quantity)
      await tx.inventory.update({
        where: {
          variantId_branchId: {
            variantId,
            branchId
          }
        },
        data: {
          quantity: inventory.quantity - quantity
        }
      });

      // Create inventory movement (adjustment type)
      await tx.inventoryMovement.create({
        data: {
          variantId,
          branchId,
          type: MovementType.ADJUSTMENT,
          quantity: -quantity, // Negative for returns
          reason: `Devolución a ${supplier.name}: ${reason}`,
          referenceId: supplierReturn.id,
        }
      });

      return supplierReturn;
    });

    return result;
  }

  async findAll(supplierId?: string, branchId?: string) {
    const where: any = {};
    if (supplierId) where.supplierId = supplierId;
    if (branchId) {
      // Filter by returns from variants that have inventory in this branch
      where.variant = {
        inventory: {
          some: { branchId }
        }
      };
    }
    
    return this.prisma.supplierReturn.findMany({
      where,
      include: {
        supplier: true,
        variant: {
          include: {
            product: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }

  async findOne(id: string) {
    const supplierReturn = await this.prisma.supplierReturn.findUnique({
      where: { id },
      include: {
        supplier: true,
        variant: {
          include: {
            product: true
          }
        }
      }
    });

    if (!supplierReturn) {
      throw new NotFoundException('Devolución no encontrada');
    }

    return supplierReturn;
  }

  async getSupplierReturnsSummary(supplierId: string, startDate?: Date, endDate?: Date) {
    // Validate supplier exists
    const supplier = await this.prisma.supplier.findUnique({
      where: { id: supplierId }
    });

    if (!supplier) {
      throw new NotFoundException('Proveedor no encontrado');
    }

    const dateFilter: any = {};
    if (startDate) dateFilter.gte = startDate;
    if (endDate) dateFilter.lte = endDate;

    const where: any = { supplierId };
    if (Object.keys(dateFilter).length > 0) {
      where.createdAt = dateFilter;
    }

    const returns = await this.prisma.supplierReturn.findMany({
      where,
      include: {
        variant: {
          include: {
            product: true
          }
        }
      }
    });

    // Calculate summary
    const totalReturns = returns.length;
    const totalQuantity = returns.reduce((sum, ret) => sum + ret.quantity, 0);
    const totalValue = returns.reduce((sum, ret) => {
      const cost = ret.variant.cost || 0;
      return sum + (cost * ret.quantity);
    }, 0);

    // Group by reason
    const returnsByReason = returns.reduce((acc: Record<string, number>, ret) => {
      acc[ret.reason] = (acc[ret.reason] || 0) + ret.quantity;
      return acc;
    }, {});

    // Group by product
    const returnsByProduct = returns.reduce((acc: Record<string, any>, ret) => {
      const productName = ret.variant.product.name;
      if (!acc[productName]) {
        acc[productName] = {
          productId: ret.variant.productId,
          productName,
          totalQuantity: 0,
          totalReturns: 0
        };
      }
      acc[productName].totalQuantity += ret.quantity;
      acc[productName].totalReturns += 1;
      return acc;
    }, {});

    return {
      supplier,
      summary: {
        totalReturns,
        totalQuantity,
        totalValue,
        averageReturnQuantity: totalReturns > 0 ? totalQuantity / totalReturns : 0
      },
      returnsByReason,
      returnsByProduct: Object.values(returnsByProduct),
      returns
    };
  }
}
