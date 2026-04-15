"use client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { IconPackageImport } from "@tabler/icons-react";

export default function IngresoPage() {
  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div className="flex justify-between items-center">
        <div><h1 className="text-2xl font-bold">Ingreso de Mercancía</h1><p className="text-muted-foreground text-sm">Registra la entrada de nuevos productos al almacén</p></div>
        <Button className="gap-2"><IconPackageImport size={16}/>Nuevo Ingreso</Button>
      </div>
      <Card><CardContent className="p-6 text-center text-muted-foreground py-20">
        <IconPackageImport size={48} className="mx-auto mb-4 opacity-20"/>
        <p className="text-lg font-medium mb-2">Sin ingresos recientes</p>
        <p className="text-sm">Registra la entrada de mercancía para actualizar el stock automáticamente.</p>
      </CardContent></Card>
    </div>
  );
}
