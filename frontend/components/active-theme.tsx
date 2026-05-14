"use client";

import {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import { usePathname } from "next/navigation";

const DEFAULT_THEME = "default";

function setThemeCookie(cookieName: string, theme: string) {
  if (typeof window === "undefined") return;

  document.cookie = `${cookieName}=${theme}; path=/; max-age=31536000; SameSite=Lax; ${
    window.location.protocol === "https:" ? "Secure;" : ""
  }`;
}

function getThemeCookie(cookieName: string) {
  if (typeof window === "undefined") return null;
  const match = document.cookie.match(new RegExp('(^| )' + cookieName + '=([^;]+)'));
  if (match) return match[2];
  return null;
}

type ThemeContextType = {
  activeTheme: string;
  setActiveTheme: (theme: string) => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ActiveThemeProvider({
  children,
  initialTheme,
}: {
  children: ReactNode;
  initialTheme?: string;
}) {
  const pathname = usePathname();
  
  let cookieName = "active_theme";
  if (pathname?.startsWith("/pos")) cookieName = "active_theme_pos";
  else if (pathname?.startsWith("/dashboard")) cookieName = "active_theme_dashboard";
  else if (pathname?.startsWith("/portal")) cookieName = "active_theme_portal";

  const [activeTheme, setActiveTheme] = useState<string>(
    () => {
      const savedTheme = getThemeCookie(cookieName);
      return savedTheme || initialTheme || DEFAULT_THEME;
    }
  );

  useEffect(() => {
    const savedTheme = getThemeCookie(cookieName);
    if (savedTheme && savedTheme !== activeTheme) {
      setActiveTheme(savedTheme);
    } else if (!savedTheme && activeTheme !== DEFAULT_THEME && activeTheme !== initialTheme) {
      setActiveTheme(initialTheme || DEFAULT_THEME);
    }
  }, [cookieName]);

  useEffect(() => {
    setThemeCookie(cookieName, activeTheme);

    Array.from(document.body.classList)
      .filter((className) => className.startsWith("theme-"))
      .forEach((className) => {
        document.body.classList.remove(className);
      });
    document.body.classList.add(`theme-${activeTheme}`);
    if (activeTheme.endsWith("-scaled")) {
      document.body.classList.add("theme-scaled");
    }
  }, [activeTheme, cookieName]);

  return (
    <ThemeContext.Provider value={{ activeTheme, setActiveTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useThemeConfig() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error(
      "useThemeConfig must be used within an ActiveThemeProvider"
    );
  }
  return context;
}
