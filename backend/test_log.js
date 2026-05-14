const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst();
  if (!user) {
    console.log('No user found to associate log');
    return;
  }
  
  const log = await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: 'TEST_ACTION',
      entity: 'TEST',
      details: JSON.stringify({ test: true }),
      ipAddress: '127.0.0.1'
    }
  });
  console.log('Test log created:', log);
}

main().catch(console.error).finally(() => prisma.$disconnect());
