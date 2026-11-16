"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { IconBrandBinance, IconBuildingBank, IconCash, IconDeviceMobile, IconMinus, IconPlus, IconCurrencyDollar } from "@tabler/icons-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { useMyModules } from "@/lib/modules";
import { creditRates } from "@/lib/credit-rate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/**
 * POS → Préstamo: the client shows the PIN of an approved loan; the cashier types it and hands the
 * money over in one or several ways: dollars in bills (out of the open shift's drawer), bolívares by
 * pago móvil or transfer at a rate (BCV dollar, BCV euro or one of its own), Binance or Zelle.
 * The parts must add up to the loan. Only when the business has the "loans" module.
 */
type Info = { id: string; amount: number; totalToPay: number; installments: number; each: number; frequencyDays: number; client: { name: string; documentId: string | null; phone: string | null } };
type Method = "CASH" | "PAGO_MOVIL" | "TRANSFER" | "BINANCE" | "ZELLE";
type Part = { amount: string; bills: Record<number, number>; rateKind: "usd" | "eur" | "custom"; customRate: string; reference: string };

const BILLS = [100, 50, 20, 10, 5, 1];
const METHODS: { k: Method; t: string; icon: React.ReactNode }[] = [
  { k: "CASH", t: "Efectivo $", icon: <IconCash size={16} /> },
  { k: "PAGO_MOVIL", t: "Pago móvil Bs", icon: <IconDeviceMobile size={16} /> },
  { k: "TRANSFER", t: "Transferencia Bs", icon: <IconBuildingBank size={16} /> },
  { k: "BINANCE", t: "Binance", icon: <IconBrandBinance size={16} /> },
  { k: "ZELLE", t: "Zelle", icon: <IconCurrencyDollar size={16} /> },
];
const money = (n: number) => `$${(Number(n) || 0).toFixed(2)}`;
const bs = (n: number) => `Bs ${(Number(n) || 0).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const r2 = (n: number) => Math.round(n * 100) / 100;
const billsFor = (amount: number) => {
  let left = Math.floor(amount);
  const out: Record<number, number> = {};
  for (const b of BILLS) { const n = Math.floor(left / b); if (n > 0) { out[b] = n; left -= n * b; } }
  return out;
};
const sumBills = (b: Record<number, number>) => Object.entries(b).reduce((a, [v, n]) => a + Number(v) * n, 0);
const emptyPart = (amount = 0): Part => ({ amount: amount ? String(r2(amount)) : "", bills: billsFor(amount), rateKind: "usd", customRate: "", reference: "" });

export function LoanDisburseButton({ shiftOpen }: { shiftOpen: boolean }) {
  const mods = useMyModules();
  const [open, setOpen] = useState(false);
  if (!mods?.find((m) => m.code === "loans")?.usable) return null;
  return (
    <>
      <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-lg border-[#DAD5CC] bg-[#FAF7F2] px-2.5 text-xs font-bold text-[#16140F] hover:bg-[#F5F1E8]" onClick={() => setOpen(true)}>
        <IconCash size={14} className="text-primary" /> Préstamo
      </Button>
      {open && <LoanDisburseDialog shiftOpen={shiftOpen} onClose={() => setOpen(false)} />}
    </>
  );
}

function LoanDisburseDialog({ shiftOpen, onClose }: { shiftOpen: boolean; onClose: () => void }) {
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [info, setInfo] = useState<Info | null>(null);
  const [parts, setParts] = useState<Partial<Record<Method, Part>>>({});
  const [order, setOrder] = useState<Method[]>([]);
  const [rates, setRates] = useState({ usd: 0, eur: 0, custom: 0 });
  const [busy, setBusy] = useState(false);
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const pin = digits.join("");

  useEffect(() => { refs.current[0]?.focus(); }, []);
  // the business's rates (the POS one, or the dashboard's if the POS never synced) and its own one
  useEffect(() => {
    apiFetch("/settings").then((r) => (r.ok ? r.json() : null)).then((s) => {
      if (!s) return;
      const c = creditRates(s);
      setRates({ usd: c.usd, eur: c.eur, custom: c.custom });
    }).catch(() => {});
  }, []);

  const partAmount = (m: Method, p?: Part) => (!p ? 0 : m === "CASH" ? sumBills(p.bills) : Number(p.amount) || 0);
  const total = r2(order.reduce((a, m) => a + partAmount(m, parts[m]), 0));
  const left = info ? r2(info.amount - total) : 0;
  const rateOf = (p: Part) => (p.rateKind === "custom" ? Number(p.customRate) || 0 : rates[p.rateKind] || 0);

  const lookup = async (p: string) => {
    setBusy(true);
    try {
      const res = await apiFetch(`/lending/pin/${p}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || "PIN no válido");
      setInfo(body);
      // starts all in cash, with the fewest bills
      setOrder(["CASH"]);
      setParts({ CASH: emptyPart(body.amount) });
    } catch (e: any) {
      toast.error(e.message);
      setDigits(["", "", "", "", "", ""]);
      refs.current[0]?.focus();
    } finally {
      setBusy(false);
    }
  };

  const setDigit = (i: number, v: string) => {
    const clean = v.replace(/\D/g, "");
    if (clean.length > 1) {
      const all = clean.slice(0, 6).split("");
      setDigits([...all, "", "", "", "", "", ""].slice(0, 6));
      if (all.length === 6) lookup(all.join(""));
      return;
    }
    const next = [...digits];
    next[i] = clean;
    setDigits(next);
    if (clean && i < 5) refs.current[i + 1]?.focus();
    if (next.every((d) => d)) lookup(next.join(""));
  };

  /** Turn a way on (it takes what's missing) or off */
  const toggle = (m: Method) => {
    if (!info) return;
    if (order.includes(m)) {
      setOrder((o) => o.filter((x) => x !== m));
      setParts((p) => { const n = { ...p }; delete n[m]; return n; });
      return;
    }
    const missing = Math.max(0, left);
    setOrder((o) => [...o, m]);
    setParts((p) => ({ ...p, [m]: emptyPart(missing) }));
  };
  const patch = (m: Method, d: Partial<Part>) => setParts((p) => ({ ...p, [m]: { ...(p[m] as Part), ...d } }));

  const problem = useMemo(() => {
    if (!info) return "";
    if (!order.length) return "Elige cómo entregas el préstamo";
    for (const m of order) {
      const p = parts[m]!;
      if (partAmount(m, p) <= 0) return `Indica el monto de ${METHODS.find((x) => x.k === m)!.t}`;
      if ((m === "PAGO_MOVIL" || m === "TRANSFER") && !(rateOf(p) > 1)) return "Indica la tasa para la parte en bolívares";
    }
    if (Math.abs(left) > 0.01) return left > 0 ? `Faltan ${money(left)}` : `Te pasaste por ${money(-left)}`;
    return "";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [info, order, parts, left, rates]);

  const disburse = async () => {
    if (!info || problem) return;
    setBusy(true);
    try {
      const body = {
        parts: order.map((m) => {
          const p = parts[m]!;
          if (m === "CASH") return { method: m, bills: p.bills };
          if (m === "PAGO_MOVIL" || m === "TRANSFER") {
            return { method: m, amount: Number(p.amount), rate: rateOf(p), rateLabel: p.rateKind === "usd" ? "BCV dólar" : p.rateKind === "eur" ? "BCV euro" : "Tasa propia", reference: p.reference };
          }
          return { method: m, amount: Number(p.amount), reference: p.reference };
        }),
      };
      const res = await apiFetch(`/lending/pin/${pin}/disburse`, { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.message || "No se pudo entregar");
      toast.success(`Entregaste ${money(info.amount)} a ${info.client.name}. ${out.installments} cuota${out.installments > 1 ? "s" : ""} de ${money(out.each)}.`);
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Entregar préstamo</DialogTitle>
          <DialogDescription>Escribe el PIN que el cliente tiene en su app de Syncro Credit.</DialogDescription>
        </DialogHeader>
        {!shiftOpen && <p className="rounded-lg bg-primary/5 px-3 py-2 text-sm text-primary">Abre tu turno de caja para poder entregar el préstamo.</p>}
        <div className="flex justify-center gap-2">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => { refs.current[i] = el; }}
              value={d}
              inputMode="numeric"
              aria-label={`Dígito ${i + 1} del PIN`}
              disabled={!!info || busy}
              onChange={(e) => setDigit(i, e.target.value)}
              onKeyDown={(e) => { if (e.key === "Backspace" && !d && i > 0) refs.current[i - 1]?.focus(); }}
              className="h-12 w-11 rounded-xl border-2 border-primary/30 bg-background text-center text-xl font-bold outline-none focus:border-primary"
            />
          ))}
        </div>

        {info && (
          <div className="space-y-3">
            <div className="flex items-start justify-between rounded-xl border p-3">
              <div>
                <p className="font-semibold">{info.client.name}</p>
                <p className="text-xs text-muted-foreground">{info.client.documentId}{info.client.phone ? ` · ${info.client.phone}` : ""}</p>
                <p className="mt-1 text-xs text-muted-foreground">Devuelve {money(info.totalToPay)} en {info.installments} cuota{info.installments > 1 ? "s" : ""} de {money(info.each)} cada {info.frequencyDays} días</p>
              </div>
              <p className="text-2xl font-bold tabular-nums">{money(info.amount)}</p>
            </div>

            <div>
              <p className="mb-1.5 text-xs font-semibold text-muted-foreground">¿Cómo lo entregas? Puedes combinar</p>
              <div className="flex flex-wrap gap-1.5">
                {METHODS.map((m) => (
                  <button
                    key={m.k}
                    type="button"
                    onClick={() => toggle(m.k)}
                    className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition", order.includes(m.k) ? "border-primary bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted")}
                  >
                    {m.icon}{m.t}
                  </button>
                ))}
              </div>
            </div>

            {order.map((m) => {
              const p = parts[m]!;
              const meta = METHODS.find((x) => x.k === m)!;
              const amt = partAmount(m, p);
              return (
                <div key={m} className="space-y-2 rounded-xl border p-3">
                  <div className="flex items-center justify-between">
                    <p className="flex items-center gap-1.5 text-sm font-semibold">{meta.icon}{meta.t}</p>
                    <p className="text-sm font-bold tabular-nums">{money(amt)}</p>
                  </div>

                  {m === "CASH" ? (
                    <div className="grid grid-cols-3 gap-2">
                      {BILLS.map((b) => {
                        const n = p.bills[b] || 0;
                        return (
                          <div key={b} className={cn("flex items-center justify-between rounded-lg border px-1.5 py-1", n ? "border-emerald-400/60 bg-emerald-500/10" : "")}>
                            <button type="button" aria-label={`Quitar billete de ${b}`} className="grid size-7 place-items-center rounded-md hover:bg-muted" onClick={() => patch(m, { bills: { ...p.bills, [b]: Math.max(0, n - 1) } })}><IconMinus size={14} /></button>
                            <span className="text-center text-sm font-bold tabular-nums">${b}{n ? <span className="text-emerald-600"> ×{n}</span> : null}</span>
                            <button type="button" aria-label={`Agregar billete de ${b}`} className="grid size-7 place-items-center rounded-md hover:bg-muted" onClick={() => patch(m, { bills: { ...p.bills, [b]: n + 1 } })}><IconPlus size={14} /></button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Monto en $</span>
                        <Input type="number" min={0} step="any" value={p.amount} onChange={(e) => patch(m, { amount: e.target.value })} className="h-9 w-28 text-right font-mono font-bold" aria-label={`Monto en dólares por ${meta.t}`} />
                        {left > 0.01 && (
                          <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={() => patch(m, { amount: String(r2((Number(p.amount) || 0) + left)) })}>+ lo que falta</Button>
                        )}
                      </div>
                      {(m === "PAGO_MOVIL" || m === "TRANSFER") && (
                        <div className="space-y-2 rounded-lg bg-muted/40 p-2.5">
                          <div className="flex flex-wrap gap-1.5">
                            {([
                              ["usd", `BCV $ ${rates.usd ? rates.usd.toFixed(2) : "—"}`],
                              ["eur", `BCV € ${rates.eur ? rates.eur.toFixed(2) : "—"}`],
                              ["custom", "Otra tasa"],
                            ] as const).map(([k, t]) => (
                              <button key={k} type="button" disabled={k !== "custom" && !rates[k]} onClick={() => patch(m, { rateKind: k, customRate: k === "custom" && !p.customRate && rates.custom ? String(rates.custom) : p.customRate })} className={cn("rounded-md border px-2.5 py-1 text-xs font-semibold transition disabled:opacity-40", p.rateKind === k ? "border-primary bg-primary/10 text-primary" : "bg-background")}>
                                {t}
                              </button>
                            ))}
                            {p.rateKind === "custom" && (
                              <Input type="number" min={1} step="any" value={p.customRate} onChange={(e) => patch(m, { customRate: e.target.value })} placeholder="Bs por $1" className="h-7 w-28 text-right text-xs font-mono font-bold" aria-label="Tasa propia" />
                            )}
                          </div>
                          <p className="text-sm">
                            Envía <b className="tabular-nums">{rateOf(p) > 1 ? bs(amt * rateOf(p)) : "—"}</b>
                            <span className="text-xs text-muted-foreground"> a {info.client.name}{info.client.phone ? ` (${info.client.phone})` : ""}</span>
                          </p>
                        </div>
                      )}
                      <Input value={p.reference} maxLength={60} onChange={(e) => patch(m, { reference: e.target.value })} placeholder="Referencia de la operación (opcional)" className="h-9" />
                    </>
                  )}
                </div>
              );
            })}

            <p className={cn("text-sm font-semibold", problem ? "text-destructive" : "text-emerald-600")}>
              {problem || `Todo listo: ${money(total)} de ${money(info.amount)}`}
            </p>
            {order.some((m) => m !== "CASH") && (
              <p className="text-xs text-muted-foreground">Solo el efectivo sale de la caja del turno. Lo demás queda registrado como salida por su método, con la referencia.</p>
            )}
            <Button className="h-11 w-full text-base" disabled={busy || !shiftOpen || !!problem} onClick={disburse}>
              {busy ? "Entregando…" : `Entregar ${money(info.amount)} y activar cuotas`}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
