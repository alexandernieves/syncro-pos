import { Controller, Get, Put, Param, Body, UseGuards, Req, ForbiddenException } from '@nestjs/common';
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
  }

  @Get('stats')
  async getStats(@Req() req: any) {
    this.assertAdmin(req);
    return this.adminService.getGlobalStats();
  }

  @Get('businesses')
  async getBusinesses(@Req() req: any) {
    this.assertAdmin(req);
    return this.adminService.getAllBusinesses();
  }

  @Put('business/:id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: string,
    @Req() req: any
  ) {
    this.assertAdmin(req);
    return this.adminService.updateBusinessStatus(id, status);
  }
}
