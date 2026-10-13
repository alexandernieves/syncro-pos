"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { OpenShiftHost } from "@/components/gym/open-shift-dialog";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { API_URL } from "@/lib/constants";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isMounted, setIsMounted] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    if (pathname && pathname !== "/dashboard/soporte" && pathname !== "/dashboard/soporte/") {
      localStorage.setItem("syncro_last_visited_dashboard_route", pathname);
    }
  }, [pathname]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const runProactiveCheck = async () => {
      try {
        const isMqlStandalone = typeof window !== "undefined" && window.matchMedia("(display-mode: standalone)").matches;
        const token = isMqlStandalone ? sessionStorage.getItem("token") : localStorage.getItem("token");
        if (!token) return;

        await fetch(`${API_URL}/ai-agent/proactive-check`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          }
        });
      } catch (e) {
        console.warn("Failed to run proactive AI check", e);
      }
    };

    runProactiveCheck();

    const interval = setInterval(runProactiveCheck, 600000); // 10 minutes
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  useEffect(() => {
    setIsMounted(true);
    const isMqlStandalone = typeof window !== "undefined" && window.matchMedia("(display-mode: standalone)").matches;
    const token = isMqlStandalone ? sessionStorage.getItem("token") : localStorage.getItem("token");
    const userStr = isMqlStandalone ? sessionStorage.getItem("user") : localStorage.getItem("user");

    if (!token || !userStr) {
      router.replace("/login");
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

      const standalone = isMqlStandalone;
      
      setIsStandalone(standalone);
      if (standalone) {
        if (typeof document !== "undefined") {
          document.documentElement.classList.add("pwa-standalone");
          document.body.classList.add("pwa-standalone");
        }
        if (window.location.pathname !== "/dashboard/soporte" && window.location.pathname !== "/dashboard/soporte/") {
          router.replace("/dashboard/soporte");
          return;
        }
      }

      setIsAuthenticated(true);
    } catch (e) {
      router.replace("/login");
    }
  }, [router]);

  if (!isMounted || !isAuthenticated) return null;

  if (isStandalone) {
    return (
      <div className="fixed inset-0 bg-background overflow-hidden flex flex-col">
        <main className="flex-1 flex flex-col overflow-hidden">
          {children}
        </main>
        <OpenShiftHost />
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
      <OpenShiftHost />
      <AppSidebar variant="inset" />
      {/* La vista es la superficie que sobresale: blanca y elevada sobre el
          armazon gris del sidebar, con la esquina superior izquierda marcada. */}
      <SidebarInset className="overflow-clip rounded-2xl border border-border/70 bg-background shadow-[0_18px_40px_-24px_rgba(26,24,21,0.28)]">
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
