import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TransfersService {
  constructor(private prisma: PrismaService) {}

  async findAll(branchId?: string) {
    return this.prisma.inventoryTransfer.findMany({
      where: branchId ? {
        OR: [
          { sourceBranchId: branchId },
          { destinationBranchId: branchId }
        ]
      } : {},
      include: {
        sourceBranch: true,
        destinationBranch: true,
        user: { select: { name: true, email: true } },
        items: {
          include: {
            variant: {
              include: {
                product: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findOne(id: string) {
    const transfer = await this.prisma.inventoryTransfer.findUnique({
      where: { id },
      include: {
        sourceBranch: true,
        destinationBranch: true,
        user: { select: { name: true, email: true } },
        items: {
          include: {
            variant: {
              include: {
                product: true
              }
            }
          }
        }
      }
    });

    if (!transfer) throw new NotFoundException('Transferencia no encontrada');
    return transfer;
  }

  async create(data: {
    sourceBranchId: string;
    destinationBranchId: string;
    userId: string;
    notes?: string;
    items: { variantId: string; quantity: number }[];
  }) {
    if (data.sourceBranchId === data.destinationBranchId) {
      throw new BadRequestException('La sucursal de origen y destino no pueden ser la misma');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Create the transfer record
      const transfer = await tx.inventoryTransfer.create({
        data: {
          sourceBranchId: data.sourceBranchId,
          destinationBranchId: data.destinationBranchId,
          userId: data.userId,
          notes: data.notes,
          status: 'PENDING',
          items: {
            create: data.items.map(item => ({
              variantId: item.variantId,
              quantity: item.quantity
            }))
          }
        },
        include: { items: true }
      });

      // 2. Subtract from source branch immediately (Mark as 'In Transit')
      for (const item of data.items) {
        // Check current stock in source
        const sourceInv = await tx.inventory.findUnique({
          where: {
            variantId_branchId: {
              variantId: item.variantId,
              branchId: data.sourceBranchId
            }
          }
        });

        if (!sourceInv || sourceInv.quantity < item.quantity) {
          const variant = await tx.productVariant.findUnique({
            where: { id: item.variantId },
            include: { product: true }
          });
          const name = variant ? `${variant.product.name} (${variant.name !== 'Default' ? variant.name : 'Único'})` : item.variantId;
          throw new BadRequestException(`Stock insuficiente para "${name}". Disponible: ${sourceInv?.quantity || 0}, Solicitado: ${item.quantity}`);
        }

        // Subtract stock
        await tx.inventory.update({
          where: { id: sourceInv.id },
          data: { quantity: { decrement: item.quantity } }
        });

        // Create movement record for source
        await tx.inventoryMovement.create({
          data: {
            variantId: item.variantId,
            branchId: data.sourceBranchId,
            type: 'OUT',
            quantity: item.quantity,
            reason: 'Transferencia (Salida)',
            referenceId: transfer.id
          }
        });
      }

      return transfer;
    });
  }

  async complete(id: string) {
    const transfer = await this.findOne(id);
    if (transfer.status !== 'PENDING') {
      throw new BadRequestException('Solo se pueden completar transferencias pendientes');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Update status
      await tx.inventoryTransfer.update({
        where: { id },
        data: { status: 'COMPLETED' }
      });

      // 2. Add to destination branch
      for (const item of transfer.items) {
        // Check if inventory record exists for destination
        const destInv = await tx.inventory.findUnique({
          where: {
            variantId_branchId: {
              variantId: item.variantId,
              branchId: transfer.destinationBranchId
            }
          }
        });

        if (destInv) {
          await tx.inventory.update({
            where: { id: destInv.id },
            data: { quantity: { increment: item.quantity } }
          });
        } else {
          await tx.inventory.create({
            data: {
              variantId: item.variantId,
              branchId: transfer.destinationBranchId,
              quantity: item.quantity
            }
          });
        }

        // Create movement record for destination
        await tx.inventoryMovement.create({
          data: {
            variantId: item.variantId,
            branchId: transfer.destinationBranchId,
            type: 'IN',
            quantity: item.quantity,
            reason: 'Transferencia (Entrada)',
            referenceId: transfer.id
          }
        });
      }

      return { message: 'Transferencia completada con éxito' };
    });
  }

  async cancel(id: string) {
    const transfer = await this.findOne(id);
    if (transfer.status !== 'PENDING') {
      throw new BadRequestException('Solo se pueden cancelar transferencias pendientes');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Update status
      await tx.inventoryTransfer.update({
        where: { id },
        data: { status: 'CANCELLED' }
      });

      // 2. Return stock to source branch
      for (const item of transfer.items) {
        await tx.inventory.update({
          where: {
            variantId_branchId: {
              variantId: item.variantId,
              branchId: transfer.sourceBranchId
            }
          },
          data: { quantity: { increment: item.quantity } }
        });

        // Create adjustment movement
        await tx.inventoryMovement.create({
          data: {
            variantId: item.variantId,
            branchId: transfer.sourceBranchId,
            type: 'IN',
            quantity: item.quantity,
            reason: 'Transferencia Cancelada (Retorno)',
            referenceId: transfer.id
          }
        });
      }

      return { message: 'Transferencia cancelada y stock devuelto' };
    });
  }
}
