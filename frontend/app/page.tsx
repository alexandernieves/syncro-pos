"use client";

/**
 * Syncro POS — landing page.
 *
 * The page is one continuous move inward. A transparent WebGL stage holds the
 * terminal on a counter; as you scroll, the camera squares up and pushes
 * through the bezel, and at the moment the display fills the frame the canvas
 * hands over to a working HTML point of sale that renders from the same cart.
 * The stage returns once more at the end to carry the globe.
 *
 * Scrolling is eased in a single animation frame that also publishes the scene
 * index, so nothing here re-renders while you scroll.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";

import { useChoreography } from "@/components/landing/lib/use-choreography";
import { scrollState, hasWebGL, subscribeScroll } from "@/components/landing/lib/scroll-store";
import {
  VERTICALS,
  openingCart,
  addToCart,
  removeFromCart,
  type CartLine,
  type Vertical,
} from "@/components/landing/lib/pos-model";

import { TopBar, SectionRail, ProgressLine } from "@/components/landing/sections/chrome";
import { Hero, Dive, Simulator } from "@/components/landing/sections/story";
import { Reel } from "@/components/landing/sections/reel";
import { Adapt, Catalog, Growth, World, Close } from "@/components/landing/sections/engine";
import { Marketplace } from "@/components/landing/sections/marketplace";

// The stage builds its textures against `document`, so it must never run
// during the static export's prerender pass.
const SyncroScene = dynamic(() => import("@/components/landing/scene/syncro-scene"), {
  ssr: false,
});

const SECTION_COUNT = 10;

export default function Landing() {
  const router = useRouter();
  const [webgl, setWebgl] = useState(false);
  const [progress, setProgress] = useState(0);

  const [vertical, setVertical] = useState<Vertical>("bodega");
  const [lines, setLines] = useState<CartLine[]>(() => openingCart("bodega"));
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    viewportRef,
    contentRef,
    spacerRef,
    stageRef,
    veilRef,
    active,
    quality,
    ready,
    scrollToScene,
  } = useChoreography(SECTION_COUNT);

  // Signed-in visitors go straight to their workspace.
  useEffect(() => {
    const adminToken = localStorage.getItem("token");
    const clientToken = localStorage.getItem("client_token");
    if (adminToken) router.replace("/dashboard");
    else if (clientToken) router.replace("/portal");
  }, [router]);

  useEffect(() => setWebgl(hasWebGL()), []);

  // The landing is light whatever theme the app is in, and the fixed scroll
  // frame means the document background is what shows through on overscroll.
  useEffect(() => {
    const root = document.documentElement;
    const prevRoot = root.style.background;
    const prevBody = document.body.style.background;
    root.style.background = "#F4F1EA";
    document.body.style.background = "#F4F1EA";
    return () => {
      root.style.background = prevRoot;
      document.body.style.background = prevBody;
    };
  }, []);

  useEffect(() => subscribeScroll((s) => setProgress(s.progress)), []);

  useEffect(
    () => () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
    },
    []
  );

  const chooseVertical = useCallback((v: Vertical) => {
    scrollState.vertical = v;
    setVertical(v);
    setLines(openingCart(v));
    setJustAdded(null);
  }, []);

  const add = useCallback(
    (id: string) => {
      const product = VERTICALS[vertical].catalog.find((p) => p.id === id);
      if (!product) return;
      setLines((prev) => addToCart(prev, product));
      setJustAdded(id);
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setJustAdded(null), 900);
    },
    [vertical]
  );

  const remove = useCallback((id: string) => {
    setLines((prev) => removeFromCart(prev, id));
  }, []);

  const clear = useCallback(() => {
    setLines([]);
    setJustAdded(null);
  }, []);

  return (
    <main className="relative w-full overflow-x-clip bg-[#F4F1EA] text-[#16140F] antialiased">
      {/* ---- stage ------------------------------------------------- */}
      <div
        ref={stageRef}
        className="pointer-events-none fixed inset-0 z-0"
        style={{ opacity: 0 }}
      >
        {webgl && ready && (
          <SyncroScene
            vertical={vertical}
            lines={lines}
            justAdded={justAdded}
            quality={quality}
          />
        )}
      </div>

      {/* Lifts away as the dive starts, so the screen is never greyed out. */}
      <div
        ref={veilRef}
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[1] bg-[#F4F1EA]"
        style={{ opacity: 0 }}
      />

      {/* ---- chrome ------------------------------------------------ */}
      <ProgressLine progress={progress} />
      <TopBar active={active} onGo={scrollToScene} />
      <SectionRail active={active} onGo={scrollToScene} />

      {/* ---- eased scroll frame ------------------------------------ */}
      <div ref={viewportRef} className="relative z-10">
        <div ref={contentRef}>
          <Hero onGo={scrollToScene} />
          <Dive />
          <Simulator
            vertical={vertical}
            lines={lines}
            justAdded={justAdded}
            onAdd={add}
            onRemove={remove}
            onClear={clear}
          />
          <Reel />
          <Adapt vertical={vertical} onChange={chooseVertical} />
          <Catalog vertical={vertical} />
          <Marketplace />
          <Growth vertical={vertical} />
          <World />
          <Close vertical={vertical} />
        </div>
      </div>

      {/* Gives the document its scroll height while the frame above is fixed. */}
      <div ref={spacerRef} aria-hidden style={{ height: 0 }} />
    </main>
  );
}
