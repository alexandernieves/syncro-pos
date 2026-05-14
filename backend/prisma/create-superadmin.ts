import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Creating Syncro SuperAdmin ---');

  const email = 'soporte@syncropos.com';
  const password = 'SyncroAdmin2026!';
  const hashedPassword = await bcrypt.hash(password, 10);

  // Check if user already exists
  let user = await prisma.user.findUnique({
    where: { email }
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: 'Soporte Syncro',
        role: 'syncropos',
        permissions: ['all'],
      }
    });
    console.log('SuperAdmin created successfully!');
    console.log('Email:', email);
    console.log('Password:', password);
  } else {
    // Update role if exists
    user = await prisma.user.update({
      where: { email },
      data: { 
        role: 'syncropos',
        permissions: ['all']
      }
    });
    console.log('Existing user promoted to SuperAdmin!');
  }

  console.log('--- Done ---');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
