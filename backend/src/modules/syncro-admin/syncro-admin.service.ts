import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SyncroAdminService {
  constructor(private prisma: PrismaService) {}

  async getGlobalStats() {
    const [businessCount, userCount, totalSales] = await Promise.all([
      this.prisma.business.count(),
      this.prisma.user.count(),
      this.prisma.sale.aggregate({
        _sum: {
          total: true
        }
      })
    ]);

    return {
      businessCount,
      userCount,
      totalSales: totalSales._sum.total || 0,
      activeSubscriptions: await this.prisma.business.count({ where: { status: 'ACTIVE' } })
    };
  }

  async getAllBusinesses() {
    return this.prisma.business.findMany({
      include: {
        _count: {
          select: {
            users: true,
            sales: true,
            branches: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async updateBusinessStatus(id: string, status: string) {
    return this.prisma.business.update({
      where: { id },
      data: { status }
    });
  }
}
