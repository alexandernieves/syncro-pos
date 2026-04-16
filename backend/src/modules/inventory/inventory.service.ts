import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MovementType } from '@prisma/client';

@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.inventoryMovement.findMany({
      include: { variant: { include: { product: true } }, branch: true },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findByVariant(variantId: string) {
    return this.prisma.inventory.findMany({
      where: { variantId },
      include: { branch: true }
    });
  }

  async restock(data: { variantId: string, branchId: string, quantity: number }) {
    const { variantId, branchId, quantity } = data;

    return this.prisma.$transaction(async (tx) => {
      // 1. Update or create inventory record
      const inventory = await tx.inventory.upsert({
        where: { variantId_branchId: { variantId, branchId } },
        update: { quantity: { increment: quantity } },
        create: { variantId, branchId, quantity }
      });

      // 2. Create Movement record
      await tx.inventoryMovement.create({
        data: {
          variantId,
          branchId,
          type: MovementType.IN,
          quantity,
          reason: 'restock'
        }
      });

      // 3. Update global stock in variant (denormalized for performance)
      await tx.productVariant.update({
        where: { id: variantId },
        data: { stock: { increment: quantity } }
      });

      return inventory;
    });
  }
}
