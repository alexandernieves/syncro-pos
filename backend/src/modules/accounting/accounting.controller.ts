import { Controller, Get, Post, Body, Req, Query, UseGuards } from '@nestjs/common';
import { AccountingService } from './accounting.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('accounting')
@UseGuards(JwtAuthGuard)
export class AccountingController {
  constructor(private readonly accountingService: AccountingService) {}

  @Post()
  async create(@Body() entryData: any, @Req() req: any) {
    const userId = req.user?.id || req.user?.sub;
    const businessId = req.user?.businessId;
    return this.accountingService.create({ ...entryData, userId, businessId });
  }

  @Get()
  async findAll(@Req() req: any) {
    const businessId = req.user?.businessId;
    return this.accountingService.findAll(businessId);
  }

  @Get('stats')
  async getStats(@Req() req: any) {
    const businessId = req.user?.businessId;
    return this.accountingService.getStats(businessId);
  }

  @Get('advanced-stats')
  async getAdvancedStats(
    @Req() req: any,
    @Query('branchId') branchId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const businessId = req.user?.businessId;
    return this.accountingService.getAdvancedStats(businessId, branchId, startDate, endDate);
  }

  @Get('investment-by-supplier')
  async getInvestmentBySupplier(@Req() req: any) {
    const businessId = req.user?.businessId;
    return this.accountingService.getInvestmentBySupplier(businessId);
  }
}
