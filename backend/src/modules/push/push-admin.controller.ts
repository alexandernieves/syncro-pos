import { Body, Controller, ForbiddenException, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PushCampaignsService } from './push-campaigns.service';

/** Syncro central → Notificaciones push. */
@Controller('syncro-admin/push')
@UseGuards(JwtAuthGuard)
export class PushAdminController {
  constructor(private readonly campaigns: PushCampaignsService) {}

  private admin(req: any) {
    if (req.user?.role !== 'syncropos') throw new ForbiddenException('Solo el equipo de Syncro puede acceder a este recurso');
    return req.user.id as string;
  }

  @Get()
  overview(@Req() req: any) {
    this.admin(req);
    return this.campaigns.overview();
  }

  @Get('audience')
  audience(@Req() req: any) {
    this.admin(req);
    return this.campaigns.audience();
  }

  @Get('campaigns/:id')
  campaign(@Param('id') id: string, @Req() req: any) {
    this.admin(req);
    return this.campaigns.campaign(id);
  }

  @Post('send')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  send(@Body() body: any, @Req() req: any) {
    return this.campaigns.sendManual(body, this.admin(req));
  }

  @Post('test')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  test(@Body() body: any, @Req() req: any) {
    return this.campaigns.sendTest(body, this.admin(req));
  }

  @Put('automations/:key')
  automation(@Param('key') key: string, @Body() body: any, @Req() req: any) {
    this.admin(req);
    return this.campaigns.updateAutomation(key, body);
  }
}
