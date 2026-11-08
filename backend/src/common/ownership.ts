import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../modules/prisma/prisma.service';

/**
 * Checks that a record reached by its id belongs to the user's business. Answers "not found"
 * (never "forbidden") so another business can't even learn that the id exists.
 * The Syncro team works across businesses and is let through.
 */
type Kind = keyof typeof OWNER;

const OWNER = {
  purchaseOrder: (b: string) => ({ branch: { businessId: b } }),
  expense: (b: string) => ({ branch: { businessId: b } }),
  inventoryTransfer: (b: string) => ({ sourceBranch: { businessId: b } }),
  supplierPayment: (b: string) => ({ supplier: { businessId: b } }),
  supplierReturn: (b: string) => ({ supplier: { businessId: b } }),
  supplier: (b: string) => ({ businessId: b }),
  notification: (b: string) => ({ OR: [{ branch: { businessId: b } }, { user: { businessId: b } }] }),
  productWaitlist: (b: string) => ({ branch: { businessId: b } }),
  shift: (b: string) => ({ branch: { businessId: b } }),
  aiChatMessage: (b: string) => ({ businessId: b }),
} as const;

const LABEL: Record<Kind, string> = {
  purchaseOrder: 'Orden de compra no encontrada',
  expense: 'Gasto no encontrado',
  inventoryTransfer: 'Transferencia no encontrada',
  supplierPayment: 'Pago no encontrado',
  supplierReturn: 'Devolución no encontrada',
  supplier: 'Proveedor no encontrado',
  notification: 'Notificación no encontrada',
  productWaitlist: 'Registro no encontrado',
  shift: 'Turno no encontrado',
  aiChatMessage: 'Mensaje no encontrado',
};

export async function assertOwned(prisma: PrismaService, kind: Kind, id: string, user: { role?: string; businessId?: string | null } | undefined) {
  if (user?.role === 'syncropos') return;
  if (!user?.businessId || !id || typeof id !== 'string') throw new NotFoundException(LABEL[kind]);
  const found = await (prisma as any)[kind].findFirst({ where: { id, ...OWNER[kind](user.businessId) }, select: { id: true } });
  if (!found) throw new NotFoundException(LABEL[kind]);
}

/** Filter for lists: the Syncro team sees everything, a business only its own rows. */
export function ownedBy(kind: Kind, user: { role?: string; businessId?: string | null } | undefined) {
  if (user?.role === 'syncropos') return {};
  return OWNER[kind](user?.businessId ?? '__none__');
}
