"use client";

import { IconPhoto } from "@tabler/icons-react";

/**
 * Syncro Credit "Para ti": a product ad, like a minimal social post. The product is the star
 * (big, on a soft stage), little text (store tag, name, price) and a background of its own, so
 * every card has its own mood. Used in the PWA and in the Syncro Central preview.
 */
export type AdTheme = "sunset" | "mint" | "sky" | "lavender" | "lemon" | "berry" | "sand" | "night";

export const AD_THEMES: Record<AdTheme, { label: string; bg: string; ink: string; sub: string; stage: string; chip: string; swatch: string }> = {
  sunset: { label: "Atardecer", bg: "radial-gradient(110% 90% at 90% 10%, #FFD9C2 0%, rgba(255,217,194,0) 45%), linear-gradient(150deg, #FFAE84 0%, #F26B3A 100%)", ink: "#FFFFFF", sub: "rgba(255,255,255,0.88)", stage: "rgba(255,255,255,0.3)", chip: "rgba(255,255,255,0.22)", swatch: "#F26B3A" },
  mint: { label: "Menta", bg: "radial-gradient(110% 90% at 90% 10%, #FFFFFF 0%, rgba(255,255,255,0) 50%), linear-gradient(150deg, #E4F7EC 0%, #93D8B4 100%)", ink: "#0E3B26", sub: "rgba(14,59,38,0.72)", stage: "rgba(255,255,255,0.6)", chip: "rgba(14,59,38,0.08)", swatch: "#93D8B4" },
  sky: { label: "Cielo", bg: "radial-gradient(110% 90% at 90% 10%, #FFFFFF 0%, rgba(255,255,255,0) 50%), linear-gradient(150deg, #E3EEFF 0%, #8CB2F6 100%)", ink: "#0D2858", sub: "rgba(13,40,88,0.72)", stage: "rgba(255,255,255,0.58)", chip: "rgba(13,40,88,0.08)", swatch: "#8CB2F6" },
  lavender: { label: "Lavanda", bg: "radial-gradient(110% 90% at 90% 10%, #FFFFFF 0%, rgba(255,255,255,0) 50%), linear-gradient(150deg, #EFE9FF 0%, #B49CF4 100%)", ink: "#2A1A5E", sub: "rgba(42,26,94,0.72)", stage: "rgba(255,255,255,0.55)", chip: "rgba(42,26,94,0.08)", swatch: "#B49CF4" },
  lemon: { label: "Limón", bg: "radial-gradient(110% 90% at 90% 10%, #FFFFFF 0%, rgba(255,255,255,0) 50%), linear-gradient(150deg, #FFF7CF 0%, #FFCF4D 100%)", ink: "#4A3500", sub: "rgba(74,53,0,0.75)", stage: "rgba(255,255,255,0.6)", chip: "rgba(74,53,0,0.08)", swatch: "#FFCF4D" },
  berry: { label: "Frambuesa", bg: "radial-gradient(110% 90% at 90% 10%, #FFD3DE 0%, rgba(255,211,222,0) 45%), linear-gradient(150deg, #FF8FAE 0%, #E2477A 100%)", ink: "#FFFFFF", sub: "rgba(255,255,255,0.9)", stage: "rgba(255,255,255,0.3)", chip: "rgba(255,255,255,0.22)", swatch: "#E2477A" },
  sand: { label: "Arena", bg: "radial-gradient(110% 90% at 90% 10%, #FFFFFF 0%, rgba(255,255,255,0) 50%), linear-gradient(150deg, #F8F0E3 0%, #D9BE92 100%)", ink: "#3B2A12", sub: "rgba(59,42,18,0.72)", stage: "rgba(255,255,255,0.55)", chip: "rgba(59,42,18,0.08)", swatch: "#D9BE92" },
  night: { label: "Noche", bg: "radial-gradient(90% 90% at 90% 15%, rgba(242,107,58,0.55) 0%, rgba(242,107,58,0) 55%), linear-gradient(150deg, #2E2A26 0%, #47423C 100%)", ink: "#FFFFFF", sub: "rgba(255,255,255,0.8)", stage: "rgba(242,107,58,0.28)", chip: "rgba(255,255,255,0.14)", swatch: "#2E2A26" },
};

export type AdCardData = {
  theme: string;
  headline?: string | null;
  product: { name: string; image?: string | null; price?: number | null; promoPrice?: number | null };
  business?: { name: string } | null;
};

const money = (n: number) => `$${(Number(n) || 0).toFixed(2)}`;

export function ScAdCard({ ad, onClick, className = "" }: { ad: AdCardData; onClick?: () => void; className?: string }) {
  const t = AD_THEMES[(ad.theme as AdTheme)] ?? AD_THEMES.sunset;
  const price = ad.product.promoPrice ?? ad.product.price;
  const promo = ad.product.promoPrice != null && ad.product.price != null && ad.product.promoPrice < ad.product.price;
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className={`relative block h-[184px] w-[280px] shrink-0 overflow-hidden rounded-[24px] text-left ${onClick ? "active:scale-[0.98] transition" : ""} ${className}`}
      style={{ background: t.bg, color: t.ink, scrollSnapAlign: "start", boxShadow: "0 14px 28px -16px rgba(60,30,10,0.45)" }}
    >
      {/* soft stage behind the product, and the product itself */}
      <span aria-hidden className="absolute -bottom-10 -right-8 size-[190px] rounded-full" style={{ background: t.stage }} />
      {ad.product.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={ad.product.image}
          alt=""
          loading="lazy"
          className="absolute bottom-2 right-1 h-[150px] w-[150px] object-contain"
          style={{ filter: "drop-shadow(0 14px 16px rgba(40,20,5,0.28))", transform: "rotate(-6deg)" }}
        />
      ) : (
        <span className="absolute bottom-6 right-8 grid size-24 place-items-center rounded-3xl" style={{ background: t.chip }}><IconPhoto size={40} style={{ color: t.sub }} /></span>
      )}

      {/* little text: who, what, how much */}
      <span className="relative flex h-full w-[56%] flex-col p-4">
        {ad.business?.name && (
          <span className="max-w-full self-start truncate rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ background: t.chip, color: t.ink }}>{ad.business.name}</span>
        )}
        {ad.headline && <span className="mt-2 text-[10.5px] font-bold uppercase" style={{ color: t.sub, letterSpacing: "0.08em" }}>{ad.headline}</span>}
        <span className="mt-auto line-clamp-2 text-[17px] leading-tight" style={{ fontWeight: 800, letterSpacing: "-0.02em" }}>{ad.product.name}</span>
        {price != null && (
          <span className="mt-1 flex items-baseline gap-1.5">
            <span className="text-[26px] leading-none" style={{ fontWeight: 800, letterSpacing: "-0.03em" }}>{money(price)}</span>
            {promo && <span className="text-[12px] line-through" style={{ color: t.sub }}>{money(ad.product.price!)}</span>}
          </span>
        )}
      </span>
    </Tag>
  );
}
