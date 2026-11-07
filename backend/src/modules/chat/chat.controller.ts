import { Controller, Get, Param, Post, Req, UseGuards, ForbiddenException } from '@nestjs/common';
import { createHmac } from 'crypto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ChatService } from './chat.service';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  private assertAdmin(req: any) {
    if (req.user?.role !== 'syncropos') {
      throw new ForbiddenException('Solo el equipo de soporte puede acceder a este recurso');
    }
  }

  @Get('support/conversations')
  async getConversations(@Req() req: any) {
    this.assertAdmin(req);
    return this.chatService.getConversationsForSupport();
  }

  @Get('support/sync')
  async syncConversations(@Req() req: any) {
    this.assertAdmin(req);
    return this.chatService.getAllBusinessesForSupport();
  }

  @Get('business/:businessId')
  async getConversation(@Param('businessId') businessId: string, @Req() req: any) {
    if (req.user?.role !== 'syncropos' && req.user?.businessId !== businessId) {
      throw new ForbiddenException('No tienes acceso a esta conversación');
    }
    return this.chatService.getConversationByBusiness(businessId);
  }

  /**
   * Connection servers for remote assistance. STUN finds a direct path; when the two networks
   * don't allow one (mobile data, strict routers), Syncro's TURN server relays the connection.
   * TURN credentials last a few hours and are signed with TURN_SECRET (coturn use-auth-secret),
   * so no fixed password lives in the app. The video stays encrypted end to end either way.
   */
  @Get('remote/ice')
  iceServers(@Req() req: any) {
    const servers: { urls: string | string[]; username?: string; credential?: string }[] = [
      { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
    ];
    const secret = process.env.TURN_SECRET;
    const host = process.env.TURN_HOST;
    if (secret && host) {
      const port = Number(process.env.TURN_PORT) || 3478;
      const ttl = 6 * 3600;
      const username = `${Math.floor(Date.now() / 1000) + ttl}:${req.user?.id ?? 'syncro'}`;
      const credential = createHmac('sha1', secret).update(username).digest('base64');
      servers.push({ urls: [`stun:${host}:${port}`] });
      servers.push({ urls: [`turn:${host}:${port}?transport=udp`, `turn:${host}:${port}?transport=tcp`], username, credential });
    }
    return { iceServers: servers, ttl: 6 * 3600, turn: !!(secret && host) };
  }

  @Get('unread')
  unread(@Req() req: any) {
    return this.chatService.unread(req.user);
  }

  @Post('read/:conversationId')
  async markAsRead(@Param('conversationId') conversationId: string, @Req() req: any) {
    const conv = await this.chatService.conversationBusiness(conversationId);
    if (req.user?.role !== 'syncropos' && conv !== req.user?.businessId) throw new ForbiddenException('No tienes acceso a esta conversación');
    return this.chatService.markAsRead(conversationId, req.user?.role === 'syncropos');
  }
}
