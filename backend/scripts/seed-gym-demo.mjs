#!/usr/bin/env node
/**
 * Demo gym: a separate business ("Ebano Demo") with about two and a half years of operation,
 * so the gym module, the POS, accounting and reports can be seen as in a gym that has been
 * running for a while. It never touches other businesses.
 *
 * Usage (inside the backend container, or locally with DATABASE_URL set):
 *   node scripts/seed-gym-demo.mjs            creates the demo business
 *   node scripts/seed-gym-demo.mjs --wipe     deletes the demo business and everything in it
 *   node scripts/seed-gym-demo.mjs --replace  deletes it and creates it again
 *   DEMO_PASSWORD=… keeps the same password across runs
 *
 * Phones are 58400xxxxxxx (no such line in Venezuela) and reminders and class notices are off,
 * so no WhatsApp ever reaches a real person.
 */
import pkg from '@prisma/client';
import bcrypt from 'bcrypt';
import { randomBytes, randomUUID } from 'node:crypto';

const { PrismaClient } = pkg;
const prisma = new PrismaClient();
const args = new Set(process.argv.slice(2));
const MARKER = 'demo@ebanocontrol.local';

// ── Random, but the same every run ──────────────────────────────────────────
let seed = 20240415;
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

// ── Time: the gym is in Caracas (UTC-4, no daylight saving) ─────────────────
const DAY = 86400000;
/** Local Caracas date and time → Date. */
const at = (y, m, d, h = 0, min = 0) => new Date(Date.UTC(y, m - 1, d, h + 4, min));
// Run before the gym opens, the demo's last day is yesterday, closed at night: nothing happens in the future
const REAL_NOW = process.env.DEMO_NOW ? new Date(process.env.DEMO_NOW) : new Date();
const NOW = (() => {
  const local = new Date(REAL_NOW.getTime() - 4 * 3600000);
  if (local.getUTCHours() >= 8) return REAL_NOW;
  return at(local.getUTCFullYear(), local.getUTCMonth() + 1, local.getUTCDate() - 1, 21, 30);
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
const OPEN_MAIN = at(2024, 4, 15);
const OPEN_SECOND = at(2025, 4, 1);
const PRICE_CHANGE = at(2025, 6, 1);
const TODAY = dayStart(NOW);

// More sign-ups in January (new year's resolutions), fewer in December and in the summer holidays
const SEASON = [0, 1.6, 1.3, 1.15, 1.1, 1.05, 0.9, 0.8, 0.85, 1.05, 0.95, 0.9, 0.6];

// ── Exchange rates over time ────────────────────────────────────────────────
const VES_START = 36.5;
const VES_NOW = 876.8;
const COP_START = 3950;
const COP_NOW = 3194.44;
const span = NOW.getTime() - OPEN_MAIN.getTime();
const progress = (t) => Math.min(1, Math.max(0, (t.getTime() - OPEN_MAIN.getTime()) / span));
const vesAt = (t) => round2(VES_START * Math.pow(VES_NOW / VES_START, progress(t)));
const copAt = (t) => round2(COP_START + (COP_NOW - COP_START) * progress(t));
const inCurrency = (usd, cur, t) => (cur === 'VES' ? round2(usd * vesAt(t)) : cur === 'COP' ? Math.ceil((usd * copAt(t)) / 100) * 100 : usd);

// ── Names ───────────────────────────────────────────────────────────────────
const MEN = ['José', 'Luis', 'Carlos', 'Juan', 'Miguel', 'Jesús', 'Pedro', 'Andrés', 'Daniel', 'Alejandro', 'Gabriel', 'Ricardo', 'Fernando', 'Diego', 'Javier', 'Rafael', 'Antonio', 'Eduardo', 'Manuel', 'Francisco', 'Alberto', 'Óscar', 'Héctor', 'Jorge', 'Víctor', 'Kevin', 'Brayan', 'Jhonny', 'Leonardo', 'Samuel', 'Sebastián', 'Mateo', 'Santiago', 'Iván', 'Ramón', 'Wilmer', 'Yorman', 'Anderson', 'Cristian', 'Enzo', 'Gustavo', 'Simón', 'Rubén', 'Elías', 'Omar'];
const WOMEN = ['María', 'Ana', 'Carmen', 'Laura', 'Gabriela', 'Daniela', 'Andrea', 'Valentina', 'Sofía', 'Isabel', 'Patricia', 'Rosa', 'Yolimar', 'Mariana', 'Carolina', 'Paola', 'Alejandra', 'Fernanda', 'Natalia', 'Camila', 'Lucía', 'Elena', 'Marisol', 'Yusmary', 'Génesis', 'Karla', 'Adriana', 'Verónica', 'Luisa', 'Diana', 'Claudia', 'Mónica', 'Beatriz', 'Josefina', 'Raquel', 'Yuleidy', 'Stefany', 'Nathaly', 'Milagros', 'Rebeca', 'Victoria', 'Paula', 'Julieta', 'Fabiola', 'Dayana'];
const SURNAMES = ['González', 'Rodríguez', 'Pérez', 'Hernández', 'García', 'Martínez', 'López', 'Sánchez', 'Ramírez', 'Torres', 'Flores', 'Rivera', 'Gómez', 'Díaz', 'Morales', 'Rojas', 'Contreras', 'Medina', 'Mendoza', 'Castillo', 'Chacón', 'Pernía', 'Zambrano', 'Rosales', 'Duque', 'Vivas', 'Mora', 'Ramírez', 'Ochoa', 'Méndez', 'Guerrero', 'Sandoval', 'Colmenares', 'Moreno', 'Ruiz', 'Varela', 'Carrero', 'Uzcátegui', 'Parra', 'Salas', 'Bustamante', 'Cárdenas', 'Lozada', 'Briceño', 'Niño', 'Jaimes', 'Silva', 'Vargas', 'Suárez', 'Acevedo'];
const usedDocs = new Set();
const usedPhones = new Set();
function person() {
  const woman = chance(0.52);
  const name = `${pick(woman ? WOMEN : MEN)} ${pick(SURNAMES)}${chance(0.5) ? ` ${pick(SURNAMES)}` : ''}`;
  let doc;
  do doc = `V-${int(9000000, 32999999)}`;
  while (usedDocs.has(doc));
  usedDocs.add(doc);
  let phone;
  do phone = `58400${int(1000000, 9999999)}`;
  while (usedPhones.has(phone));
  usedPhones.add(phone);
  return { name, woman, doc, phone };
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

// ── Wipe ────────────────────────────────────────────────────────────────────
async function wipe() {
  const business = await prisma.business.findFirst({ where: { email: MARKER } });
  // A wipe stopped halfway leaves the business gone but its users and branches behind
  const leftover = await prisma.user.findMany({ where: { email: { endsWith: '@ebanocontrol.local' } }, select: { id: true, businessId: true } });
  if (!business && !leftover.length) return console.log('No hay negocio demo que borrar.');
  if (!business) return wipeLeftovers(leftover.map((u) => u.id));
  const b = business.id;
  const branches = (await prisma.branch.findMany({ where: { businessId: b }, select: { id: true } })).map((x) => x.id);
  const saleIds = (await prisma.sale.findMany({ where: { branchId: { in: branches } }, select: { id: true } })).map((x) => x.id);
  console.log(`Borrando ${business.name}…`);
  await prisma.gymPayment.deleteMany({ where: { businessId: b } });
  await prisma.financeMovement.deleteMany({ where: { businessId: b } });
  for (let i = 0; i < saleIds.length; i += 5000) {
    const chunk = saleIds.slice(i, i + 5000);
    await prisma.saleItem.deleteMany({ where: { saleId: { in: chunk } } });
    await prisma.salePayment.deleteMany({ where: { saleId: { in: chunk } } });
  }
  await prisma.accountingEntry.deleteMany({ where: { branchId: { in: branches } } });
  await prisma.sale.deleteMany({ where: { branchId: { in: branches } } });
  await prisma.shift.deleteMany({ where: { branchId: { in: branches } } });
  await prisma.inventory.deleteMany({ where: { branchId: { in: branches } } });
  const products = (await prisma.product.findMany({ where: { businessId: b }, select: { id: true } })).map((x) => x.id);
  await prisma.productVariant.deleteMany({ where: { productId: { in: products } } });
  await prisma.product.deleteMany({ where: { businessId: b } });
  await prisma.category.deleteMany({ where: { businessId: b } });
  // The gym tables hang from the business and go with it. Clients, users, settings and branches
  // only lose the link, so they are found first and deleted after.
  const clients = (await prisma.client.findMany({ where: { businessId: b }, select: { id: true } })).map((x) => x.id);
  const users = (await prisma.user.findMany({ where: { businessId: b }, select: { id: true } })).map((x) => x.id);
  const settings = (await prisma.setting.findMany({ where: { businessId: b }, select: { id: true } })).map((x) => x.id);
  await prisma.business.delete({ where: { id: b } });
  for (let i = 0; i < clients.length; i += 5000) await prisma.client.deleteMany({ where: { id: { in: clients.slice(i, i + 5000) } } });
  await prisma.setting.deleteMany({ where: { id: { in: settings } } });
  await wipeLeftovers(users, branches);
}

/** Users of the demo (with what they left by logging in) and its branches. */
async function wipeLeftovers(users, branches = []) {
  if (!branches.length) {
    branches = (await prisma.branch.findMany({ where: { OR: [{ name: { startsWith: 'Ebano ' }, businessId: null }] }, select: { id: true } })).map((x) => x.id);
  }
  await prisma.auditLog.deleteMany({ where: { userId: { in: users } } });
  await prisma.pushSubscription.deleteMany({ where: { userId: { in: users } } });
  await prisma.expense.deleteMany({ where: { userId: { in: users } } });
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
  console.log('Creando Ebano Demo (unos minutos)…');
  // A fixed password survives --replace; otherwise a new one each time
  const password = process.env.DEMO_PASSWORD || `Demo-${randomBytes(4).toString('hex')}`;

  // Business, settings and branches
  const businessId = id();
  await prisma.business.create({ data: { id: businessId, name: 'Ebano Demo', email: MARKER, status: 'ACTIVE', subscription: 'BASIC', phone: '584000000000', address: 'San Cristóbal, Táchira', createdAt: OPEN_MAIN } });
  const main = { id: id(), name: 'Ebano San Cristóbal', opened: OPEN_MAIN, base: 1.6, sales: 14 };
  const second = { id: id(), name: 'Ebano Barrio Obrero', opened: OPEN_SECOND, base: 0.9, sales: 6 };
  const branches = [main, second];
  await prisma.branch.createMany({
    data: [
      { id: main.id, businessId, name: main.name, isMain: true, country: 'Venezuela', state: 'Táchira', location: 'Av. Carabobo, San Cristóbal', phone: '584000000001', openingHours: 'Lunes a viernes de 5:30 a. m. a 10:00 p. m. · Sábados de 7:00 a. m. a 6:00 p. m. · Domingos de 8:00 a. m. a 2:00 p. m.', latitude: 7.7669, longitude: -72.2250, createdAt: OPEN_MAIN },
      { id: second.id, businessId, name: second.name, isMain: false, country: 'Venezuela', state: 'Táchira', location: 'Carrera 20, Barrio Obrero, San Cristóbal', phone: '584000000002', openingHours: 'Lunes a viernes de 6:00 a. m. a 9:30 p. m. · Sábados de 8:00 a. m. a 2:00 p. m.', latitude: 7.7745, longitude: -72.2175, createdAt: OPEN_SECOND },
    ],
  });
  const gymSettings = {
    reminders: { enabled: false },
    notices: { CLASS_CANCELLED: false, CLASS_MOVED: false, WAITLIST_PROMOTED: false, TRIAL_BOOKED: false },
    visits: { dayPassPrice: 5, leadFromVisit: true },
    renewal: { startFrom: 'END_IF_GRACE', graceDays: 5, earlyDays: 0, earlyDiscountPct: 0, enrollmentFee: 0, reactivationFee: 0, reactivationAfterDays: 60 },
  };
  await prisma.setting.create({
    data: {
      businessId,
      businessName: 'Ebano Demo',
      businessPhone: '584000000000',
      businessAddress: 'San Cristóbal, Táchira',
      country: 'Venezuela',
      businessType: 'GENERAL',
      enabledModules: ['pos', 'products', 'inventory', 'clients', 'credit', 'suppliers', 'accounting', 'reports', 'historial', 'whatsapp', 'deliveries', 'ai_agent', 'gym'],
      exchangeRate: VES_NOW,
      exchangeRateEur: round2(VES_NOW * 1.16),
      exchangeRateDashboard: VES_NOW,
      exchangeRateDashboardEur: round2(VES_NOW * 1.16),
      bcvUpdateDate: TODAY.toISOString().slice(0, 10),
      exchangeRateCop: COP_NOW,
      taxEnabled: false,
      pagoMovilEnabled: true,
      pagoMovilBank: 'Banesco (0134)',
      pagoMovilId: 'J-500000000',
      pagoMovilPhone: '04000000000',
      salesGoal: 12000,
      gymSettings,
    },
  });

  // People: owner (the one who logs in) and reception
  const owner = { id: id(), name: 'Dueño Demo' };
  const reception = [
    { id: id(), name: 'Yuleidy Mora', branch: main },
    { id: id(), name: 'Kevin Chacón', branch: main },
    { id: id(), name: 'Dayana Pernía', branch: second },
    { id: id(), name: 'Wilmer Duque', branch: second },
  ];
  const locked = await bcrypt.hash(randomBytes(24).toString('hex'), 10);
  await prisma.user.createMany({
    data: [
      { id: owner.id, email: MARKER, password: await bcrypt.hash(password, 10), name: owner.name, role: 'ownerpos', businessId, createdAt: OPEN_MAIN },
      ...reception.map((r, i) => ({ id: r.id, email: `recepcion${i + 1}@ebanocontrol.local`, password: locked, name: r.name, role: 'pos', permissions: ['pos'], branchIds: [r.branch.id], businessId, createdAt: r.branch.opened })),
    ],
  });

  // Staff and trainers
  const trainers = [
    ['Gabriel Rojas', 'Spinning y funcional', 'TRAINER', main, '#f26b1d'], ['Andrea Medina', 'Yoga y pilates', 'TRAINER', main, '#8b5cf6'], ['Leonardo Vivas', 'Crossfit y fuerza', 'TRAINER', main, '#0ea5e9'],
    ['Paola Zambrano', 'Zumba y baile', 'TRAINER', main, '#ec4899'], ['Óscar Carrero', 'Boxeo', 'TRAINER', main, '#22c55e'], ['Marisol Parra', 'Musculación', 'TRAINER', main, '#eab308'],
    ['Daniel Salas', 'Spinning y crossfit', 'TRAINER', second, '#f26b1d'], ['Carolina Ochoa', 'Yoga y zumba', 'TRAINER', second, '#8b5cf6'], ['Jhonny Briceño', 'Musculación', 'TRAINER', second, '#0ea5e9'],
  ].map(([name, specialty, role, branch, color]) => ({ id: id(), name, specialty, role, branch, color }));
  const staffRows = [
    ...trainers,
    ...reception.map((r) => ({ id: id(), name: r.name, specialty: 'Recepción', role: 'RECEPTION', branch: r.branch, color: '#64748b' })),
    { id: id(), name: 'Rosa Colmenares', specialty: 'Limpieza', role: 'CLEANING', branch: main, color: '#94a3b8' },
    { id: id(), name: 'Ramón Jaimes', specialty: 'Limpieza', role: 'CLEANING', branch: second, color: '#94a3b8' },
  ];
  await prisma.gymTrainer.createMany({ data: staffRows.map((t) => ({ id: t.id, businessId, branchId: t.branch.id, name: t.name, specialty: t.specialty, role: t.role, color: t.color, phone: person().phone, hourlyRate: t.role === 'TRAINER' ? int(4, 7) : 3, createdAt: t.branch.opened })) });

  // Plans
  const PLANS = [
    { key: 'mensual', name: 'Mensual', days: 30, price: 25, freeze: 7, guests: 1, weight: 55 },
    { key: 'trimestral', name: 'Trimestral', days: 90, price: 65, freeze: 15, guests: 2, weight: 14 },
    { key: 'semestral', name: 'Semestral', days: 180, price: 120, freeze: 30, guests: 2, weight: 5 },
    { key: 'anual', name: 'Anual', days: 365, price: 220, freeze: 45, guests: 3, weight: 3 },
    { key: 'estudiante', name: 'Estudiante', days: 30, price: 18, freeze: 0, guests: 0, weight: 12, description: 'Con carnet estudiantil vigente.' },
    { key: 'manana', name: 'Mañanero', days: 30, price: 18, freeze: 0, guests: 0, weight: 8, windows: [{ days: [1, 2, 3, 4, 5], start: '05:30', end: '12:00' }, { days: [6], start: '07:00', end: '12:00' }], description: 'Entrada hasta el mediodía.' },
    { key: 'multisede', name: 'Multisede Mensual', days: 30, price: 32, freeze: 7, guests: 1, weight: 4, allBranches: true, description: 'Entra a las dos sedes.' },
  ].map((p) => ({ ...p, id: id() }));
  await prisma.gymPlan.createMany({
    data: PLANS.map((p) => ({ id: p.id, businessId, name: p.name, description: p.description ?? null, durationDays: p.days, price: p.price, maxFreezeDays: p.freeze, guestPassesPerMonth: p.guests, allBranches: !!p.allBranches, accessWindows: p.windows ?? undefined, createdAt: OPEN_MAIN })),
  });
  const priceOf = (plan, t) => (t < PRICE_CHANGE ? round2(plan.price * 0.8) : plan.price);

  // Classes (each row is one weekly time slot)
  const T = Object.fromEntries(trainers.map((t) => [t.name.split(' ')[0], t.id]));
  const CLASSES = [
    [main, 'Spinning', [1, 3, 5], '06:00', 45, 20, 'Gabriel', 'Sala de spinning'], [main, 'Spinning', [1, 3, 5], '18:30', 45, 20, 'Gabriel', 'Sala de spinning'],
    [main, 'Funcional', [2, 4], '06:30', 50, 18, 'Gabriel', 'Área funcional'], [main, 'Funcional', [2, 4], '19:00', 50, 18, 'Leonardo', 'Área funcional'],
    [main, 'Crossfit', [1, 2, 3, 4, 5], '17:30', 60, 16, 'Leonardo', 'Box'], [main, 'Yoga', [2, 4], '18:00', 60, 15, 'Andrea', 'Salón 2'],
    [main, 'Pilates', [6], '09:00', 60, 15, 'Andrea', 'Salón 2'], [main, 'Zumba', [1, 3], '19:30', 50, 25, 'Paola', 'Salón 1'],
    [main, 'Boxeo', [2, 4], '20:00', 60, 14, 'Óscar', 'Salón 1'], [main, 'GAP', [6], '10:30', 45, 20, 'Paola', 'Salón 1'],
    [second, 'Spinning', [1, 3, 5], '18:00', 45, 14, 'Daniel', 'Sala de spinning'], [second, 'Crossfit', [1, 3, 5], '06:30', 60, 12, 'Daniel', 'Box'],
    [second, 'Funcional', [2, 4], '07:00', 50, 14, 'Jhonny', 'Área funcional'], [second, 'Zumba', [2, 4], '19:00', 50, 20, 'Carolina', 'Salón'],
    [second, 'Yoga', [6], '09:00', 60, 12, 'Carolina', 'Salón'],
  ].map(([branch, name, days, time, dur, cap, trainer, room]) => ({ id: id(), branch, name, days, time, dur, cap, trainerId: T[trainer], room }));
  await prisma.gymClass.createMany({
    data: CLASSES.map((c) => ({ id: c.id, businessId, branchId: c.branch.id, name: c.name, daysOfWeek: c.days, startTime: c.time, durationMin: c.dur, capacity: c.cap, trainerId: c.trainerId, room: c.room, allowTrial: c.name !== 'Crossfit', createdAt: c.branch.opened })),
  });

  // Shifts: one per branch and day, with the receptionist on duty (filled with cash below)
  const shifts = new Map();
  for (const b of branches) {
    const desk = reception.filter((r) => r.branch === b);
    for (let d = b.opened; d <= TODAY; d = addDays(d, 1)) {
      const p = localDay(d);
      const opens = p.dow === 0 ? 8 : 6;
      const closes = p.dow === 0 ? 14 : p.dow === 6 ? 18 : 22;
      shifts.set(`${b.id}|${d.getTime()}`, { id: id(), branchId: b.id, userId: desk[p.d % 2].id, openedAt: at(p.y, p.m, p.d, opens), closedAt: at(p.y, p.m, p.d, closes), open: d.getTime() === TODAY.getTime() && NOW === REAL_NOW, cash: { USD: 20 }, cashUsd: 20, totals: { CASH: 20 } });
    }
  }
  const shiftAt = (branchId, t) => shifts.get(`${branchId}|${dayStart(t).getTime()}`);
  /** A moment during the shift of that day, not later than now. */
  const duringShift = (branchId, day, from = 0, to = 1) => {
    const s = shiftAt(branchId, day);
    const end = Math.min(s.closedAt.getTime(), NOW.getTime() - 60000);
    const start = s.openedAt.getTime();
    if (end <= start) return new Date(end);
    return new Date(start + (end - start) * (from + rnd() * (to - from)));
  };

  // A charge is a sale like any other: sale, payment, accounting entry and the cash of the shift
  const METHODS = [['PAGO_MOVIL', 40], ['CASH', 30], ['CARD', 20], ['TRANSFER', 7], ['BINANCE', 3]];
  function charge({ branchId, t, amount, itemName, description, category, clientId, items, channel = 'GYM', method }) {
    const shift = shiftAt(branchId, t);
    method ||= weighted(METHODS);
    const currency = method === 'CASH' ? weighted([['USD', 65], ['VES', 22], ['COP', 13]]) : null;
    const saleId = id();
    const lines = items || [{ description: itemName, quantity: 1, price: amount, subtotal: amount }];
    push('sale', { id: saleId, branchId, userId: shift.userId, businessId, clientId: clientId ?? null, paymentMethod: method, subtotal: amount, total: amount, channel, shiftId: shift.id, createdAt: t });
    for (const l of lines) push('saleItem', { id: id(), saleId, ...l });
    const amountCurrency = currency ? inCurrency(amount, currency, t) : null;
    push('salePayment', { id: id(), saleId, method, amount, ...(currency && { currency, amountCurrency }), exchangeRate: method === 'PAGO_MOVIL' || currency === 'VES' ? vesAt(t) : null, reference: method === 'PAGO_MOVIL' || method === 'TRANSFER' ? String(int(1000, 9999)) : null });
    const entryId = id();
    push('accountingEntry', { id: entryId, description, amount, type: 'INCOME', category, saleId, branchId, userId: shift.userId, createdAt: t });
    shift.totals[method] = round2((shift.totals[method] || 0) + amount);
    if (currency) {
      shift.cash[currency] = round2((shift.cash[currency] || 0) + amountCurrency);
      shift.cashUsd = round2(shift.cashUsd + amount);
    }
    return { saleId, entryId, method, currency, amountCurrency, shiftId: shift.id, userId: shift.userId };
  }

  // ── Members and their memberships ─────────────────────────────────────────
  console.log('Socios, membresías y cobros…');
  const members = [];
  let memberNumber = 0;
  const leadsWon = [];
  const GOALS = ['Bajar de peso', 'Ganar masa muscular', 'Salud y movilidad', 'Clases grupales', 'Preparación física', 'Tonificar'];
  for (const b of branches) {
    for (let d = b.opened; d <= TODAY; d = addDays(d, 1)) {
      const p = localDay(d);
      const firstMonths = (d.getTime() - b.opened.getTime()) / DAY < 60 ? 1.8 : 1;
      const signups = poisson(b.base * SEASON[p.m] * firstMonths * (p.dow === 0 ? 0.3 : 1));
      for (let i = 0; i < signups; i++) members.push({ branch: b, joined: duringShift(b.id, d, 0, 0.9), who: person() });
    }
  }
  members.sort((a, b) => a.joined - b.joined);

  const intervals = new Map(); // branchId → [{ memberId, start, end, classes }]
  for (const b of branches) intervals.set(b.id, []);
  for (const m of members) {
    m.id = id();
    m.clientId = id();
    m.number = ++memberNumber;
    m.frequency = 1.2 + rnd() * 3.6;
    m.hour = weighted([[6, 30], [12, 12], [18, 45], [20, 13]]);
    const age = int(16, 62);
    push('client', { id: m.clientId, businessId, name: m.who.name, documentId: m.who.doc, phone: m.who.phone, email: chance(0.4) ? `${m.who.name.split(' ')[0].toLowerCase().normalize('NFD').replace(/[^a-z]/g, '')}${int(10, 99)}@correo.demo` : null, createdAt: m.joined });
    push('gymMember', { id: m.id, businessId, branchId: m.branch.id, clientId: m.clientId, memberNumber: m.number, gender: m.who.woman ? 'F' : 'M', birthDate: new Date(Date.UTC(localDay(NOW).y - age, int(0, 11), int(1, 28))), goal: pick(GOALS), emergencyContact: chance(0.6) ? pick(MEN.concat(WOMEN)) : null, emergencyPhone: chance(0.6) ? person().phone : null, createdAt: m.joined });
    if (chance(0.35)) leadsWon.push(m);

    // One plan after another while they keep renewing; some come back after a while
    let start = m.joined;
    let plan = weighted(PLANS.filter((x) => x.key !== 'multisede' || m.joined > OPEN_SECOND).map((x) => [x, x.weight]));
    let first = true;
    while (start <= NOW) {
      const price = priceOf(plan, start);
      let end = addDays(start, plan.days);
      const msId = id();
      let frozen = 0;
      if (plan.freeze > 0 && chance(0.05) && end < NOW) {
        frozen = int(7, plan.freeze);
        end = addDays(end, frozen);
      }
      const cancelled = chance(0.008) && end < NOW;
      const owesNow = end > NOW && chance(0.04);
      const paid = owesNow ? round2(price / 2) : price;
      push('gymMembership', { id: msId, businessId, memberId: m.id, planId: plan.id, planName: plan.name, startDate: start, endDate: end, price, status: cancelled ? 'CANCELLED' : 'ACTIVE', cancelledAt: cancelled ? addDays(start, 5) : null, frozenDaysUsed: frozen, freezeCount: frozen ? 1 : 0, freezeReason: frozen ? pick(['Viaje', 'Lesión', 'Trabajo', 'Exámenes']) : null, createdById: null, createdAt: start });
      const payDay = start > NOW ? NOW : start;
      const t = shiftAt(m.branch.id, payDay) ? duringShift(m.branch.id, payDay, 0, 0.95) : payDay;
      const c = charge({ branchId: m.branch.id, t, amount: paid, itemName: `Membresía ${plan.name}`, description: `Membresía ${plan.name} · ${m.who.name}`, category: 'MEMBRESIA_GYM', clientId: m.clientId });
      push('gymPayment', { id: id(), businessId, membershipId: msId, amount: paid, method: c.method, ...(c.currency && { currency: c.currency, amountCurrency: c.amountCurrency }), createdById: c.userId, branchId: m.branch.id, shiftId: c.shiftId, accountingEntryId: c.entryId, saleId: c.saleId, createdAt: t });
      if (!cancelled) intervals.get(m.branch.id).push({ memberId: m.id, start, end, classes: plan.key !== 'manana', allBranches: !!plan.allBranches, member: m });
      m.lastEnd = end;
      m.lastMembership = msId;
      if (first) m.firstPlan = plan.name;
      first = false;

      // Renew, take a break or leave
      if (cancelled) break;
      const stay = plan.days >= 90 ? 0.82 : 0.78;
      if (chance(stay)) start = addDays(end, chance(0.7) ? 0 : int(1, 5));
      else if (chance(0.25)) start = addDays(end, int(30, 200));
      else break;
      if (chance(0.15)) plan = weighted(PLANS.filter((x) => x.key !== 'multisede' || start > OPEN_SECOND).map((x) => [x, x.weight]));
    }
  }
  await flush('client');
  await flush('gymMember');
  await flush('gymMembership');

  // ── Check-ins ──────────────────────────────────────────────────────────────
  console.log('Entradas…');
  for (const [branchId, list] of intervals) {
    for (const iv of list) {
      const m = iv.member;
      const last = iv.end < NOW ? iv.end : NOW;
      for (let d = dayStart(iv.start); d < last; d = addDays(d, 1)) {
        const p = localDay(d);
        if (p.dow === 0 && chance(0.85)) continue;
        if (!chance(m.frequency / 6.2)) continue;
        const h = Math.min(21, Math.max(5, m.hour + int(-1, 1)));
        const t = at(p.y, p.m, p.d, h, int(0, 59));
        if (t > NOW || t < iv.start) continue;
        const elsewhere = iv.allBranches && chance(0.15) && t > OPEN_SECOND ? branches.find((b) => b.id !== branchId).id : branchId;
        push('gymCheckIn', { id: id(), businessId, branchId: elsewhere, memberId: iv.memberId, granted: true, reason: 'Membresía activa', method: t > at(2025, 1, 10) ? 'FACE' : 'MANUAL', createdAt: t });
      }
    }
    // Some come by after their plan ran out
    for (const m of members.filter((x) => x.branch.id === branchId && x.lastEnd < NOW && chance(0.12))) {
      const t = addDays(m.lastEnd, int(1, 6));
      const when = addDays(dayStart(t), 0.75);
      if (when < NOW) push('gymCheckIn', { id: id(), businessId, branchId, memberId: m.id, granted: false, reason: `Membresía vencida el ${localDay(m.lastEnd).d}/${localDay(m.lastEnd).m}`, method: 'FACE', createdAt: when });
    }
  }
  await flush('gymCheckIn');

  // ── Class sessions and bookings ────────────────────────────────────────────
  console.log('Clases y reservas…');
  const horizon = addDays(TODAY, 7);
  const futureSessions = [];
  for (const c of CLASSES) {
    const [hh, mm] = c.time.split(':').map(Number);
    const pool = intervals.get(c.branch.id).filter((iv) => iv.classes);
    for (let d = c.branch.opened; d < horizon; d = addDays(d, 1)) {
      const p = localDay(d);
      if (!c.days.includes(p.dow)) continue;
      const startsAt = at(p.y, p.m, p.d, hh, mm);
      const sid = id();
      const past = startsAt < NOW;
      const cancelled = past && chance(0.015);
      push('gymClassSession', { id: sid, businessId, branchId: c.branch.id, classId: c.id, trainerId: c.trainerId, startsAt, endsAt: new Date(startsAt.getTime() + c.dur * 60000), capacity: c.cap, status: cancelled ? 'CANCELLED' : 'SCHEDULED', cancelReason: cancelled ? pick(['Entrenador enfermo', 'Falla eléctrica', 'Feriado']) : null, createdAt: addDays(startsAt, -7) });
      if (cancelled) continue;
      if (!past) futureSessions.push({ id: sid, startsAt, cls: c });
      const active = pool.filter((iv) => iv.start <= startsAt && iv.end > startsAt);
      const fill = Math.min(active.length, Math.round(c.cap * (past ? 0.45 + rnd() * 0.5 : 0.2 + rnd() * 0.5)));
      const chosen = new Set();
      for (let k = 0; k < fill * 3 && chosen.size < fill; k++) chosen.add(pick(active).memberId);
      for (const memberId of chosen) {
        const status = past ? weighted([['ATTENDED', 86], ['NO_SHOW', 8], ['CANCELLED', 6]]) : 'BOOKED';
        push('gymBooking', { id: id(), businessId, sessionId: sid, memberId, status, source: weighted([['PORTAL', 45], ['STAFF', 40], ['AGENT', 15]]), createdAt: new Date(startsAt.getTime() - int(2, 72) * 3600000) });
      }
    }
  }
  await flush('gymClassSession');
  await flush('gymBooking');

  // ── Day passes and guests ──────────────────────────────────────────────────
  console.log('Pases de día e invitados…');
  for (const b of branches) {
    const memberPool = members.filter((m) => m.branch === b);
    for (let d = b.opened; d <= TODAY; d = addDays(d, 1)) {
      const p = localDay(d);
      for (let i = 0; i < poisson(b === main ? 2.6 : 1.2); i++) {
        const t = duringShift(b.id, d);
        const price = t < PRICE_CHANGE ? 4 : 5;
        const who = person();
        const vid = id();
        push('gymVisit', { id: vid, businessId, branchId: b.id, kind: 'DAY_PASS', name: who.name, documentId: who.doc, phone: chance(0.6) ? who.phone : null, price, checkedInAt: t, checkedOutAt: new Date(t.getTime() + int(50, 120) * 60000), createdById: shiftAt(b.id, t).userId });
        const c = charge({ branchId: b.id, t, amount: price, itemName: 'Pase de día', description: `Pase de día · ${who.name}`, category: 'PASE_GYM' });
        push('gymPayment', { id: id(), businessId, visitId: vid, amount: price, method: c.method, ...(c.currency && { currency: c.currency, amountCurrency: c.amountCurrency }), createdById: c.userId, branchId: b.id, shiftId: c.shiftId, accountingEntryId: c.entryId, saleId: c.saleId, createdAt: t });
      }
      if (p.dow !== 0 && chance(0.45) && memberPool.length) {
        const host = pick(memberPool.filter((m) => m.joined < d) || memberPool);
        if (!host) continue;
        const t = duringShift(b.id, d);
        push('gymVisit', { id: id(), businessId, branchId: b.id, kind: 'GUEST', name: person().name, hostMemberId: host.id, price: 0, checkedInAt: t, checkedOutAt: new Date(t.getTime() + 90 * 60000) });
      }
    }
  }
  await flush('gymVisit');

  // ── Prospects ──────────────────────────────────────────────────────────────
  console.log('Prospectos…');
  const SOURCES = [['INSTAGRAM', 34], ['WALK_IN', 22], ['REFERRAL', 18], ['WHATSAPP', 12], ['FACEBOOK', 6], ['TIKTOK', 5], ['GUEST', 3]];
  const INTEREST = ['Bajar de peso', 'Ganar fuerza', 'Clases grupales', 'Salud y movilidad', 'Spinning', 'Crossfit'];
  for (const m of leadsWon) {
    const created = addDays(m.joined, -int(1, 14));
    const lid = id();
    push('gymLead', { id: lid, businessId, branchId: m.branch.id, name: m.who.name, phone: m.who.phone, documentId: m.who.doc, source: weighted(SOURCES), interest: pick(INTEREST), stage: 'WON', memberId: m.id, wonAt: m.joined, createdAt: created, updatedAt: m.joined });
    push('gymLeadActivity', { id: id(), businessId, leadId: lid, type: 'WHATSAPP', text: 'Preguntó por los planes y los horarios', userName: 'Recepción', createdAt: created });
    push('gymLeadActivity', { id: id(), businessId, leadId: lid, type: 'STAGE', text: `Nuevo → Socio (socio n.º ${m.number})`, userName: 'Recepción', createdAt: m.joined });
  }
  for (const b of branches) {
    for (let d = b.opened; d <= TODAY; d = addDays(d, 1)) {
      for (let i = 0; i < poisson(b === main ? 1.1 : 0.5); i++) {
        const who = person();
        const created = duringShift(b.id, d);
        const ageDays = (NOW - created) / DAY;
        const stage = ageDays > 30 ? weighted([['LOST', 70], ['CONTACTED', 30]]) : weighted([['NEW', 30], ['CONTACTED', 35], ['TRIAL_SCHEDULED', 20], ['TRIAL_DONE', 10], ['LOST', 5]]);
        const lid = id();
        let trialSessionId = null;
        let trialAt = null;
        if (stage === 'TRIAL_SCHEDULED') {
          const s = futureSessions.filter((f) => f.cls.branch === b && f.cls.name !== 'Crossfit');
          if (s.length) {
            const one = pick(s);
            trialSessionId = one.id;
            trialAt = one.startsAt;
          }
        }
        push('gymLead', {
          id: lid, businessId, branchId: b.id, name: who.name, phone: who.phone, source: weighted(SOURCES), interest: pick(INTEREST),
          stage: stage === 'TRIAL_SCHEDULED' && !trialSessionId ? 'CONTACTED' : stage, trialSessionId, trialAt,
          lostReason: stage === 'LOST' ? pick(['Le pareció caro', 'Se mudó', 'No respondió', 'Eligió otro gimnasio', 'Horario no le sirve']) : null,
          lostAt: stage === 'LOST' ? addDays(created, int(3, 20)) : null,
          nextFollowUpAt: ['NEW', 'CONTACTED', 'TRIAL_DONE'].includes(stage) ? addDays(created, int(1, 5)) : null,
          createdAt: created, updatedAt: created,
        });
        push('gymLeadActivity', { id: id(), businessId, leadId: lid, type: pick(['WHATSAPP', 'CALL', 'NOTE']), text: pick(['Pidió precios', 'Preguntó por clases de spinning', 'Vino a conocer las instalaciones', 'Escribió por Instagram', 'Referido por un socio']), userName: 'Recepción', createdAt: created });
      }
    }
  }
  await flush('gymLead');
  await flush('gymLeadActivity');

  // ── Equipment ──────────────────────────────────────────────────────────────
  console.log('Equipos y mantenimientos…');
  const EQUIPMENT = [
    ['Caminadora', 'CARDIO', 'Life Fitness', 6, 2, 2800, 90], ['Bicicleta de spinning', 'CARDIO', 'Keiser', 20, 14, 900, 120], ['Elíptica', 'CARDIO', 'Precor', 3, 2, 2200, 90],
    ['Remo', 'CARDIO', 'Concept2', 2, 1, 1100, 180], ['Rack de sentadillas', 'STRENGTH', 'Rogers', 2, 1, 1500, 180], ['Máquina Smith', 'STRENGTH', 'Hammer Strength', 1, 1, 2400, 180],
    ['Prensa de piernas', 'STRENGTH', 'Hammer Strength', 1, 1, 3100, 180], ['Banco plano', 'STRENGTH', 'Rogers', 4, 2, 250, 365], ['Polea doble', 'STRENGTH', 'Life Fitness', 1, 1, 3500, 120],
    ['Juego de mancuernas 2–40 kg', 'FREE_WEIGHTS', 'Ziva', 1, 1, 2600, 365],
  ];
  for (const b of branches) {
    for (const [name, category, brand, qMain, qSecond, price, every] of EQUIPMENT) {
      const q = b === main ? qMain : qSecond;
      for (let i = 1; i <= q; i++) {
        const eid = id();
        const purchase = addDays(b.opened, -int(5, 30));
        let last = null;
        for (let s = addDays(purchase, every); s < NOW; s = addDays(s, every)) {
          push('gymMaintenance', { id: id(), businessId, equipmentId: eid, kind: 'PREVENTIVE', status: 'DONE', title: 'Mantenimiento preventivo', doneAt: s, cost: round2(price * 0.02), vendor: 'Servitec Táchira', resolution: 'Lubricación, ajuste y limpieza', createdAt: s });
          last = s;
        }
        const broken = chance(0.06);
        if (broken) push('gymMaintenance', { id: id(), businessId, equipmentId: eid, kind: 'REPAIR', status: 'OPEN', title: pick(['Hace ruido al usarla', 'La pantalla no enciende', 'Cable desgastado']), reportedBy: `Socio: ${pick(members).who.name}`, createdAt: addDays(NOW, -int(1, 6)) });
        push('gymEquipment', { id: eid, businessId, branchId: b.id, name: q > 1 ? `${name} ${i}` : name, category, brand, area: category === 'CARDIO' ? 'Cardio' : 'Pesas', purchaseDate: purchase, purchasePrice: price, warrantyUntil: addDays(purchase, 365), status: broken ? 'NEEDS_SERVICE' : 'OK', serviceEveryDays: every, lastServiceAt: last, nextServiceAt: addDays(last || purchase, every), createdAt: purchase });
      }
    }
  }
  await flush('gymEquipment');
  await flush('gymMaintenance');

  // ── POS: products and daily sales ──────────────────────────────────────────
  console.log('Punto de venta…');
  const CATALOG = {
    Bebidas: [['Agua mineral 600 ml', 1, 0.45], ['Gatorade 500 ml', 2, 1.1], ['Bebida energética', 2.5, 1.4], ['Powerade 600 ml', 2, 1.05], ['Agua de coco', 2.5, 1.3]],
    Suplementos: [['Proteína whey 2 lb', 45, 30], ['Proteína whey 5 lb', 85, 58], ['Creatina 300 g', 30, 19], ['Pre-entreno 30 servicios', 35, 22], ['BCAA 250 g', 28, 17], ['Proteína por servicio', 2.5, 1.1]],
    Snacks: [['Barra de proteína', 3, 1.6], ['Barra de cereal', 1.2, 0.6], ['Galletas de avena', 1.5, 0.7], ['Maní salado', 1, 0.45], ['Batido de proteína', 4, 1.8]],
    Accesorios: [['Toalla', 8, 4], ['Guantes de entrenamiento', 15, 8], ['Shaker', 7, 3], ['Candado', 5, 2.5], ['Cuerda para saltar', 9, 4.5], ['Banda elástica', 10, 4.5]],
    Ropa: [['Franela Ebano', 15, 7], ['Short deportivo', 18, 9], ['Licra deportiva', 22, 11], ['Gorra Ebano', 12, 5]],
  };
  const variants = [];
  for (const [cat, items] of Object.entries(CATALOG)) {
    const catId = id();
    push('category', { id: catId, businessId, name: cat, createdAt: OPEN_MAIN });
    for (const [name, price, cost] of items) {
      const pid = id();
      const vid = id();
      push('product', { id: pid, name, businessId, categoryId: catId, createdAt: OPEN_MAIN });
      const stockMain = int(6, 60);
      const stockSecond = int(3, 30);
      push('productVariant', { id: vid, productId: pid, name: 'Única', sku: `EBN-${String(variants.length + 1).padStart(3, '0')}`, price, cost, stock: stockMain + stockSecond, minStock: 5, createdAt: OPEN_MAIN });
      push('inventory', { id: id(), variantId: vid, branchId: main.id, quantity: stockMain });
      push('inventory', { id: id(), variantId: vid, branchId: second.id, quantity: stockSecond });
      variants.push({ id: vid, name, price, cost, weight: cat === 'Bebidas' ? 10 : cat === 'Snacks' ? 5 : cat === 'Suplementos' ? 2 : 1 });
    }
  }
  await flush('category');
  await flush('product');
  await flush('productVariant');
  await flush('inventory');
  for (const b of branches) {
    for (let d = b.opened; d <= TODAY; d = addDays(d, 1)) {
      const p = localDay(d);
      for (let i = 0; i < poisson(b.sales * SEASON[p.m] * (p.dow === 0 ? 0.4 : 1)); i++) {
        const t = duringShift(b.id, d);
        const lines = [];
        for (let k = 0; k < weighted([[1, 70], [2, 22], [3, 8]]); k++) {
          const v = weighted(variants.map((x) => [x, x.weight]));
          const qty = v.price < 3 ? weighted([[1, 75], [2, 20], [3, 5]]) : 1;
          lines.push({ description: v.name, variantId: v.id, quantity: qty, price: v.price, cost: v.cost, subtotal: round2(v.price * qty) });
        }
        const total = round2(lines.reduce((s, l) => s + l.subtotal, 0));
        const member = chance(0.3) ? pick(members.filter((m) => m.branch === b && m.joined < t)) : null;
        charge({ branchId: b.id, t, amount: total, items: lines, description: `Venta POS #${String(int(1000, 9999))}`, category: 'VENTA_POS', clientId: member?.clientId, channel: 'POS', method: weighted([['CASH', 38], ['PAGO_MOVIL', 30], ['CARD', 25], ['TRANSFER', 4], ['BINANCE', 3]]) });
      }
    }
  }

  // ── Expenses and other money movements ─────────────────────────────────────
  console.log('Ingresos y egresos…');
  const label = { ALQUILER: 'Alquiler', SERVICIOS: 'Servicios', NOMINA: 'Nómina y personal', MANTENIMIENTO: 'Mantenimiento', LIMPIEZA: 'Limpieza', INSUMOS: 'Insumos', PUBLICIDAD: 'Publicidad', RETIRO_DUENO: 'Retiro del dueño' };
  const movement = (b, t, category, amount, method, description) => {
    if (t > NOW) return;
    const entryId = id();
    push('accountingEntry', { id: entryId, description: `Egreso: ${label[category]}${description ? ` · ${description}` : ''}`, type: 'EXPENSE', amount, category: `MOV_${category}`, branchId: b.id, userId: owner.id, createdAt: t });
    push('financeMovement', { id: id(), businessId, branchId: b.id, userId: owner.id, userName: owner.name, type: 'OUT', category, amount, currency: 'USD', amountCurrency: amount, method, description, occurredAt: t, source: 'DASHBOARD', accountingEntryId: entryId, status: 'ACTIVE', reviewedAt: (NOW - t) / DAY > 7 ? addDays(t, 1) : null, reviewedBy: (NOW - t) / DAY > 7 ? owner.name : null, createdAt: t });
  };
  for (const b of branches) {
    const big = b === main;
    for (let mth = at(localDay(b.opened).y, localDay(b.opened).m, 1); mth <= NOW; mth = at(localDay(addDays(mth, 32)).y, localDay(addDays(mth, 32)).m, 1)) {
      const p = localDay(mth);
      const grow = Math.min(1, 0.6 + ((mth - b.opened) / DAY / 365) * 0.5);
      movement(b, at(p.y, p.m, 2, 10), 'ALQUILER', big ? 1500 : 900, 'TRANSFER', 'Local');
      movement(b, at(p.y, p.m, 6, 11), 'SERVICIOS', round2((big ? 260 : 150) * (0.9 + rnd() * 0.25)), 'PAGO_MOVIL', 'Luz, agua e internet');
      movement(b, at(p.y, p.m, 15, 17), 'NOMINA', round2((big ? 1900 : 1000) * grow), 'TRANSFER', 'Primera quincena');
      movement(b, at(p.y, p.m, 28, 17), 'NOMINA', round2((big ? 1900 : 1000) * grow), 'TRANSFER', 'Segunda quincena');
      movement(b, at(p.y, p.m, 8, 9), 'LIMPIEZA', round2((big ? 110 : 70) * (0.9 + rnd() * 0.3)), 'CASH_OTHER', 'Productos de limpieza');
      movement(b, at(p.y, p.m, 10, 9), 'INSUMOS', round2((big ? 70 : 40) * (0.8 + rnd() * 0.5)), 'CASH_OTHER', pick(['Toallas de papel', 'Cloro y desinfectante', 'Bolsas y papelería']));
      if (big) movement(b, at(p.y, p.m, 3, 12), 'PUBLICIDAD', round2(120 + rnd() * 80), 'CARD', 'Anuncios en Instagram');
      if (chance(0.6)) movement(b, at(p.y, p.m, int(11, 25), 14), 'MANTENIMIENTO', round2(30 + rnd() * 220), 'CASH_OTHER', pick(['Repuesto de caminadora', 'Tapicería de banco', 'Cambio de cables de polea', 'Aire acondicionado']));
      if (big) movement(b, at(p.y, p.m, 27, 19), 'RETIRO_DUENO', round2(800 + rnd() * 900), 'TRANSFER', 'Retiro mensual');
    }
  }

  // ── Close the shifts ───────────────────────────────────────────────────────
  for (const s of shifts.values()) {
    const counted = { ...s.cash };
    let diff = 0;
    if (!s.open && chance(0.12)) {
      diff = round2((chance(0.6) ? -1 : 1) * int(1, 5));
      counted.USD = round2((counted.USD || 0) + diff);
    }
    push('shift', {
      id: s.id, userId: s.userId, branchId: s.branchId, openingBalance: 20, openingCash: { USD: 20 }, openedAt: s.openedAt,
      status: s.open ? 'OPEN' : 'CLOSED', closedAt: s.open ? null : s.closedAt,
      expectedBalance: s.open ? 0 : s.cashUsd, closingBalance: s.open ? 0 : round2(s.cashUsd + diff), difference: diff,
      expectedCash: s.open ? undefined : s.cash, countedCash: s.open ? undefined : counted,
      notes: diff ? (diff < 0 ? 'Faltante en el cierre' : 'Sobrante en el cierre') : null,
    });
  }
  await flush('shift');
  await flush('sale');
  await flush('saleItem');
  await flush('salePayment');
  await flush('accountingEntry');
  await flush('gymPayment');
  await flush('financeMovement');

  const active = [...intervals.values()].flat().filter((iv) => iv.start <= NOW && iv.end > NOW).length;
  console.log('\n✅ Ebano Demo listo');
  console.log(`   Socios: ${members.length} (${active} con plan vigente hoy)`);
  console.log(`   Usuario: ${MARKER}`);
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
