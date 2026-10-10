/**
 * Invoice design saved in settings.invoiceDesign. One design drives every copy of the
 * invoice: the printed ticket, the animated ticket in the POS and the digital copy.
 */

export type InvoiceTemplateId = "classic" | "modern" | "minimal" | "fiscal" | "letter";
export type InvoicePaper = "80" | "58" | "a4";
export type InvoiceFont = "mono" | "sans" | "serif";
export type InvoiceSectionId = "header" | "documentInfo" | "client" | "items" | "totals" | "payments" | "qr" | "barcode" | "footer";
export type InvoiceQrType = "none" | "pagomovil" | "instagram" | "website" | "custom";

export type InvoiceDesign = {
  templateId: InvoiceTemplateId;
  paper: InvoicePaper;
  font: InvoiceFont;
  accentColor: string;
  /** Title printed on the document, e.g. "Nota de entrega". */
  documentTitle: string;
  logoUrl: string | null;
  logoSize: "sm" | "md" | "lg";
  /** Empty fields use the data from Configuración → Negocio. */
  business: {
    name: string;
    rif: string;
    address: string;
    phone: string;
    email: string;
    website: string;
    instagram: string;
    slogan: string;
  };
  show: {
    rif: boolean;
    address: boolean;
    phone: boolean;
    email: boolean;
    website: boolean;
    instagram: boolean;
    slogan: boolean;
    cashier: boolean;
    clientDocument: boolean;
    clientPhone: boolean;
    itemCode: boolean;
    unitPrice: boolean;
    itemDiscount: boolean;
    taxBreakdown: boolean;
    bsTotals: boolean;
    exchangeRate: boolean;
    change: boolean;
    nonFiscalNote: boolean;
  };
  /** Order of the sections; the ones in `hidden` are skipped. */
  sections: InvoiceSectionId[];
  hidden: InvoiceSectionId[];
  qr: { type: InvoiceQrType; value: string; label: string };
  footerText: string;
};

export const SECTION_LABELS: Record<InvoiceSectionId, string> = {
  header: "Encabezado del negocio",
  documentInfo: "Número, fecha y cajero",
  client: "Datos del cliente",
  items: "Productos",
  totals: "Totales",
  payments: "Métodos de pago",
  qr: "Código QR",
  barcode: "Código de barras",
  footer: "Mensaje final",
};

export const DEFAULT_SECTIONS: InvoiceSectionId[] = ["header", "documentInfo", "client", "items", "totals", "payments", "qr", "barcode", "footer"];

const BASE_DESIGN: InvoiceDesign = {
  templateId: "classic",
  paper: "80",
  font: "mono",
  accentColor: "#E4572E",
  documentTitle: "Nota de entrega",
  logoUrl: null,
  logoSize: "md",
  business: { name: "", rif: "", address: "", phone: "", email: "", website: "", instagram: "", slogan: "" },
  show: {
    rif: true,
    address: true,
    phone: true,
    email: false,
    website: false,
    instagram: false,
    slogan: false,
    cashier: true,
    clientDocument: true,
    clientPhone: false,
    itemCode: false,
    unitPrice: true,
    itemDiscount: true,
    taxBreakdown: true,
    bsTotals: true,
    exchangeRate: true,
    change: true,
    nonFiscalNote: true,
  },
  sections: DEFAULT_SECTIONS,
  hidden: ["qr"],
  qr: { type: "none", value: "", label: "" },
  footerText: "¡Gracias por su compra!",
};

export type InvoiceTemplate = {
  id: InvoiceTemplateId;
  name: string;
  description: string;
  /** What changes when the merchant picks this template. */
  preset: Partial<Omit<InvoiceDesign, "show">> & { show?: Partial<InvoiceDesign["show"]> };
};

export const INVOICE_TEMPLATES: InvoiceTemplate[] = [
  {
    id: "classic",
    name: "Clásica térmica",
    description: "El ticket de siempre, centrado y fácil de leer. Ideal para impresoras de 80 y 58 mm.",
    preset: { paper: "80", font: "mono", hidden: ["qr"] },
  },
  {
    id: "modern",
    name: "Moderna",
    description: "Logo grande, total destacado y separadores suaves.",
    preset: { paper: "80", font: "sans", logoSize: "lg", hidden: ["qr"], show: { slogan: true, instagram: true } },
  },
  {
    id: "minimal",
    name: "Minimalista",
    description: "Solo lo esencial. La más corta y la que menos papel gasta.",
    preset: {
      paper: "80",
      font: "sans",
      logoSize: "sm",
      hidden: ["qr", "barcode", "payments"],
      show: { address: false, phone: false, cashier: false, clientDocument: false, taxBreakdown: false, exchangeRate: false },
    },
  },
  {
    id: "fiscal",
    name: "Fiscal detallada",
    description: "RIF, base imponible, IVA e IGTF desglosados. Lista para la facturación digital.",
    preset: {
      paper: "80",
      font: "mono",
      documentTitle: "Factura",
      hidden: ["qr"],
      show: { rif: true, clientDocument: true, clientPhone: true, itemCode: true, taxBreakdown: true, exchangeRate: true },
    },
  },
  {
    id: "letter",
    name: "Carta profesional",
    description: "Tamaño carta o A4 con tabla a lo ancho. Para PDF, correo y WhatsApp.",
    preset: {
      paper: "a4",
      font: "sans",
      logoSize: "lg",
      hidden: ["barcode"],
      show: { email: true, website: true, clientPhone: true, itemCode: true },
    },
  },
];

export function getTemplate(id: InvoiceTemplateId) {
  return INVOICE_TEMPLATES.find((t) => t.id === id) ?? INVOICE_TEMPLATES[0];
}

/** Base design with a template applied; used when the merchant switches templates. */
export function designFromTemplate(id: InvoiceTemplateId, keep?: InvoiceDesign): InvoiceDesign {
  const { preset } = getTemplate(id);
  const base = keep ?? BASE_DESIGN;
  return {
    ...base,
    ...preset,
    templateId: id,
    // Brand data the merchant typed is kept across templates
    business: base.business,
    logoUrl: base.logoUrl,
    accentColor: base.accentColor,
    qr: base.qr,
    footerText: base.footerText,
    documentTitle: preset.documentTitle ?? (keep ? keep.documentTitle : BASE_DESIGN.documentTitle),
    show: { ...BASE_DESIGN.show, ...preset.show },
    sections: preset.sections ?? DEFAULT_SECTIONS,
    hidden: preset.hidden ?? BASE_DESIGN.hidden,
  };
}

/**
 * Reads whatever is saved (possibly from an older version) and fills the gaps.
 * The old "receiptFooter" and "paperWidth" settings are honored when there is no design yet.
 */
export function normalizeInvoiceDesign(saved: unknown, settings?: { receiptFooter?: string | null; paperWidth?: number | string | null }): InvoiceDesign {
  const fallback = designFromTemplate("classic");
  if (!saved || typeof saved !== "object") {
    const paper = String(settings?.paperWidth ?? "80");
    return {
      ...fallback,
      paper: paper === "58" ? "58" : "80",
      footerText: settings?.receiptFooter?.trim() || fallback.footerText,
    };
  }
  const s = saved as Partial<InvoiceDesign>;
  const sections = Array.isArray(s.sections) ? s.sections.filter((id): id is InvoiceSectionId => DEFAULT_SECTIONS.includes(id as InvoiceSectionId)) : DEFAULT_SECTIONS;
  // Sections added in later versions go at the end
  for (const id of DEFAULT_SECTIONS) if (!sections.includes(id)) sections.push(id);
  return {
    ...fallback,
    ...s,
    templateId: INVOICE_TEMPLATES.some((t) => t.id === s.templateId) ? (s.templateId as InvoiceTemplateId) : "classic",
    paper: s.paper === "58" || s.paper === "a4" ? s.paper : "80",
    font: s.font === "sans" || s.font === "serif" ? s.font : s.font === "mono" ? "mono" : fallback.font,
    business: { ...fallback.business, ...(s.business ?? {}) },
    show: { ...fallback.show, ...(s.show ?? {}) },
    qr: { ...fallback.qr, ...(s.qr ?? {}) },
    sections,
    hidden: Array.isArray(s.hidden) ? s.hidden : fallback.hidden,
  };
}
