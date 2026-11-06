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
  IconTarget,
  IconFaceId,
  IconChartBar,
  IconTool,
  IconUsersGroup,
  IconHelp,
  IconSearch,
  IconInnerShadowTop,
  IconBuildingStore,
  IconHexagon,
  IconCheck,
  IconChevronDown,
  IconCirclePlusFilled,
  IconMessageCircle,
  IconApps,
  IconBulb,
  IconPuzzle,
  IconBarbell,
  IconArrowLeft,
  IconLayoutDashboard,
  IconId,
  IconCalendarRepeat,
  IconDoorEnter,
  IconBellRinging,
  IconCalendarEvent,
} from "@tabler/icons-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

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
import { DesktopVersion } from "@/components/desktop-update-badge";
import { useMyModules } from "@/lib/modules";
import { FeatureRequestDialog } from "@/components/feature-request-dialog";
import { IconSparkles } from "@tabler/icons-react";

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
      title: "Punto de venta",
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
        { title: "Todos los productos", url: "/dashboard/productos/todos" },
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
        { title: "Compras (oc)", url: "/dashboard/inventario/compras" },
        { title: "Traslados", url: "/dashboard/inventario/traslados" },
        { title: "Alertas de stock", url: "/dashboard/inventario/alertas" },
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
        { title: "Cuentas por cobrar (fiado)", url: "/dashboard/clientes/creditos", moduleId: "credit" },
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
        { title: "Ingresos y egresos", url: "/dashboard/contabilidad/movimientos" },
        { title: "Cierres de caja (turnos)", url: "/dashboard/contabilidad/turnos" },
      ],
    },
    {
      title: "Historial",
      url: "/dashboard/historial",
      icon: IconHistory,
      moduleId: "historial",
    },
    {
      title: "Syncro Shop",
      url: "/dashboard/syncro-shop",
      icon: IconBuildingStore,
      moduleId: "syncroshop",
    },
    {
      title: "Delivery",
      url: "/dashboard/deliveries",
      icon: IconTruck,
      moduleId: "deliveries",
      soon: true,
    },
    {
      title: "Gimnasio",
      url: "/dashboard/gimnasio",
      icon: IconBarbell,
      moduleId: "gym",
    },
  ],
  // Gym workspace: replaces the whole menu while inside /dashboard/gimnasio
  navGym: [
    { title: "Resumen", url: "/dashboard/gimnasio", icon: IconLayoutDashboard },
    { title: "Recepción", url: "/dashboard/gimnasio/recepcion", icon: IconDoorEnter },
    { title: "Control de acceso", url: "/dashboard/gimnasio/acceso", icon: IconFaceId },
    { title: "Socios", url: "/dashboard/gimnasio/socios", icon: IconId },
    { title: "Clases", url: "/dashboard/gimnasio/clases", icon: IconCalendarEvent },
    { title: "Prospectos", url: "/dashboard/gimnasio/prospectos", icon: IconTarget },
    { title: "Personal", url: "/dashboard/gimnasio/personal", icon: IconUsersGroup },
    { title: "Entrenamiento", url: "/dashboard/gimnasio/entrenamiento", icon: IconBarbell },
    { title: "Equipos", url: "/dashboard/gimnasio/equipos", icon: IconTool },
    { title: "Planes y membresías", url: "/dashboard/gimnasio/planes", icon: IconCalendarRepeat },
    { title: "Reportes", url: "/dashboard/gimnasio/reportes", icon: IconChartBar },
    { title: "Recordatorios", url: "/dashboard/gimnasio/recordatorios", icon: IconBellRinging },
    { title: "Ajustes", url: "/dashboard/gimnasio/ajustes", icon: IconSettings },
    { title: "Punto de venta", url: "/pos", icon: IconShoppingCart },
  ],
  navSecondary: [
    {
      title: "Tienda de módulos",
      url: "/dashboard/tienda",
      icon: IconApps,
    },
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
      title: "Syncro central",
      url: "/dashboard/syncro",
      icon: IconHexagon,
      items: [
        { title: "Gestión de negocios", url: "/dashboard/syncro/owners" },
        { title: "Mensajería", url: "/dashboard/syncro/chat" },
        { title: "Solicitudes", url: "/dashboard/syncro/requests" },
        { title: "Feedback de IA", url: "/dashboard/syncro/feedback" },
        { title: "Suscripciones", url: "/dashboard/syncro/subscriptions" },
        { title: "Métricas globales", url: "/dashboard/syncro/stats" },
        { title: "Auditoría global", url: "/dashboard/syncro/audit" },
      ],
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const [user, setUser] = React.useState(data.user);
  const [businessName, setBusinessName] = React.useState("SYNCRO CRM");
  const [businessType, setBusinessType] = React.useState<string>("GENERAL");
  const [enabledModules, setEnabledModules] = React.useState<string[]>([]);
  const [isSyncroVendor, setIsSyncroVendor] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const pathname = usePathname() || "";
  const gymMode = pathname.startsWith("/dashboard/gimnasio");
  // Inside the gym, show only the parts of the module this business has turned on
  const myModules = useMyModules();
  const gymModule = myModules?.find((m) => m.code === "gym");
  const gymNav = React.useMemo(() => {
    if (!gymModule) return data.navGym;
    const on = new Set(gymModule.features.map((f) => f.route));
    const base = data.navGym.filter((item) => !gymModule.gatedRoutes.includes(item.url) || on.has(item.url));
    // Functions built only for this business get their own entry, before Ajustes
    const known = new Set(data.navGym.map((i) => i.url));
    const extra = gymModule.features.filter((f) => f.route && !known.has(f.route)).map((f) => ({ title: f.label, url: f.route!, icon: IconPuzzle }));
    const at = base.findIndex((i) => i.url === "/dashboard/gimnasio/ajustes");
    return at < 0 ? [...base, ...extra] : [...base.slice(0, at), ...extra, ...base.slice(at)];
  }, [gymModule]);
  const [askingFeature, setAskingFeature] = React.useState(false);

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

      const storedVendor = localStorage.getItem("isSyncroVendor");
      if (storedVendor !== null) {
        setIsSyncroVendor(storedVendor === "true");
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
              if (config.isSyncroVendor !== undefined) {
                setIsSyncroVendor(Boolean(config.isSyncroVendor));
                localStorage.setItem("isSyncroVendor", String(config.isSyncroVendor));
              }

              if (config.businessName) {
                setBusinessName(config.businessName);
                localStorage.setItem("businessName", config.businessName);
              } else {
                setBusinessName("SYNCRO CRM");
                localStorage.setItem("businessName", "SYNCRO CRM");
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

      const handleUpdate = () => {
        const storedVendor = localStorage.getItem("isSyncroVendor");
        if (storedVendor !== null) {
          setIsSyncroVendor(storedVendor === "true");
        }
        fetchConfig();
      };
      window.addEventListener("settingsUpdated", handleUpdate);
      return () => window.removeEventListener("settingsUpdated", handleUpdate);
    }
  }, []);

  const filteredNavMain = React.useMemo(() => {
    const isSyncro = user.role === "syncropos";
    if (isSyncro) return data.navSyncro;

    const isAdmin = user.role === "ownerpos" || user.role === "admin";

    // Filter items based on isSyncroVendor toggle and enabledModules
    let moduleFiltered = data.navMain
      .filter((item) => {
        if (item.moduleId === "syncroshop") {
          return isSyncroVendor;
        }
        // Packaged modules follow what Syncro central turned on (fresh), not the saved list
        if (item.moduleId === "gym" && myModules) return !!myModules.find((m) => m.code === "gym")?.usable;
        if (!item.moduleId || item.moduleId === "dashboard") return true;
        if (enabledModules && enabledModules.length > 0) {
          return enabledModules.includes(item.moduleId);
        }
        return true;
      })
      .map((item) => {
        if (enabledModules && enabledModules.length > 0 && item.items && item.items.length > 0) {
          const filteredSubItems = item.items.filter((sub: any) => {
            if (!sub.moduleId) return true;
            return enabledModules.includes(sub.moduleId);
          });
          return { ...item, items: filteredSubItems };
        }
        return item;
      });

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
      if (item.moduleId === "syncroshop") return isSyncroVendor;
      if (urlStr.includes("/deliveries")) return true;
      if (p.includes("gimnasio") && urlStr.includes("/gimnasio")) return true;

      return false;
    });
  }, [user, isSyncroVendor, enabledModules, myModules]);

  const filteredNavSecondary = React.useMemo(() => {
    const isSyncro = user.role === "syncropos";
    // Support team uses Mensajería from navSyncro — hide Soporte + Configuración
    if (isSyncro) return data.navSecondary.filter(
      i => i.title !== "Configuración" && i.title !== "Soporte" && i.url !== "/dashboard/tienda"
    );

    // Only the owner asks for modules
    const isOwner = user.role === "ownerpos" || user.role === "owner";
    const isAdmin = user.role === "ownerpos" || user.role === "admin";
    if (isAdmin) return data.navSecondary.filter((i) => isOwner || i.url !== "/dashboard/tienda");
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
        {gymMode ? (
          <SidebarHeader className="gap-0 p-0">
            <div className="px-3 pb-1 pt-3">
              <Link
                href="/dashboard"
                title="Volver a Syncro"
                aria-label="Volver a Syncro"
                className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
              >
                <IconArrowLeft size={20} />
              </Link>
            </div>
          </SidebarHeader>
        ) : (
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
                        {user.role === "syncropos" ? "Centro de soporte" : "Panel de control"}
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
        )}
        <SidebarContent className="overflow-x-hidden">
          {/* The menu slides when switching between Syncro and the gym workspace */}
          <div key={gymMode ? "gym" : "main"} className={gymMode ? "animate-in slide-in-from-right-full fade-in duration-300" : "animate-in slide-in-from-left-full fade-in duration-300"}>
            {gymMode ? (
              <>
                <NavMain items={gymNav} />
                {(user.role === "ownerpos" || user.role === "owner") && (
                  <SidebarMenu className="px-2 pl-[72px]">
                    <SidebarMenuItem>
                      <SidebarMenuButton onClick={() => setAskingFeature(true)} tooltip="Pedir una función" className="text-muted-foreground hover:text-foreground">
                        <IconBulb />
                        <span>¿Te falta algo? Pídelo</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarMenu>
                )}
                <FeatureRequestDialog
                  open={askingFeature}
                  onClose={() => setAskingFeature(false)}
                  moduleCode="gym"
                  moduleName="Gimnasio"
                  sections={gymNav.filter((i) => i.url.startsWith("/dashboard/gimnasio/")).map((i) => i.title)}
                />
              </>
            ) : (
              <>
                <NavMain items={filteredNavMain} />
                {(user.role === "ownerpos" || user.role === "owner") && (
                  <>
                    <SidebarMenu className="px-2">
                      <SidebarMenuItem>
                        <SidebarMenuButton onClick={() => setAskingFeature(true)} tooltip="¿Te falta algo? Pídelo" className="text-muted-foreground hover:text-foreground">
                          <IconBulb />
                          <span>¿Te falta algo? Pídelo</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    </SidebarMenu>
                    <FeatureRequestDialog
                      open={askingFeature}
                      onClose={() => setAskingFeature(false)}
                      moduleCode="core"
                      moduleName="Syncro"
                      sections={filteredNavMain.filter((i) => !i.soon).flatMap((i) => (i.items?.length ? i.items.map((sub) => `${i.title} · ${sub.title}`) : [i.title]))}
                      examples={{
                        title: "Ej.: Productos por lote, Etiquetas con precio, Pedidos a proveedores",
                        problem: "Ej.: vendemos medicinas y necesitamos controlar el vencimiento de cada lote en el inventario…",
                        process: "Ej.: en una hoja de Excel aparte",
                      }}
                    />
                  </>
                )}
              </>
            )}
          </div>

          <NavSecondary items={filteredNavSecondary} className="mt-auto" />
        </SidebarContent>
        <SidebarFooter>
          <NavUser user={user} />
          <DesktopVersion />
        </SidebarFooter>
      </Sidebar>
    </>
  );
}
