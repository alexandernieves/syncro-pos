/** Units an order can be placed in; `factor` fixed (null = the person says how many units it holds). */
export const PURCHASE_UNITS: Record<string, { label: string; factor: number | null }> = {
  UNIDAD: { label: 'Unidades', factor: 1 },
  CAJA: { label: 'Cajas', factor: null },
  BULTO: { label: 'Bultos', factor: null },
  PAQUETE: { label: 'Paquetes', factor: null },
  FARDO: { label: 'Fardos', factor: null },
  DOCENA: { label: 'Docenas', factor: 12 },
  KILO: { label: 'Kilos', factor: 1 },
  LITRO: { label: 'Litros', factor: 1 },
};

/** A valid unit and how many stock units one of it holds. */
export function normalizeUnit(unit?: string, factor?: number) {
  const key = unit && PURCHASE_UNITS[unit] ? unit : 'UNIDAD';
  const fixed = PURCHASE_UNITS[key].factor;
  const f = fixed ?? Number(factor);
  return { unit: key, unitFactor: Number.isFinite(f) && f > 0 && f <= 100000 ? f : 1 };
}
