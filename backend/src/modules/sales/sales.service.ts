import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentMethod, MovementType } from '@prisma/client';

@Injectable()
export class SalesService {
  private readonly logger = new Logger(SalesService.name);

  constructor(private prisma: PrismaService) {}

  async create(data: any, userId: string) {
    const { branchId, items, payments, clientId } = data;

    try {
      return await this.prisma.$transaction(async (tx) => {
      // 0. Get current settings for taxes
      const settings = await tx.setting.findFirst();
      const taxRate = settings?.taxRate || 16;
      const igtfRate = settings?.igtfRate || 3;

      let netSubtotal = 0;
      const saleItemsData = [];

      for (const item of items) {
        if (item.waitlistId) {
          // 1. Handle Waitlist Item (Ghost Sale)
          const waitlist = await (tx.productWaitlist as any).findUnique({
            where: { id: item.waitlistId }
          });
          
          if (!waitlist) throw new BadRequestException(`Producto en espera ${item.waitlistId} no encontrado`);

          const itemSubtotal = waitlist.price * item.quantity;
          netSubtotal += itemSubtotal;

          saleItemsData.push({
            waitlistId: item.waitlistId,
            variantId: null,
            quantity: item.quantity,
            price: waitlist.price,
            cost: null,
            subtotal: itemSubtotal
          });

          // Note: We don't discount stock or record movement for waitlist items as they lack variants.
        } else {
          // 1. Fetch variant and check stock
          const variant = await tx.productVariant.findUnique({
            where: { id: item.variantId },
            include: { 
              inventory: { where: { branchId } },
              product: { include: { category: true } }
            }
          });

          if (!variant) throw new BadRequestException(`Variante ${item.variantId} no encontrada`);
          
          const inventory = variant.inventory[0];
          const currentStock = inventory?.quantity || 0;
          if (currentStock < item.quantity) {
            throw new BadRequestException(`Stock insuficiente para ${variant.name} (${currentStock} disponibles)`);
          }

          const itemSubtotal = variant.price * item.quantity;
          netSubtotal += itemSubtotal;

          saleItemsData.push({
            variantId: item.variantId,
            waitlistId: null,
            quantity: item.quantity,
            price: variant.price,
            cost: variant.cost,
            subtotal: itemSubtotal
          });

          // 2. Discount Stock
          await tx.inventory.update({
            where: { variantId_branchId: { variantId: item.variantId, branchId } },
            data: { quantity: { decrement: item.quantity } }
          });

          await tx.productVariant.update({
            where: { id: item.variantId },
            data: { stock: { decrement: item.quantity } }
          });

          // 3. Register Movement
          await tx.inventoryMovement.create({
            data: {
              variantId: item.variantId,
              branchId,
              type: MovementType.OUT,
              quantity: item.quantity,
              reason: 'sale',
              referenceId: 'pending' 
            }
          });
        }
      }

      // 4. Calculate Taxes
      const taxAmount = netSubtotal * (taxRate / 100);
      
      // Calculate IGTF (3% for Cash payments in USD)
      const cashAmount = payments
        .filter((p: any) => p.method === 'CASH')
        .reduce((acc: number, curr: any) => acc + curr.amount, 0);
      
      const igtfAmount = cashAmount * (igtfRate / 100);
      const total = netSubtotal + taxAmount + igtfAmount;

      // 5. Create Sale
      // Find active shift for this user and branch
      const activeShift = await tx.shift.findFirst({
        where: { userId, branchId, status: 'OPEN' }
      });

      const sale = await tx.sale.create({
        data: {
          branchId,
          userId,
          clientId,
          shiftId: activeShift?.id, // Link to active shift if exists
          subtotal: netSubtotal,
          taxAmount,
          igtfAmount,
          total,
          items: {
            create: saleItemsData
          },
          payments: {
            create: payments.map((p: any) => ({
              method: p.method,
              amount: p.amount,
              amountLocal: p.amountLocal,
              exchangeRate: p.exchangeRate,
              reference: p.reference
            }))
          }
        },
        include: { items: true, payments: true }
      });

      this.logger.log(`Venta creada exitosamente: ${sale.id} por total $${total} (Sub: ${netSubtotal}, Tax: ${taxAmount}, IGTF: ${igtfAmount})`);

      // 6. Create Accounting Entry for Ledger
      await (tx.accountingEntry as any).create({
        data: {
          description: `Venta POS #${sale.id.slice(-4).toUpperCase()}`,
          amount: total,
          type: 'INCOME',
          category: 'VENTA_POS',
          saleId: sale.id,
          branchId,
          userId
        }
      });

      return sale;
      });
    } catch (error: any) {
      this.logger.error('CRITICAL SALE ERROR:', error);
      throw new BadRequestException(error.message || 'Error occurred during sale creation');
    }
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
