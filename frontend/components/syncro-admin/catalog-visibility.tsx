"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { adminApi } from "@/lib/syncro-admin";

type CatalogModule = { code: string; name: string; private: boolean };

export function CatalogVisibility() {
  const [modules, setModules] = useState<CatalogModule[]>([]);
  const [saving, setSaving] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  function load() {
    setStatus("loading");
    adminApi<CatalogModule[]>("/modules/catalog")
      .then((catalog) => { setModules(catalog); setStatus("ready"); })
      .catch(() => setStatus("error"));
  }

  useEffect(load, []);

  async function setPrivate(module: CatalogModule, isPrivate: boolean) {
    setSaving(module.code);
    try {
      const saved = await adminApi<Pick<CatalogModule, "code" | "private">>(`/modules/catalog/${encodeURIComponent(module.code)}`, {
        method: "PUT",
        body: JSON.stringify({ private: isPrivate }),
      });
      setModules((current) => current.map((item) => item.code === saved.code ? { ...item, private: saved.private } : item));
      toast.success(saved.private ? `${module.name} ahora es privado` : `${module.name} ahora es público`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo cambiar la visibilidad");
    } finally {
      setSaving(null);
    }
  }

  return (
    <section className="space-y-3 rounded-xl border bg-card p-4">
      <div>
        <h2 className="text-base font-semibold">Visibilidad del catálogo</h2>
        <p className="text-sm text-muted-foreground">Los módulos privados se ocultan de la Tienda. Puedes activarlos desde la ficha de un negocio.</p>
      </div>
      {status === "loading" && <p role="status" className="text-sm text-muted-foreground">Cargando módulos…</p>}
      {status === "error" && <button type="button" className="text-sm underline" onClick={load}>Error al cargar los módulos. Reintentar</button>}
      {status === "ready" && modules.map((module) => (
        <div key={module.code} className="flex items-center justify-between gap-3 border-t pt-3">
          <label htmlFor={`catalog-private-${module.code}`} className="text-sm font-medium">{module.name}</label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{module.private ? "Privado" : "Público"}</span>
            <Switch
              id={`catalog-private-${module.code}`}
              aria-label={`Hacer privado el módulo ${module.name}`}
              checked={module.private}
              disabled={saving !== null}
              onCheckedChange={(checked) => { void setPrivate(module, checked); }}
            />
          </div>
        </div>
      ))}
    </section>
  );
}
