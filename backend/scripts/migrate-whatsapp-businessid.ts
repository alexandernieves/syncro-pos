/**
 * Migration script: Assign businessId to orphan WhatsAppChats before
 * applying the new @@unique([phone, businessId]) constraint.
 *
 * Run: npx ts-node scripts/migrate-whatsapp-businessid.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Find the first Business to use as fallback for orphan chats
  const firstBusiness = await prisma.business.findFirst({ orderBy: { createdAt: 'asc' } });

  if (!firstBusiness) {
    console.log('No businesses found. Nothing to migrate.');
    return;
  }

  console.log(`Using business "${firstBusiness.name}" (${firstBusiness.id}) as fallback for orphan chats.`);

  // Find chats without a businessId
  const orphanChats = await prisma.whatsAppChat.findMany({
    where: { businessId: null },
  });

  console.log(`Found ${orphanChats.length} orphan chats.`);

  if (orphanChats.length === 0) {
    console.log('No orphan chats. Migration complete.');
    return;
  }

  // Check for duplicate phones before assigning — if duplicates exist for the same business,
  // keep the most recent one and delete the older duplicates.
  const phoneGroups = new Map<string, typeof orphanChats>();
  for (const chat of orphanChats) {
    const existing = phoneGroups.get(chat.phone) || [];
    existing.push(chat);
    phoneGroups.set(chat.phone, existing);
  }

  for (const [phone, chats] of phoneGroups.entries()) {
    if (chats.length > 1) {
      // Sort by createdAt desc, keep the newest
      chats.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      const [keep, ...toDelete] = chats;
      console.log(`  Duplicate phone ${phone}: keeping ${keep.id}, deleting ${toDelete.length} older chats.`);
      for (const dup of toDelete) {
        await prisma.whatsAppMessage.deleteMany({ where: { chatId: dup.id } });
        await prisma.whatsAppChat.delete({ where: { id: dup.id } });
      }
    }
  }

  // Assign businessId to remaining orphan chats
  const updatedOrphans = await prisma.whatsAppChat.findMany({ where: { businessId: null } });
  for (const chat of updatedOrphans) {
    await prisma.whatsAppChat.update({
      where: { id: chat.id },
      data: { businessId: firstBusiness.id },
    });
    console.log(`  Assigned businessId to chat ${chat.id} (${chat.phone})`);
  }

  console.log('Migration complete!');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
