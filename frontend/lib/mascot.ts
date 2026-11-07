"use client";

import { useEffect, useSyncExternalStore } from "react";
import { apiFetch } from "@/lib/api";

/** What the merchant tunes in Configuración → Mascota (mirrors the backend defaults). */
export type MascotSettings = {
  visible: boolean;
  roam: boolean;
  ideas: boolean;
  frequency: "few" | "normal" | "many";
  festive: boolean;
  tone: "default" | "professional" | "friendly" | "direct" | "playful";
  warmth: "less" | "default" | "more";
  enthusiasm: "less" | "default" | "more";
  emoji: "less" | "default" | "more";
  length: "short" | "default" | "detailed";
  name: string;
  instructions: string;
  aboutMe: string;
  memory: boolean;
};

export const MASCOT_DEFAULTS: MascotSettings = {
  visible: true,
  roam: false,
  ideas: true,
  frequency: "normal",
  festive: true,
  tone: "default",
  warmth: "default",
  enthusiasm: "default",
  emoji: "default",
  length: "default",
  name: "Syncro",
  instructions: "",
  aboutMe: "",
  memory: true,
};

export type MascotThought = {
  id: string;
  text: string;
  topic: string | null;
  importance: number;
  needsReply: boolean;
  emotion: string;
  status: string;
  saved?: boolean;
  messages?: { role: "user" | "assistant"; content: string; at?: string }[];
  createdAt: string;
  updatedAt?: string;
};

/* One copy of the settings for the whole app: the pet, the chat button and the settings page. */
let current: MascotSettings | null = null;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function load() {
  if (loading) return loading;
  loading = (async () => {
    try {
      const res = await apiFetch("/mascot/settings");
      current = res.ok ? { ...MASCOT_DEFAULTS, ...(await res.json()) } : { ...MASCOT_DEFAULTS };
    } catch {
      current = { ...MASCOT_DEFAULTS };
    }
    emit();
  })();
  return loading;
}

/** The mascot settings, or null while they load. */
export function useMascotSettings() {
  const value = useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => current,
    () => null,
  );
  useEffect(() => { if (!current) void load(); }, []);
  return value;
}

/** Saves some settings and updates every screen at once. */
export async function saveMascotSettings(patch: Partial<MascotSettings>) {
  current = { ...(current ?? MASCOT_DEFAULTS), ...patch };
  emit();
  const res = await apiFetch("/mascot/settings", { method: "PUT", body: JSON.stringify(patch) });
  if (!res.ok) throw new Error("No se pudo guardar");
  current = { ...MASCOT_DEFAULTS, ...(await res.json()) };
  emit();
  return current;
}

/** Christmas season in Venezuela: from November to Epiphany. */
export function isChristmasSeason(d = new Date()) {
  const m = d.getMonth();
  return m === 10 || m === 11 || (m === 0 && d.getDate() <= 6);
}
