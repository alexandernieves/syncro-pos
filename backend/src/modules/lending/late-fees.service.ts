import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { chargesDue, cleanLateFees, LateFeePolicy } from './late-fees';

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Applies each business's late-charge policy to its clients' late installments, every hour.
 * A charge raises the installment, the loan and the client's debt, and leaves a "DEBT" movement
 * in the client's history. The unique index on LoanLateCharge makes each charge happen only once.
 */
@Injectable()
export class LateFeesService {
  private readonly log = new Logger('LateFees');
  private running = false;

  constructor(private readonly prisma: PrismaService) {}

  @Cron('0 20 * * * *', { timeZone: 'America/Caracas' })
  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const n = await this.applyAll();
      if (n) this.log.log(`Recargos por atraso aplicados: ${n}`);
    } catch (e: any) {
      this.log.error(`No se pudieron aplicar recargos: ${e?.message}`);
    } finally {
      this.running = false;
    }
  }

  async applyAll(now = new Date()) {
    const settings = await this.prisma.setting.findMany({
      where: { businessId: { not: null } },
      select: { businessId: true, syncroCreditLateFees: true },
    });
    let total = 0;
    for (const s of settings) {
      const policy = cleanLateFees(s.syncroCreditLateFees);
      if (!policy.enabled || !s.businessId) continue;
      total += await this.applyBusiness(s.businessId, policy, now);
    }
    return total;
  }

  /** Charges for one business: only installments of its own clients (golden rule) */
  async applyBusiness(businessId: string, policy: LateFeePolicy, now = new Date()) {
    const cutoff = new Date(now.getTime() - policy.graceDays * 86400000);
    const insts = await this.prisma.loanInstallment.findMany({
      where: {
        status: 'PENDING',
        dueDate: { lt: cutoff },
        loan: { client: { businessId }, status: { in: ['PENDING', 'OVERDUE'] } },
      },
      select: { id: true, installmentNumber: true, dueDate: true, amount: true, paidAmount: true, lateCharges: true, loanId: true, loan: { select: { clientId: true } } },
      take: 5000,
    });
    if (!insts.length) return 0;
    const done = await this.prisma.loanLateCharge.findMany({
      where: { installmentId: { in: insts.map((i) => i.id) } },
      select: { installmentId: true, kind: true, ref: true, period: true },
    });
    const has = new Set(done.map((d) => `${d.installmentId}|${d.kind}|${d.ref}|${d.period}`));

    let applied = 0;
    for (const inst of insts) {
      const base = round2(inst.amount - inst.lateCharges);
      const unpaid = round2(Math.max(0, Math.min(base, inst.amount - inst.paidAmount)));
      // only the charges are left unpaid: they don't generate more charges
      if (unpaid <= 0.004) continue;
      let wanted = chargesDue(policy, inst.dueDate, base, unpaid, now).filter((c) => !has.has(`${inst.id}|${c.kind}|${c.ref}|${c.period}`));
      if (!wanted.length) continue;
      // the cap: everything charged on one installment stays under capPct of it (0 = no cap)
      if (policy.capPct > 0) {
        let room = round2((base * policy.capPct) / 100 - inst.lateCharges);
        const capped: typeof wanted = [];
        for (const c of wanted) {
          if (room <= 0.004) break;
          const amount = round2(Math.min(c.amount, room));
          capped.push({ ...c, amount });
          room = round2(room - amount);
        }
        wanted = capped;
      }
      if (!wanted.length) continue;
      const sum = round2(wanted.reduce((a, c) => a + c.amount, 0));
      try {
        await this.prisma.$transaction(async (tx) => {
          await tx.loanLateCharge.createMany({
            data: wanted.map((c) => ({ installmentId: inst.id, loanId: inst.loanId, clientId: inst.loan.clientId, businessId, ...c })),
          });
          await tx.loanInstallment.update({ where: { id: inst.id }, data: { amount: { increment: sum }, lateCharges: { increment: sum } } });
          await tx.loan.update({ where: { id: inst.loanId }, data: { totalToPay: { increment: sum }, remainingBalance: { increment: sum } } });
          await tx.client.update({ where: { id: inst.loan.clientId }, data: { currentDebt: { increment: sum } } });
          await tx.creditTransaction.create({
            data: { clientId: inst.loan.clientId, amount: sum, type: 'DEBT', notes: `Recargo por atraso · cuota ${inst.installmentNumber}: ${[...new Set(wanted.map((c) => c.name))].join(', ')}` },
          });
        });
        applied += wanted.length;
      } catch (e: any) {
        // P2002: another run already charged it; anything else, try again next hour
        if (e?.code !== 'P2002') this.log.warn(`Cuota ${inst.id}: ${e?.message}`);
      }
    }
    return applied;
  }
}
