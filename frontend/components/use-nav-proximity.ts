"use client"

import { useCallback, useEffect, useRef } from "react"

import { useTickSound } from "@/components/use-tick-sound"

/**
 * The proximity effect from React Bits' LineSidebar, reduced to just the part
 * that matters: a per-item `--effect` value between 0 and 1 that follows how
 * close the pointer is.
 *
 * While the pointer is over the list the value is written straight from the
 * pointer position, with no easing in between — the original eased every
 * frame toward a target, which is what read as lag. Easing is kept only for
 * leaving, so the lines fade out instead of snapping off.
 *
 * It only sets that variable. What the item does with it — colour, length,
 * shift — is up to the CSS, so nothing here touches navigation, routing or
 * the accordion.
 *
 * Delete this file and the three lines that call it in nav-main.tsx to undo.
 */
export function useNavProximity({
  radius = 130,
  fadeOut = 90,
  sound = true,
}: { radius?: number; fadeOut?: number; sound?: boolean } = {}) {
  const tick = useTickSound()
  // Which item the pointer is over right now, to click once per crossing
  // instead of once per mouse event.
  const over = useRef<number | null>(null)
  const listRef = useRef<HTMLUListElement | null>(null)
  const items = useRef<(HTMLElement | null)[]>([])
  const values = useRef<number[]>([])
  const raf = useRef<number | null>(null)
  const last = useRef(0)

  const stop = useCallback(() => {
    if (raf.current != null) cancelAnimationFrame(raf.current)
    raf.current = null
  }, [])

  const write = useCallback((i: number, v: number) => {
    const el = items.current[i]
    if (!el) return
    values.current[i] = v
    el.style.setProperty("--effect", v.toFixed(4))
  }, [])

  // Straight from the pointer: whatever the mouse is doing, the lines are
  // already doing it on the same event.
  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLUListElement>) => {
      const list = listRef.current
      if (!list) return
      stop()
      const y = e.clientY - list.getBoundingClientRect().top
      let nearest: number | null = null
      let best = Infinity
      for (let i = 0; i < items.current.length; i++) {
        const el = items.current[i]
        if (!el) continue
        const center = el.offsetTop + el.offsetHeight / 2
        const distance = Math.abs(y - center)
        const p = Math.max(0, 1 - distance / radius)
        write(i, p * p * (3 - 2 * p)) // smooth falloff
        // Only count as "over" it while inside the item's own band, so the
        // click lands on the boundary between one item and the next.
        if (distance <= el.offsetHeight / 2 && distance < best) {
          best = distance
          nearest = i
        }
      }
      if (nearest !== over.current) {
        if (sound && nearest !== null) tick()
        over.current = nearest
      }
    },
    [radius, sound, stop, tick, write]
  )

  // Leaving is the only thing that gets eased, so nothing snaps off abruptly.
  const fade = useCallback(
    (now: number) => {
      const dt = Math.min((now - last.current) / 1000, 0.05)
      last.current = now
      const k = 1 - Math.exp(-dt / (Math.max(fadeOut, 1) / 1000))

      let moving = false
      for (let i = 0; i < items.current.length; i++) {
        const cur = values.current[i] || 0
        if (cur < 0.002) {
          if (cur !== 0) write(i, 0)
          continue
        }
        write(i, cur - cur * k)
        moving = true
      }
      raf.current = moving ? requestAnimationFrame(fade) : null
    },
    [fadeOut, write]
  )

  const onPointerLeave = useCallback(() => {
    over.current = null
    stop()
    last.current = performance.now()
    raf.current = requestAnimationFrame(fade)
  }, [fade, stop])

  useEffect(() => stop, [stop])

  const setItem = useCallback(
    (index: number) => (el: HTMLElement | null) => {
      items.current[index] = el
    },
    []
  )

  return { listRef, setItem, listHandlers: { onPointerMove, onPointerLeave } }
}
