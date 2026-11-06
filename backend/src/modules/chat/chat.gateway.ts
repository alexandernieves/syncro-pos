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

/** Card messages (module offers, request updates) carry this alongside the plain text. */
export type ChatExtra = { meta?: Record<string, unknown>; requestId?: string | null; type?: string };

@WebSocketGateway({
  cors: {
    origin: '*',
  }
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger('ChatGateway');
  /** Open sockets of the Syncro team, to tell businesses whether someone is there */
  private supportSockets = 0;

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
    if (auth.role === 'syncropos') {
      // The Syncro team gets every conversation's updates for its inbox
      client.join('support');
      if (++this.supportSockets === 1) this.server.emit('supportPresence', { online: true });
    } else if (auth.businessId) {
      // Every screen of the business hears about new support messages
      client.join(`business_${auth.businessId}`);
    }
    await this.prisma.user.update({ where: { id: auth.userId }, data: { lastSeen: new Date() } }).catch(() => undefined);
  }

  async handleDisconnect(client: Socket) {
    const auth = client.data as AuthedSocketData | undefined;
    if (!auth?.userId) return;
    if (auth.role === 'syncropos') {
      this.supportSockets = Math.max(0, this.supportSockets - 1);
      if (this.supportSockets === 0) this.server.emit('supportPresence', { online: false });
    }
    await this.prisma.user.update({ where: { id: auth.userId }, data: { lastSeen: new Date() } }).catch(() => undefined);
    this.server.emit('userPresence', { userId: auth.userId, status: 'offline', lastSeen: new Date() });
  }

  /** Is anyone from Syncro connected right now? */
  @SubscribeMessage('supportPresence')
  handleSupportPresence() {
    return { online: this.supportSockets > 0 };
  }

  @SubscribeMessage('joinConversation')
  async handleJoinConversation(@ConnectedSocket() client: Socket, @MessageBody() conversationId: string) {
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
    this.server.to(`conv_${conversationId}`).emit('userPresence', { userId: auth.userId, status: 'online' });
    return { event: 'joined', conversationId };
  }

  @SubscribeMessage('typing')
  handleTyping(@ConnectedSocket() client: Socket, @MessageBody() data: { conversationId: string; isTyping: boolean }) {
    const auth = client.data as AuthedSocketData | undefined;
    if (!auth) return;
    client.to(`conv_${data.conversationId}`).emit('userTyping', { userId: auth.userId, isTyping: data.isTyping });
  }

  /**
   * Saves a message and tells everyone who should know: the open conversation, the support inbox,
   * every screen of the business (for the unread badge and the pop-up notice) and push.
   */
  private async deliver(conversationId: string, businessId: string | null, senderId: string, fromSupport: boolean, text: string | undefined, extra: ChatExtra & { fileUrl?: string } = {}) {
    const message = await this.chatService.saveMessage({ conversationId, senderId, text, type: extra.type || 'TEXT', fileUrl: extra.fileUrl, meta: extra.meta, requestId: extra.requestId ?? null });
    const preview = text || (extra.type === 'AUDIO' ? 'Nota de voz' : extra.type === 'IMAGE' ? 'Imagen' : extra.type === 'VIDEO' ? 'Video' : 'Archivo');

    this.server.to(`conv_${conversationId}`).emit('newMessage', message);
    this.server.to('support').to(`conv_${conversationId}`).emit('conversationUpdated', { conversationId, lastMessage: preview, updatedAt: new Date() });

    const business = businessId ? await this.prisma.business.findUnique({ where: { id: businessId }, select: { name: true } }) : null;
    const notice = { conversationId, businessId, businessName: business?.name ?? null, text: preview, messageId: message.id, requestId: extra.requestId ?? null, fromSupport };
    if (fromSupport) {
      if (businessId) this.server.to(`business_${businessId}`).emit('supportMessage', notice);
    } else {
      this.server.to('support').emit('supportMessage', notice);
    }
    this.emitUnread(businessId);

    try {
      const to = fromSupport
        ? businessId ? await this.prisma.user.findMany({ where: { businessId, role: { not: 'syncropos' } }, select: { id: true } }) : []
        : await this.prisma.user.findMany({ where: { role: 'syncropos' }, select: { id: true } });
      for (const u of to) {
        await this.pushService.sendToUser(u.id, fromSupport
          ? { title: '💬 Equipo Syncro', body: preview.slice(0, 140), url: '/dashboard/soporte' }
          : { title: `💬 ${business?.name ?? 'Cliente'}`, body: preview.slice(0, 140), url: '/dashboard/syncro/chat' });
      }
    } catch {
      // push is best-effort
    }
    return message;
  }

  /** Unread counts changed: both sides refresh their badge. */
  private emitUnread(businessId: string | null) {
    this.server.to('support').emit('unreadChanged');
    if (businessId) this.server.to(`business_${businessId}`).emit('unreadChanged');
  }

  @SubscribeMessage('sendMessage')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string; text?: string; type?: string; fileUrl?: string; requestId?: string },
  ) {
    const auth = client.data as AuthedSocketData | undefined;
    if (!auth) return { event: 'error', message: 'No autenticado' };
    const conversation = await this.prisma.conversation.findUnique({ where: { id: data.conversationId } });
    if (!conversation) return { event: 'error', message: 'Conversación no encontrada' };
    if (auth.role !== 'syncropos' && conversation.businessId !== auth.businessId) {
      return { event: 'error', message: 'No tienes acceso a esta conversación' };
    }
    // A message about a request must belong to the same business
    let requestId: string | null = null;
    if (data.requestId) {
      const r = await this.prisma.moduleRequest.findUnique({ where: { id: data.requestId }, select: { businessId: true } });
      if (r && r.businessId === conversation.businessId) requestId = data.requestId;
    }
    const type = ['TEXT', 'IMAGE', 'VIDEO', 'AUDIO'].includes(String(data.type)) ? String(data.type) : 'TEXT';
    return this.deliver(conversation.id, conversation.businessId, auth.userId, auth.role === 'syncropos', data.text?.slice(0, 4000), { type, fileUrl: data.fileUrl, requestId });
  }

  private async conversationOf(businessId: string) {
    const conv = await this.prisma.conversation.findFirst({ where: { businessId }, select: { id: true } });
    return conv ?? this.prisma.conversation.create({ data: { businessId }, select: { id: true } });
  }

  /** A message from the Syncro team to a business, sent by the server (module offered, request updated…). */
  async notifyBusiness(businessId: string, senderId: string, text: string, extra: ChatExtra = {}) {
    const conv = await this.conversationOf(businessId);
    return this.deliver(conv.id, businessId, senderId, true, text, extra);
  }

  /** A message from a business to Syncro, sent by the server (a module request…). */
  async notifySupport(businessId: string, senderId: string, text: string, extra: ChatExtra = {}) {
    const conv = await this.conversationOf(businessId);
    return this.deliver(conv.id, businessId, senderId, false, text, extra);
  }

  @SubscribeMessage('markAsRead')
  async handleMarkRead(@ConnectedSocket() client: Socket, @MessageBody() data: { conversationId: string }) {
    const auth = client.data as AuthedSocketData | undefined;
    if (!auth || !data?.conversationId) return;
    const conversation = await this.prisma.conversation.findUnique({ where: { id: data.conversationId }, select: { businessId: true } });
    if (!conversation || (auth.role !== 'syncropos' && conversation.businessId !== auth.businessId)) return;
    try {
      // Each side reads what the other side wrote
      await this.chatService.markAsRead(data.conversationId, auth.role === 'syncropos');
      this.server.to(`conv_${data.conversationId}`).emit('messagesRead', { conversationId: data.conversationId, readBy: auth.userId, bySupport: auth.role === 'syncropos' });
      this.emitUnread(conversation.businessId);
    } catch (e: any) {
      this.logger.error(`Error marking messages as read: ${e.message}`);
    }
  }

  @SubscribeMessage('cursorMove')
  handleCursorMove(@ConnectedSocket() client: Socket, @MessageBody() data: { conversationId: string; x: number; y: number }) {
    const auth = client.data as AuthedSocketData | undefined;
    if (!auth || auth.role !== 'syncropos') return;
    client.to(`conv_${data.conversationId}`).emit('mikeCursor', { x: data.x, y: data.y });
  }

  @SubscribeMessage('cursorLeave')
  handleCursorLeave(@ConnectedSocket() client: Socket, @MessageBody() data: { conversationId: string }) {
    const auth = client.data as AuthedSocketData | undefined;
    if (!auth || auth.role !== 'syncropos') return;
    client.to(`conv_${data.conversationId}`).emit('mikeCursorLeave');
  }
}
