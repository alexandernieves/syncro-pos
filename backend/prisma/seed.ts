import { PrismaClient, PaymentMethod, MovementType, SupplierStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Iniciando Seed de Datos Regionalizados (Venezuela) para Syncro POS ---');

  // 1. Limpiar base de datos
  await prisma.accountingEntry.deleteMany();
  await prisma.shift.deleteMany();
  await prisma.supplierInvoicePayment.deleteMany();
  await prisma.supplierInvoice.deleteMany();
  await prisma.supplierPayment.deleteMany();
  await prisma.supplierProduct.deleteMany();
  await prisma.purchaseOrderItem.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.inventoryMovement.deleteMany();
  await prisma.saleItem.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.inventory.deleteMany();
  await prisma.productVariant.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.branch.deleteMany();
  await prisma.user.deleteMany();

  // 2. Sucursales (Venezuela)
  const branches = await Promise.all([
    prisma.branch.create({ data: { name: 'Sede Principal - Caracas', location: 'Av. Casanova, Sabana Grande', isMain: true } }),
    prisma.branch.create({ data: { name: 'Sucursal Lechería', location: 'Av. Principal de Lechería' } }),
    prisma.branch.create({ data: { name: 'Sucursal Maracaibo', location: 'Calle 72 con Av. 15' } })
  ]);

  // 3. Usuarios
  const hashedPassword = await bcrypt.hash('123456', 10);
  await prisma.user.createMany({
    data: [
      { email: 'admin@syncro.com', name: 'Alexander Nieves', password: hashedPassword, role: 'owner' },
      { email: 'gerente@syncro.com', name: 'Paola Maza', password: hashedPassword, role: 'admin' },
    ]
  });

  const adminUser = await prisma.user.findFirst({ where: { role: 'owner' } });

  // 4. Categorías
  const categories = {
    alimentos: await prisma.category.create({ data: { name: 'Alimentos y Víveres' } }),
    bebidas: await prisma.category.create({ data: { name: 'Bebidas y Licores' } }),
    limpieza: await prisma.category.create({ data: { name: 'Cuidado del Hogar' } }),
    tecnologia: await prisma.category.create({ data: { name: 'Tecnología y Accesorios' } }),
  };

  // 5. Proveedores Regionalizados (Venezuela)
  const suppliersData = [
    {
      name: 'Empresas Polar C.A.',
      taxId: 'J-00000123-1',
      phone: '0212-2111111',
      email: 'ventas@polar.com',
      address: 'Los Cortijos, Caracas',
      status: SupplierStatus.ACTIVE,
      paymentTerms: 'CREDITO',
      creditDays: 15,
      taxType: 'ESPECIAL',
      bankName: 'Banesco',
      bankPhone: '0412-1111111',
      bankId: 'J-00000123-1'
    },
    {
      name: 'Alimentos El Tunal',
      taxId: 'J-30123456-7',
      phone: '0251-4444444',
      email: 'contacto@eltunal.com',
      address: 'Quíbor, Edo. Lara',
      status: SupplierStatus.ACTIVE,
      paymentTerms: 'CONTADO',
      taxType: 'ORDINARIO',
      bankName: 'Mercantil',
      bankPhone: '0424-2222222',
      bankId: 'V-12345678'
    },
    {
      name: 'Distribuidora de Oriente G-2000',
      taxId: 'J-40098765-4',
      phone: '0281-2223344',
      email: 'pedidos@oriente2000.com',
      address: 'Barcelona, Anzoátegui',
      status: SupplierStatus.ACTIVE,
      paymentTerms: 'CREDITO',
      creditDays: 30,
      taxType: 'ESPECIAL',
      bankName: 'Provincial',
      bankPhone: '0414-3333333',
      bankId: 'J-40098765-4'
    },
    {
      name: 'Corporación Tecnológica Maracaibo',
      taxId: 'J-50011223-3',
      phone: '0261-7770000',
      email: 'tech@zuliatech.com',
      address: 'Av. Bella Vista, Maracaibo',
      status: SupplierStatus.ACTIVE,
      paymentTerms: 'CONTADO',
      taxType: 'ORDINARIO',
      bankName: 'BOD',
      bankPhone: '0416-4444444',
      bankId: 'V-8888777'
    }
  ];

  const createdSuppliers = [];
  for (const s of suppliersData) {
    const sup = await prisma.supplier.create({ data: s as any });
    createdSuppliers.push(sup);
  }

  // 6. Productos Realistas
  const products = [
    { name: 'Harina P.A.N 1kg', categoryId: categories.alimentos.id, supplierId: createdSuppliers[0].id, variants: [{ sku: 'HPAN1', price: 1.25, cost: 0.95 }] },
    { name: 'Arroz Primor 1kg', categoryId: categories.alimentos.id, supplierId: createdSuppliers[0].id, variants: [{ sku: 'APRI1', price: 1.10, cost: 0.85 }] },
    { name: 'Pasta Capri 1kg', categoryId: categories.alimentos.id, supplierId: createdSuppliers[1].id, variants: [{ sku: 'PCAP1', price: 1.45, cost: 1.15 }] },
    { name: 'Leche en Polvo Campestre', categoryId: categories.alimentos.id, supplierId: createdSuppliers[1].id, variants: [{ sku: 'LCAM1', price: 9.80, cost: 7.50 }] },
    { name: 'Detergente Las Llaves 1kg', categoryId: categories.limpieza.id, supplierId: createdSuppliers[0].id, variants: [{ sku: 'DLL1', price: 3.50, cost: 2.70 }] },
    { name: 'Jabón Azul Las Llaves', categoryId: categories.limpieza.id, supplierId: createdSuppliers[0].id, variants: [{ sku: 'JAZL1', price: 1.00, cost: 0.70 }] },
    { name: 'Mouse Inalámbrico Tech', categoryId: categories.tecnologia.id, supplierId: createdSuppliers[3].id, variants: [{ sku: 'MT77', price: 15.00, cost: 10.00 }] },
    { name: 'Cable HDMI 3m', categoryId: categories.tecnologia.id, supplierId: createdSuppliers[3].id, variants: [{ sku: 'HDMI3', price: 8.00, cost: 4.50 }] },
  ];

  for (const p of products) {
    const createdProduct = await prisma.product.create({
      data: {
        name: p.name,
        categoryId: p.categoryId,
        supplierId: p.supplierId,
        variants: {
          create: p.variants.map(v => ({
            sku: v.sku,
            name: 'Original',
            price: v.price,
            cost: v.cost,
            stock: 0,
            barcode: v.sku
          }))
        }
      },
      include: { variants: true }
    });

    // 7. Relacionar Proveedor-Producto (SupplierProduct)
    for (const v of createdProduct.variants) {
      await prisma.supplierProduct.create({
        data: {
          supplierId: p.supplierId!,
          productId: createdProduct.id,
          variantId: v.id,
          purchasePrice: v.cost!,
          minOrderQty: 12,
          leadTimeDays: 7
        }
      });

      // Stock inicial aleatorio
      for (const branch of branches) {
        const qty = Math.floor(Math.random() * 100) + 20;
        await prisma.inventory.create({
          data: { variantId: v.id, branchId: branch.id, quantity: qty }
        });
        await prisma.productVariant.update({
          where: { id: v.id },
          data: { stock: { increment: qty } }
        });
      }
    }
  }

  // 8. Facturas y Órdenes de Compra (Variedad)
  console.log('Generando órdenes de compra e facturas...');
  for (const sup of createdSuppliers) {
    // Una orden recibida (genera deuda si es crédito)
    const po = await prisma.purchaseOrder.create({
      data: {
        supplierId: sup.id,
        branchId: branches[0].id,
        status: 'RECEIVED',
        total: 500,
        items: {
          create: [] // En producción se poblarían
        }
      }
    });

    if (sup.paymentTerms === 'CREDITO') {
      await prisma.supplierInvoice.create({
        data: {
          supplierId: sup.id,
          purchaseOrderId: po.id,
          total: 500,
          balance: 500,
          dueDate: new Date(Date.now() + (sup.creditDays || 0) * 24 * 60 * 60 * 1000),
          status: 'PENDING'
        }
      });
    }
  }

  console.log('--- Seed Finalizado con Éxito (Versión VZLA) ---');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
