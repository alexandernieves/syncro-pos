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

      if (isTyping(document.activeElement) || popoverOpen()) return;
      if (document.activeElement?.closest("[data-kbd-zone]")) return;

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

    const reset = () => clear();
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", reset, true);
    window.addEventListener("pointermove", reset, { passive: true });
    return () => {
      clear();
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", reset, true);
      window.removeEventListener("pointermove", reset);
    };
  }, [pathname, tick]);

  return (
    <style>{`
      [data-kbd-cursor="action"] { outline: 2px solid var(--primary); outline-offset: 3px; border-radius: 8px; }
      [data-kbd-cursor="nav"] { color: var(--primary) !important; }
      [data-sidebar="menu-sub"] [data-kbd-cursor="nav"] { outline: 1.5px solid var(--primary); outline-offset: 1px; border-radius: 6px; }
      [data-kbd-zone] [data-kbd-cell][data-kbd-active="true"] { outline: 2px solid var(--primary); outline-offset: 2px; }
      @media (prefers-reduced-motion: reduce) { [data-kbd-cursor] { scroll-behavior: auto; } }
    `}</style>
  );
}
