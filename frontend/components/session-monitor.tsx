"use client"

import { useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { currentAccountId, signOutAndReload } from "@/lib/auth-helpers"


interface SessionMonitorProps {
  timeoutMinutes?: number
}

export function SessionMonitor({ timeoutMinutes = 30 }: SessionMonitorProps) {
  const router = useRouter()
  const timeoutId = useRef<NodeJS.Timeout | null>(null)
  
  const handleLogout = useCallback(async () => {
    toast.error("Sesión cerrada por inactividad", {
      description: "Por seguridad, tu sesión ha sido finalizada tras un periodo de inactividad.",
      duration: 10000,
    })
    try { sessionStorage.setItem("syncro_suspended_message", "Tu sesión se cerró por inactividad. Vuelve a iniciar sesión.") } catch { /* ignore */ }
    // Everything of the account goes, and the app reloads so nothing stays in memory
    await signOutAndReload("/login")
  }, [])

  // Another tab signed in as someone else (or signed out): this tab must not keep showing the
  // previous account's data while the requests now go out with the new one. Reload it.
  useEffect(() => {
    const mine = currentAccountId()
    const onStorage = (e: StorageEvent) => {
      if (e.key !== null && e.key !== "token" && e.key !== "user") return
      const now = currentAccountId()
      if (now !== mine) window.location.reload()
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [])

  const resetTimer = useCallback(() => {
    if (timeoutId.current) {
      clearTimeout(timeoutId.current)
    }
    
    // Solo si hay un token (usuario logueado)
    const token = localStorage.getItem("token")
    if (token) {
      // Si hay una grabación de lección en curso, postergamos el cierre de sesión
      const isRecording = localStorage.getItem("syncro_recording_active") === "true"
      if (isRecording) {
        timeoutId.current = setTimeout(resetTimer, 60 * 1000) // Re-evaluar en 1 minuto
        return
      }
      
      timeoutId.current = setTimeout(handleLogout, timeoutMinutes * 60 * 1000)
    }
  }, [handleLogout, timeoutMinutes])

  useEffect(() => {
    // Do NOT run session monitoring in the PWA portal context
    const isPortal = typeof window !== "undefined" && window.location.pathname.startsWith("/portal");
    if (isPortal) return;

    // Eventos que reinician el contador de inactividad, incluyendo evento custom de actividad
    const events = ["mousedown", "mousemove", "keydown", "scroll", "touchstart", "syncro_session_activity"]
    
    const token = localStorage.getItem("token")
    if (token) {
      resetTimer()
      
      events.forEach((event) => {
        window.addEventListener(event, resetTimer)
      })
    }

    return () => {
      if (timeoutId.current) {
        clearTimeout(timeoutId.current)
      }
      events.forEach((event) => {
        window.removeEventListener(event, resetTimer)
      })
    }
  }, [resetTimer])


  // No renderiza nada visual, es un controlador lógico
  return null;
}
