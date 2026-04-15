"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IconReportAnalytics, IconCash, IconShoppingCart, IconUsers } from "@tabler/icons-react";

export default function ReportesPage() {
  const stats = [
    { title: "Ventas del Mes", value: "$0.00", change: "0%", icon: IconCash, color: "text-green-600" },
    { title: "Transacciones", value: "0", change: "0%", icon: IconShoppingCart, color: "text-blue-600" },
    { title: "Clientes Nuevos", value: "0", change: "0%", icon: IconUsers, color: "text-purple-600" },
    { title: "Ticket Promedio", value: "$0.00", change: "0%", icon: IconReportAnalytics, color: "text-orange-600" },
  ];
  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div><h1 className="text-2xl font-bold">Reportes</h1><p className="text-muted-foreground text-sm">Resumen de métricas del negocio</p></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ title, value, change, icon: Icon, color }) => (
          <Card key={title}>
            <CardContent className="flex items-center gap-4 p-5">
              <div className={`${color} bg-muted rounded-xl p-3`}><Icon size={24}/></div>
              <div><p className="text-sm text-muted-foreground">{title}</p><p className="text-2xl font-bold">{value}</p><p className="text-xs text-muted-foreground">{change} vs mes anterior</p></div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card><CardContent className="p-6 text-center text-muted-foreground py-16"><IconReportAnalytics size={48} className="mx-auto mb-4 opacity-20"/><p>Los reportes se generarán conforme se registren ventas.</p></CardContent></Card>
    </div>
  );
}
