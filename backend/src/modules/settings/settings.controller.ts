import { Controller, Get, Put, Post, Body, UseGuards, Request, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SettingsService } from './settings.service';
import { BcvService } from './bcv.service';

@Controller('settings')
@UseGuards(AuthGuard('jwt'))
export class SettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly bcvService: BcvService
  ) {}

  @Get()
  async getSettings(@Request() req: any) {
    if (!req.user) throw new UnauthorizedException('No user context');
    const businessId = req.user.businessId;
    return this.settingsService.getSettings(businessId);
  }

  @Put()
  async updateSettings(@Body() updateData: any, @Request() req: any) {
    if (!req.user) throw new UnauthorizedException('No user context');
    const businessId = req.user.businessId;
    return this.settingsService.updateSettings(updateData, businessId);
  }

  @Post('sync-bcv')
  async syncBcv(@Body('target') target?: 'pos' | 'dashboard') {
    // BCV sync is usually global or we could scope it, but for now let's keep it
    return this.bcvService.syncRate(target || 'pos');
  }
}
