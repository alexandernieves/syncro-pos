import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { InventoryService } from './inventory.service';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('movements')
  async findAll() {
    return this.inventoryService.findAll();
  }

  @Get(':variantId')
  async findByVariant(@Param('variantId') variantId: string) {
    return this.inventoryService.findByVariant(variantId);
  }

  @Post('restock')
  async restock(@Body() data: { variantId: string, branchId: string, quantity: number }) {
    return this.inventoryService.restock(data);
  }
}
