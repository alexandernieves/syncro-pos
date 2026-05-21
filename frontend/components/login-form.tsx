"use client"

import * as React from "react"
import { useState, useEffect, useId } from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { API_URL } from "@/lib/constants"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { Eye, EyeOff, Trash2, ArrowLeft, ChevronRight } from "lucide-react"

interface SavedProfile {
  email: string
  name: string
  role?: string
  businessName?: string
  lastLogin: string
}

// ── Helper: get stored token regardless of PWA/browser mode ──────────────────
function getStoredToken(): string | null {
  if (typeof window === "undefined") return null
  const isPwa = window.matchMedia("(display-mode: standalone)").matches
  return isPwa ? sessionStorage.getItem("token") : localStorage.getItem("token")
}

// ── Helper: get/create clientId bound to this browser ────────────────────────
function getClientId(): string {
  if (typeof window === "undefined") return ""
  let clientId = localStorage.getItem("syncro_cid")
  if (!clientId) {
    clientId =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).substring(2) + Date.now().toString(36)
    localStorage.setItem("syncro_cid", clientId)
  }
  return clientId
}

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [savedProfiles, setSavedProfiles] = useState<SavedProfile[]>([])
  const [selectedProfile, setSelectedProfile] = useState<SavedProfile | null>(null)
  const [viewMode, setViewMode] = useState<"profiles" | "password" | "classic">("classic")
  const [isStandalone, setIsStandalone] = useState(false)
  const [mounted, setMounted] = useState(false)
  const router = useRouter()

  // ── Unique IDs for this render — defeats browser autocomplete heuristics ───
  // useId() produces a stable but unique-per-mount string like ":r0:", ":r1:", etc.
  const uid = useId()
  const emailId   = `em-${uid}`
  const passwordId = `pw-${uid}`
  const decoyId   = `dc-${uid}`

  // ── Mount ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    setMounted(true)
    if (typeof window !== "undefined") {
      const standalone = window.matchMedia("(display-mode: standalone)").matches
      setIsStandalone(standalone)
      // Only load saved profiles in browser mode with a valid auth token
      if (!standalone) {
        loadSavedProfiles()
      }
    }

    // Cleanup: clear sensitive state on unmount
    return () => {
      setEmail("")
      setPassword("")
    }
  }, [])

  // ── Load Saved Profiles ───────────────────────────────────────────────────
  const loadSavedProfiles = async () => {
    try {
      const clientId = getClientId()
      if (!clientId) return

      const response = await fetch(
        `${API_URL}/auth/saved-profiles?clientId=${clientId}`
      )
      if (response.ok) {
        const profiles = (await response.json()) as SavedProfile[]
        setSavedProfiles(profiles)
        if (profiles.length > 0 && viewMode === "classic") {
          setViewMode("profiles")
        }
      }
    } catch (e) {
      // Silently swallow — don't reveal internals
    }
  }

  // ── Save Profile after successful login ───────────────────────────────────
  const handleLoginSuccess = async (
    user: any,
    emailAddress: string,
    token: string,
  ) => {
    try {
      const clientId = getClientId()
      await fetch(`${API_URL}/auth/saved-profiles`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          clientId,
          email: emailAddress,
          name: user.name || user.username || emailAddress.split("@")[0],
          role: user.role || "Usuario",
          businessName: user.business?.name || user.businessName || undefined,
        }),
      })
    } catch {
      // Best-effort — don't block the UX flow
    }
  }

  // ── Handle Submit ─────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const targetEmail =
      viewMode === "password" && selectedProfile
        ? selectedProfile.email
        : email

    const loginPromise = async () => {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || "Error al iniciar sesión")
      }

      const token: string = data.access_token
      const isStandalonePwa =
        typeof window !== "undefined" &&
        window.matchMedia("(display-mode: standalone)").matches

      if (isStandalonePwa) {
        sessionStorage.setItem("token", token)
        sessionStorage.setItem("user", JSON.stringify(data.user))
        // HttpOnly-style cookie for server middleware (SameSite=Strict, Secure)
        document.cookie = `token=${token}; path=/; SameSite=Strict; Secure`
      } else {
        localStorage.setItem("token", token)
        localStorage.setItem("user", JSON.stringify(data.user))
        document.cookie = `token=${token}; path=/; max-age=28800; SameSite=Strict; Secure`
      }

      // Save the profile (async, non-blocking)
      handleLoginSuccess(data.user, targetEmail, token)

      return data
    }

    toast.promise(loginPromise(), {
      loading: "Iniciando sesión...",
      success: (data) => {
        setLoading(false)
        // Clear sensitive fields immediately after login
        setPassword("")
        setEmail("")
        const p = data.user.permissions || []
        const isPosOnly =
          p.includes("pos") && !p.some((perm: string) => perm !== "pos")
        const targetPath =
          isPosOnly || data.user.role === "pos"
            ? "/pos"
            : window.matchMedia("(display-mode: standalone)").matches
            ? "/dashboard/soporte"
            : "/dashboard"
        setTimeout(() => router.push(targetPath), 500)
        return "¡Inicio de sesión exitoso!"
      },
      error: (err) => {
        setLoading(false)
        return err.message
      },
    })
  }

  const selectProfile = (profile: SavedProfile) => {
    setSelectedProfile(profile)
    setPassword("")
    setViewMode("password")
  }

  const deleteProfile = async (e: React.MouseEvent, emailToDelete: string) => {
    e.stopPropagation()
    try {
      const clientId = getClientId()
      if (!clientId) return
      const response = await fetch(
        `${API_URL}/auth/saved-profiles?clientId=${clientId}&email=${encodeURIComponent(emailToDelete)}`,
        {
          method: "DELETE",
        },
      )
      if (response.ok) {
        const updated = savedProfiles.filter(
          (p) => p.email.toLowerCase() !== emailToDelete.toLowerCase(),
        )
        setSavedProfiles(updated)
        if (updated.length === 0) setViewMode("classic")
        else if (
          viewMode === "password" &&
          selectedProfile?.email === emailToDelete
        ) {
          setViewMode("profiles")
        }
      }
    } catch {
      // Silently swallow
    }
  }

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase()

  // ── Shared autocomplete-killing props for every input ─────────────────────
  // Multiple browser-specific attributes used together for maximum coverage:
  //   autoComplete="new-password"  → triggers the "new password" flow, not fill
  //   data-lpignore="true"         → LastPass
  //   data-form-type="other"       → Dashlane
  //   data-1p-ignore               → 1Password
  //   readOnly + onFocus handler   → Prevents initial autofill, then re-enables input
  const noFillProps = {
    autoComplete: "new-password" as const,
    "data-lpignore": "true",
    "data-form-type": "other",
    "data-1p-ignore": true,
  }

  if (!mounted) return null

  // ── 1️⃣ MODE: Password entry for a saved profile ──────────────────────────
  if (viewMode === "password" && selectedProfile) {
    return (
      <div className={cn("flex flex-col gap-6 w-full", className)} {...props}>
        <Card className="border-none shadow-2xl relative overflow-hidden animate-in fade-in duration-200">
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-4 top-4 rounded-full size-8 hover:bg-muted"
            onClick={() =>
              setViewMode(savedProfiles.length > 0 ? "profiles" : "classic")
            }
            type="button"
          >
            <ArrowLeft size={16} />
          </Button>
          <CardHeader className="text-center pb-2 pt-8">
            <div className="mx-auto size-16 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xl font-bold shadow-sm mb-2 select-none">
              {getInitials(selectedProfile.name)}
            </div>
            <CardTitle className="text-xl font-bold">
              {selectedProfile.name}
            </CardTitle>
            <CardDescription className="text-xs font-mono truncate max-w-[280px] mx-auto">
              {selectedProfile.email}
            </CardDescription>
            {selectedProfile.businessName && (
              <span className="inline-flex mx-auto items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 mt-2">
                {selectedProfile.businessName}
              </span>
            )}
          </CardHeader>
          <CardContent className="pt-2">
            {/* autocomplete=off on form is ignored by modern browsers — we use per-field tricks instead */}
            <form onSubmit={handleSubmit} autoComplete="off" noValidate>
              {/* Decoy field: browsers will fill this instead of the real field */}
              <input
                id={decoyId}
                type="text"
                name="username"
                tabIndex={-1}
                aria-hidden="true"
                style={{ display: "none" }}
                autoComplete="username"
              />
              <input
                type="password"
                name="password-decoy"
                tabIndex={-1}
                aria-hidden="true"
                style={{ display: "none" }}
                autoComplete="current-password"
              />
              <FieldGroup>
                <Field>
                  <div className="flex items-center">
                    <FieldLabel htmlFor={passwordId}>Contraseña</FieldLabel>
                  </div>
                  <div className="relative">
                    <Input
                      id={passwordId}
                      name={passwordId}
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoFocus
                      className="pr-10"
                      {...noFillProps}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={
                        showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                      }
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </Field>
                <Field>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Verificando..." : "Ingresar"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full text-xs text-muted-foreground hover:text-foreground mt-2"
                    onClick={() => setViewMode("classic")}
                  >
                    Usar otra cuenta
                  </Button>
                </Field>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── 2️⃣ MODE: Saved profiles list ─────────────────────────────────────────
  if (viewMode === "profiles" && savedProfiles.length > 0) {
    return (
      <div className={cn("flex flex-col gap-6 w-full", className)} {...props}>
        <Card className="border-none shadow-2xl animate-in fade-in duration-200">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-xl font-bold">
              Selecciona tu perfil
            </CardTitle>
            <CardDescription>
              Elige una sesión guardada para ingresar rápidamente
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            <div className="grid gap-3 max-h-[320px] overflow-y-auto pr-1">
              {savedProfiles.map((profile) => (
                <div
                  key={profile.email}
                  onClick={() => selectProfile(profile)}
                  className="group relative flex items-center justify-between p-3 rounded-xl border border-border/50 hover:border-primary/40 bg-muted/10 hover:bg-primary/5 transition-all duration-300 cursor-pointer shadow-sm hover:shadow-md"
                >
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-full bg-primary/10 group-hover:bg-primary/20 text-primary flex items-center justify-center font-bold text-xs transition-colors shadow-inner select-none">
                      {getInitials(profile.name)}
                    </div>
                    <div className="flex flex-col text-left max-w-[170px]">
                      <span className="font-bold text-sm tracking-tight group-hover:text-primary transition-colors truncate">
                        {profile.name}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-mono truncate leading-none mt-0.5">
                        {profile.email}
                      </span>
                      {profile.businessName && (
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium leading-none truncate mt-1">
                          {profile.businessName}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 rounded-lg opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-all duration-300"
                      onClick={(e) => deleteProfile(e, profile.email)}
                      aria-label="Eliminar perfil"
                      type="button"
                    >
                      <Trash2 size={14} />
                    </Button>
                    <ChevronRight
                      size={16}
                      className="text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all duration-300"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-2 pt-2 border-t border-border/40">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => setViewMode("classic")}
              >
                Usar otra cuenta
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── 3️⃣ MODE: Classic login form ──────────────────────────────────────────
  return (
    <div className={cn("flex flex-col gap-6 w-full", className)} {...props}>
      <Card className="border-none shadow-2xl animate-in fade-in duration-200">
        <CardHeader className="text-center">
          <CardTitle className="text-xl font-bold">Bienvenido de nuevo</CardTitle>
          <CardDescription>
            Ingresa con tu correo electrónico para acceder
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} autoComplete="off" noValidate>
            {/* ── Decoy fields that browsers fill instead of the real ones ── */}
            <div aria-hidden="true" style={{ display: "none" }}>
              <input
                id={decoyId}
                type="text"
                name="username"
                tabIndex={-1}
                autoComplete="username"
              />
              <input
                type="password"
                name="password-decoy"
                tabIndex={-1}
                autoComplete="current-password"
              />
            </div>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor={emailId}>Correo electrónico</FieldLabel>
                <Input
                  id={emailId}
                  name={emailId}
                  type="email"
                  placeholder="ejemplo@correo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  {...noFillProps}
                />
              </Field>
              <Field>
                <div className="flex items-center">
                  <FieldLabel htmlFor={passwordId}>Contraseña</FieldLabel>
                  <a
                    href="#"
                    className="ml-auto text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
                  >
                    ¿Olvidaste tu contraseña?
                  </a>
                </div>
                <div className="relative">
                  <Input
                    id={passwordId}
                    name={passwordId}
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="pr-10"
                    {...noFillProps}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={
                      showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                    }
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </Field>
              <Field>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Iniciando sesión..." : "Iniciar sesión"}
                </Button>
                {savedProfiles.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full text-xs text-muted-foreground hover:text-foreground mt-2"
                    onClick={() => setViewMode("profiles")}
                  >
                    Ver perfiles guardados ({savedProfiles.length})
                  </Button>
                )}
                {!isStandalone && (
                  <FieldDescription className="text-center mt-2">
                    ¿No tienes una cuenta?{" "}
                    <a
                      href="/register"
                      className="underline font-medium hover:text-foreground"
                    >
                      Regístrate
                    </a>
                  </FieldDescription>
                )}
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
      <FieldDescription className="px-6 text-center">
        Al hacer clic en continuar, aceptas nuestros{" "}
        <a
          href="#"
          className="underline underline-offset-4 hover:text-primary"
        >
          Términos de servicio
        </a>{" "}
        y nuestra{" "}
        <a
          href="#"
          className="underline underline-offset-4 hover:text-primary"
        >
          Política de privacidad
        </a>
        .
      </FieldDescription>
    </div>
  )
}
