"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { POS_THEME_KEY, THEMES, THEME_EVENT, THEME_KEY, type SyncroTheme, adoptServerThemes, applyTheme, themeFor, themedPath } from "@/lib/themes";

let fetched = false;

/** Reads the themes the owner saved (business / branch) and the cashier's own POS one. */
async function loadServerThemes() {
  let user: any = null;
  try {
    user = JSON.parse(localStorage.getItem("user") || sessionStorage.getItem("user") || "null");
  } catch {
    user = null;
  }
  if (!localStorage.getItem("token") || !user?.id) return;
  try {
    const res = await apiFetch("/settings");
    if (!res.ok) return;
    const s = await res.json();
    adoptServerThemes(s?.themes ?? null, { userId: user.id, role: user.role, branchId: localStorage.getItem("currentBranchId") });
  } catch {
    // offline: the copy on this computer stays
  }
}

/**
 * Keeps the chosen theme on the app's pages and off the public ones (landing, Syncro Shop,
 * gym portal) while moving between them without a reload. Once per visit it asks the server
 * which theme the business (or this branch, or this cashier's POS) has saved.
 */
export function ThemeSync() {
  const pathname = usePathname() || "";
  useEffect(() => {
    if (themedPath(pathname)) applyTheme(themeFor(pathname));
    else applyTheme(THEMES[0]);
    if (!fetched && themedPath(pathname) && !pathname.startsWith("/login")) {
      fetched = true;
      void loadServerThemes();
    }
  }, [pathname]);
  return null;
}

/** The theme of the page in view, kept in sync with other tabs and with Configuración. */
export function useSyncroTheme() {
  const pathname = usePathname() || "";
  const [theme, set] = useState<SyncroTheme>(THEMES[0]);
  useEffect(() => {
    const sync = () => set(themeFor(window.location.pathname));
    sync();
    const onStorage = (e: StorageEvent) => {
      if (e.key !== THEME_KEY && e.key !== POS_THEME_KEY && e.key !== null) return;
      const t = themeFor(window.location.pathname);
      if (themedPath(window.location.pathname)) applyTheme(t);
      set(t);
    };
    window.addEventListener(THEME_EVENT, sync);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(THEME_EVENT, sync);
      window.removeEventListener("storage", onStorage);
    };
  }, [pathname]);
  return { theme };
}
