"use client";

import { es } from "react-day-picker/locale";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { calendarDate, dateKey, readableDate } from "./finance-calendar";
import { FinanceCheck, FinanceSelect } from "./finance-fields";
import { invoicePeriod, monthlyIvaReference, previousMonth } from "./fiscal-periods";
import type { FiscalRecord } from "./fiscal-records";

type Deadline = { period: string; tax: string; date: string; record?: FiscalRecord };

export function FiscalCalendar({ records, today, period, month, selectedDate, monthlyIva, onPeriod, onMonth, onDay, onMonthlyIva, onEdit, onAddDeclaration }: {
  records: FiscalRecord[];
  today: string;
  period: string;
  month: string;
  selectedDate?: string;
  monthlyIva: boolean;
  onPeriod: (period: string, deadline?: string) => void;
  onMonth: (month: string) => void;
  onDay: (date: string, period?: string) => void;
  onMonthlyIva: (value: boolean) => void;
  onEdit: (record: FiscalRecord) => void;
  onAddDeclaration: (period: string) => void;
}) {
  const current = today.slice(0, 7);
  const invoices = records.filter(row => row.kind === "invoice");
  const declarations = records.filter(row => row.kind === "declaration");
  const periods = [...new Set([period, current, previousMonth(current), ...invoices.map(invoicePeriod), ...declarations.flatMap(row => row.period ? [row.period] : [])])].sort().reverse();
  const deadlines: Deadline[] = [];
  for (const row of declarations) {
    if (row.period && row.tax && row.dueDate) deadlines.push({ period: row.period, tax: row.tax, date: row.dueDate, record: row });
  }
  if (monthlyIva) {
    for (const key of periods) {
      const date = monthlyIvaReference(key);
      if (date && !declarations.some(row => row.period === key && row.tax === "IVA" && row.dueDate)) {
        deadlines.push({ period: key, tax: "IVA", date });
      }
    }
  }

  const selectedInvoices = invoices.filter(row => invoicePeriod(row) === period);
  const invoiceIds = new Set(selectedInvoices.map(row => row.id));
  const retentions = records.filter(row => row.kind === "retention" && row.invoiceId && invoiceIds.has(row.invoiceId));
  const periodDeclarations = declarations.filter(row => row.period === period);
  const dayDeadlines = selectedDate ? deadlines.filter(row => row.date === selectedDate) : [];
  const reference = deadlines.find(row => row.period === period && !row.record);
  const registered = deadlines.filter(row => row.record).map(row => calendarDate(row.date));
  const estimates = deadlines.filter(row => !row.record).map(row => calendarDate(row.date));

  return <section className="space-y-4">
    <div className="grid min-w-0 items-start gap-3 lg:grid-cols-[auto_minmax(0,1fr)]">
      <div className="min-w-0 rounded-xl border bg-card p-2 sm:p-4">
        <Calendar locale={es} mode="single" className="mx-auto w-fit px-1 sm:px-3" classNames={{
          weekday: "w-8 rounded-md text-xs font-normal text-muted-foreground sm:w-9",
          day: "relative size-8 p-0 text-center sm:size-9",
          day_button: "size-8 rounded-lg text-sm hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-primary/50 sm:size-9",
        }} month={calendarDate(month + "-01")} selected={selectedDate ? calendarDate(selectedDate) : undefined}
          onMonthChange={day => onMonth(dateKey(day).slice(0, 7))}
          onSelect={day => {
            if (!day) return;
            const date = dateKey(day);
            onDay(date, deadlines.find(row => row.date === date)?.period);
          }}
          modifiers={{ registered, estimates }}
          modifiersClassNames={{
            registered: "[&_button]:border-2 [&_button]:border-primary [&_button]:font-bold",
            estimates: "[&_button]:underline [&_button]:decoration-dashed [&_button]:underline-offset-4",
          }} />
        <p className="px-2 text-xs text-muted-foreground">Borde: vencimiento registrado. Subrayado: referencia.</p>
      </div>
      <div className="min-w-0 space-y-3 rounded-xl border bg-card p-4">
        <FinanceCheck label="Mostrar referencia de IVA mensual" checked={monthlyIva}
          onChange={onMonthlyIva} />
        {monthlyIva && <p className="text-xs text-muted-foreground">Para IVA mensual se muestra el día 15 del mes siguiente, ajustado por fines de semana. Verifica feriados y fechas aplicables en el SENIAT.</p>}
        {selectedDate && <div>
          <h2 className="text-sm font-semibold">{readableDate(selectedDate)}</h2>
          {dayDeadlines.length ? <ul className="mt-1 space-y-1">{dayDeadlines.map(row =>
            <li key={row.record?.id ?? row.period}>
              <Button type="button" size="sm" variant="ghost" onClick={() => onPeriod(row.period, row.date)}>
                {row.tax} · {row.period} · {row.record ? "Registrado" : "Referencia"}
              </Button>
            </li>)}</ul> : <p className="text-sm text-muted-foreground">No hay vencimientos en ese día.</p>}
        </div>}
        <FinanceSelect label="Período fiscal" value={period} options={periods.map(key => [key, key])} onChange={key => {
          const deadline = deadlines.find(row => row.period === key && row.tax === "IVA") ?? deadlines.find(row => row.period === key);
          onPeriod(key, deadline?.date);
        }} />
        {reference && <Button type="button" variant="outline" size="sm" onClick={() => onPeriod(period, reference.date)}>
          Ver referencia del {readableDate(reference.date)}
        </Button>}
      </div>
    </div>
    <div className="space-y-4 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Período {period}</h2>
        {!periodDeclarations.some(row => row.tax === "IVA") && <Button type="button" size="sm" variant="outline" onClick={() => onAddDeclaration(period)}>Registrar declaración de IVA</Button>}
      </div>
      <FiscalLinks title="Declaraciones" items={periodDeclarations} onEdit={onEdit} />
      <FiscalLinks title="Facturas del período" items={selectedInvoices} onEdit={onEdit} />
      <FiscalLinks title="Retenciones vinculadas" items={retentions} onEdit={onEdit} />
    </div>
  </section>;
}

const labels: Record<string, string> = {
  pending: "Pendiente", filed: "Presentada", paid: "Pagada", issued: "Emitida",
  collected: "Cobrada", void: "Anulada", confirmed: "Verificada",
};

function FiscalLinks({ title, items, onEdit }: { title: string; items: FiscalRecord[]; onEdit: (record: FiscalRecord) => void }) {
  return <div className="space-y-1.5">
    <h3 className="text-sm font-medium">{title} <span className="text-muted-foreground">({items.length})</span></h3>
    {items.length ? <ul className="space-y-2">{items.map(row => <li key={row.id}>
      <button type="button" onClick={() => onEdit(row)} className="flex w-full flex-wrap items-center justify-between gap-1 rounded-lg border p-2 text-left text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
        <span className="min-w-0 break-words">{row.reference}</span>
        <span className="text-xs text-muted-foreground">{[row.tax, labels[row.status], row.dueDate && readableDate(row.dueDate)].filter(Boolean).join(" · ")}</span>
      </button>
    </li>)}</ul> : <p className="text-xs text-muted-foreground">Sin registros.</p>}
  </div>;
}
