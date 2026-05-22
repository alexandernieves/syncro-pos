import { Controller, Get, Post, Body, Param, Patch, Query, UseGuards, Request } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  findAll(@Request() req: any) {
    const businessId = req.user.businessId;
    const userId = req.user.id || req.user.sub;
    return this.notificationsService.findAll(businessId, userId);
  }

  @Post()
  create(@Body() data: any) {
    return this.notificationsService.create(data);
  }

  @Patch(':id/read')
  markAsRead(@Param('id') id: string) {
    return this.notificationsService.markAsRead(id);
  }

  @Post('read-all')
  markAllAsRead(@Request() req: any) {
    const businessId = req.user.businessId;
    const userId = req.user.id || req.user.sub;
    return this.notificationsService.markAllAsRead(businessId, userId);
  }
}
