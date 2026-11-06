"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer } from "@react-three/drei";
import * as THREE from "three";

export type MascotVariant = "full" | "head";
export type MascotPose = "idle" | "wave" | "point" | "think" | "celebrate";

/* ------------------------------------------------------------------------------------------------
 * Pointer: one window listener shared by every mascot on the page, so the eyes can follow the user.
 * --------------------------------------------------------------------------------------------- */
const pointer = { x: 0, y: 0, at: 0 };
let listening = false;
function trackPointer() {
  if (listening || typeof window === "undefined") return;
  listening = true;
  window.addEventListener(
    "pointermove",
    (e) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.at = performance.now();
    },
    { passive: true },
  );
}

/* ------------------------------------------------------------------------------------------------
 * Head geometry. The eyes are two black beads set into the surface of a slightly squashed sphere.
 * --------------------------------------------------------------------------------------------- */
type HeadSpec = { r: number; scale: [number, number, number]; eyeR: number; eyeYaw: number; eyePitch: number };
const FULL_HEAD: HeadSpec = { r: 0.43, scale: [1.05, 0.95, 1], eyeR: 0.062, eyeYaw: 0.3, eyePitch: 0.16 };
const BIG_HEAD: HeadSpec = { r: 1, scale: [1.06, 0.95, 1], eyeR: 0.15, eyeYaw: 0.32, eyePitch: 0.12 };

function eyePlacement(spec: HeadSpec, side: -1 | 1) {
  const [sx, sy, sz] = spec.scale;
  const a = spec.eyeYaw * side;
  const b = spec.eyePitch;
  const pos = new THREE.Vector3(sx * Math.sin(a) * Math.cos(b), sy * Math.sin(b), sz * Math.cos(a) * Math.cos(b)).multiplyScalar(spec.r);
  // Normal of the ellipsoid at that point: the bead faces outwards and sinks a little into the skin
  const normal = new THREE.Vector3(pos.x / (sx * sx), pos.y / (sy * sy), pos.z / (sz * sz)).normalize();
  pos.addScaledVector(normal, -spec.eyeR * 0.35);
  const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
  return { pos, quat };
}

/** Where each arm goes per pose. z opens the arm outwards (both sides), x brings it forward. */
function armTargets(pose: MascotPose, t: number, still: boolean) {
  const sway = (speed: number, amount: number) => (still ? 0 : Math.sin(t * speed) * amount);
  const rest = { z: 0.32 + sway(1.5, 0.02), x: -0.08 };
  switch (pose) {
    case "wave":
      return { right: { z: 2.62 + sway(7, 0.24), x: -0.15 }, left: rest };
    case "point":
      return { right: { z: 1.2, x: -0.75 }, left: rest };
    case "think":
      return { right: { z: 0.35, x: -1.95 }, left: rest };
    case "celebrate":
      return { right: { z: 2.7 + sway(5, 0.1), x: 0 }, left: { z: 2.7 + sway(5, 0.1), x: 0 } };
    default:
      return { right: rest, left: rest };
  }
}

function Mascot({ variant, pose, still, anchor }: { variant: MascotVariant; pose: MascotPose; still: boolean; anchor: React.RefObject<HTMLDivElement | null> }) {
  // "Polished skin": white glazed vinyl / ceramic, almost no metalness, a clear coat on top
  const mat = useMemo(
    () => ({
      skin: new THREE.MeshPhysicalMaterial({ color: "#fbfcfd", roughness: 0.12, metalness: 0.02, clearcoat: 1, clearcoatRoughness: 0.03, reflectivity: 0.5 }),
      eye: new THREE.MeshPhysicalMaterial({ color: "#050506", roughness: 0.04, metalness: 0.15, clearcoat: 1, clearcoatRoughness: 0.01 }),
    }),
    [],
  );
  useEffect(() => () => { mat.skin.dispose(); mat.eye.dispose(); }, [mat]);

  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Mesh>(null);
  const head = useRef<THREE.Group>(null);
  const eyes = useRef<THREE.Group>(null);
  const beads = useRef<(THREE.Mesh | null)[]>([]);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const brain = useRef({ nextBlink: 1.2 + Math.random() * 2, blinkAt: -10, nextSaccade: 0.5, sx: 0, sy: 0, lx: 0, ly: 0 });

  const spec = variant === "full" ? FULL_HEAD : BIG_HEAD;
  const placement = useMemo(() => [eyePlacement(spec, -1), eyePlacement(spec, 1)], [spec]);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const b = brain.current;
    const ease = (speed: number) => 1 - Math.exp(-speed * Math.min(delta, 0.1));

    // Where to look: the cursor when it moved recently, otherwise a slow wander
    let tx = 0;
    let ty = 0;
    const el = anchor.current;
    if (el && pointer.at > 0 && performance.now() - pointer.at < 6000) {
      const r = el.getBoundingClientRect();
      tx = THREE.MathUtils.clamp((pointer.x - (r.left + r.width / 2)) / 520, -1, 1);
      ty = THREE.MathUtils.clamp((pointer.y - (r.top + r.height * (variant === "full" ? 0.25 : 0.45))) / 520, -1, 1);
    } else {
      tx = Math.sin(t * 0.23) * 0.3;
      ty = Math.sin(t * 0.17) * 0.12;
    }
    if (pose === "think") { tx = 0.5; ty = -0.55; }
    if (still) { tx = 0; ty = 0; }
    b.lx += (tx - b.lx) * ease(3);
    b.ly += (ty - b.ly) * ease(3);

    // Micro-saccades: tiny quick jumps of the eyes now and then
    if (!still && t > b.nextSaccade) {
      b.sx = (Math.random() - 0.5) * 0.07;
      b.sy = (Math.random() - 0.5) * 0.05;
      b.nextSaccade = t + 0.5 + Math.random() * 2.4;
    }

    // Natural blinking: random gaps, sometimes a double blink
    if (!still && t > b.nextBlink) {
      b.blinkAt = t;
      b.nextBlink = t + (Math.random() < 0.18 ? 0.3 : 2 + Math.random() * 4);
    }
    const p = (t - b.blinkAt) / 0.17;
    const open = p >= 0 && p <= 1 ? 1 - Math.sin(p * Math.PI) * 0.93 : 1;
    for (const bead of beads.current) if (bead) bead.scale.y = 1.08 * open;

    if (head.current) {
      head.current.rotation.y += (b.lx * 0.38 - head.current.rotation.y) * ease(5);
      head.current.rotation.x += (b.ly * 0.24 - head.current.rotation.x) * ease(5);
      head.current.rotation.z += ((pose === "think" ? -0.14 : -b.lx * 0.05) - head.current.rotation.z) * ease(4);
    }
    if (eyes.current) {
      eyes.current.rotation.y += (b.lx * 0.14 + b.sx - eyes.current.rotation.y) * ease(22);
      eyes.current.rotation.x += (b.ly * 0.1 + b.sy - eyes.current.rotation.x) * ease(22);
    }

    // Idle: gentle float and breathing
    if (root.current) root.current.position.y = still ? 0 : Math.sin(t * 1.4) * (variant === "full" ? 0.03 : 0.05);
    if (body.current) {
      const s = still ? 0 : Math.sin(t * 1.4 + 0.7) * 0.014;
      body.current.scale.set(1 + s * 0.5, 0.97 * (1 + s), 0.88 * (1 + s * 0.5));
    }
    if (!head.current || variant !== "full") return;
    const arms = armTargets(pose, t, still);
    for (const [ref, target] of [[armR, arms.right], [armL, arms.left]] as const) {
      const g = ref.current;
      if (!g) continue;
      g.rotation.z += (target.z - g.rotation.z) * ease(7);
      g.rotation.x += (target.x - g.rotation.x) * ease(7);
    }
  });

  const headMesh = (
    <>
      <mesh material={mat.skin} scale={spec.scale}>
        <sphereGeometry args={[spec.r, 64, 48]} />
      </mesh>
      <group ref={eyes}>
        {placement.map((e, i) => (
          <group key={i} position={e.pos} quaternion={e.quat}>
            <mesh ref={(m) => { beads.current[i] = m; }} material={mat.eye} scale={[1, 1.08, 0.62]}>
              <sphereGeometry args={[spec.eyeR, 32, 24]} />
            </mesh>
          </group>
        ))}
      </group>
    </>
  );

  if (variant === "head") {
    return (
      <group ref={root}>
        <group ref={head}>{headMesh}</group>
      </group>
    );
  }

  return (
    <group ref={root}>
      {/* Short, chubby legs with rounded feet */}
      {([-1, 1] as const).map((s) => (
        <group key={s} position={[0.21 * s, 0, 0]}>
          <mesh material={mat.skin} position={[0, 0.34, 0]}>
            <capsuleGeometry args={[0.18, 0.2, 12, 32]} />
          </mesh>
          <mesh material={mat.skin} position={[0.02 * s, 0.13, 0.05]} scale={[1, 0.62, 1.2]}>
            <sphereGeometry args={[0.2, 48, 32]} />
          </mesh>
        </group>
      ))}

      {/* Round body: the bottom snowball */}
      <mesh ref={body} material={mat.skin} position={[0, 0.95, 0]} scale={[1, 0.97, 0.88]}>
        <sphereGeometry args={[0.62, 72, 56]} />
      </mesh>

      {/* Bubble arms with mitten hands; the left one is a mirror of the right */}
      {([-1, 1] as const).map((s) => (
        <group key={s} position={[0.56 * s, 1.24, 0.08]} scale={[s, 1, 1]}>
          <group ref={s < 0 ? armL : armR} rotation={[0, 0, 0.24]}>
            <mesh material={mat.skin} position={[0, -0.26, 0]}>
              <capsuleGeometry args={[0.14, 0.34, 12, 32]} />
            </mesh>
            <mesh material={mat.skin} position={[0, -0.6, 0]} scale={[0.95, 1.1, 0.78]}>
              <sphereGeometry args={[0.165, 40, 32]} />
            </mesh>
            {/* Thumb, on the side facing the body */}
            <mesh material={mat.skin} position={[-0.14, -0.53, 0.04]} rotation={[0, 0, -0.55]}>
              <capsuleGeometry args={[0.056, 0.08, 8, 16]} />
            </mesh>
          </group>
        </group>
      ))}

      {/* Head: the top snowball */}
      <group ref={head} position={[0, 1.8, 0]}>{headMesh}</group>
    </group>
  );
}

/** Soft studio light: a big softbox above, two strips on the sides, a key light and a cool rim. */
function Studio() {
  return (
    <>
      <ambientLight intensity={0.35} />
      <hemisphereLight args={["#ffffff", "#aeb6bf", 0.55]} />
      <directionalLight position={[3, 5, 4]} intensity={2} />
      <directionalLight position={[-4, 2.5, -3]} intensity={0.9} color="#e3ebff" />
      <Environment resolution={256} frames={1}>
        <color attach="background" args={["#a3a9b0"]} />
        <Lightformer form="rect" intensity={3.2} position={[0, 6, 2]} scale={[8, 3, 1]} />
        <Lightformer form="rect" intensity={2.6} position={[-5, 1.5, 3]} scale={[1.4, 6, 1]} />
        <Lightformer form="rect" intensity={1.8} position={[5, 1, 2]} scale={[1, 6, 1]} />
        <Lightformer form="circle" intensity={2.2} position={[2.5, 3, 6]} scale={1.4} />
      </Environment>
    </>
  );
}

/**
 * The Syncro mascot rendered in real 3D. Fills its parent (which sets the size).
 * `full` is the whole body; `head` is just the face, for small spots.
 */
export function SyncroMascot3D({ variant = "full", pose = "idle" }: { variant?: MascotVariant; pose?: MascotPose }) {
  const anchor = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const [still] = useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  useEffect(() => {
    trackPointer();
    const el = anchor.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const full = variant === "full";
  return (
    <div ref={anchor} className="absolute inset-0">
      <Canvas
        frameloop={visible ? "always" : "never"}
        dpr={[1, 2]}
        gl={{ alpha: true, antialias: true, powerPreference: "low-power" }}
        camera={{ fov: full ? 28 : 30, position: full ? [0, 1.2, 5.3] : [0, 0.15, 5], near: 0.1, far: 50 }}
        onCreated={({ camera }) => camera.lookAt(0, full ? 1.08 : 0, 0)}
      >
        <Studio />
        <Mascot variant={variant} pose={pose} still={still} anchor={anchor} />
        {full && <ContactShadows position={[0, 0, 0]} opacity={0.35} scale={3} blur={2.4} far={1.4} resolution={256} frames={1} />}
      </Canvas>
    </div>
  );
}
