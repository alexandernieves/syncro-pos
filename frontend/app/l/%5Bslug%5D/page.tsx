"use client";

import { useEffect, useState, use } from "react";
import { useParams } from "next/navigation";
import { 
  IconStarFilled, 
  IconCheck, 
  IconTruck, 
  IconShieldCheck, 
  IconChevronDown, 
  IconChevronUp,
  IconLoader2,
  IconShoppingBag
} from "@tabler/icons-react";
import { toast, Toaster } from "sonner";
import { API_URL } from "@/lib/constants";

interface Theme {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fontFamily: string;
}

interface LandingConfig {
  title: string;
  theme: Theme;
  blocks: any[];
}

export default function PublicLandingPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [landing, setLanding] = useState<any>(null);
  const [config, setConfig] = useState<LandingConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [orderCompleted, setOrderCompleted] = useState(false);

  // Estados interactivos de la Landing
  const [selectedPackId, setSelectedPackId] = useState<string>("");
  const [activeFaqIndex, setActiveFaqIndex] = useState<number | null>(null);
  const [mainImage, setMainImage] = useState<string>("");

  // Formulario de Pago Contra Entrega
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    address: "",
    city: ""
  });

  useEffect(() => {
    fetchLandingPage();
  }, [slug]);

  const fetchLandingPage = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || API_URL}/landings/public/slug/${slug}`);
      if (!res.ok) {
        throw new Error("La página de producto no existe.");
      }
      const data = await res.json();
      setLanding(data);
      const conf = data.config as LandingConfig;
      setConfig(conf);
      
      // Auto-seleccionar imagen principal y primer paquete popular o el primero de la lista
      const heroBlock = conf.blocks.find(b => b.type === "hero");
      if (heroBlock && heroBlock.images && heroBlock.images.length > 0) {
        setMainImage(heroBlock.images[0]);
      }

      const packsBlock = conf.blocks.find(b => b.type === "packs");
      if (packsBlock && packsBlock.items && packsBlock.items.length > 0) {
        const popularPack = packsBlock.items.find((p: any) => p.popular);
        setSelectedPackId(popularPack ? popularPack.id : packsBlock.items[0].id);
      }
    } catch (error: any) {
      toast.error(error.message || "Error al cargar la página.");
    } finally {
      setLoading(false);
    }
  };

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedPackId) {
      toast.error("Por favor selecciona un paquete de oferta.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || API_URL}/landings/public/order`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          landingPageId: landing.id,
          packId: selectedPackId,
          clientName: formData.name,
          clientPhone: formData.phone,
          clientAddress: formData.address,
          clientCity: formData.city
        }),
      });

      if (!res.ok) {
        throw new Error("No se pudo procesar tu pedido. Intenta nuevamente.");
      }

      setOrderCompleted(true);
      toast.success("¡Pedido registrado exitosamente!");
    } catch (error: any) {
      toast.error(error.message || "Error de red. Intenta más tarde.");
    } finally {
      setSubmitting(false);
    }
  };

  const scrollToCheckout = () => {
    const el = document.getElementById("checkout-form");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-3">
        <IconLoader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground font-semibold">Cargando oferta exclusiva...</p>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 text-center">
        <h2 className="text-xl font-bold">Página de Producto No Encontrada</h2>
        <p className="text-sm text-muted-foreground mt-2">El enlace al que intentas acceder no existe o fue deshabilitado.</p>
      </div>
    );
  }

  // Extraer bloques clave
  const heroBlock = config.blocks.find(b => b.type === "hero");
  const featuresBlock = config.blocks.find(b => b.type === "features");
  const packsBlock = config.blocks.find(b => b.type === "packs");
  const faqsBlock = config.blocks.find(b => b.type === "faqs");
  const reviewsBlock = config.blocks.find(b => b.type === "reviews");

  const selectedPack = packsBlock?.items.find((p: any) => p.id === selectedPackId);

  // Si la orden fue completada con éxito, mostrar sección de agradecimiento
  if (orderCompleted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-rose-50/10 to-background px-5 py-12 text-center">
        <div className="max-w-md w-full bg-card border rounded-3xl p-8 shadow-2xl space-y-6 animate-fade-in">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
            <IconCheck className="h-8 w-8" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-black text-foreground">¡PEDIDO RECIBIDO CON ÉXITO!</h1>
            <p className="text-sm text-muted-foreground">
              Muchas gracias por tu compra. Hemos registrado tus datos de entrega satisfactoriamente.
            </p>
          </div>

          <div className="p-4 bg-muted/40 rounded-2xl border text-left text-xs space-y-2 leading-relaxed">
            <p className="font-bold text-foreground">📦 Resumen del Envío:</p>
            <p><span className="text-muted-foreground">Cliente:</span> {formData.name}</p>
            <p><span className="text-muted-foreground">Teléfono:</span> {formData.phone}</p>
            <p><span className="text-muted-foreground">Dirección:</span> {formData.address}, {formData.city}</p>
            <p><span className="text-muted-foreground">Oferta:</span> {selectedPack?.name}</p>
            <p className="font-extrabold text-foreground border-t pt-2 flex justify-between">
              <span>Total a Pagar en Casa:</span>
              <span className="text-emerald-500">${selectedPack?.price?.toFixed(2)}</span>
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex gap-2.5 items-center justify-center text-xs text-muted-foreground">
              <IconTruck className="h-4 w-4 text-primary animate-pulse" />
              <span>Envío Gratis Asegurado en Camino</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              * Uno de nuestros agentes comerciales te escribirá por WhatsApp en las próximas horas para confirmar la dirección de despacho. ¡Prepara tu dinero en efectivo!
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen bg-background text-foreground antialiased selection:bg-rose-500/20 max-w-lg mx-auto border-x shadow-md"
      style={{ 
        fontFamily: config.theme.fontFamily === 'Outfit' ? '"Outfit", sans-serif' : config.theme.fontFamily === 'Inter' ? '"Inter", sans-serif' : 'sans-serif',
        '--primary-color': config.theme.primaryColor,
        '--secondary-color': config.theme.secondaryColor,
        '--accent-color': config.theme.accentColor,
      } as React.CSSProperties}
    >
      <Toaster position="top-center" closeButton richColors />

      {/* Barra de envío gratis */}
      <div 
        className="w-full text-white text-[10px] md:text-xs font-bold text-center py-2 bg-rose-600 flex items-center justify-center gap-1.5 shrink-0 uppercase tracking-widest"
        style={{ backgroundColor: config.theme.primaryColor }}
      >
        <IconTruck className="h-4 w-4 shrink-0 animate-bounce" />
        🔥 ENVÍO GRATIS A TODO EL PAÍS - PAGO CONTRA ENTREGA 🔥
      </div>

      {/* HERO SECTION */}
      {heroBlock && (
        <section className="bg-gradient-to-b from-rose-50/10 via-background to-background py-6 px-5 border-b">
          <div className="flex items-center justify-center gap-0.5 text-xs text-amber-500 mb-2 font-bold">
            {[...Array(5)].map((_, i) => (
              <IconStarFilled key={i} className="h-4 w-4" style={{ color: config.theme.accentColor }} />
            ))}
            <span className="ml-1.5 text-foreground text-xs">4.9/5 (+1,200 clientes)</span>
          </div>

          <h1 className="text-xl font-black text-center leading-snug mb-3 tracking-tight">
            {heroBlock.title}
          </h1>

          <p className="text-xs text-center text-muted-foreground mb-6 leading-relaxed">
            {heroBlock.subtitle}
          </p>

          {/* Galería e Imagen Principal */}
          {heroBlock.images && heroBlock.images.length > 0 && (
            <div className="space-y-4">
              <div className="rounded-2xl overflow-hidden shadow-lg border bg-white aspect-square w-full max-w-[320px] mx-auto relative group">
                <img 
                  src={mainImage || heroBlock.images[0]} 
                  alt="Imagen de Producto" 
                  className="w-full h-full object-cover" 
                />
              </div>

              {/* Thumbnails */}
              {heroBlock.images.length > 1 && (
                <div className="flex gap-2 justify-center overflow-x-auto py-1.5">
                  {heroBlock.images.map((img: string, i: number) => (
                    <button
                      key={i}
                      onClick={() => setMainImage(img)}
                      className={`h-14 w-14 rounded-lg overflow-hidden border-2 transition shrink-0 ${
                        (mainImage || heroBlock.images[0]) === img ? "border-primary scale-105" : "border-muted hover:border-border"
                      }`}
                      style={{ borderColor: (mainImage || heroBlock.images[0]) === img ? config.theme.primaryColor : undefined }}
                    >
                      <img src={img} alt="Miniatura" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Precios y Botón CTA */}
          <div className="mt-6 flex flex-col items-center gap-4">
            <div className="flex items-baseline gap-2.5">
              <span className="text-3xl font-black" style={{ color: config.theme.primaryColor }}>
                ${heroBlock.price?.toFixed(2)}
              </span>
              {heroBlock.compareAtPrice && (
                <span className="text-base text-muted-foreground line-through decoration-rose-600/80">
                  ${heroBlock.compareAtPrice?.toFixed(2)}
                </span>
              )}
            </div>

            <button
              onClick={scrollToCheckout}
              className="w-full max-w-sm py-4 px-6 font-black text-sm rounded-2xl shadow-xl hover:brightness-105 active:scale-[0.98] transition text-white animate-pulse"
              style={{ backgroundColor: config.theme.primaryColor }}
            >
              {heroBlock.ctaText}
            </button>

            {/* Garantías Rápidas */}
            <div className="grid grid-cols-2 gap-4 w-full max-w-sm border-t border-dashed mt-4 pt-4 text-[10px] text-muted-foreground">
              <div className="flex items-center gap-2 justify-center">
                <IconTruck className="h-5 w-5 text-emerald-500 shrink-0" />
                <span className="text-left font-medium">Entrega Gratis de 2 a 5 días</span>
              </div>
              <div className="flex items-center gap-2 justify-center">
                <IconShieldCheck className="h-5 w-5 text-emerald-500 shrink-0" />
                <span className="text-left font-medium">Pagas al recibir en efectivo</span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* FEATURES SECTION */}
      {featuresBlock && (
        <section className="py-12 px-5 border-b bg-muted/15 space-y-6">
          <h2 className="text-base font-extrabold text-center leading-snug tracking-tight px-4 text-foreground/90">
            {featuresBlock.title}
          </h2>
          <div className="space-y-4">
            {featuresBlock.items?.map((item: any, fIdx: number) => (
              <div key={fIdx} className="flex items-center gap-4 p-4 bg-background border rounded-2xl shadow-sm">
                {item.image && (
                  <div className="rounded-xl overflow-hidden h-20 w-20 bg-muted border shrink-0">
                    <img src={item.image} alt={item.title} className="h-full w-full object-cover" />
                  </div>
                )}
                <div className="space-y-0.5">
                  <h3 className="font-extrabold text-xs text-foreground">{item.title}</h3>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* PACKS DE AHORRO / OFERTAS */}
      {packsBlock && (
        <section className="py-12 px-5 border-b space-y-6">
          <h2 className="text-base font-extrabold text-center leading-snug tracking-tight">
            {packsBlock.title}
          </h2>

          <div className="space-y-3.5">
            {packsBlock.items?.map((pack: any) => {
              const isSelected = selectedPackId === pack.id;
              
              return (
                <button
                  type="button"
                  key={pack.id}
                  onClick={() => setSelectedPackId(pack.id)}
                  className={`w-full relative flex items-center justify-between p-4 rounded-2xl border-2 text-left transition duration-150 ${
                    isSelected 
                      ? "bg-rose-500/5 shadow-md scale-[1.01]" 
                      : "bg-background hover:bg-muted/10 border-slate-200"
                  }`}
                  style={{ 
                    borderColor: isSelected ? config.theme.primaryColor : undefined
                  }}
                >
                  {pack.discountLabel && (
                    <span 
                      className="absolute -top-2.5 right-4 px-2 py-0.5 text-[8px] font-black text-white rounded-full uppercase tracking-widest"
                      style={{ backgroundColor: isSelected ? config.theme.primaryColor : config.theme.secondaryColor }}
                    >
                      {pack.discountLabel}
                    </span>
                  )}
                  <div className="flex items-center gap-3">
                    <div 
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-all ${
                        isSelected ? "border-primary" : "border-muted-foreground"
                      }`}
                      style={{ borderColor: isSelected ? config.theme.primaryColor : undefined }}
                    >
                      {isSelected && (
                        <div 
                          className="h-2.5 w-2.5 rounded-full" 
                          style={{ backgroundColor: config.theme.primaryColor }}
                        />
                      )}
                    </div>
                    <div>
                      <span className="font-extrabold text-xs block text-foreground">{pack.name}</span>
                      <span className="text-[10px] text-muted-foreground mt-0.5 block">Envío Express Gratis</span>
                    </div>
                  </div>
                  <span className="font-black text-sm" style={{ color: config.theme.primaryColor }}>
                    ${pack.price?.toFixed(2)}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* FORMULARIO DE COMPRA (PAGO CONTRAENTREGA) */}
      <section id="checkout-form" className="py-12 px-5 border-b bg-muted/20 space-y-6">
        <div className="text-center space-y-1.5">
          <div className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-rose-500/10 text-rose-500">
            <IconShoppingBag className="h-5 w-5" style={{ color: config.theme.primaryColor }} />
          </div>
          <h2 className="text-lg font-black tracking-tight uppercase">SOLICITAR CONTRAENTREGA</h2>
          <p className="text-xs text-muted-foreground">Llena el formulario abajo. Pagas en efectivo al recibir el producto.</p>
        </div>

        <form onSubmit={handleCheckoutSubmit} className="space-y-4 max-w-sm mx-auto bg-background rounded-2xl border p-5 shadow-sm">
          {/* Resumen de Compra en Formulario */}
          <div className="p-3 bg-muted/40 rounded-xl border text-[11px] leading-relaxed mb-2">
            <p className="font-bold flex justify-between text-foreground">
              <span>Oferta Seleccionada:</span>
              <span style={{ color: config.theme.primaryColor }}>{selectedPack?.name}</span>
            </p>
            <p className="font-extrabold flex justify-between text-foreground mt-1 border-t pt-1.5">
              <span>Total a Pagar en Puerta:</span>
              <span className="text-emerald-500 text-xs">${selectedPack?.price?.toFixed(2)}</span>
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground">Nombre y Apellido</label>
            <input
              type="text"
              placeholder="Ej. Juan Pérez"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              style={{ '--tw-ring-color': config.theme.primaryColor } as React.CSSProperties}
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground">Teléfono / Celular (WhatsApp)</label>
            <input
              type="tel"
              placeholder="Ej. +34 600 000 000"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              style={{ '--tw-ring-color': config.theme.primaryColor } as React.CSSProperties}
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground">Dirección de Entrega</label>
            <input
              type="text"
              placeholder="Ej. Calle Mayor 123, Piso 2B"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              style={{ '--tw-ring-color': config.theme.primaryColor } as React.CSSProperties}
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground">Ciudad / Municipio</label>
            <input
              type="text"
              placeholder="Ej. Madrid"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              style={{ '--tw-ring-color': config.theme.primaryColor } as React.CSSProperties}
              required
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 px-4 font-black text-xs rounded-xl shadow-lg hover:brightness-105 transition text-white mt-4 flex items-center justify-center gap-2"
            style={{ backgroundColor: config.theme.primaryColor }}
          >
            {submitting ? (
              <IconLoader2 className="h-4 w-4 animate-spin" />
            ) : (
              <IconCheck className="h-4 w-4" />
            )}
            CONFIRMAR PEDIDO CONTRAENTREGA
          </button>
        </form>
      </section>

      {/* FAQS SECTION */}
      {faqsBlock && (
        <section className="py-12 px-5 border-b space-y-6">
          <h2 className="text-base font-extrabold text-center leading-snug">
            {faqsBlock.title}
          </h2>
          <div className="space-y-2.5 max-w-sm mx-auto">
            {faqsBlock.items?.map((faq: any, faqIdx: number) => {
              const isActive = activeFaqIndex === faqIdx;
              const toggleFaq = () => setActiveFaqIndex(isActive ? null : faqIdx);

              return (
                <div key={faqIdx} className="border rounded-xl bg-card overflow-hidden">
                  <button
                    type="button"
                    onClick={toggleFaq}
                    className="w-full p-4 flex items-center justify-between text-left font-bold text-xs text-foreground hover:bg-muted/10"
                  >
                    <span>{faq.question}</span>
                    {isActive ? (
                      <IconChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <IconChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                  </button>
                  {isActive && (
                    <div className="p-4 pt-0 text-[10px] text-muted-foreground leading-relaxed border-t border-muted/20">
                      {faq.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* REVIEWS SECTION */}
      {reviewsBlock && (
        <section className="py-12 px-5 bg-background space-y-6">
          <h2 className="text-base font-extrabold text-center leading-snug">
            {reviewsBlock.title}
          </h2>
          <div className="space-y-3.5 max-w-sm mx-auto">
            {reviewsBlock.items?.map((rev: any, revIdx: number) => (
              <div key={revIdx} className="border bg-card rounded-2xl p-4 space-y-2 text-left shadow-sm">
                <div className="flex justify-between items-center text-[10px] text-muted-foreground font-medium">
                  <span className="font-bold text-xs text-foreground">{rev.author}</span>
                  <span>{rev.date}</span>
                </div>
                <div className="flex gap-0.5">
                  {[...Array(rev.rating || 5)].map((_, i) => (
                    <IconStarFilled key={i} className="h-3.5 w-3.5" style={{ color: config.theme.accentColor }} />
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed italic">"{rev.comment}"</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="py-8 px-5 bg-slate-900 text-slate-400 text-center text-[10px] space-y-2">
        <p className="font-bold text-slate-200">Compra Segura Garantizada</p>
        <p>© {new Date().getFullYear()} {config.title}. Todos los derechos reservados.</p>
        <p className="text-[9px] text-slate-500">
          La entrega se realiza por medio de transportadoras locales autorizadas con pago al recibir en efectivo.
        </p>
      </footer>
    </div>
  );
}
