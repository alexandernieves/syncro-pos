import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { gymBranch, inBranch } from './gym-branch';
import { PrismaService } from '../prisma/prisma.service';

const DAY = 24 * 60 * 60 * 1000;
export const EQUIPMENT_CATEGORIES = ['CARDIO', 'STRENGTH', 'FREE_WEIGHTS', 'FUNCTIONAL', 'OTHER'];
export const EQUIPMENT_STATUSES = ['OK', 'NEEDS_SERVICE', 'OUT_OF_ORDER', 'RETIRED'];
const MAINTENANCE_KINDS = ['REPAIR', 'PREVENTIVE', 'INSPECTION'];

type EquipmentInput = {
  name?: string;
  category?: string;
  brand?: string | null;
  model?: string | null;
  serial?: string | null;
  area?: string | null;
  photoUrl?: string | null;
  purchaseDate?: string | null;
  purchasePrice?: number | null;
  warrantyUntil?: string | null;
  status?: string;
  serviceEveryDays?: number;
  lastServiceAt?: string | null;
  notes?: string | null;
};
type MaintenanceInput = { equipmentId?: string; kind?: string; title?: string; description?: string | null; scheduledFor?: string | null; outOfOrder?: boolean; reportedBy?: string };

const day = (v?: string | null) => {
  if (!v) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(v);
  if (Number.isNaN(d.getTime())) throw new BadRequestException('Fecha inválida');
  return d;
};

/** Machines, their preventive service and their repairs (with the cost in accounting). */
@Injectable()
export class GymEquipmentService {
  constructor(private prisma: PrismaService) {}

  async list(businessId: string) {
    const items = await this.prisma.gymEquipment.findMany({
      where: { businessId, ...inBranch() },
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
      include: { maintenance: { where: { status: { not: 'DONE' } }, orderBy: { createdAt: 'desc' }, select: { id: true, kind: true, status: true, title: true, createdAt: true } } },
    });
    const now = Date.now();
    return items.map(({ maintenance, ...e }) => ({ ...e, open: maintenance, serviceDue: e.status !== 'RETIRED' && !!e.nextServiceAt && e.nextServiceAt.getTime() <= now + 3 * DAY }));
  }

  async stats(businessId: string) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const [byStatus, due, open, cost] = await Promise.all([
      this.prisma.gymEquipment.groupBy({ by: ['status'], where: { businessId, ...inBranch() }, _count: { _all: true } }),
      this.prisma.gymEquipment.count({ where: { businessId, ...inBranch(), status: { not: 'RETIRED' }, nextServiceAt: { lte: new Date(now.getTime() + 3 * DAY) } } }),
      this.prisma.gymMaintenance.count({ where: { businessId, equipment: inBranch(), status: { not: 'DONE' } } }),
      this.prisma.gymMaintenance.aggregate({ where: { businessId, equipment: inBranch(), status: 'DONE', doneAt: { gte: monthStart } }, _sum: { cost: true } }),
    ]);
    const count = (s: string) => byStatus.find((r) => r.status === s)?._count._all ?? 0;
    return {
      total: byStatus.reduce((t, r) => t + (r.status === 'RETIRED' ? 0 : r._count._all), 0),
      ok: count('OK'),
      needsService: count('NEEDS_SERVICE'),
      outOfOrder: count('OUT_OF_ORDER'),
      serviceDue: due,
      openTickets: open,
      costThisMonth: Math.round((cost._sum.cost ?? 0) * 100) / 100,
    };
  }

  async get(businessId: string, id: string) {
    const e = await this.prisma.gymEquipment.findFirst({ where: { id, businessId }, include: { maintenance: { orderBy: { createdAt: 'desc' }, take: 50 } } });
    if (!e) throw new NotFoundException('Equipo no encontrado');
    return e;
  }

  private data(d: EquipmentInput) {
    if (d.category !== undefined && !EQUIPMENT_CATEGORIES.includes(d.category)) throw new BadRequestException('Categoría inválida');
    if (d.status !== undefined && !EQUIPMENT_STATUSES.includes(d.status)) throw new BadRequestException('Estado inválido');
    const t = (v?: string | null) => v?.trim() || null;
    return {
      ...(d.name !== undefined && { name: d.name.trim() }),
      ...(d.category !== undefined && { category: d.category }),
      ...(d.brand !== undefined && { brand: t(d.brand) }),
      ...(d.model !== undefined && { model: t(d.model) }),
      ...(d.serial !== undefined && { serial: t(d.serial) }),
      ...(d.area !== undefined && { area: t(d.area) }),
      ...(d.photoUrl !== undefined && { photoUrl: d.photoUrl || null }),
      ...(d.purchaseDate !== undefined && { purchaseDate: day(d.purchaseDate) }),
      ...(d.purchasePrice !== undefined && { purchasePrice: d.purchasePrice != null && Number(d.purchasePrice) > 0 ? Number(d.purchasePrice) : null }),
      ...(d.warrantyUntil !== undefined && { warrantyUntil: day(d.warrantyUntil) }),
      ...(d.status !== undefined && { status: d.status }),
      ...(d.serviceEveryDays !== undefined && { serviceEveryDays: Math.max(0, Math.round(Number(d.serviceEveryDays) || 0)) }),
      ...(d.lastServiceAt !== undefined && { lastServiceAt: day(d.lastServiceAt) }),
      ...(d.notes !== undefined && { notes: t(d.notes) }),
    };
  }

  /** Next preventive service: from the last one (or today) plus the interval. */
  private nextService(every: number, last: Date | null) {
    return every > 0 ? new Date((last ?? new Date()).getTime() + every * DAY) : null;
  }

  async create(businessId: string, d: EquipmentInput) {
    if (!d.name?.trim()) throw new BadRequestException('Escribe el nombre del equipo');
    const data = this.data(d);
    return this.prisma.gymEquipment.create({
      data: { businessId, branchId: gymBranch(), name: d.name.trim(), ...data, nextServiceAt: this.nextService(data.serviceEveryDays ?? 0, (data.lastServiceAt as Date | null) ?? null) },
    });
  }

  async update(businessId: string, id: string, d: EquipmentInput) {
    const e = await this.prisma.gymEquipment.findFirst({ where: { id, businessId } });
    if (!e) throw new NotFoundException('Equipo no encontrado');
    if (d.name !== undefined && !d.name.trim()) throw new BadRequestException('Escribe el nombre del equipo');
    const data = this.data(d);
    const every = data.serviceEveryDays ?? e.serviceEveryDays;
    const last = data.lastServiceAt !== undefined ? (data.lastServiceAt as Date | null) : e.lastServiceAt;
    const recompute = data.serviceEveryDays !== undefined || data.lastServiceAt !== undefined;
    return this.prisma.gymEquipment.update({ where: { id }, data: { ...data, ...(recompute && { nextServiceAt: this.nextService(every, last) }) } });
  }

  /** Reports a failure or schedules a service. A failure can take the machine out of service. */
  async report(businessId: string, d: MaintenanceInput, reporter?: string) {
    const e = await this.prisma.gymEquipment.findFirst({ where: { id: d.equipmentId, businessId } });
    if (!e) throw new NotFoundException('Equipo no encontrado');
    const kind = d.kind && MAINTENANCE_KINDS.includes(d.kind) ? d.kind : 'REPAIR';
    if (!d.title?.trim()) throw new BadRequestException(kind === 'REPAIR' ? 'Describe la falla' : 'Escribe qué se va a hacer');
    const ticket = await this.prisma.gymMaintenance.create({
      data: { businessId, equipmentId: e.id, kind, title: d.title.trim(), description: d.description?.trim() || null, scheduledFor: day(d.scheduledFor), reportedBy: reporter || d.reportedBy || null },
    });
    if (kind === 'REPAIR' && e.status !== 'RETIRED') {
      await this.prisma.gymEquipment.update({ where: { id: e.id }, data: { status: d.outOfOrder ? 'OUT_OF_ORDER' : e.status === 'OUT_OF_ORDER' ? 'OUT_OF_ORDER' : 'NEEDS_SERVICE' } });
    }
    return ticket;
  }

  async setStatus(businessId: string, ticketId: string, status: 'OPEN' | 'IN_PROGRESS') {
    const t = await this.prisma.gymMaintenance.findFirst({ where: { id: ticketId, businessId } });
    if (!t) throw new NotFoundException('Mantenimiento no encontrado');
    if (t.status === 'DONE') throw new BadRequestException('Este mantenimiento ya se cerró');
    return this.prisma.gymMaintenance.update({ where: { id: ticketId }, data: { status } });
  }

  /**
   * Closes a ticket: what was done, by whom and how much it cost. The cost goes to accounting as an
   * expense; the machine is back in service when nothing else is open, and its next service is set.
   */
  async complete(businessId: string, ticketId: string, d: { cost?: number; vendor?: string; resolution?: string; branchId?: string }, userId?: string) {
    const t = await this.prisma.gymMaintenance.findFirst({ where: { id: ticketId, businessId }, include: { equipment: true } });
    if (!t) throw new NotFoundException('Mantenimiento no encontrado');
    if (t.status === 'DONE') throw new BadRequestException('Este mantenimiento ya se cerró');
    const cost = d.cost != null && Number(d.cost) > 0 ? Math.round(Number(d.cost) * 100) / 100 : null;
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      let entryId: string | null = null;
      if (cost && userId) {
        const branchId = t.equipment.branchId || (d.branchId && (await tx.branch.findFirst({ where: { id: d.branchId, businessId }, select: { id: true } }))?.id) || (await tx.branch.findFirst({ where: { businessId }, orderBy: { isMain: 'desc' }, select: { id: true } }))?.id || null;
        const entry = await tx.accountingEntry.create({
          data: { description: `Mantenimiento: ${t.equipment.name} · ${t.title}${d.vendor?.trim() ? ` (${d.vendor.trim()})` : ''}`, amount: cost, type: 'EXPENSE', category: 'MANTENIMIENTO_GYM', branchId, userId },
        });
        entryId = entry.id;
      }
      const done = await tx.gymMaintenance.update({
        where: { id: ticketId },
        data: { status: 'DONE', doneAt: now, cost, vendor: d.vendor?.trim() || null, resolution: d.resolution?.trim() || null, accountingEntryId: entryId },
      });
      const stillOpen = await tx.gymMaintenance.count({ where: { equipmentId: t.equipmentId, status: { not: 'DONE' }, kind: 'REPAIR' } });
      const serviced = t.kind !== 'INSPECTION';
      await tx.gymEquipment.update({
        where: { id: t.equipmentId },
        data: {
          ...(t.equipment.status !== 'RETIRED' && !stillOpen && { status: 'OK' }),
          ...(serviced && { lastServiceAt: now, nextServiceAt: this.nextService(t.equipment.serviceEveryDays, now) }),
        },
      });
      return done;
    });
  }

  /** Opens a preventive ticket for machines whose service is due in the next 3 days (once). Runs from a cron. */
  async openDueServices(now = new Date()) {
    const due = await this.prisma.gymEquipment.findMany({
      where: { status: { not: 'RETIRED' }, serviceEveryDays: { gt: 0 }, nextServiceAt: { lte: new Date(now.getTime() + 3 * DAY) }, maintenance: { none: { kind: 'PREVENTIVE', status: { not: 'DONE' } } } },
    });
    for (const e of due) {
      await this.prisma.gymMaintenance.create({ data: { businessId: e.businessId, equipmentId: e.id, kind: 'PREVENTIVE', title: 'Servicio preventivo', scheduledFor: e.nextServiceAt, reportedBy: 'Automático' } });
    }
    return due.length;
  }

  /** For the member app: machines they can report, without internal data. */
  listForMembers(businessId: string) {
    return this.prisma.gymEquipment.findMany({ where: { businessId, ...inBranch(), status: { not: 'RETIRED' } }, orderBy: { name: 'asc' }, select: { id: true, name: true, area: true, category: true } });
  }
}
