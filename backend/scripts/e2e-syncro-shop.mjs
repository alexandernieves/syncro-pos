#!/usr/bin/env node
/**
 * End-to-end check of the Syncro Shop flow against the LOCAL environment:
 * publish → visible in the shop → guest order → approve (sale + stock) →
 * deliver, plus a second order that is cancelled and returns its stock.
 *
 * Needs the seeded merchant (scripts/seed-dev.mjs) and the four services running.
 * Usage: node scripts/e2e-syncro-shop.mjs
 */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const API = 'http://localhost:9100';
const SHOP = 'http://localhost:3000';
const MERCHANT = { email: 'comerciante@syncro.test', password: 'Syncro2026!' };
const PRODUCT_NAME = 'Especiero giratorio';

const envFile = readFileSync(new URL('../.env', import.meta.url), 'utf8');
if (!/^DATABASE_URL=.*@localhost:5434\/syncro_dev/m.test(envFile)) {
  console.error('❌ El backend no apunta a la base local. Esta prueba solo corre en desarrollo.');
  process.exit(1);
}

const sql = (q) => execFileSync('docker', ['exec', 'syncro-dev-db', 'psql', '-U', 'postgres', '-d', 'syncro_dev', '-Atc', q]).toString().trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (label, ok, detail = '') => {
  console.log(`${ok ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};

async function call(base, method, path, body, token, extraHeaders = {}) {
  await sleep(1100); // the POS API allows 60 requests per minute
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extraHeaders },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
}

const { data: login } = await call(API, 'POST', '/auth/login', MERCHANT);
const token = login.access_token;
check('Comerciante inicia sesión', Boolean(token));

const [productId, variantId, businessId, mainBranch] = sql(
  `select p.id, v.id, p."businessId", (select id from "Branch" where "businessId"=p."businessId" and "isMain") from "Product" p join "ProductVariant" v on v."productId"=p.id where p.name='${PRODUCT_NAME}' limit 1`,
).split('|');
const stockAt = () => Number(sql(`select coalesce((select quantity from "Inventory" where "variantId"='${variantId}' and "branchId"='${mainBranch}'),0)`));
// Keep enough stock for the test
sql(`update "Inventory" set quantity = greatest(quantity, 10) where "variantId"='${variantId}' and "branchId"='${mainBranch}'`);

// 1. Publish from the main branch
await call(API, 'PUT', `/products/${productId}/syncro-shop`, { published: false }, token);
const pub = await call(API, 'PUT', `/products/${productId}/syncro-shop`, { published: true, branchId: mainBranch }, token);
check('Publicar producto desde la sucursal principal', pub.data?.isPublishedOnSyncroShop === true && pub.data?.syncroShopBranchId === mainBranch);

// 2. Visible in the shop
const page = await fetch(`${SHOP}/producto/${productId}`).then((r) => r.text());
check('La ficha se ve en Syncro Shop con precio con IVA', page.includes(PRODUCT_NAME) && page.includes('IVA incluido'));

// 3. Guest order
const order = async (name, phone) => call(SHOP, 'POST', '/api/orders', {
  businessId,
  items: [{ productId, variantId, quantity: 1 }],
  values: { name, phone },
  deliveryMethod: 'PICKUP',
  source: 'buy_now',
}, null, { 'X-Forwarded-For': `203.0.113.${Math.floor(Math.random() * 200) + 1}` });
const placed = await order('Prueba E2E', `0414${Math.floor(1000000 + Math.random() * 8999999)}`);
check('Compra como invitado', placed.status === 201 || placed.status === 200, placed.data?.code ?? JSON.stringify(placed.data));
const code = placed.data?.code;
const orderId = sql(`select id from "ShopOrder" where code='${code}'`);
check('Notificación al comerciante', Number(sql(`select count(*) from "Notification" where type='SYNCRO_SHOP_ORDER' and message like '${code}%'`)) === 1);

// 4. Approve: sale + stock
const before = stockAt();
const approved = await call(API, 'POST', `/storefront/admin/orders/${orderId}/approve`, { paymentMethod: 'PAGO_MOVIL' }, token);
const after = stockAt();
check('Aprobar pedido', approved.data?.status === 'APROBADO', approved.data?.message ?? '');
check('Stock descontado de la sucursal de publicación', after === before - 1, `${before} → ${after}`);
const saleId = approved.data?.saleIds?.[0];
const sale = sql(`select channel || '|' || round(total::numeric,2) from "Sale" where id='${saleId}'`).split('|');
check('Venta registrada en el POS (canal ONLINE)', sale[0] === 'ONLINE', `total ${sale[1]}`);
check('Total de la venta = total del pedido', Math.abs(Number(sale[1]) - placed.data.total) < 0.01, `${sale[1]} vs ${placed.data.total}`);
const sales = await call(API, 'GET', '/sales', null, token);
check('La venta aparece en el listado de ventas', Array.isArray(sales.data) && sales.data.some((s) => s.id === saleId));
const double = await call(API, 'POST', `/storefront/admin/orders/${orderId}/approve`, { paymentMethod: 'PAGO_MOVIL' }, token);
check('No se puede aprobar dos veces', double.status === 400);

// 5. Buyer sees the status; deliver
const phoneDigits = sql(`select "customerPhone" from "ShopOrder" where id='${orderId}'`).replace(/\D/g, '');
const lookup = await call(SHOP, 'GET', `/api/orders/${code}?phone=${phoneDigits}`);
check('El comprador ve su pedido confirmado', lookup.data?.status === 'APROBADO');
const delivered = await call(API, 'POST', `/storefront/admin/orders/${orderId}/deliver`, {}, token);
check('Marcar entregado', delivered.data?.status === 'ENTREGADO');

// 6. Cancel returns stock
const second = await order('Prueba E2E Cancelada', `0424${Math.floor(1000000 + Math.random() * 8999999)}`);
const secondId = sql(`select id from "ShopOrder" where code='${second.data?.code}'`);
const s0 = stockAt();
await call(API, 'POST', `/storefront/admin/orders/${secondId}/approve`, { paymentMethod: 'CASH' }, token);
const s1 = stockAt();
const cancelled = await call(API, 'POST', `/storefront/admin/orders/${secondId}/cancel`, { reason: 'Prueba E2E' }, token);
const s2 = stockAt();
check('Cancelar pedido aprobado devuelve el stock', cancelled.data?.status === 'CANCELADO' && s1 === s0 - 1 && s2 === s0, `${s0} → ${s1} → ${s2}`);

console.log(failures ? `\n❌ ${failures} verificación(es) fallaron` : '\n✅ Flujo completo de Syncro Shop OK');
process.exit(failures ? 1 : 0);
