"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SignaturePad, type SignaturePadHandle } from "@/components/gym/signature-pad";
import { IconBarbell, IconCalendarEvent, IconCheck, IconChevronRight, IconClock, IconFileText, IconHourglass, IconLoader2, IconMapPin, IconUser, IconX } from "@tabler/icons-react";
import { toast } from "sonner";
import { API_URL } from "@/lib/constants";
import { cn } from "@/lib/utils";

// ── Data ─────────────────────────────────────────────────────────────────────

type Rules = { portalEnabled: boolean; daysAhead: number; cancelHours: number; maxActive: number };
type PortalSession = {
  id: string;
  startsAt: string;
  endsAt: string;
  name: string;
  color: string | null;
  room: string | null;
  trainer: string | null;
  capacity: number;
  booked: number;
  waitlist: number;
  myBooking: { id: string; status: "BOOKED" | "WAITLIST" | "ATTENDED" | "NO_SHOW" } | null;
};
type PortalMe = {
  gym: { name: string; logo: string | null; timeZone: string };
  rules: Rules;
  member: {
    id: string;
    memberNumber: number;
    name: string;
    status: string;
    daysLeft: number | null;
    owed: number;
    membership: { planName: string; startDate: string; endDate: string; state: string } | null;
  };
  bookings: { id: string; status: "BOOKED" | "WAITLIST"; cancelUntil: string; session: { id: string; startsAt: string; endsAt: string; name: string; color: string | null; room: string | null; trainer: string | null } }[];
  visits: string[];
};

async function portalApi<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("client_token") : null;
  const res = await fetch(`${API_URL}/gym/portal${path}`, { method, headers: { Authorization: `Bearer ${token}`, ...(body !== undefined && { "Content-Type": "application/json" }) }, ...(body !== undefined && { body: JSON.stringify(body) }) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.message || "No se pudo completar"), { status: res.status });
  return data as T;
}

const DEFAULT_COLOR = "#F97316";
const tint = (color: string | null, pct = 22) => `color-mix(in oklab, ${color || DEFAULT_COLOR} ${pct}%, white)`;
const ink = (color: string | null) => `color-mix(in oklab, ${color || DEFAULT_COLOR} 45%, black)`;

function fmt(d: string, tz: string, opts: Intl.DateTimeFormatOptions) {
  return new Date(d).toLocaleString("es-VE", { timeZone: tz, ...opts });
}
const time = (d: string, tz: string) => fmt(d, tz, { hour: "numeric", minute: "2-digit" });
const dayKey = (d: string | Date, tz: string) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(d));

const STATE_LABEL: Record<string, { label: string; tone: string }> = {
  ACTIVE: { label: "Activa", tone: "bg-emerald-100 text-emerald-800" },
  SCHEDULED: { label: "Por empezar", tone: "bg-sky-100 text-sky-800" },
  FROZEN: { label: "Congelada", tone: "bg-sky-100 text-sky-800" },
  EXPIRED: { label: "Vencida", tone: "bg-rose-100 text-rose-800" },
  CANCELLED: { label: "Cancelada", tone: "bg-zinc-200 text-zinc-700" },
  BLOCKED: { label: "Acceso bloqueado", tone: "bg-rose-100 text-rose-800" },
  NONE: { label: "Sin membresía", tone: "bg-zinc-200 text-zinc-700" },
};

/** Loads the member's data; `null` means the client isn't a member of this gym. */
function usePortalGym() {
  const [me, setMe] = useState<PortalMe | null | undefined>(undefined);
  const load = useCallback(() => {
    portalApi<PortalMe>("/me")
      .then(setMe)
      .catch((e) => setMe((prev) => (e.status === 404 || e.status === 403 ? null : prev ?? null)));
  }, []);
  useEffect(load, [load]);
  return { me, reload: load };
}

// ── Home card ────────────────────────────────────────────────────────────────

/** Small card for the portal home. Renders nothing for clients who aren't members. */
export function PortalGymTeaser({ onOpen }: { onOpen: () => void }) {
  const { me } = usePortalGym();
  if (!me) return null;
  const m = me.member;
  const next = me.bookings.find((b) => b.status === "BOOKED");
  const state = STATE_LABEL[m.status] ?? STATE_LABEL.NONE;
  return (
    <button type="button" onClick={onOpen} className="flex w-full items-center gap-3 rounded-2xl border border-zinc-100 bg-white p-4 text-left shadow-sm transition active:scale-[0.99]">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800"><IconBarbell size={22} /></span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-bold text-zinc-900">Mi gimnasio</span>
          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", state.tone)}>{state.label}</span>
        </span>
        <span className="mt-0.5 block truncate text-xs text-zinc-500">
          {next
            ? `Próxima clase: ${next.session.name}, ${fmt(next.session.startsAt, me.gym.timeZone, { weekday: "short", hour: "numeric", minute: "2-digit" })}`
            : m.membership && m.daysLeft !== null
              ? `${m.membership.planName} · ${m.daysLeft === 0 ? "vence hoy" : `quedan ${m.daysLeft} días`}`
              : "Reserva tus clases desde aquí"}
        </span>
      </span>
      <IconChevronRight size={18} className="shrink-0 text-zinc-400" />
    </button>
  );
}

// ── Documents to sign ────────────────────────────────────────────────────────

type PendingDoc = { id: string; title: string; version: number; signedVersion: number | null; body: string };

/** Full-screen reader with the signature pad, made for a phone. */
function SignSheet({ doc, onClose, onSigned }: { doc: PendingDoc; onClose: () => void; onSigned: () => void }) {
  const pad = useRef<SignaturePadHandle>(null);
  const [accepted, setAccepted] = useState(false);
  const [empty, setEmpty] = useState(true);
  const [saving, setSaving] = useState(false);
  const sign = async () => {
    const signature = pad.current?.toDataURL();
    if (!signature) return;
    setSaving(true);
    try {
      await portalApi(`/documents/${doc.id}/sign`, "POST", { signature, accepted });
      toast.success(`Firmaste ${doc.title}`);
      onSigned();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-[#faf9f5]">
      <div className="flex items-center justify-between px-5 pb-2 pt-4">
        <p className="truncate text-base font-bold text-zinc-900">{doc.title}</p>
        <button type="button" onClick={onClose} className="rounded-full p-2 text-zinc-500 hover:bg-zinc-200" title="Cerrar"><IconX size={18} /></button>
      </div>
      <div className="flex-1 overflow-y-auto whitespace-pre-wrap px-5 pb-4 text-sm leading-relaxed text-zinc-700">{doc.body}</div>
      <div className="space-y-3 border-t border-zinc-200 bg-white px-5 pb-6 pt-4">
        <label className="flex items-start gap-2.5 text-sm text-zinc-700">
          <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-0.5 size-4 accent-amber-500" />
          Leí el documento y estoy de acuerdo.
        </label>
        <SignaturePad ref={pad} className="h-36" onChange={setEmpty} />
        <button type="button" disabled={!accepted || empty || saving} onClick={sign} className="flex w-full items-center justify-center gap-2 rounded-full bg-amber-400 py-3 text-sm font-bold text-amber-950 disabled:opacity-40">
          {saving && <IconLoader2 size={16} className="animate-spin" />} Firmar
        </button>
      </div>
    </div>
  );
}

function PendingDocuments({ onChange }: { onChange?: () => void }) {
  const [docs, setDocs] = useState<PendingDoc[] | null>(null);
  const [open, setOpen] = useState<PendingDoc | null>(null);
  const load = useCallback(() => { portalApi<PendingDoc[]>("/documents").then(setDocs).catch(() => setDocs([])); }, []);
  useEffect(load, [load]);
  if (!docs?.length) return null;
  return (
    <section className="space-y-2">
      {docs.map((d) => (
        <button key={d.id} type="button" onClick={() => setOpen(d)} className="flex w-full items-center gap-3 rounded-2xl bg-amber-100 p-3 text-left">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white text-amber-700"><IconFileText size={20} /></span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold text-amber-950">{d.title}</span>
            <span className="block text-xs text-amber-900/80">{d.signedVersion ? "Hay una versión nueva para firmar" : "Fírmalo aquí, toma un minuto"}</span>
          </span>
          <IconChevronRight size={18} className="shrink-0 text-amber-800" />
        </button>
      ))}
      {open && <SignSheet doc={open} onClose={() => setOpen(null)} onSigned={() => { setOpen(null); load(); onChange?.(); }} />}
    </section>
  );
}

// ── Full view ────────────────────────────────────────────────────────────────

export function PortalGym() {
  const { me, reload } = usePortalGym();
  const [schedule, setSchedule] = useState<{ timeZone: string; rules: Rules; sessions: PortalSession[] } | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<string | null>(null);

  const loadSchedule = useCallback(() => {
    portalApi<{ timeZone: string; rules: Rules; sessions: PortalSession[] }>("/schedule").then(setSchedule).catch(() => setSchedule({ timeZone: "America/Caracas", rules: { portalEnabled: false, daysAhead: 0, cancelHours: 0, maxActive: 0 }, sessions: [] }));
  }, []);
  useEffect(() => { if (me) loadSchedule(); }, [me, loadSchedule]);

  const tz = me?.gym.timeZone || "America/Caracas";
  const days = useMemo(() => {
    const out: string[] = [];
    const n = (schedule?.rules.daysAhead ?? 7) + 1;
    for (let i = 0; i < n; i++) out.push(dayKey(new Date(Date.now() + i * 86400000), tz));
    return out;
  }, [schedule, tz]);
  const selected = day ?? days.find((d) => schedule?.sessions.some((s) => dayKey(s.startsAt, tz) === d)) ?? days[0];
  const daySessions = (schedule?.sessions ?? []).filter((s) => dayKey(s.startsAt, tz) === selected);

  const refresh = () => { reload(); loadSchedule(); };

  const book = async (s: PortalSession) => {
    setBusy(s.id);
    try {
      const res = await portalApi<{ status: string }>(`/sessions/${s.id}/book`, "POST");
      toast.success(res.status === "WAITLIST" ? `Estás en la lista de espera de ${s.name}. Te avisamos por WhatsApp si se libera un cupo` : `Listo, tienes tu cupo en ${s.name}`);
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const cancel = async (bookingId: string, name: string) => {
    setBusy(bookingId);
    try {
      await portalApi(`/bookings/${bookingId}/cancel`, "POST");
      toast.success(`Cancelaste tu reserva de ${name}`);
      setConfirmCancel(null);
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  if (me === undefined) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-white" />)}
      </div>
    );
  }
  if (me === null) {
    return (
      <div className="rounded-2xl border border-zinc-100 bg-white p-6 text-center shadow-sm">
        <IconBarbell size={36} className="mx-auto text-zinc-300" />
        <p className="mt-3 text-sm font-semibold text-zinc-800">Todavía no eres socio</p>
        <p className="mt-1 text-xs text-zinc-500">Inscríbete en la recepción del gimnasio y aquí verás tu plan y tus clases.</p>
      </div>
    );
  }

  const m = me.member;
  const state = STATE_LABEL[m.status] ?? STATE_LABEL.NONE;
  const ms = m.membership;
  const total = ms ? Math.max(1, (new Date(ms.endDate).getTime() - new Date(ms.startDate).getTime()) / 86400000) : 1;
  const usedPct = ms && m.daysLeft !== null ? Math.min(100, Math.max(0, 100 - (m.daysLeft / total) * 100)) : 100;
  const rules = schedule?.rules ?? me.rules;
  const canBook = m.status === "ACTIVE" || m.status === "SCHEDULED";

  return (
    <div className="space-y-5">
      <PendingDocuments />
      {/* Membership */}
      <section className="rounded-3xl bg-zinc-900 p-5 text-white shadow-lg">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-white/60">{me.gym.name} · socio n.º {m.memberNumber}</p>
            <p className="mt-1 truncate text-2xl font-bold">{ms?.planName ?? "Sin plan"}</p>
          </div>
          <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold", state.tone)}>{state.label}</span>
        </div>
        {ms && (
          <>
            <div className="mt-5 flex items-end justify-between">
              <div>
                <p className="text-4xl font-black tabular-nums leading-none">{m.daysLeft ?? 0}</p>
                <p className="mt-1 text-xs text-white/60">{m.daysLeft === 1 ? "día restante" : "días restantes"}</p>
              </div>
              <p className="text-right text-xs text-white/60">Vence el<br /><span className="text-sm font-semibold text-white">{fmt(ms.endDate, tz, { day: "numeric", month: "long" })}</span></p>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/15">
              <div className="h-full rounded-full bg-amber-400" style={{ width: `${usedPct}%` }} />
            </div>
          </>
        )}
        {m.owed > 0 && <p className="mt-4 rounded-xl bg-white/10 px-3 py-2 text-xs">Tienes un saldo pendiente de <b>${m.owed.toFixed(2)}</b>. Puedes pagarlo en recepción.</p>}
        {(m.status === "EXPIRED" || m.status === "NONE") && <p className="mt-4 rounded-xl bg-white/10 px-3 py-2 text-xs">Renueva tu plan en recepción para volver a reservar clases.</p>}
      </section>

      {/* My bookings */}
      <section className="space-y-2">
        <h3 className="px-1 text-sm font-bold text-zinc-900">Mis reservas</h3>
        {me.bookings.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-zinc-200 px-4 py-5 text-center text-xs text-zinc-500">No tienes clases reservadas.</p>
        ) : (
          me.bookings.map((b) => {
            const locked = b.status === "BOOKED" && new Date(b.cancelUntil).getTime() < Date.now();
            return (
              <div key={b.id} className="rounded-2xl border border-zinc-100 bg-white p-3 shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="flex size-12 shrink-0 flex-col items-center justify-center rounded-xl text-[10px] font-bold leading-tight" style={{ background: tint(b.session.color), color: ink(b.session.color) }}>
                    {fmt(b.session.startsAt, tz, { weekday: "short" }).replace(".", "")}
                    <span className="text-base">{fmt(b.session.startsAt, tz, { day: "numeric" })}</span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-zinc-900">{b.session.name}</p>
                    <p className="truncate text-xs text-zinc-500">{time(b.session.startsAt, tz)}{b.session.trainer ? ` · ${b.session.trainer}` : ""}{b.session.room ? ` · ${b.session.room}` : ""}</p>
                  </div>
                  {b.status === "WAITLIST" ? (
                    <span className="flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-800"><IconHourglass size={12} /> En espera</span>
                  ) : (
                    <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-bold text-emerald-800"><IconCheck size={12} /> Reservado</span>
                  )}
                </div>
                <div className="mt-2 flex items-center justify-between gap-2 border-t border-zinc-100 pt-2">
                  <p className="text-[11px] text-zinc-500">
                    {locked ? "Ya no se puede cancelar desde la app" : b.status === "BOOKED" && rules.cancelHours > 0 ? `Puedes cancelar hasta las ${time(b.cancelUntil, tz)}` : "Puedes salir cuando quieras"}
                  </p>
                  {!locked &&
                    (confirmCancel === b.id ? (
                      <span className="flex gap-1.5">
                        <button type="button" onClick={() => setConfirmCancel(null)} className="rounded-full px-3 py-1 text-xs font-semibold text-zinc-500">No</button>
                        <button type="button" disabled={busy === b.id} onClick={() => cancel(b.id, b.session.name)} className="flex items-center gap-1 rounded-full bg-rose-600 px-3 py-1 text-xs font-bold text-white">
                          {busy === b.id && <IconLoader2 size={12} className="animate-spin" />} Sí, cancelar
                        </button>
                      </span>
                    ) : (
                      <button type="button" onClick={() => setConfirmCancel(b.id)} className="rounded-full px-3 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50">
                        {b.status === "WAITLIST" ? "Salir de la lista" : "Cancelar"}
                      </button>
                    ))}
                </div>
              </div>
            );
          })
        )}
      </section>

      {/* Book a class */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between px-1">
          <h3 className="text-sm font-bold text-zinc-900">Reservar clase</h3>
          {rules.maxActive > 0 && <span className="text-[11px] text-zinc-500">Hasta {rules.maxActive} reservas a la vez</span>}
        </div>
        {!rules.portalEnabled ? (
          <p className="rounded-2xl border border-dashed border-zinc-200 px-4 py-5 text-center text-xs text-zinc-500">Este gimnasio toma las reservas en recepción.</p>
        ) : (
          <>
            <div className="-mx-6 flex gap-2 overflow-x-auto px-6 pb-1 scrollbar-none">
              {days.map((d) => {
                const date = new Date(`${d}T12:00:00`);
                const count = (schedule?.sessions ?? []).filter((s) => dayKey(s.startsAt, tz) === d).length;
                const active = d === selected;
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDay(d)}
                    className={cn("flex w-14 shrink-0 flex-col items-center rounded-2xl py-2 transition", active ? "bg-zinc-900 text-white shadow" : "bg-white text-zinc-700 shadow-sm", !count && !active && "opacity-50")}
                  >
                    <span className="text-[10px] font-semibold">{date.toLocaleDateString("es-VE", { weekday: "short" }).replace(".", "")}</span>
                    <span className="text-lg font-black leading-tight">{date.getDate()}</span>
                    <span className={cn("mt-0.5 size-1.5 rounded-full", count ? (active ? "bg-amber-400" : "bg-amber-500") : "bg-transparent")} />
                  </button>
                );
              })}
            </div>

            {!schedule ? (
              <div className="h-24 animate-pulse rounded-2xl bg-white" />
            ) : daySessions.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-zinc-200 px-4 py-5 text-center text-xs text-zinc-500">No hay clases este día.</p>
            ) : (
              daySessions.map((s) => {
                const left = Math.max(0, s.capacity - s.booked);
                const started = new Date(s.startsAt).getTime() < Date.now();
                const mine = s.myBooking;
                return (
                  <div key={s.id} className="flex items-center gap-3 rounded-2xl border border-zinc-100 bg-white p-3 shadow-sm">
                    <span className="flex size-12 shrink-0 flex-col items-center justify-center rounded-xl text-xs font-bold" style={{ background: tint(s.color), color: ink(s.color) }}>
                      {time(s.startsAt, tz).split(/\s/)[0]}
                      <span className="text-[9px] font-semibold opacity-80">{time(s.startsAt, tz).split(/\s/).slice(1).join(" ")}</span>
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-zinc-900">{s.name}</p>
                      <p className="flex flex-wrap items-center gap-x-2 text-[11px] text-zinc-500">
                        {s.trainer && <span className="flex items-center gap-0.5"><IconUser size={11} />{s.trainer}</span>}
                        {s.room && <span className="flex items-center gap-0.5"><IconMapPin size={11} />{s.room}</span>}
                        <span className="flex items-center gap-0.5"><IconClock size={11} />{Math.round((new Date(s.endsAt).getTime() - new Date(s.startsAt).getTime()) / 60000)} min</span>
                      </p>
                      <p className={cn("mt-0.5 text-[11px] font-semibold", left === 0 ? "text-rose-600" : left <= 3 ? "text-amber-700" : "text-emerald-700")}>
                        {left === 0 ? `Lleno${s.waitlist ? ` · ${s.waitlist} en espera` : ""}` : `${left} ${left === 1 ? "cupo libre" : "cupos libres"}`}
                      </p>
                    </div>
                    {mine ? (
                      <span className={cn("shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold", mine.status === "WAITLIST" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800")}>
                        {mine.status === "WAITLIST" ? "En espera" : "Reservado"}
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={!canBook || started || busy === s.id}
                        onClick={() => book(s)}
                        className={cn("flex shrink-0 items-center gap-1 rounded-full px-3.5 py-2 text-xs font-bold transition active:scale-95 disabled:opacity-40", left === 0 ? "bg-zinc-100 text-zinc-800" : "bg-amber-400 text-amber-950")}
                      >
                        {busy === s.id && <IconLoader2 size={12} className="animate-spin" />}
                        {left === 0 ? "Lista de espera" : "Reservar"}
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </>
        )}
      </section>

      {/* Visits */}
      {me.visits.length > 0 && (
        <section className="rounded-2xl border border-zinc-100 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <IconCalendarEvent size={16} className="text-zinc-400" />
            <h3 className="text-sm font-bold text-zinc-900">Tus últimas visitas</h3>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {me.visits.map((v) => (
              <span key={v} className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-medium text-zinc-700">{fmt(v, tz, { weekday: "short", day: "numeric", month: "short" })}</span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
