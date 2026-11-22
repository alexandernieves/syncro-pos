import { shiftDay } from "./calculations";

export function invoicePeriod(invoice: { period: string | null; date: string }) {
  return invoice.period || invoice.date.slice(0, 7);
}

export function previousMonth(month: string) {
  return shiftDay(month + "-01", -1).slice(0, 7);
}

export function monthlyIvaReference(period: string) {
  if (!/^\d{4}-(?:0[1-9]|1[0-2])$/.test(period)) return undefined;
  const next = shiftDay(period + "-01", 32).slice(0, 7) + "-15";
  const weekday = new Date(next + "T00:00:00Z").getUTCDay();
  return shiftDay(next, weekday === 6 ? 2 : weekday === 0 ? 1 : 0);
}
