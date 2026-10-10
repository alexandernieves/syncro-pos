"use client";

import { useEffect, useRef, useState } from "react";

import { easeInOut, mix, slice, useScrollProgress } from "./lib/use-scroll-progress";

/**
 * The scroll set piece: a headline sets up what you're about to see, then the
 * card below it grows to fill the screen — the move the reference gif opens
 * with. As the card takes over, the headline folds away and the line inside
 * the video lands in its place.
 *
 * Everything here is keyed to scroll position, not a timer, so scrolling back
 * plays it in reverse.
 */
export function Showcase() {
  const trackRef = useRef<HTMLElement | null>(null);
  const progress = useScrollProgress(trackRef);
  const [still, setStill] = useState(false);

  useEffect(() => {
    setStill(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  // The card grows over the first half, then holds while the words land —
  // fully settled well before the next panel starts rising over it.
  const grow = still ? 1 : easeInOut(slice(progress, 0.18, 0.52));
  const words = still ? 1 : slice(progress, 0.44, 0.64);
  // The setup line holds while the card is still small, then folds away. It
  // fades out ahead of the fold so you never catch it sliced in half.
  const intro = still ? 0 : 1 - slice(grow, 0.1, 0.6);
  const introInk = slice(intro, 0.45, 1);
  // The next panel starts covering the card around 0.60 and reaches the middle
  // of the screen — where this text sits — around 0.72. Clear the text before
  // then, so it is never caught sliced by the panel's edge.
  const exit = still ? 1 : 1 - slice(progress, 0.58, 0.7);

  const width = mix(58, 100, grow);
  const radius = mix(40, 0, grow);
  const height = mix(54, 100, grow);

  return (
    <section ref={trackRef} className="relative h-[300vh]" aria-label="Syncro en el mostrador">
      <div className="sticky top-0 flex h-[100svh] flex-col items-center justify-center overflow-hidden">
        {/* setup: says what you're looking at before the card takes the screen */}
        <div
          className="flex w-full shrink-0 flex-col items-center justify-start overflow-hidden px-5 text-center"
          style={{
            height: `${mix(0, 27, intro)}vh`,
            opacity: introInk,
          }}
        >
          <span className="inline-block rounded-full bg-[#F26B3A] px-3.5 py-1.5 text-xs font-bold text-white">
            Crece contigo
          </span>
          <h2 className="mt-4 max-w-3xl text-3xl font-bold leading-[1.08] tracking-[-0.03em] sm:text-4xl">
            Hoy vendes en un puesto. Mañana, en tres tiendas.
          </h2>
          <p className="mt-4 max-w-xl text-base text-[#6B665B] md:text-lg">
            El mismo Syncro te sirve en los dos casos. No tienes que empezar de nuevo.
          </p>
        </div>

        <div
          className="relative overflow-hidden bg-[#16140F] shadow-[0_40px_90px_-50px_rgba(0,0,0,0.6)]"
          style={{
            width: `${width}%`,
            height: `${height}%`,
            borderRadius: `${radius}px`,
          }}
        >
          <video
            className="h-full w-full object-cover opacity-65"
            src="/media/clips/caja-pago.mp4"
            poster="/media/shops/tienda-caja.jpg"
            autoPlay
            muted
            loop
            playsInline
          />
          {/* An even scrim carries the text; the gradient only adds depth at the edges. */}
          <div className="absolute inset-0 bg-black/45" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/50" />

          <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
            <h2
              className="max-w-4xl text-4xl font-bold leading-[1.05] tracking-[-0.035em] text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.7)] sm:text-5xl md:text-7xl"
              style={{
                opacity: words * exit,
                transform: `translateY(${mix(28, 0, words)}px)`,
              }}
            >
              Tú mandas.
              <br />
              Nosotros nos acomodamos.
            </h2>
            <p
              className="mt-6 max-w-xl text-lg leading-relaxed text-white/90 drop-shadow-[0_2px_14px_rgba(0,0,0,0.6)] md:text-xl"
              style={{
                opacity: slice(words, 0.35, 1) * exit,
                transform: `translateY(${mix(24, 0, slice(words, 0.35, 1))}px)`,
              }}
            >
              Nos cuentas cómo vendes y cómo cobras. Armamos tu sistema igual a como tú trabajas.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
