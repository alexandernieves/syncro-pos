"use client";

/**
 * Syncro — landing page.
 *
 * Syncro is the platform; Vendemas is what we do with it: adapt the software to
 * each business and sell for it across every channel. The page stays quiet on
 * purpose — light, photographic, and about the people behind the counter.
 */

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Award, BadgeCheck, Boxes, CheckCircle2, CreditCard, MessageCircle, ShieldCheck, Star } from "lucide-react";

import { Reveal } from "@/components/landing/reveal";
import { Adapt } from "@/components/landing/adapt";
import { Channels } from "@/components/landing/channels";
import { HeroDiagram } from "@/components/landing/hero-diagram";
import { Showcase } from "@/components/landing/showcase";
import { ScrollRise } from "@/components/landing/scroll-words";
import { Eyebrow, SlideHeading } from "@/components/landing/scroll-headline";

const WHATSAPP = "https://wa.me/?text=Hola%2C%20quiero%20vender%20m%C3%A1s%20con%20Vendemas%20de%20Syncro";

const STEPS = [
  {
    n: "01",
    title: "Te escuchamos",
    text: "Conocemos tu negocio, tu barrio y a tus clientes. Antes de tocar una sola pantalla.",
  },
  {
    n: "02",
    title: "Lo hacemos a tu medida",
    text: "Te armamos el sistema como trabajas tú, no como trabaja el promedio.",
  },
  {
    n: "03",
    title: "Vendemos contigo",
    text: "Nos encargamos del marketing y abrimos nuevas puertas. Tú atiendes; nosotros traemos gente.",
  },
];

export default function Landing() {
  const router = useRouter();

  // Signed-in visitors go straight to their workspace.
  useEffect(() => {
    const adminToken = localStorage.getItem("token");
    const clientToken = localStorage.getItem("client_token");
    if (adminToken) router.replace("/dashboard");
    else if (clientToken) router.replace("/portal");
  }, [router]);

  return (
    <main className="min-h-screen w-full overflow-x-clip bg-[#F6F5F2] text-[#16140F] antialiased">
      {/* The landing is light whatever theme the app is in; this also colours the overscroll bounce. */}
      <style>{`html:root,html:root body{background:#F6F5F2 !important;background-color:#F6F5F2 !important;color-scheme:light !important;overscroll-behavior:none}`}</style>
      {/* ---- nav --------------------------------------------------- */}
      <header className="fixed inset-x-0 top-4 z-50 flex justify-center px-4">
        <nav className="animate-in fade-in slide-in-from-top-4 duration-700 flex w-full max-w-3xl items-center gap-2 rounded-full border border-black/[0.06] bg-white/85 py-2 pl-4 pr-2 shadow-[0_10px_30px_-18px_rgba(0,0,0,0.35)] backdrop-blur">
          <a href="#top" className="flex items-center gap-2 font-bold tracking-tight">
            <img src="/syncro.png" alt="" className="size-7 rounded-lg" />
            Syncro
          </a>
          <div className="ml-6 hidden items-center gap-6 text-sm font-medium text-[#4A463E] md:flex">
            <a href="#adaptamos" className="hover:text-black">Se adapta</a>
            <a href="#vendemos" className="hover:text-black">Vendemos contigo</a>
            <a href="#como" className="hover:text-black">Cómo trabajamos</a>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/login" className="rounded-full px-4 py-2 text-sm font-semibold hover:bg-black/[0.04]">
              Entrar
            </Link>
            <a
              href={WHATSAPP}
              target="_blank"
              rel="noreferrer"
              className="rounded-full bg-[#16140F] px-4 py-2 text-sm font-semibold text-white hover:bg-black"
            >
              Hablemos
            </a>
          </div>
        </nav>
      </header>

      {/* ---- hero -------------------------------------------------- */}
      <section
        id="top"
        className="relative flex min-h-[100svh] flex-col justify-center px-5 pb-10 pt-24 sm:pt-28"
      >
        <HeroDiagram />

        <div className="relative z-10 mx-auto mt-4 max-w-3xl text-center sm:mt-8">
          <h1
            className="animate-in fade-in slide-in-from-bottom-4 fill-mode-backwards text-[2.7rem] font-bold leading-[1.02] tracking-[-0.045em] duration-700 sm:text-6xl md:text-7xl"
            style={{ animationDelay: "550ms" }}
          >
            Vende más y
            <br />
            Fideliza a tus clientes
          </h1>
          <p
            className="animate-in fade-in slide-in-from-bottom-4 fill-mode-backwards mx-auto mt-6 max-w-xl text-lg leading-relaxed text-[#6B665B] duration-700"
            style={{ animationDelay: "700ms" }}
          >
            Syncro conecta tu negocio con múltiples canales de venta y con las aplicaciones que optimizan tus
            Ventas, y nosotros nos ocupamos de que todo funcione.
          </p>
          <div
            className="animate-in fade-in slide-in-from-bottom-4 fill-mode-backwards mt-9 duration-700"
            style={{ animationDelay: "850ms" }}
          >
            <a
              href={WHATSAPP}
              target="_blank"
              rel="noreferrer"
              className="inline-block rounded-xl bg-gradient-to-b from-[#F47C4F] to-[#EE6A3C] px-10 py-4 text-base font-semibold text-white shadow-[0_14px_30px_-12px_rgba(238,106,60,0.75)] transition hover:brightness-105"
            >
              Quiero vender más
            </a>
          </div>
        </div>
      </section>

      {/* ---- platform ---------------------------------------------- */}
      <section
        className="flex min-h-[100svh] flex-col items-center justify-center px-5 py-20 text-center"
      >
        <div className="mx-auto max-w-5xl">
        <Reveal>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-black/[0.08] bg-white px-4 py-2 text-sm shadow-sm">
            <div className="flex items-center gap-0.5">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="size-4 fill-amber-400 text-amber-400" />
              ))}
            </div>
            <span className="font-bold text-[#16140F]">5/5</span>
            <span className="text-[#6B665B]">· +500 Negocios satisfechos</span>
          </div>
        </Reveal>
        <SlideHeading
          lines={[
            { text: "La plataforma #1 en hacer", from: "left" },
            { text: "que tu negocio venda.", from: "right", mark: true },
          ]}
          className="text-4xl font-bold leading-[1.15] tracking-[-0.03em] sm:text-5xl md:text-6xl lg:text-7xl"
        />
        <ScrollRise from={0.3} to={0.62}>
          <p className="mx-auto mt-6 max-w-2xl text-lg font-medium leading-relaxed text-[#6B665B] sm:text-xl md:text-2xl">
            Mantenemos tu inventario en tiempo real, te ofrecemos un punto de venta rápido y completo, y nos encargamos de potenciar el crecimiento de tu negocio.
          </p>
        </ScrollRise>

        <Reveal delay={120}>
          <div className="mt-10 flex items-center justify-center -space-x-3">
            {["bodega-tendero", "minimarket-duenos", "dueno-retrato", "boutique-online", "bodega-mostrador"].map((p) => (
              <img
                key={p}
                src={`/media/shops/${p}.jpg`}
                alt=""
                className="size-14 rounded-full border-[3px] border-[#F6F5F2] object-cover md:size-16"
              />
            ))}
          </div>
          <p className="mt-4 text-sm font-medium text-[#7A756A]">Bodegas, ferreterías, boutiques, verdulerías y más.</p>
        </Reveal>

        <Reveal delay={200}>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {[
              { icon: BadgeCheck, label: "100% Satisfacción garantizada" },
              { icon: Award, label: "Cumplimiento y calidad #1" },
              { icon: ShieldCheck, label: "99.9% Respaldo de datos" },
              { icon: CheckCircle2, label: "Soporte e instalación asistida" },
            ].map(({ icon: Icon, label }) => (
              <span
                key={label}
                className="inline-flex items-center gap-2 rounded-full border border-black/[0.08] bg-white px-4.5 py-2 text-sm font-semibold text-[#16140F] shadow-sm transition-all hover:border-[#F26B3A]/30 hover:shadow-md"
              >
                <Icon className="size-4 text-[#F26B3A]" strokeWidth={2.2} />
                {label}
              </span>
            ))}
          </div>
        </Reveal>

        <Reveal delay={280}>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
            {[
              { icon: Boxes, label: "Inventario en tiempo real" },
              { icon: CreditCard, label: "Punto de venta incluido" },
              { icon: MessageCircle, label: "Soporte humano, no bots" },
            ].map(({ icon: Icon, label }) => (
              <span
                key={label}
                className="inline-flex items-center gap-2 rounded-full border border-black/[0.04] bg-[#EFECE6] px-3.5 py-1.5 text-xs font-medium text-[#4A463E]"
              >
                <Icon className="size-3.5 text-[#6B665B]" strokeWidth={2} />
                {label}
              </span>
            ))}
          </div>
        </Reveal>
        </div>
      </section>

      {/* ---- scroll set piece -------------------------------------- */}
      <Showcase />

      {/* ---- plus 1: adapts ----------------------------------------
          Rises over the tail of the showcase video on its rounded top edge,
          the way the reference gif slides its next panel up over the art. */}
      <section
        id="adaptamos"
        className="relative z-10 -mt-[60svh] flex min-h-[100svh] scroll-mt-24 flex-col justify-center rounded-t-[40px] bg-[#F6F5F2] px-5 py-16 shadow-[0_-20px_60px_-30px_rgba(0,0,0,0.45)] md:rounded-t-[56px]"
      >
        <div className="mx-auto w-full max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <Reveal>
            <Eyebrow>Se adapta a ti</Eyebrow>
          </Reveal>
          <SlideHeading
            lines={[
              { text: "Cada negocio tiene su forma.", from: "left" },
              { text: "Syncro se le acomoda.", from: "right", mark: true },
            ]}
            className="mt-4 text-4xl font-bold leading-[1.15] tracking-[-0.035em] md:text-5xl"
          />
          <ScrollRise from={0.28} to={0.6}>
            <p className="mt-5 text-lg text-[#6B665B]">
              Vemos cómo trabajas y armamos tu sistema a tu manera. Por eso tu Syncro no es igual al del
              Vecino.
            </p>
          </ScrollRise>
        </div>
        <Reveal delay={100}>
          <Adapt />
        </Reveal>
        </div>
      </section>

      {/* ---- plus 2: we sell --------------------------------------- */}
      <section
        id="vendemos"
        className="flex min-h-[100svh] scroll-mt-24 flex-col justify-center px-5 py-16"
      >
        <div className="mx-auto w-full max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <Reveal>
            <Eyebrow>Vendemos contigo</Eyebrow>
          </Reveal>
          <SlideHeading
            lines={[
              { text: "Nos encargamos", from: "left" },
              { text: "de que te encuentren.", from: "right", mark: true },
            ]}
            className="mt-4 text-4xl font-bold leading-[1.15] tracking-[-0.035em] md:text-5xl"
          />
          <ScrollRise from={0.28} to={0.6}>
            <p className="mt-5 text-lg text-[#6B665B]">
              Hacemos todo tu marketing y abrimos más puertas para que vendas: anuncios, tienda en línea y cada
              Canal donde estén tus clientes.
            </p>
          </ScrollRise>
        </div>
        <Reveal delay={100}>
          <Channels />
        </Reveal>
        </div>
      </section>

      {/* ---- how --------------------------------------------------- */}
      <section
        id="como"
        className="flex min-h-[100svh] scroll-mt-24 flex-col justify-center px-5 pb-32 pt-16"
      >
        <div className="mx-auto w-full max-w-6xl">
          <div className="text-center">
            <Reveal>
              <Eyebrow>Cómo trabajamos</Eyebrow>
            </Reveal>
            <SlideHeading
              lines={[
                { text: "Tres pasos.", from: "left" },
                { text: "Cero complicaciones.", from: "right" },
              ]}
              className="mt-4 text-4xl font-bold leading-[1.12] tracking-[-0.035em] md:text-5xl"
            />
            <ScrollRise from={0.28} to={0.6}>
              <p className="mx-auto mt-5 max-w-xl text-lg text-[#6B665B]">
                Nos sentamos contigo, armamos lo tuyo y salimos a vender juntos. Tú sigues atendiendo.
              </p>
            </ScrollRise>
          </div>

          <div className="mt-14 grid gap-5 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <Reveal key={s.n} delay={i * 110}>
                <div className="flex h-full flex-col items-center rounded-[28px] border border-black/[0.06] bg-white p-9 text-center shadow-[0_20px_50px_-32px_rgba(0,0,0,0.3)]">
                  <span className="text-6xl font-bold leading-none tracking-[-0.045em] text-[#F26B3A]">
                    {s.n}
                  </span>
                  <h3 className="mt-6 text-2xl font-bold tracking-[-0.02em]">{s.title}</h3>
                  <p className="mt-3 leading-relaxed text-[#6B665B]">{s.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---- close + footer ---------------------------------------- */}
      <section
        className="flex min-h-[100svh] flex-col justify-center px-5 pb-10 pt-16"
      >
        <div className="mx-auto w-full max-w-6xl">
        <div className="relative overflow-hidden rounded-[36px] border border-black/[0.06] bg-white px-6 pt-16 shadow-[0_20px_60px_-36px_rgba(0,0,0,0.3)] md:px-14">
          <div className="mx-auto max-w-2xl text-center">
            <SlideHeading
              lines={[
                { text: "Cuéntanos", from: "left" },
                { text: "de tu negocio.", from: "right", mark: true },
              ]}
              className="text-4xl font-bold leading-[1.15] tracking-[-0.035em] md:text-6xl"
            />
            <ScrollRise from={0.3} to={0.62}>
              <p className="mt-5 text-lg text-[#6B665B]">
                Hablamos contigo, sin compromiso. Nos interesa entender qué necesitas y qué necesitan tus clientes.
              </p>
              <a
                href={WHATSAPP}
                target="_blank"
                rel="noreferrer"
                className="mt-8 inline-block rounded-full bg-[#F26B3A] px-9 py-4 text-base font-bold text-white shadow-[0_14px_30px_-12px_rgba(242,107,58,0.7)] hover:brightness-105"
              >
                Hablemos por WhatsApp
              </a>
            </ScrollRise>
          </div>

          <div className="mt-16 flex flex-col gap-4 border-t border-black/[0.06] py-8 text-sm text-[#7A756A] md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2 font-bold text-[#16140F]">
              <img src="/syncro.png" alt="" className="size-6 rounded-md" />
              Syncro
              <span className="font-medium text-[#7A756A]">· vendemas</span>
            </div>
            <div className="flex gap-6">
              <Link href="/login" className="hover:text-black">Iniciar sesión</Link>
              <Link href="/register" className="hover:text-black">Crear cuenta</Link>
            </div>
          </div>

          <p
            aria-hidden
            className="pointer-events-none -mb-[0.16em] select-none text-center text-[14.5vw] whitespace-nowrap font-bold leading-[0.8] tracking-[-0.05em] text-[#F26B3A]/90 [mask-image:linear-gradient(to_bottom,black_35%,transparent)]"
          >
            Vendemas
          </p>
        </div>
        <p className="mt-6 text-center text-xs text-[#9A958A]">© {new Date().getFullYear()} Syncro</p>
        </div>
      </section>
    </main>
  );
}
