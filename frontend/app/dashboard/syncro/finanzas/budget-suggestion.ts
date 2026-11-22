import { monthDate, obligationOccursOn, scheduledIncome, shiftDay, type Entry, type Plan } from "./calculations";

const categories = ["food", "dining", "transport", "health", "subscriptions", "shopping", "leisure", "expense"] as const;
type Spending = { grocery: number; dining: number; small: number; other: number };

export function budgetSuggestion(plan: Plan, entries: Entry[], month: string, today: string, receiptEstimate = 0) {
  const months = new Map<string, Spending>();
  const current = today.slice(0, 7);
  const [year, monthNumber] = current.split("-").map(Number);
  const thirdMonth = new Date(Date.UTC(year, monthNumber - 4, 1)).toISOString().slice(0, 7);
  for (const row of entries) {
    const key = row.date.slice(0, 7);
    if (key < thirdMonth || key >= current) continue;
    const debit = categories.find(category => category === row.debit);
    const credit = categories.find(category => category === row.credit);
    if (!debit && !credit) continue;
    const total = months.get(key) ?? { grocery: 0, dining: 0, small: 0, other: 0 };
    for (const [category, cents] of [[debit, row.cents], [credit, -row.cents]] as const) {
      if (!category) continue;
      if (category === "food") total.grocery += cents;
      else if (category === "dining") total.dining += cents;
      else total.other += cents;
    }
    if (row.smallSpend) total.small += row.cents;
    months.set(key, total);
  }
  const history = [...months.values()];
  const average = (key: keyof Spending) => history.length
    ? Math.max(0, Math.round(history.reduce((sum, row) => sum + row[key], 0) / history.length)) : 0;

  let income = scheduledIncome(plan, month).reduce((sum, row) => sum + row.cents, 0);
  let bills = 0;
  const last = Number(monthDate(month, 31).slice(8));
  for (let offset = 0; offset < last; offset++) {
    const day = shiftDay(month + "-01", offset);
    for (const row of plan.obligations) {
      if (!obligationOccursOn(row, day)) continue;
      if (row.kind === "income") income += row.cents;
      else bills += row.cents;
    }
  }
  const debt = plan.debts.filter(row => row.date.slice(0, 7) <= month)
    .reduce((sum, row) => sum + Math.min(row.minimum, row.balance + Math.round(row.balance * row.apr / 120_000)), 0);
  const groceryHistory = history.filter(row => row.grocery > 0);
  const grocery = groceryHistory.length
    ? Math.round(groceryHistory.reduce((sum, row) => sum + row.grocery, 0) / groceryHistory.length) : receiptEstimate;
  const other = average("other");
  const afterEssentials = income - bills - debt - plan.reserve - grocery - other;
  const dining = Math.min(average("dining"), Math.max(0, afterEssentials));
  // Small purchases are a tag across categories, so their limit is not subtracted twice.
  const small = income > 0 && afterEssentials >= 0 ? Math.min(average("small"), grocery + other + dining) : 0;

  return {
    income, bills, debt, other, grocery, dining, small, historyMonths: history.length,
    groceryObserved: groceryHistory.length > 0, groceryFromReceipts: !groceryHistory.length && receiptEstimate > 0, afterEssentials, unassigned: afterEssentials - dining,
  };
}
