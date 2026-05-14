"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { usePathname } from "next/navigation";

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  const pathname = usePathname();
  
  let storageKey = "theme";
  if (pathname?.startsWith("/pos")) {
    storageKey = "theme-pos";
  } else if (pathname?.startsWith("/dashboard")) {
    storageKey = "theme-dashboard";
  } else if (pathname?.startsWith("/portal")) {
    storageKey = "theme-portal";
  }

  return <NextThemesProvider {...props} storageKey={storageKey} key={storageKey}>{children}</NextThemesProvider>;
}
