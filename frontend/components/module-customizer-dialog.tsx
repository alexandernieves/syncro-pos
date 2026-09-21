"use client";

import React, { useState, useEffect } from "react";
import { API_URL } from "@/lib/constants";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  IconBuildingStore,
  IconShirt,
  IconLayoutGrid,
  IconShoppingCart,
  IconPackage,
  IconBox,
  IconTruck,
  IconUsers,
  IconWallet,
  IconCash,
  IconReportAnalytics,
  IconHistory,
  IconBrandWhatsapp,
  IconAdjustmentsHorizontal,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface ModuleDefinition {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  category: "operacion" | "gestion" | "ventas";
  isCore?: boolean;
}

export const ALL_MODULES: ModuleDefinition[] = [
  {
    id: "pos",
    name: "Punto de Venta (POS)",
    description: "Caja rápida y cobro multimoneda.",
    icon: IconShoppingCart,
    category: "operacion",
    isCore: true,
  },
  {
    id: "products",
    name: "Catálogo de Productos",
    description: "Artículos, variantes y precios.",
    icon: IconPackage,
    category: "gestion",
    isCore: true,
  },
  {
    id: "inventory",
    name: "Inventario y Almacén",
    description: "Kardex y control de stock.",
    icon: IconBox,
    category: "gestion",
  },
  {
    id: "clients",
    name: "Clientes y Directorio",
    description: "Registro de clientes frecuentes y fidelización.",
    icon: IconUsers,
    category: "ventas",
  },
  {
    id: "credit",
    name: "Syncro Credit (Fiado & Cuotas)",
    description: "Fiado y planes de cuotas.",
    icon: IconWallet,
    category: "ventas",
  },
  {
    id: "suppliers",
    name: "Proveedores y Compras",
    description: "Compras y facturas por pagar.",
    icon: IconTruck,
    category: "gestion",
  },
  {
    id: "accounting",
    name: "Contabilidad y Caja Chica",
    description: "Gastos y cierres de turno.",
    icon: IconCash,
    category: "operacion",
  },
  {
    id: "reports",
    name: "Reportes y Métricas",
    description: "Ventas, rentabilidad y estadísticas.",
    icon: IconReportAnalytics,
    category: "operacion",
  },
  {
    id: "historial",
    name: "Historial de Ventas",
    description: "Transacciones, tickets y devoluciones.",
    icon: IconHistory,
    category: "operacion",
  },
  {
    id: "whatsapp",
    name: "WhatsApp CRM",
    description: "Pedidos y atención por chat.",
    icon: IconBrandWhatsapp,
    category: "ventas",
  },
  {
    id: "deliveries",
    name: "Delivery y Despachos",
    description: "Órdenes y rutas a domicilio.",
    icon: IconTruck,
    category: "operacion",
  },
];

export const PRESET_DEFINITIONS: Record<
  string,
  {
    title: string;
    subtitle: string;
    icon: React.ComponentType<{ className?: string }>;
    modules: string[];
  }
> = {
  BODEGA: {
    title: "Bodega / Minimarket",
    subtitle: "Alta rotación y caja rápida.",
    icon: IconBuildingStore,
    modules: [
      "pos",
      "products",
      "inventory",
      "clients",
      "suppliers",
      "accounting",
      "reports",
      "historial",
    ],
  },
  MODA: {
    title: "Tienda de Ropa / Boutique",
    subtitle: "Catálogo visual, tallas y crédito.",
    icon: IconShirt,
    modules: [
      "pos",
      "products",
      "inventory",
      "clients",
      "credit",
      "whatsapp",
      "reports",
      "historial",
    ],
  },
  GENERAL: {
    title: "Retail Completo",
    subtitle: "Todos los módulos activos.",
    icon: IconLayoutGrid,
    modules: ALL_MODULES.map((m) => m.id),
  },
};

interface ModuleCustomizerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentType?: string;
  currentModules?: string[];
  onSaved?: () => void;
}

export function ModuleCustomizerDialog({
  open,
  onOpenChange,
  currentType = "GENERAL",
  currentModules,
  onSaved,
}: ModuleCustomizerDialogProps) {
  const [selectedType, setSelectedType] = useState<string>(currentType);
  const [enabledList, setEnabledList] = useState<string[]>(
    currentModules && currentModules.length > 0
      ? currentModules
      : PRESET_DEFINITIONS.GENERAL.modules
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setSelectedType(currentType || "GENERAL");
      if (currentModules && currentModules.length > 0) {
        setEnabledList(currentModules);
      } else {
        const preset = PRESET_DEFINITIONS[currentType] || PRESET_DEFINITIONS.GENERAL;
        setEnabledList(preset.modules);
      }
    }
  }, [open, currentType, currentModules]);

  const handleToggleModule = (moduleId: string) => {
    // Los módulos core no se pueden desactivar
    const mod = ALL_MODULES.find((m) => m.id === moduleId);
    if (mod?.isCore) {
      toast.warning("Este módulo es esencial para el funcionamiento básico del sistema");
      return;
    }

    setEnabledList((prev) => {
      const exists = prev.includes(moduleId);
      if (exists) {
        return prev.filter((id) => id !== moduleId);
      } else {
        return [...prev, moduleId];
      }
    });
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/settings`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({
          businessType: selectedType,
          enabledModules: enabledList,
        }),
      });

      if (!res.ok) {
        throw new Error("No se pudo guardar la configuración de módulos");
      }

      // Guardar en cache local para reflejo inmediato
      localStorage.setItem("businessType", selectedType);
      localStorage.setItem("enabledModules", JSON.stringify(enabledList));

      // Disparar evento global para que el sidebar y otras vistas se actualicen al instante
      window.dispatchEvent(new Event("settingsUpdated"));

      toast.success("¡Espacio de trabajo actualizado!", {
        description: "Tu menú y herramientas ahora se adaptan a tu negocio.",
      });

      if (onSaved) onSaved();
      onOpenChange(false);
    } catch (err: any) {
      toast.error("Error al guardar:", {
        description: err.message || "Verifica tu conexión",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[94vh] overflow-y-auto rounded-2xl border-border/70 bg-[#f8f9fb] p-6 dark:bg-[#171b2b]">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-lg border border-border/70 bg-card text-foreground">
              <IconAdjustmentsHorizontal className="size-4.5" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">Espacio de trabajo</DialogTitle>
              <DialogDescription className="flex items-center gap-1.5 text-xs text-muted-foreground">
                Módulos activos para{" "}
                <span className="font-medium text-foreground">
                  {PRESET_DEFINITIONS[selectedType]?.title}
                </span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Separator className="my-4" />

        {/* MODULOS */}
        <div className="space-y-2.5">
          <span className="text-xs font-medium text-muted-foreground">
            Módulos ({enabledList.length}/{ALL_MODULES.length})
          </span>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {ALL_MODULES.map((mod) => {
              const Icon = mod.icon;
              const isChecked = enabledList.includes(mod.id);

              return (
                <div
                  key={mod.id}
                  onClick={() => handleToggleModule(mod.id)}
                  className={cn(
                    "flex items-center justify-between gap-2 rounded-xl border p-2.5 transition-colors cursor-pointer select-none",
                    isChecked
                      ? "border-border/70 bg-card"
                      : "border-border/40 bg-transparent opacity-55 hover:opacity-90"
                  )}
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Icon className="size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-xs font-medium text-foreground">
                          {mod.name}
                        </p>
                        {mod.isCore && (
                          <Badge variant="secondary" className="h-4 px-1 py-0 text-[9px]">
                            Esencial
                          </Badge>
                        )}
                      </div>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {mod.description}
                      </p>
                    </div>
                  </div>

                  <Switch
                    checked={isChecked}
                    disabled={mod.isCore}
                    onCheckedChange={() => handleToggleModule(mod.id)}
                    className="shrink-0"
                  />
                </div>
              );
            })}
          </div>
        </div>

        <DialogFooter className="mt-5 flex-row justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
