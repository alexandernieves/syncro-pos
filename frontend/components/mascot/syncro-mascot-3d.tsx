"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

export type MascotPose = "idle" | "wave" | "point" | "think" | "celebrate";
export type MascotEmotion = "neutral" | "happy" | "angry" | "sad" | "surprised" | "thinking" | "sleepy";
/** What Syncro wears for the season: nothing, Santa's hat and beard, or a reindeer costume. */
export type MascotOutfit = "none" | "santa" | "reindeer" | "tree" | "elf" | "snowman";

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

/**
 * A tube that thins towards its tip (antler beams and tines). The radius goes from r0 at the
 * start of the curve to r1 at the end.
 */
function taperedTube(points: THREE.Vector3[], r0: number, r1: number) {
  const curve = new THREE.CatmullRomCurve3(points);
  const seg = 64;
  const radial = 28;
  const g = new THREE.TubeGeometry(curve, seg, 1, radial, false);
  const pos = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i <= seg; i++) {
    const u = i / seg;
    const center = curve.getPointAt(u);
    // Chunky most of the way, thinning gently near the tip
    const r = r0 + (r1 - r0) * Math.pow(u, 1.4);
    for (let j = 0; j <= radial; j++) {
      const k = i * (radial + 1) + j;
      v.fromBufferAttribute(pos, k).sub(center).multiplyScalar(r).add(center);
      pos.setXYZ(k, v.x, v.y, v.z);
    }
  }
  g.computeVertexNormals();
  return { geometry: g, tip: curve.getPointAt(1), base: curve.getPointAt(0), r0, r1 };
}

/**
 * One reindeer antler (the right one; the left is mirrored), soft and rounded like a plush toy:
 * a chunky curved beam and four rounded tines, all curves, no corners or straight runs.
 * Every tine starts inside the beam and ends in a round tip, so the joints look moulded in one piece.
 */
function antlerParts() {
  const P = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  return [
    // Main beam: thick, rises leaning out and curls back up at the top
    taperedTube([P(0, -0.05, 0), P(0.06, 0.28, 0.01), P(0.17, 0.62, -0.01), P(0.2, 0.96, -0.03), P(0.12, 1.3, -0.03)], 0.17, 0.12),
    // Low tine: long, almost flat outwards, lifting at the end like a finger
    taperedTube([P(0.07, 0.22, 0.01), P(0.3, 0.24, 0.03), P(0.52, 0.3, 0.04), P(0.68, 0.46, 0.04)], 0.13, 0.1),
    // Inner tine: towards the middle, then up
    taperedTube([P(0.09, 0.42, 0.01), P(-0.06, 0.55, 0.03), P(-0.16, 0.72, 0.04), P(-0.17, 0.9, 0.03)], 0.12, 0.095),
    // Middle tine: outwards and up, well apart from the low one
    taperedTube([P(0.17, 0.66, -0.01), P(0.38, 0.74, 0), P(0.56, 0.88, 0.01), P(0.64, 1.06, 0.01)], 0.12, 0.095),
    // Upper tine: short, up and a bit out
    taperedTube([P(0.2, 0.98, -0.03), P(0.33, 1.07, -0.02), P(0.42, 1.2, -0.01), P(0.44, 1.34, -0.01)], 0.11, 0.09),
  ];
}

/**
 * Syncro as a star: a five-pointed star with soft rounded points, thick and fully bevelled so every
 * edge is round. Same glazed white as the sphere; it faces the camera.
 */
function starGeometry() {
  const shape = new THREE.Shape();
  const outer = 1;
  const inner = 0.5;
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 === 0 ? outer : inner;
    pts.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r));
  }
  // Round every corner: walk the outline and bend through each vertex with a curve
  const round = (i: number) => (i % 2 === 0 ? 0.32 : 0.22);
  const at = (i: number) => pts[(i + 10) % 10];
  const toward = (from: THREE.Vector2, to: THREE.Vector2, f: number) => from.clone().lerp(to, f);
  shape.moveTo(...(toward(at(0), at(1), round(0)).toArray() as [number, number]));
  for (let i = 1; i <= 10; i++) {
    const v = at(i);
    const a = toward(v, at(i - 1), round(i));
    const b = toward(v, at(i + 1), round(i));
    shape.lineTo(a.x, a.y);
    shape.quadraticCurveTo(v.x, v.y, b.x, b.y);
  }
  const depth = 0.34;
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.2, bevelSize: 0.14, bevelSegments: 14, curveSegments: 28 });
  g.translate(0, 0, -depth / 2);
  g.computeVertexNormals();
  return g;
}
/**
 * An elf hat: tall and slim, its tip curls backwards like a little wave. Same bent-cylinder idea
 * as the Santa hat, with soft folds.
 */
function elfHatGeometry() {
  const H = 1.7;
  const g = new THREE.CylinderGeometry(0.06, 0.82, H, 96, 80, true);
  const pos = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const h = (v.y + H / 2) / H;
    const a = Math.atan2(v.z, v.x);
    const fold = 1 + h * 0.05 * Math.sin(a * 6 + h * 9);
    v.x *= fold;
    v.z *= fold;
    // Upper part falls to the side and its tip turns back up a little (a soft wave)
    const bend = Math.max(0, h - 0.4) / 0.6;
    v.x += 0.95 * bend * bend;
    v.y -= 0.7 * bend * bend * bend - 0.18 * Math.max(0, bend - 0.75) * 4 * bend;
    pos.setXYZ(i, v.x, v.y + H / 2, v.z);
  }
  g.computeVertexNormals();
  return g;
}
/** Where the curled tip of the elf hat ends (for the bell). */
const ELF_TIP = new THREE.Vector3(0.95, 1.7 - 0.7 + 0.18, 0);

/** A pointy elf ear: a flattened teardrop whose top narrows to a point. */
function elfEarGeometry() {
  const g = new THREE.SphereGeometry(1, 48, 36);
  const pos = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const up = Math.max(0, v.y);
    const narrow = 1 - up * up * 0.9;
    v.x *= narrow;
    v.z *= narrow;
    v.y *= v.y > 0 ? 1.35 : 0.8;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

/**
 * One loose end of the snowman's scarf: a soft, flat strip of fabric with round edges that hangs
 * from the knot, hugging the body as it falls and waving a little. Its top is at the origin.
 */
function scarfEndGeometry(length: number, width: number, sway: number) {
  const g = new RoundedBoxGeometry(width, length, 0.07, 6, 0.03);
  g.translate(0, -length / 2, 0);
  const pos = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const k = THREE.MathUtils.clamp(-v.y / length, 0, 1); // 0 at the knot, 1 at the bottom
    // Hugs the body: comes forward a little and then follows the curve back in
    v.z += 0.09 * Math.sin(k * Math.PI * 0.75);
    // A soft wave and a slight slant outwards
    v.x += sway * k + 0.025 * Math.sin(k * Math.PI * 2.2);
    // The fabric widens a touch towards the end
    v.x *= 1 + 0.12 * k;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

/** How far the star's front face is from its centre (for the eyes). */
const STAR_FACE = 0.34 / 2 + 0.2;

/** One soft tier of the tree: a rounded skirt that narrows to the next tier. */
function treeTier(bottom: number, top: number, R: number, r: number) {
  const P = (x: number, y: number) => new THREE.Vector2(x, y);
  const curve = new THREE.SplineCurve([P(0.001, bottom + 0.03), P(R * 0.78, bottom), P(R, bottom + 0.07), P(R * 0.86, bottom + (top - bottom) * 0.28), P((R + r) / 2, bottom + (top - bottom) * 0.62), P(r, top)]);
  const g = new THREE.LatheGeometry(curve.getPoints(48), 72);
  g.computeVertexNormals();
  return g;
}

/** The Christmas tree under the star: three glazed tiers, shiny baubles and a trunk. */
function treeParts() {
  const tiers = [
    { geometry: treeTier(-0.92, -0.18, 0.92, 0.28), bottom: -0.92, top: -0.18, R: 0.92, r: 0.28 },
    { geometry: treeTier(-0.42, 0.18, 0.74, 0.22), bottom: -0.42, top: 0.18, R: 0.74, r: 0.22 },
    { geometry: treeTier(-0.06, 0.62, 0.56, 0.02), bottom: -0.06, top: 0.62, R: 0.56, r: 0.02 },
  ];
  const colors = ["#e3262d", "#f4c430", "#2f6fe0", "#e3262d", "#f4c430", "#c9d3dc", "#2f6fe0", "#e3262d", "#f4c430", "#c9d3dc", "#e3262d"];
  const baubles: { pos: THREE.Vector3; color: string; r: number }[] = [];
  const spots = [
    [0, 0.25, -0.5], [0, 0.32, 0.15], [0, 0.3, 0.75],
    [1, 0.3, -0.35], [1, 0.36, 0.35], [1, 0.25, 0.95],
    [2, 0.3, -0.25], [2, 0.42, 0.35],
    [0, 0.5, 0.45], [1, 0.55, -0.05], [0, 0.1, 1.3],
  ];
  spots.forEach(([ti, f, a], i) => {
    const t = tiers[ti];
    const y = t.bottom + (t.top - t.bottom) * f;
    const rad = (t.R * 0.92 + (t.r - t.R * 0.92) * f) + 0.02;
    // Angle around the trunk; 0 faces the camera
    baubles.push({ pos: new THREE.Vector3(Math.sin(a) * rad, y, Math.cos(a) * rad), color: colors[i % colors.length], r: ti === 2 ? 0.075 : 0.095 });
  });
  return { tiers, baubles };
}

type EyeParts = { bead: THREE.Mesh | null; arc: THREE.Mesh | null; brow: THREE.Mesh | null };

function Head({ emotion, pose, still, anchor, poke, outfit, timeline }: { emotion?: MascotEmotion; pose: MascotPose; still: boolean; anchor: React.RefObject<HTMLDivElement | null>; poke: React.RefObject<number>; outfit: MascotOutfit; timeline?: number }) {
  // "Polished skin": white glazed ceramic with a clear coat; the emotion only tints it softly
  const mat = useMemo(
    () => ({
      skin: new THREE.MeshPhysicalMaterial({ color: "#fbfcfd", roughness: 0.12, metalness: 0.02, clearcoat: 1, clearcoatRoughness: 0.03, reflectivity: 0.5, emissive: "#000000" }),
      eye: new THREE.MeshPhysicalMaterial({ color: "#050506", roughness: 0.04, metalness: 0.15, clearcoat: 1, clearcoatRoughness: 0.01 }),
      // Christmas: glazed red hat, white trim and a soft white beard
      hat: new THREE.MeshPhysicalMaterial({ color: "#c81e24", roughness: 0.32, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.06, sheen: 0.6, sheenRoughness: 0.4, sheenColor: new THREE.Color("#ff6b6b"), side: THREE.DoubleSide }),
      fluff: new THREE.MeshPhysicalMaterial({ color: "#ffffff", roughness: 0.55, clearcoat: 0.5, clearcoatRoughness: 0.25, sheen: 1, sheenRoughness: 0.6, sheenColor: new THREE.Color("#ffffff") }),
      // Reindeer: a round, lacquered red nose that glows a little, and glazed caramel antlers
      nose: new THREE.MeshPhysicalMaterial({ color: "#e0141c", roughness: 0.08, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02, emissive: "#ff1a1a", emissiveIntensity: 0.18 }),
      antler: new THREE.MeshPhysicalMaterial({ color: "#8a5530", roughness: 0.14, metalness: 0.04, clearcoat: 1, clearcoatRoughness: 0.03, sheen: 0.3, sheenColor: new THREE.Color("#ffcf9e") }),
      ear: new THREE.MeshPhysicalMaterial({ color: "#c58a52", roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.05 }),
      earInner: new THREE.MeshPhysicalMaterial({ color: "#f3c9a6", roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.08 }),
      // Elf: glazed green hat with a red band, light-green points, a gold bell and rosy cheeks
      elfHat: new THREE.MeshPhysicalMaterial({ color: "#07692c", roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.04, sheen: 0.4, sheenColor: new THREE.Color("#9dffbf"), side: THREE.DoubleSide }),
      elfBand: new THREE.MeshPhysicalMaterial({ color: "#d4202a", roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.03 }),
      elfPoint: new THREE.MeshPhysicalMaterial({ color: "#2fae4f", roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.03 }),
      bell: new THREE.MeshPhysicalMaterial({ color: "#f2b81d", roughness: 0.1, metalness: 0.75, clearcoat: 1, clearcoatRoughness: 0.02 }),
      elfEarInner: new THREE.MeshPhysicalMaterial({ color: "#ffc4cc", roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.05 }),
      // Snowman: glossy twig arms, coal buttons, red scarf, carrot nose, black top hat
      twig: new THREE.MeshPhysicalMaterial({ color: "#6b4226", roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.04 }),
      coal: new THREE.MeshPhysicalMaterial({ color: "#111214", roughness: 0.08, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.02 }),
      scarf: new THREE.MeshPhysicalMaterial({ color: "#d2232c", roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.06, sheen: 0.5, sheenColor: new THREE.Color("#ff9a9a") }),
      carrot: new THREE.MeshPhysicalMaterial({ color: "#f07a12", roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.03 }),
      topHat: new THREE.MeshPhysicalMaterial({ color: "#16171a", roughness: 0.1, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.02 }),
      blush: new THREE.MeshPhysicalMaterial({ color: "#ff8fa3", roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.1, transparent: true, opacity: 0.55, depthWrite: false }),
      // Tree: Syncro as a star (same white glaze, it turns yellow on top), glazed green tiers
      star: new THREE.MeshPhysicalMaterial({ color: "#fbfcfd", roughness: 0.12, metalness: 0.02, clearcoat: 1, clearcoatRoughness: 0.03, emissive: "#000000" }),
      pine: new THREE.MeshPhysicalMaterial({ color: "#0e6633", roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.05, sheen: 0.3, sheenColor: new THREE.Color("#8fffb8") }),
      trunk: new THREE.MeshPhysicalMaterial({ color: "#7a4a28", roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.06 }),
    }),
    [],
  );
  useEffect(() => () => { Object.values(mat).forEach((m) => m.dispose()); }, [mat]);
  const hatGeometry = useMemo(() => santaHatGeometry(), []);
  useEffect(() => () => hatGeometry.dispose(), [hatGeometry]);
  const antler = useMemo(() => antlerParts(), []);
  useEffect(() => () => antler.forEach((a) => a.geometry.dispose()), [antler]);
  const frame = useRef<THREE.Group>(null);
  const hat = useRef<THREE.Group>(null);
  const beard = useRef<THREE.Group>(null);
  const reindeer = useRef<THREE.Group>(null);
  const elf = useRef<THREE.Group>(null);
  const elfHat = useRef<THREE.Group>(null);
  const elfHatGeo = useMemo(() => elfHatGeometry(), []);
  const elfEarGeo = useMemo(() => elfEarGeometry(), []);
  useEffect(() => () => { elfHatGeo.dispose(); elfEarGeo.dispose(); }, [elfHatGeo, elfEarGeo]);
  const star = useMemo(() => starGeometry(), []);
  useEffect(() => () => star.dispose(), [star]);
  const tree = useMemo(() => treeParts(), []);
  useEffect(() => () => tree.tiers.forEach((t) => t.geometry.dispose()), [tree]);
  const baubleMats = useMemo(() => tree.baubles.map((b) => new THREE.MeshPhysicalMaterial({ color: b.color, roughness: 0.06, metalness: 0.25, clearcoat: 1, clearcoatRoughness: 0.02 })), [tree]);
  useEffect(() => () => baubleMats.forEach((m) => m.dispose()), [baubleMats]);
  const perch = useRef<THREE.Group>(null);
  const sphere = useRef<THREE.Mesh>(null);
  const starMesh = useRef<THREE.Mesh>(null);
  const treeGroup = useRef<THREE.Group>(null);
  const treeTime = useRef(0);
  const snowTime = useRef(0);
  const snowMid = useRef<THREE.Mesh>(null);
  const snowBottom = useRef<THREE.Mesh>(null);
  const snowArms = useRef<(THREE.Group | null)[]>([]);
  const snowButtons = useRef<(THREE.Mesh | null)[]>([]);
  const snowScarf = useRef<THREE.Group>(null);
  const snowNose = useRef<THREE.Group>(null);
  const snowHat = useRef<THREE.Group>(null);
  const twig = useMemo(() => {
    const P = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
    // One arm (the right one; the left is mirrored): a curved branch with two little twigs
    return [
      taperedTube([P(0, 0, 0), P(0.28, 0.08, 0.02), P(0.55, 0.22, 0.03), P(0.8, 0.42, 0.02)], 0.055, 0.03),
      taperedTube([P(0.5, 0.19, 0.03), P(0.6, 0.34, 0.05), P(0.64, 0.48, 0.05)], 0.035, 0.022),
      taperedTube([P(0.68, 0.32, 0.02), P(0.84, 0.32, 0.03), P(0.96, 0.37, 0.03)], 0.03, 0.02),
    ];
  }, []);
  useEffect(() => () => twig.forEach((t) => t.geometry.dispose()), [twig]);
  const scarfEnds = useMemo(() => [scarfEndGeometry(0.46, 0.21, 0.05), scarfEndGeometry(0.32, 0.19, 0.11)], []);
  useEffect(() => () => scarfEnds.forEach((g) => g.dispose()), [scarfEnds]);
  // Body layout (in the frame, before it is scaled): middle and bottom snowballs
  const SNOW = { mid: { y: 0.3, r: 0.56, sy: 0.8 }, bottom: { y: -0.6, r: 0.78, sy: 0.86 } };
  const buttonSpots = useMemo(() => [0.5, 0.31, 0.12].map((y) => {
    const dy = (y - SNOW.mid.y) / (SNOW.mid.r * SNOW.mid.sy);
    return new THREE.Vector3(0, y, Math.sqrt(Math.max(0, 1 - dy * dy)) * SNOW.mid.r * 0.98);
  }), []); // eslint-disable-line react-hooks/exhaustive-deps
  const yellow = useMemo(() => new THREE.Color("#ffbf00"), []);

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

    // ── Christmas tree: sphere → star, the tree grows, the star climbs to the top and lights up ─
    // treeTime runs forward while the tree is on (and fast backwards when it goes away)
    const step = Math.min(delta, 0.1);
    if (timeline !== undefined) {
      treeTime.current = outfit === "tree" ? timeline : 0;
      snowTime.current = outfit === "snowman" ? timeline : 0;
    } else {
      treeTime.current = outfit === "tree" ? Math.min(4, treeTime.current + step) : Math.max(0, treeTime.current - step * 2.5);
      snowTime.current = outfit === "snowman" ? Math.min(4, snowTime.current + step) : Math.max(0, snowTime.current - step * 2.5);
    }
    const e = treeTime.current;
    const span = (from: number, len: number) => THREE.MathUtils.smoothstep(e, from, from + len);
    const backOut = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : 1 + 2.4 * Math.pow(x - 1, 3) + 1.4 * Math.pow(x - 1, 2));
    const morph = span(0, 0.7);
    const grow = backOut(THREE.MathUtils.clamp((e - 0.7) / 1.1, 0, 1));
    const rise = span(0.8, 1.1);
    const light = span(1.9, 0.8);
    // The sphere melts away while the star blooms out of it, facing the camera (a little pop)
    const pop = morph < 1 ? Math.sin(morph * Math.PI) * 0.12 : 0;
    if (sphere.current) {
      const k = Math.max(0.001, 1 - THREE.MathUtils.smoothstep(morph, 0.25, 1));
      sphere.current.scale.set(HEAD.scale[0] * k, HEAD.scale[1] * k, HEAD.scale[2] * k);
      sphere.current.visible = k > 0.01;
    }
    if (starMesh.current) {
      starMesh.current.scale.setScalar(Math.max(0.001, THREE.MathUtils.smoothstep(morph, 0, 0.75) + pop));
      starMesh.current.visible = morph > 0.01;
      // A small wiggle while it changes shape, then a gentle sway once it shines
      starMesh.current.rotation.z = (1 - morph) * Math.sin(morph * Math.PI * 3) * 0.35 + (still ? 0 : Math.sin(t * 1.3) * 0.05 * light);
    }
    if (eyes.current) {
      // The eyes settle on the star's flat face
      const shrink = 1 - morph * 0.2;
      const eyeZ = placement[0].pos.z * shrink;
      eyes.current.position.z = -morph * (eyeZ - (STAR_FACE + 0.02));
      eyes.current.position.y = -morph * 0.03;
      eyes.current.scale.setScalar(shrink);
    }
    // ── Snowman: two snowballs grow under the head, then arms, buttons, scarf, nose and top hat ─
    const sn = snowTime.current;
    const sspan = (from: number, len: number) => THREE.MathUtils.smoothstep(sn, from, from + len);
    const sback = (from: number, len: number) => backOut(THREE.MathUtils.clamp((sn - from) / len, 0, 1));
    const headUp = sspan(0, 1.1);
    const popIn = (m: THREE.Object3D | null | undefined, k: number, base: [number, number, number] = [1, 1, 1]) => {
      if (!m) return;
      m.scale.set(Math.max(0.001, k * base[0]), Math.max(0.001, k * base[1]), Math.max(0.001, k * base[2]));
      m.visible = k > 0.01;
    };
    popIn(snowMid.current, sback(0.1, 0.7), [1, SNOW.mid.sy, 1]);
    popIn(snowBottom.current, sback(0.85, 0.75), [1, SNOW.bottom.sy, 1]);
    snowArms.current.forEach((a) => popIn(a, sback(1.3, 0.55)));
    snowButtons.current.forEach((b, i) => popIn(b, sback(1.6 + i * 0.15, 0.35)));
    popIn(snowScarf.current, sback(2.0, 0.45));
    popIn(snowNose.current, sback(2.25, 0.4));
    if (snowHat.current) {
      // The hat drops in from above and bounces into place
      const drop = sback(2.45, 0.6);
      snowHat.current.visible = sn > 2.45;
      snowHat.current.position.y = 0.8 + (1 - drop) * 1.4;
      snowHat.current.scale.setScalar(sn > 2.45 ? 1 : 0.001);
    }

    if (perch.current) {
      perch.current.position.y = rise * 0.66 + headUp * 0.98;
      perch.current.scale.setScalar(1 - rise * 0.62 - headUp * 0.56);
    }
    if (treeGroup.current) {
      treeGroup.current.scale.set(Math.max(0.001, grow), Math.max(0.001, grow), Math.max(0.001, grow));
      treeGroup.current.visible = grow > 0.01;
    }
    // On top it lights up yellow, like the emotion tints, and twinkles softly
    const twinkle = still ? 0 : 0.5 + 0.5 * Math.sin(t * 3.1);
    mat.star.color.copy(mat.skin.color).lerp(yellow, light * 0.9);
    mat.star.emissive.copy(yellow).multiplyScalar(light * (0.3 + 0.15 * twinkle) + (1 - light) * c.mix * 0.18);

    // Season outfit: each piece pops in and out; the head shrinks a bit so hat or antlers fit
    const wear: [THREE.Group | null, boolean][] = [[hat.current, outfit === "santa"], [beard.current, outfit === "santa"], [reindeer.current, outfit === "reindeer"], [elf.current, outfit === "elf"]];
    for (const [g, on] of wear) {
      if (!g) continue;
      const next = g.scale.x + ((on ? 1 : 0) - g.scale.x) * ease(6);
      g.scale.setScalar(Math.max(0.001, next));
      g.visible = next > 0.02;
    }
    // The red nose glows softly, like a little light
    mat.nose.emissiveIntensity = outfit === "reindeer" && !still ? 0.16 + 0.12 * (0.5 + 0.5 * Math.sin(t * 2.6)) : 0.18;
    if (frame.current) {
      // The head keeps its size with any outfit (the canvas has room around it for hats and
      // antlers); only the tall tree and snowman shrink a little so they fit whole
      const treeFit = THREE.MathUtils.smoothstep(e, 0.7, 1.8);
      const snowFit = THREE.MathUtils.smoothstep(sn, 0.1, 1.4);
      const target = 1 - treeFit * 0.05 - snowFit * 0.08;
      const sc = timeline !== undefined ? target : frame.current.scale.x + (target - frame.current.scale.x) * ease(6);
      frame.current.scale.setScalar(sc);
      frame.current.position.y = treeFit * 0.1 - snowFit * 0.12;
      if (hat.current) hat.current.rotation.z = -0.12 + (still ? 0 : Math.sin(t * 2.2) * 0.04);
      // The elf hat's curled tip swings a little, ringing its bell
      if (elfHat.current) elfHat.current.rotation.z = 0.1 + (still ? 0 : Math.sin(t * 2.6) * 0.05);
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
      {/* Snowman body: a squashed middle snowball and a big bottom one, twig arms, coal buttons, scarf */}
      <mesh ref={snowMid} material={mat.skin} position={[0, SNOW.mid.y, 0]} scale={0.001} visible={false}>
        <sphereGeometry args={[SNOW.mid.r, 64, 48]} />
      </mesh>
      <mesh ref={snowBottom} material={mat.skin} position={[0, SNOW.bottom.y, 0]} scale={0.001} visible={false}>
        <sphereGeometry args={[SNOW.bottom.r, 64, 48]} />
      </mesh>
      {([-1, 1] as const).map((sd, i) => (
        <group key={`arm${sd}`} position={[0.5 * sd, 0.36, 0]} scale={[sd, 1, 1]}>
          <group ref={(g) => { snowArms.current[i] = g; }} scale={0.001} visible={false}>
            {twig.map((tw, k) => (
              <group key={k}>
                <mesh material={mat.twig} geometry={tw.geometry} />
                <mesh material={mat.twig} position={tw.tip}>
                  <sphereGeometry args={[tw.r1, 16, 12]} />
                </mesh>
              </group>
            ))}
          </group>
        </group>
      ))}
      {buttonSpots.map((p, i) => (
        <mesh key={`btn${i}`} ref={(m) => { snowButtons.current[i] = m; }} material={mat.coal} position={p} scale={0.001} visible={false}>
          <sphereGeometry args={[0.065, 24, 18]} />
        </mesh>
      ))}
      <group ref={snowScarf} position={[0, 0.62, 0]} scale={0.001} visible={false}>
        <mesh material={mat.scarf} rotation={[Math.PI / 2 + 0.08, 0, 0]} scale={[1, 1, 1.25]}>
          <torusGeometry args={[0.36, 0.1, 24, 72]} />
        </mesh>
        {/* The knot and two loose ends of fabric hanging over the body, with a little fringe */}
        <mesh material={mat.scarf} position={[0.17, -0.03, 0.47]} scale={[1.25, 0.95, 0.8]}>
          <sphereGeometry args={[0.1, 32, 24]} />
        </mesh>
        {scarfEnds.map((g, i) => {
          const at: [number, number, number] = i === 0 ? [0.14, -0.06, 0.5] : [0.24, -0.06, 0.46];
          const tilt = i === 0 ? 0.08 : 0.3;
          const len = i === 0 ? 0.46 : 0.32;
          const width = i === 0 ? 0.21 : 0.19;
          const sway = i === 0 ? 0.05 : 0.11;
          return (
            <group key={`end${i}`} position={at} rotation={[-0.08, 0, tilt]}>
              <mesh material={mat.scarf} geometry={g} />
              {Array.from({ length: 4 }, (_, k) => {
                const x = (k / 3 - 0.5) * width * 0.95 + sway;
                return (
                  <mesh key={k} material={mat.scarf} position={[x * 1.12, -len - 0.045, 0.09 * Math.sin(Math.PI * 0.75)]} rotation={[0, 0, (k / 3 - 0.5) * 0.3]}>
                    <capsuleGeometry args={[0.018, 0.06, 6, 12]} />
                  </mesh>
                );
              })}
            </group>
          );
        })}
      </group>

      {/* Christmas tree (grows under the star) */}
      <group ref={treeGroup} position={[0, -0.18, 0]} scale={0.001} visible={false}>
        <mesh material={mat.trunk} position={[0, -1.02, 0]}>
          <cylinderGeometry args={[0.15, 0.18, 0.26, 32]} />
        </mesh>
        {tree.tiers.map((tier, i) => (
          <mesh key={i} material={mat.pine} geometry={tier.geometry} />
        ))}
        {tree.baubles.map((b, i) => (
          <mesh key={`b${i}`} material={baubleMats[i]} position={b.pos}>
            <sphereGeometry args={[b.r, 24, 18]} />
          </mesh>
        ))}
      </group>
      <group ref={perch}>
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
        {/* Reindeer: antlers, little ears and a round red nose */}
        <group ref={reindeer} scale={0.001} visible={false}>
          {([-1, 1] as const).map((sd) => (
            <group key={`antler${sd}`} position={[0.42 * sd, 0.72, -0.1]} rotation={[-0.14, 0.15 * sd, -0.3 * sd]} scale={[0.82 * sd, 0.82, 0.82]}>
              {antler.map((a, i) => (
                <group key={i}>
                  <mesh material={mat.antler} geometry={a.geometry} />
                  {/* Round tip and a soft joint where it grows from the beam */}
                  <mesh material={mat.antler} position={a.tip}>
                    <sphereGeometry args={[a.r1, 32, 24]} />
                  </mesh>
                  <mesh material={mat.antler} position={a.base}>
                    <sphereGeometry args={[a.r0 * 1.02, 32, 24]} />
                  </mesh>
                </group>
              ))}
            </group>
          ))}
          {([-1, 1] as const).map((sd) => (
            <group key={`ear${sd}`} position={[0.9 * sd, 0.36, 0.02]} rotation={[0.25, 0.35 * sd, -1.25 * sd]}>
              <mesh material={mat.ear} scale={[0.17, 0.36, 0.08]}>
                <sphereGeometry args={[1, 32, 24]} />
              </mesh>
              <mesh material={mat.earInner} position={[0, 0.02, 0.06]} scale={[0.1, 0.25, 0.03]}>
                <sphereGeometry args={[1, 24, 16]} />
              </mesh>
            </group>
          ))}
          <mesh material={mat.nose} position={[0, -0.16, 0.985]}>
            <sphereGeometry args={[0.19, 48, 36]} />
          </mesh>
        </group>
        {/* Elf: tall curled hat with a bell, pointy ears and rosy cheeks */}
        <group ref={elf} scale={0.001} visible={false}>
          <group ref={elfHat} position={[0, 0.6, -0.06]} rotation={[-0.22, 0, 0.1]}>
            <mesh material={mat.elfHat} geometry={elfHatGeo} />
            {/* Red band */}
            <mesh material={mat.elfBand} rotation={[Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
              <torusGeometry args={[0.83, 0.13, 28, 96]} />
            </mesh>
            {/* Points hanging from the band: little triangles with round tips */}
            {Array.from({ length: 12 }, (_, i) => {
              const a = (i / 12) * Math.PI * 2;
              return (
                <group key={`pt${i}`} position={[Math.cos(a) * 0.88, -0.1, Math.sin(a) * 0.88]} rotation={[0, -a, 0]}>
                  <mesh material={mat.elfPoint} rotation={[0, 0, Math.PI]} position={[0, -0.06, 0]}>
                    <coneGeometry args={[0.14, 0.24, 28]} />
                  </mesh>
                  <mesh material={mat.elfPoint} position={[0, -0.17, 0]}>
                    <sphereGeometry args={[0.045, 16, 12]} />
                  </mesh>
                </group>
              );
            })}
            {/* Gold bell at the curled tip */}
            <mesh material={mat.bell} position={[ELF_TIP.x + 0.08, ELF_TIP.y - 0.1, ELF_TIP.z]}>
              <sphereGeometry args={[0.16, 32, 24]} />
            </mesh>
            {/* The bell's slit, underneath */}
            <mesh material={mat.eye} position={[ELF_TIP.x + 0.08, ELF_TIP.y - 0.24, ELF_TIP.z + 0.05]} rotation={[1.2, 0, 0]} scale={[0.1, 0.018, 0.03]}>
              <sphereGeometry args={[1, 16, 12]} />
            </mesh>
          </group>
          {([-1, 1] as const).map((sd) => (
            <group key={`elfear${sd}`} position={[1.0 * sd, 0.08, 0.06]} rotation={[0.1, -0.35 * sd, -0.95 * sd]}>
              <mesh material={mat.skin} geometry={elfEarGeo} scale={[0.2, 0.48, 0.08]} />
              <mesh material={mat.elfEarInner} geometry={elfEarGeo} position={[0, -0.03, 0.05]} scale={[0.11, 0.32, 0.035]} />
            </group>
          ))}
          {([-1, 1] as const).map((sd) => (
            <mesh key={`blush${sd}`} material={mat.blush} position={[0.48 * sd, -0.2, 0.84]} rotation={[0, 0.5 * sd, 0]} scale={[0.17, 0.1, 0.04]}>
              <sphereGeometry args={[1, 24, 16]} />
            </mesh>
          ))}
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
        <mesh ref={sphere} material={mat.skin} scale={HEAD.scale}>
          <sphereGeometry args={[HEAD.r, 64, 48]} />
        </mesh>
        {/* Snowman: carrot nose and a black top hat */}
        {/* Carrot: points forward and to the side so its length shows */}
        <group ref={snowNose} position={[0.02, -0.15, 0.9]} rotation={[0.1, 0.75, 0]} scale={0.001} visible={false}>
          <group rotation={[Math.PI / 2, 0, 0]}>
            <mesh material={mat.carrot} position={[0, 0.36, 0]}>
              <coneGeometry args={[0.16, 0.78, 40]} />
            </mesh>
            {[0.12, 0.28, 0.44].map((y, i) => (
              <mesh key={`ring${i}`} material={mat.carrot} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[0.16 * (1 - (y + 0.03) / 0.78) + 0.004, 0.014, 8, 32]} />
              </mesh>
            ))}
          </group>
        </group>
        <group ref={snowHat} position={[0, 0.92, -0.02]} rotation={[-0.1, 0, 0.08]} scale={0.001} visible={false}>
          <mesh material={mat.topHat} position={[0, 0.03, 0]}>
            <cylinderGeometry args={[0.82, 0.82, 0.07, 64]} />
          </mesh>
          <mesh material={mat.topHat} position={[0, 0.36, 0]}>
            <cylinderGeometry args={[0.52, 0.56, 0.62, 64]} />
          </mesh>
          <mesh material={mat.scarf} position={[0, 0.14, 0]}>
            <cylinderGeometry args={[0.565, 0.57, 0.13, 64]} />
          </mesh>
        </group>
        {/* Syncro as the star of the tree */}
        <mesh ref={starMesh} material={mat.star} geometry={star} scale={0.001} visible={false} />
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

/** Room around the box for outfits (35% on every side), and the camera distance that keeps the
 *  head the same size in the box as before, 15% bigger. */
const ROOM = 0.35;
const CAMERA_Z = (5 * (1 + 2 * ROOM)) / 1.15;

/**
 * Syncro's head in real 3D. Fills its parent (which sets the size). Without an `emotion` it lives on
 * its own: follows the cursor, smiles when the pointer is over it, gets startled when poked, dozes
 * off when nobody moves the mouse for a while, and shows a short mood now and then.
 */
export function SyncroMascot3D({ pose = "idle", emotion, festive = false, outfit, timeline }: { pose?: MascotPose; emotion?: MascotEmotion; festive?: boolean; outfit?: MascotOutfit; /** Freezes the tree animation at this second (previews) */ timeline?: number }) {
  // `festive` is the older switch: Santa's outfit
  const wearing: MascotOutfit = outfit ?? (festive ? "santa" : "none");
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
      {/* The canvas reaches past the box (without taking clicks there), so hats, antlers, the tree
          or the snowman show whole while the head keeps its size inside the box */}
      <div className="pointer-events-none absolute" style={{ inset: `-${ROOM * 100}%` }}>
      <Canvas
        frameloop={visible ? "always" : "never"}
        dpr={[1, 2]}
        gl={{ alpha: true, antialias: true, powerPreference: "low-power" }}
        camera={{ fov: 30, position: [0, 0.15, CAMERA_Z], near: 0.1, far: 50 }}
        onCreated={({ camera }) => camera.lookAt(0, 0, 0)}
      >
        <Studio />
        <Head emotion={emotion} pose={pose} still={still} anchor={anchor} poke={poke} outfit={wearing} timeline={timeline} />
      </Canvas>
      </div>
    </div>
  );
}
