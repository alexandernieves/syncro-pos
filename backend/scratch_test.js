const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const settings = await prisma.setting.findMany({
      include: { business: { select: { name: true } } }
    });
    console.log("TOTAL SETTINGS:", settings.length);
    for (const s of settings) {
      console.log(`\n--- Business: ${s.business?.name || 'N/A'} (${s.businessId}) ---`);
      console.log(`  whatsappBotEnabled: ${s.whatsappBotEnabled}`);
      console.log(`  whatsappAuthorizedPhones: ${JSON.stringify(s.whatsappAuthorizedPhones)}`);
      console.log(`  updatedAt: ${s.updatedAt}`);
    }
  } catch (e) {
    console.error("ERROR:", e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
