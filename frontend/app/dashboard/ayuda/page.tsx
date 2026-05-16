import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { IconHelp, IconMessageCircle, IconBook } from "@tabler/icons-react";

export default function HelpPage() {
  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
          <IconHelp size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Centro de Ayuda</h1>
          <p className="text-muted-foreground">Estamos aquí para ayudarte a sacar el máximo provecho de SYNCRO POS.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="hover:border-primary/50 transition-colors cursor-pointer group">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 group-hover:text-primary transition-colors">
              <IconBook size={20} />
              Documentación
            </CardTitle>
            <CardDescription>
              Aprende a usar todas las funcionalidades de la plataforma.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Guías detalladas sobre inventario, ventas, reportes y configuración de facturación.
          </CardContent>
        </Card>

        <Card className="hover:border-primary/50 transition-colors cursor-pointer group">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 group-hover:text-primary transition-colors">
              <IconMessageCircle size={20} />
              Soporte en Vivo
            </CardTitle>
            <CardDescription>
              Habla directamente con nuestro equipo técnico.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Resolvemos tus dudas técnicas y problemas de configuración en tiempo real.
          </CardContent>
        </Card>
      </div>

      <Card className="bg-primary/5 border-primary/20">
        <CardHeader>
          <CardTitle className="text-lg">¿No encuentras lo que buscas?</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Nuestro equipo de soporte está disponible de Lunes a Viernes, de 8:00 AM a 6:00 PM.
          </p>
          <button className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity">
            Contactar Soporte
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
