import { db } from "./db";

/**
 * Golden rule: one account never sees another account's data, not even on the same computer.
 *
 * Signing out (or signing in as someone else) wipes everything the browser kept for the account:
 * localStorage, sessionStorage and the offline database. Only settings of the device itself
 * survive (the receipt sound, the scanner, where the chat tab sits, the theme…). Then the app is
 * reloaded from scratch, so nothing stays in memory either (mascot settings, modules, counters…).
 */

/** What belongs to the computer, not to whoever is signed in. */
const DEVICE_KEYS = new Set([
  "syncro_cid", // this device's id for the saved profiles on the login screen
  "syncro_last_account", // who was signed in last (to notice a different account)
  "syncro-receipt-sound",
  "syncro-scanner-always-on",
  "syncro-chat-tab",
  "syncro-chat-intro-seen",
  "syncro-push-prompt-snooze",
  "gym-leads-view",
  "theme",
]);
const DEVICE_PREFIXES = ["syncro-finance-tab:", "syncro-bio:"];
const SESSION_KEEP = new Set(["syncro_suspended_message"]);

const keep = (key: string) => DEVICE_KEYS.has(key) || DEVICE_PREFIXES.some((p) => key.startsWith(p));

/** Removes everything the browser stored for the account that was signed in. */
export async function purgeAccountData() {
  if (typeof window === "undefined") return;
  try {
    for (const key of Object.keys(localStorage)) if (!keep(key)) localStorage.removeItem(key);
  } catch {
    // storage blocked: nothing kept there anyway
  }
  try {
    for (const key of Object.keys(sessionStorage)) if (!SESSION_KEEP.has(key)) sessionStorage.removeItem(key);
  } catch {
    // ignore
  }
  try {
    await Promise.all([db.products.clear(), db.clients.clear(), db.pendingSales.clear(), db.cache.clear()]);
  } catch (error) {
    console.error("Failed to clear IndexedDB tables:", error);
  }
}

/** Signs out on this device: token cookie, stored data and offline data. */
export async function clearAuthSession() {
  if (typeof window === "undefined") return;
  document.cookie = "token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
  await purgeAccountData();
}

/** Signs out and reloads the app at the login, so nothing of the account stays in memory. */
export async function signOutAndReload(path = "/login") {
  await clearAuthSession();
  window.location.replace(path);
}

/**
 * Before saving a new session: if a different account was signed in on this device, wipe what
 * it left behind. Call it right before storing the new token.
 */
export async function adoptAccount(user: { id?: string } | null | undefined) {
  if (typeof window === "undefined" || !user?.id) return;
  let previous: string | null = null;
  try {
    previous = localStorage.getItem("syncro_last_account");
    if (!previous) {
      const stored = JSON.parse(localStorage.getItem("user") || sessionStorage.getItem("user") || "null");
      previous = stored?.id ?? null;
    }
  } catch {
    previous = null;
  }
  if (previous !== user.id) await purgeAccountData();
  try {
    localStorage.setItem("syncro_last_account", user.id);
  } catch {
    // ignore
  }
}

/** The account signed in on this tab right now (to notice when another tab switches it). */
export function currentAccountId(): string | null {
  try {
    const raw = localStorage.getItem("user") || sessionStorage.getItem("user");
    return raw ? (JSON.parse(raw)?.id ?? null) : null;
  } catch {
    return null;
  }
}
