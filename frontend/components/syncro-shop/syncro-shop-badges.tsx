"use client";

import { IconBuildingStore, IconStarFilled } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type SyncroShopBadgesProps = {
  published?: boolean;
  featured?: boolean;
  branchName?: string | null;
  /** "solid" for badges over product images, "soft" for lists and tables. */
  tone?: "solid" | "soft";
  className?: string;
};

/** Syncro Shop publication and featured tags, shared by products, inventory and POS. */
export function SyncroShopBadges({ published, featured, branchName, tone = "soft", className }: SyncroShopBadgesProps) {
  if (!published) return null;
  return (
    <div className={cn("flex items-center gap-1 flex-wrap", className)}>
      <Badge
        title={branchName ? `Publicado en Syncro Shop desde ${branchName}` : "Publicado en Syncro Shop"}
        aria-label={branchName ? `Publicado en Syncro Shop desde ${branchName}` : "Publicado en Syncro Shop"}
        className={cn(
          "size-5 p-0 justify-center shadow-none",
          tone === "solid"
            ? "bg-primary text-primary-foreground border-0 shadow-sm"
            : "bg-primary/10 text-primary border-primary/20",
        )}
      >
        <IconBuildingStore size={12} className="shrink-0" />
      </Badge>
      {featured && (
        <Badge
          title="Producto destacado en Syncro Shop"
          aria-label="Producto destacado en Syncro Shop"
          className={cn(
            "size-5 p-0 justify-center shadow-none",
            tone === "solid"
              ? "bg-amber-500 text-white border-0 shadow-sm"
              : "bg-amber-500/10 text-amber-600 border-amber-500/20",
          )}
        >
          <IconStarFilled size={11} />
        </Badge>
      )}
    </div>
  );
}
