import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentMethod, MovementType } from '@prisma/client';
import { HistoryService } from '../history/history.service';

import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class SalesService {
  private readonly logger = new Logger(SalesService.name);

  constructor(
    private prisma: PrismaService,
    private historyService: HistoryService,
    private notificationsService: NotificationsService,
  ) {}

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

      // Fetch active shift
      const activeShift = await tx.shift.findFirst({
        where: { userId, branchId, status: 'OPEN' as any }
      });

      for (const item of items) {
        if (item.waitlistId) {
          // 1. Handle Waitlist Item (Ghost Sale)
          const waitlist = await (tx.productWaitlist as any).findUnique({
            where: { id: item.waitlistId }
          });
          
          if (!waitlist) throw new BadRequestException(`Producto en espera ${item.waitlistId} no encontrado`);

          const discountAmt = item.discountAmt || 0;
          const discountPct = item.discountPct || 0;
          const itemSubtotal = (waitlist.price * item.quantity) - discountAmt;
          netSubtotal += itemSubtotal;

          saleItemsData.push({
            waitlistId: item.waitlistId,
            variantId: null,
            quantity: item.quantity,
            price: waitlist.price,
            cost: null,
            discountAmt,
            discountPct,
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
          const currentStock = inventory !== undefined ? inventory.quantity : variant.stock;
          if (currentStock < item.quantity) {
            throw new BadRequestException(`Stock insuficiente para ${variant.name} (${currentStock} disponibles)`);
          }

          const discountAmt = item.discountAmt || 0;
          const discountPct = item.discountPct || 0;
          const itemSubtotal = (variant.price * item.quantity) - discountAmt;
          netSubtotal += itemSubtotal;

          saleItemsData.push({
            variantId: item.variantId,
            waitlistId: null,
            quantity: item.quantity,
            price: variant.price,
            cost: variant.cost,
            discountAmt,
            discountPct,
            subtotal: itemSubtotal
          });

          // 2. Discount Stock
          await tx.inventory.upsert({
            where: { variantId_branchId: { variantId: item.variantId, branchId } },
            update: { quantity: { decrement: item.quantity } },
            create: { variantId: item.variantId, branchId, quantity: variant.stock - item.quantity }
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

      // Apply global discount
      const globalDiscountAmt = data.discountAmt || 0;
      const globalDiscountPct = data.discountPct || 0;
      netSubtotal = Math.max(0, netSubtotal - globalDiscountAmt);

      // 4. Calculate Taxes
      const taxAmount = netSubtotal * (taxRate / 100);
      
      // Calculate IGTF (3% for Cash payments in USD)
      const cashAmount = payments
        .filter((p: any) => p.method === 'CASH')
        .reduce((acc: number, curr: any) => acc + curr.amount, 0);
      
      const igtfAmount = cashAmount * (igtfRate / 100);
      const total = netSubtotal + taxAmount + igtfAmount;

      // 5. Handle Payments, Wallet and Credit
      for (const p of payments) {
        if (p.method === 'WALLET') {
          if (!clientId) throw new BadRequestException('Se requiere un cliente para pagar con monedero');
          
          const client = await tx.client.findUnique({ where: { id: clientId } });
          if (!client || (client.walletBalance || 0) < p.amount) {
            throw new BadRequestException(`Saldo insuficiente en monedero (Disponible: $${client?.walletBalance || 0})`);
          }

          await tx.client.update({
            where: { id: clientId },
            data: { walletBalance: { decrement: p.amount } }
          });
          this.logger.log(`Debitado $${p.amount} del monedero del cliente ${clientId}`);
        }

        if (p.method === 'CREDIT') {
          if (!clientId) throw new BadRequestException('Se requiere un cliente para pagar con crédito / fiado');
          
          const client = await tx.client.findUnique({ where: { id: clientId } });
          if (!client) throw new BadRequestException('Cliente no encontrado');
          
          /* 
          // 1. Validate Down Payment (Inicial) - DISABLED IN CONSTRUCTION MODE
          const downPaymentRequired = total * (client.downPaymentPercentage / 100);
          const otherPaymentsTotal = payments
            .filter((px: any) => px.method !== 'CREDIT')
            .reduce((acc: number, curr: any) => acc + curr.amount, 0);
          
          if (otherPaymentsTotal < downPaymentRequired - 0.01) { // 0.01 tolerance
            throw new BadRequestException(`Se requiere un pago inicial del ${client.downPaymentPercentage}% ($${downPaymentRequired.toFixed(2)}). Solo ha pagado $${otherPaymentsTotal.toFixed(2)}.`);
          }

          // 2. Validate Credit Limit - DISABLED IN CONSTRUCTION MODE
          const availableCredit = (client.creditLimit || 0) - (client.currentDebt || 0);
          if (availableCredit < p.amount) {
            throw new BadRequestException(`Límite de crédito insuficiente (Disponible: $${availableCredit.toFixed(2)})`);
          }
          */

          // 3. Update Client Debt and Schedule
          // If frontend provides promisedPaymentDate, use it. Otherwise calculate based on cycle.
          let nextPayment = new Date();
          if (data.promisedPaymentDate) {
            nextPayment = new Date(data.promisedPaymentDate);
          } else {
            nextPayment.setDate(nextPayment.getDate() + client.paymentCycleDays);
          }

          await tx.client.update({
            where: { id: clientId },
            data: { 
              currentDebt: { increment: p.amount },
              nextPaymentDate: nextPayment
            }
          });

          this.logger.log(`Registrado consumo de crédito de $${p.amount} para el cliente ${clientId}. Próximo pago: ${nextPayment.toDateString()}`);
        }
      }

      const sale = await tx.sale.create({
        data: {
          branchId,
          userId,
          clientId,
          shiftId: activeShift?.id,
          subtotal: netSubtotal,
          taxAmount,
          igtfAmount,
          discountAmt: globalDiscountAmt,
          discountPct: globalDiscountPct,
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

      this.logger.log(`Venta creada exitosamente: ${sale.id} por total $${total}`);

      // 6. Create Credit Transactions for record
      for (const p of payments) {
        if (p.method === 'CREDIT') {
          await tx.creditTransaction.create({
            data: {
              clientId: clientId!,
              amount: p.amount,
              type: 'DEBT',
              saleId: sale.id,
              notes: `Compra a crédito - Ticket #${sale.id.slice(0, 8)}`
            }
          });
        }
      }

      // 5.5 Handle Virtual Wallet (Monedero) - Incrementing balance from change
      if (saveChangeToWallet > 0 && clientId) {
        await tx.client.update({
          where: { id: clientId },
          data: { walletBalance: { increment: saveChangeToWallet } }
        });
        this.logger.log(`Abonado $${saveChangeToWallet} al monedero del cliente ${clientId}`);
      }

      // 6. Create Accounting Entry
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

      // 7. Log Action in History
      await this.historyService.logAction({
        userId,
        action: 'PROCESS_SALE',
        entity: 'SALE',
        entityId: sale.id,
        details: { total, itemsCount: items.length, clientId }
      });

      // 8. Trigger Real-time Notification for the Owner
      const user = await tx.user.findUnique({ where: { id: userId } });
      const branch = await tx.branch.findUnique({ where: { id: branchId } });
      
      await this.notificationsService.create({
        type: 'SALE',
        title: 'Nueva Venta Procesada',
        message: `El cajero ${user?.name} ha procesado una venta por $${total.toFixed(2)} en ${branch?.name}.`,
        branchId,
      });

      return sale;
      });
    } catch (error: any) {
      this.logger.error('CRITICAL SALE ERROR:', error);
      throw new BadRequestException(error.message || 'Error occurred during sale creation');
    }
  }

  async findAll(businessId?: string, branchId?: string) {
    const where: any = {};
    if (branchId) {
      where.branchId = branchId;
    }
    if (businessId) {
      where.branch = { businessId };
    }
    return this.prisma.sale.findMany({
      where,
      include: { items: { include: { variant: true } }, user: true, branch: true },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findOne(id: string, businessId?: string) {
    const where: any = { id };
    if (businessId) {
      where.branch = { businessId };
    }
    const sale = await this.prisma.sale.findFirst({
      where,
      include: { 
        items: { include: { variant: { include: { product: true } } } }, 
        user: true, 
        branch: true,
        client: true,
        returns: { include: { items: true } },
        payments: true
      }
    });
    if (!sale) throw new BadRequestException('Venta no encontrada');
    return sale;
  }

  async returnItems(saleId: string, data: any, userId: string, businessId?: string) {
    const { items, reason } = data; // items is an array of { variantId, quantity }

    try {
      return await this.prisma.$transaction(async (tx) => {
        // 1. Validate Sale
        const sale = await tx.sale.findFirst({
          where: {
            id: saleId,
            ...(businessId ? { branch: { businessId } } : {})
          },
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
          await tx.inventory.upsert({
             where: { variantId_branchId: { variantId: item.variantId, branchId: sale.branchId } },
             update: { quantity: { increment: item.quantity } },
             create: { variantId: item.variantId, branchId: sale.branchId, quantity: item.quantity }
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

        this.logger.log(`Devolución procesada: ${saleReturn.id} para venta ${saleId}`);

        // 7. Log Action in History
        await this.historyService.logAction({
          userId,
          action: 'SALE_RETURN',
          entity: 'SALE',
          entityId: saleId,
          details: { returnId: saleReturn.id, itemsCount: items.length, total }
        });

        return saleReturn;
      });
    } catch (error: any) {
      this.logger.error('CRITICAL RETURN ERROR:', error);
      throw new BadRequestException(error.message || 'Error occurred during return creation');
    }
  }
}

