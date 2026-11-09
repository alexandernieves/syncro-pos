"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { THEMES, THEME_EVENT, THEME_KEY, type SyncroTheme, type ThemeId, applyTheme, setTheme, storedTheme, themedPath } from "@/lib/themes";

/**
 * Keeps the chosen theme on the app's pages and off the public ones (landing, Syncro Shop,
 * gym portal) while moving between them without a reload.
 */
export function ThemeSync() {
  const pathname = usePathname() || "";
  useEffect(() => {
    if (themedPath(pathname)) applyTheme(storedTheme());
    else applyTheme(THEMES[0]);
  }, [pathname]);
  return null;
}

/** The current theme, kept in sync with other tabs and with Configuración. */
export function useSyncroTheme() {
  const [theme, set] = useState<SyncroTheme>(THEMES[0]);
  useEffect(() => {
    const sync = () => set(storedTheme());
    sync();
    const onStorage = (e: StorageEvent) => {
      if (e.key !== THEME_KEY && e.key !== null) return;
      const t = storedTheme();
      if (themedPath(window.location.pathname)) applyTheme(t);
      set(t);
    };
    window.addEventListener(THEME_EVENT, sync);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(THEME_EVENT, sync);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  const choose = useCallback((id: ThemeId) => setTheme(id), []);
  return { theme, setTheme: choose };
}

