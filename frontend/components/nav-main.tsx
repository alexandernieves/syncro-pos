"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { IconCirclePlusFilled, IconMail, IconCornerDownRight, type Icon } from "@tabler/icons-react"
import { ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { useNavProximity } from "@/components/use-nav-proximity"

import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"

// Section homes: only active on their own page, not on the pages below them
const EXACT_URLS = new Set(["/dashboard", "/dashboard/gimnasio"])

export function NavMain({
  items,
}: {
  items: {
    title: string
    url: string
    icon?: Icon
    isActive?: boolean
    items?: {
      title: string
      url: string
    }[]
  }[]
}) {
  const rawPathname = usePathname()
  // El export estatico navega a "/dashboard/" con barra final. Sin quitarla,
  // cualquier comparacion exacta contra "/dashboard" falla y el item queda sin
  // marcar. Se normaliza una vez y se usa en todo el componente.
  const pathname = rawPathname.replace(/\/+$/, "") || "/"

  // A parent is "active" if it has sub-items and one of its sub-items matches the current path
  const isParentActive = (item: typeof items[0]) => {
    if (item.items && item.items.length > 0) {
      return item.items.some(sub => pathname === sub.url || pathname.startsWith(sub.url))
    }
    return false
  }

  const [openItem, setOpenItem] = useState<string | null>(null)

  useEffect(() => {
    const activeItem = items.find(item => isParentActive(item))
    if (activeItem) {
      setOpenItem(activeItem.title)
    } else {
      setOpenItem(null)
    }
  }, [pathname, items])

  const isDashboardActive = pathname === "/dashboard"

  // Solo UI: sigue al puntero y deja un 0..1 por item en --effect.
  const { listRef, setItem, listHandlers } = useNavProximity()

  return (
    <SidebarGroup>
      {/* Efecto de proximidad (solo presentacion). Vive aqui para que quitarlo
          sea borrar este bloque y las llamadas a useNavProximity. */}
      <style>{`
        /* Hueco a la izquierda para las rayas, que ahora mandan. */
        .syncro-prox { padding-left: 64px; }

        .syncro-prox > li > [data-sidebar="menu-button"] {
          transform: translateX(calc(var(--effect, 0) * 8px));
        }

        /* Sin fondos: el unico indicador es la raya.
           Va dentro de @layer utilities a proposito. Tailwind marca el fondo
           del item activo con !important desde esa capa, y para declaraciones
           !important una capa le gana a lo que esta fuera de toda capa — sin
           esto, al pasar el mouse por el seleccionado reaparecia la pastilla
           naranja y se tragaba el texto. Dentro de la misma capa decide la
           especificidad, y estos selectores son mas especificos. */
        @layer utilities {
          .syncro-prox > li > [data-sidebar="menu-button"],
          .syncro-prox > li > [data-sidebar="menu-button"]:hover,
          .syncro-prox > li > [data-sidebar="menu-button"]:active,
          .syncro-prox > li > [data-sidebar="menu-button"][data-active="true"],
          .syncro-prox > li > [data-sidebar="menu-button"][data-active="true"]:hover,
          .syncro-prox > li > [data-sidebar="menu-button"][data-state="open"]:hover {
            background: transparent !important;
            box-shadow: none !important;
          }
          .syncro-prox > li > [data-sidebar="menu-button"][data-active="true"],
          .syncro-prox > li > [data-sidebar="menu-button"][data-active="true"]:hover {
            color: var(--primary) !important;
          }
        }

        /* Raya larga: al acercarte casi duplica su largo y engorda. */
        .syncro-prox > li::before {
          content: "";
          position: absolute;
          left: -64px;
          /* A la altura de la fila del padre (boton de 32px), no del centro del
             <li>: al desplegar el acordeon el <li> crece y la raya se iria. */
          top: 16px;
          width: 54px;
          height: calc(1px + var(--effect, 0) * 1.6px);
          border-radius: 2px;
          transform: translateY(-50%) scaleX(calc(0.5 + var(--effect, 0) * 0.5));
          transform-origin: left center;
          background-color: color-mix(in srgb, var(--primary) calc(var(--effect, 0) * 100%), #A9A296);
          opacity: calc(0.55 + var(--effect, 0) * 0.45);
        }

        /* Raya corta, en el hueco hacia el siguiente item. */
        .syncro-prox > li::after {
          content: "";
          position: absolute;
          left: -64px;
          top: calc(100% + 2px);
          width: 26px;
          height: 1px;
          transform: translateY(-50%) scaleX(calc(0.62 + var(--effect, 0) * 0.38));
          transform-origin: left center;
          background-color: #A9A296;
          opacity: 0.4;
        }
        .syncro-prox > li:last-child::after { content: none; }

        /* El item de la ruta actual: raya entera y naranja, sin pastilla. */
        .syncro-prox > li[data-selected="true"]::before,
        .syncro-prox > li:has([data-active="true"])::before {
          transform: translateY(-50%) scaleX(1);
          height: 2.6px;
          background-color: var(--primary);
          opacity: 1;
        }
        .syncro-prox > li[data-selected="true"] > [data-sidebar="menu-button"] > .syncro-idx,
        .syncro-prox > li:has([data-active="true"]) .syncro-idx,
        .syncro-prox > li[data-selected="true"] > [data-sidebar="menu-button"] > span:last-child,
        .syncro-prox > li > [data-sidebar="menu-button"][data-active="true"] > span:last-child {
          color: var(--primary) !important;
        }

        /* Numero de orden, en monoespaciada como la referencia. */
        .syncro-prox .syncro-idx {
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 0.78em;
          letter-spacing: 0.02em;
          margin-right: 0.15rem;
          opacity: calc(0.5 + var(--effect, 0) * 0.5);
          color: color-mix(in srgb, var(--primary) calc(var(--effect, 0) * 90%), var(--muted-foreground));
        }

        /* Expandido: manda el texto, sin iconos. */
        .syncro-prox > li > [data-sidebar="menu-button"] > svg { display: none; }

        .syncro-prox > li > [data-sidebar="menu-button"]:not([data-active="true"]) > span:last-child {
          color: color-mix(in srgb, var(--primary) calc(var(--effect, 0) * 85%), var(--sidebar-foreground));
        }

        /* Colapsado a iconos: vuelven los iconos y se van rayas y numeros. */
        [data-collapsible="icon"] .syncro-prox { padding-left: 0; }
        [data-collapsible="icon"] .syncro-prox > li::before,
        [data-collapsible="icon"] .syncro-prox > li::after,
        [data-collapsible="icon"] .syncro-prox .syncro-idx { display: none; }
        [data-collapsible="icon"] .syncro-prox > li > [data-sidebar="menu-button"] > svg { display: block; }
        [data-collapsible="icon"] .syncro-prox > li > [data-sidebar="menu-button"] { transform: none; }
        [data-collapsible="icon"] .syncro-prox > li > [data-sidebar="menu-button"][data-active="true"] {
          background: var(--primary) !important;
        }

        @media (prefers-reduced-motion: reduce) {
          .syncro-prox > li > [data-sidebar="menu-button"] { transform: none; }
        }
      `}</style>
      <SidebarGroupContent className="flex flex-col gap-2">
        {/* Main nav items */}
        <SidebarMenu ref={listRef} {...listHandlers} className="syncro-prox">
          {items.map((item, itemIndex) => {
            const parentActive = isParentActive(item)
            const normalizedPathname = pathname.replace(/\/$/, "")
            const anySubActive = item.items?.some(s => s.url === normalizedPathname || s.url === pathname)
            const activeIndex = item.items?.findIndex(s => s.url === normalizedPathname || s.url === pathname) ?? -1

            return (
              <Collapsible
                key={item.title}
                asChild
                open={openItem === item.title}
                onOpenChange={(isOpen) => {
                  if (isOpen) {
                    setOpenItem(item.title)
                  } else {
                    if (openItem === item.title) {
                      setOpenItem(null)
                    }
                  }
                }}
                className="group/collapsible"
              >
                <SidebarMenuItem
                  ref={setItem(itemIndex)}
                  /* Un item con subitems nunca navega al pulsarlo, solo abre el
                     acordeon, asi que jamas recibia data-active. Aqui se marca
                     tambien cuando la ruta actual es la de uno de sus hijos. */
                  data-selected={
                    // Se marca en tres casos: la ruta actual es la suya, la de
                    // uno de sus hijos, o acabas de pulsarlo y su acordeon esta
                    // abierto (pulsar un padre abre, pero no navega, asi que sin
                    // esto ultimo el clic no dejaba ninguna senal).
                    parentActive ||
                    openItem === item.title ||
                    (EXACT_URLS.has(item.url)
                      ? pathname === item.url
                      : pathname === item.url || pathname.startsWith(item.url + "/"))
                      ? "true"
                      : undefined
                  }
                >
                  {item.items && item.items.length > 0 ? (
                    <>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton
                          data-kbd-nav
                          tooltip={item.title}
                          isActive={pathname === item.url || normalizedPathname === item.url}
                        >
                          {item.icon && <item.icon />}
                          <span className="syncro-idx">{String(itemIndex + 1).padStart(2, "0")}</span>
                          <span>{item.title}</span>
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub className="relative border-l-0 pt-2 pb-2 ml-0">
                          {/* Unified SVG Tree Line */}
                          {anySubActive && activeIndex !== -1 && (
                            <div className="absolute left-[21px] top-[-14px] bottom-0 pointer-events-none z-10">
                              <svg className="w-[20px] h-full text-primary overflow-visible" fill="none">
                                <path 
                                  className="transition-all duration-500 ease-in-out"
                                  d={`
                                    M 0 0
                                    V ${activeIndex * 36 + 36 - 6}
                                    Q 0 ${activeIndex * 36 + 36} 8 ${activeIndex * 36 + 36}
                                    H 14
                                    M 11 ${activeIndex * 36 + 36 - 3}
                                    L 14 ${activeIndex * 36 + 36}
                                    L 11 ${activeIndex * 36 + 36 + 3}
                                  `}
                                  stroke="currentColor" 
                                  strokeWidth="1.8" 
                                  strokeLinecap="round" 
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </div>
                          )}

                          {item.items?.map((subItem) => {
                            const subActive = normalizedPathname === subItem.url || pathname === subItem.url
                            
                            return (
                              <SidebarMenuSubItem key={subItem.title} className="relative group/subitem">
                                <SidebarMenuSubButton
                                  asChild
                                  isActive={false}
                                  className={cn(
                                    "transition-all duration-200 pl-9 relative h-8",
                                    subActive 
                                      ? "font-bold !text-primary !bg-primary/10 shadow-sm" 
                                      : "text-muted-foreground hover:!text-primary hover:!bg-primary/5"
                                  )}
                                >
                                  <Link href={subItem.url} data-kbd-nav data-active={subActive ? "true" : undefined} className="flex items-center">
                                    <IconCornerDownRight 
                                      size={14} 
                                      stroke={2.5}
                                      className={cn(
                                        "absolute left-2 transition-all duration-300",
                                        subActive 
                                          ? "opacity-0" // Hide standard icon when active to show SVG instead
                                          : "opacity-0 -translate-x-4 group-hover/subitem:opacity-100 group-hover/subitem:translate-x-0 text-primary/70"
                                      )}
                                    />
                                    <span>{subItem.title}</span>
                                  </Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            )
                          })}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </>
                  ) : (
                    <SidebarMenuButton
                      asChild
                      tooltip={item.title}
                      isActive={
                        EXACT_URLS.has(item.url)
                          ? pathname === item.url
                          : pathname === item.url || pathname.startsWith(item.url + "/")
                      }
                    >
                      <Link href={item.url} data-kbd-nav>
                        {item.icon && <item.icon />}
                        <span className="syncro-idx">{String(itemIndex + 1).padStart(2, "0")}</span>
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  )}
                </SidebarMenuItem>
              </Collapsible>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
