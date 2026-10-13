"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, PDFDocumentLoadingTask, RenderTask } from "pdfjs-dist";
import { ChevronLeft, ChevronRight, FileText, LoaderCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

export function PdfPreview({ id, name, thumbnail = false }: { id: string; name: string; thumbnail?: boolean }) {
  const { t } = useTranslation();
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [width, setWidth] = useState(0);
  const [rendered, setRendered] = useState(false);
  const [error, setError] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new ResizeObserver(entries => setWidth(entries[0].contentRect.width));
    observer.observe(element);
    setWidth(element.clientWidth);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    let active = true;
    let loadingTask: PDFDocumentLoadingTask | undefined;
    setDocument(null); setPageNumber(1); setError(false); setRendered(false);
    void (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        if (!active) return;
        pdfjs.GlobalWorkerOptions.workerSrc = `/pdf.worker.min.mjs?v=${pdfjs.version}`;
        loadingTask = pdfjs.getDocument({ url: `/api/resume-documents/${id}`, withCredentials: true });
        const pdf = await loadingTask.promise;
        if (active) setDocument(pdf);
      } catch { if (active) setError(true); }
    })();
    return () => { active = false; void loadingTask?.destroy(); };
  }, [id]);
  useEffect(() => {
    if (!document || !width || !canvas.current) return;
    let active = true;
    let task: RenderTask | undefined;
    setRendered(false);
    void (async () => {
      try {
        const page = await document.getPage(pageNumber);
        if (!active || !canvas.current) return;
        const natural = page.getViewport({ scale: 1 });
        const scale = thumbnail ? Math.min(width / natural.width, 224 / natural.height) : Math.min(width, 794) / natural.width;
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        const viewport = page.getViewport({ scale: scale * pixelRatio });
        const element = canvas.current;
        element.width = Math.ceil(viewport.width); element.height = Math.ceil(viewport.height);
        element.style.width = `${viewport.width / pixelRatio}px`; element.style.height = `${viewport.height / pixelRatio}px`;
        task = page.render({ canvas: element, canvasContext: element.getContext("2d")!, viewport });
        await task.promise;
        if (active) setRendered(true);
      } catch { if (active) setError(true); }
    })();
    return () => { active = false; task?.cancel(); };
  }, [document, pageNumber, width, thumbnail]);
  return <div className={thumbnail ? "h-full w-full" : "space-y-3"}>
    {!thumbnail && document && document.numPages > 1 && <div className="flex items-center justify-center gap-3"><Button variant="outline" size="icon" aria-label={t("documents.previousPage")} disabled={pageNumber === 1} onClick={() => setPageNumber(pageNumber - 1)}><ChevronLeft /></Button><span className="text-xs text-muted-foreground">{pageNumber} / {document.numPages}</span><Button variant="outline" size="icon" aria-label={t("documents.nextPage")} disabled={pageNumber === document.numPages} onClick={() => setPageNumber(pageNumber + 1)}><ChevronRight /></Button></div>}
    <div ref={container} className={thumbnail ? "relative flex h-full w-full justify-center overflow-hidden bg-white" : "relative h-[62dvh] w-full overflow-auto rounded-lg border bg-muted p-2"}>
      {!error && !rendered && <div role={thumbnail ? undefined : "status"} className="absolute inset-0 flex items-center justify-center text-primary"><LoaderCircle className="size-5 animate-spin" /><span className="sr-only">{t("shell.loading")}</span></div>}
      {error ? <div className="flex h-full flex-col items-center justify-center gap-3 p-4 text-center text-muted-foreground"><FileText className="size-7" />{!thumbnail && <p className="text-sm">{t("documents.previewHint")}</p>}</div> : <canvas ref={canvas} aria-label={name} role="img" data-rendered={rendered} className={`mx-auto block bg-white ${rendered ? "" : "invisible"}`} />}
    </div>
  </div>;
}
