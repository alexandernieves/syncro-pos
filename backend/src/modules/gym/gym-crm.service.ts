import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GymService } from './gym.service';
import { GymNotificationsService } from './gym-notifications.service';
import { GymRemindersService } from './gym-reminders.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';

const DAY = 24 * 60 * 60 * 1000;

export const LEAD_STAGES = ['NEW', 'CONTACTED', 'TRIAL_SCHEDULED', 'TRIAL_DONE', 'WON', 'LOST'] as const;
export const LEAD_SOURCES = ['WALK_IN', 'INSTAGRAM', 'FACEBOOK', 'TIKTOK', 'REFERRAL', 'WHATSAPP', 'WEB', 'GUEST', 'OTHER'] as const;
const STAGE_LABEL: Record<string, string> = {
  NEW: 'Nuevo',
  CONTACTED: 'Contactado',
  TRIAL_SCHEDULED: 'Prueba agendada',
  TRIAL_DONE: 'Prueba hecha',
  WON: 'Inscrito',
  LOST: 'Perdido',
};
const OPEN_STAGES = ['NEW', 'CONTACTED', 'TRIAL_SCHEDULED', 'TRIAL_DONE'];

type LeadInput = {
  name?: string;
  phone?: string | null;
  email?: string | null;
  documentId?: string | null;
  source?: string;
  interest?: string | null;
  notes?: string | null;
  ownerName?: string | null;
  nextFollowUpAt?: string | null;
  stage?: string;
  lostReason?: string | null;
};

const digits = (v?: string | null) => (v || '').replace(/\D/g, '');

/** Prospects: from the first contact to the trial class and the sign-up. */
@Injectable()
export class GymCrmService {
  constructor(
    private prisma: PrismaService,
    private gym: GymService,
    private notices: GymNotificationsService,
    private settings: GymRemindersService,
    private whatsapp: WhatsAppService,
  ) {}

  /** Writes to the prospect from the business WhatsApp and logs it in their timeline. */
  async message(businessId: string, id: string, text: string, userName?: string) {
    const lead = await this.prisma.gymLead.findFirst({ where: { id, businessId } });
    if (!lead) throw new NotFoundException('Prospecto no encontrado');
    if (!lead.phone) throw new BadRequestException('Este prospecto no tiene WhatsApp');
    if (!text?.trim()) throw new BadRequestException('Escribe el mensaje');
    if (!(await this.whatsapp.getStatus(businessId)).connected) throw new BadRequestException('El WhatsApp del negocio no está conectado');
    await this.whatsapp.sendTextMessage(lead.phone, text.trim(), businessId);
    return this.addActivity(businessId, id, { type: 'WHATSAPP', text: `Mensaje: ${text.trim()}` }, userName);
  }

  private include = {
    trialSession: { select: { id: true, startsAt: true, status: true, class: { select: { name: true, color: true } } } },
    member: { select: { id: true, memberNumber: true } },
    _count: { select: { activities: true, visits: true } },
  } satisfies Prisma.GymLeadInclude;

  async list(businessId: string, params: { q?: string; stage?: string; source?: string }) {
    const where: Prisma.GymLeadWhereInput = { businessId };
    if (params.stage) where.stage = params.stage;
    if (params.source) where.source = params.source;
    const q = (params.q || '').trim();
    if (q) {
      const d = digits(q);
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { documentId: { contains: q, mode: 'insensitive' } },
        ...(d.length >= 4 ? [{ phone: { contains: d.slice(-7) } }] : []),
      ];
    }
    return this.prisma.gymLead.findMany({ where, include: this.include, orderBy: [{ updatedAt: 'desc' }], take: 1000 });
  }

  async stats(businessId: string) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const since = new Date(now.getTime() - 90 * DAY);
    const [byStage, newThisMonth, wonThisMonth, closed90, overdue, trialsAhead, bySource] = await Promise.all([
      this.prisma.gymLead.groupBy({ by: ['stage'], where: { businessId }, _count: { _all: true } }),
      this.prisma.gymLead.count({ where: { businessId, createdAt: { gte: monthStart } } }),
      this.prisma.gymLead.count({ where: { businessId, stage: 'WON', wonAt: { gte: monthStart } } }),
      this.prisma.gymLead.groupBy({ by: ['stage'], where: { businessId, stage: { in: ['WON', 'LOST'] }, updatedAt: { gte: since } }, _count: { _all: true } }),
      this.prisma.gymLead.count({ where: { businessId, stage: { in: OPEN_STAGES }, nextFollowUpAt: { lt: now } } }),
      this.prisma.gymLead.count({ where: { businessId, stage: 'TRIAL_SCHEDULED', trialAt: { gte: now } } }),
      this.prisma.gymLead.groupBy({ by: ['source'], where: { businessId, createdAt: { gte: since } }, _count: { _all: true } }),
    ]);
    const won = closed90.find((r) => r.stage === 'WON')?._count._all ?? 0;
    const lost = closed90.find((r) => r.stage === 'LOST')?._count._all ?? 0;
    return {
      byStage: Object.fromEntries(LEAD_STAGES.map((s) => [s, byStage.find((r) => r.stage === s)?._count._all ?? 0])),
      newThisMonth,
      wonThisMonth,
      conversion: won + lost ? Math.round((won / (won + lost)) * 100) : null,
      overdueFollowUps: overdue,
      trialsAhead,
      bySource: bySource.map((r) => ({ source: r.source, count: r._count._all })).sort((a, b) => b.count - a.count),
    };
  }

  async get(businessId: string, id: string) {
    const lead = await this.prisma.gymLead.findFirst({
      where: { id, businessId },
      include: {
        ...this.include,
        activities: { orderBy: { createdAt: 'desc' }, take: 100 },
        visits: { orderBy: { checkedInAt: 'desc' }, take: 20, select: { id: true, kind: true, checkedInAt: true, price: true } },
      },
    });
    if (!lead) throw new NotFoundException('Prospecto no encontrado');
    return lead;
  }

  private clean(data: LeadInput) {
    if (data.source !== undefined && !LEAD_SOURCES.includes(data.source as any)) throw new BadRequestException('Origen inválido');
    const follow = data.nextFollowUpAt === undefined ? undefined : data.nextFollowUpAt ? new Date(data.nextFollowUpAt) : null;
    if (follow && Number.isNaN(follow.getTime())) throw new BadRequestException('Fecha de seguimiento inválida');
    return {
      ...(data.name !== undefined && { name: data.name.trim() }),
      ...(data.phone !== undefined && { phone: data.phone?.trim() || null }),
      ...(data.email !== undefined && { email: data.email?.trim() || null }),
      ...(data.documentId !== undefined && { documentId: data.documentId?.trim() || null }),
      ...(data.source !== undefined && { source: data.source }),
      ...(data.interest !== undefined && { interest: data.interest?.trim() || null }),
      ...(data.notes !== undefined && { notes: data.notes?.trim() || null }),
      ...(data.ownerName !== undefined && { ownerName: data.ownerName?.trim() || null }),
      ...(follow !== undefined && { nextFollowUpAt: follow }),
    };
  }

  /** An open prospect or a member with the same phone or cédula. */
  async findDuplicate(businessId: string, data: { phone?: string | null; documentId?: string | null }, exceptId?: string) {
    const phone = digits(data.phone).slice(-10);
    const doc = data.documentId?.trim();
    if (phone.length < 7 && !doc) return null;
    const or: Prisma.GymLeadWhereInput[] = [];
    if (phone.length >= 7) or.push({ phone: { contains: phone.slice(-7) } });
    if (doc) or.push({ documentId: { equals: doc, mode: 'insensitive' } });
    const lead = await this.prisma.gymLead.findFirst({ where: { businessId, stage: { in: OPEN_STAGES }, id: exceptId ? { not: exceptId } : undefined, OR: or } });
    if (lead && (!phone || digits(lead.phone).endsWith(phone.slice(-7)) || (doc && lead.documentId?.toLowerCase() === doc.toLowerCase()))) return { type: 'lead' as const, id: lead.id, name: lead.name };
    const member = await this.prisma.gymMember.findFirst({
      where: { businessId, client: { OR: [...(phone.length >= 7 ? [{ phone: { contains: phone.slice(-7) } }] : []), ...(doc ? [{ documentId: { equals: doc, mode: 'insensitive' as const } }] : [])] } },
      include: { client: { select: { name: true } } },
    });
    if (member) return { type: 'member' as const, id: member.id, name: member.client.name };
    return null;
  }

  async create(businessId: string, data: LeadInput, userName?: string) {
    if (!data.name?.trim()) throw new BadRequestException('Escribe el nombre del prospecto');
    if (!data.phone?.trim() && !data.email?.trim()) throw new BadRequestException('Anota un WhatsApp o un correo para poder contactarlo');
    const dup = await this.findDuplicate(businessId, data);
    if (dup?.type === 'member') throw new BadRequestException(`${dup.name} ya es socio del gimnasio`);
    if (dup?.type === 'lead') throw new BadRequestException(`Ya tienes a ${dup.name} como prospecto`);
    const lead = await this.prisma.gymLead.create({
      data: { businessId, name: data.name.trim(), ...this.clean({ ...data, name: undefined }), stage: 'NEW', nextFollowUpAt: data.nextFollowUpAt ? new Date(data.nextFollowUpAt) : new Date(Date.now() + DAY) },
      include: this.include,
    });
    await this.log(businessId, lead.id, 'STAGE', 'Prospecto creado', userName);
    return lead;
  }

  private log(businessId: string, leadId: string, type: string, text: string, userName?: string) {
    return this.prisma.gymLeadActivity.create({ data: { businessId, leadId, type, text, userName: userName || null } });
  }

  async update(businessId: string, id: string, data: LeadInput, userName?: string) {
    const lead = await this.prisma.gymLead.findFirst({ where: { id, businessId } });
    if (!lead) throw new NotFoundException('Prospecto no encontrado');
    if (data.name !== undefined && !data.name.trim()) throw new BadRequestException('Escribe el nombre del prospecto');
    if (data.phone !== undefined || data.documentId !== undefined) {
      const dup = await this.findDuplicate(businessId, { phone: data.phone ?? lead.phone, documentId: data.documentId ?? lead.documentId }, id);
      if (dup?.type === 'lead') throw new BadRequestException(`Ese WhatsApp o cédula ya es de ${dup.name}`);
    }
    const stageChange = data.stage !== undefined && data.stage !== lead.stage ? data.stage : null;
    if (stageChange) {
      if (!LEAD_STAGES.includes(stageChange as any)) throw new BadRequestException('Etapa inválida');
      if (stageChange === 'WON') throw new BadRequestException('Para inscribirlo usa «Convertir en socio»');
      if (stageChange === 'LOST' && !data.lostReason?.trim()) throw new BadRequestException('Escribe por qué se perdió');
      if (stageChange === 'TRIAL_SCHEDULED' && !lead.trialSessionId) throw new BadRequestException('Agenda la clase de prueba para pasarlo a esa etapa');
      if (lead.stage === 'WON') throw new BadRequestException('Este prospecto ya es socio');
    }
    const updated = await this.prisma.gymLead.update({
      where: { id },
      data: {
        ...this.clean(data),
        ...(stageChange && { stage: stageChange }),
        ...(stageChange === 'LOST' && { lostReason: data.lostReason!.trim(), lostAt: new Date(), nextFollowUpAt: null }),
        ...(stageChange && stageChange !== 'LOST' && { lostReason: null, lostAt: null }),
        // Leaving the trial stage frees the spot in the class
        ...(stageChange && ['NEW', 'CONTACTED', 'LOST'].includes(stageChange) && lead.trialSessionId && { trialSessionId: null, trialAt: null }),
      },
      include: this.include,
    });
    if (stageChange) {
      await this.log(businessId, id, 'STAGE', `${STAGE_LABEL[lead.stage]} → ${STAGE_LABEL[stageChange]}${stageChange === 'LOST' ? `: ${data.lostReason!.trim()}` : ''}`, userName);
    }
    return updated;
  }

  async addActivity(businessId: string, id: string, data: { type?: string; text?: string; nextFollowUpAt?: string | null }, userName?: string) {
    const lead = await this.prisma.gymLead.findFirst({ where: { id, businessId } });
    if (!lead) throw new NotFoundException('Prospecto no encontrado');
    const type = ['NOTE', 'CALL', 'WHATSAPP', 'VISIT'].includes(data.type || '') ? data.type! : 'NOTE';
    if (!data.text?.trim()) throw new BadRequestException('Escribe qué pasó');
    const activity = await this.log(businessId, id, type, data.text.trim(), userName);
    // Contacting a new prospect moves it forward on its own
    await this.prisma.gymLead.update({
      where: { id },
      data: {
        ...(lead.stage === 'NEW' && type !== 'NOTE' && { stage: 'CONTACTED' }),
        ...(data.nextFollowUpAt !== undefined && { nextFollowUpAt: data.nextFollowUpAt ? new Date(data.nextFollowUpAt) : null }),
      },
    });
    if (lead.stage === 'NEW' && type !== 'NOTE') await this.log(businessId, id, 'STAGE', `${STAGE_LABEL.NEW} → ${STAGE_LABEL.CONTACTED}`, userName);
    return activity;
  }

  /** Spots taken in a session: bookings plus prospects coming to try it. */
  static async takenSpots(tx: Prisma.TransactionClient | PrismaService, sessionId: string) {
    const [booked, trials] = await Promise.all([
      tx.gymBooking.count({ where: { sessionId, status: { in: ['BOOKED', 'ATTENDED'] } } }),
      tx.gymLead.count({ where: { trialSessionId: sessionId, stage: { in: ['TRIAL_SCHEDULED', 'TRIAL_DONE'] } } }),
    ]);
    return booked + trials;
  }

  async scheduleTrial(businessId: string, id: string, sessionId: string, userName?: string) {
    const lead = await this.prisma.gymLead.findFirst({ where: { id, businessId } });
    if (!lead) throw new NotFoundException('Prospecto no encontrado');
    if (lead.stage === 'WON') throw new BadRequestException('Este prospecto ya es socio');
    const session = await this.prisma.gymClassSession.findFirst({ where: { id: sessionId, businessId }, include: { class: { select: { name: true } } } });
    if (!session) throw new NotFoundException('Clase no encontrada');
    if (session.status !== 'SCHEDULED') throw new BadRequestException('Esa clase está cancelada');
    if (session.startsAt < new Date()) throw new BadRequestException('Esa clase ya empezó');
    if (lead.trialSessionId !== sessionId && (await GymCrmService.takenSpots(this.prisma, sessionId)) >= session.capacity) {
      throw new BadRequestException(`${session.class.name} está llena a esa hora. Elige otra clase`);
    }
    const updated = await this.prisma.gymLead.update({
      where: { id },
      data: { trialSessionId: sessionId, trialAt: session.startsAt, stage: 'TRIAL_SCHEDULED', lostReason: null, lostAt: null, nextFollowUpAt: session.endsAt },
      include: this.include,
    });
    const { timeZone } = await this.settings.getSettings(businessId);
    await this.log(businessId, id, 'TRIAL', `Clase de prueba: ${session.class.name}, ${GymNotificationsService.when(session.startsAt, timeZone)}`, userName);
    const notified = await this.notices.notifyTrial(businessId, lead, sessionId);
    return { ...updated, notified };
  }

  /** After the trial: it came (TRIAL_DONE) or it didn't (back to contacted, spot freed). */
  async trialResult(businessId: string, id: string, attended: boolean, userName?: string) {
    const lead = await this.prisma.gymLead.findFirst({ where: { id, businessId } });
    if (!lead) throw new NotFoundException('Prospecto no encontrado');
    if (lead.stage !== 'TRIAL_SCHEDULED') throw new BadRequestException('No tiene una clase de prueba agendada');
    const updated = await this.prisma.gymLead.update({
      where: { id },
      data: attended
        ? { stage: 'TRIAL_DONE', nextFollowUpAt: new Date(Date.now() + DAY) }
        : { stage: 'CONTACTED', trialSessionId: null, trialAt: null, nextFollowUpAt: new Date(Date.now() + DAY) },
      include: this.include,
    });
    await this.log(businessId, id, 'TRIAL', attended ? 'Vino a la clase de prueba' : 'No vino a la clase de prueba', userName);
    return updated;
  }

  /** Signs the prospect up as a member (reusing the client if the cédula exists). */
  async convert(businessId: string, id: string, userName?: string) {
    const lead = await this.prisma.gymLead.findFirst({ where: { id, businessId } });
    if (!lead) throw new NotFoundException('Prospecto no encontrado');
    if (lead.stage === 'WON' && lead.memberId) return { lead, memberId: lead.memberId };
    const member = await this.gym.createMember(businessId, { name: lead.name, documentId: lead.documentId ?? undefined, phone: lead.phone ?? undefined, email: lead.email ?? undefined, goal: lead.interest ?? undefined });
    const updated = await this.prisma.gymLead.update({
      where: { id },
      data: { stage: 'WON', memberId: member.id, wonAt: new Date(), nextFollowUpAt: null, lostReason: null, lostAt: null },
      include: this.include,
    });
    await this.log(businessId, id, 'STAGE', `${STAGE_LABEL[lead.stage]} → ${STAGE_LABEL.WON} (socio n.º ${member.memberNumber})`, userName);
    return { lead: updated, memberId: member.id };
  }
}
