"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Download, LogOut, Wallet } from "lucide-react";
import { LoginForm } from "@/components/login-form";
import { Button } from "@/components/ui/button";
import { financeGroups, type FinanceSection } from "@/lib/central-finance-navigation";
import FinanceWorkspace from "../dashboard/syncro/finanzas/finance-workspace";

interface InstallEvent extends Event {
  prompt(): Promise<void>;
}

const sessionStore = () => window.matchMedia("(display-mode: standalone)").matches ? sessionStorage : localStorage;

export default function FinanceApp({ section }: { section: FinanceSection }) {
  const [access, setAccess] = useState<"loading" | "login" | "restricted" | "allowed">("loading");
  const [install, setInstall] = useState<InstallEvent>();
  const [standalone, setStandalone] = useState(false);
  const [installHelp, setInstallHelp] = useState(false);

  useEffect(() => {
    const store = sessionStore();
    try {
      const token = store.getItem("token");
      const user = JSON.parse(store.getItem("user") ?? "null");
      const claims = token ? JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))) : null;
      setAccess(!claims || (claims.exp && claims.exp * 1000 <= Date.now()) ? "login" : user?.role === "syncropos" ? "allowed" : "restricted");
    } catch {
      setAccess("login");
    }
    const display = window.matchMedia("(display-mode: standalone)");
    setStandalone(display.matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
    function onInstall(event: Event) {
      event.preventDefault();
      setInstall(event as InstallEvent);
    }
    window.addEventListener("beforeinstallprompt", onInstall);
    return () => window.removeEventListener("beforeinstallprompt", onInstall);
  }, []);

  function logout() {
    const store = sessionStore();
    store.removeItem("token");
    store.removeItem("user");
    document.cookie = "token=; path=/; max-age=0; SameSite=Strict; Secure";
    setAccess("login");
  }

  return <div className="mx-auto min-h-dvh w-full max-w-6xl">
    <header className="border-b bg-background px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/finanzas/" className="flex items-center gap-2 font-semibold"><Wallet className="size-5 text-primary" /> Syncro Finanzas</Link>
        <div className="flex gap-1">
          {!standalone && <Button type="button" size="sm" variant="outline" onClick={() => {
            if (install) void install.prompt().then(() => setInstall(undefined)).catch(() => setInstallHelp(true));
            else setInstallHelp(!installHelp);
          }}><Download /> Instalar</Button>}
          {(access === "allowed" || access === "restricted") && <Button type="button" onClick={logout} size="icon" variant="ghost" aria-label="Cerrar sesión"><LogOut /></Button>}
        </div>
      </div>
      {installHelp && <p className="mt-2 text-sm text-muted-foreground">En iPhone, abre Compartir en Safari y elige Agregar a pantalla de inicio. En Android, abre el menú del navegador y elige Instalar aplicación.</p>}
      {access === "allowed" && <nav className="mt-3 flex gap-1 overflow-x-auto" aria-label="Espacios financieros">
        {financeGroups.map(group => <Button key={group.title} asChild size="sm" variant={group.title === section.group ? "secondary" : "ghost"}>
          <Link href={"/finanzas/" + group.sections[0].slug}>{group.title}</Link>
        </Button>)}
      </nav>}
    </header>
    {access === "allowed" && <>
      <nav className="flex gap-1 overflow-x-auto border-b px-3 py-2" aria-label={section.group}>
        {financeGroups.find(group => group.title === section.group)?.sections.map(item =>
          <Button key={item.slug} asChild size="sm" variant={section.slug === item.slug ? "secondary" : "ghost"}>
            <Link href={"/finanzas/" + item.slug} aria-current={section.slug === item.slug ? "page" : undefined}>{item.title}</Link>
          </Button>)}
      </nav>
      <FinanceWorkspace section={section} mobile />
    </>}
    {access === "loading" && <p className="p-6" role="status">Abriendo Finanzas…</p>}
    {access === "login" && <div className="mx-auto max-w-md p-5"><LoginForm financeTarget="/finanzas/" /></div>}
    {access === "restricted" && <p className="p-6" role="alert">Inicia sesión con una cuenta de Syncro Central para continuar.</p>}
  </div>;
}
