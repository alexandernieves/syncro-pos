import { BadRequestException, Body, ConflictException, Controller, ForbiddenException, Get, Header, NotFoundException, Param, Post, Put, Req, StreamableFile, UseGuards } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BcvService } from '../settings/bcv.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { requireFinanceScope } from './finance-access';
import { amount, date, exchangeRate, fiscalRecordData, fiscalSelect, label } from './central-fiscal-data';
import { financeBankEntryId } from './finance-bank-identity';
import { PrismaService } from '../prisma/prisma.service';

const accounts = ['cash', 'bank', 'receivable', 'payable', 'debt', 'equity', 'income', 'food', 'dining', 'housing', 'transport', 'health', 'interest', 'expense', 'subscriptions', 'shopping', 'leisure'];
const expenseAccounts = accounts.slice(accounts.indexOf('food'));
const wallets = ['cash', 'bank', 'binance'];
accounts.push('binance');

function currency(value: unknown) {
  if (typeof value !== 'string' || !/^(?:[A-Z]{3}|USDT)$/.test(value)) {
    throw new BadRequestException('Moneda inválida');
  }
  return value;
}

function monetary(value: any, fallback: unknown, min = 0) {
  if (value == null) return { cents: amount(fallback, min), original: null };
  const code = currency(value.currency);
  const nativeCents = amount(value.nativeCents, min);
  const rate = exchangeRate(code === 'USD' ? 1 : value.rate);
  const cents = amount(new Prisma.Decimal(nativeCents).div(rate).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP).toNumber(), min);
  return { cents, original: { currency: code, nativeCents, rate: rate.toNumber() } };
}

@Controller('syncro-admin/finance')
@UseGuards(JwtAuthGuard)
export class CentralFinanceController {
  private quotes?: { expires: number; data: Promise<unknown> };

  constructor(private readonly prisma: PrismaService, private readonly bcv: BcvService) {}

  @Get('rates')
  @Header('Cache-Control', 'private, no-store')
  async rates(@Req() req: any) {
    await this.scope(req, 'personal');
    if (!this.quotes || this.quotes.expires < Date.now()) {
      const data = Promise.all([this.bcv.fetchBcv().catch(() => null), this.bcv.fetchTrm().catch(() => null)])
        .then(([bcv, trm]) => ({
          VES: bcv?.rateUsd ? { rate: bcv.rateUsd, source: 'BCV', date: bcv.updateDate } : null,
          EUR: bcv?.rateUsd && bcv.rateEur ? { rate: bcv.rateUsd / bcv.rateEur, source: 'BCV', date: bcv.updateDate } : null,
          COP: trm ? { ...trm, source: 'TRM' } : null,
          USDT: { rate: 1, source: 'Paridad' },
        }));
      this.quotes = { expires: Date.now() + 5 * 60_000, data };
    }
    return this.quotes.data;
  }

  private async scope(req: any, workspace: string) {
    return requireFinanceScope(this.prisma, req.user, workspace);
  }

  @Get(':workspace')
  @Header('Cache-Control', 'private, no-store')
  async read(@Req() req: any, @Param('workspace') workspace: string) {
    const scope = await this.scope(req, workspace);
    const [entries, plan] = await this.prisma.$transaction([
      this.prisma.centralFinanceEntry.findMany({ where: { scope }, orderBy: [{ date: 'desc' }, { createdAt: 'desc' }], select: { id: true, date: true, description: true, debit: true, credit: true, cents: true, smallSpend: true, currency: true, nativeCents: true, rate: true, toCurrency: true, toCents: true } }),
      this.prisma.centralFinancePlan.findUnique({ where: { scope } }),
    ]);
    const planData = plan?.data ? { ...(plan.data as Record<string, unknown>) } : null;
    if (planData) {
      delete planData.googleCalendar;
      delete planData.aiUsage;
      delete planData.aiModel;
    }
    return { entries, plan: planData };
  }

  @Get(':workspace/fiscal')
  @Header('Cache-Control', 'private, no-store')
  async fiscalRecords(@Req() req: any, @Param('workspace') workspace: string) {
    const scope = await this.scope(req, workspace);
    return this.prisma.centralFiscalRecord.findMany({
      where: { scope }, orderBy: [{ date: 'desc' }, { reference: 'desc' }], select: fiscalSelect,
    });
  }

  @Put(':workspace/fiscal/:id')
  @Header('Cache-Control', 'private, no-store')
  async saveFiscal(@Req() req: any, @Param('workspace') workspace: string, @Param('id') id: string, @Body() body: any) {
    const scope = await this.scope(req, workspace);
    if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id)) {
      throw new BadRequestException('Tipo o estado fiscal inválido');
    }
    const data = await fiscalRecordData(this.prisma, scope, req.user.id, body);
    const existing = await this.prisma.centralFiscalRecord.findUnique({ where: { scope_id: { scope, id } }, select: { kind: true } });
    if (existing && existing.kind !== data.kind) throw new BadRequestException('No se puede cambiar el tipo de un registro fiscal guardado');
    try {
      return await this.prisma.centralFiscalRecord.upsert({
        where: { scope_id: { scope, id } }, create: { ...data, scope, id }, update: data, select: fiscalSelect,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Ya existe un registro con esa referencia o período fiscal');
      }
      throw error;
    }
  }

  @Get(':workspace/fiscal/:id/support')
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  async fiscalAttachment(@Req() req: any, @Param('workspace') workspace: string, @Param('id') id: string) {
    const scope = await this.scope(req, workspace);
    const record = await this.prisma.centralFiscalRecord.findUnique({
      where: { scope_id: { scope, id } }, select: { support: true, supportMime: true },
    });
    if (!record?.support || !record.supportMime) throw new NotFoundException('Soporte no disponible');
    const extension = record.supportMime === 'application/pdf' ? 'pdf' : record.supportMime === 'image/png' ? 'png' : 'jpg';
    return new StreamableFile(Buffer.from(record.support), { type: record.supportMime, disposition: `attachment; filename="soporte.${extension}"` });
  }

  @Post(':workspace/entries')
  async post(@Req() req: any, @Param('workspace') workspace: string, @Body() body: any) {
    const scope = await this.scope(req, workspace);
    const { id, debit, credit } = body ?? {};
    const originalCurrency = currency(body?.currency ?? 'USD');
    const toCurrency = body?.toCurrency == null ? null : currency(body.toCurrency);
    if (typeof id !== 'string' || !/^[a-f0-9-]{36}$/i.test(id) ||
        !accounts.includes(debit) || !accounts.includes(credit) ||
        (debit === credit && (!toCurrency || toCurrency === originalCurrency)) ||
        (toCurrency && (!wallets.includes(debit) || !wallets.includes(credit)))) {
      throw new BadRequestException('Identificador o cuentas inválidas');
    }
    const smallSpend = body.smallSpend === true;
    if (smallSpend && (!expenseAccounts.includes(debit) || !wallets.includes(credit))) {
      throw new BadRequestException('Marca como gasto hormiga un egreso de caja o banco');
    }
    if (body.nativeCents == null && (originalCurrency !== 'USD' || toCurrency)) {
      throw new BadRequestException('Falta el importe original');
    }
    const { cents, original } = monetary(body.nativeCents == null ? null : body, body.cents, 1);
    const nativeCents = original?.nativeCents ?? null;
    const rate = original ? new Prisma.Decimal(original.rate) : null;
    const toCents = toCurrency ? amount(body.toCents, 1) : null;
    if (toCurrency === originalCurrency && toCents !== nativeCents) {
      throw new BadRequestException('Registra cualquier comisión como un gasto separado');
    }
    const entry = {
      scope, id, debit, credit, smallSpend, currency: originalCurrency, nativeCents, rate, toCurrency, toCents,
      date: date(body.date), description: label(body.description), cents, actorId: req.user.id,
    };
    const saved = await this.prisma.centralFinanceEntry.upsert({
      where: { scope_id: { scope, id } },
      create: entry,
      update: {},
    });
    if (saved.debit !== debit || saved.credit !== credit || saved.date !== entry.date || saved.description !== entry.description || saved.cents !== entry.cents || saved.smallSpend !== smallSpend ||
        saved.currency !== originalCurrency || saved.nativeCents !== nativeCents || saved.toCurrency !== toCurrency ||
        saved.toCents !== toCents || String(saved.rate) !== String(rate)) {
      throw new ConflictException('El identificador ya corresponde a otro asiento');
    }
    return { id: saved.id };
  }

  @Post('personal/import')
  @Header('Cache-Control', 'private, no-store')
  async importBankEntries(@Req() req: any, @Body() body: any) {
    const scope = await this.scope(req, 'personal');
    if (!Array.isArray(body?.entries) || !body.entries.length || body.entries.length > 100) {
      throw new BadRequestException('Confirma entre 1 y 100 movimientos');
    }
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Caracas', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const entries = body.entries.map((row: any) => {
      const posted = date(row?.date);
      if (posted > today) throw new BadRequestException('El archivo contiene movimientos con fecha futura');
      const reference = label(row.reference).toUpperCase();
      const description = label(row.description);
      const kind = row.kind;
      const category = row.category;
      if (kind !== 'income' && (kind !== 'expense' || !expenseAccounts.includes(category))) {
        throw new BadRequestException('Confirma la categoría de cada movimiento seleccionado');
      }
      const { cents, original } = monetary(row, null, 1);
      const { currency, nativeCents, rate } = original!;
      const id = financeBankEntryId(posted, reference, currency, nativeCents, kind);
      return {
        scope, id, date: posted, description, cents, currency, nativeCents, rate: new Prisma.Decimal(rate),
        debit: kind === 'income' ? 'bank' : category,
        credit: kind === 'income' ? 'income' : 'bank',
        actorId: req.user.id,
      };
    });
    const result = await this.prisma.centralFinanceEntry.createMany({ data: entries, skipDuplicates: true });
    return { count: result.count, duplicates: entries.length - result.count };
  }

  @Post('company/owner-payment')
  async ownerPayment(@Req() req: any, @Body() body: any) {
    const company = await this.scope(req, 'company');
    const personal = await this.scope(req, 'personal');
    const { id, account, classification } = body ?? {};
    if (typeof id !== 'string' || !/^[a-f0-9-]{36}$/i.test(id) ||
        !wallets.includes(account) || !['expense', 'equity'].includes(classification)) {
      throw new BadRequestException('Cuenta o clasificación inválida');
    }
    const { cents, original } = monetary(body.nativeCents == null ? null : body, body.cents, 1);
    const shared = {
      id, date: date(body.date), description: label(body.description), cents, actorId: req.user.id,
      currency: original?.currency ?? 'USD', nativeCents: original?.nativeCents ?? null,
      rate: original ? new Prisma.Decimal(original.rate) : null,
    };
    await this.prisma.$transaction(async tx => {
      const entries = [
        { ...shared, scope: company, debit: classification, credit: account },
        { ...shared, scope: personal, debit: account, credit: classification === 'expense' ? 'income' : 'equity' },
      ];
      for (const entry of entries) {
        const saved = await tx.centralFinanceEntry.upsert({
          where: { scope_id: { scope: entry.scope, id } },
          create: entry,
          update: {},
        });
        if (saved.actorId !== shared.actorId || saved.debit !== entry.debit || saved.credit !== entry.credit ||
            saved.date !== shared.date || saved.description !== shared.description || saved.cents !== shared.cents ||
            saved.currency !== shared.currency || saved.nativeCents !== shared.nativeCents || String(saved.rate) !== String(shared.rate)) {
          throw new ConflictException('El identificador ya corresponde a otro asiento');
        }
      }
    });
    return { id };
  }

  @Put(':workspace/plan')
  async plan(@Req() req: any, @Param('workspace') workspace: string, @Body() body: any) {
    const scope = await this.scope(req, workspace);
    if (!Array.isArray(body?.obligations) || body.obligations.length > 200) throw new BadRequestException('Compromisos inválidos');
    if (!Array.isArray(body.debts) || body.debts.length > 100) throw new BadRequestException('Deudas inválidas');
    const overrides = body.incomeOverrides ?? [];
    if (!Array.isArray(overrides) || overrides.length > 200) throw new BadRequestException('Ajustes de ingreso inválidos');
    const incomeOverrides = overrides.map((row: any) => {
      if (row?.slot !== 1 && row?.slot !== 2) throw new BadRequestException('Quincena inválida');
      const month = date(`${row.month}-01`).slice(0, 7);
      return { month, slot: row.slot, cents: amount(row.cents) };
    });
    if (new Set(incomeOverrides.map(row => `${row.month}:${row.slot}`)).size !== incomeOverrides.length) {
      throw new BadRequestException('Hay ajustes duplicados para una quincena');
    }
    const frequency = body.frequency ?? 'twice-monthly';
    if (!['weekly', 'twice-monthly', 'monthly'].includes(frequency)) throw new BadRequestException('Frecuencia inválida');
    const weeklyPayday = amount(body.weeklyPayday ?? 5);
    if (weeklyPayday > 6) throw new BadRequestException('Día de la semana inválido');
    const monthlyOverrides = body.monthlyOverrides ?? [];
    if (!Array.isArray(monthlyOverrides) || monthlyOverrides.length > 200) throw new BadRequestException('Ajustes mensuales inválidos');
    const monthlyIncome = monthlyOverrides.map((row: any) => ({
      month: date(`${row?.month}-01`).slice(0, 7),
      cents: amount(row.cents),
    }));
    if (new Set(monthlyIncome.map(row => row.month)).size !== monthlyIncome.length) {
      throw new BadRequestException('Hay ajustes duplicados para un mes');
    }
    const paydayOverrides = body.paydayOverrides ?? [];
    if (!Array.isArray(paydayOverrides) || paydayOverrides.length > 200) throw new BadRequestException('Ajustes por fecha inválidos');
    const paydayIncome = paydayOverrides.map((row: any) => ({ date: date(row?.date), cents: amount(row.cents) }));
    if (new Set(paydayIncome.map(row => row.date)).size !== paydayIncome.length) {
      throw new BadRequestException('Hay ajustes duplicados para una fecha');
    }
    const rawGoals = body.goals ?? [];
    if (!Array.isArray(rawGoals) || rawGoals.length > 50) throw new BadRequestException('Objetivos inválidos');
    const goals = rawGoals.map((row: any) => ({
      id: typeof row?.id === 'string' && row.id.trim() ? row.id.trim().slice(0, 64) : label(row?.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40),
      name: label(row?.name),
      kind: ['emergency', 'investment', 'goal'].includes(row?.kind) ? row.kind : 'goal',
      targetCents: amount(row?.targetCents, 1),
      savedCents: amount(row?.savedCents ?? 0, 0),
      monthlyTargetCents: amount(row?.monthlyTargetCents ?? 0, 0),
      deadline: row?.deadline ? date(row.deadline) : null,
    }));
    const rawTrips = body.marketTrips ?? [];
    if (!Array.isArray(rawTrips) || rawTrips.length > 60) throw new BadRequestException('Registros de mercado inválidos');
    const marketTrips = rawTrips.map((trip: any) => {
      const items = Array.isArray(trip?.items) ? trip.items.slice(0, 100).map((item: any, idx: number) => ({
        id: typeof item?.id === 'string' && item.id.trim() ? item.id.trim().slice(0, 64) : `item-${idx}`,
        name: label(item?.name),
        cents: amount(item?.cents, 1),
        qty: Math.max(1, Math.min(999, Math.round(Number(item?.qty ?? 1) || 1))),
      })) : [];
      const totalCents = items.reduce((sum: number, item: any) => sum + item.cents * (item.qty ?? 1), 0);
      return {
        id: typeof trip?.id === 'string' && trip.id.trim() ? trip.id.trim().slice(0, 64) : `trip-${date(trip?.date)}`,
        date: date(trip?.date),
        store: typeof trip?.store === 'string' && trip.store.trim() ? trip.store.trim().slice(0, 120) : null,
        status: trip?.status === 'closed' ? 'closed' : 'open',
        items,
        totalCents,
      };
    });
    const rawAssets = body.assets ?? [];
    if (!Array.isArray(rawAssets) || rawAssets.length > 50) throw new BadRequestException('Activos inválidos');
    const assets = rawAssets.map((row: any) => ({
      id: typeof row?.id === 'string' && row.id.trim() ? row.id.trim().slice(0, 64) : label(row?.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40),
      name: label(row?.name),
      category: ['salary', 'business', 'investment', 'rental', 'digital', 'other'].includes(row?.category) ? row.category : 'business',
      status: row?.status === 'planned' ? 'planned' : 'active',
      monthlyCashflowCents: amount(row?.monthlyCashflowCents ?? 0, 0),
      valuationCents: amount(row?.valuationCents ?? 0, 0),
      startupCapitalCents: amount(row?.startupCapitalCents ?? 0, 0),
      savedCapitalCents: amount(row?.savedCapitalCents ?? 0, 0),
      linkedLiabilityId: typeof row?.linkedLiabilityId === 'string' && row.linkedLiabilityId.trim() ? row.linkedLiabilityId.trim().slice(0, 64) : null,
      notes: typeof row?.notes === 'string' && row.notes.trim() ? row.notes.trim().slice(0, 200) : null,
    }));
    const rawLiabilities = body.liabilities ?? [];
    if (!Array.isArray(rawLiabilities) || rawLiabilities.length > 50) throw new BadRequestException('Pasivos inválidos');
    const liabilities = rawLiabilities.map((row: any) => ({
      id: typeof row?.id === 'string' && row.id.trim() ? row.id.trim().slice(0, 64) : label(row?.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40),
      name: label(row?.name),
      category: ['vehicle', 'housing', 'subscription', 'debt', 'lifestyle', 'other'].includes(row?.category) ? row.category : 'other',
      monthlyDrainCents: amount(row?.monthlyDrainCents ?? 0, 0),
      balanceCents: amount(row?.balanceCents ?? 0, 0),
      notes: typeof row?.notes === 'string' && row.notes.trim() ? row.notes.trim().slice(0, 200) : null,
    }));
    const income = monetary(body.incomeOriginal, body.income);
    const data = {
      frequency,
      weeklyPayday,
      horizonWeeks: amount(body.horizonWeeks ?? 13, 1),
      monthlyOverrides: monthlyIncome,
      paydayOverrides: paydayIncome,
      incomeOverrides,
      smallSpendLimit: amount(body.smallSpendLimit ?? 0),
      goals,
      marketTrips,
      assets,
      liabilities,
      debts: body.debts.map((row: any) => {
        const apr = amount(row?.apr);
        if (apr > 100_000) throw new BadRequestException('Tasa anual fuera de rango');
        const balance = monetary(row.balanceOriginal, row.balance, 1);
        const minimum = monetary(row.minimumOriginal, row.minimum, 1);
        return { name: label(row.name), balance: balance.cents, minimum: minimum.cents, balanceOriginal: balance.original, minimumOriginal: minimum.original, apr, date: date(row.date) };
      }),
      income: income.cents,
      incomeOriginal: income.original,
      grocery: amount(body.grocery),
      dining: amount(body.dining),
      reserve: amount(body.reserve),
      payday1: amount(body.payday1, 1),
      payday2: amount(body.payday2, 1),
      obligations: body.obligations.map((row: any) => {
        const value = monetary(row?.original, row?.cents, 1);
        return { name: label(row?.name), date: date(row.date), cents: value.cents, original: value.original,
          kind: row.kind === 'income' ? 'income' : 'payment', monthly: row.monthly === true };
      }),
    };
    if (data.horizonWeeks > 52) throw new BadRequestException('El horizonte máximo es de 52 semanas');
    if (data.payday1 > 31 || data.payday2 > 31 || (frequency === 'twice-monthly' && data.payday1 >= data.payday2)) throw new BadRequestException('Días de cobro inválidos');
    const existingPlan = await this.prisma.centralFinancePlan.findUnique({ where: { scope } });
    const existingRaw = existingPlan?.data as Record<string, unknown> | null;
    const stored = {
      ...data,
      ...(existingRaw?.googleCalendar ? { googleCalendar: existingRaw.googleCalendar } : {}),
      ...(existingRaw?.aiUsage ? { aiUsage: existingRaw.aiUsage } : {}),
      ...(existingRaw?.aiModel ? { aiModel: existingRaw.aiModel } : {}),
    };
    await this.prisma.centralFinancePlan.upsert({ where: { scope }, create: { scope, data: stored }, update: { data: stored } });
    return data;
  }
}
