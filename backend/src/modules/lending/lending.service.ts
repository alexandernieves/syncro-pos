import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { assertModule, usableModules } from '../business-modules/module-access';
import { documentIdVariants } from '../auth/document-id';

const LEVEL_NAMES: Record<number, string> = { 4: 'Chispa', 3: 'Cometa', 2: 'Órbita', 1: 'Galaxia' };
const round2 = (n: number) => Math.round(n * 100) / 100;
const PIN_HOURS = 24;

/**
 * Cash loans (module "loans").
 *
 * Lender: publishes offers (amount range, interest for the whole loan, installments, frequency,
 * minimum level), reviews the requests, approves (a 6-digit PIN for the client) or rejects, and the
 * cashier hands the cash over at the POS with that PIN: it leaves the drawer as a cash movement
 * (not a sale), the installments start and the client's debt with that business grows.
 *
 * Client (Syncro Credit app): sees every lender's offers for the amount needed, cheapest first, and
 * requests. When the lender isn't one of its businesses yet, a client row is created there with
 * the lender's starting limit. Golden rule: a lender only sees what the person shares with it
 * (name, cédula, phone, level), never what the person owes other businesses.
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
    if (!(interestPct >= 0 && interestPct <= 200)) throw new BadRequestException('El interés debe estar entre 0% y 200%');
    if (installments < 1 || installments > 52) throw new BadRequestException('Entre 1 y 52 cuotas');
    if (frequencyDays < 1 || frequencyDays > 90) throw new BadRequestException('La frecuencia debe estar entre 1 y 90 días');
    if (minLevel < 1 || minLevel > 4) throw new BadRequestException('Nivel no válido');
    return { name, minAmount, maxAmount, interestPct, installments, frequencyDays, minLevel, active: body?.active === undefined ? true : !!body.active };
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

  // ── Lender: requests, loans and portfolio ─────────────────────────────────
  async loans(businessId: string, status?: string) {
    await assertModule(this.prisma, businessId, 'loans');
    const where: any = { businessId, kind: 'CASH' };
    if (status === 'requests') where.status = 'REQUESTED';
    else if (status === 'approved') where.status = 'APPROVED_PENDING_DISBURSEMENT';
    else if (status === 'active') where.status = { in: ['PENDING', 'OVERDUE'] };
    else if (status === 'closed') where.status = { in: ['PAID', 'REJECTED', 'CANCELLED'] };
    const loans = await this.prisma.loan.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 300,
      include: {
        client: { select: { id: true, name: true, documentId: true, phone: true, creditLimit: true, currentDebt: true, creditUserId: true } },
        installments: { orderBy: { dueDate: 'asc' } },
      },
    });
    const offers = await this.prisma.loanOffer.findMany({ where: { businessId }, select: { id: true, name: true } });
    const offerName = new Map(offers.map((o) => [o.id, o.name]));
    const levels = await this.levelsOf(loans.map((l) => l.client));
    return loans.map((l) => {
      const now = Date.now();
      const late = l.installments.filter((i) => i.status === 'PENDING' && i.dueDate.getTime() < now).reduce((s, i) => s + (i.amount - i.paidAmount), 0);
      const available = round2((l.client.creditLimit || 0) - (l.client.currentDebt || 0));
      return {
        ...l,
        pin: undefined, // the PIN is the client's: the business types it at the POS
        offerName: l.offerId ? offerName.get(l.offerId) ?? null : null,
        level: levels.get(l.client.id) ?? 4,
        lateAmount: round2(late),
        available,
        fitsLimit: available + 0.005 >= l.totalToPay,
      };
    });
  }

  /** Level of each client: the person's level (money paid on time with every business) */
  private async levelsOf(clients: { id: string; creditUserId: string | null }[]) {
    const out = new Map<string, number>();
    for (const c of clients) {
      if (out.has(c.id)) continue;
      const ids = c.creditUserId
        ? (await this.prisma.client.findMany({ where: { creditUserId: c.creditUserId }, select: { id: true } })).map((x) => x.id)
        : [c.id];
      out.set(c.id, await this.levelOfIds(ids));
    }
    return out;
  }

  private async levelOfIds(ids: string[]) {
    if (!ids.length) return 4;
    const paid = await this.prisma.loanInstallment.findMany({
      where: { status: 'PAID', paidAt: { not: null }, loan: { clientId: { in: ids } } },
      select: { amount: true, paidAmount: true, paidAt: true, dueDate: true },
    });
    const endOfDay = (d: Date) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x.getTime(); };
    const onTime = paid.filter((i) => i.paidAt && i.paidAt.getTime() <= endOfDay(i.dueDate)).reduce((s, i) => s + (i.paidAmount || i.amount || 0), 0);
    return onTime >= 1500 ? 1 : onTime >= 500 ? 2 : onTime >= 200 ? 3 : 4;
  }

  async approve(businessId: string, userId: string, id: string) {
    await assertModule(this.prisma, businessId, 'loans');
    const loan = await this.prisma.loan.findFirst({ where: { id, businessId, kind: 'CASH' }, include: { client: true } });
    if (!loan) throw new NotFoundException('Solicitud no encontrada');
    if (loan.status !== 'REQUESTED') throw new BadRequestException('Esta solicitud ya fue respondida');
    if (loan.client.isSuspended) throw new BadRequestException('El cliente tiene la cuenta pausada');
    const available = (loan.client.creditLimit || 0) - (loan.client.currentDebt || 0);
    if (available + 0.005 < loan.totalToPay) {
      throw new BadRequestException(`Su límite disponible es $${available.toFixed(2)} y el préstamo suma $${loan.totalToPay.toFixed(2)}. Súbele el límite en Clientes o rechaza la solicitud.`);
    }
    // A PIN that isn't in use in this business
    let pin = '';
    for (let i = 0; i < 8; i++) {
      pin = Math.floor(100000 + Math.random() * 900000).toString();
      if (!(await this.prisma.loan.findFirst({ where: { businessId, pin } }))) break;
    }
    return this.prisma.loan.update({
      where: { id },
      data: { status: 'APPROVED_PENDING_DISBURSEMENT', pin, pinExpiresAt: new Date(Date.now() + PIN_HOURS * 3600 * 1000), decidedAt: new Date(), decidedBy: userId },
    });
  }

  async reject(businessId: string, userId: string, id: string, reason?: string) {
    await assertModule(this.prisma, businessId, 'loans');
    const loan = await this.prisma.loan.findFirst({ where: { id, businessId, kind: 'CASH' } });
    if (!loan) throw new NotFoundException('Solicitud no encontrada');
    if (!['REQUESTED', 'APPROVED_PENDING_DISBURSEMENT'].includes(loan.status)) throw new BadRequestException('Este préstamo ya fue entregado');
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
    return { lent: round2(lent), toCollect: round2(toCollect), collected: round2(collected), interestEarned: round2(interestEarned), late: round2(late), activeLoans: loans.filter((l) => l.remainingBalance > 0.004).length, pendingRequests: pending };
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

  async disburse(businessId: string, user: any, pin: string, body: any) {
    const info = await this.byPin(businessId, pin);
    // Bills handed over: {"20": 2, "10": 1}; they must add up to the loan
    const bills: Record<string, number> = {};
    let sum = 0;
    for (const [k, v] of Object.entries(body?.bills || {})) {
      const value = Number(k), n = Math.round(Number(v));
      if (!(value > 0) || !(n > 0)) continue;
      bills[String(value)] = n;
      sum += value * n;
    }
    if (Math.abs(round2(sum) - info.amount) > 0.005) throw new BadRequestException(`Los billetes suman $${sum.toFixed(2)} y el préstamo es de $${info.amount.toFixed(2)}`);

    const shift = await this.prisma.shift.findFirst({ where: { userId: user.id, status: 'OPEN' }, orderBy: { openedAt: 'desc' } });
    if (!shift) throw new BadRequestException('Abre tu turno de caja antes de entregar un préstamo');
    const branch = await this.prisma.branch.findFirst({ where: { id: shift.branchId, businessId } });
    if (!branch) throw new ForbiddenException('Sucursal no válida');

    const now = new Date();
    const freq = info.frequencyDays;
    const n = Math.max(1, info.installments);
    const each = round2(info.totalToPay / n);
    return this.prisma.$transaction(async (tx) => {
      // claim it first, so two cashiers can't hand the same loan over twice
      const claimed = await tx.loan.updateMany({
        where: { id: info.id, status: 'APPROVED_PENDING_DISBURSEMENT' },
        data: { status: 'PENDING', disbursedAt: now, disbursedBy: user.id, disbursedBranchId: branch.id, bills, pin: null, pinExpiresAt: null },
      });
      if (!claimed.count) throw new BadRequestException('Ese préstamo ya fue entregado');
      for (let i = 1; i <= n; i++) {
        const amount = i === n ? round2(info.totalToPay - each * (n - 1)) : each;
        await tx.loanInstallment.create({ data: { loanId: info.id, installmentNumber: i, dueDate: new Date(now.getTime() + freq * i * 86400000), amount } });
      }
      await tx.client.update({ where: { id: info.client.id }, data: { currentDebt: { increment: info.totalToPay } } });
      await tx.creditTransaction.create({ data: { clientId: info.client.id, type: 'DEBT', amount: info.totalToPay, notes: `Préstamo en efectivo de $${info.amount.toFixed(2)} (#${info.id.slice(0, 8)})` } });
      // the cash leaves the drawer of this shift (not a sale: the shift close counts it)
      await tx.financeMovement.create({
        data: {
          businessId, branchId: branch.id, userId: user.id, userName: user.name ?? null,
          type: 'OUT', category: 'LOAN', categoryLabel: 'Préstamo entregado', amount: info.amount, currency: 'USD', amountCurrency: info.amount,
          method: 'CASH_DRAWER', description: `Préstamo a ${info.client.name} (#${info.id.slice(0, 8)})`, source: 'POS', shiftId: shift.id,
        },
      });
      return { ok: true, loanId: info.id, each, installments: n };
    });
  }

  // ── Syncro Credit app ─────────────────────────────────────────────────────
  private async personIds(user: any) {
    if (user?.cu) return (await this.prisma.client.findMany({ where: { creditUserId: user.cu }, select: { id: true } })).map((c) => c.id);
    return user?.id ? [user.id] : [];
  }

  /** Every lender's active offer covering this amount, cheapest first */
  async market(user: any, amountRaw?: string) {
    const amount = Number(amountRaw) || 0;
    const ids = await this.personIds(user);
    const level = await this.levelOfIds(ids);
    const hidden = new Set((await this.prisma.setting.findMany({ where: { syncroCreditVisible: false, businessId: { not: null } }, select: { businessId: true } })).map((s) => s.businessId));
    const offers = await this.prisma.loanOffer.findMany({
      where: { active: true, ...(amount > 0 ? { minAmount: { lte: amount }, maxAmount: { gte: amount } } : {}) },
      include: { business: { select: { id: true, name: true, logo: true } } },
      take: 200,
    });
    // The person's limit with each lender: their client there (limit - debt), or that lender's starting limit
    const mine = ids.length
      ? await this.prisma.client.findMany({ where: { id: { in: ids } }, select: { businessId: true, creditLimit: true, currentDebt: true, isSuspended: true } })
      : [];
    const myAt = new Map(mine.map((c) => [c.businessId, c]));
    const starts = await this.prisma.setting.findMany({
      where: { businessId: { in: [...new Set(offers.map((o) => o.businessId))] } },
      select: { businessId: true, syncroCreditInitialLimit: true },
    });
    const startOf = new Map(starts.map((x) => [x.businessId, x.syncroCreditInitialLimit ?? 30]));
    const out: any[] = [];
    for (const o of offers) {
      if (hidden.has(o.businessId)) continue;
      if (!(await usableModules(this.prisma, o.businessId)).has('loans')) continue;
      const a = amount > 0 ? amount : o.minAmount;
      const p = this.plan(a, o);
      const mineHere = myAt.get(o.businessId);
      const available = round2(mineHere ? (mineHere.isSuspended ? 0 : (mineHere.creditLimit || 0) - (mineHere.currentDebt || 0)) : startOf.get(o.businessId) ?? 30);
      // the most this person can borrow here: what they return (with interest) must fit their limit
      const maxForYou = Math.min(o.maxAmount, Math.floor((Math.max(0, available) / (1 + o.interestPct / 100)) * 100) / 100);
      const levelOk = level <= o.minLevel;
      const fits = available + 0.005 >= p.total;
      out.push({
        available, maxForYou, levelOk, fits,
        blocked: !levelOk ? 'level' : !fits ? 'limit' : null,
        id: o.id, name: o.name, business: o.business, minAmount: o.minAmount, maxAmount: o.maxAmount, interestPct: o.interestPct,
        installments: o.installments, frequencyDays: o.frequencyDays, minLevel: o.minLevel, minLevelName: LEVEL_NAMES[o.minLevel],
        amount: a, total: p.total, each: p.each, eligible: levelOk && fits,
      });
    }
    out.sort((x, y) => Number(y.eligible) - Number(x.eligible) || x.total - y.total);
    return { level, levelName: LEVEL_NAMES[level], offers: out };
  }

  async request(user: any, body: any) {
    const offer = await this.prisma.loanOffer.findFirst({ where: { id: String(body?.offerId || ''), active: true } });
    if (!offer) throw new NotFoundException('Esa oferta ya no está disponible');
    await assertModule(this.prisma, offer.businessId, 'loans');
    const amount = round2(Number(body?.amount));
    if (!(amount >= offer.minAmount && amount <= offer.maxAmount)) throw new BadRequestException(`Esta oferta presta de $${offer.minAmount} a $${offer.maxAmount}`);
    const ids = await this.personIds(user);
    const level = await this.levelOfIds(ids);
    if (level > offer.minLevel) throw new BadRequestException(`Esta oferta es desde el nivel ${offer.minLevel} · ${LEVEL_NAMES[offer.minLevel]}`);

    // The person's client row at this lender (created the first time, with its starting limit)
    let client = ids.length ? await this.prisma.client.findFirst({ where: { id: { in: ids }, businessId: offer.businessId } }) : null;
    if (!client) {
      const cu = user?.cu ? await this.prisma.creditUser.findUnique({ where: { id: user.cu } }) : null;
      if (!cu) throw new BadRequestException('Crea tu cuenta de Syncro Credit para pedir préstamos');
      // Maybe the business already had this person as a client (typed the cédula some other way)
      client = await this.prisma.client.findFirst({ where: { businessId: offer.businessId, documentId: { in: documentIdVariants(cu.documentId), mode: 'insensitive' } } });
      if (client) {
        // Typing a cédula proves nothing: join it only with a verified phone that matches the business's
        const tail = (p: string | null | undefined) => String(p || '').replace(/\D/g, '').slice(-10);
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
    {
      const available = round2((client.creditLimit || 0) - (client.currentDebt || 0));
      const total = this.plan(amount, offer).total;
      if (available + 0.005 < total) {
        const max = Math.floor((Math.max(0, available) / (1 + offer.interestPct / 100)) * 100) / 100;
        throw new BadRequestException(
          max >= offer.minAmount
            ? `Con tu límite en este comercio ($${available.toFixed(2)}) puedes pedir hasta $${max.toFixed(2)}`
            : `Tu límite en este comercio ($${available.toFixed(2)}) no alcanza para el mínimo de esta oferta`,
        );
      }
    }
    const open = await this.prisma.loan.count({ where: { clientId: client.id, kind: 'CASH', status: { in: ['REQUESTED', 'APPROVED_PENDING_DISBURSEMENT'] } } });
    if (open) throw new BadRequestException('Ya tienes una solicitud abierta con este comercio');

    const p = this.plan(amount, offer);
    return this.prisma.loan.create({
      data: {
        clientId: client.id, businessId: offer.businessId, offerId: offer.id, kind: 'CASH', status: 'REQUESTED',
        amount, interestRate: offer.interestPct, totalToPay: p.total, remainingBalance: p.total,
        installmentsCount: p.n, frequencyDays: offer.frequencyDays,
      },
    });
  }

  /** The person's cash loans that aren't running yet (requested, approved with PIN, rejected) */
  async myRequests(user: any) {
    const ids = await this.personIds(user);
    if (!ids.length) return [];
    const loans = await this.prisma.loan.findMany({
      where: { clientId: { in: ids }, kind: 'CASH', status: { in: ['REQUESTED', 'APPROVED_PENDING_DISBURSEMENT', 'REJECTED'] } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    const biz = await this.prisma.business.findMany({ where: { id: { in: [...new Set(loans.map((l) => l.businessId!).filter(Boolean))] } }, select: { id: true, name: true, logo: true } });
    const branches = await this.prisma.branch.findMany({ where: { businessId: { in: biz.map((b) => b.id) }, isMain: true }, select: { businessId: true, location: true, name: true } });
    const bizOf = new Map(biz.map((b) => [b.id, b]));
    const branchOf = new Map(branches.map((b) => [b.businessId, b]));
    return loans
      .filter((l) => l.status !== 'REJECTED' || (l.decidedAt && Date.now() - l.decidedAt.getTime() < 7 * 86400000))
      .map((l) => {
        const expired = l.status === 'APPROVED_PENDING_DISBURSEMENT' && l.pinExpiresAt && l.pinExpiresAt < new Date();
        return {
          id: l.id, status: expired ? 'EXPIRED' : l.status, amount: l.amount, totalToPay: l.totalToPay, installments: l.installmentsCount,
          each: round2(l.totalToPay / Math.max(1, l.installmentsCount)), frequencyDays: l.frequencyDays, createdAt: l.createdAt,
          pin: l.status === 'APPROVED_PENDING_DISBURSEMENT' && !expired ? l.pin : null, pinExpiresAt: l.pinExpiresAt, rejectReason: l.rejectReason,
          business: bizOf.get(l.businessId!) ?? null, branch: branchOf.get(l.businessId!) ?? null,
        };
      });
  }

  async cancelRequest(user: any, id: string) {
    const ids = await this.personIds(user);
    const loan = await this.prisma.loan.findFirst({ where: { id, clientId: { in: ids }, kind: 'CASH', status: { in: ['REQUESTED', 'APPROVED_PENDING_DISBURSEMENT'] } } });
    if (!loan) throw new NotFoundException('Solicitud no encontrada');
    return this.prisma.loan.update({ where: { id }, data: { status: 'CANCELLED', pin: null, pinExpiresAt: null } });
  }
}
