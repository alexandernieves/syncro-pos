import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MovementType } from '@prisma/client';
import { HistoryService } from '../history/history.service';

@Injectable()
export class InventoryService {
  constructor(
    private prisma: PrismaService,
    private historyService: HistoryService,
  ) {}

  async findAll(branchId?: string) {
    const where = branchId ? { branchId } : {};
    return this.prisma.inventoryMovement.findMany({
      where,
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

  async restock(data: { variantId: string, branchId: string, quantity: number }, userId?: string) {
    const { variantId, branchId, quantity } = data;

    const result = await this.prisma.$transaction(async (tx) => {
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

      // 3. Update global stock in variant
      await tx.productVariant.update({
        where: { id: variantId },
        data: { stock: { increment: quantity } }
      });

      return inventory;
    });

    if (userId) {
        await this.historyService.logAction({
          userId,
          action: 'RESTOCK_PRODUCT',
          entity: 'INVENTORY',
          entityId: variantId,
          details: { quantity, branchId }
        });
    }

    return result;
  }

  async reconcile(data: { branchId: string, items: { variantId: string, quantity: number }[] }, userId?: string) {
    const { branchId, items } = data;

    return this.prisma.$transaction(async (tx) => {
      const results = [];
      for (const item of items) {
        // 1. Get current inventory
        const currentInv = await tx.inventory.findUnique({
          where: { variantId_branchId: { variantId: item.variantId, branchId } }
        });

        const currentQty = currentInv?.quantity || 0;
        const diff = item.quantity - currentQty;

        if (diff === 0) continue;

        // 2. Update or create inventory
        const inventory = await tx.inventory.upsert({
          where: { variantId_branchId: { variantId: item.variantId, branchId } },
          update: { quantity: item.quantity },
          create: { variantId: item.variantId, branchId, quantity: item.quantity }
        });

        // 3. Create adjustment movement
        await tx.inventoryMovement.create({
          data: {
            variantId: item.variantId,
            branchId,
            type: MovementType.ADJUSTMENT,
            quantity: diff,
            reason: 'audit'
          }
        });

        // 4. Update global variant stock
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: { stock: { increment: diff } }
        });

        results.push(inventory);
      }

      if (userId && items.length > 0) {
        await this.historyService.logAction({
          userId,
          action: 'INVENTORY_AUDIT',
          entity: 'BRANCH',
          entityId: branchId,
          details: { itemsCount: items.length }
        });
      }

      return results;
    });
  }

  async syncMaster(branchId: string, userId?: string) {
    // 1. Verify if branch is main
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId }
    });

    if (!branch?.isMain) {
      throw new Error("Solo se puede sincronizar el catálogo maestro desde la sucursal principal.");
    }

    // 2. Get all variants
    const variants = await this.prisma.productVariant.findMany();

    return this.prisma.$transaction(async (tx) => {
      let createdCount = 0;
      for (const variant of variants) {
        // Check if inventory record exists
        const exists = await tx.inventory.findUnique({
          where: { variantId_branchId: { variantId: variant.id, branchId } }
        });

        if (!exists) {
          await tx.inventory.create({
            data: {
              variantId: variant.id,
              branchId,
              quantity: 0
            }
          });
          createdCount++;
        }
      }

      if (userId && createdCount > 0) {
        await this.historyService.logAction({
          userId,
          action: 'SYNC_MASTER_CATALOG',
          entity: 'BRANCH',
          entityId: branchId,
          details: { createdRecords: createdCount }
        });
      }

      return { createdCount };
    });
  }
}
