"use client";

import { useEffect } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000";

function urlBase64ToUint8Array(base64String: string) {
  if (!base64String || typeof base64String !== "string") {
    throw new Error("Invalid VAPID key");
  }
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications(userId: string | null) {
  useEffect(() => {
    if (!userId || typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    const register = async () => {
      try {
        // Register service worker
        const registration = await navigator.serviceWorker.register("/sw.js");

        // Get VAPID public key from backend
        let publicKey: string | null = null;
        try {
          const res = await fetch(`${API}/push/vapid-key`);
          if (!res.ok) return;
          const data = await res.json();
          publicKey = data?.publicKey ?? null;
        } catch {
          // Backend not reachable — skip push registration silently
          return;
        }

        if (!publicKey) return;

        // Check existing subscription
        let subscription = await registration.pushManager.getSubscription();

        if (!subscription) {
          // Request permission
          const permission = await Notification.requestPermission();
          if (permission !== "granted") return;

          // Subscribe
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey),
          });
        }

        // Register subscription with backend
        await fetch(`${API}/push/subscribe`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, subscription }),
        });
      } catch (err) {
        console.warn("Push registration failed (non-critical):", err);
      }
    };

    register();
  }, [userId]);
}

