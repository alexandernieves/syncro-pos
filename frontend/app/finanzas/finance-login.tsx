"use client";

import { useId, useState, type FormEvent } from "react";
import { ArrowRight, Eye, EyeOff, LoaderCircle } from "lucide-react";
import { NubiFace } from "@/components/portal/nubi-face";
import { Button } from "@/components/ui/button";
import { API_URL } from "@/lib/constants";
import { adoptAccount } from "@/lib/auth-helpers";

export type FinanceUser = { id: string; role: string; name?: string };

export const financeSessionStore = () =>
  sessionStorage.getItem("syncro-finance-session") === "1" ||
  window.matchMedia("(display-mode: standalone)").matches ? sessionStorage : localStorage;

export default function FinanceLogin({ onLogin }: { onLogin: (user: FinanceUser) => void }) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: String(form.get("email")).trim(), password: form.get("password") }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.access_token || !result?.user) {
        throw new Error(typeof result?.message === "string" ? result.message : "No pudimos iniciar sesión. Intenta de nuevo.");
      }
      const user = result.user as FinanceUser;
      if (user.role !== "syncropos") throw new Error("Usa tu cuenta de Syncro Central para iniciar sesión.");
      await adoptAccount(user);
      sessionStorage.setItem("token", result.access_token);
      sessionStorage.setItem("user", JSON.stringify(user));
      sessionStorage.setItem("syncro-finance-session", "1");
      window.dispatchEvent(new Event("syncro_session_activity"));
      onLogin(user);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "No pudimos iniciar sesión.");
    } finally {
      setBusy(false);
    }
  }

  const fieldClass = "h-12 w-full rounded-full border border-zinc-200 bg-zinc-50 px-4 text-base text-zinc-900 outline-none placeholder:text-zinc-500 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20";

  return <main data-sc-orange className="relative flex min-h-dvh flex-col overflow-hidden bg-[#F26B3A] pt-[env(safe-area-inset-top)]">
    <div aria-hidden className="pointer-events-none absolute -top-1/4 left-1/2 size-[140vw] max-w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.20),transparent_62%)]" />
    <div className="relative z-10 flex min-h-64 flex-1 flex-col items-center justify-center px-4 pb-9 pt-6">
      <NubiFace className="size-[84px] shrink-0" mood={error ? "sad" : busy ? "thinking" : "neutral"} busy={busy} />
      <h1 aria-label="Syncro Finanzas" className="mt-3 select-none text-center font-extrabold leading-[0.92] tracking-[-0.045em] ![font-size:clamp(44px,11.5vw,74px)]">
        <span className="block text-white">SYNCRO</span>
        <span className="block text-[#1A1815]">FINANZAS</span>
      </h1>
    </div>
    <div className="relative z-10 rounded-t-[32px] bg-background px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+20px)] shadow-[0_-16px_40px_rgba(90,30,5,0.25)] motion-safe:animate-in motion-safe:slide-in-from-bottom motion-safe:duration-500 sm:px-6">
      <div aria-hidden className="mx-auto mb-5 h-1.5 w-10 rounded-full bg-zinc-300" />
      <form onSubmit={handleLogin} className="mx-auto w-full max-w-sm space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-zinc-900">Inicia sesión</h2>
          <p className="mt-1 text-sm text-zinc-500">Usa tu cuenta de Syncro Central.</p>
        </div>
        <div className="space-y-1.5">
          <label className="block px-2 text-sm font-medium" htmlFor={id + "-email"}>Correo electrónico</label>
          <input className={fieldClass} id={id + "-email"} type="email" name="email" autoComplete="username" autoCapitalize="none" spellCheck={false} required disabled={busy} />
        </div>
        <div className="space-y-1.5">
          <label className="block px-2 text-sm font-medium" htmlFor={id + "-password"}>Contraseña</label>
          <div className="relative">
            <input className={fieldClass + " pr-12"} id={id + "-password"} type={visible ? "text" : "password"} name="password" autoComplete="current-password" required disabled={busy} />
            <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full" onClick={() => setVisible(value => !value)} aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}>{visible ? <EyeOff /> : <Eye />}</Button>
          </div>
        </div>
        {error && <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        <Button type="submit" className="h-12 w-full rounded-full text-base font-semibold" disabled={busy}>
          {busy ? <><LoaderCircle className="animate-spin" /> Iniciando sesión…</> : <>Acceder <ArrowRight /></>}
        </Button>
      </form>
    </div>
  </main>;
}
