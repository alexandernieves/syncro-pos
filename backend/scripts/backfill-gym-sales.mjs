// Creates the sale for gym charges recorded before charges became sales (one sale per charge).
// Links the existing accounting entry to it, so nothing is counted twice. Safe to run again.
//   node scripts/backfill-gym-sales.mjs            (dry run)
//   node scripts/backfill-gym-sales.mjs --apply
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const apply = process.argv.includes('--apply');
const url = process.env.DATABASE_URL || '';
console.log(`Base: ${url.replace(/\/\/[^@]*@/, '//***@')}${apply ? '' : '  (simulación, usa --apply para guardar)'}`);

const payments = await prisma.gymPayment.findMany({
  where: { saleId: null, createdById: { not: null }, branchId: { not: null } },
  include: { membership: { include: { member: { select: { clientId: true } } } }, visit: true },
  orderBy: { createdAt: 'asc' },
});
let done = 0;
for (const p of payments) {
  const item = p.membership ? `Membresía ${p.membership.planName}` : p.visit ? (p.visit.kind === 'GUEST' ? 'Pase de invitado' : 'Pase de día') : 'Cobro del gimnasio';
  console.log(`${p.createdAt.toISOString().slice(0, 16)} · ${item} · $${p.amount} · ${p.method}`);
  if (!apply) continue;
  await prisma.$transaction(async (tx) => {
    const sale = await tx.sale.create({
      data: {
        branchId: p.branchId, userId: p.createdById, businessId: p.businessId, clientId: p.membership?.member.clientId ?? null,
        paymentMethod: p.method, subtotal: p.amount, total: p.amount, channel: 'GYM', shiftId: p.shiftId, createdAt: p.createdAt,
        items: { create: [{ description: item, quantity: 1, price: p.amount, subtotal: p.amount }] },
        payments: { create: [{ method: p.method, amount: p.amount, reference: p.reference, exchangeRate: p.exchangeRate }] },
      },
    });
    await tx.gymPayment.update({ where: { id: p.id }, data: { saleId: sale.id } });
    if (p.accountingEntryId) await tx.accountingEntry.update({ where: { id: p.accountingEntryId }, data: { saleId: sale.id } }).catch(() => {});
  });
  done++;
}
console.log(apply ? `Listo: ${done} ventas creadas.` : `${payments.length} cobros sin venta.`);
await prisma.$disconnect();
