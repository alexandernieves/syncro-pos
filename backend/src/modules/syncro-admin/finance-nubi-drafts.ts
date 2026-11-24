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
type UpdateObligationDraft = Common & Money & {
  kind: 'updateObligation';
  matchName: string;
  matchDate?: string;
  matchCents?: number;
  obligationKind?: 'payment' | 'income';
  monthly?: boolean;
};
type DeleteObligationDraft = Common & {
  kind: 'deleteObligation';
  matchName: string;
  matchDate?: string;
  matchCents?: number;
};
type DebtDraft = Common & Money & { kind: 'debt'; minimum: Money; apr: number };
type UpdateDebtDraft = Common & {
  kind: 'updateDebt';
  matchName: string;
  currency?: string;
  nativeCents?: number;
  rate?: number;
  cents?: number;
  minimum?: Money;
  apr?: number;
};
type DeleteDebtDraft = Common & {
  kind: 'deleteDebt';
  matchName: string;
};
type DeleteEntryDraft = Common & {
  kind: 'deleteEntry';
  entryId: string;
};
type PlanLimitsDraft = Common & {
  kind: 'planLimits';
  grocery?: number;
  dining?: number;
  smallSpendLimit?: number;
  reserve?: number;
};
type GoalDraft = Common & {
  kind: 'goal';
  goalKind: 'emergency' | 'investment' | 'goal';
  targetCents: number;
  savedCents: number;
  monthlyTargetCents: number;
};
type GoalContributionDraft = Common & Money & { kind: 'goalContribution'; goalName: string };
type MarketItemDraft = Common & Money & { kind: 'marketItem'; store?: string; qty: number };
type CloseMarketDraft = Common & { kind: 'closeMarket'; account: Wallet; store?: string };
type AssetDraft = Common & {
  kind: 'asset';
  category: 'salary' | 'business' | 'investment' | 'rental' | 'digital' | 'other';
  status: 'active' | 'planned';
  monthlyCashflowCents: number;
  startupCapitalCents: number;
  savedCapitalCents: number;
  linkedLiabilityName?: string;
};
type LiabilityDraft = Common & {
  kind: 'liability';
  category: 'vehicle' | 'housing' | 'subscription' | 'debt' | 'lifestyle' | 'other';
  monthlyDrainCents: number;
  balanceCents: number;
};
type AssetCapitalDraft = Common & Money & { kind: 'assetCapital'; assetName: string };
type PayDebtDraft = Common & Money & { kind: 'payDebt'; debtName: string; account: Wallet };
type AdjustBalanceDraft = Common & Money & { kind: 'adjustBalance'; account: Wallet };
export type CalendarEventDraft = Common & {
  kind: 'calendarEvent';
  startTime?: string;
  durationMinutes: number;
  notes?: string;
};
export type UpdateCalendarEventDraft = Common & {
  kind: 'updateCalendarEvent';
  eventId: string;
  startTime?: string;
  durationMinutes: number;
  notes?: string;
};
export type DeleteCalendarEventDraft = Common & {
  kind: 'deleteCalendarEvent';
  eventId: string;
};
export type FinanceDraft =
  | LedgerDraft
  | IncomePlanDraft
  | UpdateObligationDraft
  | DeleteObligationDraft
  | DebtDraft
  | UpdateDebtDraft
  | DeleteDebtDraft
  | DeleteEntryDraft
  | PlanLimitsDraft
  | GoalDraft
  | GoalContributionDraft
  | MarketItemDraft
  | CloseMarketDraft
  | AssetDraft
  | LiabilityDraft
  | AssetCapitalDraft
  | PayDebtDraft
  | AdjustBalanceDraft
  | CalendarEventDraft
  | UpdateCalendarEventDraft
  | DeleteCalendarEventDraft;

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
    const kind = row.kind;
    if (kind === 'planLimits') {
      const optCents = (val: unknown) => (val == null ? undefined : whole(val, 0) ? val as number : (() => { throw new Error('Indica topes válidos en centavos USD.'); })());
      const grocery = optCents(row.grocery);
      const dining = optCents(row.dining);
      const smallSpendLimit = optCents(row.smallSpendLimit);
      const reserve = optCents(row.reserve);
      if (grocery == null && dining == null && smallSpendLimit == null && reserve == null) {
        throw new Error('Indica al menos un tope (mercado, comidas fuera, hormiga o reserva).');
      }
      return { kind, date, description, grocery, dining, smallSpendLimit, reserve };
    }
    if (kind === 'goal') {
      if (!whole(row.targetCents, 1)) throw new Error('Indica el monto meta del objetivo en centavos USD.');
      const goalKind = ['emergency', 'investment', 'goal'].includes(row.goalKind) ? row.goalKind : 'goal';
      const savedCents = whole(row.savedCents, 0) ? row.savedCents : 0;
      const monthlyTargetCents = whole(row.monthlyTargetCents, 0) ? row.monthlyTargetCents : 0;
      return { kind, date, description, goalKind, targetCents: row.targetCents, savedCents, monthlyTargetCents };
    }
    if (kind === 'closeMarket') {
      if (!wallets.includes(row.account)) throw new Error('¿Desde qué cuenta pagaste el mercado (Banco, Efectivo o Binance)?');
      const store = typeof row.store === 'string' && row.store.trim() ? row.store.trim().slice(0, 120) : undefined;
      return { kind, date, description, account: row.account, store };
    }
    if (kind === 'asset') {
      const category = ['salary', 'business', 'investment', 'rental', 'digital', 'other'].includes(row.category) ? row.category : 'business';
      const status = row.status === 'planned' ? 'planned' : 'active';
      const monthlyCashflowCents = whole(row.monthlyCashflowCents, 0) ? row.monthlyCashflowCents : 0;
      const startupCapitalCents = whole(row.startupCapitalCents, 0) ? row.startupCapitalCents : 0;
      const savedCapitalCents = whole(row.savedCapitalCents, 0) ? row.savedCapitalCents : 0;
      const linkedLiabilityName = typeof row.linkedLiabilityName === 'string' && row.linkedLiabilityName.trim() ? row.linkedLiabilityName.trim().slice(0, 120) : undefined;
      return { kind, date, description, category, status, monthlyCashflowCents, startupCapitalCents, savedCapitalCents, linkedLiabilityName };
    }
    if (kind === 'liability') {
      const category = ['vehicle', 'housing', 'subscription', 'debt', 'lifestyle', 'other'].includes(row.category) ? row.category : 'other';
      const monthlyDrainCents = whole(row.monthlyDrainCents, 0) ? row.monthlyDrainCents : 0;
      const balanceCents = whole(row.balanceCents, 0) ? row.balanceCents : 0;
      return { kind, date, description, category, monthlyDrainCents, balanceCents };
    }
    if (kind === 'calendarEvent') {
      const startTime = typeof row.startTime === 'string' && /^\d{2}:\d{2}$/.test(row.startTime.trim()) ? row.startTime.trim() : undefined;
      const durationMinutes = Math.max(15, Math.min(480, Math.round(Number(row.durationMinutes ?? 60) || 60)));
      const notes = typeof row.notes === 'string' && row.notes.trim() ? row.notes.trim().slice(0, 400) : undefined;
      return { kind, date, description, startTime, durationMinutes, notes };
    }
    if (kind === 'updateCalendarEvent') {
      const eventId = typeof row.eventId === 'string' && row.eventId.trim() ? row.eventId.trim().slice(0, 200) : '';
      if (!eventId) throw new Error('Indica qué evento del calendario quieres reprogramar.');
      const startTime = typeof row.startTime === 'string' && /^\d{2}:\d{2}$/.test(row.startTime.trim()) ? row.startTime.trim() : undefined;
      const durationMinutes = Math.max(15, Math.min(480, Math.round(Number(row.durationMinutes ?? 60) || 60)));
      const notes = typeof row.notes === 'string' && row.notes.trim() ? row.notes.trim().slice(0, 400) : undefined;
      return { kind, eventId, date, description, startTime, durationMinutes, notes };
    }
    if (kind === 'deleteCalendarEvent') {
      const eventId = typeof row.eventId === 'string' && row.eventId.trim() ? row.eventId.trim().slice(0, 200) : '';
      if (!eventId) throw new Error('Indica qué evento del calendario quieres cancelar.');
      return { kind, eventId, date, description };
    }
    if (kind === 'deleteObligation') {
      const matchName = typeof row.matchName === 'string' && row.matchName.trim() ? row.matchName.trim().slice(0, 200) : description;
      const matchDate = typeof row.matchDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(row.matchDate.trim()) ? row.matchDate.trim() : undefined;
      const matchCents = whole(row.matchCents, 0) ? row.matchCents : undefined;
      return { kind, date, description, matchName, matchDate, matchCents };
    }
    if (kind === 'updateObligation') {
      const matchName = typeof row.matchName === 'string' && row.matchName.trim() ? row.matchName.trim().slice(0, 200) : description;
      const matchDate = typeof row.matchDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(row.matchDate.trim()) ? row.matchDate.trim() : undefined;
      const matchCents = whole(row.matchCents, 0) ? row.matchCents : undefined;
      const obligationKind = row.obligationKind === 'income' ? 'income' : row.obligationKind === 'payment' ? 'payment' : undefined;
      const monthly = typeof row.monthly === 'boolean' ? row.monthly : undefined;
      return { ...money(row), kind, date, description, matchName, matchDate, matchCents, obligationKind, monthly };
    }
    if (kind === 'deleteDebt') {
      const matchName = typeof row.matchName === 'string' && row.matchName.trim() ? row.matchName.trim().slice(0, 200) : description;
      return { kind, date, description, matchName };
    }
    if (kind === 'updateDebt') {
      const matchName = typeof row.matchName === 'string' && row.matchName.trim() ? row.matchName.trim().slice(0, 200) : description;
      const hasBalance = row.nativeCents != null && row.currency != null;
      const bal = hasBalance ? money(row) : undefined;
      const minimum = row.minimum ? money(row.minimum) : undefined;
      const apr = row.apr != null ? (whole(row.apr, 0) && row.apr <= 100_000 ? row.apr : (() => { throw new Error('Tasa anual inválida.'); })()) : undefined;
      return {
        kind, date, description, matchName,
        ...(bal ? { currency: bal.currency, nativeCents: bal.nativeCents, rate: bal.rate, cents: bal.cents } : {}),
        ...(minimum ? { minimum } : {}),
        ...(apr != null ? { apr } : {}),
      };
    }
    if (kind === 'deleteEntry') {
      const entryId = typeof row.entryId === 'string' && row.entryId.trim() ? row.entryId.trim().slice(0, 128) : '';
      if (!entryId) throw new Error('Indica qué movimiento quieres eliminar.');
      return { kind, entryId, date, description };
    }
    const common = { ...money(row), date, description };
    if (kind === 'assetCapital') {
      const assetName = typeof row.assetName === 'string' && row.assetName.trim() ? row.assetName.trim().slice(0, 120) : description;
      return { ...common, kind, assetName };
    }
    if (kind === 'payDebt') {
      if (!wallets.includes(row.account)) throw new Error('¿Desde qué cuenta abonaste a la deuda (Banco, Efectivo o Binance)?');
      const debtName = typeof row.debtName === 'string' && row.debtName.trim() ? row.debtName.trim().slice(0, 120) : description;
      return { ...common, kind, debtName, account: row.account };
    }
    if (kind === 'adjustBalance') {
      if (!wallets.includes(row.account)) throw new Error('¿Qué cuenta quieres ajustar (Banco, Efectivo o Binance)?');
      return { ...common, kind, account: row.account };
    }
    if (kind === 'goalContribution') {
      const goalName = typeof row.goalName === 'string' && row.goalName.trim() ? row.goalName.trim().slice(0, 120) : description;
      return { ...common, kind, goalName };
    }
    if (kind === 'marketItem') {
      const store = typeof row.store === 'string' && row.store.trim() ? row.store.trim().slice(0, 120) : undefined;
      const qty = Math.max(1, Math.min(999, Math.round(Number(row.qty ?? 1) || 1)));
      return { ...common, kind, store, qty };
    }
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
  if (row.kind === 'planLimits') {
    const parts = [
      row.grocery != null && `Mercado $${(row.grocery / 100).toFixed(2)}`,
      row.dining != null && `Comidas fuera $${(row.dining / 100).toFixed(2)}`,
      row.smallSpendLimit != null && `Hormiga $${(row.smallSpendLimit / 100).toFixed(2)}`,
      row.reserve != null && `Reserva $${(row.reserve / 100).toFixed(2)}`,
    ].filter(Boolean).join(' · ');
    return `Actualizar topes del plan · ${parts}`;
  }
  if (row.kind === 'goal') {
    const typeLabel = row.goalKind === 'investment' ? 'Inversión' : row.goalKind === 'emergency' ? 'Fondo emergencia' : 'Objetivo';
    return `${typeLabel} · ${row.description} · meta USD ${(row.targetCents / 100).toFixed(2)}${row.monthlyTargetCents ? ` · aporte mensual USD ${(row.monthlyTargetCents / 100).toFixed(2)}` : ''}`;
  }
  if (row.kind === 'closeMarket') {
    return `Cerrar carrito de mercado (${row.date}) y registrar gasto en ${nubiWallets[row.account]}`;
  }
  if (row.kind === 'asset') {
    const state = row.status === 'planned' ? 'Activo en construcción' : 'Activo en marcha';
    const flow = row.monthlyCashflowCents ? ` · +$${(row.monthlyCashflowCents / 100).toFixed(2)}/mes` : '';
    const cap = row.startupCapitalCents ? ` · capital meta $${(row.startupCapitalCents / 100).toFixed(2)}` : '';
    const neutralizes = row.linkedLiabilityName ? ` · neutraliza pasivo: ${row.linkedLiabilityName}` : '';
    return `${state} · ${row.description}${flow}${cap}${neutralizes}`;
  }
  if (row.kind === 'liability') {
    return `Pasivo · ${row.description} · drena -$${(row.monthlyDrainCents / 100).toFixed(2)}/mes`;
  }
  if (row.kind === 'calendarEvent') {
    return `Google Calendar · ${row.date}${row.startTime ? ` ${row.startTime}` : ' (todo el día)'} · ${row.description}`;
  }
  if (row.kind === 'updateCalendarEvent') {
    return `Reprogramar en Google Calendar · ${row.date}${row.startTime ? ` ${row.startTime}` : ' (todo el día)'} · ${row.description}`;
  }
  if (row.kind === 'deleteCalendarEvent') {
    return `Cancelar en Google Calendar · ${row.description} (${row.date})`;
  }
  if (row.kind === 'deleteObligation') {
    const amt = row.matchCents != null ? ` · $${(row.matchCents / 100).toFixed(2)}` : '';
    return `Eliminar compromiso · ${row.date} · ${row.description}${amt}`;
  }
  if (row.kind === 'updateObligation') {
    const amt = moneyLabel(row);
    return `Editar compromiso (${row.matchName}) → ${row.date} · ${row.description} · ${amt}${row.monthly ? ' · mensual' : ''}`;
  }
  if (row.kind === 'deleteDebt') {
    return `Eliminar deuda · ${row.description}`;
  }
  if (row.kind === 'updateDebt') {
    const bal = row.nativeCents != null && row.currency ? ` · saldo ${moneyLabel({ nativeCents: row.nativeCents, currency: row.currency })}` : '';
    return `Editar deuda (${row.matchName}) → ${row.description} · vence ${row.date}${bal}`;
  }
  if (row.kind === 'deleteEntry') {
    return `Eliminar movimiento · ${row.date} · ${row.description}`;
  }
  const amount = moneyLabel(row);
  const rate = row.currency === 'USD' ? '' : ` · tasa ${row.rate} ${row.currency}/USD`;
  const prefix = `${row.date} · ${row.description} · ${amount}${rate}`;
  if (row.kind === 'assetCapital') return `Capital para activo (${row.assetName}) · ${prefix}`;
  if (row.kind === 'payDebt') return `Abono a deuda (${row.debtName}) · ${prefix} · desde ${nubiWallets[row.account]}`;
  if (row.kind === 'adjustBalance') return `Ajustar saldo real de ${nubiWallets[row.account]} a ${amount}${rate}`;
  if (row.kind === 'goalContribution') return `Aporte a objetivo (${row.goalName}) · ${prefix}`;
  if (row.kind === 'marketItem') return `Carrito mercado · ${row.qty > 1 ? `${row.qty}x ` : ''}${row.description} · ${amount}${rate}`;
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
  const obligationUpdates: UpdateObligationDraft[] = [];
  const obligationDeletes: DeleteObligationDraft[] = [];
  const debts: Prisma.InputJsonObject[] = [];
  const debtUpdates: UpdateDebtDraft[] = [];
  const debtDeletes: DeleteDebtDraft[] = [];
  const entryDeletes: DeleteEntryDraft[] = [];
  const planUpdates: PlanLimitsDraft[] = [];
  const newGoals: GoalDraft[] = [];
  const goalContribs: GoalContributionDraft[] = [];
  const marketItems: MarketItemDraft[] = [];
  const closeMarkets: CloseMarketDraft[] = [];
  const newAssets: AssetDraft[] = [];
  const newLiabilities: LiabilityDraft[] = [];
  const assetCapitals: AssetCapitalDraft[] = [];
  const debtPayments: PayDebtDraft[] = [];
  const balanceAdjustments: AdjustBalanceDraft[] = [];

  rows.forEach((row, index) => {
    if (row.kind === 'planLimits') planUpdates.push(row);
    else if (row.kind === 'updateObligation') obligationUpdates.push(row);
    else if (row.kind === 'deleteObligation') obligationDeletes.push(row);
    else if (row.kind === 'updateDebt') debtUpdates.push(row);
    else if (row.kind === 'deleteDebt') debtDeletes.push(row);
    else if (row.kind === 'deleteEntry') entryDeletes.push(row);
    else if (row.kind === 'goal') newGoals.push(row);
    else if (row.kind === 'goalContribution') goalContribs.push(row);
    else if (row.kind === 'marketItem') marketItems.push(row);
    else if (row.kind === 'closeMarket') closeMarkets.push(row);
    else if (row.kind === 'asset') newAssets.push(row);
    else if (row.kind === 'liability') newLiabilities.push(row);
    else if (row.kind === 'assetCapital') assetCapitals.push(row);
    else if (row.kind === 'payDebt') debtPayments.push(row);
    else if (row.kind === 'adjustBalance') balanceAdjustments.push(row);
    else if (row.kind === 'debt') {
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

  const touchesPlan = obligations.length || obligationUpdates.length || obligationDeletes.length || debts.length || debtUpdates.length || debtDeletes.length || planUpdates.length || newGoals.length || goalContribs.length || marketItems.length || closeMarkets.length || newAssets.length || newLiabilities.length || assetCapitals.length || debtPayments.length;
  let extraSaved = 0;

  if (touchesPlan) {
    const existing = await tx.centralFinancePlan.findUnique({ where: { scope } });
    const data = (existing?.data ?? { income: 0, grocery: 0, dining: 0, reserve: 0, payday1: 15, payday2: 31, obligations: [], debts: [], goals: [], marketTrips: [], assets: [], liabilities: [] }) as Record<string, any>;
    const currentObligations = Array.isArray(data.obligations) ? [...data.obligations] : [];
    const currentDebts = Array.isArray(data.debts) ? [...data.debts] : [];
    const currentGoals: any[] = Array.isArray(data.goals) ? [...data.goals] : [];
    const currentTrips: any[] = Array.isArray(data.marketTrips) ? [...data.marketTrips] : [];
    const currentAssets: any[] = Array.isArray(data.assets) ? [...data.assets] : [];
    const currentLiabilities: any[] = Array.isArray(data.liabilities) ? [...data.liabilities] : [];

    const findObligationIdx = (matchName: string, matchDate?: string, matchCents?: number) => {
      const needle = matchName.trim().toLowerCase();
      const byAll = (exact: boolean) => currentObligations.findIndex(item => {
        const name = String(item?.name ?? '').trim().toLowerCase();
        const nameOk = exact ? name === needle : (name.includes(needle) || needle.includes(name));
        if (!nameOk) return false;
        if (matchDate && String(item?.date ?? '') !== matchDate) return false;
        if (matchCents != null && Number(item?.cents ?? -1) !== matchCents) return false;
        return true;
      });
      let idx = byAll(true);
      if (idx >= 0) return idx;
      idx = byAll(false);
      if (idx >= 0) return idx;
      if (matchDate && matchCents != null) {
        idx = currentObligations.findIndex(item => String(item?.date ?? '') === matchDate && Number(item?.cents ?? -1) === matchCents);
        if (idx >= 0) return idx;
      }
      return currentObligations.findIndex(item => String(item?.name ?? '').trim().toLowerCase().includes(needle));
    };

    for (const del of obligationDeletes) {
      const idx = findObligationIdx(del.matchName, del.matchDate, del.matchCents);
      if (idx >= 0) {
        currentObligations.splice(idx, 1);
        extraSaved++;
      }
    }

    for (const upd of obligationUpdates) {
      const idx = findObligationIdx(upd.matchName, upd.matchDate, upd.matchCents);
      if (idx >= 0) {
        const prev = currentObligations[idx];
        currentObligations[idx] = {
          ...prev,
          name: upd.description,
          date: upd.date,
          kind: upd.obligationKind ?? prev.kind ?? 'payment',
          cents: upd.cents,
          original: original(upd),
          monthly: upd.monthly ?? prev.monthly ?? false,
        };
        extraSaved++;
      }
    }

    for (const del of debtDeletes) {
      const needle = del.matchName.trim().toLowerCase();
      const idx = currentDebts.findIndex(item => String(item?.name ?? '').trim().toLowerCase() === needle)
        ?? -1;
      const finalIdx = idx >= 0 ? idx : currentDebts.findIndex(item => String(item?.name ?? '').trim().toLowerCase().includes(needle));
      if (finalIdx >= 0) {
        currentDebts.splice(finalIdx, 1);
        extraSaved++;
      }
    }

    for (const upd of debtUpdates) {
      const needle = upd.matchName.trim().toLowerCase();
      let idx = currentDebts.findIndex(item => String(item?.name ?? '').trim().toLowerCase() === needle);
      if (idx < 0) idx = currentDebts.findIndex(item => String(item?.name ?? '').trim().toLowerCase().includes(needle));
      if (idx >= 0) {
        const prev = { ...currentDebts[idx] };
        prev.name = upd.description;
        prev.date = upd.date;
        if (upd.cents != null && upd.currency && upd.nativeCents != null && upd.rate != null) {
          prev.balance = upd.cents;
          prev.balanceOriginal = { currency: upd.currency, nativeCents: upd.nativeCents, rate: upd.rate };
        }
        if (upd.minimum) {
          prev.minimum = upd.minimum.cents;
          prev.minimumOriginal = original(upd.minimum);
        }
        if (upd.apr != null) prev.apr = upd.apr;
        currentDebts[idx] = prev;
        extraSaved++;
      }
    }

    for (const upd of planUpdates) {
      if (upd.grocery != null) data.grocery = upd.grocery;
      if (upd.dining != null) data.dining = upd.dining;
      if (upd.smallSpendLimit != null) data.smallSpendLimit = upd.smallSpendLimit;
      if (upd.reserve != null) data.reserve = upd.reserve;
      extraSaved++;
    }

    for (const g of newGoals) {
      currentGoals.push({
        id: createHash('sha256').update(`goal:${batchId}:${g.description}`).digest('hex').slice(0, 16),
        name: g.description,
        kind: g.goalKind,
        targetCents: g.targetCents,
        savedCents: g.savedCents,
        monthlyTargetCents: g.monthlyTargetCents,
        deadline: null,
      });
      extraSaved++;
    }

    for (const c of goalContribs) {
      const target = currentGoals.find(item => String(item.name).toLowerCase().includes(c.goalName.toLowerCase()));
      if (target) {
        target.savedCents = (Number(target.savedCents) || 0) + c.cents;
      } else {
        currentGoals.push({
          id: createHash('sha256').update(`goal:${batchId}:${c.goalName}`).digest('hex').slice(0, 16),
          name: c.goalName,
          kind: 'goal',
          targetCents: Math.max(c.cents, 10000),
          savedCents: c.cents,
          monthlyTargetCents: 0,
          deadline: null,
        });
      }
      extraSaved++;
    }

    for (const [idx, m] of marketItems.entries()) {
      let openTrip = currentTrips.find(t => t.status === 'open');
      if (!openTrip) {
        openTrip = {
          id: createHash('sha256').update(`trip:${batchId}:${m.date}`).digest('hex').slice(0, 16),
          date: m.date,
          store: m.store ?? null,
          status: 'open',
          items: [],
          totalCents: 0,
        };
        currentTrips.unshift(openTrip);
      }
      if (m.store && !openTrip.store) openTrip.store = m.store;
      openTrip.items = [
        ...(Array.isArray(openTrip.items) ? openTrip.items : []),
        {
          id: createHash('sha256').update(`mitem:${batchId}:${idx}`).digest('hex').slice(0, 12),
          name: m.description,
          cents: m.cents,
          qty: m.qty,
        },
      ];
      openTrip.totalCents = openTrip.items.reduce((sum: number, item: any) => sum + item.cents * (item.qty ?? 1), 0);
      extraSaved++;
    }

    for (const [idx, cm] of closeMarkets.entries()) {
      const openTrip = currentTrips.find(t => t.status === 'open');
      if (openTrip && openTrip.totalCents > 0) {
        openTrip.status = 'closed';
        if (cm.store) openTrip.store = cm.store;
        entries.push({
          scope,
          id: createHash('sha256').update(`nubi-market-close:${batchId}:${idx}`).digest('hex'),
          actorId,
          date: cm.date,
          description: openTrip.store ? `Mercado (${openTrip.store})` : 'Compra de mercado',
          debit: 'food',
          credit: cm.account,
          cents: openTrip.totalCents,
          currency: 'USD',
          nativeCents: openTrip.totalCents,
          rate: new Prisma.Decimal(1),
          smallSpend: false,
        });
      }
      extraSaved++;
    }

    for (const l of newLiabilities) {
      currentLiabilities.push({
        id: createHash('sha256').update(`liab:${batchId}:${l.description}`).digest('hex').slice(0, 16),
        name: l.description,
        category: l.category,
        monthlyDrainCents: l.monthlyDrainCents,
        balanceCents: l.balanceCents,
        notes: null,
      });
      extraSaved++;
    }

    for (const a of newAssets) {
      const linked = a.linkedLiabilityName
        ? currentLiabilities.find(item => String(item.name).toLowerCase().includes(a.linkedLiabilityName!.toLowerCase()))
        : undefined;
      currentAssets.push({
        id: createHash('sha256').update(`asset:${batchId}:${a.description}`).digest('hex').slice(0, 16),
        name: a.description,
        category: a.category,
        status: a.status,
        monthlyCashflowCents: a.monthlyCashflowCents,
        valuationCents: 0,
        startupCapitalCents: a.startupCapitalCents,
        savedCapitalCents: a.savedCapitalCents,
        linkedLiabilityId: linked?.id ?? null,
        notes: null,
      });
      extraSaved++;
    }

    for (const ac of assetCapitals) {
      const target = currentAssets.find(item => String(item.name).toLowerCase().includes(ac.assetName.toLowerCase()));
      if (target) {
        target.savedCapitalCents = (Number(target.savedCapitalCents) || 0) + ac.cents;
        extraSaved++;
      }
    }

    for (const [idx, dp] of debtPayments.entries()) {
      entries.push({
        scope,
        id: createHash('sha256').update(`nubi-debt-pay:${batchId}:${idx}`).digest('hex'),
        actorId,
        date: dp.date,
        description: `Abono deuda: ${dp.debtName}`,
        debit: 'debt',
        credit: dp.account,
        cents: dp.cents,
        currency: dp.currency,
        nativeCents: dp.nativeCents,
        rate: new Prisma.Decimal(dp.rate),
        smallSpend: false,
      });
      const matchIdx = currentDebts.findIndex(item => String(item.name).toLowerCase().includes(dp.debtName.toLowerCase()));
      if (matchIdx >= 0) {
        const target = { ...currentDebts[matchIdx] };
        const remaining = Math.max(0, Number(target.balance || 0) - dp.cents);
        if (remaining <= 0) {
          currentDebts.splice(matchIdx, 1);
        } else {
          target.balance = remaining;
          target.balanceOriginal = { currency: 'USD', nativeCents: remaining, rate: 1 };
          currentDebts[matchIdx] = target;
        }
      }
    }

    const updated = {
      ...data,
      obligations: [...currentObligations, ...obligations],
      debts: [...currentDebts, ...debts],
      goals: currentGoals.slice(0, 50),
      marketTrips: currentTrips.slice(0, 60),
      assets: currentAssets.slice(0, 50),
      liabilities: currentLiabilities.slice(0, 50),
    };
    if (updated.obligations.length > 200 || updated.debts.length > 100) throw new Error('El plan alcanzó su límite de registros.');
    await tx.centralFinancePlan.upsert({ where: { scope }, create: { scope, data: updated as Prisma.InputJsonObject }, update: { data: updated as Prisma.InputJsonObject } });
  }
  for (const [idx, adj] of balanceAdjustments.entries()) {
    const grouped = await tx.centralFinanceEntry.groupBy({
      by: ['debit', 'credit'],
      where: { scope, OR: [{ debit: adj.account }, { credit: adj.account }] },
      _sum: { cents: true },
    });
    let currentBook = 0;
    for (const g of grouped) {
      if (g.debit === adj.account) currentBook += g._sum.cents ?? 0;
      if (g.credit === adj.account) currentBook -= g._sum.cents ?? 0;
    }
    const diff = adj.cents - currentBook;
    if (diff !== 0) {
      entries.push({
        scope,
        id: createHash('sha256').update(`nubi-balance-adj:${batchId}:${idx}`).digest('hex'),
        actorId,
        date: adj.date,
        description: adj.description || `Ajuste saldo real ${nubiWallets[adj.account]}`,
        debit: diff > 0 ? adj.account : 'equity',
        credit: diff > 0 ? 'equity' : adj.account,
        cents: Math.abs(diff),
        currency: 'USD',
        nativeCents: Math.abs(diff),
        rate: new Prisma.Decimal(1),
        smallSpend: false,
      });
    }
  }
  for (const de of entryDeletes) {
    const deleted = await tx.centralFinanceEntry.deleteMany({ where: { scope, id: de.entryId } });
    extraSaved += deleted.count;
  }
  const { count } = entries.length ? await tx.centralFinanceEntry.createMany({ data: entries, skipDuplicates: true }) : { count: 0 };
  return { saved: count + obligations.length + debts.length + extraSaved, duplicates: entries.length - count };
}
