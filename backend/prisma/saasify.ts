import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- SaaS-ifying existing data ---');

  // 1. Create a default business if none exists
  let business = await prisma.business.findFirst({
    where: { name: 'Default Business' }
  });

  if (!business) {
    business = await prisma.business.create({
      data: {
        name: 'Default Business',
        status: 'ACTIVE',
        subscription: 'ENTERPRISE',
      }
    });
    console.log('Created Default Business:', business.id);
  } else {
    console.log('Found Default Business:', business.id);
  }

  const businessId = business.id;

  // 2. Link all entities to this business
  console.log('Linking branches...');
  await prisma.branch.updateMany({
    where: { businessId: null },
    data: { businessId }
  });

  console.log('Linking users...');
  await prisma.user.updateMany({
    where: { businessId: null },
    data: { businessId }
  });

  console.log('Linking products...');
  await prisma.product.updateMany({
    where: { businessId: null },
    data: { businessId }
  });

  console.log('Linking categories...');
  await prisma.category.updateMany({
    where: { businessId: null },
    data: { businessId }
  });

  console.log('Linking suppliers...');
  await prisma.supplier.updateMany({
    where: { businessId: null },
    data: { businessId }
  });

  console.log('Linking clients...');
  await prisma.client.updateMany({
    where: { businessId: null },
    data: { businessId }
  });

  console.log('Linking sales...');
  await prisma.sale.updateMany({
    where: { businessId: null },
    data: { businessId }
  });

  console.log('Linking settings...');
  await prisma.setting.updateMany({
    where: { businessId: null },
    data: { businessId }
  });

  console.log('--- SaaS-ification complete ---');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
