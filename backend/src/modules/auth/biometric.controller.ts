import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from './jwt-auth.guard';
import { BiometricService } from './biometric.service';

/** Sign in with fingerprint (Touch ID) or Windows Hello from a saved profile. */
@Controller('auth/biometric')
export class BiometricController {
  constructor(private readonly bio: BiometricService) {}

  private uid(req: any) {
    return (req.user?.id ?? req.user?.sub) as string;
  }

  // ── Signed in: turn it on for this computer, see and remove computers ──────

  @UseGuards(JwtAuthGuard)
  @Get()
  list(@Req() req: any) {
    return this.bio.list(this.uid(req));
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any) {
    return this.bio.remove(this.uid(req), id);
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('device')
  registerDevice(@Body() body: any, @Req() req: any) {
    return this.bio.registerDeviceToken(this.uid(req), body);
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('passkey/register-options')
  passkeyRegisterOptions(@Req() req: any) {
    return this.bio.passkeyRegisterOptions(this.uid(req), req.headers?.origin);
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('passkey/register')
  passkeyRegister(@Body() body: any, @Req() req: any) {
    return this.bio.passkeyRegisterVerify(this.uid(req), body);
  }

  // ── Signing in (no session yet) ───────────────────────────────────────────

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('device/login')
  loginDevice(@Body() body: any) {
    return this.bio.loginDeviceToken(body);
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('passkey/login-options')
  passkeyLoginOptions(@Body() body: any, @Req() req: any) {
    return this.bio.passkeyLoginOptions(body, req.headers?.origin);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('passkey/login')
  passkeyLogin(@Body() body: any) {
    return this.bio.passkeyLoginVerify(body);
  }
}
