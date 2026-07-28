import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
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
  async getSessions(@Req() req: any, @Query('type') type?: string, @Query('branchId') branchId?: string) {
    const userId = req.user?.id || req.user?.sub;
    const businessId = req.user?.businessId;
    return this.aiAgentService.getSessions(businessId, userId, type || 'GENERAL', branchId);
  }

  /**
   * Create a new AI chat session
   */
  @Post('sessions')
  async createSession(@Req() req: any, @Body('title') title?: string, @Body('type') type?: string, @Body('branchId') branchId?: string) {
    const userId = req.user?.id || req.user?.sub;
    const businessId = req.user?.businessId;
    return this.aiAgentService.createSession(businessId, userId, title, type || 'GENERAL', branchId);
  }

  /**
   * Pin or unpin an AI chat session
   */
  @Post('sessions/pin')
  async pinSession(
    @Req() req: any,
    @Body('sessionId') sessionId: string,
    @Body('isPinned') isPinned: boolean,
  ) {
    const userId = req.user?.id || req.user?.sub;
    const businessId = req.user?.businessId;
    return this.aiAgentService.pinSession(businessId, userId, sessionId, isPinned);
  }

  /**
   * Archive or unarchive an AI chat session
   */
  @Post('sessions/archive')
  async archiveSession(
    @Req() req: any,
    @Body('sessionId') sessionId: string,
    @Body('isArchived') isArchived: boolean,
  ) {
    const userId = req.user?.id || req.user?.sub;
    const businessId = req.user?.businessId;
    return this.aiAgentService.archiveSession(businessId, userId, sessionId, isArchived);
  }

  /**
   * Delete an AI chat session
   */
  @Delete('sessions')
  async deleteSession(@Req() req: any, @Query('sessionId') sessionId: string) {
    const userId = req.user?.id || req.user?.sub;
    const businessId = req.user?.businessId;
    await this.aiAgentService.deleteSession(businessId, userId, sessionId);
    return { success: true };
  }

  /**
   * Send a message to the AI agent and receive a response
   */
  @Post('chat')
  async chat(
    @Body('message') message: string,
    @Body('sessionId') sessionId: string,
    @Req() req: any,
    @Body('branchId') branchId?: string,
    @Body('isAdsMode') isAdsMode?: boolean,
    @Body('webSearch') webSearch?: boolean,
  ): Promise<any> {
    const userId = req.user?.id || req.user?.sub;
    const businessId = req.user?.businessId;
    return this.aiAgentService.chat(userId, businessId, message, sessionId || 'default', branchId, isAdsMode, webSearch);
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
    @Body('branchId') branchId?: string,
    @Body('isAdsMode') isAdsMode?: boolean,
    @Body('screenshot') screenshot?: string | null,
    @Body('webSearch') webSearch?: boolean,
  ) {
    const userId = req.user?.id || req.user?.sub;
    const businessId = req.user?.businessId;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    if (isAdsMode) {
      await this.aiAgentService.adsChatStream(
        userId,
        businessId,
        message,
        sessionId || 'default',
        screenshot || null,
        branchId || null,
        null, // audio
        null, // audioFormat
        false, // autopilot
        (payload: any) => {
          if (typeof payload === 'string') {
            res.write(`data: ${JSON.stringify({ chunk: payload })}\n\n`);
          } else {
            res.write(`data: ${JSON.stringify(payload)}\n\n`);
          }
        },
        (result) => {
          res.write(`data: ${JSON.stringify({
            done: true,
            id: result.id,
            message: result.message,
            action: result.action
          })}\n\n`);
          res.end();
        },
        'GENERAL',
        !!webSearch
      );
    } else {
      await this.aiAgentService.chatStream(
        userId,
        businessId,
        message,
        sessionId || 'default',
        branchId,
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
  }

  /**
   * Save a screen capture of Meta Ads Manager silently into PostgreSQL database for context retrieval
   */
  @Post('screenshot')
  async saveScreenshot(
    @Body('sessionId') sessionId: string,
    @Body('screenshot') screenshot: string,
    @Req() req: any,
  ) {
    const userId = req.user?.id || req.user?.sub;
    const businessId = req.user?.businessId;
    await this.aiAgentService.saveScreenshot(businessId, userId, sessionId, screenshot);
    return { success: true };
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

  /**
   * Get all Ads Copilot documents
   */
  @Get('ads-copilot/documents')
  async getAdsDocuments(@Req() req: any, @Query('branchId') branchId?: string) {
    const businessId = req.user?.businessId;
    return this.aiAgentService.getAdsDocuments(businessId, branchId);
  }

  /**
   * Create a new Ads Copilot document (e.g. video transcript)
   */
  @Post('ads-copilot/documents')
  async createAdsDocument(
    @Req() req: any,
    @Body('title') title: string,
    @Body('content') content: string,
    @Body('sourceType') sourceType?: string,
    @Body('branchId') branchId?: string,
    @Body('screenshots') screenshots?: { ts: number; data: string }[],
  ) {
    const businessId = req.user?.businessId;
    return this.aiAgentService.createAdsDocument(
      businessId, 
      branchId || null, 
      title, 
      content, 
      sourceType || 'VIDEO_TRANSCRIPT',
      screenshots || null
    );
  }

  /**
   * Update an Ads Copilot document
   */
  @Put('ads-copilot/documents/:id')
  async updateAdsDocument(
    @Req() req: any,
    @Param('id') id: string,
    @Body('title') title: string,
    @Body('content') content: string,
  ) {
    const businessId = req.user?.businessId;
    return this.aiAgentService.updateAdsDocument(businessId, id, title, content);
  }

  /**
   * Delete an Ads Copilot document
   */
  @Delete('ads-copilot/documents')
  async deleteAdsDocument(@Req() req: any, @Query('id') id: string) {
    const businessId = req.user?.businessId;
    await this.aiAgentService.deleteAdsDocument(businessId, id);
    return { success: true };
  }

  /**
   * Transcribe an audio chunk using OpenRouter audio/transcriptions Whisper API
   */
  @Post('ads-copilot/transcribe-chunk')
  async transcribeChunk(
    @Body('audio') audio: string, // Base64 audio chunk data
    @Body('format') format?: string,
  ) {
    try {
      const text = await this.aiAgentService.transcribeAudioChunk(audio, format || 'webm');
      return { text };
    } catch (err) {
      return { text: '', error: err.message };
    }
  }

  /**
   * Send query + optional screenshot to the Ads Copilot with Vision SSE stream
   */
  @Post('ads-copilot/chat-stream')
  async adsChatStream(
    @Body('message') message: string,
    @Body('sessionId') sessionId: string,
    @Body('screenshot') screenshot: string | null,
    @Body('branchId') branchId: string | null,
    @Body('audio') audio: string | null,
    @Body('audioFormat') audioFormat: string | null,
    @Body('isAutopilot') isAutopilot: boolean | null,
    @Req() req: any,
    @Res() res: any,
  ) {
    const userId = req.user?.id || req.user?.sub;
    const businessId = req.user?.businessId;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    await this.aiAgentService.adsChatStream(
      userId,
      businessId,
      message,
      sessionId || 'default',
      screenshot || null,
      branchId || null,
      audio || null,
      audioFormat || 'webm',
      isAutopilot || false,
      (payload: any) => {
        if (typeof payload === 'string') {
          res.write(`data: ${JSON.stringify({ chunk: payload })}\n\n`);
        } else {
          res.write(`data: ${JSON.stringify(payload)}\n\n`);
        }
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
}
