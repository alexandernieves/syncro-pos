import { API_URL } from "@/lib/constants";
import { normalizeInvoiceDesign } from "@/lib/invoice/design";
import { printInvoice, resolveInvoiceBusiness } from "@/lib/invoice/render";
import type { InvoiceData } from "@/lib/invoice/types";
import { invoiceCaption, renderInvoiceImage } from "@/lib/invoice/whatsapp";
import { type GymMemberDetail, type GymMembership, shortDate } from "@/lib/gym";

/** Membership receipt built with the business's invoice design. */
function receiptParts(member: GymMemberDetail, membership: GymMembership, settings: any) {
  const base = normalizeInvoiceDesign(settings?.invoiceDesign, settings ?? undefined);
  // Memberships don't carry IVA here: hide the tax lines
  const design = { ...base, documentTitle: "Recibo de membresía", show: { ...base.show, taxBreakdown: false, itemCode: false } };
  const business = resolveInvoiceBusiness(settings, design);
  const payments = (membership.payments || []).map((p) => ({ method: p.method, amount: p.amount, reference: p.reference || undefined }));
  const total = Math.round((membership.price - membership.discount) * 100) / 100;
  const data: InvoiceData = {
    saleId: membership.id,
    saleNumber: `${member.memberNumber}-${membership.id.replace(/-/g, "").slice(-5).toUpperCase()}`,
    date: new Date(membership.payments?.[0]?.createdAt || Date.now()),
    businessName: business.name,
    clientName: member.client.name,
    clientDocument: member.client.documentId,
    clientPhone: member.client.phone,
    items: [
      {
        name: `Membresía ${membership.planName} (${shortDate(membership.startDate)} – ${shortDate(membership.endDate)})`,
        quantity: 1,
        price: membership.price,
        discount: membership.discount,
        subtotal: total,
      },
    ],
    subtotal: membership.price,
    discount: membership.discount,
    taxRate: 0,
    tax: 0,
    igtf: 0,
    total,
    exchangeRate: Number(settings?.exchangeRate) > 1 ? Number(settings.exchangeRate) : 1,
    payments,
    change: 0,
  };
  return { data, design, business };
}

export function printMembershipReceipt(member: GymMemberDetail, membership: GymMembership, settings: any) {
  const { data, design, business } = receiptParts(member, membership, settings);
  printInvoice(data, design, business);
}

export async function sendMembershipReceipt(member: GymMemberDetail, membership: GymMembership, settings: any) {
  const phone = member.client.phone?.replace(/\D/g, "");
  if (!phone) throw new Error("El socio no tiene WhatsApp registrado");
  const { data, design, business } = receiptParts(member, membership, settings);
  const image = await renderInvoiceImage(data, design, business);
  const res = await fetch(`${API_URL}/whatsapp/receipts`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` },
    body: JSON.stringify({ phone, image, caption: invoiceCaption(data, design, business), fileName: `recibo-membresia-${data.saleNumber}.png` }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "No se pudo enviar el recibo");
}
