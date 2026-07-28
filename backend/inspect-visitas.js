const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const columns = await prisma.$queryRawUnsafe(`
    SELECT column_name, data_type, is_nullable, column_default 
    FROM information_schema.columns 
    WHERE table_name = 'visitas_petgo';
  `);
  console.log("COLUMNS_START");
  console.log(JSON.stringify(columns));
  console.log("COLUMNS_END");

  // Let's also query foreign key constraints to find how it links to clientes_petgo
  const constraints = await prisma.$queryRawUnsafe(`
    SELECT
        tc.table_name, 
        kcu.column_name, 
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name 
    FROM 
        information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = 'visitas_petgo';
  `);
  console.log("CONSTRAINTS_START");
  console.log(JSON.stringify(constraints));
  console.log("CONSTRAINTS_END");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
