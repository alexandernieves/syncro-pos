"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  IconBrandWhatsapp, IconBuildingStore, IconClock, IconDeviceFloppy, IconExternalLink, IconMapPin,
  IconPhoto, IconReceipt, IconTruckDelivery, IconUpload, IconX,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { API_URL } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

// Leaflet touches `window`, so the map only loads in the browser.
const LocationPicker = dynamic(() => import("./location-picker").then((m) => m.LocationPicker), {
  ssr: false,
  loading: () => <div className="h-72 rounded-xl bg-muted/40 animate-pulse" />,
});

type DayKey = "lun" | "mar" | "mie" | "jue" | "vie" | "sab" | "dom";
type Schedule = Record<DayKey, [string, string] | null>;
type StoreProfile = {
  slug: string;
  displayName: string | null;
  description: string | null;
  logo: string | null;
  banner: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  socials: { instagram?: string; facebook?: string; tiktok?: string; website?: string } | null;
  schedule: Schedule | null;
  pickupEnabled: boolean;
  deliveryEnabled: boolean;
  deliveryCostMode: "FIXED" | "TO_AGREE";
  deliveryCost: number;
  freeDeliveryFrom: number | null;
  deliveryNotes: string | null;
  minOrderAmount: number;
  showBolivares: boolean;
  returnPolicy: string | null;
  deliveryTime: string | null;
};

const DAYS: [DayKey, string][] = [
  ["lun", "Lunes"], ["mar", "Martes"], ["mie", "Miércoles"], ["jue", "Jueves"], ["vie", "Viernes"], ["sab", "Sábado"], ["dom", "Domingo"],
];
const DEFAULT_SCHEDULE: Schedule = {
  lun: ["08:00", "18:00"], mar: ["08:00", "18:00"], mie: ["08:00", "18:00"], jue: ["08:00", "18:00"], vie: ["08:00", "18:00"], sab: ["08:00", "13:00"], dom: null,
};
const SHOP_URL = "https://syncro.shop";

const areaClass = "w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50 resize-y";

export function StoreProfileEditor() {
  const [profile, setProfile] = useState<StoreProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_URL}/storefront/admin/profile`, { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });
        if (!res.ok) throw new Error();
        setProfile(await res.json());
      } catch {
        toast.error("No se pudo cargar el perfil de tu tienda");
      }
    })();
  }, []);

  if (!profile) return <div className="h-96 rounded-2xl bg-muted/40 animate-pulse" />;

  const set = <K extends keyof StoreProfile>(key: K, value: StoreProfile[K]) => {
    setProfile({ ...profile, [key]: value });
    setDirty(true);
  };
  const schedule = profile.schedule ?? null;

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/storefront/admin/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` },
        body: JSON.stringify(profile),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(Array.isArray(data.message) ? data.message.join(". ") : data.message);
      setProfile(data);
      setDirty(false);
      toast.success("Perfil de tu tienda guardado. Los cambios ya se ven en Syncro Shop.");
    } catch (e: any) {
      toast.error(e?.message || "No se pudo guardar el perfil");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Identity */}
      <Card className="border-border/80 shadow-xs">
        <SectionHeader icon={<IconBuildingStore className="w-4 h-4 text-primary" />} title="1. Identidad de tu tienda" description="Cómo te ven los compradores en Syncro Shop." />
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="sp-name">Nombre de la tienda</Label>
              <Input id="sp-name" value={profile.displayName ?? ""} onChange={(e) => set("displayName", e.target.value)} maxLength={80} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sp-slug">Dirección de tu tienda</Label>
              <div className="flex items-center rounded-md border border-input overflow-hidden">
                <span className="px-2.5 text-xs text-muted-foreground bg-muted h-9 flex items-center whitespace-nowrap">syncro.shop/tienda/</span>
                <input id="sp-slug" value={profile.slug} onChange={(e) => set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} maxLength={50} className="h-9 flex-1 min-w-0 px-2 text-sm bg-transparent outline-none font-mono" />
              </div>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sp-desc">Descripción</Label>
            <textarea id="sp-desc" value={profile.description ?? ""} onChange={(e) => set("description", e.target.value)} maxLength={500} rows={3} placeholder="Qué vendes, qué te hace especial, zonas donde entregas..." className={areaClass} />
          </div>
          <div className="grid gap-4 md:grid-cols-[160px_1fr]">
            <ImageField label="Logo" value={profile.logo} onChange={(v) => set("logo", v)} shape="square" />
            <ImageField label="Portada (banner)" value={profile.banner} onChange={(v) => set("banner", v)} shape="wide" />
          </div>
        </CardContent>
      </Card>

      {/* 2. Location */}
      <Card className="border-border/80 shadow-xs">
        <SectionHeader icon={<IconMapPin className="w-4 h-4 text-primary" />} title="2. Ubicación" description="Se muestra en el mapa de cada producto y en la página de tu tienda. También es el punto de retiro." />
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="sp-address">Dirección</Label>
            <Input id="sp-address" value={profile.address ?? ""} onChange={(e) => set("address", e.target.value)} maxLength={300} placeholder="Ej: av. 7ma entre calles 10 y 11, centro, san cristóbal" />
          </div>
          <LocationPicker
            latitude={profile.latitude}
            longitude={profile.longitude}
            address={profile.address}
            onChange={(lat, lng) => {
              setProfile((prev) => (prev ? { ...prev, latitude: lat, longitude: lng } : prev));
              setDirty(true);
            }}
          />
        </CardContent>
      </Card>

      {/* 3. Contact */}
      <Card className="border-border/80 shadow-xs">
        <SectionHeader icon={<IconBrandWhatsapp className="w-4 h-4 text-emerald-600" />} title="3. Contacto" description="El WhatsApp recibe las consultas y los avisos de pedidos de los compradores." />
        <CardContent className="grid gap-4 md:grid-cols-3">
          <TextField id="sp-wa" label="WhatsApp" value={profile.whatsapp} onChange={(v) => set("whatsapp", v)} placeholder="+58 414 123 4567" />
          <TextField id="sp-phone" label="Teléfono" value={profile.phone} onChange={(v) => set("phone", v)} placeholder="+58 276 123 4567" />
          <TextField id="sp-email" label="Correo" value={profile.email} onChange={(v) => set("email", v)} placeholder="ventas@mitienda.com" />
          {(["instagram", "facebook", "tiktok", "website"] as const).map((key) => (
            <TextField
              key={key}
              id={`sp-${key}`}
              label={{ instagram: "Instagram", facebook: "Facebook", tiktok: "TikTok", website: "Sitio web" }[key]}
              value={profile.socials?.[key] ?? ""}
              onChange={(v) => set("socials", { ...(profile.socials ?? {}), [key]: v })}
              placeholder={key === "website" ? "https://..." : "@usuario"}
            />
          ))}
        </CardContent>
      </Card>

      {/* 4. Schedule */}
      <Card className="border-border/80 shadow-xs">
        <SectionHeader icon={<IconClock className="w-4 h-4 text-primary" />} title="4. Horario de atención" description="Syncro Shop muestra si estás abierto o cerrado en este momento." />
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between rounded-xl border p-3">
            <p className="text-sm font-medium">Mostrar horario</p>
            <Switch checked={schedule !== null} onCheckedChange={(v) => set("schedule", v ? DEFAULT_SCHEDULE : null)} />
          </div>
          {schedule && (
            <div className="divide-y rounded-xl border">
              {DAYS.map(([day, label]) => {
                const hours = schedule[day];
                return (
                  <div key={day} className="flex items-center gap-3 px-3 py-2">
                    <Switch checked={hours !== null} onCheckedChange={(v) => set("schedule", { ...schedule, [day]: v ? ["08:00", "18:00"] : null })} className="scale-90" />
                    <span className="w-24 text-sm">{label}</span>
                    {hours ? (
                      <div className="flex items-center gap-2">
                        <input type="time" value={hours[0]} onChange={(e) => set("schedule", { ...schedule, [day]: [e.target.value, hours[1]] })} className="h-8 rounded-md border px-2 text-sm bg-transparent" />
                        <span className="text-xs text-muted-foreground">a</span>
                        <input type="time" value={hours[1]} onChange={(e) => set("schedule", { ...schedule, [day]: [hours[0], e.target.value] })} className="h-8 rounded-md border px-2 text-sm bg-transparent" />
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">Cerrado</span>
                    )}
                    {day === "lun" && hours && (
                      <button type="button" className="ml-auto text-[11px] font-semibold text-primary hover:underline" onClick={() => set("schedule", Object.fromEntries(DAYS.map(([d]) => [d, d === "dom" ? schedule.dom : hours])) as Schedule)}>
                        Copiar a lunes–sábado
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 5. Delivery */}
      <Card className="border-border/80 shadow-xs">
        <SectionHeader icon={<IconTruckDelivery className="w-4 h-4 text-primary" />} title="5. Entrega" description="Lo que el comprador puede elegir al hacer su pedido." />
        <CardContent className="space-y-4">
          <ToggleRow label="Retiro en tienda" hint="El comprador busca el pedido en tu dirección. Sin costo." checked={profile.pickupEnabled} onChange={(v) => set("pickupEnabled", v)} />
          <ToggleRow label="Delivery" hint="Entregas a domicilio." checked={profile.deliveryEnabled} onChange={(v) => set("deliveryEnabled", v)} />
          {profile.deliveryEnabled && (
            <div className="space-y-4 rounded-xl border p-4 bg-muted/10">
              <div className="grid grid-cols-2 gap-2">
                {([["FIXED", "Costo fijo", "Se suma al total del pedido."], ["TO_AGREE", "A convenir", "Lo acuerdas por WhatsApp."]] as const).map(([mode, label, hint]) => (
                  <button key={mode} type="button" onClick={() => set("deliveryCostMode", mode)} className={cn("rounded-xl border p-3 text-left", profile.deliveryCostMode === mode ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "hover:border-primary/40")}>
                    <p className="text-sm font-semibold">{label}</p>
                    <p className="text-[11px] text-muted-foreground">{hint}</p>
                  </button>
                ))}
              </div>
              {profile.deliveryCostMode === "FIXED" && (
                <div className="grid gap-4 md:grid-cols-2">
                  <MoneyField id="sp-dcost" label="Costo del delivery (USD)" value={profile.deliveryCost} onChange={(v) => set("deliveryCost", v ?? 0)} />
                  <MoneyField id="sp-free" label="Delivery gratis desde (USD, opcional)" value={profile.freeDeliveryFrom} onChange={(v) => set("freeDeliveryFrom", v)} nullable />
                </div>
              )}
              <TextField id="sp-dtime" label="Tiempo de entrega" value={profile.deliveryTime} onChange={(v) => set("deliveryTime", v)} placeholder="Ej: mismo día si pides antes de las 3 p. M." />
              <TextField id="sp-dnotes" label="Zonas o notas de delivery" value={profile.deliveryNotes} onChange={(v) => set("deliveryNotes", v)} placeholder="Ej: solo san cristóbal y táriba" />
            </div>
          )}
          {!profile.pickupEnabled && !profile.deliveryEnabled && (
            <p className="text-xs text-rose-600">Activa al menos una forma de entrega para poder recibir pedidos.</p>
          )}
        </CardContent>
      </Card>

      {/* 6. Sales and policies */}
      <Card className="border-border/80 shadow-xs">
        <SectionHeader icon={<IconReceipt className="w-4 h-4 text-primary" />} title="6. Ventas y políticas" />
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <MoneyField id="sp-min" label="Pedido mínimo (USD, 0 = sin mínimo)" value={profile.minOrderAmount} onChange={(v) => set("minOrderAmount", v ?? 0)} />
            <div className="flex items-end">
              <ToggleRow label="Mostrar precios en Bs" hint="Con la tasa BCV configurada en tu POS." checked={profile.showBolivares} onChange={(v) => set("showBolivares", v)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sp-returns">Política de cambios y devoluciones</Label>
            <textarea id="sp-returns" value={profile.returnPolicy ?? ""} onChange={(e) => set("returnPolicy", e.target.value)} maxLength={500} rows={2} placeholder="Ej: cambios dentro de los 7 días con factura y empaque original." className={areaClass} />
          </div>
        </CardContent>
      </Card>

      <div className="sticky bottom-4 z-10 flex items-center justify-end gap-2">
        <Button variant="outline" className="gap-2 bg-background" onClick={() => window.open(`${SHOP_URL}/tienda/${profile.slug}`, "_blank")}>
          <IconExternalLink size={16} /> Ver mi tienda
        </Button>
        <Button onClick={save} disabled={saving || !dirty} className="gap-2 shadow-lg shadow-primary/20">
          <IconDeviceFloppy size={16} /> {saving ? "Guardando..." : dirty ? "Guardar perfil de tienda" : "Guardado"}
        </Button>
      </div>
    </div>
  );
}

function SectionHeader({ icon, title, description }: { icon: React.ReactNode; title: string; description?: string }) {
  return (
    <CardHeader className="pb-3">
      <CardTitle className="text-base font-semibold flex items-center gap-2">{icon}{title}</CardTitle>
      {description && <CardDescription className="text-xs">{description}</CardDescription>}
    </CardHeader>
  );
}

function TextField({ id, label, value, onChange, placeholder }: { id: string; label: string; value: string | null; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

function MoneyField({ id, label, value, onChange, nullable }: { id: string; label: string; value: number | null; onChange: (v: number | null) => void; nullable?: boolean }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        min={0}
        step="0.01"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? (nullable ? null : 0) : Number(e.target.value))}
      />
    </div>
  );
}

function ToggleRow({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex w-full items-center justify-between gap-3 rounded-xl border p-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} className="data-[state=checked]:bg-primary shrink-0" />
    </div>
  );
}

function ImageField({ label, value, onChange, shape }: { label: string; value: string | null; onChange: (v: string | null) => void; shape: "square" | "wide" }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const upload = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${API_URL}/uploads`, { method: "POST", headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }, body: formData });
      if (!res.ok) throw new Error();
      onChange((await res.json()).url);
    } catch {
      toast.error("No se pudo subir la imagen");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
      <div className={cn("group relative overflow-hidden rounded-xl border-2 border-dashed bg-muted/10 flex items-center justify-center", shape === "square" ? "aspect-square" : "aspect-[3/1]")}>
        {value ? (
          <>
            <img src={value} alt={label} className="h-full w-full object-cover" />
            <button type="button" onClick={() => onChange(null)} className="absolute right-1.5 top-1.5 rounded-full bg-background/90 p-1 text-rose-500 opacity-0 group-hover:opacity-100" title="Quitar">
              <IconX size={12} />
            </button>
          </>
        ) : (
          <IconPhoto className="text-muted-foreground/40" size={28} />
        )}
        <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading} className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full bg-background/95 px-2.5 py-1 text-[10px] font-semibold shadow-sm">
          <IconUpload size={11} /> {uploading ? "Subiendo..." : value ? "Cambiar" : "Subir"}
        </button>
      </div>
    </div>
  );
}
