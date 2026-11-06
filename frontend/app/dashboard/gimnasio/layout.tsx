"use client";

import Link from "next/link";
import { IconBarbell, IconLoader2, IconMessageCircle, IconSparkles } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { trialDaysLeft, useMyModules } from "@/lib/modules";

/**
 * The gym workspace needs the Gimnasio module, turned on from Syncro central.
 * While it's a trial, a slim notice says how long it lasts.
 */
export default function GymLayout({ children }: { children: React.ReactNode }) {
  const modules = useMyModules();
  const gym = modules?.find((m) => m.code === "gym");

  if (modules === null) {
    return <div className="flex flex-1 items-center justify-center py-24 text-muted-foreground"><IconLoader2 className="animate-spin" /></div>;
  }

  if (!gym?.usable) {
    const paused = gym?.status === "PAUSED";
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="max-w-md text-center">
          <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-muted"><IconBarbell size={28} /></span>
          <h1 className="mt-4 text-xl font-semibold">{paused ? "El módulo Gimnasio está pausado" : "El módulo Gimnasio no está activo"}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {paused
              ? "Tus datos siguen guardados. Escríbenos y lo reactivamos."
              : "Socios, membresías, control de acceso por rostro, clases y más. Escríbenos y te lo activamos para que lo pruebes."}
          </p>
          <Button asChild className="mt-5"><Link href="/dashboard/soporte"><IconMessageCircle size={16} /> Hablar con soporte</Link></Button>
        </div>
      </div>
    );
  }

  const left = gym.status === "TRIAL" ? trialDaysLeft(gym) : null;
  return (
    <>
      {left !== null && (
        <div className="flex flex-wrap items-center gap-2 border-b bg-muted/40 px-4 py-2 text-sm lg:px-6">
          <IconSparkles size={16} className="text-primary" />
          <span>
            {left > 1 ? `Estás probando el módulo Gimnasio: te quedan ${left} días.` : left === 1 ? "Estás probando el módulo Gimnasio: te queda 1 día." : "Tu prueba del módulo Gimnasio terminó. Escríbenos para dejarlo activo."}
          </span>
          <Link href="/dashboard/soporte" className="ml-auto font-medium text-primary hover:underline">¿Te gusta? Cuéntanos</Link>
        </div>
      )}
      {children}
    </>
  );
}
