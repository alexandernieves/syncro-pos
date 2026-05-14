import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ExpensesService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  async findAll(branchId?: string) {
    return this.prisma.expense.findMany({
      where: branchId ? { branchId } : {},
      include: {
        user: { select: { name: true } },
        branch: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(data: {
    amount: number;
    category: string;
    description?: string;
    branchId: string;
    userId: string;
  }) {
    const expense = await this.prisma.$transaction(async (tx) => {
      const createdExpense = await tx.expense.create({
        data: {
          amount: data.amount,
          category: data.category,
          description: data.description,
          branchId: data.branchId,
          userId: data.userId,
        },
      });

      // Register in General Accounting Ledger
      await tx.accountingEntry.create({
        data: {
          description: `Gasto Administrativo: ${data.category} - ${data.description || 'Sin detalles'}`,
          type: 'EXPENSE',
          amount: data.amount,
          category: 'GASTO_OPERATIVO',
          branchId: data.branchId,
          userId: data.userId,
        }
      });

      return createdExpense;
    });

    // Trigger Notification
    const user = await this.prisma.user.findUnique({ where: { id: data.userId } });
    const branch = await this.prisma.branch.findUnique({ where: { id: data.branchId } });

    await this.notificationsService.create({
      type: 'EXPENSE',
      title: 'Nuevo Gasto Registrado',
      message: `${user?.name} ha registrado un gasto de $${data.amount.toFixed(2)} (${data.category}) en ${branch?.name}.`,
      branchId: data.branchId,
    });

    return expense;
  }

  async remove(id: string) {
    return this.prisma.expense.delete({ where: { id } });
  }

  async getStats(branchId?: string) {
    const total = await this.prisma.expense.aggregate({
      where: branchId ? { branchId } : {},
      _sum: { amount: true },
    });

    return {
      totalAmount: total._sum.amount || 0,
    };
  }
}
