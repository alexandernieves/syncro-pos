"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import esLocale from "@fullcalendar/core/locales/es";
import type { DatesSetArg, EventContentArg, EventDropArg } from "@fullcalendar/core";
import type { EventResizeDoneArg } from "@fullcalendar/interaction";
import {
  IconAlertTriangle,
  IconCalendarTime,
  IconChevronLeft,
  IconChevronRight,
  IconClockHour4,
  IconCopy,
  IconLoader2,
  IconPlus,
  IconTrash,
  IconUsers,
  IconWallet,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { DateField, FUTURE_PRESETS } from "@/components/forms/date-field";
import { STAFF_ROLES, accountCountry, gymApi, money, staffRoleLabel } from "@/lib/gym";
import { Optional, PhoneField } from "@/components/forms/contact-fields";
import { countryFromAccount, formatWhatsAppNumber, toWhatsAppNumber } from "@/lib/phone-countries";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PosTable } from "@/components/pos-table";
import { StatCard, StatGrid } from "@/components/stat-card";
import { GymPage, GymPageHeader, PersonCell } from "@/components/gym/gym-ui";
import { CALENDAR_CSS } from "@/components/gym/class-calendar";

const VE = countryFromAccount("Venezuela");
const COLORS = ["#E4572E", "#2563EB", "#059669", "#7C3AED", "#DB2777", "#D97706", "#0891B2"];
const DAYS: [number, string][] = [[1, "Lunes"], [2, "Martes"], [3, "Miércoles"], [4, "Jueves"], [5, "Viernes"], [6, "Sábado"], [0, "Domingo"]];
const AREAS = ["Recepción", "Piso", "Clases", "Limpieza", "Administración"];

type Availability = { dayOfWeek: number; startTime: string; endTime: string };
type Staff = { id: string; name: string; phone: string | null; specialty: string | null; color: string | null; role: string; hourlyRate: number | null; isActive: boolean; _count: { classes: number }; availability: Availability[] };
type Shift = { id: string; staffId: string; startsAt: string; endsAt: string; area: string | null; notes: string | null; status: "SCHEDULED" | "DONE" | "ABSENT"; clockInAt: string | null; clockOutAt: string | null; staff: { id: string; name: string; color: string | null; role: string; hourlyRate: number | null } };
type ShiftsResponse = { shifts: Shift[]; uncovered: { sessionId: string; startsAt: string; endsAt: string; className: string; trainerId: string; trainerName: string }[]; totals: { staffId: string; name: string; hours: number; cost: number | null; shifts: number }[] };

const time = (d: string | Date) => new Date(d).toLocaleTimeString("es-VE", { hour: "numeric", minute: "2-digit" });
const dayTime = (d: string) => new Date(d).toLocaleString("es-VE", { weekday: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const pad = (n: number) => String(n).padStart(2, "0");
const localInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hhmm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
/** "4 h", "3 h 30 min", or that it ends the next day. */
function shiftLength(start: string, end: string) {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return "";
  let mins = eh * 60 + em - (sh * 60 + sm);
  const overnight = mins <= 0;
  if (overnight) mins += 24 * 60;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `Duración: ${h ? `${h} h` : ""}${h && m ? " " : ""}${m ? `${m} min` : ""}${overnight ? " · termina al día siguiente" : ""}`;
}
const mondayOf = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };

function availabilitySummary(rows: Availability[]) {
  if (!rows.length) return "Sin indicar";
  const byRange = new Map<string, number[]>();
  for (const r of rows) byRange.set(`${r.startTime}-${r.endTime}`, [...(byRange.get(`${r.startTime}-${r.endTime}`) ?? []), r.dayOfWeek]);
  const short = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  return [...byRange.entries()].map(([range, days]) => `${days.sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((d) => short[d]).join(", ")} ${range.replace("-", "–")}`).join(" · ");
}

// ── Staff dialog (data + weekly availability) ────────────────────────────────

function StaffDialog({ staff, open, onClose, onSaved }: { staff: Staff | null; open: boolean; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: "", phone: "", role: "TRAINER", specialty: "", hourlyRate: "", color: COLORS[1], isActive: true });
  const [avail, setAvail] = useState<Record<number, { on: boolean; start: string; end: string }>>({});
  const [saving, setSaving] = useState(false);
  const [phoneOk, setPhoneOk] = useState(true);
  useEffect(() => {
    if (!open) return;
    setPhoneOk(true);
    setForm(staff ? { name: staff.name, phone: staff.phone ?? "", role: staff.role, specialty: staff.specialty ?? "", hourlyRate: staff.hourlyRate ? String(staff.hourlyRate) : "", color: staff.color || COLORS[1], isActive: staff.isActive } : { name: "", phone: "", role: "TRAINER", specialty: "", hourlyRate: "", color: COLORS[Math.floor(Math.random() * COLORS.length)], isActive: true });
    const next: Record<number, { on: boolean; start: string; end: string }> = {};
    for (const [d] of DAYS) {
      const row = staff?.availability.find((a) => a.dayOfWeek === d);
      next[d] = row ? { on: true, start: row.startTime, end: row.endTime } : { on: false, start: "08:00", end: "16:00" };
    }
    setAvail(next);
  }, [open, staff]);
  const set = (k: keyof typeof form, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      const body = { ...form, phone: form.phone, hourlyRate: form.hourlyRate ? Number(form.hourlyRate) : null };
      const saved = await gymApi<{ id: string }>(staff ? `/trainers/${staff.id}` : "/trainers", { method: staff ? "PUT" : "POST", json: body });
      const rows = DAYS.filter(([d]) => avail[d]?.on).map(([d]) => ({ dayOfWeek: d, startTime: avail[d].start, endTime: avail[d].end }));
      await gymApi(`/trainers/${saved.id}/availability`, { method: "PUT", json: { rows } });
      toast.success(staff ? "Datos guardados" : `${form.name} quedó en tu personal`);
      onSaved();
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{staff ? `Editar a ${staff.name}` : "Nueva persona"}</DialogTitle>
          <DialogDescription>Entrenadores, recepción y el resto del equipo. Los entrenadores aparecen al crear clases.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2"><Label>Nombre</Label><Input autoFocus value={form.name} onChange={(e) => set("name", e.target.value)} /></div>
          <div className="space-y-1.5">
            <Label>Rol</Label>
            <select value={form.role} onChange={(e) => set("role", e.target.value)} className="h-9 w-full rounded-md border bg-background px-2 text-sm">
              {STAFF_ROLES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </div>
          <div className="space-y-1.5"><Label>WhatsApp <Optional /></Label><PhoneField value={form.phone} onChange={(st) => { set("phone", st.value); setPhoneOk(st.valid); }} accountCountry={accountCountry()} /></div>
          <div className="space-y-1.5"><Label>{form.role === "TRAINER" ? "Especialidad" : "Descripción"}</Label><Input value={form.specialty} onChange={(e) => set("specialty", e.target.value)} placeholder={form.role === "TRAINER" ? "Ej.: funcional, yoga" : "Opcional"} /></div>
          <div className="space-y-1.5"><Label>Pago por hora</Label><Input value={form.hourlyRate} onChange={(e) => set("hourlyRate", e.target.value.replace(/[^\d.]/g, ""))} placeholder="Opcional, en $" inputMode="decimal" /></div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Color en el calendario</Label>
            <div className="flex gap-2">
              {COLORS.map((c) => <button key={c} type="button" onClick={() => set("color", c)} className={cn("size-7 rounded-full transition", form.color === c && "ring-2 ring-offset-2 ring-offset-background")} style={{ background: c, ["--tw-ring-color" as string]: c }} title={c} />)}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold">Disponibilidad semanal</p>
          <p className="text-xs text-muted-foreground">Te avisamos si le asignas un turno fuera de estos horarios.</p>
          <div className="divide-y rounded-xl border">
            {DAYS.map(([d, label]) => {
              const a = avail[d] ?? { on: false, start: "08:00", end: "16:00" };
              return (
                <div key={d} className="flex items-center gap-3 px-3 py-2">
                  <Switch checked={a.on} onCheckedChange={(on) => setAvail((x) => ({ ...x, [d]: { ...a, on } }))} />
                  <span className={cn("w-24 text-sm", !a.on && "text-muted-foreground")}>{label}</span>
                  {a.on ? (
                    <div className="flex items-center gap-2 text-sm">
                      <Input type="time" value={a.start} onChange={(e) => setAvail((x) => ({ ...x, [d]: { ...a, start: e.target.value } }))} className="h-8 w-28" />
                      a
                      <Input type="time" value={a.end} onChange={(e) => setAvail((x) => ({ ...x, [d]: { ...a, end: e.target.value } }))} className="h-8 w-28" />
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">No disponible</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        {staff && (
          <label className="flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2 text-sm">
            Activo en el equipo
            <Switch checked={form.isActive} onCheckedChange={(v) => set("isActive", v)} />
          </label>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving || !form.name.trim() || !phoneOk} className="gap-2">{saving && <IconLoader2 size={16} className="animate-spin" />} Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Shift dialog ─────────────────────────────────────────────────────────────

type ShiftDraft = { id?: string; staffId: string; day: string; start: string; end: string; area: string; notes: string; shift?: Shift };

function ShiftDialog({ draft, staff, onClose, onSaved }: { draft: ShiftDraft | null; staff: Staff[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<ShiftDraft | null>(draft);
  const [saving, setSaving] = useState(false);
  useEffect(() => setForm(draft), [draft]);
  if (!form) return null;
  const set = (k: keyof ShiftDraft, v: string) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const s = form.shift;
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setSaving(true);
    try { await fn(); toast.success(ok); onSaved(); onClose(); } catch (e) { toast.error((e as Error).message); } finally { setSaving(false); }
  };
  const save = () =>
    run(async () => {
      const startsAt = new Date(`${form.day}T${form.start}:00`);
      let endsAt = new Date(`${form.day}T${form.end}:00`);
      if (endsAt <= startsAt) endsAt = new Date(endsAt.getTime() + 86400000); // overnight
      const res = await gymApi<{ warning: string | null }>(form.id ? `/shifts/${form.id}` : "/shifts", { method: form.id ? "PUT" : "POST", json: { staffId: form.staffId, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), area: form.area, notes: form.notes } });
      if (res.warning) toast.warning(res.warning);
    }, form.id ? "Turno actualizado" : "Turno creado");

  return (
    <Dialog open={!!draft} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{form.id ? "Turno" : "Nuevo turno"}</DialogTitle>
          {s && <DialogDescription>{s.staff.name} · {dayTime(s.startsAt)} a {time(s.endsAt)}</DialogDescription>}
        </DialogHeader>
        {s && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-muted/40 p-3 text-sm">
            {s.status === "ABSENT" ? <Badge variant="outline" className="border-rose-500/30 bg-rose-500/10 text-rose-700">Ausente</Badge> : s.clockOutAt ? <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700">Completado</Badge> : s.clockInAt ? <Badge variant="outline" className="border-sky-500/30 bg-sky-500/10 text-sky-700">Trabajando</Badge> : <Badge variant="outline">Programado</Badge>}
            {s.clockInAt && <span className="text-muted-foreground">Entró {time(s.clockInAt)}{s.clockOutAt ? ` · salió ${time(s.clockOutAt)}` : ""}</span>}
            <span className="ml-auto flex gap-1.5">
              {!s.clockInAt && s.status !== "ABSENT" && <Button size="sm" disabled={saving} onClick={() => run(() => gymApi(`/shifts/${s.id}/punch`, { method: "POST", json: { action: "in" } }), "Entrada marcada")}>Marcar entrada</Button>}
              {s.clockInAt && !s.clockOutAt && <Button size="sm" disabled={saving} onClick={() => run(() => gymApi(`/shifts/${s.id}/punch`, { method: "POST", json: { action: "out" } }), "Salida marcada")}>Marcar salida</Button>}
              {!s.clockInAt && s.status !== "ABSENT" && <Button size="sm" variant="outline" disabled={saving} onClick={() => run(() => gymApi(`/shifts/${s.id}/punch`, { method: "POST", json: { action: "absent" } }), "Marcado como ausente")}>Ausente</Button>}
              {(s.status !== "SCHEDULED" || s.clockInAt) && <Button size="sm" variant="ghost" disabled={saving} onClick={() => run(() => gymApi(`/shifts/${s.id}/punch`, { method: "POST", json: { action: "reset" } }), "Turno reiniciado")}>Deshacer</Button>}
            </span>
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Persona</Label>
            <select value={form.staffId} onChange={(e) => set("staffId", e.target.value)} className="h-9 w-full rounded-md border bg-background px-2 text-sm">
              <option value="" disabled>Elige a alguien</option>
              {staff.filter((p) => p.isActive || p.id === form.staffId).map((p) => <option key={p.id} value={p.id}>{p.name} · {staffRoleLabel(p.role)}</option>)}
            </select>
          </div>
          <div className="space-y-1.5 sm:col-span-2"><Label>Día</Label><DateField value={form.day} onChange={(v) => set("day", v)} presets={FUTURE_PRESETS} /></div>
          <div className="space-y-1.5"><Label>Entrada</Label><Input type="time" value={form.start} onChange={(e) => set("start", e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Salida</Label><Input type="time" value={form.end} onChange={(e) => set("end", e.target.value)} /></div>
          <p className="-mt-1 text-xs text-muted-foreground sm:col-span-2">{shiftLength(form.start, form.end)}</p>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Área</Label>
            <div className="flex flex-wrap gap-1.5">
              {AREAS.map((a) => <button key={a} type="button" onClick={() => set("area", form.area === a ? "" : a)} className={cn("rounded-full border px-3 py-1 text-xs", form.area === a ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground")}>{a}</button>)}
            </div>
          </div>
          <div className="space-y-1.5 sm:col-span-2"><Label>Notas</Label><Input value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Opcional" /></div>
        </div>
        <DialogFooter className="sm:justify-between">
          {form.id && !s?.clockInAt ? <Button variant="ghost" className="gap-1.5 text-rose-600" disabled={saving} onClick={() => run(() => gymApi(`/shifts/${form.id}`, { method: "DELETE" }), "Turno eliminado")}><IconTrash size={16} /> Eliminar</Button> : <span />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={save} disabled={saving || !form.staffId || !form.day} className="gap-2">{saving && <IconLoader2 size={16} className="animate-spin" />} Guardar</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

function ShiftCard({ arg }: { arg: EventContentArg }) {
  const s = arg.event.extendedProps.shift as Shift | undefined;
  // The preview while choosing an empty space (it has no shift behind it yet)
  if (!s) {
    return (
      <div className="flex h-full flex-col overflow-hidden rounded-lg border-2 border-dashed border-primary bg-primary/10 px-2 py-1 text-[11px] font-semibold leading-tight text-primary">
        <span>Nuevo turno</span>
        {arg.event.start && arg.event.end && <span className="font-normal opacity-80">{time(arg.event.start)} – {time(arg.event.end)}</span>}
      </div>
    );
  }
  const color = s.staff.color || COLORS[1];
  return (
    <div
      className={cn("gym-event flex h-full flex-col overflow-hidden rounded-lg px-2 py-1 text-[11px] leading-tight", s.status === "ABSENT" && "gym-event--cancelled")}
      style={{ ["--ev" as string]: color, color: `color-mix(in oklab, ${color} 40%, black)` }}
    >
      <span className="truncate font-semibold">{s.staff.name}</span>
      <span className="truncate opacity-80">{time(s.startsAt)} – {time(s.endsAt)}{s.area ? ` · ${s.area}` : ""}</span>
      {s.status === "ABSENT" ? <span className="mt-auto font-semibold">Ausente</span> : s.clockInAt ? <span className="mt-auto font-semibold">{s.clockOutAt ? "✓ Completado" : "● Trabajando"}</span> : null}
    </div>
  );
}

export default function GymStaffPage() {
  const ref = useRef<FullCalendar>(null);
  const [staff, setStaff] = useState<Staff[] | null>(null);
  const [data, setData] = useState<ShiftsResponse | null>(null);
  const [range, setRange] = useState<{ start: Date; end: Date } | null>(null);
  const [title, setTitle] = useState("");
  const [tab, setTab] = useState<"shifts" | "team">("shifts");
  const [filter, setFilter] = useState("all");
  const [staffDialog, setStaffDialog] = useState<{ open: boolean; staff: Staff | null }>({ open: false, staff: null });
  const [draft, setDraft] = useState<ShiftDraft | null>(null);
  const [copying, setCopying] = useState(false);
  const [view, setView] = useState<"timeGridWeek" | "timeGridDay">("timeGridWeek");
  useEffect(() => { if (typeof window !== "undefined" && window.innerWidth < 768) setView("timeGridDay"); }, []);
  useEffect(() => { ref.current?.getApi().changeView(view); }, [view]);

  const loadStaff = useCallback(() => gymApi<Staff[]>("/trainers").then(setStaff).catch((e) => toast.error(e.message)), []);
  const loadShifts = useCallback(() => {
    if (!range) return;
    gymApi<ShiftsResponse>(`/shifts?from=${range.start.toISOString()}&to=${range.end.toISOString()}`).then(setData).catch((e) => toast.error(e.message));
  }, [range]);
  useEffect(() => { loadStaff(); }, [loadStaff]);
  useEffect(() => { loadShifts(); }, [loadShifts]);

  const events = useMemo(
    () =>
      (data?.shifts ?? [])
        .filter((s) => filter === "all" || s.staffId === filter)
        .map((s) => ({ id: s.id, start: s.startsAt, end: s.endsAt, editable: !s.clockInAt && s.status === "SCHEDULED", extendedProps: { shift: s }, backgroundColor: "transparent", borderColor: "transparent" })),
    [data, filter],
  );

  const move = async (shift: Shift, start: Date, end: Date, revert: () => void) => {
    try {
      const r = await gymApi<{ warning: string | null }>(`/shifts/${shift.id}`, { method: "PUT", json: { startsAt: start.toISOString(), endsAt: end.toISOString() } });
      toast.success(`Turno de ${shift.staff.name}: ${dayTime(start.toISOString())} a ${time(end)}`, { description: r.warning ?? undefined });
      loadShifts();
    } catch (e) {
      revert();
      toast.error((e as Error).message);
    }
  };

  const copyPrevious = async () => {
    if (!range) return;
    const to = mondayOf(range.start);
    const from = new Date(to.getTime() - 7 * 86400000);
    setCopying(true);
    try {
      const r = await gymApi<{ created: number; skipped: number }>("/shifts/copy-week", { method: "POST", json: { from: from.toISOString(), to: to.toISOString() } });
      toast.success(r.created ? `Se copiaron ${r.created} turnos de la semana anterior` : "La semana anterior no tiene turnos para copiar", { description: r.skipped ? `${r.skipped} no se copiaron porque ya había un turno a esa hora.` : undefined });
      loadShifts();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCopying(false);
    }
  };

  const hours = (data?.totals ?? []).reduce((t, x) => t + x.hours, 0);
  const cost = (data?.totals ?? []).reduce((t, x) => t + (x.cost ?? 0), 0);
  const active = (staff ?? []).filter((s) => s.isActive);
  // With one person chosen, the calendar greys out the hours they can't work
  const chosen = filter !== "all" ? (staff ?? []).find((s) => s.id === filter) : undefined;
  const availabilityHours = chosen?.availability.length
    ? chosen.availability.map((a) => ({ daysOfWeek: [a.dayOfWeek], startTime: a.startTime, endTime: a.endTime }))
    : undefined;

  const columns = useMemo<ColumnDef<Staff>[]>(
    () => [
      { id: "name", header: "Persona", accessorFn: (s) => `${s.name} ${s.specialty ?? ""}`, cell: ({ row }) => <PersonCell name={row.original.name} sub={row.original.specialty || staffRoleLabel(row.original.role)} /> },
      { id: "role", header: "Rol", accessorFn: (s) => staffRoleLabel(s.role), cell: ({ getValue }) => <Badge variant="outline">{getValue<string>()}</Badge> },
      { id: "availability", header: "Disponibilidad", accessorFn: (s) => availabilitySummary(s.availability), cell: ({ getValue }) => <span className="text-sm text-muted-foreground">{getValue<string>()}</span> },
      {
        id: "week",
        header: "Esta semana",
        accessorFn: (s) => data?.totals.find((t) => t.staffId === s.id)?.hours ?? 0,
        cell: ({ row }) => {
          const t = data?.totals.find((x) => x.staffId === row.original.id);
          return t ? <span className="tabular-nums">{t.hours} h · {t.shifts} {t.shifts === 1 ? "turno" : "turnos"}{t.cost != null ? ` · ${money(t.cost)}` : ""}</span> : <span className="text-muted-foreground">Sin turnos</span>;
        },
      },
      { id: "phone", header: "WhatsApp", accessorFn: (s) => s.phone ?? "", cell: ({ getValue }) => <span className="text-muted-foreground tabular-nums">{getValue<string>() ? formatWhatsAppNumber(getValue<string>()) : "—"}</span> },
      {
        id: "active",
        header: "Estado",
        accessorFn: (s) => (s.isActive ? "Activo" : "Inactivo"),
        cell: ({ row }) => (
          <Badge variant="outline" className={cn("gap-1.5", row.original.isActive ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700" : "text-muted-foreground")}>
            <span className="size-1.5 rounded-full bg-current" /> {row.original.isActive ? "Activo" : "Inactivo"}
          </Badge>
        ),
      },
    ],
    [data],
  );

  const api = () => ref.current?.getApi();

  return (
    <GymPage>
      <GymPageHeader
        title="Personal"
        description="Tu equipo, cuándo puede trabajar y sus turnos de la semana."
        actions={
          <>
            <Button variant="outline" className="gap-2" onClick={() => setStaffDialog({ open: true, staff: null })}><IconUsers size={16} /> Nueva persona</Button>
            <Button className="gap-2" disabled={!active.length} onClick={() => { const d = new Date(); setDraft({ staffId: active[0]?.id ?? "", day: localInput(d), start: "08:00", end: "16:00", area: "", notes: "" }); }}><IconPlus size={16} /> Nuevo turno</Button>
          </>
        }
      />
      <StatGrid>
        <StatCard label="Equipo activo" value={staff ? active.length : "—"} icon={<IconUsers size={20} />} title={`${active.filter((s) => s.role === "TRAINER").length} entrenadores`} hint={`${active.filter((s) => s.role === "RECEPTION").length} en recepción`} onClick={() => setTab("team")} />
        <StatCard label="Horas en pantalla" value={data ? `${Math.round(hours)} h` : "—"} icon={<IconClockHour4 size={20} />} tone="primary" title={`${data?.shifts.filter((s) => s.status !== "ABSENT").length ?? 0} turnos`} hint="Semana que estás viendo" />
        <StatCard label="Costo estimado" value={data ? money(cost) : "—"} icon={<IconWallet size={20} />} title="Según el pago por hora" hint="Solo personas con tarifa" />
        <StatCard label="Clases sin cubrir" value={data?.uncovered.length ?? "—"} icon={<IconAlertTriangle size={20} />} tone={data?.uncovered.length ? "warn" : "good"} title={data?.uncovered.length ? "El entrenador no tiene turno" : "Todas cubiertas"} hint="Clases de la semana en pantalla" />
      </StatGrid>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "shifts" | "team")}>
        <TabsList>
          <TabsTrigger value="shifts" className="gap-1.5"><IconCalendarTime size={16} /> Turnos</TabsTrigger>
          <TabsTrigger value="team" className="gap-1.5"><IconUsers size={16} /> Equipo</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className={cn("gym-calendar flex flex-col gap-4", tab !== "shifts" && "hidden")}>
        <style>{CALENDAR_CSS}</style>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="size-9" onClick={() => api()?.prev()} title="Semana anterior"><IconChevronLeft size={18} /></Button>
            <Button variant="outline" size="icon" className="size-9" onClick={() => api()?.next()} title="Semana siguiente"><IconChevronRight size={18} /></Button>
            <Button variant="outline" size="sm" className="h-9" onClick={() => api()?.today()}>Hoy</Button>
            <h2 className="ml-2 text-lg font-semibold first-letter:uppercase">{title}</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border p-0.5">
              {([["timeGridWeek", "Semana"], ["timeGridDay", "Día"]] as const).map(([v, label]) => (
                <button key={v} type="button" onClick={() => setView(v)} className={cn("rounded-md px-3 py-1.5 text-sm font-medium", view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>{label}</button>
              ))}
            </div>
            <Button variant="outline" className="gap-2" disabled={copying} onClick={copyPrevious}>{copying ? <IconLoader2 size={16} className="animate-spin" /> : <IconCopy size={16} />} Copiar semana anterior</Button>
          </div>
        </div>

        {/* Who to look at: everyone, or one person with their availability shaded */}
        <div className="scrollbar-none -mx-1 flex gap-1.5 overflow-x-auto px-1">
          <button type="button" onClick={() => setFilter("all")} className={cn("shrink-0 rounded-full border px-3 py-1.5 text-sm", filter === "all" ? "border-primary bg-primary/10 font-semibold text-primary" : "text-muted-foreground hover:text-foreground")}>
            Todo el equipo · {Math.round(hours)} h
          </button>
          {active.map((p) => {
            const t = data?.totals.find((x) => x.staffId === p.id);
            return (
              <button key={p.id} type="button" onClick={() => setFilter(filter === p.id ? "all" : p.id)} title={`Disponible: ${availabilitySummary(p.availability)}`} className={cn("flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm", filter === p.id ? "border-primary bg-primary/10 font-semibold text-primary" : "text-muted-foreground hover:text-foreground")}>
                <span className="size-2.5 rounded-full" style={{ background: p.color || COLORS[1] }} />
                {p.name.split(" ")[0]} · {t ? `${t.hours} h` : "0 h"}
              </button>
            );
          })}
        </div>

        {!!data?.uncovered.length && (
          <div className="rounded-2xl bg-amber-500/10 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-amber-900"><IconAlertTriangle size={16} /> Clases sin turno del entrenador</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {data.uncovered.slice(0, 12).map((u) => (
                <button
                  key={u.sessionId}
                  type="button"
                  onClick={() => { const a = new Date(u.startsAt), b = new Date(u.endsAt); setDraft({ staffId: u.trainerId, day: localInput(a), start: hhmm(new Date(a.getTime() - 15 * 60000)), end: hhmm(new Date(b.getTime() + 15 * 60000)), area: "Clases", notes: u.className }); }}
                  className="rounded-full bg-background px-2.5 py-1 text-xs text-amber-900 shadow-sm hover:bg-amber-50"
                  title="Crear el turno para esta clase"
                >
                  {u.className} · {u.trainerName} · {dayTime(u.startsAt)}
                </button>
              ))}
              {data.uncovered.length > 12 && <span className="px-1 py-1 text-xs text-amber-900">y {data.uncovered.length - 12} más</span>}
            </div>
          </div>
        )}

        <div className="overflow-hidden rounded-2xl border bg-card">
          <FullCalendar
            ref={ref}
            plugins={[timeGridPlugin, interactionPlugin]}
            initialView={view}
            locale={esLocale}
            firstDay={1}
            headerToolbar={false}
            height="calc(100vh - 230px)"
            allDaySlot={false}
            nowIndicator
            slotMinTime="05:00:00"
            slotMaxTime="23:00:00"
            scrollTime="06:00:00"
            slotDuration="00:30:00"
            snapDuration="00:15:00"
            slotLabelFormat={{ hour: "numeric", minute: "2-digit", meridiem: "short" }}
            dayHeaderContent={(arg) => (
              <div className={cn("flex flex-col items-center py-1.5 leading-none", arg.isToday && "text-primary")}>
                <span className="text-[11px] font-medium text-muted-foreground">{arg.date.toLocaleDateString("es-VE", { weekday: "short" }).replace(".", "")}</span>
                <span className={cn("mt-1 flex size-8 items-center justify-center rounded-full text-base font-semibold", arg.isToday && "bg-primary text-primary-foreground")}>{arg.date.getDate()}</span>
              </div>
            )}
            events={events}
            businessHours={availabilityHours}
            eventContent={(arg) => <ShiftCard arg={arg} />}
            eventClassNames="gym-fc-event"
            eventClick={(arg) => { const s = arg.event.extendedProps.shift as Shift; const a = new Date(s.startsAt), b = new Date(s.endsAt); setDraft({ id: s.id, staffId: s.staffId, day: localInput(a), start: hhmm(a), end: hhmm(b), area: s.area ?? "", notes: s.notes ?? "", shift: s }); }}
            editable
            eventDrop={(arg: EventDropArg) => move(arg.event.extendedProps.shift, arg.event.start!, arg.event.end!, arg.revert)}
            eventResize={(arg: EventResizeDoneArg) => move(arg.event.extendedProps.shift, arg.event.start!, arg.event.end!, arg.revert)}
            selectable
            selectMirror
            select={(arg) => {
              // A click marks a single slot: open a 4-hour shift from there (until 11:00 p. m. at the latest)
              let end = arg.end;
              if (end.getTime() - arg.start.getTime() <= 30 * 60000) {
                const close = new Date(arg.start); close.setHours(23, 0, 0, 0);
                end = new Date(Math.min(arg.start.getTime() + 4 * 3600000, close.getTime()));
              }
              setDraft({ staffId: filter !== "all" ? filter : active[0]?.id ?? "", day: localInput(arg.start), start: hhmm(arg.start), end: hhmm(end), area: "", notes: "" });
              arg.view.calendar.unselect();
            }}
            datesSet={(arg: DatesSetArg) => { setTitle(arg.view.title); setRange({ start: arg.start, end: arg.end }); }}
          />
        </div>
        <p className="text-xs text-muted-foreground">Toca un espacio vacío para crear un turno de 4 horas, o arrastra para elegir el horario exacto. Arrastra un turno para moverlo, estira su borde para cambiar la hora y tócalo para marcar la entrada y la salida. Al elegir a una persona, se ven en gris las horas en que no está disponible.</p>
      </div>

      {tab === "team" && (
        <PosTable columns={columns} data={staff ?? []} loading={!staff} searchPlaceholder="Buscar persona…" getRowId={(s) => s.id} onRowClick={(s) => setStaffDialog({ open: true, staff: s })} emptyMessage="Agrega a tu equipo para planificar sus turnos." />
      )}

      <StaffDialog staff={staffDialog.staff} open={staffDialog.open} onClose={() => setStaffDialog({ open: false, staff: null })} onSaved={() => { loadStaff(); loadShifts(); }} />
      <ShiftDialog draft={draft} staff={staff ?? []} onClose={() => setDraft(null)} onSaved={loadShifts} />
    </GymPage>
  );
}
