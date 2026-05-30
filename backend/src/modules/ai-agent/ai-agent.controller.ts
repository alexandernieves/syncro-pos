import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Req,
  Res,
  Query,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AiAgentService } from './ai-agent.service';

@Controller('ai-agent')
@UseGuards(JwtAuthGuard)
export class AiAgentController {
  constructor(private readonly aiAgentService: AiAgentService) {}

  /**
   * Get all AI chat sessions for this user
   */
  @Get('sessions')
  async getSessions(@Req() req: any) {
    const userId = req.user?.id || req.user?.sub;
    const businessId = req.user?.businessId;
    return this.aiAgentService.getSessions(businessId, userId);
  }

  /**
   * Create a new AI chat session
   */
  @Post('sessions')
  async createSession(@Req() req: any, @Body('title') title?: string) {
    const userId = req.user?.id || req.user?.sub;
    const businessId = req.user?.businessId;
    return this.aiAgentService.createSession(businessId, userId, title);
  }

  /**
   * Send a message to the AI agent and receive a response
   */
  @Post('chat')
  async chat(
    @Body('message') message: string,
    @Body('sessionId') sessionId: string,
    @Req() req: any,
  ): Promise<any> {
    const userId = req.user?.id || req.user?.sub;
    const businessId = req.user?.businessId;
    return this.aiAgentService.chat(userId, businessId, message, sessionId || 'default');
  }

  /**
   * Get the full AI conversation history for this user
   */
  @Get('history')
  async getHistory(@Req() req: any, @Query('sessionId') sessionId?: string) {
    const userId = req.user?.id || req.user?.sub;
    const businessId = req.user?.businessId;
    return this.aiAgentService.getHistoryWithMeta(businessId, userId, sessionId || 'default');
  }

  /**
   * Confirm and execute an AI-suggested action (e.g. register expense)
   */
  @Post('confirm-action')
  @HttpCode(200)
  async confirmAction(
    @Body('action') action: any,
    @Body('branchId') branchId: string,
    @Body('msgId') msgId: string,
    @Req() req: any,
  ) {
    const userId = req.user?.id || req.user?.sub;
    const businessId = req.user?.businessId;
    return this.aiAgentService.confirmAction(userId, businessId, branchId, action, msgId);
  }

  /**
   * Text-to-speech using ElevenLabs
   */
  @Post('tts')
  async textToSpeech(@Body('text') text: string, @Res() res: any) {
    try {
      const buffer = await this.aiAgentService.textToSpeech(text);
      res.setHeader('Content-Type', 'audio/mpeg');
      res.send(buffer);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  /**
   * Clear all AI conversation history for this user
   */
  @Delete('history')
  async clearHistory(@Req() req: any, @Query('sessionId') sessionId?: string) {
    const userId = req.user?.id || req.user?.sub;
    const businessId = req.user?.businessId;
    await this.aiAgentService.clearHistory(businessId, userId, sessionId || 'default');
    return { success: true };
  }
}
