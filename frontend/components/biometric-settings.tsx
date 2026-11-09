"use client";

import { useCallback, useEffect, useState } from "react";
import { IconDeviceDesktop, IconFingerprint, IconLoader2, IconTrash } from "@tabler/icons-react";
import { toast } from "sonner";
import { API_URL } from "@/lib/constants";
import { apiFetch } from "@/lib/api";
import { type BioSupport, biometricSupport, disableBiometric, enableBiometric, localBiometricId } from "@/lib/biometric";
import { FingerprintScan, type ScanState } from "@/components/fingerprint-scan";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Computer = { id: string; kind: "DEVICE_TOKEN" | "PASSKEY"; deviceName: string; platform: string | null; createdAt: string; lastUsedAt: string | null };

function session() {
  try {
    const pwa = window.matchMedia("(display-mode: standalone)").matches;
    const store = pwa ? sessionStorage : localStorage;
    return { token: store.getItem("token") || "", user: JSON.parse(store.getItem("user") || "null") as { email?: string; name?: string; role?: string; businessName?: string } | null };
  } catch {
    return { token: "", user: null };
  }
}

/** Keeps this account as a saved profile on this computer, so the fingerprint shows up at the login. */
async function saveProfileHere(token: string, user: { email?: string; name?: string; role?: string }, businessName?: string) {
  let clientId = localStorage.getItem("syncro_cid");
  if (!clientId) {
    clientId = crypto.randomUUID();
    localStorage.setItem("syncro_cid", clientId);
  }
  // Also remembered on this computer, so the login shows it even if the server is slow
  try {
    const list = JSON.parse(localStorage.getItem("syncro-saved-profiles") || "[]") as { email: string }[]
    const me = { email: user.email, name: user.name || user.email?.split("@")[0], role: user.role || "Usuario", businessName, lastLogin: new Date().toISOString() }
    localStorage.setItem("syncro-saved-profiles", JSON.stringify([me, ...list.filter((p) => p.email?.toLowerCase() !== user.email?.toLowerCase())]))
  } catch {
    // storage blocked
  }
  await fetch(`${API_URL}/auth/saved-profiles`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ clientId, email: user.email, name: user.name || user.email?.split("@")[0], role: user.role || "Usuario", businessName }),
  }).catch(() => undefined);
}

const when = (d: string | null) => (d ? new Date(d).toLocaleString("es-VE", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }) : "nunca");

/** Configuración → Sesión y seguridad → enter with fingerprint (Touch ID) or Windows Hello. */
export function BiometricSettings() {
  const [support, setSupport] = useState<BioSupport | undefined>(undefined);
  const [computers, setComputers] = useState<Computer[] | null>(null);
  const [here, setHere] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [scan, setScan] = useState<ScanState>("idle");
  const [busy, setBusy] = useState<string | null>(null);
  const email = typeof window !== "undefined" ? session().user?.email ?? "" : "";

  const load = useCallback(() => {
    apiFetch("/auth/biometric").then(async (r) => setComputers(r.ok ? await r.json() : [])).catch(() => setComputers([]));
    setHere(email ? localBiometricId(email) : null);
  }, [email]);
  useEffect(() => {
    biometricSupport().then(setSupport);
    load();
  }, [load]);

  // This computer says it is on, but Syncro no longer has it (removed elsewhere or new password)
  const hereActive = !!here && !!computers?.some((c) => c.id === here);

  const start = async () => {
    const { token, user } = session();
    if (!token || !user?.email) return;
    setScan("scanning");
    try {
      await enableBiometric(user.email, token);
      await saveProfileHere(token, user, (user as { businessName?: string }).businessName ?? localStorage.getItem("businessName") ?? undefined);
      setScan("done");
      load();
    } catch (e) {
      setScan("error");
      const msg = (e as Error).message;
      if (msg !== "cancelled") toast.error(msg);
      setTimeout(() => setScan("idle"), 900);
    }
  };

  const removeHere = async () => {
    const { token } = session();
    setBusy("here");
    await disableBiometric(email, token);
    setBusy(null);
    toast.success("Huella quitada de esta computadora");
    load();
  };

  const removeOne = async (c: Computer) => {
    setBusy(c.id);
    const res = await apiFetch(`/auth/biometric/${c.id}`, { method: "DELETE" }).catch(() => null);
    if (c.id === here) await disableBiometric(email);
    setBusy(null);
    if (res?.ok) toast.success(`Quitada de «${c.deviceName}»`);
    load();
  };

  const label = support?.label === "Windows Hello" ? "Windows Hello" : "huella";

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-primary/15 p-2 text-primary"><IconFingerprint size={20} /></div>
          <div className="min-w-0 flex-1">
            <CardTitle className="text-sm">Entrar con {label}</CardTitle>
            <CardDescription className="text-xs">
              Desde tu perfil guardado en el inicio de sesión, entras tocando el sensor en vez de escribir la contraseña. Tu huella nunca sale de la computadora: la revisa {support?.platform === "windows" ? "Windows" : "macOS"} y Syncro solo recibe un sí o un no.
            </CardDescription>
          </div>
          {hereActive && <Badge className="border-emerald-500/30 bg-emerald-500/15 text-emerald-700">Activa aquí</Badge>}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {support === undefined ? (
          <p className="text-sm text-muted-foreground">Revisando esta computadora…</p>
        ) : support === null ? (
          <p className="rounded-lg bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
            Esta computadora no tiene huella ni Windows Hello configurado. En Mac actívalo en <strong>Ajustes del Sistema → Touch ID y contraseña</strong>; en Windows, en <strong>Configuración → Cuentas → Opciones de inicio de sesión</strong>. Luego vuelve aquí.
          </p>
        ) : hereActive ? (
          <div className="flex flex-wrap items-center gap-2">
            <p className="flex-1 text-sm text-muted-foreground">En esta computadora ya entras con {label}.</p>
            <Button variant="outline" size="sm" disabled={busy === "here"} onClick={removeHere}>{busy === "here" ? <IconLoader2 size={14} className="animate-spin" /> : <IconTrash size={14} />} Quitar de esta computadora</Button>
          </div>
        ) : (
          <Button onClick={() => { setScan("idle"); setOpen(true); }}><IconFingerprint size={16} /> Activar en esta computadora</Button>
        )}

        {!!computers?.length && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Computadoras donde entras con huella o Windows Hello</p>
            <div className="divide-y rounded-lg border">
              {computers.map((c) => (
                <div key={c.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                  <IconDeviceDesktop size={18} className="shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{c.deviceName}{c.id === here ? " · esta computadora" : ""}</p>
                    <p className="truncate text-xs text-muted-foreground">{c.kind === "DEVICE_TOKEN" ? "Touch ID (app de escritorio)" : c.platform === "windows" ? "Windows Hello" : "Llave de acceso"} · activada {when(c.createdAt)} · último uso {when(c.lastUsedAt)}</p>
                  </div>
                  <Button variant="ghost" size="sm" disabled={busy === c.id} onClick={() => removeOne(c)}>{busy === c.id ? <IconLoader2 size={14} className="animate-spin" /> : "Quitar"}</Button>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Si cambias tu contraseña, se quita de todas y vuelves a activarla.</p>
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={(o) => { if (scan !== "scanning") setOpen(o); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="items-center text-center">
            <DialogTitle>{scan === "done" ? "¡Listo!" : `Activa ${label === "huella" ? "tu huella" : label}`}</DialogTitle>
            <DialogDescription>
              {scan === "done"
                ? `La próxima vez, en el inicio de sesión, elige tu perfil y entra con ${label}.`
                : scan === "scanning"
                  ? support?.hint
                  : `Te pediremos ${label === "huella" ? "tu huella" : "Windows Hello"} una vez para unirla a tu perfil en esta computadora.`}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center py-6">
            <FingerprintScan state={scan} size={150} />
          </div>
          <DialogFooter className="sm:justify-center">
            {scan === "done" ? (
              <Button data-kbd-primary onClick={() => setOpen(false)}>Entendido</Button>
            ) : (
              <Button data-kbd-primary disabled={scan === "scanning"} onClick={start}>
                {scan === "scanning" ? <><IconLoader2 size={16} className="animate-spin" /> Esperando…</> : scan === "error" ? "Intentar de nuevo" : "Comenzar"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
