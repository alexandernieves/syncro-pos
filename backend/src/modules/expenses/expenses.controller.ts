import { Controller, Get, Post, Body, Param, Delete, Query, UseGuards, Request } from '@nestjs/common';
import { ExpensesService } from './expenses.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('expenses')
@UseGuards(JwtAuthGuard)
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Get()
  findAll(@Request() req: any, @Query('branchId') branchId?: string) {
    const businessId = req.user?.businessId;
    return this.expensesService.findAll(businessId, branchId);
  }

  @Get('stats')
  getStats(@Request() req: any, @Query('branchId') branchId?: string) {
    const businessId = req.user?.businessId;
    return this.expensesService.getStats(businessId, branchId);
  }

  @Post()
  create(@Body() body: any, @Request() req: any) {
    const userId = req.user.id || req.user.sub;
    return this.expensesService.create({ ...body, userId });
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.expensesService.remove(id);
  }
}
