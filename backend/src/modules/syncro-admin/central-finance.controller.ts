import { BadRequestException, Body, ConflictException, Controller, ForbiddenException, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

const accounts = ['cash', 'bank', 'receivable', 'payable', 'debt', 'equity', 'income', 'food', 'dining', 'housing', 'transport', 'health', 'interest', 'expense', 'subscriptions', 'shopping', 'leisure'];
const expenseAccounts = accounts.slice(accounts.indexOf('food'));

function amount(value: unknown, min = 0) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > 2_000_000_000) {
    throw new BadRequestException('Importe inválido en centavos');
  }
  return value;
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

@Controller('syncro-admin/finance')
@UseGuards(JwtAuthGuard)
export class CentralFinanceController {
  constructor(private readonly prisma: PrismaService) {}

  private scope(req: any, workspace: string) {
    const user = req.user;
    if (user?.role !== 'syncropos' || typeof user.id !== 'string' || !user.id) throw new ForbiddenException();
    if (workspace === 'personal') return `personal:${user.id}`;
    const financeAdmins = (process.env.SYNCRO_FINANCE_ADMIN_IDS ?? '').split(',').map(id => id.trim());
    if (workspace === 'company' && financeAdmins.includes(user.id)) return 'company';
    throw new ForbiddenException('Acceso financiero no autorizado');
  }

  @Get(':workspace')
  async read(@Req() req: any, @Param('workspace') workspace: string) {
    const scope = this.scope(req, workspace);
    const [entries, plan] = await this.prisma.$transaction([
      this.prisma.centralFinanceEntry.findMany({ where: { scope }, orderBy: [{ date: 'desc' }, { createdAt: 'desc' }], select: { id: true, date: true, description: true, debit: true, credit: true, cents: true, smallSpend: true } }),
      this.prisma.centralFinancePlan.findUnique({ where: { scope } }),
    ]);
    return { entries, plan: plan?.data ?? null };
  }

  @Post(':workspace/entries')
  async post(@Req() req: any, @Param('workspace') workspace: string, @Body() body: any) {
    const scope = this.scope(req, workspace);
    const { id, debit, credit } = body ?? {};
    if (typeof id !== 'string' || !/^[a-f0-9-]{36}$/i.test(id) || debit === credit || !accounts.includes(debit) || !accounts.includes(credit)) {
      throw new BadRequestException('Identificador o cuentas inválidas');
    }
    const smallSpend = body.smallSpend === true;
    if (smallSpend && (!expenseAccounts.includes(debit) || !['cash', 'bank'].includes(credit))) {
      throw new BadRequestException('Marca como gasto hormiga un egreso de caja o banco');
    }
    const entry = { scope, id, debit, credit, smallSpend, date: date(body.date), description: label(body.description), cents: amount(body.cents, 1), actorId: req.user.id };
    const saved = await this.prisma.centralFinanceEntry.upsert({
      where: { scope_id: { scope, id } },
      create: entry,
      update: {},
    });
    if (saved.debit !== debit || saved.credit !== credit || saved.date !== entry.date || saved.description !== entry.description || saved.cents !== entry.cents || saved.smallSpend !== smallSpend) {
      throw new ConflictException('El identificador ya corresponde a otro asiento');
    }
    return { id: saved.id };
  }

  @Post('company/owner-payment')
  async ownerPayment(@Req() req: any, @Body() body: any) {
    const company = this.scope(req, 'company');
    const personal = this.scope(req, 'personal');
    const { id, account, classification } = body ?? {};
    if (typeof id !== 'string' || !/^[a-f0-9-]{36}$/i.test(id) ||
        !['cash', 'bank'].includes(account) || !['expense', 'equity'].includes(classification)) {
      throw new BadRequestException('Cuenta o clasificación inválida');
    }
    const shared = { id, date: date(body.date), description: label(body.description), cents: amount(body.cents, 1), actorId: req.user.id };
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
            saved.date !== shared.date || saved.description !== shared.description || saved.cents !== shared.cents) {
          throw new ConflictException('El identificador ya corresponde a otro asiento');
        }
      }
    });
    return { id };
  }

  @Put(':workspace/plan')
  async plan(@Req() req: any, @Param('workspace') workspace: string, @Body() body: any) {
    const scope = this.scope(req, workspace);
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
    const data = {
      incomeOverrides,
      smallSpendLimit: amount(body.smallSpendLimit ?? 0),
      debts: body.debts.map((row: any) => {
        const apr = amount(row?.apr);
        if (apr > 100_000) throw new BadRequestException('Tasa anual fuera de rango');
        return { name: label(row.name), balance: amount(row.balance, 1), minimum: amount(row.minimum, 1), apr, date: date(row.date) };
      }),
      income: amount(body.income),
      grocery: amount(body.grocery),
      dining: amount(body.dining),
      reserve: amount(body.reserve),
      payday1: amount(body.payday1, 1),
      payday2: amount(body.payday2, 1),
      obligations: body.obligations.map((row: any) => ({
        name: label(row?.name),
        date: date(row.date),
        cents: amount(row.cents, 1),
        kind: row.kind === 'income' ? 'income' : 'payment',
        monthly: row.monthly === true,
      })),
    };
    if (data.payday1 >= data.payday2 || data.payday2 > 31) throw new BadRequestException('Días de cobro inválidos');
    await this.prisma.centralFinancePlan.upsert({ where: { scope }, create: { scope, data }, update: { data } });
    return data;
  }
}
