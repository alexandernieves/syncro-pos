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
const R = SIZE * 0.42;
/** What the mascot can't walk through: cards, the sidebar, the header, open dialogs. */
const WALLS = '[data-slot="card"], [data-slot="sidebar-container"], header, [role="dialog"], [data-mascot-wall]';
const SPEED = 70; // px per second
const BULB_WAIT_MS = 30_000;
const THINK_EVERY_MS = 4 * 60_000;

type Rect = { l: number; t: number; r: number; b: number };
type Exchange = { role: "user" | "assistant"; content: string };

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

const inside = (x: number, y: number, w: Rect, pad: number) => x > w.l - pad && x < w.r + pad && y > w.t - pad && y < w.b + pad;

/**
 * Syncro living on the screen: it wanders around (cards and panels are walls), has ideas about the
 * business (a glowing bulb), thinks them out loud in a glossy cloud and talks back. Clicking the head
 * opens the support chat. With "roam" off (or in the POS) it stays docked on the edge.
 */
export function MascotPet({ docked: forceDocked = false, side = "right", top = 38 }: { docked?: boolean; side?: "left" | "right"; top?: number }) {
  const settings = useMascotSettings();
  const unread = useSupportUnread();
  const [merchant, setMerchant] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const pos = useRef({ x: -1, y: -1 });
  const target = useRef<{ x: number; y: number } | null>(null);
  const restUntil = useRef(0);
  const walls = useRef<Rect[]>([]);
  const hovering = useRef(false);
  const [moving, setMoving] = useState(false);

  // Ideas
  const [thought, setThought] = useState<MascotThought | null>(null);
  const [cloud, setCloud] = useState<{ x: number; y: number; w: number; below: boolean; fromLeft: boolean } | null>(null);
  const [typed, setTyped] = useState("");
  const [exchange, setExchange] = useState<Exchange[]>([]);
  const [replying, setReplying] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [mood, setMood] = useState<AvatarEmotion | undefined>(undefined);
  const [bulbOut, setBulbOut] = useState(false);
  const [festive, setFestive] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const thoughtRef = useRef<MascotThought | null>(null);
  useEffect(() => { thoughtRef.current = thought; }, [thought]);

  useEffect(() => {
    const s = session();
    setMerchant(!!s.token && !!s.businessId && s.role !== "syncropos" && s.role !== "client");
  }, []);

  const visible = merchant && !!settings?.visible;
  const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const docked = forceDocked || !settings?.roam || reduced;
  const cloudOpen = !!cloud;

  // ── Where it stands ───────────────────────────────────────────────────────────────────────
  const dockSpot = useCallback(() => ({ x: side === "right" ? window.innerWidth - SIZE - 14 : 14, y: (window.innerHeight * top) / 100 - SIZE / 2 }), [side, top]);

  const place = () => {
    const el = rootRef.current;
    if (el) el.style.transform = `translate3d(${pos.current.x}px, ${pos.current.y}px, 0)`;
  };

  useEffect(() => {
    if (!visible) return;
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
  }, [visible]);

  /** A free spot on screen: not inside any wall, with room for the head. */
  const freeSpot = useCallback(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    for (let i = 0; i < 60; i++) {
      const x = 16 + Math.random() * (vw - SIZE - 32);
      const y = 70 + Math.random() * (vh - SIZE - 90);
      const cx = x + SIZE / 2;
      const cy = y + SIZE / 2;
      if (!walls.current.some((w) => inside(cx, cy, w, R + 6))) return { x, y };
    }
    return null;
  }, []);

  useEffect(() => {
    if (!visible) return;
    if (pos.current.x < 0) {
      const start = dockSpot();
      pos.current = start;
    }
    place();
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const p = pos.current;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const chatOpen = !!(window as unknown as Record<string, boolean>).__syncroChatWidgetOpen;

      if (docked) {
        const d = dockSpot();
        p.x += (d.x - p.x) * Math.min(1, dt * 6);
        p.y += (d.y - p.y) * Math.min(1, dt * 6);
      } else if (!cloudOpen && !hovering.current && !chatOpen && now > restUntil.current) {
        if (!target.current) target.current = freeSpot();
        const t = target.current;
        if (t) {
          const dx = t.x - p.x;
          const dy = t.y - p.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 4) {
            target.current = null;
            restUntil.current = now + 2500 + Math.random() * (Math.random() < 0.3 ? 12000 : 5000);
            setMoving(false);
          } else {
            const step = Math.min(dist, SPEED * dt);
            p.x += (dx / dist) * step;
            p.y += (dy / dist) * step;
            setMoving(true);
          }
        }
      }

      // Walls push the head out; bumping into one changes direction
      if (!docked) {
        let bumped = false;
        for (const w of walls.current) {
          const cx = p.x + SIZE / 2;
          const cy = p.y + SIZE / 2;
          const nx = Math.max(w.l, Math.min(cx, w.r));
          const ny = Math.max(w.t, Math.min(cy, w.b));
          let ddx = cx - nx;
          let ddy = cy - ny;
          let d = Math.hypot(ddx, ddy);
          if (d >= R) continue;
          if (d === 0) {
            // Center inside the wall: leave through the nearest side
            const exits = [cx - w.l, w.r - cx, cy - w.t, w.b - cy];
            const k = exits.indexOf(Math.min(...exits));
            ddx = k === 0 ? -1 : k === 1 ? 1 : 0;
            ddy = k === 2 ? -1 : k === 3 ? 1 : 0;
            d = 0.0001;
            p.x += ddx * (exits[k] + R) * Math.min(1, dt * 8);
            p.y += ddy * (exits[k] + R) * Math.min(1, dt * 8);
          } else {
            p.x += (ddx / d) * (R - d);
            p.y += (ddy / d) * (R - d);
          }
          bumped = true;
        }
        if (bumped && target.current) target.current = freeSpot();
      }
      p.x = Math.max(6, Math.min(vw - SIZE - 6, p.x));
      p.y = Math.max(6, Math.min(vh - SIZE - 6, p.y));
      place();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [visible, docked, cloudOpen, dockSpot, freeSpot]);

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

  /** Opens the cloud next to the head, on the side with room. */
  const openThought = useCallback((t: MascotThought) => {
    const p = pos.current;
    const vw = window.innerWidth;
    const w = Math.min(340, vw - 32);
    const fromLeft = p.x + SIZE / 2 > vw / 2; // head on the right: cloud to its left
    const below = p.y < 260;
    const x = Math.max(16, Math.min(vw - w - 16, fromLeft ? p.x - w + 30 : p.x + SIZE - 30));
    const y = below ? p.y + SIZE + 70 : p.y - 70;
    setCloud({ x, y, w, below, fromLeft });
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
  useEffect(() => {
    if (!cloud || !thought) return;
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
  }, [cloud, thought]);

  const closeCloud = () => {
    setCloud(null);
    setThought(null);
    setMood(undefined);
    setReplying(false);
    restUntil.current = performance.now() + 1500;
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
      setReplying(!!body.needsReply);
      if (body.needsReply) setTimeout(() => inputRef.current?.focus(), 60);
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
  const lastAnswer = [...exchange].reverse().find((m) => m.role === "assistant");
  const lastQuestion = [...exchange].reverse().find((m) => m.role === "user");

  return (
    <>
      <style>{`
        @keyframes syncro-bulb { 0%,100% { transform: rotate(-8deg); } 50% { transform: rotate(8deg); } }
        @keyframes syncro-glow { 0%,100% { opacity: .55; transform: scale(1); } 50% { opacity: .9; transform: scale(1.15); } }
        @keyframes syncro-pop { 0% { transform: scale(0); opacity: 0; } 70% { transform: scale(1.12); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
        @keyframes syncro-hop { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
        .syncro-bubble { animation: syncro-pop .35s cubic-bezier(.2,.9,.3,1.3) both; }
      `}</style>

      {/* The head, moved every frame without re-rendering */}
      <div ref={rootRef} data-mascot-ignore className="pointer-events-none fixed left-0 top-0 z-[45] will-change-transform" style={{ width: SIZE, height: SIZE }}>
        <button
          type="button"
          aria-label={unread ? `Hablar con el Equipo Syncro, ${unread} sin leer` : "Hablar con el Equipo Syncro"}
          title={`${settings?.name || "Syncro"} · clic para hablar con el Equipo Syncro`}
          onClick={() => window.dispatchEvent(new Event("support-chat:open"))}
          onPointerEnter={() => { hovering.current = true; }}
          onPointerLeave={() => { hovering.current = false; }}
          className="pointer-events-auto relative block rounded-full outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          style={{ width: SIZE, height: SIZE }}
        >
          <span
            className="block drop-shadow-[0_10px_16px_rgba(0,0,0,0.2)] transition-transform duration-300"
            style={{ animation: moving ? "syncro-hop .55s ease-in-out infinite" : undefined }}
          >
            <SyncroAvatar size={SIZE} title="" emotion={mood ?? (unread ? "surprised" : undefined)} festive={festive} />
          </span>
          {unread > 0 && (
            <span className="absolute bottom-1 right-0 flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold tabular-nums text-primary-foreground ring-2 ring-background">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>

        {/* The idea: a glowing, glossy light bulb on the edge of the head */}
        {showBulb && (
          <button
            type="button"
            aria-label="Syncro tiene una idea"
            title="Tengo una idea"
            onClick={() => thought && openThought(thought)}
            onPointerEnter={() => { hovering.current = true; }}
            onPointerLeave={() => { hovering.current = false; }}
            className={cn("pointer-events-auto absolute -right-3 -top-5 origin-bottom outline-none transition-[opacity,transform] duration-500 focus-visible:ring-2 focus-visible:ring-amber-400", bulbOut ? "scale-50 opacity-0" : "syncro-bubble")}
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
      </div>

      {/* Thought: glossy bubbles rising from the head to a glossy cloud */}
      {cloud && thought && (
        <div data-mascot-ignore className="fixed inset-0 z-[46] pointer-events-none" onKeyDown={(e) => { if (e.key === "Escape") closeCloud(); }}>
          {[0, 1, 2].map((i) => {
            const hx = pos.current.x + SIZE / 2;
            const hy = cloud.below ? pos.current.y + SIZE : pos.current.y;
            const cx = cloud.fromLeft ? cloud.x + cloud.w - 60 : cloud.x + 60;
            const cy = cloud.below ? cloud.y : cloud.y;
            const k = (i + 1) / 4;
            const size = 10 + i * 6;
            return (
              <span
                key={i}
                className="syncro-bubble absolute rounded-full"
                style={{
                  left: hx + (cx - hx) * k - size / 2,
                  top: hy + (cy - hy) * k - size / 2,
                  width: size,
                  height: size,
                  animationDelay: `${i * 0.12}s`,
                  background: "radial-gradient(circle at 35% 30%, #ffffff 0%, #f1f4f7 45%, #c9d1da 100%)",
                  boxShadow: "0 4px 10px rgba(0,0,0,.12), inset 0 -2px 4px rgba(0,0,0,.06)",
                }}
              />
            );
          })}

          <div
            role="dialog"
            aria-label={`Idea de ${settings?.name || "Syncro"}`}
            className="syncro-bubble pointer-events-auto absolute"
            style={{ left: cloud.x, top: cloud.below ? cloud.y : undefined, bottom: cloud.below ? undefined : window.innerHeight - cloud.y, width: cloud.w, animationDelay: ".38s", transformOrigin: cloud.below ? "50% 0%" : "50% 100%" }}
          >
            {/* Cloud puffs on top */}
            {[{ l: "12%", s: 58, t: -22 }, { l: "38%", s: 76, t: -34 }, { l: "66%", s: 54, t: -20 }].map((pf, i) => (
              <span key={i} className="absolute rounded-full" style={{ left: pf.l, top: pf.t, width: pf.s, height: pf.s, background: "radial-gradient(circle at 38% 30%, #ffffff 0%, #f6f8fa 55%, #e3e8ee 100%)" }} />
            ))}
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
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-primary">{settings?.name || "Syncro"} pensó…</p>
              <div className="-mr-2 overflow-y-auto pr-2" style={{ maxHeight: Math.max(140, (cloud.below ? window.innerHeight - cloud.y : cloud.y) - 150) }}>
              <p className="whitespace-pre-wrap pr-4">{typed}{typed.length < thought.text.length && <span className="ml-0.5 inline-block h-3 w-1 animate-pulse rounded bg-stone-400 align-middle" />}</p>

              {lastQuestion && <p className="mt-3 ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-primary/10 px-3 py-1.5 text-[12.5px] text-stone-700">{lastQuestion.content}</p>}
              {busy && <p className="mt-2 flex items-center gap-1.5 text-xs text-stone-500"><IconLoader2 size={13} className="animate-spin" /> Pensando…</p>}
              {lastAnswer && !busy && <p className="mt-2 whitespace-pre-wrap">{lastAnswer.content}</p>}
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
                    className="max-h-24 min-h-8 flex-1 resize-none bg-transparent px-2 py-1.5 text-[13px] outline-none placeholder:text-stone-400"
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
        </div>
      )}
    </>
  );
}
