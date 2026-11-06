/** What travels between the Syncro team's viewer and the business's screen. */
export type RemoteInput =
  | { kind: "move"; x: number; y: number }
  | { kind: "down" | "up"; x: number; y: number; button: "left" | "right" | "middle" }
  | { kind: "wheel"; x: number; y: number; deltaX: number; deltaY: number }
  | { kind: "key"; key: string; modifiers?: ("shift" | "control" | "alt" | "meta")[] };

/** Public STUN servers to find a direct path between both computers. */
export const ICE_SERVERS: RTCIceServer[] = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }];

export function socketSession() {
  try {
    const pwa = window.matchMedia("(display-mode: standalone)").matches;
    const store = pwa ? sessionStorage : localStorage;
    const user = JSON.parse(store.getItem("user") || "null");
    return { token: store.getItem("token"), role: user?.role as string | undefined, businessId: user?.businessId as string | undefined };
  } catch {
    return { token: null, role: undefined, businessId: undefined };
  }
}
