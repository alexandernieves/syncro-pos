"use client";

import { useCallback, useEffect, useState } from "react";
import { IconBan, IconCheck, IconClockPlay, IconLoader2, IconReceipt2, IconTrash } from "@tabler/icons-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/gym/confirm-dialog";
import {
  type BusinessDetail,
  type BusinessStatus,
  MODULE_LABEL,
  PLAN_LABEL,
  PLANS,
  ROLE_LABEL,
  STATUS_CLASS,
  STATUS_LABEL,
  actionLabel,
  adminApi,
  ago,
  dateTime,
  shortDate,
  toDateInput,
  usd,
} from "@/lib/syncro-admin";

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-muted/50 px-3 py-2.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}

/** Full picture of one business for the Syncro team: account, subscription, people and activity. */
export function BusinessSheet({ businessId, onClose, onChanged }: { businessId: string | null; onClose: () => void; onChanged: () => void }) {
  const [data, setData] = useState<BusinessDetail | null>(null);
  const [form, setForm] = useState({ subscription: "BASIC", monthlyFee: "", subscriptionEndsAt: "", adminNotes: "" });
  const [saving, setSaving] = useState(false);
  const [statusTo, setStatusTo] = useState<BusinessStatus | null>(null);
  const [paying, setPaying] = useState(false);
  const [voiding, setVoiding] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!businessId) return;
    try {
      const d = await adminApi<BusinessDetail>(`/business/${businessId}`);
      setData(d);
      setForm({ subscription: d.subscription, monthlyFee: d.monthlyFee != null ? String(d.monthlyFee) : "", subscriptionEndsAt: toDateInput(d.subscriptionEndsAt), adminNotes: d.adminNotes ?? "" });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }, [businessId]);

  useEffect(() => { setData(null); load(); }, [load]);

  const refresh = () => { load(); onChanged(); };

  const saveSubscription = async () => {
    if (!data) return;
    setSaving(true);
    try {
      await adminApi(`/business/${data.id}`, {
        method: "PUT",
        body: JSON.stringify({
          subscription: form.subscription,
          monthlyFee: form.monthlyFee === "" ? null : Number(form.monthlyFee),
          subscriptionEndsAt: form.subscriptionEndsAt ? `${form.subscriptionEndsAt}T23:59:59` : null,
          adminNotes: form.adminNotes,
        }),
      });
      toast.success("Suscripción guardada");
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const daysLeft = data?.subscriptionEndsAt ? Math.ceil((new Date(data.subscriptionEndsAt).getTime() - Date.now()) / 86_400_000) : null;
  const owner = data?.users.find((u) => ["ownerpos", "owner"].includes(u.role)) ?? data?.users[0];

  return (
    <Sheet open={!!businessId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-2xl">
        {!data ? (
          <div className="flex h-full items-center justify-center text-muted-foreground"><IconLoader2 className="animate-spin" /></div>
        ) : (
          <>
            <SheetHeader className="border-b px-6 py-5">
              <div className="flex flex-wrap items-center gap-2">
                <SheetTitle className="text-xl">{data.name}</SheetTitle>
                <Badge variant="outline" className={STATUS_CLASS[data.status]}>{STATUS_LABEL[data.status]}</Badge>
                <Badge variant="outline">{PLAN_LABEL[data.subscription] ?? data.subscription}</Badge>
              </div>
              <SheetDescription>
                Cliente desde el {shortDate(data.createdAt)} · última actividad: {ago(data.lastActivityAt).toLowerCase()}
              </SheetDescription>
              {data.status === "SUSPENDED" && (
                <p className="mt-2 rounded-lg bg-rose-600/10 px-3 py-2 text-sm text-rose-700">
                  Sin acceso al sistema{data.suspendedReason ? `: ${data.suspendedReason}` : "."}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {data.status !== "ACTIVE" && (
                  <Button size="sm" onClick={() => setStatusTo("ACTIVE")}><IconCheck size={16} /> Activar</Button>
                )}
                {data.status !== "TRIAL" && (
                  <Button size="sm" variant="outline" onClick={() => setStatusTo("TRIAL")}><IconClockPlay size={16} /> Pasar a prueba</Button>
                )}
                {data.status !== "SUSPENDED" && (
                  <Button size="sm" variant="outline" className="text-rose-700 hover:text-rose-700" onClick={() => setStatusTo("SUSPENDED")}><IconBan size={16} /> Suspender</Button>
                )}
                <Button size="sm" variant="outline" onClick={() => setPaying(true)}><IconReceipt2 size={16} /> Registrar pago</Button>
              </div>
            </SheetHeader>

            <div className="space-y-7 px-6 py-6">
              <Section title="Contacto">
                <div className="grid gap-2 sm:grid-cols-2">
                  <Fact label="Dueño" value={owner ? `${owner.name ?? "Sin nombre"} · ${owner.email}` : "—"} />
                  <Fact label="Correo del negocio" value={data.email || "—"} />
                  <Fact label="Teléfono" value={data.phone || "—"} />
                  <Fact label="RIF" value={data.ruc || "—"} />
                </div>
              </Section>

              <Section title="Uso en los últimos 30 días">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Fact label="Ventas" value={`${data.last30d.sales} · ${usd(data.last30d.salesTotal)}`} />
                  <Fact label="Cobros del gimnasio" value={`${data.last30d.gymPayments} · ${usd(data.last30d.gymTotal)}`} />
                  <Fact label="Productos" value={data._count.products} />
                  <Fact label="Socios del gimnasio" value={data._count.gymMembers} />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {data.enabledModules.length ? data.enabledModules.map((m) => <Badge key={m} variant="secondary">{MODULE_LABEL[m] ?? m}</Badge>) : <span className="text-sm text-muted-foreground">Todos los módulos</span>}
                </div>
              </Section>

              <Section title="Suscripción">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="bs-plan">Plan</Label>
                    <select id="bs-plan" value={form.subscription} onChange={(e) => setForm({ ...form, subscription: e.target.value })} className="h-9 w-full rounded-md border bg-background px-2 text-sm">
                      {PLANS.map((p) => <option key={p} value={p}>{PLAN_LABEL[p]}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="bs-fee">Cuota mensual (USD)</Label>
                    <Input id="bs-fee" type="number" min={0} step="0.01" value={form.monthlyFee} onChange={(e) => setForm({ ...form, monthlyFee: e.target.value })} placeholder="0,00" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="bs-ends">Pagado hasta</Label>
                    <Input id="bs-ends" type="date" value={form.subscriptionEndsAt} onChange={(e) => setForm({ ...form, subscriptionEndsAt: e.target.value })} />
                  </div>
                </div>
                {daysLeft !== null && (
                  <p className={cn("text-sm", daysLeft < 0 ? "text-rose-700" : daysLeft <= 7 ? "text-amber-700" : "text-muted-foreground")}>
                    {daysLeft < 0 ? `Vencida hace ${-daysLeft} ${-daysLeft === 1 ? "día" : "días"}` : daysLeft === 0 ? "Vence hoy" : `Vence en ${daysLeft} ${daysLeft === 1 ? "día" : "días"}`}
                  </p>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="bs-notes">Notas internas</Label>
                  <textarea id="bs-notes" rows={3} value={form.adminNotes} onChange={(e) => setForm({ ...form, adminNotes: e.target.value })} placeholder="Acuerdos, contacto preferido, descuentos…" className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40" />
                </div>
                <Button onClick={saveSubscription} disabled={saving}>{saving && <IconLoader2 size={16} className="animate-spin" />} Guardar suscripción</Button>
              </Section>

              <Section title="Pagos de suscripción">
                {data.subscriptionPayments.length ? (
                  <div className="divide-y rounded-xl border">
                    {data.subscriptionPayments.map((p) => (
                      <div key={p.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold tabular-nums">{usd(p.amount)} · {p.months} {p.months === 1 ? "mes" : "meses"}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {shortDate(p.createdAt)} · cubre del {shortDate(p.periodStart)} al {shortDate(p.periodEnd)}
                            {p.method ? ` · ${p.method}` : ""}{p.reference ? ` · ref. ${p.reference}` : ""}
                          </p>
                        </div>
                        <Button size="icon" variant="ghost" aria-label="Anular pago" onClick={() => setVoiding(p.id)}><IconTrash size={16} /></Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Todavía no hay pagos registrados.</p>
                )}
              </Section>

              <Section title={`Usuarios (${data.users.length})`}>
                <div className="divide-y rounded-xl border">
                  {data.users.map((u) => (
                    <div key={u.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{u.name || "Sin nombre"}</p>
                        <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                      </div>
                      <Badge variant="secondary">{ROLE_LABEL[u.role] ?? u.role}</Badge>
                      <span className="w-24 shrink-0 text-right text-xs text-muted-foreground">{ago(u.lastSeen)}</span>
                    </div>
                  ))}
                </div>
              </Section>

              <Section title={`Sucursales (${data.branches.length})`}>
                <div className="flex flex-wrap gap-2">
                  {data.branches.map((b) => (
                    <span key={b.id} className="rounded-lg bg-muted/60 px-2.5 py-1 text-sm">{b.name}{b.isMain ? " · principal" : ""}{b.location ? ` · ${b.location}` : ""}</span>
                  ))}
                </div>
              </Section>

              <Section title="Actividad reciente">
                {data.recentActivity.length ? (
                  <div className="divide-y rounded-xl border">
                    {data.recentActivity.map((a) => (
                      <div key={a.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                        <span className="min-w-0 flex-1 truncate">{actionLabel(a.action)}</span>
                        <span className="truncate text-xs text-muted-foreground">{a.user?.name || a.user?.email || "—"}</span>
                        <span className="w-36 shrink-0 text-right text-xs text-muted-foreground">{dateTime(a.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Sin actividad registrada.</p>
                )}
              </Section>
            </div>
          </>
        )}

        <ConfirmDialog
          open={!!statusTo}
          danger={statusTo === "SUSPENDED"}
          title={statusTo === "SUSPENDED" ? `¿Suspender a ${data?.name}?` : statusTo === "TRIAL" ? `¿Pasar a ${data?.name} a período de prueba?` : `¿Activar a ${data?.name}?`}
          description={
            statusTo === "SUSPENDED"
              ? "Todos sus usuarios pierden el acceso al momento y ven el motivo al intentar entrar. Sus datos no se borran."
              : statusTo === "ACTIVE"
                ? "Sus usuarios vuelven a entrar normalmente."
                : "Sigue con acceso completo mientras prueba el sistema."
          }
          reason={statusTo === "SUSPENDED" ? { label: "Motivo (lo verá el negocio)", suggestions: ["Falta de pago", "Solicitud del cliente", "Uso indebido"], required: true } : undefined}
          confirmLabel={statusTo === "SUSPENDED" ? "Suspender" : statusTo === "TRIAL" ? "Pasar a prueba" : "Activar"}
          onConfirm={async (reason) => {
            if (!data || !statusTo) return;
            try {
              await adminApi(`/business/${data.id}/status`, { method: "PUT", body: JSON.stringify({ status: statusTo, reason }) });
              toast.success(`${data.name}: ${STATUS_LABEL[statusTo].toLowerCase()}`);
              refresh();
            } catch (e) {
              toast.error((e as Error).message);
              throw e;
            }
          }}
          onClose={() => setStatusTo(null)}
        />

        <ConfirmDialog
          open={!!voiding}
          danger
          title="¿Anular este pago?"
          description="Se borra del historial. Si es el último pago, la fecha de vencimiento vuelve a la anterior."
          confirmLabel="Anular pago"
          onConfirm={async () => {
            if (!voiding) return;
            try {
              await adminApi(`/payments/${voiding}`, { method: "DELETE" });
              toast.success("Pago anulado");
              refresh();
            } catch (e) {
              toast.error((e as Error).message);
              throw e;
            }
          }}
          onClose={() => setVoiding(null)}
        />

        {data && <PaymentDialog business={data} open={paying} onClose={() => setPaying(false)} onSaved={refresh} />}
      </SheetContent>
    </Sheet>
  );
}

/** Records a subscription payment; the due date moves forward by the months paid. */
export function PaymentDialog({ business, open, onClose, onSaved }: { business: { id: string; name: string; monthlyFee: number | null; subscriptionEndsAt: string | null; status: string }; open: boolean; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ months: "1", amount: "", method: "", reference: "", note: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setForm({ months: "1", amount: business.monthlyFee ? String(business.monthlyFee) : "", method: "", reference: "", note: "" });
  }, [open, business.monthlyFee]);

  const months = Math.max(1, Number(form.months) || 1);
  const from = business.subscriptionEndsAt && new Date(business.subscriptionEndsAt) > new Date() ? new Date(business.subscriptionEndsAt) : new Date();
  const until = new Date(from);
  until.setMonth(until.getMonth() + months);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await adminApi(`/business/${business.id}/payments`, { method: "POST", body: JSON.stringify({ ...form, months, amount: Number(form.amount) }) });
      toast.success(`Pago registrado. ${business.name} queda al día hasta el ${shortDate(until)}`);
      onSaved();
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Registrar pago · {business.name}</DialogTitle>
            <DialogDescription>Queda al día hasta el <strong className="text-foreground">{shortDate(until)}</strong>.{business.status !== "ACTIVE" && " El negocio pasa a activo."}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pay-months">Meses</Label>
              <Input
                id="pay-months"
                type="number"
                min={1}
                max={36}
                value={form.months}
                onChange={(e) => {
                  const m = e.target.value;
                  setForm((f) => ({ ...f, months: m, amount: business.monthlyFee ? String(+(business.monthlyFee * (Number(m) || 1)).toFixed(2)) : f.amount }));
                }}
                required
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pay-amount">Monto (USD)</Label>
              <Input id="pay-amount" type="number" min={0.01} step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pay-method">Método</Label>
              <select id="pay-method" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} className="h-9 w-full rounded-md border bg-background px-2 text-sm">
                <option value="">Sin indicar</option>
                <option>Pago móvil</option>
                <option>Transferencia</option>
                <option>Zelle</option>
                <option>Efectivo</option>
                <option>Binance</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pay-ref">Referencia</Label>
              <Input id="pay-ref" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="Opcional" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pay-note">Nota</Label>
            <Input id="pay-note" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Opcional" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancelar</Button>
            <Button type="submit" disabled={busy}>{busy && <IconLoader2 size={16} className="animate-spin" />} Registrar pago</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
