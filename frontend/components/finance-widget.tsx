"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { IconArrowDownLeft, IconArrowUpRight, IconArrowsExchange, IconCamera, IconCheck, IconFileTypePdf, IconGripVertical, IconLoader2, IconLock, IconX } from "@tabler/icons-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { API_URL } from "@/lib/constants";
import { useCurrency } from "@/context/CurrencyContext";
import { type Currency, CURRENCY_META, formatMoney, toUsd } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateField, toDay } from "@/components/forms/date-field";
import { ChoiceSelect } from "@/components/forms/choice-select";
import { ConfirmDialog } from "@/components/gym/confirm-dialog";
import { ReceiptPreview, ReceiptThumb } from "@/components/receipt-preview";

export const MOVEMENT_LABELS: Record<string, string> = {
  ALQUILER: "Alquiler", SERVICIOS: "Servicios (luz, agua, internet)", NOMINA: "Nómina y personal", MANTENIMIENTO: "Mantenimiento", LIMPIEZA: "Limpieza", INSUMOS: "Insumos",
  TRANSPORTE: "Transporte", PUBLICIDAD: "Publicidad", IMPUESTOS: "Impuestos", RETIRO_DUENO: "Retiro del dueño", OTRO_EGRESO: "Otro egreso",
  APORTE_DUENO: "Aporte del dueño", ALQUILER_ESPACIO: "Alquiler de un espacio", PATROCINIO: "Patrocinio", REINTEGRO: "Reintegro", OTRO_INGRESO: "Otro ingreso",
};
export const METHOD_LABELS: Record<string, string> = {
  CASH_DRAWER: "Efectivo de la gaveta", CASH_OTHER: "Efectivo fuera de caja", PAGO_MOVIL: "Pago móvil", TRANSFER: "Transferencia", CARD: "Punto de venta", ZELLE: "Zelle", BINANCE: "Binance", OTHER: "Otro",
};
const METHOD_HINTS: Record<string, string> = { CASH_DRAWER: "Sale o entra de tu caja abierta", CASH_OTHER: "No toca la caja" };

type Meta = { outCategories: string[]; inCategories: string[]; methods: string[]; rules: { staffLimitUsd: number; receiptOverUsd: number; undoMinutes: number; protectedCategories: string[] }; isManager: boolean; hasSupervisorPin: boolean };
export type Movement = {
  id: string; type: "IN" | "OUT"; category: string; categoryLabel?: string | null; amount: number; currency: Currency; amountCurrency: number; method: string; methodLabel?: string | null; description: string | null; receiptUrl: string | null;
  occurredAt: string; createdAt: string; userId: string; userName: string | null; status: "ACTIVE" | "VOIDED"; voidReason: string | null; reviewedAt: string | null; authorizedBy: string | null; branch?: { name: string };
};
/** What a movement shows as its category and method (the custom ones as written). */
export const categoryOf = (m: Pick<Movement, "category" | "categoryLabel">) => m.categoryLabel || MOVEMENT_LABELS[m.category] || m.category;
export const methodOf = (m: Pick<Movement, "method" | "methodLabel">) => m.methodLabel || METHOD_LABELS[m.method] || m.method;

const api = async <T,>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> => {
  const { json, ...rest } = init;
  const res = await fetch(`${API_URL}${path}`, { ...rest, headers: { Authorization: `Bearer ${localStorage.getItem("token")}`, ...(json !== undefined && { "Content-Type": "application/json" }) }, ...(json !== undefined && { body: JSON.stringify(json) }) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(Array.isArray(data.message) ? data.message[0] : data.message || "No se pudo completar"), { code: data.code });
  return data as T;
};

/** Both words carry capitals on purpose: they read as two names on the tab. */
const TAB_LABEL = ["Ingreso", "Egreso"].join(" · ");
const SHORTCUT_TITLE = ["Registrar un ingreso o un egreso", "atajo de teclado", "G"].join(" · ");
const userId = () => { try { return JSON.parse(localStorage.getItem("user") || "{}")?.id as string | undefined; } catch { return undefined; } };

type Dock = { side: "left" | "right"; top: number };
const DOCK_KEY = (scope: string) => `syncro-finance-tab:${scope}`;
const readDock = (scope: string, fallback: Dock): Dock => {
  try {
    const d = JSON.parse(localStorage.getItem(DOCK_KEY(scope)) || "null");
    if (d && (d.side === "left" || d.side === "right") && Number.isFinite(d.top)) return { side: d.side, top: Math.min(88, Math.max(12, d.top)) };
  } catch {}
  return fallback;
};

/**
 * A tab on the edge of the screen to register money that isn't a sale (rent, services,
 * cleaning, an owner's contribution…), on every screen, POS included. Drag it up or down and to
 * the other edge; it remembers where it was left. Opens with G. The server enforces the rules too
 * (staff limit, PIN for protected categories, receipt photo, undo window).
 */
export function FinanceWidget({ placement = "right" }: { placement?: "right" | "left" }) {
  const pathname = usePathname();
  const { currencies, cashRates } = useCurrency();
  const scope = pathname?.startsWith("/pos") ? "pos" : "dashboard";
  const [dock, setDock] = useState<Dock>({ side: placement, top: 62 });
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const dragStart = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const [open, setOpen] = useState(false);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [type, setType] = useState<"OUT" | "IN">("OUT");
  const [category, setCategory] = useState("");
  const [categoryLabel, setCategoryLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<Currency>("USD");
  const [method, setMethod] = useState("CASH_OTHER");
  const [methodLabel, setMethodLabel] = useState("");
  const [description, setDescription] = useState("");
  const [day, setDay] = useState(toDay(new Date()));
  const [receipt, setReceipt] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pin, setPin] = useState("");
  const [saving, setSaving] = useState(false);
  const [today, setToday] = useState<Movement[]>([]);
  const [voiding, setVoiding] = useState<Movement | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const source = pathname?.includes("/gimnasio") ? "GYM" : pathname?.startsWith("/pos") ? "POS" : "DASHBOARD";
  const role = (() => { try { return JSON.parse(localStorage.getItem("user") || "{}")?.role as string; } catch { return ""; } })();

  useEffect(() => { setDock(readDock(scope, { side: placement, top: 62 })); }, [scope, placement]);

  const branchId = () => localStorage.getItem("currentBranchId") || "";
  const loadToday = useCallback(() => {
    api<Movement[]>(`/movements?${new URLSearchParams({ branchId: branchId(), day: toDay(new Date()) })}`).then(setToday).catch(() => {});
  }, []);

  useEffect(() => {
    if (!open) return;
    if (!meta) api<Meta>("/movements/meta").then(setMeta).catch(() => {});
    loadToday();
    setTimeout(() => panelRef.current?.querySelector<HTMLElement>("[data-type-tab][aria-selected=true]")?.focus(), 80);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // G opens it from anywhere (outside fields and windows); Esc closes it
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return;
      const el = document.activeElement as HTMLElement | null;
      const typing = !!el && (el.matches("input, textarea, select") || el.isContentEditable);
      if (open && e.key === "Escape" && !document.querySelector("[data-radix-popper-content-wrapper]")) { e.preventDefault(); setOpen(false); return; }
      if (typing || open) return;
      if ((e.key === "g" || e.key === "G") && !document.querySelector("[role=dialog][data-state=open]:not([data-finance-widget])")) { e.preventDefault(); setOpen(true); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => { if (!currencies.includes(currency)) setCurrency("USD"); }, [currencies]); // eslint-disable-line react-hooks/exhaustive-deps

  // Other screens (Contabilidad) open it with an event
  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener("finance-widget:open", show);
    return () => window.removeEventListener("finance-widget:open", show);
  }, []);

  if (role === "syncropos") return null;

  // ── Dragging the tab: anywhere up and down, it snaps to the nearest edge on release ──
  const onPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragStart.current = { x: e.clientX, y: e.clientY, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const s = dragStart.current;
    if (!s) return;
    if (!s.moved && Math.abs(e.clientX - s.x) + Math.abs(e.clientY - s.y) < 6) return;
    s.moved = true;
    setDrag({ x: e.clientX, y: e.clientY });
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const s = dragStart.current;
    dragStart.current = null;
    if (!s?.moved) { setOpen((o) => !o); setDrag(null); return; }
    const next: Dock = { side: e.clientX < window.innerWidth / 2 ? "left" : "right", top: Math.min(88, Math.max(12, (e.clientY / window.innerHeight) * 100)) };
    setDock(next);
    setDrag(null);
    try { localStorage.setItem(DOCK_KEY(scope), JSON.stringify(next)); } catch {}
  };

  const categories = meta ? (type === "OUT" ? meta.outCategories : meta.inCategories) : [];
  const parsed = Number(amount.replace(",", "."));
  const amountOk = /^\d+([.,]\d{1,2})?$/.test(amount.trim()) && parsed > 0;
  const usd = amountOk && cashRates[currency] > 0 ? toUsd(parsed, currency, cashRates) : 0;
  const isProtected = !!meta?.rules.protectedCategories.includes(category);
  const needsPin = !!meta && !meta.isManager && (usd > meta.rules.staffLimitUsd || isProtected);
  const needsReceipt = !!meta && type === "OUT" && usd > meta.rules.receiptOverUsd;
  const categoryOk = category === "CUSTOM" ? categoryLabel.trim().length >= 2 : !!category;
  const methodOk = method === "CUSTOM" ? methodLabel.trim().length >= 2 : !!method;
  const ready = categoryOk && amountOk && methodOk && (!needsReceipt || !!receipt) && (!needsPin || /^\d{4,8}$/.test(pin));
  const label = (c: string) => (source === "GYM" && c === "MANTENIMIENTO" ? "Mantenimiento de equipos" : MOVEMENT_LABELS[c] ?? c);

  const reset = () => { setCategory(""); setCategoryLabel(""); setAmount(""); setDescription(""); setReceipt(null); setPin(""); setDay(toDay(new Date())); };
  const switchType = (t: "OUT" | "IN") => { if (t === type) return; setType(t); setCategory(""); setCategoryLabel(""); };

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${API_URL}/movements/receipt`, { method: "POST", headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }, body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "No se pudo subir la foto");
      setReceipt(data.url);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!ready) {
      toast.error(!categoryOk ? "Elige una categoría" : !amountOk ? "Escribe un monto válido" : !methodOk ? (type === "OUT" ? "Elige con qué se pagó" : "Elige cómo entró") : needsReceipt && !receipt ? `Sube la foto de la factura: es obligatoria en egresos de más de $${meta!.rules.receiptOverUsd}` : "Falta el PIN del supervisor");
      return;
    }
    setSaving(true);
    try {
      const isToday = day === toDay(new Date());
      await api("/movements", {
        method: "POST",
        json: {
          type, category, amount: parsed, currency, method, description, receiptUrl: receipt, branchId: branchId(), source, supervisorPin: pin || undefined,
          ...(category === "CUSTOM" && { categoryLabel }), ...(method === "CUSTOM" && { methodLabel }),
          ...(!isToday && { occurredAt: new Date(`${day}T12:00:00`).toISOString() }),
        },
      });
      toast.success(`${type === "OUT" ? "Egreso" : "Ingreso"} registrado: ${category === "CUSTOM" ? categoryLabel : label(category)} · ${formatMoney(parsed, currency)}`, { description: method === "CASH_DRAWER" ? "Quedó en tu caja: el cierre lo tiene en cuenta." : undefined });
      reset();
      loadToday();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const undo = async (m: Movement) => {
    try {
      await api(`/movements/${m.id}/undo`, { method: "POST" });
      toast.success("Movimiento deshecho");
      loadToday();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const canUndo = (m: Movement) => m.status === "ACTIVE" && m.userId === userId() && !m.reviewedAt && !!meta && Date.now() - new Date(m.createdAt).getTime() < meta.rules.undoMinutes * 60000;
  const time = (d: string) => new Date(d).toLocaleTimeString("es-VE", { hour: "numeric", minute: "2-digit" });
  const isPdf = (u: string) => /\.pdf($|\?)/i.test(u);

  // The panel opens next to the tab, on its side, as close to its height as it fits
  const side = dock.side;
  const tabStyle: React.CSSProperties = drag
    ? { top: drag.y, left: drag.x, transform: "translate(-50%, -50%)" }
    : { top: `${dock.top}%`, [side]: 0, transform: "translateY(-50%)" };

  return (
    <>
      {/* The tab on the edge */}
      <button
        type="button"
        title={SHORTCUT_TITLE}
        aria-label="Registrar un ingreso o un egreso"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen((o) => !o); } }}
        style={tabStyle}
        className={cn(
          "group fixed z-40 flex touch-none select-none flex-col items-center gap-2 py-3 text-primary-foreground shadow-[0_10px_30px_-10px_color-mix(in_srgb,var(--primary)_70%,transparent)] outline-none transition-[padding,opacity,box-shadow] duration-200 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
          "bg-gradient-to-b from-primary to-[color-mix(in_srgb,var(--primary)_78%,#7a2e00)]",
          drag ? "cursor-grabbing rounded-2xl px-3 opacity-90" : side === "right" ? "cursor-grab rounded-l-2xl pl-2.5 pr-2 hover:pl-3.5" : "cursor-grab rounded-r-2xl pl-2 pr-2.5 hover:pr-3.5",
          open && !drag && "pointer-events-none opacity-0",
        )}
      >
        <IconGripVertical size={14} className="opacity-60" />
        <span className="flex size-7 items-center justify-center rounded-full bg-white/20"><IconArrowsExchange size={16} /></span>
        <span className="rotate-180 text-[11px] font-semibold [writing-mode:vertical-rl]">{TAB_LABEL}</span>
        <kbd className="rounded bg-white/20 px-1.5 py-0.5 font-mono text-[10px]">G</kbd>
      </button>

      {/* The panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-label="Registrar ingreso o egreso"
        data-state={open ? "open" : "closed"}
        data-finance-widget=""
        style={{ top: `clamp(12px, calc(${dock.top}vh - 280px), calc(100vh - min(88vh, 820px) - 12px))`, [side]: 16 }}
        className={cn(
          "fixed z-50 flex max-h-[min(88vh,820px)] w-[calc(100vw-2rem)] max-w-[440px] flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl transition-all duration-300 ease-out motion-reduce:transition-none",
          side === "left" ? "origin-left" : "origin-right",
          open ? "translate-x-0 scale-100 opacity-100" : cn("pointer-events-none scale-95 opacity-0", side === "left" ? "-translate-x-6" : "translate-x-6"),
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <div>
            <p className="text-sm font-semibold">Registrar movimiento</p>
            <p className="text-xs text-muted-foreground">Dinero que no viene de una venta.</p>
          </div>
          <button type="button" onClick={() => setOpen(false)} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Cerrar"><IconX size={16} /></button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {/* Out / In: a sliding switch (arrows switch it too) */}
          <div
            role="tablist"
            className="relative grid grid-cols-2 rounded-2xl bg-muted p-1"
            onKeyDown={(e) => { if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); const t = type === "OUT" ? "IN" : "OUT"; switchType(t); setTimeout(() => panelRef.current?.querySelector<HTMLElement>(`[data-type-tab="${t}"]`)?.focus(), 0); } }}
          >
            <span
              aria-hidden
              className={cn(
                "absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-xl shadow-sm transition-all duration-300 ease-out motion-reduce:transition-none",
                type === "OUT" ? "translate-x-0 bg-rose-600" : "translate-x-full bg-emerald-600",
              )}
            />
            {(["OUT", "IN"] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                data-type-tab={t}
                aria-selected={type === t}
                tabIndex={type === t ? 0 : -1}
                onClick={() => switchType(t)}
                className={cn("relative z-10 flex flex-col items-center justify-center rounded-xl py-2 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-white/70", type === t ? "text-white" : "text-muted-foreground hover:text-foreground")}
              >
                <span className="flex items-center gap-1.5">{t === "OUT" ? <IconArrowUpRight size={16} /> : <IconArrowDownLeft size={16} />}{t === "OUT" ? "Egreso" : "Ingreso"}</span>
                <span className={cn("text-[11px] font-normal", type === t ? "text-white/80" : "text-muted-foreground")}>{t === "OUT" ? "Sale dinero" : "Entra dinero"}</span>
              </button>
            ))}
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-medium">Categoría</p>
            {!meta ? <div className="h-10 animate-pulse rounded-md bg-muted" /> : (
              <ChoiceSelect
                value={category}
                customLabel={categoryLabel}
                onChange={(v, l) => { setCategory(v); setCategoryLabel(l ?? ""); }}
                options={categories.map((c) => ({ value: c, label: label(c), locked: !meta.isManager && meta.rules.protectedCategories.includes(c) }))}
                placeholder="Elegir categoría"
                customPlaceholder={type === "OUT" ? "Ej.: compra de pesas" : "Ej.: venta de un equipo usado"}
              />
            )}
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-medium">Monto</p>
            <div className="flex gap-2">
              <div className={cn("flex h-10 min-w-0 flex-1 items-center overflow-hidden rounded-md border bg-background focus-within:border-ring", amount.trim() && !amountOk && "border-destructive")}>
                <span className="pl-3 text-xs text-muted-foreground">{CURRENCY_META[currency].symbol}</span>
                <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, "").slice(0, 14))} placeholder="0.00" className="min-w-0 flex-1 bg-transparent px-2 text-base font-semibold tabular-nums outline-none" />
              </div>
              <div className="flex shrink-0 gap-1">
                {currencies.map((c) => (
                  <button key={c} type="button" disabled={!(cashRates[c] > 0)} onClick={() => setCurrency(c)} className={cn("h-10 rounded-md border px-2.5 text-xs font-semibold disabled:opacity-40", currency === c ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted")}>
                    {CURRENCY_META[c].short}
                  </button>
                ))}
              </div>
            </div>
            {amountOk && currency !== "USD" && <p className="text-xs text-muted-foreground">Equivale a {formatMoney(usd, "USD")}</p>}
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-medium">{type === "OUT" ? "¿Con qué se pagó?" : "¿Cómo entró?"}</p>
            <ChoiceSelect
              value={method}
              customLabel={methodLabel}
              onChange={(v, l) => { setMethod(v); setMethodLabel(l ?? ""); }}
              options={(meta?.methods ?? []).map((m) => ({ value: m, label: METHOD_LABELS[m] ?? m, hint: METHOD_HINTS[m] }))}
              placeholder={type === "OUT" ? "Elegir con qué se pagó" : "Elegir cómo entró"}
              customPlaceholder="Ej.: cheque, Nequi, Bancolombia"
            />
            {method === "CASH_DRAWER" && <p className="text-xs text-muted-foreground">{type === "OUT" ? "Sale de la gaveta de tu caja abierta" : "Entra a la gaveta de tu caja abierta"}: el cierre lo tiene en cuenta.</p>}
          </div>

          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,170px)]">
            <div className="space-y-1.5">
              <p className="text-xs font-medium">Detalle <span className="font-normal text-muted-foreground">(opcional)</span></p>
              <Input value={description} onChange={(e) => setDescription(e.target.value.slice(0, 300))} placeholder={type === "OUT" ? "Ej.: botellones de agua" : "Ej.: aporte para la nómina"} />
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-medium">Fecha</p>
              <DateField value={day} onChange={(v) => setDay(v || toDay(new Date()))} max={toDay(new Date())} />
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="flex items-center gap-1.5 text-xs font-medium">Factura o recibo {needsReceipt ? <span className="rounded bg-rose-500/10 px-1.5 py-0.5 text-[10px] text-rose-600">Obligatoria</span> : <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground">Opcional</span>}</p>
            <input ref={fileRef} type="file" accept="image/*,application/pdf" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
            {receipt ? (
              <div className="flex items-center gap-3 rounded-lg border p-2">
                <button type="button" onClick={() => setViewing(receipt)} className="shrink-0" title="Ver la foto">
                  {isPdf(receipt) ? <span className="flex size-12 items-center justify-center rounded bg-muted"><IconFileTypePdf size={22} /></span> : <img src={receipt} alt="Recibo" className="size-12 rounded object-cover" />}
                </button>
                <span className="flex-1 text-xs text-muted-foreground">Guardada en el almacenamiento</span>
                <Button size="sm" variant="ghost" onClick={() => setReceipt(null)}>Quitar</Button>
              </div>
            ) : (
              <Button type="button" variant="outline" size="sm" className={cn("w-full gap-2", needsReceipt && "border-rose-300")} disabled={uploading} onClick={() => fileRef.current?.click()}>
                {uploading ? <IconLoader2 size={15} className="animate-spin" /> : <IconCamera size={15} />} {uploading ? "Subiendo…" : "Tomar o subir foto"}
              </Button>
            )}
          </div>

          {needsPin && (
            <div className="space-y-1.5 rounded-xl bg-amber-500/10 p-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold"><IconLock size={13} /> Necesita el PIN de un supervisor</p>
              <p className="text-[11px] text-muted-foreground">{isProtected ? `${label(category)} solo lo registra un administrador o con su PIN.` : `Pasa de tu límite de ${formatMoney(meta!.rules.staffLimitUsd, "USD")} por movimiento.`}</p>
              {meta && !meta.hasSupervisorPin && <p className="text-[11px] text-rose-600">No hay PIN configurado: pídele a un administrador que lo registre.</p>}
              <Input type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))} placeholder="PIN" className="bg-background" />
            </div>
          )}

          <Button data-kbd-primary className={cn("w-full gap-2 text-white", type === "OUT" ? "bg-rose-600 hover:bg-rose-700" : "bg-emerald-600 hover:bg-emerald-700")} disabled={saving} onClick={save}>
            {saving ? <IconLoader2 size={16} className="animate-spin" /> : <IconCheck size={16} />} Registrar {type === "OUT" ? "egreso" : "ingreso"}
          </Button>

          {/* Today in this branch */}
          <div className="space-y-2 border-t pt-3">
            <p className="text-xs font-semibold text-muted-foreground">Hoy en esta sucursal</p>
            {today.length === 0 && <p className="text-xs text-muted-foreground">Todavía no hay movimientos hoy.</p>}
            {today.slice(0, 12).map((m) => (
              <div key={m.id} className={cn("flex items-center gap-2 rounded-lg px-1 py-1.5 text-xs", m.status === "VOIDED" && "opacity-50")}>
                <ReceiptThumb url={m.receiptUrl} onOpen={setViewing} size={32} />
                <span className="min-w-0 flex-1 truncate">{categoryOf(m)}{m.description ? ` · ${m.description}` : ""}<span className="block text-[11px] text-muted-foreground">{methodOf(m)} · {m.userName ?? "—"} · {time(m.occurredAt)}{m.status === "VOIDED" ? <b className="ml-1 font-medium">Anulado</b> : m.reviewedAt ? <b className="ml-1 font-medium">Revisado</b> : null}</span></span>
                <span className={cn("shrink-0 text-right font-semibold tabular-nums", m.type === "OUT" ? "text-rose-600" : "text-emerald-700", m.status === "VOIDED" && "line-through")}>{m.type === "OUT" ? "−" : "+"}{formatMoney(m.amountCurrency, m.currency)}</span>
                {canUndo(m) && <button type="button" onClick={() => undo(m)} className="shrink-0 rounded-md px-2 py-1 font-medium text-primary hover:bg-primary/10">Deshacer</button>}
                {!canUndo(m) && m.status === "ACTIVE" && meta?.isManager && <button type="button" onClick={() => setVoiding(m)} className="shrink-0 rounded-md px-2 py-1 font-medium text-rose-600 hover:bg-rose-500/10">Anular</button>}
              </div>
            ))}
          </div>
        </div>
      </div>

      <ReceiptPreview url={viewing} onClose={() => setViewing(null)} />
      <ConfirmDialog
        open={!!voiding}
        danger
        title="¿Anular este movimiento?"
        description="Deja de contar en contabilidad y en la caja. Queda en el historial, tachado, con tu nombre y el motivo."
        details={voiding ? `${voiding.type === "OUT" ? "Egreso" : "Ingreso"} · ${categoryOf(voiding)} · ${formatMoney(voiding.amountCurrency, voiding.currency)}` : null}
        confirmLabel="Anular"
        reason={{ label: "Motivo", suggestions: ["Monto equivocado", "Categoría equivocada", "Se registró dos veces"], required: true }}
        onConfirm={async (reason) => {
          if (!voiding) return;
          try {
            await api(`/movements/${voiding.id}/void`, { method: "POST", json: { reason } });
            toast.success("Movimiento anulado");
            loadToday();
          } catch (e: any) {
            toast.error(e.message);
            throw e;
          }
        }}
        onClose={() => setVoiding(null)}
      />
    </>
  );
}
