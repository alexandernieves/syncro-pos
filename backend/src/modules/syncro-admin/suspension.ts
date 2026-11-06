/**
 * Which businesses are suspended, cached for a short while so the check on every request
 * doesn't hit the database. Changing a status from Syncro central clears the entry at once.
 */
const TTL_MS = 30_000;
const cache = new Map<string, { suspended: boolean; reason: string | null; at: number }>();

type Lookup = (businessId: string) => Promise<{ status: string; suspendedReason: string | null } | null>;

export async function suspensionOf(businessId: string, lookup: Lookup) {
  const hit = cache.get(businessId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit;
  const b = await lookup(businessId);
  const entry = { suspended: b?.status === 'SUSPENDED', reason: b?.suspendedReason ?? null, at: Date.now() };
  cache.set(businessId, entry);
  return entry;
}

export function forgetSuspension(businessId: string) {
  cache.delete(businessId);
}

export function suspendedMessage(reason: string | null) {
  return `La cuenta de este negocio está suspendida${reason ? `: ${reason}` : ''}. Escríbenos a soporte de Syncro para reactivarla.`;
}
