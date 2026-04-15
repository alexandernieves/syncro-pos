"use client";
import { Card, CardContent } from "@/components/ui/card";
import { IconCash } from "@tabler/icons-react";

export default function ContabilidadPage() {
  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div><h1 className="text-2xl font-bold">Contabilidad</h1><p className="text-muted-foreground text-sm">Gestión financiera y balances</p></div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {["Ingresos del Mes", "Egresos del Mes", "Balance Neto"].map(t => (
          <Card key={t}>
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">{t}</p>
              <p className="text-3xl font-bold mt-1">$0.00</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card><CardContent className="p-6 text-center text-muted-foreground py-16"><IconCash size={48} className="mx-auto mb-4 opacity-20"/><p>El módulo de contabilidad se activará con las primeras ventas registradas.</p></CardContent></Card>
    </div>
  );
}
