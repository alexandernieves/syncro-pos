import { Controller, Post, Delete, Body, Param, Get } from '@nestjs/common';
import { PushService } from './push.service';
import { ConfigService } from '@nestjs/config';

@Controller('push')
export class PushController {
  constructor(
    private readonly pushService: PushService,
    private readonly config: ConfigService,
  ) {}

  @Get('vapid-key')
  getVapidKey() {
    return { publicKey: this.config.get('VAPID_PUBLIC_KEY') };
  }

  @Post('subscribe')
  async subscribe(@Body() body: { userId: string; subscription: any }) {
    return this.pushService.subscribe(body.userId, body.subscription);
  }

  @Delete('unsubscribe')
  async unsubscribe(@Body() body: { endpoint: string }) {
    return this.pushService.unsubscribe(body.endpoint);
  }
}
