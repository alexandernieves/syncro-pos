import { Controller, Get, Put, Post, Body } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { BcvService } from './bcv.service';

@Controller('settings')
export class SettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly bcvService: BcvService
  ) {}

  @Get()
  async getSettings() {
    return this.settingsService.getSettings();
  }

  @Put()
  async updateSettings(@Body() updateData: any) {
    return this.settingsService.updateSettings(updateData);
  }

  @Post('sync-bcv')
  async syncBcv(@Body('target') target?: 'pos' | 'dashboard') {
    return this.bcvService.syncRate(target || 'pos');
  }
}
