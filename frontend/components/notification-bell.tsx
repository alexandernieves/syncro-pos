"use client";

import React, { useState } from "react";
import Link from "next/link";
import { 
  Popover, PopoverContent, PopoverTrigger 
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  IconBell, IconCheck, IconCircleDot, IconInfoCircle, IconReceipt, IconCash, IconAlertTriangle 
} from "@tabler/icons-react";
import { useNotifications } from "@/hooks/useNotifications";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();

  const getIcon = (type: string) => {
    switch (type) {
      case 'SALE': return <IconReceipt className="text-emerald-500" size={16} />;
      case 'EXPENSE': return <IconCash className="text-rose-500" size={16} />;
      case 'ALERT': return <IconAlertTriangle className="text-amber-500" size={16} />;
      default: return <IconInfoCircle className="text-blue-500" size={16} />;
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800">
          <IconBell size={20} />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-rose-500 text-white border-2 border-white dark:border-zinc-950 text-[10px] font-bold">
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 rounded-2xl shadow-2xl border-none bg-white dark:bg-zinc-900" align="end">
        <div className="p-4 border-b flex items-center justify-between">
          <h4 className="font-bold text-sm">Notificaciones</h4>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllAsRead} className="h-8 text-[10px] uppercase font-bold text-primary hover:text-primary hover:bg-primary/5">
              Marcar todo como leído
            </Button>
          )}
        </div>
        
        <ScrollArea className="h-80">
          {notifications.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">
              <IconBell className="mx-auto mb-2 opacity-20" size={32} />
              <p className="text-xs">No tienes notificaciones</p>
            </div>
          ) : (
            <div className="flex flex-col">
              {notifications.map((n) => (
                <div 
                  key={n.id} 
                  className={cn(
                    "p-4 border-b last:border-0 transition-colors cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50",
                    !n.isRead && "bg-primary/5 border-l-4 border-l-primary"
                  )}
                  onClick={() => !n.isRead && markAsRead(n.id)}
                >
                  <div className="flex gap-3">
                    <div className="mt-0.5">{getIcon(n.type)}</div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <p className={cn("text-xs font-bold", !n.isRead ? "text-primary" : "text-foreground")}>{n.title}</p>
                        <span className="text-[10px] text-muted-foreground">
                          {(() => {
                            try {
                              if (!n.createdAt) return "Hace un momento";
                              const d = new Date(n.createdAt);
                              if (isNaN(d.getTime())) return "Hace un momento";
                              return formatDistanceToNow(d, { addSuffix: true, locale: es });
                            } catch (e) {
                              return "Hace un momento";
                            }
                          })()}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">{n.message}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        
        <div className="p-3 border-t text-center">
          <Button 
            variant="ghost" 
            size="sm" 
            className="w-full text-xs text-muted-foreground font-medium h-8" 
            asChild
            onClick={() => setOpen(false)}
          >
            <Link href="/dashboard/notificaciones">
              Ver todas las notificaciones
            </Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
