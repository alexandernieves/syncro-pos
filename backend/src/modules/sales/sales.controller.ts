import { Controller, Get, Post, Body, Param, Req, UseGuards, Query } from '@nestjs/common';
import { SalesService } from './sales.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Body() saleData: any, @Req() req: any) {
    const userId = req.user?.sub || req.user?.id;
    return this.salesService.create(saleData, userId);
  }

  @Get()
  async findAll(@Query('branchId') branchId?: string) {
    return this.salesService.findAll(branchId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.salesService.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/return')
  async returnItems(
    @Param('id') id: string,
    @Body() returnData: any,
    @Req() req: any,
  ) {
    const userId = req.user?.sub || req.user?.id;
    return this.salesService.returnItems(id, returnData, userId);
  }
}
