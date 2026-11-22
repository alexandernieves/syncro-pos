"use client";

import { useEffect } from "react";
import { NubiSplash } from "@/components/portal/nubi-splash";

export default function FinanceTheme({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const installed = window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (!installed) return;

    function preventPinch(event: Event) {
      if (event.cancelable) event.preventDefault();
    }
    document.addEventListener("gesturestart", preventPinch, { passive: false });
    document.addEventListener("gesturechange", preventPinch, { passive: false });
    return () => {
      document.removeEventListener("gesturestart", preventPinch);
      document.removeEventListener("gesturechange", preventPinch);
    };
  }, []);

  return <div className="syncro-finance-theme min-h-dvh">
    {children}
    <NubiSplash ready subtitle="FINANZAS" description="Tu dinero, en tu bolsillo" />
  </div>;
}
