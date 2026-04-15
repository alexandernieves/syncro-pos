import { MongoClient } from 'mongodb';
import { PrismaClient } from '@prisma/client';

const mongoUri = 'mongodb+srv://pos:pos@pos.egjupeg.mongodb.net/?appName=pos';
const prisma = new PrismaClient();

async function migrate() {
  console.log('--- Iniciando Migración Robusta de MongoDB a PostgreSQL ---');
  const mongoClient = new MongoClient(mongoUri);
  await mongoClient.connect();
  const db = mongoClient.db();

  // 1. Migrate Users
  const users = await db.collection('users').find({}).toArray();
  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role || 'pos', password: u.password },
      create: { email: u.email, name: u.name, role: u.role || 'pos', password: u.password }
    });
  }

  // 2. Branches
  const branches = await db.collection('branches').find({}).toArray();
  for (const b of branches) {
    await prisma.branch.upsert({
      where: { name: b.name },
      update: { location: b.location || b.address, isMain: b.isMain || false },
      create: { name: b.name, location: b.location || b.address, isMain: b.isMain || false }
    });
  }

  // 3. Categories
  const categories = await db.collection('categories').find({}).toArray();
  const catMap: any = {};
  for (const c of categories) {
    const created = await prisma.category.upsert({
      where: { name: c.name },
      update: {},
      create: { name: c.name }
    });
    catMap[String(c._id)] = created.id;
  }

  // 4. Suppliers
  const suppliers = await db.collection('suppliers').find({}).toArray();
  const supMap: any = {};
  for (const s of suppliers) {
    const created = await prisma.supplier.upsert({
      where: { name: s.name },
      update: {},
      create: { name: s.name }
    });
    supMap[String(s._id)] = created.id;
  }

  // 5. Products
  const products = await db.collection('products').find({}).toArray();
  for (const p of products) {
    const existing = await prisma.product.findFirst({ where: { name: p.name } });
    if (!existing) {
      await prisma.product.create({
        data: {
          name: p.name,
          description: p.description || '',
          image: p.image,
          categoryId: catMap[String(p.category)] || null,
          supplierId: supMap[String(p.supplier)] || null,
          variants: {
            create: [{
              name: 'Principal',
              sku: p.sku || `SKU-${Date.now()}-${Math.random()}`,
              barcode: p.barcode || (p.barcodes && p.barcodes[0]) || null,
              price: Number(p.price) || 0,
              cost: Number(p.cost) || 0,
              stock: Number(p.stock) || 0,
            }]
          }
        }
      });
    }
  }

  console.log('--- Migración Completada con Éxito ---');
  await mongoClient.close();
  await prisma.$disconnect();
}

migrate();
