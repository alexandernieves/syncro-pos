import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Request, UseGuards, BadRequestException } from '@nestjs/common';
import { WhatsAppService } from './whatsapp.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('whatsapp')
export class WhatsAppController {
  constructor(private readonly whatsappService: WhatsAppService) {}

  // ─────────────────────────────────────────────────────────────────────────
  // 1. Chat Webhook (Public) — customer messages for the Chat module
  // ─────────────────────────────────────────────────────────────────────────
  @Post('webhook')
  async receiveWebhook(@Body() body: any, @Query('businessId') businessId: string) {
    return this.whatsappService.handleWebhook(body, businessId);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 1b. Bot Webhook (Public) — AI bot messages, separate instance
  // ─────────────────────────────────────────────────────────────────────────
  @Post('bot-webhook')
  async receiveBotWebhook(@Body() body: any, @Query('businessId') businessId: string) {
    return this.whatsappService.handleBotWebhook(body, businessId);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // All endpoints below are protected by JWT. The businessId is extracted
  // from the token payload (req.user.businessId) so a user can ONLY ever
  // operate on their own business's WhatsApp instance and chats.
  // ─────────────────────────────────────────────────────────────────────────

  // 2. Get QR Code for pairing this business's WhatsApp number
  @UseGuards(JwtAuthGuard)
  @Get('qr')
  async getQr(@Request() req: any) {
    const businessId = req.user.businessId;
    return this.whatsappService.getQrCode(businessId);
  }

  // 3. Get connection status for this business's instance
  @UseGuards(JwtAuthGuard)
  @Get('status')
  async getStatus(@Request() req: any) {
    const businessId = req.user.businessId;
    return this.whatsappService.getStatus(businessId);
  }

  // 4. Get active chats — only chats belonging to this business
  @UseGuards(JwtAuthGuard)
  @Get('chats')
  async getChats(@Request() req: any) {
    const businessId = req.user.businessId;
    return this.whatsappService.getChats(businessId);
  }

  // 5. Get message history of a specific chat (validates ownership)
  @UseGuards(JwtAuthGuard)
  @Get('chats/:id/messages')
  async getMessages(@Param('id') chatId: string, @Request() req: any) {
    const businessId = req.user.businessId;
    return this.whatsappService.getMessages(chatId, businessId);
  }

  // 6. Send text message — scoped to this business's Evolution instance
  @UseGuards(JwtAuthGuard)
  @Post('chats/:id/send')
  async sendMessage(
    @Param('id') chatId: string,
    @Body('text') text: string,
    @Request() req: any,
  ) {
    const businessId = req.user.businessId;
    const agentId = req.user.sub;
    const chat = await this.whatsappService.findChatByIdOrPhone(chatId, businessId);
    return this.whatsappService.sendTextMessage(chat.phone, text, businessId, agentId);
  }

  // 7. Assign chat to an agent
  @UseGuards(JwtAuthGuard)
  @Post('chats/:id/assign')
  async assignChat(
    @Param('id') chatId: string,
    @Body('agentId') agentId: string,
    @Request() req: any,
  ) {
    const businessId = req.user.businessId;
    return this.whatsappService.assignChat(chatId, agentId, businessId);
  }

  // 8. Get contact profile picture (via this business's connected instance)
  @UseGuards(JwtAuthGuard)
  @Get('chats/:id/avatar')
  async getAvatar(@Param('id') chatId: string, @Request() req: any) {
    const businessId = req.user.businessId;
    const chat = await this.whatsappService.findChatByIdOrPhone(chatId, businessId);
    return this.whatsappService.getProfilePicture(chat.phone, businessId);
  }

  // 9. Get message media content on demand
  @UseGuards(JwtAuthGuard)
  @Get('messages/:id/media')
  async getMessageMedia(@Param('id') msgId: string, @Request() req: any) {
    const businessId = req.user.businessId;
    const msg = await this.whatsappService.getMessageById(msgId);
    if (!msg || !msg.whatsappMsgId) {
      return { base64: null };
    }
    return this.whatsappService.getMessageMedia(msg.whatsappMsgId, businessId);
  }

  // 10. Send media message
  @UseGuards(JwtAuthGuard)
  @Post('chats/:id/send-media')
  async sendMedia(
    @Param('id') chatId: string,
    @Body() body: { mediatype: string; media: string; fileName?: string; caption?: string },
    @Request() req: any,
  ) {
    const businessId = req.user.businessId;
    const agentId = req.user.sub;
    const chat = await this.whatsappService.findChatByIdOrPhone(chatId, businessId);
    return this.whatsappService.sendMediaMessage(
      chat.phone,
      body.mediatype,
      body.media,
      businessId,
      body.fileName,
      body.caption,
      agentId,
    );
  }

  // 11. Update chat properties (pin, archive, restrict, favorite, mute, unread, lists)
  @UseGuards(JwtAuthGuard)
  @Patch('chats/:id')
  async updateChat(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    const businessId = req.user.businessId;
    return this.whatsappService.updateChat(id, body, businessId);
  }

  // 12. Clear chat messages
  @UseGuards(JwtAuthGuard)
  @Post('chats/:id/clear')
  async clearChat(@Param('id') id: string, @Request() req: any) {
    const businessId = req.user.businessId;
    return this.whatsappService.clearChat(id, businessId);
  }

  // 13. Delete chat
  @UseGuards(JwtAuthGuard)
  @Delete('chats/:id')
  async deleteChat(@Param('id') id: string, @Request() req: any) {
    const businessId = req.user.businessId;
    return this.whatsappService.deleteChat(id, businessId);
  }

  // 14. Disconnect/Logout this business's WhatsApp instance
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logoutInstance(@Request() req: any) {
    const businessId = req.user.businessId;
    return this.whatsappService.logoutInstance(businessId);
  }

  // 15. Mark all chats as read — only for this business
  @UseGuards(JwtAuthGuard)
  @Post('chats/read-all')
  async readAllChats(@Request() req: any) {
    const businessId = req.user.businessId;
    return this.whatsappService.readAllChats(businessId);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Bot-specific endpoints (separate Evolution API instance)
  // ─────────────────────────────────────────────────────────────────────────

  // Get QR for the AI Bot instance
  @UseGuards(JwtAuthGuard)
  @Get('bot-qr')
  async getBotQr(@Request() req: any) {
    return this.whatsappService.getBotQrCode(req.user.businessId);
  }

  // Get connection status of AI Bot instance
  @UseGuards(JwtAuthGuard)
  @Get('bot-status')
  async getBotStatus(@Request() req: any) {
    return this.whatsappService.getBotStatus(req.user.businessId);
  }

  // Logout/disconnect the AI Bot instance
  @UseGuards(JwtAuthGuard)
  @Post('bot-logout')
  async logoutBotInstance(@Request() req: any) {
    return this.whatsappService.logoutBotInstance(req.user.businessId);
  }

  // 16. Create or find chat by phone number — scoped to this business
  @UseGuards(JwtAuthGuard)
  @Post('chats')
  async createChat(
    @Body('phone') phone: string,
    @Body('name') name: string,
    @Request() req: any,
  ) {
    if (!phone) throw new BadRequestException('El número de teléfono es obligatorio');
    const businessId = req.user.businessId;
    return this.whatsappService.findOrCreateChat(phone, businessId, name);
  }
}
