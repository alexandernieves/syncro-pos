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

  @UseGuards(JwtAuthGuard)
  @Get()
  async findAll(@Req() req: any, @Query('branchId') branchId?: string) {
    const businessId = req.user?.businessId;
    return this.salesService.findAll(businessId, branchId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async findOne(@Req() req: any, @Param('id') id: string) {
    const businessId = req.user?.businessId;
    return this.salesService.findOne(id, businessId);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/return')
  async returnItems(
    @Param('id') id: string,
    @Body() returnData: any,
    @Req() req: any,
  ) {
    const userId = req.user?.sub || req.user?.id;
    const businessId = req.user?.businessId;
    return this.salesService.returnItems(id, returnData, userId, businessId);
  }
}
