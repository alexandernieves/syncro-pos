import { Controller, Get, Post, Body, Req, Query } from '@nestjs/common';
import { AccountingService } from './accounting.service';
import { EntryType } from './accounting.schema';

@Controller('accounting')
export class AccountingController {
  constructor(private readonly accountingService: AccountingService) {}

  @Post()
  async create(@Body() entryData: any, @Req() req: any) {
    const userId = req.user?.id || req.user?._id || '60c72b2f9b1d8e001c8e4b3c';
    return this.accountingService.createEntry(entryData, userId);
  }

  @Get()
  async findAll(@Query('type') type?: EntryType) {
    if (type) return this.accountingService.findByType(type);
    return this.accountingService.findAll();
  }

  @Get('summary')
  async getSummary() {
    return this.accountingService.getSummary();
  }
}
