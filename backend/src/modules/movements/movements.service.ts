import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Currency, branchCurrencies, isCurrency, ratesFrom, round2, toUsd } from '../../common/currency';

/** Categories of money that isn't a sale. The protected ones need a supervisor PIN for the staff. */
export const OUT_CATEGORIES = ['ALQUILER', 'SERVICIOS', 'NOMINA', 'MANTENIMIENTO', 'LIMPIEZA', 'INSUMOS', 'TRANSPORTE', 'PUBLICIDAD', 'IMPUESTOS', 'RETIRO_DUENO', 'OTRO_EGRESO'];
export const IN_CATEGORIES = ['APORTE_DUENO', 'ALQUILER_ESPACIO', 'PATROCINIO', 'REINTEGRO', 'OTRO_INGRESO'];
export const METHODS = ['CASH_DRAWER', 'CASH_OTHER', 'PAGO_MOVIL', 'TRANSFER', 'CARD', 'ZELLE', 'BINANCE', 'OTHER'];

export type FinanceSettings = { staffLimitUsd: number; receiptOverUsd: number; undoMinutes: number; protectedCategories: string[] };
export const DEFAULT_FINANCE: FinanceSettings = { staffLimitUsd: 20, receiptOverUsd: 10, undoMinutes: 10, protectedCategories: ['ALQUILER', 'NOMINA', 'IMPUESTOS', 'RETIRO_DUENO'] };

const MANAGER_ROLES = ['ownerpos', 'owner', 'admin', 'superadmin'];
export const isManager = (role?: string) => MANAGER_ROLES.includes(String(role || '').toLowerCase());

type User = { id: string; name?: string; role?: string; businessId: string };
type MovementInput = {
  type?: string;
  category?: string;
  categoryLabel?: string;
  methodLabel?: string;
  amount?: number | string;
  currency?: string;
  method?: string;
  description?: string;
  receiptUrl?: string;
  occurredAt?: string;
  branchId?: string;
  source?: string;
  supervisorPin?: string;
};

/**
 * Income and expenses that aren't sales. Rules so a mistake can't quietly change the books:
 *   1. Nothing is deleted: a wrong movement is voided with a reason, and stays in the history.
 *   2. Its author can undo it for a few minutes (while the cash shift is open and nobody reviewed it).
 *   3. The staff has a limit per movement and can't touch protected categories without a supervisor PIN.
 *   4. Expenses over an amount need the photo of the receipt.
 *   5. The owner reviews the staff's movements; a reviewed movement is locked.
 * Cash taken from or put in the drawer moves the open shift, so the close still adds up.
 */
@Injectable()
export class MovementsService {
  constructor(private prisma: PrismaService) {}

  async getSettings(businessId: string): Promise<FinanceSettings> {
    const s = await this.prisma.setting.findFirst({ where: { businessId }, select: { financeSettings: true } });
    const saved = (s?.financeSettings ?? {}) as Partial<FinanceSettings>;
    const num = (v: unknown, d: number, max: number) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Math.min(max, Number(v)) : d);
    return {
      staffLimitUsd: num(saved.staffLimitUsd, DEFAULT_FINANCE.staffLimitUsd, 100000),
      receiptOverUsd: num(saved.receiptOverUsd, DEFAULT_FINANCE.receiptOverUsd, 100000),
      undoMinutes: Math.round(num(saved.undoMinutes, DEFAULT_FINANCE.undoMinutes, 120)),
      protectedCategories: Array.isArray(saved.protectedCategories) ? saved.protectedCategories.filter((c) => OUT_CATEGORIES.includes(c) || IN_CATEGORIES.includes(c)) : DEFAULT_FINANCE.protectedCategories,
    };
  }

  async saveSettings(user: User, data: Partial<FinanceSettings>) {
    if (!isManager(user.role)) throw new ForbiddenException('Solo un administrador cambia estas reglas');
    const current = await this.getSettings(user.businessId);
    const next = { ...current, ...data };
    const setting = await this.prisma.setting.findFirst({ where: { businessId: user.businessId } });
    if (!setting) throw new NotFoundException('Configuración no encontrada');
    await this.prisma.setting.update({ where: { id: setting.id }, data: { financeSettings: next as any } });
    return this.getSettings(user.businessId);
  }

  private async branchOf(businessId: string, branchId?: string) {
    const b = branchId
      ? await this.prisma.branch.findFirst({ where: { id: branchId, businessId } })
      : await this.prisma.branch.findFirst({ where: { businessId }, orderBy: [{ isMain: 'desc' }, { createdAt: 'asc' }] });
    if (!b) throw new NotFoundException('Sucursal no encontrada');
    return b;
  }

  async hasSupervisorPin(businessId: string) {
    const s = await this.prisma.setting.findFirst({ where: { businessId }, select: { discountPin: true } });
    return !!s?.discountPin;
  }

  private async checkPin(businessId: string, pin?: string) {
    const s = await this.prisma.setting.findFirst({ where: { businessId }, select: { discountPin: true } });
    if (!s?.discountPin) throw new ForbiddenException({ code: 'NO_PIN', message: 'Este movimiento necesita la autorización de un administrador, y no hay PIN de supervisor configurado. Pídele a un administrador que lo registre.' });
    if (!pin || String(pin) !== s.discountPin) throw new ForbiddenException({ code: 'PIN_REQUIRED', message: pin ? 'PIN de supervisor incorrecto' : 'Este movimiento necesita el PIN de un supervisor' });
  }

  async create(user: User, data: MovementInput) {
    const type = String(data.type || '').toUpperCase();
    if (!['IN', 'OUT'].includes(type)) throw new BadRequestException('Elige si es un ingreso o un egreso');
    // A custom category or method is written by the person (CUSTOM + its label)
    const category = String(data.category || '');
    const categoryLabel = category === 'CUSTOM' ? String(data.categoryLabel ?? '').trim().replace(/\s+/g, ' ').slice(0, 60) : null;
    if (category === 'CUSTOM' ? !categoryLabel || categoryLabel.length < 2 : !(type === 'OUT' ? OUT_CATEGORIES : IN_CATEGORIES).includes(category)) throw new BadRequestException(category === 'CUSTOM' ? 'Escribe la categoría' : 'Elige una categoría');
    const method = String(data.method || '');
    const methodLabel = method === 'CUSTOM' ? String(data.methodLabel ?? '').trim().replace(/\s+/g, ' ').slice(0, 60) : null;
    if (method === 'CUSTOM' ? !methodLabel || methodLabel.length < 2 : !METHODS.includes(method)) throw new BadRequestException(method === 'CUSTOM' ? (type === 'OUT' ? 'Escribe con qué se pagó' : 'Escribe cómo entró') : type === 'OUT' ? 'Elige con qué se pagó' : 'Elige cómo entró');
    const amountCurrency = round2(Number(String(data.amount ?? '').replace(',', '.')));
    if (!(amountCurrency > 0) || amountCurrency > 100_000_000) throw new BadRequestException('Escribe un monto válido');
    const description = String(data.description ?? '').trim().slice(0, 300) || null;

    const branch = await this.branchOf(user.businessId, data.branchId);
    const currency: Currency = isCurrency(data.currency) ? data.currency : 'USD';
    if (!branchCurrencies(branch.state).includes(currency)) throw new BadRequestException(`Esta sucursal no maneja ${currency}`);
    const setting = await this.prisma.setting.findFirst({ where: { businessId: user.businessId } });
    const rates = ratesFrom(setting);
    if (!(rates[currency] > 0)) throw new BadRequestException('Falta la tasa de esa moneda');
    const amount = round2(toUsd(amountCurrency, currency, rates));

    // Rules 3 and 4: staff limit, protected categories, receipt photo
    const rules = await this.getSettings(user.businessId);
    let authorizedBy: string | null = null;
    if (!isManager(user.role) && (amount > rules.staffLimitUsd || rules.protectedCategories.includes(category))) {
      await this.checkPin(user.businessId, data.supervisorPin);
      authorizedBy = 'PIN de supervisor';
    }
    if (type === 'OUT' && amount > rules.receiptOverUsd && !data.receiptUrl) throw new BadRequestException({ code: 'RECEIPT_REQUIRED', message: `Para egresos de más de $${rules.receiptOverUsd.toFixed(2)} sube la foto de la factura o el recibo` });

    const occurredAt = data.occurredAt ? new Date(data.occurredAt) : new Date();
    if (Number.isNaN(occurredAt.getTime()) || occurredAt.getTime() > Date.now() + 60_000) throw new BadRequestException('La fecha no puede ser futura');

    // Cash from the drawer: it belongs to the cashier's open shift in this branch
    let shiftId: string | null = null;
    if (method === 'CASH_DRAWER') {
      const shift = await this.prisma.shift.findFirst({ where: { userId: user.id, branchId: branch.id, status: 'OPEN' as any }, select: { id: true } });
      if (!shift) throw new BadRequestException({ code: 'SHIFT_CLOSED', message: 'Para usar el efectivo de la gaveta, abre la caja de esta sucursal' });
      shiftId = shift.id;
    }

    return this.prisma.$transaction(async (tx) => {
      const entry = await tx.accountingEntry.create({
        data: {
          description: `${type === 'OUT' ? 'Egreso' : 'Ingreso'}: ${categoryLabel ?? label(category)}${description ? ` · ${description}` : ''}`,
          type: type === 'OUT' ? 'EXPENSE' : 'INCOME',
          amount,
          category: `MOV_${category}`,
          branchId: branch.id,
          userId: user.id,
          createdAt: occurredAt,
        },
      });
      return tx.financeMovement.create({
        data: {
          businessId: user.businessId,
          branchId: branch.id,
          userId: user.id,
          userName: user.name || null,
          type,
          category,
          categoryLabel,
          amount,
          currency,
          amountCurrency,
          method,
          methodLabel,
          description,
          receiptUrl: data.receiptUrl || null,
          occurredAt,
          source: ['GYM', 'POS', 'DASHBOARD'].includes(String(data.source)) ? String(data.source) : 'DASHBOARD',
          shiftId,
          accountingEntryId: entry.id,
          authorizedBy,
        },
      });
    });
  }

  /** A day of a branch (today by default), newest first. */
  async list(businessId: string, params: { branchId?: string; day?: string; status?: string; review?: string }) {
    const where: any = { businessId };
    if (params.branchId) where.branchId = params.branchId;
    if (params.status === 'VOIDED') where.status = 'VOIDED';
    if (params.status === 'ACTIVE') where.status = 'ACTIVE';
    if (params.review === 'pending') Object.assign(where, { reviewedAt: null, status: 'ACTIVE' });
    if (params.day && /^\d{4}-\d{2}-\d{2}$/.test(params.day)) {
      const from = new Date(`${params.day}T00:00:00`);
      where.occurredAt = { gte: from, lt: new Date(from.getTime() + 86400000) };
    }
    const rows = await this.prisma.financeMovement.findMany({ where, orderBy: { occurredAt: 'desc' }, take: 300, include: { branch: { select: { name: true } } } });
    return rows;
  }

  /** Rule 2: the author undoes it within the minutes allowed, while nothing locked it. */
  async undo(user: User, id: string) {
    const m = await this.find(user.businessId, id);
    const rules = await this.getSettings(user.businessId);
    if (m.userId !== user.id) throw new ForbiddenException('Solo quien lo registró puede deshacerlo; un administrador puede anularlo');
    if (m.reviewedAt) throw new BadRequestException('Ya fue revisado: pídele a un administrador que lo anule');
    if (Date.now() - m.createdAt.getTime() > rules.undoMinutes * 60000) throw new BadRequestException(`Pasaron más de ${rules.undoMinutes} minutos: pídele a un administrador que lo anule`);
    await this.assertShiftOpen(m);
    return this.voidMovement(m, 'Deshecho por quien lo registró', user.name || 'Autor');
  }

  /** Rule 1: voided with a reason, by a manager or with the supervisor PIN. */
  async void(user: User, id: string, data: { reason?: string; supervisorPin?: string }) {
    const m = await this.find(user.businessId, id);
    const reason = String(data?.reason ?? '').trim();
    if (!reason) throw new BadRequestException('Escribe por qué lo anulas');
    if (!isManager(user.role)) await this.checkPin(user.businessId, data.supervisorPin);
    await this.assertShiftOpen(m);
    return this.voidMovement(m, reason, `${user.name || 'Usuario'}${isManager(user.role) ? '' : ' (con PIN de supervisor)'}`);
  }

  /** Rule 5: the owner reviews; reviewed movements are locked. */
  async review(user: User, ids: string[]) {
    if (!isManager(user.role)) throw new ForbiddenException('Solo un administrador revisa los movimientos');
    const r = await this.prisma.financeMovement.updateMany({ where: { businessId: user.businessId, id: { in: ids }, reviewedAt: null }, data: { reviewedAt: new Date(), reviewedBy: user.name || 'Administrador' } });
    return { reviewed: r.count };
  }

  private async find(businessId: string, id: string) {
    const m = await this.prisma.financeMovement.findFirst({ where: { id, businessId } });
    if (!m) throw new NotFoundException('Movimiento no encontrado');
    if (m.status === 'VOIDED') throw new BadRequestException('Ya está anulado');
    return m;
  }

  /** Drawer cash of a closed shift was already counted: it can't change after the close. */
  private async assertShiftOpen(m: { shiftId: string | null }) {
    if (!m.shiftId) return;
    const shift = await this.prisma.shift.findUnique({ where: { id: m.shiftId }, select: { status: true } });
    if (shift && shift.status !== ('OPEN' as any)) throw new BadRequestException('La caja de ese movimiento ya se cerró: registra un movimiento contrario en la caja de hoy');
  }

  private async voidMovement(m: { id: string; accountingEntryId: string | null }, reason: string, by: string) {
    return this.prisma.$transaction(async (tx) => {
      // It stops counting in the books; the movement stays as the record of what happened
      if (m.accountingEntryId) await tx.accountingEntry.deleteMany({ where: { id: m.accountingEntryId } });
      return tx.financeMovement.update({ where: { id: m.id }, data: { status: 'VOIDED', voidReason: reason, voidedAt: new Date(), voidedBy: by, accountingEntryId: null } });
    });
  }
}

const LABELS: Record<string, string> = {
  ALQUILER: 'Alquiler', SERVICIOS: 'Servicios', NOMINA: 'Nómina y personal', MANTENIMIENTO: 'Mantenimiento', LIMPIEZA: 'Limpieza', INSUMOS: 'Insumos',
  TRANSPORTE: 'Transporte', PUBLICIDAD: 'Publicidad', IMPUESTOS: 'Impuestos', RETIRO_DUENO: 'Retiro del dueño', OTRO_EGRESO: 'Otro egreso',
  APORTE_DUENO: 'Aporte del dueño', ALQUILER_ESPACIO: 'Alquiler de un espacio', PATROCINIO: 'Patrocinio', REINTEGRO: 'Reintegro', OTRO_INGRESO: 'Otro ingreso',
};
export const label = (c: string) => LABELS[c] ?? c;
