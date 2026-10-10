import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const DAY = 24 * 60 * 60 * 1000;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, days: number) => new Date(d.getTime() + days * DAY);

export type MembershipState = 'ACTIVE' | 'SCHEDULED' | 'FROZEN' | 'EXPIRED' | 'CANCELLED';

/** Real state of a membership: the stored status plus its dates. */
export function membershipState(m: { status: string; startDate: Date; endDate: Date }, now = new Date()): MembershipState {
  if (m.status === 'CANCELLED') return 'CANCELLED';
  if (m.status === 'FROZEN') return 'FROZEN';
  if (m.startDate > now) return 'SCHEDULED';
  if (m.endDate < now) return 'EXPIRED';
  return 'ACTIVE';
}

type PlanInput = { name: string; description?: string; durationDays: number; price: number; color?: string; maxFreezeDays?: number; isActive?: boolean };
type MemberInput = {
  clientId?: string;
  name?: string;
  documentId?: string;
  phone?: string;
  email?: string;
  photoUrl?: string | null;
  birthDate?: string | null;
  gender?: string | null;
  emergencyContact?: string | null;
  emergencyPhone?: string | null;
  medicalNotes?: string | null;
  goal?: string | null;
  notes?: string | null;
  accessEnabled?: boolean;
};
type PaymentInput = { amount: number; method: string; reference?: string; exchangeRate?: number; branchId?: string };
type MembershipInput = {
  planId: string;
  startDate?: string;
  discount?: number;
  notes?: string;
  payment?: PaymentInput;
};

/** Same methods as the POS, so the cash shift adds them up the same way. */
export const GYM_PAYMENT_METHODS = ['CASH', 'CARD', 'TRANSFER', 'PAGO_MOVIL', 'BINANCE', 'ZINLI', 'PAYPAL'];

@Injectable()
export class GymService {
  constructor(private prisma: PrismaService) {}

  // ── Plans ──────────────────────────────────────────────────────────────────

  listPlans(businessId: string) {
    return this.prisma.gymPlan.findMany({
      where: { businessId },
      orderBy: [{ isActive: 'desc' }, { durationDays: 'asc' }],
      include: { _count: { select: { memberships: true } } },
    });
  }

  private validatePlan(data: Partial<PlanInput>, partial = false) {
    if (!partial || data.name !== undefined) {
      if (!data.name?.trim()) throw new BadRequestException('El plan necesita un nombre');
    }
    if (!partial || data.durationDays !== undefined) {
      if (!(Number(data.durationDays) >= 1)) throw new BadRequestException('La duración debe ser de al menos 1 día');
    }
    if (!partial || data.price !== undefined) {
      if (!(Number(data.price) >= 0)) throw new BadRequestException('El precio no puede ser negativo');
    }
  }

  createPlan(businessId: string, data: PlanInput) {
    this.validatePlan(data);
    return this.prisma.gymPlan.create({
      data: {
        businessId,
        name: data.name.trim(),
        description: data.description?.trim() || null,
        durationDays: Math.round(Number(data.durationDays)),
        price: Number(data.price),
        color: data.color || null,
        maxFreezeDays: Math.max(0, Math.round(Number(data.maxFreezeDays) || 0)),
      },
    });
  }

  async updatePlan(businessId: string, id: string, data: Partial<PlanInput>) {
    await this.findPlan(businessId, id);
    this.validatePlan(data, true);
    return this.prisma.gymPlan.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name.trim() }),
        ...(data.description !== undefined && { description: data.description?.trim() || null }),
        ...(data.durationDays !== undefined && { durationDays: Math.round(Number(data.durationDays)) }),
        ...(data.price !== undefined && { price: Number(data.price) }),
        ...(data.color !== undefined && { color: data.color || null }),
        ...(data.maxFreezeDays !== undefined && { maxFreezeDays: Math.max(0, Math.round(Number(data.maxFreezeDays) || 0)) }),
        ...(data.isActive !== undefined && { isActive: !!data.isActive }),
      },
    });
  }

  private async findPlan(businessId: string, id: string) {
    const plan = await this.prisma.gymPlan.findFirst({ where: { id, businessId } });
    if (!plan) throw new NotFoundException('Plan no encontrado');
    return plan;
  }

  // ── Members ────────────────────────────────────────────────────────────────

  private memberInclude = {
    client: { select: { id: true, name: true, documentId: true, phone: true, email: true } },
    memberships: { orderBy: { endDate: 'desc' as const }, take: 3 },
  };

  /** The membership that decides access: the active one, else the scheduled or frozen, else the last one. */
  private currentMembership(memberships: any[], now = new Date()) {
    const withState = memberships.map((m) => ({ ...m, state: membershipState(m, now) }));
    return (
      withState.find((m) => m.state === 'ACTIVE') ||
      withState.find((m) => m.state === 'FROZEN') ||
      withState.find((m) => m.state === 'SCHEDULED') ||
      withState[0] ||
      null
    );
  }

  private presentMember(member: any) {
    const now = new Date();
    const current = this.currentMembership(member.memberships || [], now);
    const daysLeft = current && current.state === 'ACTIVE' ? Math.ceil((current.endDate.getTime() - now.getTime()) / DAY) : null;
    const status = !member.accessEnabled ? 'BLOCKED' : current ? current.state : 'NONE';
    return {
      id: member.id,
      memberNumber: member.memberNumber,
      photoUrl: member.photoUrl,
      accessEnabled: member.accessEnabled,
      faceSyncedAt: member.faceSyncedAt,
      createdAt: member.createdAt,
      client: member.client,
      status,
      daysLeft,
      currentMembership: current,
    };
  }

  async listMembers(businessId: string, params: { q?: string; status?: string; page?: string; pageSize?: string }) {
    const page = Math.max(1, Number(params.page) || 1);
    const pageSize = Math.min(5000, Math.max(5, Number(params.pageSize) || 25));
    const q = (params.q || '').trim();
    const where: Prisma.GymMemberWhereInput = { businessId };
    if (q) {
      const digits = q.replace(/\D/g, '');
      where.OR = [
        { client: { name: { contains: q, mode: 'insensitive' } } },
        { client: { documentId: { contains: q, mode: 'insensitive' } } },
        ...(digits.length >= 3 ? [{ client: { phone: { contains: digits.replace(/^0/, '') } } }] : []),
        ...(/^\d+$/.test(q) ? [{ memberNumber: Number(q) }] : []),
      ];
    }

    // Status is computed from dates, so it filters after loading; a gym has hundreds to a few thousand members
    const all = await this.prisma.gymMember.findMany({ where, include: this.memberInclude, orderBy: { memberNumber: 'desc' } });
    let rows = all.map((m) => this.presentMember(m));
    if (params.status === 'expiring') rows = rows.filter((r) => r.status === 'ACTIVE' && (r.daysLeft ?? 99) <= 7);
    else if (params.status) rows = rows.filter((r) => r.status === params.status);
    return {
      total: rows.length,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(rows.length / pageSize)),
      items: rows.slice((page - 1) * pageSize, page * pageSize),
    };
  }

  async getMember(businessId: string, id: string) {
    const member = await this.prisma.gymMember.findFirst({
      where: { id, businessId },
      include: {
        client: { select: { id: true, name: true, documentId: true, phone: true, email: true } },
        memberships: { orderBy: { startDate: 'desc' }, include: { payments: { orderBy: { createdAt: 'desc' } } } },
        checkIns: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
    if (!member) throw new NotFoundException('Socio no encontrado');
    const now = new Date();
    return {
      ...this.presentMember(member),
      birthDate: member.birthDate,
      gender: member.gender,
      emergencyContact: member.emergencyContact,
      emergencyPhone: member.emergencyPhone,
      medicalNotes: member.medicalNotes,
      goal: member.goal,
      notes: member.notes,
      memberships: member.memberships.map((m) => ({ ...m, state: membershipState(m, now) })),
      checkIns: member.checkIns,
    };
  }

  private memberData(data: MemberInput) {
    return {
      ...(data.photoUrl !== undefined && { photoUrl: data.photoUrl || null }),
      ...(data.birthDate !== undefined && { birthDate: data.birthDate ? new Date(data.birthDate) : null }),
      ...(data.gender !== undefined && { gender: data.gender || null }),
      ...(data.emergencyContact !== undefined && { emergencyContact: data.emergencyContact || null }),
      ...(data.emergencyPhone !== undefined && { emergencyPhone: data.emergencyPhone || null }),
      ...(data.medicalNotes !== undefined && { medicalNotes: data.medicalNotes || null }),
      ...(data.goal !== undefined && { goal: data.goal || null }),
      ...(data.notes !== undefined && { notes: data.notes || null }),
      ...(data.accessEnabled !== undefined && { accessEnabled: !!data.accessEnabled }),
    };
  }

  /** Signs up a member: an existing client of the business, or a new client created here. */
  async createMember(businessId: string, data: MemberInput) {
    return this.prisma.$transaction(async (tx) => {
      let clientId = data.clientId;
      if (clientId) {
        const client = await tx.client.findFirst({ where: { id: clientId, businessId } });
        if (!client) throw new NotFoundException('Cliente no encontrado');
      } else {
        if (!data.name?.trim()) throw new BadRequestException('Escribe el nombre del socio');
        const documentId = data.documentId?.trim() || null;
        if (documentId) {
          const existing = await tx.client.findFirst({ where: { businessId, documentId } });
          if (existing) clientId = existing.id;
        }
        if (!clientId) {
          const client = await tx.client.create({
            data: { businessId, name: data.name.trim(), documentId, phone: data.phone?.trim() || null, email: data.email?.trim() || null, creditLimit: 0 },
          });
          clientId = client.id;
        }
      }
      if (await tx.gymMember.findUnique({ where: { clientId } })) throw new BadRequestException('Este cliente ya es socio del gimnasio');

      const last = await tx.gymMember.findFirst({ where: { businessId }, orderBy: { memberNumber: 'desc' }, select: { memberNumber: true } });
      const member = await tx.gymMember.create({
        data: { businessId, clientId, memberNumber: (last?.memberNumber ?? 0) + 1, ...this.memberData(data) },
        include: this.memberInclude,
      });
      return this.presentMember(member);
    });
  }

  async updateMember(businessId: string, id: string, data: MemberInput) {
    const member = await this.prisma.gymMember.findFirst({ where: { id, businessId } });
    if (!member) throw new NotFoundException('Socio no encontrado');
    await this.prisma.$transaction([
      this.prisma.gymMember.update({ where: { id }, data: this.memberData(data) }),
      ...(data.name !== undefined || data.phone !== undefined || data.email !== undefined || data.documentId !== undefined
        ? [this.prisma.client.update({
            where: { id: member.clientId },
            data: {
              ...(data.name !== undefined && data.name.trim() && { name: data.name.trim() }),
              ...(data.phone !== undefined && { phone: data.phone?.trim() || null }),
              ...(data.email !== undefined && { email: data.email?.trim() || null }),
              ...(data.documentId !== undefined && { documentId: data.documentId?.trim() || null }),
            },
          })]
        : []),
    ]);
    return this.getMember(businessId, id);
  }

  // ── Memberships ────────────────────────────────────────────────────────────

  /**
   * Sells a plan to a member. Without a start date it starts today, or the day after their
   * current membership ends (an early renewal never loses days).
   */
  async addMembership(businessId: string, memberId: string, data: MembershipInput, userId?: string) {
    const member = await this.prisma.gymMember.findFirst({ where: { id: memberId, businessId }, include: { memberships: true } });
    if (!member) throw new NotFoundException('Socio no encontrado');
    const plan = await this.findPlan(businessId, data.planId);
    if (!plan.isActive) throw new BadRequestException('Este plan está desactivado');

    const now = new Date();
    let start: Date;
    if (data.startDate) {
      start = startOfDay(new Date(data.startDate));
      if (Number.isNaN(start.getTime())) throw new BadRequestException('Fecha de inicio inválida');
    } else {
      const latestEnd = member.memberships
        .filter((m) => m.status !== 'CANCELLED' && m.endDate > now)
        .reduce<Date | null>((max, m) => (!max || m.endDate > max ? m.endDate : max), null);
      start = latestEnd ? startOfDay(addDays(latestEnd, 1)) : startOfDay(now);
    }
    // Ends at the last second of its last day
    const end = new Date(addDays(start, plan.durationDays).getTime() - 1000);
    const discount = Math.max(0, Math.min(plan.price, Number(data.discount) || 0));
    const total = Math.round((plan.price - discount) * 100) / 100;
    const paid = data.payment ? Math.round(Number(data.payment.amount) * 100) / 100 : 0;
    if (data.payment && !(paid > 0)) throw new BadRequestException('El monto pagado debe ser mayor a cero');
    if (paid - total > 0.009) throw new BadRequestException(`El pago ($${paid.toFixed(2)}) supera el precio del plan ($${total.toFixed(2)})`);

    const memberName = (await this.prisma.client.findUnique({ where: { id: member.clientId }, select: { name: true } }))?.name ?? '';
    return this.prisma.$transaction(async (tx) => {
      const membership = await tx.gymMembership.create({
        data: {
          businessId,
          memberId,
          planId: plan.id,
          planName: plan.name,
          startDate: start,
          endDate: end,
          price: plan.price,
          discount,
          notes: data.notes?.trim() || null,
          createdById: userId || null,
        },
      });
      if (data.payment) {
        await this.recordPayment(tx, businessId, { id: membership.id, planName: plan.name, memberName }, { ...data.payment, amount: paid }, userId);
      }
      return tx.gymMembership.findUnique({ where: { id: membership.id }, include: { payments: true } });
    });
  }

  /**
   * Saves a membership payment in the cashier's open shift (so the shift close counts it)
   * and as income in accounting, like a POS sale.
   */
  private async recordPayment(
    tx: Prisma.TransactionClient,
    businessId: string,
    membership: { id: string; planName: string; memberName: string },
    payment: PaymentInput,
    userId?: string,
  ) {
    const method = String(payment.method || 'CASH').toUpperCase();
    if (!GYM_PAYMENT_METHODS.includes(method)) throw new BadRequestException('Método de pago no válido');

    const shift = userId ? await tx.shift.findFirst({ where: { userId, status: 'OPEN' as any, branch: { businessId } }, select: { id: true, branchId: true } }) : null;
    let branchId = shift?.branchId ?? null;
    if (!branchId && payment.branchId) {
      branchId = (await tx.branch.findFirst({ where: { id: payment.branchId, businessId }, select: { id: true } }))?.id ?? null;
    }
    if (!branchId) branchId = (await tx.branch.findFirst({ where: { businessId }, orderBy: { isMain: 'desc' }, select: { id: true } }))?.id ?? null;

    const entry = userId
      ? await tx.accountingEntry.create({
          data: {
            description: `Membresía ${membership.planName}${membership.memberName ? ` · ${membership.memberName}` : ''}`,
            amount: payment.amount,
            type: 'INCOME',
            category: 'MEMBRESIA_GYM',
            branchId,
            userId,
          },
        })
      : null;

    return tx.gymPayment.create({
      data: {
        businessId,
        membershipId: membership.id,
        amount: payment.amount,
        method,
        reference: payment.reference?.trim() || null,
        exchangeRate: payment.exchangeRate ? Number(payment.exchangeRate) : null,
        createdById: userId || null,
        branchId,
        shiftId: shift?.id ?? null,
        accountingEntryId: entry?.id ?? null,
      },
    });
  }

  private async findMembership(businessId: string, id: string) {
    const m = await this.prisma.gymMembership.findFirst({ where: { id, businessId }, include: { plan: true } });
    if (!m) throw new NotFoundException('Membresía no encontrada');
    return m;
  }

  async addPayment(businessId: string, membershipId: string, payment: PaymentInput, userId?: string) {
    const m = await this.prisma.gymMembership.findFirst({
      where: { id: membershipId, businessId },
      include: { payments: true, member: { include: { client: { select: { name: true } } } } },
    });
    if (!m) throw new NotFoundException('Membresía no encontrada');
    if (m.status === 'CANCELLED') throw new BadRequestException('La membresía está cancelada');
    const amount = Math.round(Number(payment.amount) * 100) / 100;
    if (!(amount > 0)) throw new BadRequestException('El monto debe ser mayor a cero');
    const balance = m.price - m.discount - m.payments.reduce((s, p) => s + p.amount, 0);
    if (amount - balance > 0.009) throw new BadRequestException(`El saldo pendiente es $${Math.max(0, balance).toFixed(2)}`);
    return this.prisma.$transaction((tx) =>
      this.recordPayment(tx, businessId, { id: m.id, planName: m.planName, memberName: m.member.client.name }, { ...payment, amount }, userId),
    );
  }


  /** Pauses an active membership; the paused days are added back when it resumes. */
  async freeze(businessId: string, id: string) {
    const m = await this.findMembership(businessId, id);
    if (membershipState(m) !== 'ACTIVE') throw new BadRequestException('Solo se puede congelar una membresía activa');
    if (m.plan.maxFreezeDays <= m.frozenDaysUsed) throw new BadRequestException('Este plan no permite más días de congelamiento');
    return this.prisma.gymMembership.update({ where: { id }, data: { status: 'FROZEN', frozenAt: new Date() } });
  }

  async unfreeze(businessId: string, id: string) {
    const m = await this.findMembership(businessId, id);
    if (m.status !== 'FROZEN' || !m.frozenAt) throw new BadRequestException('La membresía no está congelada');
    const allowed = Math.max(0, m.plan.maxFreezeDays - m.frozenDaysUsed);
    const days = Math.min(allowed, Math.max(0, Math.ceil((Date.now() - m.frozenAt.getTime()) / DAY)));
    return this.prisma.gymMembership.update({
      where: { id },
      data: { status: 'ACTIVE', frozenAt: null, frozenDaysUsed: m.frozenDaysUsed + days, endDate: addDays(m.endDate, days) },
    });
  }

  async cancel(businessId: string, id: string) {
    const m = await this.findMembership(businessId, id);
    if (m.status === 'CANCELLED') throw new BadRequestException('La membresía ya está cancelada');
    return this.prisma.gymMembership.update({ where: { id }, data: { status: 'CANCELLED', cancelledAt: new Date(), frozenAt: null } });
  }

  // ── Access (reception now, face reader later) ──────────────────────────────

  /**
   * Whether a member may enter right now and why. The single rule for the door:
   * manual check-in at reception today, the face reader later.
   */
  async evaluateAccess(businessId: string, memberId: string) {
    const member = await this.prisma.gymMember.findFirst({
      where: { id: memberId, businessId },
      include: { ...this.memberInclude, memberships: { orderBy: { endDate: 'desc' as const }, take: 5, include: { payments: true } } },
    });
    if (!member) throw new NotFoundException('Socio no encontrado');
    const row = this.presentMember(member);
    const m = row.currentMembership as any;
    const fmt = (d: Date) => d.toLocaleDateString('es-VE', { day: 'numeric', month: 'short' });

    let granted = false;
    let reason: string;
    if (!member.accessEnabled) reason = 'Acceso bloqueado por el gimnasio';
    else if (!m) reason = 'No tiene membresía';
    else if (m.state === 'ACTIVE') { granted = true; reason = row.daysLeft === 0 ? 'Su membresía vence hoy' : `Membresía activa · ${row.daysLeft} días restantes`; }
    else if (m.state === 'EXPIRED') reason = `Membresía vencida el ${fmt(m.endDate)}`;
    else if (m.state === 'FROZEN') reason = 'Membresía congelada';
    else if (m.state === 'SCHEDULED') reason = `Su membresía empieza el ${fmt(m.startDate)}`;
    else reason = 'Membresía cancelada';

    // Owed money doesn't stop entry, but reception should know
    const owed = m ? Math.max(0, Math.round((m.price - m.discount - (m.payments || []).reduce((t: number, p: any) => t + p.amount, 0)) * 100) / 100) : 0;
    const warnings: string[] = [];
    if (granted && owed > 0) warnings.push(`Debe $${owed.toFixed(2)} de su membresía`);
    if (granted && row.daysLeft !== null && row.daysLeft <= 3) warnings.push(row.daysLeft === 0 ? 'Recuérdale renovar hoy' : `Vence en ${row.daysLeft} días`);

    return { member: row, granted, reason, warnings };
  }

  /** Reception check-in: evaluates access and records the attempt. `override` lets someone in anyway, with a note. */
  async checkIn(businessId: string, data: { memberId: string; override?: boolean; note?: string; method?: string; deviceId?: string }, userId?: string) {
    const access = await this.evaluateAccess(businessId, data.memberId);
    const override = !access.granted && !!data.override;
    if (override && !data.note?.trim()) throw new BadRequestException('Escribe por qué lo dejas pasar');
    const checkIn = await this.prisma.gymCheckIn.create({
      data: {
        businessId,
        memberId: data.memberId,
        granted: access.granted || override,
        reason: override ? `Autorizado manualmente: ${data.note!.trim()} (${access.reason})` : access.reason,
        method: data.method || 'MANUAL',
        deviceId: data.deviceId || (userId ? `user:${userId}` : null),
      },
    });
    return { ...access, granted: access.granted || override, overridden: override, checkIn };
  }

  /** Entries of a day (today by default), newest first. */
  async listCheckIns(businessId: string, params: { date?: string; limit?: string }) {
    const day = params.date ? new Date(`${params.date}T00:00:00`) : new Date();
    const from = startOfDay(day);
    const to = addDays(from, 1);
    const where = { businessId, createdAt: { gte: from, lt: to } };
    const [items, granted, denied, unique] = await Promise.all([
      this.prisma.gymCheckIn.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: Math.min(200, Number(params.limit) || 100),
        include: { member: { select: { id: true, memberNumber: true, photoUrl: true, client: { select: { name: true } } } } },
      }),
      this.prisma.gymCheckIn.count({ where: { ...where, granted: true } }),
      this.prisma.gymCheckIn.count({ where: { ...where, granted: false } }),
      this.prisma.gymCheckIn.groupBy({ by: ['memberId'], where: { ...where, granted: true } }),
    ]);
    return { items, granted, denied, uniqueMembers: unique.length };
  }

  // ── Summary ────────────────────────────────────────────────────────────────

  async summary(businessId: string) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const [members, monthPayments, newMembers, todayCheckIns] = await Promise.all([
      this.prisma.gymMember.findMany({ where: { businessId }, include: this.memberInclude }),
      this.prisma.gymPayment.aggregate({ where: { businessId, createdAt: { gte: monthStart } }, _sum: { amount: true } }),
      this.prisma.gymMember.count({ where: { businessId, createdAt: { gte: monthStart } } }),
      this.prisma.gymCheckIn.count({ where: { businessId, granted: true, createdAt: { gte: startOfDay(now) } } }),
    ]);
    const rows = members.map((m) => this.presentMember(m));
    const expiring = rows.filter((r) => r.status === 'ACTIVE' && (r.daysLeft ?? 99) <= 7).sort((a, b) => (a.daysLeft ?? 0) - (b.daysLeft ?? 0));
    return {
      totalMembers: rows.length,
      active: rows.filter((r) => r.status === 'ACTIVE').length,
      frozen: rows.filter((r) => r.status === 'FROZEN').length,
      expired: rows.filter((r) => r.status === 'EXPIRED').length,
      withoutMembership: rows.filter((r) => r.status === 'NONE').length,
      newThisMonth: newMembers,
      revenueThisMonth: Math.round((monthPayments._sum.amount ?? 0) * 100) / 100,
      checkInsToday: todayCheckIns,
      expiringSoon: expiring.slice(0, 10),
    };
  }
}
