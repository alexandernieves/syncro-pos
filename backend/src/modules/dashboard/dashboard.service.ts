import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getStats(businessId: string, branchId?: string, userId?: string, dateParam?: string) {
    const whereClause: any = {};
    if (branchId) {
      whereClause.branchId = branchId;
    }
    if (businessId) {
      whereClause.branch = { businessId };
    }

    const [
      totalRevenue, 
      totalSales, 
      totalClients, 
      productsCount, 
      settings,
      expensesTotal,
      salesItemsTotal,
      totalNetRevenue
    ] = await Promise.all([
      this.prisma.sale.aggregate({
        where: whereClause,
        _sum: { total: true }
      }),
      this.prisma.sale.count({ where: whereClause }),
      this.prisma.client.count({ where: { businessId } }),
      this.prisma.product.count({
        where: {
          businessId,
          ...(branchId ? {
            variants: {
              some: {
                inventory: {
                  some: { branchId }
                }
              }
            }
          } : {})
        }
      }),
      this.prisma.setting.findFirst({ where: { businessId } }),
      this.prisma.accountingEntry.aggregate({
        where: {
          type: 'EXPENSE',
          branch: { businessId },
          ...(branchId ? { branchId } : {})
        },
        _sum: { amount: true }
      }),
      this.prisma.saleItem.findMany({
        where: {
          sale: whereClause
        },
        select: {
          quantity: true,
          cost: true
        }
      }),
      this.prisma.sale.aggregate({
        where: whereClause,
        _sum: { subtotal: true }
      })
    ]);

    const revenueValue = totalRevenue._sum.total || 0;
    const netRevenueValue = totalNetRevenue._sum.subtotal || 0;
    const totalExpenses = expensesTotal._sum.amount || 0;

    let totalProductCost = 0;
    salesItemsTotal.forEach(item => {
      totalProductCost += item.quantity * (item.cost || 0);
    });

    const grossMargin = netRevenueValue - totalProductCost;
    const netProfit = grossMargin - totalExpenses;
    const netMarginPercentage = revenueValue > 0 ? (netProfit / revenueValue) * 100 : 0;

    // Get real chart data (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const salesInPeriod = await this.prisma.sale.findMany({
      where: { 
        ...whereClause,
        createdAt: { gte: thirtyDaysAgo } 
      },
      select: { createdAt: true, total: true },
      orderBy: { createdAt: 'asc' }
    });

    // Group by day for the chart
    const dailyData: Record<string, { date: string, revenue: number, orders: number }> = {};
    
    // Initialize last 30 days with 0
    for(let i=0; i<30; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toISOString().split('T')[0];
        dailyData[key] = { date: key, revenue: 0, orders: 0 };
    }

    salesInPeriod.forEach(sale => {
      const key = sale.createdAt.toISOString().split('T')[0];
      if (dailyData[key]) {
        dailyData[key].revenue += sale.total;
        dailyData[key].orders += 1;
      }
    });

    const chartData = Object.values(dailyData).sort((a,b) => a.date.localeCompare(b.date));

    // Parse selected date or today
    const now = dateParam ? new Date(dateParam) : new Date();
    // VET (Venezuela Time) is GMT-4. Adjust start of day to GMT-4.
    const localTime = new Date(now.getTime() - 4 * 60 * 60 * 1000);
    const startOfDay = new Date(Date.UTC(
      localTime.getUTCFullYear(),
      localTime.getUTCMonth(),
      localTime.getUTCDate(),
      4, // 04:00:00 UTC = 00:00:00 VET (GMT-4)
      0,
      0,
      0
    ));
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    // Get all sales for the selected day in this business/branch
    const daySales = await this.prisma.sale.findMany({
      where: {
        ...whereClause,
        createdAt: {
          gte: startOfDay,
          lt: endOfDay
        }
      },
      orderBy: { createdAt: 'desc' },
      include: { client: true, user: true, branch: true }
    });

    // Check if there is an active shift for this user in this branch to light the live pulsing indicator
    let hasActiveShift = false;
    if (userId) {
      const activeShift = await this.prisma.shift.findFirst({
        where: {
          userId,
          status: 'OPEN',
          ...(branchId ? { branchId } : {})
        }
      });
      if (activeShift) {
        hasActiveShift = true;
      }
    }

    return {
      revenue: revenueValue,
      salesCount: totalSales,
      clientsCount: totalClients, 
      productsCount,
      settings: {
        ...settings,
        salesGoal: settings?.salesGoal ?? 10000,
        showSalesGoal: settings?.showSalesGoal ?? true,
        showNetMargin: settings?.showNetMargin ?? true
      },
      netProfit,
      netMarginPercentage,
      chartData,
      hasActiveShift,
      recentSales: daySales.map(s => ({
        id: s.id,
        client: s.client?.name || "Consumidor Final",
        total: s.total,
        status: s.status || "COMPLETED",
        branch: s.branch?.name || "N/A",
        date: s.createdAt
      }))
    };
  }

  async getSalesDates(businessId: string, branchId?: string) {
    const whereClause: any = {};
    if (branchId) {
      whereClause.branchId = branchId;
    }
    if (businessId) {
      whereClause.branch = { businessId };
    }

    const sales = await this.prisma.sale.findMany({
      where: whereClause,
      select: { createdAt: true }
    });

    const datesSet = new Set<string>();
    sales.forEach(sale => {
      const localTime = new Date(sale.createdAt.getTime() - 4 * 60 * 60 * 1000);
      const key = localTime.toISOString().split('T')[0];
      datesSet.add(key);
    });

    return Array.from(datesSet);
  }
}

