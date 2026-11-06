"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Socket } from "socket.io-client";
import { apiFetch } from "@/lib/api";
import { connectSocket } from "@/lib/socket";

/**
 * Unread support messages, shared by the whole app: the sidebar badge reads it, and a single
 * socket keeps it fresh and pops a notice when the other side writes.
 *
 * Business users count Syncro's unread messages; the Syncro team counts every business's.
 */
let unread = 0;
const listeners = new Set<() => void>();
const setUnread = (n: number) => {
  if (n === unread) return;
  unread = n;
  listeners.forEach((l) => l());
};
export function useSupportUnread() {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => unread,
    () => 0,
  );
}

type Notice = { conversationId: string; businessId: string | null; businessName: string | null; text: string; requestId: string | null; fromSupport: boolean };

function session() {
  try {
    const pwa = window.matchMedia("(display-mode: standalone)").matches;
    const store = pwa ? sessionStorage : localStorage;
    const user = JSON.parse(store.getItem("user") || "null");
    return { token: store.getItem("token"), role: user?.role as string | undefined };
  } catch {
    return { token: null, role: undefined };
  }
}

export function SupportNotifier() {
  const pathname = usePathname();
  const router = useRouter();
  const pathRef = useRef(pathname);
  useEffect(() => { pathRef.current = pathname; }, [pathname]);

  useEffect(() => {
    const { token, role } = session();
    if (!token) return;
    const isSupport = role === "syncropos";
    const chatPath = isSupport ? "/dashboard/syncro/chat" : "/dashboard/soporte";
    const baseTitle = document.title.replace(/^\(\d+\)\s*/, "");

    const refresh = async () => {
      try {
        const res = await apiFetch("/chat/unread");
        if (!res.ok) return;
        const { count } = await res.json();
        setUnread(Number(count) || 0);
        document.title = count > 0 ? `(${count}) ${baseTitle}` : baseTitle;
      } catch {
        // offline: keep the last count
      }
    };

    const socket: Socket = connectSocket({ auth: { token }, reconnection: true, reconnectionAttempts: Infinity, reconnectionDelay: 2000 });
    socket.on("connect", refresh);
    socket.on("unreadChanged", refresh);
    socket.on("supportMessage", (n: Notice) => {
      refresh();
      const onChat = pathRef.current?.replace(/\/+$/, "") === chatPath;
      if (onChat && !document.hidden) return; // the chat itself shows it
      const title = isSupport ? `💬 ${n.businessName ?? "Un negocio"}` : "💬 Equipo Syncro";
      const body = n.text.length > 140 ? `${n.text.slice(0, 140)}…` : n.text;
      toast(title, { description: body, duration: 8000, action: { label: "Ver", onClick: () => router.push(chatPath) } });
      if (document.hidden && "Notification" in window && Notification.permission === "granted") {
        try {
          const notification = new Notification(title, { body, icon: "/syncro.png", tag: n.conversationId });
          notification.onclick = () => { window.focus(); router.push(chatPath); };
        } catch {
          // some browsers only allow notifications from a service worker
        }
      }
    });
    // Ask once for desktop notifications, the first time someone clicks anywhere
    const ask = () => {
      if ("Notification" in window && Notification.permission === "default") Notification.requestPermission().catch(() => undefined);
      window.removeEventListener("pointerdown", ask);
    };
    window.addEventListener("pointerdown", ask);
    window.addEventListener("focus", refresh);
    refresh();
    return () => {
      socket.disconnect();
      window.removeEventListener("pointerdown", ask);
      window.removeEventListener("focus", refresh);
      document.title = baseTitle;
    };
  }, [router]);

  return null;
}
