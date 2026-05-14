"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { IconCirclePlusFilled, IconMail, IconCornerDownRight, type Icon } from "@tabler/icons-react"
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
            const normalizedPathname = pathname.replace(/\/$/, "")
            const anySubActive = item.items?.some(s => s.url === normalizedPathname || s.url === pathname)
            const activeIndex = item.items?.findIndex(s => s.url === normalizedPathname || s.url === pathname) ?? -1

            return (
              <Collapsible
                key={item.title}
                asChild
                // Keep open if any child matches current route
                open={item.items && item.items.length > 0 ? anySubActive || parentActive || undefined : undefined}
                defaultOpen={parentActive}
                className="group/collapsible"
              >
                <SidebarMenuItem>
                  {item.items && item.items.length > 0 ? (
                    <>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton
                          tooltip={item.title}
                          isActive={pathname === item.url || normalizedPathname === item.url}
                        >
                          {item.icon && <item.icon />}
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
                                  <Link href={subItem.url} className="flex items-center">
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
