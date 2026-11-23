"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, ChevronDown, House, Landmark, LogOut, MessageCircle, Receipt, Wallet } from "lucide-react";
import { NubiTabBar, nubiCenterSlotClass, nubiCenterTabClass, nubiTabClass } from "@/components/portal/nubi-tab-bar";
import { NubiFace } from "@/components/portal/nubi-face";
import { syncThemeColor } from "@/components/portal/nubi-splash";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { financeGroups, type FinanceSection } from "@/lib/central-finance-navigation";
import FinanceWorkspace from "../dashboard/syncro/finanzas/finance-workspace";
import { FinanceSkeleton } from "../dashboard/syncro/finanzas/finance-skeleton";
import FinanceInstallation from "./finance-installation";
import FinanceLogin, { financeSessionStore, type FinanceUser } from "./finance-login";

const navIcons = {
  "Resumen": House,
  "Gastos": Receipt,
  "Presupuesto": CalendarDays,
  "Libro diario": Wallet,
  "Estados financieros": Landmark,
  "Deudas": Landmark,
  "Fiscal": Receipt,
  "Nubi": MessageCircle,
};

export default function FinanceApp({ section }: { section?: FinanceSection }) {
  const [user, setUser] = useState<FinanceUser | null | undefined>(undefined);
  useEffect(() => {
    try {
      const store = financeSessionStore();
      const token = store.getItem("token");
      const account = JSON.parse(store.getItem("user") ?? "null") as FinanceUser | null;
      const claims = token ? JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))) : null;
      setUser(claims && claims.exp * 1000 > Date.now() && account?.role === "syncropos" ? account : null);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => { syncThemeColor(); }, [user, section]);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("syncro-finance-session");
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
    sessionStorage.removeItem("syncro-finance-session");
    document.cookie = "token=; path=/; max-age=0; SameSite=Strict; Secure";
    window.dispatchEvent(new Event("syncro_session_activity"));
    setUser(null);
  }, []);

  useEffect(() => {
    window.addEventListener("syncro_finance_session_expired", logout);
    return () => window.removeEventListener("syncro_finance_session_expired", logout);
  }, [logout]);

  if (user === undefined) return <main className="mx-auto max-w-md px-4 pt-[calc(env(safe-area-inset-top)+14px)]"><FinanceSkeleton mobile session /></main>;
  if (!user) return <FinanceLogin onLogin={setUser} />;
  if (!section) return <FinanceInstallation />;

  const group = financeGroups.find(item => item.title === section.group);
  const navSections = group?.workspace === "personal"
    ? [group.sections[0], group.sections[1], group.sections[3], group.sections[2], group.sections[4]]
    : group?.sections;
  const firstName = user.name?.trim().split(/\s+/)[0];
  const personalHome = section.slug === "resumen-personal";

  return <div className="relative isolate min-h-dvh min-w-0 w-full pb-[calc(env(safe-area-inset-bottom)+100px)]">
    <div className="sc-hero pointer-events-none absolute inset-x-0 top-0 -z-10" aria-hidden />
    <svg className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[300px] w-full opacity-40" aria-hidden viewBox="0 0 390 300" preserveAspectRatio="none">
      <path d="M-10 230 Q40 120 90 210 Q140 110 190 200 Q240 100 290 190 Q340 95 400 170" fill="none" stroke="white" strokeWidth="2" strokeDasharray="1.5 8" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
    <div className="mx-auto w-full min-w-0 max-w-md">
      <header className="px-5 pt-[calc(env(safe-area-inset-top)+14px)]">
        <div className="flex min-h-11 items-center justify-between gap-2">
          <Link href="/finanzas/" className="flex items-center gap-2 text-sm font-semibold text-white"><Wallet className="size-4" aria-hidden /> Syncro Finanzas</Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" size="sm" className="rounded-full border border-white/30 bg-white/15 text-white hover:bg-white/25" aria-label="Cambiar espacio financiero">
                {section.group} <ChevronDown />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-44 rounded-2xl">
              {financeGroups.map(item => <DropdownMenuItem key={item.title} asChild>
                <Link href={"/finanzas/" + item.sections[0].slug}>{item.title}</Link>
              </DropdownMenuItem>)}
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild><Link href={section.workspace === "company" ? "/finanzas/fiscal-empresa" : "/finanzas/fiscal-personal"}><Receipt /> Registro fiscal</Link></DropdownMenuItem>
              <DropdownMenuItem onSelect={logout}><LogOut /> Cerrar sesión</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="relative mt-4 flex min-h-20 items-center pr-24">
          <div>
            <h1 className="text-[30px] font-bold leading-tight text-white">{personalHome ? firstName ? `Hola, ${firstName}` : "Mis finanzas" : section.title}</h1>
            {personalHome && <p className="mt-1 text-sm font-medium text-white/90">Tu dinero, en tu bolsillo</p>}
          </div>
          <NubiFace className="!absolute -right-1 top-0 size-[84px]" mood={personalHome ? "happy" : "neutral"} />
        </div>
      </header>
      <FinanceWorkspace section={section} mobile />
    </div>
    <NubiTabBar docked label={section.group} raised={group?.workspace === "personal"}>
      {navSections?.map(item => {
        const Icon = navIcons[item.tab];
        const active = section.slug === item.slug;
        const personal = group?.workspace === "personal";
        const label = item.tab === "Resumen" && personal ? "Inicio" : item.title;
        const href = "/finanzas/" + item.slug;
        if (personal && item.tab === "Libro diario") {
          return <div key={item.slug} className={nubiCenterSlotClass}>
            <Link href={href} aria-label="Movimientos" aria-current={active ? "page" : undefined} className={nubiCenterTabClass(active)}>
              <Icon className="size-[26px]" aria-hidden />
            </Link>
          </div>;
        }
        return <Link key={item.slug} href={href} aria-current={active ? "page" : undefined} className={nubiTabClass(active)}>
          <Icon className="size-[18px]" aria-hidden />{label}
        </Link>;
      })}
    </NubiTabBar>
  </div>;
}
