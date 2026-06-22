import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PurchaseOrderStatus, MovementType } from '@prisma/client';

@Injectable()
export class PurchaseOrdersService {
  constructor(private prisma: PrismaService) {}

  async create(data: {
    supplierId: string;
    branchId: string;
    notes?: string;
    taxRate?: number;
    discountAmount?: number;
    items: Array<{
      variantId: string;
      quantity: number;
      cost: number;
      taxRate?: number;
      discountAmount?: number;
    }>;
  }) {
    const { supplierId, branchId, items, notes, taxRate: globalTaxRate = 0, discountAmount: globalDiscount = 0 } = data;

    const supplier = await this.prisma.supplier.findFirst({
      where: { id: supplierId, status: 'ACTIVE' }
    });
    if (!supplier) throw new BadRequestException('Proveedor no encontrado o inactivo');

    const branch = await this.prisma.branch.findUnique({ where: { id: branchId } });
    if (!branch) throw new BadRequestException('Sucursal no encontrada');

    // Generate Order Number
    const lastOrder = await (this.prisma.purchaseOrder as any).findFirst({
      where: { number: { startsWith: 'OC-' } },
      orderBy: { createdAt: 'desc' },
      select: { number: true }
    });
    
    let nextNumber = "OC-0001";
    if (lastOrder?.number) {
      const parts = lastOrder.number.split("-");
      if (parts.length === 2) {
        const currentNum = parseInt(parts[1]);
        nextNumber = `OC-${(currentNum + 1).toString().padStart(4, '0')}`;
      }
    }

    let subtotal = 0;
    let totalTaxAmount = 0;
    let totalItemsDiscount = 0;

    const orderItems = items.map(item => {
      const itemSubtotal = item.quantity * item.cost;
      const effectiveTaxRate = item.taxRate !== undefined ? item.taxRate : globalTaxRate;
      const itemTaxAmount = itemSubtotal * (effectiveTaxRate / 100);
      const itemDiscount = item.discountAmount || 0;
      const itemTotal = itemSubtotal + itemTaxAmount - itemDiscount;
      
      subtotal += itemSubtotal;
      totalTaxAmount += itemTaxAmount;
      totalItemsDiscount += itemDiscount;

      return {
        variantId: item.variantId,
        quantity: item.quantity,
        cost: item.cost,
        taxRate: effectiveTaxRate,
        taxAmount: itemTaxAmount,
        discountAmount: itemDiscount,
        subtotal: itemSubtotal,
        total: itemTotal
      };
    });

    const total = subtotal + totalTaxAmount - (totalItemsDiscount + globalDiscount);

    return (this.prisma.$transaction as any)(async (tx: any) => {
      return tx.purchaseOrder.create({
        data: {
          number: nextNumber,
          supplierId,
          branchId,
          status: PurchaseOrderStatus.DRAFT,
          subtotal,
          taxRate: globalTaxRate,
          taxAmount: totalTaxAmount,
          discountAmount: globalDiscount + totalItemsDiscount,
          total,
          notes,
          items: { create: orderItems }
        },
        include: {
          items: { include: { variant: { include: { product: true } } } },
          supplier: true,
          branch: true
        }
      });
    });
  }

  async findAll(branchId?: string) {
    const where = branchId ? { branchId } : {};
    return this.prisma.purchaseOrder.findMany({
      where,
      include: {
        items: { include: { variant: { include: { product: true } } } },
        supplier: true,
        branch: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findOne(id: string) {
    const purchaseOrder = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        items: { include: { variant: { include: { product: true } } } },
        supplier: true,
        branch: true,
        invoices: true
      }
    });

    if (!purchaseOrder) throw new NotFoundException('Orden de compra no encontrada');
    return purchaseOrder;
  }

  async receive(id: string, userId: string) {
    const purchaseOrder = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        items: { include: { variant: { include: { product: true } } } },
        supplier: true,
        branch: true
      }
    });

    if (!purchaseOrder) throw new NotFoundException('Orden de compra no encontrada');

    if (purchaseOrder.status !== PurchaseOrderStatus.SENT && purchaseOrder.status !== PurchaseOrderStatus.DRAFT) {
      throw new BadRequestException('La orden debe estar enviada o en borrador antes de recibir');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Check if we need to auto-send first
      if (purchaseOrder.status === PurchaseOrderStatus.DRAFT) {
        await tx.purchaseOrder.update({ where: { id }, data: { status: PurchaseOrderStatus.SENT } });
      }

      // 2. Update Order Status to RECEIVED
      const updatedOrder = await tx.purchaseOrder.update({
        where: { id },
        data: { status: PurchaseOrderStatus.RECEIVED }
      });

      // 3. Process Items
      for (const item of purchaseOrder.items) {
        // Find existing inventory
        const inventory = await tx.inventory.findUnique({
          where: { variantId_branchId: { variantId: item.variantId, branchId: purchaseOrder.branchId } }
        });

        const currentStock = inventory?.quantity || 0;
        const newStock = item.quantity;

        // Update Stock
        if (inventory) {
          await tx.inventory.update({
            where: { id: inventory.id },
            data: { quantity: currentStock + newStock }
          });
        } else {
          await tx.inventory.create({
            data: { variantId: item.variantId, branchId: purchaseOrder.branchId, quantity: newStock }
          });
        }

        // 3. WEIGHTED AVERAGE COST (WAC/PPP) calculation
        const variant = await tx.productVariant.findUnique({ where: { id: item.variantId } });
        if (variant) {
          const currentCost = variant.cost || 0;
          const totalStockAfter = currentStock + newStock;
          
          // Formula: ((Existing Stock * Old Cost) + (New Stock * New Cost)) / Total Stock
          const newWacCost = totalStockAfter > 0 
            ? ((currentStock * currentCost) + (newStock * item.cost)) / totalStockAfter 
            : item.cost;

          await tx.productVariant.update({
            where: { id: item.variantId },
            data: { cost: newWacCost }
          });
        }

        // 4. Record Movement
        await tx.inventoryMovement.create({
          data: {
            variantId: item.variantId,
            branchId: purchaseOrder.branchId,
            type: MovementType.IN,
            quantity: newStock,
            reason: `Recepción OC #${(purchaseOrder as any).number || purchaseOrder.id.substring(0, 8)}`,
            referenceId: purchaseOrder.id,
            previousStock: currentStock,
            newStock: currentStock + newStock
          }
        });
      }

      // 5. Accounting Entry (Inventory Expense / Liability)
      await tx.accountingEntry.create({
        data: {
          description: `Compra: ${(purchaseOrder as any).number || 'N/A'} - Proveedor: ${purchaseOrder.supplier.name}`,
          type: 'EXPENSE',
          amount: purchaseOrder.total,
          category: 'COMPRA_INVENTARIO',
          userId
        }
      });

      // 6. Automatic Supplier Invoice (Accounts Payable)
      const creditDays = (purchaseOrder.supplier as any).creditDays || 0;
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + creditDays);

      const invoice = await tx.supplierInvoice.create({
        data: {
          supplierId: purchaseOrder.supplierId,
          purchaseOrderId: purchaseOrder.id,
          total: purchaseOrder.total,
          balance: purchaseOrder.total,
          dueDate,
          status: 'PENDING'
        }
      });

      return { updatedOrder, invoice };
    }, { 
      timeout: 10000 // Higher timeout for complex transactions
    });
  }

  async send(id: string) {
    const purchaseOrder = await this.prisma.purchaseOrder.findUnique({ where: { id } });
    if (!purchaseOrder) throw new NotFoundException('Orden de compra no encontrada');
    if (purchaseOrder.status !== PurchaseOrderStatus.DRAFT) {
      throw new BadRequestException('Solo se pueden enviar órdenes en estado BORRADOR');
    }
    return this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: PurchaseOrderStatus.SENT }
    });
  }

  async updateStatus(id: string, status: PurchaseOrderStatus) {
    const purchaseOrder = await this.prisma.purchaseOrder.findUnique({
      where: { id }
    });

    if (!purchaseOrder) {
      throw new NotFoundException('Orden de compra no encontrada');
    }

    return this.prisma.purchaseOrder.update({
      where: { id },
      data: { status }
    });
  }

  async delete(id: string) {
    const purchaseOrder = await this.prisma.purchaseOrder.findUnique({
      where: { id }
    });

    if (!purchaseOrder) {
      throw new NotFoundException('Orden de compra no encontrada');
    }

    if (purchaseOrder.status !== PurchaseOrderStatus.DRAFT) {
      throw new BadRequestException('Solo se pueden eliminar órdenes en estado BORRADOR');
    }

    return this.prisma.purchaseOrder.delete({
      where: { id }
    });
  }
}
