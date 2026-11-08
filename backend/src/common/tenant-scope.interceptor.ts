import { CallHandler, ExecutionContext, ForbiddenException, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { PrismaService } from '../modules/prisma/prisma.service';

/**
 * Golden rule: a business never sees or touches another business's data.
 *
 * Every request made by someone from a business (not the Syncro team, not public pages) is checked
 * before it reaches the controller: any branch, client, supplier, product, variant, category, shift,
 * sale, member, chat message or conversation it mentions (in the URL, the query or anywhere in the
 * body, including lists of items) must belong to that person's business. Otherwise it is refused.
 *
 * This is a safety net under the checks each service already makes, so a route that forgets one
 * can't leak another business's data through ids sent by the browser.
 */
type Resolver = (prisma: PrismaService, ids: string[]) => Promise<{ id: string; businessId: string | null }[]>;

const byBusiness = (model: string): Resolver => (prisma, ids) =>
  (prisma as any)[model].findMany({ where: { id: { in: ids } }, select: { id: true, businessId: true } });

const byBranch = (model: string): Resolver => async (prisma, ids) => {
  const rows: { id: string; branch: { businessId: string } | null }[] = await (prisma as any)[model].findMany({
    where: { id: { in: ids } },
    select: { id: true, branch: { select: { businessId: true } } },
  });
  return rows.map((r) => ({ id: r.id, businessId: r.branch?.businessId ?? null }));
};

const branch: Resolver = byBusiness('branch');

/** Field name (anywhere in the request) → how to find which business the id belongs to. */
const FIELDS: Record<string, Resolver> = {
  branchId: branch,
  branchIds: branch,
  fromBranchId: branch,
  toBranchId: branch,
  sourceBranchId: branch,
  targetBranchId: branch,
  originBranchId: branch,
  destinationBranchId: branch,
  clientId: byBusiness('client'),
  supplierId: byBusiness('supplier'),
  categoryId: byBusiness('category'),
  productId: byBusiness('product'),
  variantId: async (prisma, ids) =>
    (await prisma.productVariant.findMany({ where: { id: { in: ids } }, select: { id: true, product: { select: { businessId: true } } } }))
      .map((v) => ({ id: v.id, businessId: v.product?.businessId ?? null })),
  shiftId: byBranch('shift'),
  saleId: async (prisma, ids) =>
    (await prisma.sale.findMany({ where: { id: { in: ids } }, select: { id: true, businessId: true, branch: { select: { businessId: true } } } }))
      .map((s) => ({ id: s.id, businessId: s.businessId ?? s.branch?.businessId ?? null })),
  memberId: byBusiness('gymMember'),
  msgId: byBusiness('aiChatMessage'),
  conversationId: byBusiness('conversation'),
};

/** Routes where these names mean something else (a device id for saved logins, public pages). */
const SKIP_PATHS = [/^\/auth\//, /^\/storefront\//, /^\/gym\/bridge\//, /^\/gym\/agent\//, /^\/whatsapp\/webhook/, /^\/push\/vapid-key/];

const MAX_IDS = 2000;

@Injectable()
export class TenantScopeInterceptor implements NestInterceptor {
  constructor(private prisma: PrismaService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    if (context.getType() !== 'http') return next.handle();
    const req = context.switchToHttp().getRequest();
    const user = req.user;
    // Public routes, the Syncro team (works across businesses on purpose) and device bridges
    if (!user?.businessId || user.role === 'syncropos') return next.handle();
    const path = String(req.path || req.url || '').replace(/^\/api(?=\/)/, '');
    if (SKIP_PATHS.some((re) => re.test(path))) return next.handle();
    // The customer portal is a shop window of several stores on purpose (public catalog, delivery)
    if (user.role === 'client' && /^\/clients\/portal\//.test(path)) return next.handle();

    const wanted = new Map<string, Set<string>>();
    let total = 0;
    const add = (field: string, value: unknown) => {
      if (total > MAX_IDS) return;
      const values = Array.isArray(value) ? value : [value];
      for (const v of values) {
        if (typeof v !== 'string' || !v || v.length > 100) continue;
        if (field === 'businessId') {
          if (v !== user.businessId) throw new ForbiddenException('No puedes acceder a datos de otro negocio');
          continue;
        }
        if (!FIELDS[field]) continue;
        if (!wanted.has(field)) wanted.set(field, new Set());
        wanted.get(field)!.add(v);
        total++;
      }
    };
    const walk = (node: unknown, depth: number) => {
      if (!node || typeof node !== 'object' || depth > 5) return;
      if (Array.isArray(node)) {
        for (const item of node.slice(0, 1000)) walk(item, depth + 1);
        return;
      }
      for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
        if (key === 'businessId' || FIELDS[key]) add(key, value);
        if (value && typeof value === 'object') walk(value, depth + 1);
      }
    };
    walk(req.params, 0);
    walk(req.query, 0);
    walk(req.body, 0);

    for (const [field, ids] of wanted) {
      const list = [...ids];
      const rows = await FIELDS[field](this.prisma, list);
      const owner = new Map(rows.map((r) => [r.id, r.businessId]));
      for (const id of list) {
        // An id that doesn't exist is left to the route (it answers "not found" or creates it)
        if (owner.has(id) && owner.get(id) !== user.businessId) {
          throw new ForbiddenException('No puedes acceder a datos de otro negocio');
        }
      }
    }
    return next.handle();
  }
}
