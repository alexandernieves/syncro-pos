import { Body, Controller, Delete, ForbiddenException, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SyncroAdminService } from './syncro-admin.service';
import { BusinessModulesService, type ModuleAction } from '../business-modules/business-modules.service';
import { ModuleRequestsService } from '../business-modules/module-requests.service';

@Controller('syncro-admin')
@UseGuards(JwtAuthGuard)
export class SyncroAdminController {
  constructor(
    private readonly adminService: SyncroAdminService,
    private readonly modules: BusinessModulesService,
    private readonly requests: ModuleRequestsService,
  ) {}

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

  // ── Modules ────────────────────────────────────────────────────────────────

  @Get('business/:id/modules')
  businessModules(@Param('id') id: string, @Req() req: any) {
    this.assertAdmin(req);
    return this.modules.forBusiness(id);
  }

  @Put('business/:id/modules/:code')
  applyModule(@Param('id') id: string, @Param('code') code: string, @Body() body: { action: ModuleAction; days?: number; notify?: boolean; message?: string }, @Req() req: any) {
    const adminId = this.assertAdmin(req);
    return this.modules.apply(id, code, body?.action, body ?? {}, adminId);
  }

  @Put('business/:id/modules/:code/features/:key')
  setFeature(@Param('id') id: string, @Param('code') code: string, @Param('key') key: string, @Body() body: { enabled: boolean }, @Req() req: any) {
    const adminId = this.assertAdmin(req);
    return this.modules.setFeature(id, code, key, !!body?.enabled, adminId);
  }

  @Get('modules/trials')
  moduleTrials(@Req() req: any) {
    this.assertAdmin(req);
    return this.modules.trials();
  }

  @Get('requests')
  moduleRequests(@Query('status') status: string | undefined, @Req() req: any) {
    this.assertAdmin(req);
    return this.requests.all(status || undefined);
  }

  @Put('requests/:id')
  updateRequest(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    const adminId = this.assertAdmin(req);
    return this.requests.setStatus(id, body ?? {}, adminId);
  }
}
