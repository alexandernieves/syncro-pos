import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HistoryService {
  constructor(private prisma: PrismaService) {}

  async logAction(data: {
    userId: string;
    action: string;
    entity: string;
    entityId?: string;
    details?: any;
    ipAddress?: string;
  }) {
    try {
      return await this.prisma.auditLog.create({
        data: {
          userId: data.userId,
          action: data.action,
          entity: data.entity,
          entityId: data.entityId,
          details: data.details ? JSON.stringify(data.details) : null,
          ipAddress: data.ipAddress || '127.0.0.1',
        },
      });
    } catch (error) {
      console.error('[HistoryService] Error in logAction:', error);
      throw error;
    }
  }

  async findAll(query?: any) {
    const where: any = {};
    if (query?.userId) where.userId = query.userId;
    if (query?.action) where.action = query.action;
    if (query?.entity) where.entity = query.entity;

    if (query?.startDate || query?.endDate) {
      where.createdAt = {};
      if (query.startDate) where.createdAt.gte = new Date(query.startDate);
      if (query.endDate) where.createdAt.lte = new Date(query.endDate);
    }

    return this.prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: query?.limit ? parseInt(query.limit) : 50,
      skip: query?.offset ? parseInt(query.offset) : 0,
    });
  }

  async getStats() {
    const totalActions = await this.prisma.auditLog.count();
    const criticalAlerts = await this.prisma.auditLog.count({
      where: {
        action: { in: ['DELETE', 'SECURITY_BREACH', 'FAILED_LOGIN'] }
      }
    });

    return {
      totalActions,
      criticalAlerts,
      systemStability: 99.9, // Mock value
    };
  }

  async remove(id: string) {
    return this.prisma.auditLog.delete({
      where: { id }
    });
  }
}
