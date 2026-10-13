import { Controller, Get, Put, Post, Body, UseGuards, Request, UnauthorizedException, ForbiddenException, BadRequestException, HttpCode } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard } from '@nestjs/passport';
import { SettingsService } from './settings.service';
import { BcvService } from './bcv.service';

const MANAGER_ROLES = ['ownerpos', 'owner', 'admin', 'superadmin'];

/** The supervisor PIN never leaves the server: the screens only learn whether there is one. */
const withoutPin = (s: any) => {
  if (!s) return s;
  const { discountPin, ...rest } = s;
  return { ...rest, hasDiscountPin: !!discountPin };
};

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
    return withoutPin(await this.settingsService.getSettings(businessId));
  }

  @Put()
  async updateSettings(@Body() updateData: any, @Request() req: any) {
    if (!req.user) throw new UnauthorizedException('No user context');
    const businessId = req.user.businessId;
    const data = { ...updateData };
    // The PIN changes only when an administrator sends a new one (or asks to remove it)
    if ('discountPin' in data || data.removeDiscountPin) {
      if (!MANAGER_ROLES.includes(String(req.user.role || '').toLowerCase())) throw new ForbiddenException('Solo un administrador cambia el PIN de supervisor');
      if (data.removeDiscountPin) data.discountPin = null;
      else if (data.discountPin === null || data.discountPin === '') delete data.discountPin;
      else if (!/^\d{4,8}$/.test(String(data.discountPin))) throw new BadRequestException('El PIN debe tener de 4 a 8 dígitos');
    }
    delete data.removeDiscountPin;
    return withoutPin(await this.settingsService.updateSettings(data, businessId));
  }

  /** Checks a supervisor PIN typed in the POS without ever sending the PIN to the browser. */
  @Post('verify-pin')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async verifyPin(@Body('pin') pin: string, @Request() req: any) {
    if (!req.user) throw new UnauthorizedException('No user context');
    const settings = await this.settingsService.getSettings(req.user.businessId);
    if (!settings?.discountPin) return { ok: true, configured: false };
    return { ok: String(pin ?? '') === settings.discountPin, configured: true };
  }

  @Post('sync-bcv')
  async syncBcv(@Body('target') target: 'pos' | 'dashboard', @Request() req: any) {
    if (!req.user) throw new UnauthorizedException('No user context');
    const businessId = req.user.businessId;
    return this.bcvService.syncRate(businessId, target || 'pos');
  }

  @Post('cop-rate')
  async setCopRate(@Body('manual') manual: number | null, @Request() req: any) {
    if (!req.user) throw new UnauthorizedException('No user context');
    return this.bcvService.setCopRate(req.user.businessId, manual === null || manual === undefined ? null : Number(manual));
  }

  @Post('apply-preset')
  async applyPreset(@Body('preset') preset: string, @Request() req: any) {
    if (!req.user) throw new UnauthorizedException('No user context');
    const businessId = req.user.businessId;
    return this.settingsService.applyPreset(preset, businessId);
  }
}
