import { Controller, Get, Param, Query, Post, Body } from '@nestjs/common';
import { ChatService } from './chat.service';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('support/conversations')
  async getConversations() {
    return this.chatService.getConversationsForSupport();
  }

  @Get('support/sync')
  async syncConversations() {
    return this.chatService.getAllBusinessesForSupport();
  }

  @Get('business/:businessId')
  async getConversation(@Param('businessId') businessId: string) {
    return this.chatService.getConversationByBusiness(businessId);
  }

  @Post('read/:conversationId')
  async markAsRead(
    @Param('conversationId') conversationId: string,
    @Body('userId') userId: string
  ) {
    return this.chatService.markAsRead(conversationId, userId);
  }

}
