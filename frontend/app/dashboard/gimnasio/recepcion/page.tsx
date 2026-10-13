"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  IconAlertTriangle,
  IconCheck,
  IconSignature,
  IconX,
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
import { SignDocumentDialog } from "@/components/gym/sign-document-dialog";
import { ReceiptPrinter } from "@/components/pos/receipt-printer";
import { visitReceiptParts } from "@/lib/gym-receipt";
import { API_URL } from "@/lib/constants";
import type { SavedVisit } from "@/components/gym/visit-dialog";
import { money } from "@/lib/gym";

type CheckInResult = {
  member: GymMemberRow;
  granted: boolean;
  overridden?: boolean;
  reason: string;
  warnings: string[];
  pendingDocuments?: { id: string; title: string }[];
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

/** Big, clear answer for the door: green to let in, red to stop, with the member's data at a glance. */
function EntryResult({ result, checking, showOverride, overrideNote, setOverrideNote, onShowOverride, onOverride, onSign }: {
  result: CheckInResult;
  checking: boolean;
  showOverride: boolean;
  overrideNote: string;
  setOverrideNote: (v: string) => void;
  onShowOverride: () => void;
  onOverride: () => void;
  onSign: (templateId: string) => void;
}) {
  const m = result.member;
  const ms = m.currentMembership;
  const ok = result.granted;
  const title = ok ? (result.overridden ? "Pase autorizado" : "Puede pasar") : "Acceso denegado";
  const total = ms ? Math.max(1, (new Date(ms.endDate).getTime() - new Date(ms.startDate).getTime()) / 86400000) : 1;
  const left = m.daysLeft ?? 0;
  const pct = ms && m.daysLeft != null ? Math.max(0, Math.min(100, (left / total) * 100)) : 0;
  return (
    <div className={cn("overflow-hidden rounded-3xl shadow-sm animate-in fade-in zoom-in-95 duration-200", ok ? "bg-emerald-500/[0.07]" : "bg-rose-500/[0.07]")}>
      <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center">
        {/* Photo with the verdict on it */}
        <div className="relative mx-auto shrink-0 sm:mx-0">
          <div className={cn("rounded-full p-1.5", ok ? "bg-emerald-500" : "bg-rose-500")}>
            <div className="rounded-full bg-background p-1"><Avatar src={m.photoUrl} name={m.client.name} size={132} /></div>
          </div>
          <span className={cn("absolute -bottom-1 right-1 flex size-11 items-center justify-center rounded-full text-white shadow-lg ring-4 ring-background", ok ? "bg-emerald-500" : "bg-rose-500")}>
            {ok ? <IconCheck size={24} stroke={3} /> : <IconX size={24} stroke={3} />}
          </span>
        </div>

        <div className="min-w-0 flex-1 space-y-4 text-center sm:text-left">
          <div>
            <p className={cn("text-sm font-semibold", ok ? "text-emerald-700" : "text-rose-700")}>{title} · {time(result.checkIn.createdAt)}</p>
            <p className="truncate text-3xl font-bold tracking-tight">{m.client.name}</p>
            <p className="text-sm text-muted-foreground">Socio n.º {m.memberNumber}{m.client.documentId ? ` · ${m.client.documentId}` : ""}</p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-background/80 p-3">
              <p className="text-[11px] text-muted-foreground">Plan</p>
              <p className="truncate text-sm font-semibold">{ms?.planName ?? "Sin plan"}</p>
            </div>
            <div className="rounded-2xl bg-background/80 p-3">
              <p className="text-[11px] text-muted-foreground">Vence</p>
              <p className="text-sm font-semibold">{ms ? shortDate(ms.endDate) : "—"}</p>
            </div>
            <div className="rounded-2xl bg-background/80 p-3">
              <p className="text-[11px] text-muted-foreground">Quedan</p>
              <p className={cn("text-sm font-semibold tabular-nums", ok && left <= 3 ? "text-amber-700" : "")}>{m.daysLeft != null ? (left === 0 ? "Vence hoy" : `${left} ${left === 1 ? "día" : "días"}`) : "—"}</p>
            </div>
          </div>
          {ms && m.daysLeft != null && (
            <div className="h-1.5 overflow-hidden rounded-full bg-background">
              <div className={cn("h-full rounded-full", left <= 3 ? "bg-amber-500" : ok ? "bg-emerald-500" : "bg-rose-500")} style={{ width: `${pct}%` }} />
            </div>
          )}

          <p className={cn("rounded-2xl px-4 py-2.5 text-sm font-medium", ok ? "bg-emerald-500/10 text-emerald-800" : "bg-rose-500/10 text-rose-800")}>{result.reason}</p>

          {result.warnings.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
              {result.warnings.map((w) => (
                <span key={w} className="flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-800"><IconAlertTriangle size={14} /> {w}</span>
              ))}
            </div>
          )}

          <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
            {!!result.pendingDocuments?.length && (
              <Button size="sm" className="gap-1.5" onClick={() => onSign(result.pendingDocuments![0].id)}><IconSignature size={15} /> Firmar {result.pendingDocuments[0].title.toLowerCase()}</Button>
            )}
            {!ok && (
              <>
                <Button size="sm" asChild className="gap-1.5"><Link href={`/dashboard/gimnasio/socios?socio=${m.id}`}><IconRefresh size={15} /> Renovar membresía</Link></Button>
                {!showOverride && <Button size="sm" variant="outline" onClick={onShowOverride}>Dejar pasar igual</Button>}
              </>
            )}
            {ok && <Button size="sm" variant="ghost" asChild><Link href={`/dashboard/gimnasio/socios?socio=${m.id}`}>Ver ficha</Link></Button>}
          </div>
          {!ok && showOverride && (
            <div className="flex flex-wrap gap-2">
              <Input autoFocus value={overrideNote} onChange={(e) => setOverrideNote(e.target.value)} onKeyDown={(e) => e.key === "Enter" && onOverride()} placeholder="Motivo (ej.: paga hoy en la tarde)" className="min-w-0 flex-1 bg-background" />
              <Button variant="outline" disabled={checking || !overrideNote.trim()} onClick={onOverride}>Autorizar</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
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
  const [signing, setSigning] = useState<string | null>(null);
  const [passReceipt, setPassReceipt] = useState<SavedVisit | null>(null);
  const [bizSettings, setBizSettings] = useState<any>(null);
  useEffect(() => {
    fetch(`${API_URL}/settings`, { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }).then((r) => (r.ok ? r.json() : null)).then(setBizSettings).catch(() => {});
  }, []);
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
        const data = await gymApi<{ items: GymMemberRow[] }>(`/members?${new URLSearchParams({ q: term, pageSize: "8", visiting: "true" })}`);
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
                    <span className="block text-xs text-muted-foreground">N.º {row.memberNumber}{row.client.documentId ? ` · ${row.client.documentId}` : ""}{row.branchId && row.branchId !== localStorage.getItem("currentBranchId") ? ` · socio de ${row.branchName}` : ""}</span>
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
              <span className="flex size-16 items-center justify-center rounded-full bg-muted"><IconDoorEnter size={30} className="opacity-60" /></span>
              <p className="text-sm">Busca a un socio para registrar su entrada.</p>
            </CardContent>
          </Card>
        ) : (
          <EntryResult
            key={result.checkIn.id}
            result={result}
            checking={checking}
            showOverride={showOverride}
            overrideNote={overrideNote}
            setOverrideNote={setOverrideNote}
            onShowOverride={() => setShowOverride(true)}
            onOverride={() => m && checkIn(m, true)}
            onSign={(id) => setSigning(id)}
          />
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
                  <p className="truncate text-xs text-muted-foreground">{c.method === "FACE" ? "Por rostro · " : ""}{c.reason}</p>
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
      {m && <SignDocumentDialog memberId={m.id} templateId={signing} onClose={() => setSigning(null)} onSigned={() => { setResult((r) => (r ? { ...r, pendingDocuments: r.pendingDocuments?.filter((d) => d.id !== signing), warnings: r.warnings.filter((w) => !w.startsWith("Falta firmar")) } : r)); }} />}
      <VisitDialog open={visitOpen} onClose={() => setVisitOpen(false)} onSaved={(v) => { loadFeed(); setFeedTab("visits"); if (v.price > 0) setPassReceipt(v); }} dayPassPrice={dayPassPrice} />
      {passReceipt && (() => {
        const { data, design, business } = visitReceiptParts(passReceipt.visit, passReceipt.price, passReceipt.method, bizSettings, passReceipt.payment);
        return <ReceiptPrinter receipt={data} design={design} business={business} doneLabel="Listo" onDone={() => setPassReceipt(null)} />;
      })()}
    </GymPage>
  );
}
