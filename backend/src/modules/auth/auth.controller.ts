import { Controller, Post, Body, UnauthorizedException, ConflictException, Get, Request, UseGuards, Query, Delete, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  async login(@Body() body: any) {
    const user = await this.authService.validateUser(body.email, body.password);
    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    return this.authService.login(user);
  }

  @Post('register')
  async register(@Body() body: any) {
    try {
      return await this.authService.register(body);
    } catch (err: any) {
      if (err?.code === 'P2002' || err?.code === 11000 || (err?.message && err.message.includes('E11000'))) {
        throw new ConflictException('Esta cuenta ya existe. El correo electrónico o nombre de negocio ya está registrado.');
      }
      throw err;
    }
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('verify-password')
  async verifyPassword(@Body() body: any, @Request() req: any) {
    // The jwt guard injects req.user based on the token payload
    const user = await this.authService.validateUser(req.user.email, body.password);
    if (!user) {
      throw new UnauthorizedException('Contraseña incorrecta');
    }
    return { success: true };
  }

  @Get('session')
  async getSession(@Request() req: any) {
    const userAgent = req.headers['user-agent'] || '';
    const ip = req.headers['x-forwarded-for'] || 
               req.socket.remoteAddress || 
               req.ip || 
               '127.0.0.1';
    
    // De-duplicate if it's a list (common with proxies)
    const displayIp = typeof ip === 'string' ? ip.split(',')[0].trim() : ip;
    
    // Parse platform from user-agent
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

  @Get('saved-profiles')
  async getSavedProfiles(@Query('clientId') clientId: string) {
    if (!clientId) return [];
    return this.authService.getSavedProfiles(clientId);
  }

  @Post('saved-profiles')
  async saveProfile(@Body() body: { clientId: string; email: string; name: string; role?: string; businessName?: string }) {
    if (!body.clientId || !body.email || !body.name) {
      throw new BadRequestException('Faltan campos requeridos');
    }
    return this.authService.saveProfile(body);
  }

  @Delete('saved-profiles')
  async deleteSavedProfile(@Query('clientId') clientId: string, @Query('email') email: string) {
    if (!clientId || !email) {
      throw new BadRequestException('Faltan campos requeridos');
    }
    return this.authService.deleteSavedProfile(clientId, email);
  }
}
