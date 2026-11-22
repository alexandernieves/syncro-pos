import { createHash } from 'node:crypto';
import { BadRequestException, Body, ConflictException, Controller, ForbiddenException, Get, Header, NotFoundException, Param, Post, Put, Req, StreamableFile, UseGuards } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BcvService } from '../settings/bcv.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { requireFinanceScope } from './finance-access';
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

function exchangeRate(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0.00000001 || value > 1_000_000_000) {
    throw new BadRequestException('Ingresa una tasa válida en unidades de moneda por USD');
  }
  return new Prisma.Decimal(value).toDecimalPlaces(8);
}

function amount(value: unknown, min = 0) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > 2_000_000_000) {
    throw new BadRequestException('Importe inválido en centavos');
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

function date(value: unknown) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new BadRequestException('Fecha inválida');
  }
  const parsed = new Date(value);
  if (!Number.isFinite(+parsed) || parsed.toISOString().slice(0, 10) !== value) {
    throw new BadRequestException('Fecha inválida');
  }
  return value;
}

function label(value: unknown) {
  if (typeof value !== 'string' || !value.trim() || value.length > 200) {
    throw new BadRequestException('Descripción inválida');
  }
  return value.trim();
}

const fiscalSelect = {
  id: true, kind: true, tax: true, direction: true, reference: true, counterparty: true, date: true,
  period: true, dueDate: true, filedDate: true, paidDate: true, status: true, baseCents: true, vatCents: true, amountCents: true,
  rateCurrency: true, rate: true, notes: true, invoiceId: true, supportMime: true,
} as const;

const fiscalStatuses: Record<string, string[]> = {
  invoice: ['issued', 'collected', 'void'],
  declaration: ['pending', 'filed', 'paid'],
  retention: ['pending', 'confirmed'],
};

function fiscalSupport(input: unknown) {
  if (typeof input !== 'string' || input.length > 6_990_508 || !/^[A-Za-z0-9+/]+={0,2}$/.test(input)) {
    throw new BadRequestException('Adjunta un PDF, PNG o JPEG de hasta 5 MiB');
  }
  const bytes = Buffer.from(input, 'base64');
  if (bytes.length > 5 * 1024 * 1024 || bytes.toString('base64') !== input) {
    throw new BadRequestException('Archivo adjunto inválido');
  }
  const mime = bytes.subarray(0, 5).toString() === '%PDF-' ? 'application/pdf'
    : bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? 'image/png'
      : bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255])) ? 'image/jpeg' : null;
  if (!mime) throw new BadRequestException('Solo se admiten PDF, PNG o JPEG');
  return { bytes, mime };
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
    return { entries, plan: plan?.data ?? null };
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
    const { kind, status } = body ?? {};
    if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id) ||
        !Object.prototype.hasOwnProperty.call(fiscalStatuses, kind) || !fiscalStatuses[kind].includes(status)) {
      throw new BadRequestException('Tipo o estado fiscal inválido');
    }
    const tax = kind === 'invoice' ? null : body.tax;
    if (kind !== 'invoice' && !['IVA', 'ISLR'].includes(tax)) throw new BadRequestException('Selecciona el impuesto');
    const direction = kind === 'retention' ? body.direction : null;
    if (kind === 'retention' && !['received', 'issued'].includes(direction)) throw new BadRequestException('Selecciona el sentido de la retención');
    const period = body.period || null;
    if ((kind === 'declaration' && !period) || (period && (typeof period !== 'string' || !/^\d{4}(?:-(?:0[1-9]|1[0-2])(?:-[12])?)?$/.test(period)))) {
      throw new BadRequestException('Período inválido. Usa AAAA, AAAA-MM o AAAA-MM-1 / AAAA-MM-2');
    }
    const invoiceId = kind === 'retention' ? body.invoiceId || null : null;
    if (invoiceId && (typeof invoiceId !== 'string' || !(await this.prisma.centralFiscalRecord.findFirst({
      where: { scope, id: invoiceId, kind: 'invoice' }, select: { id: true },
    })))) throw new BadRequestException('La factura vinculada no está disponible');
    const rateCurrency = kind === 'invoice' ? body.rateCurrency || null : null;
    if (rateCurrency && !['USD', 'EUR'].includes(rateCurrency)) throw new BadRequestException('Moneda de referencia inválida');
    const attachment = body.support == null ? null : fiscalSupport(body.support);
    const reference = kind === 'declaration' && !body.reference ? `${tax} ${period}` : label(body.reference);
    const counterparty = body.counterparty ? label(body.counterparty) : null;
    if (kind === 'retention' && !counterparty) throw new BadRequestException('Indica la contraparte de la retención');
    const identity = createHash('sha256').update(JSON.stringify(
      kind === 'declaration' ? [kind, tax, period]
        : kind === 'retention' ? [kind, tax, direction, counterparty?.toUpperCase(), reference.toUpperCase()]
          : [kind, reference.toUpperCase()],
    )).digest('hex');
    const data = {
      kind, tax, direction, status, period, invoiceId, identity, reference, counterparty,
      date: date(body.date), dueDate: body.dueDate ? date(body.dueDate) : null,
      filedDate: kind === 'declaration' && body.filedDate ? date(body.filedDate) : null,
      paidDate: kind !== 'retention' && body.paidDate ? date(body.paidDate) : null,
      amountCents: kind !== 'invoice' && body.amountCents == null ? null : amount(body.amountCents),
      baseCents: kind === 'invoice' && body.baseCents != null ? amount(body.baseCents) : null,
      vatCents: kind === 'invoice' && body.vatCents != null ? amount(body.vatCents) : null,
      rateCurrency, rate: rateCurrency ? exchangeRate(body.rate) : null,
      notes: body.notes ? label(body.notes) : null, actorId: req.user.id,
      ...(attachment && { support: new Uint8Array(attachment.bytes), supportMime: attachment.mime }),
    };
    const existing = await this.prisma.centralFiscalRecord.findUnique({ where: { scope_id: { scope, id } }, select: { kind: true } });
    if (existing && existing.kind !== kind) throw new BadRequestException('No se puede cambiar el tipo de un registro fiscal guardado');
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
    const income = monetary(body.incomeOriginal, body.income);
    const data = {
      frequency,
      weeklyPayday,
      horizonWeeks: amount(body.horizonWeeks ?? 13, 1),
      monthlyOverrides: monthlyIncome,
      paydayOverrides: paydayIncome,
      incomeOverrides,
      smallSpendLimit: amount(body.smallSpendLimit ?? 0),
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
    await this.prisma.centralFinancePlan.upsert({ where: { scope }, create: { scope, data }, update: { data } });
    return data;
  }
}
