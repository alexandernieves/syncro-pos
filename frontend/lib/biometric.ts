"use client";

import { browserSupportsWebAuthn, platformAuthenticatorIsAvailable, startAuthentication, startRegistration } from "@simplewebauthn/browser";
import { API_URL } from "@/lib/constants";

/**
 * Sign in with fingerprint from a saved profile.
 *
 * - Syncro desktop app on Mac → Touch ID asked by the app; the pass stays in the Mac's keychain.
 * - Windows (app or browser) and Chrome on Mac → a passkey: Windows Hello (fingerprint, face or the
 *   computer's PIN) or Touch ID.
 *
 * Fingerprints never reach Syncro: the operating system checks them and only says yes or no.
 * This computer remembers which saved profiles have it on (a device setting, not account data).
 */

type DesktopBio = {
  info: () => Promise<{ touchId: boolean; deviceName: string; platform: string } | null>;
  has: (email: string) => Promise<boolean>;
  verify: (reason: string) => Promise<boolean>;
  store: (input: { email: string; id: string; secret: string }) => Promise<boolean>;
  unlock: (input: { email: string; reason?: string }) => Promise<{ id: string; secret: string } | { cancelled: true } | null>;
  remove: (email: string) => Promise<boolean>;
};
const desktop = (): DesktopBio | undefined =>
  typeof window === "undefined" ? undefined : (window as unknown as { electron?: { biometric?: DesktopBio } }).electron?.biometric;

export type BioMethod = "touchid-app" | "passkey";
export type BioSupport = { method: BioMethod; label: string; hint: string; platform: "mac" | "windows" | "other"; deviceName: string } | null;

const LOCAL = "syncro-bio:"; // + email → credential id on this computer (kept when signing out)
const emailKey = (email: string) => LOCAL + email.trim().toLowerCase();

function osName(): "mac" | "windows" | "other" {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  if (/Mac OS X|Macintosh/.test(ua)) return "mac";
  if (/Windows/.test(ua)) return "windows";
  return "other";
}

function guessDeviceName(platform: "mac" | "windows" | "other") {
  const browser = /Edg\//.test(navigator.userAgent) ? "Edge" : /Chrome\//.test(navigator.userAgent) ? "Chrome" : /Safari\//.test(navigator.userAgent) ? "Safari" : "Navegador";
  return `${browser} en ${platform === "mac" ? "Mac" : platform === "windows" ? "Windows" : "esta computadora"}`;
}

/** What this computer can do (null: no fingerprint, face or Windows Hello here). */
export async function biometricSupport(): Promise<BioSupport> {
  const platform = osName();
  const app = desktop();
  if (app) {
    const info = await app.info().catch(() => null);
    if (info?.touchId) return { method: "touchid-app", label: "huella", hint: "Toca el sensor de Touch ID de tu Mac", platform: "mac", deviceName: info.deviceName || "Mac" };
  }
  try {
    if (browserSupportsWebAuthn() && (await platformAuthenticatorIsAvailable())) {
      return platform === "windows"
        ? { method: "passkey", label: "Windows Hello", hint: "Confirma con tu huella, tu cara o el PIN de Windows", platform, deviceName: guessDeviceName(platform) }
        : { method: "passkey", label: "huella", hint: platform === "mac" ? "Toca el sensor de Touch ID de tu Mac" : "Confirma con el desbloqueo de tu dispositivo", platform, deviceName: guessDeviceName(platform) };
    }
  } catch {
    // no platform authenticator
  }
  return null;
}

/** Whether this saved profile signs in with fingerprint on this computer. */
export async function hasBiometric(email: string) {
  try {
    if (!localStorage.getItem(emailKey(email))) return false;
  } catch {
    return false;
  }
  const app = desktop();
  const support = await biometricSupport();
  if (support?.method === "touchid-app" && app) return app.has(email);
  return !!support;
}

const authHeaders = (token: string) => ({ "Content-Type": "application/json", Authorization: `Bearer ${token}` });
async function json<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.message || "No se pudo completar");
  return body as T;
}

/**
 * Turns it on for the signed-in person on this computer. The operating system asks for the
 * fingerprint (Touch ID) or Windows Hello once.
 */
export async function enableBiometric(email: string, token: string): Promise<void> {
  const support = await biometricSupport();
  if (!support) throw new Error("Esta computadora no tiene huella ni Windows Hello");
  const app = desktop();
  if (support.method === "touchid-app" && app) {
    if (!(await app.verify("activar el acceso con huella a Syncro"))) throw new Error("cancelled");
    const r = await json<{ id: string; secret: string }>(await fetch(`${API_URL}/auth/biometric/device`, { method: "POST", headers: authHeaders(token), body: JSON.stringify({ deviceName: support.deviceName, platform: "mac" }) }));
    if (!(await app.store({ email, ...r }))) throw new Error("No se pudo guardar en el llavero de la Mac");
    localStorage.setItem(emailKey(email), r.id);
    return;
  }
  const options = await json<Parameters<typeof startRegistration>[0]["optionsJSON"]>(await fetch(`${API_URL}/auth/biometric/passkey/register-options`, { method: "POST", headers: authHeaders(token) }));
  let response;
  try {
    response = await startRegistration({ optionsJSON: options });
  } catch (e) {
    throw new Error(/NotAllowed|cancel|abort/i.test(String((e as Error)?.name || e)) ? "cancelled" : (e as Error).message);
  }
  const r = await json<{ id: string }>(await fetch(`${API_URL}/auth/biometric/passkey/register`, { method: "POST", headers: authHeaders(token), body: JSON.stringify({ response, deviceName: support.deviceName, platform: support.platform }) }));
  localStorage.setItem(emailKey(email), r.id);
}

/** Signs in as this saved profile with fingerprint. Returns what /auth/login returns. */
export async function signInWithBiometric(email: string): Promise<{ access_token: string; user: any }> {
  const support = await biometricSupport();
  if (!support) throw new Error("Esta computadora no tiene huella ni Windows Hello");
  const app = desktop();
  if (support.method === "touchid-app" && app) {
    const pass = await app.unlock({ email, reason: "entrar a Syncro" });
    if (!pass) throw new Error("La huella no está activada para este perfil en esta Mac");
    if ("cancelled" in pass) throw new Error("cancelled");
    return json(await fetch(`${API_URL}/auth/biometric/device/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(pass) }));
  }
  const { options, challengeId } = await json<{ options: Parameters<typeof startAuthentication>[0]["optionsJSON"]; challengeId: string }>(
    await fetch(`${API_URL}/auth/biometric/passkey/login-options`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) }),
  );
  let response;
  try {
    response = await startAuthentication({ optionsJSON: options });
  } catch (e) {
    throw new Error(/NotAllowed|cancel|abort/i.test(String((e as Error)?.name || e)) ? "cancelled" : (e as Error).message);
  }
  return json(await fetch(`${API_URL}/auth/biometric/passkey/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ challengeId, response }) }));
}

/** Forgets it on this computer (and, with a token, on Syncro too). */
export async function disableBiometric(email: string, token?: string) {
  let id: string | null = null;
  try {
    id = localStorage.getItem(emailKey(email));
    localStorage.removeItem(emailKey(email));
  } catch {
    // ignore
  }
  await desktop()?.remove(email).catch(() => undefined);
  if (id && token) await fetch(`${API_URL}/auth/biometric/${id}`, { method: "DELETE", headers: authHeaders(token) }).catch(() => undefined);
}

/** The credential id this computer keeps for that profile (to mark it in the list). */
export function localBiometricId(email: string) {
  try {
    return localStorage.getItem(emailKey(email));
  } catch {
    return null;
  }
}
