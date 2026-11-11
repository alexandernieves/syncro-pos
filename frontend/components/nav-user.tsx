"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { PushDeviceDialog } from "@/components/push-device-dialog"
import { signOutAndReload } from "@/lib/auth-helpers"

import {
  IconCreditCard,
  IconDotsVertical,
  IconBell,
  IconLogout,
  IconNotification,
  IconUserCircle,
} from "@tabler/icons-react"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

import { toast } from "sonner"

export function NavUser({
  user,
}: {
  user: {
    name: string
    email: string
    avatar: string
  }
}) {
  const { isMobile } = useSidebar()
  const router = useRouter()
  const [pushOpen, setPushOpen] = useState(false)

  const handleLogout = async () => {
    toast.success("Has cerrado sesión correctamente")
    await signOutAndReload("/login")
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg grayscale">
                <AvatarImage src={user.avatar} alt={user.name} />
                <AvatarFallback className="rounded-lg">Cn</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{user.name}</span>
                <span className="text-muted-foreground truncate text-xs">
                  {user.email}
                </span>
              </div>
              <IconDotsVertical className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src={user.avatar} alt={user.name} />
                  <AvatarFallback className="rounded-lg">Cn</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user.name}</span>
                  <span className="text-muted-foreground truncate text-xs">
                    {user.email}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => router.push('/dashboard/cuenta')} className="cursor-pointer">
                <IconUserCircle />
                Cuenta
              </DropdownMenuItem>
              {((user as any).role !== "syncropos") && (
                <>
                  <DropdownMenuItem onClick={() => router.push('/dashboard/facturacion')} className="cursor-pointer">
                    <IconCreditCard />
                    Facturación
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push('/dashboard/notificaciones')} className="cursor-pointer">
                    <IconNotification />
                    Notificaciones
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuItem onClick={() => setPushOpen(true)} className="cursor-pointer">
                <IconBell />
                Notificaciones de este dispositivo
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
              <IconLogout />
              Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <PushDeviceDialog open={pushOpen} onOpenChange={setPushOpen} />
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
