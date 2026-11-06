import { apiFetch } from "@/lib/api";

/** Calls a /syncro-admin endpoint and throws the server's message when it fails. */
export async function adminApi<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await apiFetch(`/syncro-admin${path}`, options);
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(Array.isArray(body?.message) ? body.message.join(", ") : body?.message || "No se pudo completar la acción");
  return body as T;
}

export type BusinessStatus = "ACTIVE" | "TRIAL" | "SUSPENDED";
export type Plan = "BASIC" | "PRO" | "ENTERPRISE";

export const STATUS_LABEL: Record<string, string> = { ACTIVE: "Activo", TRIAL: "En prueba", SUSPENDED: "Suspendido" };
export const STATUS_CLASS: Record<string, string> = {
  ACTIVE: "border-emerald-600/30 bg-emerald-600/10 text-emerald-700",
  TRIAL: "border-blue-600/30 bg-blue-600/10 text-blue-700",
  SUSPENDED: "border-rose-600/30 bg-rose-600/10 text-rose-700",
};
export const PLAN_LABEL: Record<string, string> = { BASIC: "Básico", PRO: "Pro", ENTERPRISE: "Empresa" };
export const PLANS: Plan[] = ["BASIC", "PRO", "ENTERPRISE"];

export const MODULE_LABEL: Record<string, string> = {
  dashboard: "Dashboard",
  pos: "Punto de venta",
  products: "Productos",
  inventory: "Inventario",
  suppliers: "Proveedores",
  reports: "Reportes",
  clients: "Clientes",
  credit: "Fiado",
  accounting: "Contabilidad",
  historial: "Historial",
  whatsapp: "WhatsApp",
  deliveries: "Delivery",
  gym: "Gimnasio",
  syncroshop: "Syncro Shop",
};

export const usd = (n: number | null | undefined) =>
  `$${(n ?? 0).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const shortDate = (d: string | Date | null | undefined) =>
  d ? new Date(d).toLocaleDateString("es-VE", { day: "numeric", month: "short", year: "numeric" }) : "—";

export const dateTime = (d: string | Date | null | undefined) =>
  d ? new Date(d).toLocaleString("es-VE", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }) : "—";

/** "hace 3 días", "hoy", "nunca" */
export function ago(d: string | Date | null | undefined) {
  if (!d) return "Nunca";
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000);
  if (days <= 0) return "Hoy";
  if (days === 1) return "Ayer";
  if (days < 30) return `Hace ${days} días`;
  const months = Math.floor(days / 30);
  return months === 1 ? "Hace 1 mes" : `Hace ${months} meses`;
}

/** yyyy-mm-dd for date inputs */
export const toDateInput = (d: string | Date | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : "");

export type AdminBusiness = {
  id: string;
  name: string;
  status: BusinessStatus;
  subscription: Plan;
  ruc: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  createdAt: string;
  subscriptionEndsAt: string | null;
  monthlyFee: number | null;
  adminNotes: string | null;
  suspendedReason: string | null;
  owner: { name: string | null; email: string } | null;
  lastActivityAt: string | null;
  revenue30d: number;
  _count: { users: number; sales: number; branches: number; products: number; gymMembers: number };
};

export type SubscriptionPayment = {
  id: string;
  amount: number;
  months: number;
  method: string | null;
  reference: string | null;
  note: string | null;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
};

export type AuditEntry = {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  details: string | null;
  ipAddress: string | null;
  createdAt: string;
  user: { name: string | null; email: string; role: string } | null;
  business: { id: string; name: string } | null;
};

export type BusinessDetail = Omit<AdminBusiness, "owner" | "revenue30d" | "_count"> & {
  _count: AdminBusiness["_count"] & { clients: number };
  users: { id: string; name: string | null; email: string; role: string; lastSeen: string | null; createdAt: string }[];
  branches: { id: string; name: string; location: string | null; isMain: boolean }[];
  enabledModules: string[];
  subscriptionPayments: SubscriptionPayment[];
  last30d: { sales: number; salesTotal: number; gymPayments: number; gymTotal: number };
  recentActivity: AuditEntry[];
};

/** Plain-language name for each audit action */
const ACTION_LABEL: Record<string, string> = {
  LOGIN: "Inició sesión",
  LOGIN_FAILED: "Intento de inicio de sesión fallido",
  CREATE_PRODUCT: "Creó un producto",
  UPDATE_PRODUCT: "Editó un producto",
  DELETE_PRODUCT: "Eliminó un producto",
  CREATE_SALE: "Registró una venta",
  SYNCRO_STATUS_CHANGE: "Syncro cambió el estado del negocio",
  SYNCRO_SUBSCRIPTION_UPDATE: "Syncro editó la suscripción",
  SYNCRO_PAYMENT: "Syncro registró un pago de suscripción",
  SYNCRO_PAYMENT_DELETED: "Syncro anuló un pago de suscripción",
};
export function actionLabel(action: string) {
  if (ACTION_LABEL[action]) return ACTION_LABEL[action];
  const s = action.replace(/_/g, " ").toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const ROLE_LABEL: Record<string, string> = {
  ownerpos: "Dueño",
  owner: "Dueño",
  admin: "Administrador",
  superadmin: "Administrador",
  pos: "Cajero",
  syncropos: "Equipo Syncro",
};
