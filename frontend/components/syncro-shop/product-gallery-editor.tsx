"use client";

import { IconCamera, IconChevronLeft, IconChevronRight, IconPhotoPlus, IconSearch, IconStarFilled, IconX } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const MAX_PRODUCT_IMAGES = 5;

type ProductGalleryEditorProps = {
  images: string[];
  onChange: (images: string[]) => void;
  uploading?: boolean;
  onUploadClick: () => void;
  onSearchClick: () => void;
  onCameraClick: () => void;
};

/** Up to five product photos; the first one is the cover used everywhere. */
export function ProductGalleryEditor({ images, onChange, uploading, onUploadClick, onSearchClick, onCameraClick }: ProductGalleryEditorProps) {
  const isFull = images.length >= MAX_PRODUCT_IMAGES;

  const move = (from: number, to: number) => {
    if (to < 0 || to >= images.length) return;
    const next = [...images];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-primary">Imágenes</h3>
        <span className={cn("text-[10px] font-bold", isFull ? "text-amber-600" : "text-muted-foreground")}>
          {images.length} / {MAX_PRODUCT_IMAGES}
        </span>
      </div>

      {/* Cover */}
      <div className="relative aspect-square rounded-2xl border bg-muted/20 flex items-center justify-center overflow-hidden">
        {images[0] ? (
          <>
            <img src={images[0]} alt="Portada" className="size-full object-contain" />
            <span className="absolute top-2 left-2 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground flex items-center gap-1">
              <IconStarFilled size={9} /> Portada
            </span>
          </>
        ) : (
          <button type="button" onClick={onUploadClick} className="flex flex-col items-center gap-2 text-muted-foreground hover:text-primary transition-colors">
            <IconPhotoPlus size={28} stroke={1.4} />
            <span className="text-xs font-bold">Subir imagen</span>
            <span className="text-[10px]">Png, jpg, webp o gif</span>
          </button>
        )}
        {uploading && (
          <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
            <div className="size-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        )}
      </div>

      {/* Thumbnails */}
      <div className="grid grid-cols-5 gap-1.5">
        {Array.from({ length: MAX_PRODUCT_IMAGES }).map((_, index) => {
          const url = images[index];
          if (!url) {
            return (
              <button
                key={index}
                type="button"
                onClick={onUploadClick}
                disabled={uploading || index !== images.length}
                title="Agregar imagen"
                className="aspect-square rounded-lg border border-dashed flex items-center justify-center text-muted-foreground/60 hover:text-primary hover:border-primary/40 disabled:opacity-40 disabled:hover:text-muted-foreground/60 disabled:hover:border-border transition-colors"
              >
                <IconPhotoPlus size={14} />
              </button>
            );
          }
          return (
            <div key={url + index} className={cn("group relative aspect-square rounded-lg border overflow-hidden bg-muted/20", index === 0 && "ring-2 ring-primary/50")}>
              <img src={url} alt={`Imagen ${index + 1}`} className="size-full object-cover" />
              <div className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-0.5">
                <button
                  type="button"
                  onClick={() => onChange(images.filter((_, i) => i !== index))}
                  className="self-end size-4 rounded-full bg-white/90 text-rose-600 flex items-center justify-center"
                  title="Quitar"
                >
                  <IconX size={10} />
                </button>
                <div className="flex justify-between">
                  <button type="button" onClick={() => move(index, index - 1)} disabled={index === 0} className="size-4 rounded-full bg-white/90 text-foreground flex items-center justify-center disabled:invisible" title="Mover a la izquierda">
                    <IconChevronLeft size={10} />
                  </button>
                  <button type="button" onClick={() => move(index, index + 1)} disabled={index === images.length - 1} className="size-4 rounded-full bg-white/90 text-foreground flex items-center justify-center disabled:invisible" title="Mover a la derecha">
                    <IconChevronRight size={10} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-muted-foreground leading-relaxed">La primera imagen es la portada. Pasa el cursor sobre una miniatura para moverla o quitarla.</p>

      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" disabled={isFull} onClick={onSearchClick} className="text-xs font-bold gap-1.5 h-9 rounded-xl border-primary/20 hover:bg-primary/5 text-primary">
          <IconSearch size={14} /> Buscar
        </Button>
        <Button type="button" variant="outline" disabled={isFull} onClick={onCameraClick} className="text-xs font-bold gap-1.5 h-9 rounded-xl border-primary/20 hover:bg-primary/5 text-primary">
          <IconCamera size={14} /> Foto
        </Button>
      </div>
    </div>
  );
}
