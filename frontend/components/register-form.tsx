"use client"

import * as React from "react"
import { API_URL } from "@/lib/constants"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Eye, EyeOff } from "lucide-react"

const COUNTRIES = ["Venezuela"]

const VENEZUELA_STATES = [
  "Amazonas",
  "Anzoátegui",
  "Apure",
  "Aragua",
  "Barinas",
  "Bolívar",
  "Carabobo",
  "Cojedes",
  "Delta Amacuro",
  "Distrito Capital",
  "Falcón",
  "Guárico",
  "Lara",
  "Mérida",
  "Miranda",
  "Monagas",
  "Nueva Esparta",
  "Portuguesa",
  "Sucre",
  "Táchira",
  "Trujillo",
  "Vargas (La Guaira)",
  "Yaracuy",
  "Zulia",
]

export function RegisterForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [country, setCountry] = useState("Venezuela")
  const [city, setCity] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [mounted, setMounted] = useState(false)
  const router = useRouter()

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!country) return toast.error("Seleccione su país");
    if (!city.trim()) return toast.error("Ingrese su ciudad principal");
    setLoading(true)

    const registerPromise = async () => {
      const response = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, country, city: city.trim(), role: "ownerpos" }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.message || "Error al registrarse");
      return data
    }

    toast.promise(registerPromise(), {
      loading: "Creando cuenta...",
      success: () => {
        setLoading(false)
        router.push("/")
        return "¡Registro exitoso! Por favor inicia sesión."
      },
      error: (err) => {
        setLoading(false)
        return err.message
      },
    })
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Únete a SYNCRO POS</CardTitle>
          <CardDescription>Crea tu cuenta de dueño de negocio</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre / Razón Social</Label>
              <Input id="name" placeholder="Juan Pérez" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Correo electrónico</Label>
              <Input id="email" type="email" placeholder="ejemplo@correo.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            {/* País y Ciudad en la misma fila */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="country">País</Label>
                <select
                  id="country"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-950 dark:text-zinc-50"
                  required
                >
                  {COUNTRIES.map((c) => (
                    <option key={c} value={c} className="dark:bg-zinc-900 dark:text-zinc-50">
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">Estado / Ciudad</Label>
                <select
                  id="city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-950 dark:text-zinc-50"
                  required
                >
                  <option value="" disabled>Selecciona...</option>
                  {VENEZUELA_STATES.map((s) => (
                    <option key={s} value={s} className="dark:bg-zinc-900 dark:text-zinc-50">
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <div className="relative">
                <Input id="password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>{loading ? "Creando..." : "Registrarme"}</Button>
          </form>
          <p className="text-center text-sm mt-4 text-muted-foreground">
            ¿Ya tienes cuenta? <a href="/" className="underline text-foreground">Inicia sesión</a>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
