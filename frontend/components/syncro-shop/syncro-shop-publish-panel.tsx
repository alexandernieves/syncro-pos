"use client";

import { IconBuildingStore, IconStarFilled } from "@tabler/icons-react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type SyncroShopPublishPanelProps = {
  published: boolean;
  featured: boolean;
  onPublishedChange: (value: boolean) => void;
  onFeaturedChange: (value: boolean) => void;
  /** Branch the product is already published from, if any. */
  originBranchName?: string | null;
  /** Branch selected right now: a new publication sells from it. */
  currentBranchName?: string | null;
  /** Featured products of the business, not counting this one. */
  featuredCount: number;
  maxFeatured: number;
};

export function SyncroShopPublishPanel({
  published,
  featured,
  onPublishedChange,
  onFeaturedChange,
  originBranchName,
  currentBranchName,
  featuredCount,
  maxFeatured,
}: SyncroShopPublishPanelProps) {
  const sellsFrom = originBranchName || currentBranchName;
  const featuredFull = !featured && featuredCount >= maxFeatured;

  return (
    <div className="rounded-xl border border-border/60 bg-muted/10 divide-y divide-border/60">
      <div className="flex items-center justify-between gap-3 p-3.5">
        <div className="space-y-0.5">
          <Label htmlFor="edit-syncro-shop-switch" className="font-bold text-xs cursor-pointer flex items-center gap-1.5 text-foreground">
            <IconBuildingStore size={14} className="text-primary" /> Publicar en Syncro Shop
          </Label>
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            {published && sellsFrom
              ? <>Los pedidos en línea se descuentan del stock de <span className="font-semibold text-foreground">{sellsFrom}</span>.</>
              : "Muestra y vende este producto en tu tienda Syncro Shop."}
          </p>
        </div>
        <Switch
          id="edit-syncro-shop-switch"
          checked={published}
          onCheckedChange={(value) => {
            onPublishedChange(value);
            if (!value) onFeaturedChange(false);
          }}
          className="data-[state=checked]:bg-primary shrink-0"
        />
      </div>

      <div className={cn("flex items-center justify-between gap-3 p-3.5", !published && "opacity-50")}>
        <div className="space-y-0.5">
          <Label htmlFor="edit-syncro-featured-switch" className="font-bold text-xs cursor-pointer flex items-center gap-1.5 text-foreground">
            <IconStarFilled size={13} className="text-amber-500" /> Producto destacado
          </Label>
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            {!published
              ? "Publica el producto para poder destacarlo."
              : featuredFull
                ? `Ya tienes ${maxFeatured} destacados. Quita uno para destacar este.`
                : `Aparece en el carrusel de tu tienda. Usados: ${featuredCount + (featured ? 1 : 0)} de ${maxFeatured}.`}
          </p>
        </div>
        <Switch
          id="edit-syncro-featured-switch"
          checked={featured}
          disabled={!published || featuredFull}
          onCheckedChange={onFeaturedChange}
          className="data-[state=checked]:bg-amber-500 shrink-0"
        />
      </div>
    </div>
  );
}
