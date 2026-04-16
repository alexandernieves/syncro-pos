import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Param, 
  UseGuards,
  Req,
  Query,
  BadRequestException
} from '@nestjs/common';
import { SupplierReturnsService } from './supplier-returns.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('supplier-returns')
@UseGuards(AuthGuard('jwt'))
export class SupplierReturnsController {
  constructor(private readonly supplierReturnsService: SupplierReturnsService) {}

  @Post()
  async create(@Req() req: any, @Body() createData: {
    supplierId: string;
    variantId: string;
    quantity: number;
    reason: string;
    branchId: string;
  }) {
    if (!req.user || !req.user.id) {
      throw new BadRequestException('Usuario no autenticado');
    }

    if (!createData.supplierId || !createData.variantId || !createData.quantity || !createData.reason || !createData.branchId) {
      throw new BadRequestException('Datos incompletos para crear la devolución');
    }

    if (createData.quantity <= 0) {
      throw new BadRequestException('La cantidad debe ser mayor a cero');
    }

    return this.supplierReturnsService.create(createData);
  }

  @Get()
  async findAll(
    @Req() req: any, 
    @Query('supplierId') supplierId?: string,
    @Query('branchId') branchId?: string
  ) {
    if (!req.user || !req.user.id) {
      throw new BadRequestException('Usuario no autenticado');
    }

    return this.supplierReturnsService.findAll(supplierId, branchId);
  }

  @Get(':id')
  async findOne(@Req() req: any, @Param('id') id: string) {
    if (!req.user || !req.user.id) {
      throw new BadRequestException('Usuario no autenticado');
    }

    return this.supplierReturnsService.findOne(id);
  }
}

@Controller('suppliers')
@UseGuards(AuthGuard('jwt'))
export class SuppliersReturnsController {
  constructor(private readonly supplierReturnsService: SupplierReturnsService) {}

  @Get(':id/returns')
  async getSupplierReturns(
    @Req() req: any, 
    @Param('id') id: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ) {
    if (!req.user || !req.user.id) {
      throw new BadRequestException('Usuario no autenticado');
    }

    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    return this.supplierReturnsService.getSupplierReturnsSummary(id, start, end);
  }
}
