"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { IconEye, IconEyeOff, IconRosetteDiscountCheck, IconStarFilled } from "@tabler/icons-react";
import { toast } from "sonner";
import { API_URL } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { PosTable } from "@/components/pos-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Review = {
  id: string;
  rating: number;
  comment: string | null;
  isHidden: boolean;
  isVerifiedPurchase: boolean;
  createdAt: string;
  customerName: string;
  product: { id: string; name: string; image: string | null };
};

const FILTERS: [string, string][] = [["all", "Todas"], ["low", "1 y 2 estrellas"], ["hidden", "Ocultas"]];

/** Reviews of the business's products; offensive ones can be hidden from Syncro Shop. */
export function ReviewsModeration() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/storefront/admin/reviews`, { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });
      if (res.ok) setReviews(await res.json());
    } catch {
      toast.error("No se pudieron cargar las reseñas");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const toggle = async (review: Review) => {
    try {
      const res = await fetch(`${API_URL}/storefront/admin/reviews/${review.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` },
        body: JSON.stringify({ hidden: !review.isHidden }),
      });
      if (!res.ok) throw new Error();
      setReviews((prev) => prev.map((r) => (r.id === review.id ? { ...r, isHidden: !r.isHidden } : r)));
      toast.success(review.isHidden ? "La reseña vuelve a verse en Syncro Shop" : "Reseña oculta de Syncro Shop");
    } catch {
      toast.error("No se pudo actualizar la reseña");
    }
  };

  const visible = reviews.filter((r) => !r.isHidden);
  const average = visible.length ? visible.reduce((s, r) => s + r.rating, 0) / visible.length : 0;
  const filtered = useMemo(() => reviews.filter((r) =>
    filter === "low" ? r.rating <= 2 : filter === "hidden" ? r.isHidden : true,
  ), [reviews, filter]);

  const columns: ColumnDef<Review>[] = [
    {
      id: "product",
      accessorFn: (r) => r.product.name,
      header: "Producto",
      cell: ({ row }) => (
        <div className="flex items-center gap-2.5 max-w-[220px]">
          <div className="size-10 shrink-0 rounded-lg border bg-white overflow-hidden">
            {row.original.product.image && <img src={row.original.product.image} alt="" className="size-full object-contain" />}
          </div>
          <span className="text-sm font-medium truncate">{row.original.product.name}</span>
        </div>
      ),
    },
    {
      accessorKey: "rating",
      header: "Estrellas",
      cell: ({ row }) => (
        <span className="flex">
          {[1, 2, 3, 4, 5].map((n) => <IconStarFilled key={n} size={13} className={n <= row.original.rating ? "text-amber-400" : "text-muted"} />)}
        </span>
      ),
    },
    {
      accessorKey: "comment",
      header: "Comentario",
      cell: ({ row }) => (
        <div className="max-w-[360px] space-y-1">
          <p className={cn("text-sm", !row.original.comment && "text-muted-foreground italic")}>{row.original.comment || "Sin comentario"}</p>
          <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
            {row.original.customerName}
            {row.original.isVerifiedPurchase && <span className="inline-flex items-center gap-0.5 text-emerald-600 font-semibold"><IconRosetteDiscountCheck size={12} /> Compra verificada</span>}
          </p>
        </div>
      ),
    },
    {
      accessorKey: "createdAt",
      header: "Fecha",
      cell: ({ row }) => <span className="text-xs text-muted-foreground whitespace-nowrap">{format(new Date(row.original.createdAt), "d MMM yyyy", { locale: es })}</span>,
    },
    {
      id: "status",
      header: "Estado",
      cell: ({ row }) => row.original.isHidden
        ? <Badge variant="outline" className="bg-muted text-muted-foreground">Oculta</Badge>
        : <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 border-emerald-500/30">Visible</Badge>,
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => toggle(row.original)}>
            {row.original.isHidden ? <><IconEye size={14} /> Mostrar</> : <><IconEyeOff size={14} /> Ocultar</>}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 rounded-xl border px-4 py-2.5">
          <IconStarFilled size={18} className="text-amber-400" />
          <span className="text-xl font-bold tabular-nums">{average ? average.toFixed(1) : "—"}</span>
          <span className="text-xs text-muted-foreground">Promedio de {visible.length} reseñas visibles</span>
        </div>
        <div className="flex gap-2">
          {FILTERS.map(([key, label]) => (
            <button key={key} onClick={() => setFilter(key)} className={cn("h-7 px-3 rounded-full border text-xs font-semibold", filter === key ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground hover:text-foreground")}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Las reseñas las escriben clientes con cuenta en Syncro Shop. Ocultar no las borra: dejan de verse en la tienda y puedes volver a mostrarlas.
      </p>
      <PosTable columns={columns} data={filtered} loading={loading} searchPlaceholder="Buscar por producto, cliente o comentario..." getRowId={(r) => r.id} />
    </div>
  );
}
