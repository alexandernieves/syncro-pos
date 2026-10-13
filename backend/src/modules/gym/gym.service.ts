import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GymRemindersService } from './gym-reminders.service';

const DAY = 24 * 60 * 60 * 1000;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, days: number) => new Date(d.getTime() + days * DAY);
/** "AAAA-MM-DD" is a calendar day here, not UTC midnight (which falls on the day before in America). */
const parseDay = (v: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(v);
};

export type MembershipState = 'ACTIVE' | 'SCHEDULED' | 'FROZEN' | 'EXPIRED' | 'CANCELLED';

/** What the member owes for a membership in total: plan price, minus discount, plus extra charges. */
export const membershipTotal = (m: { price: number; discount: number; fees?: number | null }) => Math.round((m.price - m.discount + (m.fees || 0)) * 100) / 100;
export const membershipOwed = (m: { price: number; discount: number; fees?: number | null; payments?: { amount: number }[] }) =>
  Math.max(0, Math.round((membershipTotal(m) - (m.payments || []).reduce((t, p) => t + p.amount, 0)) * 100) / 100);

export type AccessWindow = { days: number[]; start: string; end: string };
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** Parts of an instant in the gym's time zone: date, weekday (0 = Sunday) and minutes since midnight. */
export function zonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return {
    y: Number(get('year')),
    m: Number(get('month')),
    d: Number(get('day')),
    dow: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday')),
    minutes: Number(get('hour')) * 60 + Number(get('minute')),
  };
}
/** Midnight of a local date in the gym's time zone, as an instant. */
export function zonedMidnight(y: number, m: number, d: number, timeZone: string) {
  const guess = new Date(Date.UTC(y, m - 1, d));
  const p = zonedParts(guess, timeZone);
  const shown = Date.UTC(p.y, p.m - 1, p.d, Math.floor(p.minutes / 60), p.minutes % 60);
  return new Date(guess.getTime() - (shown - guess.getTime()));
}

/** Real state of a membership: the stored status plus its dates. */
export function membershipState(m: { status: string; startDate: Date; endDate: Date }, now = new Date()): MembershipState {
  if (m.status === 'CANCELLED') return 'CANCELLED';
  if (m.status === 'FROZEN') return 'FROZEN';
  if (m.startDate > now) return 'SCHEDULED';
  if (m.endDate < now) return 'EXPIRED';
  return 'ACTIVE';
}

type PlanInput = {
  name: string;
  description?: string;
  durationDays: number;
  price: number;
  color?: string;
  maxFreezeDays?: number;
  guestPassesPerMonth?: number;
  accessWindows?: AccessWindow[] | null;
  maxEntriesPerDay?: number;
  maxEntriesPerWeek?: number;
  totalEntries?: number;
  includesClasses?: boolean;
  allowedClassIds?: string[];
  isActive?: boolean;
};
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
  constructor(
    private prisma: PrismaService,
    private settings: GymRemindersService,
  ) {}

  // ── Plans ──────────────────────────────────────────────────────────────────

  /** Plans with how they sell: members on each plan right now and what was charged in the last 30 days. */
  async listPlans(businessId: string) {
    const now = new Date();
    const since = new Date(now.getTime() - 30 * DAY);
    const [plans, active, revenue] = await Promise.all([
      this.prisma.gymPlan.findMany({ where: { businessId }, orderBy: [{ isActive: 'desc' }, { durationDays: 'asc' }], include: { _count: { select: { memberships: true } } } }),
      this.prisma.gymMembership.groupBy({ by: ['planId'], where: { businessId, status: { in: ['ACTIVE', 'FROZEN'] }, startDate: { lte: now }, endDate: { gte: now } }, _count: { _all: true } }),
      this.prisma.gymPayment.findMany({ where: { businessId, createdAt: { gte: since }, membershipId: { not: null } }, select: { amount: true, membership: { select: { planId: true } } } }),
    ]);
    return plans.map((p) => ({
      ...p,
      activeMembers: active.find((a) => a.planId === p.id)?._count._all ?? 0,
      revenue30d: Math.round(revenue.filter((r) => r.membership?.planId === p.id).reduce((t, r) => t + r.amount, 0) * 100) / 100,
    }));
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
    for (const w of data.accessWindows || []) {
      if (!Array.isArray(w.days) || !w.days.length || w.days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) throw new BadRequestException('Cada horario de acceso necesita al menos un día');
      if (!TIME_RE.test(w.start) || !TIME_RE.test(w.end) || w.end <= w.start) throw new BadRequestException('Revisa las horas del horario de acceso');
    }
  }

  /** Access rules of a plan, cleaned for saving. */
  private planRules(data: Partial<PlanInput>) {
    const int = (v: any) => Math.max(0, Math.round(Number(v) || 0));
    return {
      ...(data.accessWindows !== undefined && {
        accessWindows: data.accessWindows?.length ? data.accessWindows.map((w) => ({ days: [...new Set(w.days)].sort(), start: w.start, end: w.end })) : Prisma.DbNull,
      }),
      ...(data.maxEntriesPerDay !== undefined && { maxEntriesPerDay: int(data.maxEntriesPerDay) }),
      ...(data.maxEntriesPerWeek !== undefined && { maxEntriesPerWeek: int(data.maxEntriesPerWeek) }),
      ...(data.totalEntries !== undefined && { totalEntries: int(data.totalEntries) }),
      ...(data.includesClasses !== undefined && { includesClasses: !!data.includesClasses }),
      ...(data.allowedClassIds !== undefined && { allowedClassIds: (data.allowedClassIds || []).filter((x) => typeof x === 'string') }),
    };
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
        guestPassesPerMonth: Math.max(0, Math.round(Number(data.guestPassesPerMonth) || 0)),
        ...this.planRules(data),
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
        ...(data.guestPassesPerMonth !== undefined && { guestPassesPerMonth: Math.max(0, Math.round(Number(data.guestPassesPerMonth) || 0)) }),
        ...this.planRules(data),
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
      faceError: member.faceError,
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
        client: { select: { id: true, name: true, documentId: true, phone: true, email: true, password: true } },
        memberships: { orderBy: { startDate: 'desc' }, include: { payments: { orderBy: { createdAt: 'desc' } } } },
        checkIns: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
    if (!member) throw new NotFoundException('Socio no encontrado');
    const now = new Date();
    const { password, ...client } = member.client;
    return {
      ...this.presentMember({ ...member, client }),
      // Whether the member already created their password for the app (never the hash itself)
      hasAppAccess: !!password,
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
      // A new photo has to be loaded into the face reader again
      ...(data.photoUrl !== undefined && { photoUrl: data.photoUrl || null, faceSyncedAt: null, faceError: null }),
      ...(data.birthDate !== undefined && { birthDate: data.birthDate ? parseDay(data.birthDate) : null }),
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
   * What selling a plan to a member would look like right now, following the renewal policy:
   * when it starts, the early-renewal discount and the enrollment or reactivation fee.
   */
  async quoteMembership(businessId: string, memberId: string, planId: string, startDate?: string) {
    const member = await this.prisma.gymMember.findFirst({ where: { id: memberId, businessId }, include: { memberships: true } });
    if (!member) throw new NotFoundException('Socio no encontrado');
    const plan = await this.findPlan(businessId, planId);
    const { renewal } = await this.settings.getSettings(businessId);
    const now = new Date();
    const notes: string[] = [];
    const valid = member.memberships.filter((m) => m.status !== 'CANCELLED');
    const latestEnd = valid.reduce<Date | null>((max, m) => (!max || m.endDate > max ? m.endDate : max), null);

    let start: Date;
    if (startDate) {
      start = startOfDay(parseDay(startDate));
      if (Number.isNaN(start.getTime())) throw new BadRequestException('Fecha de inicio inválida');
    } else if (latestEnd && latestEnd > now) {
      // Early renewal never loses days: it starts when the current one ends
      start = startOfDay(addDays(latestEnd, 1));
      notes.push('Empieza cuando termina su membresía actual');
    } else if (latestEnd) {
      const expiredDays = Math.floor((now.getTime() - latestEnd.getTime()) / DAY);
      const keep = renewal.startFrom === 'END' || (renewal.startFrom === 'END_IF_GRACE' && expiredDays <= renewal.graceDays);
      start = keep ? startOfDay(addDays(latestEnd, 1)) : startOfDay(now);
      if (keep && expiredDays > 0) notes.push(`Continúa desde su vencimiento (hace ${expiredDays} ${expiredDays === 1 ? 'día' : 'días'})`);
    } else {
      start = startOfDay(now);
    }
    // Ends at the last second of its last day
    const end = new Date(addDays(start, plan.durationDays).getTime() - 1000);

    let autoDiscount = 0;
    if (renewal.earlyDays > 0 && renewal.earlyDiscountPct > 0 && latestEnd && latestEnd.getTime() - now.getTime() >= renewal.earlyDays * DAY) {
      autoDiscount = Math.round(plan.price * renewal.earlyDiscountPct) / 100;
      notes.push(`Descuento de ${renewal.earlyDiscountPct}% por renovar con anticipación`);
    }
    const feeItems: { label: string; amount: number }[] = [];
    if (!valid.length && renewal.enrollmentFee > 0) feeItems.push({ label: 'Inscripción', amount: renewal.enrollmentFee });
    if (latestEnd && latestEnd < now && renewal.reactivationFee > 0 && now.getTime() - latestEnd.getTime() > renewal.reactivationAfterDays * DAY) {
      feeItems.push({ label: 'Reinscripción', amount: renewal.reactivationFee });
    }
    const fees = Math.round(feeItems.reduce((t, f) => t + f.amount, 0) * 100) / 100;
    return { plan, start, end, price: plan.price, autoDiscount, feeItems, fees, total: Math.round((plan.price - autoDiscount + fees) * 100) / 100, notes };
  }

  /**
   * Sells a plan to a member. The start date, discount and fees follow the renewal policy
   * (see quoteMembership); a manual discount is added on top.
   */
  async addMembership(businessId: string, memberId: string, data: MembershipInput, userId?: string) {
    const quote = await this.quoteMembership(businessId, memberId, data.planId, data.startDate);
    const plan = quote.plan;
    if (!plan.isActive) throw new BadRequestException('Este plan está desactivado');
    const member = await this.prisma.gymMember.findFirst({ where: { id: memberId, businessId }, select: { clientId: true } });
    const discount = Math.max(0, Math.min(plan.price, quote.autoDiscount + (Number(data.discount) || 0)));
    const total = Math.round((plan.price - discount + quote.fees) * 100) / 100;
    const paid = data.payment ? Math.round(Number(data.payment.amount) * 100) / 100 : 0;
    if (data.payment && !(paid > 0)) throw new BadRequestException('El monto pagado debe ser mayor a cero');
    if (paid - total > 0.009) throw new BadRequestException(`El pago ($${paid.toFixed(2)}) supera el total ($${total.toFixed(2)})`);

    const memberName = member ? (await this.prisma.client.findUnique({ where: { id: member.clientId }, select: { name: true } }))?.name ?? '' : '';
    return this.prisma.$transaction(async (tx) => {
      const membership = await tx.gymMembership.create({
        data: {
          businessId,
          memberId,
          planId: plan.id,
          planName: plan.name,
          startDate: quote.start,
          endDate: quote.end,
          price: plan.price,
          discount,
          fees: quote.fees,
          feeItems: quote.feeItems.length ? quote.feeItems : Prisma.DbNull,
          notes: data.notes?.trim() || null,
          createdById: userId || null,
        },
      });
      if (data.payment) {
        const extra = quote.feeItems.length ? ` + ${quote.feeItems.map((f) => f.label.toLowerCase()).join(' y ')}` : '';
        await this.recordPayment(tx, businessId, { membershipId: membership.id, clientId: member?.clientId, itemName: `Membresía ${plan.name}${extra}`, description: `Membresía ${plan.name}${extra}${memberName ? ` · ${memberName}` : ''}` }, { ...data.payment, amount: paid }, userId);
      }
      return tx.gymMembership.findUnique({ where: { id: membership.id }, include: { payments: true } });
    });
  }

  /**
   * Saves a membership payment in the cashier's open shift (so the shift close counts it)
   * and as income in accounting, like a POS sale.
   */
  async recordPayment(
    tx: Prisma.TransactionClient,
    businessId: string,
    target: { membershipId?: string; visitId?: string; description: string; category?: string; clientId?: string | null; itemName?: string },
    payment: PaymentInput,
    userId?: string,
  ) {
    const method = String(payment.method || 'CASH').toUpperCase();
    if (!GYM_PAYMENT_METHODS.includes(method)) throw new BadRequestException('Método de pago no válido');

    const shift = userId ? await tx.shift.findFirst({ where: { userId, status: 'OPEN' as any, branch: { businessId } }, select: { id: true, branchId: true } }) : null;
    // Every charge belongs to a cash shift; without one it would never be counted at the close
    if (userId && !shift && Number(payment.amount) > 0) throw new BadRequestException({ code: 'SHIFT_CLOSED', message: 'Abre la caja para poder cobrar' });
    let branchId = shift?.branchId ?? null;
    if (!branchId && payment.branchId) {
      branchId = (await tx.branch.findFirst({ where: { id: payment.branchId, businessId }, select: { id: true } }))?.id ?? null;
    }
    if (!branchId) branchId = (await tx.branch.findFirst({ where: { businessId }, orderBy: { isMain: 'desc' }, select: { id: true } }))?.id ?? null;

    // The charge is a sale like any other: it shows in sales of the day, history, reports and the shift
    const sale = userId && branchId
      ? await tx.sale.create({
          data: {
            branchId,
            userId,
            businessId,
            clientId: target.clientId ?? null,
            paymentMethod: method as any,
            subtotal: payment.amount,
            total: payment.amount,
            channel: 'GYM',
            shiftId: shift?.id ?? null,
            items: { create: [{ description: target.itemName || target.description, quantity: 1, price: payment.amount, subtotal: payment.amount }] },
            payments: { create: [{ method: method as any, amount: payment.amount, reference: payment.reference?.trim() || null, exchangeRate: payment.exchangeRate ? Number(payment.exchangeRate) : null }] },
          },
        })
      : null;

    const entry = userId
      ? await tx.accountingEntry.create({
          data: {
            description: target.description,
            amount: payment.amount,
            type: 'INCOME',
            category: target.category || 'MEMBRESIA_GYM',
            branchId,
            userId,
            ...(sale && { saleId: sale.id }),
          },
        })
      : null;

    return tx.gymPayment.create({
      data: {
        businessId,
        membershipId: target.membershipId ?? null,
        visitId: target.visitId ?? null,
        amount: payment.amount,
        method,
        reference: payment.reference?.trim() || null,
        exchangeRate: payment.exchangeRate ? Number(payment.exchangeRate) : null,
        createdById: userId || null,
        branchId,
        shiftId: shift?.id ?? null,
        accountingEntryId: entry?.id ?? null,
        saleId: sale?.id ?? null,
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
    const balance = membershipTotal(m) - m.payments.reduce((s, p) => s + p.amount, 0);
    if (amount - balance > 0.009) throw new BadRequestException(`El saldo pendiente es $${Math.max(0, balance).toFixed(2)}`);
    return this.prisma.$transaction((tx) =>
      this.recordPayment(tx, businessId, { membershipId: m.id, clientId: m.member.clientId, itemName: `Abono membresía ${m.planName}`, description: `Membresía ${m.planName} · ${m.member.client.name}` }, { ...payment, amount }, userId),
    );
  }


  /**
   * Pauses a membership; the paused days are added back when it resumes. It can start today or on a
   * later date and end on its own (`until`), following the freeze policy (minimum days, times, fee).
   */
  async freeze(businessId: string, id: string, data: { from?: string; until?: string; reason?: string; payment?: PaymentInput } = {}, userId?: string) {
    const m = await this.findMembership(businessId, id);
    const state = membershipState(m);
    if (state !== 'ACTIVE' && state !== 'SCHEDULED') throw new BadRequestException('Solo se puede congelar una membresía activa');
    if (m.freezeFrom && !m.frozenAt) throw new BadRequestException('Ya tiene un congelamiento programado');
    const { freeze: policy } = await this.settings.getSettings(businessId);
    const left = m.plan.maxFreezeDays - m.frozenDaysUsed;
    if (left <= 0) throw new BadRequestException(m.plan.maxFreezeDays ? 'Ya usó todos los días de congelamiento de su plan' : 'Este plan no permite congelar');
    if (policy.maxTimes > 0 && m.freezeCount >= policy.maxTimes) throw new BadRequestException(`Solo se puede congelar ${policy.maxTimes} ${policy.maxTimes === 1 ? 'vez' : 'veces'} por membresía`);
    if (policy.requireReason && !data.reason?.trim()) throw new BadRequestException('Escribe el motivo del congelamiento');

    const now = new Date();
    const from = data.from ? startOfDay(parseDay(data.from)) : now;
    if (Number.isNaN(from.getTime())) throw new BadRequestException('Fecha de inicio inválida');
    if (from < startOfDay(now)) throw new BadRequestException('El congelamiento no puede empezar en el pasado');
    if (from > m.endDate) throw new BadRequestException('Esa fecha es después del vencimiento');
    let until: Date | null = null;
    if (data.until) {
      until = startOfDay(parseDay(data.until));
      if (Number.isNaN(until.getTime()) || until <= from) throw new BadRequestException('La fecha de regreso debe ser después del inicio');
      const days = Math.round((until.getTime() - startOfDay(from).getTime()) / DAY);
      if (days < policy.minDays) throw new BadRequestException(`El congelamiento mínimo es de ${policy.minDays} días`);
      if (days > left) throw new BadRequestException(`Le quedan ${left} días de congelamiento en su plan`);
    }

    const fee = policy.fee;
    if (data.payment && fee <= 0) throw new BadRequestException('Congelar no tiene costo');
    const startsNow = from <= now;
    return this.prisma.$transaction(async (tx) => {
      const items = Array.isArray(m.feeItems) ? (m.feeItems as any[]) : [];
      const updated = await tx.gymMembership.update({
        where: { id },
        data: {
          status: startsNow ? 'FROZEN' : m.status,
          frozenAt: startsNow ? now : null,
          freezeFrom: startsNow ? null : from,
          freezeUntil: until,
          freezeReason: data.reason?.trim() || null,
          freezeCount: m.freezeCount + 1,
          ...(fee > 0 && { fees: Math.round(((m.fees || 0) + fee) * 100) / 100, feeItems: [...items, { label: 'Congelamiento', amount: fee }] }),
        },
      });
      if (fee > 0 && data.payment) {
        const member = await tx.gymMember.findUnique({ where: { id: m.memberId }, include: { client: { select: { name: true } } } });
        await this.recordPayment(tx, businessId, { membershipId: id, clientId: member?.clientId, itemName: `Congelamiento ${m.planName}`, description: `Congelamiento ${m.planName} · ${member?.client.name ?? ''}` }, { ...data.payment, amount: fee }, userId);
      }
      return updated;
    });
  }

  /** Resumes a frozen membership (or drops a scheduled freeze) and adds back the paused days. */
  async unfreeze(businessId: string, id: string) {
    const m = await this.findMembership(businessId, id);
    if (m.freezeFrom && !m.frozenAt && m.status !== 'FROZEN') {
      return this.prisma.gymMembership.update({ where: { id }, data: { freezeFrom: null, freezeUntil: null, freezeReason: null, freezeCount: Math.max(0, m.freezeCount - 1) } });
    }
    if (m.status !== 'FROZEN' || !m.frozenAt) throw new BadRequestException('La membresía no está congelada');
    return this.prisma.gymMembership.update({ where: { id }, data: this.resumeData(m, new Date()) });
  }

  /** Fields to resume a frozen membership at `at`: days paused (within the plan's limit) go to the end date. */
  resumeData(m: { frozenAt: Date | null; frozenDaysUsed: number; endDate: Date; plan: { maxFreezeDays: number } }, at: Date) {
    const allowed = Math.max(0, m.plan.maxFreezeDays - m.frozenDaysUsed);
    const days = Math.min(allowed, Math.max(0, Math.round((at.getTime() - (m.frozenAt ?? at).getTime()) / DAY)));
    return { status: 'ACTIVE', frozenAt: null, freezeFrom: null, freezeUntil: null, frozenDaysUsed: m.frozenDaysUsed + days, endDate: addDays(m.endDate, days) };
  }

  /** Starts the freezes scheduled for today and ends the ones whose return date arrived. Runs from a cron. */
  async runScheduledFreezes(now = new Date()) {
    const starting = await this.prisma.gymMembership.findMany({ where: { status: 'ACTIVE', freezeFrom: { lte: now }, frozenAt: null } });
    for (const m of starting) {
      await this.prisma.gymMembership.update({ where: { id: m.id }, data: { status: 'FROZEN', frozenAt: m.freezeFrom, freezeFrom: null } });
    }
    const ending = await this.prisma.gymMembership.findMany({ where: { status: 'FROZEN', freezeUntil: { lte: now } }, include: { plan: true } });
    for (const m of ending) {
      await this.prisma.gymMembership.update({ where: { id: m.id }, data: this.resumeData(m, m.freezeUntil!) });
    }
    return { started: starting.length, ended: ending.length };
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
  async evaluateAccess(businessId: string, memberId: string, now = new Date()) {
    const member = await this.prisma.gymMember.findFirst({
      where: { id: memberId, businessId },
      include: { ...this.memberInclude, memberships: { orderBy: { endDate: 'desc' as const }, take: 5, include: { payments: true, plan: true } } },
    });
    if (!member) throw new NotFoundException('Socio no encontrado');
    const settings = await this.settings.getSettings(businessId);
    const tz = settings.timeZone;
    const row = this.presentMember(member);
    const m = row.currentMembership as any;
    const fmt = (d: Date) => d.toLocaleDateString('es-VE', { day: 'numeric', month: 'short', timeZone: tz });
    const hm = (t: string) => { const [h, mi] = t.split(':').map(Number); return `${h % 12 || 12}:${String(mi).padStart(2, '0')} ${h < 12 ? 'a. m.' : 'p. m.'}`; };
    const warnings: string[] = [];

    let granted = false;
    let reason: string;
    if (!member.accessEnabled) reason = 'Acceso bloqueado por el gimnasio';
    else if (!m) reason = 'No tiene membresía';
    else if (m.state === 'ACTIVE') { granted = true; reason = row.daysLeft === 0 ? 'Su membresía vence hoy' : `Membresía activa · ${row.daysLeft} días restantes`; }
    else if (m.state === 'EXPIRED') {
      const ago = Math.floor((now.getTime() - new Date(m.endDate).getTime()) / DAY);
      if (ago < settings.access.graceDays) {
        granted = true;
        reason = `Período de gracia: venció el ${fmt(m.endDate)}`;
        warnings.push(`Le quedan ${settings.access.graceDays - ago} ${settings.access.graceDays - ago === 1 ? 'día' : 'días'} de gracia: que renueve hoy`);
      } else reason = `Membresía vencida el ${fmt(m.endDate)}`;
    }
    else if (m.state === 'FROZEN') reason = m.freezeUntil ? `Membresía congelada hasta el ${fmt(m.freezeUntil)}` : 'Membresía congelada';
    else if (m.state === 'SCHEDULED') reason = `Su membresía empieza el ${fmt(m.startDate)}`;
    else reason = 'Membresía cancelada';

    // Plan rules: hours, entries per day and week, packs of visits
    const plan = m?.plan;
    if (granted && plan) {
      const local = zonedParts(now, tz);
      const windows = (Array.isArray(plan.accessWindows) ? plan.accessWindows : []) as AccessWindow[];
      if (windows.length) {
        const ok = windows.some((w) => w.days.includes(local.dow) && local.minutes >= toMin(w.start) && local.minutes < toMin(w.end));
        if (!ok) {
          granted = false;
          const today = windows.filter((w) => w.days.includes(local.dow));
          reason = today.length ? `Su plan ${plan.name} entra de ${today.map((w) => `${hm(w.start)} a ${hm(w.end)}`).join(' y ')}` : `Su plan ${plan.name} no incluye este día`;
        }
      }
      const dayStart = zonedMidnight(local.y, local.m, local.d, tz);
      const weekStart = new Date(dayStart.getTime() - ((local.dow + 6) % 7) * DAY);
      const counts = await Promise.all([
        plan.maxEntriesPerDay ? this.prisma.gymCheckIn.count({ where: { memberId, granted: true, createdAt: { gte: dayStart } } }) : Promise.resolve(0),
        plan.maxEntriesPerWeek ? this.prisma.gymCheckIn.count({ where: { memberId, granted: true, createdAt: { gte: weekStart } } }) : Promise.resolve(0),
        plan.totalEntries ? this.prisma.gymCheckIn.count({ where: { memberId, granted: true, createdAt: { gte: new Date(m.startDate), lte: new Date(m.endDate) } } }) : Promise.resolve(0),
      ]);
      if (granted && plan.maxEntriesPerDay && counts[0] >= plan.maxEntriesPerDay) { granted = false; reason = `Ya usó ${plan.maxEntriesPerDay === 1 ? 'su entrada de hoy' : `sus ${plan.maxEntriesPerDay} entradas de hoy`}`; }
      if (granted && plan.maxEntriesPerWeek && counts[1] >= plan.maxEntriesPerWeek) { granted = false; reason = `Ya usó sus ${plan.maxEntriesPerWeek} entradas de esta semana`; }
      if (granted && plan.totalEntries) {
        const left = plan.totalEntries - counts[2];
        if (left <= 0) { granted = false; reason = `Ya usó las ${plan.totalEntries} entradas de su plan`; }
        else if (left <= 3) warnings.push(left === 1 ? 'Esta es su última entrada del paquete' : `Le quedan ${left - 1} entradas después de hoy`);
      }
    }

    // Someone already came in with this membership a moment ago
    if (granted && settings.access.reentryMinutes > 0) {
      const last = await this.prisma.gymCheckIn.findFirst({ where: { memberId, granted: true, createdAt: { gte: new Date(now.getTime() - settings.access.reentryMinutes * 60000) } }, orderBy: { createdAt: 'desc' } });
      if (last) {
        const mins = Math.max(1, Math.round((now.getTime() - last.createdAt.getTime()) / 60000));
        granted = false;
        reason = `Ya entró hace ${mins} min. Si salió y volvió, autoriza el pase`;
      }
    }

    // Owed money: a warning, or a block when the gym asks for it
    const owed = m ? membershipOwed(m) : 0;
    if (owed > 0) {
      if (granted && settings.access.blockIfOwed && owed > settings.access.owedTolerance) { granted = false; reason = `Debe $${owed.toFixed(2)} de su membresía`; }
      else if (granted) warnings.push(`Debe $${owed.toFixed(2)} de su membresía`);
    }

    // Documents the member hasn't signed yet
    const pending = await this.pendingDocuments(businessId, memberId);
    if (pending.length) {
      const names = pending.map((d) => d.title).join(', ');
      if (granted && settings.access.requireSignatures) { granted = false; reason = `Falta firmar: ${names}`; }
      else if (granted) warnings.push(`Falta firmar: ${names}`);
    }

    if (granted && row.daysLeft !== null && row.daysLeft <= 3) warnings.push(row.daysLeft === 0 ? 'Recuérdale renovar hoy' : `Vence en ${row.daysLeft} días`);
    return { member: row, granted, reason, warnings, owed, pendingDocuments: pending };
  }

  /** Required documents the member hasn't signed in their current version. */
  async pendingDocuments(businessId: string, memberId: string) {
    const templates = await this.prisma.gymDocumentTemplate.findMany({
      where: { businessId, isActive: true, required: true },
      include: { signatures: { where: { memberId }, orderBy: { version: 'desc' }, take: 1, select: { version: true } } },
    });
    return templates
      .filter((t) => !t.signatures.length || t.signatures[0].version < t.version)
      .map((t) => ({ id: t.id, title: t.title, version: t.version, signedVersion: t.signatures[0]?.version ?? null }));
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
