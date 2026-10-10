"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { IconEraser } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

export type SignaturePadHandle = { toDataURL: () => string | null; clear: () => void; isEmpty: () => boolean };

/**
 * Finger, pen or mouse signature on a canvas. Strokes are smoothed with quadratic curves
 * and the export is a transparent PNG trimmed to the ink.
 */
export const SignaturePad = forwardRef<SignaturePadHandle, { className?: string; onChange?: (empty: boolean) => void; ink?: string }>(function SignaturePad({ className, onChange, ink = "#111827" }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const points = useRef<{ x: number; y: number }[]>([]);
  const [empty, setEmptyState] = useState(true);
  const emptyRef = useRef(true);
  const setEmpty = (v: boolean) => { emptyRef.current = v; setEmptyState(v); };

  // Keeps the canvas sharp on retina screens and when the dialog resizes
  useEffect(() => {
    const canvas = canvasRef.current!;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.max(1, window.devicePixelRatio || 1);
      const prev = emptyRef.current ? null : canvas.toDataURL();
      canvas.width = rect.width * ratio;
      canvas.height = rect.height * ratio;
      const ctx = canvas.getContext("2d")!;
      ctx.scale(ratio, ratio);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = ink;
      ctx.lineWidth = 2.4;
      if (prev) { const img = new Image(); img.onload = () => ctx.drawImage(img, 0, 0, rect.width, rect.height); img.src = prev; }
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ink]);

  const pos = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const start = (e: React.PointerEvent) => {
    e.preventDefault();
    canvasRef.current!.setPointerCapture(e.pointerId);
    drawing.current = true;
    points.current = [pos(e)];
    const ctx = canvasRef.current!.getContext("2d")!;
    const p = points.current[0];
    ctx.beginPath();
    ctx.arc(p.x, p.y, 1.1, 0, Math.PI * 2);
    ctx.fillStyle = ink;
    ctx.fill();
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const pts = points.current;
    pts.push(pos(e));
    if (pts.length < 3) return;
    const [a, b, c] = pts.slice(-3);
    const m1 = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const m2 = { x: (b.x + c.x) / 2, y: (b.y + c.y) / 2 };
    ctx.beginPath();
    ctx.moveTo(m1.x, m1.y);
    ctx.quadraticCurveTo(b.x, b.y, m2.x, m2.y);
    ctx.stroke();
    if (emptyRef.current) { setEmpty(false); onChange?.(false); }
  };
  const end = () => { drawing.current = false; points.current = []; };

  const clear = () => {
    const canvas = canvasRef.current!;
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
    setEmpty(true);
    onChange?.(true);
  };

  useImperativeHandle(ref, () => ({
    isEmpty: () => emptyRef.current,
    clear,
    toDataURL: () => {
      if (emptyRef.current) return null;
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext("2d")!;
      const { width, height } = canvas;
      const data = ctx.getImageData(0, 0, width, height).data;
      let top = height, left = width, right = 0, bottom = 0;
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (data[(y * width + x) * 4 + 3] > 0) { if (x < left) left = x; if (x > right) right = x; if (y < top) top = y; if (y > bottom) bottom = y; }
      const pad = 12;
      const w = Math.min(width, right - left + pad * 2), h = Math.min(height, bottom - top + pad * 2);
      const out = document.createElement("canvas");
      out.width = w;
      out.height = h;
      out.getContext("2d")!.drawImage(canvas, Math.max(0, left - pad), Math.max(0, top - pad), w, h, 0, 0, w, h);
      return out.toDataURL("image/png");
    },
  }));

  return (
    <div className={cn("relative overflow-hidden rounded-xl bg-white ring-1 ring-border", className)}>
      <canvas
        ref={canvasRef}
        className="block h-full w-full touch-none cursor-crosshair"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        onPointerCancel={end}
      />
      <span className="pointer-events-none absolute inset-x-6 bottom-8 border-b border-dashed border-zinc-300" />
      {empty && <span className="pointer-events-none absolute inset-x-0 bottom-2 text-center text-xs text-zinc-400">Firma aquí con el dedo o el mouse</span>}
      {!empty && (
        <button type="button" onClick={clear} className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 text-xs text-zinc-600 hover:bg-zinc-200">
          <IconEraser size={14} /> Borrar
        </button>
      )}
    </div>
  );
});
