/**
 * One flat palette for the whole landing, shared by the DOM and the WebGL
 * stage so the 3D screen and the HTML simulator are literally the same colours.
 *
 * Deliberately flat: no gradients anywhere in the design. Colour is used to
 * separate meaning (problem vs. solved, base vs. bespoke), never as decoration.
 * The photography carries the warmth instead.
 */

export const C = {
  /** Warm paper the whole page sits on. */
  paper: "#F4F1EA",
  /** Slightly deeper paper for banded sections. */
  paperDeep: "#EBE6DC",
  /** Cards and the POS surface. */
  surface: "#FFFFFF",
  /** Hairlines and dividers. */
  line: "#DED8CB",
  lineSoft: "#EBE6DC",

  /** Headline ink, warm near-black. */
  ink: "#16140F",
  /** Body copy. */
  ink70: "#55504530",
  body: "#5A5449",
  /** Muted labels. */
  muted: "#8C8577",

  /** The one accent: settled money, a closed sale, a solved problem. */
  green: "#0E7A46",
  greenSoft: "#E3F0E7",
  greenInk: "#0A5733",

  /** Problems, shortfalls, the old way. */
  clay: "#B33C2A",
  claySoft: "#F6E6E1",

  /** Retail warmth, used sparingly for emphasis. */
  amber: "#C2820F",
  amberSoft: "#F8EEDA",

  /** POS chrome. */
  screenBg: "#FFFFFF",
  screenPanel: "#F7F5F0",
  screenBar: "#16140F",
} as const;

/** Per-vertical accent, kept inside the same restrained family. */
export const VERTICAL_ACCENT = {
  bodega: C.green,
  ferreteria: C.amber,
  minimarket: "#1F6FA8",
  boutique: "#8E3A62",
} as const;
