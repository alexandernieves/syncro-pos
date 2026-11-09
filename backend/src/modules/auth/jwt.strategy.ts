import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { suspendedMessage, suspensionOf } from '../syncro-admin/suspension';
import { ConfigService } from '@nestjs/config';
import { accountOpen } from './closed-accounts';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private configService: ConfigService, private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'syncro-pos-secret-key-2025',
    });
  }

  async validate(payload: any) {
    // A business suspended from Syncro central loses access on its next request
    if (payload.businessId && payload.role !== 'syncropos') {
      const s = await suspensionOf(payload.businessId, (id) => this.prisma.business.findUnique({ where: { id }, select: { status: true, suspendedReason: true } }));
      if (s.suspended) throw new UnauthorizedException(suspendedMessage(s.reason));
    }
    // Someone removed from the business can't keep using an old session
    if (payload.sub && payload.role !== 'client' && !(await accountOpen(payload.sub, (id) => this.prisma.user.findUnique({ where: { id }, select: { role: true } }))))
      throw new UnauthorizedException('Tu usuario fue eliminado de este negocio');
    return { id: payload.sub, email: payload.email, role: payload.role, name: payload.name, businessId: payload.businessId };
  }
}
