"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, CalendarDays, ChartNoAxesCombined, Wallet } from "lucide-react";
import { useRequireSyncroAdmin } from "@/hooks/use-require-syncro-admin";
import { financeUrl, type FinanceSection } from "@/lib/central-finance-navigation";
import { adminApi, usd } from "@/lib/syncro-admin";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Card, CardAction, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { FinanceSheet } from "./finance-sheet";
import { FinanceCheck, FinanceSelect, MoneyFields, type Quotes } from "./finance-fields";
import { CashForecast, FinanceOverview } from "./finance-overview";
import { FinanceDate, readableDate } from "./finance-calendar";
import { budgetSuggestion } from "./budget-suggestion";
import { BankImport } from "./bank-import";
import FinanceNubiSettings from "./finance-nubi-settings";
import FiscalRecords from "./fiscal-records";
import { FinanceSkeleton } from "./finance-skeleton";
import { FinanceDecisionCard, FinanceQuickActions } from "./finance-decision-card";
import { FinanceDebtsView } from "./finance-debts-view";
import { FinanceExpensesView } from "./finance-expenses-view";
import { FinanceLedgerView } from "./finance-ledger-view";
import { projection, simulateDebts, shiftDay, walletAccounts, walletBalances, type Entry, type Frequency, type OriginalMoney, type Plan } from "./calculations";

const names: Record<string, string> = {
  cash: "Efectivo", bank: "Banco", binance: "Binance", receivable: "Cuentas por cobrar", payable: "Cuentas por pagar",
  debt: "Deudas", equity: "Patrimonio", income: "Ingresos", food: "Mercado", dining: "Comidas fuera",
  housing: "Vivienda y servicios", transport: "Transporte", health: "Salud", interest: "Intereses", expense: "Otros gastos", subscriptions: "Suscripciones", shopping: "Compras", leisure: "Ocio",
};

const budgetViews = { suggestion: "Distribución", habitual: "Mi plan", income: "Cobros", payments: "Pagos" } as const;
type BudgetView = keyof typeof budgetViews;

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

  return <main data-finance-workspace="" data-finance-mobile={mobile ? "" : undefined} className={mobile ? "space-y-4 px-4 pb-3 pt-4 sm:px-5" : "mx-auto w-full max-w-6xl space-y-5 p-3 sm:p-6"}>
    {!mobile && <header className="flex flex-wrap items-end justify-between gap-2">
      <div>
        <p className="text-sm text-muted-foreground">{section.group}{section.workspace === "company" && " · Empresa Syncro"}</p>
        <h1 className="text-2xl font-semibold">{section.title}</h1>
      </div>
      {!mobile && section.tab === "Resumen" && <Button asChild size="sm" variant="outline"><Link href="/finanzas/instalar/">Instalar app de Finanzas</Link></Button>}
    </header>}
    {section.tab === "Fiscal" ? <FiscalRecords key={section.slug} workspace={section.workspace} mobile={mobile} />
      : section.tab === "Nubi" ? <FinanceNubiSettings />
      : <Workspace key={section.slug} workspace={section.workspace} tab={section.tab} mobile={mobile} />}
  </main>;
}

function Workspace({ workspace, tab, mobile }: { workspace: FinanceSection["workspace"]; tab: FinanceSection["tab"]; mobile: boolean }) {
  const path = "/finance/" + workspace;
  const [entries, setEntries] = useState<Entry[]>([]);
  const [plan, setPlan] = useState<Plan>(emptyPlan);
  const [hasPlan, setHasPlan] = useState(false);
  const [budgetMonth, setBudgetMonth] = useState(() => shiftDay(today().slice(0, 7) + "-01", 32).slice(0, 7));
  const [groceryReceipts, setGroceryReceipts] = useState("");
  const [budgetView, setBudgetView] = useState<BudgetView>(workspace === "personal" ? "suggestion" : "habitual");
  const [editingPayment, setEditingPayment] = useState<number | null>(null);
  const [frequency, setFrequency] = useState<Frequency>("twice-monthly");
  const [quotes, setQuotes] = useState<Quotes>({});
  const [horizon, setHorizon] = useState(13);
  const [formRevision, setFormRevision] = useState(0);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [expenseFilter, setExpenseFilter] = useState("all");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [paymentId, setPaymentId] = useState("");
  const [entryIds, setEntryIds] = useState<Record<string, string>>({});
  const [stress, setStress] = useState(false);
  const [statementBalance, setStatementBalance] = useState("");
  const [showBankImport, setShowBankImport] = useState(false);
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

  function savePlan(next: Plan, onSaved?: () => void) {
    return perform(async () => {
      setPlan(await adminApi<Plan>(path + "/plan", { method: "PUT", body: JSON.stringify(next) }));
      setHasPlan(true);
      onSaved?.();
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
      if (kind === "expense") setExpenseOpen(false);
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

  async function payDebt({ index, date, wallet, original }: { index: number; date: string; wallet: string; original: OriginalMoney }) {
    const debt = plan.debts[index];
    if (!debt) return;
    const paidUsdCents = original.currency === "USD" || original.currency === "USDT"
      ? original.nativeCents
      : Math.round(original.nativeCents / (original.rate || 1));
    await perform(async () => {
      await adminApi(path + "/entries", {
        method: "POST",
        body: JSON.stringify({
          id: crypto.randomUUID(),
          ...original,
          date,
          description: `Abono deuda: ${debt.name}`,
          debit: "debt",
          credit: wallet,
          cents: paidUsdCents,
          smallSpend: false,
        }),
      });
      const data = await adminApi<{ entries: Entry[] }>(path);
      setEntries(data.entries);
      const remainingBalance = Math.max(0, debt.balance - paidUsdCents);
      const nextDebts = plan.debts.flatMap((item, i) => {
        if (i !== index) return [item];
        if (remainingBalance <= 0) return [];
        const updatedOriginal = item.balanceOriginal && item.balanceOriginal.currency === original.currency
          ? { ...item.balanceOriginal, nativeCents: Math.max(0, item.balanceOriginal.nativeCents - original.nativeCents) }
          : { currency: "USD", nativeCents: remainingBalance, rate: 1 };
        return [{ ...item, balance: remainingBalance, balanceOriginal: updatedOriginal }];
      });
      setPlan(await adminApi<Plan>(path + "/plan", { method: "PUT", body: JSON.stringify({ ...plan, debts: nextDebts }) }));
    }, `Abono registrado en ${debt.name}`);
  }

  if (!ready) return error
    ? <p role="alert" className="rounded-xl border bg-card p-4 text-destructive">{error}</p>
    : <FinanceSkeleton tab={tab} mobile={mobile} />;

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
  const spendingCategories = expenseAccounts
    .map(account => ({ account, amount: spending[account] ?? 0 }))
    .sort((a, b) => b.amount - a.amount);
  const largestExpense = spendingCategories[0]?.amount ?? 0;
  const filteredPurchases = purchases.filter(entry =>
    expenseFilter === "all" || (expenseFilter === "small" ? entry.smallSpend : entry.debit === expenseFilter));
  const smallPurchases = purchases.filter(entry => entry.smallSpend);
  const smallTotal = smallPurchases.reduce((sum, entry) => sum + entry.cents, 0);
  const smallLimit = plan.smallSpendLimit ?? 0;
  const monthlyExpenses = expenseAccounts.reduce((sum, account) => sum + (spending[account] ?? 0), 0);
  const assets = [...walletAccounts, "receivable"].reduce((sum, account) => sum + (totals[account] ?? 0), 0);
  const liabilities = -(totals.payable ?? 0) - (totals.debt ?? 0);
  const wallets = walletBalances(entries, asOf);
  const bookBalance = walletAccounts.reduce((sum, account) => sum + (totals[account] ?? 0), 0);
  const isUsdPegged = (currency: string) => currency === "USD" || currency === "USDT";
  const hasCurrentQuotes = wallets.every(row => isUsdPegged(row.currency) || Number(quotes[row.currency]?.rate) > 0);
  const available = hasCurrentQuotes
    ? wallets.reduce((sum, row) => sum + Math.round(row.cents / (isUsdPegged(row.currency) ? 1 : quotes[row.currency]!.rate)), 0)
    : bookBalance;
  const opening = entries.filter(entry => entry.date <= asOf && entry.credit === "equity" &&
    walletAccounts.includes(entry.debit) && entry.description === "Saldo inicial").reduce((sum, row) => sum + row.cents, 0);
  const grocery = Math.max(0, plan.grocery - (spending.food ?? 0));
  const dining = Math.max(0, plan.dining - (spending.dining ?? 0));
  const forecast = projection(plan, asOf, available, grocery + dining, stress, horizon);
  const baseline = simulateDebts(plan.debts, 0);
  const extra = stress ? forecast.extra : Math.min(forecast.extra, projection(plan, asOf, available, grocery + dining, true, horizon).extra);
  const accelerated = simulateDebts(plan.debts, extra);
  const totalDebt = plan.debts.reduce((sum, debt) => sum + debt.balance, 0);
  const suggested = tab === "Presupuesto" && budgetView === "suggestion" ? budgetSuggestion(plan, entries, budgetMonth, asOf, Math.max(0, cents(groceryReceipts) || 0)) : null;
  const cashFirst = suggested ? projection({ ...plan, grocery: 0, dining: 0 }, asOf, available, 0, false, 4).shortfall : undefined;
  const personal = workspace === "personal";
  const paymentDraft = editingPayment === null ? undefined : plan.obligations[editingPayment];
  const hasCashActivity = entries.some(entry => entry.date <= asOf &&
    [entry.debit, entry.credit].some(account => walletAccounts.includes(account)));
  const sectionUrl = mobile ? (slug: string) => "/finanzas/" + slug : financeUrl;
  const budgetUrl = sectionUrl(personal ? "presupuesto-personal" : "presupuesto-empresa");

  const quickForm = quickAction && <form key={quickAction} className="grid gap-3.5 pt-2 sm:grid-cols-2" onSubmit={event => postEntry(event, quickAction)}>
    <FinanceDate label="Fecha" max={asOf} defaultValue={asOf} />
    {quickAction === "income" && <label className="block space-y-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><span>Concepto</span><Input className="h-12 rounded-2xl text-base sm:text-sm" name="description" placeholder="Ej. Sueldo o pago de cliente" maxLength={200} required /></label>}
    {quickAction === "transfer" && <Account name="credit" label="Desde" options={walletAccounts} />}
    <Account name="debit" label={quickAction === "transfer" ? "Hacia" : "Dónde está el dinero"} options={walletAccounts} />
    <div className="sm:col-span-2"><MoneyFields quotes={quotes} label={quickAction === "opening" ? "Saldo inicial" : quickAction === "transfer" ? "Importe enviado" : "Importe recibido"} /></div>
    {quickAction === "transfer" && <div className="sm:col-span-2"><MoneyFields quotes={quotes} prefix="to" label="Importe recibido" reference={false} /></div>}
    <Button type="submit" className="h-12 rounded-full text-base font-semibold sm:col-span-2">Guardar {quickAction === "opening" ? "saldo" : quickAction === "transfer" ? "transferencia" : "ingreso"}</Button>
  </form>;

  return <div className="space-y-5">
    {error && !quickAction && !expenseOpen && <p role="alert" className="text-destructive">{error}</p>}
    {success && <p role="status">{success}</p>}
    <FinanceSheet
      open={quickAction !== null}
      onOpenChange={open => { if (!open && !busy) setQuickAction(null); }}
      mobile={mobile}
      title={quickAction === "opening" ? "Anotar saldo inicial" : quickAction === "income" ? "Registrar ingreso" : "Transferir o cambiar"}
      description={quickAction === "opening"
        ? "Anota lo que ya tienes en esta cuenta. Si ya incluye un cobro anterior, registra ese dinero una sola vez."
        : quickAction === "income" ? "Registra el importe que efectivamente recibiste y su moneda."
          : "Indica cuánto salió de una cuenta y cuánto llegó a la otra."}
    >
      {error && <p role="alert" className="mb-3 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      <fieldset disabled={busy} className="min-w-0">{quickForm}</fieldset>
    </FinanceSheet>
    {personal && tab === "Libro diario" && (
      <FinanceSheet
        open={showBankImport}
        onOpenChange={setShowBankImport}
        mobile={mobile}
        title="Importar movimientos de Banesco"
        description="Revisa el archivo y confirma los movimientos que quieres guardar."
      >
        <BankImport entries={entries} categories={expenseAccounts.map(account => [account, names[account]])}
          onSaved={async () => setEntries((await adminApi<{ entries: Entry[] }>(path)).entries)} />
      </FinanceSheet>
    )}
    <fieldset disabled={busy} className="min-w-0 space-y-4">
      {tab === "Resumen" && <>
        {mobile && <section className="space-y-3">
          <div className="finance-bank-card relative overflow-hidden rounded-[28px] p-5 text-white shadow-[0_20px_44px_-18px_rgba(20,16,12,0.55)]">
            <div aria-hidden className="finance-grid-bg pointer-events-none absolute inset-0 opacity-75" />
            <div className="relative z-10">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/60">Saldo disponible</p>
              <p className="mt-1.5 text-[clamp(30px,8.5vw,44px)] font-bold leading-none tracking-[-0.045em] tabular-nums">{money(available)}</p>
              <p className="mt-2.5 text-xs text-white/65">{hasCurrentQuotes ? "Equivalente en USD a tasa vigente" : "Equivalente contable en USD"}</p>
            </div>
            <Wallet className="absolute -bottom-4 -right-2 size-28 -rotate-12 text-white/[0.06]" aria-hidden />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {([
              { label: "Ingresos del mes", value: income, icon: ArrowDownLeft, tone: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400" },
              { label: "Gastos del mes", value: monthlyExpenses, icon: ArrowUpRight, tone: "bg-orange-500/12 text-[#F26B3A]" },
            ]).map(({ label, value, icon: MetricIcon, tone }) =>
              <div key={label} className="min-w-0 rounded-[22px] border bg-card p-3.5 shadow-xs">
                <span className={`mb-2 inline-flex size-8 items-center justify-center rounded-xl ${tone}`}>
                  <MetricIcon className="size-4" aria-hidden />
                </span>
                <p className="text-xs font-medium text-muted-foreground">{label}</p>
                <p className="mt-0.5 break-all text-base font-bold tabular-nums">{money(value)}</p>
              </div>
            )}
          </div>
        </section>}
        {personal && <>
          <FinanceQuickActions
            hasCashActivity={hasCashActivity}
            onOpening={() => setQuickAction("opening")}
            onIncome={() => setQuickAction("income")}
            onTransfer={() => setQuickAction("transfer")}
            expensesHref={sectionUrl("gastos-personales")}
            fiscalHref={sectionUrl("fiscal-personal")}
          />
          {(hasPlan || hasCashActivity || totalDebt > 0) && (
            <FinanceDecisionCard
              available={available}
              reserve={plan.reserve}
              foodRemaining={grocery + dining}
              extraForDebts={extra}
              totalDebt={totalDebt}
              shortfall={forecast.shortfall}
              debtsHref={sectionUrl("deudas-personales")}
              budgetHref={budgetUrl}
            />
          )}
        </>}
        {!personal && <div className="rounded-xl border p-4">
          <Button type="button" variant="outline" aria-haspopup="dialog" onClick={() => setQuickAction("transfer")}><ArrowLeftRight /> Transferir o cambiar</Button>
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
        {personal && (plan.grocery > 0 || plan.dining > 0) && <div className="flex flex-wrap justify-between gap-2 rounded-lg border p-4">
          <div><p className="text-sm text-muted-foreground">Disponible para comida este mes</p>
            <p>Mercado <strong>{money(grocery)}</strong> · Comidas fuera <strong>{money(dining)}</strong></p></div>
          <Button asChild variant="ghost"><Link href={budgetUrl}>Ver presupuesto</Link></Button>
        </div>}
        <Tabs defaultValue="accounts" className="gap-3">
          <TabsList aria-label="Vistas del resumen" className="grid h-auto w-full grid-cols-3 rounded-xl border bg-card p-1">
            {([{ value: "accounts", label: "Cuentas", icon: Wallet }, { value: "calendar", label: "Calendario", icon: CalendarDays }, { value: "forecast", label: "Proyección", icon: ChartNoAxesCombined }]).map(({ value, label, icon: Icon }) =>
              <TabsTrigger key={value} value={value} className="min-h-11 flex-col rounded-lg px-1 text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-foreground sm:flex-row sm:text-sm">
                <Icon aria-hidden />{label}
              </TabsTrigger>)}
          </TabsList>
          <TabsContent value="accounts">
            <FinancePanel title="Saldos por cuenta y moneda">
              <p className="text-sm text-muted-foreground">El saldo inicial es el dinero registrado al comenzar. El saldo disponible refleja lo que entró y salió después. Cada movimiento conserva su tasa. El saldo usa la referencia vigente cuando está disponible para todas tus monedas.</p>
              {opening > 0 && <p>Saldo inicial registrado <strong>{money(opening)}</strong></p>}
              {wallets.length ? <dl className="grid gap-2 sm:grid-cols-2">{wallets.map(row =>
                <div key={row.account + row.currency} className="flex justify-between gap-2 rounded-lg border p-3"><dt>{names[row.account]}</dt><dd className="tabular-nums">{nativeMoney(row.cents, row.currency)}</dd></div>
              )}</dl> : <p>Aún no hay saldos registrados.</p>}
            </FinancePanel>
          </TabsContent>
          <TabsContent value="calendar">
            <FinancePanel title="Calendario e historial por período">
              <FinanceOverview plan={plan} entries={entries} today={asOf} expenseAccounts={expenseAccounts} />
            </FinancePanel>
          </TabsContent>
          <TabsContent value="forecast">
            <FinancePanel title="Proyección de flujo de caja">
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
              <div role="status" className="rounded-xl border bg-muted/50 p-3">
                <p className="font-semibold">{forecast.shortfall ? "Se prevé un faltante" : "Reserva cubierta en la proyección"}</p>
                {forecast.shortfall && <p className="text-sm text-muted-foreground">
                  El {readableDate(forecast.shortfall.date)} faltarían <strong>{money(forecast.shortfall.cents)}</strong> para mantener tu reserva mínima.
                </p>}
              </div>
              <CashForecast weeks={forecast.weeks} />
            </FinancePanel>
          </TabsContent>
        </Tabs>
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
      {tab === "Resumen" && !personal && <FinancePanel title="Comparar saldo bancario">
        <label className="block max-w-xs">Saldo del extracto al día de hoy (USD)
          <Input type="number" step="0.01" value={statementBalance} onChange={event => setStatementBalance(event.target.value)} />
        </label>
        {statementBalance !== "" && <p>Diferencia entre extracto y libro: {money(cents(statementBalance) - (totals.bank ?? 0))}</p>}
      </FinancePanel>}
      {tab === "Estados financieros" && <FinancePanel title="Saldos contables en USD">
        <dl className="grid gap-2 sm:grid-cols-2">{Object.entries(names).map(([key, label]) =>
          <div className="flex justify-between gap-3 rounded-xl border bg-muted/25 p-2.5 text-sm" key={key}><dt>{label}</dt><dd className="font-semibold tabular-nums">{money((totals[key] ?? 0) * (["payable", "debt", "equity", "income"].includes(key) ? -1 : 1))}</dd></div>)}</dl>
      </FinancePanel>}
      {tab === "Gastos" && <>
        <FinanceExpensesView
          asOf={asOf}
          monthlyExpenses={monthlyExpenses}
          monthlyIncome={income}
          spendingCategories={spendingCategories}
          largestExpense={largestExpense}
          purchases={purchases}
          filteredPurchases={filteredPurchases}
          smallPurchasesCount={smallPurchases.length}
          smallTotal={smallTotal}
          smallLimit={smallLimit}
          expenseFilter={expenseFilter}
          onFilterChange={setExpenseFilter}
          onOpenNewExpense={() => setExpenseOpen(true)}
          names={names}
        />
        <FinanceSheet
          open={expenseOpen}
          onOpenChange={open => { if (!busy) setExpenseOpen(open); }}
          mobile={mobile}
          title="Registrar gasto"
          description="Elige qué compraste y desde dónde pagaste."
        >
          {error && <p role="alert" className="mb-3 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
          <fieldset disabled={busy} className="min-w-0">
            <form key={formRevision} className="grid gap-3.5" onSubmit={event => postEntry(event, "expense")}>
              <FinanceDate label="Fecha" max={asOf} defaultValue={asOf} />
              <label className="block space-y-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <span>Concepto</span>
                <Input className="h-12 rounded-2xl text-base sm:text-sm" name="description" maxLength={200} placeholder="Ej. Café camino al trabajo" required />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <Account name="debit" label="Categoría" options={expenseAccounts} />
                <Account name="credit" label="Pagado desde" options={walletAccounts} />
              </div>
              <MoneyFields quotes={quotes} label="Importe pagado" />
              <FinanceCheck name="smallSpend" label="Marcar como gasto hormiga" />
              <Button type="submit" className="h-12 rounded-full text-base font-semibold">Guardar gasto</Button>
            </form>
          </fieldset>
        </FinanceSheet>
      </>}
      {tab === "Presupuesto" && <>
        <nav aria-label="Vistas de presupuesto" className="grid grid-cols-2 gap-1 rounded-[22px] border bg-card p-1.5 shadow-xs sm:grid-cols-4">
          {(Object.entries(budgetViews) as [BudgetView, string][]).filter(([key]) => personal || key !== "suggestion").map(([key, label]) => {
            const active = budgetView === key;
            return (
              <button
                type="button"
                key={key}
                aria-pressed={active}
                onClick={() => setBudgetView(key)}
                className={`relative h-10 rounded-2xl px-3 text-xs font-semibold transition-colors sm:text-sm ${
                  active ? "text-white" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="budget-view-pill"
                    transition={{ type: "spring", stiffness: 450, damping: 32 }}
                    className="absolute inset-0 rounded-2xl bg-[#1A1815] shadow-sm dark:bg-[#F26B3A]"
                  />
                )}
                <span className="relative z-10">{label}</span>
              </button>
            );
          })}
        </nav>
        <div key={budgetView} className="space-y-4 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-200">
        {personal && suggested && <section className="finance-grid-light space-y-4 rounded-[26px] border bg-card p-4 shadow-xs sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">Planificación inteligente</p>
              <h2 className="text-lg font-bold tracking-tight">Distribución sugerida</h2>
              <p className="text-xs text-muted-foreground">Calculada con tus cobros, compromisos y gastos de meses anteriores.</p>
            </div>
          </div>
          <label className="block max-w-xs space-y-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <span>Mes que quieres organizar</span>
            <Input className="h-12 rounded-2xl" type="month" value={budgetMonth} onChange={event => { if (/^\d{4}-(0[1-9]|1[0-2])$/.test(event.target.value)) setBudgetMonth(event.target.value); }} />
          </label>
          <dl className="grid grid-cols-2 gap-2.5 text-sm">
            <div className="rounded-2xl border bg-background/80 p-3.5"><dt className="text-xs text-muted-foreground">Cobros previstos</dt><dd className="mt-0.5 text-base font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{money(suggested.income)}</dd></div>
            <div className="rounded-2xl border bg-background/80 p-3.5"><dt className="text-xs text-muted-foreground">Pagos y cuotas</dt><dd className="mt-0.5 text-base font-bold tabular-nums">{money(suggested.bills + suggested.debt)}</dd></div>
            <div className="rounded-2xl border bg-background/80 p-3.5"><dt className="text-xs text-muted-foreground">Reserva protegida</dt><dd className="mt-0.5 text-base font-bold tabular-nums text-sky-600 dark:text-sky-400">{money(plan.reserve)}</dd></div>
            <div className="rounded-2xl border bg-background/80 p-3.5"><dt className="text-xs text-muted-foreground">Otros gastos (hist.)</dt><dd className="mt-0.5 text-base font-bold tabular-nums">{suggested.historyMonths ? money(suggested.other) : "Sin historial"}</dd></div>
          </dl>
          {cashFirst && <div className="space-y-2 rounded-2xl border border-amber-300/70 bg-amber-500/10 p-3.5 text-xs text-amber-900 dark:text-amber-200">
            <p>Primero revisa el faltante del <strong>{readableDate(cashFirst.date)}</strong>: <strong>{money(cashFirst.cents)}</strong> frente a tu reserva, aun antes de apartar para comida.</p>
            <Button type="button" size="sm" variant="outline" className="rounded-full" onClick={() => setBudgetView("payments")}>Revisar pagos programados</Button>
          </div>}
          {!suggested.groceryObserved && <label className="block max-w-xs space-y-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <span>Recibos de mercado de un mes (USD, opcional)</span>
            <Input className="h-12 rounded-2xl" type="number" inputMode="decimal" min={0} max={20000000} step="0.01" value={groceryReceipts} onChange={event => setGroceryReceipts(event.target.value)} />
            <span className="block text-[11px] font-normal normal-case text-muted-foreground">Solo se usa para estimar el tope. Tu saldo queda igual.</span>
          </label>}
          {suggested.groceryObserved || suggested.groceryFromReceipts ? <>
            <dl className="grid grid-cols-3 gap-2 text-sm">
              <div className="rounded-2xl border bg-background/80 p-3"><dt className="text-[11px] text-muted-foreground">Mercado</dt><dd className="mt-0.5 font-bold tabular-nums">{money(suggested.grocery)}</dd></div>
              <div className="rounded-2xl border bg-background/80 p-3"><dt className="text-[11px] text-muted-foreground">Comidas fuera</dt><dd className="mt-0.5 font-bold tabular-nums">{money(cashFirst ? 0 : suggested.dining)}</dd></div>
              <div className="rounded-2xl border bg-background/80 p-3"><dt className="text-[11px] text-muted-foreground">Tope hormiga</dt><dd className="mt-0.5 font-bold tabular-nums">{money(cashFirst ? 0 : suggested.small)}</dd></div>
            </dl>
            <p className="text-xs text-muted-foreground">{suggested.groceryFromReceipts
              ? "El mercado estimado viene del total de tus recibos."
              : `Base: ${suggested.historyMonths} ${suggested.historyMonths === 1 ? "mes anterior con gastos registrados" : "meses anteriores con gastos registrados"}.`}
            {" "}El tope de gastos hormiga se aplica a compras ya incluidas en sus categorías.</p>
            {suggested.unassigned >= 0 && !cashFirst && <p className="rounded-xl bg-emerald-500/10 px-3 py-2 text-xs text-emerald-800 dark:text-emerald-300">Quedaría por asignar: <strong className="tabular-nums">{money(suggested.unassigned)}</strong> después de los importes mostrados.</p>}
            {suggested.afterEssentials < 0 && <p className="rounded-xl bg-destructive/10 px-3 py-2 text-xs text-destructive">Los cobros previstos no cubren los compromisos y el gasto estimado de mercado.</p>}
            <Button type="button" className="h-11 w-full rounded-full sm:w-auto" disabled={busy || !!cashFirst || suggested.afterEssentials < 0 || suggested.income <= 0}
              onClick={() => void savePlan({ ...plan, grocery: suggested.grocery, dining: suggested.dining, smallSpendLimit: suggested.small }, () => {
                setBudgetView("habitual");
              })}>Aplicar topes al plan habitual</Button>
          </> : <div className="space-y-2.5 rounded-2xl border bg-muted/40 p-4 text-xs">
            <p>Para calcular un tope, usa el total de un mes de recibos o registra tus próximas compras como Mercado.</p>
            {!cashFirst && suggested.income > 0 && suggested.afterEssentials >= 0 && <p>Después de los importes mostrados quedan <strong>{money(suggested.afterEssentials)}</strong> por asignar.</p>}
            <Button asChild size="sm" variant="outline" className="rounded-full"><Link href={sectionUrl("gastos-personales")}>Ir a registrar gastos</Link></Button>
          </div>}
        </section>}
        {budgetView === "habitual" && <section className="space-y-4 rounded-[26px] border bg-card p-4 shadow-xs sm:p-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">Configuración base</p>
          <h2 className="text-lg font-bold tracking-tight">Tu plan habitual</h2>
          <p className="text-xs text-muted-foreground">Elige cuándo cobras y cuánto quieres apartar cada mes.</p>
        </div>
        <form className="grid gap-3.5 sm:grid-cols-2" onSubmit={event => {
          event.preventDefault();
          const fields = new FormData(event.currentTarget);
          void savePlan({ ...plan, frequency, weeklyPayday: Number(fields.get("weeklyPayday") ?? plan.weeklyPayday ?? 5), incomeOriginal: originalMoney(fields), grocery: cents(fields.get("grocery")), dining: cents(fields.get("dining")), reserve: cents(fields.get("reserve")), smallSpendLimit: cents(fields.get("smallSpendLimit")), payday1: Number(fields.get("payday1") ?? plan.payday1), payday2: Number(fields.get("payday2") ?? plan.payday2) });
        }}>
          <FinanceSelect label="Frecuencia de cobro" value={frequency} onChange={value => setFrequency(value as Frequency)}
            options={[["weekly", "Semanal"], ["twice-monthly", "Quincenal"], ["monthly", "Mensual"]]} />
          {frequency === "weekly" ? <FinanceSelect label="Día de cobro" name="weeklyPayday" defaultValue={String(plan.weeklyPayday ?? 5)}
            options={["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"].map((day, index) => [String(index), day])} /> : (
            <div className="grid grid-cols-2 gap-3">
              {frequency === "twice-monthly" && <label className="block space-y-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><span>1er cobro</span><Input className="h-12 rounded-2xl" name="payday1" type="number" min="1" max="30" defaultValue={plan.payday1} required /></label>}
              <label className="block space-y-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><span>{frequency === "monthly" ? "Día de cobro" : "2do cobro"}</span>
                <Input className="h-12 rounded-2xl" name="payday2" type="number" min={frequency === "monthly" ? 1 : 2} max="31" defaultValue={plan.payday2} required />
              </label>
            </div>
          )}
          <div className="sm:col-span-2"><MoneyFields quotes={quotes} label="Ingreso habitual por cobro" min={0} initial={plan.incomeOriginal ?? { currency: "USD", nativeCents: plan.income, rate: 1 }} /></div>
          <Dollar name="grocery" label="Mercado mensual" value={plan.grocery} />
          <Dollar name="dining" label="Comidas fuera al mes" value={plan.dining} />
          <Dollar name="smallSpendLimit" label="Tope gastos hormiga" value={smallLimit} />
          <Dollar name="reserve" label="Reserva mínima" value={plan.reserve} />
          <Button type="submit" className="h-12 rounded-full text-base font-semibold sm:col-span-2">Guardar presupuesto</Button>
        </form>
        </section>}
        {budgetView === "income" && <section className="space-y-4 rounded-[26px] border bg-card p-4 shadow-xs sm:p-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">Ajustes de cobro</p>
          <h2 className="text-lg font-bold tracking-tight">Cobros previstos</h2>
          <p className="text-xs text-muted-foreground">Ajusta el importe si esperas cobrar algo distinto. Registra el ingreso cuando entre a tu cuenta.</p>
        </div>
        <div className="space-y-3 rounded-2xl border bg-muted/25 p-3.5">
          <h3 className="text-sm font-bold">Ajustar el ingreso de un mes</h3>
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={event => {
            event.preventDefault();
            const fields = new FormData(event.currentTarget);
            const adjustment = { month: String(fields.get("month")), cents: cents(fields.get("amount")) };
            const other = (plan.monthlyOverrides ?? []).filter(row => row.month !== adjustment.month);
            void savePlan({ ...plan, monthlyOverrides: [...other, adjustment] });
          }}>
            <label className="block space-y-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><span>Mes</span><Input className="h-12 rounded-2xl" name="month" type="month" defaultValue={month} required /></label>
            <Dollar name="amount" label="Ingreso total del mes" />
            <Button type="submit" className="h-11 rounded-full sm:col-span-2">Guardar ajuste mensual</Button>
          </form>
          {(plan.monthlyOverrides ?? []).length > 0 && <ul className="space-y-2">{(plan.monthlyOverrides ?? []).map(row =>
            <li className="flex items-center justify-between gap-2 rounded-xl border bg-card px-3 py-2 text-sm" key={row.month}>
              <span className="font-medium tabular-nums">{row.month} · {money(row.cents)}</span>
              <Button variant="ghost" size="sm" className="rounded-full text-xs" type="button" onClick={() => void savePlan({ ...plan, monthlyOverrides: (plan.monthlyOverrides ?? []).filter(item => item.month !== row.month) })}>Restaurar</Button>
            </li>)}</ul>}
        </div>
        <div className="space-y-3 rounded-2xl border bg-muted/25 p-3.5">
          <h3 className="text-sm font-bold">Ajustar un cobro por fecha</h3>
          <p className="text-xs text-muted-foreground">Tiene prioridad sobre el cálculo mensual. Usa $0 para cancelar un cobro previsto.</p>
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={event => {
            event.preventDefault();
            const fields = new FormData(event.currentTarget);
            const adjustment = { date: String(fields.get("date")), cents: cents(fields.get("amount")) };
            const other = (plan.paydayOverrides ?? []).filter(row => row.date !== adjustment.date);
            void savePlan({ ...plan, paydayOverrides: [...other, adjustment] });
          }}>
            <FinanceDate label="Fecha del cobro" />
            <Dollar name="amount" label="Importe previsto" />
            <Button type="submit" className="h-11 rounded-full sm:col-span-2">Guardar fecha e importe</Button>
          </form>
          {(plan.paydayOverrides ?? []).length > 0 && <ul className="space-y-2">{(plan.paydayOverrides ?? []).map(row =>
            <li className="flex items-center justify-between gap-2 rounded-xl border bg-card px-3 py-2 text-sm" key={row.date}>
              <span className="font-medium tabular-nums">{readableDate(row.date)} · {money(row.cents)}</span>
              <Button variant="ghost" size="sm" className="rounded-full text-xs" type="button" onClick={() => void savePlan({ ...plan, paydayOverrides: (plan.paydayOverrides ?? []).filter(item => item !== row) })}>Quitar</Button>
            </li>)}</ul>}
        </div>
        {(plan.frequency ?? "twice-monthly") === "twice-monthly" && <div className="space-y-3 rounded-2xl border bg-muted/25 p-3.5">
          <h3 className="text-sm font-bold">Ajustar quincena prevista</h3>
          <form className="grid gap-3 sm:grid-cols-3" onSubmit={event => {
            event.preventDefault();
            const fields = new FormData(event.currentTarget);
            const adjustment = { month: String(fields.get("month")), slot: fields.get("slot") === "2" ? 2 as const : 1 as const, cents: cents(fields.get("amount")) };
            const other = (plan.incomeOverrides ?? []).filter(row => row.month !== adjustment.month || row.slot !== adjustment.slot);
            void savePlan({ ...plan, incomeOverrides: [...other, adjustment] });
          }}>
            <label className="block space-y-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><span>Mes</span><Input className="h-12 rounded-2xl" name="month" type="month" defaultValue={month} required /></label>
            <FinanceSelect label="Quincena" name="slot" defaultValue="1" options={[["1", "Primera"], ["2", "Segunda"]]} />
            <Dollar name="amount" label="Cobro previsto" />
            <Button type="submit" className="h-11 rounded-full sm:col-span-3">Guardar ajuste quincenal</Button>
          </form>
          {(plan.incomeOverrides ?? []).length > 0 && <ul className="space-y-2">{(plan.incomeOverrides ?? []).map(row =>
            <li className="flex items-center justify-between gap-2 rounded-xl border bg-card px-3 py-2 text-sm" key={row.month + "-" + row.slot}>
              <span className="font-medium tabular-nums">{row.month} · Quincena {row.slot} · {money(row.cents)}</span>
              <Button variant="ghost" size="sm" className="rounded-full text-xs" type="button" onClick={() => void savePlan({ ...plan, incomeOverrides: (plan.incomeOverrides ?? []).filter(item => item !== row) })}>Restaurar</Button>
            </li>)}</ul>}
        </div>}
        <div className="space-y-3 rounded-2xl border bg-muted/25 p-3.5">
          <h3 className="text-sm font-bold">Registrar un ingreso recibido</h3>
          <form key={formRevision} className="grid gap-3 sm:grid-cols-2" onSubmit={event => postEntry(event, "income")}>
            <FinanceDate label="Fecha" max={asOf} defaultValue={asOf} />
            <label className="block space-y-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><span>Concepto</span><Input className="h-12 rounded-2xl" name="description" maxLength={200} placeholder="Ej. Quincena" required /></label>
            <Account name="debit" label="Recibido en" options={walletAccounts} />
            <div className="sm:col-span-2"><MoneyFields quotes={quotes} label="Importe recibido" /></div>
            <Button type="submit" className="h-12 rounded-full font-semibold sm:col-span-2">Registrar ingreso</Button>
          </form>
        </div>
        </section>}
        {budgetView === "payments" && <section className="space-y-4 rounded-[26px] border bg-card p-4 shadow-xs sm:p-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">Agenda financiera</p>
          <h2 className="text-lg font-bold tracking-tight">Programar cobros y pagos</h2>
          <p className="text-xs text-muted-foreground">Usa el vencimiento acordado para cada compromiso. Si cambia una fecha, edítala aquí.</p>
        </div>
        <form key={editingPayment ?? `new-${plan.obligations.length}`} className="grid gap-3.5 rounded-2xl border bg-muted/25 p-3.5 sm:grid-cols-2" onSubmit={event => {
          event.preventDefault();
          const fields = new FormData(event.currentTarget);
          const row = { name: String(fields.get("name")), date: String(fields.get("date")), cents: 0, original: originalMoney(fields), kind: fields.get("kind") === "income" ? "income" as const : "payment" as const, monthly: fields.has("monthly") };
          const obligations = editingPayment === null ? [...plan.obligations, row]
            : plan.obligations.map((item, index) => index === editingPayment ? row : item);
          void savePlan({ ...plan, obligations }, () => setEditingPayment(null));
        }}>
          <label className="block space-y-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><span>Concepto</span><Input className="h-12 rounded-2xl" name="name" maxLength={200} placeholder="Ej. Alquiler o internet" defaultValue={paymentDraft?.name} required /></label>
          <FinanceDate label="Vencimiento" defaultValue={paymentDraft?.date ?? ""} />
          <FinanceSelect label="Tipo" name="kind" defaultValue={paymentDraft?.kind ?? "payment"} options={[["payment", "Pago"], ["income", "Cobro"]]} />
          <div className="flex items-end"><FinanceCheck name="monthly" label="Repetir cada mes" defaultChecked={paymentDraft?.monthly} /></div>
          <div className="sm:col-span-2"><MoneyFields quotes={quotes} label="Importe previsto" initial={paymentDraft ? paymentDraft.original ?? { currency: "USD", nativeCents: paymentDraft.cents, rate: 1 } : undefined} /></div>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button type="submit" className="h-11 flex-1 rounded-full font-semibold">{paymentDraft ? "Guardar cambios" : "Agregar compromiso"}</Button>
            {paymentDraft && <Button type="button" variant="ghost" className="h-11 rounded-full" onClick={() => setEditingPayment(null)}>Cancelar</Button>}
          </div>
        </form>
        {plan.obligations.length > 0 && <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl border bg-card">{plan.obligations.map((row, index) =>
          <li className="flex items-center justify-between gap-3 p-3.5" key={index}>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${row.kind === "income" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "bg-orange-500/15 text-orange-700 dark:text-orange-400"}`}>
                  {row.kind === "payment" ? "Pago" : "Cobro"}
                </span>
                <p className="truncate text-sm font-semibold">{row.name}</p>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {readableDate(row.date)} · <strong className="tabular-nums text-foreground">{row.original ? nativeMoney(row.original.nativeCents, row.original.currency) : money(row.cents)}</strong> {row.monthly && "· Mensual"}
              </p>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button variant="outline" size="sm" className="h-8 rounded-full px-3 text-xs" type="button" onClick={() => setEditingPayment(index)}>Editar</Button>
              <Button variant="ghost" size="sm" className="h-8 rounded-full px-2.5 text-xs text-muted-foreground hover:text-destructive" type="button" onClick={() => void savePlan({ ...plan, obligations: plan.obligations.filter((_, i) => i !== index) }, () => setEditingPayment(null))}>Quitar</Button>
            </div>
          </li>)}</ul>}
        </section>}
        </div>
      </>}
      {tab === "Libro diario" && (
        <FinanceLedgerView
          entries={entries}
          asOf={asOf}
          personal={personal}
          workspace={workspace}
          mobile={mobile}
          busy={busy}
          quotes={quotes}
          names={names}
          expenseAccounts={expenseAccounts}
          monthlyIncome={income}
          monthlyExpenses={monthlyExpenses}
          formRevision={formRevision}
          onOpenBankImport={() => setShowBankImport(true)}
          onOpenOpening={() => setQuickAction("opening")}
          onPostEntry={event => postEntry(event)}
          onPostOwnerPayment={postOwnerPayment}
        />
      )}
      {tab === "Deudas" && (
        <FinanceDebtsView
          debts={plan.debts}
          asOf={asOf}
          quotes={quotes}
          horizon={horizon}
          extra={extra}
          baseline={baseline}
          accelerated={accelerated}
          busy={busy}
          mobile={mobile}
          onAddDebt={debt => savePlan({ ...plan, debts: [...plan.debts, debt] })}
          onRemoveDebt={index => savePlan({ ...plan, debts: plan.debts.filter((_, i) => i !== index) })}
          onPayDebt={payDebt}
        />
      )}
    </fieldset>
  </div>;
}

function FinancePanel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="space-y-4 rounded-2xl border bg-card p-4 sm:p-5">
    <h2 className="text-base font-semibold">{title}</h2>
    {children}
  </section>;
}

function Dollar({ name, label, value, min = 0 }: { name: string; label: string; value?: number; min?: number }) {
  return <label className="block space-y-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
    <span>{label} (USD)</span>
    <Input className="h-12 rounded-2xl text-base font-semibold tabular-nums sm:text-sm" inputMode="decimal" name={name} type="number" step="0.01" min={min} defaultValue={value === undefined ? undefined : value / 100} required />
  </label>;
}

function Account({ name, label, options = Object.keys(names) }: { name: string; label: string; options?: string[] }) {
  return <FinanceSelect label={label} name={name} options={options.map(key => [key, names[key]])} />;
}
