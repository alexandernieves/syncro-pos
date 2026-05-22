import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsGateway } from './notifications.gateway';

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private gateway: NotificationsGateway,
  ) {}

  async create(data: {
    type: string;
    title: string;
    message: string;
    branchId?: string;
    userId?: string;
  }) {
    // 1. Persist in DB
    const notification = await this.prisma.notification.create({
      data: {
        type: data.type,
        title: data.title,
        message: data.message,
        branchId: data.branchId,
        userId: data.userId,
      },
    });

    // 2. Resolve businessId to emit via WebSocket only to this business's room
    let businessId: string | null = null;
    
    if (data.branchId) {
      const branch = await this.prisma.branch.findUnique({
        where: { id: data.branchId },
        select: { businessId: true }
      });
      businessId = branch?.businessId || null;
    } else if (data.userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: data.userId },
        select: { businessId: true }
      });
      businessId = user?.businessId || null;
    }

    if (businessId) {
      this.gateway.server.to(businessId).emit('notification', notification);
    } else {
      // Fallback
      this.gateway.server.emit('notification', notification);
    }

    return notification;
  }

  async findAll(businessId?: string, userId?: string) {
    if (!businessId && !userId) {
      return [];
    }

    return this.prisma.notification.findMany({
      where: {
        OR: [
          ...(businessId ? [{
            branch: {
              businessId: businessId,
            }
          }] : []),
          ...(userId ? [{
            userId: userId,
          }] : []),
          ...(businessId ? [{
            user: {
              businessId: businessId,
            }
          }] : [])
        ]
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  async markAsRead(id: string) {
    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  }

  async markAllAsRead(businessId?: string, userId?: string) {
    if (!businessId && !userId) {
      return { count: 0 };
    }

    const unreadNotifications = await this.prisma.notification.findMany({
      where: {
        isRead: false,
        OR: [
          ...(businessId ? [{
            branch: {
              businessId: businessId,
            }
          }] : []),
          ...(userId ? [{
            userId: userId,
          }] : []),
          ...(businessId ? [{
            user: {
              businessId: businessId,
            }
          }] : [])
        ]
      },
      select: { id: true },
    });

    const ids = unreadNotifications.map(n => n.id);
    if (ids.length === 0) return { count: 0 };

    return this.prisma.notification.updateMany({
      where: { id: { in: ids } },
      data: { isRead: true },
    });
  }
}
