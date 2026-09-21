"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { motion } from "framer-motion";
import { API_URL } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DotField } from "@/components/reactbits/dot-field";
import { toast } from "sonner";
import {
  IconBuildingStore,
  IconLock,
  IconShieldCheck,
  IconMail,
} from "@tabler/icons-react";
import { Eye, EyeOff } from "lucide-react";

const COUNTRIES = ["Venezuela"];

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
];


export function RegisterForm() {
  /*
   * Registration is a single step now.
   *
   * It used to open by asking which trade the shop was in, and that answer
   * decided which modules got switched on. The same base serves a bodega, a
   * minimarket, a hardware store and a boutique, so the question bought
   * nothing and cost a screen. Every account starts with everything enabled
   * and trims it from Configuración.
   */
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [country, setCountry] = useState("Venezuela");
  const [city, setCity] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = mounted && resolvedTheme === "dark";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error("Ingresa el nombre o razón social de tu negocio");
    if (!email.trim()) return toast.error("Ingresa tu correo electrónico");
    if (!country) return toast.error("Seleccione su país");
    if (!city.trim()) return toast.error("Seleccione su estado o ciudad");
    if (password.length < 6) return toast.error("La contraseña debe tener al menos 6 caracteres");

    setLoading(true);

    const registerPromise = async () => {
      // 1. Register. No trade is sent: the backend gives every new business
      // the same full set of modules.
      const registerRes = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          businessName: name.trim(),
          email: email.trim().toLowerCase(),
          password,
          country,
          city: city.trim(),
          role: "ownerpos",
        }),
      });

      const regData = await registerRes.json();
      if (!registerRes.ok) {
        throw new Error(regData.message || "Error al crear la cuenta");
      }

      // 2. Auto-login to provide instant onboarding
      try {
        const loginRes = await fetch(`${API_URL}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email.trim().toLowerCase(),
            password,
          }),
        });

        if (loginRes.ok) {
          const loginData = await loginRes.json();
          const token: string = loginData.access_token;
          const isStandalonePwa =
            typeof window !== "undefined" &&
            window.matchMedia("(display-mode: standalone)").matches;

          if (isStandalonePwa) {
            sessionStorage.setItem("token", token);
            sessionStorage.setItem("user", JSON.stringify(loginData.user));
            document.cookie = `token=${token}; path=/; SameSite=Strict; Secure`;
          } else {
            localStorage.setItem("token", token);
            localStorage.setItem("user", JSON.stringify(loginData.user));
            document.cookie = `token=${token}; path=/; max-age=28800; SameSite=Strict; Secure`;
          }

          return { autoLogin: true, user: loginData.user };
        }
      } catch {
        // Fallback if auto-login network fails
      }

      return { autoLogin: false };
    };

    toast.promise(registerPromise(), {
      loading: "Configurando tu terminal y espacio de trabajo...",
      success: (data) => {
        setLoading(false);
        if (data?.autoLogin) {
          router.push("/dashboard");
          return "Espacio configurado. Ya puedes empezar a vender.";
        } else {
          router.push("/login");
          return "Cuenta registrada. Inicia sesión para acceder a tu terminal.";
        }
      },
      error: (err) => {
        setLoading(false);
        return err.message || "Error al registrarse";
      },
    });
  };

  return (
    <div
      className="h-dvh w-full text-foreground flex flex-col overflow-hidden selection:bg-primary/20"
      style={{
        background: isDark
          ? "radial-gradient(ellipse 90% 70% at 15% 0%, #24304e 0%, #171f34 38%, #0b0e17 100%)"
          : "radial-gradient(ellipse 90% 70% at 15% 0%, #dde5f7 0%, #eaeef6 42%, #f8f9fb 100%)",
      }}
    >
      {/* Ambient background — the CSS gradient above is the visual source
          of truth (always visible, zero dependency). The dot field is a
          pure Canvas2D + SVG layer on top for interactive depth: no WebGL,
          so it renders identically on every device and can never wash the
          gradient out the way a shader can. */}
      <div className="fixed inset-0 pointer-events-none">
        <DotField
          dotRadius={1.4}
          dotSpacing={15}
          cursorRadius={420}
          bulgeOnly
          bulgeStrength={60}
          glowRadius={220}
          gradientFrom={isDark ? "rgba(148, 168, 214, 0.28)" : "rgba(51, 69, 107, 0.4)"}
          gradientTo={isDark ? "rgba(180, 195, 224, 0.16)" : "rgba(140, 155, 185, 0.35)"}
          glowColor={isDark ? "#24304e" : "#dde5f7"}
        />
      </div>

      {/* Slim corporate header */}
      <header className="relative z-10 shrink-0 w-full px-6 py-3.5">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <a href="/" className="flex items-center gap-2.5">
            <div className="size-8 rounded-lg overflow-hidden border border-border flex items-center justify-center bg-card">
              <img src="/syncro.png" alt="SYNCRO POS" className="size-full object-cover" />
            </div>
            <span className="font-bold text-sm tracking-tight text-foreground">SYNCRO POS</span>
          </a>


          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground hidden sm:inline">¿Ya tienes cuenta?</span>
            <a
              href="/login"
              className="font-semibold text-foreground hover:underline underline-offset-4"
            >
              Iniciar sesión
            </a>
          </div>
        </div>
      </header>

      {/* Main content — fixed viewport, no scroll */}
      <main className="relative z-10 flex-1 min-h-0 overflow-y-auto flex items-center justify-center px-6 py-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-sm"
        >
              <div className="rounded-xl border border-border bg-card p-6 shadow-md">
                <h2 className="text-lg font-bold tracking-tight text-foreground mb-4">
                  Crea tu cuenta
                </h2>

                <form onSubmit={handleSubmit} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="name" className="text-xs font-medium text-foreground">
                      Nombre del negocio
                    </Label>
                    <div className="relative">
                      <IconBuildingStore className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                      <Input
                        id="name"
                        placeholder="Ej. Bodega La Esquina"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="pl-9 h-9 text-sm"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-xs font-medium text-foreground">
                      Correo electrónico
                    </Label>
                    <div className="relative">
                      <IconMail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="admin@tunegocio.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-9 h-9 text-sm"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-1.5">
                      <Label htmlFor="country" className="text-xs font-medium text-foreground">
                        País
                      </Label>
                      <select
                        id="country"
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                        className="flex h-9 w-full rounded-md border border-input bg-background text-foreground px-3 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                        required
                      >
                        {COUNTRIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="city" className="text-xs font-medium text-foreground">
                        Estado
                      </Label>
                      <select
                        id="city"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        className="flex h-9 w-full rounded-md border border-input bg-background text-foreground px-3 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                        required
                      >
                        <option value="" disabled>
                          Selecciona...
                        </option>
                        {VENEZUELA_STATES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="password" className="text-xs font-medium text-foreground">
                      Contraseña
                    </Label>
                    <div className="relative">
                      <IconLock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Mínimo 6 caracteres"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-9 pr-9 h-9 text-sm"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-9.5 text-sm font-semibold mt-2"
                    disabled={loading}
                  >
                    {loading ? "Configurando..." : "Crear cuenta"}
                  </Button>

                  <div className="pt-1 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
                    <IconShieldCheck className="size-3.5 shrink-0" />
                    <span>Datos cifrados y aislados por comercio</span>
                  </div>
                </form>
              </div>
        </motion.div>
      </main>

      <footer className="relative z-10 shrink-0 w-full px-6 py-2.5 text-center text-[11px] text-muted-foreground">
        SYNCRO POS © {new Date().getFullYear()}
      </footer>
    </div>
  );
}
