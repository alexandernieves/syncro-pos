const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  const email = 'soporte@syncropos.com';
  const plainPassword = 'SyncroAdmin2026!';
  const role = 'syncropos';

  const hashedPassword = await bcrypt.hash(plainPassword, 10);

  try {
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        password: hashedPassword,
        role: role,
        name: 'Soporte Syncro'
      },
      create: {
        email,
        password: hashedPassword,
        role: role,
        name: 'Soporte Syncro'
      }
    });

    console.log('✅ Usuario de soporte creado/actualizado:', user.email);
  } catch (error) {
    console.error('❌ Error al crear usuario:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
