import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SettingsService implements OnModuleInit {
  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    const count = await this.prisma.setting.count();
    if (count === 0) {
      await this.prisma.setting.create({ data: {} });
      console.log('Settings: Initialized default settings document.');
    }
  }

  async getSettings() {
    return this.prisma.setting.findFirst();
  }

  async updateSettings(updateData: any) {
    const settings = await this.prisma.setting.findFirst();
    
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
      if (settings) {
        return await this.prisma.setting.update({
          where: { id: settings.id },
          data: filteredData
        });
      } else {
        return await this.prisma.setting.create({ data: filteredData });
      }
    } catch (error) {
      console.error("ERROR AL ACTUALIZAR CONFIGURACIÓN:", error);
      throw error;
    }
  }
}
