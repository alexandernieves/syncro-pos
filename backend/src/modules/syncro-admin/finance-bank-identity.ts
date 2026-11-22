import { createHash } from 'node:crypto';

export function financeBankEntryId(posted: string, reference: string, currency: string, nativeCents: number, kind: string) {
  return createHash('sha256').update(JSON.stringify(['banesco', posted, reference.trim().toUpperCase(), currency, nativeCents, kind])).digest('hex');
}
