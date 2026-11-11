"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Socket } from "socket.io-client";
import { apiFetch } from "@/lib/api";
import { connectSocket } from "@/lib/socket";
import { currentSubscription, usePushNotifications } from "@/hooks/usePushNotifications";

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

type Notice = { conversationId: string; businessId: string | null; businessName: string | null; text: string; messageId?: string; requestId: string | null; fromSupport: boolean };

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

type SyncroPush = { id: string; title: string; body: string; url: string | null; devices: number };

/** Shows a notification from the operating system, through the service worker when there is one. */
async function systemNotice(title: string, body: string, tag: string, onClick: () => void) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    const notification = new Notification(title, { body, icon: "/syncro.png", tag });
    notification.onclick = () => {
      (window as unknown as { electron?: { showWindow?: () => void } }).electron?.showWindow?.();
      window.focus();
      onClick();
      notification.close();
    };
  } catch {
    const reg = await navigator.serviceWorker?.getRegistration().catch(() => undefined);
    await reg?.showNotification(title, { body, icon: "/syncro.png", tag, data: { url: "/dashboard" } }).catch(() => undefined);
  }
}

export function SupportNotifier() {
  usePushNotifications();
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
        // The count on the Dock icon (desktop app) or the installed app's icon (phone / PWA)
        (window as unknown as { electron?: { setBadge?: (n: number) => void } }).electron?.setBadge?.(Number(count) || 0);
        const nav = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
        if (count > 0) nav.setAppBadge?.(Number(count)).catch(() => undefined);
        else nav.clearAppBadge?.().catch(() => undefined);
      } catch {
        // offline: keep the last count
      }
    };

    const socket: Socket = connectSocket({ auth: { token }, reconnection: true, reconnectionAttempts: Infinity, reconnectionDelay: 2000 });
    socket.on("connect", refresh);
    socket.on("unreadChanged", refresh);
    socket.on("supportMessage", async (n: Notice) => {
      // It reached this screen: the sender sees the gray double check
      if (n.messageId) socket.emit("delivered", { messageId: n.messageId });
      refresh();
      const onChat = pathRef.current?.replace(/\/+$/, "") === chatPath;
      const widgetOpen = !!(window as unknown as Record<string, boolean>).__syncroChatWidgetOpen;
      if ((onChat || widgetOpen) && !document.hidden) return; // the chat itself shows it
      const title = isSupport ? `💬 ${n.businessName ?? "Un negocio"}` : "💬 Equipo Syncro";
      const body = n.text.length > 140 ? `${n.text.slice(0, 140)}…` : n.text;
      // A business reads it in the floating chat without leaving the screen
      const view = () => {
        if (!isSupport && pathRef.current?.replace(/\/+$/, "") !== chatPath) window.dispatchEvent(new Event("support-chat:open"));
        else router.push(chatPath);
      };
      toast(title, { description: body, duration: 8000, action: { label: "Ver", onClick: view } });
      // Not looking at Syncro (minimised, behind other windows, window closed in the desktop app):
      // a system notification. In a browser signed up for push, the service worker already shows it.
      if (document.hidden || !document.hasFocus()) {
        const viaPush = !!(await currentSubscription().catch(() => null));
        if (!viaPush) void systemNotice(title, body, `chat-${n.conversationId}`, view);
      }
    });
    // Notifications from Syncro central and the automations (welcome, reminders…)
    socket.on("syncroPush", async (n: SyncroPush) => {
      const open = () => {
        if (!n.url) return;
        if (/^https?:\/\//.test(n.url)) window.open(n.url, "_blank", "noopener");
        else router.push(n.url);
      };
      toast(n.title, { id: `push-${n.id}`, description: n.body, duration: 10000, action: n.url ? { label: "Ver", onClick: open } : undefined });
      // This computer shows it in the system too, unless web push already did (the service worker
      // shows it on every subscribed device). The desktop app has no web push, so it always shows it here.
      const viaPush = n.devices > 0 && !!(await currentSubscription().catch(() => null));
      if (!viaPush) void systemNotice(n.title, n.body, `push-${n.id}`, open);
    });
    window.addEventListener("focus", refresh);
    refresh();
    return () => {
      socket.disconnect();
      window.removeEventListener("focus", refresh);
      document.title = baseTitle;
    };
  }, [router]);

  return null;
}
