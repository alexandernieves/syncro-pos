"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import {
  IconBrandWhatsapp,
  IconCalendarEvent,
  IconCalendarPlus,
  IconCheck,
  IconClock,
  IconLayoutKanban,
  IconList,
  IconLoader2,
  IconNote,
  IconPhone,
  IconPlus,
  IconSearch,
  IconTarget,
  IconTrendingUp,
  IconUserCheck,
  IconUserPlus,
  IconX,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { DateField, toDay } from "@/components/forms/date-field";
import { type GymLead, type LeadActivity, type LeadStage, LEAD_SOURCES, LEAD_STAGES, LEAD_STAGE_CLASS, accountCountry, gymApi, leadSourceLabel, leadStageLabel } from "@/lib/gym";
import { formatWhatsAppNumber } from "@/lib/phone-countries";
import { DocumentField, EmailField, Optional, PhoneField } from "@/components/forms/contact-fields";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PosTable } from "@/components/pos-table";
import { StatCard, StatGrid } from "@/components/stat-card";
import { GymPage, GymPageHeader, MemberAvatar, PersonCell } from "@/components/gym/gym-ui";

type Stats = { byStage: Record<LeadStage, number>; newThisMonth: number; wonThisMonth: number; conversion: number | null; overdueFollowUps: number; trialsAhead: number; bySource: { source: string; count: number }[] };
type LeadDetail = GymLead & { activities: LeadActivity[]; visits: { id: string; kind: string; checkedInAt: string; price: number }[] };
type Slot = { id: string; startsAt: string; endsAt: string; capacity: number; booked: number; status: string; class: { name: string; color: string | null }; trainer: { name: string } | null };

const dayTime = (d: string) => new Date(d).toLocaleString("es-VE", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const shortDay = (d: string) => new Date(d).toLocaleDateString("es-VE", { day: "numeric", month: "short" });
const isOverdue = (l: GymLead) => !!l.nextFollowUpAt && ["NEW", "CONTACTED", "TRIAL_SCHEDULED", "TRIAL_DONE"].includes(l.stage) && new Date(l.nextFollowUpAt) < new Date();
const inDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); d.setHours(10, 0, 0, 0); return d.toISOString(); };
const ACTIVITY_ICON: Record<string, React.ReactNode> = {
  CALL: <IconPhone size={14} />,
  WHATSAPP: <IconBrandWhatsapp size={14} />,
  NOTE: <IconNote size={14} />,
  STAGE: <IconTrendingUp size={14} />,
  TRIAL: <IconCalendarEvent size={14} />,
  VISIT: <IconUserCheck size={14} />,
};

function StageBadge({ stage }: { stage: LeadStage }) {
  return <Badge variant="outline" className={cn("whitespace-nowrap", LEAD_STAGE_CLASS[stage])}>{leadStageLabel(stage)}</Badge>;
}

// ── Board ────────────────────────────────────────────────────────────────────

function LeadCard({ lead, onOpen }: { lead: GymLead; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: lead.id, data: { lead } });
  const overdue = isOverdue(lead);
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onOpen}
      style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined}
      className={cn("cursor-grab rounded-xl bg-card p-3 shadow-sm ring-1 ring-border/60 transition-shadow hover:shadow-md active:cursor-grabbing", isDragging && "z-50 rotate-1 shadow-xl")}
    >
      <div className="flex items-start gap-2.5">
        <MemberAvatar name={lead.name} size={32} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{lead.name}</p>
          <p className="truncate text-xs text-muted-foreground">{leadSourceLabel(lead.source)}{lead.interest ? ` · ${lead.interest}` : ""}</p>
        </div>
      </div>
      {(lead.trialSession || lead.nextFollowUpAt) && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {lead.trialSession && lead.stage !== "WON" && (
            <span className="flex items-center gap-1 rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[11px] font-medium text-amber-800">
              <IconCalendarEvent size={12} /> {lead.trialSession.class.name}, {dayTime(lead.trialSession.startsAt)}
            </span>
          )}
          {lead.nextFollowUpAt && !["WON", "LOST"].includes(lead.stage) && (
            <span className={cn("flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium", overdue ? "bg-rose-500/10 text-rose-700" : "bg-muted text-muted-foreground")}>
              <IconClock size={12} /> {overdue ? "Seguimiento vencido" : `Seguir el ${shortDay(lead.nextFollowUpAt)}`}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function StageColumn({ stage, label, leads, onOpen }: { stage: LeadStage; label: string; leads: GymLead[]; onOpen: (l: GymLead) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  return (
    <div ref={setNodeRef} className={cn("flex w-72 shrink-0 flex-col rounded-2xl bg-muted/50 p-2 transition-colors", isOver && "bg-primary/10")}>
      <div className="flex items-center justify-between px-2 pb-2 pt-1">
        <span className="text-sm font-semibold">{label}</span>
        <span className="rounded-full bg-background px-2 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">{leads.length}</span>
      </div>
      <div className="flex min-h-24 flex-col gap-2">
        {leads.map((l) => <LeadCard key={l.id} lead={l} onOpen={() => onOpen(l)} />)}
        {!leads.length && <p className="px-2 py-6 text-center text-xs text-muted-foreground">Arrastra un prospecto aquí</p>}
      </div>
    </div>
  );
}

// ── New / edit ───────────────────────────────────────────────────────────────

function LeadDialog({ lead, open, onClose, onSaved }: { lead: GymLead | null; open: boolean; onClose: () => void; onSaved: (l: GymLead) => void }) {
  const empty = { name: "", phone: "", email: "", documentId: "", source: "", interest: "", notes: "" };
  const [form, setForm] = useState(empty);
  const [valid, setValid] = useState({ phone: true, email: true, documentId: true });
  const [saving, setSaving] = useState(false);
  const [dup, setDup] = useState<{ type: "lead" | "member"; name: string } | null>(null);
  const [country, setCountry] = useState<string | undefined>();
  useEffect(() => {
    if (!open) return;
    setDup(null);
    setCountry(accountCountry());
    setValid({ phone: true, email: true, documentId: true });
    setForm(lead ? { name: lead.name, phone: lead.phone ?? "", email: lead.email ?? "", documentId: lead.documentId ?? "", source: lead.source ?? "", interest: lead.interest ?? "", notes: lead.notes ?? "" } : empty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, lead]);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const field = (k: "phone" | "email" | "documentId") => (st: { value: string; valid: boolean }) => { set(k, st.value); setValid((v) => ({ ...v, [k]: st.valid })); };

  // Warn while typing if the person is already a prospect or a member
  useEffect(() => {
    if (!open) return;
    if (form.phone.replace(/\D/g, "").length < 7 && !form.documentId) { setDup(null); return; }
    const t = setTimeout(() => {
      gymApi<{ duplicate: { type: "lead" | "member"; name: string } | null }>(`/leads/duplicate?${new URLSearchParams({ phone: form.phone, documentId: form.documentId, except: lead?.id ?? "" })}`)
        .then((r) => setDup(r.duplicate ?? null))
        .catch(() => setDup(null));
    }, 350);
    return () => clearTimeout(t);
  }, [form.phone, form.documentId, open, lead]);

  const allValid = valid.phone && valid.email && valid.documentId;
  const hasContact = !!form.phone || !!form.email;
  const save = async () => {
    setSaving(true);
    try {
      const saved = await gymApi<GymLead>(lead ? `/leads/${lead.id}` : "/leads", {
        method: lead ? "PUT" : "POST",
        json: { ...form, phone: form.phone || null, email: form.email || null, documentId: form.documentId || null, source: form.source || null },
      });
      toast.success(lead ? "Prospecto actualizado" : `${saved.name} quedó en tus prospectos`);
      onSaved(saved);
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{lead ? "Editar prospecto" : "Nuevo prospecto"}</DialogTitle>
          <DialogDescription>Alguien interesado en inscribirse. Anota su WhatsApp o su correo para poder contactarlo.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2"><Label>Nombre</Label><Input autoFocus value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Nombre y apellido" /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label>WhatsApp</Label><PhoneField value={form.phone} onChange={field("phone")} accountCountry={country} /></div>
          <div className="space-y-1.5"><Label>Cédula <Optional /></Label><DocumentField value={form.documentId} onChange={field("documentId")} /></div>
          <div className="space-y-1.5">
            <Label>¿Cómo nos conoció? <Optional /></Label>
            <select value={form.source} onChange={(e) => set("source", e.target.value)} className="h-9 w-full rounded-md border bg-background px-2 text-sm">
              <option value="">Sin indicar</option>
              {LEAD_SOURCES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </div>
          <div className="space-y-1.5 sm:col-span-2"><Label>Correo <Optional /></Label><EmailField value={form.email} onChange={field("email")} /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label>Le interesa <Optional /></Label><Input value={form.interest} onChange={(e) => set("interest", e.target.value)} placeholder="Ej.: bajar de peso, crossfit" /></div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Notas <Optional /></Label>
            <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary" placeholder="Horario que prefiere, lesiones, presupuesto…" />
          </div>
        </div>
        {dup && (
          <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-800">
            {dup.type === "member" ? `${dup.name} ya es socio del gimnasio.` : `Ya tienes a ${dup.name} en tus prospectos.`}
          </p>
        )}
        {!hasContact && form.name.trim() && <p className="text-xs text-muted-foreground">Falta un WhatsApp o un correo.</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving || !form.name.trim() || !hasContact || !allValid || (!lead && dup !== null)} className="gap-2">{saving && <IconLoader2 size={16} className="animate-spin" />} {lead ? "Guardar" : "Agregar prospecto"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LostDialog({ lead, onClose, onDone }: { lead: GymLead | null; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => setReason(""), [lead]);
  const REASONS = ["Le pareció caro", "Se inscribió en otro gimnasio", "No le queda cerca", "No tiene tiempo", "No respondió"];
  const save = async () => {
    if (!lead) return;
    setSaving(true);
    try {
      await gymApi(`/leads/${lead.id}`, { method: "PUT", json: { stage: "LOST", lostReason: reason } });
      toast.success(`${lead.name} quedó como perdido`);
      onDone();
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open={!!lead} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>¿Por qué no se inscribió?</DialogTitle>
          <DialogDescription>Saber los motivos te ayuda a ajustar precios y horarios.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-1.5">
          {REASONS.map((r) => (
            <button key={r} type="button" onClick={() => setReason(r)} className={cn("rounded-full border px-3 py-1 text-sm", reason === r ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground")}>{r}</button>
          ))}
        </div>
        <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Otro motivo" />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving || !reason.trim()}>Marcar como perdido</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Upcoming classes with free spots, to book the prospect's trial: pick a day, a class, then confirm. */
function TrialPicker({ lead, onClose, onDone }: { lead: GymLead | null; onClose: () => void; onDone: () => void }) {
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [picked, setPicked] = useState<Slot | null>(null);
  const [busy, setBusy] = useState(false);
  const dayKey = (d: string | Date) => new Date(d).toLocaleDateString("en-CA");
  useEffect(() => {
    if (!lead) return;
    setSlots(null);
    setPicked(null);
    setDay(null);
    const today = new Date();
    const from = today.toLocaleDateString("en-CA");
    const to = new Date(today.getTime() + 14 * 86400000).toLocaleDateString("en-CA");
    gymApi<{ sessions: Slot[] }>(`/schedule?from=${from}&to=${to}`)
      .then((r) => setSlots(r.sessions.filter((s) => s.status === "SCHEDULED" && new Date(s.startsAt) > new Date())))
      .catch(() => setSlots([]));
  }, [lead]);

  const days = useMemo(() => {
    const map = new Map<string, { key: string; date: Date; total: number; free: number }>();
    for (const s of slots ?? []) {
      const k = dayKey(s.startsAt);
      const d = map.get(k) ?? { key: k, date: new Date(s.startsAt), total: 0, free: 0 };
      d.total++;
      if (s.capacity - s.booked > 0) d.free++;
      map.set(k, d);
    }
    return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
  }, [slots]);
  const selectedDay = day ?? days.find((d) => d.free > 0)?.key ?? days[0]?.key ?? null;
  const list = (slots ?? []).filter((s) => dayKey(s.startsAt) === selectedDay);

  const timeParts = (d: string) => {
    const t = new Date(d).toLocaleTimeString("es-VE", { hour: "numeric", minute: "2-digit" });
    const [hm, ...rest] = t.split(/\s/);
    return { hm, ampm: rest.join(" ") };
  };
  const minutes = (s: Slot) => Math.round((new Date(s.endsAt).getTime() - new Date(s.startsAt).getTime()) / 60000);

  const confirm = async () => {
    if (!lead || !picked) return;
    setBusy(true);
    try {
      const r = await gymApi<{ notified: boolean }>(`/leads/${lead.id}/trial`, { method: "POST", json: { sessionId: picked.id } });
      toast.success(`Clase de prueba agendada: ${picked.class.name}, ${dayTime(picked.startsAt)}`, { description: r.notified ? "Le enviamos la confirmación por WhatsApp." : lead.phone ? "No se pudo enviar el WhatsApp de confirmación." : undefined });
      onDone();
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!lead} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogHeader className="space-y-1 px-6 pb-4 pt-6">
          <DialogTitle>Clase de prueba para {lead?.name}</DialogTitle>
          <DialogDescription>Elige el día y la clase. Ocupa un cupo{lead?.phone ? " y le llega la confirmación por WhatsApp." : ". Sin WhatsApp no recibirá confirmación."}</DialogDescription>
        </DialogHeader>

        {!slots ? (
          <div className="flex justify-center py-16"><IconLoader2 className="animate-spin text-muted-foreground" /></div>
        ) : !slots.length ? (
          <p className="px-6 pb-10 pt-4 text-center text-sm text-muted-foreground">No hay clases en las próximas dos semanas.</p>
        ) : (
          <>
            {/* Days */}
            <div className="flex gap-2 overflow-x-auto px-6 pb-4 scrollbar-none">
              {days.map((d) => {
                const active = d.key === selectedDay;
                return (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => { setDay(d.key); setPicked(null); }}
                    className={cn(
                      "flex w-[68px] shrink-0 flex-col items-center rounded-2xl py-2.5 outline-none transition",
                      active ? "bg-primary text-primary-foreground shadow-md shadow-primary/25" : "bg-background text-foreground ring-1 ring-border hover:bg-muted",
                      !d.free && !active && "opacity-50",
                    )}
                  >
                    <span className={cn("text-[11px] font-medium", active ? "text-primary-foreground/80" : "text-muted-foreground")}>{d.date.toLocaleDateString("es-VE", { weekday: "short" }).replace(".", "")}</span>
                    <span className="text-xl font-bold leading-tight tabular-nums">{d.date.getDate()}</span>
                    <span className={cn("text-[10px]", active ? "text-primary-foreground/80" : "text-muted-foreground")}>{d.free ? `${d.free} ${d.free === 1 ? "clase" : "clases"}` : "Llenas"}</span>
                  </button>
                );
              })}
            </div>

            {/* Classes of the day */}
            <div className="max-h-[46vh] space-y-2 overflow-y-auto border-t bg-muted/20 px-6 py-4">
              {list.map((s) => {
                const left = Math.max(0, s.capacity - s.booked);
                const full = left === 0;
                const color = s.class.color || "#F97316";
                const { hm, ampm } = timeParts(s.startsAt);
                const isPicked = picked?.id === s.id;
                const pct = Math.min(100, Math.round((s.booked / Math.max(1, s.capacity)) * 100));
                return (
                  <button
                    key={s.id}
                    type="button"
                    disabled={full || busy}
                    onClick={() => setPicked(s)}
                    className={cn(
                      "flex w-full items-center gap-4 rounded-2xl bg-card p-3 text-left shadow-sm outline-none ring-1 transition",
                      isPicked ? "ring-2 ring-primary" : "ring-border/60 hover:ring-border",
                      full && "cursor-not-allowed opacity-55",
                    )}
                  >
                    <span className="flex w-16 shrink-0 flex-col items-center justify-center rounded-xl py-2" style={{ background: `color-mix(in oklab, ${color} 24%, var(--card))`, color: `color-mix(in oklab, ${color} 45%, black)` }}>
                      <span className="text-base font-bold leading-none tabular-nums">{hm}</span>
                      <span className="mt-0.5 text-[10px] font-semibold">{ampm}</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{s.class.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{s.trainer?.name ?? "Sin entrenador"} · {minutes(s)} min</span>
                      <span className="mt-2 flex items-center gap-2">
                        <span className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                          <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: full ? "#E11D48" : color }} />
                        </span>
                        <span className={cn("text-[11px] font-medium", full ? "text-rose-600" : left <= 2 ? "text-amber-700" : "text-muted-foreground")}>
                          {full ? "Llena" : `${left} ${left === 1 ? "cupo libre" : "cupos libres"} de ${s.capacity}`}
                        </span>
                      </span>
                    </span>
                    <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition", isPicked ? "border-primary bg-primary text-primary-foreground" : "border-border")}>
                      {isPicked && <IconCheck size={14} />}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Confirm */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t px-6 py-4">
              <p className="min-w-0 text-sm">
                {picked ? (
                  <>
                    <span className="font-semibold">{picked.class.name}</span>
                    <span className="text-muted-foreground"> · {new Date(picked.startsAt).toLocaleString("es-VE", { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" })}</span>
                  </>
                ) : (
                  <span className="text-muted-foreground">Elige una clase</span>
                )}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={onClose}>Cancelar</Button>
                <Button onClick={confirm} disabled={!picked || busy} className="gap-2">{busy && <IconLoader2 size={16} className="animate-spin" />} Agendar prueba</Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Lead sheet ───────────────────────────────────────────────────────────────

function LeadSheet({ leadId, version, onClose, onChanged, onEdit, onLost, onTrial }: { leadId: string | null; version: number; onClose: () => void; onChanged: () => void; onEdit: (l: GymLead) => void; onLost: (l: GymLead) => void; onTrial: (l: GymLead) => void }) {
  const router = useRouter();
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [note, setNote] = useState("");
  const [noteType, setNoteType] = useState<"NOTE" | "CALL" | "WHATSAPP">("CALL");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => { if (leadId) gymApi<LeadDetail>(`/leads/${leadId}`).then(setLead).catch((e) => toast.error(e.message)); }, [leadId]);
  useEffect(() => { setLead(null); setNote(""); setMsg(""); }, [leadId]);
  useEffect(() => { load(); }, [load, version]);

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true);
    try { await fn(); if (ok) toast.success(ok); load(); onChanged(); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };
  const open = lead && !["WON", "LOST"].includes(lead.stage);

  return (
    <Sheet open={!!leadId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-md">
        <SheetHeader className="border-b p-5">
          <SheetTitle className="sr-only">Prospecto</SheetTitle>
          {lead ? (
            <div className="flex items-start gap-3">
              <MemberAvatar name={lead.name} size={48} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-bold">{lead.name}</p>
                <p className="text-sm text-muted-foreground">{leadSourceLabel(lead.source)} · desde el {shortDay(lead.createdAt)}</p>
                <div className="mt-1.5"><StageBadge stage={lead.stage} /></div>
              </div>
              <Button size="sm" variant="ghost" className="mr-6" onClick={() => onEdit(lead)}>Editar</Button>
            </div>
          ) : (
            <div className="h-14 animate-pulse rounded-lg bg-muted" />
          )}
        </SheetHeader>

        {lead && (
          <div className="space-y-5 p-5">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-xs text-muted-foreground">WhatsApp</p><p>{lead.phone ? formatWhatsAppNumber(lead.phone) : "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">Cédula</p><p>{lead.documentId || "—"}</p></div>
              <div className="col-span-2"><p className="text-xs text-muted-foreground">Le interesa</p><p>{lead.interest || "—"}</p></div>
              {lead.notes && <div className="col-span-2"><p className="text-xs text-muted-foreground">Notas</p><p className="whitespace-pre-wrap">{lead.notes}</p></div>}
              {lead.lostReason && <div className="col-span-2"><p className="text-xs text-muted-foreground">Motivo de pérdida</p><p>{lead.lostReason}</p></div>}
            </div>

            {lead.trialSession && lead.stage !== "WON" && (
              <div className="rounded-xl bg-amber-500/10 p-3">
                <p className="text-xs font-medium text-amber-800">Clase de prueba</p>
                <p className="font-semibold">{lead.trialSession.class.name}, {dayTime(lead.trialSession.startsAt)}</p>
                {lead.stage === "TRIAL_SCHEDULED" && (
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" className="gap-1.5" disabled={busy} onClick={() => run(() => gymApi(`/leads/${lead.id}/trial-result`, { method: "POST", json: { attended: true } }), "Marcado: vino a la prueba")}><IconCheck size={14} /> Vino</Button>
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => gymApi(`/leads/${lead.id}/trial-result`, { method: "POST", json: { attended: false } }), "Marcado: no vino. Se liberó el cupo")}>No vino</Button>
                    <Button size="sm" variant="ghost" disabled={busy} onClick={() => onTrial(lead)}>Cambiar</Button>
                  </div>
                )}
              </div>
            )}

            {open && (
              <div className="grid grid-cols-2 gap-2">
                <Button className="col-span-2 gap-2" disabled={busy} onClick={() => run(async () => { const r = await gymApi<{ memberId: string }>(`/leads/${lead.id}/convert`, { method: "POST" }); router.push(`/dashboard/gimnasio/socios?socio=${r.memberId}`); }, `${lead.name} ya es socio. Véndele su plan`)}>
                  <IconUserPlus size={16} /> Convertir en socio
                </Button>
                {lead.stage !== "TRIAL_SCHEDULED" && <Button variant="outline" className="gap-2" onClick={() => onTrial(lead)}><IconCalendarPlus size={16} /> Clase de prueba</Button>}
                <Button variant="outline" className={cn("gap-2 text-rose-600", lead.stage === "TRIAL_SCHEDULED" && "col-span-2")} onClick={() => onLost(lead)}><IconX size={16} /> Se perdió</Button>
              </div>
            )}
            {lead.stage === "WON" && lead.member && (
              <Button variant="outline" className="w-full" onClick={() => router.push(`/dashboard/gimnasio/socios?socio=${lead.member!.id}`)}>Ver ficha del socio n.º {lead.member.memberNumber}</Button>
            )}
            {lead.stage === "LOST" && (
              <Button variant="outline" className="w-full" disabled={busy} onClick={() => run(() => gymApi(`/leads/${lead.id}`, { method: "PUT", json: { stage: "CONTACTED", nextFollowUpAt: inDays(1) } }), "Prospecto reabierto")}>Reabrir prospecto</Button>
            )}

            {open && (
              <div className="space-y-2">
                <p className="text-sm font-semibold">Próximo seguimiento</p>
                <div className="flex flex-wrap gap-1.5">
                  {[["Mañana", 1], ["En 3 días", 3], ["En una semana", 7]].map(([label, n]) => (
                    <button key={label} type="button" onClick={() => run(() => gymApi(`/leads/${lead.id}`, { method: "PUT", json: { nextFollowUpAt: inDays(n as number) } }), `Seguimiento: ${String(label).toLowerCase()}`)} className="rounded-full border px-3 py-1 text-xs text-muted-foreground hover:text-foreground">{label}</button>
                  ))}
                  <DateField size="sm" className="w-auto" value={lead.nextFollowUpAt ? toDay(new Date(lead.nextFollowUpAt)) : ""} min={toDay(new Date())} placeholder="Otra fecha" onChange={(v) => v && run(() => gymApi(`/leads/${lead.id}`, { method: "PUT", json: { nextFollowUpAt: new Date(`${v}T10:00:00`).toISOString() } }), "Seguimiento programado")} />
                </div>
                {lead.nextFollowUpAt && <p className={cn("text-xs", isOverdue(lead) ? "font-medium text-rose-600" : "text-muted-foreground")}>{isOverdue(lead) ? "Vencido desde el" : "Programado para el"} {dayTime(lead.nextFollowUpAt)}</p>}
              </div>
            )}

            {lead.phone && open && (
              <div className="space-y-2">
                <p className="text-sm font-semibold">Escribirle por WhatsApp</p>
                <textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={2} placeholder={`Hola ${lead.name.split(" ")[0]}, …`} className="w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
                <Button size="sm" className="gap-1.5" disabled={busy || !msg.trim()} onClick={() => run(async () => { await gymApi(`/leads/${lead.id}/message`, { method: "POST", json: { text: msg } }); setMsg(""); }, "Mensaje enviado")}><IconBrandWhatsapp size={14} /> Enviar</Button>
              </div>
            )}

            <div className="space-y-2">
              <p className="text-sm font-semibold">Anotar contacto</p>
              <div className="flex gap-1.5">
                {([["CALL", "Llamada"], ["WHATSAPP", "WhatsApp"], ["NOTE", "Nota"]] as const).map(([k, l]) => (
                  <button key={k} type="button" onClick={() => setNoteType(k)} className={cn("rounded-full border px-3 py-1 text-xs", noteType === k ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground")}>{l}</button>
                ))}
              </div>
              <div className="flex gap-2">
                <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Qué hablaron" onKeyDown={(e) => e.key === "Enter" && note.trim() && run(async () => { await gymApi(`/leads/${lead.id}/activities`, { method: "POST", json: { type: noteType, text: note } }); setNote(""); })} />
                <Button variant="outline" disabled={busy || !note.trim()} onClick={() => run(async () => { await gymApi(`/leads/${lead.id}/activities`, { method: "POST", json: { type: noteType, text: note } }); setNote(""); })}>Anotar</Button>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-semibold">Historial</p>
              <ol className="relative space-y-3 border-s border-border/70 ps-5">
                {lead.activities.map((a) => (
                  <li key={a.id}>
                    <span className="absolute -start-[11px] flex size-[22px] items-center justify-center rounded-full bg-background text-muted-foreground ring-1 ring-border">{ACTIVITY_ICON[a.type] ?? <IconNote size={14} />}</span>
                    <p className="text-sm">{a.text}</p>
                    <p className="text-xs text-muted-foreground">{dayTime(a.createdAt)}{a.userName ? ` · ${a.userName}` : ""}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function GymLeadsPage() {
  const [leads, setLeads] = useState<GymLead[] | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [view, setView] = useState<"board" | "list">("board");
  const [q, setQ] = useState("");
  const [source, setSource] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [editing, setEditing] = useState<GymLead | null>(null);
  const [creating, setCreating] = useState(false);
  const [losing, setLosing] = useState<GymLead | null>(null);
  const [trialFor, setTrialFor] = useState<GymLead | null>(null);
  const [version, setVersion] = useState(0);
  const refresh = () => { load(); setVersion((v) => v + 1); };
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const load = useCallback(() => {
    gymApi<GymLead[]>(`/leads?${new URLSearchParams({ ...(source && { source }) })}`).then(setLeads).catch((e) => toast.error(e.message));
    gymApi<Stats>("/leads/stats").then(setStats).catch(() => {});
  }, [source]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    try { if (localStorage.getItem("gym-leads-view") === "list") setView("list"); } catch {}
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return leads ?? [];
    return (leads ?? []).filter((l) => `${l.name} ${l.phone ?? ""} ${l.email ?? ""} ${l.interest ?? ""}`.toLowerCase().includes(term));
  }, [leads, q]);

  const onDragEnd = async ({ active, over }: DragEndEvent) => {
    const lead = active.data.current?.lead as GymLead | undefined;
    const stage = over?.id as LeadStage | undefined;
    if (!lead || !stage || stage === lead.stage) return;
    if (stage === "LOST") return setLosing(lead);
    if (stage === "TRIAL_SCHEDULED") return setTrialFor(lead);
    if (stage === "WON") return setOpenId(lead.id);
    setLeads((ls) => ls?.map((l) => (l.id === lead.id ? { ...l, stage } : l)) ?? ls);
    try {
      await gymApi(`/leads/${lead.id}`, { method: "PUT", json: { stage } });
      toast.success(`${lead.name}: ${leadStageLabel(stage).toLowerCase()}`);
    } catch (e) {
      toast.error((e as Error).message);
    }
    load();
  };

  const columns = useMemo<ColumnDef<GymLead>[]>(
    () => [
      { id: "name", header: "Prospecto", accessorFn: (l) => `${l.name} ${l.phone ?? ""}`, cell: ({ row }) => <PersonCell name={row.original.name} sub={row.original.phone ? formatWhatsAppNumber(row.original.phone) : row.original.email ?? ""} /> },
      { id: "stage", header: "Etapa", accessorFn: (l) => leadStageLabel(l.stage), cell: ({ row }) => <StageBadge stage={row.original.stage} /> },
      { id: "source", header: "Origen", accessorFn: (l) => leadSourceLabel(l.source), cell: ({ getValue }) => <span className="text-muted-foreground">{getValue<string>()}</span> },
      { id: "interest", header: "Le interesa", accessorFn: (l) => l.interest ?? "", cell: ({ getValue }) => <span>{getValue<string>() || "—"}</span> },
      {
        id: "follow",
        header: "Seguimiento",
        accessorFn: (l) => l.nextFollowUpAt ?? "",
        cell: ({ row }) => {
          const l = row.original;
          if (!l.nextFollowUpAt || ["WON", "LOST"].includes(l.stage)) return <span className="text-muted-foreground">—</span>;
          return <span className={cn("tabular-nums", isOverdue(l) ? "font-medium text-rose-600" : "")}>{isOverdue(l) ? "Vencido · " : ""}{shortDay(l.nextFollowUpAt)}</span>;
        },
      },
      { id: "created", header: "Desde", accessorFn: (l) => l.createdAt, cell: ({ getValue }) => <span className="text-muted-foreground tabular-nums">{shortDay(getValue<string>())}</span> },
    ],
    [],
  );

  const topSource = stats?.bySource[0];

  return (
    <GymPage>
      <GymPageHeader
        title="Prospectos"
        description="Personas interesadas: dales seguimiento, agenda su clase de prueba e inscríbelas."
        actions={<Button className="gap-2" onClick={() => setCreating(true)}><IconPlus size={16} /> Nuevo prospecto</Button>}
      />
      <StatGrid>
        <StatCard label="Nuevos este mes" value={stats?.newThisMonth ?? "—"} icon={<IconUserPlus size={20} />} title={topSource ? `Origen principal: ${leadSourceLabel(topSource.source)}` : "Registra a quien pregunte"} hint="Últimos 90 días por origen" />
        <StatCard label="Pruebas agendadas" value={stats?.trialsAhead ?? "—"} icon={<IconCalendarEvent size={20} />} tone="primary" title="Clases de prueba por venir" hint="Ocupan cupo en la clase" />
        <StatCard label="Conversión" value={stats?.conversion == null ? "—" : `${stats.conversion}%`} icon={<IconTarget size={20} />} tone="good" title={`${stats?.wonThisMonth ?? 0} inscritos este mes`} hint="Inscritos entre cerrados, 90 días" />
        <StatCard label="Seguimientos vencidos" value={stats?.overdueFollowUps ?? "—"} icon={<IconClock size={20} />} tone={stats?.overdueFollowUps ? "bad" : "default"} title={stats?.overdueFollowUps ? "Escríbeles hoy" : "Al día"} hint="Prospectos abiertos con fecha pasada" />
      </StatGrid>

      <div className="flex flex-wrap items-center gap-2">
        <Tabs value={view} onValueChange={(v) => { setView(v as "board" | "list"); try { localStorage.setItem("gym-leads-view", v); } catch {} }}>
          <TabsList>
            <TabsTrigger value="board" className="gap-1.5"><IconLayoutKanban size={16} /> Tablero</TabsTrigger>
            <TabsTrigger value="list" className="gap-1.5"><IconList size={16} /> Lista</TabsTrigger>
          </TabsList>
        </Tabs>
        {view === "board" && (
          <label className="relative min-w-56 flex-1 sm:max-w-xs">
            <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar prospecto…" className="pl-9" />
          </label>
        )}
        <select value={source} onChange={(e) => setSource(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm">
          <option value="">Todos los orígenes</option>
          {LEAD_SOURCES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </div>

      {view === "board" ? (
        !leads ? (
          <div className="flex gap-3 overflow-hidden">{LEAD_STAGES.map(([k]) => <div key={k} className="h-72 w-72 shrink-0 animate-pulse rounded-2xl bg-muted/60" />)}</div>
        ) : (
          <DndContext sensors={sensors} onDragEnd={onDragEnd}>
            <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-4 lg:-mx-6 lg:px-6">
              {LEAD_STAGES.map(([stage, label]) => (
                <StageColumn key={stage} stage={stage} label={label} leads={filtered.filter((l) => l.stage === stage)} onOpen={(l) => setOpenId(l.id)} />
              ))}
            </div>
          </DndContext>
        )
      ) : (
        <PosTable columns={columns} data={leads ?? []} loading={!leads} searchPlaceholder="Buscar prospecto…" getRowId={(l) => l.id} onRowClick={(l) => setOpenId(l.id)} emptyMessage="Todavía no tienes prospectos." />
      )}

      <LeadDialog lead={editing} open={creating || !!editing} onClose={() => { setCreating(false); setEditing(null); }} onSaved={(l) => { refresh(); if (!editing) setOpenId(l.id); }} />
      <LeadSheet leadId={openId} version={version} onClose={() => setOpenId(null)} onChanged={load} onEdit={(l) => setEditing(l)} onLost={(l) => setLosing(l)} onTrial={(l) => setTrialFor(l)} />
      <LostDialog lead={losing} onClose={() => setLosing(null)} onDone={refresh} />
      <TrialPicker lead={trialFor} onClose={() => setTrialFor(null)} onDone={refresh} />
    </GymPage>
  );
}
