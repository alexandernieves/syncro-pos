"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { usePathname } from "next/navigation";

export default function FinanceTheme({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const scroll = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (scroll.current) scroll.current.scrollTop = 0;
  }, [pathname]);

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
    <div ref={scroll} className="syncro-finance-scroll">{children}</div>
  </div>;
}
