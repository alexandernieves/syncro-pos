import { Controller, Get, Post, Body, Param, Put, Query, UseGuards, Request } from '@nestjs/common';
import { TransfersService } from './transfers.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { assertOwned, ownedBy } from '../../common/ownership';
import { PrismaService } from '../prisma/prisma.service';

@Controller('transfers')
@UseGuards(JwtAuthGuard)
export class TransfersController {
  constructor(
    private readonly transfersService: TransfersService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  findAll(@Request() req: any, @Query('branchId') branchId?: string) {
    return this.transfersService.findAll(branchId, ownedBy('inventoryTransfer', req.user));
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Request() req: any) {
    await assertOwned(this.prisma, 'inventoryTransfer', id, req.user);
    return this.transfersService.findOne(id);
  }

  @Post()
  create(@Body() body: any, @Request() req: any) {
    const userId = req.user.id || req.user.sub;
    return this.transfersService.create({ ...body, userId });
  }

  @Put(':id/complete')
  async complete(@Param('id') id: string, @Request() req: any) {
    await assertOwned(this.prisma, 'inventoryTransfer', id, req.user);
    return this.transfersService.complete(id);
  }

  @Put(':id/cancel')
  async cancel(@Param('id') id: string, @Request() req: any) {
    await assertOwned(this.prisma, 'inventoryTransfer', id, req.user);
    return this.transfersService.cancel(id);
  }
}
