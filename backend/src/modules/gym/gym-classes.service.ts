import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { gymBranch, inBranch } from './gym-branch';
import { PrismaService } from '../prisma/prisma.service';
import { GymRemindersService } from './gym-reminders.service';
import { GymNotificationsService } from './gym-notifications.service';
import { GymCrmService } from './gym-crm.service';
import { membershipState } from './gym.service';

const DAY = 24 * 60 * 60 * 1000;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Offset (ms) of a time zone at a given instant. */
function tzOffset(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second')) - date.getTime();
}
/** The instant of a local wall-clock time in the gym's time zone. */
function zoned(y: number, m: number, d: number, hh: number, mm: number, timeZone: string) {
  const guess = new Date(Date.UTC(y, m - 1, d, hh, mm));
  return new Date(guess.getTime() - tzOffset(guess, timeZone));
}
function parseDay(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
  if (!match) throw new BadRequestException('Fecha inválida (usa AAAA-MM-DD)');
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

type TrainerInput = { name: string; phone?: string; specialty?: string; photoUrl?: string | null; color?: string; role?: string; hourlyRate?: number | null; isActive?: boolean };
export const STAFF_ROLES = ['TRAINER', 'RECEPTION', 'MANAGER', 'CLEANING', 'OTHER'];
type ClassInput = {
  name: string;
  description?: string;
  color?: string;
  trainerId?: string | null;
  daysOfWeek: number[];
  startTime: string;
  durationMin: number;
  capacity: number;
  room?: string;
  isActive?: boolean;
  /** Prospects can book their free trial in it */
  allowTrial?: boolean;
};

@Injectable()
export class GymClassesService {
  constructor(
    private prisma: PrismaService,
    private settings: GymRemindersService,
    private notices: GymNotificationsService,
  ) {}

  /** Members holding a spot (or waiting for one) in a session. */
  private async activeMemberIds(sessionId: string) {
    const rows = await this.prisma.gymBooking.findMany({ where: { sessionId, status: { in: ['BOOKED', 'WAITLIST'] } }, select: { memberId: true } });
    return rows.map((r) => r.memberId);
  }

  // ── Trainers ───────────────────────────────────────────────────────────────

  listTrainers(businessId: string) {
    return this.prisma.gymTrainer.findMany({
      where: { businessId, ...inBranch() },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      include: { _count: { select: { classes: true } }, availability: { orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }] } },
    });
  }

  createTrainer(businessId: string, data: TrainerInput) {
    if (!data.name?.trim()) throw new BadRequestException('Escribe el nombre');
    if (data.role && !STAFF_ROLES.includes(data.role)) throw new BadRequestException('Rol inválido');
    return this.prisma.gymTrainer.create({
      data: {
        businessId,
        branchId: gymBranch(),
        name: data.name.trim(),
        phone: data.phone?.trim() || null,
        specialty: data.specialty?.trim() || null,
        photoUrl: data.photoUrl || null,
        color: data.color || null,
        role: data.role || 'TRAINER',
        hourlyRate: data.hourlyRate != null && Number(data.hourlyRate) > 0 ? Math.round(Number(data.hourlyRate) * 100) / 100 : null,
      },
    });
  }

  async updateTrainer(businessId: string, id: string, data: Partial<TrainerInput>) {
    if (!(await this.prisma.gymTrainer.findFirst({ where: { id, businessId } }))) throw new NotFoundException('Entrenador no encontrado');
    if (data.name !== undefined && !data.name.trim()) throw new BadRequestException('Escribe el nombre');
    if (data.role !== undefined && !STAFF_ROLES.includes(data.role)) throw new BadRequestException('Rol inválido');
    return this.prisma.gymTrainer.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name.trim() }),
        ...(data.phone !== undefined && { phone: data.phone?.trim() || null }),
        ...(data.specialty !== undefined && { specialty: data.specialty?.trim() || null }),
        ...(data.photoUrl !== undefined && { photoUrl: data.photoUrl || null }),
        ...(data.color !== undefined && { color: data.color || null }),
        ...(data.role !== undefined && { role: data.role }),
        ...(data.hourlyRate !== undefined && { hourlyRate: data.hourlyRate != null && Number(data.hourlyRate) > 0 ? Math.round(Number(data.hourlyRate) * 100) / 100 : null }),
        ...(data.isActive !== undefined && { isActive: !!data.isActive }),
      },
    });
  }

  // ── Weekly classes ─────────────────────────────────────────────────────────

  listClasses(businessId: string) {
    return this.prisma.gymClass.findMany({ where: { businessId, ...inBranch() }, orderBy: [{ isActive: 'desc' }, { startTime: 'asc' }], include: { trainer: { select: { id: true, name: true } } } });
  }

  private async validateClass(businessId: string, data: Partial<ClassInput>, partial = false) {
    if (!partial || data.name !== undefined) if (!data.name?.trim()) throw new BadRequestException('Escribe el nombre de la clase');
    if (!partial || data.startTime !== undefined) if (!TIME_RE.test(data.startTime || '')) throw new BadRequestException('Hora inválida (usa HH:MM)');
    if (!partial || data.daysOfWeek !== undefined) {
      const days = data.daysOfWeek || [];
      if (!days.length || days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) throw new BadRequestException('Elige al menos un día de la semana');
    }
    if (!partial || data.durationMin !== undefined) if (!(Number(data.durationMin) >= 10 && Number(data.durationMin) <= 600)) throw new BadRequestException('La duración debe estar entre 10 y 600 minutos');
    if (!partial || data.capacity !== undefined) if (!(Number(data.capacity) >= 1)) throw new BadRequestException('El cupo debe ser de al menos 1 persona');
    if (data.trainerId) {
      if (!(await this.prisma.gymTrainer.findFirst({ where: { id: data.trainerId, businessId } }))) throw new BadRequestException('Entrenador no encontrado');
    }
  }

  async createClass(businessId: string, data: ClassInput) {
    await this.validateClass(businessId, data);
    return this.prisma.gymClass.create({
      data: {
        businessId,
        branchId: gymBranch(),
        name: data.name.trim(),
        description: data.description?.trim() || null,
        color: data.color || null,
        trainerId: data.trainerId || null,
        daysOfWeek: [...new Set(data.daysOfWeek)].sort(),
        startTime: data.startTime,
        durationMin: Math.round(Number(data.durationMin)),
        capacity: Math.round(Number(data.capacity)),
        room: data.room?.trim() || null,
        allowTrial: data.allowTrial !== false,
      },
    });
  }

  /**
   * Updates the class. Future sessions without bookings are regenerated from the new schedule;
   * sessions that already have bookings keep their time.
   */
  async updateClass(businessId: string, id: string, data: Partial<ClassInput>) {
    const current = await this.prisma.gymClass.findFirst({ where: { id, businessId } });
    if (!current) throw new NotFoundException('Clase no encontrada');
    await this.validateClass(businessId, data, true);
    const updated = await this.prisma.gymClass.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name.trim() }),
        ...(data.description !== undefined && { description: data.description?.trim() || null }),
        ...(data.color !== undefined && { color: data.color || null }),
        ...(data.trainerId !== undefined && { trainerId: data.trainerId || null }),
        ...(data.daysOfWeek !== undefined && { daysOfWeek: [...new Set(data.daysOfWeek)].sort() }),
        ...(data.startTime !== undefined && { startTime: data.startTime }),
        ...(data.durationMin !== undefined && { durationMin: Math.round(Number(data.durationMin)) }),
        ...(data.capacity !== undefined && { capacity: Math.round(Number(data.capacity)) }),
        ...(data.room !== undefined && { room: data.room?.trim() || null }),
        ...(data.isActive !== undefined && { isActive: !!data.isActive }),
        ...(data.allowTrial !== undefined && { allowTrial: !!data.allowTrial }),
      },
    });
    // Moved and one-time sessions were set by hand: they stay as they are
    await this.prisma.gymClassSession.deleteMany({ where: { classId: id, startsAt: { gt: new Date() }, bookings: { none: {} }, isExtra: false, originalStartsAt: null } });
    // Booked future sessions follow the new trainer and capacity
    await this.prisma.gymClassSession.updateMany({
      where: { classId: id, startsAt: { gt: new Date() } },
      data: { trainerId: updated.trainerId, capacity: updated.capacity },
    });
    return updated;
  }

  // ── Schedule (dated sessions) ──────────────────────────────────────────────

  /** Creates the sessions of active classes for `days` days from `from` (local date) if missing. */
  private async ensureRange(businessId: string, from: { y: number; m: number; d: number }, days: number, timeZone: string) {
    const classes = await this.prisma.gymClass.findMany({ where: { businessId, isActive: true } });
    const rows: any[] = [];
    for (let i = 0; i < days; i++) {
      const date = new Date(Date.UTC(from.y, from.m - 1, from.d) + i * DAY);
      const dow = date.getUTCDay();
      for (const c of classes) {
        if (!c.daysOfWeek.includes(dow)) continue;
        const [hh, mm] = c.startTime.split(':').map(Number);
        const startsAt = zoned(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), hh, mm, timeZone);
        rows.push({ businessId, branchId: c.branchId, classId: c.id, trainerId: c.trainerId, startsAt, endsAt: new Date(startsAt.getTime() + c.durationMin * 60000), capacity: c.capacity });
      }
    }
    if (!rows.length) return;
    // A weekly slot whose session was moved elsewhere must not come back
    const moved = await this.prisma.gymClassSession.findMany({
      where: { businessId, originalStartsAt: { in: rows.map((r) => r.startsAt) } },
      select: { classId: true, originalStartsAt: true },
    });
    const movedKeys = new Set(moved.map((m) => `${m.classId}|${m.originalStartsAt!.getTime()}`));
    const fresh = rows.filter((r) => !movedKeys.has(`${r.classId}|${r.startsAt.getTime()}`));
    if (fresh.length) await this.prisma.gymClassSession.createMany({ data: fresh, skipDuplicates: true });
  }

  /** Sessions from `fromDay` to `toDay` (exclusive, local dates; 7 days when omitted, at most 42). */
  async schedule(businessId: string, fromDay: string, toDay?: string) {
    const { timeZone } = await this.settings.getSettings(businessId);
    const from = parseDay(fromDay);
    const days = toDay
      ? Math.min(42, Math.max(1, Math.round((Date.UTC(parseDay(toDay).y, parseDay(toDay).m - 1, parseDay(toDay).d) - Date.UTC(from.y, from.m - 1, from.d)) / DAY)))
      : 7;
    await this.ensureRange(businessId, from, days, timeZone);
    const start = zoned(from.y, from.m, from.d, 0, 0, timeZone);
    const end = new Date(start.getTime() + days * DAY);
    const sessions = await this.prisma.gymClassSession.findMany({
      where: { businessId, ...inBranch(), startsAt: { gte: start, lt: end }, OR: [{ class: { isActive: true } }, { bookings: { some: {} } }, { isExtra: true }] },
      orderBy: { startsAt: 'asc' },
      include: {
        class: { select: { id: true, name: true, color: true, room: true, allowTrial: true } },
        trainer: { select: { id: true, name: true } },
        bookings: { where: { status: { in: ['BOOKED', 'ATTENDED', 'WAITLIST'] } }, select: { status: true } },
        _count: { select: { trialLeads: { where: { stage: { in: ['TRIAL_SCHEDULED', 'TRIAL_DONE'] } } } } },
      },
    });
    return {
      timeZone,
      from: fromDay,
      sessions: sessions.map(({ bookings, _count, ...s }) => ({
        ...s,
        // Prospects on a trial class hold a spot too
        booked: bookings.filter((b) => b.status !== 'WAITLIST').length + _count.trialLeads,
        trials: _count.trialLeads,
        waitlist: bookings.filter((b) => b.status === 'WAITLIST').length,
      })),
    };
  }

  /** Overlapping sessions of the same trainer, to warn before double-booking them. */
  private async trainerConflicts(businessId: string, trainerId: string | null, startsAt: Date, endsAt: Date, exceptId?: string) {
    if (!trainerId) return [];
    return this.prisma.gymClassSession.findMany({
      where: { businessId, trainerId, status: 'SCHEDULED', id: exceptId ? { not: exceptId } : undefined, startsAt: { lt: endsAt }, endsAt: { gt: startsAt } },
      include: { class: { select: { name: true } } },
    });
  }

  private conflictWarning(conflicts: { class: { name: string }; startsAt: Date }[], timeZone: string) {
    if (!conflicts.length) return null;
    const c = conflicts[0];
    return `El entrenador ya tiene ${c.class.name} a las ${c.startsAt.toLocaleTimeString('es-VE', { hour: 'numeric', minute: '2-digit', timeZone })}`;
  }

  /** Moves one session (only that date) to another time. */
  async moveSession(businessId: string, id: string, data: { startsAt: string; endsAt?: string }) {
    const session = await this.prisma.gymClassSession.findFirst({ where: { id, businessId } });
    if (!session) throw new NotFoundException('Clase no encontrada');
    const startsAt = new Date(data.startsAt);
    if (Number.isNaN(startsAt.getTime())) throw new BadRequestException('Fecha inválida');
    const endsAt = data.endsAt ? new Date(data.endsAt) : new Date(startsAt.getTime() + (session.endsAt.getTime() - session.startsAt.getTime()));
    if (!(endsAt > startsAt)) throw new BadRequestException('La clase debe terminar después de empezar');
    if (endsAt.getTime() - startsAt.getTime() > 10 * 60 * 60000) throw new BadRequestException('Una clase no puede durar más de 10 horas');
    if (session.endsAt < new Date()) throw new BadRequestException('No se puede mover una clase que ya terminó');
    if (startsAt < new Date(Date.now() - 5 * 60000)) throw new BadRequestException('No se puede mover una clase al pasado');
    const clash = await this.prisma.gymClassSession.findFirst({ where: { classId: session.classId, startsAt, id: { not: id } } });
    if (clash) throw new BadRequestException('Ya hay una sesión de esta clase a esa hora');

    const updated = await this.prisma.gymClassSession.update({
      where: { id },
      data: { startsAt, endsAt, ...(!session.isExtra && !session.originalStartsAt && { originalStartsAt: session.startsAt }) },
    });
    const { timeZone } = await this.settings.getSettings(businessId);
    const warning = this.conflictWarning(await this.trainerConflicts(businessId, updated.trainerId, startsAt, endsAt, id), timeZone);
    const notified = await this.notices.notifyMoved(businessId, id, session.startsAt);
    return { session: updated, warning, notified };
  }

  /** One-time session outside the weekly schedule (a special class, a make-up class…). */
  async createExtraSession(businessId: string, data: { classId: string; startsAt: string; durationMin?: number; capacity?: number; trainerId?: string | null }) {
    const gymClass = await this.prisma.gymClass.findFirst({ where: { id: data.classId, businessId } });
    if (!gymClass) throw new NotFoundException('Clase no encontrada');
    const startsAt = new Date(data.startsAt);
    if (Number.isNaN(startsAt.getTime())) throw new BadRequestException('Fecha inválida');
    if (startsAt < new Date(Date.now() - 5 * 60000)) throw new BadRequestException('No se puede crear una clase en el pasado');
    const duration = Math.round(Number(data.durationMin) || gymClass.durationMin);
    const capacity = Math.round(Number(data.capacity) || gymClass.capacity);
    const trainerId = data.trainerId === undefined ? gymClass.trainerId : data.trainerId || null;
    const endsAt = new Date(startsAt.getTime() + duration * 60000);
    if (await this.prisma.gymClassSession.findFirst({ where: { classId: gymClass.id, startsAt } })) throw new BadRequestException('Ya hay una sesión de esta clase a esa hora');
    const session = await this.prisma.gymClassSession.create({
      data: { businessId, branchId: gymClass.branchId, classId: gymClass.id, trainerId, startsAt, endsAt, capacity, isExtra: true },
    });
    const { timeZone } = await this.settings.getSettings(businessId);
    return { session, warning: this.conflictWarning(await this.trainerConflicts(businessId, trainerId, startsAt, endsAt, session.id), timeZone) };
  }

  async getSession(businessId: string, id: string) {
    const session = await this.prisma.gymClassSession.findFirst({
      where: { id, businessId },
      include: {
        class: { select: { id: true, name: true, color: true, room: true, description: true } },
        trainer: { select: { id: true, name: true } },
        bookings: {
          where: { status: { not: 'CANCELLED' } },
          orderBy: { createdAt: 'asc' },
          include: { member: { select: { id: true, memberNumber: true, photoUrl: true, client: { select: { name: true, phone: true } } } } },
        },
        trialLeads: { where: { stage: { in: ['TRIAL_SCHEDULED', 'TRIAL_DONE'] } }, select: { id: true, name: true, phone: true, stage: true } },
      },
    });
    if (!session) throw new NotFoundException('Clase no encontrada');
    const booked = session.bookings.filter((b) => b.status === 'BOOKED' || b.status === 'ATTENDED').length + session.trialLeads.length;
    const waitlist = session.bookings.filter((b) => b.status === 'WAITLIST').length;
    return { ...session, booked, waitlist };
  }

  /** Books a member into a session: needs a membership valid on the class day and a free spot. */
  async book(businessId: string, sessionId: string, memberId: string, source: 'STAFF' | 'PORTAL' | 'AGENT' = 'STAFF') {
    return this.prisma.$transaction(async (tx) => {
      const session = await tx.gymClassSession.findFirst({ where: { id: sessionId, businessId }, include: { class: { select: { name: true } } } });
      if (!session) throw new NotFoundException('Clase no encontrada');
      if (session.status === 'CANCELLED') throw new BadRequestException('Esta clase fue cancelada');
      if (session.endsAt < new Date()) throw new BadRequestException('Esta clase ya terminó');

      const member = await tx.gymMember.findFirst({ where: { id: memberId, businessId }, include: { memberships: { include: { plan: true } }, client: { select: { name: true } } } });
      if (!member) throw new NotFoundException('Socio no encontrado');
      if (!member.accessEnabled) throw new BadRequestException(`${member.client.name} tiene el acceso bloqueado`);
      const covering = member.memberships.filter((m) => m.status !== 'CANCELLED' && m.status !== 'FROZEN' && m.startDate <= session.startsAt && m.endDate >= session.startsAt);
      const covered = covering.length > 0;
      // The plan decides whether classes are included, and which ones
      if (covered && !covering.some((m) => m.plan.includesClasses && (!m.plan.allowedClassIds.length || m.plan.allowedClassIds.includes(session.classId)))) {
        const p = covering[0].plan;
        throw new BadRequestException(p.includesClasses ? `El plan ${p.name} no incluye ${session.class.name}` : `El plan ${p.name} no incluye clases grupales`);
      }
      // A class in another branch needs a plan valid in every branch
      if (covered && session.branchId && member.branchId && session.branchId !== member.branchId && !covering.some((m) => m.plan.allBranches)) {
        throw new BadRequestException(`${member.client.name} es socio de otra sede: su plan no vale en esta`);
      }
      if (!covered) {
        const current = member.memberships.map((m) => membershipState(m)).includes('FROZEN') ? 'tiene la membresía congelada' : 'no tiene una membresía vigente para ese día';
        throw new BadRequestException(`${member.client.name} ${current}`);
      }

      const existing = await tx.gymBooking.findUnique({ where: { sessionId_memberId: { sessionId, memberId } } });
      if (existing && existing.status === 'WAITLIST') throw new BadRequestException(`${member.client.name} ya está en la lista de espera`);
      if (existing && existing.status !== 'CANCELLED') throw new BadRequestException(`${member.client.name} ya está anotado en esta clase`);
      // Full: the member goes to the waiting list and gets the first spot that frees up
      const taken = await GymCrmService.takenSpots(tx, sessionId);
      const status = taken >= session.capacity ? 'WAITLIST' : 'BOOKED';

      return existing
        ? tx.gymBooking.update({ where: { id: existing.id }, data: { status, source } })
        : tx.gymBooking.create({ data: { businessId, sessionId, memberId, source, status } });
    });
  }

  async setBookingStatus(businessId: string, id: string, status: string) {
    if (!['BOOKED', 'CANCELLED', 'ATTENDED', 'NO_SHOW'].includes(status)) throw new BadRequestException('Estado inválido');
    const result = await this.prisma.$transaction(async (tx) => {
      const booking = await tx.gymBooking.findFirst({ where: { id, businessId }, include: { session: true } });
      if (!booking) throw new NotFoundException('Reserva no encontrada');
      const updated = await tx.gymBooking.update({ where: { id }, data: { status } });
      let promoted: string | null = null;
      let promotedId: string | null = null;
      // A spot freed up: the first one on the waiting list takes it
      if (status === 'CANCELLED' && booking.status !== 'WAITLIST' && booking.session.endsAt > new Date()) {
        const taken = await GymCrmService.takenSpots(tx, booking.sessionId);
        if (taken < booking.session.capacity) {
          const next = await tx.gymBooking.findFirst({ where: { sessionId: booking.sessionId, status: 'WAITLIST' }, orderBy: { createdAt: 'asc' }, include: { member: { include: { client: { select: { name: true } } } } } });
          if (next) {
            await tx.gymBooking.update({ where: { id: next.id }, data: { status: 'BOOKED' } });
            promoted = next.member.client.name;
            promotedId = next.memberId;
          }
        }
      }
      return { ...updated, promoted, promotedId };
    });
    if (result.promotedId) await this.notices.notify(businessId, result.sessionId, 'WAITLIST_PROMOTED', [{ memberId: result.promotedId }]);
    return result;
  }


  async cancelSession(businessId: string, id: string, reason?: string) {
    const session = await this.prisma.gymClassSession.findFirst({ where: { id, businessId } });
    if (!session) throw new NotFoundException('Clase no encontrada');
    const updated = await this.prisma.gymClassSession.update({ where: { id }, data: { status: 'CANCELLED', cancelReason: reason?.trim() || null } });
    // Members already booked hear about it right away (only for classes still ahead)
    const notified = session.status !== 'CANCELLED' && session.endsAt > new Date()
      ? await this.notices.notify(businessId, id, 'CLASS_CANCELLED', (await this.activeMemberIds(id)).map((memberId) => ({ memberId, extra: { motivo: reason?.trim() || undefined } })))
      : 0;
    return { ...updated, notified };
  }

  async restoreSession(businessId: string, id: string) {
    const session = await this.prisma.gymClassSession.findFirst({ where: { id, businessId } });
    if (!session) throw new NotFoundException('Clase no encontrada');
    return this.prisma.gymClassSession.update({ where: { id }, data: { status: 'SCHEDULED', cancelReason: null } });
  }
}
