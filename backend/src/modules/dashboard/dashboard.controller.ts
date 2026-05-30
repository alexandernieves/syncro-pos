import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  async getStats(
    @Req() req: any, 
    @Query('branchId') branchId?: string,
    @Query('date') date?: string
  ) {
    const businessId = req.user.businessId;
    const userId = req.user.id || req.user.sub;
    return this.dashboardService.getStats(businessId, branchId, userId, date);
  }
}
