/** Snapshot of a sale used to render its invoice. */
export type InvoiceData = {
  saleId: string;
  /** Short number shown on the document and encoded in its barcode. */
  saleNumber?: string;
  date: Date;
  businessName: string;
  businessAddress?: string | null;
  businessPhone?: string | null;
  businessRif?: string | null;
  branchName?: string | null;
  clientName: string;
  clientDocument?: string | null;
  clientPhone?: string | null;
  cashierName?: string | null;
  items: { name: string; code?: string | null; quantity: number; price: number; discount?: number; subtotal: number }[];
  subtotal: number;
  discount: number;
  taxRate: number;
  tax: number;
  igtf: number;
  total: number;
  exchangeRate: number;
  payments: { method: string; amount: number; reference?: string }[];
  change: number;
  /** Saved offline, waiting to sync. */
  pending?: boolean;
};

/** Business data printed on the invoice, after applying the design's overrides. */
export type InvoiceBusiness = {
  name: string;
  rif: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  instagram: string;
  slogan: string;
  pagoMovil?: { bank: string; id: string; phone: string } | null;
};

export const PAYMENT_LABELS: Record<string, string> = {
  CASH: "Efectivo",
  CARD: "Punto de venta",
  TRANSFER: "Transferencia",
  PAGO_MOVIL: "Pago móvil",
  WALLET: "Monedero",
  CREDIT: "Crédito",
  BINANCE: "Binance",
  ZINLI: "Zinli",
  PAYPAL: "PayPal",
};

export function invoiceNumber(data: InvoiceData) {
  return data.saleNumber || data.saleId.replace(/-/g, "").slice(-8).toUpperCase();
}
