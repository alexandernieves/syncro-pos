import { Body, Controller, Delete, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MascotService } from './mascot.service';

/** Syncro the mascot: its settings, its ideas (the light bulb) and the replies to them. */
@Controller('mascot')
@UseGuards(JwtAuthGuard)
export class MascotController {
  constructor(private readonly mascot: MascotService) {}

  @Get('settings')
  settings(@Req() req: any) {
    return this.mascot.settings(req.user);
  }

  @Put('settings')
  update(@Req() req: any, @Body() body: any) {
    return this.mascot.updateSettings(req.user, body);
  }

  @Get('memory')
  memory(@Req() req: any) {
    return this.mascot.memory(req.user);
  }

  @Delete('memory')
  clearMemory(@Req() req: any) {
    return this.mascot.clearMemory(req.user);
  }

  /** The idea waiting for the user, or a new one when it's time. */
  @Post('think')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  think(@Req() req: any) {
    return this.mascot.think(req.user).then((t) => t ?? { none: true });
  }

  /** The idea history (saved thoughts). */
  @Get('thoughts/saved')
  saved(@Req() req: any) {
    return this.mascot.savedThoughts(req.user);
  }

  /** The user shares a thought; the mascot answers right away. */
  @Post('share')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  share(@Req() req: any, @Body() body: { text: string }) {
    return this.mascot.share(req.user, body?.text);
  }

  @Put('thoughts/:id/saved')
  setSaved(@Req() req: any, @Param('id') id: string, @Body() body: { saved: boolean }) {
    return this.mascot.setSaved(req.user, id, !!body?.saved);
  }

  @Put('thoughts/:id')
  status(@Req() req: any, @Param('id') id: string, @Body() body: { status: string }) {
    return this.mascot.setStatus(req.user, id, body?.status);
  }

  @Post('thoughts/:id/reply')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  reply(@Req() req: any, @Param('id') id: string, @Body() body: { text: string }) {
    return this.mascot.reply(req.user, id, body?.text);
  }
}
