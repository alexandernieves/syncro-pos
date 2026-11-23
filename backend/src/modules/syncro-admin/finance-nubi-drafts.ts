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
export type FinanceDraft =
  | LedgerDraft
  | IncomePlanDraft
  | DebtDraft
  | PlanLimitsDraft
  | GoalDraft
  | GoalContributionDraft
  | MarketItemDraft
  | CloseMarketDraft;

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
    const common = { ...money(row), date, description };
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
  const amount = moneyLabel(row);
  const rate = row.currency === 'USD' ? '' : ` · tasa ${row.rate} ${row.currency}/USD`;
  const prefix = `${row.date} · ${row.description} · ${amount}${rate}`;
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
  const debts: Prisma.InputJsonObject[] = [];
  const planUpdates: PlanLimitsDraft[] = [];
  const newGoals: GoalDraft[] = [];
  const goalContribs: GoalContributionDraft[] = [];
  const marketItems: MarketItemDraft[] = [];
  const closeMarkets: CloseMarketDraft[] = [];

  rows.forEach((row, index) => {
    if (row.kind === 'planLimits') planUpdates.push(row);
    else if (row.kind === 'goal') newGoals.push(row);
    else if (row.kind === 'goalContribution') goalContribs.push(row);
    else if (row.kind === 'marketItem') marketItems.push(row);
    else if (row.kind === 'closeMarket') closeMarkets.push(row);
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

  const touchesPlan = obligations.length || debts.length || planUpdates.length || newGoals.length || goalContribs.length || marketItems.length || closeMarkets.length;
  let extraSaved = 0;

  if (touchesPlan) {
    const existing = await tx.centralFinancePlan.findUnique({ where: { scope } });
    const data = (existing?.data ?? { income: 0, grocery: 0, dining: 0, reserve: 0, payday1: 15, payday2: 31, obligations: [], debts: [], goals: [], marketTrips: [] }) as Record<string, any>;
    const currentObligations = Array.isArray(data.obligations) ? [...data.obligations] : [];
    const currentDebts = Array.isArray(data.debts) ? [...data.debts] : [];
    const currentGoals: any[] = Array.isArray(data.goals) ? [...data.goals] : [];
    const currentTrips: any[] = Array.isArray(data.marketTrips) ? [...data.marketTrips] : [];

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

    const updated = {
      ...data,
      obligations: [...currentObligations, ...obligations],
      debts: [...currentDebts, ...debts],
      goals: currentGoals.slice(0, 50),
      marketTrips: currentTrips.slice(0, 60),
    };
    if (updated.obligations.length > 200 || updated.debts.length > 100) throw new Error('El plan alcanzó su límite de registros.');
    await tx.centralFinancePlan.upsert({ where: { scope }, create: { scope, data: updated as Prisma.InputJsonObject }, update: { data: updated as Prisma.InputJsonObject } });
  }
  const { count } = entries.length ? await tx.centralFinanceEntry.createMany({ data: entries, skipDuplicates: true }) : { count: 0 };
  return { saved: count + obligations.length + debts.length + extraSaved, duplicates: entries.length - count };
}
