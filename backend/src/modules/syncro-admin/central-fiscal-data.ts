import { createHash } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export function exchangeRate(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0.00000001 || value > 1_000_000_000) {
    throw new BadRequestException('Ingresa una tasa válida en unidades de moneda por USD');
  }
  return new Prisma.Decimal(value).toDecimalPlaces(8);
}

export function amount(value: unknown, min = 0) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > 2_000_000_000) {
    throw new BadRequestException('Importe inválido en centavos');
  }
  return value;
}

export function date(value: unknown) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new BadRequestException('Fecha inválida');
  }
  const parsed = new Date(value);
  if (!Number.isFinite(+parsed) || parsed.toISOString().slice(0, 10) !== value) {
    throw new BadRequestException('Fecha inválida');
  }
  return value;
}

export function label(value: unknown) {
  if (typeof value !== 'string' || !value.trim() || value.length > 200) {
    throw new BadRequestException('Descripción inválida');
  }
  return value.trim();
}

export const fiscalSelect = {
  id: true, kind: true, tax: true, direction: true, reference: true, counterparty: true, date: true,
  period: true, dueDate: true, filedDate: true, paidDate: true, status: true, baseCents: true, vatCents: true, amountCents: true,
  rateCurrency: true, rate: true, notes: true, invoiceId: true, supportMime: true,
} as const;

const fiscalStatuses: Record<string, string[]> = {
  invoice: ['issued', 'collected', 'void'],
  declaration: ['pending', 'filed', 'paid'],
  retention: ['pending', 'confirmed'],
};

export function fiscalSupport(input: unknown) {
  if (typeof input !== 'string' || input.length > 6_990_508 || !/^[A-Za-z0-9+/]+={0,2}$/.test(input)) {
    throw new BadRequestException('Adjunta un PDF, PNG o JPEG de hasta 5 MiB');
  }
  const bytes = Buffer.from(input, 'base64');
  if (bytes.length > 5 * 1024 * 1024 || bytes.toString('base64') !== input) {
    throw new BadRequestException('Archivo adjunto inválido');
  }
  const mime = bytes.subarray(0, 5).toString() === '%PDF-' ? 'application/pdf'
    : bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? 'image/png'
      : bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255])) ? 'image/jpeg' : null;
  if (!mime) throw new BadRequestException('Solo se admiten PDF, PNG o JPEG');
  return { bytes, mime };
}

export async function fiscalRecordData(db: Prisma.TransactionClient, scope: string, actorId: string, body: any) {
  const { kind, status } = body ?? {};
  if (!Object.prototype.hasOwnProperty.call(fiscalStatuses, kind) || !fiscalStatuses[kind].includes(status)) {
    throw new BadRequestException('Tipo o estado fiscal inválido');
  }
  const tax = kind === 'invoice' ? null : body.tax;
  if (kind !== 'invoice' && !['IVA', 'ISLR'].includes(tax)) throw new BadRequestException('Selecciona el impuesto');
  const direction = kind === 'retention' ? body.direction : null;
  if (kind === 'retention' && !['received', 'issued'].includes(direction)) throw new BadRequestException('Selecciona el sentido de la retención');
  const period = body.period || null;
  if ((kind === 'declaration' && !period) || (period && (typeof period !== 'string' || !/^\d{4}(?:-(?:0[1-9]|1[0-2])(?:-[12])?)?$/.test(period)))) {
    throw new BadRequestException('Período inválido. Usa AAAA, AAAA-MM o AAAA-MM-1 / AAAA-MM-2');
  }
  const invoiceId = kind === 'retention' ? body.invoiceId || null : null;
  if (invoiceId && (typeof invoiceId !== 'string' || !(await db.centralFiscalRecord.findFirst({
    where: { scope, id: invoiceId, kind: 'invoice' }, select: { id: true },
  })))) throw new BadRequestException('La factura vinculada no está disponible');
  const rateCurrency = kind === 'invoice' ? body.rateCurrency || null : null;
  if (rateCurrency && !['USD', 'EUR'].includes(rateCurrency)) throw new BadRequestException('Moneda de referencia inválida');
  const attachment = body.support == null ? null : fiscalSupport(body.support);
  const reference = kind === 'declaration' && !body.reference ? `${tax} ${period}` : label(body.reference);
  const counterparty = body.counterparty ? label(body.counterparty) : null;
  if (kind === 'retention' && !counterparty) throw new BadRequestException('Indica la contraparte de la retención');
  const identity = createHash('sha256').update(JSON.stringify(
    kind === 'declaration' ? [kind, tax, period]
      : kind === 'retention' ? [kind, tax, direction, counterparty?.toUpperCase(), reference.toUpperCase()]
        : [kind, reference.toUpperCase()],
  )).digest('hex');
  return {
    kind, tax, direction, status, period, invoiceId, identity, reference, counterparty,
    date: date(body.date), dueDate: body.dueDate ? date(body.dueDate) : null,
    filedDate: kind === 'declaration' && body.filedDate ? date(body.filedDate) : null,
    paidDate: kind !== 'retention' && body.paidDate ? date(body.paidDate) : null,
    amountCents: kind !== 'invoice' && body.amountCents == null ? null : amount(body.amountCents),
    baseCents: kind === 'invoice' && body.baseCents != null ? amount(body.baseCents) : null,
    vatCents: kind === 'invoice' && body.vatCents != null ? amount(body.vatCents) : null,
    rateCurrency, rate: rateCurrency ? exchangeRate(body.rate) : null,
    notes: body.notes ? label(body.notes) : null, actorId,
    ...(attachment && { support: new Uint8Array(attachment.bytes), supportMime: attachment.mime }),
  };
}
