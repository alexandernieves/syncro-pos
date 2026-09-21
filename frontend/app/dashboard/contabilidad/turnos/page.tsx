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
  IconCalculator, IconCalendar, IconUser, IconAlertCircle, IconCheck, IconX, IconRefresh, IconEye, IconShieldCheck, IconShieldLock, IconCash
} from "@tabler/icons-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const API = API_URL;

export default function TurnosPage() {
  const [shifts, setShifts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalAudits, setTotalAudits] = useState({ perfect: 0, missing: 0, surplus: 0 });
  const [auditModalShift, setAuditModalShift] = useState<any | null>(null);

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

      {/* Metrics Row - High Contrast Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border border-emerald-500/30 bg-card shadow-xs rounded-2xl flex items-center p-4 gap-4">
          <div className="bg-emerald-500/15 p-3 rounded-xl text-emerald-600 dark:text-emerald-400">
            <IconCheck className="size-6" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold tracking-wider text-emerald-600 dark:text-emerald-400">Cuadres Perfectos</p>
            <h3 className="text-2xl font-black text-foreground">{totalAudits.perfect}</h3>
          </div>
        </Card>

        <Card className="border border-rose-500/30 bg-card shadow-xs rounded-2xl flex items-center p-4 gap-4">
          <div className="bg-rose-500/15 p-3 rounded-xl text-rose-600 dark:text-rose-400">
            <IconX className="size-6" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold tracking-wider text-rose-600 dark:text-rose-400">Turnos con Faltantes</p>
            <h3 className="text-2xl font-black text-foreground">{totalAudits.missing}</h3>
          </div>
        </Card>

        <Card className="border border-blue-500/30 bg-card shadow-xs rounded-2xl flex items-center p-4 gap-4">
          <div className="bg-blue-500/15 p-3 rounded-xl text-blue-600 dark:text-blue-400">
            <IconAlertCircle className="size-6" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold tracking-wider text-blue-600 dark:text-blue-400">Turnos con Sobrantes</p>
            <h3 className="text-2xl font-black text-foreground">{totalAudits.surplus}</h3>
          </div>
        </Card>
      </div>

      {/* Main shifts list - Clean & High Contrast */}
      <Card className="border border-border/80 bg-card shadow-xs rounded-2xl overflow-hidden">
        <CardHeader className="border-b border-border/60 bg-muted/20">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold">Historial de Auditorías de Caja</CardTitle>
              <CardDescription className="text-xs">
                Saldos de apertura, montos declarados por el cajero y diferencias calculadas por el sistema.
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-xs text-primary border-primary/30">
              <IconShieldCheck className="size-3.5 mr-1" /> Control Anti-Robo Activo
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b text-xs font-bold text-muted-foreground uppercase bg-muted/40">
                  <th className="py-3.5 px-4">Fecha y Hora</th>
                  <th className="py-3.5 px-4">Cajero</th>
                  <th className="py-3.5 px-4 text-right">Apertura</th>
                  <th className="py-3.5 px-4 text-right">Esperado</th>
                  <th className="py-3.5 px-4 text-right">Declarado</th>
                  <th className="py-3.5 px-4 text-center">Diferencia</th>
                  <th className="py-3.5 px-4 text-center">Estado</th>
                  <th className="py-3.5 px-4 text-center">Auditoría</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 text-sm">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-muted-foreground opacity-60">
                      Cargando registros contables...
                    </td>
                  </tr>
                ) : shifts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-muted-foreground">
                      No hay registros de turnos de caja en esta sucursal.
                    </td>
                  </tr>
                ) : (
                  shifts.map((s) => {
                    const diff = s.difference || 0;
                    const isClosed = s.status === 'CLOSED';
                    const isBlind = s.declaredDetails?.isBlindClose;
                    
                    return (
                      <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex flex-col">
                            <span className="font-medium text-foreground flex items-center gap-1.5">
                              <IconCalendar size={14} className="text-muted-foreground" />
                              {format(new Date(s.openedAt), "dd/MM/yyyy HH:mm")}
                            </span>
                            <div className="flex items-center gap-1.5 ml-5 mt-0.5">
                              <span className="text-[10px] text-muted-foreground">
                                Cierre: {s.closedAt ? format(new Date(s.closedAt), "HH:mm") : "-"}
                              </span>
                              {isBlind && (
                                <span className="text-[9px] px-1 py-0.2 rounded font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                  Arqueo Ciego
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-semibold text-foreground flex items-center gap-1.5">
                            <IconUser size={14} className="text-muted-foreground" />
                            {s.user?.name || "Cajero"}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-semibold tabular-nums text-muted-foreground">
                          ${s.openingBalance?.toFixed(2)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold tabular-nums text-foreground">
                          ${isClosed ? s.expectedBalance?.toFixed(2) : "-"}
                        </td>
                        <td className="py-3.5 px-4 text-right font-black tabular-nums text-foreground">
                          ${isClosed ? s.closingBalance?.toFixed(2) : "-"}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {!isClosed ? (
                            <Badge variant="outline" className="border-blue-500/30 text-blue-600 dark:text-blue-400 bg-blue-500/10 font-semibold text-xs rounded-lg">
                              Activo
                            </Badge>
                          ) : Math.abs(diff) < 0.01 ? (
                            <Badge variant="outline" className="border-border text-muted-foreground font-semibold text-xs rounded-lg">
                              $0.00 (Cuadrado)
                            </Badge>
                          ) : diff < 0 ? (
                            <Badge variant="outline" className="border-rose-500/30 text-rose-600 dark:text-rose-400 bg-rose-500/10 font-black text-xs rounded-lg">
                              -${Math.abs(diff).toFixed(2)} (Faltante)
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 font-black text-xs rounded-lg">
                              +${diff.toFixed(2)} (Sobrante)
                            </Badge>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {s.status === 'OPEN' ? (
                            <Badge className="bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-[10px] uppercase">
                              Abierto
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="font-bold rounded-lg text-[10px] uppercase">
                              Cerrado
                            </Badge>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {isClosed ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setAuditModalShift(s)}
                              className="h-7 text-xs font-semibold px-2.5 rounded-lg border-border hover:border-primary/50 hover:text-primary"
                            >
                              <IconEye className="size-3.5 mr-1" /> Ver Arqueo
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
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

      {/* DIALOG: AUDITORÍA DETALLADA DEL ARQUEO */}
      <Dialog open={!!auditModalShift} onOpenChange={(open) => !open && setAuditModalShift(null)}>
        <DialogContent className="sm:max-w-[500px] p-6 rounded-2xl bg-card border-border/80 shadow-xl">
          <DialogHeader className="space-y-1">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-lg font-bold flex items-center gap-2">
                <IconShieldCheck className="size-5 text-primary" />
                Auditoría de Turno de Caja
              </DialogTitle>
              {auditModalShift?.declaredDetails?.isBlindClose && (
                <Badge variant="outline" className="text-[10px] text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/5">
                  Arqueo Ciego
                </Badge>
              )}
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              Responsable: <strong>{auditModalShift?.user?.name || "Cajero"}</strong> ({auditModalShift?.user?.email})
            </DialogDescription>
          </DialogHeader>

          {auditModalShift && (
            <div className="space-y-4 py-2 text-sm">
              {/* Resumen Financiero */}
              <div className="p-4 rounded-xl bg-muted/40 border border-border/80 space-y-2.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">Monto de Apertura:</span>
                  <span className="font-semibold text-foreground tabular-nums">${auditModalShift.openingBalance?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">Total Esperado por Sistema:</span>
                  <span className="font-semibold text-foreground tabular-nums">${auditModalShift.expectedBalance?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">Total Contado (Declarado):</span>
                  <span className="font-extrabold text-foreground tabular-nums">${auditModalShift.closingBalance?.toFixed(2)}</span>
                </div>

                <Separator />

                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-foreground">Resultado de Caja:</span>
                  <span className={`text-base font-black tabular-nums ${(auditModalShift.difference || 0) < -0.01
                      ? 'text-rose-500'
                      : (auditModalShift.difference || 0) > 0.01
                        ? 'text-emerald-500'
                        : 'text-foreground'
                    }`}>
                    {((auditModalShift.difference || 0) < -0.01 ? '-$' : '$') + Math.abs(auditModalShift.difference || 0).toFixed(2)}
                    <span className="text-[10px] ml-1 font-bold">
                      {(auditModalShift.difference || 0) < -0.01
                        ? '(Faltante)'
                        : (auditModalShift.difference || 0) > 0.01
                          ? '(Sobrante)'
                          : '(Cuadrado Perfecto)'}
                    </span>
                  </span>
                </div>
              </div>

              {/* Desglose de Billetes Físicos (si existe) */}
              {auditModalShift.cashBreakdown && (
                <div className="p-4 rounded-xl bg-card border border-border/80 space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <IconCash className="size-4 text-primary" /> Desglose de Billetes Declarados (USD)
                  </h4>
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    {[
                      { label: "$100", count: auditModalShift.cashBreakdown.b100 || 0, val: (auditModalShift.cashBreakdown.b100 || 0) * 100 },
                      { label: "$50", count: auditModalShift.cashBreakdown.b50 || 0, val: (auditModalShift.cashBreakdown.b50 || 0) * 50 },
                      { label: "$20", count: auditModalShift.cashBreakdown.b20 || 0, val: (auditModalShift.cashBreakdown.b20 || 0) * 20 },
                      { label: "$10", count: auditModalShift.cashBreakdown.b10 || 0, val: (auditModalShift.cashBreakdown.b10 || 0) * 10 },
                      { label: "$5", count: auditModalShift.cashBreakdown.b5 || 0, val: (auditModalShift.cashBreakdown.b5 || 0) * 5 },
                      { label: "$1", count: auditModalShift.cashBreakdown.b1 || 0, val: (auditModalShift.cashBreakdown.b1 || 0) * 1 },
                    ].map((bill) => (
                      <div key={bill.label} className="p-2 rounded-lg bg-muted/40 border border-border/50 text-center">
                        <span className="text-[10px] font-bold text-muted-foreground block">{bill.label}</span>
                        <span className="text-xs font-bold text-foreground tabular-nums">{bill.count} unids</span>
                        <span className="text-[10px] text-muted-foreground block font-medium">(${bill.val})</span>
                      </div>
                    ))}
                  </div>

                  {auditModalShift.declaredDetails?.cashBs > 0 && (
                    <div className="flex justify-between items-center text-xs pt-2 border-t border-border/50">
                      <span className="text-muted-foreground">Efectivo en Bolívares (Bs):</span>
                      <span className="font-bold text-foreground tabular-nums">
                        Bs {Number(auditModalShift.declaredDetails.cashBs).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <DialogFooter className="border-t pt-3">
            <Button
              variant="outline"
              onClick={() => setAuditModalShift(null)}
              className="w-full sm:w-auto"
            >
              Cerrar Auditoría
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
