import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentMethod, MovementType } from '@prisma/client';
import { HistoryService } from '../history/history.service';

import { NotificationsService } from '../notifications/notifications.service';

interface PendingPurchase {
  id: string;
  clientId: string;
  businessId: string;
  branchId: string;
  amount: number;
  frequencyDays: number;
  cartData: any;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  saleId?: string;
  createdAt: number;
}

@Injectable()
export class SalesService {
  private readonly logger = new Logger(SalesService.name);

  constructor(
    private prisma: PrismaService,
    private historyService: HistoryService,
    private notificationsService: NotificationsService,
  ) {}

  async create(data: any, userId: string, skipLoanCreation = false) {
    const { branchId, items, payments, clientId, saveChangeToWallet, generatePwaCode } = data;

    try {
      const result = await this.prisma.$transaction(async (tx) => {
      // 0. Get current settings for taxes
      const settings = await tx.setting.findFirst();
      const taxRate = settings?.taxRate ?? 16;
      const igtfRate = settings?.igtfRate ?? 3;

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
              referenceId: 'pending',
              previousStock: currentStock,
              newStock: currentStock - item.quantity
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

          // Validate Credit Limit ONLY if the client has registered (has password/account in PWA) and has a limit > 0
          const isSyncoCreditUser = !!client.password;
          if (isSyncoCreditUser && client.creditLimit > 0) {
            const availableCredit = (client.creditLimit || 0) - (client.currentDebt || 0);
            if (availableCredit < p.amount - 0.01) {
              throw new BadRequestException(`Crédito insuficiente. Disponible: $${availableCredit.toFixed(2)} USD`);
            }
          }

          // Update Client Debt and Schedule
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

      // 6. Create Credit Transactions + Loan+Installments for CREDIT payments
      for (const p of payments) {
        if (p.method === 'CREDIT') {
          // 6a. Create credit transaction record
          await tx.creditTransaction.create({
            data: {
              clientId: clientId!,
              amount: p.amount,
              type: 'DEBT',
              saleId: sale.id,
              notes: `Compra a crédito - Ticket #${sale.id.slice(0, 8)}`
            }
          });

          // 6b. Create a Loan + LoanInstallments so the PWA can display the debt breakdown.
          // For direct POS credit sales, use 1 installment due on nextPaymentDate.
          if (skipLoanCreation) {
            this.logger.log(`Saltando creación de Loan en create() (flujo PIN con pre-aprobación) para venta ${sale.id}`);
          } else {
            const creditClient = await tx.client.findUnique({ where: { id: clientId! } });
            if (creditClient) {
              const now = new Date();
              let dueDate: Date;
              if (data.promisedPaymentDate) {
                dueDate = new Date(data.promisedPaymentDate);
              } else {
                dueDate = new Date(now.getTime() + creditClient.paymentCycleDays * 24 * 60 * 60 * 1000);
              }

              // Build a human-readable description from sale items
              const itemNames = saleItemsData.slice(0, 2).map((si: any) => {
                return `${si.quantity}x artículo`;
              }).join(', ');
              const description = `Ticket #${sale.id.slice(0, 8)}${itemNames ? ` — ${itemNames}` : ''}`;

              const loan = await tx.loan.create({
                data: {
                  clientId: clientId!,
                  amount: p.amount,
                  interestRate: 0,
                  totalToPay: p.amount,
                  remainingBalance: p.amount,
                  installmentsCount: 1,
                  status: 'PENDING',
                },
              });

              await tx.loanInstallment.create({
                data: {
                  loanId: loan.id,
                  installmentNumber: 1,
                  dueDate,
                  amount: p.amount,
                  paidAmount: 0,
                  status: 'PENDING',
                },
              });

              this.logger.log(`Loan ${loan.id} + 1 installment creado para venta CREDIT ${sale.id}, vence ${dueDate.toDateString()}`);
            }
          }
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

        // 7. Get user and branch for notification
        const user = await tx.user.findUnique({ where: { id: userId } });
        const branch = await tx.branch.findUnique({ where: { id: branchId } });

        // 8. Generate PWA Activation Code if requested
        let generatedPwaCode: string | null = null;
        if (generatePwaCode && clientId) {
          generatedPwaCode = Math.floor(100000 + Math.random() * 900000).toString();
          const activationCodeExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
          await tx.client.update({
            where: { id: clientId },
            data: {
              activationCode: generatedPwaCode,
              activationCodeExpires,
            },
          });
          this.logger.log(`Generado código de activación PWA ${generatedPwaCode} para el cliente ${clientId}`);
        }

        return {
          sale,
          user,
          branch,
          total,
          generatedPwaCode
        };
      });

      // 9. Run logging and notifications OUTSIDE of the transaction block
      try {
        await this.historyService.logAction({
          userId,
          action: 'PROCESS_SALE',
          entity: 'SALE',
          entityId: result.sale.id,
          details: { total: result.total, itemsCount: items.length, clientId }
        });
      } catch (e) {
        this.logger.error('Error logging audit action:', e);
      }

      try {
        await this.notificationsService.create({
          type: 'SALE',
          title: 'Nueva Venta Procesada',
          message: `El cajero ${result.user?.name || 'Cajero'} ha procesado una venta por $${result.total.toFixed(2)} en ${result.branch?.name || 'Sucursal'}.`,
          branchId,
        });
      } catch (e) {
        this.logger.error('Error triggering websocket notification:', e);
      }

      return {
        ...result.sale,
        pwaCode: result.generatedPwaCode
      };
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
      include: { 
        items: { 
          include: { 
            variant: { 
              include: { 
                product: true 
              } 
            } 
          } 
        }, 
        user: true, 
        branch: true,
        client: true,
        payments: true
      },
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
          const currentInv = await tx.inventory.findUnique({
             where: { variantId_branchId: { variantId: item.variantId, branchId: sale.branchId } }
          });
          const prevQty = currentInv ? currentInv.quantity : 0;
          const newQty = prevQty + item.quantity;

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
              referenceId: saleId,
              previousStock: prevQty,
              newStock: newQty
            }
          });
        }

        if (returnItemsData.length === 0) {
          throw new BadRequestException("No se enviaron artículos válidos para devolver");
        }

        // Fetch settings for proper tax calculation
        const settings = await tx.setting.findFirst();
        const taxRate = settings?.taxRate ?? 16;
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

  // In-memory store for pending credit checkouts
  private pendingPurchases = new Map<string, PendingPurchase>();

  async createPendingPurchase(clientId: string, amount: number, businessId: string, cartData: any) {
    // Clear expired checkouts (older than 15 minutes)
    const now = Date.now();
    for (const [pin, purchase] of this.pendingPurchases.entries()) {
      if (now - purchase.createdAt > 15 * 60 * 1000) {
        this.pendingPurchases.delete(pin);
      }
    }

    // Fetch configured frequency days from client or settings
    let frequencyDays = 15;
    const client = await this.prisma.client.findUnique({
      where: { id: clientId }
    });
    if (client && client.syncroCreditFrequencyDays) {
      frequencyDays = client.syncroCreditFrequencyDays;
    } else if (businessId) {
      const settings = await this.prisma.setting.findFirst({
        where: { businessId }
      });
      if (settings && settings.syncroCreditFrequencyDays) {
        frequencyDays = settings.syncroCreditFrequencyDays;
      }
    }

    // Generate random 6-digit PIN
    let pinCode: string;
    do {
      pinCode = Math.floor(100000 + Math.random() * 900000).toString();
    } while (this.pendingPurchases.has(pinCode));

    const pendingPurchase: PendingPurchase = {
      id: Math.random().toString(36).substring(2, 9),
      clientId,
      businessId,
      branchId: cartData.branchId || '',
      amount,
      frequencyDays,
      cartData,
      status: 'PENDING',
      createdAt: now,
    };

    this.pendingPurchases.set(pinCode, pendingPurchase);
    this.logger.log(`Creada compra de crédito pendiente con PIN: ${pinCode} para el cliente ${clientId}`);

    return { pinCode };
  }

  async getPendingPurchaseStatus(pinCode: string) {
    const purchase = this.pendingPurchases.get(pinCode);
    if (!purchase) {
      throw new BadRequestException('El PIN de autorización ha expirado o es inválido');
    }
    return { status: purchase.status, saleId: purchase.saleId };
  }

  async rejectPendingPurchase(pinCode: string) {
    const purchase = this.pendingPurchases.get(pinCode);
    if (purchase) {
      purchase.status = 'REJECTED';
      this.logger.log(`Compra de crédito pendiente con PIN: ${pinCode} rechazada/cancelada`);
    }
    return { success: true };
  }

  async getPendingPurchaseDetails(pinCode: string, clientId: string) {
    const purchase = this.pendingPurchases.get(pinCode);
    if (!purchase) {
      throw new BadRequestException('El PIN de autorización ha expirado o es inválido');
    }

    if (purchase.clientId !== clientId) {
      throw new BadRequestException('El PIN ingresado no corresponde a tu cuenta');
    }

    if (purchase.status !== 'PENDING') {
      throw new BadRequestException(`Esta compra ya ha sido procesada o cancelada (Estado: ${purchase.status})`);
    }

    // Get branch name from the branch that created this pending purchase
    let branchName = 'Syncro POS';
    if (purchase.branchId) {
      const branch = await this.prisma.branch.findUnique({ where: { id: purchase.branchId } });
      if (branch?.name) branchName = branch.name;
    } else if (purchase.businessId) {
      // Fallback: use business name if branch not found
      const settings = await this.prisma.setting.findFirst({ where: { businessId: purchase.businessId } });
      if (settings?.businessName) branchName = settings.businessName;
    }

    // Return cart items and total details
    return {
      id: purchase.id,
      amount: purchase.amount,
      frequencyDays: purchase.frequencyDays,
      businessName: branchName,
      items: purchase.cartData.items || [],
    };
  }

  async approvePendingPurchase(pinCode: string, clientId: string, installmentsCount: number, frequencyDays?: number) {
    const purchase = this.pendingPurchases.get(pinCode);
    if (!purchase) {
      throw new BadRequestException('El PIN de autorización ha expirado o es inválido');
    }

    if (purchase.clientId !== clientId) {
      throw new BadRequestException('El PIN ingresado no corresponde a tu cuenta');
    }

    if (purchase.status !== 'PENDING') {
      throw new BadRequestException('Esta compra ya ha sido procesada o cancelada');
    }

    // Validate client's credit limit / debt
    const client = await this.prisma.client.findUnique({ where: { id: clientId } });
    if (!client) {
      throw new BadRequestException('Cliente no encontrado');
    }

    if (client.creditLimit > 0) {
      const availableCredit = (client.creditLimit || 0) - (client.currentDebt || 0);
      if (availableCredit < purchase.amount - 0.01) {
        throw new BadRequestException(`Crédito disponible insuficiente. Cupo disponible: $${availableCredit.toFixed(2)} USD.`);
      }
    }

    // 1. Process the actual sale using the cartData
    const cartData = purchase.cartData;
    const cashierUserId = cartData.userId;

    const sale = await this.create(cartData, cashierUserId, true);

    // 2. Create the interest-free Loan representing the installments
    const now = new Date();
    const intervalDays = frequencyDays || purchase.frequencyDays || 15;
    const totalToPay = purchase.amount;
    const installmentAmount = parseFloat((totalToPay / installmentsCount).toFixed(2));

    const loan = await this.prisma.loan.create({
      data: {
        clientId,
        amount: purchase.amount,
        interestRate: 0,
        totalToPay,
        remainingBalance: totalToPay,
        installmentsCount,
        status: 'PENDING',
      },
    });

    for (let i = 1; i <= installmentsCount; i++) {
      const dueDate = new Date(now.getTime() + i * intervalDays * 24 * 60 * 60 * 1000);
      await this.prisma.loanInstallment.create({
        data: {
          loanId: loan.id,
          installmentNumber: i,
          dueDate,
          amount: i === installmentsCount
            ? parseFloat((totalToPay - (installmentAmount * (installmentsCount - 1))).toFixed(2))
            : installmentAmount,
          paidAmount: 0,
          status: 'PENDING',
        },
      });
    }

    // 3. Update client's nextPaymentDate to the first installment due date
    const firstDueDate = new Date(now.getTime() + 1 * intervalDays * 24 * 60 * 60 * 1000);
    await this.prisma.client.update({
      where: { id: clientId },
      data: { nextPaymentDate: firstDueDate }
    });

    // 4. Update the pending purchase status to APPROVED
    purchase.status = 'APPROVED';
    purchase.saleId = sale.id;

    this.logger.log(`Compra de crédito pendiente con PIN: ${pinCode} APROBADA y creada Venta: ${sale.id}, Préstamo: ${loan.id}`);

    return { success: true, saleId: sale.id };
  }
}

