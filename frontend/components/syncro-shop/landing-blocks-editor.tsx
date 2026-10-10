"use client";

import { useRef, useState } from "react";
import {
  IconArrowDown, IconArrowUp, IconChecklist, IconChevronDown, IconHelpCircle, IconLayoutColumns,
  IconMessage2Star, IconPhoto, IconPlus, IconSpeakerphone, IconTextCaption, IconTrash, IconUpload,
  IconVideo, IconArrowsLeftRight, IconLayoutNavbar, IconListNumbers, IconShieldCheck,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/**
 * Same shape the storefront renders (syncro-shop/src/lib/landing-blocks.ts).
 * Keep both definitions in sync.
 */
export type LandingBlock =
  | { id: string; type: "image"; url: string; caption?: string }
  | { id: string; type: "video"; url: string; caption?: string }
  | { id: string; type: "text"; title?: string; body: string }
  | { id: string; type: "imageText"; url: string; title?: string; body: string; imageSide?: "left" | "right" }
  | { id: string; type: "benefits"; title?: string; items: { title: string; text?: string }[] }
  | { id: string; type: "beforeAfter"; before: string; after: string; caption?: string }
  | { id: string; type: "faq"; title?: string; items: { question: string; answer: string }[] }
  | { id: string; type: "testimonials"; title?: string; items: { name: string; text: string; rating?: number }[] }
  | { id: string; type: "cta"; title: string; text?: string; buttonLabel?: string }
  | { id: string; type: "hero"; url: string; title: string; text?: string; buttonLabel?: string }
  | { id: string; type: "steps"; title?: string; items: { title: string; text?: string; url?: string }[] }
  | { id: string; type: "trust"; items: { icon: TrustIcon; title: string; text?: string }[] };
type TrustIcon = "cash" | "truck" | "shield" | "return" | "star" | "clock";
const TRUST_ICONS: [TrustIcon, string][] = [["cash", "💵 Pago"], ["truck", "🚚 Envío"], ["shield", "🛡️ Garantía"], ["return", "↩️ Cambios"], ["star", "⭐ Calidad"], ["clock", "⏱️ Rapidez"]];

type BlockType = LandingBlock["type"];

const MAX_BLOCKS = 30;

const BLOCK_TYPES: { type: BlockType; label: string; hint: string; icon: typeof IconPhoto }[] = [
  { type: "hero", label: "Portada (hero)", hint: "Imagen grande con titular y botón de compra", icon: IconLayoutNavbar },
  { type: "steps", label: "Paso a paso / cómo se usa", hint: "Pasos numerados, cada uno con imagen o gif", icon: IconListNumbers },
  { type: "trust", label: "Sellos de confianza", hint: "Pago al recibir, garantía, envío, cambios", icon: IconShieldCheck },
  { type: "image", label: "Imagen", hint: "Foto grande del producto o de su uso", icon: IconPhoto },
  { type: "video", label: "Video o gif", hint: "Muestra cómo se usa (YouTube, MP4 o gif)", icon: IconVideo },
  { type: "text", label: "Texto", hint: "Un párrafo con título", icon: IconTextCaption },
  { type: "imageText", label: "Imagen + texto", hint: "Imagen a un lado y explicación al otro", icon: IconLayoutColumns },
  { type: "benefits", label: "Beneficios", hint: "Lista de ventajas del producto", icon: IconChecklist },
  { type: "beforeAfter", label: "Antes y después", hint: "Dos imágenes para comparar", icon: IconArrowsLeftRight },
  { type: "faq", label: "Preguntas frecuentes", hint: "Resuelve dudas antes de comprar", icon: IconHelpCircle },
  { type: "testimonials", label: "Testimonios", hint: "Opiniones de clientes", icon: IconMessage2Star },
  { type: "cta", label: "Botón de compra", hint: "Llamado a la acción destacado", icon: IconSpeakerphone },
];

function newBlock(type: BlockType): LandingBlock {
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now());
  switch (type) {
    case "image": return { id, type, url: "" };
    case "video": return { id, type, url: "" };
    case "text": return { id, type, title: "", body: "" };
    case "imageText": return { id, type, url: "", title: "", body: "", imageSide: "left" };
    case "benefits": return { id, type, title: "¿Por qué elegirlo?", items: [{ title: "" }] };
    case "beforeAfter": return { id, type, before: "", after: "" };
    case "faq": return { id, type, title: "Preguntas frecuentes", items: [{ question: "", answer: "" }] };
    case "testimonials": return { id, type, title: "Lo que dicen nuestros clientes", items: [{ name: "", text: "", rating: 5 }] };
    case "cta": return { id, type, title: "", text: "", buttonLabel: "Lo quiero" };
    case "hero": return { id, type, url: "", title: "", text: "", buttonLabel: "Comprar ahora" };
    case "steps": return { id, type, title: "Así de fácil se usa", items: [{ title: "", text: "", url: "" }] };
    case "trust": return {
      id, type, items: [
        { icon: "cash", title: "Pagas al recibir", text: "Sin tarjeta ni registro" },
        { icon: "truck", title: "Envío rápido", text: "Delivery el mismo día" },
        { icon: "shield", title: "Garantía", text: "Producto original" },
        { icon: "return", title: "Cambios fáciles", text: "Dentro de 7 días" },
      ],
    };
  }
}

function summary(block: LandingBlock): string {
  switch (block.type) {
    case "text": return block.title || block.body.slice(0, 60);
    case "imageText": return block.title || block.body.slice(0, 60);
    case "benefits":
    case "faq":
    case "testimonials": return `${block.title || ""} · ${block.items.length} elemento(s)`;
    case "cta":
    case "hero": return block.title;
    case "steps": return `${block.title || ""} · ${block.items.length} paso(s)`;
    case "trust": return block.items.map((i) => i.title).join(" · ");
    case "image":
    case "video":
    case "beforeAfter": return "caption" in block && block.caption ? block.caption : "";
  }
}

const fieldClass = "h-9 text-xs bg-muted/20 border-transparent focus:border-primary/20 focus:bg-background";
const areaClass = "w-full rounded-md px-3 py-2 text-xs bg-muted/20 border border-transparent focus:border-primary/20 focus:bg-background outline-none resize-y";

type LandingBlocksEditorProps = {
  value: LandingBlock[];
  onChange: (blocks: LandingBlock[]) => void;
  /** Uploads a file and returns its public URL. */
  upload: (file: File) => Promise<string>;
  /** Public product page, to preview after saving. */
  previewUrl?: string;
};

export function LandingBlocksEditor({ value, onChange, upload, previewUrl }: LandingBlocksEditorProps) {
  const [openId, setOpenId] = useState<string | null>(null);

  const update = (id: string, patch: Partial<LandingBlock>) =>
    onChange(value.map((b) => (b.id === id ? ({ ...b, ...patch } as LandingBlock) : b)));
  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };
  const add = (type: BlockType) => {
    if (value.length >= MAX_BLOCKS) return toast.error(`Máximo ${MAX_BLOCKS} bloques`);
    const block = newBlock(type);
    onChange([...value, block]);
    setOpenId(block.id);
  };

  return (
    <div className="space-y-3">
      {value.length === 0 && (
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Convierte la ficha del producto en una página de venta: agrega imágenes, gifs o videos de uso, beneficios,
          Preguntas frecuentes y testimonios. Se muestran debajo de la descripción en Syncro Shop, en el orden que elijas.
        </p>
      )}

      {value.map((block, index) => {
        const meta = BLOCK_TYPES.find((t) => t.type === block.type)!;
        const Icon = meta.icon;
        const open = openId === block.id;
        return (
          <div key={block.id} className="rounded-xl border bg-background">
            <div className="flex items-center gap-2 p-2.5">
              <button type="button" onClick={() => setOpenId(open ? null : block.id)} className="flex flex-1 items-center gap-2.5 text-left min-w-0">
                <span className="size-8 shrink-0 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><Icon size={16} /></span>
                <span className="min-w-0">
                  <span className="block text-xs font-bold">{meta.label}</span>
                  <span className="block text-[10px] text-muted-foreground truncate">{summary(block) || "Sin completar"}</span>
                </span>
                <IconChevronDown size={14} className={cn("ml-auto shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
              </button>
              <Button type="button" variant="ghost" size="icon" className="size-7" disabled={index === 0} onClick={() => move(index, -1)} title="Subir"><IconArrowUp size={13} /></Button>
              <Button type="button" variant="ghost" size="icon" className="size-7" disabled={index === value.length - 1} onClick={() => move(index, 1)} title="Bajar"><IconArrowDown size={13} /></Button>
              <Button type="button" variant="ghost" size="icon" className="size-7 text-rose-500" onClick={() => onChange(value.filter((b) => b.id !== block.id))} title="Eliminar bloque"><IconTrash size={13} /></Button>
            </div>
            {open && (
              <div className="border-t p-3 space-y-3">
                <BlockFields block={block} onChange={(patch) => update(block.id, patch)} upload={upload} />
              </div>
            )}
          </div>
        );
      })}

      <div className="flex items-center gap-2 flex-wrap">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs font-semibold border-primary/20 hover:bg-primary/5" disabled={value.length >= MAX_BLOCKS}>
              <IconPlus size={14} /> Agregar bloque
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-72">
            {BLOCK_TYPES.map(({ type, label, hint, icon: Icon }) => (
              <DropdownMenuItem key={type} onClick={() => add(type)} className="gap-2.5 py-2">
                <Icon size={16} className="text-primary shrink-0" />
                <span>
                  <span className="block text-xs font-semibold">{label}</span>
                  <span className="block text-[10px] text-muted-foreground">{hint}</span>
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        {previewUrl && (
          <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] font-semibold text-primary hover:underline">
            Ver la ficha en Syncro Shop
          </a>
        )}
        <span className="ml-auto text-[10px] text-muted-foreground">{value.length} / {MAX_BLOCKS}</span>
      </div>
    </div>
  );
}

function MediaField({ label, url, onChange, upload, accept = "image/*" }: {
  label: string; url: string; onChange: (url: string) => void; upload: (file: File) => Promise<string>; accept?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const isVideo = /\.(mp4|webm|mov)(\?|$)/i.test(url);
  const isEmbed = /youtube\.com|youtu\.be|vimeo\.com/i.test(url);

  const handleFile = async (file?: File) => {
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) return toast.error("El archivo pesa más de 25 mb");
    setUploading(true);
    try {
      onChange(await upload(file));
    } catch {
      toast.error("No se pudo subir el archivo");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-semibold text-muted-foreground">{label}</label>
      <div className="flex gap-2">
        <Input value={url} onChange={(e) => onChange(e.target.value)} placeholder="Pega un enlace o sube un archivo" className={cn(fieldClass, "flex-1")} />
        <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
        <Button type="button" variant="outline" size="sm" className="h-9 gap-1.5 text-xs shrink-0" disabled={uploading} onClick={() => inputRef.current?.click()}>
          <IconUpload size={13} /> {uploading ? "Subiendo..." : "Subir"}
        </Button>
      </div>
      {url && !isEmbed && (
        isVideo
          ? <video src={url} muted loop playsInline autoPlay className="max-h-32 rounded-lg border" />
          : <img src={url} alt="" className="max-h-32 rounded-lg border object-contain" />
      )}
      {url && isEmbed && <p className="text-[10px] text-emerald-600">Video enlazado. Se verá integrado en la ficha.</p>}
    </div>
  );
}

function BlockFields({ block, onChange, upload }: { block: LandingBlock; onChange: (patch: any) => void; upload: (file: File) => Promise<string> }) {
  switch (block.type) {
    case "image":
      return (
        <>
          <MediaField label="Imagen" url={block.url} onChange={(url) => onChange({ url })} upload={upload} accept="image/*" />
          <Input value={block.caption || ""} onChange={(e) => onChange({ caption: e.target.value })} placeholder="Texto debajo de la imagen (opcional)" className={fieldClass} />
        </>
      );
    case "video":
      return (
        <>
          <MediaField label="Video (YouTube, vimeo, MP4) o gif" url={block.url} onChange={(url) => onChange({ url })} upload={upload} accept="image/gif,video/mp4,video/webm" />
          <Input value={block.caption || ""} onChange={(e) => onChange({ caption: e.target.value })} placeholder="Texto debajo del video (opcional)" className={fieldClass} />
        </>
      );
    case "text":
      return (
        <>
          <Input value={block.title || ""} onChange={(e) => onChange({ title: e.target.value })} placeholder="Título (opcional)" className={cn(fieldClass, "font-semibold")} />
          <textarea value={block.body} onChange={(e) => onChange({ body: e.target.value })} placeholder="Escribe el texto" rows={4} className={areaClass} />
        </>
      );
    case "imageText":
      return (
        <>
          <MediaField label="Imagen, gif o video" url={block.url} onChange={(url) => onChange({ url })} upload={upload} accept="image/*,video/mp4,video/webm" />
          <Input value={block.title || ""} onChange={(e) => onChange({ title: e.target.value })} placeholder="Título" className={cn(fieldClass, "font-semibold")} />
          <textarea value={block.body} onChange={(e) => onChange({ body: e.target.value })} placeholder="Explicación" rows={3} className={areaClass} />
          <div className="flex items-center gap-2 text-[11px]">
            <span className="text-muted-foreground font-semibold">Imagen a la</span>
            {(["left", "right"] as const).map((side) => (
              <button key={side} type="button" onClick={() => onChange({ imageSide: side })} className={cn("h-7 px-3 rounded-md border font-semibold", (block.imageSide || "left") === side ? "bg-primary text-primary-foreground border-primary" : "text-muted-foreground")}>
                {side === "left" ? "Izquierda" : "Derecha"}
              </button>
            ))}
          </div>
        </>
      );
    case "beforeAfter":
      return (
        <>
          <div className="grid grid-cols-2 gap-3">
            <MediaField label="Antes" url={block.before} onChange={(before) => onChange({ before })} upload={upload} />
            <MediaField label="Después" url={block.after} onChange={(after) => onChange({ after })} upload={upload} />
          </div>
          <Input value={block.caption || ""} onChange={(e) => onChange({ caption: e.target.value })} placeholder="Descripción (opcional)" className={fieldClass} />
        </>
      );
    case "cta":
      return (
        <>
          <Input value={block.title} onChange={(e) => onChange({ title: e.target.value })} placeholder="Título, ej: ¡Últimas unidades con envío gratis!" className={cn(fieldClass, "font-semibold")} />
          <Input value={block.text || ""} onChange={(e) => onChange({ text: e.target.value })} placeholder="Texto de apoyo (opcional)" className={fieldClass} />
          <Input value={block.buttonLabel || ""} onChange={(e) => onChange({ buttonLabel: e.target.value })} placeholder="Texto del botón" className={fieldClass} />
        </>
      );
    case "hero":
      return (
        <>
          <MediaField label="Imagen de fondo" url={block.url} onChange={(url) => onChange({ url })} upload={upload} accept="image/*" />
          <Input value={block.title} onChange={(e) => onChange({ title: e.target.value })} placeholder="Titular grande, ej: la licuadora que tritura todo en segundos" className={cn(fieldClass, "font-semibold")} />
          <Input value={block.text || ""} onChange={(e) => onChange({ text: e.target.value })} placeholder="Subtítulo (opcional)" className={fieldClass} />
          <Input value={block.buttonLabel || ""} onChange={(e) => onChange({ buttonLabel: e.target.value })} placeholder="Texto del botón" className={fieldClass} />
        </>
      );
    case "steps":
      return (
        <ListFields
          title={block.title}
          onTitle={(title) => onChange({ title })}
          items={block.items}
          onItems={(items) => onChange({ items })}
          empty={{ title: "", text: "", url: "" }}
          addLabel="Agregar paso"
          render={(item, set) => (
            <>
              <Input value={item.title} onChange={(e) => set({ ...item, title: e.target.value })} placeholder="Paso, ej: agrega los ingredientes" className={cn(fieldClass, "font-semibold")} />
              <Input value={item.text || ""} onChange={(e) => set({ ...item, text: e.target.value })} placeholder="Detalle (opcional)" className={fieldClass} />
              <MediaField label="Imagen o gif del paso" url={item.url || ""} onChange={(url) => set({ ...item, url })} upload={upload} accept="image/*,video/mp4,video/webm" />
            </>
          )}
        />
      );
    case "trust":
      return (
        <ListFields
          onTitle={() => {}}
          hideTitle
          items={block.items}
          onItems={(items) => onChange({ items })}
          empty={{ icon: "shield" as TrustIcon, title: "", text: "" }}
          addLabel="Agregar sello"
          render={(item, set) => (
            <div className="flex gap-2">
              <select value={item.icon} onChange={(e) => set({ ...item, icon: e.target.value as TrustIcon })} className="h-9 rounded-md border bg-background px-2 text-xs">
                {TRUST_ICONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <Input value={item.title} onChange={(e) => set({ ...item, title: e.target.value })} placeholder="Título" className={cn(fieldClass, "font-semibold flex-1")} />
              <Input value={item.text || ""} onChange={(e) => set({ ...item, text: e.target.value })} placeholder="Detalle" className={cn(fieldClass, "flex-1")} />
            </div>
          )}
        />
      );
    case "benefits":
      return (
        <ListFields
          title={block.title}
          onTitle={(title) => onChange({ title })}
          items={block.items}
          onItems={(items) => onChange({ items })}
          empty={{ title: "", text: "" }}
          addLabel="Agregar beneficio"
          render={(item, set) => (
            <>
              <Input value={item.title} onChange={(e) => set({ ...item, title: e.target.value })} placeholder="Beneficio" className={cn(fieldClass, "font-semibold")} />
              <Input value={item.text || ""} onChange={(e) => set({ ...item, text: e.target.value })} placeholder="Detalle (opcional)" className={fieldClass} />
            </>
          )}
        />
      );
    case "faq":
      return (
        <ListFields
          title={block.title}
          onTitle={(title) => onChange({ title })}
          items={block.items}
          onItems={(items) => onChange({ items })}
          empty={{ question: "", answer: "" }}
          addLabel="Agregar pregunta"
          render={(item, set) => (
            <>
              <Input value={item.question} onChange={(e) => set({ ...item, question: e.target.value })} placeholder="Pregunta" className={cn(fieldClass, "font-semibold")} />
              <textarea value={item.answer} onChange={(e) => set({ ...item, answer: e.target.value })} placeholder="Respuesta" rows={2} className={areaClass} />
            </>
          )}
        />
      );
    case "testimonials":
      return (
        <ListFields
          title={block.title}
          onTitle={(title) => onChange({ title })}
          items={block.items}
          onItems={(items) => onChange({ items })}
          empty={{ name: "", text: "", rating: 5 }}
          addLabel="Agregar testimonio"
          render={(item, set) => (
            <>
              <div className="flex gap-2">
                <Input value={item.name} onChange={(e) => set({ ...item, name: e.target.value })} placeholder="Nombre del cliente" className={cn(fieldClass, "font-semibold flex-1")} />
                <select value={item.rating ?? 5} onChange={(e) => set({ ...item, rating: Number(e.target.value) })} className="h-9 rounded-md border bg-background px-2 text-xs">
                  {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{"★".repeat(n)}</option>)}
                </select>
              </div>
              <textarea value={item.text} onChange={(e) => set({ ...item, text: e.target.value })} placeholder="Lo que dijo" rows={2} className={areaClass} />
            </>
          )}
        />
      );
  }
}

function ListFields<T>({ title, onTitle, items, onItems, empty, addLabel, render, hideTitle }: {
  title?: string; onTitle: (title: string) => void; items: T[]; onItems: (items: T[]) => void;
  empty: T; addLabel: string; render: (item: T, set: (item: T) => void) => React.ReactNode; hideTitle?: boolean;
}) {
  return (
    <>
      {!hideTitle && <Input value={title || ""} onChange={(e) => onTitle(e.target.value)} placeholder="Título de la sección" className={cn(fieldClass, "font-semibold")} />}
      {items.map((item, i) => (
        <div key={i} className="relative rounded-lg border border-dashed p-2.5 pr-9 space-y-2">
          {render(item, (next) => onItems(items.map((it, j) => (j === i ? next : it))))}
          <button type="button" onClick={() => onItems(items.filter((_, j) => j !== i))} className="absolute right-2 top-2 text-muted-foreground hover:text-rose-500" title="Quitar">
            <IconTrash size={13} />
          </button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" className="h-7 gap-1 text-[11px]" onClick={() => onItems([...items, { ...empty }])}>
        <IconPlus size={12} /> {addLabel}
      </Button>
    </>
  );
}
