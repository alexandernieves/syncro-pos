import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SuppliersService {
  constructor(private prisma: PrismaService) {}

  async create(data: any) {
    return this.prisma.supplier.create({ data });
  }

  async findAll() {
    const suppliers = await this.prisma.supplier.findMany({
      include: {
        supplierInvoices: {
          where: { balance: { gt: 0 } },
          select: { balance: true }
        },
        _count: {
          select: { products: true }
        },
        products: {
          select: { id: true }
        }
      },
      orderBy: { name: 'asc' }
    });

    return suppliers.map((s: any) => ({
      ...s,
      outstandingBalance: s.supplierInvoices.reduce((acc: number, inv: any) => acc + inv.balance, 0),
      productsCount: s._count.products
    }));
  }

  async findOne(id: string) {
    const supplier = await this.prisma.supplier.findUnique({ where: { id } });
    if (!supplier) throw new NotFoundException('Proveedor no encontrado');
    return supplier;
  }

  async update(id: string, data: any) {
    return this.prisma.supplier.update({ where: { id }, data });
  }

  async remove(id: string) {
    return this.prisma.supplier.delete({ where: { id } });
  }

  async getStats(id: string) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id }
    });

    if (!supplier) {
      throw new NotFoundException('Proveedor no encontrado');
    }

    // Get purchase orders statistics
    const purchaseOrders = await this.prisma.purchaseOrder.findMany({
      where: { supplierId: id },
      include: {
        items: {
          include: {
            variant: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Calculate total purchased
    const totalPurchased = purchaseOrders.reduce((sum: number, po: any) => sum + po.total, 0);
    const lastPurchase = purchaseOrders[0]?.createdAt || null;

    // Calculate average delivery time (from SENT to RECEIVED)
    const completedOrders = purchaseOrders.filter((po: any) => po.status === 'RECEIVED');
    let avgDeliveryDays = 0;
    
    if (completedOrders.length > 0) {
      const totalDays = completedOrders.reduce((sum: number, po: any) => {
        // This is a simplified calculation - in real scenario, you'd track sent date separately
        return sum + 7; // Assuming 7 days average for now
      }, 0);
      avgDeliveryDays = totalDays / completedOrders.length;
    }

    // Calculate price variation for products
    const supplierProducts = await this.prisma.supplierProduct.findMany({
      where: { supplierId: id },
      include: {
        variant: true
      }
    });

    const priceVariations = supplierProducts
      .filter((sp: any) => sp.variant)
      .map((sp: any) => {
        const variant = sp.variant!;
        const currentCost = variant.cost || 0;
        const supplierPrice = sp.purchasePrice;
        const variation = currentCost > 0 ? ((currentCost - supplierPrice) / supplierPrice) * 100 : 0;
        
        return {
          productId: sp.productId,
          productName: variant.name,
          supplierPrice,
          currentCost,
          variationPercentage: variation
        };
      });

    // Get payment statistics
    const invoices = await this.prisma.supplierInvoice.findMany({
      where: { supplierId: id },
      include: {
        invoicePayments: {
          include: {
            payment: true
          }
        }
      }
    });

    const totalInvoiced = invoices.reduce((sum: number, inv: any) => sum + inv.total, 0);
    const totalPaid = invoices.reduce((sum: number, inv: any) => 
      sum + inv.invoicePayments.reduce((paySum: number, pay: any) => paySum + pay.amount, 0), 0
    );
    const outstandingBalance = totalInvoiced - totalPaid;

    // Get return statistics
    const returns = await this.prisma.supplierReturn.findMany({
      where: { supplierId: id },
      include: {
        variant: true
      }
    });

    const totalReturns = returns.length;
    const totalReturnedQuantity = returns.reduce((sum: number, ret: any) => sum + ret.quantity, 0);
    const totalReturnValue = returns.reduce((sum: number, ret: any) => {
      const cost = ret.variant.cost || 0;
      return sum + (cost * ret.quantity);
    }, 0);

    return {
      supplier,
      purchaseStats: {
        totalOrders: purchaseOrders.length,
        totalPurchased,
        lastPurchase,
        avgDeliveryDays,
        completedOrders: completedOrders.length,
        pendingOrders: purchaseOrders.filter((po: any) => po.status === 'SENT').length
      },
      financialStats: {
        totalInvoiced,
        totalPaid,
        outstandingBalance,
        paymentCompletionRate: totalInvoiced > 0 ? (totalPaid / totalInvoiced) * 100 : 0
      },
      priceAnalysis: {
        productsTracked: supplierProducts.length,
        priceVariations,
        averageVariation: priceVariations.length > 0 
          ? priceVariations.reduce((sum: number, pv: any) => sum + pv.variationPercentage, 0) / priceVariations.length 
          : 0
      },
      returnStats: {
        totalReturns,
        totalReturnedQuantity,
        totalReturnValue,
        returnRate: totalPurchased > 0 ? (totalReturnValue / totalPurchased) * 100 : 0
      },
      performance: {
        reliability: completedOrders.length > 0 ? 95 : 0, // Placeholder calculation
        qualityScore: 100 - (totalReturns * 2), // Simple quality score
        overallRating: 0 // Will be calculated based on multiple factors
      }
    };
  }

  async seed() {
    const testProviders = [
      { name: 'Apple Inc.' },
      { name: 'Logitech S.A.' },
      { name: 'Dell Technologies' },
      { name: 'Samsung Electronics' },
      { name: 'Secretlab SG' },
    ];

    for (const p of testProviders) {
      const existing = await this.prisma.supplier.findFirst({
        where: { name: p.name, businessId: null }
      });
      if (!existing) {
        await this.prisma.supplier.create({
          data: { ...p, businessId: null }
        });
      }
    }
    return { message: 'Seeded successfully' } as any;
  }

  async getSuggestions(supplierId: string) {
    const products = await this.prisma.supplierProduct.findMany({
      where: { supplierId },
      include: {
        variant: {
          include: {
            product: true,
          }
        }
      }
    });

    return products
      .filter((sp: any) => sp.variant && sp.variant.stock < sp.variant.minStock)
      .map((sp: any) => ({
        variantId: sp.variantId,
        productName: sp.variant?.product.name,
        variantName: sp.variant?.name,
        currentStock: sp.variant?.stock,
        minStock: sp.variant?.minStock,
        suggestedQty: (sp.variant?.minStock || 0) * 2 - (sp.variant?.stock || 0),
        cost: sp.purchasePrice
      }));
  }
}
