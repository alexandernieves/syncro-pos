import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async getDashboardStats(branchId?: string, startDate?: string, endDate?: string) {
    const queryWhere: any = {};
    if (branchId) queryWhere.branchId = branchId;
    if (startDate || endDate) {
      queryWhere.createdAt = {};
      if (startDate) queryWhere.createdAt.gte = new Date(startDate);
      if (endDate) queryWhere.createdAt.lte = new Date(endDate);
    }

    // 1. Fetch Sales with essential relations
    const sales = await this.prisma.sale.findMany({
      where: queryWhere,
      include: { 
        items: { 
          include: { 
            variant: { 
              include: { 
                product: { 
                  include: { category: true } 
                } 
              } 
            } 
          } 
        } 
      }
    });

    // 2. Fetch Customer acquisition count
    const customerWhere: any = {};
    if (startDate) {
      customerWhere.createdAt = { gte: new Date(startDate) };
    }
    const newCustomers = await this.prisma.client.count({ where: customerWhere });

    // 3. Basic Metrics
    const totalRevenue = sales.reduce((acc, s) => acc + s.total, 0);
    const totalOrders = sales.length;
    const avgTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // 4. Top Selling Products (by Volume)
    const productMap: Record<string, number> = {};
    sales.flatMap(s => s.items).forEach(item => {
      if (!item.variant) return;
      const name = item.variant.product.name;
      productMap[name] = (productMap[name] || 0) + item.quantity;
    });
    const topProducts = Object.entries(productMap)
      .map(([name, value]) => ({ name, value: Number(value) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    // 5. Sales by Category (by Revenue)
    const categoryMap: Record<string, number> = {};
    sales.flatMap(s => s.items).forEach(item => {
      if (!item.variant) return;
      const cat = item.variant.product.category?.name || 'Otros';
      const itemRevenue = item.price * item.quantity;
      categoryMap[cat] = (categoryMap[cat] || 0) + itemRevenue;
    });
    const categoriesCharts = Object.entries(categoryMap).map(([name, value]) => ({ name, value }));

    // 6. Trend Data (Last 15 days for better detail)
    const trend: any[] = [];
    const trendDays = 15;
    for (let i = trendDays - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dayStr = d.toISOString().split('T')[0];
        
        const daySales = sales.filter(s => s.createdAt.toISOString().split('T')[0] === dayStr);
        trend.push({
            date: dayStr,
            revenue: daySales.reduce((acc, s) => acc + s.total, 0),
            orders: daySales.length
        });
    }

    // 7. Sales by Branch (if global)
    let branchStats: any[] = [];
    if (!branchId) {
        const branchMap: Record<string, number> = {};
        const branches = await this.prisma.branch.findMany();
        branches.forEach(b => {
            const bSales = sales.filter(s => s.branchId === b.id);
            branchMap[b.name] = bSales.reduce((acc, s) => acc + s.total, 0);
        });
        branchStats = Object.entries(branchMap).map(([name, value]) => ({ name, value }));
    }

    return {
      metrics: {
        totalRevenue,
        totalOrders,
        avgTicket,
        newCustomers
      },
      topProducts,
      categories: categoriesCharts,
      trend,
      branches: branchStats
    };
  }
}
