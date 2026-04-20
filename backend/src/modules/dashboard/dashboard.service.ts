import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getStats() {
    const [totalRevenue, totalSales, totalClients, totalProducts] = await Promise.all([
      this.prisma.sale.aggregate({
        _sum: { total: true }
      }),
      this.prisma.sale.count(),
      this.prisma.client.count(),
      this.prisma.product.count()
    ]);

    const revenueValue = totalRevenue._sum.total || 0;

    // Get real chart data (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const salesInPeriod = await this.prisma.sale.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
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

    // Get recent activity (last 10 sales)
    const recentSales = await this.prisma.sale.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: { client: true, user: true }
    });

    return {
      revenue: revenueValue,
      salesCount: totalSales,
      clientsCount: totalClients, 
      productsCount: totalProducts,
      chartData,
      recentSales: recentSales.map(s => ({
        id: s.id,
        client: s.client?.name || "Consumidor Final",
        total: s.total,
        status: "COMPLETED",
        branch: "Principal",
        date: s.createdAt
      }))
    };
  }
}
