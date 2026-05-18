import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InvoiceStatus } from '@prisma/client';

@Injectable()
export class SuppliersAlertsService {
  constructor(private prisma: PrismaService) {}

  async getAllAlerts(businessId?: string, branchId?: string) {
    const alerts = [];

    // 1. Facturas vencidas
    const overdueInvoices = await this.getOverdueInvoices(businessId);
    alerts.push(...overdueInvoices);

    // 2. Proveedores inactivos
    const inactiveSuppliers = await this.getInactiveSuppliers(businessId);
    alerts.push(...inactiveSuppliers);

    // 3. Cambios de precio significativos
    const priceChanges = await this.getPriceChanges(businessId);
    alerts.push(...priceChanges);

    // 4. Retrasos en entregas
    const deliveryDelays = await this.getDeliveryDelays(businessId);
    alerts.push(...deliveryDelays);

    // 5. Bajo stock de productos de proveedores críticos
    const lowStockAlerts = await this.getLowStockAlerts(businessId, branchId);
    alerts.push(...lowStockAlerts);

    // 6. Proveedores con alto índice de devoluciones
    const highReturnRate = await this.getHighReturnRateSuppliers(businessId);
    alerts.push(...highReturnRate);

    return alerts.sort((a, b) => {
      const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  private async getOverdueInvoices(businessId?: string) {
    const where: any = {
      status: { in: [InvoiceStatus.PENDING, InvoiceStatus.PARTIAL] },
      dueDate: { lt: new Date() }
    };
    if (businessId) {
      where.supplier = {
        OR: [{ businessId: null }, { businessId }]
      };
    }
    const overdueInvoices = await this.prisma.supplierInvoice.findMany({
      where,
      include: {
        supplier: true
      }
    });

    return overdueInvoices.map((invoice: any) => ({
      id: `overdue-${invoice.id}`,
      type: 'overdue_invoice',
      priority: invoice.dueDate < new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) ? 'critical' : 'high',
      title: `Factura vencida - ${invoice.supplier.name}`,
      message: `Factura $${invoice.total.toFixed(2)} vencida hace ${Math.floor((Date.now() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24))} días`,
      supplierId: invoice.supplierId,
      supplierName: invoice.supplier.name,
      amount: invoice.total,
      dueDate: invoice.dueDate,
      createdAt: invoice.createdAt
    }));
  }

  private async getInactiveSuppliers(businessId?: string) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const where: any = {
      status: 'ACTIVE',
      purchaseOrders: {
        none: {
          createdAt: { gte: thirtyDaysAgo }
        }
      }
    };
    if (businessId) {
      where.OR = [{ businessId: null }, { businessId }];
    }
    
    const inactiveSuppliers = await this.prisma.supplier.findMany({
      where,
      include: {
        purchaseOrders: {
          where: {
            createdAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) }
          },
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    return inactiveSuppliers.map((supplier: any) => {
      const lastOrder = supplier.purchaseOrders[0];
      const daysSinceLastOrder = lastOrder 
        ? Math.floor((Date.now() - lastOrder.createdAt.getTime()) / (1000 * 60 * 60 * 24))
        : 90;

      return {
        id: `inactive-${supplier.id}`,
        type: 'inactive_supplier',
        priority: daysSinceLastOrder > 60 ? 'high' : 'medium',
        title: `Proveedor inactivo - ${supplier.name}`,
        message: `Sin actividad desde hace ${daysSinceLastOrder} días`,
        supplierId: supplier.id,
        supplierName: supplier.name,
        lastOrderDate: lastOrder?.createdAt || null,
        daysSinceLastOrder
      };
    });
  }

  private async getPriceChanges(businessId?: string) {
    const where: any = {};
    if (businessId) {
      where.supplier = {
        OR: [{ businessId: null }, { businessId }]
      };
    }
    const supplierProducts = await this.prisma.supplierProduct.findMany({
      where,
      include: {
        variant: true,
        supplier: true
      }
    });

    const priceChanges = supplierProducts
      .filter((sp: any) => {
        if (!sp.variant) return false;
        const currentCost = sp.variant.cost || 0;
        const supplierPrice = sp.purchasePrice;
        const variation = currentCost > 0 ? Math.abs(((currentCost - supplierPrice) / supplierPrice) * 100) : 0;
        return variation > 20; // Más del 20% de variación
      })
      .map((sp: any) => {
        // We know sp.variant exists because of the filter
        const variant = sp.variant!;
        const currentCost = variant.cost || 0;
        const supplierPrice = sp.purchasePrice;
        const variation = ((currentCost - supplierPrice) / supplierPrice) * 100;
        
        return {
          id: `price-change-${sp.id}`,
          type: 'price_change',
          priority: Math.abs(variation) > 50 ? 'critical' : 'high',
          title: `Cambio de precio - ${sp.supplier.name}`,
          message: `${variant.name}: ${variation > 0 ? 'Aumento' : 'Disminución'} del ${Math.abs(variation).toFixed(1)}%`,
          supplierId: sp.supplierId,
          supplierName: sp.supplier.name,
          productId: sp.productId,
          productName: variant.name,
          supplierPrice,
          currentCost,
          variationPercentage: variation
        };
      });

    return priceChanges;
  }

  private async getDeliveryDelays(businessId?: string) {
    const where: any = {
      status: 'SENT',
      createdAt: { lt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) } // Más de 14 días enviada
    };
    if (businessId) {
      where.supplier = {
        OR: [{ businessId: null }, { businessId }]
      };
    }
    const delayedOrders = await this.prisma.purchaseOrder.findMany({
      where,
      include: {
        supplier: true
      }
    });

    return delayedOrders.map((order: any) => {
      const daysDelayed = Math.floor((Date.now() - order.createdAt.getTime()) / (1000 * 60 * 60 * 24));
      
      return {
        id: `delay-${order.id}`,
        type: 'delivery_delay',
        priority: daysDelayed > 21 ? 'critical' : 'high',
        title: `Retraso en entrega - ${order.supplier.name}`,
        message: `Orden #${order.id.substring(0, 8)} retrasada ${daysDelayed} días`,
        supplierId: order.supplierId,
        supplierName: order.supplier.name,
        orderId: order.id,
        daysDelayed,
        orderTotal: order.total
      };
    });
  }

  private async getLowStockAlerts(businessId?: string, branchId?: string) {
    const where: any = {};
    if (branchId) where.branchId = branchId;
    if (businessId) {
      where.variant = {
        product: {
          businessId,
          supplierId: { not: null }
        }
      };
    } else {
      where.variant = {
        product: {
          supplierId: { not: null }
        }
      };
    }
    where.quantity = { lt: 5 }; // Menos de 5 unidades
    
    const lowStockItems = await this.prisma.inventory.findMany({
      where,
      include: {
        variant: {
          include: {
            product: {
              include: {
                supplier: true
              }
            }
          }
        },
        branch: true
      }
    });

    return lowStockItems.map((item: any) => ({
      id: `low-stock-${item.id}`,
      type: 'low_stock',
      priority: item.quantity === 0 ? 'critical' : 'medium',
      title: `Stock bajo - ${item.variant.product.name}`,
      message: `${item.variant.name}: ${item.quantity} unidades en ${item.branch.name}`,
      supplierId: item.variant.product.supplierId!,
      supplierName: item.variant.product.supplier?.name || 'Sin proveedor',
      productId: item.variant.productId,
      productName: item.variant.product.name,
      variantName: item.variant.name,
      currentStock: item.quantity,
      branchId: item.branchId,
      branchName: item.branch.name
    }));
  }

  private async getHighReturnRateSuppliers(businessId?: string) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const where: any = { status: 'ACTIVE' };
    if (businessId) {
      where.OR = [{ businessId: null }, { businessId }];
    }
    
    const suppliers = await this.prisma.supplier.findMany({
      where,
      include: {
        purchaseOrders: {
          where: { createdAt: { gte: thirtyDaysAgo } }
        },
        supplierReturns: {
          where: { createdAt: { gte: thirtyDaysAgo } }
        }
      }
    });

    const highReturnSuppliers = suppliers
      .filter((supplier: any) => {
        const totalOrders = supplier.purchaseOrders.length;
        const totalReturns = supplier.supplierReturns.length;
        
        if (totalOrders === 0) return false;
        
        const returnRate = (totalReturns / totalOrders) * 100;
        return returnRate > 10; // Más del 10% de tasa de devolución
      })
      .map((supplier: any) => {
        const totalOrders = supplier.purchaseOrders.length;
        const totalReturns = supplier.supplierReturns.length;
        const returnRate = (totalReturns / totalOrders) * 100;
        
        return {
          id: `high-return-${supplier.id}`,
          type: 'high_return_rate',
          priority: returnRate > 20 ? 'critical' : 'high',
          title: `Alta tasa de devolución - ${supplier.name}`,
          message: `${totalReturns} devoluciones de ${totalOrders} órdenes (${returnRate.toFixed(1)}%)`,
          supplierId: supplier.id,
          supplierName: supplier.name,
          totalOrders,
          totalReturns,
          returnRate
        };
      });

    return highReturnSuppliers;
  }

  async getAlertsSummary(businessId?: string) {
    const alerts = await this.getAllAlerts(businessId);
    
    const summary = {
      total: alerts.length,
      critical: alerts.filter(a => a.priority === 'critical').length,
      high: alerts.filter(a => a.priority === 'high').length,
      medium: alerts.filter(a => a.priority === 'medium').length,
      low: alerts.filter(a => a.priority === 'low').length,
      byType: alerts.reduce((acc, alert) => {
        acc[alert.type] = (acc[alert.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    };

    return { summary, alerts };
  }
}
