"use client";

import * as React from "react";
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

const data = {
  user: {
    name: "Administrador",
    email: "admin@mipos.com",
    avatar: "/avatars/shadcn.jpg",
  },
  navMain: [
    {
      title: "Punto de Venta",
      url: "/pos",
      icon: IconShoppingCart,
    },
    {
      title: "Productos",
      url: "/dashboard/productos",
      icon: IconPackage,
      items: [
        { title: "Todos los Productos", url: "/dashboard/productos/todos" },
        { title: "Categorías", url: "/dashboard/productos/categorias" },
      ],
    },
    {
      title: "Inventario",
      url: "/dashboard/inventario",
      icon: IconBox,
      items: [
        { title: "Almacén", url: "/dashboard/inventario/almacen" },
        { title: "Conteo", url: "/dashboard/inventario/conteo" },
        { title: "Ingreso", url: "/dashboard/inventario/ingreso" },
        { title: "Movimientos", url: "/dashboard/inventario/movimientos" },
      ],
    },
    {
      title: "Proveedores",
      url: "/dashboard/proveedores",
      icon: IconTruck,
    },
    {
      title: "Reportes",
      url: "/dashboard/reportes",
      icon: IconReportAnalytics,
    },
    {
      title: "Clientes",
      url: "/dashboard/clientes",
      icon: IconUsers,
    },
    {
      title: "Contabilidad",
      url: "/dashboard/contabilidad",
      icon: IconCash,
    },
    {
      title: "Historial",
      url: "/dashboard/historial",
      icon: IconHistory,
    },
  ],
  navSecondary: [
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
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const [user, setUser] = React.useState(data.user);
  const [businessName, setBusinessName] = React.useState("SYNCRO POS");
  const [activeLogo, setActiveLogo] = React.useState<string>("/syncro.png");
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
      
      const fetchConfig = async () => {
        try {
          const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000"}/settings`);
          if(res.ok) {
            const config = await res.json();
            if(config) {
              if (config.businessName) {
                setBusinessName(config.businessName);
                localStorage.setItem("businessName", config.businessName);
              }
            }
          }
        } catch(e) {}
      };
      fetchConfig();

      const handleUpdate = () => fetchConfig();
      window.addEventListener("settingsUpdated", handleUpdate);
      return () => window.removeEventListener("settingsUpdated", handleUpdate);
    }
  }, []);

  if (!mounted) {
    return <Sidebar {...props } className="bg-sidebar" />; // Return an empty sidebar to avoid flash but maintain structure
  }

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg overflow-hidden">
                    <img src="/syncro.png" alt="Logo" className="size-full object-cover rounded-md" />
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold text-base">{businessName}</span>
                    <span className="truncate text-xs text-muted-foreground">Panel de Control</span>
                  </div>
                </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  );
}
