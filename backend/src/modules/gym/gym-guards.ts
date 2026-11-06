import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { assertModule } from '../business-modules/module-access';

/** Staff screens: a member signed in to the client app cannot use them, and the business needs the gym module. Runs after JwtAuthGuard. */
@Injectable()
export class GymStaffGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}
  async canActivate(context: ExecutionContext) {
    const user = context.switchToHttp().getRequest().user;
    if (!user?.businessId || user.role === 'client') throw new ForbiddenException('Solo el personal del gimnasio puede usar esta función');
    await assertModule(this.prisma, user.businessId, 'gym');
    return true;
  }
}

/** The member's app: only client sessions, of a business with the gym module. Runs after JwtAuthGuard. */
@Injectable()
export class GymMemberGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}
  async canActivate(context: ExecutionContext) {
    const user = context.switchToHttp().getRequest().user;
    if (user?.role !== 'client' || !user.id || !user.businessId) throw new ForbiddenException('Inicia sesión en la app de socios');
    await assertModule(this.prisma, user.businessId, 'gym');
    return true;
  }
}
