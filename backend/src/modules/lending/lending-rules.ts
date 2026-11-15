/**
 * Rules of the Syncro Credit lending market (P2P).
 *
 * - The level is the person's, the same everywhere: it grows with the money paid on time to any
 *   business (Chispa → Cometa → Órbita → Galaxia).
 * - Each lender says how much it lends by level (its table) and may give one client its own limit.
 * - Syncro Central caps the whole platform by level: total debt and loans at the same time, and a
 *   person late with any business can't borrow anywhere.
 * What a person can ask a lender for = the least of: that lender's limit minus what they already
 * owe it, what is left of the platform cap, and the offer's maximum.
 */
export type Level = 1 | 2 | 3 | 4;
export const LEVELS: Level[] = [4, 3, 2, 1];
export const LEVEL_NAMES: Record<number, string> = { 4: 'Chispa', 3: 'Cometa', 2: 'Órbita', 1: 'Galaxia' };
/** Money paid on time to reach each level */
export const LEVEL_AT: Record<number, number> = { 4: 0, 3: 200, 2: 500, 1: 1500 };

export type LevelLimits = Record<Level, number>;
export const DEFAULT_LEVEL_LIMITS: LevelLimits = { 4: 30, 3: 100, 2: 250, 1: 500 };

export type PlatformCaps = { blockIfLate: boolean; levels: Record<Level, { maxDebt: number; maxActive: number }> };
export const DEFAULT_CAPS: PlatformCaps = {
  blockIfLate: true,
  levels: {
    4: { maxDebt: 60, maxActive: 2 },
    3: { maxDebt: 250, maxActive: 3 },
    2: { maxDebt: 700, maxActive: 4 },
    1: { maxDebt: 2000, maxActive: 6 },
  },
};

const money = (v: unknown, dflt: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(1_000_000, Math.max(0, Math.round(n * 100) / 100)) : dflt;
};

/** A lender's table. A better level never lends less than the one before it (going up is a benefit). */
export function cleanLevelLimits(raw: any): LevelLimits {
  const out = { ...DEFAULT_LEVEL_LIMITS };
  if (!raw || typeof raw !== 'object') return out;
  let floor = 0;
  for (const l of LEVELS) {
    out[l] = Math.max(floor, money(raw[l] ?? raw[String(l)], DEFAULT_LEVEL_LIMITS[l]));
    floor = out[l];
  }
  return out;
}

/** Syncro Central's caps; same rule: a better level is never capped below the one before it */
export function cleanCaps(raw: any): PlatformCaps {
  const out: PlatformCaps = { blockIfLate: raw?.blockIfLate === undefined ? true : !!raw.blockIfLate, levels: { ...DEFAULT_CAPS.levels } };
  let debt = 0;
  let active = 1;
  for (const l of LEVELS) {
    const r = raw?.levels?.[l] ?? raw?.levels?.[String(l)] ?? {};
    const maxDebt = Math.max(debt, money(r.maxDebt, DEFAULT_CAPS.levels[l].maxDebt));
    const n = Math.round(Number(r.maxActive));
    const maxActive = Math.max(active, Number.isFinite(n) ? Math.min(50, Math.max(1, n)) : DEFAULT_CAPS.levels[l].maxActive);
    out.levels[l] = { maxDebt, maxActive };
    debt = maxDebt;
    active = maxActive;
  }
  return out;
}

export function levelFromPaid(paidOnTime: number): Level {
  return paidOnTime >= LEVEL_AT[1] ? 1 : paidOnTime >= LEVEL_AT[2] ? 2 : paidOnTime >= LEVEL_AT[3] ? 3 : 4;
}
