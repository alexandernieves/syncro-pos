"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

export type MyModule = {
  code: string;
  name: string;
  status: string;
  usable: boolean;
  trialEndsAt: string | null;
  activatedAt: string | null;
  features: { key: string; label: string; route?: string }[];
  gatedRoutes: string[];
};

const KEY = "syncro_my_modules";
let inflight: Promise<MyModule[] | null> | null = null;
const listeners = new Set<(m: MyModule[]) => void>();

function cached(): MyModule[] | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as MyModule[]) : null;
  } catch {
    return null;
  }
}

/** Loads the business's packaged modules once and shares them with every component that asks. */
export function refreshMyModules() {
  if (!inflight) {
    inflight = apiFetch("/modules/mine")
      .then(async (res) => {
        if (!res.ok) return null;
        const data = (await res.json()) as MyModule[];
        try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* storage full or blocked */ }
        listeners.forEach((l) => l(data));
        return data;
      })
      .catch(() => null)
      .finally(() => { setTimeout(() => { inflight = null; }, 2000); });
  }
  return inflight;
}

/** The business's modules (from cache first, then fresh from the server). `null` until known. */
export function useMyModules() {
  const [modules, setModules] = useState<MyModule[] | null>(null);
  useEffect(() => {
    setModules(cached());
    listeners.add(setModules);
    // On a failed request keep the cached list; with nothing cached, stop waiting
    refreshMyModules().then((m) => setModules((prev) => m ?? prev ?? []));
    // Pick up a module Syncro just turned on when the person comes back to the window
    const onFocus = () => { refreshMyModules(); };
    window.addEventListener("focus", onFocus);
    return () => { listeners.delete(setModules); window.removeEventListener("focus", onFocus); };
  }, []);
  return modules;
}

/** Days left in a trial (negative once it ended). */
export const trialDaysLeft = (m: MyModule) => (m.trialEndsAt ? Math.ceil((new Date(m.trialEndsAt).getTime() - Date.now()) / 86_400_000) : null);
