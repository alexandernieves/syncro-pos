import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ClientsService {
  constructor(private prisma: PrismaService) {}

  async create(data: any) {
    return this.prisma.client.create({ data });
  }

  async findAll(businessId?: string) {
    const where: any = {};
    if (businessId) {
      where.businessId = businessId;
    }
    return this.prisma.client.findMany({
      where,
      include: { 
        sales: true,
        creditTransactions: {
          orderBy: { createdAt: 'desc' },
          take: 5
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async searchByDocument(q: string, businessId?: string) {
    const where: any = {
      OR: [
        { documentId: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
      ]
    };
    if (businessId) {
      where.businessId = businessId;
    }
    return this.prisma.client.findMany({
      where,
      take: 10,
    });
  }

  async findOne(id: string, businessId?: string) {
    const where: any = { id };
    if (businessId) {
      where.businessId = businessId;
    }
    const client = await this.prisma.client.findFirst({
      where,
      include: { 
        sales: true,
        creditTransactions: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });
    if (!client) throw new NotFoundException('Cliente no encontrado');
    return client;
  }

  async update(id: string, data: any, businessId?: string) {
    await this.findOne(id, businessId);
    return this.prisma.client.update({
      where: { id },
      data
    });
  }

  async registerPayment(clientId: string, data: { amount: number; notes?: string }, businessId?: string) {
    await this.findOne(clientId, businessId);
    return this.prisma.$transaction(async (tx) => {
      const client = await tx.client.findUnique({ where: { id: clientId } });
      if (!client) throw new NotFoundException("Cliente no encontrado");

      const now = new Date();
      const isLate = client.nextPaymentDate && now > client.nextPaymentDate;
      
      // 1. Calculate Score Update
      let scoreChange = isLate ? -10 : 5;
      let newScore = Math.min(100, Math.max(0, client.creditScore + scoreChange));

      // 2. Automatic Incentives (Credit Policy)
      let newDownPayment = client.downPaymentPercentage;
      let newLimit = client.creditLimit;

      if (newScore >= 95) {
        newDownPayment = 20; // Super VIP
        newLimit = client.creditLimit * 1.10; // 10% increase
      } else if (newScore >= 85) {
        newDownPayment = 30;
        newLimit = client.creditLimit * 1.05; // 5% increase
      } else if (newScore >= 70) {
        newDownPayment = 40;
      } else if (newScore < 50) {
        newDownPayment = 50; // Return to standard
      }

      // 3. Update Client
      const updatedClient = await tx.client.update({
        where: { id: clientId },
        data: { 
          currentDebt: { decrement: data.amount },
          creditScore: newScore,
          downPaymentPercentage: newDownPayment,
          creditLimit: newLimit,
          totalPaymentsCount: { increment: 1 },
          latePaymentsCount: isLate ? { increment: 1 } : undefined,
          lastPaymentDate: now,
          nextPaymentDate: client.currentDebt - data.amount <= 0.01 ? null : client.nextPaymentDate
        }
      });

      // 4. Create Transaction record
      await tx.creditTransaction.create({
        data: {
          clientId,
          amount: -data.amount,
          type: 'PAYMENT',
          notes: data.notes || (isLate ? 'Abono realizado con retraso' : 'Abono realizado a tiempo')
        }
      });

      return updatedClient;
    });
  }

  async remove(id: string, businessId?: string) {
    await this.findOne(id, businessId);
    return this.prisma.client.delete({ where: { id } });
  }
}
