import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('dashboard')
  async getDashboardStats(
    @Req() req: any,
    @Query('branchId') branchId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const businessId = req.user?.businessId;
    return this.reportsService.getDashboardStats(businessId, branchId, startDate, endDate);
  }
}
