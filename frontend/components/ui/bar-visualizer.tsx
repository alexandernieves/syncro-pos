"use client"

import React, { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

export type AgentState =
  | "connecting"
  | "initializing"
  | "listening"
  | "speaking"
  | "thinking"

export interface AudioAnalyserOptions {
  fftSize?: number
  smoothingTimeConstant?: number
  minDecibels?: number
  maxDecibels?: number
}

export interface MultiBandVolumeOptions {
  bands?: number
  loPass?: number
  hiPass?: number
  updateInterval?: number
}

export interface BarVisualizerProps extends React.HTMLAttributes<HTMLDivElement> {
  state?: AgentState
  barCount?: number
  mediaStream?: MediaStream | null
  minHeight?: number
  maxHeight?: number
  demo?: boolean
  centerAlign?: boolean
}

// 1. useAudioVolume hook
export function useAudioVolume(
  mediaStream: MediaStream | null | undefined,
  options: AudioAnalyserOptions = {}
): number {
  const [volume, setVolume] = useState(0)

  useEffect(() => {
    if (!mediaStream) {
      setVolume(0)
      return
    }

    const {
      fftSize = 32,
      smoothingTimeConstant = 0.8,
      minDecibels = -90,
      maxDecibels = -10,
    } = options

    let audioContext: AudioContext | null = null
    let source: MediaStreamAudioSourceNode | null = null
    let analyser: AnalyserNode | null = null
    let animationFrameId = 0

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      audioContext = new AudioCtx()
      analyser = audioContext.createAnalyser()
      analyser.fftSize = fftSize
      analyser.smoothingTimeConstant = smoothingTimeConstant
      analyser.minDecibels = minDecibels
      analyser.maxDecibels = maxDecibels

      source = audioContext.createMediaStreamSource(mediaStream)
      source.connect(analyser)

      const bufferLength = analyser.frequencyBinCount
      const dataArray = new Uint8Array(bufferLength)

      const update = () => {
        if (!analyser) return
        analyser.getByteFrequencyData(dataArray)
        let sum = 0
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i]
        }
        const average = sum / bufferLength
        // Normalize average (0-255) to 0-1
        setVolume(average / 255)
        animationFrameId = requestAnimationFrame(update)
      }

      update()
    } catch (e) {
      console.warn("Audio volume analysis failed:", e)
    }

    return () => {
      cancelAnimationFrame(animationFrameId)
      if (source) source.disconnect()
      if (audioContext && audioContext.state !== "closed") {
        audioContext.close()
      }
    }
  }, [mediaStream, options.fftSize, options.smoothingTimeConstant])

  return volume
}

// 2. useMultibandVolume hook
export function useMultibandVolume(
  mediaStream: MediaStream | null | undefined,
  options: MultiBandVolumeOptions = {}
): number[] {
  const {
    bands = 15,
    loPass = 100,
    hiPass = 8000,
  } = options

  const [frequencyBands, setFrequencyBands] = useState<number[]>(
    () => Array(bands).fill(0)
  )

  useEffect(() => {
    if (!mediaStream) {
      setFrequencyBands(Array(bands).fill(0))
      return
    }

    let audioContext: AudioContext | null = null
    let source: MediaStreamAudioSourceNode | null = null
    let analyser: AnalyserNode | null = null
    let animationFrameId = 0

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      audioContext = new AudioCtx()
      analyser = audioContext.createAnalyser()
      analyser.fftSize = 512
      analyser.smoothingTimeConstant = 0.65

      source = audioContext.createMediaStreamSource(mediaStream)
      source.connect(analyser)

      const bufferLength = analyser.frequencyBinCount
      const dataArray = new Uint8Array(bufferLength)
      const sampleRate = audioContext.sampleRate

      const update = () => {
        if (!analyser) return
        analyser.getByteFrequencyData(dataArray)

        const newBands = Array(bands).fill(0)
        const nyquist = sampleRate / 2
        
        // Map frequency bands
        for (let i = 0; i < bufferLength; i++) {
          const freq = (i * nyquist) / bufferLength
          if (freq >= loPass && freq <= hiPass) {
            // Find which band this frequency falls into on a logarithmic scale
            const logMin = Math.log10(loPass)
            const logMax = Math.log10(hiPass)
            const logVal = Math.log10(freq)
            const fraction = (logVal - logMin) / (logMax - logMin)
            const bandIndex = Math.min(bands - 1, Math.max(0, Math.floor(fraction * bands)))
            newBands[bandIndex] = Math.max(newBands[bandIndex], dataArray[i] / 255)
          }
        }
        
        setFrequencyBands(newBands)
        animationFrameId = requestAnimationFrame(update)
      }

      update()
    } catch (e) {
      console.warn("Multiband volume analysis failed:", e)
    }

    return () => {
      cancelAnimationFrame(animationFrameId)
      if (source) source.disconnect()
      if (audioContext && audioContext.state !== "closed") {
        audioContext.close()
      }
    }
  }, [mediaStream, bands, loPass, hiPass])

  return frequencyBands
}

// 3. useBarAnimator hook (for connecting, thinking, initializing states)
export function useBarAnimator(
  state: AgentState,
  columns: number = 15,
  intervalMs: number = 80
): number[] {
  const [highlightedIndices, setHighlightedIndices] = useState<number[]>([])

  useEffect(() => {
    if (state !== "connecting" && state !== "thinking" && state !== "initializing") {
      setHighlightedIndices([])
      return
    }

    let timer: NodeJS.Timeout
    let step = 0

    const tick = () => {
      step = (step + 1) % columns
      const indices: number[] = []

      if (state === "connecting" || state === "initializing") {
        // Wave movement (e.g., 3 highlighted adjacent bars)
        indices.push(step)
        indices.push((step + 1) % columns)
        indices.push((step + 2) % columns)
      } else if (state === "thinking") {
        // Pulse outer/inner or ping-pong
        const mid = Math.floor(columns / 2)
        const offset = Math.abs(mid - (step % (mid * 2)))
        indices.push(mid - offset)
        indices.push(mid + offset)
      }

      setHighlightedIndices(indices)
      timer = setTimeout(tick, intervalMs)
    }

    tick()
    return () => clearTimeout(timer)
  }, [state, columns, intervalMs])

  return highlightedIndices
}

// Main BarVisualizer Component
export const BarVisualizer = React.forwardRef<HTMLDivElement, BarVisualizerProps>(
  (
    {
      state = "listening",
      barCount = 15,
      mediaStream = null,
      minHeight = 20,
      maxHeight = 100,
      demo = false,
      centerAlign = false,
      className,
      ...props
    },
    ref
  ) => {
    // 1. Get real frequency data if stream exists
    const realBands = useMultibandVolume(mediaStream, { bands: barCount })

    // 2. Get passive animations
    const activePassiveIndices = useBarAnimator(state, barCount, 80)

    // 3. Demo/Dummy dynamic frequencies
    const [demoBands, setDemoBands] = useState<number[]>(() => Array(barCount).fill(0.2))

    useEffect(() => {
      if (!demo && state !== "speaking" && state !== "listening") return

      let animationFrameId = 0
      let t = 0

      const updateDemo = () => {
        t += 0.05
        const newBands = Array(barCount)
          .fill(0)
          .map((_, i) => {
            if (state === "speaking") {
              // Sine wave simulation for speaking
              const base = 0.4 + 0.3 * Math.sin(t * 3 + i * 0.5)
              const noise = 0.2 * Math.sin(t * 8 - i * 0.9)
              return Math.max(0.1, Math.min(1.0, base + noise))
            } else if (state === "listening") {
              // Gentle rumble simulation for listening
              const base = 0.15 + 0.1 * Math.sin(t * 1.5 + i * 0.8)
              return Math.max(0.1, base)
            }
            return 0.1
          })

        setDemoBands(newBands)
        animationFrameId = requestAnimationFrame(updateDemo)
      }

      updateDemo()
      return () => cancelAnimationFrame(animationFrameId)
    }, [state, demo, barCount])

    // Decide which heights to render
    const heights = React.useMemo(() => {
      if (mediaStream && !demo) {
        // Use real values
        return realBands
      }

      if (state === "connecting" || state === "thinking" || state === "initializing") {
        // Return passive heights with highlight pulses
        return Array(barCount)
          .fill(0)
          .map((_, i) => {
            const isHighlighted = activePassiveIndices.includes(i)
            if (state === "thinking") {
              return isHighlighted ? 0.85 : 0.3
            }
            // connecting/initializing
            return isHighlighted ? 0.75 : 0.25
          })
      }

      // Demo or speaking/listening fallback
      return demoBands
    }, [mediaStream, demo, state, barCount, realBands, activePassiveIndices, demoBands])

    return (
      <div
        ref={ref}
        className={cn(
          "flex items-center gap-1.5 h-16 w-full justify-center px-4",
          centerAlign ? "items-center" : "items-end",
          className
        )}
        {...props}
      >
        {heights.map((heightFraction, index) => {
          const clampedFraction = Math.max(0, Math.min(1, heightFraction))
          const heightPercent = minHeight + clampedFraction * (maxHeight - minHeight)

          // Color and style matching custom themes
          const isHighlighted =
            state === "connecting" || state === "thinking" || state === "initializing"
              ? activePassiveIndices.includes(index)
              : heightFraction > 0.35

          return (
            <div
              key={index}
              style={{
                height: `${heightPercent}%`,
              }}
              className={cn(
                "w-2 rounded-full transition-all duration-150 ease-out",
                // Active/Inactive color styles
                isHighlighted
                  ? "bg-primary shadow-[0_0_8px_rgba(var(--color-primary),0.3)] opacity-95"
                  : "bg-primary/20 dark:bg-primary/30 opacity-70",
                // Special styles based on agent states
                state === "thinking" && "duration-300",
                state === "connecting" && "duration-200"
              )}
            />
          )
        })}
      </div>
    )
  }
)

BarVisualizer.displayName = "BarVisualizer"
