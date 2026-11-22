"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Copy, MessageCircle, QrCode, ShieldCheck } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { adminApi } from "@/lib/syncro-admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { FinanceSelect } from "./finance-fields";

const path = "/finance-nubi";
const workspaceNames = { personal: "Mis finanzas", company: "Empresa Syncro" };
type Phone = { phone: string; workspace: "personal" | "company"; activeUntil: string | null };
type Settings = { connected: boolean; state: string; phones: Phone[]; model: string; aiConfigured: boolean };

export default function FinanceNubiSettings() {
  const [settings, setSettings] = useState<Settings>();
  const [qr, setQr] = useState("");
  const [code, setCode] = useState<{ phone: string; code: string; expiresAt: string }>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const result = await adminApi<Settings>(path);
    setSettings(result);
    if (result.connected) setQr("");
  }, []);

  useEffect(() => {
    void load().catch(failure => setError(failure.message));
  }, [load]);

  useEffect(() => {
    if (!qr) return;
    const polling = window.setInterval(() => { void load().catch(() => {}); }, 4000);
    return () => window.clearInterval(polling);
  }, [load, qr]);

  useEffect(() => {
    if (!code) return;
    const timeout = window.setTimeout(() => setCode(undefined), Math.max(0, Date.parse(code.expiresAt) - Date.now()));
    return () => window.clearTimeout(timeout);
  }, [code]);

  async function act(action: () => Promise<unknown>) {
    setError("");
    setBusy(true);
    try {
      await action();
      await load();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "No se pudo completar la acción.");
    } finally {
      setBusy(false);
    }
  }

  function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    void act(async () => {
      await adminApi(path + "/phones", {
        method: "POST", body: JSON.stringify({ phone: values.get("phone"), workspace: values.get("workspace") }),
      });
      form.reset();
    });
  }

  const connected = !!settings?.connected;
  const qrImage = /^data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/]+=*$/.test(qr) ? qr : "";
  const rawImage = /^iVBORw0KGgo[A-Za-z0-9+/]+=*$/.test(qr) ? "data:image/png;base64," + qr : "";
  const image = qrImage || rawImage;

  return <div className="space-y-4">
    {error && <p role="alert" className="rounded-xl border bg-card p-3 text-destructive">{error}</p>}
    {!settings && !error && <div role="status" aria-label="Cargando Nubi WhatsApp" className="space-y-3">
      <Skeleton className="h-32 rounded-2xl" /><Skeleton className="h-28 rounded-2xl" />
    </div>}
    {settings && <>
      <section className="space-y-3 rounded-2xl border bg-card p-4 sm:p-5">
        <div className="flex items-center gap-2"><MessageCircle className="size-5 text-primary" /><h2 className="font-semibold">Conecta el número de Nubi</h2></div>
        <p role="status" className="text-sm">{connected ? "WhatsApp conectado" : settings.state === "NOT_CONFIGURED" ? "Falta configurar Evolution o el secreto del webhook en el backend." : "WhatsApp sin conectar"}</p>
        {settings.aiConfigured ? <p className="text-xs text-muted-foreground">Modelo: {settings.model}</p> : <p className="text-sm text-destructive">Falta configurar la clave de OpenRouter.</p>}
        <Button type="button" variant="outline" disabled={busy || settings.state === "NOT_CONFIGURED"} onClick={() => void act(async () => {
          const result = await adminApi<{ qr: string | null; connected: boolean }>(path + "/connect", { method: "POST" });
          setQr(result.qr ?? "");
          if (!result.qr && !result.connected) throw new Error("El QR todavía no está disponible. Vuelve a generarlo.");
        })}><QrCode /> {connected ? "Reparar conexión" : qr ? "Actualizar QR" : "Generar código QR"}</Button>
        {qr && <div className="space-y-2">
          <div className="w-fit max-w-full rounded-xl bg-white p-3">
            {image ? <img src={image} width={224} height={224} alt="QR para vincular WhatsApp de Nubi Finanzas" />
              : <QRCodeSVG value={qr} size={224} level="M" aria-label="QR para vincular WhatsApp de Nubi Finanzas" />}
          </div>
          <p className="text-sm text-muted-foreground">En el WhatsApp del bot abre Dispositivos vinculados y escanea el QR.</p>
        </div>}
      </section>
      <section className="space-y-3 rounded-2xl border bg-card p-4 sm:p-5">
        <div className="flex items-center gap-2"><ShieldCheck className="size-5 text-primary" /><h2 className="font-semibold">Números autorizados por ti</h2></div>
        <p className="text-sm text-muted-foreground">Cada número puede acceder al espacio que selecciones. Autoriza únicamente números que controlas y que sean distintos del número que escanea el QR.</p>
        <form onSubmit={add} className="flex flex-wrap items-end gap-2">
          <label className="text-sm font-medium">Número de WhatsApp<Input name="phone" type="tel" inputMode="tel" placeholder="+58 412 0000000" required maxLength={24} /></label>
          <FinanceSelect name="workspace" label="Espacio autorizado" defaultValue="personal" options={Object.entries(workspaceNames)} />
          <Button type="submit" disabled={busy}>Autorizar</Button>
        </form>
        {settings.phones.length === 0 ? <p className="text-sm text-muted-foreground">Todavía no autorizaste números.</p> : <ul className="space-y-2">
          {settings.phones.map(row => <li key={row.phone} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3">
            <div><p className="font-medium">+{row.phone}</p><p className="text-xs text-muted-foreground">{workspaceNames[row.workspace]}{row.activeUntil && Date.parse(row.activeUntil) > Date.now() ? " · sesión activa" : ""}</p></div>
            <div className="flex flex-wrap gap-1">
              <Button size="sm" type="button" variant="outline" disabled={busy || !connected} onClick={() => void act(async () => {
                const issued = await adminApi<{ code: string; expiresAt: string }>(`${path}/phones/${row.phone}/code`, { method: "POST" });
                setCopied(false);
                setCode({ ...issued, phone: row.phone });
              })}>Código de acceso</Button>
              <Button size="sm" type="button" variant="ghost" disabled={busy} onClick={() => void act(async () => {
                await adminApi(`${path}/phones/${row.phone}`, { method: "DELETE" });
                if (code?.phone === row.phone) setCode(undefined);
              })}>Revocar</Button>
            </div>
          </li>)}
        </ul>}
        {code && <div className="space-y-2 rounded-xl border border-primary/30 bg-primary/5 p-3" role="status">
          <p className="text-sm">Desde +{code.phone}, escribe <strong>finanza</strong> al número de Nubi y luego envía este código. Vence en cinco minutos.</p>
          <div className="flex items-center gap-2">
            <code className="font-mono text-xl font-semibold tracking-widest">{code.code}</code>
            <Button type="button" variant="ghost" size="sm" onClick={() => {
              void navigator.clipboard?.writeText(code.code).then(() => setCopied(true)).catch(() => {});
            }}><Copy /> {copied ? "Copiado" : "Copiar"}</Button>
          </div>
        </div>}
      </section>
    </>}
  </div>;
}
