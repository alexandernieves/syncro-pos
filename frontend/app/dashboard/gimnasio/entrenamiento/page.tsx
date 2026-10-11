"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { IconBarbell, IconClipboardList, IconLoader2, IconPencil, IconPlayerPlay, IconPlus, IconRuler2, IconUsers } from "@tabler/icons-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { gymApi, shortDate } from "@/lib/gym";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PosTable } from "@/components/pos-table";
import { StatCard, StatGrid } from "@/components/stat-card";
import { FilterChips, GymPage, GymPageHeader, PersonCell } from "@/components/gym/gym-ui";
import { type Exercise, type Routine, MUSCLE_GROUPS, RoutineBuilder, groupLabel, levelLabel } from "@/components/gym/routine-builder";
import { bmiLabel } from "@/components/gym/progress";

type RecentAssessment = { id: string; date: string; weightKg: number | null; bodyFatPct: number | null; waistCm: number | null; heightCm: number | null; member: { id: string; memberNumber: number; photoUrl: string | null; client: { name: string } }; trainer: { name: string } | null };

function ExerciseDialog({ item, open, onClose, onSaved }: { item: Exercise | null; open: boolean; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ name: "", muscleGroup: "CHEST", equipment: "", instructions: "", videoUrl: "", isActive: true });
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) setF(item ? { name: item.name, muscleGroup: item.muscleGroup, equipment: item.equipment ?? "", instructions: item.instructions ?? "", videoUrl: item.videoUrl ?? "", isActive: item.isActive } : { name: "", muscleGroup: "CHEST", equipment: "", instructions: "", videoUrl: "", isActive: true }); }, [open, item]);
  const save = async () => {
    setSaving(true);
    try {
      await gymApi(item ? `/exercises/${item.id}` : "/exercises", { method: item ? "PUT" : "POST", json: f });
      toast.success(item ? "Ejercicio actualizado" : `${f.name} quedó en la biblioteca`);
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{item ? "Editar ejercicio" : "Nuevo ejercicio"}</DialogTitle>
          <DialogDescription>La explicación y el video los ve el socio en su rutina.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2"><Label>Nombre</Label><Input autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div className="space-y-1.5">
            <Label>Grupo muscular</Label>
            <select value={f.muscleGroup} onChange={(e) => setF({ ...f, muscleGroup: e.target.value })} className="h-9 w-full rounded-md border bg-background px-2 text-sm">{MUSCLE_GROUPS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          </div>
          <div className="space-y-1.5"><Label>Equipo</Label><Input value={f.equipment} onChange={(e) => setF({ ...f, equipment: e.target.value })} placeholder="Mancuernas, polea…" /></div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Cómo se hace</Label>
            <textarea value={f.instructions} onChange={(e) => setF({ ...f, instructions: e.target.value })} rows={3} className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
          </div>
          <div className="space-y-1.5 sm:col-span-2"><Label>Video (enlace)</Label><Input value={f.videoUrl} onChange={(e) => setF({ ...f, videoUrl: e.target.value })} placeholder="https://youtube.com/…" /></div>
        </div>
        {item && <label className="flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2 text-sm">Disponible para rutinas<Switch checked={f.isActive} onCheckedChange={(v) => setF({ ...f, isActive: v })} /></label>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving || !f.name.trim()} className="gap-2">{saving && <IconLoader2 size={16} className="animate-spin" />} Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function GymTrainingPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"routines" | "exercises" | "assessments">("routines");
  const [routines, setRoutines] = useState<Routine[] | null>(null);
  const [exercises, setExercises] = useState<Exercise[] | null>(null);
  const [assessments, setAssessments] = useState<RecentAssessment[] | null>(null);
  const [group, setGroup] = useState("all");
  const [builder, setBuilder] = useState<{ open: boolean; routine: Routine | null }>({ open: false, routine: null });
  const [exDialog, setExDialog] = useState<{ open: boolean; item: Exercise | null }>({ open: false, item: null });

  const load = useCallback(() => {
    gymApi<Routine[]>("/routines").then(setRoutines).catch((e) => toast.error(e.message));
    gymApi<Exercise[]>("/exercises").then(setExercises).catch(() => {});
    gymApi<RecentAssessment[]>("/assessments").then(setAssessments).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  const exerciseColumns = useMemo<ColumnDef<Exercise>[]>(
    () => [
      { id: "name", header: "Ejercicio", accessorFn: (e) => `${e.name} ${e.equipment ?? ""}`, cell: ({ row }) => <div className={cn("min-w-0", !row.original.isActive && "opacity-50")}><p className="font-medium">{row.original.name}</p>{row.original.instructions && <p className="max-w-xl truncate text-xs text-muted-foreground">{row.original.instructions}</p>}</div> },
      { id: "group", header: "Grupo", accessorFn: (e) => groupLabel(e.muscleGroup), cell: ({ getValue }) => <Badge variant="outline">{getValue<string>()}</Badge> },
      { id: "equipment", header: "Equipo", accessorFn: (e) => e.equipment ?? "", cell: ({ getValue }) => <span className="text-muted-foreground">{getValue<string>() || "—"}</span> },
      { id: "video", header: "Video", accessorFn: (e) => (e.videoUrl ? "Sí" : ""), cell: ({ row }) => (row.original.videoUrl ? <a href={row.original.videoUrl} target="_blank" rel="noreferrer" onClick={(ev) => ev.stopPropagation()} className="inline-flex items-center gap-1 text-primary hover:underline"><IconPlayerPlay size={14} /> Ver</a> : <span className="text-muted-foreground">—</span>) },
    ],
    [],
  );
  const assessmentColumns = useMemo<ColumnDef<RecentAssessment>[]>(
    () => [
      { id: "member", header: "Socio", accessorFn: (a) => a.member.client.name, cell: ({ row }) => <PersonCell src={row.original.member.photoUrl} name={row.original.member.client.name} sub={`N.º ${row.original.member.memberNumber}`} /> },
      { id: "date", header: "Fecha", accessorFn: (a) => a.date, cell: ({ getValue }) => <span className="tabular-nums">{shortDate(getValue<string>())}</span> },
      { id: "weight", header: "Peso", accessorFn: (a) => a.weightKg ?? 0, cell: ({ row }) => <span className="tabular-nums">{row.original.weightKg != null ? `${row.original.weightKg} kg` : "—"}</span> },
      { id: "fat", header: "Grasa", accessorFn: (a) => a.bodyFatPct ?? 0, cell: ({ row }) => <span className="tabular-nums">{row.original.bodyFatPct != null ? `${row.original.bodyFatPct}%` : "—"}</span> },
      {
        id: "bmi",
        header: "IMC",
        accessorFn: (a) => (a.weightKg && a.heightCm ? a.weightKg / (a.heightCm / 100) ** 2 : 0),
        cell: ({ row }) => {
          const a = row.original;
          const bmi = a.weightKg && a.heightCm ? Math.round((a.weightKg / (a.heightCm / 100) ** 2) * 10) / 10 : null;
          return bmi ? <span className="tabular-nums">{bmi} <span className="text-xs text-muted-foreground">{bmiLabel(bmi)}</span></span> : <span className="text-muted-foreground">—</span>;
        },
      },
      { id: "trainer", header: "Evaluó", accessorFn: (a) => a.trainer?.name ?? "", cell: ({ getValue }) => <span className="text-muted-foreground">{getValue<string>() || "—"}</span> },
    ],
    [],
  );

  const activeTemplates = (routines ?? []).filter((r) => r.isActive);
  const assignedTotal = activeTemplates.reduce((t, r) => t + (r.assignedCount ?? 0), 0);

  return (
    <GymPage>
      <GymPageHeader
        title="Entrenamiento"
        description="Rutinas para tus socios, la biblioteca de ejercicios y las evaluaciones físicas."
        actions={
          tab === "exercises" ? <Button className="gap-2" onClick={() => setExDialog({ open: true, item: null })}><IconPlus size={16} /> Nuevo ejercicio</Button>
          : tab === "routines" ? <Button className="gap-2" onClick={() => setBuilder({ open: true, routine: null })}><IconPlus size={16} /> Nueva rutina</Button>
          : null
        }
      />
      <StatGrid cols={3}>
        <StatCard label="Rutinas" value={routines ? activeTemplates.length : "—"} icon={<IconClipboardList size={20} />} title={assignedTotal === 1 ? "1 socio con rutina asignada" : `${assignedTotal} socios con rutina asignada`} hint="Se asignan desde la ficha del socio" onClick={() => setTab("routines")} />
        <StatCard label="Ejercicios" value={exercises?.filter((e) => e.isActive).length ?? "—"} icon={<IconBarbell size={20} />} tone="primary" title="En la biblioteca" hint="Con explicación y video" onClick={() => setTab("exercises")} />
        <StatCard label="Evaluaciones" value={assessments?.length ?? "—"} icon={<IconRuler2 size={20} />} title="Medidas registradas" hint="Peso, grasa, cintura e IMC" onClick={() => setTab("assessments")} />
      </StatGrid>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="routines">Rutinas</TabsTrigger>
          <TabsTrigger value="exercises">Ejercicios</TabsTrigger>
          <TabsTrigger value="assessments">Evaluaciones</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === "routines" && (
        !routines ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="h-48 animate-pulse rounded-xl bg-muted" />)}</div>
        : routines.length === 0 ? (
          <Card className="gap-0 py-0">
            <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary"><IconClipboardList size={24} /></span>
              <p className="font-semibold">Crea tu primera rutina</p>
              <p className="max-w-sm text-sm text-muted-foreground">Arma plantillas por nivel u objetivo, asígnalas a tus socios y envíaselas por WhatsApp.</p>
              <Button className="mt-2 gap-2" onClick={() => setBuilder({ open: true, routine: null })}><IconPlus size={16} /> Nueva rutina</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {routines.map((r) => (
              <Card key={r.id} className={cn("gap-3", !r.isActive && "opacity-60")}>
                <CardHeader>
                  <CardTitle>{r.name}</CardTitle>
                  <CardDescription>{levelLabel(r.level)}{r.goal ? ` · ${r.goal}` : ""}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {r.days.map((d, i) => (
                    <div key={i} className="rounded-lg bg-muted/40 px-3 py-2">
                      <p className="text-sm font-medium">{d.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{d.exercises.map((e) => e.name).join(" · ")}</p>
                    </div>
                  ))}
                </CardContent>
                <CardFooter className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><IconUsers size={14} /> {r.assignedCount ?? 0} {r.assignedCount === 1 ? "socio" : "socios"}</span>
                  <span className="flex gap-1">
                    <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => setBuilder({ open: true, routine: r })}><IconPencil size={14} /> Editar</Button>
                    <Button size="sm" variant="ghost" onClick={() => gymApi(`/routines/${r.id}`, { method: "PUT", json: { isActive: !r.isActive } }).then(load).catch((e) => toast.error(e.message))}>{r.isActive ? "Archivar" : "Reactivar"}</Button>
                  </span>
                </CardFooter>
              </Card>
            ))}
          </div>
        )
      )}

      {tab === "exercises" && (
        <>
          <FilterChips value={group} onChange={setGroup} options={[["all", "Todos"], ...MUSCLE_GROUPS]} />
          <PosTable columns={exerciseColumns} data={(exercises ?? []).filter((e) => group === "all" || e.muscleGroup === group)} loading={!exercises} searchPlaceholder="Buscar ejercicio…" getRowId={(e) => e.id} onRowClick={(e) => setExDialog({ open: true, item: e })} emptyMessage="No hay ejercicios en este grupo." />
        </>
      )}

      {tab === "assessments" && (
        <PosTable columns={assessmentColumns} data={assessments ?? []} loading={!assessments} searchPlaceholder="Buscar socio…" getRowId={(a) => a.id} onRowClick={(a) => router.push(`/dashboard/gimnasio/socios?socio=${a.member.id}`)} emptyMessage="Las evaluaciones se registran desde la ficha de cada socio." />
      )}

      <RoutineBuilder
        open={builder.open}
        routine={builder.routine}
        title={builder.routine ? "Editar rutina" : "Nueva rutina"}
        onClose={() => setBuilder({ open: false, routine: null })}
        onSaved={load}
        save={(body) => gymApi(builder.routine ? `/routines/${builder.routine.id}` : "/routines", { method: builder.routine ? "PUT" : "POST", json: body })}
      />
      <ExerciseDialog item={exDialog.item} open={exDialog.open} onClose={() => setExDialog({ open: false, item: null })} onSaved={load} />
    </GymPage>
  );
}
