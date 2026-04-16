import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AccountingService {
  constructor(private prisma: PrismaService) {}

  async create(data: any) {
    const { amount, ...rest } = data;
    return this.prisma.accountingEntry.create({ 
      data: {
        ...rest,
        amount: Number(amount)
      } 
    });
  }

  async findAll() {
    return (this.prisma.accountingEntry as any).findMany({
      include: { user: true, sale: true },
      orderBy: { createdAt: 'desc' }
    });
  }

  async getStats() {
    const income = await (this.prisma.accountingEntry as any).aggregate({
      where: { type: 'INCOME' },
      _sum: { amount: true }
    });

    const expense = await (this.prisma.accountingEntry as any).aggregate({
      where: { type: 'EXPENSE' },
      _sum: { amount: true }
    });

    return {
      totalIncome: income._sum?.amount || 0,
      totalExpense: expense._sum?.amount || 0,
      balance: (income._sum?.amount || 0) - (expense._sum?.amount || 0)
    };
  }

  async getInvestmentBySupplier() {
    const entries = await (this.prisma.accountingEntry as any).findMany({
      where: { category: 'COMPRA_INVENTARIO' }
    });

    // Grouping by description is a bit hacky, but consistent with current implementation.
    // Ideally we would have a supplierId column.
    const investment = entries.reduce((acc: any, entry: any) => {
      const supplierName = entry.description.split('(')[1]?.replace(')', '') || 'Otros';
      acc[supplierName] = (acc[supplierName] || 0) + entry.amount;
      return acc;
    }, {});

    return Object.entries(investment).map(([name, total]) => ({ name, total }));
  }
}
