"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Calculator, CalendarDays, FileText, Percent, Plus, Receipt } from "lucide-react";
import { adminApi, adminResponse } from "@/lib/syncro-admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { FinanceDate, readableDate } from "./finance-calendar";
import { FiscalPdfPreview } from "./fiscal-pdf-preview";
import { FiscalCalendar } from "./fiscal-calendar";
import { invoicePeriod, monthlyIvaReference } from "./fiscal-periods";
import { FinanceSelect } from "./finance-fields";
import { FinanceSheet } from "./finance-sheet";

const kinds = {
  invoice: { singular: "Factura", plural: "Facturas", statuses: [["issued", "Emitida"], ["collected", "Cobrada"], ["void", "Anulada"]] },
  declaration: { singular: "Declaración", plural: "Declaraciones", statuses: [["pending", "Por presentar"], ["filed", "Presentada"], ["paid", "Pagada"]] },
  retention: { singular: "Retención", plural: "Retenciones", statuses: [["pending", "Por verificar"], ["confirmed", "Verificada"]] },
} as const;
type Kind = keyof typeof kinds;
export type FiscalRecord = {
  id: string; kind: Kind; status: string; reference: string; date: string; period: string | null;
  dueDate: string | null; filedDate: string | null; paidDate: string | null; counterparty: string | null;
  tax: string | null; direction: string | null; invoiceId: string | null; notes: string | null;
  baseCents: number | null; vatCents: number | null; amountCents: number | null;
  rateCurrency: string | null; rate: string | null; supportMime: string | null;
};
type Editor = {
  id: string;
  kind: Kind;
  record?: FiscalRecord;
  period?: string;
  preset?: {
    invoiceId?: string;
    counterparty?: string;
    period?: string;
    tax?: "IVA" | "ISLR";
    direction?: "received" | "issued";
  };
};
const bolivares = new Intl.NumberFormat("es-VE", { style: "currency", currency: "VES" });

function fileBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    if (file.size > 5 * 1024 * 1024) return reject(new Error("El soporte debe pesar hasta 5 MiB."));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer el soporte."));
    reader.onload = () => resolve(String(reader.result).split(",", 2)[1]);
    reader.readAsDataURL(file);
  });
}

export default function FiscalRecords({ workspace, mobile }: { workspace: "personal" | "company"; mobile: boolean }) {
  const path = `/finance/${workspace}/fiscal`;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Caracas", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const [records, setRecords] = useState<FiscalRecord[]>();
  const [kind, setKind] = useState<Kind | "calendar">("invoice");
  const [calendarPeriod, setCalendarPeriod] = useState(today.slice(0, 7));
  const [calendarMonth, setCalendarMonth] = useState(today.slice(0, 7));
  const [calendarDay, setCalendarDay] = useState<string>();
  const [monthlyIva, setMonthlyIva] = useState(false);
  const [editor, setEditor] = useState<Editor>();
  const [preview, setPreview] = useState<FiscalRecord>();
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewError, setPreviewError] = useState("");
  const [error, setError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [busy, setBusy] = useState(false);
  const [invoiceBase, setInvoiceBase] = useState("");
  const [invoiceVat, setInvoiceVat] = useState("");
  const [invoiceTotal, setInvoiceTotal] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    adminApi<FiscalRecord[]>(path, { signal: controller.signal }).then(setRecords).catch(failure => {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "No se pudo cargar el registro");
    });
    return () => controller.abort();
  }, [path]);

  useEffect(() => {
    setPreviewUrl("");
    setPreviewError("");
    if (!preview) return;
    const controller = new AbortController();
    let url: string | undefined;
    adminResponse(`${path}/${preview.id}/support`, { signal: controller.signal }).then(response => response.blob()).then(blob => {
      if (controller.signal.aborted) return;
      url = URL.createObjectURL(blob);
      setPreviewUrl(url);
    }).catch(failure => {
      if (!controller.signal.aborted) setPreviewError(failure instanceof Error ? failure.message : "No se pudo abrir el soporte");
    });
    return () => {
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [path, preview]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor || busy) return;
    const form = new FormData(event.currentTarget);
    setSaveError("");
    setBusy(true);
    try {
      const values = Object.fromEntries([...form].filter(([, value]) => typeof value === "string"));
      const money = (field: string) => values[field] ? Math.round(Number(values[field]) * 100) : null;
      const file = form.get("support");
      const item = await adminApi<FiscalRecord>(`${path}/${editor.id}`, {
        method: "PUT",
        body: JSON.stringify({
          ...values, kind: editor.kind, invoiceId: values.invoiceId === "none" ? null : values.invoiceId,
          rate: values.rate ? Number(values.rate) : null, rateCurrency: values.rateCurrency === "none" ? null : values.rateCurrency,
          baseCents: money("baseCents"), vatCents: money("vatCents"), amountCents: money("amountCents"),
          support: file instanceof File && file.size ? await fileBase64(file) : null,
        }),
      });
      setRecords(current => [item, ...(current ?? []).filter(row => row.id !== item.id)].sort((a, b) => b.date.localeCompare(a.date)));
      setEditor(undefined);
    } catch (failure) {
      setSaveError(failure instanceof Error ? failure.message : "No se pudo guardar el registro.");
    } finally {
      setBusy(false);
    }
  }

  function edit(next: Editor) {
    setSaveError("");
    setInvoiceBase(next.record?.baseCents == null ? "" : String(next.record.baseCents / 100));
    setInvoiceVat(next.record?.vatCents == null ? "" : String(next.record.vatCents / 100));
    setInvoiceTotal(next.record?.amountCents == null ? "" : String(next.record.amountCents / 100));
    setEditor(next);
  }

  function applyStandardVat() {
    const base = Number(invoiceBase);
    if (!Number.isFinite(base) || base <= 0) return;
    const vat = Math.round(base * 16) / 100;
    const total = Math.round((base + vat) * 100) / 100;
    setInvoiceVat(vat.toFixed(2));
    setInvoiceTotal(total.toFixed(2));
  }

  if (error) return <p role="alert" className="rounded-xl border bg-card p-4 text-destructive">{error}</p>;
  if (!records) return <div role="status" aria-label="Cargando registro fiscal" className="space-y-3">
    {[0, 1, 2].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}
  </div>;

  function openPeriod(period: string, deadline?: string) {
    setCalendarPeriod(period);
    setCalendarDay(deadline);
    setCalendarMonth((deadline ?? (period.length >= 7 ? period : today)).slice(0, 7));
  }

  function goToRecordPeriod(row: FiscalRecord) {
    const period = row.kind === "invoice" ? invoicePeriod(row) : row.period;
    if (!period) return;
    const due = row.dueDate ?? records?.find(item =>
      item.kind === "declaration" && item.tax === "IVA" && item.period === period && item.dueDate,
    )?.dueDate ?? (monthlyIva ? monthlyIvaReference(period) : undefined);
    openPeriod(period, due);
    setKind("calendar");
  }

  const visible = records.filter(row => row.kind === kind);
  const overdue = records.filter(row => row.kind === "declaration" && row.status === "pending" && row.dueDate && row.dueDate < today).length;
  const activeInvoices = records.filter(row => row.kind === "invoice" && row.status !== "void");
  const totalInvoiced = activeInvoices.reduce((sum, row) => sum + (row.amountCents ?? 0), 0);
  const totalVat = activeInvoices.reduce((sum, row) => sum + (row.vatCents ?? 0), 0);
  const totalIvaRet = records
    .filter(row => row.kind === "retention" && row.tax === "IVA" && row.direction === "received")
    .reduce((sum, row) => sum + (row.amountCents ?? 0), 0);
  const totalIslrRet = records
    .filter(row => row.kind === "retention" && row.tax === "ISLR" && row.direction === "received")
    .reduce((sum, row) => sum + (row.amountCents ?? 0), 0);
  const invoiceMap = new Map(records.filter(row => row.kind === "invoice").map(row => [row.id, row]));

  return <div className="space-y-4">
    <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
      <div className="rounded-2xl border bg-card p-3.5 shadow-xs">
        <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground"><Receipt className="size-3.5 text-primary" /> Facturado</p>
        <p className="mt-1 text-base font-bold tabular-nums sm:text-lg">{bolivares.format(totalInvoiced / 100)}</p>
        <p className="text-[11px] text-muted-foreground">{activeInvoices.length} {activeInvoices.length === 1 ? "factura activa" : "facturas activas"}</p>
      </div>
      <div className="rounded-2xl border bg-card p-3.5 shadow-xs">
        <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground"><Percent className="size-3.5 text-sky-600" /> IVA facturado</p>
        <p className="mt-1 text-base font-bold tabular-nums sm:text-lg">{bolivares.format(totalVat / 100)}</p>
        <p className="text-[11px] text-muted-foreground">Débito fiscal acumulado</p>
      </div>
      <div className="rounded-2xl border bg-card p-3.5 shadow-xs">
        <p className="text-xs font-medium text-muted-foreground">Ret. IVA recibidas</p>
        <p className="mt-1 text-base font-bold tabular-nums text-emerald-700 dark:text-emerald-400 sm:text-lg">{bolivares.format(totalIvaRet / 100)}</p>
        <p className="text-[11px] text-muted-foreground">Crédito a descontar</p>
      </div>
      <div className="rounded-2xl border bg-card p-3.5 shadow-xs">
        <p className="text-xs font-medium text-muted-foreground">Ret. ISLR recibidas</p>
        <p className="mt-1 text-base font-bold tabular-nums text-violet-700 dark:text-violet-400 sm:text-lg">{bolivares.format(totalIslrRet / 100)}</p>
        <p className="text-[11px] text-muted-foreground">Anticipo ISLR</p>
      </div>
    </section>
    {overdue > 0 && <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{overdue} {overdue === 1 ? "declaración pendiente con vencimiento registrado" : "declaraciones pendientes con vencimiento registrado"}.</p>}
    <nav aria-label="Tipo de registro fiscal" className="flex flex-wrap gap-1 rounded-xl border bg-card p-1.5">
      {(Object.keys(kinds) as Kind[]).map(key => <Button key={key} variant={kind === key ? "secondary" : "ghost"} size="sm" aria-pressed={kind === key} onClick={() => setKind(key)}>{kinds[key].plural}</Button>)}
      <Button type="button" variant={kind === "calendar" ? "secondary" : "ghost"} size="sm" aria-pressed={kind === "calendar"} onClick={() => setKind("calendar")}><CalendarDays /> Calendario fiscal</Button>
    </nav>
    {kind === "calendar" ? <FiscalCalendar records={records} today={today} period={calendarPeriod} month={calendarMonth} selectedDate={calendarDay}
      monthlyIva={monthlyIva} onPeriod={openPeriod} onMonth={month => { setCalendarMonth(month); setCalendarDay(undefined); }}
      onDay={(date, period) => { setCalendarDay(date); setCalendarMonth(date.slice(0, 7)); if (period) setCalendarPeriod(period); }}
      onMonthlyIva={setMonthlyIva} onEdit={row => edit({ id: row.id, kind: row.kind, record: row })}
      onAddDeclaration={period => edit({ id: crypto.randomUUID(), kind: "declaration", period })} /> : <>
    <div className="flex justify-end">
      <Button onClick={() => edit({ id: crypto.randomUUID(), kind })}><Plus /> Agregar {kinds[kind].singular.toLowerCase()}</Button>
    </div>
    {visible.length ? <ul className="space-y-3">{visible.map(row => {
      const linkedRetentions = row.kind === "invoice"
        ? records.filter(item => item.kind === "retention" && item.invoiceId === row.id)
        : [];
      const retIva = linkedRetentions
        .filter(item => item.tax === "IVA" && item.direction === "received")
        .reduce((sum, item) => sum + (item.amountCents ?? 0), 0);
      const retIslr = linkedRetentions
        .filter(item => item.tax === "ISLR" && item.direction === "received")
        .reduce((sum, item) => sum + (item.amountCents ?? 0), 0);
      const netCollectible = row.kind === "invoice" && row.amountCents != null
        ? Math.max(0, row.amountCents - retIva - retIslr)
        : null;
      const parentInvoice = row.kind === "retention" && row.invoiceId ? invoiceMap.get(row.invoiceId) : undefined;

      return <li key={row.id} className="space-y-2.5 rounded-2xl border bg-card p-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <h2 className="min-w-0 break-words font-semibold">{row.reference}</h2>
            {parentInvoice && <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary">Factura {parentInvoice.reference}</span>}
          </div>
          <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">{kinds[row.kind].statuses.find(([value]) => row.status === value)?.[1] ?? row.status}</span>
        </div>
        <p className="break-words text-sm text-muted-foreground">
          {[readableDate(row.date), row.counterparty, row.tax, row.direction === "received" ? "Recibida" : row.direction === "issued" ? "Practicada" : null, row.period, row.amountCents == null ? null : bolivares.format(row.amountCents / 100)].filter(Boolean).join(" · ")}
        </p>
        {row.kind === "invoice" && (row.baseCents != null || row.vatCents != null || linkedRetentions.length > 0) && (
          <div className="grid grid-cols-2 gap-2 rounded-xl border bg-muted/30 p-3 text-xs sm:grid-cols-4">
            <div>
              <span className="text-muted-foreground">Base + IVA</span>
              <p className="font-semibold tabular-nums">
                {row.baseCents != null ? bolivares.format(row.baseCents / 100) : "—"}
                {row.vatCents != null ? ` + ${bolivares.format(row.vatCents / 100)}` : ""}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Ret. IVA</span>
              <p className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">{bolivares.format(retIva / 100)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Ret. ISLR</span>
              <p className="font-semibold tabular-nums text-violet-700 dark:text-violet-400">{bolivares.format(retIslr / 100)}</p>
            </div>
            {netCollectible != null && (
              <div>
                <span className="text-muted-foreground">Neto a cobrar</span>
                <p className="font-bold tabular-nums">{bolivares.format(netCollectible / 100)}</p>
              </div>
            )}
          </div>
        )}
        {row.dueDate && <p className="text-sm text-muted-foreground">Vence el {readableDate(row.dueDate)}</p>}
        {(row.filedDate || row.paidDate) && <p className="text-sm text-muted-foreground">
          {[row.filedDate && `Presentada el ${readableDate(row.filedDate)}`, row.paidDate && `${row.kind === "invoice" ? "Cobrada" : "Pagada"} el ${readableDate(row.paidDate)}`].filter(Boolean).join(" · ")}
        </p>}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => edit({ id: row.id, kind: row.kind, record: row })}>Editar</Button>
          {row.kind === "invoice" && row.status !== "void" && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => edit({
                id: crypto.randomUUID(),
                kind: "retention",
                preset: {
                  invoiceId: row.id,
                  counterparty: row.counterparty ?? "",
                  period: invoicePeriod(row),
                  tax: "IVA",
                  direction: "received",
                },
              })}
            >
              <Plus className="size-3.5" /> Retención
            </Button>
          )}
          {(row.kind === "invoice" || (row.kind === "declaration" && row.period)) && <Button size="sm" variant="ghost" onClick={() => goToRecordPeriod(row)}><CalendarDays /> Ver período</Button>}
          {row.supportMime && <Button size="sm" variant="outline" onClick={() => setPreview(row)}><FileText /> Ver soporte</Button>}
        </div>
      </li>;
    })}</ul> : <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">Aún no hay registros en esta sección.</p>}
    </>}
    <FinanceSheet
      open={!!editor}
      onOpenChange={open => { if (!open && !busy) setEditor(undefined); }}
      mobile={mobile}
      title={`${editor?.record ? "Editar" : "Agregar"} ${editor ? kinds[editor.kind].singular.toLowerCase() : ""}`}
      description="Usa los datos del documento o del portal fiscal."
    >
      {editor && <form onSubmit={save} key={editor.id}>
        <fieldset disabled={busy} className="grid min-w-0 gap-3.5 sm:grid-cols-2">
          <label className="space-y-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <span>{editor.kind === "declaration" ? "Referencia de la planilla" : "Número de documento"}</span>
            <Input className="h-12 rounded-2xl text-base sm:text-sm" name="reference" defaultValue={editor.record?.reference} maxLength={200} required={editor.kind !== "declaration"} />
          </label>
          <FinanceSelect label="Estado" name="status" options={kinds[editor.kind].statuses} defaultValue={editor.record?.status ?? kinds[editor.kind].statuses[0][0]} />
          <FinanceDate label={editor.kind === "invoice" ? "Fecha de emisión" : "Fecha del registro"} defaultValue={editor.record?.date ?? today} />
          <label className="space-y-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <span>Período</span>
            <Input className="h-12 rounded-2xl text-base sm:text-sm" name="period" placeholder="Ej. 2026-11-2" defaultValue={editor.record?.period ?? editor.preset?.period ?? editor.period ?? ""} required={editor.kind === "declaration"} />
          </label>
          {editor.kind !== "declaration" && <label className="space-y-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <span>{editor.kind === "invoice" ? "Cliente" : "Contraparte"}</span>
            <Input className="h-12 rounded-2xl text-base sm:text-sm" name="counterparty" maxLength={200} defaultValue={editor.record?.counterparty ?? editor.preset?.counterparty ?? ""} required={editor.kind === "retention"} />
          </label>}
          {editor.kind !== "invoice" && <FinanceSelect label="Impuesto" name="tax" defaultValue={editor.record?.tax ?? editor.preset?.tax ?? "IVA"} options={[["IVA", "IVA"], ["ISLR", "ISLR"]]} />}
          {editor.kind === "invoice" && <>
            <label className="space-y-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <span>Base imponible (Bs)</span>
              <Input className="h-12 rounded-2xl text-base font-semibold tabular-nums sm:text-sm" name="baseCents" type="number" inputMode="decimal" step="0.01" min="0" value={invoiceBase} onChange={e => setInvoiceBase(e.target.value)} />
            </label>
            <div className="space-y-1.5">
              <label className="block space-y-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <span>IVA facturado (Bs)</span>
                <Input className="h-12 rounded-2xl text-base font-semibold tabular-nums sm:text-sm" name="vatCents" type="number" inputMode="decimal" step="0.01" min="0" value={invoiceVat} onChange={e => setInvoiceVat(e.target.value)} />
              </label>
              <Button type="button" size="sm" variant="secondary" className="h-8 rounded-full px-3 text-xs" onClick={applyStandardVat}>
                <Calculator className="size-3.5" /> Calcular IVA 16%
              </Button>
            </div>
            <FinanceDate label="Fecha de cobro" name="paidDate" defaultValue={editor.record?.paidDate ?? ""} />
            <FinanceSelect label="Moneda de la tasa anotada" name="rateCurrency" defaultValue={editor.record?.rateCurrency ?? "none"} options={[["none", "Sin tasa"], ["EUR", "EUR"], ["USD", "USD"]]} />
            <label className="space-y-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <span>Tasa anotada (Bs por unidad)</span>
              <Input className="h-12 rounded-2xl text-base tabular-nums sm:text-sm" name="rate" type="number" inputMode="decimal" min="0.00000001" step="0.00000001" defaultValue={editor.record?.rate ?? ""} />
            </label>
          </>}
          {editor.kind === "declaration" && <>
            <FinanceDate label="Vencimiento" name="dueDate" defaultValue={editor.record?.dueDate ?? ""} />
            <FinanceDate label="Fecha de presentación" name="filedDate" defaultValue={editor.record?.filedDate ?? ""} />
            <FinanceDate label="Fecha de pago" name="paidDate" defaultValue={editor.record?.paidDate ?? ""} />
          </>}
          {editor.kind === "retention" && <>
            <FinanceSelect label="Sentido" name="direction" defaultValue={editor.record?.direction ?? editor.preset?.direction ?? "received"} options={[["received", "Me retuvieron"], ["issued", "Practiqué la retención"]]} />
            <FinanceSelect label="Factura vinculada" name="invoiceId" defaultValue={editor.record?.invoiceId ?? editor.preset?.invoiceId ?? "none"}
              options={[["none", "Sin vincular"], ...records.filter(row => row.kind === "invoice").map(row => [row.id, row.reference] as const)]} />
          </>}
          {editor.kind === "invoice" ? (
            <label className="space-y-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <span>Total de la factura (Bs)</span>
              <Input className="h-12 rounded-2xl text-base font-bold tabular-nums sm:text-sm" name="amountCents" type="number" inputMode="decimal" step="0.01" min="0" value={invoiceTotal} onChange={e => setInvoiceTotal(e.target.value)} required />
            </label>
          ) : (
            <FiscalAmount name="amountCents" label={editor.kind === "retention" ? "Importe retenido" : "Monto por pagar"} cents={editor.record?.amountCents} />
          )}
          <label className="space-y-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <span>Notas</span>
            <Input className="h-12 rounded-2xl text-base sm:text-sm" name="notes" maxLength={200} defaultValue={editor.record?.notes ?? ""} />
          </label>
          <label className="block space-y-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:col-span-2">
            <span>{editor.record?.supportMime ? "Reemplazar soporte" : "Adjuntar soporte"}</span>
            <Input className="h-12 rounded-2xl pt-2.5 text-sm" name="support" type="file" accept=".pdf,.png,.jpg,.jpeg" />
            <span className="text-[11px] font-normal normal-case text-muted-foreground">PDF, PNG o JPEG de hasta 5 MiB.</span>
          </label>
          {saveError && <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive sm:col-span-2">{saveError}</p>}
          <Button type="submit" className="h-12 rounded-full text-base font-semibold sm:col-span-2">{busy ? "Guardando…" : "Guardar registro"}</Button>
        </fieldset>
      </form>}
    </FinanceSheet>
    <FinanceSheet
      open={!!preview}
      onOpenChange={open => { if (!open) setPreview(undefined); }}
      mobile={mobile}
      title={`Soporte de ${preview?.reference ?? ""}`}
      description="Vista previa del documento adjunto."
    >
      <div className="space-y-3">
        {previewError && <p role="alert" className="text-destructive">{previewError}</p>}
        {!previewError && !previewUrl && <Skeleton className="h-64 rounded-2xl" />}
        {previewUrl && <>
          {preview?.supportMime === "application/pdf"
            ? <FiscalPdfPreview url={previewUrl} />
            : <img src={previewUrl} alt="Comprobante adjunto" className="max-h-[54dvh] w-full rounded-2xl object-contain" />}
          <Button asChild variant="outline" className="h-11 w-full rounded-full"><a href={previewUrl} download={preview?.supportMime === "application/pdf" ? "soporte.pdf" : preview?.supportMime === "image/png" ? "soporte.png" : "soporte.jpg"}>Descargar soporte</a></Button>
        </>}
      </div>
    </FinanceSheet>
  </div>;
}

function FiscalAmount({ name, label, cents, required = false }: { name: string; label: string; cents?: number | null; required?: boolean }) {
  return <label className="space-y-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
    <span>{label} (Bs)</span>
    <Input className="h-12 rounded-2xl text-base font-semibold tabular-nums sm:text-sm" name={name} type="number" inputMode="decimal" step="0.01" min="0" defaultValue={cents == null ? "" : cents / 100} required={required} />
  </label>;
}
