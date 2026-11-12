import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PurchaseOrderStatus, MovementType } from '@prisma/client';
import { ProductsService } from '../products/products.service';
import { PURCHASE_UNITS, normalizeUnit } from './units';

const OPEN_STATUSES: PurchaseOrderStatus[] = [PurchaseOrderStatus.DRAFT, PurchaseOrderStatus.SENT, PurchaseOrderStatus.PARTIAL];
const fmt = (n: number) => (Math.round(n * 1000) / 1000).toString();

@Injectable()
export class PurchaseOrdersService {
  constructor(private prisma: PrismaService, private products: ProductsService) {}

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
      unit?: string;
      unitFactor?: number;
      taxRate?: number;
      discountAmount?: number;
    }>;
  }, businessId?: string) {
    const { supplierId, branchId, notes, taxRate: globalTaxRate = 0, discountAmount: globalDiscount = 0 } = data;

    // Everything must belong to the business placing the order
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: supplierId, status: 'ACTIVE', ...(businessId ? { businessId } : {}) }
    });
    if (!supplier) throw new BadRequestException('Proveedor no encontrado o inactivo');

    const branch = await this.prisma.branch.findFirst({ where: { id: branchId, ...(businessId ? { businessId } : {}) } });
    if (!branch) throw new BadRequestException('Sucursal no encontrada');

    const items = (data.items ?? []).map((i) => {
      const quantity = Number(i.quantity);
      const cost = Number(i.cost);
      if (!Number.isFinite(quantity) || quantity <= 0) throw new BadRequestException('Cantidad no válida');
      if (!Number.isFinite(cost) || cost < 0) throw new BadRequestException('Costo no válido');
      return { ...i, quantity, cost, ...normalizeUnit(i.unit, i.unitFactor) };
    });
    if (businessId) {
      const ids = [...new Set(items.map((i) => i.variantId))];
      const owned = await this.prisma.productVariant.count({ where: { id: { in: ids }, product: { businessId } } });
      if (owned !== ids.length) throw new BadRequestException('Hay productos que no son de tu negocio');
    }

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
        unit: item.unit,
        unitFactor: item.unitFactor,
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

  async findAll(branchId?: string, scope: object = {}) {
    const where = { ...(branchId ? { branchId } : {}), ...scope };
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

  /**
   * Receives an order, all of it or what actually arrived (`lines`: item id → quantity in the
   * ordered unit). Can be called again for what was pending. Stock goes up by quantity × unit
   * factor in the branch and in the product, with an IN movement in the kardex that says how much
   * of what was ordered arrived and how much is still pending. The cost of each stock unit is
   * averaged in (WAC). The received value goes to accounting and to a supplier invoice.
   */
  async receive(id: string, userId: string, lines?: Array<{ itemId: string; quantity: number }>) {
    const purchaseOrder = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        items: { include: { variant: { include: { product: true } } } },
        supplier: true,
        branch: true
      }
    });

    if (!purchaseOrder) throw new NotFoundException('Orden de compra no encontrada');
    if (!OPEN_STATUSES.includes(purchaseOrder.status)) {
      throw new BadRequestException(purchaseOrder.status === PurchaseOrderStatus.RECEIVED ? 'Esta orden ya fue recibida completa' : 'Esta orden está anulada');
    }

    // What arrives now, per item (in the ordered unit)
    const arriving = new Map<string, number>();
    if (lines?.length) {
      for (const l of lines) {
        const q = Number(l?.quantity);
        if (!Number.isFinite(q) || q < 0 || q > 1_000_000) throw new BadRequestException('Cantidad no válida');
        if (!purchaseOrder.items.some((i) => i.id === l.itemId)) throw new BadRequestException('Ese producto no es de esta orden');
        if (q > 0) arriving.set(l.itemId, (arriving.get(l.itemId) ?? 0) + q);
      }
    } else {
      for (const i of purchaseOrder.items) {
        const pending = Math.max(0, i.quantity - i.receivedQuantity);
        if (pending > 0) arriving.set(i.id, pending);
      }
    }
    if (!arriving.size) throw new BadRequestException('Indica cuánto llegó de al menos un producto');

    const number = purchaseOrder.number || purchaseOrder.id.substring(0, 8);
    const result = await this.prisma.$transaction(async (tx) => {
      let receivedValue = 0;
      let stillPending = 0;
      const summary: Array<{ product: string; ordered: number; received: number; pending: number; unit: string }> = [];

      for (const item of purchaseOrder.items) {
        const now = arriving.get(item.id) ?? 0;
        const receivedTotal = item.receivedQuantity + now;
        const pending = Math.max(0, item.quantity - receivedTotal);
        stillPending += pending;
        if (now <= 0) continue;

        const units = now * item.unitFactor;
        const costPerUnit = item.unitFactor > 0 ? item.cost / item.unitFactor : item.cost;
        receivedValue += now * item.cost * (1 + (item.taxRate || 0) / 100);

        const inventory = await tx.inventory.upsert({
          where: { variantId_branchId: { variantId: item.variantId, branchId: purchaseOrder.branchId } },
          update: { quantity: { increment: units } },
          create: { variantId: item.variantId, branchId: purchaseOrder.branchId, quantity: units },
        });
        const before = inventory.quantity - units;

        // Weighted average cost of one stock unit
        const variant = await tx.productVariant.findUnique({ where: { id: item.variantId }, select: { cost: true, stock: true } });
        const oldCost = variant?.cost || 0;
        const base = Math.max(0, variant?.stock ?? before);
        const newCost = base + units > 0 ? (base * oldCost + units * costPerUnit) / (base + units) : costPerUnit;
        await tx.productVariant.update({ where: { id: item.variantId }, data: { stock: { increment: units }, cost: newCost } });

        await tx.purchaseOrderItem.update({ where: { id: item.id }, data: { receivedQuantity: receivedTotal } });

        const unitLabel = (PURCHASE_UNITS[item.unit]?.label ?? 'Unidades').toLowerCase();
        const inUnits = item.unit === 'UNIDAD' ? '' : ` (${fmt(units)} unid.)`;
        await tx.inventoryMovement.create({
          data: {
            variantId: item.variantId,
            branchId: purchaseOrder.branchId,
            type: MovementType.IN,
            quantity: units,
            reason: `Recepción ${number}: llegaron ${fmt(now)} de ${fmt(item.quantity)} ${unitLabel}${inUnits}${pending > 0 ? ` · pendiente ${fmt(pending)}` : ''}`,
            referenceId: purchaseOrder.id,
            previousStock: Math.round(before),
            newStock: Math.round(inventory.quantity),
          },
        });
        summary.push({ product: item.variant.product.name, ordered: item.quantity, received: receivedTotal, pending, unit: item.unit });
      }

      const status = stillPending > 0 ? PurchaseOrderStatus.PARTIAL : PurchaseOrderStatus.RECEIVED;
      const updatedOrder = await tx.purchaseOrder.update({ where: { id }, data: { status } });

      // Only what arrived is owed to the supplier
      const amount = Math.round(receivedValue * 100) / 100;
      let invoice: any = null;
      if (amount > 0) {
        await tx.accountingEntry.create({
          data: {
            description: `Compra ${number} - Proveedor: ${purchaseOrder.supplier.name}${status === PurchaseOrderStatus.PARTIAL ? ' (recepción parcial)' : ''}`,
            type: 'EXPENSE',
            amount,
            category: 'COMPRA_INVENTARIO',
            userId,
          },
        });
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + ((purchaseOrder.supplier as any).creditDays || 0));
        invoice = await tx.supplierInvoice.create({
          data: { supplierId: purchaseOrder.supplierId, purchaseOrderId: purchaseOrder.id, total: amount, balance: amount, dueDate, status: 'PENDING' },
        });
      }
      return { updatedOrder, invoice, status, pending: stillPending, summary };
    }, { timeout: 20000 });

    if (purchaseOrder.branch?.businessId) await this.products.invalidateProductsCache(purchaseOrder.branch.businessId).catch(() => undefined);
    return result;
  }

  /** The supplier won't send what's missing: the order is closed as it is (what's pending stays on record). */
  async closePending(id: string) {
    const po = await this.prisma.purchaseOrder.findUnique({ where: { id } });
    if (!po) throw new NotFoundException('Orden de compra no encontrada');
    if (po.status !== PurchaseOrderStatus.PARTIAL) throw new BadRequestException('Solo se cierran órdenes recibidas a medias');
    return this.prisma.purchaseOrder.update({ where: { id }, data: { status: PurchaseOrderStatus.RECEIVED, notes: [po.notes, 'Cerrada con faltante: lo pendiente no llegó.'].filter(Boolean).join('\n') } });
  }

  /** Last unit used for each product in an order of this business ("cajas de 24" comes back by itself). */
  async unitMemory(businessId: string) {
    const rows = await this.prisma.purchaseOrderItem.findMany({
      where: { purchaseOrder: { branch: { businessId } } },
      orderBy: { purchaseOrder: { createdAt: 'desc' } },
      distinct: ['variantId'],
      select: { variantId: true, unit: true, unitFactor: true, cost: true },
      take: 2000,
    });
    return Object.fromEntries(rows.map((r) => [r.variantId, { unit: r.unit, unitFactor: r.unitFactor, cost: r.cost }]));
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
