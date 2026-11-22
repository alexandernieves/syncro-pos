import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { financeBankEntryId } from './finance-bank-identity';

const wallets = ['bank', 'cash', 'binance'] as const;
export const nubiCategories = {
  food: 'Mercado', dining: 'Comidas fuera', housing: 'Vivienda y servicios', transport: 'Transporte',
  health: 'Salud', interest: 'Intereses', expense: 'Otros gastos', subscriptions: 'Suscripciones', shopping: 'Compras', leisure: 'Ocio',
} as const;
export const nubiWallets = { bank: 'Banco', cash: 'Efectivo', binance: 'Binance' } as const;
type Wallet = typeof wallets[number];
type ExpenseCategory = keyof typeof nubiCategories;
type Money = { currency: string; nativeCents: number; rate: number; cents: number };
type Common = { date: string; description: string };
export type LedgerDraft = Common & Money & {
  kind: 'income' | 'expense' | 'transfer'; account: Wallet; category?: ExpenseCategory; smallSpend?: boolean;
  toAccount?: Wallet; toCurrency?: string; toCents?: number; bankReference?: string;
};
type IncomePlanDraft = Common & Money & { kind: 'payment' | 'expectedIncome'; monthly: boolean };
type DebtDraft = Common & Money & { kind: 'debt'; minimum: Money; apr: number };
export type FinanceDraft = LedgerDraft | IncomePlanDraft | DebtDraft;

const whole = (value: unknown, min = 1) =>
  typeof value === 'number' && Number.isInteger(value) && value >= min && value <= 2_000_000_000;
const currencyCode = (value: unknown): value is string => typeof value === 'string' && /^(?:[A-Z]{3}|USDT)$/.test(value);
const moneyLabel = (value: { nativeCents: number; currency: string }) => `${value.currency} ${(value.nativeCents / 100).toFixed(2)}`;

function money(value: any): Money {
  if (!value || !currencyCode(value.currency) || !whole(value.nativeCents)) throw new Error('Confirma el importe y su moneda.');
  const rate = value.currency === 'USD' ? 1 : value.rate;
  if (typeof rate !== 'number' || !Number.isFinite(rate) || rate < 0.00000001 || rate > 1_000_000_000) {
    throw new Error(`¿Cuántas unidades de ${value.currency} equivalen a 1 USD para este registro?`);
  }
  const normalized = new Prisma.Decimal(rate).toDecimalPlaces(8);
  const cents = new Prisma.Decimal(value.nativeCents).div(normalized).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP).toNumber();
  if (!whole(cents)) throw new Error('El equivalente en USD quedó fuera del rango aceptado.');
  return { currency: value.currency, nativeCents: value.nativeCents, rate: normalized.toNumber(), cents };
}

export function validateDrafts(proposed: unknown, today: string): FinanceDraft[] {
  if (!Array.isArray(proposed) || !proposed.length || proposed.length > 20) {
    throw new Error('Envíame hasta 20 movimientos por lote para revisarlos uno a uno.');
  }
  return proposed.map((row: any) => {
    const date = row?.date;
    const parsed = typeof date === 'string' ? new Date(date) : null;
    if (!parsed || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(+parsed) || parsed.toISOString().slice(0, 10) !== date) {
      throw new Error('¿Qué fecha tiene el movimiento o vencimiento?');
    }
    const description = typeof row.description === 'string' ? row.description.trim() : '';
    if (!description || description.length > 200) throw new Error('¿Qué concepto quieres que quede en el registro?');
    const common = { ...money(row), date, description };
    const kind = row.kind;
    if (kind === 'payment' || kind === 'expectedIncome') return { ...common, kind, monthly: row.monthly === true };
    if (kind === 'debt') {
      if (!whole(row.apr, 0) || row.apr > 100_000) throw new Error('¿Cuál es la tasa anual de la deuda? Escribe 0 solo si no tiene intereses.');
      const minimum = money(row.minimum);
      if (minimum.currency !== common.currency || minimum.rate !== common.rate) {
        throw new Error('Confirma el saldo y la cuota en la misma moneda y a la misma tasa.');
      }
      return { ...common, kind, minimum, apr: row.apr };
    }
    if (!['income', 'expense', 'transfer'].includes(kind) || !wallets.includes(row.account)) {
      throw new Error('¿Fue un ingreso, gasto o cambio? Indica si usaste Banco, Efectivo o Binance.');
    }
    if (date > today) throw new Error('Ese movimiento tiene una fecha futura. ¿Quieres programarlo como compromiso?');
    const draft: LedgerDraft = { ...common, kind, account: row.account };
    if (kind === 'expense') {
      if (!Object.prototype.hasOwnProperty.call(nubiCategories, row.category)) throw new Error('¿En qué categoría anoto ese gasto?');
      draft.category = row.category;
      draft.smallSpend = row.smallSpend === true;
    }
    if (kind === 'transfer') {
      if (!wallets.includes(row.toAccount) || !currencyCode(row.toCurrency) || !whole(row.toCents)) {
        throw new Error('¿Cuánto llegó y en qué cuenta y moneda lo recibiste?');
      }
      if (row.toCurrency === draft.currency && (row.toAccount === draft.account || row.toCents !== draft.nativeCents)) {
        throw new Error('Para transferir en la misma moneda, indica cuentas distintas y el mismo monto. Las comisiones se registran aparte.');
      }
      draft.toAccount = row.toAccount;
      draft.toCurrency = row.toCurrency;
      draft.toCents = row.toCents;
    }
    if (row.bankReference != null) {
      if (draft.account !== 'bank' || kind === 'transfer' || typeof row.bankReference !== 'string' || !row.bankReference.trim() || row.bankReference.length > 200) {
        throw new Error('Confirma la referencia bancaria de cada abono o débito.');
      }
      draft.bankReference = row.bankReference.trim();
    }
    return draft;
  });
}

export function describeDraft(row: FinanceDraft) {
  const amount = moneyLabel(row);
  const rate = row.currency === 'USD' ? '' : ` · tasa ${row.rate} ${row.currency}/USD`;
  const prefix = `${row.date} · ${row.description} · ${amount}${rate}`;
  if (row.kind === 'debt') return `Deuda · ${prefix} · cuota ${moneyLabel(row.minimum)} · ${row.apr / 100}% anual`;
  if ('monthly' in row) {
    return `${row.kind === 'payment' ? 'Pago previsto' : 'Cobro previsto'} · ${prefix}${row.monthly ? ' · mensual' : ''}`;
  }
  if (row.kind === 'transfer') {
    return `Cambio · ${prefix} desde ${nubiWallets[row.account]} → ${moneyLabel({ currency: row.toCurrency!, nativeCents: row.toCents! })} en ${nubiWallets[row.toAccount!]}`;
  }
  return `${row.kind === 'income' ? 'Ingreso' : nubiCategories[row.category!]} · ${prefix} · ${nubiWallets[row.account]}${row.smallSpend ? ' · gasto hormiga' : ''}`;
}

const original = ({ currency, nativeCents, rate }: Money) => ({ currency, nativeCents, rate });

export async function storeDrafts(tx: Prisma.TransactionClient, scope: string, actorId: string, batchId: string, rows: FinanceDraft[]) {
  const entries: Prisma.CentralFinanceEntryCreateManyInput[] = [];
  const obligations: Prisma.InputJsonObject[] = [];
  const debts: Prisma.InputJsonObject[] = [];
  rows.forEach((row, index) => {
    if (row.kind === 'debt') {
      debts.push({ name: row.description, date: row.date, balance: row.cents, minimum: row.minimum.cents, apr: row.apr, balanceOriginal: original(row), minimumOriginal: original(row.minimum) });
    } else if (row.kind === 'payment' || row.kind === 'expectedIncome') {
      obligations.push({ name: row.description, date: row.date, kind: row.kind === 'payment' ? 'payment' : 'income', cents: row.cents, original: original(row), monthly: row.monthly });
    } else if ('account' in row) {
      const debit = row.kind === 'income' ? row.account : row.kind === 'transfer' ? row.toAccount! : row.category!;
      const credit = row.kind === 'income' ? 'income' : row.account;
      const id = row.bankReference
        ? financeBankEntryId(row.date, row.bankReference, row.currency, row.nativeCents, row.kind)
        : createHash('sha256').update(`nubi:${batchId}:${index}`).digest('hex');
      entries.push({
        scope, id, actorId, date: row.date, description: row.description, debit, credit, cents: row.cents,
        currency: row.currency, nativeCents: row.nativeCents, rate: new Prisma.Decimal(row.rate),
        smallSpend: row.smallSpend ?? false, toCurrency: row.toCurrency, toCents: row.toCents,
      });
    }
  });
  if (obligations.length || debts.length) {
    const existing = await tx.centralFinancePlan.findUnique({ where: { scope } });
    const data = (existing?.data ?? { income: 0, grocery: 0, dining: 0, reserve: 0, payday1: 15, payday2: 31 }) as Prisma.JsonObject;
    const currentObligations = Array.isArray(data.obligations) ? data.obligations : [];
    const currentDebts = Array.isArray(data.debts) ? data.debts : [];
    const updated = { ...data, obligations: [...currentObligations, ...obligations], debts: [...currentDebts, ...debts] };
    if (updated.obligations.length > 200 || updated.debts.length > 100) throw new Error('El plan alcanzó su límite de registros.');
    await tx.centralFinancePlan.upsert({ where: { scope }, create: { scope, data: updated }, update: { data: updated } });
  }
  const { count } = entries.length ? await tx.centralFinanceEntry.createMany({ data: entries, skipDuplicates: true }) : { count: 0 };
  return { saved: count + obligations.length + debts.length, duplicates: entries.length - count };
}
