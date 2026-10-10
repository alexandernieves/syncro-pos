import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

/** Staff screens: a member signed in to the client app cannot use them. Runs after JwtAuthGuard. */
@Injectable()
export class GymStaffGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const user = context.switchToHttp().getRequest().user;
    if (!user?.businessId || user.role === 'client') throw new ForbiddenException('Solo el personal del gimnasio puede usar esta función');
    return true;
  }
}

/** The member's app: only client sessions. Runs after JwtAuthGuard. */
@Injectable()
export class GymMemberGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const user = context.switchToHttp().getRequest().user;
    if (user?.role !== 'client' || !user.id || !user.businessId) throw new ForbiddenException('Inicia sesión en la app de socios');
    return true;
  }
}
