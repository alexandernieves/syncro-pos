import { API_URL } from "@/lib/constants";

export type GymPlan = {
  id: string;
  name: string;
  description: string | null;
  durationDays: number;
  price: number;
  color: string | null;
  maxFreezeDays: number;
  isActive: boolean;
  _count?: { memberships: number };
};

export type MembershipState = "ACTIVE" | "SCHEDULED" | "FROZEN" | "EXPIRED" | "CANCELLED";
export type MemberStatus = MembershipState | "NONE" | "BLOCKED";

export type GymPayment = { id: string; amount: number; method: string; reference: string | null; createdAt: string };

export type GymMembership = {
  id: string;
  planId: string;
  planName: string;
  startDate: string;
  endDate: string;
  price: number;
  discount: number;
  status: string;
  state: MembershipState;
  frozenDaysUsed: number;
  notes: string | null;
  payments?: GymPayment[];
};

export type GymMemberRow = {
  id: string;
  memberNumber: number;
  photoUrl: string | null;
  accessEnabled: boolean;
  faceSyncedAt: string | null;
  createdAt: string;
  client: { id: string; name: string; documentId: string | null; phone: string | null; email: string | null };
  status: MemberStatus;
  daysLeft: number | null;
  currentMembership: GymMembership | null;
};

export type GymMemberDetail = GymMemberRow & {
  birthDate: string | null;
  gender: string | null;
  emergencyContact: string | null;
  emergencyPhone: string | null;
  medicalNotes: string | null;
  goal: string | null;
  notes: string | null;
  memberships: GymMembership[];
  checkIns: { id: string; granted: boolean; reason: string | null; method: string; createdAt: string }[];
};

export const STATUS_LABEL: Record<MemberStatus, string> = {
  ACTIVE: "Activa",
  SCHEDULED: "Programada",
  FROZEN: "Congelada",
  EXPIRED: "Vencida",
  CANCELLED: "Cancelada",
  NONE: "Sin membresía",
  BLOCKED: "Acceso bloqueado",
};

export const STATUS_CLASS: Record<MemberStatus, string> = {
  ACTIVE: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
  SCHEDULED: "bg-sky-500/10 text-sky-700 border-sky-500/30",
  FROZEN: "bg-indigo-500/10 text-indigo-700 border-indigo-500/30",
  EXPIRED: "bg-rose-500/10 text-rose-700 border-rose-500/30",
  CANCELLED: "bg-muted text-muted-foreground border-border",
  NONE: "bg-muted text-muted-foreground border-border",
  BLOCKED: "bg-rose-500/10 text-rose-700 border-rose-500/30",
};

export const PAYMENT_METHODS: [string, string][] = [
  ["CASH", "Efectivo"],
  ["CARD", "Punto de venta"],
  ["PAGO_MOVIL", "Pago móvil"],
  ["TRANSFER", "Transferencia"],
  ["BINANCE", "Binance"],
  ["ZINLI", "Zinli"],
  ["PAYPAL", "PayPal"],
];

export const methodLabel = (m: string) => PAYMENT_METHODS.find(([k]) => k === m)?.[1] ?? m;

export const money = (n: number) => `$${(Number(n) || 0).toFixed(2)}`;
export const shortDate = (d: string | Date) => new Date(d).toLocaleDateString("es-VE", { day: "numeric", month: "short", year: "numeric" });

export function durationLabel(days: number) {
  if (days % 365 === 0) return days === 365 ? "1 año" : `${days / 365} años`;
  if (days % 30 === 0) return days === 30 ? "1 mes" : `${days / 30} meses`;
  if (days % 7 === 0) return days === 7 ? "1 semana" : `${days / 7} semanas`;
  return days === 1 ? "1 día" : `${days} días`;
}

/** Fetch against the gym API; throws with the backend message. */
export async function gymApi<T = any>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  const res = await fetch(`${API_URL}/gym${path}`, {
    ...rest,
    headers: {
      Authorization: `Bearer ${localStorage.getItem("token")}`,
      ...(json !== undefined && { "Content-Type": "application/json" }),
      ...headers,
    },
    ...(json !== undefined && { body: JSON.stringify(json) }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(Array.isArray(data.message) ? data.message[0] : data.message || "No se pudo completar la operación");
  return data as T;
}
