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

    await this.prisma.shift.create({
      data: {
        userId,
        branchId,
        openingBalance: Number(openingBalance),
        status: 'OPEN' as any,
        openedAt: new Date(),
      }
    });

    return this.getActive(userId);
  }

  async close(id: string, closingBalance: number) {
    const shift = await this.prisma.shift.findUnique({ 
      where: { id },
      include: { 
        sales: { 
          include: { 
            payments: { where: { method: 'CASH' } } 
          } 
        } 
      }
    });

    if (!shift) throw new BadRequestException('Turno no encontrado');

    // Calculate expected cash: Opening + All CASH payments from all sales in this shift
    const totalCashPayments = shift.sales.reduce((total: number, sale: any) => {
      const saleCash = sale.payments.reduce((sum: number, p: any) => sum + p.amount, 0);
      return total + saleCash;
    }, 0);
    
    const expectedBalance = shift.openingBalance + totalCashPayments;
    const difference = Number(closingBalance) - expectedBalance;

    return this.prisma.shift.update({
      where: { id },
      data: {
        closingBalance: Number(closingBalance),
        expectedBalance,
        difference,
        status: 'CLOSED' as any,
        closedAt: new Date()
      }
    });
  }

  async getActive(userId: string) {
    const shift = await (this.prisma.shift as any).findFirst({
      where: { userId, status: 'OPEN' },
      include: { 
        branch: true,
        sales: {
          include: { payments: true }
        }
      }
    });

    if (!shift) return null;

    // Calculate expected totals by payment method
    const expectedTotals = {
      CASH: shift.openingBalance, // Base cash includes opening balance
      CARD: 0,
      TRANSFER: 0,
      PAGO_MOVIL: 0,
      BINANCE: 0,
      ZINLI: 0,
      PAYPAL: 0
    };

    shift.sales.forEach((sale: any) => {
      // Only count completed sales
      if (sale.status !== 'CANCELLED') {
        sale.payments.forEach((p: any) => {
          if (expectedTotals[p.method as keyof typeof expectedTotals] !== undefined) {
            expectedTotals[p.method as keyof typeof expectedTotals] += p.amount;
          }
        });
      }
    });

    // Return the shift without the huge sales array to save bandwidth, but with the calculated totals
    const { sales, ...shiftData } = shift;
    
    return {
      ...shiftData,
      expectedTotals
    };
  }

  async findAll() {
    return this.prisma.shift.findMany({
      include: { user: true, branch: true },
      orderBy: { openedAt: 'desc' }
    });
  }
}
