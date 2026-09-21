"use client";

/**
 * Scroll engine for the landing: eased scrolling plus the scene index that the
 * WebGL stage reads.
 *
 * Two jobs, deliberately together because they share one animation frame.
 *
 * 1. Smooth scrolling. The document scrolls natively — the scrollbar, keyboard,
 *    anchors and browser restore all behave normally — but the content is
 *    translated toward the real scroll position with exponential easing. What
 *    you feel is weight and glide instead of a hard one-to-one jump.
 *
 * 2. The scene index. Section centres are measured live from their rects,
 *    which, because the rects already include the eased transform, means the
 *    camera follows what is actually on screen rather than where the scrollbar
 *    happens to be.
 */

import { useEffect, useRef, useState } from "react";

import {
  scrollState,
  emitScroll,
  clamp,
  detectQuality,
  type ScrollState,
} from "./scroll-store";

/**
 * Note on GSAP: ScrollTrigger is deliberately NOT used to drive any of this.
 * It reads `window.scrollY`, but with eased scrolling the sections are offset
 * from that by however far the easing is currently lagging, so every trigger
 * would fire early or late. Reveals use IntersectionObserver instead, which
 * measures real rects and therefore respects the transform. GSAP still drives
 * the imperative timelines that are not tied to scroll position.
 */

export function useChoreography(sectionCount: number) {
  /** Fixed clipping frame. Only used when eased scrolling is on. */
  const viewportRef = useRef<HTMLDivElement>(null);
  /** The element actually translated. Sections live inside it. */
  const contentRef = useRef<HTMLDivElement>(null);
  /** Empty block that gives the document its scroll height. */
  const spacerRef = useRef<HTMLDivElement>(null);
  /** The WebGL wrapper, faded in and out as the story needs it. */
  const stageRef = useRef<HTMLDivElement>(null);
  /** Paper wash that pushes the stage back behind the copy on narrow screens. */
  const veilRef = useRef<HTMLDivElement>(null);

  const easedRef = useRef(false);
  const [active, setActive] = useState(0);
  const [quality, setQuality] = useState<ScrollState["quality"]>("high");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const q = detectQuality();
    scrollState.quality = q;
    setQuality(q);
    setReady(true);

    const viewport = viewportRef.current;
    const content = contentRef.current;
    const spacer = spacerRef.current;
    if (!viewport || !content || !spacer) return;

    // Phones have real momentum scrolling that is better than anything we can
    // fake, and translating a tall subtree fights it. Reduced-motion users get
    // the plain document too.
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const eased = !coarse && !reduced;
    easedRef.current = eased;

    let smooth = window.scrollY;
    let raf = 0;
    let contentHeight = 0;

    const applyMode = () => {
      if (eased) {
        viewport.style.position = "fixed";
        viewport.style.inset = "0";
        viewport.style.overflow = "hidden";
        viewport.style.willChange = "transform";
        spacer.style.height = `${contentHeight}px`;
      } else {
        viewport.style.position = "";
        viewport.style.inset = "";
        viewport.style.overflow = "";
        viewport.style.willChange = "";
        content.style.transform = "";
        spacer.style.height = "0px";
      }
    };

    const measure = () => {
      contentHeight = content.scrollHeight;
      if (eased) spacer.style.height = `${contentHeight}px`;
    };

    let sections: HTMLElement[] = [];
    const collect = () => {
      sections = Array.from(
        content.querySelectorAll<HTMLElement>("[data-scene]")
      ).sort((a, b) => Number(a.dataset.scene) - Number(b.dataset.scene));
    };

    const readScene = () => {
      if (sections.length < 2) return;
      const mid = window.innerHeight / 2;
      const centers = sections.map((el) => {
        const r = el.getBoundingClientRect();
        return r.top + r.height / 2;
      });

      let scene = 0;
      if (mid <= centers[0]) scene = 0;
      else if (mid >= centers[centers.length - 1]) scene = centers.length - 1;
      else {
        for (let i = 0; i < centers.length - 1; i++) {
          if (mid >= centers[i] && mid <= centers[i + 1]) {
            const span = centers[i + 1] - centers[i];
            scene = i + (span > 0 ? (mid - centers[i]) / span : 0);
            break;
          }
        }
      }

      scrollState.scene = clamp(scene, 0, sectionCount - 1);

      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - window.innerHeight;
      scrollState.progress = scrollable > 0 ? clamp(window.scrollY / scrollable) : 0;

      const nearest = Math.round(scrollState.scene);
      setActive((prev) => (prev === nearest ? prev : nearest));
    };

    /**
     * The stage is only wanted for two stretches of the story: the counter and
     * the dive at the start, and the globe near the end. Fading it here rather
     * than through React state keeps scrolling free of re-renders.
     */
    const paintStage = () => {
      const stage = stageRef.current;
      if (!stage) return;
      const s = scrollState.scene;
      let o: number;
      if (s < 1.7) o = 1; // the counter and the dive
      else if (s < 2.1) o = 1 - (s - 1.7) / 0.4;
      // the till, the reel, the trades, the catalogue, the marketplace, growth
      else if (s < 7.35) o = 0;
      else if (s < 7.85) o = (s - 7.35) / 0.5;
      else if (s < 9.05) o = 1; // the globe
      else o = Math.max(0, 1 - (s - 9.05) / 0.5);

      stage.style.opacity = o.toFixed(3);
      stage.style.visibility = o < 0.01 ? "hidden" : "visible";
    };

    /**
     * On a phone the copy and the stage share the same 390 pixels, so the hero
     * text needs the scene pushed back behind a wash of paper. It cannot be a
     * fixed overlay though: the whole point of the next beat is the camera
     * going into the display, and a permanent veil would grey out exactly the
     * thing the reader is meant to see. So it lifts as the dive begins.
     */
    let narrow = window.innerWidth < 1024;
    const paintVeil = () => {
      const veil = veilRef.current;
      if (!veil) return;
      if (!narrow) {
        veil.style.opacity = "0";
        return;
      }
      const s = scrollState.scene;
      const o = s < 0.5 ? 0.82 : s < 1 ? 0.82 * (1 - (s - 0.5) / 0.5) : 0;
      veil.style.opacity = o.toFixed(3);
    };

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const y = window.scrollY;

      if (eased) {
        // Exponential approach, frame-rate independent enough at 60 and 120 Hz.
        smooth += (y - smooth) * 0.12;
        if (Math.abs(y - smooth) < 0.08) smooth = y;
        content.style.transform = `translate3d(0, ${-smooth.toFixed(2)}px, 0)`;
      }

      readScene();
      paintStage();
      paintVeil();
      emitScroll();
    };

    collect();
    measure();
    applyMode();
    smooth = window.scrollY;
    if (eased) content.style.transform = `translate3d(0, ${-smooth}px, 0)`;
    readScene();
    paintStage();
    paintVeil();
    raf = requestAnimationFrame(tick);

    const ro = new ResizeObserver(() => {
      measure();
      collect();
    });
    ro.observe(content);

    const onResize = () => {
      narrow = window.innerWidth < 1024;
      const next = detectQuality();
      scrollState.quality = next;
      setQuality(next);
      measure();
      applyMode();
    };
    window.addEventListener("resize", onResize);

    const onPointer = (e: PointerEvent) => {
      scrollState.pointerX = (e.clientX / window.innerWidth) * 2 - 1;
      scrollState.pointerY = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onPointer, { passive: true });

    const onLoad = () => measure();
    window.addEventListener("load", onLoad);
    (document as Document & { fonts?: FontFaceSet }).fonts?.ready
      ?.then(() => measure())
      .catch(() => {});

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("load", onLoad);
      content.style.transform = "";
      viewport.style.position = "";
      viewport.style.overflow = "";
      spacer.style.height = "0px";
    };
  }, [sectionCount]);

  /**
   * Anchor navigation for both scroll modes.
   *
   * The target is measured relative to the content element, never against
   * `window.scrollY`: in eased mode the content carries a transform that lags
   * the real scroll position, so mixing the two lands you short of the section
   * by exactly however much the easing owes. Subtracting the parent's own rect
   * cancels the shared transform out.
   */
  const scrollToScene = (index: number) => {
    const content = contentRef.current;
    if (!content) return;
    const el = content.querySelector<HTMLElement>(`[data-scene="${index}"]`);
    if (!el) return;
    const top = el.getBoundingClientRect().top - content.getBoundingClientRect().top;
    // When easing is on, our own loop does the gliding; asking the browser to
    // smooth-scroll as well just stacks two curves and feels mushy.
    window.scrollTo({ top, behavior: easedRef.current ? "auto" : "smooth" });
  };

  return {
    viewportRef,
    contentRef,
    spacerRef,
    stageRef,
    veilRef,
    active,
    quality,
    ready,
    scrollToScene,
  };
}
