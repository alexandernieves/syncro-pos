"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Download } from "lucide-react";
import { NubiFace } from "@/components/portal/nubi-face";
import { Button } from "@/components/ui/button";

interface InstallEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function FinanceInstallation() {
  const [offer, setOffer] = useState<InstallEvent>();
  const [installed, setInstalled] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) {
      setInstalled(true);
      return;
    }

    function handleOffer(event: Event) {
      event.preventDefault();
      setOffer(event as InstallEvent);
    }
    function handleInstalled() {
      setInstalled(true);
      setOffer(undefined);
    }

    window.addEventListener("beforeinstallprompt", handleOffer);
    window.addEventListener("appinstalled", handleInstalled);
    const manifest = document.createElement("link");
    manifest.rel = "manifest";
    manifest.href = "/manifest-finanzas.json";
    document.head.append(manifest);

    return () => {
      manifest.remove();
      window.removeEventListener("beforeinstallprompt", handleOffer);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  async function install() {
    if (!offer) {
      setShowHelp(true);
      return;
    }
    setOffer(undefined);
    try {
      await offer.prompt();
      setInstalled((await offer.userChoice).outcome === "accepted");
    } catch {
      setShowHelp(true);
    }
  }

  return <main className="mx-auto max-w-md px-4 pb-6 pt-[calc(env(safe-area-inset-top)+24px)]">
    <div className="space-y-4 rounded-[28px] border bg-card p-5 shadow-sm sm:p-8">
      <NubiFace className="size-[72px]" mood="happy" />
      <h1 className="text-2xl font-semibold">{installed ? "Syncro Finanzas instalada" : "Instalar Syncro Finanzas"}</h1>
      {!installed && <p className="text-muted-foreground">Agrega Finanzas a la pantalla de inicio de tu teléfono.</p>}
      <div className="flex flex-wrap gap-2">
        {!installed && <Button type="button" className="rounded-full" onClick={() => void install()}><Download /> Instalar</Button>}
        <Button asChild className="rounded-full" variant={installed ? "default" : "outline"}><Link href="/finanzas/">Abrir Finanzas</Link></Button>
      </div>
      {!installed && showHelp && <div className="space-y-2 rounded-xl border p-4 text-sm">
        <p><strong>iPhone:</strong> abre esta página en Safari y pulsa Compartir → Añadir a pantalla de inicio.</p>
        <p><strong>Android:</strong> abre esta página en Chrome y elige Instalar aplicación o Añadir a pantalla de inicio en el menú.</p>
      </div>}
    </div>
  </main>;
}
