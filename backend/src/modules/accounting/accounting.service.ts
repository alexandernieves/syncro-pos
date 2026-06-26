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

  async findAll(businessId: string) {
    return (this.prisma.accountingEntry as any).findMany({
      where: {
        branch: { businessId }
      },
      include: { user: true, sale: true, branch: true },
      orderBy: { createdAt: 'desc' }
    });
  }

  async getAdvancedStats(businessId: string, branchId?: string, startDate?: string, endDate?: string) {
    // Build where clause scoped strictly to this business
    const queryWhere: any = {
      branch: { businessId }
    };
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

    // 5. Operating Expenses — scoped to this business
    const expenseEntries = await this.prisma.accountingEntry.findMany({
      where: {
        branch: { businessId },
        ...(branchId ? { branchId } : {}),
        ...(queryWhere.createdAt ? { createdAt: queryWhere.createdAt } : {}),
        type: 'EXPENSE'
      }
    });
    const operatingExpenses = expenseEntries.reduce((acc, e) => acc + e.amount, 0);
    
    // 6. Net Profit
    const netProfit = grossMargin - operatingExpenses;

    // 7. Inventory Value (Snapshot) — scoped to this business via branchId
    const inventoryFilter: any = {
      branch: { businessId }
    };
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
          const name = item.variant?.name || 'Desconocido';
          const profit = (item.price - (item.cost || 0)) * item.quantity;
          if (!acc[name]) acc[name] = { name, profit: 0, quantity: 0 };
          acc[name].profit += profit;
          acc[name].quantity += item.quantity;
          return acc;
        }, {})
      ).map(([_, val]) => val).sort((a: any, b: any) => b.profit - a.profit).slice(0, 5)
    };
  }

  async getStats(businessId: string) {
    const incomeAggregate = await this.prisma.accountingEntry.aggregate({
      where: { 
        branch: { businessId },
        type: 'INCOME' 
      },
      _sum: { amount: true }
    });

    const expenseAggregate = await this.prisma.accountingEntry.aggregate({
      where: { 
        branch: { businessId },
        type: 'EXPENSE' 
      },
      _sum: { amount: true }
    });

    return {
      totalIncome: incomeAggregate._sum?.amount || 0,
      totalExpense: expenseAggregate._sum?.amount || 0,
      balance: (incomeAggregate._sum?.amount || 0) - (expenseAggregate._sum?.amount || 0)
    };
  }

  async getInvestmentBySupplier(businessId: string) {
    const entries = await this.prisma.accountingEntry.findMany({
      where: { 
        branch: { businessId },
        category: 'COMPRA_INVENTARIO' 
      }
    });

    const investment = entries.reduce((acc: any, entry: any) => {
      const supplierName = entry.description.split('(')[1]?.replace(')', '') || 'Otros';
      acc[supplierName] = (acc[supplierName] || 0) + entry.amount;
      return acc;
    }, {});

    return Object.entries(investment).map(([name, total]) => ({ name, total }));
  }

  async getFinancialStatements(
    businessId: string,
    branchId?: string,
    startDate?: string,
    endDate?: string,
  ) {
    // ─── Date range ───────────────────────────────────────────────────────────
    const now = new Date();
    const from = startDate
      ? new Date(startDate)
      : new Date(now.getFullYear(), now.getMonth(), 1); // Default: start of current month
    const to = endDate ? new Date(endDate) : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const dateFilter = { gte: from, lte: to };

    // ─── Shared filters ────────────────────────────────────────────────────────
    const saleWhere: any = {
      branch: { businessId },
      createdAt: dateFilter,
      status: { not: 'CANCELLED' },
    };
    if (branchId) saleWhere.branchId = branchId;

    const expenseWhere: any = {
      branch: { businessId },
      createdAt: dateFilter,
      type: 'EXPENSE',
    };
    if (branchId) expenseWhere.branchId = branchId;

    const invWhere: any = { branch: { businessId } };
    if (branchId) invWhere.branchId = branchId;

    // ─── 1. SALES DATA ────────────────────────────────────────────────────────
    const sales = await this.prisma.sale.findMany({
      where: saleWhere,
      include: {
        items: { include: { variant: true } },
        payments: true,
      },
    });

    const grossRevenue   = sales.reduce((s, r) => s + r.total, 0);
    const salesTax       = sales.reduce((s, r) => s + (r.taxAmount || 0) + (r.igtfAmount || 0), 0);
    const netRevenue     = sales.reduce((s, r) => s + r.subtotal, 0);

    let cogs = 0;
    let totalUnits = 0;
    sales.forEach(sale => {
      sale.items.forEach((item: any) => {
        cogs += (item.cost || 0) * item.quantity;
        totalUnits += item.quantity;
      });
    });

    const grossProfit       = netRevenue - cogs;
    const grossMarginPct    = netRevenue > 0 ? (grossProfit / netRevenue) * 100 : 0;

    // ─── 2. OPERATING EXPENSES (from AccountingEntry) ─────────────────────────
    const expenseEntries = await this.prisma.accountingEntry.findMany({
      where: expenseWhere,
    });

    const byCategory: Record<string, number> = {};
    expenseEntries.forEach(e => {
      byCategory[e.category || 'OTROS'] = (byCategory[e.category || 'OTROS'] || 0) + e.amount;
    });

    const totalOpex = expenseEntries.reduce((s, e) => s + e.amount, 0);

    // Also include Expense model records (branch-level expenses)
    const branchExpenseWhere: any = {
      branch: { businessId },
      createdAt: dateFilter,
    };
    if (branchId) branchExpenseWhere.branchId = branchId;

    const branchExpenses = await this.prisma.expense.findMany({ where: branchExpenseWhere });
    branchExpenses.forEach(e => {
      byCategory[e.category || 'OTROS'] = (byCategory[e.category || 'OTROS'] || 0) + e.amount;
    });
    const totalBranchExpenses = branchExpenses.reduce((s, e) => s + e.amount, 0);

    const totalOperatingExpenses = totalOpex + totalBranchExpenses;

    // ─── 3. NET PROFIT ─────────────────────────────────────────────────────────
    const operatingProfit = grossProfit - totalOperatingExpenses;
    const netProfit       = operatingProfit; // No taxes modeled separately yet
    const netMarginPct    = grossRevenue > 0 ? (netProfit / grossRevenue) * 100 : 0;

    // ─── 4. BALANCE SHEET — ASSETS ────────────────────────────────────────────

    // Cash: sum of CASH payments within period
    const cashPayments = sales.flatMap(s => s.payments).filter(p => p.method === 'CASH');
    const cash = cashPayments.reduce((s, p) => s + p.amount, 0);

    // Accounts receivable: active client credit balances for this business
    const clientsWithDebt = await this.prisma.client.findMany({
      where: { businessId, currentDebt: { gt: 0 } },
      select: { currentDebt: true },
    });
    const accountsReceivable = clientsWithDebt.reduce((s, c) => s + c.currentDebt, 0);

    // Loans receivable
    const activeLoans = await this.prisma.loan.findMany({
      where: {
        client: { businessId },
        status: { in: ['PENDING', 'OVERDUE', 'APPROVED_PENDING_DISBURSEMENT'] },
        remainingBalance: { gt: 0 },
      },
      select: { remainingBalance: true },
    });
    const loansReceivable = activeLoans.reduce((s, l) => s + l.remainingBalance, 0);

    // Inventory at cost (current snapshot)
    const inventory = await this.prisma.inventory.findMany({
      where: invWhere,
      include: { variant: true },
    });
    const inventoryValue = inventory.reduce((s, i) => s + (i.variant.cost || 0) * i.quantity, 0);

    const totalCurrentAssets   = cash + accountsReceivable + loansReceivable + inventoryValue;
    const totalNonCurrentAssets = 0; // Extensible: property, equipment, etc.
    const totalAssets           = totalCurrentAssets + totalNonCurrentAssets;

    // ─── 5. BALANCE SHEET — LIABILITIES ───────────────────────────────────────

    // Accounts payable: pending/partial supplier invoices for this business
    const pendingInvoices = await this.prisma.supplierInvoice.findMany({
      where: {
        supplier: { businessId },
        status: { in: ['PENDING', 'PARTIAL'] },
      },
      select: { balance: true },
    });
    const accountsPayable = pendingInvoices.reduce((s, i) => s + i.balance, 0);

    const totalCurrentLiabilities = accountsPayable;
    const totalLiabilities        = totalCurrentLiabilities;

    // ─── 6. EQUITY ────────────────────────────────────────────────────────────
    // Equity = Assets − Liabilities (basic accounting equation)
    const retainedEarnings = totalAssets - totalLiabilities;
    const totalEquity      = retainedEarnings;

    const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;
    const isBalanced = Math.abs(totalAssets - totalLiabilitiesAndEquity) < 0.01;

    // ─── 7. Branch name ───────────────────────────────────────────────────────
    let branchName: string | null = null;
    if (branchId) {
      const branch = await this.prisma.branch.findUnique({ where: { id: branchId }, select: { name: true } });
      branchName = branch?.name || null;
    }

    return {
      incomeStatement: {
        grossRevenue,
        salesTax,
        netRevenue,
        cogs,
        grossProfit,
        grossMarginPct,
        operatingExpenses: {
          total: totalOperatingExpenses,
          byCategory: Object.entries(byCategory)
            .map(([category, amount]) => ({ category, amount }))
            .sort((a, b) => b.amount - a.amount),
        },
        operatingProfit,
        netProfit,
        netMarginPct,
        totalTickets: sales.length,
        totalUnits,
      },
      balanceSheet: {
        assets: {
          current: {
            cash,
            accountsReceivable,
            loansReceivable,
            inventory: inventoryValue,
            totalCurrent: totalCurrentAssets,
          },
          nonCurrent: { totalNonCurrent: totalNonCurrentAssets },
          totalAssets,
        },
        liabilities: {
          current: {
            accountsPayable,
            totalCurrent: totalCurrentLiabilities,
          },
          totalLiabilities,
        },
        equity: {
          retainedEarnings,
          totalEquity,
        },
        totalLiabilitiesAndEquity,
        isBalanced,
      },
      period: {
        from: from.toISOString().split('T')[0],
        to: to.toISOString().split('T')[0],
      },
      branchName,
      branchId: branchId || null,
    };
  }
}

