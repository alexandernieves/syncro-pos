/**
 * Syncro's colour themes. Each one is a set of colour tokens in globals.css under
 * html[data-syncro-theme="<id>"]; the default (the orange one) has no attribute at all, so it
 * stays exactly as it always was. Dark themes also set html[data-mode="dark"], which turns on
 * theme-dark.css: it re-colours the light colours written by hand in older screens.
 *
 * The choice belongs to the computer (like a screen brightness), so it survives signing out.
 */
export type ThemeId = "syncro" | "oscuro";

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
];

export const DEFAULT_THEME: ThemeId = "syncro";
export const THEME_KEY = "syncro-theme";
export const THEME_EVENT = "syncro-theme-change";

export function isChristmasSeason(d = new Date()) {
  const m = d.getMonth();
  return m === 10 || m === 11 || (m === 0 && d.getDate() <= 6);
}

/** Themes that can be picked today (the Christmas ones only in season). */
export function availableThemes(d = new Date()) {
  const season = isChristmasSeason(d);
  return THEMES.filter((t) => !t.seasonal || season);
}

/** The theme in use: the saved one if it still exists and is in season, else the default. */
export function storedTheme(): SyncroTheme {
  let id: string | null = null;
  try {
    id = localStorage.getItem(THEME_KEY);
  } catch {
    id = null;
  }
  return availableThemes().find((t) => t.id === id) ?? THEMES[0];
}

/** Puts the theme on the page right away (no reload). */
export function applyTheme(theme: SyncroTheme) {
  const html = document.documentElement;
  if (theme.id === DEFAULT_THEME) html.removeAttribute("data-syncro-theme");
  else html.setAttribute("data-syncro-theme", theme.id);
  if (theme.mode === "dark") html.setAttribute("data-mode", "dark");
  else html.removeAttribute("data-mode");
}

export function setTheme(id: ThemeId) {
  const theme = availableThemes().find((t) => t.id === id) ?? THEMES[0];
  try {
    if (theme.id === DEFAULT_THEME) localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, theme.id);
  } catch {
    // storage blocked: still applied for this visit
  }
  applyTheme(theme);
  window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: theme.id }));
}

/**
 * Runs in <head> before the page paints, so a dark theme never flashes the light one first.
 * Kept as plain text: it can't import anything. The public pages (landing, sign-up, Syncro
 * Shop, the gym portal) keep their own look.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{
var p=location.pathname;
if(!(p.indexOf('/dashboard')===0||p.indexOf('/pos')===0||p.indexOf('/login')===0))return;
var id=localStorage.getItem('${THEME_KEY}');if(!id||id==='${DEFAULT_THEME}')return;
var themes=${JSON.stringify(Object.fromEntries(THEMES.map((t) => [t.id, { mode: t.mode, seasonal: !!t.seasonal }])))};
var t=themes[id];if(!t)return;
var d=new Date(),m=d.getMonth();if(t.seasonal&&!(m===10||m===11||(m===0&&d.getDate()<=6)))return;
var h=document.documentElement;h.setAttribute('data-syncro-theme',id);if(t.mode==='dark')h.setAttribute('data-mode','dark');
}catch(e){}})();`;

/** Pages that follow the chosen theme (the rest are public and keep their own look). */
export const themedPath = (p: string) => p.startsWith("/dashboard") || p.startsWith("/pos") || p.startsWith("/login");
