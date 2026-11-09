#!/usr/bin/env node
/**
 * Builds app/theme-dark.css: for the dark themes, re-colours the light colours written by hand
 * in the screens (bg-white, text-[#16140F], bg-gray-50, text-emerald-700, border-[#E5E1D9]…),
 * which don't follow the theme tokens. Every rule lives under html[data-mode="dark"], so the
 * default theme is never touched.
 *
 *   node scripts/build-theme-dark.mjs        (run it again after adding screens)
 *
 * Light surfaces become the theme's card / muted / accent; dark text becomes the theme's text;
 * pale tints (bg-emerald-50) become dark tints of the same colour; dark coloured text
 * (text-emerald-700) becomes its light shade. Saturated colours (buttons, badges) stay as they are.
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCAN = ["app", "components", "hooks", "lib", "context"];

// ── Tailwind palette (literal values, so nothing depends on which theme variables get emitted)
const twTheme = readFileSync(join(root, "node_modules/tailwindcss/theme.css"), "utf8");
const palette = {};
for (const m of twTheme.matchAll(/--color-([a-z]+)-(\d+):\s*([^;]+);/g)) palette[`${m[1]}-${m[2]}`] = m[3].trim();
const NEUTRALS = ["slate", "gray", "zinc", "neutral", "stone"];
const COLOURS = ["red", "orange", "amber", "yellow", "lime", "green", "emerald", "teal", "cyan", "sky", "blue", "indigo", "violet", "purple", "fuchsia", "pink", "rose"];

// ── Collect the colour classes used in the code
const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (name === "node_modules" || name.startsWith(".")) continue;
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(tsx|ts)$/.test(name)) files.push(p);
  }
};
SCAN.forEach((d) => walk(join(root, d)));

const VARIANT = "(?:(hover|focus|focus-visible|focus-within|active|disabled|placeholder|group-hover|data-\\[state=(?:active|open|checked|on|selected)\\]):)?";
const UTIL = "(bg|text|border|border-[trblxy]|divide|from|via|to)";
const COLOUR = `(white|black|(?:${[...NEUTRALS, ...COLOURS].join("|")})-(?:50|100|200|300|400|500|600|700|800|900|950)|\\[#[0-9a-fA-F]{3,8}\\])`;
const TOKEN = new RegExp(`(?<![\\w:\\-\\[/#])${VARIANT}${UTIL}-${COLOUR}(?:/(\\d{1,3}))?(?![\\w\\-\\]/])`, "g");

const tokens = new Map();
for (const f of files) {
  const src = readFileSync(f, "utf8");
  for (const m of src.matchAll(TOKEN)) tokens.set(m[0], { variant: m[1] || "", util: m[2], colour: m[3], alpha: m[4] ? Number(m[4]) : null });
}

// ── Colour maths for hand-written hex colours
function hexToRgb(hex) {
  let h = hex.replace(/[#[\]]/g, "");
  if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join("");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
}
function rgbToHsl([r, g, b]) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
const hsl = (h, s, l) => `hsl(${h.toFixed(0)} ${(s * 100).toFixed(0)}% ${(l * 100).toFixed(0)}%)`;
const mix = (colour, pct, base = "var(--card)") => `color-mix(in oklab, ${colour} ${pct}%, ${base})`;
const withAlpha = (value, alpha) => (alpha == null ? value : `color-mix(in oklab, ${value} ${alpha}%, transparent)`);
const STRONG_BORDER = "color-mix(in oklab, var(--foreground) 22%, transparent)";

/** The default theme's light colours, as written by hand in screens → the theme's token. */
const SYNCRO_LIGHT = {
  "#e9e6e0": { bg: "var(--shell)", border: "var(--border)" },
  "#f7f5f0": { bg: "var(--background)" },
  "#fcfbf8": { bg: "var(--card)" },
  "#faf7f2": { bg: "var(--card)" },
  "#faf9f5": { bg: "var(--card)" },
  "#f4f2ed": { bg: "var(--muted)" },
  "#f5f1e8": { bg: "var(--muted)" },
  "#f1eee8": { bg: "var(--accent)" },
  "#dcd7ce": { bg: "var(--sidebar-accent)" },
  "#e5e1d9": { bg: "var(--border)", border: "var(--border)" },
  "#e8e4dc": { bg: "var(--border)", border: "var(--border)" },
  "#dad5cc": { bg: "var(--border)", border: "var(--border)" },
  "#1a1815": { text: "var(--foreground)" },
  "#16140f": { text: "var(--foreground)" },
  "#5f5b52": { text: "var(--muted-foreground)" },
  "#6b665b": { text: "var(--muted-foreground)" },
};

/** The dark-theme value for a colour class, or null to leave it as it is. */
function remap(kind, colour) {
  // kind: "bg" (also gradients), "text", "border"
  if (colour === "white") return kind === "bg" ? "var(--card)" : kind === "border" ? "var(--card)" : null;
  if (colour === "black") return kind === "text" ? "var(--foreground)" : null;

  const pm = colour.match(/^([a-z]+)-(\d+)$/);
  if (pm) {
    const [, name, stepStr] = pm, step = Number(stepStr);
    if (NEUTRALS.includes(name)) {
      if (kind === "bg") return step <= 100 ? "var(--muted)" : step === 200 ? "var(--accent)" : step === 300 ? "var(--border)" : null;
      if (kind === "text") return step >= 800 ? "var(--foreground)" : step >= 400 ? "var(--muted-foreground)" : null;
      if (kind === "border") return step <= 300 ? "var(--border)" : step <= 600 ? STRONG_BORDER : "var(--border)";
    } else {
      const base = palette[`${name}-500`];
      if (kind === "bg") return step === 50 ? mix(base, 10) : step === 100 ? mix(base, 16) : step === 200 ? mix(base, 26) : null;
      if (kind === "text") {
        const to = { 600: 400, 700: 400, 800: 300, 900: 300, 950: 200 }[step];
        return to ? palette[`${name}-${to}`] : null;
      }
      if (kind === "border") return step <= 200 ? mix(base, 30) : step === 300 ? mix(base, 45) : null;
    }
    return null;
  }

  // Hand-written copies of Syncro's own light tokens go to the same token of the theme
  const exact = SYNCRO_LIGHT[colour.replace(/[[\]]/g, "").toLowerCase()];
  if (exact && exact[kind] !== undefined) return exact[kind];

  // Hand-written hex
  const rgb = hexToRgb(colour);
  const [h, s, l] = rgbToHsl(rgb);
  // Grey = little chroma (HSL saturation exaggerates near black and near white)
  const grey = Math.max(...rgb) - Math.min(...rgb) < 0.12;
  if (grey) {
    if (kind === "bg") return l >= 0.965 ? "var(--card)" : l >= 0.9 ? "var(--muted)" : l >= 0.8 ? "var(--accent)" : null;
    if (kind === "text") return l < 0.3 ? "var(--foreground)" : l < 0.66 ? "var(--muted-foreground)" : null;
    if (kind === "border") return l >= 0.7 ? "var(--border)" : l >= 0.3 ? STRONG_BORDER : null;
  } else {
    // Tints are mixed into the theme's card, so they sit right in every dark theme
    const hue = hsl(h, Math.min(s, 0.7), 0.5);
    if (kind === "bg") return l >= 0.85 ? mix(hue, 14) : null;
    if (kind === "text") return l < 0.42 ? hsl(h, Math.min(s, 0.75), 0.72) : null;
    if (kind === "border") return l >= 0.75 ? mix(hue, 30) : null;
  }
  return null;
}

// ── Rules
const SCOPE = 'html[data-mode="dark"]';
const sides = { t: ["top"], r: ["right"], b: ["bottom"], l: ["left"], x: ["left", "right"], y: ["top", "bottom"] };

function rule({ variant, util, colour, alpha }, token, fixed = null, scope = SCOPE) {
  const kind = util === "text" ? "text" : util.startsWith("border") || util === "divide" ? "border" : "bg";
  const value = fixed ?? remap(kind, colour);
  if (!value) return null;
  const v = withAlpha(value, alpha);
  const SCOPE_ = scope;

  // Paper (invoices, receipts, their previews) keeps its light colours in every theme
  let el = `[class~="${token}"]:not([data-paper], [data-paper] *)`;
  let pre = SCOPE_ + " ";
  let after = "";
  if (variant === "group-hover") pre = `${SCOPE_} .group:hover `;
  else if (variant === "placeholder") after = "::placeholder";
  else if (variant.startsWith("data-")) after = `[data-state="${variant.match(/=(\w+)/)[1]}"]`;
  else if (variant) after = `:${variant}`;

  let decl;
  if (util === "bg") decl = `background-color: ${v};`;
  else if (util === "text") decl = `color: ${v};`;
  else if (util === "border") decl = `border-color: ${v};`;
  else if (util.startsWith("border-")) decl = sides[util.slice(-1)].map((side) => `border-${side}-color: ${v};`).join(" ");
  else if (util === "divide") return `${pre}${el}${after} > :not(:last-child) { border-color: ${v}; }`;
  else decl = `--tw-gradient-${util}: ${v};`;
  return `${pre}${el}${after} { ${decl} }`;
}

const rules = [...tokens.entries()]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([token, t]) => rule(t, token))
  .filter(Boolean);

// Syncro's orange written by hand follows the theme's main colour in every theme but the default
// (red in Navidad, for example). Any theme sets html[data-syncro-theme]; the default never does.
const BRAND = ["#f26b3a", "#ee6a3c"];
const brandRules = [...tokens.entries()]
  .sort(([a], [b]) => a.localeCompare(b))
  .filter(([, t]) => BRAND.includes(t.colour.replace(/[[\]]/g, "").toLowerCase()))
  .map(([token, t]) => rule(t, token, "var(--primary)", "html[data-syncro-theme]"))
  .filter(Boolean);

const out = `/* Generated by scripts/build-theme-dark.mjs — do not edit by hand, run the script again.
   Dark themes only (html[data-mode="dark"]): light colours written by hand in the screens
   follow the theme instead of staying white. ${rules.length} rules. */

${SCOPE} { color-scheme: dark; }

/* Paper keeps the default theme's light colours: invoices, receipts and their previews. */
${SCOPE} [data-paper] {
  color-scheme: light;
  --background: #F7F5F0; --foreground: #1A1815; --card: #FCFBF8; --card-foreground: #1A1815;
  --popover: #FCFBF8; --popover-foreground: #1A1815; --secondary: #F4F2ED; --secondary-foreground: #1A1815;
  --muted: #F4F2ED; --muted-foreground: #5F5B52; --accent: #F1EEE8; --accent-foreground: #1A1815;
  --border: #E5E1D9; --input: #E5E1D9;
  color: var(--foreground);
}

${rules.join("\n")}

/* Syncro's orange written by hand → the theme's main colour (every theme but the default). */
${brandRules.join("\n")}
`;
writeFileSync(join(root, "app/theme-dark.css"), out);
console.log(`theme-dark.css: ${rules.length} + ${brandRules.length} brand rules from ${tokens.size} colour classes in ${files.length} files`);
