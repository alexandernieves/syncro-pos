"use client";

import { useEffect, useMemo, useState } from "react";
import { IconArrowDown, IconArrowUp, IconLoader2, IconPlus, IconSearch, IconTrash, IconX } from "@tabler/icons-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { gymApi } from "@/lib/gym";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export type Exercise = { id: string; name: string; muscleGroup: string; equipment: string | null; instructions: string | null; videoUrl: string | null; isActive: boolean };
export type RoutineExercise = { exerciseId: string | null; name: string; sets: number; reps: string; weight: string; restSec: number; notes: string };
export type RoutineDay = { name: string; exercises: RoutineExercise[] };
export type Routine = { id: string; name: string; goal: string | null; level: string; description: string | null; days: RoutineDay[]; isActive: boolean; memberId: string | null; trainer?: { id: string; name: string } | null; assignedCount?: number; startsAt?: string | null };

export const MUSCLE_GROUPS: [string, string][] = [["CHEST", "Pecho"], ["BACK", "Espalda"], ["LEGS", "Piernas"], ["GLUTES", "Glúteos"], ["SHOULDERS", "Hombros"], ["ARMS", "Brazos"], ["CORE", "Abdomen"], ["CARDIO", "Cardio"], ["FULL_BODY", "Cuerpo completo"]];
export const LEVELS: [string, string][] = [["BEGINNER", "Principiante"], ["INTERMEDIATE", "Intermedio"], ["ADVANCED", "Avanzado"]];
export const groupLabel = (g: string) => MUSCLE_GROUPS.find(([k]) => k === g)?.[1] ?? g;
export const levelLabel = (l: string) => LEVELS.find(([k]) => k === l)?.[1] ?? l;

/** Plain text of a routine, for WhatsApp or printing. */
export function routineText(r: Pick<Routine, "name" | "days" | "goal">, memberName?: string) {
  const lines = [`*${r.name}*${memberName ? ` · ${memberName}` : ""}`, ...(r.goal ? [`Objetivo: ${r.goal}`] : []), ""];
  for (const d of r.days) {
    lines.push(`*${d.name}*`);
    for (const e of d.exercises) lines.push(`• ${e.name}: ${e.sets} × ${e.reps}${e.weight ? ` · ${e.weight}` : ""}${e.restSec ? ` · descanso ${e.restSec} s` : ""}${e.notes ? ` (${e.notes})` : ""}`);
    lines.push("");
  }
  return lines.join("\n").trim();
}

function ExercisePicker({ exercises, onPick, onClose }: { exercises: Exercise[]; onPick: (e: Exercise) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [group, setGroup] = useState("");
  const list = exercises.filter((e) => e.isActive && (!group || e.muscleGroup === group) && e.name.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div className="space-y-2 rounded-xl border bg-background p-3 shadow-sm">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <IconSearch size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar ejercicio" className="h-8 pl-8" />
        </div>
        <Button size="icon" variant="ghost" className="size-8" onClick={onClose} title="Cerrar"><IconX size={16} /></Button>
      </div>
      <div className="flex flex-wrap gap-1">
        {[["", "Todos"] as [string, string], ...MUSCLE_GROUPS].map(([k, l]) => (
          <button key={k} type="button" onClick={() => setGroup(k)} className={cn("rounded-full px-2 py-0.5 text-[11px]", group === k ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>{l}</button>
        ))}
      </div>
      <div className="max-h-48 overflow-y-auto">
        {list.map((e) => (
          <button key={e.id} type="button" onClick={() => onPick(e)} className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted">
            <span className="truncate">{e.name}</span>
            <span className="shrink-0 text-[11px] text-muted-foreground">{groupLabel(e.muscleGroup)}</span>
          </button>
        ))}
        {!list.length && q.trim() && (
          <button type="button" onClick={() => onPick({ id: "", name: q.trim(), muscleGroup: "", equipment: null, instructions: null, videoUrl: null, isActive: true })} className="w-full rounded-lg px-2 py-1.5 text-left text-sm text-primary hover:bg-muted">Usar «{q.trim()}» sin guardarlo en la biblioteca</button>
        )}
      </div>
    </div>
  );
}

/** Builds a routine by days. `endpoint` decides whether it saves a template, edits one or edits a member's copy. */
export function RoutineBuilder({ open, routine, title, onClose, onSaved, save }: { open: boolean; routine: Partial<Routine> | null; title: string; onClose: () => void; onSaved: () => void; save: (body: Omit<Routine, "id" | "isActive" | "memberId">) => Promise<unknown> }) {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [f, setF] = useState<{ name: string; goal: string; level: string; description: string; days: RoutineDay[] }>({ name: "", goal: "", level: "BEGINNER", description: "", days: [] });
  const [picking, setPicking] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open && !exercises.length) gymApi<Exercise[]>("/exercises").then(setExercises).catch(() => {}); }, [open, exercises.length]);
  useEffect(() => {
    if (!open) return;
    setPicking(null);
    setF({ name: routine?.name ?? "", goal: routine?.goal ?? "", level: routine?.level ?? "BEGINNER", description: routine?.description ?? "", days: routine?.days?.length ? JSON.parse(JSON.stringify(routine.days)) : [{ name: "Día A", exercises: [] }] });
  }, [open, routine]);

  const setDay = (i: number, patch: Partial<RoutineDay>) => setF((x) => ({ ...x, days: x.days.map((d, j) => (j === i ? { ...d, ...patch } : d)) }));
  const setEx = (i: number, k: number, patch: Partial<RoutineExercise>) => setDay(i, { exercises: f.days[i].exercises.map((e, j) => (j === k ? { ...e, ...patch } : e)) });
  const moveEx = (i: number, k: number, dir: -1 | 1) => {
    const list = [...f.days[i].exercises];
    const t = k + dir;
    if (t < 0 || t >= list.length) return;
    [list[k], list[t]] = [list[t], list[k]];
    setDay(i, { exercises: list });
  };
  const total = useMemo(() => f.days.reduce((t, d) => t + d.exercises.length, 0), [f.days]);

  const submit = async () => {
    setSaving(true);
    try {
      await save({ name: f.name, goal: f.goal || null, level: f.level, description: f.description || null, days: f.days });
      toast.success("Rutina guardada");
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
      <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Organiza los ejercicios por día. Series, repeticiones, peso sugerido y descanso.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_160px]">
          <div className="space-y-1.5"><Label>Nombre</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Ej.: fuerza 4 días" /></div>
          <div className="space-y-1.5"><Label>Objetivo</Label><Input value={f.goal} onChange={(e) => setF({ ...f, goal: e.target.value })} placeholder="Hipertrofia, bajar de peso…" /></div>
          <div className="space-y-1.5">
            <Label>Nivel</Label>
            <select value={f.level} onChange={(e) => setF({ ...f, level: e.target.value })} className="h-9 w-full rounded-md border bg-background px-2 text-sm">{LEVELS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          </div>
        </div>

        <div className="space-y-3">
          {f.days.map((d, i) => (
            <div key={i} className="space-y-2 rounded-xl bg-muted/40 p-3">
              <div className="flex items-center gap-2">
                <Input value={d.name} onChange={(e) => setDay(i, { name: e.target.value })} className="h-8 max-w-xs font-semibold" />
                <span className="text-xs text-muted-foreground">{d.exercises.length} {d.exercises.length === 1 ? "ejercicio" : "ejercicios"}</span>
                {f.days.length > 1 && <Button size="sm" variant="ghost" className="ml-auto h-8 gap-1 text-rose-600" onClick={() => setF({ ...f, days: f.days.filter((_, j) => j !== i) })}><IconTrash size={14} /> Quitar día</Button>}
              </div>
              {d.exercises.length > 0 && (
                <div className="space-y-1.5">
                  <div className="hidden grid-cols-[1fr_56px_72px_80px_72px_76px] gap-2 px-1 text-[11px] text-muted-foreground sm:grid">
                    <span>Ejercicio</span><span>Series</span><span>Reps</span><span>Peso</span><span>Descanso</span><span />
                  </div>
                  {d.exercises.map((e, k) => (
                    <div key={k} className="grid grid-cols-2 items-center gap-2 rounded-lg bg-background p-1.5 sm:grid-cols-[1fr_56px_72px_80px_72px_76px]">
                      <span className="col-span-2 truncate px-1 text-sm font-medium sm:col-span-1">{e.name}</span>
                      <Input type="number" min={1} value={e.sets} onChange={(ev) => setEx(i, k, { sets: Number(ev.target.value) })} className="h-8 text-center" title="Series" />
                      <Input value={e.reps} onChange={(ev) => setEx(i, k, { reps: ev.target.value })} className="h-8 text-center" title="Repeticiones" />
                      <Input value={e.weight} onChange={(ev) => setEx(i, k, { weight: ev.target.value })} className="h-8 text-center" placeholder="—" title="Peso sugerido" />
                      <Input type="number" min={0} value={e.restSec} onChange={(ev) => setEx(i, k, { restSec: Number(ev.target.value) })} className="h-8 text-center" title="Descanso en segundos" />
                      <span className="flex justify-end">
                        <Button size="icon" variant="ghost" className="size-7" onClick={() => moveEx(i, k, -1)} title="Subir"><IconArrowUp size={14} /></Button>
                        <Button size="icon" variant="ghost" className="size-7" onClick={() => moveEx(i, k, 1)} title="Bajar"><IconArrowDown size={14} /></Button>
                        <Button size="icon" variant="ghost" className="size-7 text-rose-600" onClick={() => setDay(i, { exercises: d.exercises.filter((_, j) => j !== k) })} title="Quitar"><IconX size={14} /></Button>
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {picking === i ? (
                <ExercisePicker exercises={exercises} onClose={() => setPicking(null)} onPick={(ex) => { setDay(i, { exercises: [...d.exercises, { exerciseId: ex.id || null, name: ex.name, sets: 3, reps: ex.muscleGroup === "CARDIO" ? "10 min" : "10", weight: "", restSec: ex.muscleGroup === "CARDIO" ? 0 : 60, notes: "" }] }); }} />
              ) : (
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setPicking(i)}><IconPlus size={14} /> Agregar ejercicio</Button>
              )}
            </div>
          ))}
          {f.days.length < 7 && (
            <Button variant="ghost" className="gap-1.5" onClick={() => setF({ ...f, days: [...f.days, { name: `Día ${String.fromCharCode(65 + f.days.length)}`, exercises: [] }] })}><IconPlus size={16} /> Agregar día</Button>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={saving || !f.name.trim() || !total} className="gap-2">{saving && <IconLoader2 size={16} className="animate-spin" />} Guardar rutina</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
