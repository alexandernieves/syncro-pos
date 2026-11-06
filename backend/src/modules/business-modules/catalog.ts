/**
 * Packaged modules Syncro offers on top of the base (POS, products, inventory…).
 *
 * One codebase per module, switched per business: every part of a module is a feature with
 * a key. A feature built for a single business is listed here with `custom: true`,
 * `builtFor: '<businessId>'` and, once that business agrees, `shareAuthorized: true`. It stays off
 * for everyone else; Syncro central can turn it on elsewhere only when it's authorized.
 *
 * Example:
 *   { key: 'gym.lockers', label: 'Casilleros', route: '/dashboard/gimnasio/casilleros', default: false,
 *     custom: true, builtFor: '<id de Ebano>', shareAuthorized: false }
 */
export type CatalogFeature = {
  key: string;
  label: string;
  description?: string;
  /** Sidebar route it unlocks inside the module's workspace */
  route?: string;
  /** On when the module is activated */
  default: boolean;
  /** Built for one business; never on by default */
  custom?: boolean;
  /** Business that asked for it (custom features) */
  builtFor?: string;
  /**
   * That business authorized offering it to others. Without it, the feature can only be
   * turned on for the business it was built for.
   */
  shareAuthorized?: boolean;
};

export type CatalogModule = {
  code: string;
  name: string;
  /** Business type it was made for */
  trade: string;
  summary: string;
  highlights: string[];
  features: CatalogFeature[];
};

export const MODULE_CATALOG: CatalogModule[] = [
  {
    code: 'gym',
    name: 'Gimnasio',
    trade: 'Gimnasios y centros deportivos',
    summary: 'Socios, membresías, control de acceso con lector de rostro, clases, prospectos y personal.',
    highlights: [
      'Membresías con cobro, abonos y congelamientos',
      'Entrada por rostro con lector Hikvision',
      'Clases con reservas y lista de espera',
      'Prospectos con clase de prueba',
      'Recordatorios por WhatsApp',
      'App para los socios',
    ],
    features: [
      { key: 'gym.reception', label: 'Recepción', route: '/dashboard/gimnasio/recepcion', default: true },
      { key: 'gym.access', label: 'Control de acceso', description: 'Lector de rostro en la puerta', route: '/dashboard/gimnasio/acceso', default: true },
      { key: 'gym.members', label: 'Socios', route: '/dashboard/gimnasio/socios', default: true },
      { key: 'gym.classes', label: 'Clases', route: '/dashboard/gimnasio/clases', default: true },
      { key: 'gym.leads', label: 'Prospectos', route: '/dashboard/gimnasio/prospectos', default: true },
      { key: 'gym.staff', label: 'Personal', description: 'Entrenadores, turnos y disponibilidad', route: '/dashboard/gimnasio/personal', default: true },
      { key: 'gym.training', label: 'Entrenamiento', description: 'Rutinas, ejercicios y evaluaciones', route: '/dashboard/gimnasio/entrenamiento', default: true },
      { key: 'gym.equipment', label: 'Equipos', description: 'Inventario y mantenimiento de máquinas', route: '/dashboard/gimnasio/equipos', default: true },
      { key: 'gym.plans', label: 'Planes y membresías', route: '/dashboard/gimnasio/planes', default: true },
      { key: 'gym.reports', label: 'Reportes', route: '/dashboard/gimnasio/reportes', default: true },
      { key: 'gym.reminders', label: 'Recordatorios', description: 'Avisos de vencimiento por WhatsApp', route: '/dashboard/gimnasio/recordatorios', default: true },
    ],
  },
];

export const catalogModule = (code: string) => MODULE_CATALOG.find((m) => m.code === code);
export const CATALOG_CODES = MODULE_CATALOG.map((m) => m.code);

/** Statuses of a module for one business */
export const MODULE_STATUSES = ['REQUESTED', 'IN_REVIEW', 'BUILDING', 'READY', 'TRIAL', 'ACTIVE', 'PAUSED', 'REJECTED'] as const;
export type ModuleStatus = (typeof MODULE_STATUSES)[number];
/** The business can use the module in these statuses */
export const USABLE_STATUSES: ModuleStatus[] = ['TRIAL', 'ACTIVE'];
export const TRIAL_DAYS = 15;
