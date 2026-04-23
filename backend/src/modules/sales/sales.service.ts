import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentMethod, MovementType } from '@prisma/client';

@Injectable()
export class SalesService {
  private readonly logger = new Logger(SalesService.name);

  constructor(private prisma: PrismaService) {}

  async create(data: any, userId: string) {
    const { branchId, items, payments, clientId, saveChangeToWallet } = data;

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

      // 5.5 Handle Virtual Wallet (Monedero)
      if (saveChangeToWallet > 0 && clientId) {
        await tx.client.update({
          where: { id: clientId },
          data: { walletBalance: { increment: saveChangeToWallet } }
        });
        this.logger.log(`Abonado $${saveChangeToWallet} al monedero del cliente ${clientId}`);
      }

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
      include: { 
        items: { include: { variant: { include: { product: true } } } }, 
        user: true, 
        branch: true,
        client: true,
        returns: { include: { items: true } },
        payments: true
      }
    });
  }

  async returnItems(saleId: string, data: any, userId: string) {
    const { items, reason } = data; // items is an array of { variantId, quantity }

    try {
      return await this.prisma.$transaction(async (tx) => {
        // 1. Validate Sale
        const sale = await tx.sale.findUnique({
          where: { id: saleId },
          include: { items: true, returns: { include: { items: true } } }
        });
        if (!sale) throw new BadRequestException(`Venta ${saleId} no encontrada`);

        let netSubtotal = 0;
        const returnItemsData = [];

        // Calculate already returned quantities for validation
        const returnedQuantities: Record<string, number> = {};
        for (const r of sale.returns) {
          for (const ri of r.items) {
            if (ri.variantId) {
              returnedQuantities[ri.variantId] = (returnedQuantities[ri.variantId] || 0) + ri.quantity;
            }
          }
        }

        for (const item of items) {
          // Find original sale item
          const saleItem = sale.items.find(si => si.variantId === item.variantId);
          if (!saleItem) throw new BadRequestException(`El artículo no pertenece a esta venta`);

          const alreadyReturned = returnedQuantities[item.variantId] || 0;
          if (item.quantity > (saleItem.quantity - alreadyReturned)) {
            throw new BadRequestException(`Cantidad máxima a devolver superada para una de las variantes`);
          }

          if (item.quantity <= 0) continue;

          const itemSubtotal = saleItem.price * item.quantity;
          netSubtotal += itemSubtotal;

          returnItemsData.push({
            variantId: item.variantId,
            quantity: item.quantity,
            price: saleItem.price,
            subtotal: itemSubtotal
          });

          // Restore Inventory
          await tx.inventory.update({
             where: { variantId_branchId: { variantId: item.variantId, branchId: sale.branchId } },
             data: { quantity: { increment: item.quantity } }
          });

          await tx.productVariant.update({
             where: { id: item.variantId },
             data: { stock: { increment: item.quantity } }
          });

          // Register Movement IN
          await tx.inventoryMovement.create({
            data: {
              variantId: item.variantId,
              branchId: sale.branchId,
              type: MovementType.IN,
              quantity: item.quantity,
              reason: `Devolución de Venta #${saleId.slice(-4).toUpperCase()}`,
              referenceId: saleId
            }
          });
        }

        if (returnItemsData.length === 0) {
          throw new BadRequestException("No se enviaron artículos válidos para devolver");
        }

        // Fetch settings for proper tax calculation
        const settings = await tx.setting.findFirst();
        const taxRate = settings?.taxRate || 16;
        const taxAmount = netSubtotal * (taxRate / 100);
        const total = netSubtotal + taxAmount; 

        // Create SaleReturn
        const saleReturn = await tx.saleReturn.create({
          data: {
            saleId,
            userId,
            reason,
            subtotal: netSubtotal,
            taxAmount,
            total,
            items: { create: returnItemsData }
          },
          include: { items: true }
        });

        // Accounting Entry (EXPENSE/RETURN)
        await (tx.accountingEntry as any).create({
          data: {
            description: `Devolución Venta #${saleId.slice(-4).toUpperCase()}`,
            amount: total,
            type: 'EXPENSE',
            category: 'DEVOLUCION_VENTA',
            saleId: null, 
            branchId: sale.branchId,
            userId
          }
        });

        return saleReturn;
      });
    } catch (error: any) {
      this.logger.error('CRITICAL RETURN ERROR:', error);
      throw new BadRequestException(error.message || 'Error occurred during return creation');
    }
  }
}

