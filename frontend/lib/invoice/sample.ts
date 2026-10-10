import type { InvoiceData } from "./types";

/** Example sale for the designer preview. */
export function sampleInvoice(exchangeRate = 36.5, taxRate = 16): InvoiceData {
  const items = [
    { name: "Escoba de cerdas suaves", code: "7591234567", quantity: 2, price: 3.5, discount: 0, subtotal: 7 },
    { name: "Detergente en polvo 1 kg", code: "7590011223", quantity: 1, price: 4.2, discount: 0.42, subtotal: 3.78 },
    { name: "Café molido 500 g", code: "7598877665", quantity: 3, price: 5, discount: 0, subtotal: 15 },
  ];
  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const discount = items.reduce((s, i) => s + (i.discount || 0), 0);
  const tax = Math.round((subtotal - discount) * (taxRate / 100) * 100) / 100;
  const total = Math.round((subtotal - discount + tax) * 100) / 100;
  return {
    saleId: "muestra-0000-a1b2c3d4",
    saleNumber: "A1B2C3D4",
    date: new Date(),
    businessName: "",
    branchName: "Sucursal principal",
    clientName: "María González",
    clientDocument: "V-12.345.678",
    clientPhone: "+58 412 123 4567",
    cashierName: "Ana",
    items,
    subtotal,
    discount,
    taxRate,
    tax,
    igtf: 0,
    total,
    exchangeRate,
    payments: [
      { method: "PAGO_MOVIL", amount: 20, reference: "004512" },
      { method: "CASH", amount: total - 20 + 5 },
    ],
    change: 5,
  };
}
