import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeSelector } from "./theme-selector";
import { ModeSwitcher } from "./mode-switcher";
import { BranchSwitcher } from "./branch-switcher";
import { NotificationBell } from "./notification-bell";
import { useCurrency } from "@/context/CurrencyContext";
import { cn } from "@/lib/utils";
import { IconRefresh, IconChevronDown } from "@tabler/icons-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function SiteHeader() {
  const { currency, setCurrency, exchangeRate, bcvDate, syncBcvDashboard } = useCurrency();
  const [isSyncing, setIsSyncing] = useState(false);

  const userStr = typeof window !== 'undefined' ? localStorage.getItem("user") : null;
  let user = null;
  try {
    user = userStr ? JSON.parse(userStr) : null;
  } catch (e) {
    console.error("Error parsing user from localStorage", e);
  }
  const isSyncro = user?.role === "syncropos";

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const ok = await syncBcvDashboard();
      if (ok) {
        toast.success("Tasas BCV actualizadas correctamente");
      } else {
        toast.error("No se pudo obtener la tasa oficial");
      }
    } catch (e) {
      toast.error("Error de conexión con el servidor");
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <header className="h-(--header-height) bg-background border-b px-4 lg:px-6 flex items-center justify-between sticky top-0 z-10 shrink-0">
      <div className="flex items-center gap-4">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        
        <div className="flex items-center gap-2">
           {/* Removed incorrect system name */}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* FECHA VALOR STACKED (AS REQUESTED) */}
        {!isSyncro && (
          <div className="hidden lg:flex flex-col items-end mr-2">
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-tight leading-none opacity-50">Fecha Valor</p>
            <p className="text-[11px] font-bold text-foreground/80 leading-none mt-1.5">{bcvDate || "No disponible"}</p>
          </div>
        )}

        {!isSyncro && (
          <div className="flex items-center gap-1.5">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-9 px-3 gap-2 font-semibold text-[12px] bg-muted/20 border-border/40 hover:bg-muted/40 rounded-md transition-all shadow-none">
                  {currency} <IconChevronDown size={14} className="text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-24 border-none shadow-2xl rounded-xl p-1">
                {(["USD", "VES", "EUR"] as const).map((c) => (
                  <DropdownMenuItem 
                    key={c} 
                    onClick={() => setCurrency(c)}
                    className="text-[11px] font-bold uppercase py-2 rounded-lg cursor-pointer"
                  >
                    {c}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button 
              variant="outline" 
              className="h-9 px-3 gap-2 font-semibold text-[12px] bg-muted/20 border-border/40 hover:bg-muted/40 rounded-md transition-all shadow-none"
              onClick={handleSync}
              disabled={isSyncing}
            >
              <IconRefresh size={14} className={cn("text-primary", isSyncing && "animate-spin")} />
              <span>BCV: {exchangeRate.toFixed(2)}</span>
            </Button>
          </div>
        )}
        
        {/* Hiding currency/sync for Syncro role */}
        
        <Separator orientation="vertical" className="h-6 mx-1" />
        
        {(() => {
          const isPos = user?.role === 'pos' || user?.role === 'Cajero';
          return !isPos && !isSyncro ? <NotificationBell /> : null;
        })()}
        {!isSyncro && <BranchSwitcher />}
        <div className="flex items-center gap-1.5">
          <ThemeSelector />
          <ModeSwitcher />
        </div>
      </div>
    </header>
  );
}
