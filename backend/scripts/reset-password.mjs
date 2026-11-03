#!/usr/bin/env node
/**
 * Script para restablecer la contraseña de cualquier usuario en Syncro POS.
 *
 * Uso:
 *   node scripts/reset-password.mjs <correo> <nueva_contraseña>
 *
 * Ejemplo en el servidor (Docker):
 *   docker exec -it <nombre-contenedor-backend> node scripts/reset-password.mjs ebano@gmail.com Syncro2026!
 */
import pkg from '@prisma/client';
import bcrypt from 'bcrypt';

const { PrismaClient } = pkg;
const prisma = new PrismaClient();

const [emailArg, newPassword] = process.argv.slice(2);

if (!emailArg || !newPassword) {
  console.error('\nUso: node scripts/reset-password.mjs <correo> <nueva_contraseña>\n');
  process.exit(1);
}

const email = emailArg.trim().toLowerCase();

async function main() {
  try {
    const user = await prisma.user.findFirst({
      where: {
        email: {
          equals: email,
          mode: 'insensitive',
        },
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        businessId: true,
      },
    });

    if (!user) {
      console.error(`\n❌ No se encontró ningún usuario con el correo: "${email}"`);
      const allUsers = await prisma.user.findMany({
        take: 10,
        select: { email: true, name: true, role: true },
      });
      console.log('\nUsuarios existentes en la base de datos (primeros 10):');
      for (const u of allUsers) {
        console.log(` - ${u.email} (${u.name ?? 'Sin nombre'}, rol: ${u.role})`);
      }
      process.exit(1);
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    console.log(`\n Contraseña actualizada exitosamente para ${user.name ?? 'usuario'} (${user.email})`);
    console.log(` Nueva contraseña: ${newPassword}\n`);
  } catch (err) {
    console.error('Error al actualizar contraseña:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

