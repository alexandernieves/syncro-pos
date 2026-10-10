import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GymRemindersService } from './gym-reminders.service';
import { membershipState, zonedParts } from './gym.service';

const DAY = 24 * 60 * 60 * 1000;
const clampDays = (d?: string | number) => Math.min(365, Math.max(7, Math.round(Number(d) || 30)));
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : null);

/** Gym analytics: attendance and peak hours, retention and prospect conversion, classes and trainers. */
@Injectable()
export class GymReportsService {
  constructor(
    private prisma: PrismaService,
    private settings: GymRemindersService,
  ) {}

  private localKey(date: Date, timeZone: string) {
    const p = zonedParts(date, timeZone);
    return `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
  }

  // ── Attendance ─────────────────────────────────────────────────────────────

  async attendance(businessId: string, daysParam?: string) {
    const days = clampDays(daysParam);
    const { timeZone } = await this.settings.getSettings(businessId);
    const since = new Date(Date.now() - days * DAY);
    const [checkIns, visits, activeMembers] = await Promise.all([
      this.prisma.gymCheckIn.findMany({ where: { businessId, createdAt: { gte: since } }, select: { memberId: true, granted: true, reason: true, createdAt: true } }),
      this.prisma.gymVisit.findMany({ where: { businessId, checkedInAt: { gte: since }, kind: { not: 'VISITOR' } }, select: { checkedInAt: true } }),
      this.prisma.gymMembership.findMany({ where: { businessId, status: 'ACTIVE', startDate: { lte: new Date() }, endDate: { gte: new Date() } }, select: { memberId: true } }),
    ]);
    const granted = checkIns.filter((c) => c.granted);

    // Per day (members and visits) and the week × hour grid
    const perDay = new Map<string, { date: string; members: number; visits: number }>();
    for (let i = days - 1; i >= 0; i--) {
      const key = this.localKey(new Date(Date.now() - i * DAY), timeZone);
      perDay.set(key, { date: key, members: 0, visits: 0 });
    }
    const heat: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    for (const c of granted) {
      const k = this.localKey(c.createdAt, timeZone);
      if (perDay.has(k)) perDay.get(k)!.members++;
      const p = zonedParts(c.createdAt, timeZone);
      heat[p.dow][Math.floor(p.minutes / 60)]++;
    }
    for (const v of visits) {
      const k = this.localKey(v.checkedInAt, timeZone);
      if (perDay.has(k)) perDay.get(k)!.visits++;
      const p = zonedParts(v.checkedInAt, timeZone);
      heat[p.dow][Math.floor(p.minutes / 60)]++;
    }
    let peak = { dow: 0, hour: 0, count: 0 };
    heat.forEach((row, dow) => row.forEach((count, hour) => { if (count > peak.count) peak = { dow, hour, count }; }));
    const byHour = Array.from({ length: 24 }, (_, h) => heat.reduce((t, row) => t + row[h], 0));

    // How often each active member came (average per week in the period)
    const weeks = days / 7;
    const counts = new Map<string, number>();
    for (const c of granted) if (c.memberId) counts.set(c.memberId, (counts.get(c.memberId) ?? 0) + 1);
    const active = [...new Set(activeMembers.map((m) => m.memberId))];
    const buckets = { never: 0, low: 0, mid: 0, high: 0 };
    for (const id of active) {
      const perWeek = (counts.get(id) ?? 0) / weeks;
      if (perWeek === 0) buckets.never++;
      else if (perWeek < 2) buckets.low++;
      else if (perWeek < 4) buckets.mid++;
      else buckets.high++;
    }

    const denied = checkIns.filter((c) => !c.granted);
    const reasons = new Map<string, number>();
    for (const d of denied) {
      const r = (d.reason || 'Sin motivo').replace(/ el \d.*$| hasta .*$|: .*$| · .*$/, '').replace(/\d+/g, 'N');
      reasons.set(r, (reasons.get(r) ?? 0) + 1);
    }
    const total = granted.length + visits.length;
    return {
      days,
      timeZone,
      totals: { entries: total, memberEntries: granted.length, visits: visits.length, denied: denied.length, perDay: Math.round((total / days) * 10) / 10, uniqueMembers: counts.size, activeMembers: active.length },
      perDay: [...perDay.values()],
      heat,
      byHour,
      peak,
      frequency: buckets,
      deniedReasons: [...reasons.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count).slice(0, 8),
    };
  }

  // ── Retention and conversion ───────────────────────────────────────────────

  async retention(businessId: string, daysParam?: string) {
    const days = clampDays(daysParam);
    const now = new Date();
    const since = new Date(now.getTime() - days * DAY);
    const [memberships, members, lastCheckIns, leads, payments] = await Promise.all([
      this.prisma.gymMembership.findMany({ where: { businessId, status: { not: 'CANCELLED' } }, select: { id: true, memberId: true, planName: true, startDate: true, endDate: true, status: true, price: true, discount: true, fees: true } }),
      this.prisma.gymMember.findMany({ where: { businessId }, select: { id: true, memberNumber: true, createdAt: true, photoUrl: true, client: { select: { name: true, phone: true } } } }),
      this.prisma.gymCheckIn.groupBy({ by: ['memberId'], where: { businessId, granted: true }, _max: { createdAt: true } }),
      this.prisma.gymLead.findMany({ where: { businessId, createdAt: { gte: since } }, select: { stage: true, source: true, createdAt: true, wonAt: true, trialSessionId: true } }),
      this.prisma.gymPayment.findMany({ where: { businessId, createdAt: { gte: since } }, select: { amount: true, membershipId: true, visitId: true, membership: { select: { planName: true } } } }),
    ]);

    // Renewals: memberships that ended in the period, renewed within 15 days of the end or not
    const byMember = new Map<string, typeof memberships>();
    for (const m of memberships) byMember.set(m.memberId, [...(byMember.get(m.memberId) ?? []), m]);
    let ended = 0, renewed = 0, early = 0;
    for (const m of memberships) {
      if (m.endDate < since || m.endDate > now) continue;
      const next = (byMember.get(m.memberId) ?? []).find((o) => o.id !== m.id && o.startDate > m.startDate && o.startDate.getTime() <= m.endDate.getTime() + 15 * DAY);
      ended++;
      if (next) { renewed++; if (next.startDate.getTime() > m.endDate.getTime() - DAY) early++; }
    }

    // Active members by month (end of each month) for the last 6 months, and sign-ups
    const months: { month: string; active: number; newMembers: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const ref = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59);
      const at = ref > now ? now : ref;
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        month: start.toLocaleDateString('es-VE', { month: 'short', year: '2-digit' }),
        active: new Set(memberships.filter((m) => m.startDate <= at && m.endDate >= at && m.status !== 'CANCELLED').map((m) => m.memberId)).size,
        newMembers: members.filter((m) => m.createdAt >= start && m.createdAt <= ref).length,
      });
    }

    // At risk: active members who haven't come in 14 days or more
    const last = new Map(lastCheckIns.map((c) => [c.memberId, c._max.createdAt]));
    const activeIds = new Set(memberships.filter((m) => membershipState(m, now) === 'ACTIVE').map((m) => m.memberId));
    const atRisk = members
      .filter((m) => activeIds.has(m.id))
      .map((m) => ({ ...m, lastVisit: last.get(m.id) ?? null, daysAway: last.get(m.id) ? Math.floor((now.getTime() - last.get(m.id)!.getTime()) / DAY) : null }))
      .filter((m) => m.daysAway === null || m.daysAway >= 14)
      .sort((a, b) => (b.daysAway ?? 999) - (a.daysAway ?? 999))
      .slice(0, 50);

    // Revenue by plan in the period
    const revenue = new Map<string, number>();
    for (const p of payments) {
      const key = p.membership?.planName ?? (p.visitId ? 'Pases y visitas' : 'Otros');
      revenue.set(key, (revenue.get(key) ?? 0) + p.amount);
    }

    // Prospects created in the period
    const funnel = {
      created: leads.length,
      trial: leads.filter((l) => l.trialSessionId || ['TRIAL_SCHEDULED', 'TRIAL_DONE', 'WON'].includes(l.stage)).length,
      won: leads.filter((l) => l.stage === 'WON').length,
      lost: leads.filter((l) => l.stage === 'LOST').length,
    };
    const wonTimes = leads.filter((l) => l.wonAt).map((l) => (l.wonAt!.getTime() - l.createdAt.getTime()) / DAY);
    const sources = new Map<string, { source: string; created: number; won: number }>();
    for (const l of leads) {
      const s = sources.get(l.source) ?? { source: l.source, created: 0, won: 0 };
      s.created++;
      if (l.stage === 'WON') s.won++;
      sources.set(l.source, s);
    }

    return {
      days,
      renewals: { ended, renewed, early, rate: pct(renewed, ended), churned: ended - renewed },
      activeNow: activeIds.size,
      months,
      atRisk,
      revenue: [...revenue.entries()].map(([plan, amount]) => ({ plan, amount: Math.round(amount * 100) / 100 })).sort((a, b) => b.amount - a.amount),
      funnel: { ...funnel, conversion: pct(funnel.won, funnel.created), avgDaysToWin: wonTimes.length ? Math.round((wonTimes.reduce((a, b) => a + b, 0) / wonTimes.length) * 10) / 10 : null },
      sources: [...sources.values()].map((s) => ({ ...s, conversion: pct(s.won, s.created) })).sort((a, b) => b.created - a.created),
    };
  }

  // ── Classes and trainers ───────────────────────────────────────────────────

  async classes(businessId: string, daysParam?: string) {
    const days = clampDays(daysParam);
    const now = new Date();
    const since = new Date(now.getTime() - days * DAY);
    const [sessions, shifts] = await Promise.all([
      this.prisma.gymClassSession.findMany({
        where: { businessId, startsAt: { gte: since, lte: now } },
        include: {
          class: { select: { id: true, name: true, color: true } },
          trainer: { select: { id: true, name: true } },
          bookings: { select: { status: true } },
          _count: { select: { trialLeads: true } },
        },
      }),
      this.prisma.gymStaffShift.findMany({ where: { businessId, startsAt: { gte: since, lte: now }, status: { not: 'ABSENT' } }, select: { staffId: true, startsAt: true, endsAt: true, clockInAt: true, clockOutAt: true, status: true } }),
    ]);
    type Acc = { id: string; name: string; color?: string | null; sessions: number; cancelled: number; capacity: number; booked: number; attended: number; noShow: number; waitlist: number; trials: number };
    const blank = (id: string, name: string, color?: string | null): Acc => ({ id, name, color, sessions: 0, cancelled: 0, capacity: 0, booked: 0, attended: 0, noShow: 0, waitlist: 0, trials: 0 });
    const byClass = new Map<string, Acc>();
    const byTrainer = new Map<string, Acc>();
    for (const s of sessions) {
      const targets = [byClass.get(s.class.id) ?? byClass.set(s.class.id, blank(s.class.id, s.class.name, s.class.color)).get(s.class.id)!];
      if (s.trainer) targets.push(byTrainer.get(s.trainer.id) ?? byTrainer.set(s.trainer.id, blank(s.trainer.id, s.trainer.name)).get(s.trainer.id)!);
      for (const a of targets) {
        if (s.status === 'CANCELLED') { a.cancelled++; continue; }
        a.sessions++;
        a.capacity += s.capacity;
        const held = s.bookings.filter((b) => ['BOOKED', 'ATTENDED', 'NO_SHOW'].includes(b.status)).length;
        a.booked += held + s._count.trialLeads;
        a.attended += s.bookings.filter((b) => b.status === 'ATTENDED').length;
        a.noShow += s.bookings.filter((b) => b.status === 'NO_SHOW').length;
        a.waitlist += s.bookings.filter((b) => b.status === 'WAITLIST').length;
        a.trials += s._count.trialLeads;
      }
    }
    const finish = (a: Acc) => ({
      ...a,
      occupancy: pct(a.booked, a.capacity),
      attendanceRate: pct(a.attended, a.attended + a.noShow),
      avgPerSession: a.sessions ? Math.round((a.booked / a.sessions) * 10) / 10 : 0,
    });
    // Worked hours of trainers from their shifts (clocked when available)
    const hours = new Map<string, { planned: number; worked: number; late: number }>();
    for (const sh of shifts) {
      const h = hours.get(sh.staffId) ?? { planned: 0, worked: 0, late: 0 };
      h.planned += (sh.endsAt.getTime() - sh.startsAt.getTime()) / 3_600_000;
      if (sh.clockInAt && sh.clockOutAt) h.worked += (sh.clockOutAt.getTime() - sh.clockInAt.getTime()) / 3_600_000;
      if (sh.clockInAt && sh.clockInAt.getTime() - sh.startsAt.getTime() > 10 * 60000) h.late++;
      hours.set(sh.staffId, h);
    }
    const all = [...byClass.values()].map(finish);
    const totals = all.reduce((t, c) => ({ sessions: t.sessions + c.sessions, capacity: t.capacity + c.capacity, booked: t.booked + c.booked, attended: t.attended + c.attended, noShow: t.noShow + c.noShow, waitlist: t.waitlist + c.waitlist, cancelled: t.cancelled + c.cancelled }), { sessions: 0, capacity: 0, booked: 0, attended: 0, noShow: 0, waitlist: 0, cancelled: 0 });
    return {
      days,
      totals: { ...totals, occupancy: pct(totals.booked, totals.capacity), attendanceRate: pct(totals.attended, totals.attended + totals.noShow) },
      classes: all.sort((a, b) => (b.occupancy ?? 0) - (a.occupancy ?? 0)),
      trainers: [...byTrainer.values()].map(finish).map((t) => {
        const h = hours.get(t.id);
        return { ...t, plannedHours: h ? Math.round(h.planned * 10) / 10 : 0, workedHours: h ? Math.round(h.worked * 10) / 10 : 0, lateArrivals: h?.late ?? 0 };
      }).sort((a, b) => b.sessions - a.sessions),
    };
  }
}
