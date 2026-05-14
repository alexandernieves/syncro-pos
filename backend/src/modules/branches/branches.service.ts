import { Injectable, NotFoundException, UnauthorizedException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BranchesService implements OnModuleInit {
  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    const count = await this.prisma.branch.count();
    if (count === 0) {
      await this.prisma.branch.create({
        data: {
          name: 'Sucursal Principal',
          location: 'Sede Central',
          isMain: true,
          country: 'Venezuela',
          state: 'Distrito Capital',
        }
      });
      console.log('Default branch created');
    }
  }

  async create(data: any) {
    return this.prisma.branch.create({ data });
  }

  async findAll() {
    return this.prisma.branch.findMany();
  }

  async findOne(id: string) {
    const branch = await this.prisma.branch.findUnique({ where: { id } });
    if (!branch) throw new NotFoundException('Branch not found');
    return branch;
  }

  async update(id: string, data: any) {
    return this.prisma.branch.update({
      where: { id },
      data
    });
  }

  async setMain(id: string) {
    await this.prisma.branch.updateMany({ data: { isMain: false } });
    return this.prisma.branch.update({
      where: { id },
      data: { isMain: true }
    });
  }

  async remove(id: string) {
    const branch = await this.findOne(id);
    if (branch.isMain) throw new Error('No se puede eliminar la sucursal principal');
    return this.prisma.branch.delete({ where: { id } });
  }

  async findMain() {
    return this.prisma.branch.findFirst({ where: { isMain: true } });
  }

  async wipeData(id: string, userId: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const bcrypt = require('bcrypt');
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) throw new UnauthorizedException('Contraseña incorrecta');

    return this.prisma.$transaction(async (tx) => {
      // 1. Notificaciones
      await tx.notification.deleteMany({ where: { branchId: id } });
      
      // 2. Gastos
      await tx.expense.deleteMany({ where: { branchId: id } });
      
      // 3. Entradas contables sueltas (por sucursal directa)
      await tx.accountingEntry.deleteMany({ where: { branchId: id } });

      // 4. Movimientos y Transferencias
      await tx.inventoryMovement.deleteMany({ where: { branchId: id } });
      const transfers = await tx.inventoryTransfer.findMany({
        where: { OR: [{ sourceBranchId: id }, { destinationBranchId: id }] }
      });
      if (transfers.length > 0) {
        const transferIds = transfers.map(t => t.id);
        await tx.inventoryTransferItem.deleteMany({ where: { transferId: { in: transferIds } } });
        await tx.inventoryTransfer.deleteMany({ where: { id: { in: transferIds } } });
      }

      // 5. Inventario de la sucursal y Lista de Espera
      await tx.inventory.deleteMany({ where: { branchId: id } });
      await tx.productWaitlist.deleteMany({ where: { branchId: id } });

      // 6. Órdenes de Compra y sus Facturas
      const pos = await tx.purchaseOrder.findMany({ where: { branchId: id } });
      if (pos.length > 0) {
        const poIds = pos.map(p => p.id);
        const invoices = await tx.supplierInvoice.findMany({ where: { purchaseOrderId: { in: poIds } } });
        if (invoices.length > 0) {
          const invoiceIds = invoices.map(i => i.id);
          await tx.supplierInvoicePayment.deleteMany({ where: { supplierInvoiceId: { in: invoiceIds } } });
          await tx.supplierInvoice.deleteMany({ where: { id: { in: invoiceIds } } });
        }
        await tx.purchaseOrder.deleteMany({ where: { branchId: id } });
      }

      // 7. Ventas y Devoluciones
      const sales = await tx.sale.findMany({ where: { branchId: id } });
      if (sales.length > 0) {
        const saleIds = sales.map(s => s.id);
        
        const returns = await tx.saleReturn.findMany({ where: { saleId: { in: saleIds } } });
        if (returns.length > 0) {
          const returnIds = returns.map(r => r.id);
          await tx.saleReturnItem.deleteMany({ where: { returnId: { in: returnIds } } });
          await tx.saleReturn.deleteMany({ where: { id: { in: returnIds } } });
        }
        
        await tx.accountingEntry.deleteMany({ where: { saleId: { in: saleIds } } });
        await tx.creditTransaction.deleteMany({ where: { saleId: { in: saleIds } } });
        
        // Los items y payments se borran en cascada por el esquema Prisma (onDelete: Cascade)
        await tx.sale.deleteMany({ where: { branchId: id } });
      }

      // 8. Turnos (Shifts)
      await tx.shift.deleteMany({ where: { branchId: id } });

      // 9. Historial / Auditoría
      await tx.auditLog.deleteMany({});

      // 10. Clientes y Créditos
      await tx.sale.updateMany({ data: { clientId: null } });
      await tx.creditTransaction.deleteMany({});
      await tx.client.deleteMany({});

      // 11. Proveedores y sus dependencias (Órdenes, Facturas, Pagos, Devoluciones)
      await tx.product.updateMany({ data: { supplierId: null } });
      await tx.supplierProduct.deleteMany({});
      await tx.supplierReturn.deleteMany({});
      await tx.supplierInvoicePayment.deleteMany({});
      await tx.supplierPayment.deleteMany({});
      await tx.supplierInvoice.deleteMany({});
      await tx.purchaseOrderItem.deleteMany({});
      await tx.purchaseOrder.deleteMany({});
      await tx.supplier.deleteMany({});

      return { success: true, message: 'Sucursal formateada exitosamente' };
    });
  }
}

