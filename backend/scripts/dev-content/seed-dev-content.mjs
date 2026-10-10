#!/usr/bin/env node
/**
 * Demo content for the LOCAL environment (never production):
 *  - Shopify-style landing pages for six products, with illustrative GIFs
 *    generated from the product photos (make_gifs.py) and uploaded through the POS.
 *  - Demo buyers (password Cliente2026!) and reviews for every published product.
 *
 * Re-runnable: landing pages are replaced and existing reviews are kept.
 * Usage: node scripts/dev-content/seed-dev-content.mjs
 */
import { readFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const API = 'http://localhost:9100';
const DB = 'syncro-dev-db';
const PASSWORD = 'Syncro2026!';
const HERE = new URL('.', import.meta.url).pathname;
const OUT = join(tmpdir(), 'syncro-dev-gifs');

const env = readFileSync(new URL('../../.env', import.meta.url), 'utf8');
if (!/^DATABASE_URL=.*@localhost:5434\/syncro_dev/m.test(env)) {
  console.error('❌ El backend no apunta a la base local. Este script solo corre en desarrollo.');
  process.exit(1);
}

const sql = (q) => execFileSync('docker', ['exec', '-i', DB, 'psql', '-U', 'postgres', '-d', 'syncro_dev', '-v', 'ON_ERROR_STOP=1', '-Atq'], { input: q }).toString().trim();
const q = (v) => (v === null || v === undefined ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
let blockSeq = 0;
const id = () => `b${Date.now().toString(36)}${(blockSeq++).toString(36)}`;

async function api(method, path, token, body, isForm = false) {
  await sleep(1100); // 60 requests per minute
  const res = await fetch(API + path, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(isForm ? {} : { 'Content-Type': 'application/json' }) },
    body: isForm ? body : body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${JSON.stringify(data).slice(0, 200)}`);
  return data;
}

async function upload(token, filePath) {
  const form = new FormData();
  form.append('file', new Blob([readFileSync(filePath)], { type: 'image/gif' }), filePath.split('/').pop());
  return (await api('POST', '/uploads', token, form, true)).url;
}

const TRUST = [
  { icon: 'cash', title: 'Pagas al recibir', text: 'Sin tarjeta ni registro' },
  { icon: 'truck', title: 'Delivery el mismo día', text: 'Si pides antes de las 3 p. m.' },
  { icon: 'shield', title: 'Producto original', text: 'Con garantía de la tienda' },
  { icon: 'return', title: 'Cambios fáciles', text: 'Dentro de los 7 días' },
];

// ── Landing pages ────────────────────────────────────────────────────────────
const LANDINGS = [
  {
    key: 'licuadora', merchant: 'comerciante@syncro.test', product: 'Licuadora 600 W', dj: 51,
    hero: ['La licuadora que tritura hielo en segundos', 'Batidos, salsas y jugos perfectos con 600 W de potencia y vaso de vidrio de 1,5 L.'],
    benefits: [['Tritura hielo sin esfuerzo', 'Cuchillas de acero inoxidable de 6 puntas'], ['Vaso de vidrio de 1,5 L', 'No absorbe olores ni se raya'], ['3 velocidades + pulso', 'Control total de la textura'], ['Base antideslizante', 'Firme sobre la mesa'], ['Fácil de limpiar', 'Las cuchillas se desmontan'], ['6 meses de garantía', 'Respaldo directo de la tienda']],
    steps: ['Agrega los ingredientes', 'Elige la velocidad', 'Sirve y disfruta'],
    stepTexts: ['Fruta, hielo y líquido hasta la marca de 1,5 L.', 'Velocidad 1 para mezclar, 3 o pulso para triturar hielo.', 'En menos de un minuto tienes tu batido listo.'],
    imageText: ['Potencia que se nota desde el primer uso', 'Su motor de 600 W mantiene la velocidad aunque el vaso esté lleno. Ideal para la familia: batidos en la mañana, salsas al mediodía y jugos naturales en la tarde.'],
    testimonials: [['Yohana C.', 'La uso todos los días para los batidos de mis hijos. Tritura el hielo perfecto.', 5], ['Luis M.', 'Muy buena relación precio-calidad. El vaso de vidrio es grueso.', 5], ['Andreína P.', 'Llegó el mismo día. Funciona excelente.', 4]],
    faq: [['¿Sirve para triturar hielo?', 'Sí. Usa la velocidad 3 o el botón de pulso con un poco de líquido.'], ['¿Qué incluye la caja?', 'Base con motor, vaso de vidrio de 1,5 L con tapa y manual en español.'], ['¿Tiene garantía?', 'Sí, 6 meses directo con la tienda presentando tu número de pedido.']],
    cta: ['¡Llévala hoy y paga al recibir!', 'Delivery el mismo día en San Cristóbal.'],
  },
  {
    key: 'microondas', merchant: 'comerciante@syncro.test', product: 'Horno microondas 20 L', dj: 66,
    hero: ['Calienta, descongela y cocina en minutos', 'Microondas de 20 L con 5 niveles de potencia. Compacto para cualquier cocina.'],
    benefits: [['20 litros de capacidad', 'Cabe un plato llano de 25 cm'], ['5 niveles de potencia', 'De mantener caliente a cocinar'], ['Descongelado rápido', 'Por peso o por tiempo'], ['Tamaño compacto', 'Ideal para cocinas pequeñas'], ['Plato giratorio', 'Calor parejo en todo el plato'], ['1 año de garantía', 'Respaldo de la tienda']],
    steps: ['Coloca el plato', 'Elige potencia y tiempo', 'Retira con cuidado'],
    stepTexts: ['Usa recipientes aptos para microondas.', 'Gira las perillas: potencia arriba, tiempo abajo.', 'Suena una campana al terminar.'],
    imageText: ['El aliado de la cocina rápida', 'Recalienta el almuerzo, descongela la carne para la cena o prepara palomitas en minutos. Sus perillas son simples de usar para toda la familia.'],
    testimonials: [['Carmen R.', 'Calienta parejo y es muy silencioso. Lo recomiendo.', 5], ['José A.', 'Pequeño pero cabe todo lo que necesito.', 4], ['Mariela T.', 'Excelente atención, me explicaron cómo usarlo por WhatsApp.', 5]],
    faq: [['¿Cuánto consume?', '700 W de potencia de cocción; usa un tomacorriente normal de 110 V.'], ['¿Se puede usar para descongelar?', 'Sí, tiene nivel de descongelado.'], ['¿Qué garantía tiene?', '1 año con la tienda.']],
    cta: ['Tu cocina más rápida desde hoy', 'Pagas al recibir. Sin registrarte.'],
  },
  {
    key: 'cocina', merchant: 'comerciante@syncro.test', product: 'Cocina eléctrica 2 hornillas', dj: 56,
    hero: ['Cocina donde quieras con solo un enchufe', 'Dos hornillas con control de temperatura independiente. Perfecta para apartamentos y emergencias.'],
    benefits: [['Dos hornillas', 'Cocina dos cosas a la vez'], ['Temperatura regulable', 'Perilla independiente para cada una'], ['Portátil', 'Llévala a donde la necesites'], ['Calienta rápido', '2000 W en total'], ['Fácil de limpiar', 'Superficie lisa'], ['6 meses de garantía', 'Respaldo de la tienda']],
    steps: ['Conecta a 110 V', 'Ajusta la temperatura', 'Cocina como siempre'],
    stepTexts: ['Usa un tomacorriente propio, sin extensiones.', 'Mínimo para calentar, máximo para freír.', 'Sirve para ollas y sartenes de base plana.'],
    imageText: ['Ideal cuando falla el gas', 'Una solución práctica para no dejar de cocinar. También es perfecta para residencias estudiantiles y casas de playa.'],
    testimonials: [['Pedro G.', 'Nos salvó cuando no había gas. Calienta muy rápido.', 5], ['Daniela V.', 'Buena calidad, las perillas se sienten firmes.', 4], ['Rafael L.', 'Llegó bien empacada y funcionando.', 5]],
    faq: [['¿Qué ollas sirven?', 'Cualquier olla o sartén de base plana.'], ['¿Se puede usar con planta eléctrica?', 'Sí, si la planta soporta al menos 2000 W.'], ['¿Tiene garantía?', '6 meses con la tienda.']],
    cta: ['No dejes de cocinar', 'Paga al recibir y recíbela hoy.'],
  },
  {
    key: 'coconoir', merchant: 'belleza@syncro.test', product: 'Chanel Coco Noir Eau de Parfum', dj: 7,
    hero: ['Elegancia que deja huella', 'Coco Noir: rosa, pachulí y sándalo en una fragancia intensa para la noche.'],
    benefits: [['100% original', 'Importado con su caja sellada'], ['Larga duración', 'Hasta 8 horas en la piel'], ['Notas de rosa y pachulí', 'Oriental floral sofisticado'], ['Ideal para la noche', 'Cenas, fiestas y ocasiones especiales'], ['Dos presentaciones', '50 ml y 100 ml'], ['Envuelto para regalo', 'Pídelo en las notas del pedido']],
    steps: ['Aplica en puntos de pulso', 'No frotes la piel', 'Repite en la ropa si quieres'],
    stepTexts: ['Muñecas, cuello y detrás de las orejas.', 'Deja que se seque solo para que dure más.', 'Un toque en la bufanda prolonga el aroma.'],
    imageText: ['Una fragancia para recordar', 'Abre con bergamota y pomelo, se asienta en un corazón de rosa y jazmín y termina en un fondo cálido de pachulí, sándalo y vainilla.'],
    testimonials: [['Isabel U.', 'Es original, se nota en la duración. Me encanta.', 5], ['Mariana D.', 'Lo compré para regalo y llegó perfecto.', 5], ['Fernanda P.', 'El aroma es intenso, ideal para la noche.', 4]],
    faq: [['¿Es original?', 'Sí. Todos nuestros perfumes son originales y vienen en su caja sellada.'], ['¿Cuánto dura en la piel?', 'Entre 6 y 8 horas, según el tipo de piel.'], ['¿Lo envuelven para regalo?', 'Sí, escríbelo en las notas del pedido.']],
    cta: ['Regálate algo especial', 'Original, sellado y con pago al recibir.'],
  },
  {
    key: 'jadore', merchant: 'belleza@syncro.test', product: "Dior J'adore", dj: 8,
    hero: ["J'adore, el clásico floral de Dior", 'Luminoso y femenino: ylang-ylang, rosa de Damasco y jazmín.'],
    benefits: [['100% original', 'Caja sellada'], ['Floral luminoso', 'Perfecto para el día'], ['Larga duración', 'Hasta 7 horas'], ['Dos presentaciones', '50 ml y 100 ml'], ['Un clásico', 'Uno de los más vendidos del mundo'], ['Ideal para regalar', 'Envoltura disponible']],
    steps: ['Aplica después de la ducha', 'En puntos de pulso', 'Disfruta todo el día'],
    stepTexts: ['La piel hidratada retiene mejor el aroma.', 'Muñecas y cuello.', 'Su estela floral te acompaña desde temprano.'],
    imageText: ['Feminidad en cada gota', 'Un bouquet floral que combina la frescura del ylang-ylang con la elegancia de la rosa y el jazmín.'],
    testimonials: [['Paola R.', 'Mi perfume favorito y aquí lo conseguí original.', 5], ['Camila B.', 'Delicado y duradero.', 5], ['Rosa M.', 'Buen precio comparado con otras tiendas.', 4]],
    faq: [['¿Es original?', 'Sí, con caja sellada.'], ['¿Para qué ocasión es?', 'Ideal para el día y la oficina.'], ['¿Hacen delivery?', 'Sí, en Mérida. También puedes retirar en tienda.']],
    cta: ['Tu aroma de todos los días', 'Pagas al recibir.'],
  },
  {
    key: 'mascara', merchant: 'belleza@syncro.test', product: 'Máscara de pestañas Lash Princess', dj: 1,
    hero: ['Pestañas de impacto sin grumos', 'Volumen y largo desde la primera capa.'],
    benefits: [['Volumen y largo', 'Efecto pestañas postizas'], ['Sin grumos', 'Cepillo cónico de fibras'], ['Larga duración', 'No se corre en todo el día'], ['Fácil de retirar', 'Con agua tibia y desmaquillante'], ['Apta para ojos sensibles', 'Probada dermatológicamente'], ['Precio accesible', 'Calidad de marca']],
    steps: ['Riza tus pestañas', 'Aplica de la raíz a las puntas', 'Una segunda capa para más volumen'],
    stepTexts: ['Con el rizador, antes de la máscara.', 'Movimientos en zigzag.', 'Espera 30 segundos entre capas.'],
    imageText: ['La favorita de nuestras clientas', 'Su cepillo cónico separa y define cada pestaña, logrando un acabado natural o dramático según las capas.'],
    testimonials: [['Valeria S.', 'No hace grumos y dura todo el día.', 5], ['Gabriela F.', 'Excelente por su precio.', 4], ['Daniela O.', 'Ya voy por la tercera.', 5]],
    faq: [['¿Es resistente al agua?', 'Resiste la humedad del día, pero no es a prueba de agua.'], ['¿Cómo se retira?', 'Con desmaquillante de ojos o agua tibia.'], ['¿Es apta para lentes de contacto?', 'Sí.']],
    cta: ['Mirada de impacto hoy mismo', 'Pagas al recibir.'],
  },
];

async function seedLandings() {
  const spec = [];
  for (const l of LANDINGS) {
    const data = await (await fetch(`https://dummyjson.com/products/${l.dj}?select=images`)).json();
    l.images = data.images;
    spec.push({ key: l.key, images: data.images.slice(0, 4), steps: l.steps });
  }
  console.log('🎞️  Generando GIFs ilustrativos...');
  const gen = spawnSync('python3', [`${HERE}make_gifs.py`, OUT], { input: JSON.stringify(spec), encoding: 'utf8', stdio: ['pipe', 'pipe', 'inherit'] });
  if (gen.status !== 0) throw new Error('No se pudieron generar los GIFs');
  const gifs = JSON.parse(gen.stdout);

  const tokens = {};
  for (const l of LANDINGS) {
    tokens[l.merchant] ??= (await (await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: l.merchant, password: PASSWORD }) })).json()).access_token;
    const token = tokens[l.merchant];
    const productId = sql(`select id from "Product" where name=${q(l.product)} limit 1`);
    const urls = { showcase: await upload(token, gifs[l.key].showcase) };
    for (let n = 1; n <= l.steps.length; n++) urls[`step${n}`] = await upload(token, gifs[l.key][`step${n}`]);

    const blocks = [
      { id: id(), type: 'hero', url: l.images[0], title: l.hero[0], text: l.hero[1], buttonLabel: 'Comprar ahora' },
      { id: id(), type: 'trust', items: TRUST },
      { id: id(), type: 'benefits', title: `¿Por qué elegir ${l.product.split(' ').slice(0, 2).join(' ')}?`, items: l.benefits.map(([title, text]) => ({ title, text })) },
      { id: id(), type: 'steps', title: 'Así de fácil se usa', items: l.steps.map((title, i) => ({ title, text: l.stepTexts[i], url: urls[`step${i + 1}`] })) },
      { id: id(), type: 'imageText', url: urls.showcase, title: l.imageText[0], body: l.imageText[1], imageSide: 'right' },
      ...(l.images.length > 1 ? [{ id: id(), type: 'image', url: l.images[1], caption: 'Detalle del producto' }] : []),
      { id: id(), type: 'testimonials', title: 'Lo que dicen nuestros clientes', items: l.testimonials.map(([name, text, rating]) => ({ name, text, rating })) },
      { id: id(), type: 'faq', title: 'Preguntas frecuentes', items: l.faq.map(([question, answer]) => ({ question, answer })) },
      { id: id(), type: 'cta', title: l.cta[0], text: l.cta[1], buttonLabel: 'Lo quiero' },
    ];
    await api('PUT', `/products/${productId}`, token, { landingBlocks: blocks });
    console.log(`✓ Landing de "${l.product}" con ${blocks.length} bloques y ${l.steps.length + 1} GIFs`);
  }
}

// ── Reviews ──────────────────────────────────────────────────────────────────
const BUYERS = [
  'María Rodríguez', 'Carlos Mendoza', 'José Contreras', 'Luisa Fernández', 'Pedro Ramírez', 'Gabriela Sánchez', 'Andrés Molina',
  'Valentina Rojas', 'Daniel Chacón', 'Sofía Pernía', 'Isabel Uzcátegui', 'Mariana Dávila', 'Fernanda Paredes', 'Paola Rivas',
  'Camila Briceño', 'Ricardo Duque', 'Yohana Colmenares', 'Héctor Zambrano',
];
const COMMENTS = {
  general5: ['Excelente, tal como en la foto.', 'Llegó rápido y en perfecto estado. Recomendado.', 'Muy buena calidad por el precio.', 'Súper atentos por WhatsApp, volveré a comprar.', 'Todo perfecto, pagué al recibir sin problema.', 'Cumple con lo que promete.'],
  general4: ['Buen producto, el delivery tardó un poco más de lo esperado.', 'Muy bien, aunque el empaque podría ser mejor.', 'Buena compra, lo recomiendo.', 'Bueno, cumple su función.'],
  general3: ['Está bien, pero esperaba un poco más.', 'Regular, aunque la atención fue buena.'],
  general2: ['No me convenció del todo, pero me ayudaron a cambiarlo.'],
  frescos: ['Muy frescos, se nota la calidad.', 'Llegaron en buen estado y bien empacados.', 'Frescos y a buen precio.'],
  cocina: ['Funciona perfecto, muy práctico.', 'Excelente para la cocina de todos los días.', 'Buena calidad, se siente resistente.'],
  belleza: ['Original, se nota en la duración.', 'Me encantó, ya lo pedí de nuevo.', 'Llegó sellado y a tiempo.', 'Huele increíble.'],
};
const weightedRating = () => pick([5, 5, 5, 5, 5, 4, 4, 4, 3, 2]);

function seedReviews() {
  const bcrypt = require('../../node_modules/bcrypt');
  const hash = bcrypt.hashSync('Cliente2026!', 10);
  const customerIds = BUYERS.map((name) => {
    const email = name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '.') + '@cliente.test';
    return sql(`insert into "ShopCustomer"(id,email,name,phone,"passwordHash") values (${q(randomUUID())}, ${q(email)}, ${q(name)}, ${q('0414' + rand(1000000, 9999999))}, ${q(hash)})
      on conflict (email) do update set name = excluded.name returning id;`);
  });

  const products = sql(`select p.id || '|' || coalesce(c.name,'') from "Product" p left join "Category" c on c.id=p."categoryId"
    where p."isPublishedOnSyncroShop" and p."businessId" in (select id from "Business" where name in ('Mercado La Esquina','Belleza Natural'))`).split('\n').filter(Boolean);
  const statements = [];
  for (const row of products) {
    const [productId, category] = row.split('|');
    // Re-runs keep existing reviews instead of piling up new ones
    if (Number(sql(`select count(*) from "ProductReview" where "productId"=${q(productId)}`)) >= 3) continue;
    const pool = /Frescos|Víveres|Bebidas/.test(category) ? COMMENTS.frescos : /Cocina|Hogar/.test(category) ? COMMENTS.cocina : /Perfume|Maquillaje|piel/i.test(category) ? COMMENTS.belleza : [];
    const reviewers = [...customerIds].sort(() => Math.random() - 0.5).slice(0, rand(3, 9));
    for (const customerId of reviewers) {
      const rating = weightedRating();
      const comment = Math.random() < 0.15 ? null : rating >= 5 ? pick([...COMMENTS.general5, ...pool]) : rating === 4 ? pick([...COMMENTS.general4, ...pool]) : rating === 3 ? pick(COMMENTS.general3) : pick(COMMENTS.general2);
      const days = rand(1, 40);
      statements.push(`insert into "ProductReview"(id,"productId","customerId",rating,comment,"isVerifiedPurchase","createdAt","updatedAt")
        values (${q(randomUUID())}, ${q(productId)}, ${q(customerId)}, ${rating}, ${q(comment)}, ${Math.random() < 0.6}, now() - interval '${days} days', now() - interval '${days} days')
        on conflict ("productId","customerId") do nothing;`);
    }
  }
  sql(statements.join('\n'));
  console.log(`✓ ${customerIds.length} compradores de prueba y reseñas para ${products.length} productos (total en la base: ${sql('select count(*) from "ProductReview"')})`);
}

await seedLandings();
seedReviews();
console.log('\n✅ Contenido de demostración listo. Compradores: <nombre.apellido>@cliente.test / Cliente2026!');
