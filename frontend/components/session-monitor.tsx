"use client"

import { useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

interface SessionMonitorProps {
  timeoutMinutes?: number
}

export function SessionMonitor({ timeoutMinutes = 30 }: SessionMonitorProps) {
  const router = useRouter()
  const timeoutId = useRef<NodeJS.Timeout | null>(null)
  
  const handleLogout = useCallback(() => {
    // Limpiar almacenamiento
    localStorage.removeItem("token")
    localStorage.removeItem("user")
    document.cookie = "token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;"
    
    toast.error("Sesión cerrada por inactividad", {
      description: "Por seguridad, tu sesión ha sido finalizada tras un periodo de inactividad.",
      duration: 10000,
    })
    
    router.replace("/")
  }, [router])

  const resetTimer = useCallback(() => {
    if (timeoutId.current) {
      clearTimeout(timeoutId.current)
    }
    
    // Solo si hay un token (usuario logueado)
    const token = localStorage.getItem("token")
    if (token) {
      timeoutId.current = setTimeout(handleLogout, timeoutMinutes * 60 * 1000)
    }
  }, [handleLogout, timeoutMinutes])

  useEffect(() => {
    // Eventos que reinician el contador de inactividad
    const events = ["mousedown", "mousemove", "keydown", "scroll", "touchstart"]
    
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
  return null
}
