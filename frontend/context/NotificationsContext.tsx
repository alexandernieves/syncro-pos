"use client";

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { API_URL } from "@/lib/constants"
import { io, Socket } from "socket.io-client";
import { toast } from "sonner";

const API = API_URL;

interface NotificationsContextType {
  notifications: any[];
  unreadCount: number;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  loading: boolean;
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState<Socket | null>(null);

  // Colapsa ráfagas de notificaciones (ej. varias alertas de stock llegando casi
  // juntas) en un único toast agrupado, para no apilar decenas de toasts.
  const burstCountRef = useRef(0);
  const burstTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const BURST_THRESHOLD = 3;
  const BURST_WINDOW_MS = 4000;

  const fetchNotifications = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const res = await fetch(`${API}/notifications`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
        setUnreadCount(data.filter((n: any) => !n.isRead).length);
      }
    } catch (error) {
      console.error("Error fetching notifications", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Do NOT run dashboard notifications in the PWA portal context
    const isPortal = typeof window !== "undefined" && window.location.pathname.startsWith("/portal");
    if (isPortal) {
      setLoading(false);
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      setLoading(false);
      return;
    }

    fetchNotifications();

    const newSocket = io(API, {
      auth: { token }
    });

    newSocket.on("notification", (notification) => {
      setNotifications(prev => [notification, ...prev]);
      setUnreadCount(prev => prev + 1);
      
      // Only show toast if we are still in the dashboard context
      const stillInDashboard = !window.location.pathname.startsWith("/portal");
      if (stillInDashboard) {
        // id = notification.id evita duplicar el toast si el mismo evento
        // llega dos veces (p.ej. reconexión del socket).
        burstCountRef.current += 1;
        if (burstTimerRef.current) clearTimeout(burstTimerRef.current);
        burstTimerRef.current = setTimeout(() => {
          burstCountRef.current = 0;
        }, BURST_WINDOW_MS);

        if (burstCountRef.current <= BURST_THRESHOLD) {
          toast(notification.title, {
            id: notification.id,
            description: notification.message,
          });
        } else {
          // Ya se mostraron varios toasts individuales en esta ráfaga:
          // a partir de aquí se agrupan todos en un único toast que se
          // va actualizando, en vez de seguir apilando uno por evento.
          const extra = burstCountRef.current - BURST_THRESHOLD;
          toast(`🔔 ${extra} notificaciones más`, {
            id: "notifications-burst",
            description: "Revisa la campana de notificaciones para ver el detalle.",
          });
        }
      }
    });

    setSocket(newSocket);

    return () => {
      if (burstTimerRef.current) clearTimeout(burstTimerRef.current);
      newSocket.disconnect();
    };
  }, [fetchNotifications]);

  const markAsRead = async (id: string) => {
    const token = localStorage.getItem("token");
    try {
      await fetch(`${API}/notifications/${id}/read`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, isRead: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Error marking as read", error);
    }
  };

  const markAllAsRead = async () => {
    const token = localStorage.getItem("token");
    try {
      await fetch(`${API}/notifications/read-all`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error("Error marking all as read", error);
    }
  };

  return (
    <NotificationsContext.Provider value={{ notifications, unreadCount, markAsRead, markAllAsRead, loading }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (context === undefined) {
    throw new Error("useNotifications must be used within a NotificationsProvider");
  }
  return context;
}
