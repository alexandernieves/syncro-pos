import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  async getSettings(businessId: string) {
    if (!businessId) return null;
    
    let settings = await this.prisma.setting.findFirst({
      where: { businessId }
    });

    if (!settings) {
      console.log(`Settings: Initializing default settings for business ${businessId}`);
      settings = await this.prisma.setting.create({
        data: { businessId }
      });
    }

    return settings;
  }

  async updateSettings(updateData: any, businessId: string) {
    if (!businessId) throw new Error('Business ID is required');

    const settings = await this.getSettings(businessId);
    if (!settings) throw new Error('Could not find or create settings');
    
    // Lista de campos permitidos en el modelo Setting para evitar errores de Prisma
    const allowedFields = [
      'businessName', 'businessAddress', 'businessPhone', 'businessEmail', 'businessIcon',
      'ruc', 'address', 'phone', 'email', 'website', 'country', 'currency',
      'taxRate', 'taxEnabled', 'igtfRate', 'receiptFooter',
      'pagoMovilBank', 'pagoMovilId', 'pagoMovilPhone', 'pagoMovilEnabled',
      'binanceId', 'binanceEmail', 'binanceEnabled',
      'zinliEmail', 'zinliEnabled',
      'paypalEmail', 'paypalEnabled',
      'requireClient', 'printOnSale', 'lowStockAlert', 'allowNegativeStock',
      'defaultPrinter', 'paperWidth', 'copiesPerSale',
      'paymentMethods', 'discountPin', 'pinPermissions',
      'salesGoal', 'showSalesGoal',
      'exchangeRate', 'exchangeRateEur', 'bcvUpdateDate',
      'exchangeRateDashboard', 'exchangeRateDashboardEur', 'bcvUpdateDateDashboard'
    ];

    const filteredData: any = {};
    for (const key of allowedFields) {
      if (updateData[key] !== undefined) {
        filteredData[key] = updateData[key];
      }
    }

    try {
      return await this.prisma.setting.update({
        where: { id: settings.id },
        data: filteredData
      });
    } catch (error) {
      console.error("ERROR AL ACTUALIZAR CONFIGURACIÓN:", error);
      throw error;
    }
  }
}
