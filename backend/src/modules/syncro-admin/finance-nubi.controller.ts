import { Body, Controller, Delete, Get, Header, HttpCode, Param, Post, Put, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FinanceNubiService } from './finance-nubi.service';
import { FinanceGoogleCalendarService } from './finance-google-calendar.service';
import { requireFinanceScope } from './finance-access';
import { PrismaService } from '../prisma/prisma.service';

@Controller('syncro-admin/finance-nubi')
export class FinanceNubiController {
  constructor(
    private readonly nubi: FinanceNubiService,
    private readonly gcal: FinanceGoogleCalendarService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('google/auth-url')
  @Header('Cache-Control', 'private, no-store')
  @UseGuards(JwtAuthGuard)
  async googleAuthUrl(@Req() req: any) {
    await requireFinanceScope(this.prisma, req.user, 'personal');
    return { url: this.gcal.buildAuthUrl(req.user.id) };
  }

  @Get('google/callback')
  async googleCallback(@Query('code') code: string, @Query('state') state: string, @Res() res: Response) {
    try {
      const { email } = await this.gcal.handleCallback(code, state);
      res.type('html').send(`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Google Calendar conectado</title><body style="font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;background:#f7f5f0;color:#1a1815;padding:24px;text-align:center"><div style="max-width:360px;background:#fff;padding:28px;border-radius:24px;border:1px solid #e5e1d9"><h1 style="font-size:20px;margin:0 0 8px">Google Calendar conectado</h1><p style="font-size:14px;color:#5f5b52;margin:0 0 18px">${email ? `Cuenta vinculada: ${email}.` : 'Tu calendario quedó vinculado.'} Ya puedes pedirle a Nubi por WhatsApp que agende eventos y recordatorios.</p><a href="/dashboard/syncro/finanzas/nubi-whatsapp" style="display:inline-block;background:#F26B3A;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:600;font-size:14px">Volver a Syncro</a></div></body></html>`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo conectar Google Calendar';
      res.status(400).type('html').send(`<!doctype html><html lang="es"><meta charset="utf-8"><title>Error</title><body style="font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;background:#f7f5f0;color:#1a1815;padding:24px;text-align:center"><div style="max-width:360px;background:#fff;padding:24px;border-radius:20px;border:1px solid #e5e1d9"><h1 style="font-size:18px;margin:0 0 8px">No se pudo conectar</h1><p style="font-size:14px;color:#b91c1c">${msg}</p></div></body></html>`);
    }
  }

  @Delete('google')
  @UseGuards(JwtAuthGuard)
  async disconnectGoogle(@Req() req: any) {
    await requireFinanceScope(this.prisma, req.user, 'personal');
    return this.gcal.disconnect(req.user.id);
  }

  @Get()
  @Header('Cache-Control', 'private, no-store')
  @UseGuards(JwtAuthGuard)
  settings(@Req() req: any) {
    return this.nubi.settings(req.user);
  }

  @Post('connect')
  @Header('Cache-Control', 'private, no-store')
  @UseGuards(JwtAuthGuard)
  connect(@Req() req: any) {
    return this.nubi.connect(req.user);
  }

  @Post('disconnect')
  @Header('Cache-Control', 'private, no-store')
  @UseGuards(JwtAuthGuard)
  disconnect(@Req() req: any) {
    return this.nubi.disconnect(req.user);
  }

  @Put('model')
  @Header('Cache-Control', 'private, no-store')
  @UseGuards(JwtAuthGuard)
  setModel(@Req() req: any, @Body() body: { model?: string }) {
    return this.nubi.setModel(req.user, body?.model);
  }

  @Post('phones')
  @UseGuards(JwtAuthGuard)
  authorize(@Req() req: any, @Body() input: unknown) {
    return this.nubi.authorize(req.user, input);
  }

  @Delete('phones/:phone')
  @UseGuards(JwtAuthGuard)
  revoke(@Req() req: any, @Param('phone') phone: string) {
    return this.nubi.revoke(req.user, phone);
  }

  @Post('phones/:phone/code')
  @Header('Cache-Control', 'private, no-store')
  @UseGuards(JwtAuthGuard)
  code(@Req() req: any, @Param('phone') phone: string) {
    return this.nubi.issueCode(req.user, phone);
  }

  @Post('webhook')
  @HttpCode(200)
  webhook(@Query('token') token: unknown, @Body() payload: unknown) {
    return this.nubi.receive(token, payload);
  }
}
