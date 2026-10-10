"use client";

import { useEffect, useState } from "react";
import {
  IconBrandFacebook,
  IconBrandGoogle,
  IconBrandInstagram,
  IconBrandMeta,
  IconBrandTiktok,
  IconBrandWhatsapp,
  IconBrandYoutube,
} from "@tabler/icons-react";

/**
 * The places we put a shop's products, dealt as an arc of cards with the one
 * in front named underneath. The arc turns on its own, bringing each platform
 * to the middle in turn; hovering a card brings it forward instead.
 */
const PLATFORMS = [
  { id: "meta", label: "Meta ads", line: "Anuncios en Facebook e Instagram", icon: IconBrandMeta, color: "#0866FF" },
  { id: "google", label: "Google", line: "Que te encuentren cuando te buscan", icon: IconBrandGoogle, color: "#EA4335" },
  { id: "instagram", label: "Instagram", line: "Publicaciones y catálogo de lo tuyo", icon: IconBrandInstagram, color: "#E1306C" },
  { id: "whatsapp", label: "WhatsApp", line: "Pedidos por chat, sin perder ninguno", icon: IconBrandWhatsapp, color: "#25D366" },
  { id: "tiktok", label: "TikTok", line: "Videos cortos que traen gente nueva", icon: IconBrandTiktok, color: "#16140F" },
  { id: "facebook", label: "Facebook", line: "Tu página y tu tienda al día", icon: IconBrandFacebook, color: "#0866FF" },
  { id: "youtube", label: "YouTube", line: "Anuncios en video para tu zona", icon: IconBrandYoutube, color: "#FF0033" },
];

const N = PLATFORMS.length;

export function Channels() {
  const [front, setFront] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setFront((a) => (a + 1) % N), 2600);
    return () => clearInterval(t);
  }, [paused]);

  const current = PLATFORMS[front];

  return (
    <div className="mt-16">
      {/* Hovering pauses the turn but never reorders the arc: moving a card out
          from under the cursor would bounce the hover on and off. A click is
          what brings a card to the front. */}
      <div
        className="relative mx-auto h-[290px] w-full max-w-4xl sm:h-[320px]"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {PLATFORMS.map((p, i) => {
          // Where this card sits relative to the one in front, wrapped so the
          // arc turns the short way round.
          let rel = i - front;
          if (rel > N / 2) rel -= N;
          if (rel < -N / 2) rel += N;

          const edge = Math.abs(rel);
          const visible = edge <= 2;
          const Icon = p.icon;

          return (
            <button
              key={p.id}
              type="button"
              aria-label={p.label}
              onClick={() => setFront(i)}
              onFocus={() => setPaused(true)}
              onBlur={() => setPaused(false)}
              className="absolute left-1/2 top-6 grid place-items-center rounded-[28px] bg-white shadow-[0_24px_50px_-28px_rgba(0,0,0,0.35)] transition-all duration-500 ease-out"
              style={{
                width: rel === 0 ? 148 : 128,
                height: rel === 0 ? 148 : 128,
                transform: `translateX(-50%) translate(${rel * 152}px, ${Math.pow(edge, 1.45) * 42}px) rotate(${rel * 9}deg)`,
                opacity: visible ? 1 : 0,
                zIndex: 10 - edge,
                pointerEvents: visible ? "auto" : "none",
              }}
            >
              <Icon size={rel === 0 ? 62 : 52} stroke={1.6} style={{ color: p.color }} />
            </button>
          );
        })}
      </div>

      <div className="mt-2 text-center">
        <p key={`${current.id}-label`} className="animate-in fade-in text-xl font-bold tracking-[-0.02em] duration-500">
          {current.label}
        </p>
        <p key={`${current.id}-line`} className="animate-in fade-in mt-1 text-[#6B665B] duration-500">
          {current.line}
        </p>
      </div>
    </div>
  );
}
