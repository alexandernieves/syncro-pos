import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GymService, membershipOwed } from './gym.service';
import { GymClassesService } from './gym-classes.service';
import { GymRemindersService } from './gym-reminders.service';
import { GymDocumentsService } from './gym-documents.service';

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

/** Local date (AAAA-MM-DD) in the gym's time zone, `offsetDays` from today. */
function localDay(timeZone: string, offsetDays = 0) {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(Date.now() + offsetDays * DAY));
}

/**
 * What a member sees and does from the client app: their membership, the class schedule,
 * and booking or cancelling with the gym's rules (days ahead, cancel window, max bookings).
 */
@Injectable()
export class GymPortalService {
  constructor(
    private prisma: PrismaService,
    private gym: GymService,
    private classes: GymClassesService,
    private settings: GymRemindersService,
    private docs: GymDocumentsService,
  ) {}

  async documents(clientId: string, businessId: string) {
    const { id } = await this.memberFor(clientId, businessId);
    return this.docs.pendingForPortal(businessId, id);
  }

  async sign(clientId: string, businessId: string, templateId: string, body: any, ip?: string, userAgent?: string) {
    const { id } = await this.memberFor(clientId, businessId);
    const s = await this.docs.sign(businessId, templateId, id, { ...body, signerName: undefined, signerDocument: undefined }, { method: 'PORTAL', ip, userAgent });
    return { id: s.id, signedAt: s.signedAt };
  }

  private async memberFor(clientId: string, businessId: string) {
    const member = await this.prisma.gymMember.findFirst({ where: { clientId, businessId }, select: { id: true } });
    if (!member) throw new NotFoundException('Todavía no eres socio de este gimnasio');
    return member;
  }

  private activeBookingsWhere(memberId: string) {
    return { memberId, status: { in: ['BOOKED', 'WAITLIST'] }, session: { status: 'SCHEDULED', endsAt: { gt: new Date() } } };
  }

  async me(clientId: string, businessId: string) {
    const { id } = await this.memberFor(clientId, businessId);
    const [member, settings, business, bookings] = await Promise.all([
      this.gym.getMember(businessId, id),
      this.settings.getSettings(businessId),
      this.prisma.business.findUnique({ where: { id: businessId }, select: { name: true, logo: true } }),
      this.prisma.gymBooking.findMany({
        where: this.activeBookingsWhere(id),
        orderBy: { session: { startsAt: 'asc' } },
        include: { session: { include: { class: { select: { name: true, color: true, room: true } }, trainer: { select: { name: true } } } } },
      }),
    ]);
    const current = member.currentMembership as any;
    const owed = current ? membershipOwed({ ...current, payments: member.memberships.find((m: any) => m.id === current.id)?.payments ?? [] }) : 0;
    return {
      gym: { name: business?.name || 'Gimnasio', logo: business?.logo ?? null, timeZone: settings.timeZone },
      rules: settings.booking,
      member: {
        id: member.id,
        memberNumber: member.memberNumber,
        name: member.client.name,
        photoUrl: member.photoUrl,
        status: member.status,
        daysLeft: member.daysLeft,
        owed,
        membership: current ? { planName: current.planName, startDate: current.startDate, endDate: current.endDate, state: current.state } : null,
      },
      bookings: bookings.map((b) => ({
        id: b.id,
        status: b.status,
        cancelUntil: new Date(b.session.startsAt.getTime() - settings.booking.cancelHours * HOUR),
        session: {
          id: b.session.id,
          startsAt: b.session.startsAt,
          endsAt: b.session.endsAt,
          name: b.session.class.name,
          color: b.session.class.color,
          room: b.session.class.room,
          trainer: b.session.trainer?.name ?? null,
        },
      })),
      visits: member.checkIns.filter((c: any) => c.granted).slice(0, 10).map((c: any) => c.createdAt),
    };
  }

  /** Classes the member can book: from now until the booking window closes. */
  async schedule(clientId: string, businessId: string) {
    const { id } = await this.memberFor(clientId, businessId);
    const settings = await this.settings.getSettings(businessId);
    const { sessions } = await this.classes.schedule(businessId, localDay(settings.timeZone), localDay(settings.timeZone, settings.booking.daysAhead + 1));
    const mine = await this.prisma.gymBooking.findMany({
      where: { memberId: id, sessionId: { in: sessions.map((s) => s.id) }, status: { not: 'CANCELLED' } },
      select: { id: true, sessionId: true, status: true },
    });
    const now = Date.now();
    const limit = now + settings.booking.daysAhead * DAY;
    return {
      timeZone: settings.timeZone,
      rules: settings.booking,
      sessions: sessions
        .filter((s) => s.status === 'SCHEDULED' && s.endsAt.getTime() > now && s.startsAt.getTime() <= limit)
        .map((s) => {
          const booking = mine.find((b) => b.sessionId === s.id);
          return {
            id: s.id,
            startsAt: s.startsAt,
            endsAt: s.endsAt,
            name: s.class.name,
            color: s.class.color,
            room: s.class.room,
            trainer: s.trainer?.name ?? null,
            capacity: s.capacity,
            booked: s.booked,
            waitlist: s.waitlist,
            myBooking: booking ? { id: booking.id, status: booking.status } : null,
          };
        }),
    };
  }

  async book(clientId: string, businessId: string, sessionId: string) {
    const { id } = await this.memberFor(clientId, businessId);
    const { booking: rules } = await this.settings.getSettings(businessId);
    if (!rules.portalEnabled) throw new ForbiddenException('El gimnasio recibe las reservas solo en recepción');
    const session = await this.prisma.gymClassSession.findFirst({ where: { id: sessionId, businessId } });
    if (!session) throw new NotFoundException('Clase no encontrada');
    if (session.startsAt.getTime() > Date.now() + rules.daysAhead * DAY) {
      throw new BadRequestException(`Puedes reservar con hasta ${rules.daysAhead} ${rules.daysAhead === 1 ? 'día' : 'días'} de anticipación`);
    }
    if (session.startsAt.getTime() < Date.now()) throw new BadRequestException('Esta clase ya empezó');
    if (rules.maxActive > 0) {
      const active = await this.prisma.gymBooking.count({ where: this.activeBookingsWhere(id) });
      if (active >= rules.maxActive) throw new BadRequestException(`Ya tienes ${active} reservas activas, el máximo del gimnasio. Cancela una para reservar otra`);
    }
    const booking = await this.classes.book(businessId, sessionId, id, 'PORTAL');
    return { id: booking.id, status: booking.status };
  }

  async cancel(clientId: string, businessId: string, bookingId: string) {
    const { id } = await this.memberFor(clientId, businessId);
    const booking = await this.prisma.gymBooking.findFirst({ where: { id: bookingId, memberId: id, businessId }, include: { session: true } });
    if (!booking) throw new NotFoundException('Reserva no encontrada');
    if (booking.status === 'CANCELLED') return { id: booking.id, status: booking.status };
    if (!['BOOKED', 'WAITLIST'].includes(booking.status)) throw new BadRequestException('Esta reserva ya no se puede cancelar');
    const { booking: rules } = await this.settings.getSettings(businessId);
    // Leaving the waiting list is always allowed; a held spot only until the cancel window closes
    if (booking.status === 'BOOKED' && booking.session.startsAt.getTime() - rules.cancelHours * HOUR < Date.now()) {
      throw new BadRequestException(
        rules.cancelHours > 0 ? `Solo puedes cancelar hasta ${rules.cancelHours} ${rules.cancelHours === 1 ? 'hora' : 'horas'} antes de la clase. Avisa en recepción` : 'La clase ya empezó',
      );
    }
    const updated = await this.classes.setBookingStatus(businessId, bookingId, 'CANCELLED');
    return { id: updated.id, status: updated.status };
  }
}
