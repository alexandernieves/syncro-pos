import {
  Controller,
  Post,
  Body,
  UnauthorizedException,
  ConflictException,
  Get,
  Request,
  UseGuards,
  Query,
  Delete,
  BadRequestException,
  Ip,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  // ── Login ─────────────────────────────────────────────────────────────────
  // Strict rate-limit: max 5 attempts per 15 minutes per IP
  @Throttle({ default: { limit: 5, ttl: 900000 } })
  @Post('login')
  async login(@Body() body: any, @Ip() ip: string) {
    const user = await this.authService.validateUser(body.email, body.password, ip);
    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    return this.authService.login(user);
  }

  // ── Register ──────────────────────────────────────────────────────────────
  // Moderate rate-limit: max 3 registrations per hour per IP
  @Throttle({ default: { limit: 3, ttl: 3600000 } })
  @Post('register')
  async register(@Body() body: any) {
    try {
      return await this.authService.register(body);
    } catch (err: any) {
      if (
        err?.code === 'P2002' ||
        err?.code === 11000 ||
        (err?.message && err.message.includes('E11000'))
      ) {
        throw new ConflictException(
          'Esta cuenta ya existe. El correo electrónico o nombre de negocio ya está registrado.',
        );
      }
      throw err;
    }
  }

  // ── Verify Password ───────────────────────────────────────────────────────
  @UseGuards(AuthGuard('jwt'))
  @Throttle({ default: { limit: 5, ttl: 900000 } })
  @Post('verify-password')
  async verifyPassword(@Body() body: any, @Request() req: any) {
    const user = await this.authService.validateUser(req.user.email, body.password);
    if (!user) {
      throw new UnauthorizedException('Contraseña incorrecta');
    }
    return { success: true };
  }

  // ── Session Info ──────────────────────────────────────────────────────────
  @SkipThrottle()
  @Get('session')
  async getSession(@Request() req: any) {
    const userAgent = req.headers['user-agent'] || '';
    const ip =
      req.headers['x-forwarded-for'] ||
      req.socket.remoteAddress ||
      req.ip ||
      '127.0.0.1';

    const displayIp = typeof ip === 'string' ? ip.split(',')[0].trim() : ip;

    let platform = 'Desconocida';
    if (userAgent.includes('Macintosh')) platform = 'Mac OS';
    else if (userAgent.includes('Windows')) platform = 'Windows';
    else if (userAgent.includes('Linux')) platform = 'Linux';
    else if (userAgent.includes('Android')) platform = 'Android';
    else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) platform = 'iOS';

    return {
      userAgent,
      ip: displayIp,
      timestamp: new Date().toISOString(),
      platform,
    };
  }

  // ── Saved Profiles ────────────────────────────────────────────────────────
  // Requires JWT auth — profile list is scoped to the authenticated client only
  @UseGuards(AuthGuard('jwt'))
  @Get('saved-profiles')
  async getSavedProfiles(
    @Query('clientId') clientId: string,
    @Request() req: any,
  ) {
    if (!clientId) return [];
    // Validate clientId ownership by cross-checking with userId stored in DB
    return this.authService.getSavedProfiles(clientId, req.user.sub);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('saved-profiles')
  async saveProfile(
    @Body()
    body: {
      clientId: string;
      email: string;
      name: string;
      role?: string;
      businessName?: string;
    },
    @Request() req: any,
  ) {
    if (!body.clientId || !body.email || !body.name) {
      throw new BadRequestException('Faltan campos requeridos');
    }
    // Only allow saving your own profile
    if (req.user.email !== body.email) {
      throw new UnauthorizedException('No puedes guardar perfiles de otros usuarios');
    }
    return this.authService.saveProfile(body);
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete('saved-profiles')
  async deleteSavedProfile(
    @Query('clientId') clientId: string,
    @Query('email') email: string,
    @Request() req: any,
  ) {
    if (!clientId || !email) {
      throw new BadRequestException('Faltan campos requeridos');
    }
    // Only allow deleting your own profile
    if (req.user.email !== email) {
      throw new UnauthorizedException('No puedes eliminar perfiles de otros usuarios');
    }
    return this.authService.deleteSavedProfile(clientId, email);
  }
}
