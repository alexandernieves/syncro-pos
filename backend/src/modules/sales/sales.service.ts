import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentMethod, MovementType } from '@prisma/client';

@Injectable()
export class SalesService {
  private readonly logger = new Logger(SalesService.name);

  constructor(private prisma: PrismaService) {}

  async create(data: any, userId: string) {
    const { branchId, items, paymentMethod } = data;

    return this.prisma.$transaction(async (tx) => {
      let total = 0;
      const saleItemsData = [];

      for (const item of items) {
        // 1. Fetch variant and check stock
        const variant = await tx.productVariant.findUnique({
          where: { id: item.variantId },
          include: { inventory: { where: { branchId } } }
        });

        if (!variant) throw new BadRequestException(`Variante ${item.variantId} no encontrada`);
        
        const currentStock = variant.inventory[0]?.quantity || 0;
        if (currentStock < item.quantity) {
          throw new BadRequestException(`Stock insuficiente para ${variant.name} (${currentStock} disponibles)`);
        }

        const subtotal = variant.price * item.quantity;
        total += subtotal;

        saleItemsData.push({
          variantId: item.variantId,
          quantity: item.quantity,
          price: variant.price,
          subtotal
        });

        // 2. Discount Stock
        await tx.inventory.update({
          where: { variantId_branchId: { variantId: item.variantId, branchId } },
          data: { quantity: { decrement: item.quantity } }
        });

        // 3. Register Movement
        await tx.inventoryMovement.create({
          data: {
            variantId: item.variantId,
            branchId,
            type: MovementType.OUT,
            quantity: item.quantity,
            reason: 'sale'
          }
        });
        
        this.logger.log(`Stock descontado para variante ${variant.id}: -${item.quantity}`);
      }

      // 4. Create Sale
      const sale = await tx.sale.create({
        data: {
          branchId,
          userId,
          paymentMethod,
          total,
          items: {
            create: saleItemsData
          }
        },
        include: { items: true }
      });

      this.logger.log(`Venta creada exitosamente: ${sale.id} por total $${total}`);
      return sale;
    });
  }

  async findAll() {
    return this.prisma.sale.findMany({
      include: { items: { include: { variant: true } }, user: true, branch: true },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findOne(id: string) {
    return this.prisma.sale.findUnique({
      where: { id },
      include: { items: { include: { variant: true } }, user: true, branch: true }
    });
  }
}
