"use client";

import { useEffect } from "react";
import { API_URL } from "@/lib/constants";
import { signOutAndReload } from "@/lib/auth-helpers";

const KEY = "syncro_suspended_message";

/**
 * When Syncro central suspends a business, the API answers 401 with a message that says so.
 * This watches API responses and, on that message, ends the session and goes to the login,
 * which shows the reason.
 */
export function SuspendedSessionGuard() {
  useEffect(() => {
    const w = window as typeof window & { __syncroSuspendGuard?: boolean };
    if (w.__syncroSuspendGuard) return;
    w.__syncroSuspendGuard = true;
    const original = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const res = await original(input, init);
      try {
        const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
        if (res.status === 401 && url.startsWith(API_URL)) {
          const body = await res.clone().json().catch(() => null);
          const message: string | undefined = body?.message;
          if (message && /suspendida/i.test(message)) {
            sessionStorage.setItem(KEY, message);
            await signOutAndReload("/login/");
          }
        }
      } catch {
        // never break the original response
      }
      return res;
    };
  }, []);
  return null;
}

/** The reason left by the guard, read once by the login page. */
export function takeSuspendedMessage() {
  try {
    const m = sessionStorage.getItem(KEY);
    if (m) sessionStorage.removeItem(KEY);
    return m;
  } catch {
    return null;
  }
}
