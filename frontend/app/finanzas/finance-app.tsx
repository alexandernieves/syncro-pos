"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, ChevronDown, House, Landmark, LogOut, Receipt, Wallet } from "lucide-react";
import { NubiFace } from "@/components/portal/nubi-face";
import { syncThemeColor } from "@/components/portal/nubi-splash";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { financeGroups, type FinanceSection } from "@/lib/central-finance-navigation";
import { cn } from "@/lib/utils";
import FinanceWorkspace from "../dashboard/syncro/finanzas/finance-workspace";
import FinanceInstallation from "./finance-installation";
import FinanceLogin, { financeSessionStore, type FinanceUser } from "./finance-login";

const navIcons = {
  "Resumen": House,
  "Gastos": Receipt,
  "Presupuesto": CalendarDays,
  "Libro diario": Wallet,
  "Estados financieros": Landmark,
  "Deudas": Landmark,
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

  function logout() {
    const store = financeSessionStore();
    store.removeItem("token");
    store.removeItem("user");
    document.cookie = "token=; path=/; max-age=0; SameSite=Strict; Secure";
    window.dispatchEvent(new Event("syncro_session_activity"));
    setUser(null);
  }

  if (user === undefined) return <p className="p-6" role="status">Abriendo Syncro Finanzas…</p>;
  if (!user) return <FinanceLogin onLogin={setUser} />;
  if (!section) return <FinanceInstallation />;

  const group = financeGroups.find(item => item.title === section.group);
  const navSections = group?.workspace === "personal"
    ? [group.sections[0], group.sections[1], group.sections[3], group.sections[2], group.sections[4]]
    : group?.sections;
  const firstName = user.name?.trim().split(/\s+/)[0];
  const personalHome = section.slug === "resumen-personal";

  return <div className="relative isolate min-h-dvh pb-[calc(env(safe-area-inset-bottom)+100px)]">
    <div className="sc-hero pointer-events-none absolute inset-x-0 top-0 -z-10" aria-hidden />
    <svg className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[300px] w-full opacity-40" aria-hidden viewBox="0 0 390 300" preserveAspectRatio="none">
      <path d="M-10 230 Q40 120 90 210 Q140 110 190 200 Q240 100 290 190 Q340 95 400 170" fill="none" stroke="white" strokeWidth="2" strokeDasharray="1.5 8" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
    <div className="mx-auto max-w-md">
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
    <nav className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+12px)] z-40 mx-auto flex min-h-16 max-w-sm items-center justify-around gap-1 rounded-full bg-white px-2 py-2 shadow-[0_8px_25px_rgba(139,92,26,0.18)]" aria-label={section.group}>
      {navSections?.map(item => {
        const Icon = navIcons[item.tab];
        const active = section.slug === item.slug;
        const raised = group?.workspace === "personal" && item.tab === "Libro diario";
        const label = item.tab === "Resumen" && group?.workspace === "personal" ? "Inicio"
          : item.tab === "Libro diario" && group?.workspace === "personal" ? "Movimientos" : item.title;
        return <Link key={item.slug} href={"/finanzas/" + item.slug}
          aria-current={active ? "page" : undefined} className={cn(
            "flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-full px-1 text-center text-[9px] font-semibold leading-tight focus-visible:outline-2 focus-visible:outline-primary sm:text-[10px]",
            raised ? "relative z-10" : active ? "bg-amber-100 text-amber-800" : "text-zinc-600 hover:bg-zinc-100",
          )}>
          {raised
            ? <><span className="absolute -top-[28px] grid size-14 place-items-center rounded-full bg-white shadow-[0_-3px_10px_rgba(139,92,26,0.08)]">
                <span className={cn("grid size-11 place-items-center rounded-full", active ? "bg-amber-100 text-amber-800" : "bg-primary text-primary-foreground")}><Icon className="size-5" aria-hidden /></span>
              </span><span className={cn("pt-7", active ? "text-amber-800" : "text-zinc-600")}>{label}</span></>
            : <><Icon className="size-[17px] shrink-0" aria-hidden />{label}</>}
        </Link>;
      })}
    </nav>
  </div>;
}
