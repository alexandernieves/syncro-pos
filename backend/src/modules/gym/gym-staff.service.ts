import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GymRemindersService } from './gym-reminders.service';

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Day of week (0 = Sunday) and minutes since midnight of an instant, in the gym's time zone. */
function localSlot(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
  return { dow, minutes: Number(get('hour')) * 60 + Number(get('minute')) };
}
const toMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

type ShiftInput = { staffId?: string; startsAt?: string; endsAt?: string; area?: string | null; notes?: string | null };

/** Staff schedule: weekly availability, dated shifts, clock in and out, and the gaps to cover. */
@Injectable()
export class GymStaffService {
  constructor(
    private prisma: PrismaService,
    private settings: GymRemindersService,
  ) {}

  private async staff(businessId: string, id: string) {
    const s = await this.prisma.gymTrainer.findFirst({ where: { id, businessId }, include: { availability: true } });
    if (!s) throw new NotFoundException('Persona no encontrada');
    return s;
  }

  /** Replaces the weekly availability of a person. */
  async setAvailability(businessId: string, staffId: string, rows: { dayOfWeek: number; startTime: string; endTime: string }[]) {
    await this.staff(businessId, staffId);
    const clean = (rows || []).map((r) => {
      if (!Number.isInteger(r.dayOfWeek) || r.dayOfWeek < 0 || r.dayOfWeek > 6) throw new BadRequestException('Día inválido');
      if (!TIME_RE.test(r.startTime) || !TIME_RE.test(r.endTime)) throw new BadRequestException('Hora inválida (usa HH:MM)');
      if (toMinutes(r.endTime) <= toMinutes(r.startTime)) throw new BadRequestException('La hora de salida debe ser después de la de entrada');
      return { businessId, staffId, dayOfWeek: r.dayOfWeek, startTime: r.startTime, endTime: r.endTime };
    });
    await this.prisma.$transaction([
      this.prisma.gymStaffAvailability.deleteMany({ where: { staffId } }),
      ...(clean.length ? [this.prisma.gymStaffAvailability.createMany({ data: clean })] : []),
    ]);
    return this.prisma.gymStaffAvailability.findMany({ where: { staffId }, orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }] });
  }

  /** Warnings that don't block saving a shift: outside the person's availability. */
  private outsideAvailability(availability: { dayOfWeek: number; startTime: string; endTime: string }[], startsAt: Date, endsAt: Date, timeZone: string) {
    if (!availability.length) return null;
    const a = localSlot(startsAt, timeZone);
    const b = localSlot(new Date(endsAt.getTime() - 60000), timeZone);
    const fits = availability.some((r) => r.dayOfWeek === a.dow && a.dow === b.dow && toMinutes(r.startTime) <= a.minutes && toMinutes(r.endTime) >= b.minutes + 1);
    return fits ? null : 'Este turno queda fuera de la disponibilidad que indicó';
  }

  private async validate(businessId: string, data: Required<Pick<ShiftInput, 'staffId' | 'startsAt' | 'endsAt'>>, exceptId?: string) {
    const person = await this.staff(businessId, data.staffId);
    const startsAt = new Date(data.startsAt);
    const endsAt = new Date(data.endsAt);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) throw new BadRequestException('Fecha inválida');
    if (endsAt <= startsAt) throw new BadRequestException('El turno debe terminar después de empezar');
    if (endsAt.getTime() - startsAt.getTime() > 16 * HOUR) throw new BadRequestException('Un turno no puede durar más de 16 horas');
    const overlap = await this.prisma.gymStaffShift.findFirst({
      where: { businessId, staffId: data.staffId, id: exceptId ? { not: exceptId } : undefined, status: { not: 'ABSENT' }, startsAt: { lt: endsAt }, endsAt: { gt: startsAt } },
    });
    if (overlap) throw new BadRequestException(`${person.name} ya tiene un turno que se cruza con ese horario`);
    const { timeZone } = await this.settings.getSettings(businessId);
    const warning = this.outsideAvailability(person.availability, startsAt, endsAt, timeZone);
    return { startsAt, endsAt, warning };
  }

  async listShifts(businessId: string, from: string, to: string) {
    const start = new Date(from);
    const end = new Date(to);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) throw new BadRequestException('Fechas inválidas');
    if (end.getTime() - start.getTime() > 43 * DAY) throw new BadRequestException('Elige un rango de hasta 6 semanas');
    const { timeZone } = await this.settings.getSettings(businessId);
    const [shifts, sessions] = await Promise.all([
      this.prisma.gymStaffShift.findMany({
        where: { businessId, startsAt: { lt: end }, endsAt: { gt: start } },
        orderBy: { startsAt: 'asc' },
        include: { staff: { select: { id: true, name: true, color: true, role: true, hourlyRate: true } } },
      }),
      this.prisma.gymClassSession.findMany({
        where: { businessId, status: 'SCHEDULED', startsAt: { gte: start, lt: end }, trainerId: { not: null } },
        orderBy: { startsAt: 'asc' },
        select: { id: true, startsAt: true, endsAt: true, trainerId: true, class: { select: { name: true } }, trainer: { select: { name: true } } },
      }),
    ]);
    // Classes whose trainer has no shift covering them
    const uncovered = sessions
      .filter((s) => !shifts.some((sh) => sh.staffId === s.trainerId && sh.status !== 'ABSENT' && sh.startsAt <= s.startsAt && sh.endsAt >= s.endsAt))
      .map((s) => ({ sessionId: s.id, startsAt: s.startsAt, endsAt: s.endsAt, className: s.class.name, trainerId: s.trainerId, trainerName: s.trainer?.name ?? '' }));
    // Hours and estimated cost per person
    const totals = new Map<string, { staffId: string; name: string; hours: number; cost: number | null; shifts: number }>();
    for (const sh of shifts) {
      if (sh.status === 'ABSENT') continue;
      const hours = (sh.endsAt.getTime() - sh.startsAt.getTime()) / HOUR;
      const t = totals.get(sh.staffId) ?? { staffId: sh.staffId, name: sh.staff.name, hours: 0, cost: sh.staff.hourlyRate ? 0 : null, shifts: 0 };
      t.hours += hours;
      t.shifts++;
      if (t.cost !== null && sh.staff.hourlyRate) t.cost += hours * sh.staff.hourlyRate;
      totals.set(sh.staffId, t);
    }
    return {
      timeZone,
      shifts,
      uncovered,
      totals: [...totals.values()].map((t) => ({ ...t, hours: Math.round(t.hours * 10) / 10, cost: t.cost === null ? null : Math.round(t.cost * 100) / 100 })),
    };
  }

  async createShift(businessId: string, data: ShiftInput) {
    if (!data.staffId || !data.startsAt || !data.endsAt) throw new BadRequestException('Elige la persona y el horario');
    const { startsAt, endsAt, warning } = await this.validate(businessId, data as any);
    const shift = await this.prisma.gymStaffShift.create({
      data: { businessId, staffId: data.staffId, startsAt, endsAt, area: data.area?.trim() || null, notes: data.notes?.trim() || null },
      include: { staff: { select: { id: true, name: true, color: true, role: true, hourlyRate: true } } },
    });
    return { shift, warning };
  }

  async updateShift(businessId: string, id: string, data: ShiftInput) {
    const current = await this.prisma.gymStaffShift.findFirst({ where: { id, businessId } });
    if (!current) throw new NotFoundException('Turno no encontrado');
    const next = { staffId: data.staffId ?? current.staffId, startsAt: data.startsAt ?? current.startsAt.toISOString(), endsAt: data.endsAt ?? current.endsAt.toISOString() };
    const { startsAt, endsAt, warning } = await this.validate(businessId, next, id);
    const shift = await this.prisma.gymStaffShift.update({
      where: { id },
      data: {
        staffId: next.staffId,
        startsAt,
        endsAt,
        ...(data.area !== undefined && { area: data.area?.trim() || null }),
        ...(data.notes !== undefined && { notes: data.notes?.trim() || null }),
      },
      include: { staff: { select: { id: true, name: true, color: true, role: true, hourlyRate: true } } },
    });
    return { shift, warning };
  }

  async deleteShift(businessId: string, id: string) {
    const current = await this.prisma.gymStaffShift.findFirst({ where: { id, businessId } });
    if (!current) throw new NotFoundException('Turno no encontrado');
    if (current.clockInAt) throw new BadRequestException('Este turno ya tiene entrada marcada; márcalo como ausente o termínalo');
    await this.prisma.gymStaffShift.delete({ where: { id } });
    return { deleted: true };
  }

  /** Clock in, clock out or mark absent. */
  async punch(businessId: string, id: string, action: 'in' | 'out' | 'absent' | 'reset') {
    const shift = await this.prisma.gymStaffShift.findFirst({ where: { id, businessId } });
    if (!shift) throw new NotFoundException('Turno no encontrado');
    const now = new Date();
    if (action === 'in') {
      if (shift.clockInAt) throw new BadRequestException('Ya marcó la entrada');
      if (shift.startsAt.getTime() - now.getTime() > 2 * HOUR) throw new BadRequestException('Falta mucho para este turno');
      return this.prisma.gymStaffShift.update({ where: { id }, data: { clockInAt: now, status: 'SCHEDULED' } });
    }
    if (action === 'out') {
      if (!shift.clockInAt) throw new BadRequestException('Primero marca la entrada');
      if (shift.clockOutAt) throw new BadRequestException('Ya marcó la salida');
      return this.prisma.gymStaffShift.update({ where: { id }, data: { clockOutAt: now, status: 'DONE' } });
    }
    if (action === 'absent') {
      if (shift.clockInAt) throw new BadRequestException('Ya marcó la entrada en este turno');
      return this.prisma.gymStaffShift.update({ where: { id }, data: { status: 'ABSENT' } });
    }
    return this.prisma.gymStaffShift.update({ where: { id }, data: { status: 'SCHEDULED', clockInAt: null, clockOutAt: null } });
  }

  /** Copies the shifts of one week into the next (or any later week), skipping overlaps. */
  async copyWeek(businessId: string, fromWeekStart: string, toWeekStart: string) {
    const from = new Date(fromWeekStart);
    const to = new Date(toWeekStart);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) throw new BadRequestException('Fechas inválidas');
    const offset = to.getTime() - from.getTime();
    if (offset <= 0 || offset % DAY > HOUR) throw new BadRequestException('La semana de destino debe ser posterior');
    const source = await this.prisma.gymStaffShift.findMany({ where: { businessId, startsAt: { gte: from, lt: new Date(from.getTime() + 7 * DAY) } } });
    let created = 0;
    let skipped = 0;
    for (const s of source) {
      const startsAt = new Date(s.startsAt.getTime() + offset);
      const endsAt = new Date(s.endsAt.getTime() + offset);
      const clash = await this.prisma.gymStaffShift.findFirst({ where: { businessId, staffId: s.staffId, startsAt: { lt: endsAt }, endsAt: { gt: startsAt } } });
      if (clash) { skipped++; continue; }
      await this.prisma.gymStaffShift.create({ data: { businessId, staffId: s.staffId, startsAt, endsAt, area: s.area, notes: s.notes } });
      created++;
    }
    return { created, skipped };
  }

  /** Who should be working right now (for reception). */
  async onDuty(businessId: string) {
    const now = new Date();
    return this.prisma.gymStaffShift.findMany({
      where: { businessId, status: { not: 'ABSENT' }, startsAt: { lte: new Date(now.getTime() + HOUR) }, endsAt: { gt: now } },
      orderBy: { startsAt: 'asc' },
      include: { staff: { select: { id: true, name: true, color: true, role: true } } },
    });
  }
}
