"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LogOut, Wallet } from "lucide-react";
import { LoginForm } from "@/components/login-form";
import { Button } from "@/components/ui/button";
import { financeGroups, type FinanceSection } from "@/lib/central-finance-navigation";
import FinanceWorkspace from "../dashboard/syncro/finanzas/finance-workspace";
import FinanceInstallation from "./finance-installation";

const sessionStore = () => window.matchMedia("(display-mode: standalone)").matches ? sessionStorage : localStorage;

export default function FinanceApp({ section }: { section?: FinanceSection }) {
  const [access, setAccess] = useState<"loading" | "login" | "restricted" | "allowed">("loading");
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
        {(access === "allowed" || access === "restricted") && <Button type="button" onClick={logout} size="icon" variant="ghost" aria-label="Cerrar sesión"><LogOut /></Button>}
      </div>
      {access === "allowed" && section && <nav className="mt-3 flex gap-1 overflow-x-auto" aria-label="Espacios financieros">
        {financeGroups.map(group => <Button key={group.title} asChild size="sm" variant={group.title === section.group ? "secondary" : "ghost"}>
          <Link href={"/finanzas/" + group.sections[0].slug}>{group.title}</Link>
        </Button>)}
      </nav>}
    </header>
    {access === "allowed" && section && <>
      <nav className="flex gap-1 overflow-x-auto border-b px-3 py-2" aria-label={section.group}>
        {financeGroups.find(group => group.title === section.group)?.sections.map(item =>
          <Button key={item.slug} asChild size="sm" variant={section.slug === item.slug ? "secondary" : "ghost"}>
            <Link href={"/finanzas/" + item.slug} aria-current={section.slug === item.slug ? "page" : undefined}>{item.title}</Link>
          </Button>)}
      </nav>
      <FinanceWorkspace section={section} mobile />
    </>}
    {access === "allowed" && !section && <FinanceInstallation />}
    {access === "loading" && <p className="p-6" role="status">Abriendo Finanzas…</p>}
    {access === "login" && <div className="mx-auto max-w-md p-5"><LoginForm financeTarget={section ? "/finanzas/" : "/finanzas/instalar/"} /></div>}
    {access === "restricted" && <p className="p-6" role="alert">Inicia sesión con una cuenta de Syncro Central para continuar.</p>}
  </div>;
}
