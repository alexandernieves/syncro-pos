"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { API_URL } from "@/lib/constants"
import { 
  Card, CardContent, CardHeader, CardTitle, CardDescription 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  IconBell, IconShoppingCart, IconReload
} from "@tabler/icons-react";
import { toast } from "sonner";
import { UniversalTable } from "@/components/universal-table";
import { alertsColumns, AlertData } from "@/components/alerts-columns";
import { Skeleton } from "@/components/ui/skeleton";

const API = API_URL;

export default function AlertasPage() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const currentBranchId = localStorage.getItem("currentBranchId") || "";
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/products?branchId=${currentBranchId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const products = await res.json();
        const lowStock = products.filter((p: any) => p.status === 'LOW' || p.status === 'CRITICAL');
        setAlerts(lowStock);
      }
    } catch (error) {
      toast.error("Error al cargar alertas");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const tableData = useMemo<AlertData[]>(() => {
    return alerts.map(p => ({
      id: p.id,
      header: p.name,
      status: p.status === 'CRITICAL' ? 'Sin Stock' : 'Stock Bajo',
      target: p.totalStock,
      limit: p.variants[0]?.minStock || 5,
      category: p.category?.name || 'General'
    }));
  }, [alerts]);

  return (
    <div className="flex flex-col gap-6 py-4 md:gap-8 md:py-6 font-sans px-4 lg:px-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2 uppercase">
            <IconBell className="text-foreground/80" /> Alertas de Reabastecimiento
          </h1>
          <p className="text-sm text-muted-foreground font-medium">Productos que requieren atención inmediata en esta sucursal.</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} disabled={loading} className="gap-2 font-bold shadow-sm h-9">
            <IconReload size={16} />
            Recargar
        </Button>
      </div>

      <div className="w-full">
        {loading ? (
            <div className="space-y-4">
                <Skeleton className="h-10 w-full rounded-xl" />
                <Skeleton className="h-[400px] w-full rounded-2xl" />
            </div>
        ) : tableData.length === 0 ? (
          <Card className="border border-dashed bg-muted/30 shadow-none rounded-[2rem] transition-all">
            <CardContent className="flex flex-col items-center justify-center py-24 text-center">
              <div className="bg-background border shadow-sm p-5 rounded-2xl mb-6 text-muted-foreground/60">
                <IconShoppingCart size={32} />
              </div>
              <h3 className="text-lg font-bold tracking-tight">Inventario Saludable</h3>
              <p className="text-sm text-muted-foreground max-w-xs mt-1.5 font-medium leading-relaxed opacity-70">
                No hay alertas de reabastecimiento pendientes. Todos los productos superan el stock mínimo.
              </p>
            </CardContent>
          </Card>
        ) : (
          <UniversalTable 
            data={tableData} 
            columns={alertsColumns}
            hideAddButton={true}
            tabs={{
                outline: "Críticas",
                pastPerformance: "Pendientes",
                keyPersonnel: "Historial",
                focusDocuments: "Reporte"
            }}
          />
        )}
      </div>
    </div>
  );
}
