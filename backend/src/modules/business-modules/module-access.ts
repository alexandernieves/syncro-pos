import { ForbiddenException } from '@nestjs/common';
import { USABLE_STATUSES, catalogModule } from './catalog';

/**
 * Which packaged modules each business can use, cached briefly so every gym request
 * doesn't hit the database. Any change from Syncro central clears that business at once.
 */
const TTL_MS = 30_000;
const cache = new Map<string, { codes: Set<string>; at: number }>();

type Db = { businessModule: { findMany: (args: any) => Promise<{ moduleCode: string }[]> } };

export async function usableModules(prisma: Db, businessId: string) {
  const hit = cache.get(businessId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.codes;
  const rows = await prisma.businessModule.findMany({ where: { businessId, status: { in: USABLE_STATUSES } }, select: { moduleCode: true } });
  const codes = new Set(rows.map((r) => r.moduleCode));
  cache.set(businessId, { codes, at: Date.now() });
  return codes;
}

export function forgetModules(businessId: string) {
  cache.delete(businessId);
}

/** Throws a clear 403 when the business doesn't have the module turned on. */
export async function assertModule(prisma: Db, businessId: string | null | undefined, code: string) {
  if (!businessId) throw new ForbiddenException('Sesión sin negocio');
  const codes = await usableModules(prisma, businessId);
  if (!codes.has(code)) {
    const name = catalogModule(code)?.name ?? code;
    throw new ForbiddenException(`El módulo ${name} no está activo en este negocio. Puedes solicitarlo en la Tienda de módulos.`);
  }
}
