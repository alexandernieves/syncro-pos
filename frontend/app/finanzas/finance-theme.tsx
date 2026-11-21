"use client";

import { NubiSplash } from "@/components/portal/nubi-splash";

export default function FinanceTheme({ children }: { children: React.ReactNode }) {
  return <div className="syncro-finance-theme min-h-dvh">
    {children}
    <NubiSplash ready subtitle="FINANZAS" description="Tu dinero, en tu bolsillo" />
  </div>;
}
