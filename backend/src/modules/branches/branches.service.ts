import { Injectable, NotFoundException, UnauthorizedException, OnModuleInit, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BranchesService implements OnModuleInit {
  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    // This is global, should ideally be per business, but we keep it for now
    // to ensure at least one branch exists globally if needed for legacy tests.
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
      console.log('Default global branch created');
    }
  }

  async create(data: any) {
    if (!data.businessId) {
      throw new BadRequestException('El ID del negocio es requerido para crear una sucursal');
    }
    // If setting as main, unset others for the same business
    if (data.isMain && data.businessId) {
      await this.prisma.branch.updateMany({
        where: { businessId: data.businessId },
        data: { isMain: false }
      });
    }
    return this.prisma.branch.create({ data });
  }

  async findAll(businessId: string) {
    return this.prisma.branch.findMany({
      where: { businessId }
    });
  }

  async findOne(id: string, businessId: string) {
    const branch = await this.prisma.branch.findFirst({ 
      where: { id, businessId } 
    });
    if (!branch) throw new NotFoundException('Branch not found');
    return branch;
  }

  async update(id: string, data: any, businessId: string) {
    // Security check
    await this.findOne(id, businessId);

    // If setting as main, unset others
    if (data.isMain) {
      await this.prisma.branch.updateMany({
        where: { businessId, id: { not: id } },
        data: { isMain: false }
      });
    }

    return this.prisma.branch.update({
      where: { id },
      data
    });
  }

  async setMain(id: string, businessId: string) {
    await this.findOne(id, businessId);
    
    await this.prisma.branch.updateMany({ 
      where: { businessId },
      data: { isMain: false } 
    });
    
    return this.prisma.branch.update({
      where: { id },
      data: { isMain: true }
    });
  }

  async remove(id: string, businessId: string) {
    const branch = await this.findOne(id, businessId);
    
    if (branch.isMain) {
      throw new BadRequestException('No se puede eliminar la sucursal principal');
    }

    // Check if it's the last branch for the business
    const count = await this.prisma.branch.count({ where: { businessId } });
    if (count <= 1) {
      throw new BadRequestException('No se puede eliminar la única sucursal disponible');
    }

    return this.prisma.branch.delete({ where: { id } });
  }

  async findMain(businessId: string) {
    return this.prisma.branch.findFirst({ 
      where: { businessId, isMain: true } 
    });
  }

  async wipeData(id: string, userId: string, password: string, businessId: string) {
    // Security check
    await this.findOne(id, businessId);

    const user = await this.prisma.user.findFirst({ 
      where: { id: userId, businessId } 
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const bcrypt = require('bcrypt');
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) throw new UnauthorizedException('Contraseña incorrecta');

    return this.prisma.$transaction(async (tx) => {
      // Logic for wiping data... (reusing existing logic but ensured businessId scoping where possible)
      // Since wipeData is very aggressive, we keep the existing logic but the branch check above handles the scoping.
      
      // ... (existing code from lines 72-148)
      await tx.notification.deleteMany({ where: { branchId: id } });
      await tx.expense.deleteMany({ where: { branchId: id } });
      await tx.accountingEntry.deleteMany({ where: { branchId: id } });

      const transfers = await tx.inventoryTransfer.findMany({
        where: { OR: [{ sourceBranchId: id }, { destinationBranchId: id }] }
      });
      if (transfers.length > 0) {
        const transferIds = transfers.map(t => t.id);
        await tx.inventoryTransferItem.deleteMany({ where: { transferId: { in: transferIds } } });
        await tx.inventoryTransfer.deleteMany({ where: { id: { in: transferIds } } });
      }

      await tx.inventory.deleteMany({ where: { branchId: id } });
      await tx.productWaitlist.deleteMany({ where: { branchId: id } });

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
        await tx.sale.deleteMany({ where: { branchId: id } });
      }

      await tx.shift.deleteMany({ where: { branchId: id } });
      // We don't delete global things like all users or audit logs here as it might affect other branches
      // but the user asked for a "clean" deletion. Usually "wipe" means all data for THAT branch.
      
      return { success: true, message: 'Sucursal formateada exitosamente' };
    });
  }
}
