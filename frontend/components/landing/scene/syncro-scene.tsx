"use client";

/* eslint-disable react/no-unknown-property */

/**
 * The WebGL stage.
 *
 * The canvas is transparent and there is no floor plane: the rig sits on the
 * page's own paper colour with nothing but a contact shadow under it, which is
 * how a product photograph is lit and sidesteps the horizon seam a ground
 * plane always eventually shows.
 *
 * The camera follows hand-placed keyframes, one per narrative beat. Beats 1
 * and 2 push the lens through the bezel and into the display; the page fades
 * this canvas out at the same moment the HTML simulator fades in, so the two
 * read as one continuous move inward.
 */

import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Environment,
  Lightformer,
  ContactShadows,
  AdaptiveDpr,
  Preload,
} from "@react-three/drei";
import * as THREE from "three";

import { CounterRig } from "./pos-hardware";
import { WorldGlobe } from "./story-elements";
import type { CartLine, Vertical } from "../lib/pos-model";
import { scrollState, clamp, damp, easeInOutCubic, range } from "../lib/scroll-store";

/* ------------------------------------------------------------------ */
/* Camera                                                              */
/* ------------------------------------------------------------------ */

interface CamKey {
  pos: [number, number, number];
  target: [number, number, number];
  fov: number;
  /** Aim offset so the rig clears the half of the screen the copy occupies. */
  shift: number;
}

const CAM_KEYS: CamKey[] = [
  // 0 · on the counter
  { pos: [0.98, 1.54, 3.45], target: [0, 1.06, 0], fov: 36, shift: -0.52 },
  // 1 · squared up, moving in
  { pos: [0.02, 1.15, 1.42], target: [0, 1.07, 0], fov: 36, shift: 0 },
  // 2 · at the glass
  { pos: [0, 1.07, 0.3], target: [0, 1.065, 0], fov: 36, shift: 0 },
  // 3-7 · the stage is hidden through the reel, the trades, the catalogue,
  // the marketplace and the growth engine; the camera eases back out so the
  // globe is already framed by the time it returns
  { pos: [0, 1.2, 1.8], target: [0, 1.1, 0], fov: 36, shift: 0 },
  { pos: [0, 1.28, 2.3], target: [0, 1.16, 0], fov: 36, shift: 0 },
  { pos: [0, 1.36, 2.8], target: [0, 1.24, 0], fov: 37, shift: 0 },
  { pos: [0, 1.46, 3.4], target: [0, 1.32, 0], fov: 37, shift: -0.25 },
  { pos: [0, 1.55, 4.1], target: [0, 1.42, 0], fov: 38, shift: -0.45 },
  // 8 · the globe
  { pos: [0, 1.62, 4.9], target: [0, 1.5, 0], fov: 38, shift: -0.62 },
  // 9 · close
  { pos: [0.7, 1.5, 3.9], target: [0, 1.08, 0], fov: 36, shift: 0 },
];

function CameraRig() {
  const { camera, size } = useThree();
  const target = useRef(new THREE.Vector3(0, 1.06, 0));
  const intro = useRef(0);
  const tmpPos = useMemo(() => new THREE.Vector3(), []);
  const tmpTgt = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, dt) => {
    intro.current = Math.min(1, intro.current + dt / 1.7);
    const introEase = easeInOutCubic(intro.current);

    const s = clamp(scrollState.scene, 0, CAM_KEYS.length - 1);
    const i = Math.min(Math.floor(s), CAM_KEYS.length - 2);
    const t = easeInOutCubic(s - i);

    const a = CAM_KEYS[i];
    const b = CAM_KEYS[i + 1];

    tmpPos.set(
      THREE.MathUtils.lerp(a.pos[0], b.pos[0], t),
      THREE.MathUtils.lerp(a.pos[1], b.pos[1], t),
      THREE.MathUtils.lerp(a.pos[2], b.pos[2], t)
    );
    tmpTgt.set(
      THREE.MathUtils.lerp(a.target[0], b.target[0], t),
      THREE.MathUtils.lerp(a.target[1], b.target[1], t),
      THREE.MathUtils.lerp(a.target[2], b.target[2], t)
    );

    const aspect = size.width / Math.max(1, size.height);
    const wide = aspect >= 1.35;
    tmpPos.z *= aspect < 1 ? 1.6 : wide ? 1 : 1.25;
    if (wide) {
      const shift = THREE.MathUtils.lerp(a.shift, b.shift, t);
      tmpTgt.x += shift;
      tmpPos.x += shift;
    } else {
      tmpPos.x *= 0.6;
    }

    tmpPos.z += (1 - introEase) * 1.4;

    // Pointer parallax fades out during the dive, so the approach stays on rails.
    const handheld = 1 - range(scrollState.scene, 0.2, 0.95);
    tmpPos.x += scrollState.pointerX * 0.2 * handheld;
    tmpPos.y += scrollState.pointerY * 0.11 * handheld;

    // Faster tracking once we are close, or the push-in feels rubbery.
    const lambda = 3.2 + range(scrollState.scene, 0.5, 2) * 3.5;
    camera.position.x = damp(camera.position.x, tmpPos.x, lambda, dt);
    camera.position.y = damp(camera.position.y, tmpPos.y, lambda, dt);
    camera.position.z = damp(camera.position.z, tmpPos.z, lambda, dt);

    target.current.x = damp(target.current.x, tmpTgt.x, lambda, dt);
    target.current.y = damp(target.current.y, tmpTgt.y, lambda, dt);
    target.current.z = damp(target.current.z, tmpTgt.z, lambda, dt);
    camera.lookAt(target.current);

    const cam = camera as THREE.PerspectiveCamera;
    const fov = THREE.MathUtils.lerp(a.fov, b.fov, t) * (aspect < 1 ? 1.2 : 1);
    const next = damp(cam.fov, fov, lambda, dt);
    if (Math.abs(next - cam.fov) > 0.001) {
      cam.fov = next;
      cam.updateProjectionMatrix();
    }
  });

  return null;
}

/* ------------------------------------------------------------------ */
/* Light                                                               */
/* ------------------------------------------------------------------ */

function Studio() {
  return (
    <>
      {/* A white room built from light panels rather than a downloaded HDRI,
          so the page stays self-contained and works offline. */}
      <Environment resolution={256} frames={1}>
        <color attach="background" args={["#efece5"]} />
        <Lightformer
          form="rect"
          intensity={4}
          position={[0, 4.5, 3]}
          rotation={[-Math.PI / 2.3, 0, 0]}
          scale={[9, 6, 1]}
          color="#ffffff"
        />
        <Lightformer
          form="rect"
          intensity={2.6}
          position={[-5, 2.4, 1]}
          rotation={[0, Math.PI / 2.4, 0]}
          scale={[6, 5, 1]}
          color="#ffffff"
        />
        <Lightformer
          form="rect"
          intensity={2.2}
          position={[5, 2, 1]}
          rotation={[0, -Math.PI / 2.4, 0]}
          scale={[6, 5, 1]}
          color="#FFF6E8"
        />
        <Lightformer
          form="rect"
          intensity={1.6}
          position={[0, 0.4, 5]}
          scale={[7, 3, 1]}
          color="#ffffff"
        />
      </Environment>

      <ambientLight intensity={0.45} color="#FFFDF8" />
      <directionalLight position={[2.6, 5, 3.2]} intensity={1.1} color="#FFFAF0" />
      <directionalLight position={[-3.2, 2.6, 1.4]} intensity={0.4} color="#EEF2FF" />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Ground                                                              */
/* ------------------------------------------------------------------ */

/**
 * The contact shadow belongs to the counter, so it leaves with the counter.
 * Left on, it keeps catching the globe — which floats well above the ground
 * plane — and paints a large soft blob under an object that is not resting on
 * anything.
 */
function GroundShadow({ quality }: { quality: "high" | "medium" | "low" }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (ref.current) ref.current.visible = scrollState.scene < 4.6;
  });
  return (
    <ContactShadows
      ref={ref}
      position={[0, 0, 0]}
      opacity={quality === "low" ? 0.42 : 0.58}
      scale={8}
      blur={1.7}
      far={2.2}
      resolution={quality === "high" ? 1024 : 512}
      color="#4A4438"
    />
  );
}

/* ------------------------------------------------------------------ */
/* Root                                                                */
/* ------------------------------------------------------------------ */

export default function SyncroScene({
  vertical,
  lines,
  justAdded,
  quality,
}: {
  vertical: Vertical;
  lines: CartLine[];
  justAdded: string | null;
  quality: "high" | "medium" | "low";
}) {
  return (
    <Canvas
      dpr={quality === "high" ? [1, 2] : quality === "medium" ? [1, 1.6] : [1, 1.25]}
      gl={{
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
        toneMapping: THREE.ACESFilmicToneMapping,
      }}
      camera={{ position: [0.98, 1.54, 4.9], fov: 36, near: 0.05, far: 60 }}
      onCreated={({ gl }) => {
        gl.toneMappingExposure = 0.95;
      }}
    >
      <Suspense fallback={null}>
        <CameraRig />
        <Studio />

        <CounterRig vertical={vertical} lines={lines} justAdded={justAdded} />
        <WorldGlobe />

        {/* The only thing grounding the rig. No floor plane, so there is no
            horizon to betray the render when the camera pulls back. */}
        <GroundShadow quality={quality} />

        <AdaptiveDpr pixelated />
        <Preload all />
      </Suspense>
    </Canvas>
  );
}
