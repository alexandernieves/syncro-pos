"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { LoginForm } from "@/components/login-form"
import { DotField } from "@/components/reactbits/dot-field"

export default function LoginPage() {
  const router = useRouter()
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const clientToken = localStorage.getItem("client_token")
    const adminToken = localStorage.getItem("token")
    if (clientToken && !adminToken) {
      router.push("/portal")
    }
  }, [router])

  const isDark = mounted && resolvedTheme === "dark"

  return (
    <div
      className="relative flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10 overflow-hidden selection:bg-primary/20"
      style={{
        background: isDark
          ? "radial-gradient(ellipse 90% 70% at 15% 0%, #351a10 0%, #22120b 38%, #0f0906 100%)"
          : "radial-gradient(ellipse 90% 70% at 15% 0%, #fdebe4 0%, #f7eae4 42%, #f6f5f2 100%)",
      }}
    >
      {/* Ambient background — warm orange brand gradient with interactive dot field */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <DotField
          dotRadius={2.8}
          dotSpacing={16}
          cursorRadius={380}
          bulgeOnly
          bulgeStrength={85}
          glowRadius={240}
          gradientFrom={isDark ? "rgba(242, 107, 58, 0.7)" : "rgba(230, 95, 45, 0.55)"}
          gradientTo={isDark ? "rgba(242, 107, 58, 0.4)" : "rgba(210, 80, 35, 0.35)"}
          glowColor={isDark ? "#4d2215" : "#fcd8c9"}
        />
      </div>

      <style>{`
        html:root, html:root.dark, html:root body, html:root body[class*="theme-"] {
          color-scheme: light !important;
          --background: #F6F5F2;
          --foreground: #16140F;
          --card: #FAF7F2;
          --card-foreground: #16140F;
          --popover: #FAF7F2;
          --popover-foreground: #16140F;
          --primary: #F26B3A;
          --primary-foreground: #FFFFFF;
          --secondary: #F3F1EC;
          --secondary-foreground: #16140F;
          --muted: #F3F1EC;
          --muted-foreground: #6B665B;
          --accent: #F3F1EC;
          --accent-foreground: #16140F;
          --border: #E8E5DE;
          --input: #E8E5DE;
          --ring: #F26B3A;
        }
      `}</style>

      <div className="relative z-10 flex w-full max-w-sm flex-col gap-6">
        <a href="/" className="flex items-center gap-2.5 self-center font-bold text-sm tracking-tight text-foreground">
          <div className="flex size-8 items-center justify-center overflow-hidden rounded-lg border border-border bg-card shadow-xs">
            <img
              src="/syncro.png"
              alt="Syncro CRM"
              className="size-full object-cover"
            />
          </div>
          Syncro CRM
        </a>
        <LoginForm />
      </div>
    </div>
  )
}
