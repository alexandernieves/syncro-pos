import { BadRequestException, Body, Controller, Delete, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PushService } from './push.service';

@Controller('push')
export class PushController {
  constructor(
    private readonly pushService: PushService,
    private readonly config: ConfigService,
  ) {}

  @Get('vapid-key')
  getVapidKey() {
    return { publicKey: this.pushService.configured ? this.config.get('VAPID_PUBLIC_KEY') : null };
  }

  /** Registers this device for the signed-in user (the user always comes from the token). */
  @Post('subscribe')
  @UseGuards(JwtAuthGuard)
  async subscribe(@Req() req: any, @Body() body: { subscription?: any }) {
    const sub = body?.subscription;
    if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth || typeof sub.endpoint !== 'string' || !/^https:\/\//.test(sub.endpoint)) {
      throw new BadRequestException('Suscripción no válida');
    }
    if (req.user?.role === 'client') throw new BadRequestException('Solo para el equipo del negocio');
    return this.pushService.subscribe(req.user.id ?? req.user.sub, sub, req.headers?.['user-agent']);
  }

  @Delete('unsubscribe')
  @UseGuards(JwtAuthGuard)
  async unsubscribe(@Req() req: any, @Body() body: { endpoint: string }) {
    return this.pushService.unsubscribe(req.user.id ?? req.user.sub, String(body?.endpoint ?? ''));
  }
}
