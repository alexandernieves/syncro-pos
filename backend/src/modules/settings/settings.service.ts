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
    if (settings) {
      return this.prisma.setting.update({
        where: { id: settings.id },
        data: updateData
      });
    } else {
      return this.prisma.setting.create({ data: updateData });
    }
  }
}
