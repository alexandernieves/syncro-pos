import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  try {
    const exists = await prisma.notification.findFirst({
      where: {
        branchId: "some-id",
        title: "some-title",
        createdAt: { gte: today }
      }
    });
    console.log(exists);
  } catch (e) {
    console.error(e.message);
  } finally {
    await prisma.$disconnect();
  }
}
main();
