import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const messages = await prisma.aiChatMessage.findMany({
    where: {
      content: {
        contains: 'segundo'
      }
    }
  });
  console.log('Found messages:', messages);
}

main().catch(console.error).finally(() => prisma.$disconnect());
