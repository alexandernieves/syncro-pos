import { renderToStaticMarkup } from "react-dom/server";
import { toast } from "sonner";
import { InvoiceDocument } from "@/components/invoice/invoice-document";
import type { InvoiceDesign } from "./design";
import { type InvoiceBusiness, type InvoiceData, invoiceNumber } from "./types";

/** Business data from settings, with the design's overrides on top. */
export function resolveInvoiceBusiness(settings: any, design: InvoiceDesign, fallbackName?: string): InvoiceBusiness {
  const o = design.business;
  const pick = (override: string, ...values: unknown[]) =>
    override.trim() || (values.find((v) => typeof v === "string" && v.trim()) as string | undefined)?.trim() || "";
  return {
    name: pick(o.name, settings?.businessName, fallbackName) || "Mi negocio",
    rif: pick(o.rif, settings?.ruc),
    address: pick(o.address, settings?.businessAddress, settings?.address),
    phone: pick(o.phone, settings?.businessPhone, settings?.phone),
    email: pick(o.email, settings?.businessEmail, settings?.email),
    website: pick(o.website, settings?.website),
    instagram: o.instagram.trim(),
    slogan: o.slogan.trim(),
    pagoMovil: settings?.pagoMovilEnabled
      ? { bank: settings.pagoMovilBank || "", id: settings.pagoMovilId || "", phone: settings.pagoMovilPhone || "" }
      : null,
  };
}

const PAGE_CSS: Record<InvoiceDesign["paper"], string> = {
  "80": "@page { size: 80mm auto; margin: 0; } body { width: 72mm; padding: 4mm 0; }",
  "58": "@page { size: 58mm auto; margin: 0; } body { width: 48mm; padding: 3mm 0; }",
  a4: "@page { size: auto; margin: 12mm; } body { width: 100%; }",
};

/** Full HTML page of the invoice, ready for a printer. */
export function invoiceHtml(data: InvoiceData, design: InvoiceDesign, business: InvoiceBusiness) {
  // Thermal paper prints in black; letter size keeps the colors for color printers and PDF
  const ink = design.paper === "a4" ? "color" : "thermal";
  const body = renderToStaticMarkup(<InvoiceDocument data={data} design={design} business={business} ink={ink} />);
  return `<!doctype html><html><head><meta charset="utf-8"><title>${design.documentTitle} ${invoiceNumber(data)}</title><style>
    ${PAGE_CSS[design.paper]}
    html, body { margin: 0 auto; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  </style></head><body>${body}</body></html>`;
}

type DesktopBridge = { printHtml?: (html: string, paper: string) => Promise<{ ok: boolean; reason?: string }> };

/** Prints only the invoice: straight to the ticket printer in the desktop app, through a hidden frame in the browser. */
export function printInvoice(data: InvoiceData, design: InvoiceDesign, business: InvoiceBusiness) {
  const desktop = (window as unknown as { electron?: DesktopBridge }).electron;
  if (desktop?.printHtml) {
    desktop.printHtml(invoiceHtml(data, design, business), design.paper).then((r) => {
      if (!r.ok && r.reason !== "cancelled") toast.error("No se pudo imprimir el ticket. Revisa la impresora en el menú Syncro → Impresora de tickets.");
    });
    return;
  }
  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument!;
  doc.open();
  doc.write(invoiceHtml(data, design, business));
  doc.close();
  const images = Array.from(doc.images);
  // Wait for the logo so it doesn't print blank
  Promise.all(images.map((img) => (img.complete ? Promise.resolve() : new Promise((r) => { img.onload = img.onerror = r; setTimeout(r, 2500); })))).then(() => {
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => iframe.remove(), 1000);
    }, 100);
  });
}
