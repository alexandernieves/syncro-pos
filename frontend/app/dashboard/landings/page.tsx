"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { 
  IconBrowser, 
  IconEdit, 
  IconTrash, 
  IconPlus, 
  IconLoader2, 
  IconWorld, 
  IconShoppingBag, 
  IconEye, 
  IconClick 
} from "@tabler/icons-react";
import { toast } from "sonner";
import { API_URL } from "@/lib/constants";

interface LandingPage {
  id: string;
  title: string;
  slug: string;
  productUrl: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export default function LandingsListPage() {
  const [landings, setLandings] = useState<LandingPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchLandings();
  }, []);

  const fetchLandings = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || API_URL}/landings`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error("No se pudieron cargar las landing pages.");
      }

      const data = await res.json();
      setLandings(data);
    } catch (error: any) {
      toast.error(error.message || "Error al obtener las landing pages.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Estás seguro de que deseas eliminar esta landing page?")) {
      return;
    }

    setDeletingId(id);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || API_URL}/landings/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error("Error al eliminar la landing page.");
      }

      toast.success("Landing page eliminada correctamente.");
      setLandings((prev) => prev.filter((l) => l.id !== id));
    } catch (error: any) {
      toast.error(error.message || "No se pudo eliminar la landing page.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="flex-1 p-6 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-foreground via-foreground/90 to-muted-foreground bg-clip-text">
            Landing Pages con IA
          </h1>
          <p className="text-sm text-muted-foreground">
            Diseña y administra páginas de producto de alta conversión optimizadas para dropshipping y campañas en redes sociales.
          </p>
        </div>
        <Link
          href="/dashboard/landings/create"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary w-fit"
        >
          <IconPlus className="h-4 w-4" />
          Crear Nueva Landing
        </Link>
      </div>

      {/* Grid de Landings */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <IconLoader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Cargando tus landing pages...</p>
        </div>
      ) : landings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center border-2 border-dashed rounded-xl bg-muted/20 gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <IconBrowser className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">No tienes landing pages creadas</h3>
            <p className="text-sm text-muted-foreground max-w-sm mt-1">
              Pon un enlace de Amazon o AliExpress y deja que nuestra Inteligencia Artificial cree una landing de ventas en segundos.
            </p>
          </div>
          <Link
            href="/dashboard/landings/create"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 shadow-sm"
          >
            Importar Primer Producto
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {landings.map((landing) => {
            const publicUrl = `/l/?p=${landing.slug}`;
            
            return (
              <div 
                key={landing.id}
                className="group relative flex flex-col justify-between rounded-xl border bg-card/60 backdrop-blur-md hover:shadow-lg transition duration-200 overflow-hidden"
              >
                {/* Contenido */}
                <div className="p-6 space-y-4">
                  <div className="flex justify-between items-start gap-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                      landing.status === 'PUBLISHED' 
                        ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' 
                        : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                    }`}>
                      {landing.status === 'PUBLISHED' ? 'Publicado' : 'Borrador'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(landing.createdAt).toLocaleDateString('es-ES', {
                        day: 'numeric',
                        month: 'short'
                      })}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-bold text-lg leading-snug group-hover:text-primary transition duration-150 line-clamp-2">
                      {landing.title}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      Slug: {landing.slug}
                    </p>
                  </div>

                  {/* Estadísticas de Conversión Rápidas (Simuladas de Ejemplo) */}
                  <div className="grid grid-cols-3 gap-2 py-2.5 px-3 rounded-lg bg-muted/30 border border-muted/50 text-center">
                    <div className="flex flex-col items-center">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <IconEye className="h-3 w-3" /> Visitas
                      </span>
                      <span className="font-semibold text-sm mt-0.5">--</span>
                    </div>
                    <div className="flex flex-col items-center border-x">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <IconShoppingBag className="h-3 w-3" /> Ventas
                      </span>
                      <span className="font-semibold text-sm mt-0.5">--</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <IconClick className="h-3 w-3" /> Conv.
                      </span>
                      <span className="font-semibold text-sm mt-0.5">--</span>
                    </div>
                  </div>
                </div>

                {/* Acciones */}
                <div className="flex items-center gap-2 p-4 border-t bg-muted/10">
                  <Link
                    href={`/dashboard/landings/edit/?id=${landing.id}`}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold hover:bg-muted text-foreground transition"
                  >
                    <IconEdit className="h-3.5 w-3.5" />
                    Editar
                  </Link>

                  <a
                    href={publicUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center rounded-lg border px-3 py-2 text-xs font-semibold hover:bg-muted text-foreground transition gap-1"
                    title="Ver página pública"
                  >
                    <IconWorld className="h-3.5 w-3.5" />
                    Ver
                  </a>

                  <button
                    onClick={() => handleDelete(landing.id)}
                    disabled={deletingId === landing.id}
                    className="inline-flex items-center justify-center rounded-lg border border-destructive/20 hover:border-destructive/30 px-3 py-2 text-xs font-semibold hover:bg-destructive/10 text-destructive transition"
                    title="Eliminar Landing Page"
                  >
                    {deletingId === landing.id ? (
                      <IconLoader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <IconTrash className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
