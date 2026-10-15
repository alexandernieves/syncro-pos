"use client";

import { useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import dayGridPlugin from "@fullcalendar/daygrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";
import esLocale from "@fullcalendar/core/locales/es";
import type { DatesSetArg, EventClickArg, EventContentArg, EventDropArg, DateSelectArg } from "@fullcalendar/core";
import type { EventResizeDoneArg } from "@fullcalendar/interaction";
import { IconChevronLeft, IconChevronRight, IconUsers } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export type CalendarSession = {
  id: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
  status: "SCHEDULED" | "CANCELLED";
  booked: number;
  waitlist: number;
  isExtra?: boolean;
  originalStartsAt?: string | null;
  class: { id: string; name: string; color: string | null; room: string | null };
  trainer: { id: string; name: string } | null;
};

type View = "timeGridWeek" | "timeGridDay" | "dayGridMonth" | "listWeek";
const VIEWS: [View, string][] = [["timeGridWeek", "Semana"], ["timeGridDay", "Día"], ["dayGridMonth", "Mes"], ["listWeek", "Agenda"]];

type ClassCalendarProps = {
  sessions: CalendarSession[];
  loading?: boolean;
  trainers: { id: string; name: string }[];
  classes: { id: string; name: string }[];
  onRangeChange: (from: Date, to: Date) => void;
  onOpenSession: (id: string) => void;
  onMove: (session: CalendarSession, startsAt: Date, endsAt: Date, revert: () => void) => void;
  onSelectSlot: (start: Date, end: Date) => void;
};

const DEFAULT_COLOR = "#E4572E";
const pad = (n: number) => String(n).padStart(2, "0");

/** Text color with enough contrast over a light tint of the class color. */
function ink(hex: string) {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  // Darken the color for text: same hue, readable on the pale fill
  return `rgb(${Math.round(r * 0.42)}, ${Math.round(g * 0.42)}, ${Math.round(b * 0.42)})`;
}

/** Seats shown as small pills, then a number when the class is big. */
function Seats({ booked, capacity, color }: { booked: number; capacity: number; color: string }) {
  const full = booked >= capacity;
  if (capacity <= 12) {
    return (
      <span className="flex flex-wrap gap-[2px]" aria-label={`${booked} de ${capacity} cupos`}>
        {Array.from({ length: capacity }, (_, i) => (
          <span key={i} className="h-[5px] w-[5px] rounded-full" style={{ background: i < booked ? (full ? "#BE123C" : color) : "rgba(0,0,0,0.12)" }} />
        ))}
      </span>
    );
  }
  return <span className={cn("tabular-nums", full && "text-rose-700")}>{booked}/{capacity}</span>;
}

function EventCard({ arg }: { arg: EventContentArg }) {
  const s = arg.event.extendedProps.session as CalendarSession | undefined;
  // The preview while choosing an empty slot (no session behind it yet)
  if (!s) {
    return (
      <div className="flex h-full flex-col overflow-hidden rounded-lg border-2 border-dashed border-primary bg-primary/10 px-2 py-1 text-[11px] font-semibold leading-tight text-primary">
        <span>Agregar aquí</span>
      </div>
    );
  }
  const color = s.class.color || DEFAULT_COLOR;
  const cancelled = s.status === "CANCELLED";
  const full = !cancelled && s.booked >= s.capacity;
  const past = arg.isPast;
  const time = `${arg.event.start!.getHours() % 12 || 12}:${pad(arg.event.start!.getMinutes())}`;
  const minutes = arg.event.end ? (arg.event.end.getTime() - arg.event.start!.getTime()) / 60000 : 60;
  const compact = arg.view.type === "dayGridMonth" || minutes < 30;

  if (arg.view.type === "listWeek") {
    return (
      <div className="flex w-full items-center justify-between gap-4">
        <div className="min-w-0">
          <p className={cn("font-semibold", cancelled && "line-through opacity-60")}>{s.class.name}</p>
          <p className="text-xs text-muted-foreground">{s.trainer?.name ?? "Sin entrenador"}{s.class.room ? ` · ${s.class.room}` : ""}{s.isExtra ? " · sesión especial" : ""}</p>
        </div>
        <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
          {cancelled ? (
            <span className="font-semibold text-rose-700">Cancelada</span>
          ) : (
            <>
              {s.capacity <= 12 && <Seats booked={s.booked} capacity={s.capacity} color={color} />}
              <span className={cn(full && "font-semibold text-rose-700")}>{full ? "Llena" : `${s.booked} de ${s.capacity} · ${s.capacity - s.booked} libres`}</span>
            </>
          )}
          {s.waitlist > 0 && <span className="text-amber-700">· {s.waitlist} en espera</span>}
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn("gym-event relative h-full w-full overflow-hidden rounded-[10px] px-2 py-1.5 transition-transform", past && "opacity-55", cancelled && "gym-event--cancelled")}
      title={past ? "Esta clase ya pasó: no se puede mover" : cancelled ? "Clase cancelada: reactívala para moverla" : "Arrastra para cambiarla de hora en esta fecha"}
      style={{ ["--ev" as string]: color, color: ink(color) }}
    >
      <div className="flex items-baseline justify-between gap-1">
        <span className="truncate text-[11px] font-medium tabular-nums opacity-80">{time}</span>
        {s.isExtra && <span className="shrink-0 text-[9px] font-semibold opacity-70">Especial</span>}
      </div>
      <p className={cn("truncate text-[13px] font-semibold leading-tight", cancelled && "line-through")}>{s.class.name}</p>
      {!compact && (
        <>
          {s.trainer && <p className="truncate text-[11px] opacity-75">{s.trainer.name}</p>}
          <div className="mt-1 flex items-center gap-1.5 text-[10px] font-medium">
            {cancelled ? (
              <span>Cancelada</span>
            ) : (
              <>
                <Seats booked={s.booked} capacity={s.capacity} color={color} />
                {full && <span className="text-rose-700">{s.waitlist ? `+${s.waitlist} espera` : "Llena"}</span>}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Gym class calendar on FullCalendar: week and day time grids, month and agenda,
 * drag to move a session, drag on empty time to add one.
 */
export function ClassCalendar({ sessions, loading, trainers, classes, onRangeChange, onOpenSession, onMove, onSelectSlot }: ClassCalendarProps) {
  const ref = useRef<FullCalendar>(null);
  const [view, setView] = useState<View>("timeGridWeek");
  const [title, setTitle] = useState("");
  const [trainerFilter, setTrainerFilter] = useState("all");
  const [classFilter, setClassFilter] = useState("all");

  const visible = useMemo(
    () => sessions.filter((s) => (trainerFilter === "all" || s.trainer?.id === trainerFilter) && (classFilter === "all" || s.class.id === classFilter)),
    [sessions, trainerFilter, classFilter],
  );

  const events = useMemo(
    () =>
      visible.map((s) => ({
        id: s.id,
        start: s.startsAt,
        end: s.endsAt,
        title: s.class.name,
        // Past and cancelled sessions stay put
        editable: s.status === "SCHEDULED" && new Date(s.endsAt) > new Date(),
        extendedProps: { session: s },
        backgroundColor: "transparent",
        borderColor: "transparent",
      })),
    [visible],
  );

  // Hours shown: from an hour before the first class to an hour after the last one
  const [slotMin, slotMax] = useMemo(() => {
    if (!sessions.length) return ["06:00:00", "22:00:00"];
    let min = 24, max = 0;
    for (const s of sessions) {
      const a = new Date(s.startsAt), b = new Date(s.endsAt);
      min = Math.min(min, a.getHours());
      max = Math.max(max, b.getHours() + (b.getMinutes() ? 1 : 0));
    }
    return [`${pad(Math.max(0, Math.min(6, min - 1)))}:00:00`, `${pad(Math.min(24, Math.max(22, max + 1)))}:00:00`];
  }, [sessions]);

  // Opens scrolled to the first class of the day
  const scrollTime = useMemo(() => {
    if (!sessions.length) return "06:00:00";
    const first = Math.min(...sessions.map((s) => new Date(s.startsAt).getHours()));
    return `${pad(Math.max(0, first - 1))}:00:00`;
  }, [sessions]);

  const api = () => ref.current?.getApi();

  return (
    <div className="gym-calendar flex flex-col gap-4">
      <style>{CALENDAR_CSS}</style>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="size-9" onClick={() => api()?.prev()} title="Anterior"><IconChevronLeft size={18} /></Button>
          <Button variant="outline" size="icon" className="size-9" onClick={() => api()?.next()} title="Siguiente"><IconChevronRight size={18} /></Button>
          <Button variant="outline" size="sm" className="h-9" onClick={() => api()?.today()}>Hoy</Button>
          <h2 className="ml-2 text-lg font-semibold first-letter:uppercase">{title}</h2>
          {loading && <span className="ml-1 size-1.5 animate-pulse rounded-full bg-primary" />}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={trainerFilter} onValueChange={setTrainerFilter}>
            <SelectTrigger size="sm" className="w-52"><SelectValue placeholder="Entrenador" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los entrenadores</SelectItem>
              {trainers.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={classFilter} onValueChange={setClassFilter}>
            <SelectTrigger size="sm" className="w-40"><SelectValue placeholder="Clase" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las clases</SelectItem>
              {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Tabs value={view} onValueChange={(v) => { setView(v as View); api()?.changeView(v); }}>
            <TabsList>
              {VIEWS.map(([key, label]) => <TabsTrigger key={key} value={key}>{label}</TabsTrigger>)}
            </TabsList>
          </Tabs>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card">
        <FullCalendar
          ref={ref}
          plugins={[timeGridPlugin, dayGridPlugin, listPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          locale={esLocale}
          firstDay={1}
          headerToolbar={false}
          height={view === "listWeek" || view === "dayGridMonth" ? "auto" : "calc(100vh - 230px)"}
          scrollTime={scrollTime}
          expandRows
          allDaySlot={false}
          nowIndicator
          slotMinTime={slotMin}
          slotMaxTime={slotMax}
          slotDuration="00:30:00"
          snapDuration="00:15:00"
          slotLabelFormat={{ hour: "numeric", minute: "2-digit", meridiem: "short" }}
          eventTimeFormat={{ hour: "numeric", minute: "2-digit", meridiem: "short" }}
          dayHeaderContent={(arg) => {
            // Month and agenda headers come as text from the calendar (already in the right day)
            if (arg.view.type === "dayGridMonth") return <span className="text-[11px] font-medium text-muted-foreground">{arg.text}</span>;
            if (arg.view.type.startsWith("list")) {
              const label = arg.date.toLocaleDateString("es-VE", { weekday: "long", day: "numeric", month: "long" });
              return <span className={cn("block px-1 text-left text-sm font-semibold", arg.isToday && "text-primary")}>{label.charAt(0).toUpperCase() + label.slice(1)}{arg.isToday ? " · hoy" : ""}</span>;
            }
            return (
              <div className={cn("flex flex-col items-center py-1.5 leading-none", arg.isToday && "text-primary")}>
                <span className="text-[11px] font-medium text-muted-foreground">{arg.date.toLocaleDateString("es-VE", { weekday: "short" }).replace(".", "")}</span>
                <span className={cn("mt-1 flex size-8 items-center justify-center rounded-full text-base font-semibold", arg.isToday && "bg-primary text-primary-foreground")}>{arg.date.getDate()}</span>
              </div>
            );
          }}
          listDayFormat={{ weekday: "long", day: "numeric", month: "long" }}
          listDaySideFormat={false}
          events={events}
          eventContent={(arg) => <EventCard arg={arg} />}
          eventClassNames="gym-fc-event"
          eventClick={(arg: EventClickArg) => onOpenSession(arg.event.id)}
          editable
          eventDurationEditable
          eventDrop={(arg: EventDropArg) => onMove(arg.event.extendedProps.session, arg.event.start!, arg.event.end!, arg.revert)}
          eventResize={(arg: EventResizeDoneArg) => onMove(arg.event.extendedProps.session, arg.event.start!, arg.event.end!, arg.revert)}
          selectable
          selectMirror
          selectAllow={(info) => info.start > new Date()}
          select={(arg: DateSelectArg) => { onSelectSlot(arg.start, arg.end); arg.view.calendar.unselect(); }}
          datesSet={(arg: DatesSetArg) => { setTitle(arg.view.title); onRangeChange(arg.start, arg.end); }}
          dayMaxEvents={3}
          noEventsContent={() => (
            <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
              <IconUsers size={28} className="opacity-40" />
              <span>No hay clases en estas fechas.</span>
            </div>
          )}
        />
      </div>
      <p className="text-xs text-muted-foreground">Arrastra una clase para cambiarla de hora solo en esa fecha (las que ya pasaron o están canceladas no se mueven). Arrastra sobre un espacio vacío para crear una clase o una sesión especial.</p>
    </div>
  );
}

/** FullCalendar themed with the dashboard tokens; events drawn by EventCard. */
export const CALENDAR_CSS = `
.gym-calendar .fc { --fc-border-color: var(--border); --fc-page-bg-color: transparent; --fc-neutral-bg-color: var(--muted); --fc-today-bg-color: color-mix(in oklab, var(--primary) 4%, transparent); --fc-now-indicator-color: var(--primary); --fc-list-event-hover-bg-color: var(--muted); font-family: inherit; }
.gym-calendar .fc .fc-scrollgrid { border: 0; }
.gym-calendar .fc th { border-left: 0; border-right: 0; }
.gym-calendar .fc .fc-col-header-cell { background: transparent; }
.gym-calendar .fc .fc-timegrid-slot { height: 3rem; border-color: color-mix(in oklab, var(--border) 60%, transparent); }
.gym-calendar .fc .fc-timegrid-slot-minor { border-top-style: dotted; }
.gym-calendar .fc .fc-timegrid-slot-label-cushion, .gym-calendar .fc .fc-timegrid-axis-cushion { font-size: 11px; color: var(--muted-foreground); text-transform: lowercase; }
.gym-calendar .fc .fc-timegrid-col.fc-day-today { background: var(--fc-today-bg-color); }
.gym-calendar .fc .fc-timegrid-now-indicator-line { border-width: 2px 0 0; }
.gym-calendar .fc .fc-timegrid-now-indicator-arrow { border-color: var(--primary); border-top-color: transparent; border-bottom-color: transparent; }
.gym-calendar .fc .fc-highlight { background: color-mix(in oklab, var(--primary) 12%, transparent); border-radius: 10px; }
.gym-calendar .fc .fc-timegrid-event-harness-inset .fc-timegrid-event, .gym-calendar .fc .fc-timegrid-event { box-shadow: none; }
.gym-calendar .fc .gym-fc-event { background: transparent; border: 0; padding: 1px; cursor: pointer; }
.gym-calendar .fc .fc-daygrid-event.gym-fc-event { margin: 1px 4px; }
/* Event: pale fill of the class color, a hair of its tone around, lifts on hover */
.gym-calendar .gym-event { background: color-mix(in oklab, var(--ev) 30%, var(--card)); box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--ev) 45%, transparent); }
.gym-calendar .fc-event-draggable:hover .gym-event { background: color-mix(in oklab, var(--ev) 38%, var(--card)); transform: translateY(-1px); box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--ev) 60%, transparent), 0 8px 18px -8px color-mix(in oklab, var(--ev) 70%, transparent); }
.gym-calendar .fc-event-draggable { cursor: grab; }
.gym-calendar .fc-event-dragging, .gym-calendar .fc-event-dragging * { cursor: grabbing; }
.gym-calendar .gym-event--cancelled { background: repeating-linear-gradient(135deg, color-mix(in oklab, var(--ev) 16%, var(--card)) 0 6px, var(--card) 6px 12px); }
.gym-calendar .fc .fc-event-mirror .gym-event { box-shadow: 0 10px 24px -10px rgba(0,0,0,.35); }
.gym-calendar .fc .fc-daygrid-day-number { font-size: 12px; padding: 6px 8px; color: var(--muted-foreground); }
.gym-calendar .fc .fc-day-today .fc-daygrid-day-number { color: var(--primary); font-weight: 700; }
.gym-calendar .fc .fc-daygrid-more-link { font-size: 11px; color: var(--muted-foreground); }
.gym-calendar .fc .fc-list { border: 0; }
.gym-calendar .fc .fc-list-day-cushion { background: color-mix(in oklab, var(--muted) 70%, transparent); padding: 10px 14px; }
.gym-calendar .fc .fc-list-day th { border-left: 0; border-right: 0; }
.gym-calendar .fc .fc-list-event-time { font-size: 12px; color: var(--muted-foreground); white-space: nowrap; }
.gym-calendar .fc .fc-list-event-graphic { display: none; }
.gym-calendar .fc .fc-list-event td { padding: 10px 14px; }
.gym-calendar .fc .fc-list-event:hover td { background: var(--muted); }
`;
