"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminApi } from "@/lib/syncro-admin";
import { FinanceCheck, FinanceSelect } from "./finance-fields";
import { parseBankCsv, type BankMovement } from "./bank-csv";
import type { Entry } from "./calculations";

type Review = BankMovement & { selected: boolean; category: string };

export function BankImport({ entries, categories, onSaved }: {
  entries: Entry[]; categories: [string, string][]; onSaved: () => Promise<void>;
}) {
  const [rows, setRows] = useState<Review[]>([]);
  const [currency, setCurrency] = useState("VES");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const selected = rows.filter(row => row.selected);

  function update(index: number, changes: Partial<Review>) {
    setRows(current => current.map((row, position) => position === index ? { ...row, ...changes } : row));
  }

  async function readFile(file?: File) {
    setRows([]);
    setStatus("");
    setError("");
    if (!file) return;
    try {
      if (!/\.csv$/i.test(file.name) || file.size > 256_000) throw new Error("Elige un CSV de hasta 256 KB.");
      setRows(parseBankCsv(await file.text()).map(row => ({ ...row, selected: false, category: "" })));
    } catch (failure) {
      setError((failure as Error).message);
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setStatus("");
    if (!selected.length || selected.some(row => row.signedCents < 0 && !row.category)) {
      setError("Selecciona los movimientos que quieras importar y clasifica cada gasto.");
      return;
    }
    const rate = currency === "USD" ? 1 : Number(new FormData(event.currentTarget).get("rate"));
    setBusy(true);
    try {
      const result = await adminApi<{ count: number; duplicates: number }>("/finance/personal/import", {
        method: "POST",
        body: JSON.stringify({ entries: selected.map(row => ({
          date: row.date, reference: row.reference, description: row.description,
          kind: row.signedCents > 0 ? "income" : "expense", category: row.category,
          currency, nativeCents: Math.abs(row.signedCents), rate,
        })) }),
      });
      await onSaved();
      setRows(current => current.filter(row => !row.selected));
      setStatus(`${result.count} movimientos guardados · ${result.duplicates} duplicados omitidos.`);
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return <div className="space-y-4">
    <p className="text-sm text-muted-foreground">El CSV debe tener las columnas Fecha, Referencia, Concepto y Monto. Usa montos positivos para abonos y negativos para salidas.</p>
    <label className="block space-y-2 text-sm font-medium"><span>Archivo CSV</span>
      <Input type="file" accept=".csv,text/csv" disabled={busy} onChange={event => {
        const file = event.target.files?.[0];
        event.target.value = "";
        void readFile(file);
      }} />
    </label>
    {rows.length > 0 && <form onSubmit={save} className="space-y-3">
      <fieldset disabled={busy} className="space-y-3">
        <FinanceSelect label="Moneda del archivo" value={currency} onChange={setCurrency} options={[["VES", "VES · Bolívar"], ["USD", "USD · Dólar"]]} />
        {currency !== "USD" && <label className="block space-y-1 text-sm font-medium"><span>Tasa para los movimientos seleccionados (VES por USD)</span>
          <Input name="rate" type="number" min="0.00000001" step="0.00000001" inputMode="decimal" required />
          <span className="block font-normal text-muted-foreground">Si corresponden a tasas distintas, confirma grupos por separado.</span>
        </label>}
        <p className="text-sm">Marca solo ingresos y gastos que aún no registraste. Si ya anotaste el saldo inicial, importa los movimientos posteriores a ese saldo. Para cambios o transferencias propias, usa Transferir o cambiar.</p>
        <ul className="space-y-2">{rows.map((row, index) => {
          const duplicate = entries.some(entry => entry.date === row.date && (entry.currency ?? "USD") === currency &&
            (entry.nativeCents ?? entry.cents) === Math.abs(row.signedCents) &&
            (row.signedCents > 0 ? entry.debit === "bank" : entry.credit === "bank"));
          return <li key={index} className="space-y-1 rounded-lg border p-3">
            <p className="break-words font-medium">{row.description}</p>
            <p className="text-sm text-muted-foreground">{row.date} · {currency} {(row.signedCents / 100).toLocaleString("es-VE", { minimumFractionDigits: 2 })}</p>
            {duplicate && <p className="text-sm text-amber-800">Hay un movimiento registrado con la misma fecha y monto.</p>}
            <FinanceCheck label={row.signedCents > 0 ? "Confirmar como ingreso" : "Confirmar como gasto"} checked={row.selected}
              onChange={checked => update(index, { selected: checked })} />
            {row.selected && row.signedCents < 0 && <FinanceSelect label="Categoría" options={categories} value={row.category}
              onChange={category => update(index, { category })} />}
          </li>;
        })}</ul>
        <Button type="submit" disabled={busy || !selected.length}>Guardar {selected.length} movimientos</Button>
      </fieldset>
    </form>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {status && <p role="status" className="text-sm">{status}</p>}
  </div>;
}
