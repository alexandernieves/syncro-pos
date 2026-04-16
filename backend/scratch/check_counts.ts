import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const suppliers = await prisma.supplier.findMany({
    include: {
      _count: {
        select: { products: true }
      }
    }
  });

  console.log('Resultados de la DB:');
  suppliers.forEach(s => {
    console.log(`Proveedor: ${s.name}, Productos: ${s._count.products}`);
  });
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
