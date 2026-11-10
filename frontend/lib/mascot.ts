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
  outfit: "auto" | "santa" | "reindeer" | "none";
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
  outfit: "auto",
  tone: "default",
  warmth: "default",
  enthusiasm: "default",
  emoji: "default",
  length: "default",
  name: "Nubi",
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

export type SeasonOutfit = "santa" | "reindeer" | "tree" | "elf" | "snowman";
const OUTFITS: SeasonOutfit[] = ["santa", "reindeer", "tree", "elf", "snowman"];

/** A number from 0 to 1 that is always the same for the same text (so a choice holds for a while). */
function seeded(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10000) / 10000;
}

/**
 * Syncro's outfit for each morning and afternoon of the season (Nov 1 – Jan 6), standard for every
 * business. All five stand for Christmas, so each one comes up equally often (20%); the pick holds
 * for the half day, so it doesn't change on a whim.
 */
export function favouriteOutfit(d = new Date(), who = ""): SeasonOutfit {
  const halfDay = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours() < 13 ? "am" : "pm"}`;
  const x = seeded(`${who}:${halfDay}`);
  return OUTFITS[Math.min(OUTFITS.length - 1, Math.floor(x * OUTFITS.length))];
}

/** What to put on now: mostly the favourite of this half day, now and then one of the others. */
export function pickOutfit(d = new Date(), who = ""): SeasonOutfit {
  const fav = favouriteOutfit(d, who);
  if (Math.random() < 0.7) return fav;
  const others = OUTFITS.filter((o) => o !== fav);
  return others[Math.floor(Math.random() * others.length)];
}
