"use client";

import * as React from "react";
import { API_URL } from "@/lib/constants"
import {
  IconPackage,
  IconBox,
  IconTruck,
  IconShoppingCart,
  IconReportAnalytics,
  IconUsers,
  IconCash,
  IconHistory,
  IconSettings,
  IconHelp,
  IconSearch,
  IconInnerShadowTop,
  IconBuildingStore,
  IconHexagon,
  IconCheck,
  IconChevronDown,
  IconCirclePlusFilled,
  IconMessageCircle,
} from "@tabler/icons-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { NavMain } from "@/components/nav-main";
import { NavSecondary } from "@/components/nav-secondary";
import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { ModuleCustomizerDialog, PRESET_DEFINITIONS } from "@/components/module-customizer-dialog";
import { IconAdjustmentsHorizontal, IconSparkles } from "@tabler/icons-react";

const data = {
  user: {
    name: "Administrador",
    email: "admin@mipos.com",
    avatar: "",
    role: "admin",
    permissions: [] as string[],
  },
  navMain: [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: IconCirclePlusFilled,
      moduleId: "dashboard",
    },
    {
      title: "Punto de Venta",
      url: "/pos",
      icon: IconShoppingCart,
      moduleId: "pos",
    },
    {
      title: "Productos",
      url: "/dashboard/productos",
      icon: IconPackage,
      moduleId: "products",
      items: [
        { title: "Todos los Productos", url: "/dashboard/productos/todos" },
        { title: "Categorías", url: "/dashboard/productos/categorias" },
      ],
    },
    {
      title: "Inventario",
      url: "/dashboard/inventario",
      icon: IconBox,
      moduleId: "inventory",
      items: [
        { title: "Almacén", url: "/dashboard/inventario/almacen" },
        { title: "Compras (OC)", url: "/dashboard/inventario/compras" },
        { title: "Traslados", url: "/dashboard/inventario/traslados" },
        { title: "Alertas de Stock", url: "/dashboard/inventario/alertas" },
        { title: "Conteo", url: "/dashboard/inventario/conteo" },
        { title: "Movimientos", url: "/dashboard/inventario/movimientos" },
      ],
    },
    {
      title: "Proveedores",
      url: "/dashboard/proveedores",
      icon: IconTruck,
      moduleId: "suppliers",
    },
    {
      title: "Reportes",
      url: "/dashboard/reportes",
      icon: IconReportAnalytics,
      moduleId: "reports",
    },
    {
      title: "Clientes",
      url: "/dashboard/clientes",
      icon: IconUsers,
      moduleId: "clients",
      items: [
        { title: "Directorio", url: "/dashboard/clientes" },
        { title: "Cuentas por Cobrar (Fiado)", url: "/dashboard/clientes/creditos", moduleId: "credit" },
        { title: "Chat de WhatsApp", url: "/dashboard/chat", moduleId: "whatsapp" },
      ],
    },
    {
      title: "Contabilidad",
      url: "/dashboard/contabilidad",
      icon: IconCash,
      moduleId: "accounting",
      items: [
        { title: "Resumen", url: "/dashboard/contabilidad" },
        { title: "Gastos (Caja Chica)", url: "/dashboard/contabilidad/gastos" },
        { title: "Cierres de Caja (Turnos)", url: "/dashboard/contabilidad/turnos" },
      ],
    },
    {
      title: "Historial",
      url: "/dashboard/historial",
      icon: IconHistory,
      moduleId: "historial",
    },
    {
      title: "Delivery",
      url: "/dashboard/deliveries",
      icon: IconTruck,
      moduleId: "deliveries",
    },
  ],
  navSecondary: [
    {
      title: "Soporte",
      url: "/dashboard/soporte",
      icon: IconMessageCircle,
    },
    {
      title: "Configuración",
      url: "/dashboard/configuracion",
      icon: IconSettings,
    },
    {
      title: "Ayuda",
      url: "/dashboard/ayuda",
      icon: IconHelp,
    },
    {
      title: "Buscar",
      url: "#",
      icon: IconSearch,
    },
  ],
  navSyncro: [
    {
      title: "Syncro Central",
      url: "/dashboard/syncro",
      icon: IconHexagon,
      items: [
        { title: "Gestión de Negocios", url: "/dashboard/syncro/owners" },
        { title: "Mensajería", url: "/dashboard/syncro/chat" },
        { title: "Feedback de IA", url: "/dashboard/syncro/feedback" },
        { title: "Suscripciones", url: "/dashboard/syncro/subscriptions" },
        { title: "Métricas Globales", url: "/dashboard/syncro/stats" },
        { title: "Auditoría Global", url: "/dashboard/syncro/audit" },
      ],
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const [user, setUser] = React.useState(data.user);
  const [businessName, setBusinessName] = React.useState("SYNCRO POS");
  const [businessType, setBusinessType] = React.useState<string>("GENERAL");
  const [enabledModules, setEnabledModules] = React.useState<string[]>([]);
  const [customizerOpen, setCustomizerOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined") {
      const storedUser = localStorage.getItem("user");
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }

      const storedBusinessName = localStorage.getItem("businessName");
      if (storedBusinessName) {
        setBusinessName(storedBusinessName);
      }

      const storedBusinessType = localStorage.getItem("businessType");
      if (storedBusinessType) {
        setBusinessType(storedBusinessType);
      }

      const storedModules = localStorage.getItem("enabledModules");
      if (storedModules) {
        try {
          setEnabledModules(JSON.parse(storedModules));
        } catch (e) {}
      }

      const fetchConfig = async () => {
        try {
          const token = localStorage.getItem("token");
          const res = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL || `${API_URL}`}/settings`,
            {
              headers: token ? { Authorization: `Bearer ${token}` } : {},
            }
          );
          if (res.ok) {
            const config = await res.json();
            if (config) {
              if (config.businessName) {
                setBusinessName(config.businessName);
                localStorage.setItem("businessName", config.businessName);
              } else {
                setBusinessName("SYNCRO POS");
                localStorage.setItem("businessName", "SYNCRO POS");
              }

              if (config.businessType) {
                setBusinessType(config.businessType);
                localStorage.setItem("businessType", config.businessType);
              }

              if (config.enabledModules && Array.isArray(config.enabledModules)) {
                setEnabledModules(config.enabledModules);
                localStorage.setItem(
                  "enabledModules",
                  JSON.stringify(config.enabledModules)
                );
              }
            }
          }
        } catch (e) {}
      };
      fetchConfig();

      const handleUpdate = () => fetchConfig();
      window.addEventListener("settingsUpdated", handleUpdate);
      return () => window.removeEventListener("settingsUpdated", handleUpdate);
    }
  }, []);

  const filteredNavMain = React.useMemo(() => {
    const isSyncro = user.role === "syncropos";
    if (isSyncro) return data.navSyncro;

    const isAdmin = user.role === "ownerpos" || user.role === "admin";

    // Filtrar primero por módulos activos (si está configurado)
    let moduleFiltered = data.navMain;
    if (enabledModules && enabledModules.length > 0) {
      moduleFiltered = data.navMain
        .filter((item) => {
          if (!item.moduleId || item.moduleId === "dashboard") return true;
          return enabledModules.includes(item.moduleId);
        })
        .map((item) => {
          // Filtrar también sub-ítems específicos si tienen moduleId
          if (item.items && item.items.length > 0) {
            const filteredSubItems = item.items.filter((sub: any) => {
              if (!sub.moduleId) return true;
              return enabledModules.includes(sub.moduleId);
            });
            return { ...item, items: filteredSubItems };
          }
          return item;
        });
    }

    if (isAdmin) return moduleFiltered;
    if (!user.permissions || user.permissions.length === 0) return [];

    return moduleFiltered.filter((item) => {
      const urlStr = item.url.toLowerCase();
      const p = user.permissions as string[];

      if (p.includes("dashboard") && urlStr === "/dashboard") return true;
      if (p.includes("pos") && urlStr === "/pos") return true;
      if (p.includes("productos") && urlStr.includes("/productos")) return true;
      if (p.includes("inventario") && urlStr.includes("/inventario")) return true;
      if (p.includes("proveedores") && urlStr.includes("/proveedores")) return true;
      if (p.includes("reportes") && urlStr.includes("/reportes")) return true;
      if (p.includes("clientes") && urlStr.includes("/clientes")) return true;
      if (p.includes("contabilidad") && urlStr.includes("/contabilidad")) return true;
      if (p.includes("historial") && urlStr.includes("/historial")) return true;
      if (urlStr.includes("/deliveries")) return true;

      return false;
    });
  }, [user, enabledModules]);

  const filteredNavSecondary = React.useMemo(() => {
    const isSyncro = user.role === "syncropos";
    // Support team uses Mensajería from navSyncro — hide Soporte + Configuración
    if (isSyncro) return data.navSecondary.filter(
      i => i.title !== "Configuración" && i.title !== "Soporte"
    );

    const isAdmin = user.role === "ownerpos" || user.role === "admin";
    if (isAdmin) return data.navSecondary;
    if (!user.permissions || user.permissions.length === 0) return [];
    
    return data.navSecondary.filter(item => {
      const urlStr = item.url.toLowerCase();
      if ((user.permissions as string[]).includes("configuracion") && urlStr.includes("/configuracion")) return true;
      if (urlStr.includes("/ayuda") || urlStr === "#") return true;
      // Only ownerpos see Soporte link
      if (urlStr.includes("/soporte") && (user.role === "ownerpos" || user.role === "admin")) return true;
      return false;
    });
  }, [user]);

  if (!mounted) {
    return <Sidebar {...props } className="bg-sidebar" />; // Return an empty sidebar to avoid flash but maintain structure
  }

  return (
    <>
      <Sidebar collapsible="icon" {...props}>
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                size="lg"
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              >
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg overflow-hidden shrink-0">
                  <img src="/syncro.png" alt="Logo" className="size-full object-cover rounded-md" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate font-semibold text-base">{businessName}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="truncate text-xs text-muted-foreground">
                      {user.role === "syncropos" ? "Centro de Soporte" : "Panel de Control"}
                    </span>
                    {businessType && businessType !== "GENERAL" && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded-full font-medium bg-primary/15 text-primary border border-primary/20 shrink-0">
                        {businessType === "BODEGA" ? "Bodega" : businessType === "MODA" ? "Moda" : businessType}
                      </span>
                    )}
                  </div>
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <NavMain items={filteredNavMain} />

          {(user.role === "ownerpos" || user.role === "admin") && (
            <div className="px-3 py-2 mt-2">
              <button
                type="button"
                onClick={() => setCustomizerOpen(true)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium border border-border/70 hover:border-primary/50 bg-card hover:bg-muted/40 transition-colors group text-foreground cursor-pointer shadow-2xs"
              >
                <span className="flex items-center gap-2">
                  <IconAdjustmentsHorizontal className="w-4 h-4 text-primary group-hover:rotate-12 transition-transform" />
                  <span>Personalizar Menú</span>
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground group-hover:text-primary group-hover:bg-primary/10">
                  Adaptar
                </span>
              </button>
            </div>
          )}

          <NavSecondary items={filteredNavSecondary} className="mt-auto" />
        </SidebarContent>
        <SidebarFooter>
          <NavUser user={user} />
        </SidebarFooter>
      </Sidebar>

      <ModuleCustomizerDialog
        open={customizerOpen}
        onOpenChange={setCustomizerOpen}
        currentType={businessType}
        currentModules={enabledModules}
      />
    </>
  );
}
