/**
 * A Venezuelan ID can be stored as "V-12345678", "V12345678" or just "12345678" (and a RIF as
 * "J-12345678-9"). The client portal sends type + number (V, E, J, G, C); these are every
 * spelling it may have been saved with, so the client is found however the business typed it.
 */
export function documentIdVariants(raw: string): string[] {
  const clean = String(raw || '').toUpperCase().replace(/[\s.]/g, '');
  const out = new Set<string>([clean]);
  const m = clean.match(/^([VEJGCP])-?(\d+)(?:-(\d))?$/);
  if (m) {
    const [, type, num, check] = m;
    const digits = num + (check ?? '');
    out.add(`${type}-${digits}`);
    out.add(`${type}${digits}`);
    out.add(digits);
    // RIF with its check digit apart: J-12345678-9
    if (digits.length >= 9) out.add(`${type}-${digits.slice(0, -1)}-${digits.slice(-1)}`);
  }
  return [...out].filter(Boolean);
}
