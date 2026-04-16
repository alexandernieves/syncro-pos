import { Controller, Get, Post, Body, Req } from '@nestjs/common';
import { AccountingService } from './accounting.service';

@Controller('accounting')
export class AccountingController {
  constructor(private readonly accountingService: AccountingService) {}

  @Post()
  async create(@Body() entryData: any, @Req() req: any) {
    const userId = req.user?.id || 'admin-id-placeholder';
    return this.accountingService.create({ ...entryData, userId });
  }

  @Get()
  async findAll() {
    return this.accountingService.findAll();
  }

  @Get('stats')
  async getStats() {
    return this.accountingService.getStats();
  }

  @Get('investment-by-supplier')
  async getInvestmentBySupplier() {
    return this.accountingService.getInvestmentBySupplier();
  }
}
