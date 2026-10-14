/**
 * Purchase form a merchant builds for Syncro Shop (StoreProfile.checkoutForm).
 *
 * The same shape is used by the POS builder (frontend/components/syncro-shop/checkout-form-builder.tsx)
 * and the storefront (syncro-shop/src/lib/checkout-form.ts). Keep the three in sync.
 */
export type BuiltinFieldKey =
  | 'name'
  | 'phone'
  | 'email'
  | 'address'
  | 'city'
  | 'reference'
  | 'notes';
export type CheckoutFieldType =
  | 'text'
  | 'tel'
  | 'email'
  | 'textarea'
  | 'number'
  | 'select'
  | 'checkbox'
  | 'yesno';

export type CheckoutField = {
  id: string;
  builtin?: BuiltinFieldKey;
  type: CheckoutFieldType;
  label: string;
  placeholder?: string;
  help?: string;
  enabled: boolean;
  required: boolean;
  options?: string[];
};

export type CheckoutFormConfig = {
  version: 1;
  /** "embedded": the form is shown on the product page. "modal": a button opens it. */
  mode: 'embedded' | 'modal';
  title: string;
  subtitle: string;
  buttonLabel: string;
  buttonColor: string | null;
  stickyMobileButton: boolean;
  submitLabel: string;
  showQuantity: boolean;
  showSummary: boolean;
  successMessage: string;
  whatsappAfterOrder: boolean;
  /** Attention-grabbing look of the buy buttons. */
  buttonAnimation: ButtonAnimation;
  buttonStyle: 'solid' | 'gradient';
  buttonSize: 'md' | 'lg';
  buttonIcon: 'zap' | 'cart' | 'bag' | 'none';
  /** Small line under the buy button, e.g. "Pagas al recibir · Envío hoy". */
  buttonSubtext: string;
  /** Highlighted line above the buy button, e.g. "¡Últimas unidades!". */
  urgencyText: string;
  fields: CheckoutField[];
};

export const BUTTON_ANIMATIONS = [
  'none',
  'pulse',
  'shake',
  'bounce',
  'shine',
  'glow',
  'wiggle',
] as const;
export type ButtonAnimation = (typeof BUTTON_ANIMATIONS)[number];

export const BUILTIN_FIELDS: Record<
  BuiltinFieldKey,
  Omit<CheckoutField, 'id' | 'builtin' | 'enabled' | 'required'>
> = {
  name: {
    type: 'text',
    label: 'Nombre y apellido',
    placeholder: 'Ej: María Rodríguez',
  },
  phone: {
    type: 'tel',
    label: 'Teléfono (WhatsApp)',
    placeholder: 'Ej: 0414 123 4567',
  },
  email: {
    type: 'email',
    label: 'Correo electrónico',
    placeholder: 'tucorreo@ejemplo.com',
  },
  address: {
    type: 'textarea',
    label: 'Dirección de entrega',
    placeholder: 'Calle, casa o edificio, apartamento',
  },
  city: {
    type: 'text',
    label: 'Ciudad o sector',
    placeholder: 'Ej: San Cristóbal, Barrio Obrero',
  },
  reference: {
    type: 'text',
    label: 'Punto de referencia',
    placeholder: 'Ej: frente a la panadería',
  },
  notes: {
    type: 'textarea',
    label: 'Notas para el vendedor',
    placeholder: 'Algo que debamos saber',
  },
};

/** Always on and required: without them the merchant cannot contact the buyer. */
export const LOCKED_FIELDS: BuiltinFieldKey[] = ['name', 'phone'];

const BUILTIN_ORDER: BuiltinFieldKey[] = [
  'name',
  'phone',
  'email',
  'address',
  'city',
  'reference',
  'notes',
];
const DEFAULT_ENABLED: Record<BuiltinFieldKey, [boolean, boolean]> = {
  name: [true, true],
  phone: [true, true],
  email: [false, false],
  address: [true, false],
  city: [true, false],
  reference: [true, false],
  notes: [true, false],
};

export const MAX_CUSTOM_FIELDS = 15;

export function defaultCheckoutForm(): CheckoutFormConfig {
  return {
    version: 1,
    mode: 'embedded',
    title: 'Completa tu pedido',
    subtitle: 'Pagas al recibir. Te contactamos por WhatsApp para confirmar.',
    buttonLabel: 'Comprar ahora',
    buttonColor: null,
    stickyMobileButton: true,
    submitLabel: 'Confirmar pedido',
    showQuantity: true,
    showSummary: true,
    successMessage:
      '¡Gracias! Recibimos tu pedido. Te escribiremos por WhatsApp para confirmar la entrega.',
    whatsappAfterOrder: true,
    buttonAnimation: 'pulse',
    buttonStyle: 'solid',
    buttonSize: 'lg',
    buttonIcon: 'zap',
    buttonSubtext: 'Pagas al recibir · Sin registrarte',
    urgencyText: '',
    fields: BUILTIN_ORDER.map((key) => ({
      id: key,
      builtin: key,
      ...BUILTIN_FIELDS[key],
      enabled: DEFAULT_ENABLED[key][0],
      required: DEFAULT_ENABLED[key][1],
    })),
  };
}

const str = (v: unknown, max: number, fallback = '') =>
  typeof v === 'string' ? v.trim().slice(0, max) : fallback;

/** Merges a stored (possibly old or partial) config with the defaults and enforces the rules. */
export function normalizeCheckoutForm(value: unknown): CheckoutFormConfig {
  const base = defaultCheckoutForm();
  if (!value || typeof value !== 'object') return base;
  const raw = value as Record<string, any>;

  const fields: CheckoutField[] = [];
  const seen = new Set<string>();
  const incoming: any[] = Array.isArray(raw.fields) ? raw.fields : [];

  for (const f of incoming) {
    if (
      !f ||
      typeof f !== 'object' ||
      typeof f.id !== 'string' ||
      seen.has(f.id)
    )
      continue;
    if (f.builtin && BUILTIN_ORDER.includes(f.builtin)) {
      const key = f.builtin as BuiltinFieldKey;
      const locked = LOCKED_FIELDS.includes(key);
      fields.push({
        id: key,
        builtin: key,
        type: BUILTIN_FIELDS[key].type,
        label: str(f.label, 80) || BUILTIN_FIELDS[key].label,
        placeholder: str(f.placeholder, 120, BUILTIN_FIELDS[key].placeholder),
        help: str(f.help, 200),
        enabled: locked ? true : Boolean(f.enabled),
        required: locked ? true : Boolean(f.enabled) && Boolean(f.required),
      });
      seen.add(key);
    } else if (
      !f.builtin &&
      fields.filter((x) => !x.builtin).length < MAX_CUSTOM_FIELDS
    ) {
      const type: CheckoutFieldType = [
        'text',
        'textarea',
        'number',
        'select',
        'checkbox',
        'yesno',
      ].includes(f.type)
        ? f.type
        : 'text';
      const label = str(f.label, 80);
      if (!label) continue;
      const options =
        type === 'select'
          ? (Array.isArray(f.options) ? f.options : [])
              .map((o: unknown) => str(o, 60))
              .filter(Boolean)
              .slice(0, 20)
          : undefined;
      if (type === 'select' && (!options || options.length === 0)) continue;
      const id = /^cf_[a-z0-9_]{1,40}$/i.test(f.id)
        ? f.id
        : `cf_${Math.random().toString(36).slice(2, 10)}`;
      fields.push({
        id,
        type,
        label,
        placeholder: str(f.placeholder, 120),
        help: str(f.help, 200),
        enabled: Boolean(f.enabled),
        required: Boolean(f.enabled) && Boolean(f.required),
        options,
      });
      seen.add(id);
    }
  }
  // Built-in fields missing from an older config keep their defaults, in their usual place.
  for (const def of base.fields) {
    if (!seen.has(def.id))
      fields.splice(
        Math.min(BUILTIN_ORDER.indexOf(def.builtin!), fields.length),
        0,
        def,
      );
  }

  return {
    version: 1,
    mode: raw.mode === 'modal' ? 'modal' : 'embedded',
    title: str(raw.title, 80) || base.title,
    subtitle: str(raw.subtitle, 200, base.subtitle),
    buttonLabel: str(raw.buttonLabel, 40) || base.buttonLabel,
    buttonColor:
      typeof raw.buttonColor === 'string' &&
      /^#[0-9a-f]{6}$/i.test(raw.buttonColor)
        ? raw.buttonColor
        : null,
    stickyMobileButton:
      raw.stickyMobileButton === undefined
        ? base.stickyMobileButton
        : Boolean(raw.stickyMobileButton),
    submitLabel: str(raw.submitLabel, 40) || base.submitLabel,
    showQuantity:
      raw.showQuantity === undefined
        ? base.showQuantity
        : Boolean(raw.showQuantity),
    showSummary:
      raw.showSummary === undefined
        ? base.showSummary
        : Boolean(raw.showSummary),
    successMessage: str(raw.successMessage, 300) || base.successMessage,
    whatsappAfterOrder:
      raw.whatsappAfterOrder === undefined
        ? base.whatsappAfterOrder
        : Boolean(raw.whatsappAfterOrder),
    buttonAnimation: (BUTTON_ANIMATIONS as readonly string[]).includes(
      raw.buttonAnimation,
    )
      ? (raw.buttonAnimation as ButtonAnimation)
      : base.buttonAnimation,
    buttonStyle: raw.buttonStyle === 'gradient' ? 'gradient' : 'solid',
    buttonSize: raw.buttonSize === 'md' ? 'md' : 'lg',
    buttonIcon: ['zap', 'cart', 'bag', 'none'].includes(raw.buttonIcon)
      ? raw.buttonIcon
      : base.buttonIcon,
    buttonSubtext: str(raw.buttonSubtext, 60, base.buttonSubtext),
    urgencyText: str(raw.urgencyText, 80),
    fields,
  };
}
