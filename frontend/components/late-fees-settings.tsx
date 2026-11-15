"use client";

import { useMemo } from "react";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

/**
 * Configuración → Syncro Credit → "Atrasos y recargos". What a client is charged when an installment
 * passes its due date. The backend applies it every hour (backend/src/modules/lending/late-fees.ts
 * has the same rules); this card only edits the policy and shows an example.
 */
export type LateExtra = { id: string; name: string; type: "fixed" | "percent"; amount: number; when: "once" | "every"; everyDays: number };
export type LateFees = {
  enabled: boolean;
  since?: string | null;
  graceDays: number;
  fixedFee: number;
  percentFee: number;
  interestPct: number;
  interestEveryDays: number;
  capPct: number;
  extras: LateExtra[];
};

export const DEFAULT_LATE_FEES: LateFees = { enabled: false, since: null, graceDays: 3, fixedFee: 0, percentFee: 0, interestPct: 0, interestEveryDays: 7, capPct: 50, extras: [] };

export function readLateFees(raw: any): LateFees {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_LATE_FEES };
  return { ...DEFAULT_LATE_FEES, ...raw, extras: Array.isArray(raw.extras) ? raw.extras : [] };
}

const money = (n: number) => `$${(Math.round(n * 100) / 100).toFixed(2)}`;
const EVERY = [
  { d: 1, t: "Diario" },
  { d: 7, t: "Semanal" },
  { d: 15, t: "Quincenal" },
  { d: 30, t: "Mensual" },
];

/** The example: what an installment of $base owes after `days` late (same rules as the server) */
function example(p: LateFees, base: number, days: number) {
  const lines: { name: string; amount: number }[] = [];
  const late = days - p.graceDays;
  if (!p.enabled || late <= 0) return { lines, total: 0, capped: false };
  const periods = (every: number) => Math.floor((late - 1) / Math.max(1, every)) + 1;
  if (p.fixedFee > 0) lines.push({ name: "Cargo por atraso", amount: p.fixedFee });
  if (p.percentFee > 0) lines.push({ name: `Cargo ${p.percentFee}%`, amount: (base * p.percentFee) / 100 });
  if (p.interestPct > 0) {
    const n = periods(p.interestEveryDays);
    lines.push({ name: `Interés por mora ${p.interestPct}% × ${n}`, amount: ((base * p.interestPct) / 100) * n });
  }
  for (const e of p.extras) {
    if (!e.name || !(e.amount > 0)) continue;
    const n = e.when === "every" ? periods(e.everyDays) : 1;
    const one = e.type === "percent" ? (base * e.amount) / 100 : e.amount;
    lines.push({ name: n > 1 ? `${e.name} × ${n}` : e.name, amount: one * n });
  }
  let total = lines.reduce((a, l) => a + l.amount, 0);
  const cap = p.capPct > 0 ? (base * p.capPct) / 100 : Infinity;
  const capped = total > cap;
  if (capped) total = cap;
  return { lines, total, capped };
}

function NumField({ value, onChange, suffix, prefix, min = 0, max, className }: { value: number; onChange: (n: number) => void; suffix?: string; prefix?: string; min?: number; max?: number; className?: string }) {
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      {prefix && <span className="text-sm text-muted-foreground">{prefix}</span>}
      <Input
        type="number"
        min={min}
        max={max}
        step="any"
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-20 text-center font-mono font-bold"
      />
      {suffix && <span className="text-sm text-muted-foreground">{suffix}</span>}
    </div>
  );
}

function Row({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="min-w-0 max-w-sm">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      {children}
    </div>
  );
}

export function LateFeesSettings({ value, onChange }: { value: LateFees; onChange: (v: LateFees) => void }) {
  const p = value;
  const set = (patch: Partial<LateFees>) => onChange({ ...p, ...patch });
  const setExtra = (id: string, patch: Partial<LateExtra>) => set({ extras: p.extras.map((e) => (e.id === id ? { ...e, ...patch } : e)) });
  const addExtra = () =>
    set({ extras: [...p.extras, { id: `x${Date.now().toString(36)}`, name: "", type: "fixed" as const, amount: 0, when: "once" as const, everyDays: 7 }].slice(0, 8) });
  const ex = useMemo(() => example(p, 50, p.graceDays + 20), [p]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base font-semibold">Atrasos y recargos</CardTitle>
            <CardDescription>Lo que se le cobra a un cliente cuando una cuota pasa de su fecha. Aplica a compras a crédito y préstamos.</CardDescription>
          </div>
          <Switch checked={p.enabled} onCheckedChange={(v) => set({ enabled: v })} aria-label="Cobrar recargos por atraso" />
        </div>
      </CardHeader>

      {p.enabled && (
        <CardContent className="space-y-1">
          <div className="divide-y divide-border/60">
            <Row title="Días de gracia" desc="Días después del vencimiento antes de cobrar cualquier recargo">
              <NumField value={p.graceDays} onChange={(n) => set({ graceDays: n })} max={60} suffix="días" />
            </Row>
            <Row title="Cargo fijo" desc="Se cobra una sola vez por cada cuota atrasada">
              <NumField value={p.fixedFee} onChange={(n) => set({ fixedFee: n })} prefix="$" />
            </Row>
            <Row title="Cargo porcentual" desc="Un porcentaje de la cuota, una sola vez">
              <NumField value={p.percentFee} onChange={(n) => set({ percentFee: n })} max={100} suffix="%" />
            </Row>
            <div className="py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 max-w-sm">
                  <p className="text-sm font-medium">Interés por mora</p>
                  <p className="text-xs text-muted-foreground">Sobre lo que falta por pagar de la cuota, mientras siga atrasada</p>
                </div>
                <NumField value={p.interestPct} onChange={(n) => set({ interestPct: n })} max={100} suffix="%" />
              </div>
              {p.interestPct > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="mr-1 text-xs text-muted-foreground">Se cobra</span>
                  {EVERY.map((o) => (
                    <Button key={o.d} type="button" size="sm" variant={p.interestEveryDays === o.d ? "default" : "outline"} className="h-7 px-2.5 text-xs" onClick={() => set({ interestEveryDays: o.d })}>
                      {o.t}
                    </Button>
                  ))}
                  <NumField value={p.interestEveryDays} onChange={(n) => set({ interestEveryDays: n })} min={1} max={90} prefix="cada" suffix="días" className="ml-1" />
                </div>
              )}
            </div>
            <Row title="Tope de recargos" desc="Lo máximo que se puede cobrar en recargos por una cuota (0 = sin tope)">
              <NumField value={p.capPct} onChange={(n) => set({ capPct: n })} max={1000} suffix="% de la cuota" />
            </Row>
          </div>

          {/* The business's own charges */}
          <div className="pt-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Cargos personalizados</p>
                <p className="text-xs text-muted-foreground">Por ejemplo: gestión de cobranza, aviso por WhatsApp, visita de cobro.</p>
              </div>
              <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={addExtra} disabled={p.extras.length >= 8}>
                <IconPlus size={15} /> Agregar
              </Button>
            </div>
            {p.extras.length > 0 && (
              <div className="mt-3 space-y-2">
                {p.extras.map((e) => (
                  <div key={e.id} className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/20 p-2.5">
                    <Input value={e.name} maxLength={40} placeholder="Nombre del cargo" onChange={(ev) => setExtra(e.id, { name: ev.target.value })} className="h-9 min-w-[150px] flex-1" />
                    <div className="flex overflow-hidden rounded-md border">
                      {(["fixed", "percent"] as const).map((t) => (
                        <button key={t} type="button" onClick={() => setExtra(e.id, { type: t })} className={cn("h-9 px-3 text-sm font-semibold transition", e.type === t ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted")}>
                          {t === "fixed" ? "$" : "%"}
                        </button>
                      ))}
                    </div>
                    <Input type="number" min={0} step="any" value={e.amount} onChange={(ev) => setExtra(e.id, { amount: Number(ev.target.value) })} className="h-9 w-20 text-center font-mono font-bold" aria-label="Monto" />
                    <div className="flex overflow-hidden rounded-md border">
                      {(["once", "every"] as const).map((w) => (
                        <button key={w} type="button" onClick={() => setExtra(e.id, { when: w })} className={cn("h-9 px-3 text-xs font-semibold transition", e.when === w ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted")}>
                          {w === "once" ? "Una vez" : "Repetir"}
                        </button>
                      ))}
                    </div>
                    {e.when === "every" && <NumField value={e.everyDays} onChange={(n) => setExtra(e.id, { everyDays: n })} min={1} max={90} prefix="cada" suffix="días" />}
                    <Button type="button" variant="ghost" size="icon" className="size-9 text-destructive hover:text-destructive" aria-label="Quitar cargo" onClick={() => set({ extras: p.extras.filter((x) => x.id !== e.id) })}>
                      <IconTrash size={16} />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Example */}
          <div className="mt-3 rounded-lg bg-muted px-3 py-2.5 text-xs text-muted-foreground">
            <p>
              Ejemplo: una cuota de <b className="text-foreground">$50</b> con <b className="text-foreground">20 días</b> de atraso (después de la gracia)
              {ex.total > 0 ? <> suma <b className="text-foreground">{money(ex.total)}</b> en recargos{ex.capped ? " (llegó al tope)" : ""}.</> : " no tiene recargos con esta configuración."}
            </p>
            {ex.lines.length > 0 && (
              <ul className="mt-1.5 space-y-0.5">
                {ex.lines.map((l) => (
                  <li key={l.name} className="flex justify-between gap-3"><span>{l.name}</span><span className="tabular-nums">{money(l.amount)}</span></li>
                ))}
              </ul>
            )}
          </div>
          <p className="pt-2 text-xs text-muted-foreground">
            Se revisa cada hora. Solo se cobran los atrasos desde el día en que lo activas (los anteriores no). El cliente ve cada recargo en su app y en su historial.
          </p>
        </CardContent>
      )}
    </Card>
  );
}
