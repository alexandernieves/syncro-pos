import { Body, Controller, Delete, ForbiddenException, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SyncroAdminService } from './syncro-admin.service';

@Controller('syncro-admin')
@UseGuards(JwtAuthGuard)
export class SyncroAdminController {
  constructor(private readonly adminService: SyncroAdminService) {}

  private assertAdmin(req: any) {
    if (req.user?.role !== 'syncropos') {
      throw new ForbiddenException('Solo el equipo de Syncro puede acceder a este recurso');
    }
    return req.user.id as string;
  }

  @Get('stats')
  getStats(@Req() req: any) {
    this.assertAdmin(req);
    return this.adminService.getGlobalStats();
  }

  @Get('businesses')
  getBusinesses(@Req() req: any) {
    this.assertAdmin(req);
    return this.adminService.getAllBusinesses();
  }

  @Get('business/:id')
  getBusiness(@Param('id') id: string, @Req() req: any) {
    this.assertAdmin(req);
    return this.adminService.getBusiness(id);
  }

  @Put('business/:id/status')
  updateStatus(@Param('id') id: string, @Body() body: { status: string; reason?: string }, @Req() req: any) {
    const adminId = this.assertAdmin(req);
    return this.adminService.updateBusinessStatus(id, body?.status, body?.reason, adminId);
  }

  @Put('business/:id')
  updateBusiness(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    const adminId = this.assertAdmin(req);
    return this.adminService.updateBusiness(id, body ?? {}, adminId);
  }

  @Post('business/:id/payments')
  registerPayment(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    const adminId = this.assertAdmin(req);
    return this.adminService.registerPayment(id, body ?? {}, adminId);
  }

  @Delete('payments/:paymentId')
  deletePayment(@Param('paymentId') paymentId: string, @Req() req: any) {
    const adminId = this.assertAdmin(req);
    return this.adminService.deletePayment(paymentId, adminId);
  }

  @Get('subscriptions')
  getSubscriptions(@Req() req: any) {
    this.assertAdmin(req);
    return this.adminService.getSubscriptions();
  }

  @Get('audit')
  getAudit(@Query() query: any, @Req() req: any) {
    this.assertAdmin(req);
    return this.adminService.getAudit(query ?? {});
  }
}
