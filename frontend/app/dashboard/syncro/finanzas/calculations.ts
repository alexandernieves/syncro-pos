export type OriginalMoney = { currency: string; nativeCents: number; rate: number };
export type Debt = { balanceOriginal?: OriginalMoney | null; minimumOriginal?: OriginalMoney | null; name: string; balance: number; minimum: number; apr: number; date: string };
export type Obligation = { original?: OriginalMoney | null; name: string; date: string; cents: number; kind: "income" | "payment"; monthly: boolean };
export type IncomeOverride = { month: string; slot: 1 | 2; cents: number };
export type Frequency = "weekly" | "twice-monthly" | "monthly";
export type GoalKind = "emergency" | "investment" | "goal";
export type Goal = {
  id: string;
  name: string;
  kind: GoalKind;
  targetCents: number;
  savedCents: number;
  monthlyTargetCents: number;
  deadline?: string | null;
};
export type MarketItem = { id: string; name: string; cents: number; qty?: number };
export type MarketTrip = {
  id: string;
  date: string;
  store?: string | null;
  status: "open" | "closed";
  items: MarketItem[];
  totalCents: number;
};
export type AssetCategory = "salary" | "business" | "investment" | "rental" | "digital" | "other";
export type AssetItem = {
  id: string;
  name: string;
  category: AssetCategory;
  status: "active" | "planned";
  monthlyCashflowCents: number;
  valuationCents: number;
  startupCapitalCents: number;
  savedCapitalCents: number;
  linkedLiabilityId?: string | null;
  notes?: string | null;
};
export type LiabilityCategory = "vehicle" | "housing" | "subscription" | "debt" | "lifestyle" | "other";
export type LiabilityItem = {
  id: string;
  name: string;
  category: LiabilityCategory;
  monthlyDrainCents: number;
  balanceCents: number;
  notes?: string | null;
};
export type Plan = {
  incomeOriginal?: OriginalMoney | null;
  horizonWeeks?: number;
  paydayOverrides?: { date: string; cents: number }[];
  frequency?: Frequency;
  weeklyPayday?: number;
  monthlyOverrides?: { month: string; cents: number }[];
  smallSpendLimit?: number;
  incomeOverrides?: IncomeOverride[];
  income: number;
  payday1: number;
  payday2: number;
  grocery: number;
  dining: number;
  reserve: number;
  obligations: Obligation[];
  debts: Debt[];
  goals?: Goal[];
  marketTrips?: MarketTrip[];
  assets?: AssetItem[];
  liabilities?: LiabilityItem[];
};
export type Entry = { id: string; date: string; description: string; debit: string; credit: string; cents: number; smallSpend?: boolean; currency?: string; nativeCents?: number | null; rate?: string | null; toCurrency?: string | null; toCents?: number | null };

export function distributeIncome(
  amountCents: number,
  params: {
    fiscalIvaCents: number;
    upcomingBillsCents: number;
    foodRemainingCents: number;
    reserveGapCents: number;
    totalDebtCents: number;
    topDebtName?: string;
    monthlyInvestmentTargetCents: number;
  },
) {
  let pool = Math.max(0, Math.round(amountCents));
  const take = (need: number) => {
    const used = Math.min(pool, Math.max(0, Math.round(need)));
    pool -= used;
    return used;
  };

  const fiscal = take(params.fiscalIvaCents);
  const bills = take(params.upcomingBillsCents);
  const food = take(params.foodRemainingCents);
  const reserve = take(params.reserveGapCents);

  // Split remaining surplus between Debt Attack, Investments/Goals, and Free Cash
  let debtAttack = 0;
  let investments = 0;
  if (pool > 0) {
    if (params.totalDebtCents > 0) {
      // Prioritize 60% of surplus to avalanche debt #1, 25% to investments/goals (so you still build wealth!), 15% free
      debtAttack = take(Math.min(params.totalDebtCents, Math.round(pool * 0.6)));
      const invTarget = params.monthlyInvestmentTargetCents > 0
        ? Math.min(params.monthlyInvestmentTargetCents, Math.round(pool * 0.65))
        : Math.round(pool * 0.55);
      investments = take(invTarget);
    } else {
      // Debt-free: allocate 50% (or monthly target) to investments & goals, rest free
      const invTarget = params.monthlyInvestmentTargetCents > 0
        ? Math.max(params.monthlyInvestmentTargetCents, Math.round(pool * 0.45))
        : Math.round(pool * 0.5);
      investments = take(invTarget);
    }
  }
  const freeCash = pool;

  return {
    total: Math.max(0, Math.round(amountCents)),
    fiscal,
    bills,
    food,
    reserve,
    debtAttack,
    topDebtName: params.topDebtName,
    investments,
    freeCash,
  };
}

export function monthDate(month: string, day: number) {
  const [year, index] = month.split("-").map(Number);
  const last = new Date(Date.UTC(year, index, 0)).getUTCDate();
  return month + "-" + String(Math.min(last, day)).padStart(2, "0");
}

export function expectedIncome(plan: Plan, month: string, slot: 1 | 2) {
  return plan.incomeOverrides?.find(row => row.month === month && row.slot === slot)?.cents ?? plan.income;
}

export function shiftDay(date: string, days: number) {
  return new Date(Date.parse(date + "T00:00:00Z") + days * 86_400_000).toISOString().slice(0, 10);
}

export function scheduledIncome(plan: Plan, month: string) {
  const lastDay = Number(monthDate(month, 31).slice(8));
  const frequency = plan.frequency ?? "twice-monthly";
  const days = frequency === "weekly"
    ? Array.from({ length: lastDay }, (_, index) => index + 1)
      .filter(day => new Date(monthDate(month, day) + "T00:00:00Z").getUTCDay() === (plan.weeklyPayday ?? 5))
    : frequency === "monthly" ? [plan.payday2] : [plan.payday1, plan.payday2];
  const monthly = plan.monthlyOverrides?.find(row => row.month === month)?.cents;
  const result = new Map<string, number>();
  days.forEach((day, index) => {
    const date = monthDate(month, day);
    const cents = monthly === undefined
      ? frequency === "twice-monthly" ? expectedIncome(plan, month, index === 0 ? 1 : 2) : plan.income
      : Math.floor(monthly / days.length) + Number(index < monthly % days.length);
    result.set(date, (result.get(date) ?? 0) + cents);
  });
  for (const row of plan.paydayOverrides ?? []) {
    if (row.date.startsWith(month)) result.set(row.date, row.cents);
  }
  return Array.from(result, ([date, cents]) => ({ date, cents })).sort((a, b) => a.date.localeCompare(b.date));
}

export function obligationOccursOn(row: Obligation, date: string) {
  return row.date === date ||
    (row.monthly && row.date < date && monthDate(date.slice(0, 7), Number(row.date.slice(8))) === date);
}

export function projection(plan: Plan, from: string, balance: number, foodRemaining: number, stress: boolean, horizon = plan.horizonWeeks ?? 13) {
  const incomeByMonth = new Map<string, ReturnType<typeof scheduledIncome>>();
  let lowest = balance;
  let shortfall: { date: string; cents: number } | undefined;
  const weeks = [];
  const debts = plan.debts.map(debt => ({ ...debt }));
  for (let offset = 0; offset < horizon * 7; offset++) {
    const date = shiftDay(from, offset);
    const month = date.slice(0, 7);
    if (!incomeByMonth.has(month)) incomeByMonth.set(month, scheduledIncome(plan, month));
    for (const payment of incomeByMonth.get(month) ?? []) {
      if (offset > 0 && payment.date === date) balance += Math.floor(payment.cents * (stress ? 0.9 : 1));
    }
    for (const row of plan.obligations) {
      if (obligationOccursOn(row, date)) {
        balance += row.kind === "income" ? Math.floor(row.cents * (stress ? 0.9 : 1)) : -row.cents;
      }
    }
    for (const debt of debts) {
      if (debt.date > date || monthDate(month, Number(debt.date.slice(8))) !== date) continue;
      debt.balance += monthlyInterest(debt);
      const payment = Math.min(debt.balance, debt.minimum);
      debt.balance -= payment;
      balance -= payment;
    }
    if (offset === 0) balance -= foodRemaining;
    if (offset > 0 && date.endsWith("-01")) balance -= plan.grocery + plan.dining;
    lowest = Math.min(lowest, balance);
    if (!shortfall && balance < plan.reserve) shortfall = { date, cents: plan.reserve - balance };
    if (offset % 7 === 6) weeks.push({ date, balance });
  }
  return { weeks, shortfall, extra: Math.max(0, lowest - plan.reserve) };
}

function monthlyInterest(debt: Debt) {
  return Math.round(debt.balance * debt.apr / 120_000);
}

export function simulateDebts(input: Debt[], extra: number) {
  const debts = input.map(debt => ({ ...debt })).sort((a, b) => b.apr - a.apr);
  for (const debt of debts) {
    const payment = Math.min(debt.balance, extra);
    debt.balance -= payment;
    extra -= payment;
  }
  const budget = debts.reduce((sum, debt) => sum + debt.minimum, 0);
  let interest = 0;
  for (let months = 0; months <= 600; months++) {
    if (debts.every(debt => debt.balance === 0)) return { months, interest, first: debts[0]?.name };
    if (months === 600) break;
    let remaining = budget;
    for (const debt of debts) {
      const charge = monthlyInterest(debt);
      interest += charge;
      debt.balance += charge;
      const payment = Math.min(debt.balance, debt.minimum);
      debt.balance -= payment;
      remaining -= payment;
    }
    for (const debt of debts) {
      const payment = Math.min(debt.balance, remaining);
      debt.balance -= payment;
      remaining -= payment;
    }
  }
  return null;
}

export const walletAccounts = ["bank", "cash", "binance"];

export function walletBalances(entries: Entry[], asOf: string) {
  const balances = new Map<string, { account: string; currency: string; cents: number }>();
  function add(account: string, currency: string, cents: number) {
    if (!walletAccounts.includes(account)) return;
    const key = account + ":" + currency;
    balances.set(key, { account, currency, cents: (balances.get(key)?.cents ?? 0) + cents });
  }
  for (const entry of entries) {
    if (entry.date > asOf) continue;
    const source = entry.currency ?? "USD";
    add(entry.credit, source, -(entry.nativeCents ?? entry.cents));
    add(entry.debit, entry.toCurrency ?? source, entry.toCents ?? entry.nativeCents ?? entry.cents);
  }
  return [...balances.values()].filter(row => row.cents !== 0);
}
