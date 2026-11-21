"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRequireSyncroAdmin } from "@/hooks/use-require-syncro-admin";
import type { FinanceSection } from "@/lib/central-finance-navigation";
import { adminApi, usd } from "@/lib/syncro-admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { expectedIncome, projection, simulateDebts, type Entry, type Plan } from "./calculations";

const names: Record<string, string> = {
  cash: "Caja", bank: "Banco", receivable: "Cuentas por cobrar", payable: "Cuentas por pagar",
  debt: "Deudas", equity: "Patrimonio", income: "Ingresos", food: "Mercado", dining: "Comidas fuera",
  housing: "Vivienda y servicios", transport: "Transporte", health: "Salud", interest: "Intereses", expense: "Otros gastos", subscriptions: "Suscripciones", shopping: "Compras", leisure: "Ocio",
};

const expenseAccounts = ["food", "dining", "housing", "transport", "health", "subscriptions", "shopping", "leisure", "interest", "expense"];

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Caracas", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const money = (cents: number) => usd(cents / 100);
const cents = (value: FormDataEntryValue | null) => Math.round(Number(value) * 100);
const emptyPlan = (personal: boolean): Plan => ({ income: personal ? 80000 : 0, payday1: 15, payday2: 31, grocery: 0, dining: 0, reserve: 0, obligations: [], debts: [] });

export default function FinanceWorkspace({ section }: { section: FinanceSection }) {
  useRequireSyncroAdmin();

  return <main className="mx-auto w-full max-w-6xl space-y-6 p-6">
    <header>
      <p className="text-sm text-muted-foreground">{section.group}{section.workspace === "company" && " · Empresa Syncro"}</p>
      <h1 className="text-2xl font-semibold">{section.title}</h1>
    </header>
    <Workspace key={section.slug} workspace={section.workspace} tab={section.tab} />
  </main>;
}

function Workspace({ workspace, tab }: { workspace: FinanceSection["workspace"]; tab: FinanceSection["tab"] }) {
  const path = "/finance/" + workspace;
  const [entries, setEntries] = useState<Entry[]>([]);
  const [plan, setPlan] = useState<Plan>(() => emptyPlan(workspace === "personal"));
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [paymentId, setPaymentId] = useState("");
  const [entryIds, setEntryIds] = useState<Record<string, string>>({});
  const [stress, setStress] = useState(false);
  const [statementBalance, setStatementBalance] = useState("");

  useEffect(() => {
    let current = true;
    adminApi<{ entries: Entry[]; plan: Plan | null }>(path).then(data => {
      if (!current) return;
      setEntries(data.entries);
      if (data.plan) setPlan(data.plan);
      setReady(true);
    }).catch(err => { if (current) setError(err.message); });
    return () => { current = false; };
  }, [path]);

  async function perform(action: () => Promise<void>, message: string) {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await action();
      setSuccess(message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setBusy(false);
    }
  }

  function savePlan(next: Plan) {
    return perform(async () => {
      setPlan(await adminApi<Plan>(path + "/plan", { method: "PUT", body: JSON.stringify(next) }));
    }, "Plan guardado");
  }

  function postEntry(event: FormEvent<HTMLFormElement>, kind = "journal") {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    const id = entryIds[kind] || crypto.randomUUID();
    setEntryIds(ids => ({ ...ids, [kind]: id }));
    const entry = {
      id,
      date: String(fields.get("date")),
      description: String(fields.get("description")),
      debit: String(fields.get("debit")),
      credit: kind === "income" ? "income" : String(fields.get("credit")),
      cents: cents(fields.get("amount")),
      smallSpend: fields.has("smallSpend"),
    };
    void perform(async () => {
      await adminApi(path + "/entries", { method: "POST", body: JSON.stringify(entry) });
      const data = await adminApi<{ entries: Entry[] }>(path);
      setEntries(data.entries);
      setEntryIds(ids => ({ ...ids, [kind]: "" }));
      form.reset();
    }, "Asiento registrado");
  }

  function postOwnerPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    const id = paymentId || crypto.randomUUID();
    setPaymentId(id);
    void perform(async () => {
      await adminApi(path + "/owner-payment", {
        method: "POST",
        body: JSON.stringify({ id, date: fields.get("date"), description: fields.get("description"), account: fields.get("account"), classification: fields.get("classification"), cents: cents(fields.get("amount")) }),
      });
      const data = await adminApi<{ entries: Entry[] }>(path);
      setEntries(data.entries);
      setPaymentId("");
      form.reset();
    }, "Pago registrado en los dos espacios");
  }

  if (!ready) return <p role="status">{error || "Cargando finanzas…"}</p>;

  const asOf = today();
  const month = asOf.slice(0, 7);
  const totals: Record<string, number> = {};
  const spending: Record<string, number> = {};
  for (const entry of entries) {
    if (entry.date > asOf) continue;
    totals[entry.debit] = (totals[entry.debit] ?? 0) + entry.cents;
    totals[entry.credit] = (totals[entry.credit] ?? 0) - entry.cents;
    if (entry.date.startsWith(month)) {
      spending[entry.debit] = (spending[entry.debit] ?? 0) + entry.cents;
      spending[entry.credit] = (spending[entry.credit] ?? 0) - entry.cents;
    }
  }
  const monthlyPayments = plan.obligations.filter(row =>
    row.kind === "payment" && (row.date.startsWith(month) || (row.monthly && row.date.slice(0, 7) < month)),
  ).reduce((sum, row) => sum + row.cents, 0);
  const monthlyMinimums = plan.debts.filter(debt => debt.date.slice(0, 7) <= month)
    .reduce((sum, debt) => sum + Math.min(debt.minimum, debt.balance + Math.round(debt.balance * debt.apr / 120_000)), 0);
  const income = -(spending.income ?? 0);
  const firstIncome = expectedIncome(plan, month, 1);
  const secondIncome = expectedIncome(plan, month, 2);
  const monthlyIncome = firstIncome + secondIncome;
  const purchases = entries.filter(entry =>
    entry.date <= asOf && entry.date.startsWith(month) && expenseAccounts.includes(entry.debit),
  );
  const smallPurchases = purchases.filter(entry => entry.smallSpend);
  const smallTotal = smallPurchases.reduce((sum, entry) => sum + entry.cents, 0);
  const smallLimit = plan.smallSpendLimit ?? 0;
  const monthlyExpenses = expenseAccounts.reduce((sum, account) => sum + (spending[account] ?? 0), 0);
  const assets = ["cash", "bank", "receivable"].reduce((sum, account) => sum + (totals[account] ?? 0), 0);
  const liabilities = -(totals.payable ?? 0) - (totals.debt ?? 0);
  const available = (totals.cash ?? 0) + (totals.bank ?? 0);
  const grocery = Math.max(0, plan.grocery - (spending.food ?? 0));
  const dining = Math.max(0, plan.dining - (spending.dining ?? 0));
  const forecast = projection(plan, asOf, available, grocery + dining, stress);
  const baseline = simulateDebts(plan.debts, 0);
  const extra = stress ? forecast.extra : Math.min(forecast.extra, projection(plan, asOf, available, grocery + dining, true).extra);
  const accelerated = simulateDebts(plan.debts, extra);

  return <div className="space-y-5">
    {error && <p role="alert" className="text-destructive">{error}</p>}
    {success && <p role="status">{success}</p>}
    <fieldset disabled={busy} className="min-w-0 space-y-4">
      {tab === "Resumen" && <>
        <div className="grid gap-3 sm:grid-cols-3">
          {[["Caja y banco registrados", available], ["Mercado disponible este mes", grocery], ["Comidas fuera disponibles este mes", dining]].map(([label, value]) =>
            <div className="rounded-lg border p-4" key={label}><p>{label}</p><p className="text-2xl font-semibold">{money(Number(value))}</p></div>)}
        </div>
        {workspace === "personal" && <div className="rounded border p-4">
          <h2 className="font-semibold">Distribución mensual de tus dos cobros</h2>
          <p>Primera quincena: {money(firstIncome)} · Segunda quincena: {money(secondIncome)} · Total previsto: {money(monthlyIncome)}</p>
          <p>Ingresos registrados este mes: {money(income)}</p>
          <p>Mercado y comidas fuera: {money(plan.grocery + plan.dining)} · Pagos previstos: {money(monthlyPayments)} · Cuotas de deuda: {money(monthlyMinimums)}</p>
          <p>Margen mensual antes de la reserva: {money(monthlyIncome - plan.grocery - plan.dining - monthlyPayments - monthlyMinimums)}</p>
          <p>Capacidad estimada para abono inmediato: <strong>{money(extra)}</strong></p>
        </div>}
        <h2 className="text-lg font-semibold">Flujo de caja de 13 semanas</h2>
        <p className="text-sm text-muted-foreground">Parte de los movimientos registrados hasta hoy. Confirma que los compromisos de hoy siguen pendientes. Los cobros quincenales de hoy cuentan al registrar el ingreso.</p>
        <label className="flex items-center gap-2"><input type="checkbox" checked={stress} onChange={e => setStress(e.target.checked)} /> Escenario con cobros 10 % menores</label>
        <p>{forecast.shortfall ? `Primer faltante frente a la reserva: ${forecast.shortfall.date} · ${money(forecast.shortfall.cents)}` : "La proyección cubre la reserva configurada."}</p>
        <ul className="grid gap-2 sm:grid-cols-3">{forecast.weeks.map(week => <li className="rounded border p-2" key={week.date}>{week.date} · {money(week.balance)}</li>)}</ul>
      </>}
      {(tab === "Estados financieros" || (tab === "Resumen" && workspace === "personal")) && <>
        <h2 className="text-lg font-semibold">Resumen contable</h2>
        <dl className="grid gap-2 sm:grid-cols-3">
          {[
            ["Activos registrados", assets], ["Pasivos registrados", liabilities], ["Patrimonio y resultado acumulado", assets - liabilities],
            ["Ingresos del mes", income], ["Gastos del mes", monthlyExpenses], ["Resultado del mes", income - monthlyExpenses],
            ["Variación de caja y banco del mes", (spending.cash ?? 0) + (spending.bank ?? 0)],
          ].map(([label, value]) => <div className="rounded border p-3" key={label}><dt>{label}</dt><dd>{money(Number(value))}</dd></div>)}
        </dl>
      </>}
      {tab === "Resumen" && <>
        <h2 className="text-lg font-semibold">Comparar saldo bancario</h2>
        <label className="block max-w-xs">Saldo del extracto al día de hoy (USD)
          <Input type="number" step="0.01" value={statementBalance} onChange={event => setStatementBalance(event.target.value)} />
        </label>
        {statementBalance !== "" && <p>Diferencia entre extracto y libro: {money(cents(statementBalance) - (totals.bank ?? 0))}</p>}
      </>}
      {(tab === "Estados financieros" || tab === "Libro diario" || (tab === "Resumen" && workspace === "personal")) && <>
        <h2 className="text-lg font-semibold">Saldos contables</h2>
        <dl className="grid gap-2 sm:grid-cols-2">{Object.entries(names).map(([key, label]) =>
          <div className="flex justify-between gap-3 rounded border p-2" key={key}><dt>{label}</dt><dd>{money((totals[key] ?? 0) * (["payable", "debt", "equity", "income"].includes(key) ? -1 : 1))}</dd></div>)}</dl>
      </>}
      {tab === "Gastos" && <>
        <h2 className="text-lg font-semibold">Registrar gasto</h2>
        <form className="flex flex-wrap items-end gap-3" onSubmit={event => postEntry(event, "expense")}>
          <label>Fecha<Input name="date" type="date" max={asOf} defaultValue={asOf} required /></label>
          <label>Concepto<Input name="description" maxLength={200} placeholder="Ej. Café camino al trabajo" required /></label>
          <Account name="debit" label="Categoría" options={expenseAccounts} />
          <Account name="credit" label="Pagado desde" options={["cash", "bank"]} />
          <Dollar name="amount" label="Importe" min={0.01} />
          <label className="flex gap-2"><input type="checkbox" name="smallSpend" /> Gasto hormiga</label>
          <Button type="submit">Registrar gasto</Button>
        </form>
        <h2 className="text-lg font-semibold">Adónde se fue el dinero este mes</h2>
        <p>Total de gastos registrados: <strong>{money(monthlyExpenses)}</strong></p>
        <dl className="grid gap-2 sm:grid-cols-2">
          {[...expenseAccounts].sort((a, b) => (spending[b] ?? 0) - (spending[a] ?? 0)).map(account =>
            <div className="flex justify-between rounded border p-2" key={account}><dt>{names[account]}</dt><dd>{money(spending[account] ?? 0)}</dd></div>)}
        </dl>
        <h2 className="text-lg font-semibold">Gastos hormiga de este mes</h2>
        <p>{smallPurchases.length} movimientos · <strong>{money(smallTotal)}</strong></p>
        {smallLimit > 0 && <p role="status">
          {smallTotal > smallLimit
            ? `Superaste el tope por ${money(smallTotal - smallLimit)}.`
            : `Disponible del tope de ${money(smallLimit)}: ${money(smallLimit - smallTotal)}.`}
        </p>}
        <h2 className="text-lg font-semibold">Movimientos del mes</h2>
        <ul className="space-y-2">{purchases.map(entry =>
          <li className="rounded border p-2" key={entry.id}>
            {entry.date} · {entry.description} · {names[entry.debit]} · {names[entry.credit]} · {money(entry.cents)}
            {entry.smallSpend && " · Gasto hormiga"}
          </li>)}</ul>
      </>}
      {tab === "Presupuesto" && <>
        <form className="grid gap-3 sm:grid-cols-3" onSubmit={event => {
          event.preventDefault();
          const fields = new FormData(event.currentTarget);
          void savePlan({ ...plan, income: cents(fields.get("income")), grocery: cents(fields.get("grocery")), dining: cents(fields.get("dining")), reserve: cents(fields.get("reserve")), smallSpendLimit: cents(fields.get("smallSpendLimit")), payday1: Number(fields.get("payday1")), payday2: Number(fields.get("payday2")) });
        }}>
          <Dollar name="income" label="Ingreso habitual por quincena" value={plan.income} />
          <Dollar name="grocery" label="Mercado mensual" value={plan.grocery} />
          <Dollar name="dining" label="Comidas fuera al mes" value={plan.dining} />
          <Dollar name="smallSpendLimit" label="Tope mensual de gastos hormiga" value={smallLimit} />
          <Dollar name="reserve" label="Reserva mínima" value={plan.reserve} />
          <label>Día del primer cobro<Input name="payday1" type="number" min="1" max="30" defaultValue={plan.payday1} required /></label>
          <label>Día del segundo cobro<Input name="payday2" type="number" min="2" max="31" defaultValue={plan.payday2} required /></label>
          <Button type="submit">Guardar presupuesto</Button>
        </form>
        <h2 className="text-lg font-semibold">Ajustar un cobro quincenal previsto</h2>
        <form className="flex flex-wrap items-end gap-3" onSubmit={event => {
          event.preventDefault();
          const fields = new FormData(event.currentTarget);
          const adjustment = { month: String(fields.get("month")), slot: fields.get("slot") === "2" ? 2 as const : 1 as const, cents: cents(fields.get("amount")) };
          const other = (plan.incomeOverrides ?? []).filter(row => row.month !== adjustment.month || row.slot !== adjustment.slot);
          void savePlan({ ...plan, incomeOverrides: [...other, adjustment] });
        }}>
          <label>Mes<Input name="month" type="month" defaultValue={month} required /></label>
          <label>Quincena<select name="slot" className="block rounded border bg-background p-2"><option value="1">Primera</option><option value="2">Segunda</option></select></label>
          <Dollar name="amount" label="Cobro previsto" />
          <Button type="submit">Guardar ajuste</Button>
        </form>
        <ul className="space-y-2">{(plan.incomeOverrides ?? []).map(row =>
          <li className="flex items-center justify-between gap-2 rounded border p-2" key={row.month + "-" + row.slot}>
            <span>{row.month} · Quincena {row.slot} · {money(row.cents)}</span>
            <Button variant="outline" type="button" onClick={() => void savePlan({ ...plan, incomeOverrides: (plan.incomeOverrides ?? []).filter(item => item !== row) })}>Restaurar habitual</Button>
          </li>)}</ul>
        <h2 className="text-lg font-semibold">Registrar ingreso recibido</h2>
        <p className="text-sm text-muted-foreground">Si cobraste antes de la fecha prevista, pon esa quincena en $0 para que el flujo de caja cuente el dinero una sola vez.</p>
        <form className="flex flex-wrap items-end gap-3" onSubmit={event => postEntry(event, "income")}>
          <label>Fecha<Input name="date" type="date" max={asOf} defaultValue={asOf} required /></label>
          <label>Concepto<Input name="description" maxLength={200} required /></label>
          <Account name="debit" label="Recibido en" options={["cash", "bank"]} />
          <Dollar name="amount" label="Importe recibido" min={0.01} />
          <Button type="submit">Registrar ingreso</Button>
        </form>
        <h2 className="text-lg font-semibold">Cobros y pagos previstos</h2>
        <form className="flex flex-wrap items-end gap-3" onSubmit={event => {
          event.preventDefault();
          const fields = new FormData(event.currentTarget);
          void savePlan({ ...plan, obligations: [...plan.obligations, { name: String(fields.get("name")), date: String(fields.get("date")), cents: cents(fields.get("amount")), kind: fields.get("kind") === "income" ? "income" : "payment", monthly: fields.has("monthly") }] });
        }}>
          <label>Concepto<Input name="name" maxLength={200} required /></label>
          <label>Vencimiento<Input name="date" type="date" required /></label>
          <Dollar name="amount" label="Importe" min={0.01} />
          <label>Tipo <select name="kind" className="block rounded border bg-background p-2"><option value="payment">Pago</option><option value="income">Cobro</option></select></label>
          <label className="flex gap-2"><input type="checkbox" name="monthly" /> Repetir cada mes</label>
          <Button type="submit">Agregar compromiso</Button>
        </form>
        <ul className="space-y-2">{plan.obligations.map((row, index) =>
          <li className="flex flex-wrap items-center justify-between gap-2 rounded border p-2" key={index}>
            <span>{row.name} · {row.date} · {row.kind === "payment" ? "Pago" : "Cobro"} {money(row.cents)} {row.monthly && "· Mensual"}</span>
            <Button variant="outline" type="button" onClick={() => void savePlan({ ...plan, obligations: plan.obligations.filter((_, i) => i !== index) })}>Quitar</Button>
          </li>)}</ul>
      </>}
      {tab === "Libro diario" && <>
        <p>Registra saldos iniciales y movimientos en USD. Para corregir un asiento, registra su reversión con las cuentas invertidas.</p>
        <form className="flex flex-wrap items-end gap-3" onSubmit={event => postEntry(event)}>
          <label>Fecha<Input name="date" type="date" max={asOf} defaultValue={asOf} required /></label>
          <label>Descripción<Input name="description" maxLength={200} required /></label>
          <Account name="debit" label="Debe" />
          <Account name="credit" label="Haber" />
          <Dollar name="amount" label="Importe" min={0.01} />
          <Button type="submit">Registrar asiento</Button>
        </form>
        {workspace === "company" && <form className="space-y-3 rounded border p-4" onSubmit={postOwnerPayment}>
          <h2 className="font-semibold">Registrar un pago de Syncro a mi cuenta personal</h2>
          <div className="flex flex-wrap items-end gap-3">
            <label>Fecha<Input name="date" type="date" max={asOf} defaultValue={asOf} required /></label>
            <label>Descripción<Input name="description" maxLength={200} required /></label>
            <label>Contrapartida<select name="classification" required defaultValue="" className="block rounded border bg-background p-2">
              <option value="" disabled>Seleccionar</option><option value="expense">Remuneración</option><option value="equity">Retiro de patrimonio</option>
            </select></label>
            <label>Medio en ambas cuentas<select name="account" className="block rounded border bg-background p-2"><option value="bank">Banco</option><option value="cash">Caja</option></select></label>
            <Dollar name="amount" label="Importe" min={0.01} />
            <Button type="submit">Registrar pago vinculado</Button>
          </div>
        </form>}
        <div className="overflow-x-auto"><table className="w-full text-left text-sm">
          <thead><tr>{["Fecha", "Descripción", "Debe", "Haber", "Importe"].map(label => <th key={label} className="p-2">{label}</th>)}</tr></thead>
          <tbody>{entries.map(entry => <tr key={entry.id} className="border-t">
            <td className="p-2">{entry.date}</td><td className="p-2">{entry.description}</td><td className="p-2">{names[entry.debit]}</td><td className="p-2">{names[entry.credit]}</td><td className="p-2">{money(entry.cents)}</td>
          </tr>)}</tbody>
        </table></div>
      </>}
      {tab === "Deudas" && <>
        <p>Simulación estimada para cuotas mensuales y tasa nominal anual fija. Registra las deudas aquí para incluir sus cuotas en la proyección.</p>
        <form className="flex flex-wrap items-end gap-3" onSubmit={event => {
          event.preventDefault();
          const fields = new FormData(event.currentTarget);
          void savePlan({ ...plan, debts: [...plan.debts, { name: String(fields.get("name")), date: String(fields.get("date")), balance: cents(fields.get("balance")), minimum: cents(fields.get("minimum")), apr: cents(fields.get("apr")) }] });
        }}>
          <label>Acreedor<Input name="name" maxLength={200} required /></label>
          <label>Próximo vencimiento<Input name="date" type="date" min={asOf} required /></label>
          <Dollar name="balance" label="Saldo pendiente" min={0.01} />
          <Dollar name="minimum" label="Cuota mensual" min={0.01} />
          <label>Tasa anual (%)<Input name="apr" type="number" min="0" max="1000" step="0.01" required /></label>
          <Button type="submit">Agregar deuda</Button>
        </form>
        <ul className="space-y-2">{plan.debts.map((debt, index) =>
          <li className="flex flex-wrap items-center justify-between gap-2 rounded border p-2" key={index}>
            <span>{debt.name} · Saldo {money(debt.balance)} · Cuota {money(debt.minimum)} · {debt.apr / 100}% anual · {debt.date}</span>
            <Button variant="outline" type="button" onClick={() => void savePlan({ ...plan, debts: plan.debts.filter((_, i) => i !== index) })}>Quitar</Button>
          </li>)}</ul>
        {plan.debts.length > 0 && <div className="space-y-2 rounded border p-4">
          <p>Capacidad estimada para un abono inmediato tras proteger la reserva durante 13 semanas: <strong>{money(extra)}</strong></p>
          <p>Cuotas y reasignación de cuotas liberadas: {baseline ? `${baseline.months} meses · ${money(baseline.interest)} en intereses` : "La simulación supera 600 meses."}</p>
          <p>Con el abono inmediato: {accelerated ? `${accelerated.months} meses · ${money(accelerated.interest)} en intereses` : "La simulación supera 600 meses."}</p>
          <p>Orden de abono por tasa: {[...plan.debts].sort((a, b) => b.apr - a.apr).map(debt => debt.name).join(", ")}</p>
        </div>}
      </>}
    </fieldset>
  </div>;
}

function Dollar({ name, label, value, min = 0 }: { name: string; label: string; value?: number; min?: number }) {
  return <label>{label} (USD)<Input name={name} type="number" step="0.01" min={min} defaultValue={value === undefined ? undefined : value / 100} required /></label>;
}

function Account({ name, label, options = Object.keys(names) }: { name: string; label: string; options?: string[] }) {
  return <label>{label}<select name={name} defaultValue="" required className="block rounded border bg-background p-2">
    <option value="" disabled>Seleccionar</option>
    {options.map(key => <option key={key} value={key}>{names[key]}</option>)}
  </select></label>;
}
