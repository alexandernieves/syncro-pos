import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InvoiceStatus, PaymentMethod } from '@prisma/client';

@Injectable()
export class SupplierPaymentsService {
  constructor(private prisma: PrismaService) {}

  async getSupplierAccount(supplierId: string) {
    // Validate supplier exists
    const supplier = await this.prisma.supplier.findUnique({
      where: { id: supplierId }
    });

    if (!supplier) {
      throw new NotFoundException('Proveedor no encontrado');
    }

    // Get all invoices
    const invoices = await this.prisma.supplierInvoice.findMany({
      where: { supplierId },
      include: {
        purchaseOrder: {
          include: {
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
        },
        invoicePayments: {
          include: {
            payment: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Get all payments
    const payments = await this.prisma.supplierPayment.findMany({
      where: { supplierId },
      include: {
        invoicePayments: {
          include: {
            invoice: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Calculate totals
    const totalInvoiced = invoices.reduce((sum, inv) => sum + inv.total, 0);
    const totalPaid = payments.reduce((sum, pay) => sum + pay.amount, 0);
    const totalBalance = totalInvoiced - totalPaid;

    // Separate pending invoices
    const pendingInvoices = invoices.filter(inv => inv.status !== InvoiceStatus.PAID);
    const overdueInvoices = pendingInvoices.filter(inv => 
      inv.status !== InvoiceStatus.PAID && new Date(inv.dueDate) < new Date()
    );

    return {
      supplier,
      summary: {
        totalInvoiced,
        totalPaid,
        totalBalance,
        pendingInvoicesCount: pendingInvoices.length,
        overdueInvoicesCount: overdueInvoices.length
      },
      invoices,
      payments,
      pendingInvoices,
      overdueInvoices
    };
  }

  async createPayment(data: {
    supplierId: string;
    amount: number;
    method: PaymentMethod;
    reference?: string;
    invoiceIds?: string[];
    userId: string;
  }) {
    const { supplierId, amount, method, reference, invoiceIds, userId } = data;

    // Validate supplier exists
    const supplier = await this.prisma.supplier.findUnique({
      where: { id: supplierId }
    });

    if (!supplier) {
      throw new NotFoundException('Proveedor no encontrado');
    }

    // Get supplier's pending invoices if specific invoices not provided
    let targetInvoices;
    if (invoiceIds && invoiceIds.length > 0) {
      targetInvoices = await this.prisma.supplierInvoice.findMany({
        where: {
          id: { in: invoiceIds },
          supplierId,
          status: { in: [InvoiceStatus.PENDING, InvoiceStatus.PARTIAL] }
        }
      });
    } else {
      targetInvoices = await this.prisma.supplierInvoice.findMany({
        where: {
          supplierId,
          status: { in: [InvoiceStatus.PENDING, InvoiceStatus.PARTIAL] }
        },
        orderBy: {
          dueDate: 'asc'
        }
      });
    }

    if (targetInvoices.length === 0) {
      throw new BadRequestException('No hay facturas pendientes para este proveedor');
    }

    // Process payment (transaction)
    const result = await this.prisma.$transaction(async (tx) => {
      // Create payment
      const payment = await tx.supplierPayment.create({
        data: {
          supplierId,
          amount,
          method,
          reference
        }
      });

      // Create accounting entry for expense
      await tx.accountingEntry.create({
        data: {
          description: `Pago a proveedor - ${supplier.name} (Ref: ${reference || 'S/N'})`,
          type: 'EXPENSE',
          amount,
          category: 'PAGO_PROVEEDOR',
          userId
        }
      });

      let remainingAmount = amount;
      const paymentAllocations = [];

      // Allocate payment to invoices (FIFO - oldest due dates first)
      for (const invoice of targetInvoices) {
        if (remainingAmount <= 0) break;

        const allocationAmount = Math.min(remainingAmount, invoice.balance);
        
        // Create invoice-payment relationship
        await tx.supplierInvoicePayment.create({
          data: {
            supplierInvoiceId: invoice.id,
            supplierPaymentId: payment.id,
            amount: allocationAmount
          }
        });

        // Update invoice balance and status
        const newBalance = invoice.balance - allocationAmount;
        let newStatus = invoice.status;

        if (newBalance <= 0) {
          newStatus = InvoiceStatus.PAID;
        } else if (invoice.status === InvoiceStatus.PENDING) {
          newStatus = InvoiceStatus.PARTIAL;
        }

        await tx.supplierInvoice.update({
          where: { id: invoice.id },
          data: {
            balance: Math.max(0, newBalance),
            status: newStatus
          }
        });

        paymentAllocations.push({
          invoiceId: invoice.id,
          allocationAmount,
          remainingBalance: Math.max(0, newBalance)
        });

        remainingAmount -= allocationAmount;
      }

      return {
        payment,
        allocations: paymentAllocations,
        remainingAmount
      };
    });

    return result;
  }

  async findAll(supplierId?: string) {
    const where = supplierId ? { supplierId } : {};
    
    return this.prisma.supplierPayment.findMany({
      where,
      include: {
        supplier: true,
        invoicePayments: {
          include: {
            invoice: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }

  async findOne(id: string) {
    const payment = await this.prisma.supplierPayment.findUnique({
      where: { id },
      include: {
        supplier: true,
        invoicePayments: {
          include: {
            invoice: {
              include: {
                purchaseOrder: true
              }
            }
          }
        }
      }
    });

    if (!payment) {
      throw new NotFoundException('Pago no encontrado');
    }

    return payment;
  }
}
