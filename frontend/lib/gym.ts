import { API_URL } from "@/lib/constants";

export type GymPlan = {
  id: string;
  name: string;
  description: string | null;
  durationDays: number;
  price: number;
  color: string | null;
  maxFreezeDays: number;
  guestPassesPerMonth?: number;
  accessWindows?: { days: number[]; start: string; end: string }[] | null;
  maxEntriesPerDay?: number;
  maxEntriesPerWeek?: number;
  totalEntries?: number;
  includesClasses?: boolean;
  /** Valid in every branch (sede); otherwise only in the member's branch. */
  allBranches?: boolean;
  allowedClassIds?: string[];
  isActive: boolean;
  _count?: { memberships: number };
  activeMembers?: number;
  revenue30d?: number;
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
  fees?: number;
  feeItems?: { label: string; amount: number }[] | null;
  status: string;
  state: MembershipState;
  frozenDaysUsed: number;
  frozenAt?: string | null;
  freezeFrom?: string | null;
  freezeUntil?: string | null;
  freezeReason?: string | null;
  freezeCount?: number;
  notes: string | null;
  payments?: GymPayment[];
};

export type GymMemberRow = {
  id: string;
  memberNumber: number;
  photoUrl: string | null;
  accessEnabled: boolean;
  faceSyncedAt: string | null;
  faceError?: string | null;
  createdAt: string;
  /** Branch (sede) the member belongs to, and whether their plan is valid everywhere. */
  branchId?: string | null;
  branchName?: string | null;
  allBranches?: boolean;
  client: { id: string; name: string; documentId: string | null; phone: string | null; email: string | null };
  status: MemberStatus;
  daysLeft: number | null;
  currentMembership: GymMembership | null;
};

export type GymMemberDetail = GymMemberRow & {
  hasAppAccess?: boolean;
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

/** Total of a membership: price, minus discount, plus extra charges. */
export const membershipTotal = (m: { price: number; discount: number; fees?: number | null }) => Math.round((m.price - m.discount + (m.fees || 0)) * 100) / 100;

export const money = (n: number) => `$${(Number(n) || 0).toFixed(2)}`;
export const shortDate = (d: string | Date) => new Date(d).toLocaleDateString("es-VE", { day: "numeric", month: "short", year: "numeric" });

export function durationLabel(days: number) {
  if (days % 365 === 0) return days === 365 ? "1 año" : `${days / 365} años`;
  if (days % 30 === 0) return days === 30 ? "1 mes" : `${days / 30} meses`;
  if (days % 7 === 0) return days === 7 ? "1 semana" : `${days / 7} semanas`;
  return days === 1 ? "1 día" : `${days} días`;
}

/**
 * Asks the user to open the cash shift (the dialog lives in the dashboard layout).
 * Resolves true once it's open, false if they gave up.
 */
let shiftOpener: (() => Promise<boolean>) | null = null;
export const registerShiftOpener = (fn: (() => Promise<boolean>) | null) => { shiftOpener = fn; };

/** Fetch against the gym API; throws with the backend message. A charge with the cash closed opens it first and retries. */
export async function gymApi<T = any>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  const send = () => fetch(`${API_URL}/gym${path}`, {
    ...rest,
    headers: {
      Authorization: `Bearer ${localStorage.getItem("token")}`,
      // The gym works per branch (sede): the one picked in the header
      ...(localStorage.getItem("currentBranchId") && { "x-branch-id": localStorage.getItem("currentBranchId")! }),
      ...(json !== undefined && { "Content-Type": "application/json" }),
      ...headers,
    },
    ...(json !== undefined && { body: JSON.stringify(json) }),
  });
  let res = await send();
  let data = await res.json().catch(() => ({}));
  if (!res.ok && data.code === "SHIFT_CLOSED") {
    if (!shiftOpener || !(await shiftOpener())) throw new Error("No se cobró: la caja está cerrada");
    res = await send();
    data = await res.json().catch(() => ({}));
  }
  if (!res.ok) throw new Error(Array.isArray(data.message) ? data.message[0] : data.message || "No se pudo completar la operación");
  return data as T;
}

// ── Prospects (CRM) ──────────────────────────────────────────────────────────

export type LeadStage = "NEW" | "CONTACTED" | "TRIAL_SCHEDULED" | "TRIAL_DONE" | "WON" | "LOST";
export type GymLead = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  documentId: string | null;
  source: string | null;
  interest: string | null;
  stage: LeadStage;
  lostReason: string | null;
  notes: string | null;
  ownerName: string | null;
  nextFollowUpAt: string | null;
  trialSessionId: string | null;
  trialAt: string | null;
  memberId: string | null;
  wonAt: string | null;
  createdAt: string;
  updatedAt: string;
  trialSession: { id: string; startsAt: string; status: string; class: { name: string; color: string | null } } | null;
  member: { id: string; memberNumber: number } | null;
  _count: { activities: number; visits: number };
};
export type LeadActivity = { id: string; type: string; text: string; userName: string | null; createdAt: string };

export const LEAD_STAGES: [LeadStage, string][] = [
  ["NEW", "Nuevo"],
  ["CONTACTED", "Contactado"],
  ["TRIAL_SCHEDULED", "Prueba agendada"],
  ["TRIAL_DONE", "Prueba hecha"],
  ["WON", "Inscrito"],
  ["LOST", "Perdido"],
];
export const leadStageLabel = (s: string) => LEAD_STAGES.find(([k]) => k === s)?.[1] ?? s;
export const LEAD_STAGE_CLASS: Record<LeadStage, string> = {
  NEW: "bg-sky-500/10 text-sky-700 border-sky-500/30",
  CONTACTED: "bg-indigo-500/10 text-indigo-700 border-indigo-500/30",
  TRIAL_SCHEDULED: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  TRIAL_DONE: "bg-orange-500/10 text-orange-700 border-orange-500/30",
  WON: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
  LOST: "bg-muted text-muted-foreground border-border",
};
export const LEAD_SOURCES: [string, string][] = [
  ["WALK_IN", "Vino al gimnasio"],
  ["INSTAGRAM", "Instagram"],
  ["FACEBOOK", "Facebook"],
  ["TIKTOK", "TikTok"],
  ["REFERRAL", "Referido de un socio"],
  ["WHATSAPP", "WhatsApp"],
  ["WEB", "Página web"],
  ["GUEST", "Invitado de un socio"],
  ["OTHER", "Otro"],
];
export const leadSourceLabel = (s: string | null | undefined) => (!s || s === "UNKNOWN" ? "Sin indicar" : LEAD_SOURCES.find(([k]) => k === s)?.[1] ?? s);

// ── Staff ────────────────────────────────────────────────────────────────────

export const STAFF_ROLES: [string, string][] = [
  ["TRAINER", "Entrenador"],
  ["RECEPTION", "Recepción"],
  ["MANAGER", "Encargado"],
  ["CLEANING", "Limpieza"],
  ["OTHER", "Otro"],
];
export const staffRoleLabel = (r: string) => STAFF_ROLES.find(([k]) => k === r)?.[1] ?? r;

/** Country of the Syncro account (default dial code for WhatsApp fields). */
export const accountCountry = () => {
  try { return JSON.parse(localStorage.getItem("user") || "{}").country as string | undefined; } catch { return undefined; }
};
