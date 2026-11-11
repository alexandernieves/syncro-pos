/**
 * Syncro's colour themes. Each one is a set of colour tokens in globals.css under
 * html[data-syncro-theme="<id>"]; the default (the orange one) has no attribute at all, so it
 * stays exactly as it always was. Dark themes also set html[data-mode="dark"], which turns on
 * theme-dark.css: it re-colours the light colours written by hand in older screens.
 *
 * The owner saves the theme on the server for the whole business or for one branch; a cashier
 * can pick one of their own that only changes the POS. The browser keeps a copy (THEME_KEY and
 * POS_THEME_KEY) so the page paints with it before anything loads, and the app theme survives
 * signing out (the login screen keeps the last one).
 */
export type ThemeId = "syncro" | "oscuro" | "atardecer" | "navidad" | "santa";

export type SyncroTheme = {
  id: ThemeId;
  name: string;
  description: string;
  mode: "light" | "dark";
  /** Only offered in the Christmas season (Nov 1 – Jan 6, the same as the mascot's outfits). */
  seasonal?: boolean;
  /** Colours for the preview card: frame, view, card, text, accent. */
  preview: { shell: string; background: string; card: string; text: string; muted: string; primary: string };
};

export const THEMES: SyncroTheme[] = [
  {
    id: "syncro",
    name: "Syncro",
    description: "El naranja de siempre sobre tonos hueso. Es el tema por defecto.",
    mode: "light",
    preview: { shell: "#E9E6E0", background: "#F7F5F0", card: "#FCFBF8", text: "#1A1815", muted: "#5F5B52", primary: "#F26B3A" },
  },
  {
    id: "oscuro",
    name: "Noche",
    description: "Oscuro y cálido, descansa la vista en jornadas largas o de noche.",
    mode: "dark",
    preview: { shell: "#121110", background: "#1A1917", card: "#22201D", text: "#EEEAE3", muted: "#A29C91", primary: "#F26B3A" },
  },
  {
    id: "atardecer",
    name: "Atardecer",
    description: "Oscuro suave en grises cálidos, con menos contraste que Noche.",
    mode: "dark",
    preview: { shell: "#25221F", background: "#2D2A26", card: "#35312D", text: "#F2EEE7", muted: "#B5AEA2", primary: "#EA6838" },
  },
  {
    id: "navidad",
    name: "Navidad",
    description: "Crema y rojo navideño con toques de verde pino.",
    mode: "light",
    seasonal: true,
    preview: { shell: "#ECE4D6", background: "#FAF6EE", card: "#FFFCF6", text: "#2B1B17", muted: "#2E7A4E", primary: "#C3302C" },
  },
  {
    id: "santa",
    name: "Santa",
    description: "Nieve cayendo, el árbol de Navidad y el trineo de Santa en el menú, y bambalinas arriba. Los datos quedan sobre fondo claro.",
    mode: "light",
    seasonal: true,
    preview: { shell: "#0F3324", background: "#FBF7EF", card: "#FFFDF8", text: "#2B1B17", muted: "#A9C4B4", primary: "#C8262C" },
  },
];

export const DEFAULT_THEME: ThemeId = "syncro";
export const THEME_KEY = "syncro-theme";
/** A cashier's own POS theme (cleared when they sign out) */
export const POS_THEME_KEY = "syncro-theme-pos";
export const THEME_EVENT = "syncro-theme-change";

/** What the server keeps in Setting.themes */
export type SavedThemes = { business: ThemeId | null; branches: Record<string, ThemeId>; pos: Record<string, ThemeId> };

const OWNER_ROLES = ["ownerpos", "owner", "admin", "superadmin"];
export const isOwnerRole = (role?: string | null) => OWNER_ROLES.includes(String(role || "").toLowerCase());

export function isChristmasSeason(d = new Date()) {
  const m = d.getMonth();
  return m === 10 || m === 11 || (m === 0 && d.getDate() <= 6);
}

/** Themes that can be picked today (the Christmas ones only in season). */
export function availableThemes(d = new Date()) {
  const season = isChristmasSeason(d);
  return THEMES.filter((t) => !t.seasonal || season);
}

const read = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key: string, id: string | null) => {
  try {
    if (id && id !== DEFAULT_THEME) localStorage.setItem(key, id);
    else localStorage.removeItem(key);
  } catch {
    // storage blocked: still applied for this visit
  }
};
const find = (id: string | null) => availableThemes().find((t) => t.id === id) ?? null;

/** The business's theme (dashboard and POS), as last known on this computer. */
export function storedTheme(): SyncroTheme {
  return find(read(THEME_KEY)) ?? THEMES[0];
}

/** A theme being tried in Temas before "Guardar" (only on this screen, never stored) */
let previewing: ThemeId | null = null;

/** The theme of a page: in the POS a cashier's own one wins. */
export function themeFor(path: string): SyncroTheme {
  if (previewing) return find(previewing) ?? THEMES[0];
  if (path.startsWith("/pos")) {
    const own = find(read(POS_THEME_KEY));
    if (own) return own;
  }
  return storedTheme();
}

/** A cashier's own POS theme, if they picked one. */
export const storedPosTheme = () => find(read(POS_THEME_KEY));

/**
 * Takes what the server says (after signing in or when it changes): the branch's theme, else the
 * business's; and for a cashier, their own POS theme. If the owner never saved one, the copy on
 * this computer stays as it was.
 */
export function adoptServerThemes(saved: SavedThemes | null | undefined, who: { userId?: string; role?: string; branchId?: string | null }) {
  if (saved) {
    const app = (who.branchId && saved.branches?.[who.branchId]) || saved.business;
    if (app) write(THEME_KEY, app);
    write(POS_THEME_KEY, !isOwnerRole(who.role) && who.userId ? saved.pos?.[who.userId] ?? null : null);
  }
  if (themedPath(window.location.pathname)) applyTheme(themeFor(window.location.pathname));
  window.dispatchEvent(new CustomEvent(THEME_EVENT));
}

/** Remembers a theme just saved on the server, so this computer shows it right away. */
export function rememberTheme(kind: "app" | "pos", id: ThemeId | null) {
  write(kind === "app" ? THEME_KEY : POS_THEME_KEY, id);
  if (themedPath(window.location.pathname)) applyTheme(themeFor(window.location.pathname));
  window.dispatchEvent(new CustomEvent(THEME_EVENT));
}

/** Puts the theme on the page right away (no reload). */
export function applyTheme(theme: SyncroTheme) {
  const html = document.documentElement;
  if (theme.id === DEFAULT_THEME) html.removeAttribute("data-syncro-theme");
  else html.setAttribute("data-syncro-theme", theme.id);
  if (theme.mode === "dark") html.setAttribute("data-mode", "dark");
  else html.removeAttribute("data-mode");
}

/** Shows a theme on screen without saving it (Temas, before "Guardar"); null goes back to the saved one. */
export function previewTheme(id: ThemeId | null) {
  previewing = id;
  applyTheme(themeFor(window.location.pathname));
  window.dispatchEvent(new CustomEvent(THEME_EVENT));
}

/**
 * Runs in <head> before the page paints, so a dark theme never flashes the light one first.
 * Kept as plain text: it can't import anything. The public pages (landing, sign-up, Syncro
 * Shop, the gym portal) keep their own look.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{
var p=location.pathname;
if(!(p.indexOf('/dashboard')===0||p.indexOf('/pos')===0||p.indexOf('/login')===0))return;
var id=(p.indexOf('/pos')===0&&localStorage.getItem('${POS_THEME_KEY}'))||localStorage.getItem('${THEME_KEY}');if(!id||id==='${DEFAULT_THEME}')return;
var themes=${JSON.stringify(Object.fromEntries(THEMES.map((t) => [t.id, { mode: t.mode, seasonal: !!t.seasonal }])))};
var t=themes[id];if(!t)return;
var d=new Date(),m=d.getMonth();if(t.seasonal&&!(m===10||m===11||(m===0&&d.getDate()<=6)))return;
var h=document.documentElement;h.setAttribute('data-syncro-theme',id);if(t.mode==='dark')h.setAttribute('data-mode','dark');
}catch(e){}})();`;

/** Pages that follow the chosen theme (the rest are public and keep their own look). */
export const themedPath = (p: string) => p.startsWith("/dashboard") || p.startsWith("/pos") || p.startsWith("/login");
