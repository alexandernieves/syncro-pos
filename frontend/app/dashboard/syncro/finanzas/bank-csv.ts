export type BankMovement = { date: string; reference: string; description: string; signedCents: number };

function csvRows(text: string, delimiter: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') { field += '"'; index++; }
      else quoted = !quoted;
    } else if (!quoted && (char === delimiter || char === "\n" || char === "\r")) {
      row.push(field.trim());
      field = "";
      if (char !== delimiter) {
        if (row.some(Boolean)) rows.push(row);
        row = [];
        if (char === "\r" && text[index + 1] === "\n") index++;
      }
    } else field += char;
  }
  if (quoted) throw new Error("Hay una celda con comillas sin cerrar.");
  row.push(field.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

function parseDate(value: string) {
  const local = /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/.exec(value);
  const date = local ? [local[3], local[2].padStart(2, "0"), local[1].padStart(2, "0")].join("-") : value;
  const parsed = new Date(date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(+parsed) || parsed.toISOString().slice(0, 10) !== date) {
    throw new Error("fecha inválida");
  }
  return date;
}

function parseAmount(value: string) {
  const raw = value.trim().replace(/\s/g, "");
  const localized = /^[-+]?\d{1,3}(?:\.\d{3})+,\d{1,2}$/.test(raw)
    ? raw.replace(/\./g, "").replace(",", ".") : raw.replace(",", ".");
  if (!/^[-+]?\d+(?:\.\d{1,2})?$/.test(localized)) throw new Error("monto inválido");
  const cents = Math.round(Number(localized) * 100);
  if (!Number.isSafeInteger(cents) || cents === 0 || Math.abs(cents) > 2_000_000_000) throw new Error("monto fuera de rango");
  return cents;
}

export function parseBankCsv(text: string): BankMovement[] {
  const clean = text.replace(/^\uFEFF/, "");
  const header = clean.split(/\r?\n/, 1)[0];
  const delimiter = header.includes(";") ? ";" : header.includes("\t") ? "\t" : ",";
  const [head, ...rows] = csvRows(clean, delimiter);
  const headers = (head ?? []).map(normalize);
  const positions = [
    headers.indexOf("fecha"), headers.indexOf("referencia"),
    headers.findIndex(value => ["concepto", "descripcion"].includes(value)),
    headers.findIndex(value => ["monto", "importe"].includes(value)),
  ];
  if (positions.some(index => index < 0)) throw new Error("El archivo debe incluir Fecha, Referencia, Concepto y Monto.");
  if (!rows.length || rows.length > 100) throw new Error("El archivo debe contener entre 1 y 100 movimientos.");
  return rows.map((row, index) => {
    const [date, reference, description, value] = positions.map(position => row[position] ?? "");
    try {
      if (row.length !== headers.length || !reference || !description || reference.length > 200 || description.length > 200) {
        throw new Error("faltan datos o una celda excede 200 caracteres");
      }
      return { date: parseDate(date), reference, description, signedCents: parseAmount(value) };
    } catch (error) {
      throw new Error(`Movimiento ${index + 1}: ${(error as Error).message}.`);
    }
  });
}
