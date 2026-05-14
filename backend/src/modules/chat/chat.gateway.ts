import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { ChatService } from './chat.service';
import { PushService } from './push.service';
import { PrismaService } from '../prisma/prisma.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  }
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger('ChatGateway');

  constructor(
    private readonly chatService: ChatService,
    private readonly pushService: PushService,
    private readonly prisma: PrismaService,
  ) {
    this.logger.log('ChatGateway initialized');
  }

  handleConnection(client: Socket) {
    const userId = client.handshake.query.userId as string;
    this.logger.log(`[DEBUG] Client trying to connect: ${client.id}`);
    this.logger.log(`[DEBUG] Handshake query userId: ${userId}`);
    if (userId) {
      client.join(`user_${userId}`);
      this.logger.log(`[DEBUG] User ${userId} joined room: user_${userId}`);
    } else {
      this.logger.warn(`[DEBUG] Connection attempt without userId`);
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.handshake.query.userId as string;
    if (userId) {
      client.leave(`user_${userId}`);
      console.log(`User disconnected: ${userId}`);
    }
  }

  @SubscribeMessage('joinConversation')
  handleJoinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() conversationId: string,
  ) {
    console.log(`[DEBUG] Received joinConversation for: ${conversationId} from client ${client.id}`);
    client.join(`conv_${conversationId}`);
    return { event: 'joined', conversationId };
  }

  @SubscribeMessage('sendMessage')
  async handleMessage(
    @MessageBody() data: {
      conversationId: string;
      senderId: string;
      text?: string;
      type?: string;
      fileUrl?: string;
    },
  ) {
    console.log(`[DEBUG] Handling sendMessage:`, data);
    const message = await this.chatService.saveMessage(data);

    // Broadcast to the conversation room
    this.server.to(`conv_${data.conversationId}`).emit('newMessage', message);

    // Notify sidebar list
    this.server.emit('conversationUpdated', {
      conversationId: data.conversationId,
      lastMessage: data.text || `Envió un ${data.type}`,
      updatedAt: new Date()
    });

    // Send push notification to the OTHER participant
    try {
      const conv = await this.prisma.conversation.findUnique({
        where: { id: data.conversationId },
        include: { business: true },
      });
      const sender = await this.prisma.user.findUnique({ where: { id: data.senderId } });
      const isSupportSender = sender?.role === 'syncropos';

      if (isSupportSender && conv?.businessId) {
        // Notify all users belonging to that business
        const businessUsers = await this.prisma.user.findMany({
          where: { businessId: conv.businessId, role: { not: 'syncropos' } },
        });
        for (const u of businessUsers) {
          await this.pushService.sendToUser(u.id, {
            title: '💬 Soporte Syncro POS',
            body: data.text || 'Te envió un archivo',
            url: '/dashboard/soporte',
          });
        }
      } else {
        // Notify support team
        const supportUsers = await this.prisma.user.findMany({
          where: { role: 'syncropos' },
        });
        for (const u of supportUsers) {
          await this.pushService.sendToUser(u.id, {
            title: `💬 ${conv?.business?.name || 'Cliente'}`,
            body: data.text || 'Te envió un archivo',
            url: '/dashboard/syncro/chat',
          });
        }
      }
    } catch (e) {
      // Non-critical: don't break message flow
    }

    return message;
  }

  @SubscribeMessage('markRead')
  async handleMarkRead(
    @MessageBody() data: { conversationId: string; userId: string },
  ) {
    await this.chatService.markAsRead(data.conversationId, data.userId);
    this.server.to(`conv_${data.conversationId}`).emit('messagesRead', {
      conversationId: data.conversationId,
      readBy: data.userId
    });
  }
}
