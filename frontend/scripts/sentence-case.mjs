#!/usr/bin/env node
/**
 * Enforces sentence case in the UI text of Syncro (Spanish):
 *   - Only the first letter of each sentence is uppercase; the rest is lowercase,
 *     except acronyms (IVA, RIF, SKU…) and proper names (Syncro, WhatsApp…).
 *   - No forced capitals: removes the `uppercase` class and wide letter spacing
 *     (`tracking-wide`, `tracking-wider`, `tracking-widest`, `tracking-[0.xem]`).
 *
 * It parses the code with TypeScript and only touches text a person reads:
 * JSX text, user-facing attributes (placeholder, title, aria-label…), labels in
 * menus/columns/options and toast messages. Identifiers, keys and values are untouched.
 *
 * Usage:
 *   node scripts/sentence-case.mjs --check   # report, exit 1 if something must change
 *   node scripts/sentence-case.mjs --write   # apply the changes
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";

const ROOT = new URL("..", import.meta.url).pathname;
const DIRS = ["app", "components"];
const WRITE = process.argv.includes("--write");

// Written exactly like this wherever they appear.
const ACRONYMS = [
  "IVA", "IGTF", "ISLR", "RUC", "NIF", "NIT", "RFC", "BCV", "USD", "VES", "EUR", "USDT", "RIF", "CI", "SKU", "PIN", "PWA", "POS", "CRM", "ERP", "API", "QR",
  "PDF", "CSV", "XLSX", "XLS", "JSON", "ID", "IDs", "SENIAT", "IA", "KPI", "KPIs", "URL", "SMS", "OK", "GPS", "IP", "EAN", "UPC", "UTC",
  "COD", "OTP", "IN", "OUT", "FIFO", "LIFO", "IMEI", "NFC", "HTML", "CSS", "UI", "UX", "AM", "PM", "IGV", "S.A.", "C.A.", "2FA", "TV", "LED", "USB", "IMC", "ISAPI", "NTP", "README", "COP", "TRM",
];
const PROPER = [
  "Hikvision", "Ubuntu", "Colombia", "Cúcuta", "Koenyx",
  "Syncro", "SyncroCredit", "Syncro Credit", "Syncro Shop", "Syncro POS", "Syncro Score", "Syncro IA", "WhatsApp Web", "WhatsApp", "Binance", "Zinli", "PayPal", "Zelle", "Google",
  "Gemini", "Claude", "Mike", "Venezuela", "Caracas", "Táchira", "Mérida", "Excel", "Instagram", "Facebook", "TikTok", "YouTube",
  "Telegram", "Chrome", "Android", "iOS", "iPhone", "Apple", "Visa", "Mastercard", "Cashea", "Kardex", "Evolution", "Mac OS", "macOS", "Windows", "Linux",
  // Keyboard keys
  "Enter", "Esc", "Tab", "Shift", "Ctrl", "Alt", "Cmd", "Supr",
  // Venezuelan states
  "Distrito Capital", "Nueva Esparta", "Delta Amacuro", "La Guaira", "Amazonas", "Anzoátegui", "Apure", "Aragua", "Barinas", "Carabobo",
  "Cojedes", "Falcón", "Guárico", "Lara", "Miranda", "Monagas", "Portuguesa", "Sucre", "Trujillo", "Vargas", "Yaracuy", "Zulia", "Bluetooth", "Wi-Fi", "Bolívar",
];
const ACRONYM_MAP = new Map(ACRONYMS.map((a) => [a.toLowerCase(), a]));
const PROPER_SINGLE = new Map(PROPER.filter((p) => !p.includes(" ")).map((p) => [p.toLowerCase(), p]));
const PROPER_MULTI = PROPER.filter((p) => p.includes(" "));

// Attributes and object keys whose string value is read by people.
const TEXT_ATTRS = new Set(["placeholder", "title", "aria-label", "alt", "label", "description", "tooltip", "searchPlaceholder", "emptyMessage", "subtitle", "helperText", "confirmText", "cancelText", "buttonLabel", "heading"]);
const TEXT_KEYS = new Set(["title", "label", "description", "placeholder", "header", "subtitle", "text", "message", "emptyMessage", "tooltip", "hint", "helper", "buttonLabel", "confirmText", "cancelText", "heading", "caption"]);
const TOAST_FNS = new Set(["success", "error", "info", "warning", "message", "loading", "promise"]);

const WORD = /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ][A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9'’.-]*/g;

/** Does this look like code rather than text (class names, keys, URLs, paths…)? */
function looksLikeCode(s) {
  const t = s.trim();
  if (!t || !/[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(t)) return true;
  if (/^(https?:|mailto:|tel:|\/|#|\.|@)/.test(t)) return true;
  if (/[{}<>=;`$\\]|=>|&&|\|\|/.test(t)) return true;
  if (!/\s/.test(t) && (/[_/:]/.test(t) || /[a-z][A-Z]/.test(t) || /^[a-z0-9-]+$/.test(t))) return true;
  return false;
}

/** Sentence case for Spanish. `start`: the fragment begins a sentence. */
export function toSentenceCase(input, start = true) {
  if (looksLikeCode(input)) return input;
  let text = input;
  const placeholders = [];
  // Emails and URLs are kept exactly as written
  text = text.replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+|https?:\/\/\S+|www\.\S+/g, (m) => {
    placeholders.push(m);
    return `\u0000${placeholders.length - 1}\u0000`;
  });
  // Codes like ID-PEN, S/D, A-01 are written exactly as they are
  text = text.replace(/\b[A-Z]{1,4}(?:[\/-][A-Z0-9]{1,6})+\b/g, (m) => {
    placeholders.push(m);
    return `\u0000${placeholders.length - 1}\u0000`;
  });
  // Protect multi-word proper names first
  for (const name of PROPER_MULTI) {
    text = text.replace(new RegExp(name.replace(/ /g, "\\s+"), "gi"), () => {
      placeholders.push(name);
      return `\u0000${placeholders.length - 1}\u0000`;
    });
  }
  let sentenceStart = start;
  let out = "";
  let last = 0;
  for (const match of text.matchAll(WORD)) {
    const word = match[0];
    const before = text.slice(last, match.index);
    out += before;
    // A sentence starts after . ! ? or a line break; ¿ ¡ open one too.
    if (/[.!?…]\s*$|\n\s*$/.test(out) && out.trim().length > 0) sentenceStart = true;
    if (/[¿¡]\s*$/.test(before)) sentenceStart = true;
    const placeholderBefore = /\u0000\d+\u0000\s*$/.test(out);
    out += caseWord(word, sentenceStart && !placeholderBefore);
    sentenceStart = false;
    last = match.index + word.length;
  }
  out += text.slice(last);
  return out.replace(/\u0000(\d+)\u0000/g, (_, i) => placeholders[Number(i)]);
}

function caseWord(word, capitalize) {
  const bare = word.replace(/[.'’-]+$/, "");
  const tail = word.slice(bare.length);
  const lower = bare.toLowerCase();
  if (ACRONYM_MAP.has(lower)) return ACRONYM_MAP.get(lower) + tail;
  if (PROPER_SINGLE.has(lower)) return PROPER_SINGLE.get(lower) + tail;
  if (/\d/.test(bare)) return word; // codes, sizes: 20L, 4K, 2FA
  if (/^Bs\.?$/i.test(bare)) return "Bs" + tail;
  // Mixed case inside a word (iPad, McDonald) is a brand: leave it
  if (/[a-záéíóúñ][A-ZÁÉÍÓÚÑ]/.test(bare)) return word;
  const cased = capitalize ? lower.charAt(0).toUpperCase() + lower.slice(1) : lower;
  return cased + tail;
}

// ── Tailwind classes that force capitals or wide spacing ────────────────────
const CLASS_RE = /(^|[\s"'`])(uppercase|tracking-wide|tracking-wider|tracking-widest|tracking-\[0?\.\d+em\]|tracking-\[\d+(?:\.\d+)?px\])(?=[\s"'`]|$)/g;

function cleanClasses(literalText) {
  return literalText.replace(CLASS_RE, "$1").replace(/ {2,}/g, " ").replace(/(["'`]) +/g, "$1").replace(/ +(["'`])/g, "$1");
}

// ── AST walk ─────────────────────────────────────────────────────────────────
const INLINE_TAGS = new Set(["strong", "b", "em", "i", "span", "a", "mark", "code", "u", "small", "Link"]);

/**
 * A string that ends up on screen through ?: / || / ?? inside a JSX child
 * expression or a text attribute (never a condition or a comparison).
 */
function isDisplayedValue(node, sf) {
  let child = node;
  let parent = node.parent;
  let viaOperator = false;
  while (parent && (ts.isConditionalExpression(parent) || ts.isParenthesizedExpression(parent) || (ts.isBinaryExpression(parent) && [ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(parent.operatorToken.kind)))) {
    if (ts.isConditionalExpression(parent) && parent.condition === child) return false; // the condition itself
    viaOperator = true;
    child = parent;
    parent = parent.parent;
  }
  if (!viaOperator || !parent || !ts.isJsxExpression(parent)) return false;
  const holder = parent.parent;
  if (ts.isJsxElement(holder) || ts.isJsxFragment(holder)) return true;
  return ts.isJsxAttribute(holder) && TEXT_ATTRS.has(holder.name.getText(sf));
}

/** Whitespace, {" "} and JSX comments do not count as content. */
function isIgnorable(child) {
  if (ts.isJsxText(child)) return !child.getText(child.getSourceFile()).trim();
  if (ts.isJsxExpression(child)) return !child.expression || (ts.isStringLiteral(child.expression) && !child.expression.text.trim());
  return false;
}

/** Text that ends a sentence, or that has no words at all (an emoji, a bullet). */
function endsSentence(text) {
  return /[.!?…:]\s*$/.test(text) || !/[A-Za-zÁÉÍÓÚÑáéíóúñ0-9]/.test(text);
}

/** Whether a JSX text node begins a sentence, looking at what comes before it. */
function startsSentence(node) {
  const sf = node.getSourceFile();
  const siblings = node.parent.children ?? [];
  const idx = siblings.indexOf(node);
  for (let i = idx - 1; i >= 0; i--) {
    const prev = siblings[i];
    if (isIgnorable(prev)) continue;
    // {value} before the text continues the sentence; {cond ? <Icon/> : …} only draws something
    if (ts.isJsxExpression(prev)) return /<[A-Za-z]/.test(prev.getText(sf));
    if (ts.isJsxText(prev)) return endsSentence(prev.getText(sf));
    if (ts.isJsxElement(prev)) {
      const visibleText = prev.getText(sf).replace(/<[^>]*>/g, " ").replace(/\{[^}]*\}/g, " ");
      const hasText = /[A-Za-zÁÉÍÓÚÑáéíóúñ0-9]/.test(visibleText);
      // A bold label ending in ":" ("Nota:") opens a new sentence
      return !hasText || /[.!?:]\s*$/.test(visibleText.trim());
    }
    return true; // self-closing element before it, like an icon
  }
  // First text inside an inline element (<strong>…</strong>): depends on where that element sits
  const parent = node.parent;
  if (ts.isJsxElement(parent) && INLINE_TAGS.has(parent.openingElement.tagName.getText(sf)) && parent.parent && (ts.isJsxElement(parent.parent) || ts.isJsxFragment(parent.parent))) {
    const outer = parent.parent.children;
    const pos = outer.indexOf(parent);
    for (let i = pos - 1; i >= 0; i--) {
      const prev = outer[i];
      if (isIgnorable(prev)) continue;
      if (ts.isJsxText(prev)) return endsSentence(prev.getText(sf));
      if (ts.isJsxExpression(prev)) return /<[A-Za-z]/.test(prev.getText(sf));
      break;
    }
  }
  return true;
}
function processFile(path) {
  const source = readFileSync(path, "utf8");
  const sf = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const edits = [];
  const replaceNode = (node, newText, kind) => {
    const startPos = node.getStart(sf);
    const old = source.slice(startPos, node.end);
    if (old !== newText) edits.push({ start: startPos, end: node.end, newText, old, kind, line: sf.getLineAndCharacterOfPosition(startPos).line + 1 });
  };
  const fixStringLiteral = (lit, start = true) => {
    // Written in lowercase on purpose (a fragment of a longer sentence): do not capitalize it
    const firstLetter = (lit.text ?? "").match(/[A-Za-zÁÉÍÓÚÑáéíóúñ]/)?.[0];
    if (firstLetter && firstLetter === firstLetter.toLowerCase()) start = false;
    // " para …" glued after another text continues that sentence
    if (/^\s/.test(lit.text ?? source.slice(lit.getStart(sf) + 1, lit.getStart(sf) + 2))) start = false;
    if (ts.isStringLiteral(lit)) {
      const q = source[lit.getStart(sf)];
      const next = toSentenceCase(lit.text, start);
      if (next !== lit.text) replaceNode(lit, q + next.replace(new RegExp(q, "g"), "\\" + q) + q, "text");
    } else if (ts.isNoSubstitutionTemplateLiteral(lit)) {
      const next = toSentenceCase(lit.text, start);
      if (next !== lit.text) replaceNode(lit, "`" + next + "`", "text");
    } else if (ts.isTemplateExpression(lit)) {
      // Head starts the sentence; the text after each ${…} continues it
      const parts = [lit.head, ...lit.templateSpans.map((s) => s.literal)];
      parts.forEach((part, i) => {
        const raw = source.slice(part.getStart(sf) + 1, part.end - (ts.isTemplateTail(part) ? 1 : 2));
        if (/[\\]/.test(raw) || !/\s/.test(raw.trim())) return; // escapes, or a code prefix like `OC-${id}`
        const next = toSentenceCase(raw, i === 0 && start);
        if (next !== raw) {
          const open = source.slice(part.getStart(sf), part.getStart(sf) + 1);
          const close = ts.isTemplateTail(part) ? "`" : "${";
          edits.push({ start: part.getStart(sf), end: part.end, newText: open + next + close, old: raw, kind: "text", line: sf.getLineAndCharacterOfPosition(part.getStart(sf)).line + 1 });
        }
      });
    }
  };

  const visit = (node) => {
    // className="…" / cn("…") / any string with Tailwind classes
    if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && CLASS_RE.test(source.slice(node.getStart(sf), node.end))) {
      CLASS_RE.lastIndex = 0;
      const raw = source.slice(node.getStart(sf), node.end);
      const parent = node.parent;
      const isClassContext =
        (ts.isJsxAttribute(parent) && parent.name.getText(sf) === "className") ||
        (ts.isJsxExpression(parent) && ts.isJsxAttribute(parent.parent) && parent.parent.name.getText(sf) === "className") ||
        /\b(?:text|font|px|py|flex|rounded|bg|border)-/.test(raw);
      if (isClassContext) replaceNode(node, cleanClasses(raw), "class");
    }
    CLASS_RE.lastIndex = 0;
    if (ts.isTemplateExpression(node) && ts.isJsxExpression(node.parent) && ts.isJsxAttribute(node.parent.parent) && node.parent.parent.name.getText(sf) === "className") {
      for (const part of [node.head, ...node.templateSpans.map((s) => s.literal)]) {
        const raw = source.slice(part.getStart(sf), part.end);
        const cleaned = raw.replace(/(^|\s|`|})(uppercase|tracking-wide|tracking-wider|tracking-widest|tracking-\[0?\.\d+em\])(?=\s|`|\$\{|$)/g, "$1");
        if (cleaned !== raw) edits.push({ start: part.getStart(sf), end: part.end, newText: cleaned, old: raw, kind: "class", line: sf.getLineAndCharacterOfPosition(part.getStart(sf)).line + 1 });
      }
    }

    // JSX text between tags
    if (ts.isJsxText(node) && !node.containsOnlyTriviaWhiteSpaces) {
      const raw = node.getFullText(sf);
      const next = toSentenceCase(raw, startsSentence(node));
      if (next !== raw) edits.push({ start: node.getFullStart(), end: node.end, newText: next, old: raw.trim(), kind: "text", line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1 });
    }

    // {cond ? "Guardando..." : "Guardar cambios"} / {name || "Consumidor final"} inside JSX or a text attribute
    if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateExpression(node)) && isDisplayedValue(node, sf)) {
      fixStringLiteral(node);
    }
    // {"texto"} as a JSX child
    if (ts.isJsxExpression(node) && node.expression && ts.isJsxElement(node.parent) && (ts.isStringLiteral(node.expression) || ts.isNoSubstitutionTemplateLiteral(node.expression))) {
      fixStringLiteral(node.expression);
    }
    // placeholder="…" title="…"
    if (ts.isJsxAttribute(node) && node.initializer && TEXT_ATTRS.has(node.name.getText(sf))) {
      const init = node.initializer;
      if (ts.isStringLiteral(init)) fixStringLiteral(init);
      else if (ts.isJsxExpression(init) && init.expression) fixStringLiteral(init.expression);
    }
    // { title: "…", label: "…" }
    if (ts.isPropertyAssignment(node) && TEXT_KEYS.has(node.name.getText(sf).replace(/["']/g, ""))) {
      fixStringLiteral(node.initializer);
    }
    // toast.success("…"), toast("…")
    if (ts.isCallExpression(node)) {
      const callee = node.expression.getText(sf);
      const isToast = callee === "toast" || (callee.startsWith("toast.") && TOAST_FNS.has(callee.slice(6)));
      if (isToast && node.arguments[0]) fixStringLiteral(node.arguments[0]);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);

  // Text the code compares literally ("escribe la palabra Eliminar") must stay as is
  const compared = new Set([...source.matchAll(/[!=]==?\s*["'`]([^"'`]+)["'`]|["'`]([^"'`]+)["'`]\s*[!=]==?/g)].map((m) => (m[1] ?? m[2]).trim()));
  for (let i = edits.length - 1; i >= 0; i--) {
    if (edits[i].kind === "text" && compared.has(edits[i].old.trim().replace(/^["'`]|["'`]$/g, ""))) edits.splice(i, 1);
  }
  if (edits.length === 0) return [];
  edits.sort((a, b) => b.start - a.start);
  // Drop overlapping edits (keep the outermost one already queued first)
  const applied = [];
  let result = source;
  let lastStart = Infinity;
  for (const e of edits) {
    if (e.end > lastStart) continue;
    result = result.slice(0, e.start) + e.newText + result.slice(e.end);
    lastStart = e.start;
    applied.push(e);
  }
  if (WRITE) writeFileSync(path, result);
  return applied;
}

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) yield* walk(full);
    else if (/\.tsx$/.test(entry)) yield full;
  }
}

let total = 0;
const report = [];
for (const dir of DIRS) {
  for (const file of walk(join(ROOT, dir))) {
    const edits = processFile(file);
    if (edits.length) {
      total += edits.length;
      report.push({ file: relative(ROOT, file), edits });
    }
  }
}
for (const { file, edits } of report) {
  console.log(`\n${file} (${edits.length})`);
  if (!process.argv.includes("--summary")) {
    for (const e of edits.slice().reverse()) {
      if (e.kind === "text") console.log(`  ${e.line}: ${JSON.stringify(e.old.trim()).slice(0, 70)} → ${JSON.stringify(e.newText.trim()).slice(0, 70)}`);
    }
  }
}
console.log(`\n${WRITE ? "Aplicados" : "Pendientes"}: ${total} cambios en ${report.length} archivos`);
if (!WRITE && total > 0) process.exit(1);
