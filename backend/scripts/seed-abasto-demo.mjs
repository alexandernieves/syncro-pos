#!/usr/bin/env node
/**
 * Demo shop for screen recordings: "Abasto Don Pedro", a neighbourhood grocery with about eight
 * months of history. It has sales in dollars, bolívares and pesos, fiado with payments (clients
 * who pay on time and some who are late), suppliers with purchase orders, invoices and payments,
 * stock that runs low, a daily till with its closings, and expenses. It has no gym module.
 * It never touches other businesses.
 *
 * Usage (inside the backend container, or locally with DATABASE_URL set):
 *   node scripts/seed-abasto-demo.mjs            creates the demo shop
 *   node scripts/seed-abasto-demo.mjs --wipe     deletes the demo shop and everything in it
 *   node scripts/seed-abasto-demo.mjs --replace  deletes it and creates it again
 *   DEMO_PASSWORD=… keeps the same password across runs; DEMO_EMAIL=… sets the owner's login
 *
 * Phones are 58400xxxxxxx (no such line in Venezuela), so no WhatsApp ever reaches a real person.
 */
import pkg from '@prisma/client';
import bcrypt from 'bcrypt';
import { randomBytes, randomUUID } from 'node:crypto';

const { PrismaClient } = pkg;
const prisma = new PrismaClient();
const args = new Set(process.argv.slice(2));
const DOMAIN = 'abasto-demo.local';
const MARKER = `demo@${DOMAIN}`;
const OWNER_EMAIL = (process.env.DEMO_EMAIL || MARKER).trim().toLowerCase();
const BUSINESS_NAME = 'Abasto Don Pedro';

// ── Random, but the same every run ──────────────────────────────────────────
let seed = 20260310;
const rnd = () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const int = (a, b) => Math.floor(rnd() * (b - a + 1)) + a;
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const chance = (p) => rnd() < p;
const weighted = (pairs) => {
  const total = pairs.reduce((s, [, w]) => s + w, 0);
  let r = rnd() * total;
  for (const [v, w] of pairs) if ((r -= w) <= 0) return v;
  return pairs[pairs.length - 1][0];
};
const poisson = (l) => {
  const L = Math.exp(-l);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rnd();
  } while (p > L);
  return k - 1;
};
const round2 = (n) => Math.round(n * 100) / 100;
const id = () => randomUUID();

// ── Time: the shop is in Venezuela (UTC-4, no daylight saving) ──────────────
const DAY = 86400000;
const at = (y, m, d, h = 0, min = 0) => new Date(Date.UTC(y, m - 1, d, h + 4, min));
const REAL_NOW = process.env.DEMO_NOW ? new Date(process.env.DEMO_NOW) : new Date();
// Before the shop opens, the last day of the demo is yesterday (closed at night)
const NOW = (() => {
  const local = new Date(REAL_NOW.getTime() - 4 * 3600000);
  if (local.getUTCHours() >= 8) return REAL_NOW;
  return at(local.getUTCFullYear(), local.getUTCMonth() + 1, local.getUTCDate() - 1, 21, 0);
})();
const localDay = (date) => {
  const x = new Date(date.getTime() - 4 * 3600000);
  return { y: x.getUTCFullYear(), m: x.getUTCMonth() + 1, d: x.getUTCDate(), dow: x.getUTCDay() };
};
const dayStart = (date) => {
  const p = localDay(date);
  return at(p.y, p.m, p.d);
};
const addDays = (date, n) => new Date(date.getTime() + n * DAY);
const TODAY = dayStart(NOW);
const OPENED = addDays(TODAY, -240);
const hours = (dow) => (dow === 0 ? [8, 14] : [7, 21]);

// ── Exchange rates over time ────────────────────────────────────────────────
const VES_START = 420;
const VES_NOW = 876.8;
const COP_START = 3900;
const COP_NOW = 3194.44;
const progress = (t) => Math.min(1, Math.max(0, (t - OPENED) / (NOW - OPENED)));
const vesAt = (t) => round2(VES_START * Math.pow(VES_NOW / VES_START, progress(t)));
const copAt = (t) => round2(COP_START + (COP_NOW - COP_START) * progress(t));
const inCurrency = (usd, cur, t) => (cur === 'VES' ? round2(usd * vesAt(t)) : cur === 'COP' ? Math.ceil((usd * copAt(t)) / 100) * 100 : usd);

// ── Names ───────────────────────────────────────────────────────────────────
const MEN = ['José', 'Luis', 'Carlos', 'Juan', 'Miguel', 'Jesús', 'Pedro', 'Andrés', 'Daniel', 'Gabriel', 'Ricardo', 'Fernando', 'Javier', 'Rafael', 'Antonio', 'Eduardo', 'Manuel', 'Francisco', 'Alberto', 'Óscar', 'Héctor', 'Jorge', 'Víctor', 'Kevin', 'Brayan', 'Jhonny', 'Leonardo', 'Samuel', 'Ramón', 'Wilmer', 'Yorman', 'Anderson', 'Gustavo', 'Rubén', 'Omar'];
const WOMEN = ['María', 'Ana', 'Carmen', 'Laura', 'Gabriela', 'Daniela', 'Andrea', 'Valentina', 'Isabel', 'Patricia', 'Rosa', 'Yolimar', 'Mariana', 'Carolina', 'Paola', 'Alejandra', 'Natalia', 'Lucía', 'Elena', 'Marisol', 'Yusmary', 'Génesis', 'Karla', 'Adriana', 'Luisa', 'Claudia', 'Mónica', 'Josefina', 'Yuleidy', 'Milagros', 'Dayana', 'Norelys', 'Zulay', 'Betty'];
const SURNAMES = ['González', 'Rodríguez', 'Pérez', 'Hernández', 'García', 'Martínez', 'López', 'Sánchez', 'Ramírez', 'Torres', 'Flores', 'Rivera', 'Gómez', 'Díaz', 'Morales', 'Rojas', 'Contreras', 'Medina', 'Mendoza', 'Castillo', 'Chacón', 'Pernía', 'Zambrano', 'Rosales', 'Duque', 'Vivas', 'Mora', 'Ochoa', 'Méndez', 'Guerrero', 'Colmenares', 'Moreno', 'Varela', 'Carrero', 'Uzcátegui', 'Parra', 'Salas', 'Cárdenas', 'Briceño', 'Jaimes', 'Silva', 'Vargas', 'Suárez'];
const usedDocs = new Set();
const usedPhones = new Set();
function person() {
  const woman = chance(0.55);
  const name = `${pick(woman ? WOMEN : MEN)} ${pick(SURNAMES)}`;
  let doc;
  do doc = `V-${int(8, 31)}.${int(100, 999)}.${int(100, 999)}`;
  while (usedDocs.has(doc));
  usedDocs.add(doc);
  let phone;
  do phone = `58400${int(1000000, 9999999)}`;
  while (usedPhones.has(phone));
  usedPhones.add(phone);
  return { name, doc, phone };
}

// ── Batching ────────────────────────────────────────────────────────────────
const rows = {};
const push = (table, row) => (rows[table] ||= []).push(row);
async function flush(table) {
  const list = rows[table] || [];
  for (let i = 0; i < list.length; i += 2000) await prisma[table].createMany({ data: list.slice(i, i + 2000) });
  if (list.length) console.log(`  ${table}: ${list.length}`);
  rows[table] = [];
}
const inChunks = async (ids, fn) => {
  for (let i = 0; i < ids.length; i += 5000) await fn(ids.slice(i, i + 5000));
};

// ── Catalog: [name, price, cost, demand weight, weighable, pack] ────────────
// Generic names (no brands). Prices in dollars, as a neighbourhood shop sells today.
const CATALOG = {
  'Víveres': [
    ['Harina de maíz precocida 1 kg', 1.1, 0.82, 20, false, 20], ['Arroz blanco 1 kg', 1.35, 0.98, 14, false, 24], ['Pasta corta 1 kg', 1.5, 1.08, 10, false, 12],
    ['Pasta larga 1 kg', 1.5, 1.08, 8, false, 12], ['Azúcar 1 kg', 1.45, 1.05, 10, false, 20], ['Aceite vegetal 1 L', 3.6, 2.7, 9, false, 12],
    ['Caraotas negras 500 g', 1.6, 1.12, 7, false, 24], ['Lentejas 500 g', 1.4, 0.98, 4, false, 24], ['Sal 1 kg', 0.6, 0.38, 4, false, 25],
    ['Café molido 250 g', 3.3, 2.45, 8, false, 12], ['Mayonesa 445 g', 3.4, 2.5, 5, false, 12], ['Salsa de tomate 397 g', 2.2, 1.55, 4, false, 12],
    ['Atún en lata 140 g', 1.9, 1.35, 6, false, 24], ['Sardinas en lata 170 g', 1.3, 0.9, 6, false, 24], ['Avena en hojuelas 400 g', 1.8, 1.25, 3, false, 12],
  ],
  'Bebidas': [
    ['Refresco cola 2 L', 2.3, 1.62, 12, false, 6], ['Refresco naranja 2 L', 2.1, 1.48, 5, false, 6], ['Malta 355 ml', 1.0, 0.68, 10, false, 24],
    ['Agua mineral 1,5 L', 1.0, 0.62, 9, false, 12], ['Jugo de naranja 1 L', 2.4, 1.7, 4, false, 12], ['Cerveza tercio 222 ml', 0.9, 0.6, 14, false, 36],
    ['Bebida energética 473 ml', 2.2, 1.5, 3, false, 24], ['Té frío 500 ml', 1.2, 0.8, 4, false, 24],
  ],
  'Charcutería': [
    ['Queso blanco duro (kg)', 6.8, 5.1, 9, true, 5], ['Queso amarillo (kg)', 9.5, 7.2, 4, true, 3], ['Jamón de pierna (kg)', 9.8, 7.4, 4, true, 3],
    ['Mortadela (kg)', 4.6, 3.3, 5, true, 5], ['Salchichas paquete 500 g', 2.6, 1.85, 5, false, 12],
  ],
  'Lácteos y huevos': [
    ['Huevos cartón 30 unidades', 6.5, 5.0, 7, false, 10], ['Leche en polvo 400 g', 6.9, 5.2, 5, false, 12], ['Leche líquida 1 L', 1.9, 1.35, 6, false, 12],
    ['Margarina 500 g', 2.4, 1.7, 5, false, 12], ['Yogurt bebible 1 L', 2.8, 2.0, 2, false, 12], ['Mantequilla 250 g', 3.1, 2.25, 2, false, 12],
  ],
  'Panadería': [
    ['Pan canilla', 1.0, 0.6, 16, false, 30], ['Pan de sándwich', 2.6, 1.85, 5, false, 10], ['Galletas de soda paquete', 1.2, 0.8, 5, false, 24],
    ['Pan dulce', 0.8, 0.45, 5, false, 30],
  ],
  'Limpieza': [
    ['Jabón en polvo 1 kg', 3.6, 2.6, 4, false, 12], ['Cloro 1 L', 1.2, 0.78, 4, false, 12], ['Lavaplatos en crema 500 g', 2.1, 1.45, 3, false, 12],
    ['Jabón de panela', 1.1, 0.72, 3, false, 24], ['Desinfectante 1 L', 2.2, 1.5, 2, false, 12], ['Esponja de cocina', 0.6, 0.32, 2, false, 24],
  ],
  'Higiene personal': [
    ['Papel higiénico 4 rollos', 2.9, 2.1, 6, false, 12], ['Crema dental 100 ml', 2.2, 1.55, 3, false, 24], ['Jabón de baño', 1.0, 0.65, 4, false, 24],
    ['Champú 400 ml', 4.6, 3.3, 2, false, 12], ['Desodorante', 3.4, 2.4, 2, false, 12], ['Toallas sanitarias', 2.3, 1.6, 2, false, 24],
  ],
  'Chucherías': [
    ['Chocolate en barra', 1.3, 0.85, 7, false, 24], ['Papitas fritas 150 g', 1.8, 1.2, 6, false, 24], ['Caramelos (unidad)', 0.1, 0.05, 6, false, 100],
    ['Chupeta', 0.25, 0.12, 4, false, 50], ['Galletas rellenas', 0.9, 0.55, 6, false, 24], ['Maní salado 100 g', 1.0, 0.62, 3, false, 24],
  ],
};
// Who brings what, and on which weekday (0 = Sunday)
const SUPPLIERS = [
  { name: 'Distribuidora Los Andes C.A.', contact: 'Ramón Pernía', cats: ['Víveres'], dow: 2, creditDays: 15, terms: 'CREDITO' },
  { name: 'Bebidas del Táchira', contact: 'Yorman Duque', cats: ['Bebidas'], dow: 4, creditDays: 0, terms: 'CONTADO' },
  { name: 'Charcutería La Montaña', contact: 'Marisol Ochoa', cats: ['Charcutería', 'Lácteos y huevos'], dow: 1, creditDays: 7, terms: 'CREDITO' },
  { name: 'Panadería El Trigal', contact: 'Jesús Colmenares', cats: ['Panadería'], dow: -1, creditDays: 0, terms: 'CONTADO' },
  { name: 'Comercial Higiene y Hogar', contact: 'Paola Rosales', cats: ['Limpieza', 'Higiene personal'], dow: 3, creditDays: 30, terms: 'CREDITO' },
  { name: 'Dulces y Golosinas Mora', contact: 'Kevin Mora', cats: ['Chucherías'], dow: 5, creditDays: 0, terms: 'CONTADO' },
];
// These run out near the end on purpose, so the low stock alerts have something to say
const RUNS_OUT = ['Aceite vegetal 1 L', 'Café molido 250 g', 'Huevos cartón 30 unidades', 'Leche en polvo 400 g'];

// ── Wipe ────────────────────────────────────────────────────────────────────
async function wipe() {
  const business = await prisma.business.findFirst({ where: { email: MARKER } });
  const users = (await prisma.user.findMany({ where: { OR: [{ email: { endsWith: `@${DOMAIN}` } }, ...(business ? [{ businessId: business.id }] : [])] }, select: { id: true } })).map((u) => u.id);
  if (!business && !users.length) return console.log('No hay negocio demo que borrar.');
  console.log(`Borrando ${business?.name ?? 'restos del demo'}…`);
  const b = business?.id ?? '__none__';
  const branches = (await prisma.branch.findMany({ where: { businessId: b }, select: { id: true } })).map((x) => x.id);
  const clients = (await prisma.client.findMany({ where: { businessId: b }, select: { id: true } })).map((x) => x.id);
  const suppliers = (await prisma.supplier.findMany({ where: { businessId: b }, select: { id: true } })).map((x) => x.id);
  const products = (await prisma.product.findMany({ where: { businessId: b }, select: { id: true } })).map((x) => x.id);
  const variants = (await prisma.productVariant.findMany({ where: { productId: { in: products } }, select: { id: true } })).map((x) => x.id);
  const saleIds = (await prisma.sale.findMany({ where: { branchId: { in: branches } }, select: { id: true } })).map((x) => x.id);
  const orders = (await prisma.purchaseOrder.findMany({ where: { supplierId: { in: suppliers } }, select: { id: true } })).map((x) => x.id);
  const invoices = (await prisma.supplierInvoice.findMany({ where: { supplierId: { in: suppliers } }, select: { id: true } })).map((x) => x.id);
  const loans = (await prisma.loan.findMany({ where: { clientId: { in: clients } }, select: { id: true } })).map((x) => x.id);

  await inChunks(variants, (c) => prisma.inventoryMovement.deleteMany({ where: { variantId: { in: c } } }));
  await prisma.supplierInvoicePayment.deleteMany({ where: { supplierInvoiceId: { in: invoices } } });
  await prisma.supplierPayment.deleteMany({ where: { supplierId: { in: suppliers } } });
  await prisma.supplierInvoice.deleteMany({ where: { id: { in: invoices } } });
  await prisma.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: { in: orders } } });
  await prisma.purchaseOrder.deleteMany({ where: { id: { in: orders } } });
  await inChunks(loans, (c) => prisma.loanInstallment.deleteMany({ where: { loanId: { in: c } } }));
  await inChunks(loans, (c) => prisma.loan.deleteMany({ where: { id: { in: c } } }));
  await inChunks(clients, (c) => prisma.creditTransaction.deleteMany({ where: { clientId: { in: c } } }));
  await prisma.financeMovement.deleteMany({ where: { businessId: b } });
  await inChunks(saleIds, async (c) => {
    await prisma.saleItem.deleteMany({ where: { saleId: { in: c } } });
    await prisma.salePayment.deleteMany({ where: { saleId: { in: c } } });
  });
  await prisma.accountingEntry.deleteMany({ where: { OR: [{ branchId: { in: branches } }, { userId: { in: users } }] } });
  await inChunks(saleIds, (c) => prisma.sale.deleteMany({ where: { id: { in: c } } }));
  await prisma.shift.deleteMany({ where: { branchId: { in: branches } } });
  await inChunks(variants, (c) => prisma.inventory.deleteMany({ where: { variantId: { in: c } } }));
  await prisma.productVariant.deleteMany({ where: { id: { in: variants } } });
  await prisma.product.deleteMany({ where: { id: { in: products } } });
  await prisma.category.deleteMany({ where: { businessId: b } });
  await prisma.supplier.deleteMany({ where: { id: { in: suppliers } } });
  const settings = (await prisma.setting.findMany({ where: { businessId: b }, select: { id: true } })).map((x) => x.id);
  // Whatever the owner left by using the demo (logins, the mascot, notifications…)
  for (const table of ['auditLog', 'pushSubscription', 'expense', 'savedProfile', 'biometricCredential', 'mascotThought', 'mascotProfile', 'notification']) {
    try {
      await prisma[table].deleteMany({ where: { userId: { in: users } } });
    } catch {
      // that table has no userId here: nothing to clean
    }
  }
  if (business) await prisma.business.delete({ where: { id: b } });
  await inChunks(clients, (c) => prisma.client.deleteMany({ where: { id: { in: c } } }));
  await prisma.setting.deleteMany({ where: { id: { in: settings } } });
  await prisma.user.deleteMany({ where: { id: { in: users } } });
  await prisma.branch.deleteMany({ where: { id: { in: branches } } });
  console.log('Listo: negocio demo borrado.');
}

// ── Seed ────────────────────────────────────────────────────────────────────
async function create() {
  if (await prisma.business.findFirst({ where: { email: MARKER } })) {
    console.log('Ya existe el negocio demo. Usa --replace para crearlo de nuevo.');
    return;
  }
  if (await prisma.user.findUnique({ where: { email: OWNER_EMAIL } })) {
    console.log(`Ya hay un usuario con el correo ${OWNER_EMAIL}. Elige otro con DEMO_EMAIL.`);
    return;
  }
  console.log(`Creando ${BUSINESS_NAME} (un par de minutos)…`);
  const password = process.env.DEMO_PASSWORD || `Demo-${randomBytes(4).toString('hex')}`;

  // Business, settings, branch, people
  const businessId = id();
  const branchId = id();
  await prisma.business.create({ data: { id: businessId, name: BUSINESS_NAME, email: MARKER, status: 'ACTIVE', subscription: 'BASIC', phone: '584000000000', address: 'Barrio Obrero, San Cristóbal, Táchira', createdAt: OPENED } });
  await prisma.branch.create({ data: { id: branchId, businessId, name: 'Abasto Don Pedro', isMain: true, country: 'Venezuela', state: 'Táchira', location: 'Carrera 20 con calle 9, Barrio Obrero, San Cristóbal', phone: '584000000001', openingHours: 'Lunes a sábado de 7:00 a. m. a 9:00 p. m. · Domingos de 8:00 a. m. a 2:00 p. m.', latitude: 7.7745, longitude: -72.2175, createdAt: OPENED } });
  await prisma.setting.create({
    data: {
      businessId,
      businessName: BUSINESS_NAME,
      businessPhone: '584000000000',
      businessAddress: 'Carrera 20 con calle 9, Barrio Obrero, San Cristóbal',
      country: 'Venezuela',
      businessType: 'GENERAL',
      enabledModules: ['pos', 'products', 'inventory', 'clients', 'credit', 'suppliers', 'accounting', 'reports', 'historial', 'whatsapp', 'deliveries', 'ai_agent'],
      exchangeRate: VES_NOW,
      exchangeRateEur: round2(VES_NOW * 1.16),
      exchangeRateDashboard: VES_NOW,
      exchangeRateDashboardEur: round2(VES_NOW * 1.16),
      bcvUpdateDate: TODAY.toISOString().slice(0, 10),
      exchangeRateCop: COP_NOW,
      taxEnabled: false,
      pagoMovilEnabled: true,
      pagoMovilBank: 'Banesco (0134)',
      pagoMovilId: 'V-00000000',
      pagoMovilPhone: '04000000000',
      salesGoal: 11000,
    },
  });
  const owner = { id: id(), name: 'Pedro Contreras' };
  const cashiers = [{ id: id(), name: 'Génesis Mora' }, { id: id(), name: 'Kevin Duque' }];
  const locked = await bcrypt.hash(randomBytes(24).toString('hex'), 10);
  await prisma.user.createMany({
    data: [
      { id: owner.id, email: OWNER_EMAIL, password: await bcrypt.hash(password, 10), name: owner.name, role: 'ownerpos', permissions: ['all'], businessId, createdAt: OPENED },
      ...cashiers.map((c, i) => ({ id: c.id, email: `caja${i + 1}@${DOMAIN}`, password: locked, name: c.name, role: 'pos', permissions: ['pos'], branchIds: [branchId], businessId, createdAt: OPENED })),
    ],
  });

  // Catalog, suppliers and the starting stock
  console.log('Productos y proveedores…');
  const variants = [];
  const supplierOf = {};
  const suppliers = SUPPLIERS.map((s) => {
    const sid = id();
    for (const c of s.cats) supplierOf[c] = sid;
    let taxId = `J-${int(40000000, 49999999)}-${int(0, 9)}`;
    push('supplier', { id: sid, businessId, name: s.name, taxId, contactName: s.contact, phone: `58400${int(1000000, 9999999)}`, address: 'San Cristóbal, Táchira', paymentTerms: s.terms, creditDays: s.creditDays, currency: 'USD', createdAt: OPENED });
    return { ...s, id: sid };
  });
  let sku = 0;
  for (const [cat, items] of Object.entries(CATALOG)) {
    const catId = id();
    push('category', { id: catId, businessId, name: cat, createdAt: OPENED });
    for (const [name, price, cost, weight, weighable, pack] of items) {
      const pid = id();
      const vid = id();
      sku++;
      push('product', { id: pid, name, businessId, categoryId: catId, supplierId: supplierOf[cat], isWeighable: weighable, createdAt: OPENED });
      variants.push({ id: vid, pid, name, cat, price, cost, weight, weighable, pack, sku: `ADP-${String(sku).padStart(3, '0')}`, barcode: `759${String(int(1000000000, 9999999999))}`, supplierId: supplierOf[cat], stock: 0 });
    }
  }

  // Expected daily units of each product, to size the purchases
  const BASE_SALES = 46;
  const LINES = 2.3;
  const totalWeight = variants.reduce((s, v) => s + v.weight, 0);
  for (const v of variants) {
    v.daily = (BASE_SALES * LINES * v.weight) / totalWeight * (v.weighable ? 0.6 : 1.4);
    v.target = Math.max(v.pack, Math.ceil((v.daily * 10) / v.pack) * v.pack);
    v.minStock = Math.max(3, Math.round(v.daily * 3));
    v.stock = v.target;
  }

  // Clients: regulars, and the ones who buy on fiado
  console.log('Clientes…');
  const clients = [];
  for (let i = 0; i < 95; i++) {
    const who = person();
    const joined = addDays(OPENED, Math.floor(rnd() * rnd() * 220));
    const fiado = i < 34;
    // good: pays on time · slow: pays in parts and late · bad: stopped paying a while ago
    const kind = !fiado ? null : weighted([['good', 55], ['slow', 30], ['bad', 15]]);
    clients.push({
      id: id(), who, joined, fiado, kind, cycle: pick([7, 15, 15, 15, 30]),
      limit: fiado ? pick([30, 40, 50, 60, 80, 100, 150]) : 0,
      debt: 0, next: null, last: null, score: 50, payments: 0, late: 0, points: 0, loans: [],
      stopsAt: kind === 'bad' ? addDays(TODAY, -int(25, 55)) : null,
    });
  }
  for (const c of clients) {
    push('client', {
      id: c.id, businessId, name: c.who.name, documentId: c.who.doc, phone: c.who.phone,
      email: chance(0.25) ? `${c.who.name.split(' ')[0].toLowerCase().normalize('NFD').replace(/[^a-z]/g, '')}${int(10, 99)}@correo.demo` : null,
      address: chance(0.6) ? `Barrio Obrero, calle ${int(1, 14)}` : null, creditLimit: c.limit, paymentCycleDays: c.cycle, createdAt: c.joined,
    });
  }

  // ── Day by day ─────────────────────────────────────────────────────────────
  console.log('Ventas, fiado, compras y caja día por día…');
  const shifts = [];
  const movement = (v, type, qty, reason, referenceId, t) => {
    const prev = v.stock;
    v.stock = round2(type === 'OUT' ? prev - qty : prev + qty);
    push('inventoryMovement', { id: id(), variantId: v.id, branchId, type, quantity: qty, reason, referenceId, previousStock: Math.round(prev), newStock: Math.round(v.stock), createdAt: t });
  };
  const timeIn = (shift, from = 0, to = 1) => {
    const end = Math.min(shift.closedAt.getTime(), NOW.getTime() - 60000);
    const start = shift.openedAt.getTime() + 5 * 60000;
    if (end <= start) return new Date(end);
    return new Date(start + (end - start) * (from + rnd() * (to - from)));
  };
  // A busier morning and evening
  const saleTime = (shift) => {
    const slot = weighted([[[0, 0.18], 30], [[0.18, 0.55], 30], [[0.55, 0.85], 32], [[0.85, 1], 8]]);
    return timeIn(shift, slot[0], slot[1]);
  };
  let orderNo = 0;
  const shortId = businessId.slice(0, 4).toUpperCase();
  const supplierInvoices = [];

  const SEASON = { 1: 0.85, 2: 0.9, 3: 0.95, 4: 1, 5: 1, 6: 0.95, 7: 1, 8: 1.05, 9: 1, 10: 1.02, 11: 1.08, 12: 1.3 };
  for (let d = OPENED; d <= TODAY; d = addDays(d, 1)) {
    const p = localDay(d);
    const [opens, closes] = hours(p.dow);
    const isToday = d.getTime() === TODAY.getTime();
    const shift = { id: id(), userId: cashiers[p.d % 2].id, openedAt: at(p.y, p.m, p.d, opens), closedAt: at(p.y, p.m, p.d, closes), open: isToday && NOW === REAL_NOW, cash: { USD: 20 }, cashUsd: 20 };
    if (shift.openedAt > NOW) break;
    shifts.push(shift);
    const daysLeft = (TODAY - d) / DAY;

    // Deliveries in the morning: each supplier on its weekday (the bakery every day)
    for (const s of suppliers) {
      if (s.dow !== -1 && s.dow !== p.dow) continue;
      if (s.dow === -1 && p.dow === 0) continue;
      const t = at(p.y, p.m, p.d, opens, int(10, 50));
      if (t > NOW) continue;
      const lines = variants
        .filter((v) => v.supplierId === s.id && !(RUNS_OUT.includes(v.name) && daysLeft < 12))
        .map((v) => ({ v, qty: Math.ceil(Math.max(0, v.target - v.stock) / v.pack) * v.pack }))
        .filter((l) => l.qty > 0);
      if (!lines.length) continue;
      const poId = id();
      const number = `OC-${shortId}-${String(++orderNo).padStart(4, '0')}`;
      const items = lines.map((l) => {
        const cost = round2(l.v.cost * (0.97 + rnd() * 0.06));
        return { id: id(), purchaseOrderId: poId, variantId: l.v.id, quantity: l.qty, cost, subtotal: round2(cost * l.qty), total: round2(cost * l.qty) };
      });
      const total = round2(items.reduce((s2, i) => s2 + i.total, 0));
      push('purchaseOrder', { id: poId, number, supplierId: s.id, branchId, status: 'RECEIVED', subtotal: total, total, expectedDate: t, createdAt: addDays(t, -2), updatedAt: t });
      items.forEach((i) => push('purchaseOrderItem', i));
      for (const l of lines) movement(l.v, 'IN', l.qty, `Recepción OC #${number}`, poId, t);
      push('accountingEntry', { id: id(), description: `Compra: ${number} - Proveedor: ${s.name}`, type: 'EXPENSE', amount: total, category: 'COMPRA_INVENTARIO', userId: owner.id, createdAt: t });
      const inv = { id: id(), supplierId: s.id, supplierName: s.name, purchaseOrderId: poId, total, balance: total, dueDate: addDays(t, s.creditDays), createdAt: t, payments: [] };
      supplierInvoices.push(inv);
    }

    // Sales
    const growth = 0.8 + 0.3 * progress(d);
    const dowFactor = [0.55, 1, 0.95, 0.95, 1, 1.15, 1.25][p.dow];
    const count = poisson(BASE_SALES * growth * dowFactor * SEASON[p.m]);
    const times = Array.from({ length: count }, () => saleTime(shift)).filter((t) => t <= NOW).sort((a, b) => a - b);
    for (const t of times) {
      const lines = [];
      const n = weighted([[1, 34], [2, 28], [3, 18], [4, 12], [5, 8]]);
      for (let k = 0; k < n; k++) {
        const v = weighted(variants.map((x) => [x, x.weight]));
        if (lines.some((l) => l.v === v)) continue;
        let qty = v.weighable ? pick([0.25, 0.3, 0.5, 0.5, 0.75, 1, 1.5]) : v.price < 0.5 ? int(2, 10) : weighted([[1, 70], [2, 22], [3, 8]]);
        if (v.stock < qty) qty = v.weighable ? round2(Math.max(0, v.stock)) : Math.floor(v.stock);
        if (qty <= 0) continue;
        lines.push({ v, qty });
      }
      if (!lines.length) continue;
      const total = round2(lines.reduce((s2, l) => s2 + round2(l.v.price * l.qty), 0));
      // Fiado: a client with room left in the limit, and not one who already stopped paying
      let method = weighted([['CASH', 34], ['PAGO_MOVIL', 36], ['CARD', 16], ['TRANSFER', 4], ['BINANCE', 2], ['CREDIT', 8]]);
      let client = null;
      if (method === 'CREDIT') {
        const able = clients.filter((c) => c.fiado && c.joined <= t && (!c.stopsAt || t < c.stopsAt) && c.limit - c.debt >= total);
        if (able.length) client = pick(able);
        else method = 'PAGO_MOVIL';
      } else if (chance(0.18)) {
        client = pick(clients.filter((c) => c.joined <= t) || []) ?? null;
      }
      const saleId = id();
      push('sale', { id: saleId, branchId, userId: shift.userId, businessId, clientId: client?.id ?? null, paymentMethod: method, subtotal: total, total, channel: 'POS', shiftId: shift.id, createdAt: t });
      for (const l of lines) {
        push('saleItem', { id: id(), saleId, variantId: l.v.id, quantity: l.qty, price: l.v.price, cost: l.v.cost, subtotal: round2(l.v.price * l.qty) });
        movement(l.v, 'OUT', l.qty, 'sale', saleId, t);
      }
      const currency = method === 'CASH' ? weighted([['USD', 52], ['VES', 36], ['COP', 12]]) : null;
      const amountCurrency = currency ? inCurrency(total, currency, t) : null;
      push('salePayment', {
        id: id(), saleId, method, amount: total,
        ...(currency && { currency, amountCurrency }),
        ...(method === 'PAGO_MOVIL' && { amountLocal: round2(total * vesAt(t)) }),
        exchangeRate: method === 'PAGO_MOVIL' || currency === 'VES' ? vesAt(t) : null,
        reference: method === 'PAGO_MOVIL' || method === 'TRANSFER' ? String(int(100000, 999999)) : null,
      });
      push('accountingEntry', { id: id(), description: `Venta POS #${saleId.slice(-4).toUpperCase()}`, amount: total, type: 'INCOME', category: 'VENTA_POS', saleId, branchId, userId: shift.userId, createdAt: t });
      if (currency) {
        shift.cash[currency] = round2((shift.cash[currency] || 0) + amountCurrency);
        shift.cashUsd = round2(shift.cashUsd + total);
      }
      if (method === 'CREDIT') {
        const loanId = id();
        const due = addDays(t, client.cycle);
        client.debt = round2(client.debt + total);
        client.next = due;
        client.loans.push({ id: loanId, instId: id(), amount: total, paid: 0, due, createdAt: t, paidAt: null });
        push('creditTransaction', { id: id(), clientId: client.id, amount: total, type: 'DEBT', saleId, notes: `Compra a crédito - Ticket #${saleId.slice(0, 8)}`, createdAt: t });
      }
    }

    // Payments of fiado (abonos), during the day
    for (const c of clients) {
      if (!c.fiado || c.debt <= 0.01 || (c.stopsAt && d >= c.stopsAt)) continue;
      const overdue = c.next && d > c.next;
      const p0 = c.kind === 'good' ? (overdue ? 0.5 : 0.1) : c.kind === 'slow' ? (overdue ? 0.12 : 0.03) : 0.05;
      if (!chance(p0)) continue;
      const t = timeIn(shift);
      if (t > NOW) continue;
      const amount = round2(c.kind === 'good' && chance(0.75) ? c.debt : Math.max(Math.min(c.debt, 5), c.debt * (0.3 + rnd() * 0.4)));
      const late = c.next && t > c.next;
      c.score = Math.min(100, Math.max(0, c.score + (late ? -10 : 5)));
      c.payments++;
      if (late) c.late++;
      else c.points += Math.floor(amount);
      c.last = t;
      let left = amount;
      for (const loan of c.loans) {
        if (left <= 0.001) break;
        const need = round2(loan.amount - loan.paid);
        if (need <= 0.001) continue;
        const use = Math.min(left, need);
        loan.paid = round2(loan.paid + use);
        if (loan.amount - loan.paid <= 0.01) loan.paidAt = t;
        left = round2(left - use);
      }
      c.debt = round2(Math.max(0, c.debt - amount));
      if (c.debt <= 0.01) c.next = null;
      const how = pick([['Pago móvil', null], ['Efectivo en dólares', null], ['Efectivo en bolívares', 'VES']]);
      const note = `${late ? 'Abono realizado con retraso' : 'Abono realizado a tiempo'}${how[1] ? ` [Pago en VES: ${round2(amount * vesAt(t)).toLocaleString('es-VE')} a tasa ${vesAt(t).toLocaleString('es-VE')}]` : ` · ${how[0]}`}`;
      push('creditTransaction', { id: id(), clientId: c.id, amount: -amount, type: 'PAYMENT', notes: note, createdAt: t });
    }
  }

  // Two orders on the way, for "Compras": one sent and one being prepared
  for (const [s, status, days] of [[suppliers[0], 'SENT', 2], [suppliers[4], 'DRAFT', 6]]) {
    const poId = id();
    const number = `OC-${shortId}-${String(++orderNo).padStart(4, '0')}`;
    const items = variants.filter((v) => v.supplierId === s.id).slice(0, 6).map((v) => {
      const qty = v.pack * int(1, 3);
      return { id: id(), purchaseOrderId: poId, variantId: v.id, quantity: qty, cost: v.cost, subtotal: round2(v.cost * qty), total: round2(v.cost * qty) };
    });
    const total = round2(items.reduce((s2, i) => s2 + i.total, 0));
    push('purchaseOrder', { id: poId, number, supplierId: s.id, branchId, status, subtotal: total, total, expectedDate: addDays(TODAY, days), notes: status === 'SENT' ? 'Confirmado por WhatsApp' : null, createdAt: addDays(NOW, -1), updatedAt: addDays(NOW, -1) });
    items.forEach((i) => push('purchaseOrderItem', i));
  }

  // Suppliers get paid: cash ones on delivery, credit ones around the due date (the last ones still owed)
  for (const inv of supplierInvoices) {
    const s = suppliers.find((x) => x.id === inv.supplierId);
    let when = s.creditDays === 0 ? new Date(inv.createdAt.getTime() + 20 * 60000) : addDays(inv.dueDate, int(-3, 2));
    if (when > NOW) {
      // Not due yet: sometimes half was paid ahead
      if (s.creditDays > 0 && chance(0.3)) when = addDays(inv.createdAt, int(1, 4));
      else continue;
      if (when > NOW) continue;
      inv.partial = round2(inv.total * 0.5);
    }
    const amount = inv.partial ?? inv.total;
    const payId = id();
    const methodPay = s.creditDays === 0 ? weighted([['CASH', 50], ['PAGO_MOVIL', 50]]) : weighted([['TRANSFER', 70], ['PAGO_MOVIL', 30]]);
    const reference = methodPay === 'CASH' ? null : String(int(100000, 999999));
    push('supplierPayment', { id: payId, supplierId: s.id, amount, method: methodPay, reference, createdAt: when });
    push('supplierInvoicePayment', { id: id(), supplierInvoiceId: inv.id, supplierPaymentId: payId, amount, createdAt: when });
    push('accountingEntry', { id: id(), description: `Pago a proveedor - ${s.name} (Ref: ${reference || 'S/N'})`, type: 'EXPENSE', amount, category: 'PAGO_PROVEEDOR', userId: owner.id, createdAt: when });
    inv.balance = round2(inv.total - amount);
  }
  for (const inv of supplierInvoices) {
    push('supplierInvoice', { id: inv.id, supplierId: inv.supplierId, purchaseOrderId: inv.purchaseOrderId, total: inv.total, balance: inv.balance, dueDate: inv.dueDate, status: inv.balance <= 0.01 ? 'PAID' : inv.balance < inv.total ? 'PARTIAL' : 'PENDING', createdAt: inv.createdAt, updatedAt: inv.createdAt });
  }

  // A few stock counts: spoiled or broken goods
  for (let i = 0; i < 14; i++) {
    const v = pick(variants.filter((x) => ['Panadería', 'Lácteos y huevos', 'Charcutería', 'Bebidas'].includes(x.cat)));
    const t = timeIn(pick(shifts.slice(0, -1)), 0.9, 1);
    const qty = v.weighable ? pick([0.5, 1]) : int(1, 3);
    push('inventoryMovement', { id: id(), variantId: v.id, branchId, type: 'ADJUSTMENT', quantity: -qty, reason: pick(['Producto vencido', 'Merma', 'Empaque roto', 'Conteo físico']), previousStock: Math.round(v.stock + qty), newStock: Math.round(v.stock), createdAt: t });
  }

  // ── Expenses and other money movements ─────────────────────────────────────
  const label = { ALQUILER: 'Alquiler', SERVICIOS: 'Servicios', NOMINA: 'Nómina y personal', MANTENIMIENTO: 'Mantenimiento', LIMPIEZA: 'Limpieza', INSUMOS: 'Insumos', PUBLICIDAD: 'Publicidad', RETIRO_DUENO: 'Retiro del dueño' };
  const money = (t, category, amount, method, description) => {
    if (t > NOW || t < OPENED) return;
    const entryId = id();
    push('accountingEntry', { id: entryId, description: `Egreso: ${label[category]}${description ? ` · ${description}` : ''}`, type: 'EXPENSE', amount, category: `MOV_${category}`, branchId, userId: owner.id, createdAt: t });
    push('financeMovement', { id: id(), businessId, branchId, userId: owner.id, userName: owner.name, type: 'OUT', category, amount, currency: 'USD', amountCurrency: amount, method, description, occurredAt: t, source: 'DASHBOARD', accountingEntryId: entryId, status: 'ACTIVE', reviewedAt: (NOW - t) / DAY > 7 ? addDays(t, 1) : null, reviewedBy: (NOW - t) / DAY > 7 ? owner.name : null, createdAt: t });
  };
  for (let mth = at(localDay(OPENED).y, localDay(OPENED).m, 1); mth <= NOW; mth = at(localDay(addDays(mth, 32)).y, localDay(addDays(mth, 32)).m, 1)) {
    const p = localDay(mth);
    money(at(p.y, p.m, 1, 10), 'ALQUILER', 450, 'TRANSFER', 'Local');
    money(at(p.y, p.m, 5, 11), 'SERVICIOS', round2(85 + rnd() * 30), 'PAGO_MOVIL', 'Luz, agua e internet');
    money(at(p.y, p.m, 15, 20), 'NOMINA', 260, 'PAGO_MOVIL', 'Quincena de Génesis y Kevin');
    money(at(p.y, p.m, 28, 20), 'NOMINA', 260, 'PAGO_MOVIL', 'Quincena de Génesis y Kevin');
    money(at(p.y, p.m, 7, 9), 'INSUMOS', round2(35 + rnd() * 20), 'CASH_OTHER', 'Bolsas y papel para la impresora');
    money(at(p.y, p.m, 12, 9), 'LIMPIEZA', round2(15 + rnd() * 12), 'CASH_OTHER', 'Productos de limpieza');
    if (chance(0.45)) money(at(p.y, p.m, int(13, 24), 15), 'MANTENIMIENTO', round2(25 + rnd() * 120), 'CASH_OTHER', pick(['Técnico de la nevera', 'Bombillos y cableado', 'Arreglo de la santamaría', 'Mantenimiento del aire']));
    if (chance(0.5)) money(at(p.y, p.m, int(2, 9), 12), 'PUBLICIDAD', round2(10 + rnd() * 15), 'CARD', 'Volantes y estado de WhatsApp');
    money(at(p.y, p.m, 27, 21), 'RETIRO_DUENO', round2(250 + rnd() * 150), 'TRANSFER', 'Retiro mensual');
  }

  // ── Close the tills ────────────────────────────────────────────────────────
  for (const s of shifts) {
    const counted = { ...s.cash };
    let diff = 0;
    if (!s.open && chance(0.1)) {
      diff = round2((chance(0.65) ? -1 : 1) * pick([0.5, 1, 2, 3, 5]));
      counted.USD = round2((counted.USD || 0) + diff);
    }
    push('shift', {
      id: s.id, userId: s.userId, branchId, openingBalance: 20, openingCash: { USD: 20 }, openedAt: s.openedAt,
      status: s.open ? 'OPEN' : 'CLOSED', closedAt: s.open ? null : s.closedAt,
      expectedBalance: s.open ? 0 : s.cashUsd, closingBalance: s.open ? 0 : round2(s.cashUsd + diff), difference: diff,
      expectedCash: s.open ? undefined : s.cash, countedCash: s.open ? undefined : counted,
      notes: diff ? (diff < 0 ? 'Faltante en el cierre' : 'Sobrante en el cierre') : null,
    });
  }

  // ── Fiado: what each client owes today ─────────────────────────────────────
  for (const c of clients) {
    for (const loan of c.loans) {
      const done = loan.amount - loan.paid <= 0.01;
      push('loan', { id: loan.id, clientId: c.id, amount: loan.amount, interestRate: 0, totalToPay: loan.amount, remainingBalance: round2(Math.max(0, loan.amount - loan.paid)), installmentsCount: 1, status: done ? 'PAID' : 'PENDING', createdAt: loan.createdAt, updatedAt: loan.paidAt ?? loan.createdAt });
      push('loanInstallment', { id: loan.instId, loanId: loan.id, installmentNumber: 1, dueDate: loan.due, amount: loan.amount, paidAmount: loan.paid, status: done ? 'PAID' : 'PENDING', paidAt: loan.paidAt });
    }
  }

  await flush('supplier');
  await flush('category');
  await flush('product');
  for (const v of variants) {
    const stock = Math.max(0, v.weighable ? round2(v.stock) : Math.round(v.stock));
    push('productVariant', { id: v.id, productId: v.pid, name: 'Única', sku: v.sku, barcode: v.barcode, price: v.price, cost: v.cost, stock, minStock: v.minStock, createdAt: OPENED });
    push('inventory', { id: id(), variantId: v.id, branchId, quantity: stock });
  }
  await flush('productVariant');
  await flush('inventory');
  await flush('client');
  const saleCount = rows.sale.length;
  await flush('shift');
  await flush('sale');
  await flush('saleItem');
  await flush('salePayment');
  await flush('accountingEntry');
  await flush('financeMovement');
  await flush('creditTransaction');
  await flush('loan');
  await flush('loanInstallment');
  await flush('purchaseOrder');
  await flush('purchaseOrderItem');
  await flush('supplierInvoice');
  await flush('supplierPayment');
  await flush('supplierInvoicePayment');
  await flush('inventoryMovement');

  // Client balances (one update each, few clients)
  for (const c of clients.filter((x) => x.fiado || x.payments)) {
    const downPayment = c.score >= 95 ? 20 : c.score >= 85 ? 30 : c.score >= 70 ? 40 : 50;
    await prisma.client.update({
      where: { id: c.id },
      data: { currentDebt: c.debt, nextPaymentDate: c.debt > 0.01 ? c.next : null, lastPaymentDate: c.last, creditScore: c.score, totalPaymentsCount: c.payments, latePaymentsCount: c.late, accumulatedPoints: c.points, downPaymentPercentage: downPayment },
    });
  }

  const owing = clients.filter((c) => c.debt > 0.01);
  const late = owing.filter((c) => c.next && c.next < NOW);
  const low = variants.filter((v) => v.stock <= v.minStock);
  console.log(`\n✅ ${BUSINESS_NAME} listo`);
  console.log(`   Ventas: ${saleCount} · Fiado pendiente: ${owing.length} clientes ($${round2(owing.reduce((s, c) => s + c.debt, 0))}), ${late.length} atrasados`);
  console.log(`   Productos bajos o agotados: ${low.map((v) => v.name).join(', ')}`);
  console.log(`   Usuario: ${OWNER_EMAIL}`);
  console.log(`   Clave:   ${password}`);
  if (!process.env.DEMO_PASSWORD) console.log('   Guarda la clave: no se vuelve a mostrar. Si la pierdes, corre el script con --replace.');
}

try {
  if (args.has('--wipe') || args.has('--replace')) await wipe();
  if (!args.has('--wipe')) await create();
} catch (e) {
  console.error('❌', e.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
