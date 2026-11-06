"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { IconArrowBackUp, IconLoader2, IconSend, IconX } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { SyncroAvatar, type AvatarEmotion } from "@/components/syncro-avatar";
import { useSupportUnread } from "@/components/support-notifier";
import { isChristmasSeason, type MascotThought, useMascotSettings } from "@/lib/mascot";

/** Size of the head on screen. */
const SIZE = 96;
const HALF = SIZE / 2;
/** Space between the head and the edge of the screen. */
const MARGIN = 10;
/** What the head hops over or squeezes between when it roams: cards, the sidebar, the header, dialogs. */
const WALLS = '[data-slot="card"], [data-slot="sidebar-container"], header, [role="dialog"], [data-mascot-wall]';
const BULB_WAIT_MS = 30_000;
const THINK_EVERY_MS = 4 * 60_000;
const CLOUD_W = 330;

type Rect = { l: number; t: number; r: number; b: number };
type Exchange = { role: "user" | "assistant"; content: string };
type Mode = "follow" | "drag" | "fly";

function session() {
  try {
    const pwa = window.matchMedia("(display-mode: standalone)").matches;
    const store = pwa ? sessionStorage : localStorage;
    const user = JSON.parse(store.getItem("user") || "null");
    return { token: store.getItem("token"), role: user?.role as string | undefined, businessId: user?.businessId as string | undefined };
  } catch {
    return { token: null, role: undefined, businessId: undefined };
  }
}

/**
 * Syncro living on the screen. By default it slides along the frame of the screen, staying close to
 * where the person points or types (without covering it). With "roam" on it follows the pointer
 * across the page, squeezing through gaps and hopping over cards. It can be grabbed and thrown: it
 * bounces off the edges like a rubber ball. Ideas show as a glowing bulb and a glossy thought cloud
 * that stays attached to the head; while thinking, it stands still.
 */
export function MascotPet({ docked: forceDocked = false, side = "right", top = 38 }: { docked?: boolean; side?: "left" | "right"; top?: number }) {
  const settings = useMascotSettings();
  const unread = useSupportUnread();
  const [merchant, setMerchant] = useState(false);

  // Motion lives in refs and is written straight to the DOM every frame (no React re-render)
  const rootRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLSpanElement>(null);
  const shadowRef = useRef<HTMLSpanElement>(null);
  const pos = useRef({ x: -1, y: -1 });
  const vel = useRef({ x: 0, y: 0 });
  const squash = useRef({ x: 1, y: 1, vx: 0, vy: 0 });
  const size = useRef({ s: 1, lift: 0 });
  const mode = useRef<Mode>("follow");
  const interest = useRef({ x: 0, y: 0, at: 0 });
  const grab = useRef<{ dx: number; dy: number; startX: number; startY: number; moved: boolean; trail: { x: number; y: number; t: number }[] } | null>(null);
  const walls = useRef<Rect[]>([]);
  const [onRight, setOnRight] = useState(true);
  const [onTop, setOnTop] = useState(false);

  // Ideas
  const [thought, setThought] = useState<MascotThought | null>(null);
  const [cloud, setCloud] = useState<{ dx: number; above: boolean; maxH: number } | null>(null);
  const [typed, setTyped] = useState("");
  const [exchange, setExchange] = useState<Exchange[]>([]);
  const [replying, setReplying] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [mood, setMood] = useState<AvatarEmotion | undefined>(undefined);
  const [bulbOut, setBulbOut] = useState(false);
  const [festive, setFestive] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const thoughtRef = useRef<MascotThought | null>(null);
  useEffect(() => { thoughtRef.current = thought; }, [thought]);

  useEffect(() => {
    const s = session();
    setMerchant(!!s.token && !!s.businessId && s.role !== "syncropos" && s.role !== "client");
  }, []);

  const visible = merchant && !!settings?.visible;
  const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const roam = !forceDocked && !!settings?.roam && !reduced;
  const frozen = !!cloud;
  const frozenRef = useRef(false);
  useEffect(() => { frozenRef.current = frozen; }, [frozen]);

  // ── What the person is doing: where they point, and the field they're typing in ───────────
  useEffect(() => {
    if (!visible) return;
    const onMove = (e: PointerEvent) => { interest.current = { x: e.clientX, y: e.clientY, at: performance.now() }; };
    const onFocus = (e: FocusEvent) => {
      const el = e.target as HTMLElement | null;
      if (!el || !el.matches?.("input, textarea, select, [contenteditable]") || rootRef.current?.contains(el)) return;
      const r = el.getBoundingClientRect();
      interest.current = { x: r.left + r.width / 2, y: r.top + r.height / 2, at: performance.now() };
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("focusin", onFocus);
    return () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("focusin", onFocus); };
  }, [visible]);

  // Walls only matter when it roams inside the page
  useEffect(() => {
    if (!visible || !roam) { walls.current = []; return; }
    const refresh = () => {
      const own = rootRef.current;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      walls.current = Array.from(document.querySelectorAll<HTMLElement>(WALLS))
        .filter((el) => !own?.contains(el) && el.offsetParent !== null && !el.closest("[data-mascot-ignore]"))
        .map((el) => el.getBoundingClientRect())
        .filter((r) => r.width > 24 && r.height > 24 && r.bottom > 0 && r.right > 0 && r.left < vw && r.top < vh)
        .map((r) => ({ l: r.left, t: r.top, r: r.right, b: r.bottom }));
    };
    refresh();
    const id = window.setInterval(refresh, 700);
    window.addEventListener("scroll", refresh, true);
    window.addEventListener("resize", refresh);
    return () => { window.clearInterval(id); window.removeEventListener("scroll", refresh, true); window.removeEventListener("resize", refresh); };
  }, [visible, roam]);

  /** Where the head wants to be (top-left corner), given what the person is doing. */
  const goal = useCallback((now: number) => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const p = pos.current;
    const minX = MARGIN;
    const maxX = vw - SIZE - MARGIN;
    const minY = MARGIN;
    const maxY = vh - SIZE - MARGIN;
    if (forceDocked) return { x: side === "right" ? maxX - 4 : minX + 4, y: (vh * top) / 100 - HALF };
    const I = interest.current;
    const fresh = I.at > 0 && now - I.at < 8000;

    if (roam) {
      if (!fresh) return { x: p.x, y: p.y };
      // Keep company a little away from the pointer, on the side it already is
      const cx = p.x + HALF;
      const cy = p.y + HALF;
      let dx = cx - I.x;
      let dy = cy - I.y;
      const d = Math.hypot(dx, dy) || 1;
      dx /= d;
      dy /= d;
      const keep = 130;
      return { x: Math.min(maxX, Math.max(minX, I.x + dx * keep - HALF)), y: Math.min(maxY, Math.max(minY, I.y + dy * keep - HALF)) };
    }

    // Along the frame of the screen: the closest spot on the edge to what the person is doing
    const P = fresh ? { x: I.x - HALF, y: I.y - HALF } : { x: p.x, y: p.y };
    const dl = P.x - minX;
    const dr = maxX - P.x;
    const dt = P.y - minY;
    const db = maxY - P.y;
    const m = Math.min(dl, dr, dt, db);
    const T = m === dl ? { x: minX, y: P.y } : m === dr ? { x: maxX, y: P.y } : m === dt ? { x: P.x, y: minY } : { x: P.x, y: maxY };
    T.x = Math.min(maxX, Math.max(minX, T.x));
    T.y = Math.min(maxY, Math.max(minY, T.y));
    // Never sit on top of what the person is about to click: slide aside along the edge
    if (fresh) {
      const gap = 150;
      const vertical = m === dl || m === dr;
      const along = vertical ? I.y - (T.y + HALF) : I.x - (T.x + HALF);
      const across = vertical ? Math.abs(I.x - (T.x + HALF)) : Math.abs(I.y - (T.y + HALF));
      if (across < gap && Math.abs(along) < gap) {
        const shift = (along >= 0 ? -1 : 1) * (gap - Math.abs(along));
        if (vertical) T.y = Math.min(maxY, Math.max(minY, T.y + shift));
        else T.x = Math.min(maxX, Math.max(minX, T.x + shift));
        // At a corner it can't slide further: go to the other side of the pointer
        if (vertical && Math.abs(I.y - (T.y + HALF)) < gap) T.y = Math.min(maxY, Math.max(minY, I.y + (along >= 0 ? gap : -gap) - HALF));
        if (!vertical && Math.abs(I.x - (T.x + HALF)) < gap) T.x = Math.min(maxX, Math.max(minX, I.x + (along >= 0 ? gap : -gap) - HALF));
      }
    }
    return T;
  }, [roam, forceDocked, side, top]);

  // ── The motion loop ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!visible) return;
    if (pos.current.x < 0) {
      const vw = window.innerWidth;
      pos.current = { x: side === "right" ? vw - SIZE - MARGIN : MARGIN, y: (window.innerHeight * top) / 100 - HALF };
    }
    let raf = 0;
    let last = performance.now();
    let sideCheck = 0;
    /** One small physics step (the frame is split in steps of at most 1/60 s, so speed never depends on the frame rate). */
    const step = (dt: number, now: number) => {
      const p = pos.current;
      const v = vel.current;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const minX = MARGIN;
      const maxX = vw - SIZE - MARGIN;
      const minY = MARGIN;
      const maxY = vh - SIZE - MARGIN;
      const sq = squash.current;
      let targetScale = 1;
      let targetLift = 0;

      if (frozenRef.current) {
        v.x = 0;
        v.y = 0;
      } else if (mode.current === "drag") {
        // the pointer handlers move it
      } else if (mode.current === "fly") {
        // Thrown: glides with a little friction and bounces off the frame like a rubber ball
        p.x += v.x * dt;
        p.y += v.y * dt;
        const friction = Math.pow(0.55, dt);
        v.x *= friction;
        v.y *= friction;
        const hit = (axis: "x" | "y", speed: number) => {
          const k = Math.min(0.42, Math.abs(speed) / 4200);
          if (axis === "x") { sq.x = 1 - k; sq.y = 1 + k * 0.7; } else { sq.y = 1 - k; sq.x = 1 + k * 0.7; }
          sq.vx = 0;
          sq.vy = 0;
        };
        if (p.x < minX) { p.x = minX; hit("x", v.x); v.x = Math.abs(v.x) * 0.82; }
        if (p.x > maxX) { p.x = maxX; hit("x", v.x); v.x = -Math.abs(v.x) * 0.82; }
        if (p.y < minY) { p.y = minY; hit("y", v.y); v.y = Math.abs(v.y) * 0.82; }
        if (p.y > maxY) { p.y = maxY; hit("y", v.y); v.y = -Math.abs(v.y) * 0.82; }
        if (Math.hypot(v.x, v.y) < 45) { mode.current = "follow"; v.x = 0; v.y = 0; }
      } else {
        // Follow with a soft, critically damped spring: smooth, never jerky
        const g = goal(now);
        const w = roam ? 3.2 : 2.6;
        v.x += ((g.x - p.x) * w * w - v.x * 2 * w) * dt;
        v.y += ((g.y - p.y) * w * w - v.y * 2 * w) * dt;
        const max = 900;
        const sp = Math.hypot(v.x, v.y);
        if (sp > max) { v.x *= max / sp; v.y *= max / sp; }
        p.x += v.x * dt;
        p.y += v.y * dt;

        if (roam && walls.current.length) {
          const cx = p.x + HALF;
          const cy = p.y + HALF;
          const over = walls.current.some((r) => cx > r.l && cx < r.r && cy > r.t && cy < r.b);
          if (over) {
            // On top of a card: it hops over it (a bit bigger, higher shadow)
            targetScale = 1.1;
            targetLift = 1;
          } else {
            // Between walls closer than its size: it shrinks to fit through the gap
            let left = cx - minX;
            let right = maxX + SIZE - cx;
            let up = cy - minY;
            let down = maxY + SIZE - cy;
            for (const r of walls.current) {
              if (cy > r.t && cy < r.b) {
                if (r.r <= cx) left = Math.min(left, cx - r.r);
                if (r.l >= cx) right = Math.min(right, r.l - cx);
              }
              if (cx > r.l && cx < r.r) {
                if (r.b <= cy) up = Math.min(up, cy - r.b);
                if (r.t >= cy) down = Math.min(down, r.t - cy);
              }
            }
            const gap = Math.min(left + right, up + down);
            if (gap < SIZE + 8) targetScale = Math.max(0.55, (gap - 8) / SIZE);
          }
        }
      }
      p.x = Math.min(maxX, Math.max(minX, p.x));
      p.y = Math.min(maxY, Math.max(minY, p.y));

      // Jelly: the squash springs back with a little wobble
      sq.vx += ((1 - sq.x) * 260 - sq.vx * 11) * dt;
      sq.vy += ((1 - sq.y) * 260 - sq.vy * 11) * dt;
      sq.x += sq.vx * dt;
      sq.y += sq.vy * dt;
      const sz = size.current;
      sz.s += (targetScale - sz.s) * Math.min(1, dt * 8);
      sz.lift += (targetLift - sz.lift) * Math.min(1, dt * 8);
    };

    const tick = (now: number) => {
      const total = Math.min(0.1, (now - last) / 1000);
      last = now;
      const n = Math.max(1, Math.ceil(total * 60));
      for (let i = 0; i < n; i++) step(total / n, now);
      const p = pos.current;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const sq = squash.current;
      const sz = size.current;

      if (rootRef.current) rootRef.current.style.transform = `translate3d(${p.x}px, ${p.y}px, 0)`;
      if (bodyRef.current) bodyRef.current.style.transform = `translateY(${(-sz.lift * 14).toFixed(2)}px) scale(${(sq.x * sz.s).toFixed(4)}, ${(sq.y * sz.s).toFixed(4)})`;
      if (shadowRef.current) {
        const k = sz.s * (1 + sz.lift * 0.25);
        shadowRef.current.style.opacity = String(0.22 - sz.lift * 0.08);
        shadowRef.current.style.transform = `translateX(-50%) scale(${k.toFixed(3)})`;
      }

      // Bulb and badge on the side facing the middle of the screen (checked a few times a second)
      if (now - sideCheck > 300) {
        sideCheck = now;
        const right = p.x + HALF > vw / 2;
        const upper = p.y + HALF < vh / 2;
        setOnRight((r) => (r === right ? r : right));
        setOnTop((t) => (t === upper ? t : upper));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [visible, goal, roam, side, top]);

  // ── Grab and throw ──────────────────────────────────────────────────────────────────────────
  const onPointerDown = (e: React.PointerEvent) => {
    if (frozen || e.button !== 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const now = performance.now();
    grab.current = { dx: e.clientX - pos.current.x, dy: e.clientY - pos.current.y, startX: e.clientX, startY: e.clientY, moved: false, trail: [{ x: e.clientX, y: e.clientY, t: now }] };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const g = grab.current;
    if (!g) return;
    if (!g.moved && Math.hypot(e.clientX - g.startX, e.clientY - g.startY) < 6) return;
    g.moved = true;
    mode.current = "drag";
    const now = performance.now();
    pos.current.x = e.clientX - g.dx;
    pos.current.y = e.clientY - g.dy;
    g.trail.push({ x: e.clientX, y: e.clientY, t: now });
    while (g.trail.length > 2 && now - g.trail[0].t > 90) g.trail.shift();
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const g = grab.current;
    grab.current = null;
    if (!g) return;
    if (!g.moved) {
      mode.current = "follow";
      window.dispatchEvent(new Event("support-chat:open"));
      return;
    }
    const first = g.trail[0];
    const span = Math.max(16, performance.now() - first.t) / 1000;
    let vx = (e.clientX - first.x) / span;
    let vy = (e.clientY - first.y) / span;
    const sp = Math.hypot(vx, vy);
    const cap = 3200;
    if (sp > cap) { vx *= cap / sp; vy *= cap / sp; }
    if (sp > 120) {
      vel.current = { x: vx, y: vy };
      mode.current = "fly";
    } else {
      vel.current = { x: 0, y: 0 };
      mode.current = "follow";
    }
  };

  // ── Ideas: ask for one now and then (the server decides if it's time) ─────────────────────
  useEffect(() => {
    if (!visible || !settings?.ideas) return;
    let alive = true;
    const ask = async () => {
      if (document.hidden || thoughtRef.current) return;
      try {
        const res = await apiFetch("/mascot/think", { method: "POST" });
        if (!res.ok || !alive) return;
        const t = await res.json();
        if (t?.id && t.status === "NEW") { setBulbOut(false); setThought(t); }
      } catch {
        // offline: try later
      }
    };
    const first = window.setTimeout(ask, 12_000);
    const id = window.setInterval(ask, THINK_EVERY_MS);
    return () => { alive = false; window.clearTimeout(first); window.clearInterval(id); };
  }, [visible, settings?.ideas]);

  const setStatus = (id: string, status: "SHOWN" | "DISMISSED") => apiFetch(`/mascot/thoughts/${id}`, { method: "PUT", body: JSON.stringify({ status }) }).catch(() => undefined);

  /** Opens the cloud attached to the head, on the side with room; the head stops while it thinks. */
  const openThought = useCallback((t: MascotThought) => {
    mode.current = "follow";
    vel.current = { x: 0, y: 0 };
    const p = pos.current;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = Math.min(CLOUD_W, vw - 32);
    const wantLeft = p.x + HALF > vw / 2;
    const screenX = Math.max(16, Math.min(vw - w - 16, wantLeft ? p.x + HALF - w + 40 : p.x + HALF - 40));
    const above = p.y + HALF > vh / 2;
    const maxH = Math.max(180, above ? p.y - 80 : vh - (p.y + SIZE) - 80);
    setCloud({ dx: screenX - p.x, above, maxH });
    setExchange([]);
    setReplying(false);
    setDraft("");
    setTyped("");
    setMood((t.emotion as AvatarEmotion) || "happy");
    void setStatus(t.id, "SHOWN");
  }, []);

  // Bulb waiting: if nobody clicks it, the mascot decides — important ideas speak up, the rest fade
  useEffect(() => {
    if (!thought || cloud) return;
    const id = window.setTimeout(() => {
      if (thought.importance >= 3) openThought(thought);
      else {
        setBulbOut(true);
        void setStatus(thought.id, "DISMISSED");
        window.setTimeout(() => { setThought(null); setBulbOut(false); }, 700);
      }
    }, BULB_WAIT_MS);
    return () => window.clearTimeout(id);
  }, [thought, cloud, openThought]);

  // Types the idea out, then opens the reply box if the mascot asked something
  const cloudOpen = cloud !== null;
  useEffect(() => {
    if (!cloudOpen || !thought) return;
    const text = thought.text;
    let i = 0;
    const id = window.setInterval(() => {
      i += 2;
      setTyped(text.slice(0, i));
      if (i >= text.length) {
        window.clearInterval(id);
        if (thought.needsReply) { setReplying(true); setTimeout(() => inputRef.current?.focus(), 60); }
      }
    }, 22);
    return () => window.clearInterval(id);
  }, [cloudOpen, thought]);

  // The conversation keeps scrolling to the newest line
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [typed, exchange, busy, replying]);

  const closeCloud = () => {
    setCloud(null);
    setThought(null);
    setMood(undefined);
    setReplying(false);
  };

  const sendReply = async () => {
    const text = draft.trim();
    if (!text || !thought || busy) return;
    setBusy(true);
    setExchange((x) => [...x, { role: "user", content: text }]);
    setDraft("");
    setMood("thinking");
    try {
      const res = await apiFetch(`/mascot/thoughts/${thought.id}/reply`, { method: "POST", body: JSON.stringify({ text }) });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.message || "No pude pensar en eso ahora");
      setExchange((x) => [...x, { role: "assistant", content: body.reply }]);
      setMood((body.emotion as AvatarEmotion) || "happy");
      setReplying(true);
      setTimeout(() => inputRef.current?.focus(), 60);
    } catch (e) {
      setExchange((x) => [...x, { role: "assistant", content: (e as Error).message }]);
      setMood("sad");
    } finally {
      setBusy(false);
    }
  };

  // ── Christmas: now and then the Santa hat and beard ───────────────────────────────────────
  useEffect(() => {
    if (!visible || !settings?.festive || !isChristmasSeason()) return;
    let timer = 0;
    const schedule = (first: boolean) => {
      timer = window.setTimeout(() => {
        setFestive(true);
        timer = window.setTimeout(() => { setFestive(false); schedule(false); }, 25_000 + Math.random() * 20_000);
      }, first ? 30_000 + Math.random() * 30_000 : 3 * 60_000 + Math.random() * 6 * 60_000);
    };
    schedule(true);
    return () => window.clearTimeout(timer);
  }, [visible, settings?.festive]);

  if (!visible) return null;

  const showBulb = !!thought && !cloud;
  const name = settings?.name || "Syncro";
  const cloudW = typeof window !== "undefined" ? Math.min(CLOUD_W, window.innerWidth - 32) : CLOUD_W;

  return (
    <>
      <style>{`
        @keyframes syncro-bulb { 0%,100% { transform: rotate(-8deg); } 50% { transform: rotate(8deg); } }
        @keyframes syncro-glow { 0%,100% { opacity: .55; transform: scale(1); } 50% { opacity: .9; transform: scale(1.15); } }
        @keyframes syncro-pop { 0% { transform: scale(0); opacity: 0; } 70% { transform: scale(1.1); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
        .syncro-pop { animation: syncro-pop .35s cubic-bezier(.2,.9,.3,1.3) both; }
        .syncro-noscroll { scrollbar-width: none; -ms-overflow-style: none; }
        .syncro-noscroll::-webkit-scrollbar { display: none; }
      `}</style>

      {/* Everything that belongs to the mascot moves together: head, bulb, badge and thought */}
      <div ref={rootRef} data-mascot-ignore className="pointer-events-none fixed left-0 top-0 z-[45] will-change-transform" style={{ width: SIZE, height: SIZE }}>
        <span ref={shadowRef} className="absolute -bottom-2 left-1/2 h-3 w-16 rounded-full bg-black/40 blur-md" style={{ opacity: 0.22, transform: "translateX(-50%)" }} />
        <button
          type="button"
          aria-label={unread ? `Hablar con el Equipo Syncro, ${unread} sin leer` : "Hablar con el Equipo Syncro"}
          title={`${name} · clic para hablar con el Equipo Syncro, o arrástralo y lánzalo`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => { grab.current = null; mode.current = "follow"; }}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); window.dispatchEvent(new Event("support-chat:open")); } }}
          className={cn("pointer-events-auto relative block touch-none select-none rounded-full outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2", frozen ? "cursor-default" : "cursor-grab active:cursor-grabbing")}
          style={{ width: SIZE, height: SIZE }}
        >
          <span ref={bodyRef} className="block will-change-transform" style={{ transformOrigin: "50% 60%" }}>
            <SyncroAvatar size={SIZE} title="" emotion={mood ?? (unread ? "surprised" : undefined)} festive={festive} />
          </span>
          {unread > 0 && (
            <span className={cn("absolute bottom-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold tabular-nums text-primary-foreground ring-2 ring-background", onRight ? "left-0" : "right-0")}>
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>

        {/* The idea: a glowing, glossy light bulb on the edge of the head, facing the screen */}
        {showBulb && (
          <button
            type="button"
            aria-label={`${name} tiene una idea`}
            title="Tengo una idea"
            onClick={() => thought && openThought(thought)}
            className={cn("pointer-events-auto absolute origin-bottom outline-none transition-[opacity,transform] duration-500 focus-visible:ring-2 focus-visible:ring-amber-400", onRight ? "-left-3" : "-right-3", onTop ? "-bottom-6" : "-top-6", bulbOut ? "scale-50 opacity-0" : "syncro-pop")}
            style={{ width: 40, height: 52 }}
          >
            <span className="absolute inset-0 rounded-full bg-amber-300 blur-md" style={{ animation: bulbOut ? undefined : "syncro-glow 1.8s ease-in-out infinite" }} />
            <svg viewBox="0 0 40 52" width="40" height="52" className="relative" style={{ animation: bulbOut ? undefined : "syncro-bulb 2.4s ease-in-out infinite", transformOrigin: "50% 100%" }}>
              <defs>
                <radialGradient id="syncro-bulb-glass" cx="0.38" cy="0.32" r="0.75">
                  <stop offset="0" stopColor="#fffbe6" />
                  <stop offset="0.45" stopColor="#ffe066" />
                  <stop offset="1" stopColor="#f5a623" />
                </radialGradient>
                <linearGradient id="syncro-bulb-base" x1="0" x2="1">
                  <stop offset="0" stopColor="#9aa3ad" />
                  <stop offset="0.45" stopColor="#f4f6f8" />
                  <stop offset="1" stopColor="#8b939c" />
                </linearGradient>
              </defs>
              <path d="M20 2 C31 2 37 10 37 18 C37 25 32 28 29 33 L11 33 C8 28 3 25 3 18 C3 10 9 2 20 2 Z" fill="url(#syncro-bulb-glass)" />
              <path d="M15 33 L15 22 Q20 17 25 22 L25 33" fill="none" stroke="#f08c00" strokeWidth="1.4" opacity=".7" />
              <ellipse cx="13" cy="11" rx="5" ry="3" fill="#fff" opacity=".85" transform="rotate(-30 13 11)" />
              <rect x="11" y="33" width="18" height="11" rx="2.5" fill="url(#syncro-bulb-base)" />
              <path d="M11 37 H29 M11 40.5 H29" stroke="#7d858e" strokeWidth="1" opacity=".7" />
              <path d="M15 44 H25 L23 48 H17 Z" fill="#6b737c" />
            </svg>
          </button>
        )}

        {/* Thought: glossy bubbles rising from the head to a glossy cloud, all attached to the head */}
        {cloud && thought && (
          <>
            {[0, 1, 2].map((i) => {
              const s = 10 + i * 6;
              const anchorX = cloud.dx + (cloud.dx + cloudW / 2 < HALF ? cloudW - 70 : 70);
              const k = (i + 1) / 4;
              const x = HALF + (anchorX - HALF) * k;
              const y = cloud.above ? -k * 56 : SIZE + k * 56;
              return (
                <span
                  key={i}
                  className="syncro-pop absolute rounded-full"
                  style={{
                    left: x - s / 2,
                    top: y - s / 2,
                    width: s,
                    height: s,
                    animationDelay: `${i * 0.12}s`,
                    background: "radial-gradient(circle at 35% 30%, #ffffff 0%, #f1f4f7 45%, #c9d1da 100%)",
                    boxShadow: "0 4px 10px rgba(0,0,0,.12), inset 0 -2px 4px rgba(0,0,0,.06)",
                  }}
                />
              );
            })}

            <div
              role="dialog"
              aria-label={`Idea de ${name}`}
              onKeyDown={(e) => { if (e.key === "Escape") closeCloud(); }}
              className="syncro-pop pointer-events-auto absolute"
              style={{
                left: cloud.dx,
                top: cloud.above ? undefined : SIZE + 62,
                bottom: cloud.above ? SIZE + 62 : undefined,
                width: cloudW,
                animationDelay: ".38s",
                transformOrigin: cloud.above ? "50% 100%" : "50% 0%",
              }}
            >
              <div
                className="relative rounded-[30px] px-5 pb-4 pt-4 text-[13.5px] leading-relaxed text-stone-800"
                style={{
                  background: "radial-gradient(120% 140% at 25% 0%, #ffffff 0%, #f7f9fb 50%, #e6ebf0 100%)",
                  boxShadow: "0 18px 40px -12px rgba(15,23,42,.35), inset 0 2px 0 rgba(255,255,255,.9), inset 0 -6px 14px rgba(148,163,184,.25)",
                }}
              >
                <span className="pointer-events-none absolute left-6 top-2 h-3 w-24 rounded-full bg-white/90 blur-[2px]" />
                <button type="button" onClick={closeCloud} aria-label="Cerrar" className="absolute right-3 top-3 rounded-full p-1 text-stone-400 hover:bg-white hover:text-stone-700">
                  <IconX size={14} />
                </button>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-primary">{name} pensó…</p>
                <div ref={scrollRef} className="syncro-noscroll -mr-2 overflow-y-auto scroll-smooth pr-2" style={{ maxHeight: Math.max(120, cloud.maxH - (replying ? 150 : 110)) }}>
                  <p className="whitespace-pre-wrap pr-4">{typed}{typed.length < thought.text.length && <span className="ml-0.5 inline-block h-3 w-1 animate-pulse rounded bg-stone-400 align-middle" />}</p>
                  {exchange.map((m, i) => (
                    m.role === "user"
                      ? <p key={i} className="mt-3 ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-primary/10 px-3 py-1.5 text-[12.5px] text-stone-700">{m.content}</p>
                      : <p key={i} className="mt-2 whitespace-pre-wrap">{m.content}</p>
                  ))}
                  {busy && <p className="mt-2 flex items-center gap-1.5 text-xs text-stone-500"><IconLoader2 size={13} className="animate-spin" /> Pensando…</p>}
                </div>

                {replying ? (
                  <div className="mt-3 flex items-end gap-2 rounded-2xl bg-white/90 p-1.5 shadow-inner ring-1 ring-stone-200">
                    <textarea
                      ref={inputRef}
                      rows={1}
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendReply(); } }}
                      placeholder="Respóndele…"
                      className="syncro-noscroll max-h-24 min-h-8 flex-1 resize-none bg-transparent px-2 py-1.5 text-[13px] outline-none placeholder:text-stone-400"
                    />
                    <button type="button" onClick={() => void sendReply()} disabled={!draft.trim() || busy} aria-label="Enviar" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40">
                      <IconSend size={15} />
                    </button>
                  </div>
                ) : (
                  typed.length >= thought.text.length && (
                    <div className="mt-3 flex justify-end">
                      <button
                        type="button"
                        onClick={() => { setReplying(true); setTimeout(() => inputRef.current?.focus(), 60); }}
                        className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-primary shadow-sm ring-1 ring-primary/20 transition hover:shadow"
                        style={{ background: "radial-gradient(circle at 35% 25%, #fff 0%, #fff4ee 60%, #ffe2d3 100%)" }}
                      >
                        <IconArrowBackUp size={14} /> Responder
                      </button>
                    </div>
                  )
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
