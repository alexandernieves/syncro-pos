import { Controller, Get, Post, Body, Param, Req, UseGuards } from '@nestjs/common';
import { SalesService } from './sales.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Post()
  async create(@Body() saleData: any, @Req() req: any) {
    // Falls back to a default user if req.user is not set (for testing)
    const userId = req.user?.id || 'admin-id-placeholder'; 
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
}
