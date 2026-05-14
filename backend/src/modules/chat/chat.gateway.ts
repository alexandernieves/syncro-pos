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

  async handleConnection(client: Socket) {
    const userId = client.handshake.query.userId as string;
    if (userId) {
      client.join(`user_${userId}`);
      // Update last seen and broadcast online status
      await this.prisma.user.update({
        where: { id: userId },
        data: { lastSeen: new Date() }
      });
      this.logger.log(`User connected: ${userId}`);
    }
  }

  async handleDisconnect(client: Socket) {
    const userId = client.handshake.query.userId as string;
    if (userId) {
      client.leave(`user_${userId}`);
      // Final update of last seen
      await this.prisma.user.update({
        where: { id: userId },
        data: { lastSeen: new Date() }
      });
      
      // Notify all conversations this user was in
      // For simplicity, we can broadcast to all rooms the client was part of
      // or just a general presence update if needed.
      this.server.emit('userPresence', {
        userId,
        status: 'offline',
        lastSeen: new Date()
      });

      this.logger.log(`User disconnected: ${userId}`);
    }
  }

  @SubscribeMessage('joinConversation')
  async handleJoinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() conversationId: string,
  ) {
    client.join(`conv_${conversationId}`);
    
    // Notify others that this user is online in the conversation
    const userId = client.handshake.query.userId as string;
    this.server.to(`conv_${conversationId}`).emit('userPresence', {
      userId,
      status: 'online'
    });

    return { event: 'joined', conversationId };
  }

  @SubscribeMessage('typing')
  handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string; isTyping: boolean },
  ) {
    const userId = client.handshake.query.userId as string;
    // Broadcast "Escribiendo..." to everyone in the room EXCEPT the sender
    client.to(`conv_${data.conversationId}`).emit('userTyping', {
      userId,
      isTyping: data.isTyping
    });
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
    const message = await this.chatService.saveMessage(data);

    // Broadcast to the conversation room
    this.server.to(`conv_${data.conversationId}`).emit('newMessage', message);

    // Notify sidebar list
    this.server.emit('conversationUpdated', {
      conversationId: data.conversationId,
      lastMessage: data.text || `Envió un ${data.type}`,
      updatedAt: new Date()
    });

    // Send push notification to the participant
    try {
      const conv = await this.prisma.conversation.findUnique({
        where: { id: data.conversationId },
        include: { business: true },
      });
      const sender = await this.prisma.user.findUnique({ where: { id: data.senderId } });
      const isSupportSender = sender?.role === 'syncropos';

      if (isSupportSender && conv?.businessId) {
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
    } catch (e) {}

    return message;
  }

  @SubscribeMessage('markAsRead')
  async handleMarkRead(
    @MessageBody() data: { conversationId: string; userId: string },
  ) {
    try {
      await this.chatService.markAsRead(data.conversationId, data.userId);
      // Emit to the conversation room so the sender sees the double check turn blue
      this.server.to(`conv_${data.conversationId}`).emit('messagesRead', {
        conversationId: data.conversationId,
        readBy: data.userId
      });
      this.logger.log(`Messages marked as read in conv: ${data.conversationId} by ${data.userId}`);
    } catch (e) {
      this.logger.error(`Error marking messages as read: ${e.message}`);
    }
  }
}
