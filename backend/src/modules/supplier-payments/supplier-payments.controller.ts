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
import { SupplierPaymentsService } from './supplier-payments.service';
import { AuthGuard } from '@nestjs/passport';
import { PaymentMethod } from '@prisma/client';
import { assertOwned, ownedBy } from '../../common/ownership';
import { PrismaService } from '../prisma/prisma.service';

@Controller('supplier-payments')
@UseGuards(AuthGuard('jwt'))
export class SupplierPaymentsController {
  constructor(
    private readonly supplierPaymentsService: SupplierPaymentsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  async findAll(@Req() req: any, @Query('supplierId') supplierId?: string) {
    if (!req.user || !req.user.id) {
      throw new BadRequestException('Usuario no autenticado');
    }

    return this.supplierPaymentsService.findAll(supplierId, ownedBy('supplierPayment', req.user));
  }

  @Get(':id')
  async findOne(@Req() req: any, @Param('id') id: string) {
    if (!req.user || !req.user.id) {
      throw new BadRequestException('Usuario no autenticado');
    }

    await assertOwned(this.prisma, 'supplierPayment', id, req.user);
    return this.supplierPaymentsService.findOne(id);
  }

  @Post()
  async create(@Req() req: any, @Body() createData: {
    supplierId: string;
    amount: number;
    method: PaymentMethod;
    reference?: string;
    invoiceIds?: string[];
  }) {
    if (!req.user || !req.user.id) {
      throw new BadRequestException('Usuario no autenticado');
    }

    if (!createData.supplierId || !createData.amount || !createData.method) {
      throw new BadRequestException('Datos incompletos para crear el pago');
    }

    if (createData.amount <= 0) {
      throw new BadRequestException('El monto debe ser mayor a cero');
    }

    if (!Object.values(PaymentMethod).includes(createData.method)) {
      throw new BadRequestException('Método de pago inválido');
    }

    return this.supplierPaymentsService.createPayment({ ...createData, userId: req.user.id });
  }
}

@Controller('suppliers')
@UseGuards(AuthGuard('jwt'))
export class SuppliersAccountController {
  constructor(
    private readonly supplierPaymentsService: SupplierPaymentsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get(':id/account')
  async getAccount(@Req() req: any, @Param('id') id: string) {
    if (!req.user || !req.user.id) {
      throw new BadRequestException('Usuario no autenticado');
    }

    await assertOwned(this.prisma, 'supplier', id, req.user);
    return this.supplierPaymentsService.getSupplierAccount(id);
  }
}
