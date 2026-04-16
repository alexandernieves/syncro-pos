import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ShiftsService {
  constructor(private prisma: PrismaService) {}

  async open(data: any) {
    const { userId, branchId, openingBalance } = data;
    
    // Check if there is already an open shift for this user/branch
    const activeShift = await this.prisma.shift.findFirst({
      where: { userId, branchId, status: 'OPEN' as any }
    });

    if (activeShift) {
      throw new BadRequestException('Ya existe un turno abierto para esta sucursal.');
    }

    return this.prisma.shift.create({
      data: {
        userId,
        branchId,
        openingBalance: Number(openingBalance),
        status: 'OPEN' as any,
        openedAt: new Date(),
      }
    });
  }

  async close(id: string, closingBalance: number) {
    return this.prisma.shift.update({
      where: { id },
      data: {
        closingBalance: Number(closingBalance),
        status: 'CLOSED' as any,
        closedAt: new Date()
      }
    });
  }

  async getActive(userId: string) {
    return (this.prisma.shift as any).findFirst({
      where: { userId, status: 'OPEN' },
      include: { branch: true }
    });
  }

  async findAll() {
    return this.prisma.shift.findMany({
      include: { user: true, branch: true },
      orderBy: { openedAt: 'desc' }
    });
  }
}
