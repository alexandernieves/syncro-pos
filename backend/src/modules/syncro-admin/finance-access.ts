import { ForbiddenException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';

export async function requireFinanceScope(prisma: PrismaService, user: any, workspace: string) {
  if (user?.role !== 'syncropos' || typeof user.id !== 'string' || !user.id) throw new ForbiddenException();
  const account = await prisma.user.findUnique({ where: { id: user.id }, select: { role: true } });
  if (account?.role !== 'syncropos') throw new ForbiddenException('Tu usuario ya no tiene acceso a Finanzas');
  if (workspace === 'personal') return `personal:${user.id}`;
  const admins = (process.env.SYNCRO_FINANCE_ADMIN_IDS ?? '').split(',').map(id => id.trim());
  if (workspace === 'company' && admins.includes(user.id)) return 'company';
  throw new ForbiddenException('Acceso financiero no autorizado');
}
