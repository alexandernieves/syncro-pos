import { Controller, Get, Post, Body, Param, UseGuards, Req, Query } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('inventory')
@UseGuards(JwtAuthGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('movements')
  async findAll(@Req() req: any, @Query('branchId') branchId?: string) {
    return this.inventoryService.findAll(branchId, req.user?.role === 'syncropos' ? undefined : req.user?.businessId);
  }

  @Get(':variantId')
  async findByVariant(@Req() req: any, @Param('variantId') variantId: string) {
    return this.inventoryService.findByVariant(variantId, req.user?.role === 'syncropos' ? undefined : req.user?.businessId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('restock')
  async restock(@Body() data: { variantId: string, branchId: string, quantity: number }, @Req() req: any) {
    const userId = req.user?.id || req.user?.sub;
    await this.inventoryService.assertOwned(req.user, data?.branchId, [data?.variantId]);
    return this.inventoryService.restock(data, userId);
  }

  /** Several products arriving at once (the "Ingreso de mercancía" screen, scanner first) */
  @Post('restock-bulk')
  async restockBulk(@Body() data: { branchId: string, items: { variantId: string, quantity: number }[] }, @Req() req: any) {
    const userId = req.user?.id || req.user?.sub;
    const items = Array.isArray(data?.items) ? data.items : [];
    await this.inventoryService.assertOwned(req.user, data?.branchId, items.map((i) => i?.variantId));
    return this.inventoryService.restockMany(data.branchId, items, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('reconcile')
  async reconcile(@Body() data: { branchId: string, items: { variantId: string, quantity: number }[] }, @Req() req: any) {
    const userId = req.user?.id || req.user?.sub;
    await this.inventoryService.assertOwned(req.user, data?.branchId, (data?.items ?? []).map((i) => i?.variantId));
    return this.inventoryService.reconcile(data, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('sync-master')
  async syncMaster(@Body() data: { branchId: string }, @Req() req: any) {
    const userId = req.user?.id || req.user?.sub;
    await this.inventoryService.assertOwned(req.user, data?.branchId, []);
    return this.inventoryService.syncMaster(data.branchId, userId);
  }
}
