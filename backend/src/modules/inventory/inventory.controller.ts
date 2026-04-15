import { Controller, Get, Param } from '@nestjs/common';
import { InventoryService } from './inventory.service';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get() findAll() { return this.inventoryService.findAll(); }
  @Get('product/:id') findByProduct(@Param('id') id: string) { return this.inventoryService.findByProduct(id); }
}
