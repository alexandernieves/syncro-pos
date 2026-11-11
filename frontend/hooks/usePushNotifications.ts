"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { API_URL } from "@/lib/constants";

/**
 * Push notifications on this device: registers it for whoever is signed in, so Syncro
 * central and the automations (welcome, payment reminders…) reach them even with the app closed.
 *
 * The desktop app has no web push (Electron has no push service); there the open app shows the
 * notifications itself from the socket (see SupportNotifier).
 */

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
  return out;
}

function token() {
  try {
    const pwa = window.matchMedia("(display-mode: standalone)").matches;
    return (pwa ? sessionStorage : localStorage).getItem("token") || localStorage.getItem("token");
  } catch {
    return null;
  }
}

export const isDesktopApp = () => typeof window !== "undefined" && !!(window as unknown as { electron?: { isDesktop?: boolean } }).electron?.isDesktop;

/** Web push can work here (a browser or installed app with a service worker and the Push API). */
export const pushSupported = () =>
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window && !isDesktopApp();

let inFlight: Promise<PushState> | null = null;
/**
 * "push-service": the browser couldn't reach its own push service (Google's for Chrome/Edge,
 * Apple's for Safari). Not Syncro's server: usually a VPN, an ad-blocking DNS or a network that
 * blocks it.
 */
export type PushState = "on" | "denied" | "default" | "unsupported" | "off-server" | "push-service" | "error";
/** The last error, to show it in "Notificaciones de este dispositivo" */
export let lastPushError = "";

/** Tells the service worker where the API is (it confirms delivered messages there). */
export function tellServiceWorkerApi() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || isDesktopApp()) return;
  navigator.serviceWorker.ready.then((r) => r.active?.postMessage({ type: "syncro-api", api: API_URL })).catch(() => undefined);
}

/** The subscription this device has right now, if any. */
export async function currentSubscription() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return (await reg?.pushManager.getSubscription()) ?? null;
}

/**
 * Makes sure this device is subscribed and registered for the signed-in user.
 * With `ask`, it asks for permission first (it has to come from a click).
 */
export function ensurePushSubscription({ ask = false }: { ask?: boolean } = {}): Promise<PushState> {
  if (inFlight) return inFlight;
  inFlight = (async (): Promise<PushState> => {
    if (!pushSupported()) {
      // The desktop app shows notifications itself; it only needs the permission
      if ("Notification" in window && Notification.permission === "default" && ask) await Notification.requestPermission().catch(() => undefined);
      return "unsupported";
    }
    const auth = token();
    if (!auth) return "error";
    let permission = Notification.permission;
    if (permission === "default" && ask) permission = await Notification.requestPermission();
    if (permission !== "granted") return permission === "denied" ? "denied" : "default";

    const res = await fetch(`${API_URL}/push/vapid-key`).catch(() => null);
    const publicKey: string | null = res?.ok ? (await res.json().catch(() => null))?.publicKey ?? null : null;
    if (!publicKey) return "off-server";

    const registration = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register("/sw.js"));
    await navigator.serviceWorker.ready;
    const key = urlBase64ToUint8Array(publicKey);
    let subscription = await registration.pushManager.getSubscription();
    // Keys changed on the server: the old subscription can no longer be used
    if (subscription) {
      const old = subscription.options?.applicationServerKey;
      const same = old && new Uint8Array(old).every((b, i) => b === key[i]) && new Uint8Array(old).length === key.length;
      if (old && !same) {
        await subscription.unsubscribe().catch(() => undefined);
        subscription = null;
      }
    }
    if (!subscription) subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });

    const saved = await fetch(`${API_URL}/push/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth}` },
      body: JSON.stringify({ subscription: subscription.toJSON() }),
    }).catch(() => null);
    return saved?.ok ? "on" : "error";
  })()
    .catch((err) => {
      console.warn("Push registration failed (non-critical):", err);
      lastPushError = String(err?.message || err || "");
      // Chrome: "Registration failed - push service error"
      return (/push service/i.test(lastPushError) || err?.name === "AbortError" ? "push-service" : "error") as PushState;
    })
    .finally(() => {
      setTimeout(() => { inFlight = null; }, 0);
    });
  return inFlight;
}

const SNOOZE_KEY = "syncro-push-prompt-snooze";
const snoozed = () => {
  try { return Number(localStorage.getItem(SNOOZE_KEY) || 0) > Date.now(); } catch { return false; }
};
const snooze = (hours: number) => {
  try { localStorage.setItem(SNOOZE_KEY, String(Date.now() + hours * 3_600_000)); } catch { /* private mode */ }
};

/** Asks with a button the person sees (Chrome hides prompts that pop up on their own). */
function promptToEnable() {
  toast("Activa las notificaciones de esta computadora", {
    id: "push-enable",
    description: "Así te llegan los avisos de Syncro aunque tengas la ventana cerrada o minimizada.",
    duration: Infinity,
    action: {
      label: "Activar",
      onClick: async () => {
        const state = await ensurePushSubscription({ ask: true });
        if (state === "on") toast.success("Listo: las notificaciones están activas en esta computadora.");
        else if (state === "denied") blockedNotice();
        else if (state === "push-service") toast.error("Chrome no pudo conectarse a su servicio de notificaciones", { description: "Abre tu menú de usuario → Notificaciones de este dispositivo para ver cómo resolverlo." });
        else if (state === "error" || state === "off-server") toast.error("No se pudieron activar. Intenta de nuevo en un momento.");
      },
    },
    cancel: { label: "Ahora no", onClick: () => snooze(24) },
  });
}

function blockedNotice() {
  toast("Las notificaciones están bloqueadas en este navegador", {
    id: "push-blocked",
    description: "Haz clic en el ícono a la izquierda de la dirección (el candado o los controles), entra en Notificaciones, elige Permitir y recarga la página.",
    duration: 20000,
    cancel: { label: "Entendido", onClick: () => snooze(24 * 7) },
  });
}

/**
 * Keeps this device registered. If permission was never given, it offers a button to turn
 * notifications on; if they are blocked, it explains how to unblock them.
 */
export function usePushNotifications() {
  useEffect(() => {
    if (typeof window === "undefined" || !token()) return;
    tellServiceWorkerApi();
    let cancelled = false;
    const t = setTimeout(async () => {
      const state = await ensurePushSubscription();
      if (cancelled || snoozed()) return;
      if (state === "default") promptToEnable();
      else if (state === "denied") { blockedNotice(); snooze(24); }
    }, 2500);
    return () => { cancelled = true; clearTimeout(t); };
  }, []);
}
