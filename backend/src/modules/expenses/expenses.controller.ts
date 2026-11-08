import { Controller, Get, Post, Body, Param, Delete, Query, UseGuards, Request } from '@nestjs/common';
import { ExpensesService } from './expenses.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { assertOwned, ownedBy } from '../../common/ownership';
import { PrismaService } from '../prisma/prisma.service';

@Controller('expenses')
@UseGuards(JwtAuthGuard)
export class ExpensesController {
  constructor(
    private readonly expensesService: ExpensesService,
    private readonly prisma: PrismaService,
  ) {}

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
  async remove(@Param('id') id: string, @Request() req: any) {
    await assertOwned(this.prisma, 'expense', id, req.user);
    return this.expensesService.remove(id);
  }
}
