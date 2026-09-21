"use client";

/**
 * The horizontal reel: real shops, real footage, one pain each.
 *
 * The section is deliberately tall. A stage inside it is pinned by hand every
 * frame rather than with `position: sticky`, because the page scrolls by
 * translating a wrapper and sticky resolves against the nearest scrolling
 * ancestor — which, under that transform, is not the document. Reading the
 * section's own rect sidesteps the whole problem, and the rect already carries
 * the eased transform, so the reel tracks what is actually on screen.
 */

import { useEffect, useRef } from "react";
import { IconArrowRight, IconCheck, IconPlayerPlayFilled } from "@tabler/icons-react";

import { REEL } from "../lib/media";
import { clamp } from "../lib/scroll-store";

export function Reel() {
  const section = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const progressBar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sec = section.current;
    const st = stage.current;
    const tr = track.current;
    if (!sec || !st || !tr) return;

    const videos = Array.from(tr.querySelectorAll<HTMLVideoElement>("video"));
    const cards = Array.from(tr.children) as HTMLElement[];
    let raf = 0;
    let shown = -1;
    let targetX = 0;
    let currentX = 0;
    let lastX = 0;
    let lean = 0;
    let exitDelta = 0;
    let startDelta = 0;

    const getSecTargetY = () => {
      const content = sec.parentElement;
      if (!content) return 0;
      return sec.getBoundingClientRect().top - content.getBoundingClientRect().top;
    };

    const checkScrollPosition = () => {
      const rect = sec.getBoundingClientRect();
      const vw = window.innerWidth;
      const travel = Math.max(0, tr.scrollWidth - vw + 80);
      if (rect.bottom < 0) {
        targetX = travel;
        currentX = travel;
      } else if (rect.top > window.innerHeight) {
        targetX = 0;
        currentX = 0;
      }
    };

    checkScrollPosition();
    window.addEventListener("scroll", checkScrollPosition, { passive: true });

    const onWheel = (e: WheelEvent) => {
      const rect = sec.getBoundingClientRect();
      const vw = window.innerWidth;
      const travel = Math.max(0, tr.scrollWidth - vw + 80);

      // Check if user is at the Reel section (top aligned to viewport)
      const isAtTop = rect.top <= 45 && rect.bottom >= window.innerHeight * 0.7;
      if (!isAtTop) return;

      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (Math.abs(delta) < 0.5) return;

      // Scrolling DOWN
      if (delta > 0) {
        if (targetX < travel) {
          // LOCK vertical scroll completely while cards are moving horizontally
          e.preventDefault();
          const targetY = getSecTargetY();
          window.scrollTo(0, targetY);
          targetX = Math.min(travel, targetX + delta * 1.05);
          exitDelta = 0;
          return;
        }

        // Reached end of horizontal travel
        if (targetX >= travel) {
          if (exitDelta < 160) {
            e.preventDefault();
            exitDelta += delta;
            const targetY = getSecTargetY();
            window.scrollTo(0, targetY);
            return;
          }
          // Buffer passed: allow vertical scroll down to next section
        }
      }

      // Scrolling UP
      if (delta < 0) {
        if (targetX > 0) {
          // LOCK vertical scroll completely while cards are moving back horizontally
          e.preventDefault();
          const targetY = getSecTargetY();
          window.scrollTo(0, targetY);
          targetX = Math.max(0, targetX + delta * 1.05);
          startDelta = 0;
          return;
        }

        // Reached start of horizontal travel
        if (targetX <= 0) {
          if (startDelta > -130) {
            e.preventDefault();
            startDelta += delta;
            const targetY = getSecTargetY();
            window.scrollTo(0, targetY);
            return;
          }
          // Buffer passed: allow vertical scroll up to previous section
        }
      }
    };

    window.addEventListener("wheel", onWheel, { passive: false });

    // Touch support for trackpad/mobile
    let touchStartY = 0;
    let touchStartX = 0;

    const onTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0].clientY;
      touchStartX = e.touches[0].clientX;
    };

    const onTouchMove = (e: TouchEvent) => {
      const rect = sec.getBoundingClientRect();
      const vw = window.innerWidth;
      const travel = Math.max(0, tr.scrollWidth - vw + 80);
      const isAtTop = rect.top <= 45 && rect.bottom >= window.innerHeight * 0.7;
      if (!isAtTop) return;

      const dy = touchStartY - e.touches[0].clientY;
      const dx = touchStartX - e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      touchStartX = e.touches[0].clientX;

      const delta = Math.abs(dx) > Math.abs(dy) ? dx : dy;
      if (Math.abs(delta) < 1) return;

      if (delta > 0 && targetX < travel) {
        e.preventDefault();
        const targetY = getSecTargetY();
        window.scrollTo(0, targetY);
        targetX = Math.min(travel, targetX + delta * 1.5);
      } else if (delta < 0 && targetX > 0) {
        e.preventDefault();
        const targetY = getSecTargetY();
        window.scrollTo(0, targetY);
        targetX = Math.max(0, targetX + delta * 1.5);
      }
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });

    const tick = () => {
      raf = requestAnimationFrame(tick);

      const rect = sec.getBoundingClientRect();
      const vh = window.innerHeight;
      const vw = window.innerWidth;
      const travel = Math.max(0, tr.scrollWidth - vw + 80);

      // Smoothly glide currentX towards targetX
      currentX += (targetX - currentX) * 0.16;
      if (Math.abs(targetX - currentX) < 0.1) currentX = targetX;

      tr.style.transform = `translate3d(${-currentX.toFixed(1)}px, 0, 0)`;

      const p = travel > 0 ? clamp(currentX / travel) : 0;
      if (progressBar.current) {
        progressBar.current.style.transform = `scaleX(${Math.max(0.02, p).toFixed(3)})`;
      }

      // Velocity lean
      const vel = currentX - lastX;
      lastX = currentX;
      lean += (Math.max(-90, Math.min(90, vel)) - lean) * 0.12;
      const skew = (lean * 0.045).toFixed(3);
      const squash = (1 - Math.min(0.05, Math.abs(lean) * 0.0009)).toFixed(4);
      for (let i = 0; i < cards.length; i++) {
        cards[i].style.transform = `skewY(${skew}deg) scaleY(${squash})`;
      }

      // Pause videos when section is off screen vertically
      if (rect.bottom < 0 || rect.top > vh) {
        if (shown !== -1) {
          videos.forEach((v) => v.pause());
          shown = -1;
        }
        return;
      }

      // Only the clip nearest the middle of the screen is allowed to play
      const mid = vw / 2;
      let best = -1;
      let bestDist = Infinity;
      videos.forEach((v, i) => {
        const r = v.getBoundingClientRect();
        const d = Math.abs(r.left + r.width / 2 - mid);
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      });
      if (best !== shown) {
        videos.forEach((v, i) => {
          if (i === best && bestDist < vw * 0.8) {
            v.play().catch(() => {});
          } else {
            v.pause();
          }
        });
        shown = best;
      }
    };

    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", checkScrollPosition);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      videos.forEach((v) => v.pause());
    };
  }, []);

  return (
    <section
      ref={section}
      id="comercios"
      data-scene={3}
      className="relative w-full min-h-[100svh] bg-[#EBE6DC]"
    >
      <div
        ref={stage}
        className="flex min-h-[100svh] w-full flex-col overflow-hidden will-change-transform"
      >
        <header className="shrink-0 px-5 pb-5 pt-20 sm:px-8">
          <div className="mx-auto max-w-[1240px]">
            <span className="inline-flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.22em] text-[#B33C2A]">
              <span className="h-px w-7 bg-current" />
              Comercios de verdad
            </span>
            <h2 className="mt-3 max-w-2xl text-[clamp(1.4rem,2.9vw,2.3rem)] font-extrabold leading-[1.08] tracking-[-0.025em] text-[#16140F]">
              Cada negocio tiene una fuga por donde se le va la plata.
            </h2>
          </div>
        </header>

        <div className="relative min-h-0 flex-1">
          <div
            ref={track}
            className="flex h-full gap-5 pl-5 pr-24 will-change-transform sm:pl-8"
          >
            {REEL.map((item) => (
              <article
                key={item.id}
                className="relative h-full w-[82vw] shrink-0 overflow-hidden rounded-2xl bg-[#16140F] sm:w-[48vw] lg:w-[34vw]"
              >
                {item.kind === "photo" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.src}
                    alt={item.alt}
                    loading="lazy"
                    className="absolute inset-0 size-full object-cover"
                  />
                ) : (
                  <>
                    <video
                      src={item.src}
                      poster={item.poster}
                      muted
                      loop
                      playsInline
                      preload="none"
                      aria-label={item.alt}
                      className="absolute inset-0 size-full object-cover"
                    />
                    <span className="absolute right-4 top-4 z-10 flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-sm">
                      <IconPlayerPlayFilled className="size-2.5" />
                      Video
                    </span>
                  </>
                )}

                {/* the only gradient on the page, and it is doing real work:
                    holding type legible over photography we do not control */}
                <div
                  aria-hidden
                  className="absolute inset-x-0 bottom-0 h-3/5"
                  style={{
                    background:
                      "linear-gradient(to top, rgba(10,9,6,0.94) 0%, rgba(10,9,6,0.72) 42%, rgba(10,9,6,0) 100%)",
                  }}
                />

                <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
                  <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/50">
                    {item.trade}
                  </span>
                  <p className="mt-2.5 text-[clamp(1.5rem,2.6vw,2.2rem)] font-extrabold leading-[1.04] tracking-[-0.02em] text-white">
                    {item.pain}
                  </p>
                  <p className="mt-3 flex gap-2 text-[14px] font-semibold leading-snug text-white/85">
                    <IconCheck className="mt-0.5 size-4 shrink-0 text-[#4ADE80]" />
                    {item.fix}
                  </p>
                </div>
              </article>
            ))}

            {/* closing card, so the strip lands on an action */}
            <article className="flex h-full w-[82vw] shrink-0 flex-col justify-center rounded-2xl border border-[#DED8CB] bg-white p-8 sm:w-[48vw] lg:w-[34vw]">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#8C8577]">
                Tu negocio
              </span>
              <h3 className="mt-3 text-[clamp(1.4rem,2.4vw,2rem)] font-extrabold leading-[1.08] tracking-[-0.02em] text-[#16140F]">
                ¿Cuál de estas fugas es la tuya?
              </h3>
              <p className="mt-3 text-[14px] leading-relaxed text-[#5A5449]">
                Ninguna se tapa trabajando más horas. Se tapan con un sistema que
                se arma alrededor de cómo ya trabajas.
              </p>
              <a
                href="/register"
                className="group mt-6 inline-flex w-fit items-center gap-2 rounded-lg bg-[#0E7A46] px-6 py-3.5 text-[15px] font-bold text-white transition-colors hover:bg-[#0A5733]"
              >
                Empezar gratis
                <IconArrowRight className="size-[18px] transition-transform group-hover:translate-x-1" />
              </a>
            </article>
          </div>
        </div>

        <footer className="shrink-0 px-5 pb-8 pt-5 sm:px-8">
          <div className="mx-auto max-w-[1240px]">
            <div className="h-[3px] w-full overflow-hidden rounded-full bg-[#DED8CB]">
              <div
                ref={progressBar}
                className="h-full origin-left rounded-full bg-[#0E7A46]"
                style={{ transform: "scaleX(0.02)" }}
              />
            </div>
            <p className="mt-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8C8577]">
              Sigue bajando para recorrerlos
            </p>
          </div>
        </footer>
      </div>
    </section>
  );
}
