import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ChatGateway } from '../chat/chat.gateway';
import { SettingsService } from '../settings/settings.service';
import { CATALOG_CODES, MODULE_CATALOG, TRIAL_DAYS, USABLE_STATUSES, type ModuleStatus, catalogModule } from './catalog';
import { forgetModules } from './module-access';

const DAY = 86_400_000;
const fmt = (d: Date) => d.toLocaleDateString('es-VE', { day: 'numeric', month: 'long', timeZone: 'America/Caracas' });

/** What Syncro central can do with a module for a business */
export type ModuleAction = 'ACTIVATE' | 'TRIAL' | 'EXTEND_TRIAL' | 'PAUSE' | 'REMOVE';

@Injectable()
export class BusinessModulesService {
  constructor(
    private prisma: PrismaService,
    private chat: ChatGateway,
    private settings: SettingsService,
  ) {}

  /** Features of a module for a business: the catalog defaults with this business's own switches on top. */
  private featureMap(code: string, rows: { featureKey: string; enabled: boolean }[]) {
    const mod = catalogModule(code);
    const own = new Map(rows.map((r) => [r.featureKey, r.enabled]));
    return (mod?.features ?? []).map((f) => ({ ...f, enabled: own.has(f.key) ? own.get(f.key)! : f.default && !f.custom }));
  }

  /** Keeps Setting.enabledModules (what the sidebar reads) in line with the modules the business can use. */
  private async syncEnabledModules(businessId: string) {
    const usable = await this.prisma.businessModule.findMany({ where: { businessId, status: { in: USABLE_STATUSES } }, select: { moduleCode: true } });
    const settings = await this.prisma.setting.findMany({ where: { businessId }, select: { id: true, enabledModules: true } });
    for (const s of settings) {
      const current = Array.isArray(s.enabledModules) ? (s.enabledModules as string[]) : [];
      const next = [...current.filter((m) => !CATALOG_CODES.includes(m)), ...usable.map((u) => u.moduleCode)];
      await this.prisma.setting.update({ where: { id: s.id }, data: { enabledModules: next } });
    }
    forgetModules(businessId);
    await this.settings.invalidateSettingsCache(businessId).catch(() => undefined);
  }

  // ── Business side ──────────────────────────────────────────────────────────

  async catalog() {
    return MODULE_CATALOG.map(({ features, ...m }) => ({ ...m, features: features.filter((f) => !f.custom).map((f) => ({ key: f.key, label: f.label, description: f.description })) }));
  }

  /** The business's modules, their status and which features are on (the sidebar uses it). */
  async mine(businessId: string) {
    const [modules, features] = await Promise.all([
      this.prisma.businessModule.findMany({ where: { businessId }, orderBy: { createdAt: 'asc' } }),
      this.prisma.businessFeature.findMany({ where: { businessId }, select: { featureKey: true, enabled: true, moduleCode: true } }),
    ]);
    return modules.map((m) => {
      const mod = catalogModule(m.moduleCode);
      return {
        code: m.moduleCode,
        name: mod?.name ?? m.moduleCode,
        status: m.status,
        usable: USABLE_STATUSES.includes(m.status as ModuleStatus),
        trialEndsAt: m.trialEndsAt,
        activatedAt: m.activatedAt,
        features: this.featureMap(m.moduleCode, features.filter((f) => f.moduleCode === m.moduleCode)).filter((f) => f.enabled).map((f) => ({ key: f.key, label: f.label, route: f.route })),
        /** Every route the module's features control, so the sidebar hides the ones turned off */
        gatedRoutes: (mod?.features ?? []).map((f) => f.route).filter(Boolean),
      };
    });
  }

  // ── Syncro central ─────────────────────────────────────────────────────────

  async forBusiness(businessId: string) {
    const [modules, features] = await Promise.all([
      this.prisma.businessModule.findMany({ where: { businessId } }),
      this.prisma.businessFeature.findMany({ where: { businessId } }),
    ]);
    return MODULE_CATALOG.map((mod) => {
      const row = modules.find((m) => m.moduleCode === mod.code);
      return {
        code: mod.code,
        name: mod.name,
        summary: mod.summary,
        status: row?.status ?? null,
        origin: row?.origin ?? null,
        trialEndsAt: row?.trialEndsAt ?? null,
        activatedAt: row?.activatedAt ?? null,
        features: this.featureMap(mod.code, features.filter((f) => f.moduleCode === mod.code)),
      };
    });
  }

  async apply(businessId: string, code: string, action: ModuleAction, opts: { days?: number; notify?: boolean; message?: string }, adminId: string) {
    const mod = catalogModule(code);
    if (!mod) throw new NotFoundException('Módulo no encontrado');
    const business = await this.prisma.business.findUnique({ where: { id: businessId }, select: { id: true, name: true } });
    if (!business) throw new NotFoundException('Negocio no encontrado');
    const row = await this.prisma.businessModule.findUnique({ where: { businessId_moduleCode: { businessId, moduleCode: code } } });
    const now = new Date();
    const days = Math.min(90, Math.max(1, Math.round(Number(opts.days) || TRIAL_DAYS)));
    let data: Record<string, unknown>;
    let text: string | null = null;

    switch (action) {
      case 'ACTIVATE':
        data = { status: 'ACTIVE', trialEndsAt: null, activatedAt: row?.activatedAt ?? now };
        text = `¡Listo! Activamos el módulo ${mod.name} en tu cuenta. Lo encuentras en el menú lateral. Cualquier duda, escríbenos por aquí.`;
        break;
      case 'TRIAL': {
        const until = new Date(now.getTime() + days * DAY);
        data = { status: 'TRIAL', trialEndsAt: until, activatedAt: row?.activatedAt ?? now, origin: row?.origin ?? 'OFFER' };
        text = `Te activamos el módulo ${mod.name} para que lo pruebes sin costo durante ${days} días (hasta el ${fmt(until)}). Lo encuentras en el menú lateral. ${mod.summary} Cuéntanos qué te parece o qué te gustaría adaptar a tu forma de trabajar.`;
        break;
      }
      case 'EXTEND_TRIAL': {
        if (row?.status !== 'TRIAL') throw new BadRequestException('Solo se puede extender una prueba en curso');
        const from = row.trialEndsAt && row.trialEndsAt > now ? row.trialEndsAt : now;
        const until = new Date(from.getTime() + days * DAY);
        data = { trialEndsAt: until };
        text = `Extendimos tu prueba del módulo ${mod.name} hasta el ${fmt(until)}.`;
        break;
      }
      case 'PAUSE':
        if (!row) throw new BadRequestException('Este negocio no tiene el módulo');
        data = { status: 'PAUSED' };
        text = `Pausamos el módulo ${mod.name} en tu cuenta. Tus datos se conservan y lo podemos reactivar cuando quieras.`;
        break;
      case 'REMOVE':
        if (!row) return { ok: true };
        await this.prisma.businessModule.delete({ where: { id: row.id } });
        await this.syncEnabledModules(businessId);
        await this.audit(adminId, businessId, 'SYNCRO_MODULE_REMOVE', { module: code });
        return { ok: true };
      default:
        throw new BadRequestException('Acción no válida');
    }

    const saved = row
      ? await this.prisma.businessModule.update({ where: { id: row.id }, data })
      : await this.prisma.businessModule.create({ data: { businessId, moduleCode: code, origin: 'OFFER', ...data } });
    await this.syncEnabledModules(businessId);
    // Turning it on answers any open request for this module
    if (action === 'TRIAL' || action === 'ACTIVATE') {
      const open = await this.prisma.moduleRequest.findMany({ where: { businessId, kind: 'CATALOG', moduleCode: code, status: { in: ['REQUESTED', 'IN_REVIEW', 'BUILDING', 'READY'] } }, select: { id: true } });
      for (const r of open) {
        await this.prisma.moduleRequest.update({
          where: { id: r.id },
          data: { status: 'DONE', events: { create: { status: 'DONE', note: action === 'TRIAL' ? `Activado en prueba hasta el ${fmt(saved.trialEndsAt!)}` : 'Activado', byRole: 'syncro' } } },
        });
      }
    }
    await this.audit(adminId, businessId, `SYNCRO_MODULE_${action}`, { module: code, status: saved.status, trialEndsAt: saved.trialEndsAt });
    if (opts.notify !== false && text) {
      await this.chat.notifyBusiness(businessId, adminId, opts.message?.trim() || text).catch(() => undefined);
    }
    return saved;
  }

  async setFeature(businessId: string, code: string, featureKey: string, enabled: boolean, adminId: string) {
    const mod = catalogModule(code);
    const feature = mod?.features.find((f) => f.key === featureKey);
    if (!mod || !feature) throw new NotFoundException('Función no encontrada');
    const saved = await this.prisma.businessFeature.upsert({
      where: { businessId_featureKey: { businessId, featureKey } },
      create: { businessId, moduleCode: code, featureKey, enabled: !!enabled },
      update: { enabled: !!enabled },
    });
    await this.audit(adminId, businessId, 'SYNCRO_FEATURE_TOGGLE', { module: code, feature: featureKey, enabled: !!enabled });
    return saved;
  }

  /** Trials that already ended or end within the next days: Syncro decides what to do with each one. */
  async trials(withinDays = 7) {
    const limit = new Date(Date.now() + withinDays * DAY);
    const rows = await this.prisma.businessModule.findMany({
      where: { status: 'TRIAL', trialEndsAt: { lte: limit } },
      include: { business: { select: { id: true, name: true } } },
      orderBy: { trialEndsAt: 'asc' },
    });
    return rows.map((r) => ({
      businessId: r.businessId,
      businessName: r.business.name,
      code: r.moduleCode,
      name: catalogModule(r.moduleCode)?.name ?? r.moduleCode,
      trialEndsAt: r.trialEndsAt,
      daysLeft: r.trialEndsAt ? Math.ceil((r.trialEndsAt.getTime() - Date.now()) / DAY) : null,
    }));
  }

  /** Every module in use across businesses, for the module column of Gestión de negocios. */
  async summary() {
    const rows = await this.prisma.businessModule.findMany({ select: { businessId: true, moduleCode: true, status: true, trialEndsAt: true } });
    return rows.map((r) => ({ ...r, name: catalogModule(r.moduleCode)?.name ?? r.moduleCode }));
  }

  private audit(adminId: string, businessId: string, action: string, details: Record<string, unknown>) {
    return this.prisma.auditLog
      .create({ data: { userId: adminId, businessId, action, entity: 'MODULE', entityId: businessId, details: JSON.stringify(details) } })
      .catch(() => undefined);
  }
}
