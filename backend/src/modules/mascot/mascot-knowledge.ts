import { MODULE_CATALOG } from '../business-modules/catalog';

/**
 * What Nubi the mascot knows about the software itself: every screen, what it's for and where it
 * is. It is part of the mascot's prompt, so it can point the merchant to the right place.
 * Keep it in sync when screens are added or renamed.
 */
const BASE = `
SYNCRO POS — lo que tiene el software (menú de la izquierda):
- Dashboard (/dashboard): ingresos, ventas, clientes y stock del día; meta de ventas del mes; margen y ganancia neta; tendencia de ventas (7, 30, 90 días).
- Punto de venta (/pos): vender con lector o búsqueda, varias monedas (USD, Bs con tasa BCV), métodos de pago, descuentos, clientes, abrir y cerrar caja (turnos).
- Productos (/dashboard/productos): crear productos y variantes, precios, costos, categorías, códigos de barra, fotos.
- Inventario (/dashboard/inventario): existencias por sucursal, stock mínimo, ajustes, transferencias entre sucursales, alertas de stock bajo.
- Proveedores (/dashboard/proveedores): proveedores, órdenes de compra, pagos y devoluciones a proveedores.
- Reportes (/dashboard/reportes): ventas por día, producto, categoría, cajero y método de pago; exportar.
- Clientes (/dashboard/clientes): base de clientes, historial de compras, cuentas por cobrar.
- Contabilidad (/dashboard/contabilidad): ingresos y egresos (gastos por categoría), flujo de caja, cierres.
- Historial (/dashboard/historial): todas las ventas y movimientos, con anulaciones.
- Delivery: próximamente.
- Botón flotante "Ingreso · Egreso": registrar rápido un ingreso o un gasto desde cualquier pantalla.
- Configuración (/dashboard/configuracion): negocio, facturación e IVA, diseño de factura, métodos de pago, punto de venta, usuarios y roles, sucursales, sesión y seguridad, WhatsApp, y la sección Mascota (para personalizarme o esconderme).
- Tienda de módulos (/dashboard/tienda): módulos empaquetados para cada tipo de negocio; pedir uno o pedir un módulo a la medida.
- "¿Te falta algo? Pídelo" (en el menú): pedirle a Syncro una función nueva.
- Soporte (/dashboard/soporte) y el chat flotante: hablar con el Equipo Syncro (personas), mandar fotos, asistencia en vivo en pantalla.
- Syncro IA: el asistente que puede registrar gastos, crear órdenes de compra, etc.
`.trim();

export function softwareKnowledge(activeModules: Set<string>) {
  const modules = MODULE_CATALOG.map((m) => {
    const on = activeModules.has(m.code);
    const features = m.features.filter((f) => !f.custom).map((f) => `${f.label}${f.route ? ` (${f.route})` : ''}`).join('; ');
    return `- ${m.name}: ${on ? 'ACTIVO en este negocio' : 'no lo tiene (se puede pedir en la Tienda de módulos)'}. ${m.summary}${on && features ? ` Partes: ${features}.` : ''}`;
  }).join('\n');
  return `${BASE}\n\nMÓDULOS EMPAQUETADOS:\n${modules}`;
}
