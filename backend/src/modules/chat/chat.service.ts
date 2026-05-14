import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ChatService {
  constructor(private prisma: PrismaService) {}

  async getConversationsForSupport() {
    return this.prisma.conversation.findMany({
      include: {
        business: true,
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      },
      orderBy: { updatedAt: 'desc' }
    });
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
          orderBy: { createdAt: 'asc' }
        },
        business: true
      }
    });

    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: { businessId },
        include: {
          messages: true,
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
