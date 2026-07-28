"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
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

function PublicLandingContent() {
  const searchParams = useSearchParams();
  const slug = searchParams.get("p") as string;

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
    if (slug) {
      fetchLandingPage();
    } else {
      setLoading(false);
    }
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
      if (conf && conf.blocks) {
        const hasHeader = conf.blocks.some((b: any) => b.type === "header");
        if (!hasHeader) {
          conf.blocks = [
            {
              type: "header",
              logoText: data.title ? data.title.split(' ')[0] : "Mi Tienda",
              logoImage: "",
              showCart: true
            },
            ...conf.blocks
          ];
        }
      }
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

    if (!selectedPackId || !landing) {
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

  if (!slug) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 text-center">
        <h2 className="text-xl font-bold">Identificador de Landing Faltante</h2>
        <p className="text-sm text-muted-foreground mt-2">Especifica una landing page agregando el parámetro ?p=slug en la URL.</p>
      </div>
    );
  }

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
  const headerBlock = config.blocks.find(b => b.type === "header");
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
      className="min-h-screen bg-white text-slate-900 antialiased selection:bg-rose-500/10"
      style={{ 
        fontFamily: config.theme.fontFamily === 'Outfit' ? '"Outfit", sans-serif' : config.theme.fontFamily === 'Inter' ? '"Inter", sans-serif' : 'sans-serif',
        '--primary-color': config.theme.primaryColor,
        '--secondary-color': config.theme.secondaryColor,
        '--accent-color': config.theme.accentColor,
      } as React.CSSProperties}
    >
      {/* Barra de envío gratis */}
      <div 
        className="w-full text-white text-[10px] md:text-xs font-bold text-center py-2 bg-rose-600 flex items-center justify-center gap-1.5 shrink-0 uppercase tracking-widest"
        style={{ backgroundColor: config.theme.primaryColor }}
      >
        <IconTruck className="h-4 w-4 shrink-0 animate-bounce" />
        🔥 ENVÍO GRATIS A TODO EL PAÍS - PAGO CONTRA ENTREGA 🔥
      </div>

      {/* HEADER SECTION */}
      {headerBlock && (
        <header className="w-full bg-white border-b border-slate-100 shrink-0 sticky top-0 z-40 shadow-sm">
          <div className="mx-auto w-full flex justify-between items-center py-3.5 px-5 lg:px-[64px]" style={{ maxWidth: '1400px' }}>
            {headerBlock.logoImage ? (
              <img src={headerBlock.logoImage} alt="Logo" className="h-7 object-contain" />
            ) : (
              <span className="font-extrabold text-sm tracking-tight text-slate-900">
                {headerBlock.logoText || "Mi Tienda"}
              </span>
            )}
            {headerBlock.showCart !== false && (
              <button
                onClick={scrollToCheckout}
                className="relative p-1.5 rounded-full hover:bg-slate-50 text-slate-700 transition active:scale-95"
              >
                <IconShoppingBag className="h-5 w-5" />
              </button>
            )}
          </div>
        </header>
      )}

      {/* Main Split Layout Grid */}
      <div className="w-full bg-[#fafafa] pt-4 px-5 pb-8 lg:pt-[29px] lg:px-[64px] lg:pb-[48px] text-slate-900">
        <div className="mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-x-14 items-start" style={{ maxWidth: '1400px' }}>
          
          {/* COLUMNA IZQUIERDA: IMÁGENES Y CARACTERÍSTICAS */}
          <div className="lg:col-span-6 space-y-6">
            {/* Hero Gallery */}
            {heroBlock && (
              <div className="p-2 space-y-4">
                {heroBlock.images && heroBlock.images.length > 0 && (
                  <div className="bg-white border border-slate-200 rounded-md overflow-hidden aspect-square w-full shadow-xs">
                    <img 
                      src={mainImage || heroBlock.images[0]} 
                      alt="Product" 
                      className="w-full h-full object-cover animate-fade-in" 
                    />
                  </div>
                )}

                {heroBlock.images && heroBlock.images.length > 1 && (
                  <div className="flex gap-3 overflow-x-auto pb-3 scrollbar-none md:grid md:grid-cols-2 md:gap-4 md:overflow-visible">
                    {heroBlock.images.map((img: string, i: number) => (
                      <button
                        key={i}
                        onClick={() => setMainImage(img)}
                        className={`aspect-square rounded-md border transition overflow-hidden shrink-0 ${
                          (mainImage || heroBlock.images[0]) === img ? "border-[#16a34a] border-2" : "border-slate-200"
                        }`}
                        style={{ minWidth: '70px' }}
                      >
                        <img src={img} alt="Thumb" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Features block */}
            {featuresBlock && (
              <div className="grid grid-cols-2 gap-3 p-2">
                {featuresBlock.items?.map((item: any, fIdx: number) => (
                  <div key={fIdx} className="bg-white border border-slate-200 rounded-md overflow-hidden shadow-xs">
                    {item.image && (
                      <div className="aspect-square bg-white border-b border-slate-200">
                        <img src={item.image} alt={item.title} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="p-3 text-center space-y-1">
                      <h4 className="font-bold text-[11px] text-slate-900">{item.title}</h4>
                      <p className="text-[9px] text-slate-500 leading-relaxed">{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* COLUMNA DERECHA: COMPRA Y CONVERSIÓN */}
          <div className="lg:col-span-6 space-y-6 px-4 lg:px-0 lg:sticky lg:top-5 h-fit text-left">
            
            {/* Hero Main Info (Rating, Title, Price, Description, CTA, Badges) */}
            {heroBlock && (
              <div className="space-y-4 p-2">
                {/* Rating */}
                <div className="flex items-center gap-1.5 justify-start text-[11px] lg:text-xs text-slate-900 font-medium">
                  <div className="flex gap-0.5">
                    {[...Array(5)].map((_, i) => (
                      <IconStarFilled key={i} className="h-4 w-4 text-[#00B67A] fill-[#00B67A]" />
                    ))}
                  </div>
                  <span className="font-semibold text-slate-800">4.8/5 en +1400 opiniones</span>
                  <span className="text-slate-350">|</span>
                  <span className="font-extrabold text-slate-800 flex items-center gap-0.5">
                    <IconStarFilled className="h-3.5 w-3.5 text-[#00B67A] fill-[#00B67A]" />
                    Trustpilot
                  </span>
                </div>

                {/* Title */}
                <h1 className="text-2xl lg:text-[40px] font-black text-slate-900 leading-[105%] tracking-[-1px] mb-4">
                  {heroBlock.title}
                </h1>

                {/* Price & Badges */}
                <div className="flex flex-row items-center gap-3">
                  <div className="flex flex-row gap-1.5 items-center">
                    <span className="text-xl lg:text-[28px] font-bold" style={{ color: config.theme.primaryColor }}>
                      ${heroBlock.price?.toFixed(2)}
                    </span>
                    {heroBlock.compareAtPrice && (
                      <span className="text-sm lg:text-[18px] text-slate-400 line-through opacity-50">
                        ${heroBlock.compareAtPrice?.toFixed(2)}
                      </span>
                    )}
                  </div>
                  <div 
                    className="py-1 px-1.5 flex items-center gap-1 rounded-xs text-white shadow-sm text-[10px] font-bold uppercase tracking-wider" 
                    style={{ backgroundColor: config.theme.primaryColor }}
                  >
                    <IconStarFilled className="h-3.5 w-3.5 text-white fill-white" />
                    <span>¡Más Vendido!</span>
                  </div>
                </div>

                {/* Subtitle / Description */}
                <p className="text-xs lg:text-sm text-slate-500 leading-[150%]">
                  {heroBlock.subtitle}
                </p>

                {/* Add to Cart button */}
                <div className="space-y-4 pt-2">
                  <button
                    onClick={scrollToCheckout}
                    className="w-full py-4 px-6 font-black text-xs lg:text-sm rounded-md shadow-md hover:brightness-105 active:scale-[0.98] transition text-white uppercase tracking-wider"
                    style={{ backgroundColor: config.theme.primaryColor }}
                  >
                    {heroBlock.ctaText || "AÑADIR AL CARRITO"}
                  </button>
                  
                  {/* Payment Logos */}
                  <div className="flex justify-center items-center gap-1.5 flex-wrap opacity-80 pt-1">
                    <span className="bg-slate-100 text-[8px] font-bold text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">VISA</span>
                    <span className="bg-slate-100 text-[8px] font-bold text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">MASTERCARD</span>
                    <span className="bg-slate-100 text-[8px] font-bold text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">AMEX</span>
                    <span className="bg-slate-100 text-[8px] font-bold text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">PAYPAL</span>
                    <span className="bg-slate-100 text-[8px] font-bold text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">SHOP PAY</span>
                    <span className="bg-slate-100 text-[8px] font-bold text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">GOOGLE PAY</span>
                    <span className="bg-slate-100 text-[8px] font-bold text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">APPLE PAY</span>
                  </div>
                </div>

                {/* Trust Badges */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-2">
                  <div 
                    className="px-3 py-3 rounded-sm flex flex-row items-start gap-x-3 shadow-xs border border-slate-200 text-left" 
                    style={{ backgroundColor: config.theme.primaryColor + '08' }}
                  >
                    <IconShieldCheck className="h-6 w-6 shrink-0 mt-0.5" style={{ color: config.theme.primaryColor }} />
                    <div className="space-y-0.5">
                      <h4 className="font-bold text-[11px] lg:text-xs text-slate-900 leading-none">
                        {heroBlock.trustTitle1 || "Prueba Sin Riesgos"}
                      </h4>
                      <p className="text-[9px] lg:text-[10px] text-slate-500 leading-normal">
                        {heroBlock.trustDesc1 || "100% satisfecho o te devolvemos tu dinero."}
                      </p>
                    </div>
                  </div>
                  <div 
                    className="px-3 py-3 rounded-sm flex flex-row items-start gap-x-3 shadow-xs border border-slate-200 text-left" 
                    style={{ backgroundColor: config.theme.primaryColor + '08' }}
                  >
                    <IconTruck className="h-6 w-6 shrink-0 mt-0.5" style={{ color: config.theme.primaryColor }} />
                    <div className="space-y-0.5">
                      <h4 className="font-bold text-[11px] lg:text-xs text-slate-900 leading-none">
                        {heroBlock.trustTitle2 || "Envío Rápido y Seguro"}
                      </h4>
                      <p className="text-[9px] lg:text-[10px] text-slate-500 leading-normal">
                        {heroBlock.trustDesc2 || "Recibe tu producto en tiempo récord."}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Separator / Title Pack & Ahorra */}
            {packsBlock && (
              <div className="relative flex items-center py-2">
                <div className="flex-grow border-t border-slate-200"></div>
                <span className="flex-shrink mx-4 text-[9px] font-black text-slate-400 tracking-widest uppercase">
                  PACK & AHORRA
                </span>
                <div className="flex-grow border-t border-slate-200"></div>
              </div>
            )}

            {/* Packs Selection block */}
            {packsBlock && (
              <div className="space-y-3 p-2 text-left">
                {packsBlock.items?.map((pack: any, pIdx: number) => {
                  const isSelectedPack = selectedPackId === pack.id;
                  return (
                    <div
                      key={pack.id || pIdx}
                      onClick={() => setSelectedPackId(pack.id)}
                      className={`w-full relative flex items-center justify-between p-4 rounded-xl border-2 text-left transition cursor-pointer ${
                        isSelectedPack 
                          ? "bg-slate-50/50 shadow-xs scale-[1.01]" 
                          : "bg-white hover:bg-slate-50 border-slate-200"
                      }`}
                      style={isSelectedPack ? { borderColor: config.theme.primaryColor } : {}}
                    >
                      {pack.discountLabel && (
                        <span 
                          className="absolute -top-2.5 right-4 px-2 py-0.5 text-[8px] font-black text-white rounded-full uppercase tracking-wider"
                          style={{ backgroundColor: config.theme.primaryColor }}
                        >
                          {pack.discountLabel}
                        </span>
                      )}
                      
                      <div className="flex items-center gap-3">
                        <div 
                          className="flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full border transition"
                          style={{ borderColor: isSelectedPack ? config.theme.primaryColor : '#cbd5e1' }}
                        >
                          {isSelectedPack && (
                            <div 
                              className="h-2.5 w-2.5 rounded-full animate-scale-in" 
                              style={{ backgroundColor: config.theme.primaryColor }}
                            />
                          )}
                        </div>
                        <div>
                          <span className="font-extrabold text-xs block text-slate-950">{pack.name}</span>
                          <span className="text-[9px] text-slate-500 mt-0.5 block">Envío Express Gratis</span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="font-black text-xs block" style={{ color: config.theme.primaryColor }}>
                          ${pack.price?.toFixed(2)}
                        </span>
                        {heroBlock && (
                          <span className="text-[9px] text-slate-400 line-through block mt-0.5">
                            ${(pack.price * 1.5).toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* FAQs Accordion block */}
            {faqsBlock && (
              <div className="space-y-2 p-2 text-left">
                {faqsBlock.items?.map((faq: any, faqIdx: number) => {
                  const isOpen = activeFaqIndex === faqIdx;
                  return (
                    <div key={faqIdx} className="border border-slate-200 rounded-md bg-white overflow-hidden transition-all duration-200 shadow-xs">
                      <button
                        onClick={() => setActiveFaqIndex(isOpen ? null : faqIdx)}
                        className="w-full flex items-center justify-between p-3.5 text-left font-bold text-xs text-slate-900 hover:bg-slate-50 transition"
                      >
                        <span>{faq.question}</span>
                        {isOpen ? <IconChevronUp className="h-4 w-4 text-slate-400" /> : <IconChevronDown className="h-4 w-4 text-slate-400" />}
                      </button>
                      
                      {isOpen && (
                        <div className="p-3.5 pt-0 text-[10px] text-slate-500 leading-relaxed border-t border-slate-100/50 bg-white animate-fade-in">
                          {faq.answer}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* FORMULARIO DE COMPRA (PAGO CONTRAENTREGA) */}
      <section id="checkout-form" className="py-12 px-5 border-t border-slate-100 bg-slate-50/30 space-y-6">
        <div className="text-center space-y-1.5 animate-fade-in">
          <div className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-rose-500/10 text-rose-500">
            <IconShoppingBag className="h-5 w-5" style={{ color: config.theme.primaryColor }} />
          </div>
          <h2 className="text-lg font-black tracking-tight text-slate-900 uppercase">SOLICITAR CONTRAENTREGA</h2>
          <p className="text-xs text-slate-500 font-medium">Completa tus datos de entrega a continuación. ¡Pagas al recibir en casa!</p>
        </div>

        <form onSubmit={handleCheckoutSubmit} className="space-y-4 max-w-sm mx-auto bg-white rounded-2xl border border-slate-150 p-5 shadow-sm">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Nombre Completo</label>
            <input
              type="text"
              required
              placeholder="Ej: Juan Pérez"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full rounded-xl border border-slate-200 p-3 bg-slate-50/50 text-xs focus:bg-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Número de Teléfono</label>
            <input
              type="tel"
              required
              placeholder="Ej: 3001234567"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full rounded-xl border border-slate-200 p-3 bg-slate-50/50 text-xs focus:bg-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Dirección de Entrega</label>
            <input
              type="text"
              required
              placeholder="Ej: Calle 100 # 15-20, Apto 101"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full rounded-xl border border-slate-200 p-3 bg-slate-50/50 text-xs focus:bg-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Ciudad / Municipio</label>
            <input
              type="text"
              required
              placeholder="Ej: Bogotá"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              className="w-full rounded-xl border border-slate-200 p-3 bg-slate-50/50 text-xs focus:bg-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition"
            />
          </div>

          <div className="pt-2">
            <div className="p-3 bg-emerald-50 text-[10px] text-emerald-800 rounded-xl border border-emerald-100 flex items-start gap-2 mb-3">
              <IconTruck className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
              <div>
                <span className="font-bold">Envío Gratis & Contra Entrega:</span> Pagas en efectivo cuando la transportadora llegue a tu puerta.
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-4 bg-rose-600 hover:brightness-105 active:scale-[0.99] text-white font-black rounded-xl uppercase tracking-wider text-xs shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ backgroundColor: config.theme.primaryColor }}
            >
              {submitting ? (
                <IconLoader2 className="h-4 w-4 animate-spin" />
              ) : (
                <IconCheck className="h-4 w-4" />
              )}
              CONFIRMAR PEDIDO CONTRAENTREGA
            </button>
          </div>
        </form>
      </section>

      {/* REVIEWS SECTION */}
      {reviewsBlock && (
        <section className="py-12 px-5 bg-white border-t border-slate-150 text-center">
          <h2 className="text-base font-extrabold text-center text-slate-950 leading-snug mb-6">
            {reviewsBlock.title}
          </h2>
          <div className="space-y-3.5 max-w-lg mx-auto">
            {reviewsBlock.items?.map((rev: any, revIdx: number) => (
              <div key={revIdx} className="border border-slate-100 bg-slate-50/30 rounded-2xl p-4 space-y-2 text-left shadow-sm">
                <div className="flex justify-between items-center text-[10px] text-slate-500 font-medium">
                  <span className="font-bold text-xs text-slate-950">{rev.author}</span>
                  <span>{rev.date}</span>
                </div>
                <div className="flex gap-0.5">
                  {[...Array(rev.rating || 5)].map((_, i) => (
                    <IconStarFilled key={i} className="h-3.5 w-3.5 fill-amber-500 text-amber-500 animate-scale-in" style={{ color: config.theme.accentColor }} />
                  ))}
                </div>
                <p className="text-[10px] text-slate-500 leading-relaxed italic">"{rev.comment}"</p>
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

export default function PublicLandingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-3">
        <IconLoader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground font-semibold">Cargando oferta exclusiva...</p>
      </div>
    }>
      <PublicLandingContent />
    </Suspense>
  );
}
