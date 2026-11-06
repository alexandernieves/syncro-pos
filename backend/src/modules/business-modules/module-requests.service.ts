import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ChatGateway } from '../chat/chat.gateway';
import { USABLE_STATUSES, type ModuleStatus, catalogModule } from './catalog';

/** Syncro's base functions (products, inventory, sales…), not a catalog module. */
export const CORE_MODULE = { code: 'core', name: 'Syncro' } as const;
const moduleName = (code: string) => (code === CORE_MODULE.code ? CORE_MODULE.name : catalogModule(code)?.name ?? code);

export const REQUEST_KINDS = ['CATALOG', 'CUSTOM_MODULE', 'CUSTOM_FEATURE'] as const;
export const REQUEST_STATUSES = ['REQUESTED', 'IN_REVIEW', 'BUILDING', 'READY', 'DONE', 'REJECTED'] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

const STATUS_TEXT: Record<RequestStatus, string> = {
  REQUESTED: 'Recibida',
  IN_REVIEW: 'En revisión',
  BUILDING: 'En construcción',
  READY: 'Lista para probar',
  DONE: 'Entregada',
  REJECTED: 'No procede por ahora',
};

/** Only the owner of the business asks for modules and features */
const OWNER_ROLES = ['ownerpos', 'owner'];

const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

@Injectable()
export class ModuleRequestsService {
  constructor(
    private prisma: PrismaService,
    private chat: ChatGateway,
  ) {}

  private assertOwner(user: any) {
    if (!user?.businessId) throw new ForbiddenException('Sesión sin negocio');
    if (!OWNER_ROLES.includes(user.role)) throw new ForbiddenException('Solo el dueño del negocio puede solicitar módulos');
  }

  // ── Business side ──────────────────────────────────────────────────────────

  async create(user: any, body: any) {
    this.assertOwner(user);
    const businessId = user.businessId as string;
    const kind = String(body?.kind ?? '');
    if (!REQUEST_KINDS.includes(kind as any)) throw new BadRequestException('Tipo de solicitud no válido');

    let moduleCode: string | null = null;
    let title = clean(body?.title, 120);
    if (kind === 'CUSTOM_FEATURE' && String(body?.moduleCode ?? '') === CORE_MODULE.code) {
      // A function for Syncro's base (products, inventory, sales…): every business has it
      moduleCode = CORE_MODULE.code;
    } else if (kind === 'CATALOG' || kind === 'CUSTOM_FEATURE') {
      const mod = catalogModule(String(body?.moduleCode ?? ''));
      if (!mod) throw new BadRequestException('Módulo no encontrado');
      moduleCode = mod.code;
      if (kind === 'CATALOG') title = `Módulo ${mod.name}`;
    }
    const problem = clean(body?.problem, 4000) || (kind === 'CATALOG' ? 'Quiere usar el módulo.' : '');
    if (!title) throw new BadRequestException('Escribe un nombre corto para lo que necesitas');
    if (!problem) throw new BadRequestException('Cuéntanos qué quieres resolver');

    if (kind === 'CATALOG') {
      const has = await this.prisma.businessModule.findUnique({ where: { businessId_moduleCode: { businessId, moduleCode: moduleCode! } } });
      if (has && USABLE_STATUSES.includes(has.status as ModuleStatus)) throw new BadRequestException('Ya tienes este módulo activo');
      const open = await this.prisma.moduleRequest.findFirst({ where: { businessId, kind, moduleCode, status: { in: ['REQUESTED', 'IN_REVIEW', 'BUILDING', 'READY'] } } });
      if (open) throw new BadRequestException('Ya solicitaste este módulo. Te avisaremos por el chat de soporte.');
    }

    const request = await this.prisma.moduleRequest.create({
      data: {
        businessId,
        requestedById: user.id,
        kind,
        moduleCode,
        title,
        trade: clean(body?.trade, 120) || null,
        problem,
        currentProcess: clean(body?.currentProcess, 4000) || null,
        extra: clean(body?.extra, 2000) || null,
        events: { create: { status: 'REQUESTED', byRole: 'business' } },
      },
      include: { events: { orderBy: { createdAt: 'asc' } } },
    });

    // A catalog request also shows up in the business's module list in Syncro central
    if (kind === 'CATALOG') {
      await this.prisma.businessModule.upsert({
        where: { businessId_moduleCode: { businessId, moduleCode: moduleCode! } },
        create: { businessId, moduleCode: moduleCode!, status: 'REQUESTED', origin: 'REQUEST' },
        update: { status: 'REQUESTED', origin: 'REQUEST' },
      });
    }

    const text =
      kind === 'CATALOG'
        ? `📦 Solicité el módulo ${catalogModule(moduleCode!)?.name}.`
        : kind === 'CUSTOM_FEATURE'
          ? `🛠️ Solicité una función para ${moduleName(moduleCode!)}: «${title}».\n\n${problem}`
          : `🧩 Solicité un módulo a la medida: «${title}»${request.trade ? ` (${request.trade})` : ''}.\n\n${problem}`;
    await this.chat
      .notifySupport(businessId, user.id, text, {
        type: 'CARD',
        requestId: request.id,
        meta: { card: 'request', requestId: request.id, title: request.title, kind, status: 'REQUESTED', trade: request.trade, moduleCode },
      })
      .catch(() => undefined);
    return request;
  }

  mine(user: any) {
    if (!user?.businessId) return [];
    return this.prisma.moduleRequest.findMany({
      where: { businessId: user.businessId },
      orderBy: { createdAt: 'desc' },
      include: { events: { orderBy: { createdAt: 'asc' } } },
    });
  }

  // ── Syncro central ─────────────────────────────────────────────────────────

  async all(status?: string) {
    const rows = await this.prisma.moduleRequest.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: 'desc' },
      take: 500,
      include: {
        business: { select: { id: true, name: true, email: true, phone: true } },
        events: { orderBy: { createdAt: 'asc' } },
      },
    });
    const counts = await this.prisma.moduleRequest.groupBy({ by: ['status'], _count: true });
    return { counts: Object.fromEntries(counts.map((c) => [c.status, c._count])), items: rows };
  }

  async setStatus(id: string, body: { status: string; note?: string; notify?: boolean }, adminId: string) {
    const status = String(body?.status ?? '') as RequestStatus;
    if (!REQUEST_STATUSES.includes(status)) throw new BadRequestException('Estado no válido');
    const request = await this.prisma.moduleRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundException('Solicitud no encontrada');
    const note = clean(body?.note, 2000) || null;
    const updated = await this.prisma.moduleRequest.update({
      where: { id },
      data: { status, events: { create: { status, note, byRole: 'syncro' } } },
      include: { events: { orderBy: { createdAt: 'asc' } }, business: { select: { id: true, name: true, email: true, phone: true } } },
    });
    // A catalog request that gets turned down leaves the module list clean
    if (request.kind === 'CATALOG' && request.moduleCode && status === 'REJECTED') {
      await this.prisma.businessModule.updateMany({ where: { businessId: request.businessId, moduleCode: request.moduleCode, status: 'REQUESTED' }, data: { status: 'REJECTED' } });
    }
    await this.prisma.auditLog
      .create({ data: { userId: adminId, businessId: request.businessId, action: 'SYNCRO_REQUEST_STATUS', entity: 'MODULE_REQUEST', entityId: id, details: JSON.stringify({ title: request.title, from: request.status, to: status, note }) } })
      .catch(() => undefined);
    if (body?.notify !== false) {
      const text = `Tu solicitud «${request.title}» ahora está: ${STATUS_TEXT[status]}.${note ? `\n\n${note}` : ''}`;
      await this.chat
        .notifyBusiness(request.businessId, adminId, text, {
          type: 'CARD',
          requestId: id,
          meta: { card: 'request', requestId: id, title: request.title, kind: request.kind, status, note },
        })
        .catch(() => undefined);
    }
    return updated;
  }
}
