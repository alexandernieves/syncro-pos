"use client";

import React, { useState } from "react";
import { 
  Card, CardContent, CardHeader, CardTitle, CardDescription 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  IconBell, IconCheck, IconTrash, IconReceipt, IconCash, IconAlertTriangle, IconInfoCircle, IconFilter
} from "@tabler/icons-react";
import { useNotifications } from "@/hooks/useNotifications";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";

export default function NotificacionesPage() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [filter, setFilter] = useState("all");

  const filteredNotifications = notifications.filter(n => {
    if (filter === "unread") return !n.isRead;
    if (filter === "read") return n.isRead;
    return true;
  });

  const getIcon = (type: string) => {
    switch (type) {
      case 'SALE': return <IconReceipt className="text-emerald-500" size={24} />;
      case 'EXPENSE': return <IconCash className="text-rose-500" size={24} />;
      case 'ALERT': return <IconAlertTriangle className="text-amber-500" size={24} />;
      default: return <IconInfoCircle className="text-blue-500" size={24} />;
    }
  };

  return (
    <div className="flex flex-col gap-6 py-4 md:gap-8 md:py-6 font-sans px-4 lg:px-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <IconBell className="text-primary" /> Centro de Notificaciones
          </h1>
          <p className="text-muted-foreground">Gestiona todas las alertas y actividades de tus sucursales.</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[150px] rounded-xl h-11">
              <IconFilter size={16} className="mr-2 text-muted-foreground" />
              <SelectValue placeholder="Filtrar" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="unread">No leídas</SelectItem>
              <SelectItem value="read">Leídas</SelectItem>
            </SelectContent>
          </Select>
          
          <Button 
            variant="outline" 
            onClick={markAllAsRead}
            disabled={unreadCount === 0}
            className="rounded-xl h-11 gap-2 font-bold"
          >
            <IconCheck size={18} /> Marcar todo como leído
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {filteredNotifications.length === 0 ? (
          <Card className="border-dashed bg-transparent">
            <CardContent className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
              <IconBell size={48} className="mb-4 opacity-20" />
              <h3 className="text-lg font-semibold text-foreground">Sin notificaciones</h3>
              <p className="max-w-xs">No hay alertas que coincidan con el filtro seleccionado.</p>
            </CardContent>
          </Card>
        ) : (
          filteredNotifications.map((n) => (
            <Card 
              key={n.id} 
              className={cn(
                "overflow-hidden shadow-sm transition-all border-none rounded-2xl group relative",
                !n.isRead ? "bg-primary/5 ring-1 ring-primary/20" : "bg-white dark:bg-zinc-900"
              )}
            >
              <CardContent className="p-0">
                <div className="flex flex-col md:flex-row items-start md:items-center p-5 gap-4">
                  <div className={cn(
                    "p-3 rounded-2xl shrink-0",
                    !n.isRead ? "bg-primary/10" : "bg-zinc-100 dark:bg-zinc-800"
                  )}>
                    {getIcon(n.type)}
                  </div>
                  
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className={cn("text-base font-bold", !n.isRead ? "text-primary" : "text-foreground")}>
                        {n.title}
                      </h3>
                      {!n.isRead && (
                        <Badge className="bg-primary text-primary-foreground hover:bg-primary text-[10px] h-5">NUEVO</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {n.message}
                    </p>
                    <div className="flex items-center gap-4 mt-2">
                      <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">
                        {format(new Date(n.createdAt), "dd MMM yyyy 'a las' HH:mm", { locale: es })}
                      </span>
                      {n.branch && (
                        <span className="text-[10px] font-bold text-primary/60 uppercase tracking-wider flex items-center gap-1">
                          📍 {n.branch.name || "Sucursal"}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end md:self-center">
                    {!n.isRead && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => markAsRead(n.id)}
                        className="rounded-lg text-xs font-bold text-primary hover:bg-primary/10"
                      >
                        Marcar como leído
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive rounded-lg">
                      <IconTrash size={18} />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
