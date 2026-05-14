import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ClientsService {
  constructor(private prisma: PrismaService) {}

  async create(data: any) {
    return this.prisma.client.create({ data });
  }

  async findAll() {
    return this.prisma.client.findMany({
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

  async searchByDocument(q: string) {
    return this.prisma.client.findMany({
      where: {
        OR: [
          { documentId: { contains: q, mode: 'insensitive' } },
          { name: { contains: q, mode: 'insensitive' } },
        ]
      },
      take: 10,
    });
  }

  async findOne(id: string) {
    return this.prisma.client.findUnique({
      where: { id },
      include: { 
        sales: true,
        creditTransactions: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });
  }

  async update(id: string, data: any) {
    return this.prisma.client.update({
      where: { id },
      data
    });
  }

  async registerPayment(clientId: string, data: { amount: number; notes?: string }) {
    return this.prisma.$transaction(async (tx) => {
      const client = await tx.client.findUnique({ where: { id: clientId } });
      if (!client) throw new Error("Cliente no encontrado");

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
          // If debt is fully paid, we could clear nextPaymentDate or just extend it
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

  async remove(id: string) {
    return this.prisma.client.delete({ where: { id } });
  }
}
