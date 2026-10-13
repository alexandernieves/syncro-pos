"use client";

import { useEffect, useState } from "react";
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

  useEffect(() => {
    if (!open) return;
    setKind("DAY_PASS");
    setForm({ name: "", documentId: "", phone: "", notes: "", price: "" });
    setPay(emptyPayment());
    setHost(null);
    setHostQuery("");
    setQuota(null);
    setValid({ phone: true, documentId: true });
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

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar visita</DialogTitle>
          <DialogDescription>Para quien entra sin membresía. Los pases se cobran en tu turno de caja.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-2">
          {KINDS.map((k) => (
            <button key={k.kind} type="button" onClick={() => setKind(k.kind)} className={cn("flex flex-col items-start gap-1 rounded-xl p-3 text-left outline-none transition", kind === k.kind ? "bg-primary/10 text-primary ring-1 ring-primary/40" : "bg-muted/50 text-muted-foreground hover:bg-muted")}>
              {k.icon}
              <span className="text-sm font-semibold text-foreground">{k.title}</span>
              <span className="text-[11px] leading-tight">{k.hint}</span>
            </button>
          ))}
        </div>

        {kind === "GUEST" && (
          <div className="space-y-1.5">
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
                <Button size="sm" variant="ghost" onClick={() => { setHost(null); setHostQuery(""); }}>Cambiar</Button>
              </div>
            ) : (
              <div className="relative">
                <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input value={hostQuery} onChange={(e) => setHostQuery(e.target.value)} placeholder="Nombre, cédula o n.º de socio" className="pl-9" />
                {hostMatches.length > 0 && (
                  <div className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-xl border bg-popover shadow-lg">
                    {hostMatches.map((m) => (
                      <button key={m.id} type="button" onClick={() => setHost(m)} className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted">
                        <MemberAvatar src={m.photoUrl} name={m.client.name} size={28} />
                        <span className="min-w-0 flex-1 truncate text-sm">{m.client.name}</span>
                        <span className="text-xs text-muted-foreground">N.º {m.memberNumber}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2"><Label>Nombre</Label><Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Nombre y apellido" /></div>
          <div className="space-y-1.5"><Label>Cédula <Optional /></Label><DocumentField value={form.documentId} onChange={(st) => { set("documentId", st.value); setValid((v) => ({ ...v, documentId: st.valid })); }} /></div>
          <div className="space-y-1.5"><Label>WhatsApp <Optional /></Label><PhoneField value={form.phone} onChange={(st) => { set("phone", st.value); setValid((v) => ({ ...v, phone: st.valid })); }} accountCountry={accountCountry()} /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label>Notas</Label><Input value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Opcional" /></div>
        </div>

        {kind !== "VISITOR" && (
          <div className="space-y-3 rounded-xl bg-muted/40 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">{price > 0 ? "Cobrar pase" : "Sin costo"}</p>
                <p className="text-xs text-muted-foreground">{kind === "GUEST" && !host ? "Elige al socio para ver si le quedan pases gratis." : kind === "GUEST" && quota && quota.left > 0 ? "Usa uno de los pases gratis del socio." : kind === "GUEST" ? "Al socio no le quedan pases gratis: se cobra como pase de día." : "Precio del pase de día en ajustes."}</p>
              </div>
              {!(kind === "GUEST" && quota && quota.left > 0) && (
                <div className="flex items-center gap-1.5">
                  <span className="text-sm text-muted-foreground">$</span>
                  <Input value={form.price === "" ? String(dayPassPrice) : form.price} onChange={(e) => set("price", e.target.value.replace(/[^\d.]/g, ""))} className="h-9 w-20 text-right tabular-nums" inputMode="decimal" />
                </div>
              )}
            </div>
            {price > 0 && <PaymentFields value={pay} onChange={setPay} amountUsd={price} />}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving || !ready} className="gap-2">{saving && <IconLoader2 size={16} className="animate-spin" />} {price > 0 ? `Cobrar ${money(price)} y registrar` : "Registrar entrada"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
