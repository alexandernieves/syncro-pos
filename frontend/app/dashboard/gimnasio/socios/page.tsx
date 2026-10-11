"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  IconBan,
  IconDeviceMobile,
  IconBrandWhatsapp,
  IconPrinter,
  IconCircleCheckFilled,
  IconCamera,
  IconCash,
  IconLoader2,
  IconPencil,
  IconPlayerPlay,
  IconRefresh,
  IconSearch,
  IconSnowflake,
  IconUser,
  IconUserPlus,
  IconX,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { API_URL } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { countryFromAccount, formatWhatsAppNumber, toWhatsAppNumber } from "@/lib/phone-countries";
import {
  type GymMemberDetail,
  type GymMemberRow,
  type GymMembership,
  type GymPlan,
  type MemberStatus,
  PAYMENT_METHODS,
  STATUS_CLASS,
  STATUS_LABEL,
  durationLabel,
  gymApi,
  membershipTotal,
  methodLabel,
  money,
  shortDate,
} from "@/lib/gym";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import type { ColumnDef } from "@tanstack/react-table";
import { PosTable } from "@/components/pos-table";
import { StatCard, StatGrid } from "@/components/stat-card";
import { FilterChips, GymPage, GymPageHeader, MemberAvatar, PersonCell, StatusBadge } from "@/components/gym/gym-ui";
import { printMembershipReceipt, sendMembershipReceipt } from "@/lib/gym-receipt";
import { SignDocumentDialog, SignedDocumentDialog } from "@/components/gym/sign-document-dialog";
import { type Routine, RoutineBuilder, levelLabel, routineText } from "@/components/gym/routine-builder";
import { AssessmentDialog, type Progress, ProgressSummary } from "@/components/gym/progress";

const FILTERS: [string, string][] = [
  ["", "Todos"],
  ["ACTIVE", "Activos"],
  ["expiring", "Vencen esta semana"],
  ["EXPIRED", "Vencidos"],
  ["FROZEN", "Congelados"],
  ["NONE", "Sin membresía"],
  ["BLOCKED", "Bloqueados"],
];

const VE = countryFromAccount("Venezuela");

function Avatar({ src, name, size = 36 }: { src?: string | null; name: string; size?: number }) {
  return <MemberAvatar src={src} name={name} size={size} />;
}

async function uploadPhoto(file: File) {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_URL}/uploads`, { method: "POST", headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }, body: form });
  if (!res.ok) throw new Error("No se pudo subir la foto");
  return (await res.json()).url as string;
}

// ── Sell / renew a plan ─────────────────────────────────────────────────────

type Quote = { start: string; end: string; price: number; autoDiscount: number; feeItems: { label: string; amount: number }[]; fees: number; total: number; notes: string[] };

function SellPlanForm({ memberId, plans, onSubmit, saving }: { memberId: string; plans: GymPlan[]; saving: boolean; onSubmit: (body: any) => void }) {
  const active = plans.filter((p) => p.isActive);
  const [planId, setPlanId] = useState(active[0]?.id || "");
  const [discount, setDiscount] = useState("");
  const [paid, setPaid] = useState("");
  const [method, setMethod] = useState("CASH");
  const [reference, setReference] = useState("");
  const [startDate, setStartDate] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const plan = active.find((p) => p.id === planId);
  const manual = Number(discount) || 0;
  const total = quote ? Math.max(0, Math.round((quote.total - manual) * 100) / 100) : Math.max(0, (plan?.price || 0) - manual);

  // The server applies the renewal policy: start date, early discount, enrollment fees
  useEffect(() => {
    if (!planId) return;
    setQuote(null);
    gymApi<Quote>(`/members/${memberId}/quote?${new URLSearchParams({ planId, ...(startDate && { startDate }) })}`).then(setQuote).catch(() => {});
  }, [memberId, planId, startDate]);
  useEffect(() => setPaid(total ? total.toFixed(2) : ""), [total]); // eslint-disable-line react-hooks/exhaustive-deps

  if (active.length === 0) return <p className="rounded-lg bg-muted px-3 py-3 text-sm text-muted-foreground">Primero crea un plan en planes y membresías.</p>;

  return (
    <div className="grid gap-3">
      <div className="grid gap-2 sm:grid-cols-2">
        {active.map((p) => (
          <button key={p.id} type="button" onClick={() => setPlanId(p.id)} className={cn("rounded-xl border p-3 text-left transition-colors", planId === p.id ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "hover:border-primary/40")}>
            <span className="block text-sm font-semibold">{p.name}</span>
            <span className="block text-xs text-muted-foreground">{durationLabel(p.durationDays)} · {money(p.price)}</span>
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Descuento extra ($)</Label>
          <Input type="number" min={0} step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0.00" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Inicia</Label>
          <Input type="date" value={startDate || (quote ? quote.start.slice(0, 10) : "")} onChange={(e) => setStartDate(e.target.value)} />
        </div>
      </div>
      {quote && (
        <div className="space-y-1 rounded-xl bg-muted/40 p-3 text-sm">
          <div className="flex justify-between"><span>{plan?.name}</span><span className="tabular-nums">{money(quote.price)}</span></div>
          {quote.autoDiscount > 0 && <div className="flex justify-between text-emerald-700"><span>Renovación anticipada</span><span className="tabular-nums">−{money(quote.autoDiscount)}</span></div>}
          {manual > 0 && <div className="flex justify-between text-emerald-700"><span>Descuento</span><span className="tabular-nums">−{money(manual)}</span></div>}
          {quote.feeItems.map((f) => <div key={f.label} className="flex justify-between"><span>{f.label}</span><span className="tabular-nums">{money(f.amount)}</span></div>)}
          <div className="flex justify-between border-t pt-1 font-semibold"><span>Total</span><span className="tabular-nums">{money(total)}</span></div>
          <p className="pt-1 text-xs text-muted-foreground">Del {shortDate(quote.start)} al {shortDate(quote.end)}{quote.notes.length ? `. ${quote.notes.join(". ")}.` : "."}</p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Pagado ahora ($)</Label>
          <Input type="number" min={0} step="0.01" value={paid} onChange={(e) => setPaid(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Método</Label>
          <select value={method} onChange={(e) => setMethod(e.target.value)} className="h-9 w-full rounded-md border bg-background px-3 text-sm">
            {PAYMENT_METHODS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
        </div>
      </div>
      {method !== "CASH" && (
        <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Referencia del pago" />
      )}
      <Button
        disabled={saving || !planId}
        className="gap-2"
        onClick={() =>
          onSubmit({
            planId,
            discount: manual,
            ...(startDate && { startDate }),
            ...(Number(paid) > 0 && { payment: { amount: Number(paid), method, reference, branchId: localStorage.getItem("currentBranchId") || undefined } }),
          })
        }
      >
        {saving && <IconLoader2 size={16} className="animate-spin" />} Vender {plan?.name ?? "plan"}
      </Button>
    </div>
  );
}

type FreezePolicy = { minDays: number; maxTimes: number; fee: number; requireReason: boolean };

/** Freeze from today or a later date, until a return date (the days come back at the end). */
function FreezeForm({ membership, maxDays, policy, saving, onSubmit, onCancel }: { membership: GymMembership; maxDays: number; policy: FreezePolicy | null; saving: boolean; onSubmit: (body: any) => void; onCancel: () => void }) {
  const today = new Date().toLocaleDateString("en-CA");
  const plus = (d: string, n: number) => { const x = new Date(`${d}T12:00:00`); x.setDate(x.getDate() + n); return x.toLocaleDateString("en-CA"); };
  const [from, setFrom] = useState(today);
  const [until, setUntil] = useState(plus(today, Math.min(maxDays, Math.max(policy?.minDays ?? 7, 7))));
  const [reason, setReason] = useState("");
  const [method, setMethod] = useState("CASH");
  const days = Math.round((new Date(`${until}T12:00:00`).getTime() - new Date(`${from}T12:00:00`).getTime()) / 86400000);
  const left = maxDays - membership.frozenDaysUsed;
  const fee = policy?.fee ?? 0;
  return (
    <div className="space-y-3 border-t pt-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5"><Label className="text-xs">Desde</Label><Input type="date" min={today} value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div className="space-y-1.5"><Label className="text-xs">Regresa el</Label><Input type="date" min={plus(from, 1)} value={until} onChange={(e) => setUntil(e.target.value)} /></div>
      </div>
      <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={policy?.requireReason ? "Motivo (viaje, lesión…)" : "Motivo (opcional)"} />
      <p className={cn("text-xs", days > left || days < (policy?.minDays ?? 1) ? "text-rose-600" : "text-muted-foreground")}>
        {days} {days === 1 ? "día" : "días"} · le quedan {left} de {maxDays} en su plan{policy?.minDays ? ` · mínimo ${policy.minDays}` : ""}. Esos días se suman al final.
      </p>
      {fee > 0 && (
        <div className="flex items-center justify-between gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-sm">
          <span>Congelar cuesta {money(fee)}</span>
          <select value={method} onChange={(e) => setMethod(e.target.value)} className="h-8 rounded-md border bg-background px-2 text-sm">
            <option value="">Cobrar después</option>
            {PAYMENT_METHODS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
        </div>
      )}
      <div className="flex gap-2">
        <Button size="sm" disabled={saving || days < 1 || days > left || (policy?.requireReason && !reason.trim())} onClick={() => onSubmit({ from, until, reason, ...(fee > 0 && method && { payment: { method, branchId: localStorage.getItem("currentBranchId") || undefined } }) })}>
          {from === today ? "Congelar ahora" : "Programar congelamiento"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancelar</Button>
      </div>
    </div>
  );
}

type MemberDocs = { documents: { id: string; title: string; required: boolean; version: number; status: "PENDING" | "OUTDATED" | "SIGNED"; signature: { id: string; signedAt: string; version: number } | null }[] };

// ── New member ──────────────────────────────────────────────────────────────

function NewMemberDialog({ open, onOpenChange, onCreated, member }: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: (id: string) => void; member?: GymMemberDetail | null }) {
  const [form, setForm] = useState({ name: "", documentId: "", phone: "", email: "", birthDate: "", emergencyContact: "", emergencyPhone: "", goal: "", medicalNotes: "" });
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!open) return;
    setForm({
      name: member?.client.name ?? "",
      documentId: member?.client.documentId ?? "",
      phone: member?.client.phone ?? "",
      email: member?.client.email ?? "",
      birthDate: member?.birthDate ? member.birthDate.slice(0, 10) : "",
      emergencyContact: member?.emergencyContact ?? "",
      emergencyPhone: member?.emergencyPhone ?? "",
      goal: member?.goal ?? "",
      medicalNotes: member?.medicalNotes ?? "",
    });
    setPhotoUrl(member?.photoUrl ?? null);
  }, [open, member]);

  const save = async () => {
    if (!form.name.trim()) return toast.error("Escribe el nombre del socio");
    setSaving(true);
    try {
      const phone = form.phone.trim() ? toWhatsAppNumber(form.phone, VE) || form.phone.trim() : "";
      const saved = await gymApi<GymMemberRow>(member ? `/members/${member.id}` : "/members", {
        method: member ? "PUT" : "POST",
        json: { ...form, phone, birthDate: form.birthDate || null, photoUrl },
      });
      toast.success(member ? "Datos del socio actualizados" : `${saved.client.name} es el socio n.º ${saved.memberNumber}`);
      onOpenChange(false);
      onCreated(saved.id);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>{member ? "Editar socio" : "Nuevo socio"}</DialogTitle></DialogHeader>
        <div className="grid gap-5 sm:grid-cols-[140px_1fr]">
          <div className="flex flex-col items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="user"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setUploading(true);
                try { setPhotoUrl(await uploadPhoto(file)); } catch (err) { toast.error((err as Error).message); } finally { setUploading(false); e.target.value = ""; }
              }}
            />
            <button type="button" onClick={() => fileRef.current?.click()} className="flex size-32 items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed bg-muted/30 text-muted-foreground hover:border-primary/50 hover:text-primary">
              {uploading ? <IconLoader2 className="animate-spin" /> : photoUrl ? <img src={photoUrl} alt="" className="size-full object-cover" /> : <IconCamera size={28} />}
            </button>
            <p className="text-center text-[11px] leading-snug text-muted-foreground">Foto de frente, con buena luz. Se usará en el lector de rostro.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2"><Label>Nombre completo</Label><Input autoFocus value={form.name} onChange={(e) => set("name", e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Cédula</Label><Input value={form.documentId} onChange={(e) => set("documentId", e.target.value.toUpperCase())} placeholder="V-12345678" /></div>
            <div className="space-y-1.5"><Label>WhatsApp</Label><Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="0412 123 4567" inputMode="tel" /></div>
            <div className="space-y-1.5"><Label>Correo</Label><Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Fecha de nacimiento</Label><Input type="date" value={form.birthDate} onChange={(e) => set("birthDate", e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Contacto de emergencia</Label><Input value={form.emergencyContact} onChange={(e) => set("emergencyContact", e.target.value)} placeholder="Nombre" /></div>
            <div className="space-y-1.5"><Label>Teléfono de emergencia</Label><Input value={form.emergencyPhone} onChange={(e) => set("emergencyPhone", e.target.value)} inputMode="tel" /></div>
            <div className="space-y-1.5 sm:col-span-2"><Label>Objetivo</Label><Input value={form.goal} onChange={(e) => set("goal", e.target.value)} placeholder="Bajar de peso, ganar masa muscular…" /></div>
            <div className="space-y-1.5 sm:col-span-2"><Label>Notas médicas</Label><Input value={form.medicalNotes} onChange={(e) => set("medicalNotes", e.target.value)} placeholder="Lesiones, condiciones o alergias" /></div>
          </div>
        </div>
        {!member && <p className="text-xs text-muted-foreground">Si la cédula ya es de un cliente de tu negocio, se usa ese cliente. Después de crearlo puedes venderle su plan.</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving || uploading} className="gap-2">{saving && <IconLoader2 size={16} className="animate-spin" />} {member ? "Guardar cambios" : "Crear socio"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Training and progress (inside the member card) ─────────────────────────

type Training = { current: Routine | null; previous: Routine[]; logs: { id: string; dayName: string | null; doneAt: string }[]; workoutsLast4Weeks: number };

function TrainingSection({ member }: { member: GymMemberDetail }) {
  const [training, setTraining] = useState<Training | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [templates, setTemplates] = useState<Routine[] | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [editing, setEditing] = useState(false);
  const [measuring, setMeasuring] = useState(false);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => {
    gymApi<Training>(`/members/${member.id}/training`).then(setTraining).catch(() => {});
    gymApi<Progress>(`/members/${member.id}/assessments`).then(setProgress).catch(() => {});
  }, [member.id]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (assigning && !templates) gymApi<Routine[]>("/routines").then((r) => setTemplates(r.filter((x) => x.isActive))).catch(() => setTemplates([])); }, [assigning, templates]);

  const assign = async (templateId: string) => {
    setBusy(true);
    try {
      await gymApi(`/members/${member.id}/routine`, { method: "POST", json: { templateId } });
      toast.success("Rutina asignada. El socio ya la ve en su app");
      setAssigning(false);
      load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const send = async () => {
    if (!training?.current) return;
    setBusy(true);
    try {
      await gymApi(`/members/${member.id}/routine/send`, { method: "POST", json: { text: routineText(training.current, member.client.name.split(" ")[0]) } });
      toast.success("Rutina enviada por WhatsApp");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const r = training?.current;

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold">Entrenamiento y progreso</p>
      <div className="space-y-3 rounded-xl border p-3">
        {r ? (
          <>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold">{r.name}</p>
                <p className="text-xs text-muted-foreground">{levelLabel(r.level)} · {r.days.length} {r.days.length === 1 ? "día" : "días"}{r.startsAt ? ` · desde el ${shortDate(r.startsAt)}` : ""}{r.trainer ? ` · ${r.trainer.name}` : ""}</p>
              </div>
              <span className="shrink-0 text-right text-xs text-muted-foreground"><span className="block text-base font-bold text-foreground tabular-nums">{training!.workoutsLast4Weeks}</span>Entrenos en 4 semanas</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {r.days.map((d, i) => <span key={i} className="rounded-full bg-muted px-2.5 py-0.5 text-xs">{d.name}</span>)}
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Sin rutina asignada.</p>
        )}
        {assigning ? (
          <div className="space-y-1.5 border-t pt-2">
            {!templates && <IconLoader2 size={16} className="animate-spin text-muted-foreground" />}
            {templates && !templates.length && <p className="text-xs text-muted-foreground">Crea rutinas en la sección de entrenamiento.</p>}
            {templates?.map((t) => (
              <button key={t.id} type="button" disabled={busy} onClick={() => assign(t.id)} className="flex w-full items-center justify-between gap-2 rounded-lg bg-muted/40 px-3 py-2 text-left text-sm hover:bg-muted">
                <span className="truncate font-medium">{t.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{levelLabel(t.level)} · {t.days.length} días</span>
              </button>
            ))}
            <Button size="sm" variant="ghost" onClick={() => setAssigning(false)}>Cancelar</Button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant={r ? "outline" : "default"} onClick={() => setAssigning(true)}>{r ? "Cambiar rutina" : "Asignar rutina"}</Button>
            {r && <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Ajustar para este socio</Button>}
            {r && member.client.phone && <Button size="sm" variant="ghost" className="gap-1.5 text-emerald-700" disabled={busy} onClick={send}><IconBrandWhatsapp size={14} /> Enviar</Button>}
          </div>
        )}
      </div>

      <div className="space-y-3 rounded-xl border p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium">Evaluaciones{progress?.items.length ? ` (${progress.items.length})` : ""}</p>
          <Button size="sm" variant="outline" onClick={() => setMeasuring(true)}>Nueva evaluación</Button>
        </div>
        {progress && progress.items.length ? <ProgressSummary progress={progress} compact /> : <p className="text-sm text-muted-foreground">Registra peso y medidas para ver su progreso.</p>}
      </div>

      {r && (
        <RoutineBuilder
          open={editing}
          routine={r}
          title={`Rutina de ${member.client.name.split(" ")[0]}`}
          onClose={() => setEditing(false)}
          onSaved={load}
          save={(body) => gymApi(`/routines/${r.id}`, { method: "PUT", json: body })}
        />
      )}
      <AssessmentDialog memberId={member.id} open={measuring} onClose={() => setMeasuring(false)} onSaved={load} />
    </div>
  );
}

// ── Member detail ───────────────────────────────────────────────────────────

function MemberSheet({ memberId, plans, onClose, onChanged }: { memberId: string | null; plans: GymPlan[]; onClose: () => void; onChanged: () => void }) {
  const [member, setMember] = useState<GymMemberDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [selling, setSelling] = useState(false);
  const [payFor, setPayFor] = useState<GymMembership | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("CASH");
  const [editing, setEditing] = useState(false);
  const [settings, setSettings] = useState<any>(null);
  const [justSold, setJustSold] = useState<string | null>(null);
  const [sendingReceipt, setSendingReceipt] = useState<string | null>(null);
  const [freezing, setFreezing] = useState(false);
  const [freezePolicy, setFreezePolicy] = useState<FreezePolicy | null>(null);
  const [docs, setDocs] = useState<MemberDocs | null>(null);
  const [signing, setSigning] = useState<string | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);

  useEffect(() => {
    gymApi<{ freeze: FreezePolicy }>("/settings").then((x) => setFreezePolicy(x.freeze)).catch(() => {});
    fetch(`${API_URL}/settings`, { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then(setSettings)
      .catch(() => {});
  }, []);

  const sendReceipt = async (m: GymMembership) => {
    if (!member) return;
    setSendingReceipt(m.id);
    try {
      await sendMembershipReceipt(member, m, settings);
      toast.success(`Recibo enviado por WhatsApp a ${member.client.name}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSendingReceipt(null);
    }
  };
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    if (!memberId) return;
    gymApi<GymMemberDetail>(`/members/${memberId}`).then(setMember).catch((e) => toast.error(e.message));
    gymApi<MemberDocs>(`/members/${memberId}/documents`).then(setDocs).catch(() => setDocs(null));
  }, [memberId]);
  useEffect(() => { setMember(null); setDocs(null); setSelling(false); setFreezing(false); setPayFor(null); setJustSold(null); load(); }, [load]);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try { await fn(); toast.success(ok); load(); onChanged(); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  const paidOf = (m: GymMembership) => (m.payments || []).reduce((s, p) => s + p.amount, 0);
  const balanceOf = (m: GymMembership) => Math.max(0, Math.round((membershipTotal(m) - paidOf(m)) * 100) / 100);
  const planOf = (m: GymMembership) => plans.find((p) => p.id === m.planId);

  return (
    <Sheet open={!!memberId} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader><SheetTitle>Ficha del socio</SheetTitle></SheetHeader>
        {!member ? (
          <div className="space-y-3 p-4"><Skeleton className="h-24" /><Skeleton className="h-40" /></div>
        ) : (
          <div className="space-y-5 px-4 pb-8">
            <div className="flex items-center gap-4">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="user"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  await run(async () => gymApi(`/members/${member.id}`, { method: "PUT", json: { photoUrl: await uploadPhoto(file) } }), "Foto actualizada");
                  e.target.value = "";
                }}
              />
              <button type="button" onClick={() => fileRef.current?.click()} className="group relative" title="Cambiar foto">
                <Avatar src={member.photoUrl} name={member.client.name} size={72} />
                <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 text-white opacity-0 group-hover:opacity-100"><IconCamera size={20} /></span>
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-bold">{member.client.name}</p>
                <p className="text-sm text-muted-foreground">Socio n.º {member.memberNumber}{member.client.documentId ? ` · ${member.client.documentId}` : ""}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <StatusBadge status={member.status} />
                  <span className={cn("text-xs", member.faceError ? "text-rose-600" : member.faceSyncedAt ? "text-emerald-700" : "text-muted-foreground")} title={member.faceError ?? undefined}>
                    {member.faceError ? "Rostro con error en el lector" : member.faceSyncedAt ? "Rostro cargado en el lector" : member.photoUrl ? "Rostro pendiente de cargar" : "Sin foto para el lector"}
                  </span>
                </div>
              </div>
              <div className="flex shrink-0 flex-col gap-1.5">
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEditing(true)}><IconPencil size={14} /> Editar</Button>
                {member.client.phone && member.currentMembership && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-emerald-700"
                    disabled={busy}
                    title="Envía por WhatsApp el aviso que corresponde a su membresía"
                    onClick={() => run(() => gymApi(`/members/${member.id}/remind`, { method: "POST" }), "Recordatorio enviado por WhatsApp")}
                  >
                    <IconBrandWhatsapp size={14} /> Recordar
                  </Button>
                )}
                {!member.hasAppAccess && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    disabled={busy}
                    title="Le envía por WhatsApp un código para crear su contraseña en la app de socios"
                    onClick={async () => {
                      if (!member.client.documentId) return toast.error("Anota la cédula del socio: es su usuario para entrar a la app");
                      if (!member.client.phone) return toast.error("Anota el WhatsApp del socio para enviarle el código");
                      setBusy(true);
                      try {
                        const res = await fetch(`${API_URL}/clients/${member.client.id}/activation-code`, { method: "POST", headers: { Authorization: `Bearer ${localStorage.getItem("token")}`, "Content-Type": "application/json" }, body: JSON.stringify({ purpose: "gym" }) });
                        const data = await res.json().catch(() => ({}));
                        if (!res.ok) throw new Error(data.message || "No se pudo generar el código");
                        if (data.sent) toast.success("Le enviamos por WhatsApp el código para entrar a la app");
                        else toast.warning(`${data.reason}. Dale este código: ${data.activationCode}`, { duration: 15000 });
                      } catch (e) {
                        toast.error((e as Error).message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    <IconDeviceMobile size={14} /> Invitar a la app
                  </Button>
                )}
              </div>
            </div>
            <NewMemberDialog open={editing} onOpenChange={setEditing} member={member} onCreated={() => { load(); onChanged(); }} />

            {/* Current membership */}
            <Card className="gap-0 py-0">
              <CardContent className="space-y-3 p-4">
                {member.currentMembership ? (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold">{member.currentMembership.planName}</p>
                        <p className="text-xs text-muted-foreground">{shortDate(member.currentMembership.startDate)} – {shortDate(member.currentMembership.endDate)}</p>
                      </div>
                      {member.daysLeft !== null && <span className="text-sm font-bold text-emerald-600">{member.daysLeft} días</span>}
                    </div>
                    {member.currentMembership.state === "FROZEN" && (
                      <p className="rounded-lg bg-indigo-500/10 px-3 py-2 text-xs text-indigo-800">Congelada{member.currentMembership.freezeUntil ? ` hasta el ${shortDate(member.currentMembership.freezeUntil)}: se reactiva sola ese día` : ""}{member.currentMembership.freezeReason ? ` · ${member.currentMembership.freezeReason}` : ""}.</p>
                    )}
                    {member.currentMembership.freezeFrom && member.currentMembership.state !== "FROZEN" && (
                      <div className="flex items-center justify-between gap-2 rounded-lg bg-indigo-500/10 px-3 py-2 text-xs text-indigo-800">
                        <span>Se congela del {shortDate(member.currentMembership.freezeFrom)}{member.currentMembership.freezeUntil ? ` al ${shortDate(member.currentMembership.freezeUntil)}` : ""}.</span>
                        <button type="button" className="font-semibold hover:underline" disabled={busy} onClick={() => run(() => gymApi(`/memberships/${member.currentMembership!.id}/unfreeze`, { method: "PATCH" }), "Congelamiento cancelado")}>Quitar</button>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {(member.currentMembership.state === "ACTIVE" || member.currentMembership.state === "SCHEDULED") && !member.currentMembership.freezeFrom && (planOf(member.currentMembership)?.maxFreezeDays ?? 0) > 0 && (
                        <Button size="sm" variant="outline" disabled={busy} className="gap-1.5" onClick={() => { setFreezing((v) => !v); setSelling(false); }}>
                          <IconSnowflake size={14} /> Congelar
                        </Button>
                      )}
                      {member.currentMembership.state === "FROZEN" && (
                        <Button size="sm" variant="outline" disabled={busy} className="gap-1.5" onClick={() => run(() => gymApi(`/memberships/${member.currentMembership!.id}/unfreeze`, { method: "PATCH" }), "Membresía reactivada")}>
                          <IconPlayerPlay size={14} /> Reactivar
                        </Button>
                      )}
                      <Button size="sm" disabled={busy} className="gap-1.5" onClick={() => { setSelling((v) => !v); setFreezing(false); }}>
                        <IconRefresh size={14} /> {member.currentMembership.state === "EXPIRED" || member.currentMembership.state === "CANCELLED" ? "Vender plan" : "Renovar"}
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-muted-foreground">Aún no tiene membresía.</p>
                    <Button size="sm" onClick={() => setSelling(true)}>Vender plan</Button>
                  </div>
                )}
                {freezing && member.currentMembership && (
                  <FreezeForm
                    membership={member.currentMembership}
                    maxDays={planOf(member.currentMembership)?.maxFreezeDays ?? 0}
                    policy={freezePolicy}
                    saving={busy}
                    onCancel={() => setFreezing(false)}
                    onSubmit={(body) => run(async () => { await gymApi(`/memberships/${member.currentMembership!.id}/freeze`, { method: "PATCH", json: body }); setFreezing(false); }, body.from === new Date().toLocaleDateString("en-CA") ? "Membresía congelada" : "Congelamiento programado")}
                  />
                )}
                {selling && (
                  <div className="border-t pt-3">
                    <SellPlanForm
                      memberId={member.id}
                      plans={plans}
                      saving={busy}
                      onSubmit={(body) => run(async () => { const sold = await gymApi<GymMembership>(`/members/${member.id}/memberships`, { method: "POST", json: body }); setSelling(false); setJustSold(sold.id); }, "Membresía registrada")}
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {(() => {
              const sold = justSold && member.memberships.find((m) => m.id === justSold);
              if (!sold) return null;
              return (
                <div className="flex flex-wrap items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
                  <IconCircleCheckFilled size={22} className="shrink-0 text-emerald-600" />
                  <span className="min-w-0 flex-1 text-sm">
                    <span className="block font-semibold">{sold.planName} registrada</span>
                    <span className="block text-xs text-muted-foreground">El pago quedó en tu turno de caja y en contabilidad.</span>
                  </span>
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => printMembershipReceipt(member, sold, settings)}><IconPrinter size={14} /> Imprimir</Button>
                  {member.client.phone && (
                    <Button size="sm" variant="outline" className="gap-1.5 text-emerald-700" disabled={sendingReceipt === sold.id} onClick={() => sendReceipt(sold)}>
                      {sendingReceipt === sold.id ? <IconLoader2 size={14} className="animate-spin" /> : <IconBrandWhatsapp size={14} />} WhatsApp
                    </Button>
                  )}
                </div>
              );
            })()}

            {/* Contact */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-xs text-muted-foreground">WhatsApp</p><p>{member.client.phone ? formatWhatsAppNumber(member.client.phone) : "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">Correo</p><p className="truncate">{member.client.email || "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">Emergencia</p><p>{member.emergencyContact || "—"}{member.emergencyPhone ? ` · ${member.emergencyPhone}` : ""}</p></div>
              <div><p className="text-xs text-muted-foreground">Nacimiento</p><p>{member.birthDate ? shortDate(member.birthDate) : "—"}</p></div>
              {member.goal && <div className="col-span-2"><p className="text-xs text-muted-foreground">Objetivo</p><p>{member.goal}</p></div>}
              {member.medicalNotes && <div className="col-span-2"><p className="text-xs text-muted-foreground">Notas médicas</p><p className="text-rose-700">{member.medicalNotes}</p></div>}
            </div>

            <label className="flex items-center justify-between gap-3 rounded-xl border p-3">
              <span>
                <span className="flex items-center gap-1.5 text-sm font-semibold"><IconBan size={15} /> Permitir acceso</span>
                <span className="block text-xs text-muted-foreground">Apágalo para bloquearle la entrada aunque tenga membresía.</span>
              </span>
              <Switch checked={member.accessEnabled} disabled={busy} onCheckedChange={(v) => run(() => gymApi(`/members/${member.id}`, { method: "PUT", json: { accessEnabled: v } }), v ? "Acceso permitido" : "Acceso bloqueado")} />
            </label>

            {/* Contracts and consents */}
            {docs && docs.documents.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-semibold">Documentos</p>
                {docs.documents.map((d) => (
                  <div key={d.id} className="flex items-center gap-3 rounded-xl border p-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{d.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {d.status === "SIGNED" ? `Firmado el ${shortDate(d.signature!.signedAt)}` : d.status === "OUTDATED" ? `Firmó la versión ${d.signature!.version}; hay una nueva` : d.required ? "Obligatorio, sin firmar" : "Opcional, sin firmar"}
                      </p>
                    </div>
                    {d.signature && <Button size="sm" variant="ghost" onClick={() => setViewing(d.signature!.id)}>Ver</Button>}
                    {d.status !== "SIGNED" && <Button size="sm" variant={d.required ? "default" : "outline"} onClick={() => setSigning(d.id)}>Firmar</Button>}
                  </div>
                ))}
              </div>
            )}
            <SignDocumentDialog memberId={member.id} templateId={signing} onClose={() => setSigning(null)} onSigned={() => { load(); onChanged(); }} />
            <SignedDocumentDialog signatureId={viewing} onClose={() => setViewing(null)} />

            <TrainingSection member={member} />

            {/* History */}
            <div className="space-y-2">
              <p className="text-sm font-semibold">Historial de membresías</p>
              {member.memberships.length === 0 && <p className="text-sm text-muted-foreground">Sin membresías todavía.</p>}
              {member.memberships.map((m) => {
                const balance = balanceOf(m);
                return (
                  <div key={m.id} className="rounded-xl border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{m.planName}</p>
                        <p className="text-xs text-muted-foreground">{shortDate(m.startDate)} – {shortDate(m.endDate)}</p>
                      </div>
                      <StatusBadge status={m.state} />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="text-muted-foreground">
                        {money(membershipTotal(m))}{m.discount > 0 ? ` (desc. ${money(m.discount)})` : ""}{m.feeItems?.length ? ` (incluye ${m.feeItems.map((f) => f.label.toLowerCase()).join(" y ")})` : ""} · pagado {money(paidOf(m))}
                        {(m.payments || []).length > 0 && ` en ${[...new Set((m.payments || []).map((p) => methodLabel(p.method)))].join(", ")}`}
                      </span>
                      <span className="flex gap-1.5">
                        {(m.payments || []).length > 0 && (
                          <>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Imprimir recibo" onClick={() => printMembershipReceipt(member, m, settings)}><IconPrinter size={14} /></Button>
                            {member.client.phone && (
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-emerald-700" title="Enviar recibo por WhatsApp" disabled={sendingReceipt === m.id} onClick={() => sendReceipt(m)}>
                                {sendingReceipt === m.id ? <IconLoader2 size={14} className="animate-spin" /> : <IconBrandWhatsapp size={14} />}
                              </Button>
                            )}
                          </>
                        )}
                        {balance > 0 && m.state !== "CANCELLED" && (
                          <Button size="sm" variant="outline" className="h-7 gap-1 text-xs text-amber-700" onClick={() => { setPayFor(m); setPayAmount(balance.toFixed(2)); }}>
                            <IconCash size={13} /> Debe {money(balance)}
                          </Button>
                        )}
                        {m.state !== "CANCELLED" && m.state !== "EXPIRED" && (
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-rose-600" disabled={busy} onClick={() => confirm(`¿Cancelar la membresía ${m.planName}? El socio pierde el acceso de esa membresía.`) && run(() => gymApi(`/memberships/${m.id}/cancel`, { method: "PATCH" }), "Membresía cancelada")}>
                            Cancelar
                          </Button>
                        )}
                      </span>
                    </div>
                    {payFor?.id === m.id && (
                      <div className="mt-3 flex flex-wrap gap-2 border-t pt-3">
                        <Input type="number" min={0} step="0.01" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} className="h-8 w-28" />
                        <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)} className="h-8 rounded-md border bg-background px-2 text-sm">
                          {PAYMENT_METHODS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                        </select>
                        <Button size="sm" className="h-8" disabled={busy} onClick={() => run(async () => { await gymApi(`/memberships/${m.id}/payments`, { method: "POST", json: { amount: Number(payAmount), method: payMethod, branchId: localStorage.getItem("currentBranchId") || undefined } }); setPayFor(null); }, "Pago registrado")}>Registrar pago</Button>
                        <Button size="sm" variant="ghost" className="h-8" onClick={() => setPayFor(null)}><IconX size={14} /></Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

function MembersPage() {
  const params = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState(params.get("estado") || "");
  const [members, setMembers] = useState<GymMemberRow[] | null>(null);
  const [plans, setPlans] = useState<GymPlan[]>([]);
  const [newOpen, setNewOpen] = useState(params.get("nuevo") === "1");
  const [openId, setOpenId] = useState<string | null>(params.get("socio"));

  // A gym has hundreds to a few thousand members: load them once and filter in the table
  const load = useCallback(() => {
    gymApi<{ items: GymMemberRow[] }>("/members?pageSize=5000").then((d) => setMembers(d.items)).catch((e) => toast.error(e.message));
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { gymApi<GymPlan[]>("/plans").then(setPlans).catch(() => {}); }, []);
  useEffect(() => { if (params.get("nuevo") || params.get("socio") || params.get("estado")) router.replace("/dashboard/gimnasio/socios"); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const isExpiring = (m: GymMemberRow) => m.status === "ACTIVE" && (m.daysLeft ?? 99) <= 7;
  const counts = useMemo(() => {
    const c: Record<string, number> = { "": members?.length ?? 0 };
    for (const [key] of FILTERS) if (key) c[key] = (members ?? []).filter((m) => (key === "expiring" ? isExpiring(m) : m.status === key)).length;
    return c;
  }, [members]);
  const rows = useMemo(() => (members ?? []).filter((m) => !status || (status === "expiring" ? isExpiring(m) : m.status === status)), [members, status]);

  const columns = useMemo<ColumnDef<GymMemberRow>[]>(
    () => [
      {
        id: "member",
        header: "Socio",
        accessorFn: (r) => `${r.client.name} ${r.memberNumber} ${r.client.phone ?? ""}`,
        cell: ({ row }) => <PersonCell src={row.original.photoUrl} name={row.original.client.name} sub={`N.º ${row.original.memberNumber}`} />,
      },
      { id: "documentId", header: "Cédula", accessorFn: (r) => r.client.documentId ?? "", cell: ({ getValue }) => <span className="font-mono text-xs text-muted-foreground">{getValue<string>() || "—"}</span> },
      {
        id: "phone",
        header: "WhatsApp",
        accessorFn: (r) => r.client.phone ?? "",
        cell: ({ getValue }) => <span className="text-sm text-muted-foreground tabular-nums">{getValue<string>() ? formatWhatsAppNumber(getValue<string>()) : "—"}</span>,
      },
      { id: "plan", header: "Plan", accessorFn: (r) => r.currentMembership?.planName ?? "", cell: ({ getValue }) => <span>{getValue<string>() || "—"}</span> },
      {
        id: "end",
        header: "Vence",
        accessorFn: (r) => r.currentMembership?.endDate ?? "",
        cell: ({ row }) => {
          const m = row.original;
          if (!m.currentMembership) return <span className="text-muted-foreground">—</span>;
          return (
            <span className={cn("whitespace-nowrap", isExpiring(m) && "font-semibold text-amber-600")}>
              {shortDate(m.currentMembership.endDate)}
              {m.status === "ACTIVE" && m.daysLeft !== null && <span className="ml-1 text-xs text-muted-foreground">({m.daysLeft} d)</span>}
            </span>
          );
        },
      },
      { id: "status", header: "Estado", accessorFn: (r) => STATUS_LABEL[r.status], cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    ],
    [],
  );

  return (
    <GymPage>
      <GymPageHeader
        title="Socios"
        description="Registro, membresías y acceso de cada socio."
        actions={<Button className="gap-2" onClick={() => setNewOpen(true)}><IconUserPlus size={16} /> Nuevo socio</Button>}
      />

      <StatGrid>
        <StatCard label="Activos" value={counts.ACTIVE ?? "—"} tone="good" title="Con acceso al gimnasio" hint={`${counts[""] ?? 0} socios en total`} onClick={() => setStatus("ACTIVE")} />
        <StatCard label="Vencen esta semana" value={counts.expiring ?? "—"} tone="warn" title="Por renovar" hint="Vencen en 7 días o menos" onClick={() => setStatus("expiring")} />
        <StatCard label="Vencidos" value={counts.EXPIRED ?? "—"} tone={counts.EXPIRED ? "bad" : "default"} title="Sin acceso" hint="Su membresía ya terminó" onClick={() => setStatus("EXPIRED")} />
        <StatCard label="Sin membresía" value={(counts.NONE ?? 0) + (counts.FROZEN ?? 0)} title={`${counts.FROZEN ?? 0} congelados`} hint="Registrados sin plan vigente" onClick={() => setStatus("NONE")} />
      </StatGrid>

      <FilterChips value={status} options={FILTERS} onChange={setStatus} counts={counts} />

      <PosTable
        columns={columns}
        data={rows}
        loading={!members}
        searchPlaceholder="Buscar por nombre, cédula, teléfono o n.º de socio"
        getRowId={(r) => r.id}
        onRowClick={(r) => setOpenId(r.id)}
        emptyMessage={status ? "No hay socios con ese filtro." : "Aún no tienes socios. Registra el primero con el botón de arriba."}
      />

      <NewMemberDialog open={newOpen} onOpenChange={setNewOpen} onCreated={(id) => { load(); setOpenId(id); }} />
      <MemberSheet memberId={openId} plans={plans} onClose={() => setOpenId(null)} onChanged={load} />
    </GymPage>
  );
}

export default function GymMembersPage() {
  return (
    <Suspense fallback={null}>
      <MembersPage />
    </Suspense>
  );
}
