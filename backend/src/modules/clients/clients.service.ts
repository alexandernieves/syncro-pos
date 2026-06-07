import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ClientsService {
  constructor(private prisma: PrismaService) {}

  async create(data: any) {
    return this.prisma.client.create({ data });
  }

  async findAll(businessId?: string) {
    const where: any = {};
    if (businessId) {
      where.businessId = businessId;
    }
    return this.prisma.client.findMany({
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
    return this.prisma.client.findMany({
      where,
      take: 10,
    });
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
    return client;
  }

  async update(id: string, data: any, businessId?: string) {
    await this.findOne(id, businessId);
    return this.prisma.client.update({
      where: { id },
      data
    });
  }

  async registerPayment(clientId: string, data: { amount: number; notes?: string; paidCurrency?: string; paidAmount?: number; exchangeRate?: number }, businessId?: string) {
    await this.findOne(clientId, businessId);
    return this.prisma.$transaction(async (tx) => {
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

      if (newScore >= 95) {
        newDownPayment = 20; // Super VIP
        newLimit = client.creditLimit * 1.10; // 10% increase
      } else if (newScore >= 85) {
        newDownPayment = 30;
        newLimit = client.creditLimit * 1.05; // 5% increase
      } else if (newScore >= 70) {
        newDownPayment = 40;
      } else if (newScore < 50) {
        newDownPayment = 50; // Return to standard
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

      // 3. Update Client
      const updatedClient = await tx.client.update({
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

      return updatedClient;
    });
  }

  async registerCharge(clientId: string, data: { amount: number; notes?: string }, businessId?: string) {
    await this.findOne(clientId, businessId);
    return this.prisma.$transaction(async (tx) => {
      const client = await tx.client.findUnique({ where: { id: clientId } });
      if (!client) throw new NotFoundException("Cliente no encontrado");

      const now = new Date();
      
      // Update Client
      const updatedClient = await tx.client.update({
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

      return updatedClient;
    });
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
          status: installment.paidAmount + paidAmount >= installment.amount ? 'PAID' : 'PENDING',
          paidAt: installment.paidAmount + paidAmount >= installment.amount ? new Date() : null,
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

  async redeemReward(clientId: string, rewardId: string, businessId?: string) {
    await this.findOne(clientId, businessId);
    return this.prisma.$transaction(async (tx) => {
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
  }

  async getSettings(businessId: string) {
    return this.prisma.setting.findFirst({
      where: { businessId }
    });
  }
}
