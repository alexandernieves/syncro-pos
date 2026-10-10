"use client";

import { useEffect, useState } from "react";
import { IconLoader2, IconSearch, IconTicket, IconUserShare, IconWalk } from "@tabler/icons-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { type GymMemberRow, PAYMENT_METHODS, gymApi, money } from "@/lib/gym";
import { countryFromAccount, toWhatsAppNumber } from "@/lib/phone-countries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MemberAvatar } from "@/components/gym/gym-ui";

const VE = countryFromAccount("Venezuela");
type Kind = "GUEST" | "DAY_PASS" | "VISITOR";
type Quota = { memberId: string; name: string; planName: string | null; allowed: number; used: number; left: number };
const KINDS: { kind: Kind; title: string; hint: string; icon: React.ReactNode }[] = [
  { kind: "DAY_PASS", title: "Pase de día", hint: "Paga y entrena hoy", icon: <IconTicket size={20} /> },
  { kind: "GUEST", title: "Invitado", hint: "Viene con un socio", icon: <IconUserShare size={20} /> },
  { kind: "VISITOR", title: "Visita", hint: "No entrena (acompañante, proveedor)", icon: <IconWalk size={20} /> },
];

/** Registers someone without a membership at reception, charging the pass in the cash shift. */
export function VisitDialog({ open, onClose, onSaved, dayPassPrice }: { open: boolean; onClose: () => void; onSaved: () => void; dayPassPrice: number }) {
  const [kind, setKind] = useState<Kind>("DAY_PASS");
  const [form, setForm] = useState({ name: "", documentId: "", phone: "", notes: "", price: "" });
  const [method, setMethod] = useState("CASH");
  const [reference, setReference] = useState("");
  const [hostQuery, setHostQuery] = useState("");
  const [hostMatches, setHostMatches] = useState<GymMemberRow[]>([]);
  const [host, setHost] = useState<GymMemberRow | null>(null);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setKind("DAY_PASS");
    setForm({ name: "", documentId: "", phone: "", notes: "", price: "" });
    setMethod("CASH");
    setReference("");
    setHost(null);
    setHostQuery("");
    setQuota(null);
  }, [open]);

  useEffect(() => {
    const term = hostQuery.trim();
    if (kind !== "GUEST" || host || term.length < 2) { setHostMatches([]); return; }
    const t = setTimeout(() => gymApi<{ items: GymMemberRow[] }>(`/members?${new URLSearchParams({ q: term, pageSize: "6" })}`).then((r) => setHostMatches(r.items)).catch(() => {}), 200);
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
      const phone = form.phone.trim() ? toWhatsAppNumber(form.phone, VE) || form.phone.trim() : null;
      const res = await gymApi<{ price: number; previousVisits: number; visit: { leadId: string | null } }>("/visits", {
        method: "POST",
        json: {
          kind,
          name: form.name,
          documentId: form.documentId,
          phone,
          notes: form.notes,
          hostMemberId: host?.id,
          ...(form.price !== "" && { price: Number(form.price) || 0 }),
          ...(price > 0 && { payment: { method, reference } }),
        },
      });
      const extra = [res.price > 0 ? `Cobrado ${money(res.price)} en tu turno de caja.` : null, res.previousVisits >= 2 ? `Es su visita n.º ${res.previousVisits + 1}: ofrécele un plan.` : null, res.visit.leadId ? "Quedó en tus prospectos para darle seguimiento." : null].filter(Boolean).join(" ");
      toast.success(`Entrada registrada: ${form.name}`, { description: extra || undefined });
      onSaved();
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const ready = form.name.trim() && (kind !== "GUEST" || host);

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
          <div className="space-y-1.5"><Label>Cédula</Label><Input value={form.documentId} onChange={(e) => set("documentId", e.target.value)} placeholder="Opcional" /></div>
          <div className="space-y-1.5"><Label>WhatsApp</Label><Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="Para invitarlo a inscribirse" inputMode="tel" /></div>
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
            {price > 0 && (
              <div className="grid gap-2 sm:grid-cols-2">
                <select value={method} onChange={(e) => setMethod(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm">
                  {PAYMENT_METHODS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
                {method !== "CASH" && <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Referencia" />}
              </div>
            )}
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
