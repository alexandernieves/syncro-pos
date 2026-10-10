"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { IconCheck, IconCopy, IconDoor, IconFaceId, IconKey, IconLoader2, IconPlugConnected, IconPlus, IconRefresh, IconServer, IconUserScan } from "@tabler/icons-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { API_URL } from "@/lib/constants";
import { gymApi } from "@/lib/gym";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PosTable } from "@/components/pos-table";
import { StatCard, StatGrid } from "@/components/stat-card";
import { GymPage, GymPageHeader, PersonCell } from "@/components/gym/gym-ui";

type Device = {
  id: string;
  name: string;
  model: string;
  location: string | null;
  mode: "VALIDITY" | "STRICT";
  doorNo: number;
  keyPrefix: string;
  isActive: boolean;
  online: boolean;
  lastSeenAt: string | null;
  lastSyncAt: string | null;
  status: { deviceOnline?: boolean; device?: { model?: string; serialNumber?: string; firmware?: string } | null; usersOnDevice?: number | null; lastError?: string | null; bridgeVersion?: string } | null;
};
type Faces = { members: number; synced: number; failed: number; noPhoto: number; pending: number };
type DeviceEvent = { id: string; occurredAt: string; deviceGranted: boolean; syncroGranted: boolean | null; reason: string | null; employeeNo: string | null; device: { name: string }; member: { id: string; memberNumber: number; photoUrl: string | null; client: { name: string } } | null };
type FaceIssue = { id: string; memberNumber: number; photoUrl: string | null; faceError: string | null; faceSyncedAt: string | null; client: { name: string } };

const ago = (d: string | null) => {
  if (!d) return "nunca";
  const s = Math.round((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return `hace ${s} s`;
  if (s < 3600) return `hace ${Math.round(s / 60)} min`;
  return new Date(d).toLocaleString("es-VE", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
};

function KeyDialog({ data, onClose }: { data: { name: string; key: string } | null; onClose: () => void }) {
  const env = data ? `# cd gym-bridge && npm ci && nano .env\nSYNCRO_URL=${API_URL}\nDEVICE_KEY=${data.key}\nDEVICE_HOST=http://192.168.1.50\nDEVICE_USER=admin\nDEVICE_PASS=la-clave-del-lector\n\n# npm run check` : "";
  const copy = (t: string) => navigator.clipboard.writeText(t).then(() => toast.success("Copiado"));
  return (
    <Dialog open={!!data} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Conecta {data?.name}</DialogTitle>
          <DialogDescription>Esta clave se muestra una sola vez. Guárdala en el archivo de configuración del puente en tu servidor.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between"><Label>Clave del lector</Label><Button size="sm" variant="ghost" className="h-7 gap-1.5" onClick={() => copy(data!.key)}><IconCopy size={14} /> Copiar</Button></div>
            <code className="block break-all rounded-lg bg-muted px-3 py-2 font-mono text-xs">{data?.key}</code>
          </div>
          <ol className="space-y-3">
            <li className="flex gap-3"><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">1</span><span>En el lector: ponle una IP fija, activa ISAPI y configura la hora con la zona del gimnasio (NTP).</span></li>
            <li className="flex gap-3"><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">2</span><span>En el servidor Ubuntu: copia la carpeta del puente, instala sus dependencias y crea su archivo de configuración con estos datos (pon la IP, el usuario y la clave de tu lector):</span></li>
          </ol>
          <div className="relative">
            <pre className="overflow-x-auto rounded-lg bg-zinc-950 p-3 font-mono text-xs leading-relaxed text-zinc-100">{env}</pre>
            <Button size="sm" variant="secondary" className="absolute right-2 top-2 h-7 gap-1.5" onClick={() => copy(env)}><IconCopy size={14} /> Copiar</Button>
          </div>
          <ol start={3} className="space-y-3">
            <li className="flex gap-3"><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">3</span><span>Ejecuta la prueba de conexión y, si todo sale bien, instala el servicio como explica el README del puente. En unos segundos este lector aparecerá conectado.</span></li>
          </ol>
        </div>
        <DialogFooter><Button onClick={onClose}>Listo, la guardé</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeviceDialog({ device, open, onClose, onSaved }: { device: Device | null; open: boolean; onClose: () => void; onSaved: (key?: { name: string; key: string }) => void }) {
  const [f, setF] = useState({ name: "", location: "", mode: "VALIDITY" as Device["mode"], doorNo: "1", isActive: true });
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) setF(device ? { name: device.name, location: device.location ?? "", mode: device.mode, doorNo: String(device.doorNo), isActive: device.isActive } : { name: "Entrada principal", location: "", mode: "VALIDITY", doorNo: "1", isActive: true }); }, [open, device]);
  const save = async () => {
    setSaving(true);
    try {
      if (device) {
        await gymApi(`/devices/${device.id}`, { method: "PUT", json: { ...f, doorNo: Number(f.doorNo) } });
        toast.success("Lector actualizado");
        onSaved();
      } else {
        const r = await gymApi<{ device: Device; key: string }>("/devices", { method: "POST", json: { ...f, doorNo: Number(f.doorNo) } });
        onSaved({ name: r.device.name, key: r.key });
      }
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
          <DialogTitle>{device ? "Editar lector" : "Agregar lector facial"}</DialogTitle>
          <DialogDescription>Hikvision DS-K1T341CMFW conectado por el puente en tu servidor local.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5"><Label>Nombre</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Ubicación</Label><Input value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} placeholder="Opcional" /></div>
        </div>
        <div className="space-y-2">
          <Label>¿Quién decide si alguien entra?</Label>
          {([
            ["VALIDITY", "El lector, con las fechas de Syncro", "Syncro carga a cada socio con la fecha hasta la que puede entrar (incluye gracia, congelamientos, firmas y deudas). Funciona aunque se caiga internet. Recomendado."],
            ["STRICT", "Syncro, entrada por entrada", "Aplica también horarios del plan, entradas por día y tiempo entre entradas. El puente abre la puerta cuando Syncro aprueba; sin internet no entra nadie por rostro."],
          ] as const).map(([k, title, text]) => (
            <button key={k} type="button" onClick={() => setF({ ...f, mode: k })} className={cn("w-full rounded-xl p-3 text-left outline-none transition", f.mode === k ? "bg-primary/10 ring-1 ring-primary/40" : "bg-muted/40 hover:bg-muted")}>
              <span className="block text-sm font-semibold">{title}</span>
              <span className="block text-xs text-muted-foreground">{text}</span>
            </button>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving || !f.name.trim()} className="gap-2">{saving && <IconLoader2 size={16} className="animate-spin" />} {device ? "Guardar" : "Crear y ver la clave"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function GymAccessPage() {
  const router = useRouter();
  const [data, setData] = useState<{ devices: Device[]; faces: Faces } | null>(null);
  const [events, setEvents] = useState<DeviceEvent[] | null>(null);
  const [issues, setIssues] = useState<FaceIssue[] | null>(null);
  const [tab, setTab] = useState<"events" | "faces">("events");
  const [dialog, setDialog] = useState<{ open: boolean; device: Device | null }>({ open: false, device: null });
  const [keyInfo, setKeyInfo] = useState<{ name: string; key: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    gymApi<{ devices: Device[]; faces: Faces }>("/devices").then(setData).catch((e) => toast.error(e.message));
    gymApi<DeviceEvent[]>("/devices/events").then(setEvents).catch(() => setEvents([]));
    gymApi<FaceIssue[]>("/devices/faces").then(setIssues).catch(() => setIssues([]));
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 10000); return () => clearInterval(t); }, [load]);

  const command = async (d: Device, type: "OPEN_DOOR" | "RESYNC") => {
    setBusy(d.id + type);
    try {
      const r = await gymApi<{ online: boolean }>(`/devices/${d.id}/command`, { method: "POST", json: { type } });
      toast.success(type === "OPEN_DOOR" ? "Orden enviada: la puerta se abre en unos segundos" : "Se volverá a cargar todo el padrón en el lector", { description: r.online ? undefined : "El puente no está conectado ahora; se hará cuando vuelva." });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  const rotate = async (d: Device) => {
    if (!confirm(`¿Generar una clave nueva para ${d.name}? El puente dejará de funcionar hasta que pongas la nueva clave en su .env.`)) return;
    try {
      const r = await gymApi<{ key: string }>(`/devices/${d.id}/key`, { method: "POST" });
      setKeyInfo({ name: d.name, key: r.key });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const eventColumns = useMemo<ColumnDef<DeviceEvent>[]>(
    () => [
      { id: "when", header: "Hora", accessorFn: (e) => e.occurredAt, cell: ({ getValue }) => <span className="tabular-nums text-muted-foreground">{new Date(getValue<string>()).toLocaleString("es-VE", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", second: "2-digit" })}</span> },
      { id: "who", header: "Persona", accessorFn: (e) => e.member?.client.name ?? "", cell: ({ row }) => (row.original.member ? <PersonCell src={row.original.member.photoUrl} name={row.original.member.client.name} sub={`N.º ${row.original.member.memberNumber}`} /> : <span className="text-muted-foreground">{row.original.employeeNo ? `N.º ${row.original.employeeNo} (no está en Syncro)` : "Rostro desconocido"}</span>) },
      {
        id: "result",
        header: "Resultado",
        accessorFn: (e) => (e.deviceGranted ? "Entró" : "No entró"),
        cell: ({ row }) => {
          const e = row.original;
          // Strict mode: the reader says no and Syncro opens the door when it approves
          const late = !!e.reason?.startsWith("Evento atrasado");
          const validityDenied = !!e.reason?.startsWith("El lector negó");
          const entered = e.deviceGranted || (e.syncroGranted === true && !late && !validityDenied);
          const mismatch = !!e.reason?.startsWith("Entró por el lector") || validityDenied;
          return (
            <div className="space-y-0.5">
              <Badge variant="outline" className={cn(entered ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700" : "border-rose-500/30 bg-rose-500/10 text-rose-700")}>{entered ? "Entró" : "No entró"}</Badge>
              {mismatch && <p className="text-xs text-amber-700">El lector y Syncro no coincidieron</p>}
            </div>
          );
        },
      },
      { id: "reason", header: "Detalle", accessorFn: (e) => e.reason ?? "", cell: ({ getValue }) => <span className="text-sm text-muted-foreground">{getValue<string>() || "—"}</span> },
      { id: "device", header: "Lector", accessorFn: (e) => e.device.name, cell: ({ getValue }) => <span className="text-muted-foreground">{getValue<string>()}</span> },
    ],
    [],
  );
  const faceColumns = useMemo<ColumnDef<FaceIssue>[]>(
    () => [
      { id: "member", header: "Socio", accessorFn: (m) => m.client.name, cell: ({ row }) => <PersonCell src={row.original.photoUrl} name={row.original.client.name} sub={`N.º ${row.original.memberNumber}`} /> },
      {
        id: "issue",
        header: "Rostro",
        accessorFn: (m) => m.faceError ?? (m.photoUrl ? "Pendiente" : "Sin foto"),
        cell: ({ row }) => {
          const m = row.original;
          return m.faceError ? <span className="text-sm text-rose-700">{m.faceError}</span> : !m.photoUrl ? <span className="text-sm text-amber-700">Sin foto: tómale una en su ficha</span> : <span className="text-sm text-muted-foreground">Pendiente de cargar en el lector</span>;
        },
      },
    ],
    [],
  );

  const devices = data?.devices ?? [];
  const faces = data?.faces;

  return (
    <GymPage>
      <GymPageHeader title="Control de acceso" description="Lector facial en la puerta: quién está cargado, qué pasa en cada entrada y el estado de la conexión." actions={<Button className="gap-2" onClick={() => setDialog({ open: true, device: null })}><IconPlus size={16} /> Agregar lector</Button>} />
      <StatGrid>
        <StatCard label="Lectores conectados" value={data ? `${devices.filter((d) => d.online).length}/${devices.filter((d) => d.isActive).length}` : "—"} icon={<IconPlugConnected size={20} />} tone={devices.some((d) => d.isActive && !d.online) ? "bad" : "good"} title={devices.some((d) => d.isActive && !d.online) ? "Revisa el servidor o la red" : devices.length ? "Todo en línea" : "Agrega tu primer lector"} hint="El puente reporta cada 5 segundos" />
        <StatCard label="Rostros cargados" value={faces ? `${faces.synced}/${faces.members}` : "—"} icon={<IconFaceId size={20} />} tone="primary" title={faces?.failed ? `${faces.failed} con error` : "Sin errores"} hint="Socios con su cara en el lector" onClick={() => setTab("faces")} />
        <StatCard label="Sin foto" value={faces?.noPhoto ?? "—"} icon={<IconUserScan size={20} />} tone={faces?.noPhoto ? "warn" : "default"} title="Tómales una foto en su ficha" hint="Sin foto entran solo por recepción" onClick={() => setTab("faces")} />
        <StatCard label="Lecturas de rostro" value={events?.filter((e) => new Date(e.occurredAt).toDateString() === new Date().toDateString()).length ?? "—"} icon={<IconDoor size={20} />} title="Hoy, incluidos los no reconocidos" hint="Las entradas aparecen en recepción" />
      </StatGrid>

      {data && !devices.length && (
        <Card className="gap-0 py-0">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary"><IconFaceId size={24} /></span>
            <p className="font-semibold">Conecta tu lector facial</p>
            <p className="max-w-md text-sm text-muted-foreground">El lector Hikvision se conecta a Syncro por un pequeño programa (el puente) en un servidor de tu red local. No necesitas abrir puertos ni IP pública.</p>
            <Button className="mt-2 gap-2" onClick={() => setDialog({ open: true, device: null })}><IconPlus size={16} /> Agregar lector</Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        {devices.map((d) => {
          const st = d.status;
          return (
            <Card key={d.id} className={cn("gap-3", !d.isActive && "opacity-60")}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className={cn("flex size-11 items-center justify-center rounded-xl", d.online ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground")}><IconFaceId size={22} /></span>
                    <div>
                      <CardTitle>{d.name}</CardTitle>
                      <CardDescription>{st?.device?.model || d.model}{d.location ? ` · ${d.location}` : ""} · {d.mode === "STRICT" ? "decide Syncro" : "decide el lector con fechas de Syncro"}</CardDescription>
                    </div>
                  </div>
                  <Badge variant="outline" className={cn("gap-1.5", d.online ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700" : "border-rose-500/30 bg-rose-500/10 text-rose-700")}><span className="size-1.5 rounded-full bg-current" />{d.online ? "Conectado" : "Sin conexión"}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  <div><p className="text-xs text-muted-foreground">Puente</p><p className="flex items-center gap-1">{d.online ? <IconCheck size={14} className="text-emerald-600" /> : null}{ago(d.lastSeenAt)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Lector</p><p>{d.lastSeenAt ? (st?.deviceOnline ? "Responde" : "No responde") : "—"}</p></div>
                  <div><p className="text-xs text-muted-foreground">Personas cargadas</p><p className="tabular-nums">{st?.usersOnDevice ?? "—"}</p></div>
                  <div><p className="text-xs text-muted-foreground">Última carga</p><p>{ago(d.lastSyncAt)}</p></div>
                </div>
                {st?.device?.serialNumber && <p className="text-xs text-muted-foreground">Serie {st.device.serialNumber} · firmware {st.device.firmware} · puente {st.bridgeVersion}</p>}
                {st?.lastError && <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-700">{st.lastError}</p>}
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" className="gap-1.5" disabled={!d.isActive || busy === d.id + "OPEN_DOOR"} onClick={() => command(d, "OPEN_DOOR")}><IconDoor size={14} /> Abrir puerta</Button>
                  <Button size="sm" variant="outline" className="gap-1.5" disabled={!d.isActive || busy === d.id + "RESYNC"} onClick={() => command(d, "RESYNC")}><IconRefresh size={14} /> Recargar padrón</Button>
                  <Button size="sm" variant="ghost" onClick={() => setDialog({ open: true, device: d })}>Editar</Button>
                  <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => rotate(d)}><IconKey size={14} /> Nueva clave</Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {devices.length > 0 && (
        <>
          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
            <TabsList>
              <TabsTrigger value="events">Entradas por rostro</TabsTrigger>
              <TabsTrigger value="faces">Rostros por revisar{issues?.length ? ` · ${issues.length}` : ""}</TabsTrigger>
            </TabsList>
          </Tabs>
          {tab === "events" ? (
            <PosTable columns={eventColumns} data={events ?? []} loading={!events} searchPlaceholder="Buscar persona…" getRowId={(e) => e.id} onRowClick={(e) => e.member && router.push(`/dashboard/gimnasio/socios?socio=${e.member.id}`)} emptyMessage="Todavía no hay entradas por el lector." />
          ) : (
            <PosTable columns={faceColumns} data={issues ?? []} loading={!issues} searchPlaceholder="Buscar socio…" getRowId={(m) => m.id} onRowClick={(m) => router.push(`/dashboard/gimnasio/socios?socio=${m.id}`)} emptyMessage="Todos los socios tienen su rostro cargado." />
          )}
        </>
      )}

      <Card className="gap-2">
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><IconServer size={18} className="text-muted-foreground" /> Cómo funciona</CardTitle></CardHeader>
        <CardContent className="grid gap-3 text-sm text-muted-foreground md:grid-cols-3">
          <p>El puente corre en tu servidor Ubuntu, en la misma red del lector. Se conecta a Syncro hacia afuera: no hace falta abrir puertos.</p>
          <p>Syncro le pasa al lector a cada socio con su foto y la fecha hasta la que puede entrar. Al renovar, congelar o bloquear a alguien, el lector se actualiza en menos de un minuto.</p>
          <p>Cada vez que alguien pasa la cara, la entrada queda registrada en recepción y en los reportes, igual que una entrada manual.</p>
        </CardContent>
      </Card>

      <DeviceDialog device={dialog.device} open={dialog.open} onClose={() => setDialog({ open: false, device: null })} onSaved={(k) => { load(); if (k) setKeyInfo(k); }} />
      <KeyDialog data={keyInfo} onClose={() => setKeyInfo(null)} />
    </GymPage>
  );
}
