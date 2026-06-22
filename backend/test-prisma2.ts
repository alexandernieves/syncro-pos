import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  try {
    const exists = await prisma.notification.findFirst({
      where: {
        branchId: undefined, // Let's test passing undefined
        title: undefined,
        createdAt: { gte: today }
      }
    });
    console.log(exists);
  } catch (e) {
    console.error("ERROR CAUGHT:");
    console.error(e.message);
  } finally {
    await prisma.$disconnect();
  }
}
main();
