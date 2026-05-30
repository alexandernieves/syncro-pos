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
  ForbiddenException,
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
   * Send a message to the AI agent and receive a streamed response (SSE)
   */
  @Post('chat-stream')
  async chatStream(
    @Body('message') message: string,
    @Body('sessionId') sessionId: string,
    @Req() req: any,
    @Res() res: any,
  ) {
    const userId = req.user?.id || req.user?.sub;
    const businessId = req.user?.businessId;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    await this.aiAgentService.chatStream(
      userId,
      businessId,
      message,
      sessionId || 'default',
      (chunk) => {
        res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
      },
      (result) => {
        res.write(`data: ${JSON.stringify({
          done: true,
          id: result.id,
          message: result.message,
          action: result.action
        })}\n\n`);
        res.end();
      }
    );
  }

  /**
   * Run a proactive business audit check for active business anomalies
   */
  @Post('proactive-check')
  @HttpCode(200)
  async proactiveCheck(@Req() req: any) {
    const businessId = req.user?.businessId;
    if (!businessId) return { success: false, alertsFound: 0 };
    return this.aiAgentService.runProactiveAudit(businessId);
  }

  /**
   * Get predictive purchase orders suggestions based on historical sales speed and inventory metrics
   */
  @Get('predictive-purchases')
  async getPredictivePurchases(@Req() req: any, @Query('branchId') branchId?: string) {
    const businessId = req.user?.businessId;
    if (!businessId) return [];
    return this.aiAgentService.getPredictivePurchases(businessId, branchId);
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
   * Revert/Undo an AI-suggested action (e.g. income/expense)
   */
  @Post('undo-action')
  @HttpCode(200)
  async undoAction(
    @Body('msgId') msgId: string,
    @Req() req: any,
  ) {
    const userId = req.user?.id || req.user?.sub;
    const businessId = req.user?.businessId;
    return this.aiAgentService.undoAction(userId, businessId, msgId);
  }

  /**
   * Dismiss/Cancel an AI-suggested action card
   */
  @Post('dismiss-action')
  @HttpCode(200)
  async dismissAction(
    @Body('msgId') msgId: string,
    @Req() req: any,
  ) {
    return this.aiAgentService.dismissAction(msgId);
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

  /**
   * Submit feedback for an AI assistant response
   */
  @Post('feedback')
  async submitFeedback(
    @Req() req: any,
    @Body() body: { messageId?: string; prompt: string; response: string; rating: string; comment?: string }
  ) {
    const businessId = req.user?.businessId;
    return this.aiAgentService.submitFeedback(businessId, body);
  }

  /**
   * Get all registered feedback (restricted to syncropos role)
   */
  @Get('feedback')
  async getAllFeedback(@Req() req: any) {
    if (req.user?.role !== 'syncropos') {
      throw new ForbiddenException('Acceso restringido a personal de soporte de Syncro.');
    }
    return this.aiAgentService.getAllFeedback();
  }
}
