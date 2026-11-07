import { apiFetch } from "@/lib/api";
/** What travels between the Syncro team's viewer and the business's screen. */
export type RemoteInput =
  | { kind: "move"; x: number; y: number }
  | { kind: "down" | "up"; x: number; y: number; button: "left" | "right" | "middle" }
  | { kind: "wheel"; x: number; y: number; deltaX: number; deltaY: number }
  | { kind: "key"; key: string; modifiers?: ("shift" | "control" | "alt" | "meta")[] };

/** Public STUN servers to find a direct path between both computers. */
export const ICE_SERVERS: RTCIceServer[] = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }];

/**
 * STUN plus Syncro's TURN server (with credentials that expire), from the backend. When the two
 * networks can't connect directly, TURN relays the encrypted video. Falls back to STUN only.
 */
let iceCache: { at: number; servers: RTCIceServer[] } | null = null;
let iceLoading: Promise<RTCIceServer[]> | null = null;
export function getIceServers(): Promise<RTCIceServer[]> {
  if (iceCache && Date.now() - iceCache.at < 60 * 60 * 1000) return Promise.resolve(iceCache.servers);
  if (iceLoading) return iceLoading;
  iceLoading = apiFetch("/chat/remote/ice")
    .then(async (r) => (r.ok ? ((await r.json()).iceServers as RTCIceServer[]) : ICE_SERVERS))
    .catch(() => ICE_SERVERS)
    .then((servers) => {
      iceCache = { at: Date.now(), servers };
      iceLoading = null;
      return servers;
    });
  return iceLoading;
}

/** How the two computers ended up connected: directly, or relayed by Syncro's server. */
export async function connectionRoute(pc: RTCPeerConnection): Promise<"direct" | "relay" | null> {
  try {
    const stats = await pc.getStats();
    let pairId: string | undefined;
    stats.forEach((s) => { if (s.type === "transport" && s.selectedCandidatePairId) pairId = s.selectedCandidatePairId; });
    let pair: { localCandidateId?: string; remoteCandidateId?: string } | undefined;
    stats.forEach((s) => { if ((pairId && s.id === pairId) || (!pairId && s.type === "candidate-pair" && s.nominated && s.state === "succeeded")) pair = s; });
    if (!pair) return null;
    const local = pair.localCandidateId ? stats.get(pair.localCandidateId) : undefined;
    const remote = pair.remoteCandidateId ? stats.get(pair.remoteCandidateId) : undefined;
    return local?.candidateType === "relay" || remote?.candidateType === "relay" ? "relay" : "direct";
  } catch {
    return null;
  }
}

/** Up to 30 frames per second and enough bitrate for sharp text. */
export async function tuneSender(sender: RTCRtpSender) {
  try {
    const params = sender.getParameters();
    if (!params.encodings?.length) params.encodings = [{}];
    params.encodings[0].maxBitrate = 6_000_000;
    params.encodings[0].maxFramerate = 30;
    (params as RTCRtpSendParameters & { degradationPreference?: string }).degradationPreference = "maintain-framerate";
    await sender.setParameters(params);
  } catch {
    // older browsers: defaults are fine
  }
}

/** Prefer H.264 (hardware encoding on most computers, lower delay), then VP8. */
export function preferFastCodecs(pc: RTCPeerConnection) {
  try {
    const caps = RTCRtpSender.getCapabilities?.("video");
    if (!caps) return;
    const rank = (mime: string) => (mime === "video/H264" ? 0 : mime === "video/VP8" ? 1 : 2);
    const codecs = [...caps.codecs].sort((a, b) => rank(a.mimeType) - rank(b.mimeType));
    for (const t of pc.getTransceivers()) if (t.sender.track?.kind === "video") t.setCodecPreferences(codecs);
  } catch {
    // not supported: the browser picks
  }
}

/** Show frames as soon as they arrive instead of buffering them. */
export function lowLatency(receiver: RTCRtpReceiver) {
  const r = receiver as RTCRtpReceiver & { jitterBufferTarget?: number; playoutDelayHint?: number };
  try { if ("jitterBufferTarget" in r) r.jitterBufferTarget = 0; } catch { /* ignore */ }
  try { if ("playoutDelayHint" in r) r.playoutDelayHint = 0; } catch { /* ignore */ }
}

/** The microphone for talking during live assistance. Null when there is none or it was denied. */
export async function openMic(): Promise<MediaStream | null> {
  try {
    return await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
  } catch {
    return null;
  }
}

/** Plays the other side's voice. */
export function playVoice(track: MediaStreamTrack, el: HTMLAudioElement | null) {
  if (!el) return;
  el.srcObject = new MediaStream([track]);
  void el.play().catch(() => undefined);
}

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
