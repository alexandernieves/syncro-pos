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
import * as jwt from 'jsonwebtoken';
import { ChatService } from './chat.service';
import { PushService } from './push.service';
import { PrismaService } from '../prisma/prisma.service';

interface AuthedSocketData {
  userId: string;
  role: string;
  businessId?: string;
}

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

  /** Identity comes from the verified JWT only — never from client-supplied fields. */
  private authenticate(client: Socket): AuthedSocketData | null {
    let token = client.handshake.auth?.token as string | undefined;
    if (!token) return null;
    if (token.startsWith('Bearer ')) token = token.slice(7);
    try {
      const secret = process.env.JWT_SECRET || 'syncro-pos-secret-key-2025';
      const decoded = jwt.verify(token, secret) as any;
      return { userId: decoded.sub, role: decoded.role, businessId: decoded.businessId };
    } catch (err: any) {
      this.logger.warn(`Socket auth failed for ${client.id}: ${err.message}`);
      return null;
    }
  }

  async handleConnection(client: Socket) {
    const auth = this.authenticate(client);
    if (!auth) {
      client.disconnect(true);
      return;
    }
    client.data = auth;
    client.join(`user_${auth.userId}`);
    await this.prisma.user.update({
      where: { id: auth.userId },
      data: { lastSeen: new Date() }
    });
    this.logger.log(`User connected: ${auth.userId}`);
  }

  async handleDisconnect(client: Socket) {
    const auth = client.data as AuthedSocketData | undefined;
    if (auth?.userId) {
      client.leave(`user_${auth.userId}`);
      await this.prisma.user.update({
        where: { id: auth.userId },
        data: { lastSeen: new Date() }
      });

      this.server.emit('userPresence', {
        userId: auth.userId,
        status: 'offline',
        lastSeen: new Date()
      });

      this.logger.log(`User disconnected: ${auth.userId}`);
    }
  }

  @SubscribeMessage('joinConversation')
  async handleJoinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() conversationId: string,
  ) {
    const auth = client.data as AuthedSocketData | undefined;
    if (!auth) return { event: 'error', message: 'No autenticado' };

    // Support staff can join any conversation; a business user only their own.
    if (auth.role !== 'syncropos') {
      const conversation = await this.prisma.conversation.findUnique({ where: { id: conversationId } });
      if (!conversation || conversation.businessId !== auth.businessId) {
        return { event: 'error', message: 'No tienes acceso a esta conversación' };
      }
    }

    client.join(`conv_${conversationId}`);
    this.server.to(`conv_${conversationId}`).emit('userPresence', {
      userId: auth.userId,
      status: 'online'
    });

    return { event: 'joined', conversationId };
  }

  @SubscribeMessage('typing')
  handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string; isTyping: boolean },
  ) {
    const auth = client.data as AuthedSocketData | undefined;
    if (!auth) return;
    client.to(`conv_${data.conversationId}`).emit('userTyping', {
      userId: auth.userId,
      isTyping: data.isTyping
    });
  }

  @SubscribeMessage('sendMessage')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      conversationId: string;
      text?: string;
      type?: string;
      fileUrl?: string;
    },
  ) {
    const auth = client.data as AuthedSocketData | undefined;
    if (!auth) return { event: 'error', message: 'No autenticado' };

    if (auth.role !== 'syncropos') {
      const conversation = await this.prisma.conversation.findUnique({ where: { id: data.conversationId } });
      if (!conversation || conversation.businessId !== auth.businessId) {
        return { event: 'error', message: 'No tienes acceso a esta conversación' };
      }
    }

    const message = await this.chatService.saveMessage({ ...data, senderId: auth.userId });

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
      const isSupportSender = auth.role === 'syncropos';

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
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const auth = client.data as AuthedSocketData | undefined;
    if (!auth) return;
    try {
      await this.chatService.markAsRead(data.conversationId, auth.userId);
      // Emit to the conversation room so the sender sees the double check turn blue
      this.server.to(`conv_${data.conversationId}`).emit('messagesRead', {
        conversationId: data.conversationId,
        readBy: auth.userId
      });
      this.logger.log(`Messages marked as read in conv: ${data.conversationId} by ${auth.userId}`);
    } catch (e) {
      this.logger.error(`Error marking messages as read: ${e.message}`);
    }
  }

  /**
   * "Mike" live cursor — support staff only. Broadcasts a viewport-relative
   * position (0-100) to the business's conversation room so their dashboard
   * can render a ghost cursor. Purely presentational, no page/route data.
   */
  @SubscribeMessage('cursorMove')
  handleCursorMove(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string; x: number; y: number },
  ) {
    const auth = client.data as AuthedSocketData | undefined;
    if (!auth || auth.role !== 'syncropos') return;
    client.to(`conv_${data.conversationId}`).emit('mikeCursor', { x: data.x, y: data.y });
  }

  @SubscribeMessage('cursorLeave')
  handleCursorLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const auth = client.data as AuthedSocketData | undefined;
    if (!auth || auth.role !== 'syncropos') return;
    client.to(`conv_${data.conversationId}`).emit('mikeCursorLeave');
  }
}
