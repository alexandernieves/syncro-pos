"use client";

import { useState } from "react";
import { toast } from "sonner";
import { IconBell, IconLoader2, IconMoon, IconSend } from "@tabler/icons-react";
import { API_URL } from "@/lib/constants";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";

export type AlertGroup = "SALE" | "CREDIT" | "CREDIT_PAYMENT" | "EXPENSE" | "STOCK" | "ORDERS" | "CASH";
export type WhatsAppAlerts = {
  enabled: boolean;
  recipients: string[];
  self: boolean;
  events: Record<AlertGroup, boolean>;
  saleMin: number;
  quiet: { enabled: boolean; from: string; to: string };
};

export const DEFAULT_WHATSAPP_ALERTS: WhatsAppAlerts = {
  enabled: false,
  recipients: [],
  self: false,
  events: { SALE: false, CREDIT: true, CREDIT_PAYMENT: true, EXPENSE: true, STOCK: true, ORDERS: true, CASH: true },
  saleMin: 0,
  quiet: { enabled: true, from: "22:00", to: "06:00" },
};

/** What the server sent (or nothing yet), as a full configuration for the screen. */
export const readWhatsAppAlerts = (raw: any): WhatsAppAlerts => ({
  ...DEFAULT_WHATSAPP_ALERTS,
  ...(raw && typeof raw === "object" ? raw : {}),
  events: { ...DEFAULT_WHATSAPP_ALERTS.events, ...(raw?.events ?? {}) },
  quiet: { ...DEFAULT_WHATSAPP_ALERTS.quiet, ...(raw?.quiet ?? {}) },
  recipients: Array.isArray(raw?.recipients) ? raw.recipients : [],
});

const EVENTS: { key: AlertGroup; icon: string; label: string; hint: string }[] = [
  { key: "SALE", icon: "💰", label: "Ventas", hint: "Cada venta, o solo las grandes (abajo)" },
  { key: "CREDIT", icon: "📒", label: "Fiados nuevos", hint: "A quién le fiaste, cuánto y cuándo paga" },
  { key: "CREDIT_PAYMENT", icon: "✅", label: "Abonos recibidos", hint: "Quién abonó y cuánto le queda" },
  { key: "EXPENSE", icon: "💸", label: "Gastos", hint: "Gastos registrados y gastos fuera de lo normal" },
  { key: "STOCK", icon: "📦", label: "Stock bajo", hint: "Productos por acabarse" },
  { key: "ORDERS", icon: "🛵", label: "Pedidos", hint: "Delivery y Syncro Shop" },
  { key: "CASH", icon: "🧾", label: "Caja", hint: "Cierres de caja (si cuadró, faltó o sobró) y cajas abiertas de más" },
];

const digits = (p: string) => p.replace(/\D/g, "");

/**
 * "Avisos por WhatsApp" in Configuración → Bot de WhatsApp: the same notifications as the bell,
 * sent through the bot's WhatsApp to the owner's authorized numbers.
 */
export function WhatsAppAlertsSettings({
  value,
  onChange,
  authorizedPhones,
}: {
  value: WhatsAppAlerts;
  onChange: (v: WhatsAppAlerts) => void;
  authorizedPhones: string[];
}) {
  const [testing, setTesting] = useState(false);
  const set = (patch: Partial<WhatsAppAlerts>) => onChange({ ...value, ...patch });
  const phones = [...new Set(authorizedPhones.map(digits).filter(Boolean))];
  const toggleRecipient = (p: string, on: boolean) => set({ recipients: on ? [...new Set([...value.recipients, p])] : value.recipients.filter((x) => x !== p) });

  const test = async () => {
    setTesting(true);
    try {
      const res = await fetch(`${API_URL}/whatsapp/alerts/test`, {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("token") || ""}`, "Content-Type": "application/json" },
        body: JSON.stringify(value),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message || "No se pudo enviar la prueba");
      if (data.failed?.length) toast.warning(`Enviado a ${data.sent.length}; falló en ${data.failed.length}`);
      else toast.success(`Mensaje de prueba enviado a ${data.sent.length} número(s)`);
    } catch (e: any) {
      toast.error(e?.message || "No se pudo enviar la prueba");
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card>
      <CardContent className="flex flex-col gap-6 p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <IconBell size={22} />
            </div>
            <div>
              <p className="font-bold">Avisos por WhatsApp</p>
              <p className="text-xs text-muted-foreground">Las mismas notificaciones de la campanita, en tu WhatsApp. Si llegan varias juntas, te llegan en un solo mensaje.</p>
            </div>
          </div>
          <Switch checked={value.enabled} onCheckedChange={(v) => set({ enabled: v })} aria-label="Avisos por WhatsApp" />
        </div>

        {value.enabled && (
          <>
            <Separator />
            <div className="flex flex-col gap-3">
              <div>
                <Label className="text-sm font-bold">¿A qué números?</Label>
                <p className="text-xs text-muted-foreground">Solo a los números autorizados de arriba. Nunca se envía a clientes.</p>
              </div>
              {phones.length === 0 ? (
                <p className="rounded-lg border border-dashed p-3 text-center text-xs italic text-muted-foreground">Agrega arriba tu número personal para recibir los avisos con sonido.</p>
              ) : (
                <div className="flex flex-col divide-y rounded-lg border">
                  {phones.map((p) => (
                    <label key={p} className="flex cursor-pointer items-center gap-3 p-3 hover:bg-muted/30">
                      <Checkbox checked={value.recipients.includes(p)} onCheckedChange={(v) => toggleRecipient(p, v === true)} />
                      <span className="text-sm font-medium">+{p}</span>
                    </label>
                  ))}
                </div>
              )}
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 hover:bg-muted/30">
                <Checkbox className="mt-0.5" checked={value.self} onCheckedChange={(v) => set({ self: v === true })} />
                <span className="text-sm">
                  <span className="font-medium">El mismo número que escaneó el QR</span>
                  <span className="block text-xs text-muted-foreground">Llegan a tu chat “Tú” (mensajes a ti mismo). WhatsApp no suena con esos: solo los ves si abres ese chat.</span>
                </span>
              </label>
            </div>

            <Separator />
            <div className="flex flex-col gap-3">
              <Label className="text-sm font-bold">¿Qué avisos?</Label>
              <div className="flex flex-col divide-y rounded-lg border">
                {EVENTS.map((e) => (
                  <div key={e.key} className="flex items-center justify-between gap-4 p-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{e.icon} {e.label}</p>
                      <p className="text-xs text-muted-foreground">{e.hint}</p>
                    </div>
                    <Switch checked={value.events[e.key]} onCheckedChange={(v) => set({ events: { ...value.events, [e.key]: v } })} aria-label={e.label} />
                  </div>
                ))}
              </div>
              {value.events.SALE && (
                <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/40 p-3 text-sm">
                  <span>Avisarme solo de ventas desde</span>
                  <div className="relative w-28">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                    <Input type="number" min={0} step="1" className="h-9 pl-6" value={value.saleMin || ""} placeholder="0" onChange={(e) => set({ saleMin: Math.max(0, Number(e.target.value) || 0) })} aria-label="Monto mínimo de venta" />
                  </div>
                  <span className="text-xs text-muted-foreground">(vacío = todas las ventas)</span>
                </div>
              )}
            </div>

            <Separator />
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label className="flex items-center gap-1.5 text-sm font-bold"><IconMoon size={15} /> Horario de silencio</Label>
                  <p className="text-xs text-muted-foreground">En ese horario no te llega nada; lo que pase te llega junto al terminar.</p>
                </div>
                <Switch checked={value.quiet.enabled} onCheckedChange={(v) => set({ quiet: { ...value.quiet, enabled: v } })} aria-label="Horario de silencio" />
              </div>
              {value.quiet.enabled && (
                <div className="flex items-center gap-2 text-sm">
                  <span>De</span>
                  <Input type="time" className="h-9 w-32" value={value.quiet.from} onChange={(e) => set({ quiet: { ...value.quiet, from: e.target.value } })} aria-label="Silencio desde" />
                  <span>a</span>
                  <Input type="time" className="h-9 w-32" value={value.quiet.to} onChange={(e) => set({ quiet: { ...value.quiet, to: e.target.value } })} aria-label="Silencio hasta" />
                </div>
              )}
            </div>

            <Separator />
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="outline" className="gap-2" onClick={() => void test()} disabled={testing}>
                {testing ? <IconLoader2 size={16} className="animate-spin" /> : <IconSend size={16} />} Enviar mensaje de prueba
              </Button>
              <p className="text-xs text-muted-foreground">Necesita el WhatsApp del bot conectado. Recuerda guardar los cambios.</p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
