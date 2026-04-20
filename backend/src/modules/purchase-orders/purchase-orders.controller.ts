import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Param, 
  Delete, 
  Patch,
  UseGuards,
  Req,
  Query,
  BadRequestException
} from '@nestjs/common';
import { PurchaseOrdersService } from './purchase-orders.service';
import { AuthGuard } from '@nestjs/passport';
import { PurchaseOrderStatus } from '@prisma/client';

@Controller('purchase-orders')
@UseGuards(AuthGuard('jwt'))
export class PurchaseOrdersController {
  constructor(private readonly purchaseOrdersService: PurchaseOrdersService) {}

  @Post()
  async create(@Req() req: any, @Body() createData: {
    supplierId: string;
    branchId: string;
    items: Array<{
      variantId: string;
      quantity: number;
      cost: number;
    }>;
  }) {
    if (!req.user || !req.user.id) {
      throw new BadRequestException('Usuario no autenticado');
    }

    if (!createData.supplierId || !createData.branchId || !createData.items || createData.items.length === 0) {
      throw new BadRequestException('Datos incompletos para crear la orden de compra');
    }

    return this.purchaseOrdersService.create(createData);
  }

  @Get()
  async findAll(@Req() req: any, @Query('branchId') branchId?: string) {
    if (!req.user || !req.user.id) {
      throw new BadRequestException('Usuario no autenticado');
    }

    return this.purchaseOrdersService.findAll(branchId);
  }

  @Get(':id')
  async findOne(@Req() req: any, @Param('id') id: string) {
    if (!req.user || !req.user.id) {
      throw new BadRequestException('Usuario no autenticado');
    }

    return this.purchaseOrdersService.findOne(id);
  }

  @Post(':id/send')
  async send(@Req() req: any, @Param('id') id: string) {
    if (!req.user || !req.user.id) {
      throw new BadRequestException('Usuario no autenticado');
    }

    return this.purchaseOrdersService.send(id);
  }

  @Post(':id/receive')
  async receive(@Req() req: any, @Param('id') id: string) {
    if (!req.user || !req.user.id) {
      throw new BadRequestException('Usuario no autenticado');
    }

    return this.purchaseOrdersService.receive(id, req.user.id);
  }

  @Patch(':id/status')
  async updateStatus(
    @Req() req: any, 
    @Param('id') id: string, 
    @Body('status') status: PurchaseOrderStatus
  ) {
    if (!req.user || !req.user.id) {
      throw new BadRequestException('Usuario no autenticado');
    }

    if (!Object.values(PurchaseOrderStatus).includes(status)) {
      throw new BadRequestException('Estado inválido');
    }

    return this.purchaseOrdersService.updateStatus(id, status);
  }

  @Delete(':id')
  async remove(@Req() req: any, @Param('id') id: string) {
    if (!req.user || !req.user.id) {
      throw new BadRequestException('Usuario no autenticado');
    }

    return this.purchaseOrdersService.delete(id);
  }
}
