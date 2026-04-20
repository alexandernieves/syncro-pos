"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { IconCirclePlusFilled, IconMail, type Icon } from "@tabler/icons-react"
import { ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

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
  const pathname = usePathname()

  // A parent is "active" if the current path starts with its URL or any child matches
  const isParentActive = (item: typeof items[0]) => {
    if (item.items && item.items.length > 0) {
      return item.items.some(sub => pathname === sub.url || pathname.startsWith(sub.url))
    }
    return pathname === item.url || pathname.startsWith(item.url)
  }

  const isDashboardActive = pathname === "/dashboard"

  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-2">
        {/* Main nav items */}
        <SidebarMenu>
          {items.map((item) => {
            const parentActive = isParentActive(item)
            const anySubActive = item.items?.some(s => pathname === s.url)
            const activeIndex = item.items?.findIndex(s => pathname === s.url) ?? -1

            return (
              <Collapsible
                key={item.title}
                asChild
                // Keep open if any child matches current route
                open={item.items && item.items.length > 0 ? parentActive || undefined : undefined}
                defaultOpen={parentActive}
                className="group/collapsible"
              >
                <SidebarMenuItem>
                  {item.items && item.items.length > 0 ? (
                    <>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton
                          tooltip={item.title}
                          isActive={pathname === item.url}
                        >
                          {item.icon && <item.icon />}
                          <span>{item.title}</span>
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub className="relative border-l-0">
                          {anySubActive && (
                            <div className="absolute inset-0 pointer-events-none z-20">
                              <svg 
                                className="w-[20px] h-full text-primary overflow-visible" 
                                fill="none"
                              >
                                <path 
                                  className="transition-all duration-300 ease-in-out"
                                  d={`
                                    M 1 0 
                                    L 1 ${activeIndex * 32 + 16 - 8}
                                    C 1 ${activeIndex * 32 + 16 - 3.58} 4.58 ${activeIndex * 32 + 16} 9 ${activeIndex * 32 + 16}
                                    H 12.5
                                    M 9.5 ${activeIndex * 32 + 16 - 3}
                                    L 12.5 ${activeIndex * 32 + 16}
                                    L 9.5 ${activeIndex * 32 + 16 + 3}
                                  `}
                                  stroke="currentColor" 
                                  strokeWidth="2" 
                                  strokeLinecap="round" 
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </div>
                          )}

                          {item.items?.map((subItem) => {
                            const subActive = pathname === subItem.url
                            
                            return (
                              <SidebarMenuSubItem key={subItem.title} className="relative">
                                <SidebarMenuSubButton
                                  asChild
                                  isActive={false}
                                  className={cn(
                                    "transition-all duration-200",
                                    subActive 
                                      ? "font-bold !text-primary !bg-primary/10 hover:!bg-primary/10" 
                                      : "text-muted-foreground hover:!text-primary hover:!bg-primary/5"
                                  )}
                                >
                                  <Link href={subItem.url}>
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
                        item.url === "/dashboard"
                          ? pathname === "/dashboard"
                          : pathname === item.url || pathname.startsWith(item.url + "/")
                      }
                    >
                      <Link href={item.url}>
                        {item.icon && <item.icon />}
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
