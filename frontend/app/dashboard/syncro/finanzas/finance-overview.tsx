"use client";

import { useState } from "react";
import { es } from "react-day-picker/locale";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { usd } from "@/lib/syncro-admin";
import { calendarDate, dateKey, readableDate } from "./finance-calendar";
import { monthDate, obligationOccursOn, scheduledIncome, shiftDay, type Entry, type Plan } from "./calculations";

const money = (cents: number) => usd((cents || 0) / 100);
const periods = { weekly: "Semana", fortnight: "Quincena", monthly: "Mes" } as const;

function calendarIncome(plan: Plan, month: string) {
  const income = new Map(scheduledIncome(plan, month).map(row => [row.date, row.cents]));
  const commitments = plan.obligations.filter(row => row.kind === "income");
  const days = Number(monthDate(month, 31).slice(8));
  for (let day = 1; day <= days; day++) {
    const date = monthDate(month, day);
    const amount = commitments.reduce((total, row) => total + (obligationOccursOn(row, date) ? row.cents : 0), 0);
    if (amount) income.set(date, (income.get(date) ?? 0) + amount);
  }
  return Array.from(income, ([date, cents]) => ({ date, cents })).sort((a, b) => a.date.localeCompare(b.date));
}

export function FinanceOverview({ plan, entries, today, expenseAccounts }: {
  plan: Plan; entries: Entry[]; today: string; expenseAccounts: string[];
}) {
  const [period, setPeriod] = useState<keyof typeof periods>("monthly");
  const [selected, setSelected] = useState(today);
  const [visibleMonth, setVisibleMonth] = useState(today.slice(0, 7));
  const month = selected.slice(0, 7);
  const weekday = (calendarDate(selected).getDay() + 6) % 7;
  const from = period === "weekly" ? shiftDay(selected, -weekday) : monthDate(month, period === "fortnight" && selected.slice(8) > "15" ? 16 : 1);
  const to = period === "weekly" ? shiftDay(from, 6) : monthDate(month, period === "fortnight" && from.endsWith("-01") ? 15 : 31);
  const scheduled = [...new Set([from.slice(0, 7), to.slice(0, 7)])].flatMap(key => calendarIncome(plan, key))
    .filter(row => row.date >= from && row.date <= to);
  const plannedIncome = scheduled.reduce((total, row) => total + row.cents, 0);
  let actualIncome = 0;
  let expenses = 0;
  for (const entry of entries) {
    if (entry.date < from || entry.date > to) continue;
    if (entry.credit === "income") actualIncome += entry.cents;
    if (entry.debit === "income") actualIncome -= entry.cents;
    if (expenseAccounts.includes(entry.debit)) expenses += entry.cents;
    if (expenseAccounts.includes(entry.credit)) expenses -= entry.cents;
  }

  return <section className="grid items-start gap-4 rounded-xl border bg-card p-4 lg:grid-cols-[auto_1fr]">
    <div className="mx-auto w-fit">
      <Calendar locale={es} mode="single" selected={calendarDate(selected)} month={calendarDate(visibleMonth + "-01")}
        onMonthChange={day => {
          const next = dateKey(day).slice(0, 7);
          setVisibleMonth(next);
          setSelected(monthDate(next, Number(selected.slice(8))));
        }}
        onSelect={day => {
          if (day) {
            const key = dateKey(day);
            setSelected(key);
            setVisibleMonth(key.slice(0, 7));
          }
        }}
        modifiers={{ reporting: { from: calendarDate(from), to: calendarDate(to) }, payday: calendarIncome(plan, visibleMonth).filter(row => row.cents > 0).map(row => calendarDate(row.date)) }}
        modifiersClassNames={{ reporting: "[&_button]:bg-primary/10", payday: "[&_button]:underline [&_button]:decoration-primary [&_button]:underline-offset-4" }} />
      <p className="px-3 text-xs text-muted-foreground">Los días subrayados tienen cobros previstos.</p>
    </div>
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1" aria-label="Período del resumen">
        {Object.entries(periods).map(([key, label]) => <Button key={key} type="button" size="sm" variant={period === key ? "secondary" : "ghost"}
          aria-pressed={period === key} onClick={() => setPeriod(key as keyof typeof periods)}>{label}</Button>)}
        <Button type="button" size="sm" variant="outline" onClick={() => { setSelected(today); setVisibleMonth(today.slice(0, 7)); }}>Hoy</Button>
      </div>
      <h2 className="text-lg font-semibold">{readableDate(from)} – {readableDate(to)}</h2>
      <dl className="grid gap-2 sm:grid-cols-3">
        {([["Ingresos previstos", plannedIncome], ["Ingresos registrados", actualIncome], ["Gastos registrados", expenses]] as const).map(([label, value]) =>
          <div key={label} className="rounded-lg border p-3"><dt className="text-sm text-muted-foreground">{label}</dt><dd className="text-xl font-semibold tabular-nums">{money(value)}</dd></div>)}
      </dl>
      {scheduled.some(row => row.cents > 0) && <ul className="flex flex-wrap gap-2">
        {scheduled.filter(row => row.cents > 0).map((row, index) => <li key={row.date + index} className="rounded-full bg-muted px-3 py-1 text-sm">{readableDate(row.date)} · {money(row.cents)}</li>)}
      </ul>}
    </div>
  </section>;
}

export function CashForecast({ weeks }: { weeks: { date: string; balance: number }[] }) {
  return <>
    <div className="h-64 rounded-xl border bg-card px-2 py-4">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={weeks} margin={{ top: 5, right: 16, left: 4, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="date" minTickGap={25} tickFormatter={date => date.slice(8) + "/" + date.slice(5, 7)} fontSize={12} />
          <YAxis tickFormatter={value => usd(value / 100)} width={86} fontSize={12} />
          <Tooltip labelFormatter={label => typeof label === "string" ? readableDate(label) : label} formatter={value => [money(Number(value)), "Saldo previsto"]} contentStyle={{ background: "var(--popover)", borderColor: "var(--border)", borderRadius: 8 }} />
          <Area dataKey="balance" type="monotone" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.12} strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
    <details className="rounded-lg border p-3">
      <summary className="cursor-pointer text-sm font-medium">Ver los {weeks.length} saldos semanales</summary>
      <ul className="mt-3 grid gap-2 sm:grid-cols-3">{weeks.map(week => <li key={week.date}>{readableDate(week.date)} · {money(week.balance)}</li>)}</ul>
    </details>
  </>;
}
