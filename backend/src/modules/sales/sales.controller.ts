import { Controller, Get, Post, Body, Param, Req, Delete, UseGuards } from '@nestjs/common';
import { SalesService } from './sales.service';

@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Post()
  async create(@Body() saleData: any, @Req() req: any) {
    const userId = req.user?.id || req.user?._id || '60c72b2f9b1d8e001c8e4b3c'; // Sample ID for now
    return this.salesService.create(saleData, userId);
  }

  @Get()
  async findAll() {
    return this.salesService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.salesService.findOne(id);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.salesService.delete(id);
  }
}
