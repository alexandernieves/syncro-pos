"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const token = localStorage.getItem("token");
    const userStr = localStorage.getItem("user");

    if (!token || !userStr) {
      router.replace("/");
      return;
    }

    try {
      const user = JSON.parse(userStr);
      const p = user.permissions || [];
      const isPosOnly = p.includes("pos") && !p.some((perm: string) => perm !== "pos");
      if (isPosOnly || user.role === "pos") {
        router.replace("/pos");
        return;
      }

      const isPwaQuery = typeof window !== "undefined" && window.location.search.includes("pwa=true");
      const isPwaStorage = typeof window !== "undefined" && localStorage.getItem("is_pwa") === "true";
      const isMqlStandalone = typeof window !== "undefined" && window.matchMedia("(display-mode: standalone)").matches;
      const standalone = isMqlStandalone || isPwaQuery || isPwaStorage;

      if (typeof window !== "undefined" && (isPwaQuery || isMqlStandalone)) {
        localStorage.setItem("is_pwa", "true");
      }
      
      setIsStandalone(standalone);
      if (standalone) {
        if (window.location.pathname !== "/dashboard/soporte" && window.location.pathname !== "/dashboard/soporte/") {
          router.replace("/dashboard/soporte");
          return;
        }
      }

      setIsAuthenticated(true);
    } catch (e) {
      router.replace("/");
    }
  }, [router]);

  if (!isMounted || !isAuthenticated) return null;

  if (isStandalone) {
    return (
      <div className="flex flex-col h-screen w-screen bg-background overflow-hidden">
        <main className="flex-1 flex flex-col overflow-hidden">
          {children}
        </main>
      </div>
    );
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset className="rounded-xl overflow-hidden border shadow-sm bg-background/50">
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            {children}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
