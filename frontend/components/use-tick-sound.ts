"use client"

import { useCallback, useEffect, useRef } from "react"

/**
 * The detent click of an iOS picker, synthesised on the fly — a very short
 * burst of filtered noise for the mechanical edge plus a low thump for body.
 * No audio files, so nothing to load before the first tick.
 *
 * Browsers refuse to start audio until the visitor has interacted with the
 * page, and moving the mouse does not count. The context is therefore created
 * lazily and resumed on the first real gesture; until then, ticks are simply
 * skipped rather than queued up to fire in a burst later.
 */
export function useTickSound({ volume = 0.05 } = {}) {
  const ctxRef = useRef<AudioContext | null>(null)
  const ready = useRef(false)
  const lastAt = useRef(0)

  useEffect(() => {
    const unlock = () => {
      if (!ctxRef.current) {
        const Ctor = window.AudioContext || (window as any).webkitAudioContext
        if (Ctor) ctxRef.current = new Ctor()
      }
      ctxRef.current?.resume()
      ready.current = true
    }
    // Any of these counts as user activation for the audio policy.
    const opts = { once: true, passive: true } as const
    window.addEventListener("pointerdown", unlock, opts)
    window.addEventListener("keydown", unlock, opts)
    return () => {
      window.removeEventListener("pointerdown", unlock)
      window.removeEventListener("keydown", unlock)
    }
  }, [])

  const tick = useCallback(() => {
    const ctx = ctxRef.current
    if (!ready.current || !ctx || ctx.state !== "running") return

    const now = ctx.currentTime
    // Never stack ticks on top of each other on a fast sweep.
    if (now - lastAt.current < 0.022) return
    lastAt.current = now

    const out = ctx.createGain()
    out.gain.value = volume
    out.connect(ctx.destination)

    // The click itself: a few milliseconds of noise, band-passed so it reads
    // as a detent rather than a hiss.
    const frames = Math.floor(ctx.sampleRate * 0.03)
    const buf = ctx.createBuffer(1, frames, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < frames; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / frames, 14)
    }
    const noise = ctx.createBufferSource()
    noise.buffer = buf

    const band = ctx.createBiquadFilter()
    band.type = "bandpass"
    band.frequency.value = 2400
    band.Q.value = 1.4

    const noiseGain = ctx.createGain()
    noiseGain.gain.setValueAtTime(1, now)
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.028)

    noise.connect(band).connect(noiseGain).connect(out)

    // A short low thump underneath, so it feels like something engaged.
    const osc = ctx.createOscillator()
    osc.type = "triangle"
    osc.frequency.setValueAtTime(520, now)
    osc.frequency.exponentialRampToValueAtTime(190, now + 0.02)
    const oscGain = ctx.createGain()
    oscGain.gain.setValueAtTime(0.5, now)
    oscGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.022)
    osc.connect(oscGain).connect(out)

    noise.start(now)
    osc.start(now)
    osc.stop(now + 0.03)
    noise.stop(now + 0.03)
    noise.onended = () => out.disconnect()

    // Where the device has a motor, the same detent as a nudge.
    navigator.vibrate?.(6)
  }, [volume])

  return tick
}
