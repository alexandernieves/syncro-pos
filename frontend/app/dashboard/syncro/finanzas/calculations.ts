export type Debt = { name: string; balance: number; minimum: number; apr: number; date: string };
export type Obligation = { name: string; date: string; cents: number; kind: "income" | "payment"; monthly: boolean };
export type IncomeOverride = { month: string; slot: 1 | 2; cents: number };
export type Plan = { smallSpendLimit?: number; incomeOverrides?: IncomeOverride[]; income: number; payday1: number; payday2: number; grocery: number; dining: number; reserve: number; obligations: Obligation[]; debts: Debt[] };
export type Entry = { id: string; date: string; description: string; debit: string; credit: string; cents: number; smallSpend?: boolean };

export function monthDate(month: string, day: number) {
  const [year, index] = month.split("-").map(Number);
  const last = new Date(Date.UTC(year, index, 0)).getUTCDate();
  return month + "-" + String(Math.min(last, day)).padStart(2, "0");
}

export function expectedIncome(plan: Plan, month: string, slot: 1 | 2) {
  return plan.incomeOverrides?.find(row => row.month === month && row.slot === slot)?.cents ?? plan.income;
}

export function projection(plan: Plan, from: string, balance: number, foodRemaining: number, stress: boolean) {
  const start = new Date(from + "T00:00:00Z");
  let lowest = balance;
  let shortfall: { date: string; cents: number } | undefined;
  const weeks = [];
  const debts = plan.debts.map(debt => ({ ...debt }));
  for (let offset = 0; offset < 91; offset++) {
    const date = new Date(+start + offset * 86_400_000).toISOString().slice(0, 10);
    const month = date.slice(0, 7);
    for (const slot of [1, 2] as const) {
      const day = slot === 1 ? plan.payday1 : plan.payday2;
      if (offset > 0 && monthDate(month, day) === date) {
        balance += Math.floor(expectedIncome(plan, month, slot) * (stress ? 0.9 : 1));
      }
    }
    for (const row of plan.obligations) {
      if (row.date === date || (row.monthly && row.date < date && monthDate(month, Number(row.date.slice(8))) === date)) {
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
