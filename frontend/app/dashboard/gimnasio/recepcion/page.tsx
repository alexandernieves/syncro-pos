"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  IconAlertTriangle,
  IconCircleCheckFilled,
  IconCircleXFilled,
  IconDoorEnter,
  IconLoader2,
  IconRefresh,
  IconSearch,
  IconTicket,
  IconUser,
  IconUsers,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { type GymMemberRow, STATUS_LABEL, gymApi, shortDate } from "@/lib/gym";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard, StatGrid } from "@/components/stat-card";
import { GymPage, GymPageHeader, MemberAvatar } from "@/components/gym/gym-ui";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VisitDialog } from "@/components/gym/visit-dialog";
import { money } from "@/lib/gym";

type CheckInResult = {
  member: GymMemberRow;
  granted: boolean;
  overridden?: boolean;
  reason: string;
  warnings: string[];
  checkIn: { id: string; createdAt: string };
};

type CheckInRow = {
  id: string;
  granted: boolean;
  reason: string | null;
  method: string;
  createdAt: string;
  member: { id: string; memberNumber: number; photoUrl: string | null; client: { name: string } } | null;
};

type VisitRow = {
  id: string;
  kind: "GUEST" | "DAY_PASS" | "VISITOR";
  name: string;
  price: number;
  checkedInAt: string;
  checkedOutAt: string | null;
  hostMember: { id: string; memberNumber: number; client: { name: string } } | null;
  lead: { id: string; stage: string } | null;
};
type OnDuty = { id: string; startsAt: string; endsAt: string; area: string | null; clockInAt: string | null; staff: { id: string; name: string; role: string } };
const VISIT_LABEL: Record<VisitRow["kind"], string> = { GUEST: "Invitado", DAY_PASS: "Pase de día", VISITOR: "Visita" };

const time = (d: string) => new Date(d).toLocaleTimeString("es-VE", { hour: "numeric", minute: "2-digit" });

function Avatar({ src, name, size }: { src?: string | null; name: string; size: number }) {
  return <MemberAvatar src={src} name={name} size={size} />;
}

export default function GymReceptionPage() {
  const [q, setQ] = useState("");
  const [matches, setMatches] = useState<GymMemberRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [active, setActive] = useState(0);
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [overrideNote, setOverrideNote] = useState("");
  const [showOverride, setShowOverride] = useState(false);
  const [feed, setFeed] = useState<{ items: CheckInRow[]; granted: number; denied: number; uniqueMembers: number } | null>(null);
  const [visits, setVisits] = useState<{ items: VisitRow[]; revenue: number; inside: number } | null>(null);
  const [visitOpen, setVisitOpen] = useState(false);
  const [dayPassPrice, setDayPassPrice] = useState(5);
  const [feedTab, setFeedTab] = useState<"entries" | "visits">("entries");
  const [onDuty, setOnDuty] = useState<OnDuty[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestRef = useRef(0);

  const loadFeed = useCallback(() => {
    gymApi("/check-ins").then(setFeed).catch(() => {});
    gymApi("/visits").then(setVisits).catch(() => {});
    gymApi<OnDuty[]>("/shifts/on-duty").then(setOnDuty).catch(() => {});
  }, []);
  useEffect(() => {
    gymApi<{ visits: { dayPassPrice: number } }>("/settings").then((s) => setDayPassPrice(s.visits.dayPassPrice)).catch(() => {});
  }, []);

  useEffect(() => {
    loadFeed();
    const timer = setInterval(loadFeed, 15000);
    return () => clearInterval(timer);
  }, [loadFeed]);

  // Search as you type; a card or barcode reader that types the cédula + Enter also works
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setMatches([]); return; }
    const id = ++requestRef.current;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const data = await gymApi<{ items: GymMemberRow[] }>(`/members?${new URLSearchParams({ q: term, pageSize: "8" })}`);
        if (id === requestRef.current) { setMatches(data.items); setActive(0); }
      } catch {
        if (id === requestRef.current) setMatches([]);
      } finally {
        if (id === requestRef.current) setSearching(false);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [q]);

  const checkIn = async (member: GymMemberRow, override = false) => {
    setChecking(true);
    try {
      const res = await gymApi<CheckInResult>("/check-ins", { method: "POST", json: { memberId: member.id, override, note: override ? overrideNote : undefined } });
      setResult(res);
      setShowOverride(false);
      setOverrideNote("");
      setQ("");
      setMatches([]);
      loadFeed();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setChecking(false);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  const m = result?.member;

  return (
    <GymPage>
      <GymPageHeader
        title="Recepción"
        description="Busca al socio por nombre, cédula o número para registrar su entrada."
        actions={<Button variant="outline" className="gap-2" onClick={() => setVisitOpen(true)}><IconTicket size={16} /> Registrar visita</Button>}
      />
      <StatGrid>
        <StatCard label="Entradas hoy" value={feed?.granted ?? "—"} tone="good" icon={<IconDoorEnter size={20} />} title="Accesos permitidos" hint="Se actualiza cada 15 segundos" />
        <StatCard label="Socios distintos" value={feed?.uniqueMembers ?? "—"} icon={<IconUsers size={20} />} title="Personas que entraron hoy" hint="Cada socio cuenta una vez" />
        <StatCard label="Denegados" value={feed?.denied ?? "—"} tone={feed?.denied ? "bad" : "default"} icon={<IconCircleXFilled size={20} />} title="Intentos sin acceso" hint="Vencidos, congelados o bloqueados" />
        <StatCard label="Visitas hoy" value={visits?.items.length ?? "—"} icon={<IconTicket size={20} />} tone="primary" title={visits?.revenue ? `${money(visits.revenue)} en pases` : "Invitados y pases de día"} hint="Gente que entra sin membresía" onClick={() => setFeedTab("visits")} />
      </StatGrid>
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="flex flex-col gap-5">

        {/* Search */}
        <div className="relative">
          <label className="flex h-14 items-center gap-3 rounded-2xl border-2 bg-background px-4 shadow-sm focus-within:border-primary">
            <IconSearch size={22} className="text-muted-foreground" />
            <input
              ref={inputRef}
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(i + 1, matches.length - 1)); }
                if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
                if (e.key === "Enter" && matches[active]) { e.preventDefault(); checkIn(matches[active]); }
                if (e.key === "Escape") { setQ(""); setMatches([]); }
              }}
              placeholder="Nombre, cédula o n.º de socio"
              className="h-full flex-1 bg-transparent text-lg outline-none"
            />
            {(searching || checking) && <IconLoader2 size={20} className="animate-spin text-muted-foreground" />}
          </label>
          {matches.length > 0 && (
            <div className="absolute inset-x-0 top-full z-20 mt-2 overflow-hidden rounded-2xl border bg-popover shadow-xl">
              {matches.map((row, i) => (
                <button
                  key={row.id}
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => checkIn(row)}
                  className={cn("flex w-full items-center gap-3 px-4 py-3 text-left", i === active && "bg-muted")}
                >
                  <Avatar src={row.photoUrl} name={row.client.name} size={40} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{row.client.name}</span>
                    <span className="block text-xs text-muted-foreground">N.º {row.memberNumber}{row.client.documentId ? ` · ${row.client.documentId}` : ""}</span>
                  </span>
                  <span className={cn("text-xs font-semibold", row.status === "ACTIVE" ? "text-emerald-600" : "text-rose-600")}>{STATUS_LABEL[row.status]}</span>
                </button>
              ))}
            </div>
          )}
          {q.trim().length >= 2 && !searching && matches.length === 0 && (
            <p className="mt-2 px-1 text-sm text-muted-foreground">No hay socios con “{q.trim()}”. <Link href="/dashboard/gimnasio/socios?nuevo=1" className="font-medium text-primary hover:underline">Registrar nuevo socio</Link></p>
          )}
        </div>

        {/* Result */}
        {!result ? (
          <Card className="gap-0 py-0">
            <CardContent className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
              <IconDoorEnter size={44} className="opacity-40" />
              <p className="text-sm">El resultado de cada entrada aparece aquí.</p>
            </CardContent>
          </Card>
        ) : (
          <Card key={result.checkIn.id} className={cn("gap-0 overflow-hidden py-0 animate-in fade-in zoom-in-95 duration-200", result.granted ? "border-emerald-500/40" : "border-rose-500/40")}>
            <div className={cn("flex items-center gap-3 px-6 py-4 text-white", result.granted ? "bg-emerald-600" : "bg-rose-600")}>
              {result.granted ? <IconCircleCheckFilled size={32} /> : <IconCircleXFilled size={32} />}
              <div>
                <p className="text-xl font-bold">{result.granted ? (result.overridden ? "Pase autorizado" : "Puede pasar") : "Acceso denegado"}</p>
                <p className="text-sm opacity-90">{result.reason}</p>
              </div>
              <span className="ml-auto text-sm opacity-80">{time(result.checkIn.createdAt)}</span>
            </div>
            <CardContent className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center">
              <Avatar src={m?.photoUrl} name={m?.client.name || ""} size={120} />
              <div className="min-w-0 flex-1 space-y-2">
                <p className="text-2xl font-bold">{m?.client.name}</p>
                <p className="text-sm text-muted-foreground">Socio n.º {m?.memberNumber}{m?.client.documentId ? ` · ${m.client.documentId}` : ""}</p>
                {m?.currentMembership && (
                  <p className="text-sm">{m.currentMembership.planName} · vence {shortDate(m.currentMembership.endDate)}</p>
                )}
                {result.warnings.map((w) => (
                  <p key={w} className="flex items-center gap-1.5 text-sm font-medium text-amber-700"><IconAlertTriangle size={16} /> {w}</p>
                ))}
              </div>
            </CardContent>
            {!result.granted && m && (
              <div className="space-y-3 border-t px-6 py-4">
                <div className="flex flex-wrap gap-2">
                  <Button asChild className="gap-2"><Link href={`/dashboard/gimnasio/socios?socio=${m.id}`}><IconRefresh size={16} /> Renovar membresía</Link></Button>
                  {!showOverride && <Button variant="outline" onClick={() => setShowOverride(true)}>Dejar pasar igual</Button>}
                </div>
                {showOverride && (
                  <div className="flex flex-wrap gap-2">
                    <Input autoFocus value={overrideNote} onChange={(e) => setOverrideNote(e.target.value)} onKeyDown={(e) => e.key === "Enter" && checkIn(m, true)} placeholder="Motivo (ej.: paga hoy en la tarde)" className="min-w-0 flex-1" />
                    <Button variant="outline" disabled={checking || !overrideNote.trim()} onClick={() => checkIn(m, true)}>Autorizar</Button>
                  </div>
                )}
              </div>
            )}
          </Card>
        )}
      </div>

      {/* Today's entries */}
      <Card className="h-fit gap-0 pb-0 xl:sticky xl:top-[calc(var(--header-height)+1rem)]">
        <CardHeader className="border-b pb-4">
          <div className="flex items-center justify-between gap-2">
            <CardTitle>Hoy</CardTitle>
            <Tabs value={feedTab} onValueChange={(v) => setFeedTab(v as "entries" | "visits")}>
              <TabsList className="h-8">
                <TabsTrigger value="entries" className="text-xs">Entradas</TabsTrigger>
                <TabsTrigger value="visits" className="text-xs">Visitas{visits?.inside ? ` · ${visits.inside}` : ""}</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          {onDuty.length > 0 && (
            <CardDescription className="pt-1">En turno: {onDuty.map((d) => `${d.staff.name.split(" ")[0]}${d.area ? ` (${d.area.toLowerCase()})` : ""}`).join(", ")}</CardDescription>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {feedTab === "visits" ? (
            <div className="max-h-[calc(100vh-260px)] divide-y overflow-y-auto">
              {visits && visits.items.length === 0 && <p className="px-4 py-10 text-center text-sm text-muted-foreground">Todavía no hay visitas hoy.</p>}
              {visits?.items.map((v) => (
                <div key={v.id} className="flex items-center gap-3 px-4 py-2.5">
                  <Avatar name={v.name} size={34} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{v.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{VISIT_LABEL[v.kind]}{v.hostMember ? ` de ${v.hostMember.client.name}` : ""}{v.price > 0 ? ` · ${money(v.price)}` : ""}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-0.5">
                    {v.checkedOutAt ? (
                      <span className="text-[11px] text-muted-foreground">Salió {time(v.checkedOutAt)}</span>
                    ) : (
                      <button type="button" className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground" onClick={() => gymApi(`/visits/${v.id}/checkout`, { method: "POST" }).then(loadFeed).catch((e) => toast.error(e.message))}>Marcar salida</button>
                    )}
                    <span className="text-[11px] text-muted-foreground">Entró {time(v.checkedInAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
          <div className="max-h-[calc(100vh-260px)] divide-y overflow-y-auto">
            {feed && feed.items.length === 0 && <p className="px-4 py-10 text-center text-sm text-muted-foreground">Todavía no hay entradas hoy.</p>}
            {feed?.items.map((c) => (
              <div key={c.id} className="flex items-center gap-3 px-4 py-2.5">
                <Avatar src={c.member?.photoUrl} name={c.member?.client.name || "?"} size={34} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{c.member?.client.name ?? "Socio eliminado"}</p>
                  <p className="truncate text-xs text-muted-foreground">{c.reason}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end">
                  {c.granted ? <IconCircleCheckFilled size={18} className="text-emerald-600" /> : <IconCircleXFilled size={18} className="text-rose-600" />}
                  <span className="text-[11px] text-muted-foreground">{time(c.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
          )}
        </CardContent>
      </Card>
    </div>
      <VisitDialog open={visitOpen} onClose={() => setVisitOpen(false)} onSaved={() => { loadFeed(); setFeedTab("visits"); }} dayPassPrice={dayPassPrice} />
    </GymPage>
  );
}
