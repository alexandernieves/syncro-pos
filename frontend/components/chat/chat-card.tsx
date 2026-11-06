"use client";

import Link from "next/link";
import { IconApps, IconBarbell, IconPuzzle } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/** Steps of a module request, as both sides see them in the chat */
export const REQUEST_STEPS = [
  { key: "REQUESTED", label: "Recibida" },
  { key: "IN_REVIEW", label: "En revisión" },
  { key: "BUILDING", label: "En construcción" },
  { key: "READY", label: "Lista para probar" },
  { key: "DONE", label: "Entregada" },
];
const STEP_LABEL: Record<string, string> = { ...Object.fromEntries(REQUEST_STEPS.map((s) => [s.key, s.label])), REJECTED: "No procede por ahora" };
const MODULE_ICON: Record<string, React.ComponentType<{ size?: number }>> = { gym: IconBarbell };
const MODULE_ROUTE: Record<string, string> = { gym: "/dashboard/gimnasio" };
const KIND_LABEL: Record<string, string> = { CATALOG: "Módulo del catálogo", CUSTOM_MODULE: "Módulo a la medida", CUSTOM_FEATURE: "Función nueva" };

export type CardMeta = {
  card?: "module" | "request";
  // module
  action?: string;
  moduleCode?: string;
  name?: string;
  status?: string;
  trialEndsAt?: string | null;
  // request
  requestId?: string;
  title?: string;
  kind?: string;
  note?: string | null;
  trade?: string | null;
};

const longDate = (d: string) => new Date(d).toLocaleDateString("es-VE", { day: "numeric", month: "long" });

/**
 * A card inside the support chat. `audience` decides the buttons: the business opens its module or
 * its Tienda; the Syncro team opens the request in Solicitudes.
 */
export function ChatCard({ meta, text, audience }: { meta: CardMeta; text?: string | null; audience: "business" | "support" }) {
  if (meta.card === "module") {
    const Icon = (meta.moduleCode && MODULE_ICON[meta.moduleCode]) || IconPuzzle;
    const usable = meta.status === "TRIAL" || meta.status === "ACTIVE";
    const headline =
      meta.action === "TRIAL" ? `${meta.name} en prueba` : meta.action === "EXTEND_TRIAL" ? `Prueba de ${meta.name} extendida` : meta.action === "ACTIVATE" ? `${meta.name} activado` : meta.action === "PAUSE" ? `${meta.name} pausado` : meta.name;
    return (
      <div className="w-full max-w-md space-y-2.5">
        <div className="flex items-center gap-2.5">
          <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", usable ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}><Icon size={18} /></span>
          <div className="min-w-0">
            <p className="font-semibold leading-tight">{headline}</p>
            {meta.status === "TRIAL" && meta.trialEndsAt && <p className="text-xs text-muted-foreground">Hasta el {longDate(meta.trialEndsAt)}</p>}
          </div>
        </div>
        {text && <p className="whitespace-pre-wrap leading-relaxed">{text}</p>}
        {audience === "business" && usable && meta.moduleCode && MODULE_ROUTE[meta.moduleCode] && (
          <Button asChild size="sm"><Link href={MODULE_ROUTE[meta.moduleCode]}>Abrir {meta.name}</Link></Button>
        )}
      </div>
    );
  }

  if (meta.card === "request") {
    const at = REQUEST_STEPS.findIndex((s) => s.key === meta.status);
    return (
      <div className="w-full max-w-md space-y-2.5">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-background text-primary ring-1 ring-border"><IconApps size={18} /></span>
          <div className="min-w-0">
            <p className="truncate font-semibold leading-tight">{meta.title}</p>
            <p className="text-xs text-muted-foreground">{KIND_LABEL[meta.kind ?? ""] ?? "Solicitud"}{meta.trade ? ` · ${meta.trade}` : ""} · {STEP_LABEL[meta.status ?? ""] ?? meta.status}</p>
          </div>
        </div>
        {meta.status !== "REJECTED" && at >= 0 && (
          <div className="grid grid-cols-5 gap-1">
            {REQUEST_STEPS.map((s, i) => <div key={s.key} className={cn("h-1.5 rounded-full", i <= at ? "bg-primary" : "bg-muted")} title={s.label} />)}
          </div>
        )}
        {meta.note ? <p className="whitespace-pre-wrap leading-relaxed">{meta.note}</p> : meta.status === "REQUESTED" && text ? <p className="line-clamp-4 whitespace-pre-wrap leading-relaxed text-muted-foreground">{text.replace(/^[^\n]*\n\n/, "")}</p> : null}
        <Button asChild size="sm" variant="outline">
          <Link href={audience === "business" ? "/dashboard/tienda" : `/dashboard/syncro/requests?id=${meta.requestId}`}>{audience === "business" ? "Ver mi solicitud" : "Abrir solicitud"}</Link>
        </Button>
      </div>
    );
  }

  return <span className="whitespace-pre-wrap leading-relaxed">{text}</span>;
}
