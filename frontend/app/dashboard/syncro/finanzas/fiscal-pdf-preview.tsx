"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function FiscalPdfPreview({ url }: { url: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [document, setDocument] = useState<PDFDocumentProxy>();
  const [page, setPage] = useState(1);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let loading: { destroy: () => Promise<void> } | undefined;
    setDocument(undefined);
    setPage(1);
    setError(false);

    async function open() {
      const pdf = await import("pdfjs-dist");
      if (cancelled) return;
      pdf.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
      const task = pdf.getDocument({ url, isEvalSupported: false, enableXfa: false, maxImageSize: 10_000_000 });
      loading = task;
      const result = await task.promise;
      if (!cancelled) setDocument(result);
    }

    void open().catch(() => { if (!cancelled) setError(true); });
    return () => {
      cancelled = true;
      void loading?.destroy().catch(() => {});
    };
  }, [url]);

  useEffect(() => {
    if (!document) return;
    let cancelled = false;
    let render: { cancel: () => void } | undefined;

    async function draw(pdf: PDFDocumentProxy) {
      const pdfPage = await pdf.getPage(page);
      const target = canvas.current;
      if (!target || cancelled) return;
      const original = pdfPage.getViewport({ scale: 1 });
      const viewport = pdfPage.getViewport({ scale: Math.min(1100 / original.width, 1400 / original.height) });
      target.width = Math.ceil(viewport.width);
      target.height = Math.ceil(viewport.height);
      const task = pdfPage.render({ canvas: target, viewport });
      render = task;
      await task.promise;
    }

    void draw(document).catch(() => { if (!cancelled) setError(true); });
    return () => {
      cancelled = true;
      render?.cancel();
    };
  }, [document, page]);

  if (error) return <p role="alert" className="text-sm text-muted-foreground">No se pudo mostrar la vista previa. Puedes descargar el archivo.</p>;
  if (!document) return <Skeleton className="h-52" aria-label="Cargando PDF" />;

  return <div className="space-y-2">
    <div className="max-h-[50dvh] overflow-y-auto rounded-lg border bg-muted">
      <canvas ref={canvas} aria-label={`Vista previa de la página ${page}`} className="block h-auto w-full" />
    </div>
    {document.numPages > 1 && <div className="flex items-center justify-between gap-2 text-sm">
      <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(value => value - 1)}>Anterior</Button>
      <span>{page} / {document.numPages}</span>
      <Button type="button" variant="outline" size="sm" disabled={page >= document.numPages} onClick={() => setPage(value => value + 1)}>Siguiente</Button>
    </div>}
  </div>;
}
