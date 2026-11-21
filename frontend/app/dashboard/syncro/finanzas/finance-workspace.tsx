"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, ChevronDown, Wallet } from "lucide-react";
import { useRequireSyncroAdmin } from "@/hooks/use-require-syncro-admin";
import { financeUrl, type FinanceSection } from "@/lib/central-finance-navigation";
import { adminApi, usd } from "@/lib/syncro-admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardAction, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { FinanceCheck, FinanceSelect, MoneyFields, type Quotes } from "./finance-fields";
import { CashForecast, FinanceOverview } from "./finance-overview";
import { FinanceDate } from "./finance-calendar";
import { projection, simulateDebts, walletAccounts, walletBalances, type Entry, type Frequency, type OriginalMoney, type Plan } from "./calculations";

const names: Record<string, string> = {
  cash: "Efectivo", bank: "Banco", binance: "Binance", receivable: "Cuentas por cobrar", payable: "Cuentas por pagar",
  debt: "Deudas", equity: "Patrimonio", income: "Ingresos", food: "Mercado", dining: "Comidas fuera",
  housing: "Vivienda y servicios", transport: "Transporte", health: "Salud", interest: "Intereses", expense: "Otros gastos", subscriptions: "Suscripciones", shopping: "Compras", leisure: "Ocio",
};

const expenseAccounts = ["food", "dining", "housing", "transport", "health", "subscriptions", "shopping", "leisure", "interest", "expense"];

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Caracas", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const nativeMoney = (cents: number, currency: string) =>
  `${currency} ${(cents / 100).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const money = (cents: number) => usd((cents || 0) / 100);
const cents = (value: FormDataEntryValue | null) => Math.round(Number(value) * 100);
function originalMoney(fields: FormData, prefix = ""): OriginalMoney {
  const selected = fields.get(prefix ? prefix + "Currency" : "currency");
  return {
    currency: String(selected === "other" ? fields.get(prefix ? prefix + "CurrencyCode" : "currencyCode") : selected ?? "USD").toUpperCase(),
    nativeCents: cents(fields.get(prefix ? prefix + "Amount" : "amount")),
    rate: Number(fields.get(prefix ? prefix + "Rate" : "rate") ?? 1),
  };
}

const emptyPlan: Plan = { income: 0, payday1: 15, payday2: 31, grocery: 0, dining: 0, reserve: 0, obligations: [], debts: [] };

export default function FinanceWorkspace({ section, mobile = false }: { section: FinanceSection; mobile?: boolean }) {
  useRequireSyncroAdmin(!mobile);

  return <main data-finance-mobile={mobile ? "" : undefined} className={mobile ? "space-y-4 px-4 pb-3 pt-4 sm:px-5" : "mx-auto w-full max-w-6xl space-y-5 p-3 sm:p-6"}>
    {!mobile && <header className="flex flex-wrap items-end justify-between gap-2">
      <div>
        <p className="text-sm text-muted-foreground">{section.group}{section.workspace === "company" && " · Empresa Syncro"}</p>
        <h1 className="text-2xl font-semibold">{section.title}</h1>
      </div>
      {!mobile && section.tab === "Resumen" && <Button asChild size="sm" variant="outline"><Link href="/finanzas/instalar/">Instalar app de Finanzas</Link></Button>}
    </header>}
    <Workspace key={section.slug} workspace={section.workspace} tab={section.tab} mobile={mobile} />
  </main>;
}

function Workspace({ workspace, tab, mobile }: { workspace: FinanceSection["workspace"]; tab: FinanceSection["tab"]; mobile: boolean }) {
  const path = "/finance/" + workspace;
  const [entries, setEntries] = useState<Entry[]>([]);
  const [plan, setPlan] = useState<Plan>(emptyPlan);
  const [hasPlan, setHasPlan] = useState(false);
  const [frequency, setFrequency] = useState<Frequency>("twice-monthly");
  const [quotes, setQuotes] = useState<Quotes>({});
  const [horizon, setHorizon] = useState(13);
  const [formRevision, setFormRevision] = useState(0);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [paymentId, setPaymentId] = useState("");
  const [entryIds, setEntryIds] = useState<Record<string, string>>({});
  const [stress, setStress] = useState(false);
  const [statementBalance, setStatementBalance] = useState("");
  const [quickAction, setQuickAction] = useState<"opening" | "income" | "transfer" | null>(null);

  useEffect(() => {
    let current = true;
    adminApi<{ entries: Entry[]; plan: Plan | null }>(path).then(data => {
      if (!current) return;
      setEntries(data.entries);
      if (data.plan) {
        setPlan(data.plan);
        setHasPlan(true);
        setHorizon(data.plan.horizonWeeks ?? 13);
        setFrequency(data.plan.frequency ?? "twice-monthly");
      }
      setReady(true);
    }).catch(err => { if (current) setError(err.message); });
    adminApi<Quotes>("/finance/rates").then(data => { if (current) setQuotes(data); }).catch(() => {});
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
      setHasPlan(true);
    }, "Plan guardado");
  }

  function postEntry(event: FormEvent<HTMLFormElement>, kind = "journal") {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    const id = entryIds[kind] || crypto.randomUUID();
    setEntryIds(ids => ({ ...ids, [kind]: id }));
    const original = originalMoney(fields);
    const destination = originalMoney(fields, "to");
    const entry = {
      id,
      ...original,
      ...(kind === "transfer" && { toCurrency: destination.currency, toCents: destination.nativeCents }),
      date: String(fields.get("date")),
      description: kind === "opening" ? "Saldo inicial" : kind === "transfer" ? "Transferencia entre cuentas" : String(fields.get("description")),
      debit: String(fields.get("debit")),
      credit: kind === "income" ? "income" : kind === "opening" ? "equity" : String(fields.get("credit")),
      cents: cents(fields.get("amount")),
      smallSpend: fields.has("smallSpend"),
    };
    void perform(async () => {
      await adminApi(path + "/entries", { method: "POST", body: JSON.stringify(entry) });
      const data = await adminApi<{ entries: Entry[] }>(path);
      setEntries(data.entries);
      setEntryIds(ids => ({ ...ids, [kind]: "" }));
      form.reset();
      setFormRevision(revision => revision + 1);
      if (kind === quickAction) setQuickAction(null);
    }, kind === "opening" ? "Saldo inicial registrado" : kind === "income" ? "Ingreso registrado" : kind === "expense" ? "Gasto registrado" : kind === "transfer" ? "Transferencia registrada" : "Asiento registrado");
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
        body: JSON.stringify({ id, date: fields.get("date"), description: fields.get("description"), account: fields.get("account"), classification: fields.get("classification"), ...originalMoney(fields) }),
      });
      const data = await adminApi<{ entries: Entry[] }>(path);
      setEntries(data.entries);
      setPaymentId("");
      form.reset();
      setFormRevision(revision => revision + 1);
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
  const income = -(spending.income ?? 0);
  const purchases = entries.filter(entry =>
    entry.date <= asOf && entry.date.startsWith(month) && expenseAccounts.includes(entry.debit),
  );
  const smallPurchases = purchases.filter(entry => entry.smallSpend);
  const smallTotal = smallPurchases.reduce((sum, entry) => sum + entry.cents, 0);
  const smallLimit = plan.smallSpendLimit ?? 0;
  const monthlyExpenses = expenseAccounts.reduce((sum, account) => sum + (spending[account] ?? 0), 0);
  const assets = [...walletAccounts, "receivable"].reduce((sum, account) => sum + (totals[account] ?? 0), 0);
  const liabilities = -(totals.payable ?? 0) - (totals.debt ?? 0);
  const wallets = walletBalances(entries, asOf);
  const bookBalance = walletAccounts.reduce((sum, account) => sum + (totals[account] ?? 0), 0);
  const hasCurrentQuotes = wallets.every(row => row.currency === "USD" || Number(quotes[row.currency]?.rate) > 0);
  const available = hasCurrentQuotes
    ? wallets.reduce((sum, row) => sum + Math.round(row.cents / (row.currency === "USD" ? 1 : quotes[row.currency]!.rate)), 0)
    : bookBalance;
  const opening = entries.filter(entry => entry.date <= asOf && entry.credit === "equity" &&
    walletAccounts.includes(entry.debit) && entry.description === "Saldo inicial").reduce((sum, row) => sum + row.cents, 0);
  const grocery = Math.max(0, plan.grocery - (spending.food ?? 0));
  const dining = Math.max(0, plan.dining - (spending.dining ?? 0));
  const forecast = projection(plan, asOf, available, grocery + dining, stress, horizon);
  const baseline = simulateDebts(plan.debts, 0);
  const extra = stress ? forecast.extra : Math.min(forecast.extra, projection(plan, asOf, available, grocery + dining, true, horizon).extra);
  const accelerated = simulateDebts(plan.debts, extra);
  const personal = workspace === "personal";
  const hasCashActivity = entries.some(entry => entry.date <= asOf &&
    [entry.debit, entry.credit].some(account => account === "cash" || account === "bank"));
  const sectionUrl = mobile ? (slug: string) => "/finanzas/" + slug : financeUrl;
  const budgetUrl = sectionUrl(personal ? "presupuesto-personal" : "presupuesto-empresa");

  const quickForm = quickAction && <form key={quickAction} className="mt-5 flex flex-wrap items-end gap-3 border-t pt-4" onSubmit={event => postEntry(event, quickAction)}>
    <FinanceDate label="Fecha" max={asOf} defaultValue={asOf} />
    {quickAction === "income" && <label>Concepto<Input name="description" placeholder="Ej. Sueldo" maxLength={200} required /></label>}
    {quickAction === "transfer" && <Account name="credit" label="Desde" options={walletAccounts} />}
    <Account name="debit" label={quickAction === "transfer" ? "Hacia" : "Dónde está el dinero"} options={walletAccounts} />
    <MoneyFields quotes={quotes} label={quickAction === "opening" ? "Saldo inicial" : quickAction === "transfer" ? "Importe enviado" : "Importe recibido"} />
    {quickAction === "transfer" && <MoneyFields quotes={quotes} prefix="to" label="Importe recibido" reference={false} />}
    <Button type="submit">Guardar {quickAction === "opening" ? "saldo" : quickAction === "transfer" ? "transferencia" : "ingreso"}</Button>
  </form>;

  return <div className="space-y-5">
    {error && <p role="alert" className="text-destructive">{error}</p>}
    {success && <p role="status">{success}</p>}
    <fieldset disabled={busy} className="min-w-0 space-y-4">
      {tab === "Resumen" && <>
        {mobile && <section className="space-y-3">
          <div className="relative overflow-hidden rounded-[26px] bg-[linear-gradient(160deg,#ffffff_0%,#fafbfc_42%,#eceff3_100%)] p-5 text-zinc-900 shadow-[0_18px_40px_-16px_rgba(90,30,5,0.45),inset_0_1px_0_#fff,inset_0_-12px_26px_rgba(140,150,170,0.18)]">
            <div className="relative z-10">
              <p className="text-sm font-semibold text-zinc-500">Saldo disponible</p>
              <p className="mt-1 text-[clamp(28px,8vw,44px)] font-bold leading-tight tracking-[-0.045em] tabular-nums">{money(available)}</p>
              <p className="mt-2 text-xs text-zinc-600">{hasCurrentQuotes ? "Equivalente en USD a tasa de referencia" : "Equivalente contable en USD"}</p>
            </div>
            <Wallet className="absolute -bottom-4 -right-2 size-28 -rotate-12 text-zinc-900/5" aria-hidden />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {([{ label: "Ingresos del mes", value: income, icon: ArrowDownLeft }, { label: "Gastos del mes", value: monthlyExpenses, icon: ArrowUpRight }]).map(({ label, value, icon: MetricIcon }) =>
              <div key={label} className="min-w-0 rounded-[22px] border bg-card p-3 shadow-xs">
                <MetricIcon className="mb-2 size-4 text-primary" aria-hidden />
                <p className="text-xs font-medium text-muted-foreground">{label}</p>
                <p className="mt-0.5 break-all font-semibold tabular-nums">{money(value)}</p>
              </div>
            )}
          </div>
        </section>}
        {personal && <section className="rounded-2xl border bg-card p-5 sm:p-6">
          <h2 className="text-xl font-semibold">{hasCashActivity ? "¿Qué quieres registrar?" : "Empieza por tu saldo de hoy"}</h2>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            {hasCashActivity
              ? "Anota lo que entra y sale para tener tu saldo al día."
              : "Anota el dinero que ya tienes en el banco o en efectivo. Luego registra cada cobro y cada gasto a medida que ocurran."}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {!hasCashActivity && <Button type="button" aria-expanded={quickAction === "opening"} onClick={() => setQuickAction(quickAction === "opening" ? null : "opening")}><Wallet /> Anotar saldo inicial</Button>}
            <Button type="button" variant={hasCashActivity ? "default" : "outline"} aria-expanded={quickAction === "income"} onClick={() => setQuickAction(quickAction === "income" ? null : "income")}><ArrowDownLeft /> Registrar ingreso</Button>
            <Button asChild variant="outline"><Link href={sectionUrl("gastos-personales")}><ArrowUpRight /> Registrar gasto</Link></Button>
            <Button type="button" variant="outline" aria-expanded={quickAction === "transfer"} onClick={() => setQuickAction(quickAction === "transfer" ? null : "transfer")}><ArrowLeftRight /> Transferir o cambiar</Button>
          </div>
          {quickForm}
          {quickAction === "opening" && <p className="mt-2 text-sm text-muted-foreground">Incluye en el saldo el dinero que ya está en esa cuenta. Registra por separado los cobros que recibas después.</p>}
        </section>}
        {!personal && <div className="rounded-xl border p-4">
          <Button type="button" variant="outline" aria-expanded={quickAction === "transfer"} onClick={() => setQuickAction(quickAction === "transfer" ? null : "transfer")}><ArrowLeftRight /> Transferir o cambiar</Button>
          {quickForm}
        </div>}
        {!hasPlan && (hasCashActivity || !personal) && <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
          <div><h2 className="font-semibold">Organiza tus próximos cobros</h2><p className="text-sm text-muted-foreground">Configura cuándo cobras y cuánto quieres apartar para comida.</p></div>
          <Button asChild variant="outline"><Link href={budgetUrl}>Configurar presupuesto</Link></Button>
        </div>}
        {!mobile && <div className="grid gap-3 sm:grid-cols-3">
          {[
            { label: "Saldo disponible", value: available, hint: hasCurrentQuotes ? "Equivalente en USD a tasa de referencia" : "Equivalente contable en USD", icon: Wallet },
            { label: "Ingresos del mes", value: income, hint: "Cobros registrados", icon: ArrowDownLeft },
            { label: "Gastos del mes", value: monthlyExpenses, hint: "Egresos registrados", icon: ArrowUpRight },
          ].map(({ label, value, hint, icon: Icon }) =>
            <Card className="@container/card bg-gradient-to-t from-primary/5 to-card shadow-xs" key={label}>
              <CardHeader><CardDescription>{label}</CardDescription>
                <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">{money(value)}</CardTitle>
                <CardAction><Icon className="size-4 text-primary" aria-hidden /></CardAction>
              </CardHeader>
              <CardFooter className="text-sm text-muted-foreground">{hint}</CardFooter>
            </Card>)}
        </div>}
        <FinanceDetails title="Saldos por cuenta y moneda">
          <p className="text-sm text-muted-foreground">El saldo inicial es el dinero registrado al comenzar. El saldo disponible refleja lo que entró y salió después. Cada movimiento conserva su tasa. El saldo usa la referencia vigente cuando está disponible para todas tus monedas.</p>
          {opening > 0 && <p>Saldo inicial registrado <strong>{money(opening)}</strong></p>}
          {wallets.length ? <dl className="grid gap-2 sm:grid-cols-2">{wallets.map(row =>
            <div key={row.account + row.currency} className="flex justify-between gap-2 rounded-lg border p-3"><dt>{names[row.account]}</dt><dd className="tabular-nums">{nativeMoney(row.cents, row.currency)}</dd></div>
          )}</dl> : <p>Aún no hay saldos registrados.</p>}
        </FinanceDetails>
        {personal && (plan.grocery > 0 || plan.dining > 0) && <div className="flex flex-wrap justify-between gap-2 rounded-lg border p-4">
          <div><p className="text-sm text-muted-foreground">Disponible para comida este mes</p>
            <p>Mercado <strong>{money(grocery)}</strong> · Comidas fuera <strong>{money(dining)}</strong></p></div>
          <Button asChild variant="ghost"><Link href={budgetUrl}>Ver presupuesto</Link></Button>
        </div>}
        <FinanceDetails title="Calendario e historial por período">
          <FinanceOverview plan={plan} entries={entries} today={asOf} expenseAccounts={expenseAccounts} />
        </FinanceDetails>
        <FinanceDetails title="Proyección de flujo de caja">
          <FinanceSelect label="Horizonte" value={String(horizon)} options={[4, 8, 13, 26, 52, horizon].filter((value, index, all) => all.indexOf(value) === index).sort((a, b) => a - b).map(value => [String(value), `${value} semanas`])} onChange={value => setHorizon(Number(value))} />
          <form className="flex flex-wrap items-end gap-2" onSubmit={event => {
            event.preventDefault();
            const weeks = Number(new FormData(event.currentTarget).get("weeks"));
            setHorizon(weeks);
            void savePlan({ ...plan, horizonWeeks: weeks });
          }}>
            <label className="block max-w-52 space-y-1.5 text-sm font-medium">Semanas personalizadas
              <Input key={horizon} name="weeks" className="h-11 rounded-xl" type="number" min={1} max={52} defaultValue={horizon} required />
            </label>
            <Button type="submit" variant="outline">Guardar horizonte</Button>
          </form>
          {plan.debts.length > 0 && <p>Capacidad estimada para abono inmediato <strong>{money(extra)}</strong></p>}
          <p className="text-sm text-muted-foreground">Parte de los movimientos registrados hasta hoy. Confirma que los compromisos de hoy siguen pendientes. Los cobros de hoy cuentan al registrar el ingreso.</p>
          <FinanceCheck checked={stress} onChange={setStress} label="Simular cobros 10 % menores" />
          <p>{forecast.shortfall ? `Primer faltante frente a la reserva: ${forecast.shortfall.date} · ${money(forecast.shortfall.cents)}` : "La proyección cubre la reserva configurada."}</p>
          <CashForecast weeks={forecast.weeks} />
        </FinanceDetails>
      </>}
      {tab === "Estados financieros" && <>
        <h2 className="text-lg font-semibold">Resumen contable</h2>
        <dl className="grid gap-2 sm:grid-cols-3">
          {[
            ["Activos registrados", assets], ["Pasivos registrados", liabilities], ["Patrimonio y resultado acumulado", assets - liabilities],
            ["Ingresos del mes", income], ["Gastos del mes", monthlyExpenses], ["Resultado del mes", income - monthlyExpenses],
            ["Variación de caja y banco del mes", (spending.cash ?? 0) + (spending.bank ?? 0)],
          ].map(([label, value]) => <div className="rounded border p-3" key={label}><dt>{label}</dt><dd>{money(Number(value))}</dd></div>)}
        </dl>
      </>}
      {tab === "Resumen" && !personal && <FinanceDetails title="Comparar saldo bancario">
        <label className="block max-w-xs">Saldo del extracto al día de hoy (USD)
          <Input type="number" step="0.01" value={statementBalance} onChange={event => setStatementBalance(event.target.value)} />
        </label>
        {statementBalance !== "" && <p>Diferencia entre extracto y libro: {money(cents(statementBalance) - (totals.bank ?? 0))}</p>}
      </FinanceDetails>}
      {(tab === "Estados financieros" || tab === "Libro diario") && <FinanceDetails title="Saldos contables en USD">
        <dl className="grid gap-2 sm:grid-cols-2">{Object.entries(names).map(([key, label]) =>
          <div className="flex justify-between gap-3 rounded border p-2" key={key}><dt>{label}</dt><dd>{money((totals[key] ?? 0) * (["payable", "debt", "equity", "income"].includes(key) ? -1 : 1))}</dd></div>)}</dl>
      </FinanceDetails>}
      {tab === "Gastos" && <>
        <h2 className="text-lg font-semibold">Registrar gasto</h2>
        <form key={formRevision} className="flex flex-wrap items-end gap-3" onSubmit={event => postEntry(event, "expense")}>
          <FinanceDate label="Fecha" max={asOf} defaultValue={asOf} />
          <label>Concepto<Input name="description" maxLength={200} placeholder="Ej. Café camino al trabajo" required /></label>
          <Account name="debit" label="Categoría" options={expenseAccounts} />
          <Account name="credit" label="Pagado desde" options={walletAccounts} />
          <MoneyFields quotes={quotes} label="Importe pagado" />
          <FinanceCheck name="smallSpend" label="Gasto hormiga" />
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
            {entry.date} · {entry.description} · {names[entry.debit]} · {names[entry.credit]} · {entry.nativeCents != null ? nativeMoney(entry.nativeCents, entry.currency ?? "USD") : money(entry.cents)}
            {entry.smallSpend && " · Gasto hormiga"}
          </li>)}</ul>
      </>}
      {tab === "Presupuesto" && <>
        <section className="space-y-4 rounded-xl border bg-card p-5">
        <div><h2 className="text-lg font-semibold">Tu plan habitual</h2><p className="text-sm text-muted-foreground">Elige cuándo cobras y cuánto quieres apartar cada mes.</p></div>
        <form className="grid gap-3 sm:grid-cols-3" onSubmit={event => {
          event.preventDefault();
          const fields = new FormData(event.currentTarget);
          void savePlan({ ...plan, frequency, weeklyPayday: Number(fields.get("weeklyPayday") ?? plan.weeklyPayday ?? 5), incomeOriginal: originalMoney(fields), grocery: cents(fields.get("grocery")), dining: cents(fields.get("dining")), reserve: cents(fields.get("reserve")), smallSpendLimit: cents(fields.get("smallSpendLimit")), payday1: Number(fields.get("payday1") ?? plan.payday1), payday2: Number(fields.get("payday2") ?? plan.payday2) });
        }}>
          <FinanceSelect label="Frecuencia de cobro" value={frequency} onChange={value => setFrequency(value as Frequency)}
            options={[["weekly", "Semanal"], ["twice-monthly", "Quincenal"], ["monthly", "Mensual"]]} />
          <MoneyFields quotes={quotes} label="Ingreso habitual por cobro" min={0} initial={plan.incomeOriginal ?? { currency: "USD", nativeCents: plan.income, rate: 1 }} />
          <Dollar name="grocery" label="Mercado mensual" value={plan.grocery} />
          <Dollar name="dining" label="Comidas fuera al mes" value={plan.dining} />
          <Dollar name="smallSpendLimit" label="Tope mensual de gastos hormiga" value={smallLimit} />
          <Dollar name="reserve" label="Reserva mínima" value={plan.reserve} />
          {frequency === "weekly" ? <FinanceSelect label="Día de cobro" name="weeklyPayday" defaultValue={String(plan.weeklyPayday ?? 5)}
            options={["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"].map((day, index) => [String(index), day])} /> : <>
            {frequency === "twice-monthly" && <label>Día del primer cobro<Input name="payday1" type="number" min="1" max="30" defaultValue={plan.payday1} required /></label>}
            <label>{frequency === "monthly" ? "Día de cobro" : "Día del segundo cobro"}
              <Input name="payday2" type="number" min={frequency === "monthly" ? 1 : 2} max="31" defaultValue={plan.payday2} required />
            </label>
          </>}
          <Button type="submit">Guardar presupuesto</Button>
        </form>
        </section>
        <FinanceDetails title="Cambiar un cobro o un mes">
        <h2 className="font-semibold">Ajustar el ingreso de un mes</h2>
        <p className="text-sm text-muted-foreground">Distribuye el total entre las fechas de cobro programadas de ese mes.</p>
        <form className="flex flex-wrap items-end gap-3" onSubmit={event => {
          event.preventDefault();
          const fields = new FormData(event.currentTarget);
          const adjustment = { month: String(fields.get("month")), cents: cents(fields.get("amount")) };
          const other = (plan.monthlyOverrides ?? []).filter(row => row.month !== adjustment.month);
          void savePlan({ ...plan, monthlyOverrides: [...other, adjustment] });
        }}>
          <label>Mes<Input name="month" type="month" defaultValue={month} required /></label>
          <Dollar name="amount" label="Ingreso total previsto del mes" />
          <Button type="submit">Guardar ajuste mensual</Button>
        </form>
        <ul className="space-y-2">{(plan.monthlyOverrides ?? []).map(row =>
          <li className="flex items-center justify-between gap-2 rounded border p-2" key={row.month}>
            <span>{row.month} · {money(row.cents)}</span>
            <Button variant="outline" type="button" onClick={() => void savePlan({ ...plan, monthlyOverrides: (plan.monthlyOverrides ?? []).filter(item => item.month !== row.month) })}>Restaurar habitual</Button>
          </li>)}</ul>
        <h2 className="text-lg font-semibold">Ajustar un cobro por fecha</h2>
        <p className="text-sm text-muted-foreground">El importe de esa fecha tiene prioridad sobre el cálculo mensual. Puedes usar $0 para cancelar un cobro previsto.</p>
        <form className="flex flex-wrap items-end gap-3" onSubmit={event => {
          event.preventDefault();
          const fields = new FormData(event.currentTarget);
          const adjustment = { date: String(fields.get("date")), cents: cents(fields.get("amount")) };
          const other = (plan.paydayOverrides ?? []).filter(row => row.date !== adjustment.date);
          void savePlan({ ...plan, paydayOverrides: [...other, adjustment] });
        }}>
          <FinanceDate label="Fecha del cobro" />
          <Dollar name="amount" label="Importe previsto ese día" />
          <Button type="submit">Guardar fecha e importe</Button>
        </form>
        <ul className="space-y-2">{(plan.paydayOverrides ?? []).map(row =>
          <li className="flex items-center justify-between gap-2 rounded border p-2" key={row.date}>
            <span>{row.date} · {money(row.cents)}</span>
            <Button variant="outline" type="button" onClick={() => void savePlan({ ...plan, paydayOverrides: (plan.paydayOverrides ?? []).filter(item => item !== row) })}>Quitar ajuste</Button>
          </li>)}</ul>
        {(plan.frequency ?? "twice-monthly") === "twice-monthly" && <>
        <h2 className="text-lg font-semibold">Ajustar un cobro quincenal previsto</h2>
        <form className="flex flex-wrap items-end gap-3" onSubmit={event => {
          event.preventDefault();
          const fields = new FormData(event.currentTarget);
          const adjustment = { month: String(fields.get("month")), slot: fields.get("slot") === "2" ? 2 as const : 1 as const, cents: cents(fields.get("amount")) };
          const other = (plan.incomeOverrides ?? []).filter(row => row.month !== adjustment.month || row.slot !== adjustment.slot);
          void savePlan({ ...plan, incomeOverrides: [...other, adjustment] });
        }}>
          <label>Mes<Input name="month" type="month" defaultValue={month} required /></label>
          <FinanceSelect label="Quincena" name="slot" defaultValue="1" options={[["1", "Primera"], ["2", "Segunda"]]} />
          <Dollar name="amount" label="Cobro previsto" />
          <Button type="submit">Guardar ajuste</Button>
        </form>
        <ul className="space-y-2">{(plan.incomeOverrides ?? []).map(row =>
          <li className="flex items-center justify-between gap-2 rounded border p-2" key={row.month + "-" + row.slot}>
            <span>{row.month} · Quincena {row.slot} · {money(row.cents)}</span>
            <Button variant="outline" type="button" onClick={() => void savePlan({ ...plan, incomeOverrides: (plan.incomeOverrides ?? []).filter(item => item !== row) })}>Restaurar habitual</Button>
          </li>)}</ul>
        </>}
        </FinanceDetails>
        <FinanceDetails title="Registrar un ingreso recibido">
        <p className="text-sm text-muted-foreground">Registra aquí el importe que llegó a tu cuenta. Ajusta el plan si ya recibiste un cobro que sigue previsto para una fecha futura.</p>
        <form key={formRevision} className="flex flex-wrap items-end gap-3" onSubmit={event => postEntry(event, "income")}>
          <FinanceDate label="Fecha" max={asOf} defaultValue={asOf} />
          <label>Concepto<Input name="description" maxLength={200} required /></label>
          <Account name="debit" label="Recibido en" options={walletAccounts} />
          <MoneyFields quotes={quotes} label="Importe recibido" />
          <Button type="submit">Registrar ingreso</Button>
        </form>
        </FinanceDetails>
        <FinanceDetails title="Programar cobros y pagos">
        <form className="flex flex-wrap items-end gap-3" onSubmit={event => {
          event.preventDefault();
          const fields = new FormData(event.currentTarget);
          void savePlan({ ...plan, obligations: [...plan.obligations, { name: String(fields.get("name")), date: String(fields.get("date")), cents: 0, original: originalMoney(fields), kind: fields.get("kind") === "income" ? "income" : "payment", monthly: fields.has("monthly") }] });
        }}>
          <label>Concepto<Input name="name" maxLength={200} required /></label>
          <FinanceDate label="Vencimiento" />
          <MoneyFields quotes={quotes} label="Importe previsto" />
          <FinanceSelect label="Tipo" name="kind" defaultValue="payment" options={[["payment", "Pago"], ["income", "Cobro"]]} />
          <FinanceCheck name="monthly" label="Repetir cada mes" />
          <Button type="submit">Agregar compromiso</Button>
        </form>
        <ul className="space-y-2">{plan.obligations.map((row, index) =>
          <li className="flex flex-wrap items-center justify-between gap-2 rounded border p-2" key={index}>
            <span>{row.name} · {row.date} · {row.kind === "payment" ? "Pago" : "Cobro"} {row.original ? nativeMoney(row.original.nativeCents, row.original.currency) : money(row.cents)} {row.monthly && "· Mensual"}</span>
            <Button variant="outline" type="button" onClick={() => void savePlan({ ...plan, obligations: plan.obligations.filter((_, i) => i !== index) })}>Quitar</Button>
          </li>)}</ul>
        </FinanceDetails>
      </>}
      {tab === "Libro diario" && <>
        {personal && <FinanceDetails title="Anotar el saldo inicial de otra cuenta">
          <p className="text-sm text-muted-foreground">Úsalo cuando comiences a llevar una cuenta de banco o efectivo.</p>
          <Button type="button" variant="outline" aria-expanded={quickAction === "opening"} onClick={() => setQuickAction(quickAction === "opening" ? null : "opening")}>Anotar saldo inicial</Button>
          {quickForm}
        </FinanceDetails>}
        <FinanceDetails title="Registrar asiento manual">
        <p className="text-sm text-muted-foreground">Para corregir un asiento, registra su reversión con las cuentas invertidas.</p>
        <form key={formRevision} className="flex flex-wrap items-end gap-3" onSubmit={event => postEntry(event)}>
          <FinanceDate label="Fecha" max={asOf} defaultValue={asOf} />
          <label>Descripción<Input name="description" maxLength={200} required /></label>
          <Account name="debit" label="Debe" />
          <Account name="credit" label="Haber" />
          <MoneyFields quotes={quotes} label="Importe" />
          <Button type="submit">Registrar asiento</Button>
        </form>
        </FinanceDetails>
        {workspace === "company" && <form key={formRevision} className="space-y-3 rounded border p-4" onSubmit={postOwnerPayment}>
          <h2 className="font-semibold">Registrar un pago de Syncro a mi cuenta personal</h2>
          <div className="flex flex-wrap items-end gap-3">
            <FinanceDate label="Fecha" max={asOf} defaultValue={asOf} />
            <label>Descripción<Input name="description" maxLength={200} required /></label>
            <FinanceSelect label="Concepto contable" name="classification" options={[["expense", "Remuneración"], ["equity", "Retiro de patrimonio"]]} />
            <FinanceSelect label="Medio en ambas cuentas" name="account" defaultValue="bank" options={walletAccounts.map(key => [key, names[key]])} />
            <MoneyFields quotes={quotes} label="Importe pagado" />
            <Button type="submit">Registrar pago vinculado</Button>
          </div>
        </form>}
        <div className="overflow-x-auto"><table className="w-full text-left text-sm">
          <thead><tr>{["Fecha", "Descripción", "Debe", "Haber", "Importe"].map(label => <th key={label} className="p-2">{label}</th>)}</tr></thead>
          <tbody>{entries.map(entry => <tr key={entry.id} className="border-t">
            <td className="p-2">{entry.date}</td><td className="p-2">{entry.description}</td><td className="p-2">{names[entry.debit]}</td><td className="p-2">{names[entry.credit]}</td><td className="p-2">{money(entry.cents)}
              {entry.nativeCents != null && entry.currency !== "USD" && <div className="text-xs text-muted-foreground">{nativeMoney(entry.nativeCents, entry.currency ?? "USD")}</div>}
              {entry.toCurrency && entry.toCents != null && <div className="text-xs text-muted-foreground">Recibido {nativeMoney(entry.toCents, entry.toCurrency)}</div>}
              {entry.rate && entry.currency !== "USD" && <div className="text-xs text-muted-foreground">{Number(entry.rate).toLocaleString("es-VE", { maximumFractionDigits: 8 })} {entry.currency} por USD</div>}
            </td>
          </tr>)}</tbody>
        </table></div>
      </>}
      {tab === "Deudas" && <>
        <p>Simulación estimada para cuotas mensuales y tasa nominal anual fija. Registra las deudas aquí para incluir sus cuotas en la proyección.</p>
        <form className="flex flex-wrap items-end gap-3" onSubmit={event => {
          event.preventDefault();
          const fields = new FormData(event.currentTarget);
          void savePlan({ ...plan, debts: [...plan.debts, { name: String(fields.get("name")), date: String(fields.get("date")), balance: 0, minimum: 0, balanceOriginal: originalMoney(fields, "balance"), minimumOriginal: originalMoney(fields, "minimum"), apr: cents(fields.get("apr")) }] });
        }}>
          <label>Acreedor<Input name="name" maxLength={200} required /></label>
          <FinanceDate label="Próximo vencimiento" min={asOf} />
          <MoneyFields quotes={quotes} prefix="balance" label="Saldo pendiente" />
          <MoneyFields quotes={quotes} prefix="minimum" label="Cuota mensual" />
          <label>Tasa anual (%)<Input name="apr" type="number" min="0" max="1000" step="0.01" required /></label>
          <Button type="submit">Agregar deuda</Button>
        </form>
        <ul className="space-y-2">{plan.debts.map((debt, index) =>
          <li className="flex flex-wrap items-center justify-between gap-2 rounded border p-2" key={index}>
            <span>{debt.name} · Saldo {debt.balanceOriginal ? nativeMoney(debt.balanceOriginal.nativeCents, debt.balanceOriginal.currency) : money(debt.balance)} · Cuota {debt.minimumOriginal ? nativeMoney(debt.minimumOriginal.nativeCents, debt.minimumOriginal.currency) : money(debt.minimum)} · {debt.apr / 100}% anual · {debt.date}</span>
            <Button variant="outline" type="button" onClick={() => void savePlan({ ...plan, debts: plan.debts.filter((_, i) => i !== index) })}>Quitar</Button>
          </li>)}</ul>
        {plan.debts.length > 0 && <div className="space-y-2 rounded border p-4">
          <p>Capacidad estimada para un abono inmediato tras proteger la reserva durante {horizon} semanas: <strong>{money(extra)}</strong></p>
          <p>Cuotas y reasignación de cuotas liberadas: {baseline ? `${baseline.months} meses · ${money(baseline.interest)} en intereses` : "La simulación supera 600 meses."}</p>
          <p>Con el abono inmediato: {accelerated ? `${accelerated.months} meses · ${money(accelerated.interest)} en intereses` : "La simulación supera 600 meses."}</p>
          <p>Orden de abono por tasa: {[...plan.debts].sort((a, b) => b.apr - a.apr).map(debt => debt.name).join(", ")}</p>
        </div>}
      </>}
    </fieldset>
  </div>;
}

function FinanceDetails({ title, children }: { title: string; children: React.ReactNode }) {
  return <details className="group rounded-xl border bg-card">
    <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 font-medium [&::-webkit-details-marker]:hidden">
      {title}<ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
    </summary>
    <div className="space-y-4 border-t p-4">{children}</div>
  </details>;
}

function Dollar({ name, label, value, min = 0 }: { name: string; label: string; value?: number; min?: number }) {
  return <label>{label} (USD)<Input className="h-11 rounded-xl" inputMode="decimal" name={name} type="number" step="0.01" min={min} defaultValue={value === undefined ? undefined : value / 100} required /></label>;
}

function Account({ name, label, options = Object.keys(names) }: { name: string; label: string; options?: string[] }) {
  return <FinanceSelect label={label} name={name} options={options.map(key => [key, names[key]])} />;
}
