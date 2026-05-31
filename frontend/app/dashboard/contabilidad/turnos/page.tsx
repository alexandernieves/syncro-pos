"use client";

import React, { useState, useEffect, useCallback } from "react";
import { API_URL } from "@/lib/constants";
import { 
  Card, CardContent, CardHeader, CardTitle, CardDescription 
} from "@/components/ui/card";
import { 
  Badge 
} from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  IconCalculator, IconCalendar, IconUser, IconAlertCircle, IconCheck, IconX, IconRefresh
} from "@tabler/icons-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const API = API_URL;

export default function TurnosPage() {
  const [shifts, setShifts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalAudits, setTotalAudits] = useState({ perfect: 0, missing: 0, surplus: 0 });

  const currentBranchId = typeof window !== 'undefined' ? localStorage.getItem("currentBranchId") : "";

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/shifts`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        const allShifts = await res.json();
        // Filter by current branch for clean organization
        const branchShifts = allShifts.filter((s: any) => s.branchId === currentBranchId);
        setShifts(branchShifts);

        // Calculate audit summary stats
        let perfect = 0;
        let missing = 0;
        let surplus = 0;
        branchShifts.forEach((s: any) => {
          if (s.status === 'CLOSED') {
            const diff = s.difference || 0;
            if (Math.abs(diff) < 0.01) perfect++;
            else if (diff < 0) missing++;
            else surplus++;
          }
        });
        setTotalAudits({ perfect, missing, surplus });
      } else {
        toast.error("Error al cargar el historial de turnos");
      }
    } catch (error) {
      toast.error("Error de conexión");
    } finally {
      setLoading(false);
    }
  }, [currentBranchId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="flex flex-col gap-6 py-4 md:gap-8 md:py-6 font-sans px-4 lg:px-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cierres de Caja y Turnos</h1>
          <p className="text-muted-foreground">Historial de auditorías y cuadres de caja de la sucursal actual.</p>
        </div>
        <Button 
          variant="outline" 
          onClick={loadData} 
          disabled={loading}
          className="rounded-xl border-zinc-200 dark:border-zinc-800"
        >
          <IconRefresh className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Sincronizar
        </Button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-none bg-emerald-500/5 dark:bg-emerald-500/10 shadow-none rounded-2xl flex items-center p-4 gap-4">
          <div className="bg-emerald-500/20 p-3 rounded-xl">
            <IconCheck className="text-emerald-600 size-6" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold tracking-wider text-emerald-600 dark:text-emerald-400">Cuadres Perfectos</p>
            <h3 className="text-2xl font-black text-emerald-700 dark:text-emerald-500">{totalAudits.perfect}</h3>
          </div>
        </Card>

        <Card className="border-none bg-rose-500/5 dark:bg-rose-500/10 shadow-none rounded-2xl flex items-center p-4 gap-4">
          <div className="bg-rose-500/20 p-3 rounded-xl">
            <IconX className="text-rose-600 size-6" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold tracking-wider text-rose-600 dark:text-rose-400">Turnos con Faltantes</p>
            <h3 className="text-2xl font-black text-rose-700 dark:text-rose-500">{totalAudits.missing}</h3>
          </div>
        </Card>

        <Card className="border-none bg-indigo-500/5 dark:bg-indigo-500/10 shadow-none rounded-2xl flex items-center p-4 gap-4">
          <div className="bg-indigo-500/20 p-3 rounded-xl">
            <IconAlertCircle className="text-indigo-600 size-6" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold tracking-wider text-indigo-600 dark:text-indigo-400">Turnos con Sobrantes</p>
            <h3 className="text-2xl font-black text-indigo-700 dark:text-indigo-500">{totalAudits.surplus}</h3>
          </div>
        </Card>
      </div>

      {/* Main shifts list */}
      <Card className="border-none bg-white dark:bg-zinc-900 shadow-sm rounded-2xl overflow-hidden">
        <CardHeader>
          <CardTitle>Historial de Auditorías de Caja</CardTitle>
          <CardDescription>Consulte los saldos de apertura, reportados por el personal, y diferencias calculadas por el sistema.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b text-xs font-bold text-muted-foreground uppercase bg-zinc-50/50 dark:bg-zinc-800/20">
                  <th className="py-4 px-4">Fecha y Hora</th>
                  <th className="py-4 px-4">Cajero</th>
                  <th className="py-4 px-4 text-right">Apertura</th>
                  <th className="py-4 px-4 text-right">Esperado</th>
                  <th className="py-4 px-4 text-right">Contado / Reportado</th>
                  <th className="py-4 px-4 text-center">Resultado / Diferencia</th>
                  <th className="py-4 px-4 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y text-sm">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-muted-foreground opacity-60">
                      Cargando registros contables...
                    </td>
                  </tr>
                ) : shifts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-muted-foreground">
                      No hay registros de turnos de caja en esta sucursal.
                    </td>
                  </tr>
                ) : (
                  shifts.map((s) => {
                    const diff = s.difference || 0;
                    const isClosed = s.status === 'CLOSED';
                    
                    return (
                      <tr key={s.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/10 transition-colors">
                        <td className="py-4 px-4">
                          <div className="flex flex-col">
                            <span className="font-medium text-foreground flex items-center gap-1.5">
                              <IconCalendar size={14} className="text-muted-foreground" />
                              {format(new Date(s.openedAt), "dd/MM/yyyy HH:mm")}
                            </span>
                            <span className="text-[10px] text-muted-foreground ml-5">
                              Cierre: {s.closedAt ? format(new Date(s.closedAt), "dd/MM/yyyy HH:mm") : "-"}
                            </span>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <span className="font-semibold text-foreground flex items-center gap-1.5">
                            <IconUser size={14} className="text-muted-foreground" />
                            {s.user?.name || "Cajero"}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right font-semibold tabular-nums text-muted-foreground">
                          ${s.openingBalance?.toFixed(2)}
                        </td>
                        <td className="py-4 px-4 text-right font-bold tabular-nums text-foreground">
                          ${isClosed ? s.expectedBalance?.toFixed(2) : "-"}
                        </td>
                        <td className="py-4 px-4 text-right font-black tabular-nums text-foreground">
                          ${isClosed ? s.closingBalance?.toFixed(2) : "-"}
                        </td>
                        <td className="py-4 px-4 text-center">
                          {!isClosed ? (
                            <Badge variant="outline" className="border-blue-500/20 text-blue-600 bg-blue-500/5 font-semibold text-xs rounded-lg">
                              Activo en curso
                            </Badge>
                          ) : Math.abs(diff) < 0.01 ? (
                            <Badge variant="outline" className="border-zinc-200 dark:border-zinc-800 text-muted-foreground font-semibold text-xs rounded-lg">
                              $0.00 (Cuadrado)
                            </Badge>
                          ) : diff < 0 ? (
                            <Badge variant="outline" className="border-rose-500/20 text-rose-600 bg-rose-500/5 font-black text-xs rounded-lg">
                              -${Math.abs(diff).toFixed(2)} (Faltante)
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-emerald-500/20 text-emerald-600 bg-emerald-500/5 font-black text-xs rounded-lg">
                              +${diff.toFixed(2)} (Sobrante)
                            </Badge>
                          )}
                        </td>
                        <td className="py-4 px-4 text-center">
                          {s.status === 'OPEN' ? (
                            <Badge className="bg-blue-500 hover:bg-blue-600 font-bold rounded-lg text-[10px] uppercase">
                              Abierto
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="font-bold rounded-lg text-[10px] uppercase">
                              Cerrado
                            </Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
