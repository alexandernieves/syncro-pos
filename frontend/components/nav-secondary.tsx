"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { type Icon, IconBrandWhatsapp, IconMail } from "@tabler/icons-react"
import { GlobalSearch } from "@/components/global-search"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

import { Button } from "@/components/ui/button"

export function NavSecondary({
  items,
  ...props
}: {
  items: {
    title: string
    url: string
    icon: Icon
  }[]
} & React.ComponentPropsWithoutRef<typeof SidebarGroup>) {
  const pathname = usePathname()
  const [isHelpOpen, setIsHelpOpen] = React.useState(false)
  const [isSearchOpen, setIsSearchOpen] = React.useState(false)

  const handleItemClick = (e: React.MouseEvent, item: { title: string, url: string }) => {
    if (item.title === "Ayuda") {
      e.preventDefault()
      setIsHelpOpen(true)
    }
    if (item.title === "Buscar") {
      e.preventDefault()
      setIsSearchOpen(true)
    }
  }

  return (
    <>
      <SidebarGroup {...props}>
        <SidebarGroupContent>
          <SidebarMenu>
            {items.map((item) => {
              const isActive = pathname === item.url || pathname.startsWith(item.url + "/")
              return (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive} tooltip={item.title}>
                    <Link href={item.url} onClick={(e) => handleItemClick(e, item)}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      <GlobalSearch open={isSearchOpen} onOpenChange={setIsSearchOpen} />

      <Dialog open={isHelpOpen} onOpenChange={setIsHelpOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-center">
              Centro de Ayuda
            </DialogTitle>
            <DialogDescription className="text-center pt-1">
              ¿En qué podemos ayudarte hoy?
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 py-6">
            <Button
              variant="outline"
              size="lg"
              className="h-16 justify-start gap-4 px-6 border-green-500/20 hover:bg-green-500/10 hover:text-green-600 transition-all group"
              asChild
            >
              <a
                href="https://wa.me/584127674690"
                target="_blank"
                rel="noopener noreferrer"
              >
                <div className="p-2 rounded-full bg-green-500 text-white group-hover:scale-110 transition-transform">
                  <IconBrandWhatsapp size={20} />
                </div>
                <div className="flex flex-col items-start gap-0.5">
                  <span className="font-semibold">WhatsApp Business</span>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Soporte Inmediato</span>
                </div>
              </a>
            </Button>
            
            <Button
              variant="outline"
              size="lg"
              className="h-16 justify-start gap-4 px-6 border-blue-500/20 hover:bg-blue-500/10 hover:text-blue-600 transition-all group"
              asChild
            >
              <a href="mailto:alexcodesolutionstm@gmail.com">
                <div className="p-2 rounded-full bg-blue-500 text-white group-hover:scale-110 transition-transform">
                  <IconMail size={20} />
                </div>
                <div className="flex flex-col items-start gap-0.5">
                  <span className="font-semibold">Correo Electrónico</span>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Consultas Generales</span>
                </div>
              </a>
            </Button>
          </div>
          <div className="text-center text-[9px] text-muted-foreground/50 font-bold uppercase tracking-[0.2em]">
            Desarrollado por Syncro Solution
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
