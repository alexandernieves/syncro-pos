"use client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { IconClipboardCheck } from "@tabler/icons-react";

export default function ConteoPage() {
  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div className="flex justify-between items-center">
        <div><h1 className="text-2xl font-bold">Conteo de Inventario</h1><p className="text-muted-foreground text-sm">Realiza un conteo físico y compara con el sistema</p></div>
        <Button className="gap-2"><IconClipboardCheck size={16}/>Iniciar Conteo</Button>
      </div>
      <Card><CardContent className="p-6 text-center text-muted-foreground py-20">
        <IconClipboardCheck size={48} className="mx-auto mb-4 opacity-20"/>
        <p className="text-lg font-medium mb-2">Sin conteos activos</p>
        <p className="text-sm">Inicia un nuevo conteo para verificar el stock físico contra el registrado.</p>
      </CardContent></Card>
    </div>
  );
}
