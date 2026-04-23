const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  try {
    const user = await prisma.user.findFirst();
    const branch = await prisma.branch.findFirst();
    
    console.log('Using User:', user.id);
    console.log('Using Branch:', branch.id);
    
    const result = await prisma.productWaitlist.create({
      data: {
        name: 'Test Product',
        price: 10.5,
        stock: 5,
        barcode: '123456789',
        userId: user.id,
        branchId: branch.id,
        status: 'PENDING'
      }
    });
    
    console.log('Success:', result);
    
    // Clean up
    await prisma.productWaitlist.delete({ where: { id: result.id } });
    console.log('Cleaned up');
    
  } catch (e) {
    console.error('FAILED:', e);
  } finally {
    await prisma.$disconnect();
  }
}

test();
