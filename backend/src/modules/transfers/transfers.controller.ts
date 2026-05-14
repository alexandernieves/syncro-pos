import { Controller, Get, Post, Body, Param, Put, Query, UseGuards, Request } from '@nestjs/common';
import { TransfersService } from './transfers.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('transfers')
@UseGuards(JwtAuthGuard)
export class TransfersController {
  constructor(private readonly transfersService: TransfersService) {}

  @Get()
  findAll(@Query('branchId') branchId?: string) {
    return this.transfersService.findAll(branchId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.transfersService.findOne(id);
  }

  @Post()
  create(@Body() body: any, @Request() req: any) {
    const userId = req.user.id || req.user.sub;
    return this.transfersService.create({ ...body, userId });
  }

  @Put(':id/complete')
  complete(@Param('id') id: string) {
    return this.transfersService.complete(id);
  }

  @Put(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.transfersService.cancel(id);
  }
}
