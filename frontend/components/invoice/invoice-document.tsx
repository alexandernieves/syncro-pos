import { useMemo } from "react";
import { QRCodeSVG } from "qrcode.react";
import JsBarcode from "jsbarcode";
import type { InvoiceDesign, InvoiceSectionId } from "@/lib/invoice/design";
import { type InvoiceBusiness, type InvoiceData, PAYMENT_LABELS, invoiceNumber, paymentAmountLabel } from "@/lib/invoice/types";

/**
 * The invoice itself. Plain markup with its own scoped CSS (no Tailwind), so the same
 * component renders in the dashboard preview, the POS animation and the print window.
 */

export type InvoiceInk = "color" | "thermal";

type InvoiceDocumentProps = {
  data: InvoiceData;
  design: InvoiceDesign;
  business: InvoiceBusiness;
  /** Thermal printers only print black: the accent color and logo turn grayscale. */
  ink?: InvoiceInk;
};

const money = (n: number) => `$${n.toFixed(2)}`;
const bs = (n: number) => `Bs ${n.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const CSS = `
.syi { --a: var(--syi-accent, #E4572E); color: #111; background: #fff; font-size: 11px; line-height: 1.4; width: 100%; text-align: left; }
.syi * { box-sizing: border-box; margin: 0; padding: 0; }
.syi.syi-f-mono { font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; }
.syi.syi-f-sans { font-family: Inter, "Helvetica Neue", Arial, sans-serif; }
.syi.syi-f-serif { font-family: Georgia, "Times New Roman", serif; }
.syi.syi-p-58 { font-size: 10px; }
.syi.syi-p-a4 { font-size: 12px; }
.syi.syi-ink-thermal { --a: #000; }
.syi.syi-ink-thermal img { filter: grayscale(1) contrast(1.2); }
.syi section + section { margin-top: 8px; }
.syi .c { text-align: center; }
.syi .r { text-align: right; }
.syi .b { font-weight: 700; }
.syi .muted { color: #555; }
.syi .small { font-size: .88em; }
.syi .hr { border-top: 1px dashed #777; margin: 8px 0 0; }
.syi .row { display: flex; justify-content: space-between; gap: 8px; }
.syi .row > :last-child { text-align: right; white-space: nowrap; }
.syi .logo { display: block; margin: 0 auto 6px; object-fit: contain; }
.syi .logo-sm { max-height: 32px; max-width: 45%; }
.syi .logo-md { max-height: 52px; max-width: 60%; }
.syi .logo-lg { max-height: 80px; max-width: 75%; }
.syi .name { font-size: 1.3em; font-weight: 800; }
.syi .title { font-weight: 800; letter-spacing: .02em; }
.syi .total { font-size: 1.25em; font-weight: 800; }
.syi .qr { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.syi .barcode svg { display: block; width: 100%; height: 44px; }
.syi table { width: 100%; border-collapse: collapse; }
.syi th { text-align: left; font-weight: 700; }
.syi td, .syi th { padding: 3px 4px; vertical-align: top; }
.syi td.n, .syi th.n { text-align: right; white-space: nowrap; }

/* Moderna */
.syi-t-modern .name { font-size: 1.45em; }
.syi-t-modern .band { background: var(--a); color: #fff; border-radius: 6px; padding: 4px 8px; text-align: center; font-weight: 800; margin-top: 6px; }
.syi-t-modern .hr { border-top: 1px solid #ddd; }
.syi-t-modern .totalbox { border: 2px solid var(--a); border-radius: 8px; padding: 6px 8px; margin-top: 6px; }
.syi-t-modern .totalbox .total { color: var(--a); }

/* Minimalista */
.syi-t-minimal .hr { border-top: 1px solid #ccc; }
.syi-t-minimal section + section { margin-top: 6px; }

/* Fiscal */
.syi-t-fiscal .docbox { border: 1.5px solid #000; padding: 4px 6px; margin-top: 6px; text-align: center; }
.syi-t-fiscal .docbox .title { font-size: 1.2em; }
.syi-t-fiscal .hr { border-top: 1px solid #000; }

/* Carta profesional */
.syi-t-letter { padding: 4px; }
.syi-t-letter .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
.syi-t-letter .head .logo { margin: 0 0 6px; }
.syi-t-letter .docbox { text-align: right; }
.syi-t-letter .docbox .title { font-size: 1.6em; color: var(--a); }
.syi-t-letter .card { border: 1px solid #ddd; border-radius: 8px; padding: 8px 10px; }
.syi-t-letter .label { font-size: .8em; font-weight: 700; color: var(--a); text-transform: none; margin-bottom: 2px; }
.syi-t-letter table thead th { background: var(--a); color: #fff; }
.syi-t-letter table tbody tr:nth-child(even) td { background: #f6f6f6; }
.syi-t-letter .totals { margin-left: auto; width: 45%; min-width: 220px; }
.syi-t-letter .totals .total { border-top: 2px solid var(--a); padding-top: 4px; margin-top: 4px; }
.syi-t-letter section + section { margin-top: 14px; }
.syi-t-letter .hr { display: none; }
.syi-t-letter.syi-ink-thermal table thead th { background: #000; }
`;

function barcodeSvg(value: string) {
  if (typeof document === "undefined" || !value) return "";
  try {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    JsBarcode(svg, value, { format: "CODE128", displayValue: false, margin: 0, height: 44, width: 1.6 });
    svg.setAttribute("preserveAspectRatio", "none");
    return svg.outerHTML;
  } catch {
    return "";
  }
}

export function qrValue(design: InvoiceDesign, business: InvoiceBusiness) {
  const { type, value } = design.qr;
  if (type === "pagomovil") {
    const pm = business.pagoMovil;
    if (!pm || (!pm.phone && !pm.id)) return "";
    return [`Pago móvil · ${business.name}`, pm.bank && `Banco: ${pm.bank}`, pm.id && `Cédula/RIF: ${pm.id}`, pm.phone && `Teléfono: ${pm.phone}`].filter(Boolean).join("\n");
  }
  if (type === "instagram") {
    const handle = (value || business.instagram).trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//, "").replace(/\/$/, "");
    return handle ? `https://instagram.com/${handle}` : "";
  }
  if (type === "website") {
    const site = (value || business.website).trim();
    return site ? (/^https?:\/\//.test(site) ? site : `https://${site}`) : "";
  }
  if (type === "custom") return value.trim();
  return "";
}

const QR_DEFAULT_LABEL: Record<string, string> = {
  pagomovil: "Escanea para pagar por pago móvil",
  instagram: "Síguenos en Instagram",
  website: "Visita nuestra web",
  custom: "",
};

export function InvoiceDocument({ data, design, business, ink = "color" }: InvoiceDocumentProps) {
  const number = invoiceNumber(data);
  const tpl = design.templateId;
  const wide = design.paper === "a4";
  const show = design.show;
  const barcode = useMemo(() => barcodeSvg(number), [number]);
  const qr = qrValue(design, business);
  const base = Math.max(0, data.subtotal - data.discount);

  const businessLines = [
    show.rif && business.rif && `RIF ${business.rif}`,
    show.address && business.address,
    show.phone && business.phone && `Tel. ${business.phone}`,
    show.email && business.email,
    show.website && business.website,
    show.instagram && business.instagram && `@${business.instagram.replace(/^@/, "")}`,
  ].filter(Boolean) as string[];

  const logo = design.logoUrl ? <img src={design.logoUrl} alt="" className={`logo logo-${design.logoSize}`} /> : null;

  const docInfoRows = (
    <>
      {tpl !== "fiscal" && <div className="row"><span className="muted">N.º</span><span className="b">{number}</span></div>}
      <div className="row"><span className="muted">Fecha</span><span>{data.date.toLocaleString("es-VE", { dateStyle: "short", timeStyle: "short" })}</span></div>
      {show.cashier && data.cashierName && <div className="row"><span className="muted">Cajero</span><span>{data.cashierName}</span></div>}
      {data.branchName && <div className="row"><span className="muted">Sucursal</span><span>{data.branchName}</span></div>}
    </>
  );

  const sections: Record<InvoiceSectionId, () => React.ReactNode> = {
    header: () => {
      if (tpl === "letter") {
        return (
          <div className="head">
            <div>
              {logo}
              <p className="name">{business.name}</p>
              {show.slogan && business.slogan && <p className="muted">{business.slogan}</p>}
              {businessLines.map((l) => <p key={l} className="small muted">{l}</p>)}
            </div>
            <div className="docbox">
              <p className="title">{design.documentTitle}</p>
              <p className="b">N.º {number}</p>
              <p className="muted">{data.date.toLocaleString("es-VE", { dateStyle: "long" })}</p>
            </div>
          </div>
        );
      }
      return (
        <div className="c">
          {logo}
          <p className="name">{business.name}</p>
          {show.slogan && business.slogan && <p className="muted small">{business.slogan}</p>}
          {businessLines.map((l) => <p key={l} className="small">{l}</p>)}
          {tpl === "modern" && <p className="band">{design.documentTitle}</p>}
          {tpl === "fiscal" && (
            <div className="docbox">
              <p className="title">{design.documentTitle}</p>
              <p className="b">N.º {number}</p>
            </div>
          )}
          {(tpl === "classic" || tpl === "minimal") && <p className="title" style={{ marginTop: 6 }}>{design.documentTitle}</p>}
        </div>
      );
    },
    documentInfo: () => {
      if (tpl === "letter") {
        if (!(show.cashier && data.cashierName) && !data.branchName) return null;
        return (
          <p className="small muted">
            {[show.cashier && data.cashierName && `Atendido por ${data.cashierName}`, data.branchName].filter(Boolean).join(" · ")}
          </p>
        );
      }
      return <><div className="hr" />{docInfoRows}</>;
    },
    client: () => {
      const rows = [
        ["Cliente", data.clientName],
        show.clientDocument && data.clientDocument ? ["Cédula/RIF", data.clientDocument] : null,
        show.clientPhone && data.clientPhone ? ["Teléfono", data.clientPhone] : null,
      ].filter(Boolean) as [string, string][];
      if (tpl === "letter") {
        return (
          <div className="card">
            <p className="label">Facturar a</p>
            <p className="b">{data.clientName}</p>
            {rows.slice(1).map(([l, v]) => <p key={l} className="small">{l}: {v}</p>)}
          </div>
        );
      }
      return <><div className="hr" />{rows.map(([l, v]) => <div key={l} className="row"><span className="muted">{l}</span><span>{v}</span></div>)}</>;
    },
    items: () => {
      if (wide) {
        return (
          <table>
            <thead>
              <tr>
                {show.itemCode && <th>Código</th>}
                <th>Descripción</th>
                <th className="n">Cant.</th>
                {show.unitPrice && <th className="n">Precio</th>}
                {show.itemDiscount && <th className="n">Desc.</th>}
                <th className="n">Total</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item, i) => (
                <tr key={i}>
                  {show.itemCode && <td className="small muted">{item.code || "—"}</td>}
                  <td>{item.name}</td>
                  <td className="n">{item.quantity}</td>
                  {show.unitPrice && <td className="n">{money(item.price)}</td>}
                  {show.itemDiscount && <td className="n">{item.discount ? `-${money(item.discount)}` : "—"}</td>}
                  <td className="n b">{money(item.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      }
      return (
        <>
          <div className="hr" />
          {data.items.map((item, i) => (
            <div key={i} style={{ marginTop: i ? 4 : 0 }}>
              <p>{show.itemCode && item.code ? <span className="muted small">{item.code} · </span> : null}{item.name}</p>
              <div className="row">
                <span className="muted">{show.unitPrice ? `${item.quantity} x ${money(item.price)}` : `Cant. ${item.quantity}`}</span>
                <span>{money(item.subtotal)}</span>
              </div>
              {show.itemDiscount && !!item.discount && <div className="row small muted"><span>Descuento</span><span>-{money(item.discount)}</span></div>}
            </div>
          ))}
        </>
      );
    },
    totals: () => {
      const lines = (
        <>
          <div className="row"><span>Subtotal</span><span>{money(data.subtotal)}</span></div>
          {data.discount > 0 && <div className="row"><span>Descuento</span><span>-{money(data.discount)}</span></div>}
          {show.taxBreakdown && tpl === "fiscal" && <div className="row"><span>Base imponible</span><span>{money(base)}</span></div>}
          {show.taxBreakdown && <div className="row"><span>IVA ({data.taxRate}%)</span><span>{money(data.tax)}</span></div>}
          {data.igtf > 0 && <div className="row"><span>IGTF</span><span>{money(data.igtf)}</span></div>}
        </>
      );
      const total = (
        <>
          <div className="row total"><span>Total</span><span>{money(data.total)}</span></div>
          {show.bsTotals && data.exchangeRate > 1 && (
            <div className="row b"><span>{show.exchangeRate ? `Tasa ${data.exchangeRate.toFixed(2)}` : "Total Bs"}</span><span>{bs(data.total * data.exchangeRate)}</span></div>
          )}
        </>
      );
      if (tpl === "letter") return <div className="totals">{lines}<div className="total">{total}</div></div>;
      if (tpl === "modern") return <><div className="hr" />{lines}<div className="totalbox">{total}</div></>;
      return <><div className="hr" />{lines}<div style={{ marginTop: 3 }}>{total}</div></>;
    },
    payments: () => {
      if (!data.payments.length) return null;
      const rows = (
        <>
          {data.payments.map((p, i) => (
            <div key={i} className="row"><span>{PAYMENT_LABELS[p.method] ?? p.method}{p.reference ? <span className="muted small"> · Ref. {p.reference}</span> : null}</span><span>{paymentAmountLabel(p.amount, p.currency, p.amountCurrency)}</span></div>
          ))}
          {show.change && data.change > 0 && <div className="row b"><span>Cambio</span><span>{paymentAmountLabel(data.change, data.changeCurrency, data.changeAmount)}</span></div>}
        </>
      );
      if (tpl === "letter") return <div className="totals"><p className="label">Pagos</p>{rows}</div>;
      return <><div className="hr" />{rows}</>;
    },
    qr: () => {
      if (!qr) return null;
      const label = design.qr.label || QR_DEFAULT_LABEL[design.qr.type] || "";
      return (
        <div className="qr">
          <QRCodeSVG value={qr} size={wide ? 96 : 104} level="M" />
          {label && <p className="small c">{label}</p>}
        </div>
      );
    },
    barcode: () => {
      if (!barcode) return null;
      return (
        <div className="barcode" style={wide ? { width: 220 } : undefined}>
          <div dangerouslySetInnerHTML={{ __html: barcode }} />
          <p className="c small" style={{ letterSpacing: ".15em" }}>{number}</p>
        </div>
      );
    },
    footer: () => {
      if (!design.footerText && !show.nonFiscalNote) return null;
      return (
        <div className="c">
          {design.footerText && <p className="b">{design.footerText}</p>}
          {show.nonFiscalNote && <p className="small muted">Documento no fiscal · Syncro POS</p>}
        </div>
      );
    },
  };

  return (
    <div
      className={`syi syi-t-${tpl} syi-p-${design.paper} syi-f-${design.font} syi-ink-${ink}`}
      style={{ ["--syi-accent" as string]: design.accentColor }}
    >
      <style>{CSS}</style>
      {design.sections
        .filter((id) => !design.hidden.includes(id))
        .map((id) => {
          const content = sections[id]();
          return content ? <section key={id}>{content}</section> : null;
        })}
    </div>
  );
}
