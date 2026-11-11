import { IconCheck, IconChecks } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

/**
 * WhatsApp-style ticks on my messages: ✓ sent · ✓✓ gray reached their device (Syncro open or the
 * notification arrived) · ✓✓ blue read.
 */
export function MessageTicks({ read, delivered, size = 12, className }: { read?: boolean; delivered?: string | Date | null; size?: number; className?: string }) {
  if (read) return <IconChecks size={size} className={cn("text-sky-500", className)} aria-label="Leído" />;
  if (delivered) return <IconChecks size={size} className={cn("opacity-70", className)} aria-label="Entregado" />;
  return <IconCheck size={size} className={cn("opacity-70", className)} aria-label="Enviado" />;
}

/** Applies a "messagesDelivered" event to a list of messages. */
export function withDelivered<T extends { id?: string; deliveredAt?: string | null }>(list: T[], ids: string[], at: string): T[] {
  if (!ids?.length) return list;
  const set = new Set(ids);
  return list.map((m) => (m.id && set.has(m.id) && !m.deliveredAt ? { ...m, deliveredAt: at } : m));
}
