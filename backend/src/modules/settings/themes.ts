/**
 * Colour themes saved on the server, so they follow the business and not the computer:
 * one for the whole business, one per branch (optional), and one per cashier that only
 * changes the POS. Kept in Setting.themes.
 */
export const THEME_IDS = ['syncro', 'oscuro', 'atardecer', 'navidad', 'santa'] as const;
export type ThemeId = (typeof THEME_IDS)[number];

export type SavedThemes = {
  business: ThemeId | null;
  branches: Record<string, ThemeId>;
  pos: Record<string, ThemeId>;
};

const isTheme = (v: unknown): v is ThemeId => typeof v === 'string' && (THEME_IDS as readonly string[]).includes(v);

const map = (v: unknown) => {
  const out: Record<string, ThemeId> = {};
  if (v && typeof v === 'object') for (const [k, t] of Object.entries(v)) if (isTheme(t) && k.length <= 64) out[k] = t;
  return out;
};

export function normalizeThemes(raw: unknown): SavedThemes {
  const r = (raw && typeof raw === 'object' ? raw : {}) as any;
  return { business: isTheme(r.business) ? r.business : null, branches: map(r.branches), pos: map(r.pos) };
}

export { isTheme };
