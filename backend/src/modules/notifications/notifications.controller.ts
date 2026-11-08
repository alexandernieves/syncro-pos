import { Controller, Get, Post, Body, Param, Patch, Query, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { assertOwned, ownedBy } from '../../common/ownership';
import { PrismaService } from '../prisma/prisma.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  findAll(@Request() req: any) {
    const businessId = req.user.businessId;
    const userId = req.user.id || req.user.sub;
    return this.notificationsService.findAll(businessId, userId);
  }

  @Post()
  create(@Body() data: any, @Request() req: any) {
    // Notifications are created by the server itself; from outside only the Syncro team may
    if (req.user?.role !== 'syncropos') throw new ForbiddenException('No permitido');
    return this.notificationsService.create(data);
  }

  @Patch(':id/read')
  async markAsRead(@Param('id') id: string, @Request() req: any) {
    await assertOwned(this.prisma, 'notification', id, req.user);
    return this.notificationsService.markAsRead(id);
  }

  @Post('read-all')
  markAllAsRead(@Request() req: any) {
    const businessId = req.user.businessId;
    const userId = req.user.id || req.user.sub;
    return this.notificationsService.markAllAsRead(businessId, userId);
  }
}
