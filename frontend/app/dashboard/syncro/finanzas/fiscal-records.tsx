"use client";

import { useEffect, useState, type FormEvent } from "react";
import { FileText, Plus } from "lucide-react";
import { adminApi, adminResponse } from "@/lib/syncro-admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FinanceDate, readableDate } from "./finance-calendar";
import { FiscalPdfPreview } from "./fiscal-pdf-preview";
import { FinanceSelect } from "./finance-fields";

const kinds = {
  invoice: { singular: "Factura", plural: "Facturas", statuses: [["issued", "Emitida"], ["collected", "Cobrada"], ["void", "Anulada"]] },
  declaration: { singular: "Declaración", plural: "Declaraciones", statuses: [["pending", "Por presentar"], ["filed", "Presentada"], ["paid", "Pagada"]] },
  retention: { singular: "Retención", plural: "Retenciones", statuses: [["pending", "Por verificar"], ["confirmed", "Verificada"]] },
} as const;
type Kind = keyof typeof kinds;
type RecordItem = {
  id: string; kind: Kind; status: string; reference: string; date: string; period: string | null;
  dueDate: string | null; filedDate: string | null; paidDate: string | null; counterparty: string | null;
  tax: string | null; direction: string | null; invoiceId: string | null; notes: string | null;
  baseCents: number | null; vatCents: number | null; amountCents: number | null;
  rateCurrency: string | null; rate: string | null; supportMime: string | null;
};
type Editor = { id: string; kind: Kind; record?: RecordItem };
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
  const [records, setRecords] = useState<RecordItem[]>();
  const [kind, setKind] = useState<Kind>("invoice");
  const [editor, setEditor] = useState<Editor>();
  const [preview, setPreview] = useState<RecordItem>();
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewError, setPreviewError] = useState("");
  const [error, setError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    adminApi<RecordItem[]>(path, { signal: controller.signal }).then(setRecords).catch(failure => {
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
      const item = await adminApi<RecordItem>(`${path}/${editor.id}`, {
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
    setEditor(next);
  }

  if (error) return <p role="alert" className="rounded-xl border bg-card p-4 text-destructive">{error}</p>;
  if (!records) return <div role="status" aria-label="Cargando registro fiscal" className="space-y-3">
    {[0, 1, 2].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}
  </div>;

  const visible = records.filter(row => row.kind === kind);
  const overdue = records.filter(row => row.kind === "declaration" && row.status === "pending" && row.dueDate && row.dueDate < today).length;

  return <div className="space-y-4">
    {overdue > 0 && <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{overdue} {overdue === 1 ? "declaración pendiente con vencimiento registrado" : "declaraciones pendientes con vencimiento registrado"}.</p>}
    <nav aria-label="Tipo de registro fiscal" className="flex flex-wrap gap-1 rounded-xl border bg-card p-1.5">
      {(Object.keys(kinds) as Kind[]).map(key => <Button key={key} variant={kind === key ? "secondary" : "ghost"} size="sm" aria-pressed={kind === key} onClick={() => setKind(key)}>{kinds[key].plural}</Button>)}
    </nav>
    <div className="flex justify-end">
      <Button onClick={() => edit({ id: crypto.randomUUID(), kind })}><Plus /> Agregar {kinds[kind].singular.toLowerCase()}</Button>
    </div>
    {visible.length ? <ul className="space-y-2">{visible.map(row => <li key={row.id} className="space-y-2 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap justify-between gap-2">
        <h2 className="min-w-0 break-words font-semibold">{row.reference}</h2>
        <span className="rounded-full bg-muted px-2.5 py-1 text-xs">{kinds[row.kind].statuses.find(([value]) => row.status === value)?.[1] ?? row.status}</span>
      </div>
      <p className="break-words text-sm text-muted-foreground">
        {[readableDate(row.date), row.counterparty, row.tax, row.direction === "received" ? "Recibida" : row.direction === "issued" ? "Practicada" : null, row.period, row.amountCents == null ? null : bolivares.format(row.amountCents / 100)].filter(Boolean).join(" · ")}
      </p>
      {row.dueDate && <p className="text-sm text-muted-foreground">Vence el {readableDate(row.dueDate)}</p>}
      {(row.filedDate || row.paidDate) && <p className="text-sm text-muted-foreground">
        {[row.filedDate && `Presentada el ${readableDate(row.filedDate)}`, row.paidDate && `${row.kind === "invoice" ? "Cobrada" : "Pagada"} el ${readableDate(row.paidDate)}`].filter(Boolean).join(" · ")}
      </p>}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => edit({ id: row.id, kind: row.kind, record: row })}>Editar</Button>
        {row.supportMime && <Button size="sm" variant="outline" onClick={() => setPreview(row)}><FileText /> Ver soporte</Button>}
      </div>
    </li>)}</ul> : <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">Aún no hay registros en esta sección.</p>}
    <Dialog open={!!editor} onOpenChange={open => { if (!open && !busy) setEditor(undefined); }}>
      <DialogContent data-finance-workspace="" data-finance-mobile={mobile ? "" : undefined} className="z-[60] max-h-[85dvh] overflow-y-auto overscroll-y-contain">
        <DialogHeader>
          <DialogTitle>{editor?.record ? "Editar" : "Agregar"} {editor && kinds[editor.kind].singular.toLowerCase()}</DialogTitle>
          <DialogDescription>Usa los datos del documento o del portal fiscal.</DialogDescription>
        </DialogHeader>
        {editor && <form onSubmit={save} key={editor.id}>
          <fieldset disabled={busy} className="grid min-w-0 gap-3 sm:grid-cols-2">
            <label className="text-sm">{editor.kind === "declaration" ? "Referencia de la planilla" : "Número de documento"}
              <Input name="reference" defaultValue={editor.record?.reference} maxLength={200} required={editor.kind !== "declaration"} />
            </label>
            <FinanceSelect label="Estado" name="status" options={kinds[editor.kind].statuses} defaultValue={editor.record?.status ?? kinds[editor.kind].statuses[0][0]} />
            <FinanceDate label={editor.kind === "invoice" ? "Fecha de emisión" : "Fecha del registro"} defaultValue={editor.record?.date ?? today} />
            <label className="text-sm">Período<Input name="period" placeholder="Ej. 2026-11-2" defaultValue={editor.record?.period ?? ""} required={editor.kind === "declaration"} /></label>
            {editor.kind !== "declaration" && <label className="text-sm">{editor.kind === "invoice" ? "Cliente" : "Contraparte"}
              <Input name="counterparty" maxLength={200} defaultValue={editor.record?.counterparty ?? ""} required={editor.kind === "retention"} />
            </label>}
            {editor.kind !== "invoice" && <FinanceSelect label="Impuesto" name="tax" defaultValue={editor.record?.tax ?? "IVA"} options={[["IVA", "IVA"], ["ISLR", "ISLR"]]} />}
            {editor.kind === "invoice" && <>
              <FiscalAmount name="baseCents" label="Base imponible" cents={editor.record?.baseCents} />
              <FiscalAmount name="vatCents" label="IVA facturado" cents={editor.record?.vatCents} />
              <FinanceDate label="Fecha de cobro" name="paidDate" defaultValue={editor.record?.paidDate ?? ""} />
              <FinanceSelect label="Moneda de la tasa anotada" name="rateCurrency" defaultValue={editor.record?.rateCurrency ?? "none"} options={[["none", "Sin tasa"], ["EUR", "EUR"], ["USD", "USD"]]} />
              <label className="text-sm">Tasa anotada (Bs por unidad)<Input name="rate" type="number" min="0.00000001" step="0.00000001" defaultValue={editor.record?.rate ?? ""} /></label>
            </>}
            {editor.kind === "declaration" && <>
              <FinanceDate label="Vencimiento" name="dueDate" defaultValue={editor.record?.dueDate ?? ""} />
              <FinanceDate label="Fecha de presentación" name="filedDate" defaultValue={editor.record?.filedDate ?? ""} />
              <FinanceDate label="Fecha de pago" name="paidDate" defaultValue={editor.record?.paidDate ?? ""} />
            </>}
            {editor.kind === "retention" && <>
              <FinanceSelect label="Sentido" name="direction" defaultValue={editor.record?.direction ?? "received"} options={[["received", "Me retuvieron"], ["issued", "Practiqué la retención"]]} />
              <FinanceSelect label="Factura vinculada" name="invoiceId" defaultValue={editor.record?.invoiceId ?? "none"}
                options={[["none", "Sin vincular"], ...records.filter(row => row.kind === "invoice").map(row => [row.id, row.reference] as const)]} />
            </>}
            <FiscalAmount name="amountCents" label={editor.kind === "invoice" ? "Total de la factura" : editor.kind === "retention" ? "Importe retenido" : "Monto por pagar"} cents={editor.record?.amountCents} required={editor.kind === "invoice"} />
            <label className="text-sm">Notas<Input name="notes" maxLength={200} defaultValue={editor.record?.notes ?? ""} /></label>
            <label className="block text-sm sm:col-span-2">{editor.record?.supportMime ? "Reemplazar soporte" : "Adjuntar soporte"}
              <Input name="support" type="file" accept=".pdf,.png,.jpg,.jpeg" />
              <span className="text-xs text-muted-foreground">PDF, PNG o JPEG de hasta 5 MiB.</span>
            </label>
            {saveError && <p role="alert" className="text-sm text-destructive sm:col-span-2">{saveError}</p>}
            <Button type="submit" className="sm:col-span-2">{busy ? "Guardando…" : "Guardar registro"}</Button>
          </fieldset>
        </form>}
      </DialogContent>
    </Dialog>
    <Dialog open={!!preview} onOpenChange={open => { if (!open) setPreview(undefined); }}>
      <DialogContent className="z-[60] max-h-[85dvh] overflow-y-auto">
        <DialogHeader><DialogTitle>Soporte de {preview?.reference}</DialogTitle><DialogDescription>Vista previa del documento adjunto.</DialogDescription></DialogHeader>
        {previewError && <p role="alert" className="text-destructive">{previewError}</p>}
        {!previewError && !previewUrl && <Skeleton className="h-64" />}
        {previewUrl && <>
          {preview?.supportMime === "application/pdf"
            ? <FiscalPdfPreview url={previewUrl} />
            : <img src={previewUrl} alt="Comprobante adjunto" className="max-h-[54dvh] w-full rounded-lg object-contain" />}
          <Button asChild variant="outline"><a href={previewUrl} download={preview?.supportMime === "application/pdf" ? "soporte.pdf" : preview?.supportMime === "image/png" ? "soporte.png" : "soporte.jpg"}>Descargar soporte</a></Button>
        </>}
      </DialogContent>
    </Dialog>
  </div>;
}

function FiscalAmount({ name, label, cents, required = false }: { name: string; label: string; cents?: number | null; required?: boolean }) {
  return <label className="text-sm">{label} (Bs)
    <Input name={name} type="number" step="0.01" min="0" defaultValue={cents == null ? "" : cents / 100} required={required} />
  </label>;
}
