"use client";

import dynamic from "next/dynamic";
import { Component, type ReactNode, type RefObject, useEffect, useState } from "react";

export type ScLevel = 1 | 2 | 3 | 4;

/** Syncro Credit levels: every client starts at 4 and climbs to 1 with the money paid on time. */
export const SC_LEVELS: Record<ScLevel, { name: string; from: number }> = {
  4: { name: "Chispa", from: 0 },
  3: { name: "Cometa", from: 200 },
  2: { name: "Órbita", from: 500 },
  1: { name: "Galaxia", from: 1500 },
};

// eslint-disable-next-line @next/next/no-img-element
const Still = () => <img src="/nubi/nubi-happy.webp" alt="" draggable={false} className="absolute left-1/2 top-1/2 h-3/5 -translate-x-1/2 -translate-y-1/2 object-contain" />;
const SyncroMascot3D = dynamic(() => import("@/components/mascot/syncro-mascot-3d").then((m) => m.SyncroMascot3D), { ssr: false, loading: Still });

function canDraw3D() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}
class Safe3D extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { /* the still Nubi takes over */ }
  render() { return this.state.failed ? <Still /> : this.props.children; }
}

/**
 * Nubi on the level podium (2 · 1 · 3 · 4), standing on the client's step and living on its own:
 * hops of every size, leans, spins, walks off and rolls out of the screen, pretends to go up a
 * level or drops below it and vanishes in a puff, laughing with a yellow glow. It looks around,
 * now and then at `lookAt` (the credit card). Its feelings show in the eyes and the sphere's
 * colour. Tap it and it does something.
 */
export function NubiPodium({ level, className = "", lookAt }: { level: ScLevel; className?: string; lookAt?: RefObject<HTMLElement | null> }) {
  const [webgl, setWebgl] = useState<boolean | null>(null);
  useEffect(() => setWebgl(canDraw3D()), []);
  return (
    <div className={`relative select-none ${className}`}>
      {webgl ? (
        <Safe3D>
          <SyncroMascot3D outfit={`podium${level}`} noSleep lookAt={lookAt} />
        </Safe3D>
      ) : webgl === false ? <Still /> : null}
    </div>
  );
}
