import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const chats = await prisma.whatsAppChat.findMany({
    include: {
      client: true,
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });
  console.log('--- WHATSAPP CHATS ---');
  chats.forEach(c => {
    console.log(`ID: ${c.id} | Phone: ${c.phone} | Name: ${JSON.stringify(c.name)} | ClientName: ${c.client?.name || 'N/A'}`);
    if (c.messages.length > 0) {
      console.log(`  Last Message: ${JSON.stringify(c.messages[0].text)}`);
    }
  });
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
