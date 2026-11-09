/**
 * People removed from a business keep their old session token until it expires. Each request
 * checks whether the account is still open; the answer is remembered for a minute so this costs
 * at most one small query per person per minute.
 */
const TTL = 60_000;
const seen = new Map<string, { open: boolean; at: number }>();

export async function accountOpen(userId: string, lookup: (id: string) => Promise<{ role: string } | null>) {
  const hit = seen.get(userId);
  if (hit && Date.now() - hit.at < TTL) return hit.open;
  const user = await lookup(userId).catch(() => undefined);
  if (user === undefined) return hit?.open ?? true; // database hiccup: don't lock everybody out
  const open = !!user && user.role !== 'deleted';
  seen.set(userId, { open, at: Date.now() });
  return open;
}

/** Right after removing someone: their next request is already refused. */
export function forgetUser(userId: string) {
  seen.set(userId, { open: false, at: Date.now() });
}
