import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { gymBranch, inBranch, memberInBranch } from './gym-branch';
import { PrismaService } from '../prisma/prisma.service';
import { GymService } from './gym.service';
import { GymCrmService } from './gym-crm.service';
import { GymRemindersService } from './gym-reminders.service';

const DAY = 24 * 60 * 60 * 1000;
export const VISIT_KINDS = ['GUEST', 'DAY_PASS', 'VISITOR'] as const;
const KIND_LABEL: Record<string, string> = { GUEST: 'Invitado', DAY_PASS: 'Pase de día', VISITOR: 'Visita' };

type VisitInput = {
  kind?: string;
  name?: string;
  documentId?: string | null;
  phone?: string | null;
  hostMemberId?: string | null;
  notes?: string | null;
  /** Day pass price when the reception changes it (promo, kids…). */
  price?: number;
  payment?: { method: string; reference?: string; exchangeRate?: number; branchId?: string };
};

/** Start of the current month in the gym's time zone, as an instant. */
function monthStart(timeZone: string) {
  const [y, m] = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit' }).format(new Date()).split('-').map(Number);
  const guess = new Date(Date.UTC(y, m - 1, 1));
  const local = new Date(guess.toLocaleString('en-US', { timeZone }));
  return new Date(guess.getTime() - (local.getTime() - guess.getTime()));
}

/** People who come in without a membership: members' guests, day passes, visitors. */
@Injectable()
export class GymVisitsService {
  constructor(
    private prisma: PrismaService,
    private gym: GymService,
    private crm: GymCrmService,
    private settings: GymRemindersService,
  ) {}

  /** Free guest passes the member has left this month. */
  async guestQuota(businessId: string, memberId: string) {
    const member = await this.prisma.gymMember.findFirst({
      where: { id: memberId, businessId },
      include: { client: { select: { name: true } }, memberships: { where: { status: 'ACTIVE', startDate: { lte: new Date() }, endDate: { gte: new Date() } }, include: { plan: true }, take: 1 } },
    });
    if (!member) throw new NotFoundException('Socio no encontrado');
    const { timeZone } = await this.settings.getSettings(businessId);
    const allowed = member.memberships[0]?.plan.guestPassesPerMonth ?? 0;
    const used = await this.prisma.gymVisit.count({ where: { businessId, hostMemberId: memberId, kind: 'GUEST', price: 0, checkedInAt: { gte: monthStart(timeZone) } } });
    return { memberId, name: member.client.name, planName: member.memberships[0]?.planName ?? null, allowed, used, left: Math.max(0, allowed - used) };
  }

  async list(businessId: string, day?: string) {
    const { timeZone } = await this.settings.getSettings(businessId);
    const local = day || new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date());
    const [y, m, d] = local.split('-').map(Number);
    const guess = new Date(Date.UTC(y, m - 1, d));
    const offset = new Date(guess.toLocaleString('en-US', { timeZone })).getTime() - guess.getTime();
    const from = new Date(guess.getTime() - offset);
    const to = new Date(from.getTime() + DAY);
    const items = await this.prisma.gymVisit.findMany({
      where: { businessId, ...inBranch(), checkedInAt: { gte: from, lt: to } },
      orderBy: { checkedInAt: 'desc' },
      include: {
        hostMember: { select: { id: true, memberNumber: true, client: { select: { name: true } } } },
        lead: { select: { id: true, stage: true } },
        payments: { select: { amount: true, method: true } },
      },
    });
    const revenue = items.reduce((t, v) => t + v.payments.reduce((s, p) => s + p.amount, 0), 0);
    return { day: local, items, revenue: Math.round(revenue * 100) / 100, inside: items.filter((v) => !v.checkedOutAt).length };
  }

  /** How many times this person came before (by cédula or phone), to offer them a plan. */
  private async previousVisits(businessId: string, documentId?: string | null, phone?: string | null) {
    const p = (phone || '').replace(/\D/g, '').slice(-7);
    const or = [...(documentId ? [{ documentId: { equals: documentId, mode: 'insensitive' as const } }] : []), ...(p.length === 7 ? [{ phone: { contains: p } }] : [])];
    return or.length ? this.prisma.gymVisit.count({ where: { businessId, OR: or } }) : 0;
  }

  async create(businessId: string, data: VisitInput, userId?: string, userName?: string) {
    const kind = data.kind as (typeof VISIT_KINDS)[number];
    if (!VISIT_KINDS.includes(kind)) throw new BadRequestException('Elige el tipo de visita');
    if (!data.name?.trim()) throw new BadRequestException('Escribe el nombre');
    const settings = await this.settings.getSettings(businessId);

    let price = 0;
    let host: Awaited<ReturnType<GymVisitsService['guestQuota']>> | null = null;
    if (kind === 'GUEST') {
      if (!data.hostMemberId) throw new BadRequestException('Elige el socio que lo invita');
      const access = await this.gym.evaluateAccess(businessId, data.hostMemberId);
      if (!access.granted) throw new BadRequestException(`${access.member.client.name} no puede invitar: ${access.reason.toLowerCase()}`);
      host = await this.guestQuota(businessId, data.hostMemberId);
      // No free passes left: the guest pays like a day pass
      price = host.left > 0 ? 0 : data.price !== undefined ? Number(data.price) : settings.visits.dayPassPrice;
    } else if (kind === 'DAY_PASS') {
      price = data.price !== undefined ? Number(data.price) : settings.visits.dayPassPrice;
    }
    price = Math.max(0, Math.round((Number.isFinite(price) ? price : 0) * 100) / 100);
    if (price > 0 && !data.payment?.method) throw new BadRequestException(`Cobra el pase ($${price.toFixed(2)}) para registrar la entrada`);

    const before = await this.previousVisits(businessId, data.documentId, data.phone);
    const visit = await this.prisma.$transaction(async (tx) => {
      const v = await tx.gymVisit.create({
        data: {
          businessId,
          branchId: gymBranch(),
          kind,
          name: data.name!.trim(),
          documentId: data.documentId?.trim() || null,
          phone: data.phone?.trim() || null,
          hostMemberId: kind === 'GUEST' ? data.hostMemberId! : null,
          price,
          notes: data.notes?.trim() || null,
          createdById: userId || null,
        },
      });
      if (price > 0) {
        const label = kind === 'GUEST' ? `Pase de invitado · ${v.name}${host ? ` (de ${host.name})` : ''}` : `Pase de día · ${v.name}`;
        await this.gym.recordPayment(tx, businessId, { visitId: v.id, description: label, itemName: kind === 'GUEST' ? 'Pase de invitado' : 'Pase de día', category: 'PASE_GYM' }, { ...data.payment!, amount: price }, userId);
      }
      return v;
    });

    // Someone who trained here without a plan is a prospect worth following up
    let leadId: string | null = null;
    if (kind !== 'VISITOR' && settings.visits.leadFromVisit && (visit.phone || visit.documentId)) {
      const dup = await this.crm.findDuplicate(businessId, { phone: visit.phone, documentId: visit.documentId });
      if (dup?.type === 'lead') leadId = dup.id;
      else if (!dup && visit.phone) {
        const lead = await this.crm.create(businessId, { name: visit.name, phone: visit.phone, documentId: visit.documentId, source: kind === 'GUEST' ? 'GUEST' : 'WALK_IN', interest: null }, userName).catch(() => null);
        leadId = lead?.id ?? null;
      }
      if (leadId) {
        await this.prisma.gymVisit.update({ where: { id: visit.id }, data: { leadId } });
        await this.crm.addActivity(businessId, leadId, { type: 'VISIT', text: `${KIND_LABEL[kind]}${host ? ` de ${host.name}` : ''}${price > 0 ? ` · pagó $${price.toFixed(2)}` : ' · sin costo'}` }, userName);
      }
    }
    return { visit: { ...visit, leadId }, price, host, previousVisits: before };
  }

  async checkout(businessId: string, id: string) {
    const visit = await this.prisma.gymVisit.findFirst({ where: { id, businessId } });
    if (!visit) throw new NotFoundException('Visita no encontrada');
    if (visit.checkedOutAt) return visit;
    return this.prisma.gymVisit.update({ where: { id }, data: { checkedOutAt: new Date() } });
  }
}
