import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  await prisma.notification.deleteMany({});
  console.log('Notifications cleared');
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
