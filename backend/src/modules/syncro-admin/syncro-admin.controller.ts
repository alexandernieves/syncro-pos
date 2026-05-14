import { Controller, Get, Put, Param, Body, UseGuards } from '@nestjs/common';
import { SyncroAdminService } from './syncro-admin.service';

@Controller('syncro-admin')
export class SyncroAdminController {
  constructor(private readonly adminService: SyncroAdminService) {}

  @Get('stats')
  async getStats() {
    return this.adminService.getGlobalStats();
  }

  @Get('businesses')
  async getBusinesses() {
    return this.adminService.getAllBusinesses();
  }

  @Put('business/:id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: string
  ) {
    return this.adminService.updateBusinessStatus(id, status);
  }
}
