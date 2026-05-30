/**
 * Syncro POS AI Agent — Knowledge Base Seeder
 *
 * Run with:  ts-node prisma/seed-knowledge.ts
 *
 * Seeds the KnowledgeChunk table with financial and operational knowledge
 * about cash register closing procedures, accounting entries, and Syncro POS
 * specific workflows in the Venezuelan business context.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const KNOWLEDGE_CHUNKS = [
  // ── Cuadre de Caja ─────────────────────────────────────────────────────────
  {
    topic: 'cuadre_caja',
    content: `El cuadre de caja (también llamado arqueo de caja) es el proceso de verificar que el dinero físico en la caja coincida con lo que el sistema registró como ventas. 
    
El cuadre implica comparar:
1. Efectivo esperado = Fondo inicial de apertura + Total de ventas en efectivo durante el turno
2. Efectivo real = Lo que físicamente cuentas en billetes y monedas

Si el efectivo real es MAYOR que el esperado → hay un SOBRANTE (posible error a favor)
Si el efectivo real es MENOR que el esperado → hay un FALTANTE (error a investigar)

Un faltante o sobrante menor a $2-3 es considerado normal por vueltos aproximados.`,
  },
  {
    topic: 'cuadre_caja',
    content: `Pasos para hacer el cuadre de caja en Syncro POS:
1. Ve a "Punto de Venta" en el menú lateral
2. Haz clic en el botón "Cerrar Caja" (aparece en la parte superior)
3. Se abrirá el modal "Arqueo de Caja Detallado"
4. El sistema ya muestra el "Efectivo USD Esperado" calculado automáticamente
5. Cuenta físicamente los billetes que tienes y llena cada campo:
   - Billetes de $1, $5, $10, $20, $50, $100
   - Efectivo Bs (bolívares)
   - Lote Punto de Venta (total del lote de la máquina)
   - Total Pago Móvil (confirmaciones de Pago Móvil)
6. El sistema calcula automáticamente el "Efectivo Contado (USD eq)"
7. Haz clic en "Confirmar Arqueo y Cerrar Caja"`,
  },
  {
    topic: 'sobrante_faltante',
    content: `¿Qué hacer con sobrantes y faltantes?

SOBRANTE (tienes más dinero del esperado):
- Puede ser por propinas no registradas
- Error en vuelto (devolviste menos)
- Ingreso no registrado en el sistema
- Acción: Registrarlo como ingreso en Contabilidad → "Sobrante de caja"

FALTANTE (tienes menos dinero del esperado):
- Puede ser por vueltos redondeados
- Error al entregar cambio (diste de más)
- Dinero retirado sin registrar
- Acción: Si es pequeño (<$2), es normal. Si es grande, investigar y registrar como egreso → "Faltante de caja"

Syncro POS registra automáticamente la diferencia al cerrar el turno.`,
  },

  // ── Apertura y Cierre de Turno ─────────────────────────────────────────────
  {
    topic: 'apertura_turno',
    content: `Para abrir un turno (inicio de caja) en Syncro POS:
1. Ve a "Punto de Venta"
2. Si no hay turno abierto, verás el botón "Abrir Turno"
3. Ingresa el "Fondo de Caja Inicial" (el dinero con que empieza la caja, ej: $50)
4. Haz clic en "Confirmar Apertura"

El fondo inicial es el dinero que pones en la caja para poder dar cambio durante el día. Generalmente es entre $30 y $100 dependiendo del volumen de ventas esperado.`,
  },
  {
    topic: 'cierre_turno',
    content: `Pasos completos para el cierre de turno en Syncro POS:

ANTES de cerrar:
- Asegúrate de haber registrado TODAS las ventas del día
- Verifica que los pagos con Pago Móvil estén confirmados en el banco
- Obtén el lote de la máquina de punto (si usas tarjeta)

DURANTE el cierre:
1. Punto de Venta → "Cerrar Caja"
2. Completa el Arqueo de Caja Detallado
3. Haz clic en "Confirmar Arqueo y Cerrar Caja"

DESPUÉS del cierre:
- El sistema genera el reporte del turno automáticamente
- Puedes ver el turno cerrado en el historial de Reportes
- Registra cualquier diferencia (sobrante/faltante) en Contabilidad`,
  },

  // ── Registro de Ingresos y Egresos ─────────────────────────────────────────
  {
    topic: 'registro_egreso',
    content: `Para registrar un egreso (gasto) en Syncro POS:
1. Ve a "Contabilidad" en el menú lateral
2. Haz clic en el botón "Nuevo Registro" (botón verde arriba a la derecha)
3. Completa el formulario:
   - Descripción/Concepto: describe el gasto claramente (ej: "Alquiler Abril", "Compra de bolsas")
   - Tipo: selecciona "Egreso (-)"
   - Monto: ingresa el monto en USD
   - Categoría: selecciona la categoría apropiada
4. Haz clic en "Registrar Movimiento"

Categorías de egresos disponibles:
- Gasto Operativo (alquiler, servicios, etc.)
- Compra Inventario (cuando no usas órdenes de compra)
- Pago Nómina (salarios)
- Otro Egreso`,
  },
  {
    topic: 'registro_ingreso',
    content: `Para registrar un ingreso manual en Syncro POS (distinto de las ventas):
1. Ve a "Contabilidad" en el menú lateral
2. Haz clic en "Nuevo Registro"
3. Completa el formulario:
   - Descripción: describe el ingreso (ej: "Anticipo de cliente", "Sobrante de caja")
   - Tipo: selecciona "Ingreso (+)"
   - Monto: ingresa el monto en USD
   - Categoría: "Ingreso Operativo" u "Otro Ingreso"
4. Haz clic en "Registrar Movimiento"

NOTA: Las ventas del Punto de Venta se registran automáticamente como ingresos. Solo usa este formulario para ingresos adicionales que no son ventas directas.`,
  },

  // ── Métodos de Pago Venezuela ───────────────────────────────────────────────
  {
    topic: 'metodos_pago_vzla',
    content: `Métodos de pago disponibles en Syncro POS para Venezuela:

1. CASH (Efectivo USD): Dólares americanos en billetes físicos
2. PAGO_MOVIL: Transferencias bancarias venezolanas (necesitas el banco, número de cédula/RIF y teléfono)
3. CARD (Punto de Venta): Máquina de tarjeta de débito/crédito
4. BINANCE: Pagos en criptomoneda (USDT principalmente)
5. TRANSFER: Transferencia bancaria directa
6. ZINLI: Pagos por aplicación Zinli
7. PAYPAL: Pagos por PayPal

El tipo de cambio (USD/Bs) se actualiza automáticamente desde el BCV o puede configurarse manualmente en Configuración.

Para el cuadre de caja, solo el efectivo USD y los Bs se cuentan físicamente. Pago Móvil y Punto se verifican por lote/confirmaciones bancarias.`,
  },
  {
    topic: 'metodos_pago_vzla',
    content: `Cómo contar y verificar cada método de pago al cierre:

EFECTIVO USD: Cuenta billetes físicamente y súmalos
- $1 × cantidad, $5 × cantidad, $10 × cantidad, etc.
- Ingresa la cantidad de billetes en cada campo del arqueo

EFECTIVO BS: Convierte al tipo de cambio del día
- Suma todos los Bs físicos y divídelos entre el tipo de cambio
- Syncro POS lo convierte automáticamente

PAGO MÓVIL: Verifica las confirmaciones en el banco
- Revisa el número de confirmaciones del día
- Ingresa el monto total de Pago Móvil en el campo "Total Pago Móvil"

PUNTO DE VENTA: Cierra el lote del día en la máquina
- La máquina imprime el "Lote" con el total de transacciones
- Ingresa ese total en "Lote Punto Venta"`,
  },

  // ── Balance Contable ────────────────────────────────────────────────────────
  {
    topic: 'balance_contable',
    content: `Cómo interpretar el módulo de Contabilidad en Syncro POS:

BALANCE = Total Ingresos - Total Egresos

Si el balance es POSITIVO: el negocio tiene más entradas que salidas ✅
Si el balance es NEGATIVO: los gastos superan los ingresos ⚠️

Tipos de registros en Contabilidad:
- INCOME (+): Ventas, ingresos varios, sobrantes de caja
- EXPENSE (-): Gastos operativos, compras, nómina, etc.

Las ventas del Punto de Venta se registran automáticamente como INCOME.
Solo necesitas registrar manualmente los gastos y los ingresos no-ventas.

Para ver estadísticas avanzadas: Contabilidad → sección de gráficas → selecciona rango de fechas.`,
  },

  // ── Cierre mensual ──────────────────────────────────────────────────────────
  {
    topic: 'cierre_mensual',
    content: `Proceso de cierre mensual de caja recomendado en Syncro POS:

1. AL FINAL DEL MES, antes de la última venta:
   - Asegúrate que todos los turnos del mes estén cerrados
   - Verifica que todos los gastos del mes estén registrados en Contabilidad

2. REPORTE DEL MES:
   - Ve a Reportes → selecciona el mes completo
   - Descarga el resumen de ventas por método de pago
   - Verifica que el total de ventas coincide con lo depositado en banco

3. GASTOS DEL MES:
   - Revisa todos los egresos en Contabilidad del mes
   - Verifica: alquiler, empleados, servicios, reposición de inventario

4. GANANCIA NETA:
   - Ganancia = Total ventas - Costo de mercancía - Gastos operativos
   - La puedes ver en Contabilidad → Estadísticas Avanzadas`,
  },

  // ── Conceptos financieros básicos ──────────────────────────────────────────
  {
    topic: 'conceptos_financieros',
    content: `Conceptos financieros básicos para administrar tu negocio:

FLUJO DE CAJA: El dinero que entra y sale del negocio cada día/semana/mes
- Flujo positivo = entró más de lo que salió (bueno ✅)
- Flujo negativo = salió más de lo que entró (requiere atención ⚠️)

MARGEN DE GANANCIA: Porcentaje de ganancia sobre el precio de venta
- Ej: Si vendes algo en $10 y te costó $6, tu margen es 40%
- Fórmula: (Precio - Costo) / Precio × 100

PUNTO DE EQUILIBRIO: Las ventas mínimas para cubrir todos los gastos
- Si tus gastos fijos son $500/mes y vendes a margen del 40%
- Necesitas vender al menos $1,250/mes para no perder

CAPITAL DE TRABAJO: El dinero disponible para operar el día a día
- Capital = Dinero en caja + Inventario - Deudas inmediatas`,
  },
];

async function main() {
  console.log('🌱 Seeding AI knowledge base...');

  // Clear existing chunks
  await prisma.knowledgeChunk.deleteMany();
  console.log('🗑️  Cleared existing knowledge chunks');

  // Insert all chunks
  let count = 0;
  for (const chunk of KNOWLEDGE_CHUNKS) {
    await prisma.knowledgeChunk.create({ data: chunk });
    count++;
    console.log(`✅ [${count}/${KNOWLEDGE_CHUNKS.length}] Seeded: ${chunk.topic}`);
  }

  console.log(`\n🎉 Knowledge base seeded successfully with ${count} chunks!`);
  console.log('💡 Tip: Run the backend to generate embeddings on first query');
}

main()
  .catch(e => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
