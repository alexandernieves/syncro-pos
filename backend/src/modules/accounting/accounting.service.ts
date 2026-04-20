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
      include: { user: true, sale: true, branch: true },
      orderBy: { createdAt: 'desc' }
    });
  }

  async getAdvancedStats(branchId?: string, startDate?: string, endDate?: string) {
    const queryWhere: any = {};
    if (branchId) queryWhere.branchId = branchId;
    if (startDate || endDate) {
      queryWhere.createdAt = {};
      if (startDate) queryWhere.createdAt.gte = new Date(startDate);
      if (endDate) queryWhere.createdAt.lte = new Date(endDate);
    }

    // 1. Sales & Revenue
    const sales = await this.prisma.sale.findMany({
      where: queryWhere,
      include: {
        items: {
          include: { variant: true }
        },
        payments: true
      }
    });

    const totalSales = sales.reduce((acc, s) => acc + s.total, 0);
    const totalNetSales = sales.reduce((acc, s) => acc + s.subtotal, 0);
    const totalTickets = sales.length;
    
    // 2. COGS & Margin
    let totalCogs = 0;
    let totalUnits = 0;
    sales.forEach(s => {
      s.items.forEach((item: any) => {
        totalCogs += (item.cost || 0) * item.quantity;
        totalUnits += item.quantity;
      });
    });

    const grossMargin = totalNetSales - totalCogs;
    const grossMarginPercentage = totalNetSales > 0 ? (grossMargin / totalNetSales) * 100 : 0;

    // 3. Efficiency Metrics
    const ticketPromedio = totalTickets > 0 ? totalSales / totalTickets : 0;
    const upt = totalTickets > 0 ? totalUnits / totalTickets : 0;

    // 4. Payments
    const paymentMethods: any = {};
    sales.forEach(s => {
      s.payments.forEach(p => {
        paymentMethods[p.method] = (paymentMethods[p.method] || 0) + p.amount;
      });
    });

    // 5. Operating Expenses
    const expenseEntries = await this.prisma.accountingEntry.findMany({
      where: {
        ...queryWhere,
        type: 'EXPENSE'
      }
    });
    const operatingExpenses = expenseEntries.reduce((acc, e) => acc + e.amount, 0);
    
    // 6. Net Profit
    const netProfit = grossMargin - operatingExpenses;

    // 7. Inventory Value (Snapshot)
    const inventoryFilter: any = {};
    if (branchId) inventoryFilter.branchId = branchId;
    
    const inventory = await this.prisma.inventory.findMany({
      where: inventoryFilter,
      include: { variant: true }
    });
    const totalInventoryValue = inventory.reduce((acc, i) => acc + (i.variant.cost || 0) * i.quantity, 0);

    // 8. Daily Sales Trend (last 7 days by default if no dates)
    const trendDays = 7;
    const trend = [];
    for (let i = trendDays - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayStart = new Date(d.setHours(0, 0, 0, 0));
      const dayEnd = new Date(d.setHours(23, 59, 59, 999));
      
      const daySales = sales.filter(s => s.createdAt >= dayStart && s.createdAt <= dayEnd);
      trend.push({
        date: dayStart.toISOString().split('T')[0],
        revenue: daySales.reduce((acc, s) => acc + s.total, 0),
        orders: daySales.length
      });
    }

    return {
      revenue: {
        totalSales,
        totalNetSales,
        totalTickets,
        ticketPromedio,
        upt
      },
      profitability: {
        cogs: totalCogs,
        grossMargin,
        grossMarginPercentage,
        operatingExpenses,
        netProfit,
        netMarginPercentage: totalSales > 0 ? (netProfit / totalSales) * 100 : 0
      },
      inventory: {
        totalValue: totalInventoryValue
      },
      payments: paymentMethods,
      trend,
      topProducts: Object.entries(
        sales.flatMap(s => s.items).reduce((acc: any, item: any) => {
          const name = item.variant.name;
          const profit = (item.price - (item.cost || 0)) * item.quantity;
          if (!acc[name]) acc[name] = { name, profit: 0, quantity: 0 };
          acc[name].profit += profit;
          acc[name].quantity += item.quantity;
          return acc;
        }, {})
      ).map(([_, val]) => val).sort((a: any, b: any) => b.profit - a.profit).slice(0, 5)
    };
  }

  async getStats() {
    const incomeAggregate = await this.prisma.accountingEntry.aggregate({
      where: { type: 'INCOME' },
      _sum: { amount: true }
    });

    const expenseAggregate = await this.prisma.accountingEntry.aggregate({
      where: { type: 'EXPENSE' },
      _sum: { amount: true }
    });

    return {
      totalIncome: incomeAggregate._sum?.amount || 0,
      totalExpense: expenseAggregate._sum?.amount || 0,
      balance: (incomeAggregate._sum?.amount || 0) - (expenseAggregate._sum?.amount || 0)
    };
  }

  async getInvestmentBySupplier() {
    const entries = await this.prisma.accountingEntry.findMany({
      where: { category: 'COMPRA_INVENTARIO' }
    });

    const investment = entries.reduce((acc: any, entry: any) => {
      const supplierName = entry.description.split('(')[1]?.replace(')', '') || 'Otros';
      acc[supplierName] = (acc[supplierName] || 0) + entry.amount;
      return acc;
    }, {});

    return Object.entries(investment).map(([name, total]) => ({ name, total }));
  }
}
