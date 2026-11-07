/**
 * The automatic notifications. Syncro central can switch each one off and change its text;
 * these are the starting texts. {variables} are filled per person.
 */
export type AutomationDef = {
  key: string;
  label: string;
  when: string;
  title: string;
  body: string;
  url: string | null;
  /** Variables this text can use */
  vars: string[];
  /** The text comes from the event itself (only the switch is editable) */
  fixedText?: boolean;
};

export const AUTOMATIONS: AutomationDef[] = [
  {
    key: 'welcome_business',
    label: 'Bienvenida a un comercio nuevo',
    when: 'Cuando alguien crea su cuenta en Syncro. Si aún no ha activado las notificaciones, le llega apenas las active.',
    title: '¡Bienvenido a Syncro, {nombre}! 🎉',
    body: '{negocio} ya está listo. Empieza cargando tus productos y haz tu primera venta.',
    url: '/dashboard',
    vars: ['nombre', 'negocio'],
  },
  {
    key: 'welcome_member',
    label: 'Bienvenida a un empleado nuevo',
    when: 'Cuando un comercio agrega a una persona de su equipo.',
    title: '¡Bienvenido al equipo de {negocio}!',
    body: 'Hola {nombre}, ya tienes acceso a Syncro. Si necesitas ayuda, escríbenos desde el chat de soporte.',
    url: '/dashboard',
    vars: ['nombre', 'negocio'],
  },
  {
    key: 'request_update',
    label: 'Avance de una solicitud',
    when: 'Cuando Syncro cambia el estado de una solicitud de módulo o función (le llega al dueño).',
    title: 'Tu solicitud avanzó',
    body: '«{solicitud}» ahora está: {estado}.',
    url: '/dashboard/tienda',
    vars: ['nombre', 'negocio', 'solicitud', 'estado'],
  },
  {
    key: 'payment_reminder',
    label: 'Recordatorio de pago',
    when: 'Tres días antes de que venza la suscripción, a las 9:00 a. m. (le llega al dueño, una vez por vencimiento).',
    title: 'Tu plan de Syncro vence {cuando}',
    body: 'Hola {nombre}, la suscripción de {negocio} vence el {fecha}. Renueva para no perder el acceso.',
    url: '/dashboard/facturacion',
    vars: ['nombre', 'negocio', 'cuando', 'fecha'],
  },
  {
    key: 'support_message',
    label: 'Mensaje de soporte',
    when: 'Cuando el equipo de Syncro responde por el chat de soporte (y al revés).',
    title: '💬 Equipo Syncro',
    body: 'El texto del mensaje.',
    url: '/dashboard/soporte',
    vars: [],
    fixedText: true,
  },
];

export const AUTOMATION = Object.fromEntries(AUTOMATIONS.map((a) => [a.key, a])) as Record<string, AutomationDef>;

/** Fills {variables}; unknown ones are left out cleanly. */
export function fill(text: string, vars: Record<string, string | undefined | null>) {
  return text
    .replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''))
    .replace(/\s+([,.!?])/g, '$1')
    .replace(/,([!?.])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export const firstName = (name?: string | null) => (name ?? '').trim().split(/\s+/)[0] || '';
