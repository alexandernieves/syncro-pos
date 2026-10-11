import { API_URL } from "@/lib/constants";
import { normalizeInvoiceDesign } from "@/lib/invoice/design";
import { printInvoice, resolveInvoiceBusiness } from "@/lib/invoice/render";
import type { InvoiceData } from "@/lib/invoice/types";
import { invoiceCaption, renderInvoiceImage } from "@/lib/invoice/whatsapp";
import { type GymMemberDetail, type GymMembership, shortDate } from "@/lib/gym";

/** Membership receipt built with the business's invoice design. */
export function membershipReceiptParts(member: GymMemberDetail, membership: GymMembership, settings: any) {
  const base = normalizeInvoiceDesign(settings?.invoiceDesign, settings ?? undefined);
  // Memberships don't carry IVA here: hide the tax lines
  const design = { ...base, documentTitle: "Recibo de membresía", show: { ...base.show, taxBreakdown: false, itemCode: false } };
  const business = resolveInvoiceBusiness(settings, design);
  const payments = (membership.payments || []).map((p) => ({ method: p.method, amount: p.amount, reference: p.reference || undefined }));
  // Plan line plus one line per extra charge (enrollment, reactivation, freeze fee)
  const fees = (membership.feeItems ?? []).filter((f) => f && f.amount > 0);
  const feesTotal = Math.round(fees.reduce((t, f) => t + f.amount, 0) * 100) / 100;
  const total = Math.round((membership.price - membership.discount + feesTotal) * 100) / 100;
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
        subtotal: Math.round((membership.price - membership.discount) * 100) / 100,
      },
      ...fees.map((f) => ({ name: f.label, quantity: 1, price: f.amount, discount: 0, subtotal: f.amount })),
    ],
    subtotal: Math.round((membership.price + feesTotal) * 100) / 100,
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
  const { data, design, business } = membershipReceiptParts(member, membership, settings);
  printInvoice(data, design, business);
}

export async function sendMembershipReceipt(member: GymMemberDetail, membership: GymMembership, settings: any) {
  const phone = member.client.phone?.replace(/\D/g, "");
  if (!phone) throw new Error("El socio no tiene WhatsApp registrado");
  const { data, design, business } = membershipReceiptParts(member, membership, settings);
  const image = await renderInvoiceImage(data, design, business);
  const res = await fetch(`${API_URL}/whatsapp/receipts`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` },
    body: JSON.stringify({ phone, image, caption: invoiceCaption(data, design, business), fileName: `recibo-membresia-${data.saleNumber}.png` }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "No se pudo enviar el recibo");
}

/** Receipt of a day pass or a guest pass charged at reception. */
export function visitReceiptParts(visit: { id: string; name: string; documentId?: string | null; phone?: string | null; kind: string; checkedInAt?: string }, price: number, method: string, settings: any) {
  const base = normalizeInvoiceDesign(settings?.invoiceDesign, settings ?? undefined);
  const design = { ...base, documentTitle: "Recibo de pase", show: { ...base.show, taxBreakdown: false, itemCode: false } };
  const business = resolveInvoiceBusiness(settings, design);
  const label = visit.kind === "GUEST" ? "Pase de invitado" : "Pase de día";
  const data: InvoiceData = {
    saleId: visit.id,
    saleNumber: `P-${visit.id.replace(/-/g, "").slice(-6).toUpperCase()}`,
    date: new Date(visit.checkedInAt || Date.now()),
    businessName: business.name,
    clientName: visit.name,
    clientDocument: visit.documentId ?? null,
    clientPhone: visit.phone ?? null,
    items: [{ name: `${label} · ${new Date(visit.checkedInAt || Date.now()).toLocaleDateString("es-VE", { day: "numeric", month: "long" })}`, quantity: 1, price, discount: 0, subtotal: price }],
    subtotal: price,
    discount: 0,
    taxRate: 0,
    tax: 0,
    igtf: 0,
    total: price,
    exchangeRate: Number(settings?.exchangeRate) > 1 ? Number(settings.exchangeRate) : 1,
    payments: [{ method, amount: price }],
    change: 0,
  };
  return { data, design, business };
}
