"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  IconArrowDown,
  IconArrowUp,
  IconCheck,
  IconDeviceFloppy,
  IconLoader2,
  IconPhotoPlus,
  IconPrinter,
  IconRefresh,
  IconTrash,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { API_URL } from "@/lib/constants";
import { cn } from "@/lib/utils";
import {
  type InvoiceDesign,
  type InvoiceQrType,
  type InvoiceSectionId,
  INVOICE_TEMPLATES,
  SECTION_LABELS,
  designFromTemplate,
  normalizeInvoiceDesign,
} from "@/lib/invoice/design";
import { printInvoice, resolveInvoiceBusiness } from "@/lib/invoice/render";
import { sampleInvoice } from "@/lib/invoice/sample";
import { InvoiceDocument, qrValue, type InvoiceInk } from "@/components/invoice/invoice-document";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

const COLORS = ["#E4572E", "#16140F", "#2563EB", "#059669", "#7C3AED", "#DB2777", "#D97706", "#0891B2"];

const PAPER_OPTIONS: [InvoiceDesign["paper"], string][] = [["80", "80 mm"], ["58", "58 mm"], ["a4", "Carta / A4"]];
const FONT_OPTIONS: [InvoiceDesign["font"], string][] = [["mono", "Ticket"], ["sans", "Moderna"], ["serif", "Clásica"]];
const LOGO_SIZES: [InvoiceDesign["logoSize"], string][] = [["sm", "Pequeño"], ["md", "Mediano"], ["lg", "Grande"]];
const QR_OPTIONS: [InvoiceQrType, string][] = [["none", "Sin QR"], ["pagomovil", "Pago móvil"], ["instagram", "Instagram"], ["website", "Página web"], ["custom", "Texto o enlace"]];

const BUSINESS_FIELDS: { key: keyof InvoiceDesign["business"]; label: string; show?: keyof InvoiceDesign["show"]; placeholder?: string }[] = [
  { key: "name", label: "Nombre del negocio" },
  { key: "rif", label: "RIF", show: "rif" },
  { key: "address", label: "Dirección", show: "address" },
  { key: "phone", label: "Teléfono", show: "phone" },
  { key: "email", label: "Correo", show: "email" },
  { key: "website", label: "Página web", show: "website" },
  { key: "instagram", label: "Instagram", show: "instagram", placeholder: "@minegocio" },
  { key: "slogan", label: "Eslogan", show: "slogan", placeholder: "Calidad al mejor precio" },
];

const DETAIL_TOGGLES: { key: keyof InvoiceDesign["show"]; label: string }[] = [
  { key: "cashier", label: "Nombre del cajero" },
  { key: "clientDocument", label: "Cédula o RIF del cliente" },
  { key: "clientPhone", label: "Teléfono del cliente" },
  { key: "itemCode", label: "Código de cada producto" },
  { key: "unitPrice", label: "Precio unitario" },
  { key: "itemDiscount", label: "Descuento por producto" },
  { key: "taxBreakdown", label: "Desglose del IVA" },
  { key: "bsTotals", label: "Total en bolívares" },
  { key: "exchangeRate", label: "Tasa de cambio" },
  { key: "change", label: "Cambio entregado" },
  { key: "nonFiscalNote", label: "Aviso de documento no fiscal" },
];

const PREVIEW_WIDTH: Record<InvoiceDesign["paper"], number> = { "80": 302, "58": 220, a4: 720 };

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex rounded-lg border bg-muted/40 p-0.5">
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={cn("rounded-md px-3 py-1.5 text-xs font-semibold transition-colors", value === v ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function Block({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div>
          <p className="text-sm font-semibold">{title}</p>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

/** Configuración → Factura: pick a template and customize the invoice, with a live preview. */
export function InvoiceDesigner() {
  const [settings, setSettings] = useState<any>(null);
  const [design, setDesign] = useState<InvoiceDesign | null>(null);
  const [savedJson, setSavedJson] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [ink, setInk] = useState<InvoiceInk>("thermal");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_URL}/settings`, { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });
        if (!res.ok) throw new Error();
        const data = await res.json();
        const initial = normalizeInvoiceDesign(data?.invoiceDesign, data);
        setSettings(data);
        setDesign(initial);
        setSavedJson(JSON.stringify(initial));
      } catch {
        toast.error("No se pudo cargar la configuración de la factura");
      }
    })();
  }, []);

  const sample = useMemo(() => sampleInvoice(Number(settings?.exchangeRate) > 1 ? Number(settings.exchangeRate) : 36.5, Number(settings?.taxRate ?? 16)), [settings]);
  const business = useMemo(() => (design ? resolveInvoiceBusiness(settings, design) : null), [settings, design]);

  useEffect(() => {
    if (design) setInk(design.paper === "a4" ? "color" : "thermal");
  }, [design?.paper]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!design || !business) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        <IconLoader2 className="animate-spin" size={22} />
      </div>
    );
  }

  const dirty = JSON.stringify(design) !== savedJson;
  const set = (patch: Partial<InvoiceDesign>) => setDesign((d) => (d ? { ...d, ...patch } : d));
  const setShow = (key: keyof InvoiceDesign["show"], value: boolean) => setDesign((d) => (d ? { ...d, show: { ...d.show, [key]: value } } : d));
  const setBusiness = (key: keyof InvoiceDesign["business"], value: string) => setDesign((d) => (d ? { ...d, business: { ...d.business, [key]: value } } : d));

  const toggleSection = (id: InvoiceSectionId, visible: boolean) =>
    set({ hidden: visible ? design.hidden.filter((h) => h !== id) : [...design.hidden, id] });
  const moveSection = (index: number, delta: number) => {
    const next = [...design.sections];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    set({ sections: next });
  };

  const uploadLogo = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${API_URL}/uploads`, { method: "POST", headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }, body: form });
      if (!res.ok) throw new Error();
      set({ logoUrl: (await res.json()).url });
    } catch {
      toast.error("No se pudo subir el logo");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` },
        // The old footer and paper settings stay in sync for anything that still reads them
        body: JSON.stringify({
          invoiceDesign: design,
          receiptFooter: design.footerText,
          ...(design.paper !== "a4" && { paperWidth: Number(design.paper) }),
        }),
      });
      if (!res.ok) throw new Error();
      setSavedJson(JSON.stringify(design));
      window.dispatchEvent(new Event("settingsUpdated"));
      toast.success("Diseño de factura guardado. Las próximas ventas ya lo usan.");
    } catch {
      toast.error("No se pudo guardar el diseño");
    } finally {
      setSaving(false);
    }
  };

  const qrMissing = design.qr.type !== "none" && !design.hidden.includes("qr") && !qrValue(design, business);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Factura</h2>
          <p className="text-sm text-muted-foreground">Elige una plantilla y personalízala. Se usa al imprimir y en la factura digital.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => printInvoice({ ...sample, businessName: business.name }, design, business)}>
            <IconPrinter size={16} /> Imprimir prueba
          </Button>
          <Button className="gap-2" onClick={save} disabled={!dirty || saving}>
            {saving ? <IconLoader2 size={16} className="animate-spin" /> : <IconDeviceFloppy size={16} />}
            {dirty ? "Guardar cambios" : "Guardado"}
          </Button>
        </div>
      </div>

      {/* Templates */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {INVOICE_TEMPLATES.map((tpl) => {
          const active = design.templateId === tpl.id;
          const thumb = designFromTemplate(tpl.id, design);
          return (
            <button
              key={tpl.id}
              type="button"
              onClick={() => setDesign(designFromTemplate(tpl.id, design))}
              className={cn(
                "group relative flex flex-col overflow-hidden rounded-xl border bg-card text-left transition-all hover:border-primary/50",
                active && "border-primary ring-2 ring-primary/20",
              )}
            >
              <div className="relative h-40 overflow-hidden border-b bg-[#F1EFEA]">
                <div className="absolute left-1/2 top-3 -translate-x-1/2 bg-white shadow-sm" style={{ width: thumb.paper === "a4" ? 720 : 302, zoom: thumb.paper === "a4" ? 0.2 : 0.42, padding: thumb.paper === "a4" ? 24 : 12 }}>
                  <InvoiceDocument data={{ ...sample, businessName: business.name }} design={thumb} business={business} ink={thumb.paper === "a4" ? "color" : "thermal"} />
                </div>
              </div>
              <div className="space-y-0.5 p-3">
                <p className="flex items-center gap-1.5 text-sm font-semibold">
                  {tpl.name}
                  {active && <IconCheck size={14} className="text-primary" />}
                </p>
                <p className="text-[11px] leading-snug text-muted-foreground">{tpl.description}</p>
              </div>
            </button>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* Controls */}
        <div className="flex flex-col gap-4">
          <Block title="Papel, letra y color" description="El color se ve en la factura digital y en impresoras a color. Las térmicas imprimen en negro.">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label className="text-xs">Tamaño del papel</Label>
                <Segmented value={design.paper} options={PAPER_OPTIONS} onChange={(paper) => set({ paper })} />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label className="text-xs">Letra</Label>
                <Segmented value={design.font} options={FONT_OPTIONS} onChange={(font) => set({ font })} />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label className="text-xs">Color principal</Label>
                <div className="flex items-center gap-1.5">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => set({ accentColor: c })}
                      className={cn("size-6 rounded-full border-2 border-background shadow-sm ring-1 ring-black/10", design.accentColor.toLowerCase() === c.toLowerCase() && "ring-2 ring-foreground")}
                      style={{ background: c }}
                      title={c}
                    />
                  ))}
                  <label className="relative size-6 cursor-pointer overflow-hidden rounded-full border shadow-sm" title="Otro color" style={{ background: "conic-gradient(red, yellow, lime, aqua, blue, magenta, red)" }}>
                    <input type="color" value={design.accentColor} onChange={(e) => set({ accentColor: e.target.value })} className="absolute inset-0 cursor-pointer opacity-0" />
                  </label>
                </div>
              </div>
            </div>
          </Block>

          <Block title="Logo">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => uploadLogo(e.target.files?.[0])} />
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed bg-muted/20 text-muted-foreground hover:border-primary/40 hover:text-primary"
              >
                {uploading ? <IconLoader2 className="animate-spin" size={20} /> : design.logoUrl ? <img src={design.logoUrl} alt="Logo" className="size-full object-contain p-1" /> : <IconPhotoPlus size={22} />}
              </button>
              <div className="space-y-2">
                <Segmented value={design.logoSize} options={LOGO_SIZES} onChange={(logoSize) => set({ logoSize })} />
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => fileRef.current?.click()}>
                    {design.logoUrl ? "Cambiar logo" : "Subir logo"}
                  </Button>
                  {design.logoUrl && (
                    <Button type="button" variant="ghost" size="sm" className="h-8 gap-1 text-xs text-rose-600" onClick={() => set({ logoUrl: null })}>
                      <IconTrash size={13} /> Quitar
                    </Button>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">Png o jpg con fondo blanco o transparente.</p>
              </div>
            </div>
          </Block>

          <Block title="Datos del negocio" description="Si dejas un campo vacío se usa el dato que ya tienes guardado del negocio. El interruptor decide si sale en la factura.">
            <div className="grid gap-3 sm:grid-cols-2">
              {BUSINESS_FIELDS.map((f) => {
                const fallback = f.key === "instagram" || f.key === "slogan" ? "" : (resolveInvoiceBusiness(settings, { ...design, business: { ...design.business, [f.key]: "" } })[f.key] as string);
                return (
                  <div key={f.key} className={cn("space-y-1.5", f.key === "address" && "sm:col-span-2")}>
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">{f.label}</Label>
                      {f.show && <Switch checked={design.show[f.show]} onCheckedChange={(v) => setShow(f.show!, v)} className="scale-75" />}
                    </div>
                    <Input
                      value={design.business[f.key]}
                      onChange={(e) => setBusiness(f.key, e.target.value)}
                      placeholder={fallback || f.placeholder || ""}
                      disabled={!!f.show && !design.show[f.show]}
                      className="h-9 text-sm"
                    />
                  </div>
                );
              })}
            </div>
          </Block>

          <Block title="Secciones" description="Activa, desactiva y ordena lo que aparece en la factura.">
            <div className="divide-y rounded-lg border">
              {design.sections.map((id, index) => {
                const visible = !design.hidden.includes(id);
                return (
                  <div key={id} className="flex items-center gap-2 px-3 py-2">
                    <Switch checked={visible} onCheckedChange={(v) => toggleSection(id, v)} />
                    <span className={cn("flex-1 text-sm", !visible && "text-muted-foreground")}>{SECTION_LABELS[id]}</span>
                    <button type="button" onClick={() => moveSection(index, -1)} disabled={index === 0} className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30" title="Subir">
                      <IconArrowUp size={14} />
                    </button>
                    <button type="button" onClick={() => moveSection(index, 1)} disabled={index === design.sections.length - 1} className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30" title="Bajar">
                      <IconArrowDown size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          </Block>

          <Block title="Detalles">
            <div className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
              {DETAIL_TOGGLES.map((t) => (
                <label key={t.key} className="flex cursor-pointer items-center justify-between gap-3 text-sm">
                  <span>{t.label}</span>
                  <Switch checked={design.show[t.key]} onCheckedChange={(v) => setShow(t.key, v)} />
                </label>
              ))}
            </div>
          </Block>

          <Block title="Código QR" description="Un código que el cliente escanea con su teléfono.">
            <Segmented
              value={design.qr.type}
              options={QR_OPTIONS}
              onChange={(type) => setDesign((d) => (d ? { ...d, qr: { ...d.qr, type }, hidden: type === "none" ? [...new Set([...d.hidden, "qr" as const])] : d.hidden.filter((h) => h !== "qr") } : d))}
            />
            {design.qr.type !== "none" && (
              <div className="grid gap-3 sm:grid-cols-2">
                {(design.qr.type === "custom" || design.qr.type === "instagram" || design.qr.type === "website") && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">{design.qr.type === "custom" ? "Texto o enlace" : design.qr.type === "instagram" ? "Usuario de Instagram" : "Página web"}</Label>
                    <Input
                      value={design.qr.value}
                      onChange={(e) => set({ qr: { ...design.qr, value: e.target.value } })}
                      placeholder={design.qr.type === "instagram" ? business.instagram || "@minegocio" : design.qr.type === "website" ? business.website || "www.minegocio.com" : "https://..."}
                      className="h-9 text-sm"
                    />
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label className="text-xs">Texto debajo del QR</Label>
                  <Input value={design.qr.label} onChange={(e) => set({ qr: { ...design.qr, label: e.target.value } })} placeholder="Opcional" className="h-9 text-sm" />
                </div>
              </div>
            )}
            {qrMissing && (
              <p className="text-xs text-amber-600">
                {design.qr.type === "pagomovil" ? "Activa y completa el pago móvil en los métodos de pago para generar el QR." : "Completa el dato para generar el QR."}
              </p>
            )}
          </Block>

          <Block title="Título y mensaje final">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Título del documento</Label>
                <Input value={design.documentTitle} onChange={(e) => set({ documentTitle: e.target.value })} placeholder="Nota de entrega" className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Mensaje final</Label>
                <Input value={design.footerText} onChange={(e) => set({ footerText: e.target.value })} placeholder="¡Gracias por su compra!" className="h-9 text-sm" />
              </div>
            </div>
          </Block>

          <Button variant="ghost" className="self-start gap-2 text-muted-foreground" onClick={() => setDesign(designFromTemplate(design.templateId, design))}>
            <IconRefresh size={15} /> Restablecer la plantilla
          </Button>
        </div>

        {/* Live preview */}
        <div className="lg:sticky lg:top-[calc(var(--header-height)+1rem)] lg:self-start">
          <div className="rounded-2xl border bg-[#E8E6E0] p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-[#6B665B]">Vista previa con una venta de ejemplo</p>
              <Segmented value={ink} options={[["thermal", "Impresión térmica"], ["color", "Digital"]]} onChange={setInk} />
            </div>
            <div className="flex max-h-[calc(100vh-var(--header-height)-120px)] justify-center overflow-auto rounded-xl py-4">
              <div
                className="h-fit bg-white shadow-[0_20px_40px_-20px_rgba(0,0,0,.35)]"
                style={{
                  width: PREVIEW_WIDTH[design.paper],
                  padding: design.paper === "a4" ? 32 : 14,
                  zoom: design.paper === "a4" ? 0.62 : 1,
                }}
              >
                <InvoiceDocument data={{ ...sample, businessName: business.name }} design={design} business={business} ink={ink} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
