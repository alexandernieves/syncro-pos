"use client";

import { useEffect, useRef, useState } from "react";
import { IconLoader2, IconSearch, IconTicket, IconUserShare, IconWalk } from "@tabler/icons-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { type GymMemberRow, type GymPayment, accountCountry, gymApi, money } from "@/lib/gym";
import { PaymentFields, emptyPayment, paymentBody, paymentReady } from "@/components/gym/payment-fields";
import { useCurrency } from "@/context/CurrencyContext";
import { DocumentField, Optional, PhoneField } from "@/components/forms/contact-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MemberAvatar } from "@/components/gym/gym-ui";

type Kind = "GUEST" | "DAY_PASS" | "VISITOR";
type Quota = { memberId: string; name: string; planName: string | null; allowed: number; used: number; left: number };
const KINDS: { kind: Kind; title: string; hint: string; icon: React.ReactNode }[] = [
  { kind: "DAY_PASS", title: "Pase de día", hint: "Paga y entrena hoy", icon: <IconTicket size={20} /> },
  { kind: "GUEST", title: "Invitado", hint: "Viene con un socio", icon: <IconUserShare size={20} /> },
  { kind: "VISITOR", title: "Visita", hint: "No entrena (acompañante, proveedor)", icon: <IconWalk size={20} /> },
];

/** Registers someone without a membership at reception, charging the pass in the cash shift. */
export type SavedVisit = { visit: { id: string; name: string; documentId: string | null; phone: string | null; kind: string; checkedInAt: string }; price: number; method: string; payment?: GymPayment | null };

export function VisitDialog({ open, onClose, onSaved, dayPassPrice }: { open: boolean; onClose: () => void; onSaved: (v: SavedVisit) => void; dayPassPrice: number }) {
  const [kind, setKind] = useState<Kind>("DAY_PASS");
  const [form, setForm] = useState({ name: "", documentId: "", phone: "", notes: "", price: "" });
  const [pay, setPay] = useState(emptyPayment());
  const { cashRates } = useCurrency();
  const method = pay.method;
  const [hostQuery, setHostQuery] = useState("");
  const [hostMatches, setHostMatches] = useState<GymMemberRow[]>([]);
  const [host, setHost] = useState<GymMemberRow | null>(null);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [saving, setSaving] = useState(false);
  const [valid, setValid] = useState({ phone: true, documentId: true });
  // Keyboard flow: pick the kind with the arrows and Enter (that locks it), then Enter moves field by field
  const [locked, setLocked] = useState(false);
  const [nameError, setNameError] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setKind("DAY_PASS");
    setForm({ name: "", documentId: "", phone: "", notes: "", price: "" });
    setPay(emptyPayment());
    setHost(null);
    setHostQuery("");
    setQuota(null);
    setValid({ phone: true, documentId: true });
    setLocked(false);
    setNameError(false);
  }, [open]);

  useEffect(() => {
    const term = hostQuery.trim();
    if (kind !== "GUEST" || host || term.length < 2) { setHostMatches([]); return; }
    const t = setTimeout(() => gymApi<{ items: GymMemberRow[] }>(`/members?${new URLSearchParams({ q: term, pageSize: "6", visiting: "true" })}`).then((r) => setHostMatches(r.items)).catch(() => {}), 200);
    return () => clearTimeout(t);
  }, [hostQuery, kind, host]);

  useEffect(() => {
    setQuota(null);
    if (host) gymApi<Quota>(`/members/${host.id}/guest-quota`).then(setQuota).catch(() => {});
  }, [host]);

  const basePrice = form.price !== "" ? Number(form.price) || 0 : dayPassPrice;
  const price = kind === "VISITOR" ? 0 : kind === "GUEST" ? (quota && quota.left > 0 ? 0 : basePrice) : basePrice;
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      const phone = form.phone || null;
      const res = await gymApi<{ price: number; previousVisits: number; visit: SavedVisit["visit"] & { leadId: string | null }; payment: GymPayment | null }>("/visits", {
        method: "POST",
        json: {
          kind,
          name: form.name,
          documentId: form.documentId,
          phone,
          notes: form.notes,
          hostMemberId: host?.id,
          ...(form.price !== "" && { price: Number(form.price) || 0 }),
          ...(price > 0 && { payment: paymentBody(pay, price) }),
        },
      });
      const extra = [res.price > 0 ? `Cobrado ${money(res.price)} en tu turno de caja.` : null, res.previousVisits >= 2 ? `Es su visita n.º ${res.previousVisits + 1}: ofrécele un plan.` : null, res.visit.leadId ? "Quedó en tus prospectos para darle seguimiento." : null].filter(Boolean).join(" ");
      toast.success(`Entrada registrada: ${form.name}`, { description: extra || undefined });
      onSaved({ visit: res.visit, price: res.price, method, payment: res.payment });
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const ready = form.name.trim() && (kind !== "GUEST" || host) && valid.phone && valid.documentId && (price <= 0 || paymentReady(pay, price, cashRates));
  const missing = !form.name.trim() ? "Escribe el nombre" : kind === "GUEST" && !host ? "Elige al socio que lo invita" : !valid.documentId ? "Revisa la cédula" : !valid.phone ? "Revisa el WhatsApp" : price > 0 && !paymentReady(pay, price, cashRates) ? "Revisa el pago: falta dinero o el monto no es válido" : "";

  const focusStep = (step: string) =>
    setTimeout(() => {
      const root = contentRef.current;
      const el = step === "received" ? root?.querySelector<HTMLElement>("[data-received]") : step.startsWith("kind:") ? root?.querySelector<HTMLElement>(`[data-kind="${step.slice(5)}"]`) : root?.querySelector<HTMLElement>(`[data-step="${step}"] input`);
      el?.focus();
    }, 30);

  const choose = (k: Kind) => {
    setKind(k);
    setLocked(true);
    focusStep(k === "GUEST" && !host ? "host" : "name");
  };
  const unlock = () => {
    setLocked(false);
    focusStep(`kind:${kind}`);
  };

  // Order of the fields that Enter walks through
  const steps = [...(kind === "GUEST" ? ["host"] : []), "name", "doc", "phone", "notes", ...(price > 0 && pay.method === "CASH" ? ["received"] : [])];
  const next = (from: string) => {
    if (from === "name" && !form.name.trim()) { setNameError(true); return; }
    if (from === "doc" && !valid.documentId) return;
    if (from === "phone" && !valid.phone) return;
    const i = steps.indexOf(from);
    const to = steps[i + 1];
    if (to) return focusStep(to);
    if (ready) save();
    else toast.error(missing);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const target = e.target as HTMLElement;
    if (!contentRef.current?.contains(target)) return; // pickers open in their own layer
    // Arrows move between the three kinds while it isn't locked
    const kindEl = target.closest<HTMLElement>("[data-kind]");
    if (kindEl && !locked && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
      e.preventDefault();
      const i = KINDS.findIndex((k) => k.kind === kind);
      const k = KINDS[(i + (e.key === "ArrowRight" ? 1 : KINDS.length - 1)) % KINDS.length].kind;
      setKind(k);
      focusStep(`kind:${k}`);
      return;
    }
    if (e.key !== "Enter" || target.tagName !== "INPUT") return;
    e.preventDefault();
    if (target.hasAttribute("data-received")) return next("received");
    const step = target.closest<HTMLElement>("[data-step]")?.dataset.step;
    if (step === "host") {
      if (host) return focusStep("name");
      if (hostMatches[0]) { setHost(hostMatches[0]); focusStep("name"); }
      return;
    }
    if (step === "price") return next("notes");
    if (step) next(step);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        ref={contentRef}
        onKeyDown={onKeyDown}
        onOpenAutoFocus={(e) => { e.preventDefault(); focusStep(`kind:${kind}`); }}
        className="max-h-[92vh] overflow-y-auto sm:max-w-4xl"
      >
        <DialogHeader>
          <DialogTitle>Registrar visita</DialogTitle>
          <DialogDescription>Para quien entra sin membresía. Los pases se cobran en tu turno de caja.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
          <div className="min-w-0 space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>Tipo de visita</Label>
                {locked && <button type="button" onClick={unlock} className="text-xs font-semibold text-primary hover:underline">Cambiar tipo</button>}
              </div>
              <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Tipo de visita">
                {KINDS.map((k) => {
                  const selected = kind === k.kind;
                  const off = locked && !selected;
                  return (
                    <button
                      key={k.kind}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      data-kind={k.kind}
                      disabled={off}
                      tabIndex={selected ? 0 : -1}
                      onClick={() => choose(k.kind)}
                      className={cn(
                        "flex flex-col items-start gap-1 rounded-xl p-4 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-primary",
                        selected ? "bg-primary/10 text-primary ring-1 ring-primary/40" : "bg-muted/50 text-muted-foreground hover:bg-muted",
                        off && "cursor-not-allowed opacity-40 hover:bg-muted/50",
                      )}
                    >
                      {k.icon}
                      <span className="text-sm font-semibold text-foreground">{k.title}</span>
                      <span className="text-xs leading-tight">{k.hint}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {kind === "GUEST" && (
              <div className="space-y-1.5" data-step="host">
                <Label>Socio que lo invita</Label>
                {host ? (
                  <div className="flex items-center gap-3 rounded-xl bg-muted/40 p-2.5">
                    <MemberAvatar src={host.photoUrl} name={host.client.name} size={36} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{host.client.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {!quota ? "Revisando pases…" : quota.allowed ? `${quota.left} de ${quota.allowed} pases gratis este mes` : `Su plan${quota.planName ? ` ${quota.planName}` : ""} no incluye pases gratis`}
                      </p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => { setHost(null); setHostQuery(""); focusStep("host"); }}>Cambiar</Button>
                  </div>
                ) : (
                  <div className="relative">
                    <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input value={hostQuery} onChange={(e) => setHostQuery(e.target.value)} placeholder="Nombre, cédula o n.º de socio" className="pl-9" />
                    {hostMatches.length > 0 && (
                      <div className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-xl border bg-popover shadow-lg">
                        {hostMatches.map((m, i) => (
                          <button key={m.id} type="button" onClick={() => { setHost(m); focusStep("name"); }} className={cn("flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted", i === 0 && "bg-muted/60")}>
                            <MemberAvatar src={m.photoUrl} name={m.client.name} size={28} />
                            <span className="min-w-0 flex-1 truncate text-sm">{m.client.name}</span>
                            <span className="text-xs text-muted-foreground">N.º {m.memberNumber}</span>
                            {i === 0 && <kbd className="rounded border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">Enter</kbd>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2" data-step="name">
                <Label>Nombre</Label>
                <Input value={form.name} onChange={(e) => { set("name", e.target.value); if (e.target.value.trim()) setNameError(false); }} placeholder="Nombre y apellido" className={cn(nameError && "border-destructive")} />
                {nameError && <p className="text-xs text-destructive">Escribe el nombre para seguir</p>}
              </div>
              <div className="space-y-1.5" data-step="doc"><Label>Cédula <Optional /></Label><DocumentField value={form.documentId} onChange={(st) => { set("documentId", st.value); setValid((v) => ({ ...v, documentId: st.valid })); }} /></div>
              <div className="space-y-1.5" data-step="phone"><Label>WhatsApp <Optional /></Label><PhoneField value={form.phone} onChange={(st) => { set("phone", st.value); setValid((v) => ({ ...v, phone: st.valid })); }} accountCountry={accountCountry()} /></div>
              <div className="space-y-1.5 sm:col-span-2" data-step="notes"><Label>Notas <Optional /></Label><Input value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Ej.: viene con su entrenador" /></div>
            </div>
          </div>

          <div className="min-w-0 space-y-3">
            {kind === "VISITOR" ? (
              <div className="rounded-xl bg-muted/40 p-4">
                <p className="text-sm font-semibold">Sin costo</p>
                <p className="mt-1 text-sm text-muted-foreground">Una visita no entrena: acompañantes, proveedores o técnicos. Solo queda registrada su entrada.</p>
              </div>
            ) : (
              <div className="space-y-3 rounded-xl bg-muted/40 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{price > 0 ? "Cobrar pase" : "Sin costo"}</p>
                    <p className="text-xs text-muted-foreground">{kind === "GUEST" && !host ? "Elige al socio para ver si le quedan pases gratis." : kind === "GUEST" && quota && quota.left > 0 ? "Usa uno de los pases gratis del socio." : kind === "GUEST" ? "Al socio no le quedan pases gratis: se cobra como pase de día." : "Precio del pase de día en ajustes."}</p>
                  </div>
                  {!(kind === "GUEST" && quota && quota.left > 0) && (
                    <div className="flex items-center gap-1.5" data-step="price">
                      <span className="text-sm text-muted-foreground">$</span>
                      <Input value={form.price === "" ? String(dayPassPrice) : form.price} onChange={(e) => set("price", e.target.value.replace(/[^\d.]/g, ""))} className="h-9 w-20 text-right tabular-nums" inputMode="decimal" />
                    </div>
                  )}
                </div>
                {price > 0 && <PaymentFields value={pay} onChange={setPay} amountUsd={price} compact />}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="items-center gap-2 sm:justify-between">
          <div className="hidden items-center gap-3 text-xs text-muted-foreground sm:flex">
            <span className="flex items-center gap-1"><kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[11px]">←</kbd><kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[11px]">→</kbd><span>Tipo</span></span>
            <span className="flex items-center gap-1"><kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[11px]">Enter</kbd><span>Siguiente</span></span>
            <span className="flex items-center gap-1"><kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[11px]">Esc</kbd><span>Cerrar</span></span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={save} disabled={saving || !ready} className="gap-2">{saving && <IconLoader2 size={16} className="animate-spin" />} {price > 0 ? `Cobrar ${money(price)} y registrar` : "Registrar entrada"}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
