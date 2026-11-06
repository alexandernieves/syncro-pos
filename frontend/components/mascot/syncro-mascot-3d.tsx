"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import * as THREE from "three";

export type MascotPose = "idle" | "wave" | "point" | "think" | "celebrate";
export type MascotEmotion = "neutral" | "happy" | "angry" | "sad" | "surprised" | "thinking" | "sleepy";

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
 * How each emotion looks. The skin keeps its glaze; the colour is only a soft, see-through tint.
 * --------------------------------------------------------------------------------------------- */
type Look = {
  tint: string; // colour mixed into the white skin
  mix: number; // how much of it (low, so it stays glazed white)
  bead: [number, number]; // eye bead scale (width, height)
  arc: number; // happy "bridge" eyes ∩ (0–1)
  brow: number; // brows (0–1)
  browSlant: number; // >0 angry (inner ends down), <0 sad (inner ends up)
  lookY: number; // where the eyes rest vertically (- up, + down)
  headTilt: number;
};
const LOOKS: Record<MascotEmotion, Look> = {
  neutral: { tint: "#ffffff", mix: 0, bead: [1, 1], arc: 0, brow: 0, browSlant: 0, lookY: 0, headTilt: 0 },
  happy: { tint: "#ffb08a", mix: 0.32, bead: [1, 1], arc: 1, brow: 0, browSlant: 0, lookY: 0, headTilt: 0.06 },
  angry: { tint: "#ff6f61", mix: 0.34, bead: [1.05, 0.72], arc: 0, brow: 1, browSlant: 0.5, lookY: 0.05, headTilt: 0 },
  sad: { tint: "#8fb6ff", mix: 0.32, bead: [0.95, 0.9], arc: 0, brow: 1, browSlant: -0.38, lookY: 0.35, headTilt: -0.1 },
  surprised: { tint: "#ffe07a", mix: 0.3, bead: [1.28, 1.32], arc: 0, brow: 0, browSlant: 0, lookY: -0.1, headTilt: 0 },
  thinking: { tint: "#c3adff", mix: 0.3, bead: [1, 0.7], arc: 0, brow: 0, browSlant: 0, lookY: -0.55, headTilt: -0.14 },
  sleepy: { tint: "#aebcd3", mix: 0.24, bead: [1.05, 0.14], arc: 0, brow: 0, browSlant: 0, lookY: 0.25, headTilt: 0.12 },
};

const POSE_EMOTION: Record<MascotPose, MascotEmotion> = { idle: "neutral", wave: "happy", celebrate: "happy", think: "thinking", point: "neutral" };

/* ------------------------------------------------------------------------------------------------
 * Head geometry: a slightly squashed glazed sphere with two black bead eyes set into its surface.
 * --------------------------------------------------------------------------------------------- */
const HEAD = { r: 1, scale: [1.06, 0.95, 1] as [number, number, number], eyeR: 0.15, eyeYaw: 0.32, eyePitch: 0.12 };

function eyePlacement(side: -1 | 1) {
  const [sx, sy, sz] = HEAD.scale;
  const a = HEAD.eyeYaw * side;
  const b = HEAD.eyePitch;
  const pos = new THREE.Vector3(sx * Math.sin(a) * Math.cos(b), sy * Math.sin(b), sz * Math.cos(a) * Math.cos(b)).multiplyScalar(HEAD.r);
  // Normal of the ellipsoid at that point: the eye faces outwards and sinks a little into the skin
  const normal = new THREE.Vector3(pos.x / (sx * sx), pos.y / (sy * sy), pos.z / (sz * sz)).normalize();
  pos.addScaledVector(normal, -HEAD.eyeR * 0.35);
  const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
  return { pos, quat };
}

/**
 * A Santa hat that isn't a straight cone: soft folds in the fabric and a tip that droops to one side
 * under its own weight. Built from a cylinder whose vertices are bent and rippled.
 */
function santaHatGeometry() {
  const H = 1.4;
  const g = new THREE.CylinderGeometry(0.07, 0.84, H, 96, 64, true);
  const pos = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const h = (v.y + H / 2) / H; // 0 at the brim, 1 at the tip
    const a = Math.atan2(v.z, v.x);
    // Folds: a few soft wrinkles that grow towards the tip, and a little dent where it bends
    const fold = 1 + h * (0.06 * Math.sin(a * 5 + h * 7) + 0.035 * Math.sin(a * 9 - h * 4)) - 0.08 * Math.exp(-((h - 0.62) ** 2) / 0.01) * Math.max(0, Math.cos(a));
    v.x *= fold;
    v.z *= fold;
    // Droop: the top half falls to the side and down
    const bend = Math.max(0, h - 0.35) / 0.65;
    v.x += 0.95 * bend * bend;
    v.y -= 0.72 * bend * bend * bend;
    pos.setXYZ(i, v.x, v.y + H / 2, v.z);
  }
  g.computeVertexNormals();
  return g;
}
/** Where the bent tip ends up (for the pompom). */
const HAT_TIP = new THREE.Vector3(0.95, 1.4 - 0.72, 0);

type EyeParts = { bead: THREE.Mesh | null; arc: THREE.Mesh | null; brow: THREE.Mesh | null };

function Head({ emotion, pose, still, anchor, poke, festive }: { emotion?: MascotEmotion; pose: MascotPose; still: boolean; anchor: React.RefObject<HTMLDivElement | null>; poke: React.RefObject<number>; festive: boolean }) {
  // "Polished skin": white glazed ceramic with a clear coat; the emotion only tints it softly
  const mat = useMemo(
    () => ({
      skin: new THREE.MeshPhysicalMaterial({ color: "#fbfcfd", roughness: 0.12, metalness: 0.02, clearcoat: 1, clearcoatRoughness: 0.03, reflectivity: 0.5, emissive: "#000000" }),
      eye: new THREE.MeshPhysicalMaterial({ color: "#050506", roughness: 0.04, metalness: 0.15, clearcoat: 1, clearcoatRoughness: 0.01 }),
      // Christmas: glazed red hat, white trim and a soft white beard
      hat: new THREE.MeshPhysicalMaterial({ color: "#c81e24", roughness: 0.32, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.06, sheen: 0.6, sheenRoughness: 0.4, sheenColor: new THREE.Color("#ff6b6b"), side: THREE.DoubleSide }),
      fluff: new THREE.MeshPhysicalMaterial({ color: "#ffffff", roughness: 0.55, clearcoat: 0.5, clearcoatRoughness: 0.25, sheen: 1, sheenRoughness: 0.6, sheenColor: new THREE.Color("#ffffff") }),
    }),
    [],
  );
  useEffect(() => () => { Object.values(mat).forEach((m) => m.dispose()); }, [mat]);
  const hatGeometry = useMemo(() => santaHatGeometry(), []);
  useEffect(() => () => hatGeometry.dispose(), [hatGeometry]);
  const frame = useRef<THREE.Group>(null);
  const hat = useRef<THREE.Group>(null);
  const beard = useRef<THREE.Group>(null);

  const root = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const eyes = useRef<THREE.Group>(null);
  const parts = useRef<EyeParts[]>([{ bead: null, arc: null, brow: null }, { bead: null, arc: null, brow: null }]);
  const placement = useMemo(() => [eyePlacement(-1), eyePlacement(1)], []);

  const white = useMemo(() => new THREE.Color("#fbfcfd"), []);
  const tint = useMemo(() => new THREE.Color(), []);
  const brain = useRef({
    nextBlink: 1.2 + Math.random() * 2,
    blinkAt: -10,
    nextSaccade: 0.5,
    sx: 0,
    sy: 0,
    lx: 0,
    ly: 0,
    // a short mood now and then while idle (a happy squint, a curious look)
    mood: null as MascotEmotion | null,
    moodUntil: 0,
    nextMood: 8 + Math.random() * 10,
    lastPoke: 0,
    cur: { mix: 0, bx: 1, by: 1, arc: 0, brow: 0, browSlant: 0, headTilt: 0 },
  });

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const b = brain.current;
    const ease = (speed: number) => 1 - Math.exp(-speed * Math.min(delta, 0.1));
    const now = performance.now();

    // ── What it feels ─────────────────────────────────────────────────────────────────────────
    const rect = anchor.current?.getBoundingClientRect();
    const pointerFresh = pointer.at > 0 && now - pointer.at < 6000;
    const hovered = !!rect && pointerFresh && pointer.x >= rect.left && pointer.x <= rect.right && pointer.y >= rect.top && pointer.y <= rect.bottom;
    const asleep = !still && pointer.at > 0 && now - pointer.at > 30000;
    if (poke.current && poke.current !== b.lastPoke) {
      b.lastPoke = poke.current;
      b.mood = "surprised";
      b.moodUntil = t + 0.7;
    }
    if (!still && !emotion && !b.mood && t > b.nextMood) {
      b.mood = Math.random() < 0.6 ? "happy" : "surprised";
      b.moodUntil = t + (b.mood === "happy" ? 1.6 : 0.6);
      b.nextMood = t + 12 + Math.random() * 14;
    }
    if (b.mood && t > b.moodUntil) b.mood = null;
    const feeling: MascotEmotion = emotion ?? b.mood ?? (asleep ? "sleepy" : hovered ? "happy" : POSE_EMOTION[pose]);
    const look = LOOKS[feeling];

    // ── Where it looks ────────────────────────────────────────────────────────────────────────
    let tx: number;
    let ty: number;
    if (rect && pointerFresh) {
      tx = THREE.MathUtils.clamp((pointer.x - (rect.left + rect.width / 2)) / 520, -1, 1);
      ty = THREE.MathUtils.clamp((pointer.y - (rect.top + rect.height * 0.45)) / 520, -1, 1);
    } else {
      tx = Math.sin(t * 0.23) * 0.3;
      ty = Math.sin(t * 0.17) * 0.12;
    }
    if (feeling === "thinking") tx = 0.5;
    if (feeling === "sleepy" || still) tx = 0;
    ty = feeling === "thinking" || feeling === "sad" || feeling === "sleepy" ? look.lookY : ty + look.lookY;
    b.lx += (tx - b.lx) * ease(3);
    b.ly += (ty - b.ly) * ease(3);

    // Micro-saccades: tiny quick jumps of the eyes now and then
    if (!still && feeling !== "sleepy" && t > b.nextSaccade) {
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

    // ── Blend towards the look ────────────────────────────────────────────────────────────────
    const c = b.cur;
    const k = ease(9);
    c.bx += (look.bead[0] - c.bx) * k;
    c.by += (look.bead[1] - c.by) * k;
    c.arc += (look.arc - c.arc) * k;
    c.brow += (look.brow - c.brow) * k;
    c.browSlant += (look.browSlant - c.browSlant) * k;
    c.headTilt += (look.headTilt - c.headTilt) * ease(4);
    c.mix += (look.mix - c.mix) * ease(3);

    // Soft, see-through colour on the glaze: mixed into the base plus a faint inner glow.
    // The clear coat stays on top, so the reflections remain white and glossy.
    tint.set(look.tint);
    mat.skin.color.copy(white).lerp(tint, c.mix);
    mat.skin.emissive.copy(tint).multiplyScalar(c.mix * 0.18);

    parts.current.forEach((part, i) => {
      const side = i === 0 ? -1 : 1;
      const beadOn = 1 - c.arc;
      const slant = c.browSlant * side;
      if (part.bead) {
        part.bead.scale.set(Math.max(0.001, c.bx * beadOn), Math.max(0.001, 1.08 * c.by * open * beadOn), 0.62);
        part.bead.rotation.z = slant * 0.35;
        part.bead.visible = beadOn > 0.02;
      }
      if (part.arc) {
        part.arc.scale.setScalar(Math.max(0.001, c.arc));
        part.arc.visible = c.arc > 0.02;
      }
      if (part.brow) {
        const shake = feeling === "angry" && !still ? Math.sin(t * 22) * 0.012 : 0;
        part.brow.scale.setScalar(Math.max(0.001, c.brow));
        part.brow.rotation.z = Math.PI / 2 + slant;
        part.brow.position.y = HEAD.eyeR * (1.55 - Math.abs(c.browSlant) * 0.2) + shake;
        part.brow.visible = c.brow > 0.02;
      }
    });

    if (head.current) {
      head.current.rotation.y += (b.lx * 0.38 - head.current.rotation.y) * ease(5);
      head.current.rotation.x += (b.ly * 0.24 - head.current.rotation.x) * ease(5);
      head.current.rotation.z += (c.headTilt - b.lx * 0.05 - head.current.rotation.z) * ease(4);
    }
    if (eyes.current) {
      eyes.current.rotation.y += (b.lx * 0.14 + b.sx - eyes.current.rotation.y) * ease(22);
      eyes.current.rotation.x += (b.ly * 0.1 + b.sy - eyes.current.rotation.x) * ease(22);
    }

    // Christmas outfit: pops in and out; the head shrinks a bit so the hat fits
    const dress = festive ? 1 : 0;
    for (const g of [hat.current, beard.current]) {
      if (!g) continue;
      const next = g.scale.x + (dress - g.scale.x) * ease(6);
      g.scale.setScalar(Math.max(0.001, next));
      g.visible = next > 0.02;
    }
    if (frame.current) {
      const target = festive ? 0.8 : 1;
      const sc = frame.current.scale.x + (target - frame.current.scale.x) * ease(6);
      frame.current.scale.setScalar(sc);
      frame.current.position.y = (1 - sc) * -0.55;
      if (hat.current) hat.current.rotation.z = -0.12 + (still ? 0 : Math.sin(t * 2.2) * 0.04);
    }

    // Idle float; bouncier when happy, slow and low when sleepy; a little stretch when surprised
    if (root.current) {
      const speed = feeling === "sleepy" ? 0.7 : feeling === "happy" ? 2.4 : 1.4;
      const amount = feeling === "sleepy" ? 0.03 : feeling === "happy" ? 0.07 : 0.05;
      root.current.position.y = still ? 0 : Math.sin(t * speed) * amount;
      const stretch = feeling === "surprised" && !still ? 1.05 : 1;
      root.current.scale.y += (stretch - root.current.scale.y) * ease(10);
    }
  });

  return (
    <group ref={frame}>
    <group ref={root}>
      <group ref={head}>
        {/* Santa hat: brim, cone leaning to one side and a pompom */}
        <group ref={hat} position={[0, 0.6, -0.04]} rotation={[-0.16, 0, -0.12]} scale={0.001} visible={false}>
          <mesh material={mat.hat} geometry={hatGeometry} />
          {/* Thick fur trim, slightly uneven */}
          <mesh material={mat.fluff} rotation={[Math.PI / 2, 0, 0]} scale={[1.04, 1, 0.98]}>
            <torusGeometry args={[0.84, 0.2, 32, 96]} />
          </mesh>
          <mesh material={mat.fluff} position={[0, 0.05, 0]} rotation={[Math.PI / 2, 0, 0.6]} scale={[1.02, 1.03, 0.9]}>
            <torusGeometry args={[0.83, 0.15, 24, 96]} />
          </mesh>
          {/* Pompom hanging from the drooping tip */}
          <mesh material={mat.fluff} position={[HAT_TIP.x + 0.06, HAT_TIP.y - 0.1, HAT_TIP.z]}>
            <sphereGeometry args={[0.21, 40, 32]} />
          </mesh>
        </group>
        {/* Beard and moustache */}
        <group ref={beard} scale={0.001} visible={false}>
          <mesh material={mat.fluff} position={[0, -0.6, 0.5]} scale={[1, 0.78, 0.62]}>
            <sphereGeometry args={[0.62, 48, 32]} />
          </mesh>
          {([-1, 1] as const).map((sd) => (
            <mesh key={`side${sd}`} material={mat.fluff} position={[0.52 * sd, -0.38, 0.52]}>
              <sphereGeometry args={[0.34, 32, 24]} />
            </mesh>
          ))}
          <mesh material={mat.fluff} position={[0, -1.02, 0.42]}>
            <sphereGeometry args={[0.36, 32, 24]} />
          </mesh>
          {([-1, 1] as const).map((sd) => (
            <mesh key={`m${sd}`} material={mat.fluff} position={[0.2 * sd, -0.2, 0.93]} rotation={[0, 0, 0.35 * sd]} scale={[1.7, 0.75, 0.6]}>
              <sphereGeometry args={[0.15, 24, 16]} />
            </mesh>
          ))}
        </group>
        <mesh material={mat.skin} scale={HEAD.scale}>
          <sphereGeometry args={[HEAD.r, 64, 48]} />
        </mesh>
        <group ref={eyes}>
          {placement.map((e, i) => (
            <group key={i} position={e.pos} quaternion={e.quat}>
              {/* Bead eye */}
              <mesh ref={(m) => { parts.current[i].bead = m; }} material={mat.eye} scale={[1, 1.08, 0.62]}>
                <sphereGeometry args={[HEAD.eyeR, 32, 24]} />
              </mesh>
              {/* Happy eye: a glossy black bridge ∩ */}
              <mesh ref={(m) => { parts.current[i].arc = m; }} material={mat.eye} position={[0, -HEAD.eyeR * 0.35, HEAD.eyeR * 0.2]} visible={false}>
                <torusGeometry args={[HEAD.eyeR * 0.95, HEAD.eyeR * 0.36, 20, 48, Math.PI]} />
              </mesh>
              {/* Brow, for angry and sad */}
              <mesh ref={(m) => { parts.current[i].brow = m; }} material={mat.eye} position={[0, HEAD.eyeR * 1.55, HEAD.eyeR * 0.2]} visible={false}>
                <capsuleGeometry args={[HEAD.eyeR * 0.2, HEAD.eyeR * 1.5, 8, 16]} />
              </mesh>
            </group>
          ))}
        </group>
      </group>
    </group>
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
 * Syncro's head in real 3D. Fills its parent (which sets the size). Without an `emotion` it lives on
 * its own: follows the cursor, smiles when the pointer is over it, gets startled when poked, dozes
 * off when nobody moves the mouse for a while, and shows a short mood now and then.
 */
export function SyncroMascot3D({ pose = "idle", emotion, festive = false }: { pose?: MascotPose; emotion?: MascotEmotion; festive?: boolean }) {
  const anchor = useRef<HTMLDivElement>(null);
  const poke = useRef(0);
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

  return (
    <div ref={anchor} className="absolute inset-0" onPointerDown={() => { poke.current = performance.now(); }}>
      <Canvas
        frameloop={visible ? "always" : "never"}
        dpr={[1, 2]}
        gl={{ alpha: true, antialias: true, powerPreference: "low-power" }}
        camera={{ fov: 30, position: [0, 0.15, 5], near: 0.1, far: 50 }}
        onCreated={({ camera }) => camera.lookAt(0, 0, 0)}
      >
        <Studio />
        <Head emotion={emotion} pose={pose} still={still} anchor={anchor} poke={poke} festive={festive} />
      </Canvas>
    </div>
  );
}
