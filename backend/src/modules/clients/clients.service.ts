import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ClientsService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  private sanitizeClient(client: any) {
    if (!client) return client;
    const { password, ...sanitized } = client;
    return {
      ...sanitized,
      hasAccount: !!password,
    };
  }

  async create(data: any) {
    if (data.creditLimit === undefined || data.creditLimit === null) {
      data.creditLimit = 100;
    }
    const client = await this.prisma.client.create({ data });
    return this.sanitizeClient(client);
  }

  async findAll(businessId?: string) {
    const where: any = {};
    if (businessId) {
      where.businessId = businessId;
    }
    const clients = await this.prisma.client.findMany({
      where,
      include: { 
        sales: true,
        creditTransactions: {
          orderBy: { createdAt: 'desc' },
          take: 5
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    return clients.map(c => this.sanitizeClient(c));
  }

  async searchByDocument(q: string, businessId?: string) {
    const where: any = {
      OR: [
        { documentId: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
      ]
    };
    if (businessId) {
      where.businessId = businessId;
    }
    const clients = await this.prisma.client.findMany({
      where,
      take: 10,
    });
    return clients.map(c => this.sanitizeClient(c));
  }

  async findOne(id: string, businessId?: string) {
    const where: any = { id };
    if (businessId) {
      where.businessId = businessId;
    }
    const client = await this.prisma.client.findFirst({
      where,
      include: { 
        sales: {
          orderBy: { createdAt: 'desc' },
          include: {
            payments: true,
            branch: true,
            user: true,
            items: {
              include: {
                variant: {
                  include: {
                    product: true
                  }
                }
              }
            }
          }
        },
        creditTransactions: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });
    if (!client) throw new NotFoundException('Cliente no encontrado');
    return this.sanitizeClient(client);
  }

  async update(id: string, data: any, businessId?: string) {
    const client = await this.findOne(id, businessId);
    if (data.creditLimit !== undefined && data.creditLimit > 0) {
      if (data.creditLimit < client.currentDebt) {
        throw new BadRequestException(`El límite de crédito ($${data.creditLimit} USD) no puede ser menor a la de deuda actual del cliente ($${client.currentDebt.toFixed(2)} USD)`);
      }
    }
    const updatedClient = await this.prisma.client.update({
      where: { id },
      data
    });
    return this.sanitizeClient(updatedClient);
  }

  async registerPayment(clientId: string, data: { amount: number; notes?: string; paidCurrency?: string; paidAmount?: number; exchangeRate?: number }, businessId?: string) {
    await this.findOne(clientId, businessId);
    const updatedClient = await this.prisma.$transaction(async (tx) => {
      const client = await tx.client.findUnique({ where: { id: clientId } });
      if (!client) throw new NotFoundException("Cliente no encontrado");

      const now = new Date();
      const isLate = client.nextPaymentDate && now > client.nextPaymentDate;
      
      // 1. Calculate Score Update
      let scoreChange = isLate ? -10 : 5;
      let newScore = Math.min(100, Math.max(0, client.creditScore + scoreChange));

      // 2. Automatic Incentives (Credit Policy)
      let newDownPayment = client.downPaymentPercentage;
      let newLimit = client.creditLimit;

      if (client.creditLimit > 0) {
        if (newScore >= 95) {
          newDownPayment = 20; // Super VIP
          newLimit = client.creditLimit * 1.10; // 10% increase
        } else if (newScore >= 85) {
          newDownPayment = 30;
          newLimit = client.creditLimit * 1.05; // 5% increase
        } else if (newScore >= 70) {
          newDownPayment = 40;
        } else {
          newDownPayment = 50; // Return to standard
          newLimit = Math.min(100, newLimit); // Cap limit at 100 for Level 1
        }
      }

      // Calculate new debt
      const remainingDebt = Math.max(0, client.currentDebt - data.amount);

      // Points gained (1 point per USD on time)
      const pointsGained = !isLate ? Math.floor(data.amount) : 0;

      // Construct notes
      let notes = data.notes || (isLate ? 'Abono realizado con retraso' : 'Abono realizado a tiempo');
      if (data.paidCurrency && data.paidAmount) {
        const rateText = data.exchangeRate ? ` a tasa ${data.exchangeRate.toLocaleString()}` : '';
        notes = `${notes} [Pago en ${data.paidCurrency}: ${data.paidAmount.toLocaleString()}${rateText}]`;
      }

      // 2.5 Apply payment to loan installments sequentially
      const pendingInstallments = await tx.loanInstallment.findMany({
        where: {
          loan: { clientId },
          status: 'PENDING'
        },
        include: { loan: true },
        orderBy: { dueDate: 'asc' }
      });

      let remainingPayment = data.amount;
      for (const inst of pendingInstallments) {
        if (remainingPayment <= 0.001) break;

        const needed = inst.amount - inst.paidAmount;
        if (needed <= 0.001) continue;

        const toApply = Math.min(remainingPayment, needed);
        const newPaidAmount = inst.paidAmount + toApply;
        const isPaid = (inst.amount - newPaidAmount) <= 0.01;

        await tx.loanInstallment.update({
          where: { id: inst.id },
          data: {
            paidAmount: newPaidAmount,
            status: isPaid ? 'PAID' : 'PENDING',
            paidAt: isPaid ? new Date() : undefined
          }
        });

        const loanRemaining = Math.max(0, inst.loan.remainingBalance - toApply);
        const isLoanPaid = loanRemaining <= 0.01;

        await tx.loan.update({
          where: { id: inst.loanId },
          data: {
            remainingBalance: loanRemaining,
            status: isLoanPaid ? 'PAID' : 'PENDING'
          }
        });

        if (isLoanPaid) {
          await tx.loanInstallment.updateMany({
            where: {
              loanId: inst.loanId,
              status: 'PENDING',
              id: { not: inst.id }
            },
            data: {
              status: 'PAID',
              paidAmount: 0,
              paidAt: new Date()
            }
          });
        }

        remainingPayment -= toApply;
      }

      // 3. Update Client
      const updatedClientVal = await tx.client.update({
        where: { id: clientId },
        data: { 
          currentDebt: remainingDebt,
          creditScore: newScore,
          downPaymentPercentage: newDownPayment,
          creditLimit: newLimit,
          totalPaymentsCount: { increment: 1 },
          latePaymentsCount: isLate ? { increment: 1 } : undefined,
          lastPaymentDate: now,
          nextPaymentDate: remainingDebt <= 0.01 ? null : client.nextPaymentDate,
          accumulatedPoints: { increment: pointsGained },
          isSuspended: remainingDebt <= 0.01 ? false : client.isSuspended
        }
      });

      // 4. Create Transaction record
      await tx.creditTransaction.create({
        data: {
          clientId,
          amount: -data.amount,
          type: 'PAYMENT',
          notes: notes
        }
      });

      return updatedClientVal;
    });
    return this.sanitizeClient(updatedClient);
  }

  async registerCharge(clientId: string, data: { amount: number; notes?: string }, businessId?: string) {
    await this.findOne(clientId, businessId);
    const updatedClient = await this.prisma.$transaction(async (tx) => {
      const client = await tx.client.findUnique({ where: { id: clientId } });
      if (!client) throw new NotFoundException("Cliente no encontrado");

      const now = new Date();
      
      // Update Client
      const updatedClientVal = await tx.client.update({
        where: { id: clientId },
        data: { 
          currentDebt: { increment: data.amount },
          nextPaymentDate: client.nextPaymentDate || new Date(now.getTime() + client.paymentCycleDays * 24 * 60 * 60 * 1000)
        }
      });

      // Create Transaction record
      await tx.creditTransaction.create({
        data: {
          clientId,
          amount: data.amount,
          type: 'DEBT',
          notes: data.notes || 'Cargo manual de deuda'
        }
      });

      return updatedClientVal;
    });
    return this.sanitizeClient(updatedClient);
  }

  async remove(id: string, businessId?: string) {
    await this.findOne(id, businessId);
    return this.prisma.client.delete({ where: { id } });
  }

  // --- LOANS SECTION ---

  async createLoan(
    clientId: string,
    data: { amount: number; interestRate: number; installmentsCount: number; period: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' },
    businessId?: string,
  ) {
    await this.findOne(clientId, businessId);
    return this.prisma.$transaction(async (tx) => {
      const client = await tx.client.findUnique({ where: { id: clientId } });
      if (!client) throw new NotFoundException('Cliente no encontrado');

      const interest = data.amount * (data.interestRate / 100);
      const totalToPay = data.amount + interest;
      const installmentAmount = parseFloat((totalToPay / data.installmentsCount).toFixed(2));

      // Create Loan
      const loan = await tx.loan.create({
        data: {
          clientId,
          amount: data.amount,
          interestRate: data.interestRate,
          totalToPay,
          remainingBalance: totalToPay,
          installmentsCount: data.installmentsCount,
          status: 'PENDING',
        },
      });

      // Create Installments
      const now = new Date();
      const intervalDays = data.period === 'WEEKLY' ? 7 : data.period === 'BIWEEKLY' ? 15 : 30;

      for (let i = 1; i <= data.installmentsCount; i++) {
        const dueDate = new Date(now.getTime() + i * intervalDays * 24 * 60 * 60 * 1000);
        await tx.loanInstallment.create({
          data: {
            loanId: loan.id,
            installmentNumber: i,
            dueDate,
            amount: i === data.installmentsCount 
              ? parseFloat((totalToPay - (installmentAmount * (data.installmentsCount - 1))).toFixed(2)) 
              : installmentAmount,
            paidAmount: 0,
            status: 'PENDING',
          },
        });
      }

      // Update Client Debt
      await tx.client.update({
        where: { id: clientId },
        data: {
          currentDebt: { increment: totalToPay },
          nextPaymentDate: client.nextPaymentDate || new Date(now.getTime() + intervalDays * 24 * 60 * 60 * 1000),
        },
      });

      // Create Debt transaction
      await tx.creditTransaction.create({
        data: {
          clientId,
          amount: totalToPay,
          type: 'DEBT',
          notes: `Préstamo de efectivo aprobado: $${data.amount} USD + $${interest} USD de intereses (${data.interestRate}%)`,
        },
      });

      return loan;
    });
  }

  async getLoans(clientId: string, businessId?: string) {
    await this.findOne(clientId, businessId);
    return this.prisma.loan.findMany({
      where: { clientId },
      include: {
        installments: {
          orderBy: { installmentNumber: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Returns a unified debt summary for the client portal PWA.
   * Each entry represents one credit purchase (loan) with its installments,
   * linked to the original sale via creditTransactions.
   * Also synthesizes virtual loan records for legacy credit transactions lacking real Loan entries.
   */
  async getPortalDebts(clientId: string) {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
    });
    if (!client) {
      return [];
    }

    // 1. Get all PENDING loans with installments
    const loans = await this.prisma.loan.findMany({
      where: {
        clientId,
        status: 'PENDING',
      },
      include: {
        installments: {
          where: { status: 'PENDING' },
          orderBy: { dueDate: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // 2. Get credit transactions of type DEBT to find sale descriptions
    const debtTxs = await this.prisma.creditTransaction.findMany({
      where: {
        clientId,
        type: 'DEBT',
      },
      orderBy: { createdAt: 'desc' },
    });

    // 3. Build a map of amount+date to saleId/notes (best-effort matching)
    const txMap = new Map<string, { id: string; saleId: string | null; notes: string | null; createdAt: Date; amount: number }>();
    for (const tx of debtTxs) {
      txMap.set(`${tx.amount.toFixed(2)}_${tx.createdAt.toISOString().slice(0, 10)}`, {
        id: tx.id,
        saleId: tx.saleId ?? null,
        notes: tx.notes ?? null,
        createdAt: tx.createdAt,
        amount: tx.amount,
      });
    }

    // Keep track of which credit transactions matched a loan
    const matchedTxIds = new Set<string>();

    // 4. Fetch sale item details for matched/unmatched saleIds
    const uniqueSaleIds = [...new Set(debtTxs.map(t => t.saleId).filter(Boolean))] as string[];
    const sales = uniqueSaleIds.length > 0
      ? await this.prisma.sale.findMany({
          where: { id: { in: uniqueSaleIds } },
          include: {
            items: {
              include: {
                variant: {
                  include: { product: true },
                },
              },
            },
          },
        })
      : [];

    const saleMap = new Map(sales.map(s => [s.id, s]));

    // 5. Build loan debt entries
    const loanDebts = loans.map(loan => {
      const dateKey = loan.createdAt.toISOString().slice(0, 10);
      const txInfo = txMap.get(`${loan.amount.toFixed(2)}_${dateKey}`);
      if (txInfo) {
        matchedTxIds.add(txInfo.id);
      }
      const sale = txInfo?.saleId ? saleMap.get(txInfo.saleId) : undefined;

      const itemsSummary = sale?.items?.map((si: any) => ({
        name: si.variant?.product?.name || si.variant?.name || 'Artículo',
        quantity: si.quantity,
        price: si.price,
        subtotal: si.subtotal,
      })) || [];

      const nextInstallment = loan.installments[0];

      return {
        loanId: loan.id,
        saleId: txInfo?.saleId ?? null,
        description: txInfo?.notes ?? `Compra a crédito`,
        amount: loan.amount,
        totalToPay: loan.totalToPay,
        remainingBalance: loan.remainingBalance,
        nextPaymentDate: nextInstallment?.dueDate ?? null,
        nextPaymentAmount: nextInstallment?.amount ?? null,
        createdAt: loan.createdAt,
        items: itemsSummary,
        installments: loan.installments.map(inst => ({
          id: inst.id,
          number: inst.installmentNumber,
          dueDate: inst.dueDate,
          amount: inst.amount,
          paidAmount: inst.paidAmount,
          remaining: inst.amount - inst.paidAmount,
          status: inst.status,
        })),
      };
    });

    // 6. Find unmatched DEBT transactions
    const unmatchedTxs = debtTxs.filter(tx => !matchedTxIds.has(tx.id));

    // 7. Apportion remaining balance from client.currentDebt
    const totalLoanRemaining = loans.reduce((sum, l) => sum + l.remainingBalance, 0);
    let legacyDebtToAllocate = Math.max(0, (client.currentDebt || 0) - totalLoanRemaining);

    const legacyDebts = [];
    for (const tx of unmatchedTxs) {
      const allocatedRemaining = Math.min(tx.amount, legacyDebtToAllocate);
      legacyDebtToAllocate -= allocatedRemaining;

      // Only return legacy debts that are still active (allocatedRemaining > 0)
      if (allocatedRemaining > 0) {
        const sale = tx.saleId ? saleMap.get(tx.saleId) : undefined;
        const itemsSummary = sale?.items?.map((si: any) => ({
          name: si.variant?.product?.name || si.variant?.name || 'Artículo',
          quantity: si.quantity,
          price: si.price,
          subtotal: si.subtotal,
        })) || [];

        // Fallback due date
        const fallbackDueDate = client.nextPaymentDate 
          ? new Date(client.nextPaymentDate)
          : new Date(tx.createdAt.getTime() + (client.paymentCycleDays || 15) * 24 * 60 * 60 * 1000);

        legacyDebts.push({
          loanId: `legacy-${tx.id}`,
          saleId: tx.saleId ?? null,
          description: tx.notes ?? `Compra a crédito`,
          amount: tx.amount,
          totalToPay: tx.amount,
          remainingBalance: allocatedRemaining,
          nextPaymentDate: fallbackDueDate,
          nextPaymentAmount: allocatedRemaining,
          createdAt: tx.createdAt,
          items: itemsSummary,
          installments: [
            {
              id: `legacy-inst-${tx.id}`,
              number: 1,
              dueDate: fallbackDueDate,
              amount: tx.amount,
              paidAmount: tx.amount - allocatedRemaining,
              remaining: allocatedRemaining,
              status: 'PENDING',
            }
          ],
        });
      }
    }

    // 8. Return combined results, sorted by createdAt desc
    return [...loanDebts, ...legacyDebts].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async payInstallment(installmentId: string, paidAmount: number, businessId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const installment = await tx.loanInstallment.findUnique({
        where: { id: installmentId },
        include: { loan: true },
      });

      if (!installment) throw new NotFoundException('Cuota no encontrada');

      const updatedInstallment = await tx.loanInstallment.update({
        where: { id: installmentId },
        data: {
          paidAmount: { increment: paidAmount },
          status: 'PAID',
          paidAt: new Date(),
        },
      });

      // Update Loan Balance
      const remaining = Math.max(0, installment.loan.remainingBalance - paidAmount);
      const isLoanPaid = remaining <= 0.01;

      await tx.loan.update({
        where: { id: installment.loanId },
        data: {
          remainingBalance: remaining,
          status: isLoanPaid ? 'PAID' : 'PENDING',
        },
      });

      // Redistribute remaining balance to other PENDING installments of this loan
      if (!isLoanPaid) {
        const remainingInstallments = await tx.loanInstallment.findMany({
          where: {
            loanId: installment.loanId,
            status: 'PENDING',
            id: { not: installmentId }
          },
          orderBy: { installmentNumber: 'asc' }
        });

        if (remainingInstallments.length > 0) {
          const baseAmt = parseFloat((remaining / remainingInstallments.length).toFixed(2));
          for (let i = 0; i < remainingInstallments.length; i++) {
            const inst = remainingInstallments[i];
            const isLast = i === remainingInstallments.length - 1;
            const newAmt = isLast
              ? parseFloat((remaining - (baseAmt * (remainingInstallments.length - 1))).toFixed(2))
              : baseAmt;

            await tx.loanInstallment.update({
              where: { id: inst.id },
              data: { amount: newAmt }
            });
          }
        }
      } else {
        // If loan is fully paid, mark all other pending installments as paid
        await tx.loanInstallment.updateMany({
          where: {
            loanId: installment.loanId,
            status: 'PENDING',
            id: { not: installmentId }
          },
          data: {
            status: 'PAID',
            paidAmount: 0,
            paidAt: new Date()
          }
        });
      }

      // Register payment in credit book
      await tx.client.update({
        where: { id: installment.loan.clientId },
        data: {
          currentDebt: { decrement: paidAmount },
        },
      });

      await tx.creditTransaction.create({
        data: {
          clientId: installment.loan.clientId,
          amount: -paidAmount,
          type: 'PAYMENT',
          notes: `Pago a cuota #${installment.installmentNumber} de préstamo`,
        },
      });

      return updatedInstallment;
    });
  }

  // --- REWARDS SECTION ---

  async createReward(businessId: string, data: { name: string; description?: string; pointsCost: number; stock?: number; image?: string }) {
    return this.prisma.reward.create({
      data: {
        businessId,
        name: data.name,
        description: data.description,
        pointsCost: data.pointsCost,
        stock: data.stock ?? 0,
        image: data.image,
      },
    });
  }

  async getRewards(businessId: string) {
    return this.prisma.reward.findMany({
      where: { businessId },
      orderBy: { pointsCost: 'asc' },
    });
  }


  async getPortalBusinesses() {
    // Return all main branches (stores) that have a businessId, including business info
    return this.prisma.branch.findMany({
      where: {
        businessId: { not: null },
        isMain: true,
      },
      include: {
        business: {
          select: {
            id: true,
            name: true,
            logo: true,
          }
        }
      },
      orderBy: { name: 'asc' }
    });
  }

  async getPortalBusinessBranches(businessId: string) {
    if (!businessId) {
      throw new BadRequestException('El ID del negocio es requerido');
    }
    return this.prisma.branch.findMany({
      where: { businessId },
      orderBy: [{ isMain: 'desc' }, { name: 'asc' }]
    });
  }


  async getPortalProducts(branchId: string) {
    if (!branchId) {
      throw new BadRequestException('El ID de la sucursal es requerido');
    }

    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId }
    });

    if (!branch) {
      throw new NotFoundException('Sucursal no encontrada');
    }

    const businessId = branch.businessId;
    if (!businessId) {
      throw new BadRequestException('La sucursal no está asociada a ningún negocio');
    }

    const products = await this.prisma.product.findMany({
      where: { businessId },
      include: {
        category: true,
        variants: {
          include: {
            inventory: {
              where: { branchId }
            }
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    return products.map(p => {
      const mappedVariants = p.variants.map(v => {
        const branchInventory = v.inventory.find(inv => inv.branchId === branchId);
        const stock = branchInventory ? branchInventory.quantity : 0;
        return {
          id: v.id,
          name: v.name,
          sku: v.sku,
          barcode: v.barcode,
          price: v.price,
          promoPrice: v.promoPrice,
          bulkPrice: v.bulkPrice,
          stock,
        };
      });

      const totalStock = mappedVariants.reduce((acc, v) => acc + v.stock, 0);

      return {
        id: p.id,
        name: p.name,
        description: p.description,
        image: p.image,
        category: p.category ? { id: p.category.id, name: p.category.name } : null,
        variants: mappedVariants,
        totalStock
      };
    });
  }

  async redeemReward(clientId: string, rewardId: string, businessId?: string) {
    await this.findOne(clientId, businessId);
    const result = await this.prisma.$transaction(async (tx) => {
      const client = await tx.client.findUnique({ where: { id: clientId } });
      const reward = await tx.reward.findUnique({ where: { id: rewardId } });

      if (!client) throw new NotFoundException('Cliente no encontrado');
      if (!reward) throw new NotFoundException('Premio no encontrado');
      if (client.accumulatedPoints < reward.pointsCost) {
        throw new Error('Puntos insuficientes para canjear este premio');
      }
      if (reward.stock <= 0) {
        throw new Error('Este premio se encuentra agotado temporalmente');
      }

      // Deduct points from client
      const updatedClient = await tx.client.update({
        where: { id: clientId },
        data: {
          accumulatedPoints: { decrement: reward.pointsCost },
        },
      });

      // Deduct stock from reward
      await tx.reward.update({
        where: { id: rewardId },
        data: {
          stock: { decrement: 1 },
        },
      });

      // Create RedeemedReward log
      const redemption = await tx.redeemedReward.create({
        data: {
          clientId,
          rewardId,
          pointsSpent: reward.pointsCost,
        },
      });

      // Create a record in credit transactions to document point redemption
      await tx.creditTransaction.create({
        data: {
          clientId,
          amount: 0,
          type: 'PAYMENT',
          notes: `Canje de Premio: ${reward.name} (-${reward.pointsCost} pts)`,
        },
      });

      return { redemption, updatedClient };
    });
    return {
      redemption: result.redemption,
      updatedClient: this.sanitizeClient(result.updatedClient),
    };
  }

  async getSettings(businessId: string) {
    const settings = await this.prisma.setting.findFirst({
      where: { businessId }
    });
    return settings ?? {};
  }

  async generateActivationCode(clientId: string, businessId: string, creditLimit?: number) {
    const activationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const activationCodeExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const client = await this.findOne(clientId, businessId);
    if (creditLimit !== undefined && creditLimit > 0) {
      if (creditLimit < client.currentDebt) {
        throw new BadRequestException(`El límite de crédito ($${creditLimit} USD) no puede ser menor a la de deuda actual del cliente ($${client.currentDebt.toFixed(2)} USD)`);
      }
    }
    await this.prisma.client.update({
      where: { id: clientId },
      data: {
        activationCode,
        activationCodeExpires,
        ...(creditLimit !== undefined && creditLimit > 0 ? { creditLimit } : {}),
      },
    });

    return { activationCode };
  }

  async requestLoan(clientId: string, amount: number, businessId: string) {
    if (![20, 30, 40, 50].includes(amount)) {
      throw new BadRequestException('Monto de préstamo inválido para el Nivel 1. Debe ser 20, 30, 40 o 50 USD.');
    }

    const client = await this.prisma.client.findFirst({
      where: { id: clientId, businessId },
    });
    if (!client) throw new NotFoundException('Cliente no encontrado');

    const activeLoans = await this.prisma.loan.findMany({
      where: {
        clientId,
        status: { in: ['REQUESTED' as any, 'APPROVED_PENDING_DISBURSEMENT' as any, 'PENDING' as any, 'OVERDUE' as any] },
      },
    });
    if (activeLoans.length > 0) {
      throw new BadRequestException('Ya tienes una solicitud de préstamo activa o un préstamo pendiente de pago.');
    }

    const interest = amount * 0.20;
    const totalToPay = amount + interest;

    return this.prisma.loan.create({
      data: {
        clientId,
        amount,
        interestRate: 20,
        totalToPay,
        remainingBalance: totalToPay,
        installmentsCount: 4, // Default, updated on disbursement
        status: 'REQUESTED' as any,
      },
    });
  }

  async getPendingRequests(businessId: string) {
    const loans = await this.prisma.loan.findMany({
      where: {
        status: { in: ['REQUESTED' as any, 'APPROVED_PENDING_DISBURSEMENT' as any] },
        client: { businessId },
      },
      include: {
        client: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return loans.map((loan) => ({
      ...loan,
      client: this.sanitizeClient(loan.client),
    }));
  }

  async approveLoan(loanId: string, businessId: string) {
    const loan = await this.prisma.loan.findFirst({
      where: { id: loanId, client: { businessId } },
    });
    if (!loan) throw new NotFoundException('Préstamo no encontrado');
    if (loan.status !== 'REQUESTED') {
      throw new BadRequestException('El préstamo no se encuentra en estado solicitado');
    }
    return this.prisma.loan.update({
      where: { id: loanId },
      data: { status: 'APPROVED_PENDING_DISBURSEMENT' as any },
    });
  }

  async disburseLoan(loanId: string, installmentsCount: number, period: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY', businessId: string) {
    const loan = await this.prisma.loan.findFirst({
      where: { id: loanId, client: { businessId } },
      include: { client: true },
    });
    if (!loan) throw new NotFoundException('Préstamo no encontrado');
    if (loan.status !== ('APPROVED_PENDING_DISBURSEMENT' as any)) {
      throw new BadRequestException('El préstamo no está aprobado para desembolso');
    }

    return this.prisma.$transaction(async (tx) => {
      // Update Loan status and installmentsCount
      const updatedLoan = await tx.loan.update({
        where: { id: loanId },
        data: {
          status: 'PENDING',
          installmentsCount,
        },
      });

      const totalToPay = loan.totalToPay;
      const installmentAmount = parseFloat((totalToPay / installmentsCount).toFixed(2));
      const now = new Date();
      const intervalDays = period === 'WEEKLY' ? 7 : period === 'BIWEEKLY' ? 15 : 30;
      let firstDueDate: Date | null = null;

      // Create Installments
      for (let i = 1; i <= installmentsCount; i++) {
        const dueDate = new Date(now.getTime() + i * intervalDays * 24 * 60 * 60 * 1000);
        if (i === 1) firstDueDate = dueDate;

        await tx.loanInstallment.create({
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

      // Update Client currentDebt and nextPaymentDate
      await tx.client.update({
        where: { id: loan.clientId },
        data: {
          currentDebt: { increment: totalToPay },
          nextPaymentDate: loan.client.nextPaymentDate || firstDueDate || new Date(now.getTime() + intervalDays * 24 * 60 * 60 * 1000),
        },
      });

      // Create CreditTransaction record
      const interest = totalToPay - loan.amount;
      await tx.creditTransaction.create({
        data: {
          clientId: loan.clientId,
          amount: totalToPay,
          type: 'DEBT',
          notes: `Préstamo de efectivo desembolsado: $${loan.amount} USD + $${interest.toFixed(2)} USD de intereses (20% semanal)`,
        },
      });

      return updatedLoan;
    });
  }

  async toggleSuspension(clientId: string, businessId: string) {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, businessId }
    });
    if (!client) throw new NotFoundException('Cliente no encontrado');

    const updated = await this.prisma.client.update({
      where: { id: clientId },
      data: { isSuspended: !client.isSuspended }
    });

    return this.sanitizeClient(updated);
  }

  async deleteAccount(clientId: string, securityPin: string, businessId: string) {
    const settings = await this.prisma.setting.findFirst({
      where: { businessId }
    });
    if (!settings?.discountPin || settings.discountPin !== securityPin) {
      throw new BadRequestException('PIN de seguridad incorrecto');
    }

    const client = await this.prisma.client.findFirst({
      where: { id: clientId, businessId }
    });
    if (!client) throw new NotFoundException('Cliente no encontrado');

    await this.prisma.$transaction(async (tx) => {
      // Clear credentials, suspension, credit limit, and current debt
      await tx.client.update({
        where: { id: clientId },
        data: {
          password: null,
          activationCode: null,
          activationCodeExpires: null,
          currentDebt: 0,
          nextPaymentDate: null,
          creditLimit: 0,
          isSuspended: false,
        }
      });

      // Delete all loans (this will cascade delete installments)
      await tx.loan.deleteMany({
        where: { clientId }
      });

      // Delete all credit transactions
      await tx.creditTransaction.deleteMany({
        where: { clientId }
      });
    });

    return { success: true };
  }

  async submitPayment(
    clientId: string,
    businessId: string,
    data: { debtId: string; loanId?: string; amount: number; receiptUrl: string; referenceNumber?: string },
  ) {
    const { debtId, loanId, amount, receiptUrl, referenceNumber } = data;

    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
    });
    if (!client) throw new NotFoundException('Cliente no encontrado');

    const submission = await this.prisma.paymentSubmission.create({
      data: {
        clientId,
        businessId,
        loanId: loanId || null,
        debtId,
        amount,
        receiptUrl,
        referenceNumber: referenceNumber || null,
        status: 'PENDING',
      },
      include: {
        client: true,
      },
    });

    // Notify business via WebSocket and DB Notification
    try {
      const branch = await this.prisma.branch.findFirst({
        where: { businessId, isMain: true },
      }) || await this.prisma.branch.findFirst({
        where: { businessId },
      });

      if (branch) {
        await this.notificationsService.create({
          type: 'ALERT',
          title: 'Nuevo Abono Recibido',
          message: `El cliente ${client.name} ha reportado un pago de $${amount.toFixed(2)} USD vía Pago Móvil.`,
          branchId: branch.id,
        });
      }
    } catch (err) {
      console.error('Error creating notification for payment submission', err);
    }

    return submission;
  }

  async getClientSubmissions(clientId: string) {
    return this.prisma.paymentSubmission.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPendingSubmissions(businessId: string) {
    return this.prisma.paymentSubmission.findMany({
      where: { businessId },
      include: {
        client: {
          select: { id: true, name: true, documentId: true, phone: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async approveSubmission(submissionId: string, businessId: string) {
    const submission = await this.prisma.paymentSubmission.findFirst({
      where: { id: submissionId, businessId, status: 'PENDING' },
    });
    if (!submission) throw new NotFoundException('Solicitud de abono no encontrada o ya procesada');

    // Update submission status
    await this.prisma.paymentSubmission.update({
      where: { id: submissionId },
      data: { status: 'APPROVED' },
    });

    // Call existing registerPayment to update debt and log transaction
    await this.registerPayment(
      submission.clientId,
      {
        amount: submission.amount,
        notes: `Abono PWA Pago Móvil validado [Ref: ${submission.id.substring(0, 8)}]`,
      },
      businessId,
    );

    return { success: true };
  }

  async rejectSubmission(submissionId: string, businessId: string) {
    const submission = await this.prisma.paymentSubmission.findFirst({
      where: { id: submissionId, businessId, status: 'PENDING' },
    });
    if (!submission) throw new NotFoundException('Solicitud de abono no encontrada o ya procesada');

    // Update status to REJECTED
    await this.prisma.paymentSubmission.update({
      where: { id: submissionId },
      data: { status: 'REJECTED' },
    });

    return { success: true };
  }

  // --- DELIVERY FLOW METHODS ---

  async createDeliveryOrder(clientId: string, businessId: string, data: any) {
    const { products, total, lat, lng, address, phone } = data;

    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
    });
    if (!client) throw new NotFoundException('Cliente no encontrado');

    const order = await this.prisma.deliveryOrder.create({
      data: {
        clientId,
        businessId,
        products: products || [],
        total: parseFloat(String(total)),
        lat: parseFloat(String(lat)),
        lng: parseFloat(String(lng)),
        address: address || null,
        phone: phone || client.phone,
        clientName: client.name,
        status: 'PENDING',
      },
    });

    // Notify business via DB Notification
    try {
      const branch = await this.prisma.branch.findFirst({
        where: { businessId, isMain: true },
      }) || await this.prisma.branch.findFirst({
        where: { businessId },
      });

      if (branch) {
        await this.notificationsService.create({
          type: 'ALERT',
          title: 'Nuevo Pedido Delivery',
          message: `El cliente ${client.name} ha solicitado un delivery por $${total.toFixed(2)} USD.`,
          branchId: branch.id,
        });
      }
    } catch (err) {
      console.error('Error creating notification for delivery order', err);
    }

    return order;
  }

  async getPortalDeliveryOrders(clientId: string) {
    return this.prisma.deliveryOrder.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getActiveDeliveryOrder(clientId: string) {
    return this.prisma.deliveryOrder.findFirst({
      where: {
        clientId,
        status: { in: ['PENDING', 'APPROVED', 'SHIPPED', 'ON_THE_WAY'] },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getDeliveryOrders(businessId: string) {
    return this.prisma.deliveryOrder.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateDeliveryOrderStatus(id: string, status: string, businessId: string) {
    const order = await this.prisma.deliveryOrder.findFirst({
      where: { id, businessId },
    });
    if (!order) throw new NotFoundException('Pedido de delivery no encontrado');

    return this.prisma.deliveryOrder.update({
      where: { id },
      data: { status },
    });
  }

  async cancelDeliveryOrder(id: string, clientId: string) {
    const order = await this.prisma.deliveryOrder.findFirst({
      where: { id, clientId },
    });
    if (!order) throw new NotFoundException('Pedido de delivery no encontrado');

    if (order.status !== 'PENDING' && order.status !== 'APPROVED') {
      throw new BadRequestException('No se puede cancelar el pedido en este estado');
    }

    return this.prisma.deliveryOrder.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
  }

  async deleteDeliveryOrder(id: string, businessId: string) {
    const order = await this.prisma.deliveryOrder.findFirst({
      where: { id, businessId },
    });
    if (!order) throw new NotFoundException('Pedido de delivery no encontrado');

    return this.prisma.deliveryOrder.delete({
      where: { id },
    });
  }
}
