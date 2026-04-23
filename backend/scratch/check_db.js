const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  try {
    const users = await prisma.user.findMany();
    console.log('Users:', users.map(u => ({ id: u.id, email: u.email })));
    
    const waitlist = await prisma.productWaitlist.findMany();
    console.log('Current Waitlist Count:', waitlist.length);
    
    const branches = await prisma.branch.findMany();
    console.log('Branches:', branches.map(b => ({ id: b.id, name: b.name })));
    
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

test();
