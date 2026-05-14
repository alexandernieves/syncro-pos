import { Controller, Get, Post, Body, Param, UseGuards, Req, Query } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('movements')
  async findAll(@Query('branchId') branchId?: string) {
    return this.inventoryService.findAll(branchId);
  }

  @Get(':variantId')
  async findByVariant(@Param('variantId') variantId: string) {
    return this.inventoryService.findByVariant(variantId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('restock')
  async restock(@Body() data: { variantId: string, branchId: string, quantity: number }, @Req() req: any) {
    const userId = req.user?.id || req.user?.sub;
    return this.inventoryService.restock(data, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('reconcile')
  async reconcile(@Body() data: { branchId: string, items: { variantId: string, quantity: number }[] }, @Req() req: any) {
    const userId = req.user?.id || req.user?.sub;
    return this.inventoryService.reconcile(data, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('sync-master')
  async syncMaster(@Body() data: { branchId: string }, @Req() req: any) {
    const userId = req.user?.id || req.user?.sub;
    return this.inventoryService.syncMaster(data.branchId, userId);
  }
}
