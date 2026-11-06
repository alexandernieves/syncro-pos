import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { forgetSuspension } from './suspension';

export const BUSINESS_STATUSES = ['ACTIVE', 'TRIAL', 'SUSPENDED'] as const;
export const PLANS = ['BASIC', 'PRO', 'ENTERPRISE'] as const;
const OWNER_ROLES = ['ownerpos', 'owner', 'admin', 'superadmin'];
const DAY = 86_400_000;

const addMonths = (d: Date, months: number) => {
  const out = new Date(d);
  out.setMonth(out.getMonth() + months);
  return out;
};

@Injectable()
export class SyncroAdminService {
  constructor(private prisma: PrismaService) {}

  private audit(adminId: string | undefined, businessId: string, action: string, details: Record<string, unknown>) {
    if (!adminId) return Promise.resolve();
    return this.prisma.auditLog
      .create({ data: { userId: adminId, businessId, action, entity: 'BUSINESS', entityId: businessId, details: JSON.stringify(details) } })
      .then(() => undefined)
      .catch(() => undefined);
  }

  /** Last time anyone of each business used Syncro: latest sale, gym payment or user activity. */
  private async lastActivity(businessIds?: string[]) {
    const where = businessIds ? { businessId: { in: businessIds } } : { businessId: { not: null } };
    const [sales, users] = await Promise.all([
      this.prisma.sale.groupBy({ by: ['businessId'], where, _max: { createdAt: true } }),
      this.prisma.user.groupBy({ by: ['businessId'], where: { ...where, role: { not: 'syncropos' } }, _max: { lastSeen: true } }),
    ]);
    const out = new Map<string, Date>();
    const keep = (id: string | null, d: Date | null | undefined) => {
      if (!id || !d) return;
      const prev = out.get(id);
      if (!prev || d > prev) out.set(id, d);
    };
    sales.forEach((s) => keep(s.businessId, s._max.createdAt));
    users.forEach((u) => keep(u.businessId, u._max.lastSeen));
    return out;
  }

  // ── Businesses ─────────────────────────────────────────────────────────────

  async getAllBusinesses() {
    const since = new Date(Date.now() - 30 * DAY);
    const [businesses, activity, sales30, gym30, owners] = await Promise.all([
      this.prisma.business.findMany({
        include: { _count: { select: { users: true, sales: true, branches: true, products: true, gymMembers: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.lastActivity(),
      this.prisma.sale.groupBy({ by: ['businessId'], where: { createdAt: { gte: since }, status: { not: 'CANCELLED' } }, _sum: { total: true } }),
      this.prisma.gymPayment.groupBy({ by: ['businessId'], where: { createdAt: { gte: since } }, _sum: { amount: true } }),
      this.prisma.user.findMany({
        where: { role: { in: OWNER_ROLES }, businessId: { not: null } },
        select: { businessId: true, name: true, email: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);
    const owner = new Map<string, { name: string | null; email: string }>();
    owners.forEach((u) => { if (u.businessId && !owner.has(u.businessId)) owner.set(u.businessId, { name: u.name, email: u.email }); });
    const sales = new Map(sales30.map((s) => [s.businessId, s._sum.total ?? 0]));
    const gym = new Map(gym30.map((g) => [g.businessId, g._sum.amount ?? 0]));
    return businesses.map((b) => ({
      ...b,
      owner: owner.get(b.id) ?? null,
      lastActivityAt: activity.get(b.id) ?? null,
      revenue30d: (sales.get(b.id) ?? 0) + (gym.get(b.id) ?? 0),
    }));
  }

  async getBusiness(id: string) {
    const since = new Date(Date.now() - 30 * DAY);
    const business = await this.prisma.business.findUnique({
      where: { id },
      include: {
        _count: { select: { users: true, sales: true, branches: true, products: true, clients: true, gymMembers: true } },
        users: { where: { role: { not: 'syncropos' } }, select: { id: true, name: true, email: true, role: true, lastSeen: true, createdAt: true }, orderBy: { createdAt: 'asc' } },
        branches: { select: { id: true, name: true, location: true, isMain: true } },
        settings: { select: { enabledModules: true }, take: 1 },
        subscriptionPayments: { orderBy: { createdAt: 'desc' }, take: 24 },
      },
    });
    if (!business) throw new NotFoundException('Negocio no encontrado');
    const [sales, gym, activity, recent] = await Promise.all([
      this.prisma.sale.aggregate({ where: { businessId: id, createdAt: { gte: since }, status: { not: 'CANCELLED' } }, _sum: { total: true }, _count: true }),
      this.prisma.gymPayment.aggregate({ where: { businessId: id, createdAt: { gte: since } }, _sum: { amount: true }, _count: true }),
      this.lastActivity([id]),
      this.prisma.auditLog.findMany({
        where: { businessId: id },
        orderBy: { createdAt: 'desc' },
        take: 15,
        include: { user: { select: { name: true, email: true } } },
      }),
    ]);
    const { settings, ...rest } = business;
    return {
      ...rest,
      enabledModules: (settings[0]?.enabledModules as string[] | null) ?? [],
      lastActivityAt: activity.get(id) ?? null,
      last30d: { sales: sales._count, salesTotal: sales._sum.total ?? 0, gymPayments: gym._count, gymTotal: gym._sum.amount ?? 0 },
      recentActivity: recent,
    };
  }

  async updateBusinessStatus(id: string, status: string, reason: string | undefined, adminId?: string) {
    if (!BUSINESS_STATUSES.includes(status as any)) throw new BadRequestException('Estado no válido');
    const before = await this.prisma.business.findUnique({ where: { id }, select: { status: true } });
    if (!before) throw new NotFoundException('Negocio no encontrado');
    const updated = await this.prisma.business.update({
      where: { id },
      data: { status, suspendedReason: status === 'SUSPENDED' ? reason?.trim() || null : null },
    });
    forgetSuspension(id);
    await this.audit(adminId, id, 'SYNCRO_STATUS_CHANGE', { from: before.status, to: status, reason: reason || undefined });
    return updated;
  }

  async updateBusiness(id: string, body: { subscription?: string; monthlyFee?: number | null; subscriptionEndsAt?: string | null; adminNotes?: string | null }, adminId?: string) {
    const data: Record<string, unknown> = {};
    if (body.subscription !== undefined) {
      if (!PLANS.includes(body.subscription as any)) throw new BadRequestException('Plan no válido');
      data.subscription = body.subscription;
    }
    if (body.monthlyFee !== undefined) {
      const fee = body.monthlyFee === null ? null : Number(body.monthlyFee);
      if (fee !== null && (!Number.isFinite(fee) || fee < 0)) throw new BadRequestException('Cuota no válida');
      data.monthlyFee = fee;
    }
    if (body.subscriptionEndsAt !== undefined) {
      const d = body.subscriptionEndsAt ? new Date(body.subscriptionEndsAt) : null;
      if (d && Number.isNaN(d.getTime())) throw new BadRequestException('Fecha no válida');
      data.subscriptionEndsAt = d;
    }
    if (body.adminNotes !== undefined) data.adminNotes = body.adminNotes?.trim() || null;
    const exists = await this.prisma.business.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException('Negocio no encontrado');
    const updated = await this.prisma.business.update({ where: { id }, data });
    await this.audit(adminId, id, 'SYNCRO_SUBSCRIPTION_UPDATE', data);
    return updated;
  }

  /** Records a payment and moves the due date forward. Paying reactivates a suspended or trial account. */
  async registerPayment(id: string, body: { amount: number; months?: number; method?: string; reference?: string; note?: string }, adminId?: string) {
    const amount = Number(body.amount);
    const months = Math.round(Number(body.months ?? 1));
    if (!Number.isFinite(amount) || amount <= 0) throw new BadRequestException('Monto no válido');
    if (!Number.isFinite(months) || months < 1 || months > 36) throw new BadRequestException('Meses no válidos (1 a 36)');
    const business = await this.prisma.business.findUnique({ where: { id }, select: { subscriptionEndsAt: true, status: true } });
    if (!business) throw new NotFoundException('Negocio no encontrado');
    const now = new Date();
    const periodStart = business.subscriptionEndsAt && business.subscriptionEndsAt > now ? business.subscriptionEndsAt : now;
    const periodEnd = addMonths(periodStart, months);
    const [payment] = await this.prisma.$transaction([
      this.prisma.subscriptionPayment.create({
        data: { businessId: id, amount, months, method: body.method?.trim() || null, reference: body.reference?.trim() || null, note: body.note?.trim() || null, periodStart, periodEnd, createdById: adminId ?? null },
      }),
      this.prisma.business.update({ where: { id }, data: { subscriptionEndsAt: periodEnd, status: 'ACTIVE', suspendedReason: null } }),
    ]);
    forgetSuspension(id);
    await this.audit(adminId, id, 'SYNCRO_PAYMENT', { amount, months, until: periodEnd.toISOString(), previousStatus: business.status });
    return payment;
  }

  async deletePayment(paymentId: string, adminId?: string) {
    const payment = await this.prisma.subscriptionPayment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new NotFoundException('Pago no encontrado');
    // Undoing the latest payment rolls the due date back to where it was
    const latest = await this.prisma.subscriptionPayment.findFirst({ where: { businessId: payment.businessId }, orderBy: { periodEnd: 'desc' } });
    await this.prisma.$transaction([
      this.prisma.subscriptionPayment.delete({ where: { id: paymentId } }),
      ...(latest?.id === paymentId ? [this.prisma.business.update({ where: { id: payment.businessId }, data: { subscriptionEndsAt: payment.periodStart } })] : []),
    ]);
    await this.audit(adminId, payment.businessId, 'SYNCRO_PAYMENT_DELETED', { amount: payment.amount, months: payment.months });
    return { ok: true };
  }

  // ── Subscriptions ──────────────────────────────────────────────────────────

  async getSubscriptions() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const [businesses, lastPayments, monthPayments, owners] = await Promise.all([
      this.prisma.business.findMany({
        select: { id: true, name: true, status: true, subscription: true, monthlyFee: true, subscriptionEndsAt: true, createdAt: true, email: true, phone: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.subscriptionPayment.findMany({ distinct: ['businessId'], orderBy: { createdAt: 'desc' }, select: { businessId: true, amount: true, createdAt: true, months: true } }),
      this.prisma.subscriptionPayment.aggregate({ where: { createdAt: { gte: monthStart } }, _sum: { amount: true }, _count: true }),
      this.prisma.user.findMany({ where: { role: { in: OWNER_ROLES }, businessId: { not: null } }, select: { businessId: true, name: true, email: true }, orderBy: { createdAt: 'asc' } }),
    ]);
    const last = new Map(lastPayments.map((p) => [p.businessId, p]));
    const owner = new Map<string, { name: string | null; email: string }>();
    owners.forEach((u) => { if (u.businessId && !owner.has(u.businessId)) owner.set(u.businessId, { name: u.name, email: u.email }); });
    const rows = businesses.map((b) => {
      const daysLeft = b.subscriptionEndsAt ? Math.ceil((b.subscriptionEndsAt.getTime() - now.getTime()) / DAY) : null;
      return { ...b, owner: owner.get(b.id) ?? null, daysLeft, lastPayment: last.get(b.id) ?? null };
    });
    const paying = rows.filter((r) => r.status === 'ACTIVE');
    return {
      summary: {
        mrr: paying.reduce((s, r) => s + (r.monthlyFee ?? 0), 0),
        collectedThisMonth: monthPayments._sum.amount ?? 0,
        paymentsThisMonth: monthPayments._count,
        expiringSoon: rows.filter((r) => r.status !== 'SUSPENDED' && r.daysLeft !== null && r.daysLeft >= 0 && r.daysLeft <= 7).length,
        overdue: rows.filter((r) => r.status !== 'SUSPENDED' && r.daysLeft !== null && r.daysLeft < 0).length,
        withoutDate: rows.filter((r) => r.status !== 'SUSPENDED' && r.daysLeft === null).length,
      },
      businesses: rows,
    };
  }

  // ── Metrics ────────────────────────────────────────────────────────────────

  async getGlobalStats() {
    const now = Date.now();
    const d7 = new Date(now - 7 * DAY);
    const d30 = new Date(now - 30 * DAY);
    const year = new Date(now - 365 * DAY);
    const [businesses, users, members, sales30, gym30, salesAll, daily, feedback, unread, activity, settings] = await Promise.all([
      this.prisma.business.findMany({ select: { id: true, name: true, status: true, subscription: true, createdAt: true, monthlyFee: true } }),
      this.prisma.user.count({ where: { role: { not: 'syncropos' } } }),
      this.prisma.gymMember.count(),
      this.prisma.sale.groupBy({ by: ['businessId'], where: { createdAt: { gte: d30 }, status: { not: 'CANCELLED' } }, _sum: { total: true }, _count: true }),
      this.prisma.gymPayment.aggregate({ where: { createdAt: { gte: d30 } }, _sum: { amount: true }, _count: true }),
      this.prisma.sale.aggregate({ where: { status: { not: 'CANCELLED' } }, _sum: { total: true }, _count: true }),
      this.prisma.$queryRaw<{ day: Date; sales: bigint; total: number }[]>`
        SELECT date_trunc('day', "createdAt") AS day, COUNT(*)::bigint AS sales, COALESCE(SUM("total"), 0)::float AS total
        FROM "Sale" WHERE "createdAt" >= ${d30} AND "status" <> 'CANCELLED'
        GROUP BY 1 ORDER BY 1`,
      this.prisma.aiFeedback.groupBy({ by: ['rating'], _count: true }),
      this.prisma.message.count({ where: { isRead: false, sender: { role: { not: 'syncropos' } } } }),
      this.lastActivity(),
      this.prisma.setting.findMany({ where: { businessId: { not: null } }, select: { businessId: true, enabledModules: true } }),
    ]);

    const byStatus = Object.fromEntries(BUSINESS_STATUSES.map((s) => [s, businesses.filter((b) => b.status === s).length]));
    const byPlan = Object.fromEntries(PLANS.map((p) => [p, businesses.filter((b) => b.subscription === p).length]));
    const active7 = [...activity.values()].filter((d) => d >= d7).length;
    const active30 = [...activity.values()].filter((d) => d >= d30).length;

    // New businesses per month, last 12 months
    const months: { month: string; count: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      months.push({ month: key, count: 0 });
    }
    businesses.filter((b) => b.createdAt >= year).forEach((b) => {
      const key = `${b.createdAt.getFullYear()}-${String(b.createdAt.getMonth() + 1).padStart(2, '0')}`;
      const m = months.find((x) => x.month === key);
      if (m) m.count++;
    });

    const names = new Map(businesses.map((b) => [b.id, b.name]));
    const top = sales30
      .filter((s) => s.businessId)
      .map((s) => ({ businessId: s.businessId!, name: names.get(s.businessId!) ?? '—', sales: s._count, total: s._sum.total ?? 0 }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    const moduleUse: Record<string, number> = {};
    const seen = new Set<string>();
    settings.forEach((s) => {
      if (!s.businessId || seen.has(s.businessId)) return;
      seen.add(s.businessId);
      ((s.enabledModules as string[] | null) ?? []).forEach((m) => { moduleUse[m] = (moduleUse[m] ?? 0) + 1; });
    });

    const likes = feedback.find((f) => f.rating === 'LIKE')?._count ?? 0;
    const dislikes = feedback.find((f) => f.rating === 'DISLIKE')?._count ?? 0;

    return {
      businessCount: businesses.length,
      userCount: users,
      gymMembers: members,
      activeSubscriptions: byStatus.ACTIVE ?? 0,
      byStatus,
      byPlan,
      active7,
      active30,
      mrr: businesses.filter((b) => b.status === 'ACTIVE').reduce((s, b) => s + (b.monthlyFee ?? 0), 0),
      totalSales: salesAll._sum.total ?? 0,
      totalSalesCount: salesAll._count,
      last30d: {
        sales: sales30.reduce((s, x) => s + x._count, 0),
        salesTotal: sales30.reduce((s, x) => s + (x._sum.total ?? 0), 0),
        gymPayments: gym30._count,
        gymTotal: gym30._sum.amount ?? 0,
      },
      dailySales: daily.map((d) => ({ day: d.day.toISOString().slice(0, 10), sales: Number(d.sales), total: d.total })),
      newBusinesses: months,
      topBusinesses: top,
      moduleUse,
      feedback: { likes, dislikes },
      unreadSupport: unread,
    };
  }

  // ── Audit ──────────────────────────────────────────────────────────────────

  async getAudit(q: { page?: string; pageSize?: string; businessId?: string; action?: string; search?: string; from?: string; to?: string }) {
    const page = Math.max(1, Number(q.page) || 1);
    const pageSize = Math.min(100, Math.max(10, Number(q.pageSize) || 25));
    const where: any = {};
    if (q.businessId) where.businessId = q.businessId;
    if (q.action) where.action = q.action;
    if (q.from || q.to) {
      where.createdAt = {};
      if (q.from) where.createdAt.gte = new Date(`${q.from}T00:00:00`);
      if (q.to) where.createdAt.lte = new Date(`${q.to}T23:59:59.999`);
    }
    const term = q.search?.trim();
    if (term) {
      where.OR = [
        { details: { contains: term, mode: 'insensitive' } },
        { entity: { contains: term, mode: 'insensitive' } },
        { user: { name: { contains: term, mode: 'insensitive' } } },
        { user: { email: { contains: term, mode: 'insensitive' } } },
        { business: { name: { contains: term, mode: 'insensitive' } } },
      ];
    }
    const [total, items, actions] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { user: { select: { name: true, email: true, role: true } }, business: { select: { id: true, name: true } } },
      }),
      this.prisma.auditLog.groupBy({ by: ['action'], _count: true, orderBy: { action: 'asc' } }),
    ]);
    return { total, page, pageSize, items, actions: actions.map((a) => ({ action: a.action, count: a._count })) };
  }
}
