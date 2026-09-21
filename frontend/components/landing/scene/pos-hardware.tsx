"use client";

/* eslint-disable react/no-unknown-property */

/**
 * The counter: terminal, receipt printer, card reader and a little stock.
 *
 * Built from primitives with physically based materials and lit for a light
 * page, so it reads as a product photograph rather than a glowing game asset.
 * There is deliberately no laser, no emissive trim and no additive glow — that
 * kind of thing is what makes a render look synthetic.
 */

import { useMemo, useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";

import {
  ScreenPainter,
  brushedMetalMap,
  softPlasticMap,
  receiptMap,
  productLabelMap,
} from "../lib/canvas-textures";
import { C } from "../lib/palette";
import type { CartLine, Vertical } from "../lib/pos-model";
import { VERTICALS } from "../lib/pos-model";
import { scrollState, range, damp } from "../lib/scroll-store";

/* ------------------------------------------------------------------ */
/* Materials                                                           */
/* ------------------------------------------------------------------ */

function useHardwareMaterials() {
  return useMemo(() => {
    const metalRough = new THREE.CanvasTexture(brushedMetalMap());
    metalRough.wrapS = metalRough.wrapT = THREE.RepeatWrapping;
    metalRough.repeat.set(2, 2);

    const plasticRough = new THREE.CanvasTexture(softPlasticMap());
    plasticRough.wrapS = plasticRough.wrapT = THREE.RepeatWrapping;
    plasticRough.repeat.set(4, 4);

    /** Anodised stand, light enough to sit on paper without a halo. */
    const aluminium = new THREE.MeshPhysicalMaterial({
      color: "#ADA79C",
      metalness: 0.92,
      roughness: 0.36,
      roughnessMap: metalRough,
      clearcoat: 0.25,
      clearcoatRoughness: 0.35,
      envMapIntensity: 1.1,
    });

    /**
     * Painted shell. Sits a couple of steps darker than the paper behind it —
     * at the same value the whole device dissolves into the page.
     */
    const shell = new THREE.MeshPhysicalMaterial({
      color: "#CFC9BC",
      metalness: 0.18,
      roughness: 0.5,
      roughnessMap: plasticRough,
      clearcoat: 0.3,
      clearcoatRoughness: 0.34,
      envMapIntensity: 0.5,
    });

    /** Graphite bezel: the only dark mass, so the screen has an edge. */
    const bezel = new THREE.MeshPhysicalMaterial({
      color: "#232120",
      metalness: 0.25,
      roughness: 0.55,
      roughnessMap: plasticRough,
      clearcoat: 0.4,
      clearcoatRoughness: 0.3,
      envMapIntensity: 0.25,
    });

    const glass = new THREE.MeshPhysicalMaterial({
      color: "#ffffff",
      metalness: 0,
      roughness: 0.08,
      opacity: 0.06,
      transparent: true,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
      envMapIntensity: 1.4,
    });

    const rubber = new THREE.MeshStandardMaterial({
      color: "#3A3733",
      roughness: 0.9,
      metalness: 0,
      roughnessMap: plasticRough,
    });

    return { aluminium, shell, bezel, glass, rubber };
  }, []);
}

type Materials = ReturnType<typeof useHardwareMaterials>;

/* ------------------------------------------------------------------ */
/* Terminal                                                            */
/* ------------------------------------------------------------------ */

export function PosTerminal({
  materials,
  vertical,
  lines,
  justAdded,
}: {
  materials: Materials;
  vertical: Vertical;
  lines: CartLine[];
  justAdded: string | null;
}) {
  const head = useRef<THREE.Group>(null);

  const { painter, texture } = useMemo(() => {
    const p = new ScreenPainter();
    const t = new THREE.CanvasTexture(p.canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 16;
    t.minFilter = THREE.LinearFilter;
    t.generateMipmaps = false;
    return { painter: p, texture: t };
  }, []);

  useEffect(() => () => texture.dispose(), [texture]);

  const clock = useRef(0);
  const lastPaint = useRef(-1);
  const lastKey = useRef("");

  useFrame((_, dt) => {
    clock.current += dt;

    // Repaint on a slow cadence, or immediately when the cart changes.
    const key = `${vertical}|${justAdded}|${lines
      .map((l) => l.id + l.qty)
      .join(",")}`;
    const stale = clock.current - lastPaint.current > 1 / 8;
    if (stale || key !== lastKey.current) {
      lastPaint.current = clock.current;
      lastKey.current = key;
      painter.paint({ vertical, lines, time: clock.current, justAdded });
      texture.needsUpdate = true;
    }

    // A touch of life so the device is not a frozen render. Damped to nothing
    // as the camera closes in, otherwise the screen wobbles in your face.
    if (head.current) {
      const calm = 1 - range(scrollState.scene, 0.35, 1.2);
      head.current.rotation.z = Math.sin(clock.current * 0.4) * 0.0035 * calm;
      head.current.position.y = 1.06 + Math.sin(clock.current * 0.6) * 0.0035 * calm;
    }
  });

  return (
    <group>
      {/* stand */}
      <mesh position={[0, 0.028, -0.08]} castShadow receiveShadow>
        <cylinderGeometry args={[0.46, 0.52, 0.056, 64]} />
        <primitive object={materials.aluminium} attach="material" />
      </mesh>
      <mesh position={[0, 0.004, -0.08]} receiveShadow>
        <cylinderGeometry args={[0.5, 0.5, 0.008, 48]} />
        <primitive object={materials.rubber} attach="material" />
      </mesh>

      <group position={[0, 0.36, -0.16]} rotation={[0.22, 0, 0]}>
        <RoundedBox args={[0.2, 0.72, 0.13]} radius={0.055} smoothness={6} castShadow>
          <primitive object={materials.aluminium} attach="material" />
        </RoundedBox>
      </group>

      {/* display head */}
      <group ref={head} position={[0, 1.06, 0.03]} rotation={[-0.14, 0, 0]}>
        <RoundedBox
          args={[1.64, 1.08, 0.072]}
          radius={0.048}
          smoothness={6}
          castShadow
          receiveShadow
        >
          <primitive object={materials.shell} attach="material" />
        </RoundedBox>

        <RoundedBox
          args={[1.6, 1.04, 0.02]}
          radius={0.04}
          smoothness={6}
          position={[0, 0, 0.04]}
        >
          <primitive object={materials.bezel} attach="material" />
        </RoundedBox>

        <mesh position={[0, 0.01, 0.052]}>
          <planeGeometry args={[1.5, 0.94]} />
          <meshBasicMaterial map={texture} toneMapped={false} />
        </mesh>

        <mesh position={[0, 0.01, 0.056]}>
          <planeGeometry args={[1.54, 0.98]} />
          <primitive object={materials.glass} attach="material" />
        </mesh>

        {/* camera pinhole and power light, the only two small details */}
        <mesh position={[-0.62, 0.5, 0.053]}>
          <circleGeometry args={[0.012, 20]} />
          <meshBasicMaterial color="#15130F" toneMapped={false} />
        </mesh>
        <mesh position={[0.62, 0.5, 0.053]}>
          <circleGeometry args={[0.007, 16]} />
          <meshBasicMaterial color={C.green} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Receipt printer                                                     */
/* ------------------------------------------------------------------ */

function ReceiptPrinter({
  materials,
  vertical,
  lines,
}: {
  materials: Materials;
  vertical: Vertical;
  lines: CartLine[];
}) {
  const paper = useRef<THREE.Mesh>(null);

  const paperTex = useMemo(() => {
    const t = new THREE.CanvasTexture(receiptMap(vertical, lines));
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
    // Reprinting on every keystroke would thrash; the slip is a prop, so it
    // only needs to follow the trade and the rough shape of the sale.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vertical, lines.length]);

  useEffect(() => () => paperTex.dispose(), [paperTex]);

  const paperGeo = useMemo(() => {
    const g = new THREE.PlaneGeometry(0.3, 0.78, 1, 40);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const t = (y + 0.39) / 0.78;
      const curl = Math.pow(1 - t, 2.1);
      pos.setZ(i, curl * 0.26);
      pos.setY(i, y + curl * 0.1);
    }
    g.computeVertexNormals();
    return g;
  }, []);

  const clock = useRef(0);
  useFrame((_, dt) => {
    clock.current += dt;
    if (paper.current) paper.current.rotation.z = Math.sin(clock.current * 0.9) * 0.01;
  });

  return (
    <group position={[-1.42, 0, 0.28]} rotation={[0, 0.42, 0]}>
      <RoundedBox
        args={[0.52, 0.34, 0.46]}
        radius={0.05}
        smoothness={5}
        position={[0, 0.17, 0]}
        castShadow
        receiveShadow
      >
        <primitive object={materials.shell} attach="material" />
      </RoundedBox>
      <mesh position={[0, 0.335, 0.02]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.34, 0.028]} />
        <meshBasicMaterial color="#2B2925" toneMapped={false} />
      </mesh>
      <mesh position={[0.19, 0.1, 0.232]}>
        <circleGeometry args={[0.01, 16]} />
        <meshBasicMaterial color={C.green} toneMapped={false} />
      </mesh>

      <mesh
        ref={paper}
        geometry={paperGeo}
        position={[0, 0.36, 0.12]}
        rotation={[-0.28, 0, 0]}
        castShadow
      >
        <meshStandardMaterial
          map={paperTex}
          roughness={0.95}
          metalness={0}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Card reader                                                         */
/* ------------------------------------------------------------------ */

function CardReader({ materials }: { materials: Materials }) {
  return (
    <group position={[1.36, 0, 0.36]} rotation={[0, -0.5, 0]}>
      <RoundedBox
        args={[0.44, 0.1, 0.56]}
        radius={0.04}
        smoothness={5}
        position={[0, 0.05, 0]}
        castShadow
        receiveShadow
      >
        <primitive object={materials.shell} attach="material" />
      </RoundedBox>
      <group position={[0, 0.101, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <mesh>
          <planeGeometry args={[0.4, 0.52]} />
          <meshStandardMaterial color="#2B2925" roughness={0.42} metalness={0.1} />
        </mesh>
        {/* keypad */}
        {Array.from({ length: 12 }).map((_, i) => (
          <mesh
            key={i}
            position={[-0.11 + (i % 3) * 0.11, -0.16 + Math.floor(i / 3) * 0.072, 0.002]}
          >
            <planeGeometry args={[0.082, 0.05]} />
            <meshStandardMaterial color="#3C3834" roughness={0.6} />
          </mesh>
        ))}
        <mesh position={[0, 0.16, 0.002]}>
          <planeGeometry args={[0.3, 0.13]} />
          <meshBasicMaterial color="#C9D6C6" toneMapped={false} />
        </mesh>
      </group>
      <mesh position={[0, 0.05, 0.281]}>
        <planeGeometry args={[0.3, 0.01]} />
        <meshBasicMaterial color="#1C1A17" toneMapped={false} />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Stock on the counter                                                */
/* ------------------------------------------------------------------ */

function Stock({ vertical }: { vertical: Vertical }) {
  const profile = VERTICALS[vertical];

  const labels = useMemo(() => {
    const a = profile.catalog[0];
    const b = profile.catalog[2];
    const texA = new THREE.CanvasTexture(productLabelMap(a.name, a.unit, C.green));
    const texB = new THREE.CanvasTexture(productLabelMap(b.name, b.unit, C.amber));
    texA.colorSpace = THREE.SRGBColorSpace;
    texB.colorSpace = THREE.SRGBColorSpace;
    texA.anisotropy = 8;
    texB.anisotropy = 8;
    return [texA, texB];
  }, [profile]);

  useEffect(() => () => labels.forEach((t) => t.dispose()), [labels]);

  return (
    <group>
      <group position={[-0.58, 0, 0.95]} rotation={[0, -0.3, 0]} scale={0.74}>
        <RoundedBox
          args={[0.36, 0.52, 0.2]}
          radius={0.01}
          smoothness={3}
          position={[0, 0.26, 0]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial map={labels[0]} roughness={0.78} metalness={0} />
        </RoundedBox>
      </group>
      <group position={[0.66, 0, 1.02]} rotation={[0, 0.42, 0]} scale={0.74}>
        <RoundedBox
          args={[0.3, 0.4, 0.24]}
          radius={0.01}
          smoothness={3}
          position={[0, 0.2, 0]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial map={labels[1]} roughness={0.8} metalness={0} />
        </RoundedBox>
      </group>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Assembled counter                                                   */
/* ------------------------------------------------------------------ */

export function CounterRig({
  vertical,
  lines,
  justAdded,
}: {
  vertical: Vertical;
  lines: CartLine[];
  justAdded: string | null;
}) {
  const materials = useHardwareMaterials();
  const group = useRef<THREE.Group>(null);

  useFrame((_, dt) => {
    if (!group.current) return;
    const s = scrollState.scene;

    // Once the story has left the till behind, the counter stops rendering
    // altogether — the globe gets the stage to itself rather than sharing it
    // with hardware loitering at the bottom of frame.
    group.current.visible = s < 3;
    if (!group.current.visible) return;

    // The rig squares up to the camera as the dive begins: by the time we are
    // at the glass the screen has to be dead-on, or the UI shears.
    const squareUp = range(s, 0.15, 1);
    const target = (-0.34 + scrollState.pointerX * 0.07) * (1 - squareUp);
    group.current.rotation.y = damp(group.current.rotation.y, target, 3.2, dt);
    group.current.rotation.x = damp(
      group.current.rotation.x,
      scrollState.pointerY * -0.03 * (1 - squareUp),
      3.2,
      dt
    );
  });

  return (
    <group ref={group}>
      <PosTerminal
        materials={materials}
        vertical={vertical}
        lines={lines}
        justAdded={justAdded}
      />
      <ReceiptPrinter materials={materials} vertical={vertical} lines={lines} />
      <CardReader materials={materials} />
      <Stock vertical={vertical} />
    </group>
  );
}
