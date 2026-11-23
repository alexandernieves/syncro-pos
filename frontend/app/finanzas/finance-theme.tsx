"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { NubiSplash } from "@/components/portal/nubi-splash";

export default function FinanceTheme({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const scroll = useRef<HTMLDivElement>(null);
  const [bootReady, setBootReady] = useState(false);

  useLayoutEffect(() => {
    if (scroll.current) scroll.current.scrollTop = 0;
  }, [pathname]);

  useEffect(() => {
    const markReady = () => setBootReady(true);
    window.addEventListener("syncro_finance_boot_ready", markReady);
    const fallback = window.setTimeout(markReady, 1200);
    return () => {
      window.removeEventListener("syncro_finance_boot_ready", markReady);
      window.clearTimeout(fallback);
    };
  }, []);

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

  return <div className="syncro-finance-theme">
    <NubiSplash ready={bootReady} subtitle="FINANZAS" description="Tu dinero, en tu bolsillo" />
    <div ref={scroll} className="syncro-finance-scroll">{children}</div>
  </div>;
}
