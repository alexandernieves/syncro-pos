import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ChatService {
  constructor(private prisma: PrismaService) {}

  async getConversationsForSupport() {
    const [conversations, unread] = await Promise.all([
      this.prisma.conversation.findMany({
        include: {
          business: { select: { id: true, name: true, email: true, phone: true, status: true } },
          messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true, senderId: true, type: true } },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      // Messages from the business that nobody in Syncro has read yet
      this.prisma.message.groupBy({
        by: ['conversationId'],
        where: { isRead: false, sender: { role: { not: 'syncropos' } } },
        _count: true,
      }),
    ]);
    const unreadBy = new Map(unread.map((u) => [u.conversationId, u._count]));
    return conversations.map((c) => ({ ...c, unread: unreadBy.get(c.id) ?? 0, lastMessageAt: c.messages[0]?.createdAt ?? null }));
  }

  async getAllBusinessesForSupport() {
    const businesses = await this.prisma.business.findMany({
      include: {
        conversations: { take: 1 }
      }
    });

    for (const b of businesses) {
      if (b.conversations.length === 0) {
        await this.prisma.conversation.create({
          data: { businessId: b.id }
        });
      }
    }

    return this.getConversationsForSupport();
  }

  async getConversationByBusiness(businessId: string) {
    let conversation = await this.prisma.conversation.findFirst({
      where: { businessId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          include: { sender: { select: { id: true, name: true, avatar: true, role: true } } },
        },
        business: true
      }
    });

    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: { businessId },
        include: {
          messages: { include: { sender: { select: { id: true, name: true, avatar: true, role: true } } } },
          business: true
        }
      });
    }

    return conversation;
  }

  async saveMessage(data: {
    conversationId: string;
    senderId: string;
    text?: string;
    type?: string;
    fileUrl?: string;
    meta?: Record<string, unknown>;
    requestId?: string | null;
  }) {
    const message = await this.prisma.message.create({
      data: {
        conversationId: data.conversationId,
        senderId: data.senderId,
        text: data.text,
        type: data.type || 'TEXT',
        fileUrl: data.fileUrl,
        meta: (data.meta as any) ?? undefined,
        requestId: data.requestId ?? null,
      },
      include: {
        sender: {
          select: { id: true, name: true, avatar: true, role: true }
        }
      }
    });

    // Update conversation last message and timestamp
    await this.prisma.conversation.update({
      where: { id: data.conversationId },
      data: { 
        lastMessage: data.text || `Envió un ${data.type}`,
        updatedAt: new Date()
      }
    });

    return message;
  }

  async conversationBusiness(conversationId: string) {
    const c = await this.prisma.conversation.findUnique({ where: { id: conversationId }, select: { businessId: true } });
    return c?.businessId ?? null;
  }

  /** Marks as read what the other side wrote: the business reads Syncro's messages and vice versa. */
  async markAsRead(conversationId: string, bySupport: boolean) {
    return this.prisma.message.updateMany({
      where: { conversationId, isRead: false, sender: bySupport ? { role: { not: 'syncropos' } } : { role: 'syncropos' } },
      data: { isRead: true },
    });
  }

  /** Unread messages for the badge: Syncro's for a business, every business's for the Syncro team. */
  async unread(user: { role?: string; businessId?: string }) {
    if (user?.role === 'syncropos') {
      const count = await this.prisma.message.count({ where: { isRead: false, sender: { role: { not: 'syncropos' } } } });
      return { count };
    }
    if (!user?.businessId) return { count: 0 };
    const count = await this.prisma.message.count({ where: { isRead: false, sender: { role: 'syncropos' }, conversation: { businessId: user.businessId } } });
    return { count };
  }
}
