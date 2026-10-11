import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { toPng } from "html-to-image";
import { API_URL } from "@/lib/constants";
import { InvoiceDocument } from "@/components/invoice/invoice-document";
import type { InvoiceDesign } from "./design";
import { type InvoiceBusiness, type InvoiceData, PAYMENT_LABELS, invoiceNumber } from "./types";

const IMAGE_LAYOUT: Record<InvoiceDesign["paper"], { width: number; padding: number }> = {
  "80": { width: 380, padding: 20 },
  "58": { width: 300, padding: 16 },
  a4: { width: 820, padding: 40 },
};

const TRANSPARENT_PIXEL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

/** Renders the invoice off screen, in color, and returns it as a PNG data URL. */
export async function renderInvoiceImage(data: InvoiceData, design: InvoiceDesign, business: InvoiceBusiness) {
  const { width, padding } = IMAGE_LAYOUT[design.paper];
  const host = document.createElement("div");
  // Off screen wrapper; the capture is of the inner page so the offset isn't copied
  host.style.cssText = "position:fixed;left:-10000px;top:0;";
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    flushSync(() =>
      root.render(
        <div style={{ width, padding, background: "#fff" }}>
          <InvoiceDocument data={data} design={design} business={business} ink="color" />
        </div>,
      ),
    );
    const page = host.firstElementChild as HTMLElement;
    await Promise.all(
      Array.from(page.querySelectorAll("img")).map((img) =>
        img.complete ? Promise.resolve() : new Promise((r) => { img.onload = img.onerror = r; setTimeout(r, 3000); }),
      ),
    );
    // A logo that can't be read (another domain without CORS) is left out instead of failing
    return await toPng(page, { pixelRatio: 2, backgroundColor: "#ffffff", imagePlaceholder: TRANSPARENT_PIXEL, cacheBust: true });
  } finally {
    root.unmount();
    host.remove();
  }
}

const money = (n: number) => `$${n.toFixed(2)}`;
const bs = (n: number) => `Bs ${n.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Text that goes with the image; also used for the wa.me fallback. */
export function invoiceCaption(data: InvoiceData, design: InvoiceDesign, business: InvoiceBusiness, withDetail = false) {
  const firstName = data.clientName && !/consumidor/i.test(data.clientName) ? data.clientName.trim().split(/\s+/)[0] : "";
  const lines = [
    `${firstName ? `Hola ${firstName}, gracias` : "Gracias"} por tu compra en *${business.name}*.`,
    `${design.documentTitle} N.º ${invoiceNumber(data)}`,
  ];
  if (withDetail) {
    lines.push("", ...data.items.map((i) => `• ${i.quantity} x ${i.name}: ${money(i.subtotal)}`));
    if (data.payments.length) lines.push("", ...data.payments.map((p) => `${PAYMENT_LABELS[p.method] ?? p.method}: ${money(p.amount)}`));
  }
  lines.push(`Total: *${money(data.total)}*${data.exchangeRate > 1 ? ` (${bs(data.total * data.exchangeRate)})` : ""}`);
  if (design.footerText) lines.push("", design.footerText);
  return lines.join("\n");
}

/** Opens WhatsApp with the invoice as text, for when the business number isn't connected. */
export function openInvoiceInWhatsApp(phone: string, data: InvoiceData, design: InvoiceDesign, business: InvoiceBusiness) {
  const text = invoiceCaption(data, design, business, true);
  window.open(`https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`, "_blank", "noopener");
}

export type WhatsAppInvoiceResult = {
  whatsappInvoiceStatus: "SENT" | "FAILED" | null;
  whatsappInvoiceTo: string | null;
  whatsappInvoiceSentAt: string | null;
  whatsappInvoiceError: string | null;
};

export class WhatsAppInvoiceError extends Error {
  /** The business's WhatsApp isn't connected: offer to open WhatsApp instead. */
  notConnected: boolean;
  constructor(message: string, notConnected: boolean) {
    super(message);
    this.notConnected = notConnected;
  }
}

/** Renders the invoice and sends it from the business's WhatsApp (Evolution API). */
export async function sendInvoiceWhatsApp(saleId: string, phone: string, data: InvoiceData, design: InvoiceDesign, business: InvoiceBusiness): Promise<WhatsAppInvoiceResult> {
  const image = await renderInvoiceImage(data, design, business);
  const res = await fetch(`${API_URL}/whatsapp/invoices/${saleId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` },
    body: JSON.stringify({
      image,
      phone,
      caption: invoiceCaption(data, design, business),
      fileName: `${design.documentTitle.toLowerCase().replace(/\s+/g, "-")}-${invoiceNumber(data)}.png`,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new WhatsAppInvoiceError(err.message || "No se pudo enviar la factura por WhatsApp", res.status === 409);
  }
  return res.json();
}

/** Invoice data rebuilt from a sale saved on the server (for resending from the history). */
export function saleToInvoiceData(sale: any, settings: any): InvoiceData {
  const payments = (sale.payments || []).map((p: any) => ({ method: p.method, amount: Number(p.amount) || 0, reference: p.reference || undefined }));
  const paid = payments.reduce((s: number, p: { amount: number }) => s + p.amount, 0);
  const rate = Number(payments.find((p: any) => p.exchangeRate)?.exchangeRate) || Number(settings?.exchangeRate) || 1;
  return {
    saleId: sale.id,
    date: new Date(sale.createdAt),
    businessName: settings?.businessName || "",
    branchName: sale.branch?.name || null,
    clientName: sale.client?.name || "Consumidor final",
    clientDocument: sale.client?.documentId || null,
    clientPhone: sale.client?.phone || null,
    cashierName: sale.user?.name || null,
    items: (sale.items || []).map((i: any) => ({
      name: i.variant?.product?.name || i.waitlist?.name || i.description || "Producto",
      code: i.variant?.barcode || i.variant?.sku || null,
      quantity: Number(i.quantity) || 0,
      price: Number(i.price) || 0,
      discount: Number(i.discountAmt) || 0,
      subtotal: Number(i.subtotal) || 0,
    })),
    subtotal: Number(sale.subtotal) || 0,
    discount: Number(sale.discountAmt) || 0,
    taxRate: Number(settings?.taxRate ?? 16),
    tax: Number(sale.taxAmount) || 0,
    igtf: Number(sale.igtfAmount) || 0,
    total: Number(sale.total) || 0,
    exchangeRate: rate,
    payments,
    change: Math.max(0, Math.round((paid - (Number(sale.total) || 0)) * 100) / 100),
  };
}
