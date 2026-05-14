"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { IconDeviceMobileDown } from "@tabler/icons-react";

export function PWAInstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handler);

    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setDeferredPrompt(null);
    }
  };

  if (isInstalled || !deferredPrompt) return null;

  return (
    <Button
      onClick={handleInstall}
      variant="outline"
      size="sm"
      className="w-full mt-2 gap-2 bg-primary/5 border-primary/20 hover:bg-primary/10 text-primary font-semibold text-[11px] h-8 rounded-lg"
    >
      <IconDeviceMobileDown size={14} />
      Instalar App de Chat
    </Button>
  );
}
