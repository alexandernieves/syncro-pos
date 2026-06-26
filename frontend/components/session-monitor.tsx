"use client"

import { useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { clearAuthSession } from "@/lib/auth-helpers"


interface SessionMonitorProps {
  timeoutMinutes?: number
}

export function SessionMonitor({ timeoutMinutes = 30 }: SessionMonitorProps) {
  const router = useRouter()
  const timeoutId = useRef<NodeJS.Timeout | null>(null)
  
  const handleLogout = useCallback(async () => {
    // Limpiar almacenamiento
    await clearAuthSession()
    
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

  useEffect(() => {
    // Escuchar actualizaciones de Electron (si estamos corriendo en Electron)
    if (typeof window !== "undefined" && "electron" in window) {
      const electronObj = (window as any).electron;
      if (electronObj && typeof electronObj.onUpdateDownloaded === "function") {
        const cleanup = electronObj.onUpdateDownloaded((info: any) => {
          toast.success("Nueva actualización lista", {
            description: `Se ha descargado la versión ${info?.version || '1.0.x'}. Haz clic para reiniciar y actualizar.`,
            action: {
              label: "Actualizar",
              onClick: () => {
                if (typeof electronObj.installUpdate === "function") {
                  electronObj.installUpdate();
                }
              }
            },
            duration: Infinity, // Mantener visible hasta tomar acción
          });
        });
        return () => {
          if (typeof cleanup === "function") cleanup();
        };
      }
    }
  }, []);

  // No renderiza nada visual, es un controlador lógico
  return null;
}
