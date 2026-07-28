"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { IconArrowLeft, IconSparkles, IconWorld, IconAlertCircle, IconLoader2 } from "@tabler/icons-react";
import { toast } from "sonner";
import { API_URL } from "@/lib/constants";

const LOADING_STEPS = [
  "Estableciendo conexión segura con la tienda...",
  "Extrayendo imágenes y galería del producto...",
  "Analizando las especificaciones técnicas...",
  "Recopilando opiniones y reviews de clientes...",
  "El copiloto de IA está redactando textos persuasivos en español...",
  "Diseñando estructura de conversión, FAQs y ofertas de packs...",
  "¡Todo listo! Cargando editor visual..."
];

export default function CreateLandingPage() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [detectedPlatform, setDetectedPlatform] = useState<"aliexpress" | "amazon" | null>(null);

  useEffect(() => {
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes("aliexpress")) {
      setDetectedPlatform("aliexpress");
    } else if (lowerUrl.includes("amazon")) {
      setDetectedPlatform("amazon");
    } else {
      setDetectedPlatform(null);
    }
  }, [url]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (loading) {
      interval = setInterval(() => {
        setStepIndex((prev) => (prev < LOADING_STEPS.length - 1 ? prev + 1 : prev));
      }, 4000); // Cambia el mensaje de estado cada 4 segundos
    } else {
      setStepIndex(0);
    }
    return () => clearInterval(interval);
  }, [loading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!url) {
      toast.error("Por favor ingresa un enlace válido.");
      return;
    }

    if (!url.includes("aliexpress") && !url.includes("amazon")) {
      toast.error("El enlace debe ser de Amazon o AliExpress.");
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || API_URL}/landings/import`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ url }),
      });

      if (!res.ok) {
        throw new Error("No se pudo importar el producto. Verifica el enlace e intenta de nuevo.");
      }

      const landing = await res.json();
      toast.success("¡Landing page creada con éxito!");
      
      // Redirigir al editor visual
      router.push(`/dashboard/landings/edit/?id=${landing.id}`);
    } catch (error: any) {
      toast.error(error.message || "Error de red al conectar con el servidor.");
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 p-6 md:p-8 max-w-4xl mx-auto space-y-6">
      {/* Back button */}
      <Link
        href="/dashboard/landings"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition"
      >
        <IconArrowLeft className="h-4 w-4" />
        Volver a mis landings
      </Link>

      {!loading ? (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-foreground via-foreground/90 to-muted-foreground bg-clip-text">
              Crear Nueva Landing Page con IA
            </h1>
            <p className="text-sm text-muted-foreground">
              Ingresa el enlace del producto de Amazon o AliExpress. El sistema automatizará el scraping del producto y usará Inteligencia Artificial para redactar tu oferta de venta.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6 rounded-xl border bg-card/60 backdrop-blur-md p-6">
            <div className="space-y-2">
              <label htmlFor="url" className="text-sm font-semibold flex items-center gap-1.5">
                <IconWorld className="h-4 w-4 text-primary" />
                Enlace del Producto (AliExpress / Amazon)
              </label>
              <input
                id="url"
                type="url"
                placeholder="https://es.aliexpress.com/item/... o https://www.amazon.es/..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full rounded-lg border border-input bg-background/50 px-3.5 py-2.5 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                required
              />
            </div>

            {detectedPlatform && (
              <div className={`rounded-xl border p-4 flex items-center gap-3 text-xs leading-relaxed transition-all duration-300 animate-fade-in ${
                detectedPlatform === "aliexpress"
                  ? "bg-orange-500/10 border-orange-500/20 text-orange-700 dark:text-orange-400"
                  : "bg-amber-500/10 border-amber-500/20 text-amber-800 dark:text-amber-400"
              }`}>
                {detectedPlatform === "aliexpress" ? (
                  <>
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-orange-500 to-red-600 text-white font-extrabold shadow-md shadow-orange-500/20 text-xs">
                      Ali
                    </div>
                    <div>
                      <p className="font-extrabold text-foreground">Plataforma Detectada: AliExpress</p>
                      <p className="text-[10px] opacity-90">El sistema extraerá las fotos, precio, variaciones y reviews desde la tienda de AliExpress.</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-zinc-800 to-black text-amber-400 font-extrabold shadow-md shadow-black/20 text-xs border border-amber-500/30">
                      Amz
                    </div>
                    <div>
                      <p className="font-extrabold text-foreground">Plataforma Detectada: Amazon</p>
                      <p className="text-[10px] opacity-90">El sistema extraerá las fotos, precio, variaciones y reviews desde la tienda de Amazon.</p>
                    </div>
                  </>
                )}
              </div>
            )}

            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition"
            >
              <IconSparkles className="h-4 w-4" />
              Generar Landing Page con IA
            </button>
          </form>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center space-y-6 rounded-xl border bg-card/40 backdrop-blur-md">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-primary/20 blur-md animate-pulse"></div>
            <IconLoader2 className="h-12 w-12 animate-spin text-primary relative" />
          </div>
          <div className="space-y-2 max-w-md">
            <h3 className="font-bold text-lg">Importando y Diseñando</h3>
            <p className="text-sm text-primary font-medium min-h-[20px] transition-all duration-300">
              {LOADING_STEPS[stepIndex]}
            </p>
            <p className="text-xs text-muted-foreground pt-4">
              Este proceso puede tardar hasta 30 segundos mientras la IA realiza el análisis semántico y redacta los copies de conversión.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
