import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CashByCurrency, Currency, Rates, branchCurrencies, cashToUsd, cleanCash, isCurrency, ratesFrom, round2 } from '../../common/currency';

@Injectable()
export class ShiftsService {
  constructor(private prisma: PrismaService) {}

  private async branchContext(branchId: string) {
    const branch = await this.prisma.branch.findUnique({ where: { id: branchId }, select: { id: true, state: true, businessId: true } });
    const settings = branch?.businessId ? await this.prisma.setting.findFirst({ where: { businessId: branch.businessId } }) : null;
    return { branch, rates: ratesFrom(settings), currencies: branchCurrencies(branch?.state) };
  }

  async open(data: any) {
    const { userId, branchId } = data;

    // Check if there is already an open shift for this user/branch
    const activeShift = await this.prisma.shift.findFirst({
      where: { userId, branchId, status: 'OPEN' as any }
    });

    if (activeShift) {
      throw new BadRequestException('Ya existe un turno abierto para esta sucursal.');
    }

    // Cash per currency in the drawer; the old single amount counts as dollars
    const { rates, currencies } = await this.branchContext(branchId);
    let openingCash = cleanCash(data.openingCash);
    if (!Object.keys(openingCash).length) openingCash = { USD: round2(Number(data.openingBalance) || 0) };
    const outside = Object.keys(openingCash).find((c) => !currencies.includes(c as Currency));
    if (outside) throw new BadRequestException(`Esta sucursal no maneja ${outside}`);
    if (openingCash.COP && !(rates.COP > 0)) throw new BadRequestException('Falta la tasa del peso colombiano para abrir con COP');

    await this.prisma.shift.create({
      data: {
        userId,
        branchId,
        openingCash: openingCash as any,
        openingBalance: cashToUsd(openingCash, rates),
        status: 'OPEN' as any,
        openedAt: new Date(),
      }
    });

    return this.getActive(userId);
  }

  /**
   * What should be in the drawer, per currency: opening cash, plus cash received in each
   * currency, minus change handed back. Cancelled sales don't count.
   */
  private async drawer(shiftId: string) {
    const shift = await this.prisma.shift.findUnique({
      where: { id: shiftId },
      include: { sales: { include: { payments: true } } },
    });
    if (!shift) throw new BadRequestException('Turno no encontrado');

    const cash: Record<string, number> = { ...((shift.openingCash as CashByCurrency) || { USD: shift.openingBalance }) };
    const add = (c: string, n: number) => { cash[c] = round2((cash[c] || 0) + n); };
    let cashUsd = shift.openingBalance;
    const expectedTotals: Record<string, number> = { CASH: shift.openingBalance, CARD: 0, TRANSFER: 0, PAGO_MOVIL: 0, BINANCE: 0, ZINLI: 0, PAYPAL: 0 };

    for (const sale of shift.sales) {
      if (sale.status === 'CANCELLED') continue;
      for (const p of sale.payments) {
        if (expectedTotals[p.method] !== undefined) expectedTotals[p.method] += p.amount;
        if (p.method !== 'CASH') continue;
        cashUsd += p.amount;
        // Older payments without a currency were taken as dollars
        if (p.currency && isCurrency(p.currency)) add(p.currency, p.amountCurrency ?? p.amount);
        else add('USD', p.amount);
      }
      if (sale.changeCurrency && sale.changeAmount) {
        add(sale.changeCurrency, -sale.changeAmount);
        cashUsd -= sale.changeUsd || 0;
        expectedTotals.CASH -= sale.changeUsd || 0;
      }
    }

    // Older gym charges without their own sale (new ones are already among the shift's sales)
    const gymPayments = await this.prisma.gymPayment.findMany({ where: { shiftId }, select: { method: true, amount: true, saleId: true, currency: true, amountCurrency: true } });
    let gymTotal = 0;
    for (const p of gymPayments) {
      gymTotal += p.amount;
      if (p.saleId) continue;
      if (expectedTotals[p.method] !== undefined) expectedTotals[p.method] += p.amount;
      if (p.method === 'CASH') {
        cashUsd += p.amount;
        add(p.currency && isCurrency(p.currency) ? p.currency : 'USD', p.currency ? (p.amountCurrency ?? p.amount) : p.amount);
      }
    }

    // Cash taken from or put in the drawer outside sales (the income and expenses widget)
    const movements = await this.prisma.financeMovement.findMany({
      where: { shiftId, status: 'ACTIVE', method: 'CASH_DRAWER' },
      orderBy: { occurredAt: 'asc' },
      select: { id: true, type: true, category: true, categoryLabel: true, amount: true, currency: true, amountCurrency: true, description: true, userName: true, occurredAt: true },
    });
    for (const m of movements) {
      const sign = m.type === 'IN' ? 1 : -1;
      add(isCurrency(m.currency) ? m.currency : 'USD', sign * m.amountCurrency);
      cashUsd += sign * m.amount;
      expectedTotals.CASH += sign * m.amount;
    }

    for (const k of Object.keys(expectedTotals)) expectedTotals[k] = round2(expectedTotals[k]);
    return { shift, expectedCash: cash as CashByCurrency, expectedCashUsd: round2(cashUsd), expectedTotals, gymTotal: round2(gymTotal), gymPaymentsCount: gymPayments.length, movements };
  }

  async close(id: string, closingBalance: number, cashBreakdown?: any, declaredDetails?: any, notes?: string, countedCashInput?: unknown) {
    const { shift, expectedCash, expectedCashUsd } = await this.drawer(id);
    if (shift.status !== ('OPEN' as any)) throw new BadRequestException('Este turno ya está cerrado');
    const { rates } = await this.branchContext(shift.branchId);

    // Counted per currency when the drawer was counted that way; otherwise the single total in dollars
    const countedCash = cleanCash(countedCashInput);
    const perCurrency = Object.keys(countedCash).length > 0;
    const counted = perCurrency ? cashToUsd(countedCash, rates) : Number(closingBalance);
    const difference = round2(counted - expectedCashUsd);

    return this.prisma.shift.update({
      where: { id },
      data: {
        closingBalance: counted,
        expectedBalance: expectedCashUsd,
        difference,
        expectedCash: expectedCash as any,
        ...(perCurrency && { countedCash: countedCash as any }),
        cashBreakdown: cashBreakdown ? (cashBreakdown as any) : undefined,
        declaredDetails: declaredDetails ? (declaredDetails as any) : undefined,
        notes: notes !== undefined ? notes : shift.notes,
        status: 'CLOSED' as any,
        closedAt: new Date()
      }
    });
  }

  async getActive(userId: string) {
    const open = await this.prisma.shift.findFirst({ where: { userId, status: 'OPEN' as any }, select: { id: true } });
    if (!open) return null;

    const { shift, expectedCash, expectedCashUsd, expectedTotals, gymTotal, gymPaymentsCount, movements } = await this.drawer(open.id);
    const branch = await this.prisma.branch.findUnique({ where: { id: shift.branchId } });
    const { rates, currencies } = await this.branchContext(shift.branchId);

    // Return the shift without the huge sales array to save bandwidth, but with the calculated totals
    const { sales, ...shiftData } = shift;

    return {
      ...shiftData,
      branch,
      expectedTotals,
      expectedCash,
      expectedCashUsd,
      currencies,
      rates: rates as Rates,
      gymTotal,
      gymPaymentsCount,
      movements,
    };
  }

  async findAll() {
    return this.prisma.shift.findMany({
      include: { user: { select: { id: true, name: true, email: true, role: true, avatar: true } }, branch: true },
      orderBy: { openedAt: 'desc' }
    });
  }
}
