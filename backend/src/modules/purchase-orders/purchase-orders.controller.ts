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
import { assertOwned, ownedBy } from '../../common/ownership';
import { PrismaService } from '../prisma/prisma.service';

@Controller('purchase-orders')
@UseGuards(AuthGuard('jwt'))
export class PurchaseOrdersController {
  constructor(
    private readonly purchaseOrdersService: PurchaseOrdersService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  async create(@Req() req: any, @Body() createData: {
    supplierId: string;
    branchId: string;
    items: Array<{
      variantId: string;
      quantity: number;
      cost: number;
      unit?: string;
      unitFactor?: number;
    }>;
  }) {
    if (!req.user || !req.user.id) {
      throw new BadRequestException('Usuario no autenticado');
    }

    if (!createData.supplierId || !createData.branchId || !createData.items || createData.items.length === 0) {
      throw new BadRequestException('Datos incompletos para crear la orden de compra');
    }

    return this.purchaseOrdersService.create(createData, req.user.businessId);
  }

  @Get()
  async findAll(@Req() req: any, @Query('branchId') branchId?: string) {
    if (!req.user || !req.user.id) {
      throw new BadRequestException('Usuario no autenticado');
    }

    return this.purchaseOrdersService.findAll(branchId, ownedBy('purchaseOrder', req.user));
  }

  @Get('unit-memory')
  async unitMemory(@Req() req: any) {
    return this.purchaseOrdersService.unitMemory(req.user?.businessId);
  }

  @Get(':id')
  async findOne(@Req() req: any, @Param('id') id: string) {
    if (!req.user || !req.user.id) {
      throw new BadRequestException('Usuario no autenticado');
    }

    await assertOwned(this.prisma, 'purchaseOrder', id, req.user);
    return this.purchaseOrdersService.findOne(id);
  }

  @Post(':id/send')
  async send(@Req() req: any, @Param('id') id: string) {
    if (!req.user || !req.user.id) {
      throw new BadRequestException('Usuario no autenticado');
    }

    await assertOwned(this.prisma, 'purchaseOrder', id, req.user);
    return this.purchaseOrdersService.send(id);
  }

  /** Receives the order: all of it, or `lines` with what actually arrived (the rest stays pending) */
  @Post(':id/receive')
  async receive(@Req() req: any, @Param('id') id: string, @Body() body: { lines?: Array<{ itemId: string; quantity: number }> }) {
    if (!req.user || !req.user.id) {
      throw new BadRequestException('Usuario no autenticado');
    }

    await assertOwned(this.prisma, 'purchaseOrder', id, req.user);
    return this.purchaseOrdersService.receive(id, req.user.id, Array.isArray(body?.lines) ? body.lines : undefined);
  }

  /** Close an order received in part: what's pending won't come */
  @Post(':id/close-pending')
  async closePending(@Req() req: any, @Param('id') id: string) {
    await assertOwned(this.prisma, 'purchaseOrder', id, req.user);
    return this.purchaseOrdersService.closePending(id);
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

    await assertOwned(this.prisma, 'purchaseOrder', id, req.user);
    return this.purchaseOrdersService.updateStatus(id, status);
  }

  @Delete(':id')
  async remove(@Req() req: any, @Param('id') id: string) {
    if (!req.user || !req.user.id) {
      throw new BadRequestException('Usuario no autenticado');
    }

    await assertOwned(this.prisma, 'purchaseOrder', id, req.user);
    return this.purchaseOrdersService.delete(id);
  }
}
