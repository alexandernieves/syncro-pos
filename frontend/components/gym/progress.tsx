"use client";

import { useEffect, useState } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { IconLoader2 } from "@tabler/icons-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { DateField, FUTURE_PRESETS } from "@/components/forms/date-field";
import { gymApi } from "@/lib/gym";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

export type Assessment = {
  id: string;
  date: string;
  weightKg: number | null;
  heightCm: number | null;
  bodyFatPct: number | null;
  muscleMassKg: number | null;
  waistCm: number | null;
  hipCm: number | null;
  chestCm: number | null;
  armCm: number | null;
  thighCm: number | null;
  restingHr: number | null;
  bloodPressure: string | null;
  notes: string | null;
  bmi: number | null;
  trainer?: { name: string } | null;
};
export type Progress = { items: Assessment[]; change: { weightKg: number | null; bodyFatPct: number | null; waistCm: number | null; muscleMassKg: number | null } };

const FIELDS: [keyof Assessment, string, string][] = [
  ["weightKg", "Peso", "kg"],
  ["heightCm", "Estatura", "cm"],
  ["bodyFatPct", "Grasa corporal", "%"],
  ["muscleMassKg", "Masa muscular", "kg"],
  ["waistCm", "Cintura", "cm"],
  ["hipCm", "Cadera", "cm"],
  ["chestCm", "Pecho", "cm"],
  ["armCm", "Brazo", "cm"],
  ["thighCm", "Muslo", "cm"],
  ["restingHr", "Pulso en reposo", "lpm"],
];

export function bmiLabel(bmi: number | null) {
  if (bmi == null) return null;
  if (bmi < 18.5) return "Bajo peso";
  if (bmi < 25) return "Normal";
  if (bmi < 30) return "Sobrepeso";
  return "Obesidad";
}

/** New body assessment. Height is taken from the last one if left empty. */
export function AssessmentDialog({ memberId, open, onClose, onSaved }: { memberId: string; open: boolean; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) setF({ date: new Date().toLocaleDateString("en-CA") }); }, [open]);
  const save = async () => {
    setSaving(true);
    try {
      const body: Record<string, unknown> = { date: f.date, notes: f.notes, bloodPressure: f.bloodPressure };
      for (const [k] of FIELDS) if (f[k as string]) body[k as string] = Number(f[k as string].replace(",", "."));
      await gymApi(`/members/${memberId}/assessments`, { method: "POST", json: body });
      toast.success("Evaluación guardada");
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
          <DialogTitle>Nueva evaluación</DialogTitle>
          <DialogDescription>Anota solo las medidas que tomaste. La estatura se repite de la evaluación anterior.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="space-y-1.5"><Label>Fecha</Label><DateField value={f.date ?? ""} max={new Date().toLocaleDateString("en-CA")} onChange={(v) => setF({ ...f, date: v })} /></div>
          {FIELDS.map(([k, label, unit]) => (
            <div key={k as string} className="space-y-1.5">
              <Label>{label} <span className="font-normal text-muted-foreground">({unit})</span></Label>
              <Input value={f[k as string] ?? ""} onChange={(e) => setF({ ...f, [k as string]: e.target.value.replace(/[^\d.,]/g, "") })} inputMode="decimal" />
            </div>
          ))}
          <div className="space-y-1.5"><Label>Tensión</Label><Input value={f.bloodPressure ?? ""} onChange={(e) => setF({ ...f, bloodPressure: e.target.value })} placeholder="120/80" /></div>
          <div className="col-span-2 space-y-1.5 sm:col-span-3"><Label>Notas</Label><Input value={f.notes ?? ""} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="Observaciones, lesiones, próximos objetivos" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving} className="gap-2">{saving && <IconLoader2 size={16} className="animate-spin" />} Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const chartConfig = { weightKg: { label: "Peso (kg)", color: "var(--primary)" }, bodyFatPct: { label: "Grasa (%)", color: "#2563EB" } } satisfies ChartConfig;

/** Weight and body fat over time, with the change since the first assessment. */
export function ProgressSummary({ progress, compact }: { progress: Progress; compact?: boolean }) {
  const items = progress.items;
  if (!items.length) return null;
  const last = items[items.length - 1];
  const data = items.map((a) => ({ date: new Date(a.date).toLocaleDateString("es-VE", { day: "numeric", month: "short" }), weightKg: a.weightKg, bodyFatPct: a.bodyFatPct }));
  const delta = (v: number | null, unit: string, goodWhenDown = true) =>
    v == null || v === 0 ? null : <span className={cn("text-xs font-semibold", (v < 0) === goodWhenDown ? "text-emerald-600" : "text-rose-600")}>{v > 0 ? "+" : ""}{v} {unit}</span>;
  const tiles: [string, string, React.ReactNode][] = [
    ["Peso", last.weightKg != null ? `${last.weightKg} kg` : "—", delta(progress.change.weightKg, "kg")],
    ["Grasa", last.bodyFatPct != null ? `${last.bodyFatPct}%` : "—", delta(progress.change.bodyFatPct, "%")],
    ["Cintura", last.waistCm != null ? `${last.waistCm} cm` : "—", delta(progress.change.waistCm, "cm")],
    ["IMC", last.bmi != null ? String(last.bmi) : "—", <span key="b" className="text-xs text-muted-foreground">{bmiLabel(last.bmi)}</span>],
  ];
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-2">
        {tiles.map(([label, value, extra]) => (
          <div key={label} className="rounded-xl bg-muted/40 p-2.5">
            <p className="text-[11px] text-muted-foreground">{label}</p>
            <p className="text-base font-bold tabular-nums">{value}</p>
            {extra}
          </div>
        ))}
      </div>
      {items.length > 1 && (
        <ChartContainer config={chartConfig} className={cn("w-full", compact ? "h-36" : "h-56")}>
          <LineChart data={data} margin={{ left: 12, right: 12, top: 8, bottom: 0 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="date" tickLine={false} axisLine={false} fontSize={11} />
            <YAxis yAxisId="w" hide domain={["dataMin - 2", "dataMax + 2"]} />
            <YAxis yAxisId="f" hide domain={["dataMin - 2", "dataMax + 2"]} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line yAxisId="w" type="monotone" dataKey="weightKg" stroke="var(--color-weightKg)" strokeWidth={2.5} dot={{ r: 3 }} connectNulls isAnimationActive={false} />
            <Line yAxisId="f" type="monotone" dataKey="bodyFatPct" stroke="var(--color-bodyFatPct)" strokeWidth={2} dot={{ r: 3 }} connectNulls isAnimationActive={false} />
          </LineChart>
        </ChartContainer>
      )}
    </div>
  );
}
