"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { 
  IconArrowLeft, 
  IconDeviceMobile, 
  IconDeviceDesktop, 
  IconDeviceFloppy, 
  IconLoader2, 
  IconPlus, 
  IconTrash, 
  IconStarFilled, 
  IconCheck,
  IconSparkles,
  IconPalette,
  IconShoppingBag,
  IconSettings,
  IconArrowUp,
  IconArrowDown,
  IconTruck,
  IconShieldCheck,
  IconChevronDown,
  IconChevronUp
} from "@tabler/icons-react";
import { toast } from "sonner";
import { API_URL } from "@/lib/constants";

// Definición de tipos
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

function LandingEditorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get("id") as string;

  const [landing, setLanding] = useState<any>(null);
  const [config, setConfig] = useState<LandingConfig | null>(null);
  const [status, setStatus] = useState("DRAFT");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState<"mobile" | "desktop">("desktop");
  const [editingBlockIndex, setEditingBlockIndex] = useState<number | null>(null);
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);
  const [isAddSectionOpen, setIsAddSectionOpen] = useState(false);
  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
  const [selectedPackId, setSelectedPackId] = useState<string>("");
  const [activeFaqIndex, setActiveFaqIndex] = useState<number | null>(null);
  const [mainImage, setMainImage] = useState<string>("");

  useEffect(() => {
    if (id) {
      fetchLandingDetails();
    }
  }, [id]);

  const fetchLandingDetails = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || API_URL}/landings/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error("No se pudo cargar la landing page.");
      }

      const data = await res.json();
      setLanding(data);
      
      const dataConfig = data.config as LandingConfig;
      if (dataConfig && dataConfig.blocks) {
        const hasHeader = dataConfig.blocks.some((b: any) => b.type === "header");
        if (!hasHeader) {
          dataConfig.blocks = [
            {
              type: "header",
              logoText: data.title ? data.title.split(' ')[0] : "Mi Tienda",
              logoImage: "",
              showCart: true
            },
            ...dataConfig.blocks
          ];
        }
      }

      setConfig(dataConfig);
      
      // Auto-seleccionar primer pack e imagen principal para previsualización
      const heroB = dataConfig.blocks.find((b: any) => b.type === "hero");
      if (heroB && heroB.images && heroB.images.length > 0) {
        setMainImage(heroB.images[0]);
      }
      const packsB = dataConfig.blocks.find((b: any) => b.type === "packs");
      if (packsB && packsB.items && packsB.items.length > 0) {
        const popularPack = packsB.items.find((p: any) => p.popular);
        setSelectedPackId(popularPack ? popularPack.id : packsB.items[0].id);
      }
      
      setStatus(data.status);
    } catch (error: any) {
      toast.error(error.message || "Error al obtener detalles.");
      router.push("/dashboard/landings");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!config || !id) return;
    
    setSaving(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || API_URL}/landings/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: config.title,
          config,
          status,
        }),
      });

      if (!res.ok) {
        throw new Error("No se pudieron guardar los cambios.");
      }

      toast.success("¡Landing page guardada correctamente!");
    } catch (error: any) {
      toast.error(error.message || "Error al guardar.");
    } finally {
      setSaving(false);
    }
  };

  // Helper para actualizar campos del config
  const updateConfigValue = (key: string, value: any) => {
    if (!config) return;
    setConfig({
      ...config,
      [key]: value
    });
  };

  const addNewSection = (type: string) => {
    if (!config) return;
    
    let newBlock: any = { type };
    
    if (type === "hero") {
      newBlock = {
        type: "hero",
        title: "¡Título de conversión de tu nuevo banner!",
        subtitle: "Describe aquí los beneficios principales e irresistibles de tu producto.",
        ctaText: "PEDIR CON PAGO CONTRAENTREGA",
        features: ["Envío Gratis", "Pago al Recibir", "Garantía de Satisfacción"],
        price: 19.99,
        compareAtPrice: 39.99,
        images: []
      };
    } else if (type === "features") {
      newBlock = {
        type: "features",
        title: "¿Por qué es el producto favorito de nuestros clientes?",
        items: [
          { title: "Calidad Premium", description: "Fabricado con materiales de la más alta calidad del mercado.", image: "" },
          { title: "Fácil de Usar", description: "Diseño ergonómico pensado para la máxima comodidad del usuario.", image: "" }
        ]
      };
    } else if (type === "packs") {
      newBlock = {
        type: "packs",
        title: "🔥 SELECCIONA TU OFERTA - ENVÍO GRATIS Y PAGO CONTRAENTREGA 🔥",
        items: [
          { id: `pack_${Date.now()}`, name: "Compra 1 Unidad", quantity: 1, price: 19.99, popular: false, discountLabel: "Oferta estándar" },
          { id: `pack_${Date.now() + 1}`, name: "Lleva 2, Paga 1.5 (Ahorras 25%)", quantity: 2, price: 29.99, popular: true, discountLabel: "MÁS VENDIDO" }
        ]
      };
    } else if (type === "faqs") {
      newBlock = {
        type: "faqs",
        title: "Preguntas Frecuentes",
        items: [
          { question: "¿Cuánto tarda el envío?", answer: "El envío es gratis y tarda entre 2 y 5 días hábiles." },
          { question: "¿Cómo pago?", answer: "Pagas en efectivo al recibir el producto en tu casa." }
        ]
      };
    } else if (type === "reviews") {
      newBlock = {
        type: "reviews",
        title: "Lo que opinan nuestros clientes",
        items: [
          { author: "Juan P.", comment: "Excelente producto, llegó muy rápido y el pago contraentrega fue súper seguro.", rating: 5, date: "Hace unos días" }
        ]
      };
    }

    const newBlocks = [...config.blocks];
    const insertIndex = editingBlockIndex !== null ? editingBlockIndex + 1 : newBlocks.length;
    newBlocks.splice(insertIndex, 0, newBlock);
    
    setConfig({
      ...config,
      blocks: newBlocks
    });

    toast.success("¡Nueva sección agregada correctamente!");
  };

  const moveBlock = (index: number, direction: "up" | "down") => {
    if (!config) return;
    const newBlocks = [...config.blocks];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    
    if (targetIndex < 0 || targetIndex >= newBlocks.length) return;
    
    // Intercambiar
    const temp = newBlocks[index];
    newBlocks[index] = newBlocks[targetIndex];
    newBlocks[targetIndex] = temp;
    
    setConfig({
      ...config,
      blocks: newBlocks
    });
    setEditingBlockIndex(targetIndex);
    toast.success("Sección reordenada correctamente");
  };

  const deleteBlock = (index: number) => {
    if (!config) return;
    const newBlocks = [...config.blocks];
    newBlocks.splice(index, 1);
    
    setConfig({
      ...config,
      blocks: newBlocks
    });
    setEditingBlockIndex(null);
    toast.success("Sección eliminada correctamente");
  };

  const updateThemeValue = (key: keyof Theme, value: string) => {
    if (!config) return;
    setConfig({
      ...config,
      theme: {
        ...config.theme,
        [key]: value
      }
    });
  };

  const updateBlockValue = (blockIndex: number, field: string, value: any) => {
    if (!config) return;
    const newBlocks = [...config.blocks];
    newBlocks[blockIndex] = {
      ...newBlocks[blockIndex],
      [field]: value
    };
    setConfig({
      ...config,
      blocks: newBlocks
    });
  };

  const updateNestedBlockValue = (blockIndex: number, arrayField: string, itemIndex: number, field: string, value: any) => {
    if (!config) return;
    const newBlocks = [...config.blocks];
    const newArray = [...newBlocks[blockIndex][arrayField]];
    newArray[itemIndex] = {
      ...newArray[itemIndex],
      [field]: value
    };
    newBlocks[blockIndex] = {
      ...newBlocks[blockIndex],
      [arrayField]: newArray
    };
    setConfig({
      ...config,
      blocks: newBlocks
    });
  };

  if (!id) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-xl font-bold">Identificador de Landing Faltante</h2>
        <Link href="/dashboard/landings" className="text-primary hover:underline mt-2">Volver al listado</Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <IconLoader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Cargando editor de landing page...</p>
      </div>
    );
  }

  if (!config) return null;

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-var(--header-height)-12px)] overflow-hidden">
      {/* Editor Header */}
      <div className="border-b bg-card/60 backdrop-blur-md px-6 py-3 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/landings"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border hover:bg-muted text-muted-foreground hover:text-foreground transition"
          >
            <IconArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <input
              type="text"
              value={config.title}
              onChange={(e) => updateConfigValue("title", e.target.value)}
              className="text-lg font-bold bg-transparent border-b border-transparent hover:border-border focus:border-primary focus:outline-none px-1 py-0.5 max-w-md"
            />
            <p className="text-xs text-muted-foreground mt-0.5">
              URL Pública: <a href={`/l/?p=${landing?.slug}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">/l/?p={landing?.slug}</a>
            </p>
          </div>
        </div>

        {/* Center: Device Toggle */}
        <div className="hidden md:flex items-center gap-1 bg-muted p-1 rounded-lg border">
          <button
            onClick={() => setPreviewMode("mobile")}
            className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-md transition ${
              previewMode === "mobile" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <IconDeviceMobile className="h-3.5 w-3.5" />
            Móvil
          </button>
          <button
            onClick={() => setPreviewMode("desktop")}
            className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-md transition ${
              previewMode === "desktop" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <IconDeviceDesktop className="h-3.5 w-3.5" />
            Escritorio
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsThemeModalOpen(true)}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border bg-background px-3.5 py-1.5 text-xs font-semibold hover:bg-muted text-foreground transition"
          >
            <IconPalette className="h-4 w-4 text-muted-foreground" />
            Diseño del Tema
          </button>

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-lg border bg-background px-3 py-1.5 text-xs font-semibold"
          >
            <option value="DRAFT">Borrador</option>
            <option value="PUBLISHED">Publicado</option>
          </select>

          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/95 shadow-sm transition disabled:opacity-50"
          >
            {saving ? (
              <IconLoader2 className="h-4 w-4 animate-spin" />
            ) : (
              <IconDeviceFloppy className="h-4 w-4" />
            )}
            Guardar Cambios
          </button>
        </div>
      </div>

      {/* Editor Body */}
      <div className="flex-1 flex overflow-hidden">

        <div className="flex-1 bg-muted/40 flex flex-col items-center overflow-hidden p-0">

          {/* Simulator Wrapper */}
          <div className="flex-1 w-full flex justify-center overflow-hidden relative items-center">
            <div 
              className={`bg-background transition-all duration-300 overflow-y-auto ${
                previewMode === "mobile" 
                  ? "absolute inset-y-0 left-1/2 -translate-x-1/2 w-[375px] border-x border-slate-200 shadow-slate-900/10" 
                  : "w-full h-full border-none shadow-none"
              }`}
            >
              {/* RENDERIZADOR DIRECTO DE COMPONENTES (Aislado de tema global dark/light) */}
              <div 
                className="w-full bg-white text-slate-900 selection:bg-rose-500/10 select-none pb-20"
                style={{ 
                  fontFamily: config.theme.fontFamily === 'Outfit' ? '"Outfit", sans-serif' : config.theme.fontFamily === 'Inter' ? '"Inter", sans-serif' : 'sans-serif',
                  '--primary-color': config.theme.primaryColor,
                  '--secondary-color': config.theme.secondaryColor,
                  '--accent-color': config.theme.accentColor,
                } as React.CSSProperties}
              >
                {(() => {
                  const SelectableBlockWrapper = ({ 
                    index, 
                    children,
                    isSticky = false,
                  }: { 
                    index: number; 
                    children: React.ReactNode;
                    isSticky?: boolean;
                  }) => {
                    if (index === -1) return null;
                    const isSelected = editingBlockIndex === index;
                    
                    return (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingBlockIndex(index);
                        }}
                        className={`${isSticky ? "sticky top-0 z-40 bg-white shadow-sm" : "relative"} group/block cursor-pointer border-2 transition-all duration-200 ${
                          isSelected 
                            ? "border-[#16a34a] bg-[#16a34a]/[0.01]" 
                            : "border-transparent hover:border-[#16a34a]/60 hover:bg-slate-50/10"
                        }`}
                      >
                        {/* Barra de herramientas flotante del bloque seleccionado */}
                        {isSelected && (
                          <div className="absolute top-2 right-2 bg-slate-900 text-white rounded-lg flex items-center gap-1 px-1.5 py-1 shadow-xl z-40 animate-fade-in border border-slate-800">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setIsBlockModalOpen(true);
                              }}
                              title="Editar Contenido"
                              className="p-1 rounded hover:bg-slate-800 text-slate-200 hover:text-white transition flex items-center gap-1 text-[10px] font-bold"
                            >
                              <IconSettings className="h-3.5 w-3.5" />
                              <span>Configurar</span>
                            </button>
                            
                            {index > 0 && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  moveBlock(index, "up");
                                }}
                                title="Subir Sección"
                                className="p-1 rounded hover:bg-slate-800 text-slate-200 hover:text-white transition"
                              >
                                <IconArrowUp className="h-3.5 w-3.5" />
                              </button>
                            )}
                            
                            {index < config.blocks.length - 1 && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  moveBlock(index, "down");
                                }}
                                title="Bajar Sección"
                                className="p-1 rounded hover:bg-slate-800 text-slate-200 hover:text-white transition"
                              >
                                <IconArrowDown className="h-3.5 w-3.5" />
                              </button>
                            )}

                            {config.blocks.length > 1 && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteBlock(index);
                                }}
                                title="Eliminar Sección"
                                className="p-1 rounded hover:bg-red-500/20 text-rose-400 hover:text-rose-200 transition"
                              >
                                <IconTrash className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        )}
                        
                        {children}
                      </div>
                    );
                  };

                  const headerBlockIdx = config.blocks.findIndex(b => b.type === "header");
                  const heroBlockIdx = config.blocks.findIndex(b => b.type === "hero");
                  const featuresBlockIdx = config.blocks.findIndex(b => b.type === "features");
                  const packsBlockIdx = config.blocks.findIndex(b => b.type === "packs");
                  const faqsBlockIdx = config.blocks.findIndex(b => b.type === "faqs");
                  const reviewsBlockIdx = config.blocks.findIndex(b => b.type === "reviews");

                  const headerBlock = headerBlockIdx !== -1 ? config.blocks[headerBlockIdx] : null;
                  const heroBlock = heroBlockIdx !== -1 ? config.blocks[heroBlockIdx] : null;
                  const featuresBlock = featuresBlockIdx !== -1 ? config.blocks[featuresBlockIdx] : null;
                  const packsBlock = packsBlockIdx !== -1 ? config.blocks[packsBlockIdx] : null;
                  const faqsBlock = faqsBlockIdx !== -1 ? config.blocks[faqsBlockIdx] : null;
                  const reviewsBlock = reviewsBlockIdx !== -1 ? config.blocks[reviewsBlockIdx] : null;

                  return (
                    <div className="w-full text-slate-900 bg-white">
                      {/* Announcement Bar */}
                      <div 
                        className="w-full text-white text-[10px] md:text-xs font-bold text-center py-2 bg-rose-600 flex items-center justify-center gap-1.5 shrink-0 uppercase tracking-widest"
                        style={{ backgroundColor: config.theme.primaryColor }}
                      >
                        <IconTruck className="h-4 w-4 shrink-0 animate-bounce" />
                        🔥 ENVÍO GRATIS A TODO EL PAÍS - PAGO CONTRA ENTREGA 🔥
                      </div>

                      {/* Header block */}
                      {headerBlockIdx !== -1 && headerBlock && (
                        <SelectableBlockWrapper index={headerBlockIdx} isSticky={true}>
                          <div className="w-full bg-white border-b border-slate-100 shrink-0 min-h-[56px] relative">
                            <div className="mx-auto w-full flex justify-between items-center py-3.5 px-5 lg:px-[64px]" style={{ maxWidth: '1400px' }}>
                              {headerBlock.logoImage ? (
                                <img src={headerBlock.logoImage} alt="Logo" className="h-7 object-contain" />
                              ) : (
                                <span className="font-extrabold text-sm tracking-tight text-slate-900">
                                  {headerBlock.logoText || "Mi Tienda"}
                                </span>
                              )}
                              
                              {/* Botón Agregar Sección en el centro, visible solo si está seleccionado */}
                              {editingBlockIndex === headerBlockIdx && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setIsAddSectionOpen(true);
                                  }}
                                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black hover:bg-black/90 text-white px-4 py-1.5 font-bold text-[10px] tracking-wider uppercase transition shadow-md z-40 active:scale-95 whitespace-nowrap"
                                >
                                  Agregar Sección
                                </button>
                              )}

                              {headerBlock.showCart !== false && (
                                <div className="relative p-1.5 rounded-full hover:bg-slate-50 text-slate-700 transition">
                                  <IconShoppingBag className="h-5 w-5" />
                                </div>
                              )}
                            </div>
                          </div>
                        </SelectableBlockWrapper>
                      )}

                      {/* Main Split Layout Grid */}
                      {heroBlockIdx !== -1 && heroBlock && (
                        <SelectableBlockWrapper index={heroBlockIdx}>
                          <div className="w-full bg-[#fafafa] pt-4 px-5 pb-8 lg:pt-[29px] lg:px-[64px] lg:pb-[48px] text-slate-900">
                            <div className="mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-x-14 items-start" style={{ maxWidth: '1400px' }}>
                              
                              {/* COLUMNA IZQUIERDA: IMÁGENES Y CARACTERÍSTICAS */}
                              <div className="lg:col-span-6 space-y-6">
                                {/* Hero Gallery */}
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
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setMainImage(img);
                                          }}
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

                                {/* Features block */}
                                {featuresBlockIdx !== -1 && featuresBlock && (
                                  <SelectableBlockWrapper index={featuresBlockIdx}>
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
                                  </SelectableBlockWrapper>
                                )}
                              </div>

                              {/* COLUMNA DERECHA: COMPRA Y CONVERSIÓN */}
                              <div className="lg:col-span-6 space-y-6 px-4 lg:px-0 lg:sticky lg:top-5 h-fit text-left">
                                
                                {/* Hero Main Info */}
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

                                  {/* Trust Badges — seleccionable independientemente */}
                                  <SelectableBlockWrapper index={heroBlockIdx}>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 p-2">
                                      <div 
                                        className="px-3 py-3 rounded-sm flex flex-row items-start gap-x-3 shadow-xs border border-slate-200 text-left cursor-pointer" 
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
                                        className="px-3 py-3 rounded-sm flex flex-row items-start gap-x-3 shadow-xs border border-slate-200 text-left cursor-pointer" 
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
                                  </SelectableBlockWrapper>
                                </div>

                                {/* Separator / Title Pack & Ahorra */}
                                {packsBlockIdx !== -1 && packsBlock && (
                                  <div className="relative flex items-center py-2">
                                    <div className="flex-grow border-t border-slate-200"></div>
                                    <span className="flex-shrink mx-4 text-[9px] font-black text-slate-400 tracking-widest uppercase">
                                      PACK & AHORRA
                                    </span>
                                    <div className="flex-grow border-t border-slate-200"></div>
                                  </div>
                                )}

                                {/* Packs Selection block */}
                                {packsBlockIdx !== -1 && packsBlock && (
                                  <SelectableBlockWrapper index={packsBlockIdx}>
                                    <div className="space-y-3 p-2 text-left">
                                      {packsBlock.items?.map((pack: any, pIdx: number) => {
                                        const isSelectedPack = selectedPackId === pack.id;
                                        return (
                                          <div
                                            key={pack.id || pIdx}
                                            onClick={() => {
                                              setSelectedPackId(pack.id);
                                            }}
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
                                  </SelectableBlockWrapper>
                                )}

                                {/* FAQs Accordion block */}
                                {faqsBlockIdx !== -1 && faqsBlock && (
                                  <SelectableBlockWrapper index={faqsBlockIdx}>
                                    <div className="space-y-2 p-2 text-left">
                                      {faqsBlock.items?.map((faq: any, faqIdx: number) => {
                                        const isOpen = activeFaqIndex === faqIdx;
                                        return (
                                          <div key={faqIdx} className="border border-slate-200 rounded-md bg-white overflow-hidden transition-all duration-200 shadow-xs">
                                            <button
                                              onClick={() => {
                                                setActiveFaqIndex(isOpen ? null : faqIdx);
                                              }}
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
                                  </SelectableBlockWrapper>
                                )}
                              </div>
                            </div>
                          </div>
                        </SelectableBlockWrapper>
                      )}


                      {/* Visual Mockup of Checkout Form */}
                      <div className="bg-slate-50/30 border-t border-slate-100 py-12 px-5">
                        <div className="max-w-sm mx-auto bg-white rounded-2xl border border-slate-150 p-5 shadow-sm space-y-4 text-slate-900">
                          <h3 className="font-extrabold text-sm text-center uppercase tracking-wider text-slate-950">📦 DATOS DE DESPACHO</h3>
                          <div className="space-y-3 text-xs">
                            <div>
                              <label className="font-bold text-slate-500">Nombre Completo</label>
                              <input type="text" disabled placeholder="Ej: Carlos Pérez" className="w-full rounded border p-2 bg-slate-50/50 mt-1 cursor-not-allowed" />
                            </div>
                            <div>
                              <label className="font-bold text-slate-500">Teléfono</label>
                              <input type="text" disabled placeholder="Ej: 3001234567" className="w-full rounded border p-2 bg-slate-50/50 mt-1 cursor-not-allowed" />
                            </div>
                            <div>
                              <label className="font-bold text-slate-500">Dirección de Entrega</label>
                              <input type="text" disabled placeholder="Ej: Calle 12 # 34 - 56" className="w-full rounded border p-2 bg-slate-50/50 mt-1 cursor-not-allowed" />
                            </div>
                          </div>
                          <button disabled className="w-full py-3.5 bg-rose-600/50 text-white font-extrabold rounded-xl uppercase tracking-wider text-xs cursor-not-allowed" style={{ backgroundColor: config.theme.primaryColor + '80' }}>
                            Enviar Pedido (Pago Contra Entrega)
                          </button>
                        </div>
                      </div>

                      {/* Reviews Section at the very bottom (Full Width) */}
                      {reviewsBlockIdx !== -1 && reviewsBlock && (
                        <SelectableBlockWrapper index={reviewsBlockIdx}>
                          <div className="py-10 px-5 bg-white border-t border-slate-150 text-center">
                            <h2 className="text-base font-extrabold text-center text-slate-900 leading-snug mb-6">
                              {reviewsBlock.title}
                            </h2>
                            <div className="space-y-4 max-w-lg mx-auto">
                              {reviewsBlock.items?.map((rev: any, revIdx: number) => (
                                <div key={revIdx} className="border border-slate-100 bg-slate-50/30 rounded-xl p-4 space-y-2 text-left animate-fade-in">
                                  <div className="flex justify-between items-center text-[10px] text-slate-500 font-medium">
                                    <span className="font-bold text-xs text-slate-900">{rev.author}</span>
                                    <span>{rev.date}</span>
                                  </div>
                                  <div className="flex gap-0.5 text-amber-500">
                                    {[...Array(rev.rating || 5)].map((_, i) => (
                                      <IconStarFilled key={i} className="h-3 w-3 fill-amber-500 text-amber-500" style={{ color: config.theme.accentColor }} />
                                    ))}
                                  </div>
                                  <p className="text-[10px] text-slate-500 leading-relaxed italic">"{rev.comment}"</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </SelectableBlockWrapper>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL: EDITAR BLOQUE */}
      {isBlockModalOpen && editingBlockIndex !== null && config && config.blocks[editingBlockIndex] && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 text-left">
          <div className="bg-card border rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-fade-in text-xs text-foreground">
            <div className="px-6 py-4 border-b flex items-center justify-between bg-muted/10">
              <h3 className="font-bold text-sm capitalize">
                Configurar Bloque: {config.blocks[editingBlockIndex].type === "faqs" ? "Preguntas Frecuentes" : config.blocks[editingBlockIndex].type}
              </h3>
              <button 
                onClick={() => setIsBlockModalOpen(false)}
                className="text-muted-foreground hover:text-foreground text-xs font-bold"
              >
                Cerrar
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* HEADER BLOCK */}
              {config.blocks[editingBlockIndex].type === "header" && (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="font-semibold text-muted-foreground">Texto del Logo (Si no hay imagen)</label>
                    <input
                      type="text"
                      value={config.blocks[editingBlockIndex].logoText || ""}
                      onChange={(e) => updateBlockValue(editingBlockIndex, "logoText", e.target.value)}
                      className="w-full rounded border p-2 bg-background text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold text-muted-foreground">URL de Imagen del Logo (Opcional)</label>
                    <input
                      type="text"
                      value={config.blocks[editingBlockIndex].logoImage || ""}
                      onChange={(e) => updateBlockValue(editingBlockIndex, "logoImage", e.target.value)}
                      className="w-full rounded border p-2 bg-background text-xs"
                      placeholder="https://ejemplo.com/logo.png"
                    />
                  </div>
                  <div className="flex items-center gap-2 py-2">
                    <input
                      type="checkbox"
                      id="showCart"
                      checked={config.blocks[editingBlockIndex].showCart !== false}
                      onChange={(e) => updateBlockValue(editingBlockIndex, "showCart", e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <label htmlFor="showCart" className="font-semibold text-xs text-muted-foreground cursor-pointer select-none">
                      Mostrar icono del carrito de compras
                    </label>
                  </div>
                </div>
              )}

              {/* HERO BLOCK */}
              {config.blocks[editingBlockIndex].type === "hero" && (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="font-semibold text-muted-foreground">Título Principal</label>
                    <input
                      type="text"
                      value={config.blocks[editingBlockIndex].title || ""}
                      onChange={(e) => updateBlockValue(editingBlockIndex, "title", e.target.value)}
                      className="w-full rounded border p-2 bg-background text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold text-muted-foreground">Subtítulo</label>
                    <textarea
                      value={config.blocks[editingBlockIndex].subtitle || ""}
                      onChange={(e) => updateBlockValue(editingBlockIndex, "subtitle", e.target.value)}
                      rows={3}
                      className="w-full rounded border p-2 bg-background text-xs"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="font-semibold text-muted-foreground">Precio Oferta ($)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={config.blocks[editingBlockIndex].price ?? ""}
                        onChange={(e) => updateBlockValue(editingBlockIndex, "price", parseFloat(e.target.value) || 0)}
                        className="w-full rounded border p-2 bg-background text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-semibold text-muted-foreground">Precio Normal ($)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={config.blocks[editingBlockIndex].compareAtPrice ?? ""}
                        onChange={(e) => updateBlockValue(editingBlockIndex, "compareAtPrice", parseFloat(e.target.value) || 0)}
                        className="w-full rounded border p-2 bg-background text-xs"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold text-muted-foreground">Texto del Botón (CTA)</label>
                    <input
                      type="text"
                      value={config.blocks[editingBlockIndex].ctaText || ""}
                      onChange={(e) => updateBlockValue(editingBlockIndex, "ctaText", e.target.value)}
                      className="w-full rounded border p-2 bg-background text-xs"
                    />
                  </div>
                  
                  {/* Trust Badges Config */}
                  <div className="border-t pt-3 mt-3 space-y-3">
                    <h4 className="font-bold text-[11px] text-muted-foreground uppercase tracking-wider">Insignias de Garantía</h4>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-muted-foreground">Título Garantía 1</label>
                        <input
                          type="text"
                          value={config.blocks[editingBlockIndex].trustTitle1 || ""}
                          placeholder="Prueba Sin Riesgos"
                          onChange={(e) => updateBlockValue(editingBlockIndex, "trustTitle1", e.target.value)}
                          className="w-full rounded border p-1.5 bg-background text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-muted-foreground">Descripción Garantía 1</label>
                        <input
                          type="text"
                          value={config.blocks[editingBlockIndex].trustDesc1 || ""}
                          placeholder="100% satisfecho o te devolvemos tu dinero."
                          onChange={(e) => updateBlockValue(editingBlockIndex, "trustDesc1", e.target.value)}
                          className="w-full rounded border p-1.5 bg-background text-xs"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-muted-foreground">Título Garantía 2</label>
                        <input
                          type="text"
                          value={config.blocks[editingBlockIndex].trustTitle2 || ""}
                          placeholder="Envío Rápido y Seguro"
                          onChange={(e) => updateBlockValue(editingBlockIndex, "trustTitle2", e.target.value)}
                          className="w-full rounded border p-1.5 bg-background text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-muted-foreground">Descripción Garantía 2</label>
                        <input
                          type="text"
                          value={config.blocks[editingBlockIndex].trustDesc2 || ""}
                          placeholder="Recibe tu producto en tiempo récord."
                          onChange={(e) => updateBlockValue(editingBlockIndex, "trustDesc2", e.target.value)}
                          className="w-full rounded border p-1.5 bg-background text-xs"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* FEATURES BLOCK */}
              {config.blocks[editingBlockIndex].type === "features" && (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="font-semibold text-muted-foreground">Título de la Sección</label>
                    <input
                      type="text"
                      value={config.blocks[editingBlockIndex].title || ""}
                      onChange={(e) => updateBlockValue(editingBlockIndex, "title", e.target.value)}
                      className="w-full rounded border p-2 bg-background text-xs"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="font-bold text-xs block text-muted-foreground">Beneficios del Producto</label>
                    {config.blocks[editingBlockIndex].items?.map((item: any, itemIdx: number) => (
                      <div key={itemIdx} className="p-3 border rounded-xl space-y-2 bg-muted/10 relative">
                        <div className="grid grid-cols-1 gap-2">
                          <div className="space-y-1">
                            <label className="text-[10px] font-semibold text-muted-foreground">Título</label>
                            <input
                              type="text"
                              value={item.title || ""}
                              onChange={(e) => updateNestedBlockValue(editingBlockIndex, "items", itemIdx, "title", e.target.value)}
                              className="w-full rounded border p-1.5 bg-background text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-semibold text-muted-foreground">Descripción</label>
                            <textarea
                              value={item.description || ""}
                              onChange={(e) => updateNestedBlockValue(editingBlockIndex, "items", itemIdx, "description", e.target.value)}
                              rows={2}
                              className="w-full rounded border p-1.5 bg-background text-xs"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* PACKS BLOCK */}
              {config.blocks[editingBlockIndex].type === "packs" && (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="font-semibold text-muted-foreground">Título de Ofertas</label>
                    <input
                      type="text"
                      value={config.blocks[editingBlockIndex].title || ""}
                      onChange={(e) => updateBlockValue(editingBlockIndex, "title", e.target.value)}
                      className="w-full rounded border p-2 bg-background text-xs"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="font-bold text-xs block text-muted-foreground">Packs de Oferta</label>
                    {config.blocks[editingBlockIndex].items?.map((pack: any, packIdx: number) => (
                      <div key={packIdx} className="p-3 border rounded-xl space-y-2 bg-muted/10">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-[10px] font-semibold text-muted-foreground">Nombre del Pack</label>
                            <input
                              type="text"
                              value={pack.name || ""}
                              onChange={(e) => updateNestedBlockValue(editingBlockIndex, "items", packIdx, "name", e.target.value)}
                              className="w-full rounded border p-1.5 bg-background text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-semibold text-muted-foreground">Precio ($)</label>
                            <input
                              type="number"
                              step="0.01"
                              value={pack.price ?? ""}
                              onChange={(e) => updateNestedBlockValue(editingBlockIndex, "items", packIdx, "price", parseFloat(e.target.value) || 0)}
                              className="w-full rounded border p-1.5 bg-background text-xs"
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-semibold text-muted-foreground">Etiqueta de Descuento (Ej. MÁS POPULAR)</label>
                          <input
                            type="text"
                            value={pack.discountLabel || ""}
                            onChange={(e) => updateNestedBlockValue(editingBlockIndex, "items", packIdx, "discountLabel", e.target.value)}
                            className="w-full rounded border p-1.5 bg-background text-xs"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* FAQS BLOCK */}
              {config.blocks[editingBlockIndex].type === "faqs" && (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="font-semibold text-muted-foreground">Título de FAQs</label>
                    <input
                      type="text"
                      value={config.blocks[editingBlockIndex].title || ""}
                      onChange={(e) => updateBlockValue(editingBlockIndex, "title", e.target.value)}
                      className="w-full rounded border p-2 bg-background text-xs"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="font-bold text-xs block text-muted-foreground">Preguntas y Respuestas</label>
                    {config.blocks[editingBlockIndex].items?.map((faq: any, faqIdx: number) => (
                      <div key={faqIdx} className="p-3 border rounded-xl space-y-2 bg-muted/10">
                        <div className="space-y-1">
                          <label className="text-[10px] font-semibold text-muted-foreground">Pregunta</label>
                          <input
                            type="text"
                            value={faq.question || ""}
                            onChange={(e) => updateNestedBlockValue(editingBlockIndex, "items", faqIdx, "question", e.target.value)}
                            className="w-full rounded border p-1.5 bg-background text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-semibold text-muted-foreground">Respuesta</label>
                          <textarea
                            value={faq.answer || ""}
                            onChange={(e) => updateNestedBlockValue(editingBlockIndex, "items", faqIdx, "answer", e.target.value)}
                            rows={2}
                            className="w-full rounded border p-1.5 bg-background text-xs"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* REVIEWS BLOCK */}
              {config.blocks[editingBlockIndex].type === "reviews" && (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="font-semibold text-muted-foreground">Título de Reseñas</label>
                    <input
                      type="text"
                      value={config.blocks[editingBlockIndex].title || ""}
                      onChange={(e) => updateBlockValue(editingBlockIndex, "title", e.target.value)}
                      className="w-full rounded border p-2 bg-background text-xs"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="font-bold text-xs block text-muted-foreground">Reseñas de Clientes</label>
                    {config.blocks[editingBlockIndex].items?.map((review: any, reviewIdx: number) => (
                      <div key={reviewIdx} className="p-3 border rounded-xl space-y-2 bg-muted/10">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-[10px] font-semibold text-muted-foreground">Autor</label>
                            <input
                              type="text"
                              value={review.author || ""}
                              onChange={(e) => updateNestedBlockValue(editingBlockIndex, "items", reviewIdx, "author", e.target.value)}
                              className="w-full rounded border p-1.5 bg-background text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-semibold text-muted-foreground">Fecha</label>
                            <input
                              type="text"
                              value={review.date || ""}
                              onChange={(e) => updateNestedBlockValue(editingBlockIndex, "items", reviewIdx, "date", e.target.value)}
                              className="w-full rounded border p-1.5 bg-background text-xs"
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-semibold text-muted-foreground">Comentario</label>
                          <textarea
                            value={review.comment || ""}
                            onChange={(e) => updateNestedBlockValue(editingBlockIndex, "items", reviewIdx, "comment", e.target.value)}
                            rows={2}
                            className="w-full rounded border p-1.5 bg-background text-xs"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t bg-muted/10 flex justify-end">
              <button
                onClick={() => setIsBlockModalOpen(false)}
                className="rounded-lg bg-primary text-primary-foreground px-4 py-2 hover:brightness-105 font-semibold text-xs"
              >
                Listo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DISEÑO Y COLORES */}
      {isThemeModalOpen && config && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 text-left">
          <div className="bg-card border rounded-2xl w-full max-w-md max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-fade-in text-xs text-foreground">
            <div className="px-6 py-4 border-b flex items-center justify-between bg-muted/10">
              <h3 className="font-bold text-sm">Diseño y Colores del Tema</h3>
              <button 
                onClick={() => setIsThemeModalOpen(false)}
                className="text-muted-foreground hover:text-foreground text-xs font-bold"
              >
                Cerrar
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <label className="font-semibold text-muted-foreground text-[10px]">Color Principal</label>
                  <div className="flex gap-1.5 items-center">
                    <input
                      type="color"
                      value={config.theme.primaryColor}
                      onChange={(e) => updateThemeValue("primaryColor", e.target.value)}
                      className="h-8 w-8 rounded border p-0 cursor-pointer bg-transparent"
                    />
                    <span className="font-mono text-[9px] uppercase">{config.theme.primaryColor}</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-muted-foreground text-[10px]">Color Secundario</label>
                  <div className="flex gap-1.5 items-center">
                    <input
                      type="color"
                      value={config.theme.secondaryColor}
                      onChange={(e) => updateThemeValue("secondaryColor", e.target.value)}
                      className="h-8 w-8 rounded border p-0 cursor-pointer bg-transparent"
                    />
                    <span className="font-mono text-[9px] uppercase">{config.theme.secondaryColor}</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-muted-foreground text-[10px]">Color Acento</label>
                  <div className="flex gap-1.5 items-center">
                    <input
                      type="color"
                      value={config.theme.accentColor}
                      onChange={(e) => updateThemeValue("accentColor", e.target.value)}
                      className="h-8 w-8 rounded border p-0 cursor-pointer bg-transparent"
                    />
                    <span className="font-mono text-[9px] uppercase">{config.theme.accentColor}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-muted-foreground">Fuente Tipográfica</label>
                <select
                  value={config.theme.fontFamily}
                  onChange={(e) => updateThemeValue("fontFamily", e.target.value)}
                  className="w-full rounded border p-2 bg-background text-xs"
                >
                  <option value="Outfit">Outfit (Moderna/Sleek)</option>
                  <option value="Inter">Inter (Limpia/Neutral)</option>
                  <option value="sans-serif">System Sans (Clásica)</option>
                </select>
              </div>
            </div>

            <div className="px-6 py-4 border-t bg-muted/10 flex justify-end">
              <button
                onClick={() => setIsThemeModalOpen(false)}
                className="rounded-lg bg-primary text-primary-foreground px-4 py-2 hover:brightness-105 font-semibold text-xs"
              >
                Aplicar Estilo
              </button>
            </div>
          </div>
        </div>
      )}
      {/* MODAL: AGREGAR SECCIÓN */}
      {isAddSectionOpen && config && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 text-left">
          <div className="bg-card border rounded-2xl w-full max-w-sm max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-fade-in text-xs text-foreground">
            <div className="px-6 py-4 border-b flex items-center justify-between bg-muted/10">
              <h3 className="font-bold text-sm">Agregar Nueva Sección</h3>
              <button 
                onClick={() => setIsAddSectionOpen(false)}
                className="text-muted-foreground hover:text-foreground text-xs font-bold"
              >
                Cancelar
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-2">
              {[
                { type: "hero", label: "Banner Principal (Hero)", desc: "Título, subtítulo, imagen y precio de oferta." },
                { type: "features", label: "Características y Beneficios", desc: "Listado de ventajas clave con imágenes." },
                { type: "packs", label: "Packs de Ofertas", desc: "Selección de ofertas con descuentos." },
                { type: "faqs", label: "Preguntas Frecuentes", desc: "Acordeones de dudas comunes." },
                { type: "reviews", label: "Opiniones de Clientes", desc: "Reseñas reales con estrellitas." }
              ].map((sec) => (
                <button
                  key={sec.type}
                  onClick={() => {
                    addNewSection(sec.type);
                    setIsAddSectionOpen(false);
                  }}
                  className="w-full text-left p-3.5 border rounded-xl hover:border-primary hover:bg-primary/[0.02] transition space-y-1 group"
                >
                  <div className="font-bold text-xs text-foreground group-hover:text-primary transition">{sec.label}</div>
                  <div className="text-[10px] text-muted-foreground">{sec.desc}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function LandingEditorPage() {
  return (
    <Suspense fallback={
      <div className="flex-1 flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <IconLoader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Cargando editor de landing page...</p>
      </div>
    }>
      <LandingEditorContent />
    </Suspense>
  );
}
