"use client";

import { useEffect, useState } from "react";
import {
  IconArrowDown, IconArrowUp, IconDeviceFloppy, IconDeviceMobile, IconLayoutBottombar, IconLock,
  IconPlus, IconTrash, IconWindowMaximize, IconBrandWhatsapp,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { API_URL } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

/**
 * Same shape as backend/src/modules/storefront/checkout-form.ts (the backend
 * normalizes whatever is saved) and syncro-shop/src/lib/checkout-form.ts.
 */
type FieldType = "text" | "tel" | "email" | "textarea" | "number" | "select" | "checkbox" | "yesno";
type CheckoutField = {
  id: string;
  builtin?: "name" | "phone" | "email" | "address" | "city" | "reference" | "notes";
  type: FieldType;
  label: string;
  placeholder?: string;
  help?: string;
  enabled: boolean;
  required: boolean;
  options?: string[];
};
type CheckoutFormConfig = {
  version: 1;
  mode: "embedded" | "modal";
  title: string;
  subtitle: string;
  buttonLabel: string;
  buttonColor: string | null;
  stickyMobileButton: boolean;
  submitLabel: string;
  showQuantity: boolean;
  showSummary: boolean;
  successMessage: string;
  whatsappAfterOrder: boolean;
  buttonAnimation: ButtonAnimation;
  buttonStyle: "solid" | "gradient";
  buttonSize: "md" | "lg";
  buttonIcon: "zap" | "cart" | "bag" | "none";
  buttonSubtext: string;
  urgencyText: string;
  fields: CheckoutField[];
};
type ButtonAnimation = "none" | "pulse" | "shake" | "bounce" | "shine" | "glow" | "wiggle";

const ANIMATIONS: [ButtonAnimation, string][] = [
  ["none", "Sin animación"], ["pulse", "Pulso"], ["shake", "Sacudida"], ["bounce", "Rebote"],
  ["shine", "Brillo"], ["glow", "Resplandor"], ["wiggle", "Vaivén"],
];
const BUTTON_ICONS: [CheckoutFormConfig["buttonIcon"], string][] = [["zap", "⚡ Rayo"], ["cart", "🛒 Carrito"], ["bag", "🛍️ Bolsa"], ["none", "Sin ícono"]];

/** Same keyframes as syncro-shop/src/app/globals.css, so the preview matches the store. */
const ANIMATION_CSS = `
@keyframes ss-pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.045); } }
@keyframes ss-shake { 0%, 84%, 100% { transform: translateX(0); } 86%, 94% { transform: translateX(-5px); } 90%, 98% { transform: translateX(5px); } }
@keyframes ss-bounce { 0%, 70%, 100% { transform: translateY(0); } 80% { transform: translateY(-7px); } 90% { transform: translateY(0); } 95% { transform: translateY(-3px); } }
@keyframes ss-wiggle { 0%, 80%, 100% { transform: rotate(0); } 85% { transform: rotate(-3deg); } 90% { transform: rotate(3deg); } 95% { transform: rotate(-2deg); } }
@keyframes ss-glow { 0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--ss-btn, #e4572e) 55%, transparent); } 50% { box-shadow: 0 0 0 10px color-mix(in srgb, var(--ss-btn, #e4572e) 0%, transparent); } }
@keyframes ss-shine { 0% { left: -60%; } 55%, 100% { left: 130%; } }
.ss-anim-pulse { animation: ss-pulse 1.6s ease-in-out infinite; }
.ss-anim-shake { animation: ss-shake 3.2s ease-in-out infinite; }
.ss-anim-bounce { animation: ss-bounce 2.4s ease-in-out infinite; }
.ss-anim-wiggle { animation: ss-wiggle 2.8s ease-in-out infinite; }
.ss-anim-glow { animation: ss-glow 1.8s ease-out infinite; }
.ss-anim-shine { position: relative; overflow: hidden; }
.ss-anim-shine::after { content: ""; position: absolute; top: 0; left: -60%; width: 45%; height: 100%; background: linear-gradient(110deg, transparent, rgba(255,255,255,.55), transparent); transform: skewX(-20deg); animation: ss-shine 2.6s ease-in-out infinite; }
`;

function buttonLook(form: Pick<CheckoutFormConfig, "buttonColor" | "buttonStyle" | "buttonAnimation">) {
  const color = form.buttonColor || "#E4572E";
  return {
    className: form.buttonAnimation === "none" ? "" : `ss-anim-${form.buttonAnimation}`,
    style: {
      background: form.buttonStyle === "gradient" ? `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 55%, #f59e0b))` : color,
      ["--ss-btn" as string]: color,
    } as React.CSSProperties,
  };
}
const ICON_EMOJI = { zap: "⚡", cart: "🛒", bag: "🛍️", none: "" } as const;
type Delivery = { pickupEnabled: boolean; deliveryEnabled: boolean; deliveryCost: number };

const LOCKED = new Set(["name", "phone"]);
const ADDRESS = new Set(["address", "city"]);
const CUSTOM_TYPES: { type: FieldType; label: string }[] = [
  { type: "text", label: "Texto corto" },
  { type: "textarea", label: "Texto largo" },
  { type: "number", label: "Número" },
  { type: "select", label: "Lista de opciones" },
  { type: "yesno", label: "Sí / no" },
  { type: "checkbox", label: "Casilla (aceptar)" },
];
const COLORS = ["#E4572E", "#111827", "#2563EB", "#059669", "#7C3AED", "#DB2777"];
const MAX_CUSTOM = 15;

const fieldClass = "h-9 text-xs bg-muted/20 border-transparent focus:border-primary/20 focus:bg-background";

export function CheckoutFormBuilder() {
  const [form, setForm] = useState<CheckoutFormConfig | null>(null);
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_URL}/storefront/admin/checkout-form`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        });
        if (!res.ok) throw new Error();
        const data = await res.json();
        setForm(data.form);
        setDelivery(data.delivery);
      } catch {
        toast.error("No se pudo cargar el formulario de compra");
      }
    })();
  }, []);

  if (!form) return <div className="h-96 rounded-2xl bg-muted/40 animate-pulse" />;

  const patch = (changes: Partial<CheckoutFormConfig>) => {
    setForm({ ...form, ...changes });
    setDirty(true);
  };
  const patchField = (id: string, changes: Partial<CheckoutField>) =>
    patch({ fields: form.fields.map((f) => (f.id === id ? { ...f, ...changes } : f)) });
  const moveField = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= form.fields.length) return;
    const fields = [...form.fields];
    [fields[index], fields[target]] = [fields[target], fields[index]];
    patch({ fields });
  };
  const customCount = form.fields.filter((f) => !f.builtin).length;
  const addCustom = (type: FieldType) => {
    if (customCount >= MAX_CUSTOM) return toast.error(`Máximo ${MAX_CUSTOM} campos personalizados`);
    const label = type === "checkbox" ? "Acepto las condiciones de entrega" : type === "yesno" ? "¿Necesitas factura?" : "Nuevo campo";
    patch({
      fields: [...form.fields, {
        id: `cf_${Math.random().toString(36).slice(2, 10)}`, type, label, enabled: true, required: false,
        options: type === "select" ? ["Opción 1", "Opción 2"] : undefined,
      }],
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/storefront/admin/checkout-form`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` },
        body: JSON.stringify({ form }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message);
      setForm(data.form);
      setDirty(false);
      toast.success("Formulario de compra guardado. Ya se ve así en tu tienda.");
    } catch (e: any) {
      toast.error(e?.message || "No se pudo guardar el formulario");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
      <div className="space-y-5">
        {/* Presentation */}
        <section className="rounded-2xl border bg-card p-5 space-y-4">
          <h3 className="text-xs font-bold text-primary">Presentación</h3>
          <div className="grid grid-cols-2 gap-3">
            {([
              ["embedded", "Integrado en la página", "El formulario aparece directamente en la ficha del producto.", IconLayoutBottombar],
              ["modal", "Ventana con botón", "Un botón de compra abre el formulario en una ventana.", IconWindowMaximize],
            ] as const).map(([mode, label, hint, Icon]) => (
              <button key={mode} type="button" onClick={() => patch({ mode })} className={cn("rounded-xl border p-3 text-left transition-all", form.mode === mode ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "hover:border-primary/40")}>
                <Icon size={18} className={form.mode === mode ? "text-primary" : "text-muted-foreground"} />
                <p className="mt-2 text-xs font-bold">{label}</p>
                <p className="text-[10px] text-muted-foreground leading-relaxed">{hint}</p>
              </button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Texto del botón de compra</Label>
              <Input value={form.buttonLabel} onChange={(e) => patch({ buttonLabel: e.target.value })} maxLength={40} className={fieldClass} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Color del botón</Label>
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={() => patch({ buttonColor: null })} className={cn("h-7 px-2 rounded-md border text-[10px] font-semibold", !form.buttonColor && "border-primary text-primary")}>Tienda</button>
                {COLORS.map((c) => (
                  <button key={c} type="button" onClick={() => patch({ buttonColor: c })} title={c} className={cn("size-7 rounded-full border-2", form.buttonColor === c ? "border-foreground" : "border-transparent")} style={{ backgroundColor: c }} />
                ))}
                <input type="color" value={form.buttonColor ?? "#E4572E"} onChange={(e) => patch({ buttonColor: e.target.value })} className="size-7 rounded-full border cursor-pointer" title="Otro color" />
              </div>
            </div>
          </div>
          <ToggleRow icon={<IconDeviceMobile size={15} />} label="Botón fijo abajo en celulares" hint="Siempre visible mientras el cliente baja por la ficha." checked={form.stickyMobileButton} onChange={(v) => patch({ stickyMobileButton: v })} />
        </section>

        {/* Eye-catching button */}
        <section className="rounded-2xl border bg-card p-5 space-y-4">
          <style>{ANIMATION_CSS}</style>
          <h3 className="text-xs font-bold text-primary">Botón llamativo</h3>
          <div className="space-y-1.5">
            <Label className="text-xs">Animación</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {ANIMATIONS.map(([value, label]) => {
                const look = buttonLook({ ...form, buttonAnimation: value });
                return (
                  <button key={value} type="button" onClick={() => patch({ buttonAnimation: value })} className={cn("rounded-xl border p-2.5 space-y-2 text-center transition-all", form.buttonAnimation === value ? "border-primary ring-2 ring-primary/20 bg-primary/5" : "hover:border-primary/40")}>
                    <span className={cn("mx-auto block w-full rounded-full py-1.5 text-[10px] font-bold text-white", look.className)} style={look.style}>Comprar</span>
                    <span className="block text-[11px] font-semibold">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Estilo</Label>
              <div className="flex gap-1.5">
                {([["solid", "Sólido"], ["gradient", "Degradado"]] as const).map(([value, label]) => (
                  <button key={value} type="button" onClick={() => patch({ buttonStyle: value })} className={cn("h-8 flex-1 rounded-md border text-xs font-semibold", form.buttonStyle === value ? "border-primary bg-primary/5 text-primary" : "text-muted-foreground")}>{label}</button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Tamaño</Label>
              <div className="flex gap-1.5">
                {([["md", "Normal"], ["lg", "Grande"]] as const).map(([value, label]) => (
                  <button key={value} type="button" onClick={() => patch({ buttonSize: value })} className={cn("h-8 flex-1 rounded-md border text-xs font-semibold", form.buttonSize === value ? "border-primary bg-primary/5 text-primary" : "text-muted-foreground")}>{label}</button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Ícono</Label>
              <select value={form.buttonIcon} onChange={(e) => patch({ buttonIcon: e.target.value as CheckoutFormConfig["buttonIcon"] })} className="h-8 w-full rounded-md border bg-background px-2 text-xs">
                {BUTTON_ICONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Mensaje de urgencia (arriba del botón)</Label>
              <Input value={form.urgencyText} onChange={(e) => patch({ urgencyText: e.target.value })} maxLength={80} placeholder="Ej: ¡Últimas unidades a este precio!" className={fieldClass} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Texto debajo del botón</Label>
              <Input value={form.buttonSubtext} onChange={(e) => patch({ buttonSubtext: e.target.value })} maxLength={60} placeholder="Ej: pagas al recibir · envío hoy" className={fieldClass} />
            </div>
          </div>
        </section>

        {/* Texts */}
        <section className="rounded-2xl border bg-card p-5 space-y-4">
          <h3 className="text-xs font-bold text-primary">Textos y opciones</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Título</Label>
              <Input value={form.title} onChange={(e) => patch({ title: e.target.value })} maxLength={80} className={fieldClass} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Botón para enviar</Label>
              <Input value={form.submitLabel} onChange={(e) => patch({ submitLabel: e.target.value })} maxLength={40} className={fieldClass} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Subtítulo</Label>
            <Input value={form.subtitle} onChange={(e) => patch({ subtitle: e.target.value })} maxLength={200} className={fieldClass} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Mensaje al recibir el pedido</Label>
            <textarea value={form.successMessage} onChange={(e) => patch({ successMessage: e.target.value })} maxLength={300} rows={2} className="w-full rounded-md px-3 py-2 text-xs bg-muted/20 border border-transparent focus:border-primary/20 focus:bg-background outline-none" />
          </div>
          <ToggleRow label="Mostrar resumen del pedido" hint="Productos, delivery y total antes de confirmar." checked={form.showSummary} onChange={(v) => patch({ showSummary: v })} />
          <ToggleRow label="Permitir cambiar la cantidad en el formulario" hint="Solo en «Comprar ahora»." checked={form.showQuantity} onChange={(v) => patch({ showQuantity: v })} />
          <ToggleRow icon={<IconBrandWhatsapp size={15} className="text-emerald-600" />} label="Botón para avisarte por WhatsApp al terminar" hint="Usa el WhatsApp configurado en tu tienda." checked={form.whatsappAfterOrder} onChange={(v) => patch({ whatsappAfterOrder: v })} />
        </section>

        {/* Fields */}
        <section className="rounded-2xl border bg-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-primary">Campos del formulario</h3>
            <span className="text-[10px] text-muted-foreground">{customCount} / {MAX_CUSTOM} personalizados</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Nombre y teléfono son obligatorios siempre. Dirección y ciudad se piden solo si el cliente elige delivery.
          </p>

          {form.fields.map((field, index) => {
            const locked = field.builtin && LOCKED.has(field.builtin);
            return (
              <div key={field.id} className={cn("rounded-xl border p-3 space-y-2", !field.enabled && "opacity-60")}>
                <div className="flex items-center gap-2">
                  <Switch checked={field.enabled} disabled={Boolean(locked)} onCheckedChange={(v) => patchField(field.id, { enabled: v, required: v ? field.required : false })} className="data-[state=checked]:bg-primary scale-90" />
                  <Input value={field.label} onChange={(e) => patchField(field.id, { label: e.target.value })} maxLength={80} className={cn(fieldClass, "font-semibold flex-1")} />
                  <span className="hidden sm:inline text-[10px] text-muted-foreground w-24 truncate">
                    {field.builtin ? "Campo base" : CUSTOM_TYPES.find((t) => t.type === field.type)?.label}
                  </span>
                  <Button type="button" variant="ghost" size="icon" className="size-7" disabled={index === 0} onClick={() => moveField(index, -1)}><IconArrowUp size={13} /></Button>
                  <Button type="button" variant="ghost" size="icon" className="size-7" disabled={index === form.fields.length - 1} onClick={() => moveField(index, 1)}><IconArrowDown size={13} /></Button>
                  {field.builtin ? (
                    <span className="size-7 flex items-center justify-center text-muted-foreground/50" title={locked ? "Siempre activo" : "Campo base: se puede desactivar pero no borrar"}>
                      {locked ? <IconLock size={13} /> : null}
                    </span>
                  ) : (
                    <Button type="button" variant="ghost" size="icon" className="size-7 text-rose-500" onClick={() => patch({ fields: form.fields.filter((f) => f.id !== field.id) })}><IconTrash size={13} /></Button>
                  )}
                </div>
                {field.enabled && (
                  <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] items-center pl-11">
                    {field.type !== "checkbox" && field.type !== "yesno" && field.type !== "select" ? (
                      <Input value={field.placeholder || ""} onChange={(e) => patchField(field.id, { placeholder: e.target.value })} placeholder="Texto de ejemplo" className={fieldClass} />
                    ) : <span />}
                    <Input value={field.help || ""} onChange={(e) => patchField(field.id, { help: e.target.value })} placeholder="Ayuda debajo del campo (opcional)" className={fieldClass} />
                    <label className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground whitespace-nowrap">
                      <Switch checked={field.required} disabled={Boolean(locked)} onCheckedChange={(v) => patchField(field.id, { required: v })} className="scale-75" />
                      {field.builtin && ADDRESS.has(field.builtin) ? "Obligatorio (delivery)" : "Obligatorio"}
                    </label>
                    {field.type === "select" && (
                      <textarea
                        value={(field.options || []).join("\n")}
                        onChange={(e) => patchField(field.id, { options: e.target.value.split("\n").slice(0, 20) })}
                        placeholder="Una opción por línea"
                        rows={3}
                        className="sm:col-span-3 w-full rounded-md px-3 py-2 text-xs bg-muted/20 border border-transparent focus:border-primary/20 focus:bg-background outline-none"
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}

          <div className="flex flex-wrap gap-1.5 pt-1">
            {CUSTOM_TYPES.map(({ type, label }) => (
              <Button key={type} type="button" variant="outline" size="sm" className="h-7 gap-1 text-[11px] border-dashed" onClick={() => addCustom(type)}>
                <IconPlus size={12} /> {label}
              </Button>
            ))}
          </div>
        </section>

        <div className="sticky bottom-4 z-10 flex justify-end">
          <Button onClick={save} disabled={saving || !dirty} className="gap-2 shadow-lg shadow-primary/20">
            <IconDeviceFloppy size={16} /> {saving ? "Guardando..." : dirty ? "Guardar formulario" : "Guardado"}
          </Button>
        </div>
      </div>

      {/* Live preview */}
      <div className="xl:sticky xl:top-4 xl:self-start space-y-2">
        <p className="text-xs font-semibold text-muted-foreground">Vista previa</p>
        <FormPreview form={form} delivery={delivery} />
      </div>
    </div>
  );
}

function ToggleRow({ label, hint, checked, onChange, icon }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-xs font-semibold flex items-center gap-1.5">{icon}{label}</p>
        {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} className="data-[state=checked]:bg-primary shrink-0" />
    </div>
  );
}

/** Static mock of how the form looks in Syncro Shop. */
function FormPreview({ form, delivery }: { form: CheckoutFormConfig; delivery: Delivery | null }) {
  const color = form.buttonColor || "#E4572E";
  const look = buttonLook(form);
  const fields = form.fields.filter((f) => f.enabled);
  const body = (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-bold text-gray-900">{form.title}</p>
        {form.subtitle && <p className="text-[11px] text-gray-500">{form.subtitle}</p>}
      </div>
      {form.showSummary && (
        <div className="rounded-xl bg-gray-50 p-2.5 text-[11px] space-y-1">
          <div className="flex justify-between text-gray-600"><span>1 × Producto de ejemplo</span><span>$10,00</span></div>
          <div className="flex justify-between font-bold text-gray-900"><span>Total a pagar al recibir</span><span>$10,00</span></div>
        </div>
      )}
      {delivery?.pickupEnabled && delivery?.deliveryEnabled && (
        <div className="grid grid-cols-2 gap-1.5 text-[10px]">
          <div className="rounded-lg border-2 p-1.5 font-semibold" style={{ borderColor: color }}>Retiro en tienda</div>
          <div className="rounded-lg border p-1.5 text-gray-500">Delivery</div>
        </div>
      )}
      {fields.map((f) => (
        <div key={f.id} className="space-y-1">
          {f.type === "checkbox" ? (
            <p className="flex items-center gap-1.5 text-[11px] text-gray-800"><span className="size-3 rounded border border-gray-400" />{f.label}{f.required && " *"}</p>
          ) : (
            <>
              <p className="text-[11px] font-semibold text-gray-800">{f.label}{f.required ? <span style={{ color }}> *</span> : <span className="font-normal text-gray-400"> (Opcional)</span>}</p>
              <div className={cn("rounded-lg border border-gray-300 px-2 text-[10px] text-gray-400 flex items-center", f.type === "textarea" ? "h-10" : "h-7")}>
                {f.type === "select" ? "Selecciona una opción" : f.type === "yesno" ? "Sí  /  no" : f.placeholder || ""}
              </div>
              {f.help && <p className="text-[9px] text-gray-500">{f.help}</p>}
            </>
          )}
        </div>
      ))}
      {form.urgencyText && <p className="rounded-lg bg-amber-50 px-2 py-1.5 text-center text-[10px] font-semibold text-amber-800">● {form.urgencyText}</p>}
      <div className={cn("rounded-full text-center font-bold text-white", form.buttonSize === "lg" ? "py-2.5 text-sm" : "py-2 text-xs", look.className)} style={look.style}>
        {ICON_EMOJI[form.buttonIcon]} {form.submitLabel} · $10,00
      </div>
      {form.buttonSubtext && <p className="text-center text-[9px] text-gray-500">{form.buttonSubtext}</p>}
    </div>
  );

  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      {form.mode === "modal" ? (
        <div className="space-y-3">
          {form.urgencyText && <p className="rounded-lg bg-amber-50 px-2 py-1.5 text-center text-[10px] font-semibold text-amber-800">● {form.urgencyText}</p>}
          <div className={cn("rounded-full text-center font-bold text-white", form.buttonSize === "lg" ? "py-2.5 text-sm" : "py-2 text-xs", look.className)} style={look.style}>{ICON_EMOJI[form.buttonIcon]} {form.buttonLabel}</div>
          <p className="text-center text-[10px] text-gray-400">Al tocar el botón se abre:</p>
          <div className="rounded-2xl border border-gray-200 p-3 shadow-lg">{body}</div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="h-2 w-2/3 rounded bg-gray-200" />
          <div className="h-2 w-1/3 rounded bg-gray-200" />
          <div className="border-t border-gray-200 pt-3">{body}</div>
        </div>
      )}
    </div>
  );
}
