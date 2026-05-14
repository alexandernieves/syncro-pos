const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const count = await prisma.auditLog.count();
  const lastLogs = await prisma.auditLog.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    include: { user: true }
  });
  console.log('Total logs:', count);
  console.log('Last 5 logs:', JSON.stringify(lastLogs, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
