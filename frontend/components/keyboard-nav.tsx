"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useTickSound } from "@/components/use-tick-sound";

/**
 * Keyboard layer for the whole app, by priority:
 *   1. An open window (dialog or sheet): Enter jumps to the next field; on the last one it
 *      presses the window's main button. Fields that handle Enter themselves win.
 *   2. Arrow up/down: moves through the sidebar like the mouse does (with its tick);
 *      Enter opens the item.
 *   3. Arrow left/right: moves a thin orange selector through the page's header actions
 *      ([data-kbd-actions] or [data-kbd-action]); Enter runs the selected one.
 *   4. Enter with nothing selected: the page's main action ([data-kbd-primary], or the
 *      last header action).
 * Pages with their own keyboard (the POS product grid) mark a zone with [data-kbd-zone]
 * and handle the arrows themselves.
 */

const FIELD = 'input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=file]):not([disabled]):not([readonly]), select:not([disabled]), textarea:not([disabled])';
const isTyping = (el: Element | null) => !!el && (el.matches("input, textarea, select") || (el as HTMLElement).isContentEditable);
const visible = (el: Element) => (el as HTMLElement).offsetParent !== null || (el as HTMLElement).getClientRects().length > 0;

/** The window in front, if any (dialogs and sheets are role=dialog). */
function openWindow(): HTMLElement | null {
  const all = [...document.querySelectorAll<HTMLElement>('[role=dialog][data-state=open], [role=alertdialog][data-state=open]')].filter(visible);
  return all[all.length - 1] ?? null;
}
const popoverOpen = () => !!document.querySelector('[data-radix-popper-content-wrapper] [data-state=open], [role=menu][data-state=open], [role=listbox]');

function sidebarItems(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>('[data-sidebar="sidebar"] [data-kbd-nav]')].filter(visible);
}

/** Header actions of the page in view: marked groups, or the buttons next to the page title. */
function pageActions(): HTMLElement[] {
  const main = document.querySelector<HTMLElement>("main, [data-slot=sidebar-inset]") ?? document.body;
  const marked = [...main.querySelectorAll<HTMLElement>("[data-kbd-actions] button, [data-kbd-actions] a, [data-kbd-action]")];
  const pick = (els: HTMLElement[]) => els.filter((el) => visible(el) && !(el as HTMLButtonElement).disabled && !el.closest('[data-sidebar="sidebar"]'));
  if (marked.length) return pick(marked);
  // Fallback: the buttons that sit in the same header row as the first title
  const h1 = main.querySelector("h1");
  const row = h1?.parentElement?.parentElement;
  if (!row) return [];
  return pick([...row.querySelectorAll<HTMLElement>("button, a[href]")].filter((el) => !h1!.parentElement!.contains(el)));
}

function primaryAction(): HTMLElement | null {
  const main = document.querySelector<HTMLElement>("main, [data-slot=sidebar-inset]") ?? document.body;
  const explicit = [...main.querySelectorAll<HTMLElement>("[data-kbd-primary]")].find((el) => visible(el) && !(el as HTMLButtonElement).disabled);
  if (explicit) return explicit;
  const actions = pageActions();
  return actions[actions.length - 1] ?? null;
}

/** The button that confirms a window: marked, or the last enabled button of its footer. */
function windowSubmit(win: HTMLElement): HTMLButtonElement | null {
  const marked = win.querySelector<HTMLButtonElement>("[data-kbd-primary]");
  if (marked) return marked.disabled ? null : marked;
  const footer = win.querySelector('[data-slot="dialog-footer"], [data-slot="sheet-footer"]');
  const buttons = [...(footer?.querySelectorAll<HTMLButtonElement>("button") ?? [])].filter((b) => visible(b));
  const last = buttons[buttons.length - 1];
  return last && !last.disabled ? last : null;
}

/** Rows of a table body that hold data (not the loading or "no results" rows). */
function tableRows(body: HTMLElement): HTMLElement[] {
  return [...body.querySelectorAll<HTMLTableRowElement>(":scope > tr")].filter((tr) => visible(tr) && !(tr.cells.length === 1 && tr.cells[0].colSpan > 1));
}

/** Previous/next page button next to a table (marked, or the usual "next page" labels). */
function pageButton(body: HTMLElement, dir: "prev" | "next"): HTMLButtonElement | null {
  let box: HTMLElement | null = body;
  for (let i = 0; i < 6 && box; i++) {
    box = box.parentElement;
    const marked = box?.querySelector<HTMLButtonElement>(`[data-kbd-page="${dir}"]`);
    if (marked) return marked.disabled ? null : marked;
    const re = dir === "next" ? /next page|p[aá]gina siguiente/i : /previous page|p[aá]gina anterior/i;
    const byLabel = [...(box?.querySelectorAll<HTMLButtonElement>("button") ?? [])].find((b) => re.test(b.getAttribute("aria-label") || b.textContent || ""));
    if (byLabel) return byLabel.disabled ? null : byLabel;
  }
  return null;
}

/**
 * Arrows inside a table: up/down through the rows, left/right through the pages, Home/End,
 * Enter opens the row (its own click, or its first link), Esc leaves the table.
 */
function handleTable(e: KeyboardEvent, body: HTMLElement, tick: () => void): boolean {
  const rows = tableRows(body);
  const at = rows.findIndex((r) => r.hasAttribute("data-kbd-row"));
  const focusRow = (i: number) => {
    rows.forEach((r) => r.removeAttribute("data-kbd-row"));
    const r = rows[i];
    if (!r) return;
    r.setAttribute("data-kbd-row", "");
    r.scrollIntoView({ block: "nearest" });
    tick();
  };
  // After changing page the rows are new: land on the first (or last) one
  const afterPage = (first: boolean) => setTimeout(() => { const fresh = tableRows(body); if (fresh.length) { fresh.forEach((r) => r.removeAttribute("data-kbd-row")); const r = fresh[first ? 0 : fresh.length - 1]; r.setAttribute("data-kbd-row", ""); r.scrollIntoView({ block: "nearest" }); } }, 60);

  switch (e.key) {
    case "ArrowDown":
      if (!rows.length) return false;
      if (at === rows.length - 1) { const next = pageButton(body, "next"); if (next) { next.click(); afterPage(true); } return true; }
      focusRow(at + 1);
      return true;
    case "ArrowUp":
      if (!rows.length) return false;
      if (at <= 0) { if (at === 0) { const prev = pageButton(body, "prev"); if (prev) { prev.click(); afterPage(false); } } else focusRow(0); return true; }
      focusRow(at - 1);
      return true;
    case "ArrowRight": { const next = pageButton(body, "next"); if (next) { next.click(); afterPage(true); } return true; }
    case "ArrowLeft": { const prev = pageButton(body, "prev"); if (prev) { prev.click(); afterPage(true); } return true; }
    case "Home": focusRow(0); return true;
    case "End": focusRow(rows.length - 1); return true;
    case "Enter": {
      const row = rows[at];
      if (!row) return false;
      if (row.hasAttribute("data-kbd-open") || row.classList.contains("cursor-pointer")) row.click();
      else row.querySelector<HTMLElement>("a[href]")?.click();
      return true;
    }
    case "Escape":
      rows.forEach((r) => r.removeAttribute("data-kbd-row"));
      body.blur();
      return true;
  }
  return false;
}

export function KeyboardNav() {
  const tick = useTickSound();
  const pathname = usePathname();

  useEffect(() => {
    let mode: "sidebar" | "actions" | null = null;
    let index = -1;
    let current: HTMLElement | null = null;

    const clear = () => {
      if (current) {
        current.removeAttribute("data-kbd-cursor");
        current.closest<HTMLElement>("li")?.style.removeProperty("--effect");
      }
      current = null;
      mode = null;
      index = -1;
    };

    const mark = (el: HTMLElement, sidebar: boolean) => {
      if (current && current !== el) {
        current.removeAttribute("data-kbd-cursor");
        current.closest<HTMLElement>("li")?.style.removeProperty("--effect");
      }
      current = el;
      el.setAttribute("data-kbd-cursor", sidebar ? "nav" : "action");
      // Same look as the mouse: the line of a top-level item grows
      if (sidebar && el.closest(".syncro-prox > li") && !el.closest("[data-sidebar=menu-sub]")) el.closest<HTMLElement>("li")?.style.setProperty("--effect", "1");
      el.scrollIntoView({ block: "nearest" });
      tick();
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
      const target = e.target as HTMLElement;

      // 1. Windows: Enter walks the fields
      const win = openWindow();
      if (win) {
        if (e.key !== "Enter" || e.shiftKey || !win.contains(target) || popoverOpen()) return;
        if (win.closest("[data-kbd=custom]") || win.matches("[data-kbd=custom]")) return;
        if (!target.matches("input") || target.matches("[type=checkbox], [type=radio], [type=file]")) return;
        const input = target as HTMLInputElement;
        // A required field doesn't let you through empty
        if ((input.required || input.getAttribute("aria-required") === "true") && !input.value.trim()) { e.preventDefault(); input.setAttribute("aria-invalid", "true"); return; }
        const fields = [...win.querySelectorAll<HTMLElement>(FIELD)].filter(visible);
        const i = fields.indexOf(input);
        e.preventDefault();
        const nextField = fields[i + 1];
        if (nextField) {
          nextField.focus();
          if (nextField instanceof HTMLInputElement) nextField.select?.();
        } else windowSubmit(win)?.click();
        return;
      }

      // From a table's search box, arrow down enters its rows
      if (e.key === "ArrowDown" && target.matches("[data-kbd-search]")) {
        let box: HTMLElement | null = target;
        let body: HTMLElement | null = null;
        for (let i = 0; i < 6 && box && !body; i++) { box = box.parentElement; body = box?.querySelector<HTMLElement>("[data-kbd-table]") ?? null; }
        if (body) { e.preventDefault(); body.focus(); handleTable(new KeyboardEvent("keydown", { key: "ArrowDown" }), body, tick); }
        return;
      }
      // Tab with nothing focused jumps straight to the page's table (instead of walking the whole menu)
      if (e.key === "Tab" && !e.shiftKey && (!document.activeElement || document.activeElement === document.body)) {
        const main = document.querySelector<HTMLElement>("main, [data-slot=sidebar-inset]");
        const body = [...(main?.querySelectorAll<HTMLElement>("[data-kbd-table]") ?? [])].find((b) => visible(b) && tableRows(b).length);
        if (body) { e.preventDefault(); clear(); body.focus(); handleTable(new KeyboardEvent("keydown", { key: "ArrowDown" }), body, tick); return; }
      }

      if (isTyping(document.activeElement) || popoverOpen()) return;
      if (document.activeElement?.closest("[data-kbd-zone]")) return;

      // Inside a table (reached with Tab): its rows and pages
      const body = (document.activeElement as HTMLElement | null)?.closest<HTMLElement>("[data-kbd-table]");
      if (body) {
        if (handleTable(e, body, tick)) { e.preventDefault(); clear(); }
        return;
      }

      // 2. Sidebar
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        const items = sidebarItems();
        if (!items.length) return;
        e.preventDefault();
        if (mode !== "sidebar") {
          clear();
          mode = "sidebar";
          const active = items.findIndex((el) => el.matches('[data-active="true"], [aria-current="page"]') || el.closest('li[data-selected="true"]') === el.closest("li"));
          index = active >= 0 ? active : e.key === "ArrowDown" ? -1 : items.length;
        }
        index = Math.max(0, Math.min(items.length - 1, index + (e.key === "ArrowDown" ? 1 : -1)));
        mark(items[index], true);
        return;
      }

      // 3. Header actions
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        const actions = pageActions();
        if (!actions.length) return;
        e.preventDefault();
        if (mode !== "actions") {
          clear();
          mode = "actions";
          index = e.key === "ArrowRight" ? -1 : actions.length;
        }
        index = (index + (e.key === "ArrowRight" ? 1 : -1) + actions.length) % actions.length;
        mark(actions[index], false);
        return;
      }

      if (e.key === "Escape" && mode) { clear(); return; }

      // 4. Enter: the selected item, else the page's main action
      if (e.key === "Enter") {
        if (target.matches("button, a[href], [role=button]") && !current) return; // a focused control does its own thing
        const el = current ?? primaryAction();
        if (!el) return;
        e.preventDefault();
        const wasSidebar = mode === "sidebar";
        el.click();
        // Opening an accordion keeps the cursor so the sub-items can be reached
        if (!wasSidebar || el.closest("a[href]")) clear();
      }
    };

    // The mouse takes over: drop the keyboard selectors (sidebar, actions and table rows)
    const reset = () => { clear(); document.querySelectorAll("[data-kbd-row]").forEach((r) => r.removeAttribute("data-kbd-row")); };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", reset, true);
    // Only a real mouse movement (not a nudge of the hand) takes over from the keyboard
    let anchor: { x: number; y: number } | null = null;
    const onMove = (e: PointerEvent) => {
      if (!anchor) { anchor = { x: e.clientX, y: e.clientY }; return; }
      if (Math.abs(e.clientX - anchor.x) + Math.abs(e.clientY - anchor.y) > 24) { anchor = null; reset(); }
    };
    const onKeyAnchor = () => { anchor = null; };
    window.addEventListener("keydown", onKeyAnchor, true);
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      clear();
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", reset, true);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("keydown", onKeyAnchor, true);
    };
  }, [pathname, tick]);

  return (
    <style>{`
      [data-kbd-cursor="action"] { outline: 2px solid var(--primary); outline-offset: 3px; border-radius: 8px; }
      [data-kbd-cursor="nav"] { color: var(--primary) !important; }
      [data-sidebar="menu-sub"] [data-kbd-cursor="nav"] { outline: 1.5px solid var(--primary); outline-offset: 1px; border-radius: 6px; }
      [data-kbd-zone] [data-kbd-cell][data-kbd-active="true"] { outline: 2px solid var(--primary); outline-offset: 2px; }
      [data-kbd-table]:focus-visible { box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--primary) 35%, transparent); }
      [data-kbd-table]:focus tr[data-kbd-row] { background: color-mix(in srgb, var(--primary) 9%, transparent); outline: 2px solid var(--primary); outline-offset: -2px; }
      @media (prefers-reduced-motion: reduce) { [data-kbd-cursor] { scroll-behavior: auto; } }
    `}</style>
  );
}
