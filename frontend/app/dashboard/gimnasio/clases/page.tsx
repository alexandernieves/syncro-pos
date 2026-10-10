"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  IconAlertTriangle,
  IconClock,
  IconDotsVertical,
  IconMapPin,
  IconBan,
  IconCalendarEvent,
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconLoader2,
  IconPencil,
  IconPlus,
  IconRestore,
  IconSearch,
  IconUser,
  IconUserCheck,
  IconUserX,
  IconX,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { type GymMemberRow, gymApi } from "@/lib/gym";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { ColumnDef } from "@tanstack/react-table";
import { PosTable } from "@/components/pos-table";
import { StatCard, StatGrid } from "@/components/stat-card";
import { GymPage, GymPageHeader, MemberAvatar, PersonCell } from "@/components/gym/gym-ui";
import { type CalendarSession, ClassCalendar } from "@/components/gym/class-calendar";

type Trainer = { id: string; name: string; phone: string | null; specialty: string | null; color: string | null; isActive: boolean; _count?: { classes: number } };
type GymClass = {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  trainerId: string | null;
  trainer: { id: string; name: string } | null;
  daysOfWeek: number[];
  startTime: string;
  durationMin: number;
  capacity: number;
  room: string | null;
  isActive: boolean;
};
type Session = {
  id: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
  status: "SCHEDULED" | "CANCELLED";
  cancelReason: string | null;
  booked: number;
  waitlist: number;
  isExtra?: boolean;
  originalStartsAt?: string | null;
  class: { id: string; name: string; color: string | null; room: string | null; description?: string | null };
  trainer: { id: string; name: string } | null;
};
type Booking = {
  id: string;
  status: "BOOKED" | "WAITLIST" | "ATTENDED" | "NO_SHOW" | "CANCELLED";
  source: string;
  member: { id: string; memberNumber: number; photoUrl: string | null; client: { name: string; phone: string | null } };
};

const COLORS = ["#E4572E", "#2563EB", "#059669", "#7C3AED", "#DB2777", "#D97706", "#0891B2"];
const DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const DAY_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

const pad = (n: number) => String(n).padStart(2, "0");
const upperFirst = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
function mondayOf(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const timeLabel = (iso: string, timeZone?: string) => new Date(iso).toLocaleTimeString("es-VE", { hour: "numeric", minute: "2-digit", timeZone });
function hhmmLabel(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${pad(m)} ${h < 12 ? "a. m." : "p. m."}`;
}

function Avatar({ src, name, size = 32 }: { src?: string | null; name: string; size?: number }) {
  return <MemberAvatar src={src} name={name} size={size} />;
}

function CapacityBar({ booked, capacity, color }: { booked: number; capacity: number; color: string }) {
  const pct = Math.min(100, Math.round((booked / Math.max(1, capacity)) * 100));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: booked >= capacity ? "#E11D48" : color }} />
    </div>
  );
}

/** Class badge: initials on a tile of its color (instead of a colored stripe). */
function ClassMark({ name, color, size = 36 }: { name: string; color: string; size?: number }) {
  const letters = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-xl text-xs font-bold"
      style={{ width: size, height: size, background: `color-mix(in oklab, ${color} 28%, var(--card))`, color: `color-mix(in oklab, ${color} 40%, black)` }}
    >
      {letters}
    </span>
  );
}

/** Three-dot menu for table rows; clicks don't open the row. */
function RowMenu({ items }: { items: { label: string; onClick: () => void }[] }) {
  return (
    <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-8 text-muted-foreground" title="Opciones"><IconDotsVertical size={16} /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {items.map((it) => <DropdownMenuItem key={it.label} onClick={it.onClick}>{it.label}</DropdownMenuItem>)}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// ── Class form ──────────────────────────────────────────────────────────────

type ClassDraft = { id?: string; name: string; description: string; color: string; trainerId: string; daysOfWeek: number[]; startTime: string; durationMin: string; capacity: string; room: string; isActive: boolean };
const emptyClass: ClassDraft = { name: "", description: "", color: COLORS[0], trainerId: "", daysOfWeek: [], startTime: "07:00", durationMin: "60", capacity: "20", room: "", isActive: true };

function ClassDialog({ draft, setDraft, trainers, onSaved }: { draft: ClassDraft | null; setDraft: (d: ClassDraft | null) => void; trainers: Trainer[]; onSaved: () => void }) {
  const [saving, setSaving] = useState(false);
  if (!draft) return null;
  const set = (patch: Partial<ClassDraft>) => setDraft({ ...draft, ...patch });
  const save = async () => {
    setSaving(true);
    try {
      const body = { ...draft, trainerId: draft.trainerId || null, durationMin: Number(draft.durationMin), capacity: Number(draft.capacity) };
      await gymApi(draft.id ? `/classes/${draft.id}` : "/classes", { method: draft.id ? "PUT" : "POST", json: body });
      toast.success(draft.id ? "Clase actualizada" : "Clase creada");
      setDraft(null);
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open onOpenChange={(open) => !open && setDraft(null)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>{draft.id ? "Editar clase" : "Nueva clase"}</DialogTitle></DialogHeader>
        <div className="grid gap-4">
          <div className="space-y-1.5"><Label>Nombre</Label><Input autoFocus value={draft.name} onChange={(e) => set({ name: e.target.value })} placeholder="Spinning" /></div>
          <div className="space-y-1.5">
            <Label>Días</Label>
            <div className="flex flex-wrap gap-1.5">
              {WEEK_ORDER.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => set({ daysOfWeek: draft.daysOfWeek.includes(d) ? draft.daysOfWeek.filter((x) => x !== d) : [...draft.daysOfWeek, d] })}
                  className={cn("h-9 w-12 rounded-lg border text-xs font-semibold", draft.daysOfWeek.includes(d) ? "border-primary bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:text-foreground")}
                >
                  {DAY_SHORT[d]}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5"><Label>Hora</Label><Input type="time" value={draft.startTime} onChange={(e) => set({ startTime: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Minutos</Label><Input type="number" min={10} value={draft.durationMin} onChange={(e) => set({ durationMin: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Cupo</Label><Input type="number" min={1} value={draft.capacity} onChange={(e) => set({ capacity: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Entrenador</Label>
              <select value={draft.trainerId} onChange={(e) => set({ trainerId: e.target.value })} className="h-9 w-full rounded-md border bg-background px-3 text-sm">
                <option value="">Sin asignar</option>
                {trainers.filter((t) => t.isActive || t.id === draft.trainerId).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5"><Label>Sala (opcional)</Label><Input value={draft.room} onChange={(e) => set({ room: e.target.value })} placeholder="Sala 1" /></div>
          </div>
          <div className="space-y-1.5"><Label>Descripción (opcional)</Label><Input value={draft.description} onChange={(e) => set({ description: e.target.value })} placeholder="Clase de alta intensidad en bicicleta" /></div>
          <div className="flex items-center justify-between">
            <div className="flex gap-1.5">
              {COLORS.map((c) => <button key={c} type="button" onClick={() => set({ color: c })} className={cn("size-6 rounded-full ring-1 ring-black/10", draft.color === c && "ring-2 ring-foreground ring-offset-2")} style={{ background: c }} />)}
            </div>
            {draft.id && <label className="flex items-center gap-2 text-sm"><Switch checked={draft.isActive} onCheckedChange={(v) => set({ isActive: v })} /> Activa</label>}
          </div>
          {draft.id && <p className="text-xs text-muted-foreground">Las clases futuras que ya tienen reservas mantienen su hora; las demás se ajustan al nuevo horario.</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setDraft(null)}>Cancelar</Button>
          <Button onClick={save} disabled={saving} className="gap-2">{saving && <IconLoader2 size={16} className="animate-spin" />} Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Trainer form ────────────────────────────────────────────────────────────

type TrainerDraft = { id?: string; name: string; phone: string; specialty: string; color: string; isActive: boolean };

function TrainerDialog({ draft, setDraft, onSaved }: { draft: TrainerDraft | null; setDraft: (d: TrainerDraft | null) => void; onSaved: () => void }) {
  const [saving, setSaving] = useState(false);
  if (!draft) return null;
  const set = (patch: Partial<TrainerDraft>) => setDraft({ ...draft, ...patch });
  const save = async () => {
    setSaving(true);
    try {
      await gymApi(draft.id ? `/trainers/${draft.id}` : "/trainers", { method: draft.id ? "PUT" : "POST", json: draft });
      toast.success(draft.id ? "Entrenador actualizado" : "Entrenador agregado");
      setDraft(null);
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open onOpenChange={(open) => !open && setDraft(null)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{draft.id ? "Editar entrenador" : "Nuevo entrenador"}</DialogTitle></DialogHeader>
        <div className="grid gap-4">
          <div className="space-y-1.5"><Label>Nombre</Label><Input autoFocus value={draft.name} onChange={(e) => set({ name: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Especialidad</Label><Input value={draft.specialty} onChange={(e) => set({ specialty: e.target.value })} placeholder="Spinning, funcional, yoga…" /></div>
          <div className="space-y-1.5"><Label>Teléfono</Label><Input value={draft.phone} onChange={(e) => set({ phone: e.target.value })} inputMode="tel" /></div>
          {draft.id && <label className="flex items-center gap-2 text-sm"><Switch checked={draft.isActive} onCheckedChange={(v) => set({ isActive: v })} /> Activo</label>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setDraft(null)}>Cancelar</Button>
          <Button onClick={save} disabled={saving} className="gap-2">{saving && <IconLoader2 size={16} className="animate-spin" />} Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Session detail ──────────────────────────────────────────────────────────

function SessionSheet({ sessionId, timeZone, onClose, onChanged }: { sessionId: string | null; timeZone?: string; onClose: () => void; onChanged: () => void }) {
  const [session, setSession] = useState<(Session & { bookings: Booking[]; trialLeads?: { id: string; name: string; phone: string | null; stage: string }[] }) | null>(null);
  const [q, setQ] = useState("");
  const [matches, setMatches] = useState<GymMemberRow[]>([]);
  const [busy, setBusy] = useState(false);
  const reqRef = useRef(0);

  const load = useCallback(() => {
    if (!sessionId) return;
    gymApi(`/sessions/${sessionId}`).then(setSession).catch((e) => toast.error(e.message));
  }, [sessionId]);
  useEffect(() => { setSession(null); setQ(""); setMatches([]); load(); }, [load]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setMatches([]); return; }
    const id = ++reqRef.current;
    const t = setTimeout(() => {
      gymApi<{ items: GymMemberRow[] }>(`/members?${new URLSearchParams({ q: term, pageSize: "6" })}`).then((d) => id === reqRef.current && setMatches(d.items)).catch(() => {});
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true);
    try { await fn(); if (ok) toast.success(ok); load(); onChanged(); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  const color = session?.class.color || COLORS[0];
  const ended = session ? new Date(session.endsAt) < new Date() : false;
  const started = session ? new Date(session.startsAt) <= new Date() : false;

  return (
    <Sheet open={!!sessionId} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader><SheetTitle>Detalle de la clase</SheetTitle></SheetHeader>
        {!session ? (
          <div className="space-y-3 p-4"><Skeleton className="h-24" /><Skeleton className="h-40" /></div>
        ) : (
          <div className="space-y-5 px-4 pb-8">
            {/* Header in the class's own tone, like its card on the calendar */}
            <div
              className="space-y-4 rounded-2xl p-5"
              style={{ background: `color-mix(in oklab, ${color} 22%, var(--card))`, color: `color-mix(in oklab, ${color} 42%, black)` }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-2xl font-bold leading-tight">{session.class.name}</p>
                  {session.isExtra && <p className="text-xs font-semibold opacity-75">Sesión especial</p>}
                </div>
                {session.status === "CANCELLED" && <Badge className="shrink-0 border-0 bg-rose-600 text-white">Cancelada</Badge>}
              </div>
              <div className="grid gap-2 text-sm">
                <p className="flex items-center gap-2.5"><IconCalendarEvent size={17} className="shrink-0 opacity-70" />{upperFirst(new Date(session.startsAt).toLocaleDateString("es-VE", { weekday: "long", day: "numeric", month: "long", timeZone }))}</p>
                <p className="flex items-center gap-2.5"><IconClock size={17} className="shrink-0 opacity-70" />{timeLabel(session.startsAt, timeZone)} – {timeLabel(session.endsAt, timeZone)}</p>
                <p className="flex items-center gap-2.5"><IconUser size={17} className="shrink-0 opacity-70" />{session.trainer?.name ?? "Sin entrenador"}</p>
                {session.class.room && <p className="flex items-center gap-2.5"><IconMapPin size={17} className="shrink-0 opacity-70" />{session.class.room}</p>}
              </div>
              {session.cancelReason && <p className="rounded-lg bg-white/50 px-3 py-2 text-sm text-rose-800">{session.cancelReason}</p>}
              <div className="flex items-end justify-between gap-4 rounded-xl bg-white/45 px-4 py-3">
                <div>
                  <p className="text-xs font-medium opacity-75">Cupos</p>
                  <p className="text-xl font-bold tabular-nums">
                    {session.booked} <span className="text-sm font-medium opacity-70">de {session.capacity}</span>
                  </p>
                </div>
                <div className="flex max-w-[60%] flex-wrap justify-end gap-1">
                  {session.capacity <= 30 ? (
                    Array.from({ length: session.capacity }, (_, i) => (
                      <span key={i} className="size-2.5 rounded-full" style={{ background: i < session.booked ? (session.booked >= session.capacity ? "#BE123C" : color) : "rgba(0,0,0,0.12)" }} />
                    ))
                  ) : (
                    <span className="text-sm font-semibold">{session.capacity - session.booked} libres</span>
                  )}
                </div>
              </div>
            </div>

            {session.status === "SCHEDULED" && !ended && (
              <div className="relative">
                <label className="flex h-10 items-center gap-2 rounded-xl border bg-background px-3 focus-within:border-primary/50">
                  <IconSearch size={16} className="text-muted-foreground" />
                  <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={session.booked >= session.capacity ? "Clase llena · anotar en lista de espera" : "Anotar socio: nombre, cédula o n.º"} className="h-full flex-1 bg-transparent text-sm outline-none" />
                </label>
                {matches.length > 0 && (
                  <div className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-xl border bg-popover shadow-lg">
                    {matches.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        disabled={busy}
                        onClick={() => run(async () => {
                          const b = await gymApi<{ status: string }>(`/sessions/${session.id}/bookings`, { method: "POST", json: { memberId: m.id } });
                          setQ(""); setMatches([]);
                          toast.success(b.status === "WAITLIST" ? `Clase llena: ${m.client.name} quedó en lista de espera` : `${m.client.name} anotado en ${session.class.name}`);
                        })}
                        className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted"
                      >
                        <Avatar src={m.photoUrl} name={m.client.name} size={30} />
                        <span className="min-w-0 flex-1 truncate text-sm">{m.client.name}</span>
                        <span className={cn("text-xs", m.status === "ACTIVE" ? "text-emerald-600" : "text-rose-600")}>{m.status === "ACTIVE" ? "Activa" : "Sin membresía vigente"}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <p className="text-sm font-semibold">Anotados ({session.bookings.filter((b) => b.status !== "WAITLIST").length})</p>
              {session.bookings.length === 0 && <p className="rounded-xl bg-muted/50 px-4 py-6 text-center text-sm text-muted-foreground">Nadie se ha anotado todavía.</p>}
              {session.bookings.filter((b) => b.status !== "WAITLIST").map((b) => (
                <div key={b.id} className="flex items-center gap-3 rounded-xl border px-3 py-2">
                  <Avatar src={b.member.photoUrl} name={b.member.client.name} size={34} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{b.member.client.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {b.status === "ATTENDED" ? "Asistió" : b.status === "NO_SHOW" ? "No vino" : b.source === "PORTAL" ? "Reservó desde la app" : "Reservado en recepción"}
                    </p>
                  </div>
                  {started && b.status === "BOOKED" ? (
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" className="h-8 gap-1 text-emerald-700" disabled={busy} onClick={() => run(() => gymApi(`/bookings/${b.id}`, { method: "PATCH", json: { status: "ATTENDED" } }))}><IconUserCheck size={14} /> Asistió</Button>
                      <Button size="sm" variant="outline" className="h-8 gap-1 text-rose-600" disabled={busy} onClick={() => run(() => gymApi(`/bookings/${b.id}`, { method: "PATCH", json: { status: "NO_SHOW" } }))}><IconUserX size={14} /> No vino</Button>
                    </div>
                  ) : b.status === "ATTENDED" ? (
                    <IconCheck size={18} className="text-emerald-600" />
                  ) : b.status === "NO_SHOW" ? (
                    <IconX size={18} className="text-rose-600" />
                  ) : null}
                  {!ended && b.status === "BOOKED" && (
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground" title="Quitar de la clase" disabled={busy} onClick={() => run(async () => {
                      const r = await gymApi<{ promoted: string | null }>(`/bookings/${b.id}`, { method: "PATCH", json: { status: "CANCELLED" } });
                      toast.success(r.promoted ? `Reserva cancelada. ${r.promoted} pasó de la lista de espera a la clase y le avisaremos por WhatsApp` : "Reserva cancelada");
                    })}><IconX size={16} /></Button>
                  )}
                </div>
              ))}
            </div>

            {!!session.trialLeads?.length && (
              <div className="space-y-2">
                <p className="text-sm font-semibold">Clase de prueba ({session.trialLeads.length})</p>
                {session.trialLeads.map((l) => (
                  <a key={l.id} href="/dashboard/gimnasio/prospectos" className="flex items-center gap-3 rounded-lg bg-amber-500/10 px-2 py-1.5 hover:bg-amber-500/15">
                    <Avatar name={l.name} size={30} />
                    <p className="min-w-0 flex-1 truncate text-sm">{l.name}</p>
                    <span className="text-[11px] font-medium text-amber-800">{l.stage === "TRIAL_DONE" ? "Vino" : "Prospecto"}</span>
                  </a>
                ))}
              </div>
            )}

            {session.bookings.some((b) => b.status === "WAITLIST") && (
              <div className="space-y-2">
                <div>
                  <p className="text-sm font-semibold">Lista de espera ({session.bookings.filter((b) => b.status === "WAITLIST").length})</p>
                  <p className="text-xs text-muted-foreground">Si alguien cancela, el primero de la lista pasa a la clase solo.</p>
                </div>
                {session.bookings.filter((b) => b.status === "WAITLIST").map((b, i) => (
                  <div key={b.id} className="flex items-center gap-3 rounded-xl border border-dashed px-3 py-2">
                    <span className="w-5 text-center text-sm font-semibold tabular-nums text-muted-foreground">{i + 1}</span>
                    <Avatar src={b.member.photoUrl} name={b.member.client.name} size={30} />
                    <p className="min-w-0 flex-1 truncate text-sm">{b.member.client.name}</p>
                    {!ended && (
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground" title="Sacar de la lista de espera" disabled={busy} onClick={() => run(() => gymApi(`/bookings/${b.id}`, { method: "PATCH", json: { status: "CANCELLED" } }), "Quitado de la lista de espera")}><IconX size={16} /></Button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {!ended && (
              session.status === "SCHEDULED" ? (
                <Button
                  variant="outline"
                  className="w-full gap-2 text-rose-600"
                  disabled={busy}
                  onClick={() => {
                    const reason = prompt("¿Por qué se cancela la clase? (el motivo lo verán los socios)");
                    if (reason !== null)
                      run(async () => {
                        const r = await gymApi<{ notified: number }>(`/sessions/${session.id}/cancel`, { method: "PATCH", json: { reason } });
                        toast.success("Clase cancelada", { description: r.notified ? `Avisaremos a ${r.notified} ${r.notified === 1 ? "socio" : "socios"} por WhatsApp.` : undefined });
                      });
                  }}
                >
                  <IconBan size={16} /> Cancelar esta clase
                </Button>
              ) : (
                <Button variant="outline" className="w-full gap-2" disabled={busy} onClick={() => run(() => gymApi(`/sessions/${session.id}/restore`, { method: "PATCH" }), "Clase reactivada")}>
                  <IconRestore size={16} /> Reactivar esta clase
                </Button>
              )
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ── Empty slot: weekly class or one-time session ────────────────────────────

function SlotDialog({ slot, classes, onClose, onWeekly, onCreated }: { slot: { start: Date; end: Date } | null; classes: GymClass[]; onClose: () => void; onWeekly: (start: Date, end: Date) => void; onCreated: () => void }) {
  const [classId, setClassId] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (slot) setClassId(classes[0]?.id ?? ""); }, [slot, classes]);
  if (!slot) return null;
  const minutes = Math.max(15, Math.round((slot.end.getTime() - slot.start.getTime()) / 60000));
  const when = `${upperFirst(slot.start.toLocaleDateString("es-VE", { weekday: "long", day: "numeric", month: "long" }))} · ${slot.start.toLocaleTimeString("es-VE", { hour: "numeric", minute: "2-digit" })} (${minutes} min)`;
  const createExtra = async () => {
    setSaving(true);
    try {
      const res = await gymApi<{ warning: string | null }>("/sessions", { method: "POST", json: { classId, startsAt: slot.start.toISOString(), durationMin: minutes } });
      toast.success("Sesión especial creada", { description: res.warning || undefined });
      onCreated();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Agregar en este horario</DialogTitle></DialogHeader>
        <p className="-mt-2 text-sm text-muted-foreground">{when}</p>
        <div className="grid gap-3">
          <div className="space-y-3 rounded-xl border p-4">
            <div>
              <p className="font-semibold">Sesión especial</p>
              <p className="text-sm text-muted-foreground">Una sola vez: una clase de reposición, un evento o un horario extra.</p>
            </div>
            {classes.length ? (
              <div className="flex gap-2">
                <select value={classId} onChange={(e) => setClassId(e.target.value)} className="h-9 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm">
                  {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <Button onClick={createExtra} disabled={saving || !classId} className="gap-2">{saving && <IconLoader2 size={16} className="animate-spin" />} Crear</Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Primero crea una clase.</p>
            )}
          </div>
          <button type="button" onClick={() => onWeekly(slot.start, slot.end)} className="space-y-1 rounded-xl border p-4 text-left transition-colors hover:border-primary/40 hover:bg-muted/40">
            <p className="font-semibold">Clase semanal nueva</p>
            <p className="text-sm text-muted-foreground">Se repite cada {slot.start.toLocaleDateString("es-VE", { weekday: "long" })} a esta hora.</p>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function GymClassesPage() {
  const [tab, setTab] = useState<"schedule" | "classes" | "trainers">("schedule");
  const [range, setRange] = useState<{ from: string; to: string } | null>(null);
  const [slot, setSlot] = useState<{ start: Date; end: Date } | null>(null);
  const [schedule, setSchedule] = useState<{ timeZone: string; sessions: Session[] } | null>(null);
  const [classes, setClasses] = useState<GymClass[] | null>(null);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [classDraft, setClassDraft] = useState<ClassDraft | null>(null);
  const [trainerDraft, setTrainerDraft] = useState<TrainerDraft | null>(null);
  const [openSession, setOpenSession] = useState<string | null>(null);

  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const loadSchedule = useCallback(() => {
    if (!range) return;
    setLoadingSchedule(true);
    gymApi(`/schedule?from=${range.from}&to=${range.to}`)
      .then(setSchedule)
      .catch((e) => toast.error(e.message))
      .finally(() => setLoadingSchedule(false));
  }, [range]);
  const loadClasses = () => gymApi<GymClass[]>("/classes").then(setClasses).catch(() => setClasses([]));
  const loadTrainers = () => gymApi<Trainer[]>("/trainers").then(setTrainers).catch(() => {});

  useEffect(() => { loadSchedule(); }, [loadSchedule]);
  useEffect(() => { loadClasses(); loadTrainers(); }, []);

  // Drag & drop: move only that date, with undo
  const moveSession = async (session: CalendarSession, startsAt: Date, endsAt: Date, revert: () => void) => {
    const before = { startsAt: session.startsAt, endsAt: session.endsAt };
    try {
      const res = await gymApi<{ warning: string | null; notified: number }>(`/sessions/${session.id}/move`, { method: "PATCH", json: { startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() } });
      const when = startsAt.toLocaleString("es-VE", { weekday: "long", hour: "numeric", minute: "2-digit" });
      toast.success(`${session.class.name} pasó al ${when}`, {
        description: [res.warning, res.notified ? `En un minuto avisaremos por WhatsApp a ${res.notified === 1 ? "la persona anotada" : `los ${res.notified} anotados`}. Si deshaces, no se envía.` : null].filter(Boolean).join(" ") || undefined,
        action: {
          label: "Deshacer",
          onClick: () => gymApi(`/sessions/${session.id}/move`, { method: "PATCH", json: before }).then(loadSchedule).catch((e) => toast.error(e.message)),
        },
        duration: 8000,
      });
      loadSchedule();
    } catch (e) {
      revert();
      toast.error((e as Error).message);
    }
  };

  const afterClassChange = () => { loadClasses(); loadSchedule(); };

  // Occupancy and load from the sessions on screen
  const classStats = useMemo(() => {
    const map: Record<string, { sessions: number; booked: number; capacity: number; waitlist: number }> = {};
    for (const x of schedule?.sessions ?? []) {
      if (x.status !== "SCHEDULED") continue;
      const m = (map[x.class.id] ||= { sessions: 0, booked: 0, capacity: 0, waitlist: 0 });
      m.sessions++; m.booked += x.booked; m.capacity += x.capacity; m.waitlist += x.waitlist;
    }
    return map;
  }, [schedule]);
  const trainerSessions = useMemo(() => {
    const map: Record<string, number> = {};
    for (const x of schedule?.sessions ?? []) if (x.status === "SCHEDULED" && x.trainer) map[x.trainer.id] = (map[x.trainer.id] ?? 0) + 1;
    return map;
  }, [schedule]);

  const toggleClass = (c: GymClass) =>
    gymApi(`/classes/${c.id}`, { method: "PUT", json: { isActive: !c.isActive } })
      .then(() => { toast.success(c.isActive ? `${c.name} quedó desactivada` : `${c.name} vuelve al horario`); afterClassChange(); })
      .catch((e) => toast.error(e.message));
  const toggleTrainer = (t: Trainer) =>
    gymApi(`/trainers/${t.id}`, { method: "PUT", json: { isActive: !t.isActive } })
      .then(() => { toast.success(t.isActive ? `${t.name} quedó inactivo` : `${t.name} está activo`); loadTrainers(); })
      .catch((e) => toast.error(e.message));
  const editClass = (c: GymClass) => setClassDraft({ id: c.id, name: c.name, description: c.description || "", color: c.color || COLORS[0], trainerId: c.trainerId || "", daysOfWeek: c.daysOfWeek, startTime: c.startTime, durationMin: String(c.durationMin), capacity: String(c.capacity), room: c.room || "", isActive: c.isActive });
  const editTrainer = (t: Trainer) => setTrainerDraft({ id: t.id, name: t.name, phone: t.phone || "", specialty: t.specialty || "", color: t.color || COLORS[1], isActive: t.isActive });

  const classColumns = useMemo<ColumnDef<GymClass>[]>(
    () => [
      {
        id: "name",
        header: "Clase",
        accessorFn: (c) => `${c.name} ${c.trainer?.name ?? ""} ${c.room ?? ""}`,
        cell: ({ row }) => {
          const c = row.original;
          const color = c.color || COLORS[0];
          return (
            <div className="flex items-center gap-3">
              <ClassMark name={c.name} color={color} />
              <div className="min-w-0">
                <p className="truncate font-medium">{c.name}</p>
                <p className="truncate text-xs text-muted-foreground">{c.room || "Sin sala"}{c.description ? ` · ${c.description}` : ""}</p>
              </div>
            </div>
          );
        },
      },
      {
        id: "trainer",
        header: "Entrenador",
        accessorFn: (c) => c.trainer?.name ?? "",
        cell: ({ row }) => (row.original.trainer ? <PersonCell name={row.original.trainer.name} /> : <span className="text-muted-foreground">Sin asignar</span>),
      },
      {
        id: "days",
        header: "Días y hora",
        accessorFn: (c) => `${c.daysOfWeek.join("")} ${c.startTime}`,
        cell: ({ row }) => {
          const c = row.original;
          const color = c.color || COLORS[0];
          return (
            <div className="space-y-1.5">
              <div className="flex gap-1">
                {WEEK_ORDER.map((d) => {
                  const on = c.daysOfWeek.includes(d);
                  return (
                    <span
                      key={d}
                      className={cn("flex size-6 items-center justify-center rounded-md text-[10px] font-semibold", !on && "bg-muted/60 text-muted-foreground/50")}
                      style={on ? { background: `color-mix(in oklab, ${color} 28%, var(--card))`, color: `color-mix(in oklab, ${color} 42%, black)` } : undefined}
                    >
                      {DAY_SHORT[d].charAt(0)}
                    </span>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground tabular-nums">{hhmmLabel(c.startTime)} · {c.durationMin} min</p>
            </div>
          );
        },
      },
      {
        id: "occupancy",
        header: "Ocupación",
        accessorFn: (c) => {
          const st = classStats[c.id];
          return st && st.capacity ? st.booked / st.capacity : 0;
        },
        cell: ({ row }) => {
          const c = row.original;
          const st = classStats[c.id];
          if (!st || !st.sessions) return <span className="text-xs text-muted-foreground">Sin sesiones en estas fechas</span>;
          const pct = Math.round((st.booked / Math.max(1, st.capacity)) * 100);
          return (
            <div className="w-40 space-y-1">
              <div className="flex items-baseline justify-between text-xs">
                <span className="font-semibold tabular-nums">{pct}%</span>
                <span className="text-muted-foreground">{st.booked}/{st.capacity} · {st.sessions} ses.</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, background: pct >= 90 ? "#BE123C" : c.color || COLORS[0] }} />
              </div>
              {st.waitlist > 0 && <p className="text-[11px] font-medium text-amber-700">{st.waitlist} en lista de espera</p>}
            </div>
          );
        },
      },
      { id: "capacity", header: "Cupo", accessorFn: (c) => c.capacity, cell: ({ getValue }) => <span className="tabular-nums">{getValue<number>()} personas</span> },
      {
        id: "active",
        header: "Estado",
        accessorFn: (c) => (c.isActive ? "Activa" : "Desactivada"),
        cell: ({ row }) => (
          <Badge variant="outline" className={cn("gap-1.5", row.original.isActive ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700" : "text-muted-foreground")}>
            <span className="size-1.5 rounded-full bg-current" /> {row.original.isActive ? "Activa" : "Desactivada"}
          </Badge>
        ),
      },
      {
        id: "actions",
        header: "",
        enableHiding: false,
        cell: ({ row }) => (
          <RowMenu
            items={[
              { label: "Editar clase", onClick: () => editClass(row.original) },
              { label: row.original.isActive ? "Sacar del horario" : "Volver al horario", onClick: () => toggleClass(row.original) },
            ]}
          />
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [classStats],
  );

  const trainerColumns = useMemo<ColumnDef<Trainer>[]>(
    () => [
      { id: "name", header: "Entrenador", accessorFn: (t) => `${t.name} ${t.specialty ?? ""}`, cell: ({ row }) => <PersonCell name={row.original.name} sub={row.original.specialty || "Entrenador"} /> },
      {
        id: "classes",
        header: "Clases que da",
        accessorFn: (t) => (classes ?? []).filter((c) => c.trainerId === t.id).map((c) => c.name).join(" "),
        cell: ({ row }) => {
          const own = (classes ?? []).filter((c) => c.trainerId === row.original.id);
          if (!own.length) return <span className="text-xs text-muted-foreground">Sin clases asignadas</span>;
          return (
            <div className="flex flex-wrap gap-1">
              {own.map((c) => {
                const color = c.color || COLORS[0];
                return (
                  <span key={c.id} className={cn("rounded-full px-2 py-0.5 text-xs font-medium", !c.isActive && "opacity-50")} style={{ background: `color-mix(in oklab, ${color} 24%, var(--card))`, color: `color-mix(in oklab, ${color} 42%, black)` }}>
                    {c.name}
                  </span>
                );
              })}
            </div>
          );
        },
      },
      { id: "load", header: "Sesiones en estas fechas", accessorFn: (t) => trainerSessions[t.id] ?? 0, cell: ({ getValue }) => <span className="tabular-nums">{getValue<number>()}</span> },
      { id: "phone", header: "Teléfono", accessorFn: (t) => t.phone ?? "", cell: ({ getValue }) => <span className="text-muted-foreground tabular-nums">{getValue<string>() || "—"}</span> },
      {
        id: "active",
        header: "Estado",
        accessorFn: (t) => (t.isActive ? "Activo" : "Inactivo"),
        cell: ({ row }) => (
          <Badge variant="outline" className={cn("gap-1.5", row.original.isActive ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700" : "text-muted-foreground")}>
            <span className="size-1.5 rounded-full bg-current" /> {row.original.isActive ? "Activo" : "Inactivo"}
          </Badge>
        ),
      },
      {
        id: "actions",
        header: "",
        enableHiding: false,
        cell: ({ row }) => (
          <RowMenu
            items={[
              { label: "Editar entrenador", onClick: () => editTrainer(row.original) },
              { label: row.original.isActive ? "Marcar inactivo" : "Marcar activo", onClick: () => toggleTrainer(row.original) },
            ]}
          />
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [classes, trainerSessions],
  );

  return (
    <GymPage>
      <GymPageHeader
        title="Clases"
        description="Horario semanal, cupos y reservas de tus socios."
        actions={
          <>
            <Button variant="outline" className="gap-2" onClick={() => setTrainerDraft({ name: "", phone: "", specialty: "", color: COLORS[1], isActive: true })}><IconUser size={16} /> Entrenador</Button>
            <Button className="gap-2" onClick={() => setClassDraft({ ...emptyClass })}><IconPlus size={16} /> Nueva clase</Button>
          </>
        }
      />

      <StatGrid>
        <StatCard label="Clases en pantalla" value={schedule ? schedule.sessions.filter((x) => x.status === "SCHEDULED").length : "—"} icon={<IconCalendarEvent size={20} />} title={`${classes?.filter((c) => c.isActive).length ?? 0} clases en el horario`} hint="Se repiten cada semana" />
        <StatCard label="Reservas" value={schedule ? schedule.sessions.reduce((t, x) => t + x.booked, 0) : "—"} tone="primary" icon={<IconUserCheck size={20} />} title="Lugares ocupados en estas fechas" hint={schedule ? `de ${schedule.sessions.filter((x) => x.status === "SCHEDULED").reduce((t, x) => t + x.capacity, 0)} disponibles` : ""} />
        <StatCard label="Clases llenas" value={schedule ? schedule.sessions.filter((x) => x.status === "SCHEDULED" && x.booked >= x.capacity).length : "—"} tone="warn" icon={<IconAlertTriangle size={20} />} title="Sin cupo disponible" hint="Considera abrir otro horario" />
        <StatCard label="Entrenadores" value={trainers.filter((t) => t.isActive).length} icon={<IconUser size={20} />} title="Activos" hint="Asignados a tus clases" />
      </StatGrid>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="schedule">Horario</TabsTrigger>
          <TabsTrigger value="classes">Clases</TabsTrigger>
          <TabsTrigger value="trainers">Entrenadores</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === "schedule" && (
        classes && classes.length === 0 ? (
          <Card className="gap-0 py-0">
            <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary"><IconCalendarEvent size={24} /></span>
              <p className="font-semibold">Arma tu horario de clases</p>
              <p className="max-w-sm text-sm text-muted-foreground">Crea una clase, elige los días y la hora, y se repite cada semana. Tus socios se anotan con cupo limitado.</p>
              <Button className="mt-2 gap-2" onClick={() => setClassDraft({ ...emptyClass })}><IconPlus size={16} /> Nueva clase</Button>
            </CardContent>
          </Card>
        ) : (
          <ClassCalendar
            sessions={schedule?.sessions ?? []}
            loading={loadingSchedule}
            trainers={trainers.filter((t) => t.isActive)}
            classes={(classes ?? []).filter((c) => c.isActive)}
            onRangeChange={(from, to) => setRange((r) => (r && r.from === isoDay(from) && r.to === isoDay(to) ? r : { from: isoDay(from), to: isoDay(to) }))}
            onOpenSession={setOpenSession}
            onMove={moveSession}
            onSelectSlot={(start, end) => setSlot({ start, end })}
          />
        )
      )}

      {tab === "classes" && (
        <PosTable
          columns={classColumns}
          data={classes ?? []}
          loading={!classes}
          searchPlaceholder="Buscar clase o entrenador…"
          getRowId={(r) => r.id}
          onRowClick={editClass}
          emptyMessage="Aún no tienes clases. Crea la primera con el botón de arriba."
        />
      )}

      {tab === "trainers" && (
        <PosTable
          columns={trainerColumns}
          data={trainers}
          searchPlaceholder="Buscar entrenador…"
          getRowId={(r) => r.id}
          onRowClick={editTrainer}
          emptyMessage="Aún no tienes entrenadores. Agrégalos para asignarlos a tus clases."
        />
      )}

      <SlotDialog
        slot={slot}
        classes={(classes ?? []).filter((c) => c.isActive)}
        onClose={() => setSlot(null)}
        onWeekly={(start, end) => {
          setSlot(null);
          setClassDraft({ ...emptyClass, daysOfWeek: [start.getDay()], startTime: `${pad(start.getHours())}:${pad(start.getMinutes())}`, durationMin: String(Math.max(15, Math.round((end.getTime() - start.getTime()) / 60000))) });
        }}
        onCreated={() => { setSlot(null); loadSchedule(); }}
      />
      <ClassDialog draft={classDraft} setDraft={setClassDraft} trainers={trainers} onSaved={afterClassChange} />
      <TrainerDialog draft={trainerDraft} setDraft={setTrainerDraft} onSaved={() => { loadTrainers(); loadClasses(); }} />
      <SessionSheet sessionId={openSession} timeZone={schedule?.timeZone} onClose={() => setOpenSession(null)} onChanged={loadSchedule} />
    </GymPage>
  );
}
