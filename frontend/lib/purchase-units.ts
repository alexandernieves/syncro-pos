/** Units an order can be placed in (same list as the server). `factor` null = how many units it holds is asked. */
export const PURCHASE_UNITS: { key: string; label: string; short: string; factor: number | null }[] = [
  { key: "UNIDAD", label: "Unidades", short: "unid.", factor: 1 },
  { key: "CAJA", label: "Cajas", short: "cajas", factor: null },
  { key: "BULTO", label: "Bultos", short: "bultos", factor: null },
  { key: "PAQUETE", label: "Paquetes", short: "paquetes", factor: null },
  { key: "FARDO", label: "Fardos", short: "fardos", factor: null },
  { key: "DOCENA", label: "Docenas", short: "docenas", factor: 12 },
  { key: "KILO", label: "Kilos", short: "kg", factor: 1 },
  { key: "LITRO", label: "Litros", short: "L", factor: 1 },
];
export const unitInfo = (key?: string) => PURCHASE_UNITS.find((u) => u.key === key) ?? PURCHASE_UNITS[0];
/** One box, one bale… (singular, for "por caja") */
export const UNIT_SINGULAR: Record<string, string> = { UNIDAD: "unidad", CAJA: "caja", BULTO: "bulto", PAQUETE: "paquete", FARDO: "fardo", DOCENA: "docena", KILO: "kilo", LITRO: "litro" };
export const fmtQty = (n: number) => (Math.round(n * 100) / 100).toLocaleString("es-VE");
