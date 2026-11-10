import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MovementType } from '@prisma/client';
import { HistoryService } from '../history/history.service';
import { ProductsService } from '../products/products.service';

@Injectable()
export class InventoryService {
  constructor(
    private prisma: PrismaService,
    private historyService: HistoryService,
    private productsService: ProductsService,
  ) {}

  async findAll(branchId?: string, businessId?: string) {
    const where = { ...(branchId ? { branchId } : {}), ...(businessId ? { branch: { businessId } } : {}) };
    return this.prisma.inventoryMovement.findMany({
      where,
      include: { variant: { include: { product: true } }, branch: true },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findByVariant(variantId: string, businessId?: string) {
    return this.prisma.inventory.findMany({
      where: { variantId, ...(businessId ? { branch: { businessId } } : {}) },
      include: { branch: true }
    });
  }

  /**
   * The branch and every product must be of the user's own business (golden rule: a business
   * never touches another's stock). Answers "not found" so other ids can't be probed.
   */
  async assertOwned(user: { role?: string; businessId?: string | null } | undefined, branchId: string | undefined, variantIds: (string | undefined)[]) {
    if (user?.role === 'syncropos') return;
    const businessId = user?.businessId;
    if (!businessId || !branchId || typeof branchId !== 'string') throw new NotFoundException('Sucursal no encontrada');
    const branch = await this.prisma.branch.findFirst({ where: { id: branchId, businessId }, select: { id: true } });
    if (!branch) throw new NotFoundException('Sucursal no encontrada');
    const ids = [...new Set(variantIds)];
    if (ids.some((v) => !v || typeof v !== 'string')) throw new NotFoundException('Producto no encontrado');
    if (!ids.length) return;
    const found = await this.prisma.productVariant.count({ where: { id: { in: ids as string[] }, product: { businessId } } });
    if (found !== ids.length) throw new NotFoundException('Producto no encontrado');
  }

  /** Merchandise that arrived without a purchase order: adds the stock of several products at once. */
  async restockMany(branchId: string, rawItems: { variantId: string, quantity: number }[], userId?: string) {
    const merged = new Map<string, number>();
    for (const i of rawItems) {
      const q = Number(i?.quantity);
      if (!Number.isFinite(q) || q <= 0 || q > 100000) throw new BadRequestException('Cantidad no válida');
      merged.set(i.variantId, (merged.get(i.variantId) ?? 0) + q);
    }
    if (!merged.size) throw new BadRequestException('No hay productos para ingresar');
    const branch = await this.prisma.branch.findUnique({ where: { id: branchId }, select: { businessId: true } });

    await this.prisma.$transaction(async (tx) => {
      for (const [variantId, quantity] of merged) {
        const inventory = await tx.inventory.upsert({
          where: { variantId_branchId: { variantId, branchId } },
          update: { quantity: { increment: quantity } },
          create: { variantId, branchId, quantity },
        });
        await tx.inventoryMovement.create({
          data: { variantId, branchId, type: MovementType.IN, quantity, reason: 'Ingreso de mercancía', previousStock: Math.round(inventory.quantity - quantity), newStock: Math.round(inventory.quantity) },
        });
        await tx.productVariant.update({ where: { id: variantId }, data: { stock: { increment: quantity } } });
      }
    });

    if (userId) {
      try {
        await this.historyService.logAction({
          userId,
          action: 'RESTOCK_PRODUCT',
          entity: 'INVENTORY',
          entityId: branchId,
          details: { quantity: [...merged.values()].reduce((s, q) => s + q, 0), products: merged.size, branchId },
        });
      } catch (e) {
        console.error('[InventoryService] Failed to log RESTOCK_PRODUCT:', e);
      }
    }
    if (branch?.businessId) await this.productsService.invalidateProductsCache(branch.businessId);
    return { products: merged.size, units: [...merged.values()].reduce((s, q) => s + q, 0) };
  }

  async restock(data: { variantId: string, branchId: string, quantity: number }, userId?: string) {
    const { variantId, branchId, quantity } = data;

    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId }
    });
    const businessId = branch?.businessId;

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
          reason: 'restock',
          previousStock: inventory.quantity - quantity,
          newStock: inventory.quantity
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

    if (businessId) {
      await this.productsService.invalidateProductsCache(businessId);
    }

    return result;
  }

  async reconcile(data: { branchId: string, items: { variantId: string, quantity: number }[] }, userId?: string) {
    const { branchId, items } = data;

    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId }
    });
    const businessId = branch?.businessId;

    const result = await this.prisma.$transaction(async (tx) => {
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
            reason: 'audit',
            previousStock: currentQty,
            newStock: item.quantity
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

    if (businessId) {
      await this.productsService.invalidateProductsCache(businessId);
    }

    return result;
  }

  async syncMaster(branchId: string, userId?: string) {
    // 1. Verify if branch is main
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId }
    });

    if (!branch?.isMain) {
      throw new Error("Solo se puede sincronizar el catálogo maestro desde la sucursal principal.");
    }
    const businessId = branch?.businessId;

    // 2. Only this business's products (never another business's catalog)
    if (!businessId) throw new Error('La sucursal no pertenece a ningún negocio.');
    const variants = await this.prisma.productVariant.findMany({ where: { product: { businessId } } });

    const result = await this.prisma.$transaction(async (tx) => {
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

    if (businessId) {
      await this.productsService.invalidateProductsCache(businessId);
    }

    return result;
  }
}
