"use client";

/* eslint-disable react/no-unknown-property */

/**
 * The globe that closes the argument: same software, any country.
 *
 * Land is an instanced point cloud sampled from rasterised continent
 * outlines, so there is no GeoJSON to ship. Colours stay flat and opaque —
 * no additive glow, no atmosphere halo — because on a light page those read
 * as smudges rather than light.
 */

import { useMemo, useRef, useEffect, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import { sampleWorldDots, latLonToVec3, MARKET_CITIES } from "../lib/world-dots";
import { C } from "../lib/palette";
import { scrollState, bump, damp } from "../lib/scroll-store";

const R = 1.28;

function TradeArc({
  from,
  to,
  offset,
}: {
  from: [number, number];
  to: [number, number];
  offset: number;
}) {
  const pulse = useRef<THREE.Mesh>(null);
  const lineMat = useRef<THREE.MeshBasicMaterial>(null);

  const curve = useMemo(() => {
    const a = new THREE.Vector3(...latLonToVec3(from[0], from[1], R));
    const b = new THREE.Vector3(...latLonToVec3(to[0], to[1], R));
    const mid = a.clone().add(b).multiplyScalar(0.5);
    mid.normalize().multiplyScalar(R * (1 + a.distanceTo(b) * 0.4));
    return new THREE.QuadraticBezierCurve3(a, mid, b);
  }, [from, to]);

  const geometry = useMemo(
    () => new THREE.TubeGeometry(curve, 44, 0.0055, 6, false),
    [curve]
  );
  useEffect(() => () => geometry.dispose(), [geometry]);

  const clock = useRef(offset * 4);

  useFrame((_, dt) => {
    clock.current += dt;
    const presence = bump(scrollState.scene, 7.3, 9.1, 0.2);
    if (lineMat.current) lineMat.current.opacity = presence * 0.55;
    if (pulse.current) {
      const t = (clock.current * 0.24) % 1;
      pulse.current.position.copy(curve.getPointAt(t));
      pulse.current.scale.setScalar((0.5 + Math.sin(t * Math.PI) * 0.7) * presence);
      pulse.current.visible = presence > 0.02;
    }
  });

  return (
    <group>
      <mesh geometry={geometry}>
        <meshBasicMaterial ref={lineMat} color={C.green} transparent opacity={0} />
      </mesh>
      <mesh ref={pulse} visible={false}>
        <sphereGeometry args={[0.02, 12, 12]} />
        <meshBasicMaterial color={C.green} toneMapped={false} />
      </mesh>
    </group>
  );
}

export function WorldGlobe() {
  const group = useRef<THREE.Group>(null);
  const dots = useRef<THREE.InstancedMesh>(null);
  const coreMat = useRef<THREE.MeshStandardMaterial>(null);
  const [land, setLand] = useState<{ lon: number; lat: number }[]>([]);

  useEffect(() => {
    const step =
      scrollState.quality === "low" ? 3.4 : scrollState.quality === "medium" ? 2.8 : 2.3;
    setLand(sampleWorldDots(step));
  }, []);

  useEffect(() => {
    const mesh = dots.current;
    if (!mesh || land.length === 0) return;
    const dummy = new THREE.Object3D();
    const out = new THREE.Vector3();
    land.forEach((d, i) => {
      const [x, y, z] = latLonToVec3(d.lat, d.lon, R);
      dummy.position.set(x, y, z);
      out.set(x, y, z).multiplyScalar(2);
      dummy.lookAt(out);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.count = land.length;
  }, [land]);

  const routes = useMemo(() => {
    const hub = MARKET_CITIES[0];
    return MARKET_CITIES.slice(1).map((c, i) => ({
      from: [hub.lat, hub.lon] as [number, number],
      to: [c.lat, c.lon] as [number, number],
      offset: i / 6,
    }));
  }, []);

  useFrame((_, dt) => {
    if (!group.current) return;
    const presence = bump(scrollState.scene, 7.3, 9.1, 0.2);

    group.current.rotation.y += dt * 0.075;
    group.current.position.y = damp(
      group.current.position.y,
      1.5 + (1 - presence) * -0.7,
      3,
      dt
    );
    group.current.scale.setScalar(Math.max(0.001, 0.5 + presence * 0.28));
    group.current.visible = presence > 0.02;

    if (coreMat.current) coreMat.current.opacity = presence;
    if (dots.current) {
      (dots.current.material as THREE.MeshBasicMaterial).opacity = presence * 0.92;
    }
  });

  return (
    <group ref={group} position={[0, 0.8, 0]} rotation={[0.3, 0, 0.24]} visible={false}>
      {/* A solid, lit sphere: on paper this is what gives the globe volume. */}
      <mesh>
        <sphereGeometry args={[R * 0.985, 64, 64]} />
        <meshStandardMaterial
          ref={coreMat}
          color="#E4DFD3"
          roughness={0.95}
          metalness={0}
          transparent
          opacity={0}
        />
      </mesh>

      <instancedMesh
        ref={dots}
        args={[undefined as never, undefined as never, 6000]}
        frustumCulled={false}
      >
        <circleGeometry args={[0.0125, 6]} />
        <meshBasicMaterial
          color={C.ink}
          transparent
          opacity={0}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </instancedMesh>

      {routes.map((r, i) => (
        <TradeArc key={i} {...r} />
      ))}

      {MARKET_CITIES.map((c) => {
        const [x, y, z] = latLonToVec3(c.lat, c.lon, R * 1.012);
        return (
          <mesh key={c.name} position={[x, y, z]}>
            <sphereGeometry args={[0.017, 10, 10]} />
            <meshBasicMaterial color={C.green} toneMapped={false} />
          </mesh>
        );
      })}
    </group>
  );
}
