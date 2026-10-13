import { AsyncLocalStorage } from 'async_hooks';
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';

/**
 * The branch (sede) a gym request works in. The dashboard sends the branch picked in the
 * header; it must belong to the user's business, otherwise the main branch is used.
 * Scheduled jobs run outside any request and see every branch.
 */
const store = new AsyncLocalStorage<{ branchId: string }>();

export const gymBranch = (): string | null => store.getStore()?.branchId ?? null;

/** Filter for models with their own branchId (members, classes, visits, leads…). */
export const inBranch = (): { branchId?: string } => {
  const b = gymBranch();
  return b ? { branchId: b } : {};
};

/** Filter for rows that belong to a member (memberships, reminders, assessments…). */
export const memberInBranch = (): { member?: { branchId: string } } => {
  const b = gymBranch();
  return b ? { member: { branchId: b } } : {};
};

/** Runs `fn` as if the request were made in `branchId` (devices, bridge). */
export const runInBranch = <T>(branchId: string, fn: () => T) => store.run({ branchId }, fn);

@Injectable()
export class GymBranchInterceptor implements NestInterceptor {
  private cache = new Map<string, { branches: Set<string>; main: string | null; at: number }>();

  constructor(private prisma: PrismaService) {}

  private async branchesOf(businessId: string) {
    const hit = this.cache.get(businessId);
    if (hit && Date.now() - hit.at < 60_000) return hit;
    const rows = await this.prisma.branch.findMany({ where: { businessId }, select: { id: true, isMain: true, createdAt: true }, orderBy: [{ isMain: 'desc' }, { createdAt: 'asc' }] });
    const entry = { branches: new Set(rows.map((r) => r.id)), main: rows[0]?.id ?? null, at: Date.now() };
    this.cache.set(businessId, entry);
    return entry;
  }

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const req = context.switchToHttp().getRequest();
    const businessId: string | undefined = req.user?.businessId;
    if (!businessId) return next.handle();
    const { branches, main } = await this.branchesOf(businessId);
    const asked = String(req.headers['x-branch-id'] || '');
    const branchId = branches.has(asked) ? asked : main;
    if (!branchId) return next.handle();
    req.gymBranchId = branchId;
    return new Observable((subscriber) => store.run({ branchId }, () => next.handle().subscribe(subscriber)));
  }
}
