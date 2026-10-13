import { BadRequestException, ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { branchCurrencies, cashDue, fromUsd, ratesFrom } from '../../common/currency';
import { GymService, membershipOwed } from './gym.service';
import { GymClassesService } from './gym-classes.service';
import { GymCrmService } from './gym-crm.service';
import { GymVisitsService } from './gym-visits.service';
import { GymRemindersService } from './gym-reminders.service';
import { runInBranch } from './gym-branch';

const DAY = 24 * 60 * 60 * 1000;
const digits = (v?: string | null) => String(v ?? '').replace(/\D/g, '');
/** Last 10 digits: the same number written with or without the country code. */
const phoneKey = (v?: string | null) => digits(v).slice(-10);

/**
 * API for the WhatsApp agent (Koenyx): it looks people up by phone, shows branches, plans and
 * classes, books and cancels classes and schedules trial classes. Authenticated with a key per
 * business; the answers carry only what the agent needs (no health notes, no payments detail).
 */
@Injectable()
export class GymAgentService {
  /** Keys already checked, so bcrypt doesn't run on every call. */
  private verified = new Map<string, { businessId: string; keyId: string; at: number }>();

  constructor(
    private prisma: PrismaService,
    private gym: GymService,
    private classesService: GymClassesService,
    private crm: GymCrmService,
    private visits: GymVisitsService,
    private settings: GymRemindersService,
  ) {}

  // ── Keys ────────────────────────────────────────────────────────────────────

  listKeys(businessId: string) {
    return this.prisma.gymApiKey.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, keyPrefix: true, lastUsedAt: true, revokedAt: true, createdAt: true },
    });
  }

  /** The full key is shown only once, here. */
  async createKey(businessId: string, name?: string) {
    const prefix = randomBytes(4).toString('hex');
    const key = `syk_${prefix}_${randomBytes(24).toString('base64url')}`;
    const row = await this.prisma.gymApiKey.create({
      data: { businessId, name: name?.trim() || 'Agente de WhatsApp', keyPrefix: prefix, keyHash: await bcrypt.hash(key, 10) },
      select: { id: true, name: true, keyPrefix: true, createdAt: true },
    });
    return { ...row, key };
  }

  async revokeKey(businessId: string, id: string) {
    const row = await this.prisma.gymApiKey.findFirst({ where: { id, businessId } });
    if (!row) throw new NotFoundException('Clave no encontrada');
    for (const [k, v] of this.verified) if (v.keyId === id) this.verified.delete(k);
    return this.prisma.gymApiKey.update({ where: { id }, data: { revokedAt: new Date() }, select: { id: true, revokedAt: true } });
  }

  async authenticate(header?: string) {
    const key = String(header || '').replace(/^Bearer\s+/i, '').trim();
    const m = /^syk_([0-9a-f]{8})_[A-Za-z0-9_-]{20,}$/.exec(key);
    if (!m) throw new UnauthorizedException('Falta la clave de Syncro (Authorization: Bearer syk_…)');
    const hit = this.verified.get(key);
    if (hit && Date.now() - hit.at < 5 * 60_000) return hit.businessId;
    const row = await this.prisma.gymApiKey.findUnique({ where: { keyPrefix: m[1] } });
    if (!row || row.revokedAt || !(await bcrypt.compare(key, row.keyHash))) throw new UnauthorizedException('Clave de Syncro inválida o revocada');
    this.verified.set(key, { businessId: row.businessId, keyId: row.id, at: Date.now() });
    this.prisma.gymApiKey.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
    return row.businessId;
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private async ctx(businessId: string) {
    const [settings, gymSettings] = await Promise.all([this.prisma.setting.findFirst({ where: { businessId } }), this.settings.getSettings(businessId)]);
    const tz = gymSettings.timeZone;
    // "martes, 13 de octubre, 7:00 p. m": without the last period, so sentences can end after it
    const when = (d: Date) => d.toLocaleString('es-VE', { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' }).replace(/\.$/, '');
    const day = (d: Date) => d.toLocaleDateString('es-VE', { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long' });
    return { rates: ratesFrom(settings), tz, when, day, gymName: settings?.businessName || 'el gimnasio' };
  }

  private async branchOf(businessId: string, branchId?: string) {
    if (!branchId) {
      const main = await this.prisma.branch.findFirst({ where: { businessId }, orderBy: [{ isMain: 'desc' }, { createdAt: 'asc' }] });
      if (!main) throw new NotFoundException('El negocio no tiene sedes');
      return main;
    }
    const b = await this.prisma.branch.findFirst({ where: { id: branchId, businessId } });
    if (!b) throw new NotFoundException('Sede no encontrada. Usa listar_sedes para ver las sedes');
    return b;
  }

  private async membersByPhone(businessId: string, phone: string) {
    const key = phoneKey(phone);
    if (key.length < 7) throw new BadRequestException('Número de teléfono inválido');
    return this.prisma.gymMember.findMany({ where: { businessId, client: { phone: { endsWith: key } } }, include: { client: { select: { name: true, phone: true } } } });
  }

  /** The member who wrote; with several members on one phone, `memberId` picks one. */
  private async memberFor(businessId: string, phone: string, memberId?: string) {
    const found = await this.membersByPhone(businessId, phone);
    if (memberId) {
      const m = found.find((x) => x.id === memberId);
      if (!m) throw new NotFoundException('Ese socio no tiene este número');
      return m;
    }
    if (!found.length) throw new NotFoundException('No hay ningún socio con este número. Si quiere probar el gimnasio, usa agendar_clase_prueba');
    if (found.length > 1) throw new ConflictException({ message: 'Hay varios socios con este número: pregúntale su nombre y envía memberId', members: found.map((m) => ({ memberId: m.id, name: m.client.name })) });
    return found[0];
  }

  // ── What the agent can ask ──────────────────────────────────────────────────

  async branches(businessId: string) {
    const rows = await this.prisma.branch.findMany({ where: { businessId }, orderBy: [{ isMain: 'desc' }, { createdAt: 'asc' }] });
    return rows.map((b) => ({ branchId: b.id, name: b.name, isMain: b.isMain, address: b.location, state: b.state, phone: b.phone, currencies: branchCurrencies(b.state) }));
  }

  async contact(businessId: string, phone: string) {
    const { when, day } = await this.ctx(businessId);
    const members = await this.membersByPhone(businessId, phone);
    if (members.length) {
      const now = new Date();
      const out = [];
      for (const m of members) {
        const detail = await this.gym.getMember(businessId, m.id);
        const current: any = detail.currentMembership;
        const quota = await this.visits.guestQuota(businessId, m.id).catch(() => null);
        const upcoming = await this.prisma.gymBooking.findMany({
          where: { memberId: m.id, status: { in: ['BOOKED', 'WAITLIST'] }, session: { startsAt: { gte: now } } },
          orderBy: { session: { startsAt: 'asc' } },
          take: 10,
          include: { session: { include: { class: { select: { name: true } } } } },
        });
        out.push({
          memberId: m.id,
          name: detail.client.name,
          memberNumber: detail.memberNumber,
          branch: detail.branchId ? { branchId: detail.branchId, name: detail.branchName } : null,
          validInAllBranches: !!detail.allBranches,
          status: detail.status,
          plan: current ? { name: current.planName, startDate: day(new Date(current.startDate)), endDate: day(new Date(current.endDate)), endsAt: current.endDate, daysLeft: detail.daysLeft } : null,
          owedUsd: current ? membershipOwed(current) : 0,
          guestPasses: quota ? { allowed: quota.allowed, left: quota.left } : null,
          bookings: upcoming.map((b) => ({ sessionId: b.sessionId, className: b.session.class.name, when: when(b.session.startsAt), startsAt: b.session.startsAt, status: b.status })),
        });
      }
      return { type: 'member', members: out };
    }
    const key = phoneKey(phone);
    const lead = await this.prisma.gymLead.findFirst({ where: { businessId, phone: { endsWith: key } }, orderBy: { updatedAt: 'desc' }, include: { trialSession: { include: { class: { select: { name: true } } } } } });
    if (lead) {
      return {
        type: 'prospect',
        prospect: {
          prospectId: lead.id,
          name: lead.name,
          stage: lead.stage,
          branchId: lead.branchId,
          trial: lead.trialSession ? { sessionId: lead.trialSessionId, className: lead.trialSession.class.name, when: when(lead.trialSession.startsAt), startsAt: lead.trialSession.startsAt } : null,
        },
      };
    }
    return { type: 'unknown' };
  }

  async plans(businessId: string, branchId?: string) {
    const { rates } = await this.ctx(businessId);
    const branch = await this.branchOf(businessId, branchId);
    const cop = branchCurrencies(branch.state).includes('COP') && rates.COP > 0;
    const plans = await this.prisma.gymPlan.findMany({ where: { businessId, isActive: true }, orderBy: { durationDays: 'asc' } });
    return plans.map((p) => ({
      planId: p.id,
      name: p.name,
      description: p.description,
      durationDays: p.durationDays,
      price: { usd: p.price, ves: fromUsd(p.price, 'VES', rates), ...(cop && { copCash: cashDue(fromUsd(p.price, 'COP', rates), 'COP') }) },
      includesClasses: p.includesClasses,
      validInAllBranches: p.allBranches,
      guestPassesPerMonth: p.guestPassesPerMonth,
      maxFreezeDays: p.maxFreezeDays,
      accessWindows: p.accessWindows,
    }));
  }

  /** Classes of a branch with free spots, from today for `days` days (7 by default, up to 14). */
  async classes(businessId: string, branchId?: string, fromDay?: string, daysParam?: string) {
    const { tz, when } = await this.ctx(businessId);
    const branch = await this.branchOf(businessId, branchId);
    const days = Math.min(14, Math.max(1, Number(daysParam) || 7));
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
    const from = /^\d{4}-\d{2}-\d{2}$/.test(fromDay || '') ? fromDay! : today;
    const to = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date(new Date(`${from}T12:00:00Z`).getTime() + days * DAY));
    const { sessions } = await runInBranch(branch.id, () => this.classesService.schedule(businessId, from, to));
    const now = Date.now();
    return {
      branch: { branchId: branch.id, name: branch.name },
      sessions: sessions
        .filter((s: any) => s.status === 'SCHEDULED' && new Date(s.startsAt).getTime() > now)
        .map((s: any) => ({
          sessionId: s.id,
          className: s.class.name,
          room: s.class.room ?? null,
          trainer: s.trainer?.name ?? null,
          when: when(new Date(s.startsAt)),
          startsAt: s.startsAt,
          endsAt: s.endsAt,
          capacity: s.capacity,
          spotsLeft: Math.max(0, s.capacity - s.booked),
          waitlist: s.waitlist,
        })),
    };
  }

  async book(businessId: string, data: { phone: string; sessionId: string; memberId?: string }) {
    if (!data?.sessionId) throw new BadRequestException('Falta sessionId (usa ver_clases)');
    const { when } = await this.ctx(businessId);
    const member = await this.memberFor(businessId, data.phone, data.memberId);
    const booking = await this.classesService.book(businessId, data.sessionId, member.id, 'AGENT');
    const session = await this.prisma.gymClassSession.findUnique({ where: { id: data.sessionId }, include: { class: { select: { name: true } } } });
    return {
      status: booking.status,
      message: booking.status === 'WAITLIST'
        ? `La clase está llena: ${member.client.name} quedó en lista de espera de ${session?.class.name}, ${when(session!.startsAt)}. Si se libera un cupo, queda anotado solo.`
        : `${member.client.name} quedó anotado en ${session?.class.name}, ${when(session!.startsAt)}.`,
    };
  }

  async cancelBooking(businessId: string, data: { phone: string; sessionId: string; memberId?: string }) {
    if (!data?.sessionId) throw new BadRequestException('Falta sessionId');
    const member = await this.memberFor(businessId, data.phone, data.memberId);
    const booking = await this.prisma.gymBooking.findFirst({ where: { businessId, sessionId: data.sessionId, memberId: member.id, status: { in: ['BOOKED', 'WAITLIST'] } } });
    if (!booking) throw new NotFoundException(`${member.client.name} no está anotado en esa clase`);
    await this.classesService.setBookingStatus(businessId, booking.id, 'CANCELLED');
    return { status: 'CANCELLED', message: `Listo, ${member.client.name} ya no está anotado en esa clase.` };
  }

  /**
   * Trial class for someone who isn't a member: finds or creates the prospect (in the branch of
   * the class) and books the trial. The agent confirms in its own chat, so no notice is sent.
   */
  async trial(businessId: string, data: { name: string; phone: string; sessionId: string; documentId?: string; interest?: string }) {
    if (!data?.name?.trim()) throw new BadRequestException('Falta el nombre');
    if (phoneKey(data.phone).length < 7) throw new BadRequestException('Número de teléfono inválido');
    if (!data.sessionId) throw new BadRequestException('Falta sessionId (usa ver_clases)');
    const { when } = await this.ctx(businessId);
    const session = await this.prisma.gymClassSession.findFirst({ where: { id: data.sessionId, businessId }, include: { class: { select: { name: true } } } });
    if (!session) throw new NotFoundException('Clase no encontrada');
    const branch = await this.branchOf(businessId, session.branchId ?? undefined);
    const phone = digits(data.phone);

    return runInBranch(branch.id, async () => {
      const dup = await this.crm.findDuplicate(businessId, { phone, documentId: data.documentId || null });
      if (dup?.type === 'member') throw new ConflictException(`${dup.name} ya es socio: usa reservar_clase`);
      const lead = dup?.type === 'lead'
        ? { id: dup.id }
        : await this.crm.create(businessId, { name: data.name.trim(), phone, documentId: data.documentId || undefined, interest: data.interest || undefined, source: 'WHATSAPP' } as any, 'Agente de WhatsApp');
      await this.crm.scheduleTrial(businessId, lead.id, session.id, 'Agente de WhatsApp', false);
      return {
        prospectId: lead.id,
        status: 'TRIAL_SCHEDULED',
        message: `Clase de prueba agendada para ${data.name.trim()}: ${session.class.name}, ${when(session.startsAt)}, en ${branch.name}.`,
      };
    });
  }
}
