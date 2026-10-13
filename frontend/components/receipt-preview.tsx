"use client";

import { IconExternalLink, IconFileTypePdf, IconPhotoOff } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const isPdf = (u: string) => /\.pdf($|\?)/i.test(u);

/** Small picture of a receipt (or a PDF badge) that opens the big view. */
export function ReceiptThumb({ url, onOpen, size = 40 }: { url: string | null | undefined; onOpen: (url: string) => void; size?: number }) {
  if (!url) {
    return (
      <span className="flex shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground/60" style={{ width: size, height: size }} title="Sin foto">
        <IconPhotoOff size={Math.max(14, size * 0.4)} />
      </span>
    );
  }
  return (
    <button type="button" onClick={(e) => { e.stopPropagation(); onOpen(url); }} className="shrink-0 overflow-hidden rounded-md ring-1 ring-black/5 transition hover:ring-2 hover:ring-primary" style={{ width: size, height: size }} title="Ver la foto">
      {isPdf(url) ? <span className="flex size-full items-center justify-center bg-muted"><IconFileTypePdf size={Math.max(14, size * 0.45)} /></span> : <img src={url} alt="Recibo" loading="lazy" className="size-full object-cover" />}
    </button>
  );
}

/** The receipt in big, with a link to the original file. */
export function ReceiptPreview({ url, onClose, title = "Factura o recibo" }: { url: string | null; onClose: () => void; title?: string }) {
  return (
    <Dialog open={!!url} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Guardado en el almacenamiento de Syncro.</DialogDescription>
        </DialogHeader>
        {url && (isPdf(url) ? (
          <div className="flex flex-col items-center gap-3 rounded-xl bg-muted py-12">
            <IconFileTypePdf size={40} />
            <p className="text-sm text-muted-foreground">Es un PDF: ábrelo para verlo completo.</p>
          </div>
        ) : (
          <div className="flex max-h-[70vh] justify-center overflow-auto rounded-xl bg-muted/50">
            <img src={url} alt="Recibo" className="max-h-[70vh] w-auto object-contain" />
          </div>
        ))}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cerrar</Button>
          {url && <Button asChild className="gap-2"><a href={url} target="_blank" rel="noreferrer"><IconExternalLink size={15} /> Abrir original</a></Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
