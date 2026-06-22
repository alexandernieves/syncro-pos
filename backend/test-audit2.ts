import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const inventory = await prisma.inventory.findFirst({
    include: { variant: true }
  });
  if (inventory) {
    console.log("Updating inventory to 0 to trigger low stock alert...");
    await prisma.inventory.update({
      where: { id: inventory.id },
      data: { quantity: 0 }
    });
    console.log("Inventory updated.");
  } else {
    console.log("No inventory found.");
  }
  await prisma.$disconnect();
}
main();
