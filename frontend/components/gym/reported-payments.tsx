"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { IconBrandWhatsapp, IconCheck, IconX } from "@tabler/icons-react";
import { toast } from "sonner";
import { gymApi } from "@/lib/gym";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MemberAvatar } from "@/components/gym/gym-ui";
import { ConfirmDialog } from "@/components/gym/confirm-dialog";

type Reported = {
  id: string;
  planName: string | null;
  amountText: string;
  bank: string | null;
  reference: string | null;
  createdAt: string;
  member: { id: string; memberNumber: number; photoUrl: string | null; client: { name: string; phone: string | null } };
};

/**
 * Pago móvil payments members reported to the WhatsApp agent. The agent never confirms a
 * payment: reception checks the bank and registers the renewal, or rejects it.
 */
export function ReportedPayments() {
  const router = useRouter();
  const [rows, setRows] = useState<Reported[]>([]);
  const [rejecting, setRejecting] = useState<Reported | null>(null);
  const load = useCallback(() => gymApi<Reported[]>("/reported-payments").then(setRows).catch(() => {}), []);
  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  if (!rows.length) return null;
  const when = (d: string) => new Date(d).toLocaleString("es-VE", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><IconBrandWhatsapp size={18} className="text-emerald-600" /> Pagos reportados por WhatsApp · {rows.length}</CardTitle>
        <CardDescription>Socios que dicen haber pagado por pago móvil. Revisa el banco: si llegó, registra la renovación; si no, recházalo.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-3 rounded-xl border px-3 py-2.5">
            <MemberAvatar src={r.member.photoUrl} name={r.member.client.name} size={36} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{r.member.client.name}</p>
              <p className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground tabular-nums">{r.amountText}</span>
                {[r.planName, r.bank, r.reference && `Referencia ${r.reference}`, when(r.createdAt)].filter(Boolean).map((t) => ` · ${t}`).join("")}
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" className="gap-1 text-rose-600" onClick={() => setRejecting(r)}><IconX size={14} /> Rechazar</Button>
              <Button
                size="sm"
                className="gap-1"
                onClick={async () => {
                  try {
                    await gymApi(`/reported-payments/${r.id}/review`, { method: "POST", json: { status: "CONFIRMED" } });
                    toast.success("Pago confirmado: registra ahora la renovación");
                    router.push(`/dashboard/gimnasio/socios?socio=${r.member.id}`);
                  } catch (e) {
                    toast.error((e as Error).message);
                  }
                }}
              >
                <IconCheck size={14} /> Registrar renovación
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
      <ConfirmDialog
        open={!!rejecting}
        danger
        title="¿Rechazar este pago?"
        description="Úsalo cuando el pago no aparece en el banco o el monto no coincide. Escríbele al socio para avisarle."
        confirmLabel="Rechazar pago"
        reason={{ label: "Motivo", suggestions: ["No llegó al banco", "Monto incompleto", "Referencia no coincide"], required: true }}
        onConfirm={async (note) => {
          if (!rejecting) return;
          await gymApi(`/reported-payments/${rejecting.id}/review`, { method: "POST", json: { status: "REJECTED", note } });
          toast.success("Pago rechazado");
          load();
        }}
        onClose={() => setRejecting(null)}
      />
    </Card>
  );
}
