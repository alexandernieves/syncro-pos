import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { assertModule, usableModules } from '../business-modules/module-access';
import { documentIdVariants } from '../auth/document-id';
import { cleanCaps, cleanLevelLimits, DEFAULT_CAPS, LEVEL_AT, LEVEL_NAMES, LEVELS, Level, levelFromPaid, PlatformCaps } from './lending-rules';

const round2 = (n: number) => Math.round(n * 100) / 100;
const PIN_HOURS = 24;
const OPEN = ['REQUESTED', 'APPROVED_PENDING_DISBURSEMENT'];
const RUNNING = ['PENDING', 'OVERDUE'];
export const CAPS_KEY = 'lendingCaps';

/** What the market knows about one person (only theirs: their own clients across businesses) */
type Person = {
  ids: string[];
  level: Level;
  paidOnTime: number;
  owed: number;
  owedAt: Map<string, number>;
  active: number;
  late: boolean;
  caps: PlatformCaps;
  globalRoom: number;
  block: 'late' | 'count' | 'global' | null;
};

/**
 * Cash loans (module "loans"), a P2P market inside Syncro Credit.
 *
 * Lender: publishes offers (amount range, interest for the whole loan, installments, frequency,
 * minimum level), sets how much it lends by level, answers the requests (approve → a 6-digit PIN
 * for the client; reject) and the cashier hands the cash over at the POS with that PIN: it leaves
 * the drawer as a cash movement (not a sale), the installments start and the client's debt grows.
 *
 * Client (Syncro Credit app): sees every lender's offers with what they can take there, requests,
 * and collects with the PIN. The rules are in lending-rules.ts. Golden rule: a lender only sees
 * what the person shares with it (name, cédula, phone, level, reputation, how many loans they have
 * running on the platform), never with whom or how much.
 */
@Injectable()
export class LendingService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Shared ────────────────────────────────────────────────────────────────
  private plan(amount: number, offer: { interestPct: number; installments: number }) {
    const total = round2(amount * (1 + offer.interestPct / 100));
    const n = Math.max(1, offer.installments);
    const each = round2(total / n);
    return { total, interest: round2(total - amount), each, n };
  }

  private cleanOffer(body: any) {
    const minAmount = round2(Number(body?.minAmount));
    const maxAmount = round2(Number(body?.maxAmount));
    const interestPct = round2(Number(body?.interestPct));
    const installments = Math.round(Number(body?.installments) || 1);
    const frequencyDays = Math.round(Number(body?.frequencyDays) || 7);
    const minLevel = Math.round(Number(body?.minLevel) || 4);
    const name = String(body?.name || '').trim().slice(0, 40);
    if (!name) throw new BadRequestException('Ponle un nombre a la oferta');
    if (!(minAmount > 0) || !(maxAmount >= minAmount)) throw new BadRequestException('Revisa el monto mínimo y máximo');
    if (maxAmount > 100000) throw new BadRequestException('El monto máximo es demasiado alto');
    if (!(interestPct >= 0 && interestPct <= 100)) throw new BadRequestException('El interés debe estar entre 0% y 100%');
    if (installments < 1 || installments > 52) throw new BadRequestException('Entre 1 y 52 cuotas');
    if (frequencyDays < 1 || frequencyDays > 90) throw new BadRequestException('La frecuencia debe estar entre 1 y 90 días');
    if (minLevel < 1 || minLevel > 4) throw new BadRequestException('Nivel no válido');
    return { name, minAmount, maxAmount, interestPct, installments, frequencyDays, minLevel, active: body?.active === undefined ? true : !!body.active };
  }

  // ── Rules: platform caps, lender tables, the person ───────────────────────
  async caps(): Promise<PlatformCaps> {
    const row = await this.prisma.platformSetting.findUnique({ where: { key: CAPS_KEY } });
    return row ? cleanCaps(row.value) : cleanCaps(DEFAULT_CAPS);
  }

  async saveCaps(raw: any) {
    const value = cleanCaps(raw);
    await this.prisma.platformSetting.upsert({ where: { key: CAPS_KEY }, create: { key: CAPS_KEY, value: value as any }, update: { value: value as any } });
    return value;
  }

  private async tablesOf(businessIds: string[]) {
    const rows = businessIds.length
      ? await this.prisma.setting.findMany({ where: { businessId: { in: businessIds } }, select: { businessId: true, loanLevelLimits: true } })
      : [];
    const out = new Map(rows.map((r) => [r.businessId!, cleanLevelLimits(r.loanLevelLimits)]));
    for (const b of businessIds) if (!out.has(b)) out.set(b, cleanLevelLimits(null));
    return out;
  }

  private async paidOnTime(ids: string[]) {
    if (!ids.length) return 0;
    const paid = await this.prisma.loanInstallment.findMany({
      where: { status: 'PAID', paidAt: { not: null }, loan: { clientId: { in: ids } } },
      select: { amount: true, paidAmount: true, paidAt: true, dueDate: true, lateCharges: true },
    });
    const endOfDay = (d: Date) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x.getTime(); };
    return paid.filter((i) => i.paidAt && i.paidAt.getTime() <= endOfDay(i.dueDate)).reduce((s, i) => s + (i.paidAmount || i.amount || 0), 0);
  }

  private async levelOfIds(ids: string[]) {
    return levelFromPaid(await this.paidOnTime(ids));
  }

  /** The person's rows: from the app session, or (lender side) from one of their client rows */
  private async personIds(user: any) {
    if (user?.cu) return (await this.prisma.client.findMany({ where: { creditUserId: user.cu }, select: { id: true } })).map((c) => c.id);
    return user?.id ? [user.id] : [];
  }

  private async idsOfClient(client: { id: string; creditUserId: string | null }) {
    if (!client.creditUserId) return [client.id];
    return (await this.prisma.client.findMany({ where: { creditUserId: client.creditUserId }, select: { id: true } })).map((c) => c.id);
  }

  /** Everything the rules need about a person. `exceptLoan` leaves one request out (when approving it). */
  private async person(ids: string[], exceptLoan?: string): Promise<Person> {
    const [paidOnTime, caps] = await Promise.all([this.paidOnTime(ids), this.caps()]);
    const level = levelFromPaid(paidOnTime);
    const loans = ids.length
      ? await this.prisma.loan.findMany({
          where: { clientId: { in: ids }, kind: 'CASH', status: { in: [...OPEN, ...RUNNING] as any }, ...(exceptLoan ? { id: { not: exceptLoan } } : {}) },
          select: { businessId: true, status: true, amount: true, remainingBalance: true },
        })
      : [];
    const owedAt = new Map<string, number>();
    let owed = 0;
    for (const l of loans) {
      // an open request reserves its amount, so nobody can ask everywhere at once
      const v = OPEN.includes(l.status) ? l.amount : l.remainingBalance;
      owed += v;
      if (l.businessId) owedAt.set(l.businessId, round2((owedAt.get(l.businessId) ?? 0) + v));
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const late = ids.length
      ? (await this.prisma.loanInstallment.count({ where: { status: 'PENDING', dueDate: { lt: today }, loan: { clientId: { in: ids }, status: { in: RUNNING as any } } } })) > 0
      : false;
    const cap = caps.levels[level];
    const globalRoom = round2(Math.max(0, cap.maxDebt - owed));
    const block = caps.blockIfLate && late ? 'late' : loans.length >= cap.maxActive ? 'count' : globalRoom <= 0.004 ? 'global' : null;
    return { ids, level, paidOnTime: round2(paidOnTime), owed: round2(owed), owedAt, active: loans.length, late, caps, globalRoom, block };
  }

  /** How much this person can borrow from one lender right now (before any offer's range) */
  private roomAt(p: Person, businessId: string, table: Record<number, number>, ownLimit: number | null | undefined) {
    const limit = ownLimit ?? table[p.level];
    return round2(Math.max(0, Math.min(limit - (p.owedAt.get(businessId) ?? 0), p.globalRoom)));
  }

  private blockText(p: Person) {
    if (p.block === 'late') return 'Tienes cuotas atrasadas. Ponte al día para volver a pedir préstamos.';
    if (p.block === 'count') return `Ya tienes ${p.active} préstamo${p.active > 1 ? 's' : ''} o solicitud${p.active > 1 ? 'es' : ''} abiertos, el máximo de tu nivel. Termina de pagar uno para pedir otro.`;
    if (p.block === 'global') return `Ya usaste todo tu cupo de nivel ${LEVEL_NAMES[p.level]} ($${p.caps.levels[p.level].maxDebt}). Paga para liberar cupo o sube de nivel.`;
    return null;
  }

  // ── Reputation (stars both ways) ──────────────────────────────────────────
  async lenderStats(businessIds: string[]) {
    const out = new Map<string, { stars: number; reviews: number; positive: number; delivered: number; responseMins: number | null }>();
    if (!businessIds.length) return out;
    const [rev, delivered, decided] = await Promise.all([
      this.prisma.loanReview.groupBy({ by: ['businessId'], where: { businessId: { in: businessIds }, fromClient: true }, _avg: { stars: true }, _count: { _all: true } }),
      this.prisma.loan.groupBy({ by: ['businessId'], where: { businessId: { in: businessIds }, kind: 'CASH', disbursedAt: { not: null } }, _count: { _all: true } }),
      this.prisma.loan.findMany({
        where: { businessId: { in: businessIds }, kind: 'CASH', decidedAt: { not: null } },
        select: { businessId: true, createdAt: true, decidedAt: true },
        orderBy: { decidedAt: 'desc' },
        take: 500,
      }),
    ]);
    const pos = await this.prisma.loanReview.groupBy({ by: ['businessId'], where: { businessId: { in: businessIds }, fromClient: true, stars: { gte: 4 } }, _count: { _all: true } });
    const posOf = new Map(pos.map((x) => [x.businessId, x._count._all]));
    const revOf = new Map(rev.map((x) => [x.businessId, x]));
    const delOf = new Map(delivered.map((x) => [x.businessId!, x._count._all]));
    const times = new Map<string, number[]>();
    for (const d of decided) {
      const arr = times.get(d.businessId!) ?? [];
      if (arr.length < 50) arr.push((d.decidedAt!.getTime() - d.createdAt.getTime()) / 60000);
      times.set(d.businessId!, arr);
    }
    for (const b of businessIds) {
      const r = revOf.get(b);
      const n = r?._count._all ?? 0;
      const t = times.get(b) ?? [];
      out.set(b, {
        stars: n ? round2(r!._avg.stars ?? 0) : 0,
        reviews: n,
        positive: n ? Math.round(((posOf.get(b) ?? 0) / n) * 100) : 0,
        delivered: delOf.get(b) ?? 0,
        responseMins: t.length ? Math.round([...t].sort((a, c) => a - c)[Math.floor(t.length / 2)]) : null,
      });
    }
    return out;
  }

  /** The client's reputation, as any lender sees it: stars from lenders, on-time record, loans running on the platform */
  private async clientStats(client: { id: string; creditUserId: string | null }) {
    const ids = await this.idsOfClient(client);
    const p = await this.person(ids);
    const where = client.creditUserId ? { creditUserId: client.creditUserId, fromClient: false } : { clientId: client.id, fromClient: false };
    const [agg, pos, inst] = await Promise.all([
      this.prisma.loanReview.aggregate({ where, _avg: { stars: true }, _count: { _all: true } }),
      this.prisma.loanReview.count({ where: { ...where, stars: { gte: 4 } } }),
      this.prisma.loanInstallment.findMany({ where: { status: 'PAID', paidAt: { not: null }, loan: { clientId: { in: ids } } }, select: { paidAt: true, dueDate: true } }),
    ]);
    const endOfDay = (d: Date) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x.getTime(); };
    const onTime = inst.filter((i) => i.paidAt!.getTime() <= endOfDay(i.dueDate)).length;
    const n = agg._count._all;
    return {
      level: p.level,
      levelName: LEVEL_NAMES[p.level],
      stars: n ? round2(agg._avg.stars ?? 0) : 0,
      reviews: n,
      positive: n ? Math.round((pos / n) * 100) : 0,
      paidInstallments: inst.length,
      onTimePct: inst.length ? Math.round((onTime / inst.length) * 100) : null,
      activeOnPlatform: p.active,
      lateAnywhere: p.late,
      person: p,
    };
  }

  // ── Lender: offers ────────────────────────────────────────────────────────
  async offers(businessId: string) {
    await assertModule(this.prisma, businessId, 'loans');
    const offers = await this.prisma.loanOffer.findMany({ where: { businessId }, orderBy: [{ active: 'desc' }, { createdAt: 'desc' }] });
    const counts = await this.prisma.loan.groupBy({ by: ['offerId'], where: { businessId, kind: 'CASH' }, _count: { _all: true } });
    const countOf = new Map(counts.map((c) => [c.offerId, c._count._all]));
    return offers.map((o) => ({ ...o, requests: countOf.get(o.id) ?? 0 }));
  }

  async createOffer(businessId: string, body: any) {
    await assertModule(this.prisma, businessId, 'loans');
    return this.prisma.loanOffer.create({ data: { businessId, ...this.cleanOffer(body) } });
  }

  async updateOffer(businessId: string, id: string, body: any) {
    await assertModule(this.prisma, businessId, 'loans');
    const offer = await this.prisma.loanOffer.findFirst({ where: { id, businessId } });
    if (!offer) throw new NotFoundException('Oferta no encontrada');
    const data = body?.onlyActive !== undefined ? { active: !!body.onlyActive } : this.cleanOffer({ ...offer, ...body });
    return this.prisma.loanOffer.update({ where: { id }, data });
  }

  async deleteOffer(businessId: string, id: string) {
    await assertModule(this.prisma, businessId, 'loans');
    const offer = await this.prisma.loanOffer.findFirst({ where: { id, businessId } });
    if (!offer) throw new NotFoundException('Oferta no encontrada');
    // Offers that already have loans are paused, not deleted (the loans keep their reference)
    const used = await this.prisma.loan.count({ where: { offerId: id } });
    if (used) await this.prisma.loanOffer.update({ where: { id }, data: { active: false } });
    else await this.prisma.loanOffer.delete({ where: { id } });
    return { ok: true, paused: !!used };
  }

  // ── Lender: its table by level, and one client's own limit ───────────────
  async lenderSettings(businessId: string) {
    await assertModule(this.prisma, businessId, 'loans');
    const [tables, caps, stats] = await Promise.all([this.tablesOf([businessId]), this.caps(), this.lenderStats([businessId])]);
    return { levelLimits: tables.get(businessId), caps, levelNames: LEVEL_NAMES, levelAt: LEVEL_AT, reputation: stats.get(businessId) };
  }

  async saveLenderSettings(businessId: string, body: any) {
    await assertModule(this.prisma, businessId, 'loans');
    const levelLimits = cleanLevelLimits(body?.levelLimits);
    const row = await this.prisma.setting.findFirst({ where: { businessId }, select: { id: true } });
    if (row) await this.prisma.setting.update({ where: { id: row.id }, data: { loanLevelLimits: levelLimits as any } });
    else await this.prisma.setting.create({ data: { businessId, loanLevelLimits: levelLimits as any } });
    return { levelLimits };
  }

  async setClientLimit(businessId: string, clientId: string, raw: any) {
    await assertModule(this.prisma, businessId, 'loans');
    const client = await this.prisma.client.findFirst({ where: { id: clientId, businessId } });
    if (!client) throw new NotFoundException('Cliente no encontrado');
    const n = raw === null || raw === '' || raw === undefined ? null : round2(Number(raw));
    if (n !== null && !(n >= 0 && n <= 1_000_000)) throw new BadRequestException('Límite no válido');
    return this.prisma.client.update({ where: { id: clientId }, data: { lendingLimit: n }, select: { id: true, lendingLimit: true } });
  }

  // ── Lender: requests, loans and portfolio ─────────────────────────────────
  async loans(businessId: string, status?: string) {
    await assertModule(this.prisma, businessId, 'loans');
    const where: any = { businessId, kind: 'CASH' };
    if (status === 'requests') where.status = 'REQUESTED';
    else if (status === 'approved') where.status = 'APPROVED_PENDING_DISBURSEMENT';
    else if (status === 'active') where.status = { in: RUNNING };
    else if (status === 'closed') where.status = { in: ['PAID', 'REJECTED', 'CANCELLED'] };
    const loans = await this.prisma.loan.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 300,
      include: {
        client: { select: { id: true, name: true, documentId: true, phone: true, creditLimit: true, currentDebt: true, creditUserId: true, lendingLimit: true } },
        installments: { orderBy: { dueDate: 'asc' } },
        reviews: { select: { fromClient: true, stars: true, comment: true } },
      },
    });
    const [offers, table, unread] = await Promise.all([
      this.prisma.loanOffer.findMany({ where: { businessId }, select: { id: true, name: true } }),
      this.tablesOf([businessId]).then((t) => t.get(businessId)!),
      this.prisma.loanMessage.groupBy({ by: ['loanId'], where: { loanId: { in: loans.map((l) => l.id) }, fromClient: true, readAt: null }, _count: { _all: true } }),
    ]);
    const offerName = new Map(offers.map((o) => [o.id, o.name]));
    const unreadOf = new Map(unread.map((u) => [u.loanId, u._count._all]));
    // one look per person (several loans of the same client share it)
    const statsOf = new Map<string, Awaited<ReturnType<LendingService['clientStats']>>>();
    for (const l of loans) {
      if (!statsOf.has(l.client.id)) statsOf.set(l.client.id, await this.clientStats(l.client));
    }
    const now = Date.now();
    return loans.map((l) => {
      const late = l.installments.filter((i) => i.status === 'PENDING' && i.dueDate.getTime() < now).reduce((s, i) => s + (i.amount - i.paidAmount), 0);
      const st = statsOf.get(l.client.id)!;
      // what this person could borrow here, leaving this request out of their reserved amount
      const p = st.person;
      const ownReserve = OPEN.includes(l.status) ? l.amount : 0;
      const owedHere = (p.owedAt.get(businessId) ?? 0) - ownReserve;
      const limitHere = l.client.lendingLimit ?? table[p.level];
      const available = round2(Math.max(0, Math.min(limitHere - owedHere, p.globalRoom + ownReserve)));
      const { person: _p, ...reputation } = st;
      return {
        ...l,
        pin: undefined, // the PIN is the client's: the business types it at the POS
        offerName: l.offerId ? offerName.get(l.offerId) ?? null : null,
        level: st.level,
        lateAmount: round2(late),
        limitHere,
        levelLimit: table[p.level],
        available,
        fitsLimit: available + 0.005 >= l.amount,
        blockedAnywhere: l.status === 'REQUESTED' && p.block === 'late',
        reputation,
        unread: unreadOf.get(l.id) ?? 0,
        myReview: l.reviews.find((r) => !r.fromClient) ?? null,
        clientReview: l.reviews.find((r) => r.fromClient) ?? null,
      };
    });
  }

  async approve(businessId: string, userId: string, id: string, body?: any) {
    await assertModule(this.prisma, businessId, 'loans');
    const loan = await this.prisma.loan.findFirst({ where: { id, businessId, kind: 'CASH' }, include: { client: true } });
    if (!loan) throw new NotFoundException('Solicitud no encontrada');
    if (loan.status !== 'REQUESTED') throw new BadRequestException('Esta solicitud ya fue respondida');
    if (loan.client.isSuspended) throw new BadRequestException('El cliente tiene la cuenta pausada');
    // The rules again, now (the person may have borrowed elsewhere since asking)
    const p = await this.person(await this.idsOfClient(loan.client), loan.id);
    if (p.block === 'late') throw new BadRequestException('El cliente tiene cuotas atrasadas en la plataforma: no se le puede prestar hasta que se ponga al día.');
    if (p.block === 'count') throw new BadRequestException('El cliente llegó al máximo de préstamos a la vez de su nivel.');
    const table = (await this.tablesOf([businessId])).get(businessId)!;
    const room = this.roomAt(p, businessId, table, loan.client.lendingLimit);
    if (room + 0.005 < loan.amount) {
      throw new BadRequestException(`Hoy puede pedirte hasta $${room.toFixed(2)} y pidió $${loan.amount.toFixed(2)}. Súbele su límite o rechaza la solicitud.`);
    }
    // A plan of its own for this client (the total to pay stays: the interest is for the whole loan)
    let plan: { installmentsCount: number; frequencyDays: number } | null = null;
    if (body?.installments !== undefined || body?.frequencyDays !== undefined) {
      const n = Math.round(Number(body?.installments ?? loan.installmentsCount));
      const f = Math.round(Number(body?.frequencyDays ?? loan.frequencyDays ?? 7));
      if (!(n >= 1 && n <= 52)) throw new BadRequestException('Entre 1 y 52 cuotas');
      if (!(f >= 1 && f <= 90)) throw new BadRequestException('La frecuencia debe estar entre 1 y 90 días');
      if (n !== loan.installmentsCount || f !== (loan.frequencyDays ?? 7)) plan = { installmentsCount: n, frequencyDays: f };
    }
    // A PIN that isn't in use in this business
    let pin = '';
    for (let i = 0; i < 8; i++) {
      pin = Math.floor(100000 + Math.random() * 900000).toString();
      if (!(await this.prisma.loan.findFirst({ where: { businessId, pin } }))) break;
    }
    const updated = await this.prisma.loan.update({
      where: { id },
      data: { status: 'APPROVED_PENDING_DISBURSEMENT', pin, pinExpiresAt: new Date(Date.now() + PIN_HOURS * 3600 * 1000), decidedAt: new Date(), decidedBy: userId, ...(plan ?? {}) },
    });
    if (plan) {
      // the client learns the new plan in the chat (and sees it on the loan)
      const each = round2(loan.totalToPay / plan.installmentsCount);
      const every = plan.frequencyDays === 7 ? 'semanales' : plan.frequencyDays === 15 ? 'quincenales' : plan.frequencyDays === 30 ? 'mensuales' : `cada ${plan.frequencyDays} días`;
      const biz = await this.prisma.business.findUnique({ where: { id: businessId }, select: { name: true } });
      await this.prisma.loanMessage.create({
        data: {
          loanId: id, fromClient: false, senderUserId: userId, senderName: biz?.name || 'Comercio',
          text: `Te aprobamos el préstamo con un plan a tu medida: ${plan.installmentsCount} cuota${plan.installmentsCount > 1 ? 's' : ''} ${every} de $${each.toFixed(2)} (devuelves $${loan.totalToPay.toFixed(2)} en total).`,
        },
      });
    }
    return updated;
  }

  async reject(businessId: string, userId: string, id: string, reason?: string) {
    await assertModule(this.prisma, businessId, 'loans');
    const loan = await this.prisma.loan.findFirst({ where: { id, businessId, kind: 'CASH' } });
    if (!loan) throw new NotFoundException('Solicitud no encontrada');
    if (!OPEN.includes(loan.status)) throw new BadRequestException('Este préstamo ya fue entregado');
    return this.prisma.loan.update({
      where: { id },
      data: { status: 'REJECTED', rejectReason: reason ? String(reason).slice(0, 200) : null, decidedAt: new Date(), decidedBy: userId, pin: null, pinExpiresAt: null },
    });
  }

  async portfolio(businessId: string) {
    await assertModule(this.prisma, businessId, 'loans');
    const loans = await this.prisma.loan.findMany({
      where: { businessId, kind: 'CASH', disbursedAt: { not: null } },
      include: { installments: true },
    });
    const now = Date.now();
    let lent = 0, toCollect = 0, collected = 0, interestEarned = 0, late = 0;
    for (const l of loans) {
      lent += l.amount;
      toCollect += l.remainingBalance;
      const paid = l.totalToPay - l.remainingBalance;
      collected += paid;
      // interest is earned in proportion to what was paid back
      interestEarned += l.totalToPay > 0 ? paid * ((l.totalToPay - l.amount) / l.totalToPay) : 0;
      late += l.installments.filter((i) => i.status === 'PENDING' && i.dueDate.getTime() < now).reduce((s, i) => s + (i.amount - i.paidAmount), 0);
    }
    const pending = await this.prisma.loan.count({ where: { businessId, kind: 'CASH', status: 'REQUESTED' } });
    const unread = await this.prisma.loanMessage.count({ where: { fromClient: true, readAt: null, loan: { businessId } } });
    return { lent: round2(lent), toCollect: round2(toCollect), collected: round2(collected), interestEarned: round2(interestEarned), late: round2(late), activeLoans: loans.filter((l) => l.remainingBalance > 0.004).length, pendingRequests: pending, unreadMessages: unread };
  }

  // ── POS: hand the cash over with the client's PIN ─────────────────────────
  async byPin(businessId: string, pin: string) {
    await assertModule(this.prisma, businessId, 'loans');
    const loan = await this.prisma.loan.findFirst({
      where: { businessId, pin: String(pin || '').trim(), kind: 'CASH' },
      include: { client: { select: { id: true, name: true, documentId: true, phone: true } } },
    });
    if (!loan) throw new NotFoundException('No hay ningún préstamo con ese PIN');
    if (loan.status !== 'APPROVED_PENDING_DISBURSEMENT') throw new BadRequestException('Ese préstamo ya fue entregado o no está aprobado');
    if (loan.pinExpiresAt && loan.pinExpiresAt < new Date()) throw new BadRequestException('El PIN venció. El comercio debe aprobarlo de nuevo.');
    const each = round2(loan.totalToPay / Math.max(1, loan.installmentsCount));
    return { id: loan.id, amount: loan.amount, totalToPay: loan.totalToPay, installments: loan.installmentsCount, each, frequencyDays: loan.frequencyDays ?? 7, client: loan.client };
  }

  /**
   * How the loan was handed over: one or several parts that add up to it.
   *  - CASH: dollars in bills from the drawer {bills: {"20": 1}}
   *  - PAGO_MOVIL / TRANSFER: bolívares at a rate {amount (in $), rate, rateLabel, reference}
   *  - BINANCE / ZELLE: {amount, reference}
   * The old body {bills} still means "all in cash".
   */
  private cleanParts(body: any, loanAmount: number) {
    const raw: any[] = Array.isArray(body?.parts) ? body.parts : body?.bills ? [{ method: 'CASH', bills: body.bills }] : [];
    if (!raw.length) throw new BadRequestException('Indica cómo entregas el préstamo');
    const parts: any[] = [];
    for (const p of raw.slice(0, 6)) {
      const method = String(p?.method || '').toUpperCase();
      if (method === 'CASH') {
        const bills: Record<string, number> = {};
        let sum = 0;
        for (const [k, v] of Object.entries(p?.bills || {})) {
          const value = Number(k), n = Math.round(Number(v));
          if (!(value > 0) || !(n > 0)) continue;
          bills[String(value)] = n;
          sum += value * n;
        }
        if (sum > 0) parts.push({ method, amount: round2(sum), bills });
      } else if (method === 'PAGO_MOVIL' || method === 'TRANSFER') {
        const amount = round2(Number(p?.amount));
        const rate = Number(p?.rate);
        if (!(amount > 0)) continue;
        if (!(rate > 1)) throw new BadRequestException('Indica la tasa para la parte en bolívares');
        parts.push({ method, amount, rate: round2(rate), rateLabel: String(p?.rateLabel || 'Tasa').slice(0, 30), ves: round2(amount * rate), reference: String(p?.reference || '').trim().slice(0, 60) || null });
      } else if (method === 'BINANCE' || method === 'ZELLE') {
        const amount = round2(Number(p?.amount));
        if (amount > 0) parts.push({ method, amount, reference: String(p?.reference || '').trim().slice(0, 60) || null });
      } else {
        throw new BadRequestException('Método de entrega no válido');
      }
    }
    const total = round2(parts.reduce((x, p) => x + p.amount, 0));
    if (Math.abs(total - loanAmount) > 0.01) throw new BadRequestException(`Lo que entregas suma $${total.toFixed(2)} y el préstamo es de $${loanAmount.toFixed(2)}`);
    return parts;
  }

  async disburse(businessId: string, user: any, pin: string, body: any) {
    const info = await this.byPin(businessId, pin);
    const parts = this.cleanParts(body, info.amount);

    const shift = await this.prisma.shift.findFirst({ where: { userId: user.id, status: 'OPEN' }, orderBy: { openedAt: 'desc' } });
    if (!shift) throw new BadRequestException('Abre tu turno de caja antes de entregar un préstamo');
    const branch = await this.prisma.branch.findFirst({ where: { id: shift.branchId, businessId } });
    if (!branch) throw new ForbiddenException('Sucursal no válida');

    const now = new Date();
    const freq = info.frequencyDays;
    const n = Math.max(1, info.installments);
    const each = round2(info.totalToPay / n);
    const label: Record<string, string> = { CASH: 'efectivo', PAGO_MOVIL: 'pago móvil', TRANSFER: 'transferencia', BINANCE: 'Binance', ZELLE: 'Zelle' };
    return this.prisma.$transaction(async (tx) => {
      // claim it first, so two cashiers can't hand the same loan over twice
      const claimed = await tx.loan.updateMany({
        where: { id: info.id, status: 'APPROVED_PENDING_DISBURSEMENT' },
        data: { status: 'PENDING', disbursedAt: now, disbursedBy: user.id, disbursedBranchId: branch.id, bills: { parts } as any, pin: null, pinExpiresAt: null },
      });
      if (!claimed.count) throw new BadRequestException('Ese préstamo ya fue entregado');
      for (let i = 1; i <= n; i++) {
        const amount = i === n ? round2(info.totalToPay - each * (n - 1)) : each;
        await tx.loanInstallment.create({ data: { loanId: info.id, installmentNumber: i, dueDate: new Date(now.getTime() + freq * i * 86400000), amount } });
      }
      await tx.client.update({ where: { id: info.client.id }, data: { currentDebt: { increment: info.totalToPay } } });
      await tx.creditTransaction.create({ data: { clientId: info.client.id, type: 'DEBT', amount: info.totalToPay, notes: `Préstamo en efectivo de $${info.amount.toFixed(2)} (#${info.id.slice(0, 8)})` } });
      // one movement per way it left: only the cash comes out of this shift's drawer
      for (const p of parts) {
        await tx.financeMovement.create({
          data: {
            businessId, branchId: branch.id, userId: user.id, userName: user.name ?? null,
            type: 'OUT', category: 'LOAN', categoryLabel: 'Préstamo entregado', amount: p.amount,
            currency: p.ves ? 'VES' : 'USD', amountCurrency: p.ves ?? p.amount,
            method: p.method === 'CASH' ? 'CASH_DRAWER' : p.method,
            description: `Préstamo a ${info.client.name} (#${info.id.slice(0, 8)}) · ${label[p.method]}${p.ves ? ` Bs ${p.ves.toFixed(2)} a ${p.rate}` : ''}${p.reference ? ` · ref ${p.reference}` : ''}`,
            source: 'POS', shiftId: shift.id,
          },
        });
      }
      return { ok: true, loanId: info.id, each, installments: n, parts };
    });
  }

  // ── Syncro Credit app: the market ─────────────────────────────────────────
  /** Every lender's offer with what this person can take there, the ones they can take first */
  async market(user: any) {
    const ids = await this.personIds(user);
    const p = await this.person(ids);
    const hidden = new Set((await this.prisma.setting.findMany({ where: { syncroCreditVisible: false, businessId: { not: null } }, select: { businessId: true } })).map((s) => s.businessId));
    const all = await this.prisma.loanOffer.findMany({
      where: { active: true },
      include: { business: { select: { id: true, name: true, logo: true } } },
      take: 300,
    });
    const offers: typeof all = [];
    const usable = new Map<string, boolean>();
    for (const o of all) {
      if (hidden.has(o.businessId)) continue;
      if (!usable.has(o.businessId)) usable.set(o.businessId, (await usableModules(this.prisma, o.businessId)).has('loans'));
      if (usable.get(o.businessId)) offers.push(o);
    }
    const bizIds = [...new Set(offers.map((o) => o.businessId))];
    const [tables, stats, mine] = await Promise.all([
      this.tablesOf(bizIds),
      this.lenderStats(bizIds),
      ids.length ? this.prisma.client.findMany({ where: { id: { in: ids } }, select: { businessId: true, lendingLimit: true, isSuspended: true } }) : Promise.resolve([]),
    ]);
    const mineAt = new Map(mine.map((c) => [c.businessId, c]));
    const openAt = new Set(
      ids.length
        ? (await this.prisma.loan.findMany({ where: { clientId: { in: ids }, kind: 'CASH', status: { in: OPEN as any } }, select: { businessId: true } })).map((l) => l.businessId)
        : [],
    );

    const out = offers.map((o) => {
      const table = tables.get(o.businessId)!;
      const here = mineAt.get(o.businessId);
      const room = here?.isSuspended ? 0 : this.roomAt(p, o.businessId, table, here?.lendingLimit);
      const max = round2(Math.min(o.maxAmount, room));
      let blocked: string | null = null;
      let unlockLevel: number | null = null;
      if (here?.isSuspended) blocked = 'suspended';
      else if (p.block) blocked = p.block;
      else if (openAt.has(o.businessId)) blocked = 'open';
      else if (p.level > o.minLevel) { blocked = 'level'; unlockLevel = o.minLevel; }
      else if (max + 0.005 < o.minAmount) {
        blocked = 'limit';
        // the first better level whose limits (this lender's and the platform's) reach the offer's minimum
        const owedHere = p.owedAt.get(o.businessId) ?? 0;
        unlockLevel = LEVELS.filter((l) => l < p.level).find((l) => Math.min((here?.lendingLimit ?? table[l]) - owedHere, p.caps.levels[l].maxDebt - p.owed) + 0.005 >= o.minAmount) ?? null;
      }
      const forYou = blocked ? null : { min: o.minAmount, max };
      const sample = this.plan(forYou ? forYou.max : o.minAmount, o);
      return {
        id: o.id, name: o.name, business: o.business, minAmount: o.minAmount, maxAmount: o.maxAmount, interestPct: o.interestPct,
        installments: o.installments, frequencyDays: o.frequencyDays, minLevel: o.minLevel, minLevelName: LEVEL_NAMES[o.minLevel],
        forYou, blocked, unlockLevel, unlockName: unlockLevel ? LEVEL_NAMES[unlockLevel] : null,
        amount: sample.n ? (forYou ? forYou.max : o.minAmount) : 0, total: sample.total, each: sample.each,
        eligible: !blocked,
        lender: stats.get(o.businessId),
      };
    });
    out.sort((x, y) => Number(y.eligible) - Number(x.eligible) || x.interestPct - y.interestPct || (y.lender?.stars ?? 0) - (x.lender?.stars ?? 0));
    const next = p.level > 1 ? { level: p.level - 1, name: LEVEL_NAMES[p.level - 1], at: LEVEL_AT[p.level - 1], missing: round2(LEVEL_AT[p.level - 1] - p.paidOnTime) } : null;
    return {
      level: p.level,
      levelName: LEVEL_NAMES[p.level],
      paidOnTime: p.paidOnTime,
      next,
      owed: p.owed,
      active: p.active,
      maxActive: p.caps.levels[p.level].maxActive,
      cap: p.caps.levels[p.level].maxDebt,
      globalRoom: p.globalRoom,
      maxAnywhere: round2(Math.max(0, ...out.filter((o) => o.forYou).map((o) => o.forYou!.max))),
      block: p.block,
      blockText: this.blockText(p),
      offers: out,
    };
  }

  /** A lender's profile in the app: its reputation and the latest comments */
  async lenderProfile(businessId: string) {
    const biz = await this.prisma.business.findUnique({ where: { id: businessId }, select: { id: true, name: true, logo: true, createdAt: true } });
    if (!biz) throw new NotFoundException('Comercio no encontrado');
    const [stats, reviews] = await Promise.all([
      this.lenderStats([businessId]),
      this.prisma.loanReview.findMany({ where: { businessId, fromClient: true }, orderBy: { createdAt: 'desc' }, take: 20, select: { stars: true, comment: true, createdAt: true, creditUserId: true, clientId: true } }),
    ]);
    // only the first name of whoever wrote it
    const people = await this.prisma.client.findMany({ where: { id: { in: reviews.map((r) => r.clientId) } }, select: { id: true, name: true } });
    const nameOf = new Map(people.map((c) => [c.id, String(c.name || '').trim().split(/\s+/)[0] || 'Cliente']));
    return { business: biz, ...stats.get(businessId), comments: reviews.map((r) => ({ stars: r.stars, comment: r.comment, createdAt: r.createdAt, by: nameOf.get(r.clientId) ?? 'Cliente' })) };
  }

  async request(user: any, body: any) {
    const offer = await this.prisma.loanOffer.findFirst({ where: { id: String(body?.offerId || ''), active: true } });
    if (!offer) throw new NotFoundException('Esa oferta ya no está disponible');
    await assertModule(this.prisma, offer.businessId, 'loans');
    const amount = round2(Number(body?.amount));
    if (!(amount >= offer.minAmount && amount <= offer.maxAmount)) throw new BadRequestException(`Esta oferta presta de $${offer.minAmount} a $${offer.maxAmount}`);
    const ids = await this.personIds(user);
    const p = await this.person(ids);
    if (p.block) throw new BadRequestException(this.blockText(p)!);
    if (p.level > offer.minLevel) throw new BadRequestException(`Esta oferta es desde el nivel ${offer.minLevel} · ${LEVEL_NAMES[offer.minLevel]}`);

    // The person's client row at this lender (created the first time)
    let client = ids.length ? await this.prisma.client.findFirst({ where: { id: { in: ids }, businessId: offer.businessId } }) : null;
    if (!client) {
      const cu = user?.cu ? await this.prisma.creditUser.findUnique({ where: { id: user.cu } }) : null;
      if (!cu) throw new BadRequestException('Crea tu cuenta de Syncro Credit para pedir préstamos');
      // Maybe the business already had this person as a client (typed the cédula some other way)
      client = await this.prisma.client.findFirst({ where: { businessId: offer.businessId, documentId: { in: documentIdVariants(cu.documentId), mode: 'insensitive' } } });
      if (client) {
        // Typing a cédula proves nothing: join it only with a verified phone that matches the business's
        const tail = (ph: string | null | undefined) => String(ph || '').replace(/\D/g, '').slice(-10);
        const same = !!cu.phoneVerifiedAt && tail(cu.phone).length === 10 && tail(cu.phone) === tail(client.phone);
        if (client.creditUserId && client.creditUserId !== cu.id) throw new BadRequestException('Esta cédula ya está vinculada a otra cuenta en este comercio. Acércate a la caja.');
        if (!same) throw new BadRequestException('Este comercio ya te tiene como cliente. Pide en caja tu código de activación para vincular tu cuenta.');
        client = await this.prisma.client.update({ where: { id: client.id }, data: { creditUserId: cu.id } });
      } else {
        const policy = await this.prisma.setting.findFirst({ where: { businessId: offer.businessId }, select: { syncroCreditInitialLimit: true } });
        client = await this.prisma.client.create({
          data: { businessId: offer.businessId, name: cu.name, documentId: cu.documentId, phone: cu.phone, email: cu.email, creditUserId: cu.id, creditLimit: policy?.syncroCreditInitialLimit ?? 30 },
        });
      }
    }
    if (client.isSuspended) throw new BadRequestException('Tu cuenta con este comercio está pausada');
    const open = await this.prisma.loan.count({ where: { clientId: client.id, kind: 'CASH', status: { in: OPEN as any } } });
    if (open) throw new BadRequestException('Ya tienes una solicitud abierta con este comercio');
    const table = (await this.tablesOf([offer.businessId])).get(offer.businessId)!;
    const room = this.roomAt(p, offer.businessId, table, client.lendingLimit);
    if (room + 0.005 < amount) {
      throw new BadRequestException(room + 0.005 >= offer.minAmount ? `Con este comercio puedes pedir hasta $${room.toFixed(2)}` : 'Tu límite no alcanza para el mínimo de esta oferta');
    }

    const plan = this.plan(amount, offer);
    return this.prisma.loan.create({
      data: {
        clientId: client.id, businessId: offer.businessId, offerId: offer.id, kind: 'CASH', status: 'REQUESTED',
        amount, interestRate: offer.interestPct, totalToPay: plan.total, remainingBalance: plan.total,
        installmentsCount: plan.n, frequencyDays: offer.frequencyDays,
      },
    });
  }

  /** The person's cash loans: open requests, running and recent closed ones (chat and reviews live here) */
  async myRequests(user: any) {
    const ids = await this.personIds(user);
    if (!ids.length) return [];
    const loans = await this.prisma.loan.findMany({
      where: { clientId: { in: ids }, kind: 'CASH', status: { in: ['REQUESTED', 'APPROVED_PENDING_DISBURSEMENT', 'REJECTED', 'PENDING', 'OVERDUE', 'PAID'] as any } },
      orderBy: { createdAt: 'desc' },
      take: 30,
      include: { reviews: { select: { fromClient: true, stars: true, comment: true } } },
    });
    const bizIds = [...new Set(loans.map((l) => l.businessId!).filter(Boolean))];
    const [biz, branches, unread, stats] = await Promise.all([
      this.prisma.business.findMany({ where: { id: { in: bizIds } }, select: { id: true, name: true, logo: true } }),
      this.prisma.branch.findMany({ where: { businessId: { in: bizIds }, isMain: true }, select: { businessId: true, location: true, name: true } }),
      this.prisma.loanMessage.groupBy({ by: ['loanId'], where: { loanId: { in: loans.map((l) => l.id) }, fromClient: false, readAt: null }, _count: { _all: true } }),
      this.lenderStats(bizIds),
    ]);
    const bizOf = new Map(biz.map((b) => [b.id, b]));
    const branchOf = new Map(branches.map((b) => [b.businessId, b]));
    const unreadOf = new Map(unread.map((u) => [u.loanId, u._count._all]));
    const recent = (d: Date | null) => !!d && Date.now() - d.getTime() < 30 * 86400000;
    return loans
      .filter((l) => (l.status !== 'REJECTED' || recent(l.decidedAt)) && (l.status !== 'PAID' || recent(l.updatedAt)))
      .map((l) => {
        const expired = l.status === 'APPROVED_PENDING_DISBURSEMENT' && l.pinExpiresAt && l.pinExpiresAt < new Date();
        return {
          id: l.id, status: expired ? 'EXPIRED' : l.status, amount: l.amount, totalToPay: l.totalToPay, remainingBalance: l.remainingBalance,
          installments: l.installmentsCount, each: round2(l.totalToPay / Math.max(1, l.installmentsCount)), frequencyDays: l.frequencyDays, createdAt: l.createdAt,
          pin: l.status === 'APPROVED_PENDING_DISBURSEMENT' && !expired ? l.pin : null, pinExpiresAt: l.pinExpiresAt, rejectReason: l.rejectReason,
          business: bizOf.get(l.businessId!) ?? null, branch: branchOf.get(l.businessId!) ?? null, lender: stats.get(l.businessId!) ?? null,
          unread: unreadOf.get(l.id) ?? 0,
          canReview: !!l.disbursedAt,
          received: Array.isArray((l.bills as any)?.parts) ? (l.bills as any).parts.map((p: any) => ({ method: p.method, amount: p.amount, ves: p.ves ?? null, rate: p.rate ?? null })) : l.disbursedAt ? [{ method: 'CASH', amount: l.amount }] : null,
          myReview: l.reviews.find((r) => r.fromClient) ?? null,
        };
      });
  }

  async cancelRequest(user: any, id: string) {
    const ids = await this.personIds(user);
    const loan = await this.prisma.loan.findFirst({ where: { id, clientId: { in: ids }, kind: 'CASH', status: { in: OPEN as any } } });
    if (!loan) throw new NotFoundException('Solicitud no encontrada');
    return this.prisma.loan.update({ where: { id }, data: { status: 'CANCELLED', pin: null, pinExpiresAt: null } });
  }

  // ── Chat (one per loan) ───────────────────────────────────────────────────
  private async clientLoan(user: any, id: string) {
    const ids = await this.personIds(user);
    const loan = await this.prisma.loan.findFirst({ where: { id, clientId: { in: ids }, kind: 'CASH' }, include: { client: { select: { name: true } } } });
    if (!loan) throw new NotFoundException('Préstamo no encontrado');
    return loan;
  }

  private async lenderLoan(businessId: string, id: string) {
    await assertModule(this.prisma, businessId, 'loans');
    const loan = await this.prisma.loan.findFirst({ where: { id, businessId, kind: 'CASH' }, include: { client: { select: { id: true, name: true, creditUserId: true } } } });
    if (!loan) throw new NotFoundException('Préstamo no encontrado');
    return loan;
  }

  private async thread(loanId: string, readerIsClient: boolean) {
    // reading marks the other side's messages as read
    await this.prisma.loanMessage.updateMany({ where: { loanId, fromClient: !readerIsClient, readAt: null }, data: { readAt: new Date() } });
    return this.prisma.loanMessage.findMany({
      where: { loanId },
      orderBy: { createdAt: 'asc' },
      take: 500,
      select: { id: true, fromClient: true, senderName: true, text: true, readAt: true, createdAt: true },
    });
  }

  private cleanText(raw: any) {
    const text = String(raw ?? '').replace(/\s+\n/g, '\n').trim().slice(0, 1000);
    if (!text) throw new BadRequestException('Escribe un mensaje');
    return text;
  }

  async clientMessages(user: any, id: string) {
    const loan = await this.clientLoan(user, id);
    const biz = await this.prisma.business.findUnique({ where: { id: loan.businessId! }, select: { id: true, name: true, logo: true } });
    return { loan: { id: loan.id, status: loan.status, amount: loan.amount }, business: biz, messages: await this.thread(loan.id, true) };
  }

  async clientSend(user: any, id: string, body: any) {
    const loan = await this.clientLoan(user, id);
    if (loan.status === 'CANCELLED') throw new BadRequestException('Esta solicitud fue cancelada');
    return this.prisma.loanMessage.create({ data: { loanId: loan.id, fromClient: true, senderName: String(loan.client.name || 'Cliente').split(/\s+/)[0], text: this.cleanText(body?.text) } });
  }

  async lenderMessages(businessId: string, id: string) {
    const loan = await this.lenderLoan(businessId, id);
    return { loan: { id: loan.id, status: loan.status, amount: loan.amount }, client: { name: loan.client.name }, messages: await this.thread(loan.id, false) };
  }

  async lenderSend(businessId: string, user: any, id: string, body: any) {
    const loan = await this.lenderLoan(businessId, id);
    if (loan.status === 'CANCELLED') throw new BadRequestException('El cliente canceló esta solicitud');
    const biz = await this.prisma.business.findUnique({ where: { id: businessId }, select: { name: true } });
    return this.prisma.loanMessage.create({ data: { loanId: loan.id, fromClient: false, senderUserId: user?.id ?? null, senderName: biz?.name || 'Comercio', text: this.cleanText(body?.text) } });
  }

  async clientUnread(user: any) {
    const ids = await this.personIds(user);
    if (!ids.length) return { unread: 0 };
    return { unread: await this.prisma.loanMessage.count({ where: { fromClient: false, readAt: null, loan: { clientId: { in: ids }, kind: 'CASH' } } }) };
  }

  // ── Reviews (stars and a comment, both ways, once per loan each, editable) ─
  private cleanReview(body: any) {
    const stars = Math.round(Number(body?.stars));
    if (!(stars >= 1 && stars <= 5)) throw new BadRequestException('Elige de 1 a 5 estrellas');
    const comment = String(body?.comment ?? '').trim().slice(0, 400) || null;
    return { stars, comment };
  }

  async clientReview(user: any, id: string, body: any) {
    const loan = await this.clientLoan(user, id);
    if (!loan.disbursedAt) throw new BadRequestException('Podrás calificar cuando recibas el préstamo');
    const data = this.cleanReview(body);
    const client = await this.prisma.client.findUnique({ where: { id: loan.clientId }, select: { creditUserId: true } });
    return this.prisma.loanReview.upsert({
      where: { loanId_fromClient: { loanId: loan.id, fromClient: true } },
      create: { loanId: loan.id, fromClient: true, businessId: loan.businessId!, clientId: loan.clientId, creditUserId: client?.creditUserId ?? null, ...data },
      update: data,
    });
  }

  async lenderReview(businessId: string, id: string, body: any) {
    const loan = await this.lenderLoan(businessId, id);
    if (!loan.disbursedAt) throw new BadRequestException('Podrás calificar al cliente cuando le entregues el préstamo');
    const data = this.cleanReview(body);
    return this.prisma.loanReview.upsert({
      where: { loanId_fromClient: { loanId: loan.id, fromClient: false } },
      create: { loanId: loan.id, fromClient: false, businessId, clientId: loan.client.id, creditUserId: loan.client.creditUserId ?? null, ...data },
      update: data,
    });
  }
}
