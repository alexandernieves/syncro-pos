import { Controller, Get, Param, Post, Req, UseGuards, ForbiddenException } from '@nestjs/common';
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

  @Post('read/:conversationId')
  async markAsRead(@Param('conversationId') conversationId: string, @Req() req: any) {
    return this.chatService.markAsRead(conversationId, req.user.id);
  }
}
