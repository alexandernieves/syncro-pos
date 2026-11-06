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
  }) {
    const message = await this.prisma.message.create({
      data: {
        conversationId: data.conversationId,
        senderId: data.senderId,
        text: data.text,
        type: data.type || 'TEXT',
        fileUrl: data.fileUrl
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

  async markAsRead(conversationId: string, userId: string) {
    return this.prisma.message.updateMany({
      where: {
        conversationId,
        senderId: { not: userId },
        isRead: false
      },
      data: { isRead: true }
    });
  }
}
