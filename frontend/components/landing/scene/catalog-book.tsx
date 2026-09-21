"use client";

/* eslint-disable react/no-unknown-property */

/**
 * The catalogue, as a book you can actually handle.
 *
 * Each leaf is a box divided along its width and bound to a chain of bones —
 * one per segment — so rotating them by a graded amount bends the paper rather
 * than swinging it like a door. Three curves are layered on the base angle: a
 * bow near the spine, a counter-bow at the outer edge, and a travelling wave
 * that only exists mid-turn.
 *
 * Handling: click a leaf to turn it, drag anywhere to rotate the whole book.
 */

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Lightformer, ContactShadows } from "@react-three/drei";
import * as THREE from "three";

import { buildCatalog, type CatalogSpread } from "../lib/catalog-pages";
import { damp } from "../lib/scroll-store";

const PAGE_W = 1.28;
const PAGE_H = 1.71;
/**
 * Paper thickness and stack spacing are two different numbers.
 *
 * They used to be one. A leaf 0.008 deep spans ±0.004 around its centre, so
 * spacing the centres 0.008 apart put the front face of one leaf on exactly
 * the same plane as the back face of the next. Coplanar faces are the textbook
 * cause of z-fighting, and it showed up as one page's text punching through
 * another mid-turn.
 */
const PAGE_D = 0.005;
const PAGE_GAP = 0.018;
const SEGMENTS = 24;
const SEG_W = PAGE_W / SEGMENTS;

const EASE = 6.5;
const EASE_FOLD = 9;
const INSIDE_CURVE = 0.18;
const OUTSIDE_CURVE = 0.05;
const TURNING_CURVE = 0.09;

const BASE_YAW = -Math.PI / 2 - 0.2;
const BASE_PITCH = -0.1;

/** Shared handle so the DOM pointer listeners can steer the 3D book. */
export interface Orbit {
  yaw: number;
  pitch: number;
  dragging: boolean;
  moved: boolean;
}

function makePageGeometry() {
  const geo = new THREE.BoxGeometry(PAGE_W, PAGE_H, PAGE_D, SEGMENTS, 2);
  geo.translate(PAGE_W / 2, 0, 0);

  const pos = geo.attributes.position;
  const vertex = new THREE.Vector3();
  const skinIndex: number[] = [];
  const skinWeight: number[] = [];

  for (let i = 0; i < pos.count; i++) {
    vertex.fromBufferAttribute(pos, i);
    // Which segment a vertex sits in picks the two bones that move it; how far
    // across that segment decides the blend between them.
    const idx = Math.max(0, Math.floor(vertex.x / SEG_W));
    const w = (vertex.x % SEG_W) / SEG_W;
    skinIndex.push(idx, idx + 1, 0, 0);
    skinWeight.push(1 - w, w, 0, 0);
  }

  geo.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(skinIndex, 4));
  geo.setAttribute("skinWeight", new THREE.Float32BufferAttribute(skinWeight, 4));
  return geo;
}

function Leaf({
  index,
  page,
  spread,
  opened,
  bookClosed,
}: {
  index: number;
  page: number;
  spread: CatalogSpread;
  opened: boolean;
  bookClosed: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.SkinnedMesh>(null);
  const turnedAt = useRef(0);
  const lastOpened = useRef(opened);

  const { faceFront, faceBack } = useMemo(() => {
    const f = new THREE.CanvasTexture(spread.front);
    const b = new THREE.CanvasTexture(spread.back);
    f.colorSpace = b.colorSpace = THREE.SRGBColorSpace;
    f.anisotropy = b.anisotropy = 8;
    return { faceFront: f, faceBack: b };
  }, [spread]);

  useEffect(
    () => () => {
      faceFront.dispose();
      faceBack.dispose();
    },
    [faceFront, faceBack]
  );

  const skinned = useMemo(() => {
    const geo = makePageGeometry();
    const bones: THREE.Bone[] = [];
    for (let i = 0; i <= SEGMENTS; i++) {
      const bone = new THREE.Bone();
      bone.position.x = i === 0 ? 0 : SEG_W;
      if (i > 0) bones[i - 1].add(bone);
      bones.push(bone);
    }
    const skeleton = new THREE.Skeleton(bones);

    /*
     * No polygon offset here any more. It was set to a negative factor scaled
     * by the leaf index, which pulls geometry toward the camera — so the
     * deeper a page sat in the stack the further forward it was nudged, the
     * exact opposite of what the stack needs. With real separation between
     * leaves the depth buffer sorts them correctly on its own.
     */
    const common = {
      roughness: 0.82,
      metalness: 0,
    };
    const edge = new THREE.MeshStandardMaterial({
      color: "#F2EFE8",
      roughness: 0.9,
    });
    const materials = [
      edge,
      edge,
      edge,
      edge,
      new THREE.MeshStandardMaterial({ map: faceFront, ...common }),
      new THREE.MeshStandardMaterial({ map: faceBack, ...common }),
    ];

    const mesh = new THREE.SkinnedMesh(geo, materials);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    mesh.add(skeleton.bones[0]);
    mesh.bind(skeleton);
    return mesh;
  }, [faceFront, faceBack, index]);

  useEffect(() => () => skinned.geometry.dispose(), [skinned]);

  useFrame((_, dt) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    if (lastOpened.current !== opened) {
      turnedAt.current = 0;
      lastOpened.current = opened;
    }
    turnedAt.current = Math.min(1, turnedAt.current + dt * 2);
    const turning = Math.sin(turnedAt.current * Math.PI);

    /*
     * Every leaf in a stack takes the SAME angle, with no per-leaf fan.
     *
     * There used to be an `index * 0.8°` splay here. Over a leaf 1.28 wide
     * that tilt walks the outer edge further than the stack gap separates it,
     * so leaves physically crossed near the fore-edge — and where two leaves
     * cross, the depth test flips back and forth across the width and you get
     * two different pages interleaved in vertical bands. That is what the
     * "Granos⋮trigo" and "é molica básica" blends were.
     *
     * Leaves that share an angle are parallel planes offset along their own
     * normal, and parallel planes cannot intersect. The stack is now provably
     * unable to blend, rather than tuned until it happened to look fine.
     */
    const target = opened ? -Math.PI / 2 : Math.PI / 2;

    const bones = mesh.skeleton.bones;
    for (let i = 0; i < bones.length; i++) {
      const node = i === 0 ? group.current : bones[i];
      if (!node) continue;

      const inside = i < 8 ? Math.sin(i * 0.2 + 0.25) : 0;
      const outside = i >= 8 ? Math.cos(i * 0.3 + 0.09) : 0;
      const wave = Math.sin((i * Math.PI) / bones.length) * turning;

      let angle =
        INSIDE_CURVE * inside * target -
        OUTSIDE_CURVE * outside * target +
        TURNING_CURVE * wave * target;

      let fold = 0;
      if (bookClosed) {
        angle = i === 0 ? target : 0;
      } else {
        fold = Math.sign(target) * 2 * turning;
      }

      node.rotation.y = damp(node.rotation.y, angle, EASE, dt);
      if (i > 0) {
        node.rotation.x = damp(node.rotation.x, (fold * Math.PI) / 180, EASE_FOLD, dt);
      }
    }

    /**
     * The stack slides so the open spread always sits at z = 0: turned leaves
     * drift to one side, untouched ones to the other. Without this every leaf
     * shares a plane and they grind against each other while turning.
     */
    const z = (page - index) * PAGE_GAP;
    mesh.position.z = damp(mesh.position.z, z, 6, dt);
  });

  return (
    <group ref={group}>
      <primitive ref={meshRef} object={skinned} />
    </group>
  );
}

function Book({
  page,
  spreads,
  orbit,
}: {
  page: number;
  spreads: CatalogSpread[];
  orbit: React.RefObject<Orbit>;
}) {
  const group = useRef<THREE.Group>(null);
  const clock = useRef(0);

  useFrame((_, dt) => {
    clock.current += dt;
    const g = group.current;
    const o = orbit.current;
    if (!g || !o) return;

    // Idle drift only while nobody is holding the book.
    const settle = o.dragging ? 0 : 1;
    const driftY = Math.sin(clock.current * 0.3) * 0.05 * settle;
    const driftX = Math.cos(clock.current * 0.25) * 0.02 * settle;

    g.rotation.y = damp(g.rotation.y, BASE_YAW + o.yaw + driftY, 7, dt);
    g.rotation.x = damp(g.rotation.x, BASE_PITCH + o.pitch + driftX, 7, dt);
  });

  return (
    <group ref={group} rotation={[BASE_PITCH, BASE_YAW, 0]}>
      {spreads.map((s, i) => (
        <Leaf
          key={i}
          index={i}
          page={page}
          spread={s}
          opened={page > i}
          bookClosed={page === 0 || page === spreads.length}
        />
      ))}
    </group>
  );
}

export default function CatalogBook({ store }: { store: string }) {
  const [spreads, setSpreads] = useState<CatalogSpread[] | null>(null);
  const [page, setPage] = useState(0);
  const [grabbing, setGrabbing] = useState(false);

  const orbit = useRef<Orbit>({ yaw: 0, pitch: 0, dragging: false, moved: false });
  const start = useRef({ x: 0, y: 0, yaw: 0, pitch: 0 });

  useEffect(() => {
    let alive = true;
    buildCatalog(store).then((s) => {
      if (alive) setSpreads(s);
    });
    return () => {
      alive = false;
    };
  }, [store]);

  const last = spreads?.length ?? 0;
  const turn = (to: number) => setPage(Math.max(0, Math.min(last, to)));

  /**
   * Drag tracking lives on the window, not on a captured pointer.
   *
   * Capturing the pointer on this wrapper was swallowing the pointerup before
   * it reached the canvas, which killed every click on the book. Listening
   * globally for the duration of the drag gives the same reliable tracking
   * outside the element without taking the event away from anyone.
   */
  const onPointerDown = (e: React.PointerEvent) => {
    const host = e.currentTarget as HTMLElement;
    orbit.current.dragging = true;
    orbit.current.moved = false;
    start.current = {
      x: e.clientX,
      y: e.clientY,
      yaw: orbit.current.yaw,
      pitch: orbit.current.pitch,
    };
    setGrabbing(true);

    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - start.current.x;
      const dy = ev.clientY - start.current.y;
      // Under a few pixels it is a click with a shaky hand, not a drag.
      if (Math.hypot(dx, dy) > 4) orbit.current.moved = true;
      orbit.current.yaw = start.current.yaw + dx * 0.006;
      // Clamped so the book never tips past its own edge and vanishes.
      orbit.current.pitch = Math.max(
        -0.85,
        Math.min(0.85, start.current.pitch + dy * 0.005)
      );
    };

    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      orbit.current.dragging = false;
      setGrabbing(false);

      // A still pointer over the book turns a page: the half you released on
      // decides the direction, the way a real book does.
      if (!orbit.current.moved) {
        const r = host.getBoundingClientRect();
        const forward = ev.clientX - r.left > r.width / 2;
        setPage((prev) => Math.max(0, Math.min(last, prev + (forward ? 1 : -1))));
      }
      orbit.current.moved = false;
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  const recenter = () => {
    orbit.current.yaw = 0;
    orbit.current.pitch = 0;
  };

  return (
    <div className="relative w-full">
      <div
        onPointerDown={onPointerDown}
        className={`h-[58svh] min-h-[380px] w-full touch-none select-none ${
          grabbing ? "cursor-grabbing" : "cursor-grab"
        }`}
      >
        {spreads && (
          <Canvas
            shadows
            dpr={[1, 1.75]}
            gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping }}
            /*
             * Tight near and far planes. The default 0.1 to 2000 spreads the
             * depth buffer across a range twenty thousand times deeper than
             * this scene, leaving almost no precision where the pages actually
             * are — which is why leaves millimetres apart could not be told
             * apart. The book lives between roughly 1.7 and 4.5 units out.
             */
            camera={{ position: [0.35, 0.45, 3.1], fov: 42, near: 1, far: 14 }}
            onCreated={({ gl }) => {
              gl.toneMappingExposure = 1.05;
            }}
          >
            <Suspense fallback={null}>
              <Environment resolution={128} frames={1}>
                <color attach="background" args={["#efece5"]} />
                <Lightformer
                  form="rect"
                  intensity={3.4}
                  position={[0, 4, 3]}
                  rotation={[-Math.PI / 2.3, 0, 0]}
                  scale={[8, 5, 1]}
                  color="#ffffff"
                />
                <Lightformer
                  form="rect"
                  intensity={2}
                  position={[-4, 2, 2]}
                  rotation={[0, Math.PI / 2.4, 0]}
                  scale={[5, 4, 1]}
                  color="#ffffff"
                />
              </Environment>
              <ambientLight intensity={0.5} />
              <directionalLight position={[2, 4, 3]} intensity={1.4} castShadow />
              <Book page={page} spreads={spreads} orbit={orbit} />
              <ContactShadows
                position={[0, -1.05, 0]}
                opacity={0.42}
                scale={7}
                blur={2}
                far={2}
                color="#4A4438"
              />
            </Suspense>
          </Canvas>
        )}
        {!spreads && (
          <div className="flex size-full items-center justify-center text-[13px] text-[#8C8577]">
            Armando el catálogo…
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
        <button
          onClick={() => turn(page - 1)}
          disabled={page === 0}
          className="rounded-lg border border-[#DED8CB] bg-white px-4 py-2 text-[13px] font-bold text-[#16140F] transition-colors hover:border-[#0E7A46] disabled:opacity-40"
        >
          Anterior
        </button>
        {Array.from({ length: last + 1 }).map((_, i) => (
          <button
            key={i}
            onClick={() => turn(i)}
            aria-label={`Ir a la hoja ${i}`}
            className={`size-8 rounded-lg text-[12px] font-bold transition-colors ${
              page === i
                ? "bg-[#16140F] text-white"
                : "border border-[#DED8CB] bg-white text-[#5A5449] hover:border-[#8C8577]"
            }`}
          >
            {i === 0 ? "•" : i}
          </button>
        ))}
        <button
          onClick={() => turn(page + 1)}
          disabled={page === last}
          className="rounded-lg border border-[#DED8CB] bg-white px-4 py-2 text-[13px] font-bold text-[#16140F] transition-colors hover:border-[#0E7A46] disabled:opacity-40"
        >
          Siguiente
        </button>
        <button
          onClick={recenter}
          className="ml-1 rounded-lg px-3 py-2 text-[12px] font-semibold text-[#8C8577] transition-colors hover:text-[#16140F]"
        >
          Centrar
        </button>
      </div>

      <p className="mt-2 text-center text-[12px] text-[#8C8577]">
        Haz clic en una hoja para pasarla. Mantén presionado y arrastra para
        girar el catálogo.
      </p>
    </div>
  );
}
