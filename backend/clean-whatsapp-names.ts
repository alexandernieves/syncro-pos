import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const chats = await prisma.whatsAppChat.findMany({
    where: {
      OR: [
        { name: '💻' },
        { name: null }
      ]
    },
    include: { client: true }
  });

  console.log(`Encontrados ${chats.length} chats con el nombre '💻' o nulos para limpiar...`);

  for (const chat of chats) {
    let newName = '';
    let linkedClientId: string | null = chat.clientId;

    // 1. Try to find a matching client in the database by phone number
    const matchedClient = await prisma.client.findFirst({
      where: {
        phone: {
          contains: chat.phone.slice(-8), // Match last 8 digits
        },
      },
    });

    if (matchedClient) {
      newName = matchedClient.name;
      linkedClientId = matchedClient.id;
      console.log(`Cliente encontrado en el sistema para ${chat.phone}: ${matchedClient.name}`);
    } else {
      // 2. Fallback to clean Contacto +phone instead of 💻
      newName = `Contacto ${chat.phone}`;
    }

    // Update the database record
    await prisma.whatsAppChat.update({
      where: { id: chat.id },
      data: {
        name: newName,
        clientId: linkedClientId
      }
    });

    console.log(`Chat ${chat.phone} actualizado: Nombre cambiado de "${chat.name}" a "${newName}"`);
  }

  console.log('¡Limpieza completada con éxito!');
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
