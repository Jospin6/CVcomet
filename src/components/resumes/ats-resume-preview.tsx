"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";

import { EditableResumeCanvas } from "./editable-resume-canvas";
import {
  A4_HEIGHT,
  normalizeEditorResume,
  resumePaperDimensions,
  type ResumePage,
} from "@/lib/resume-editor";
import { resumeEditorCopy } from "@/lib/resume-editor-copy";

import "./resume-editor.css";
import "@/components/templates/template-preview.css";

export type AtsResumeRecord = {
  id: string;
  title: string;
  design?: { documentName?: string } | null;
} & Record<string, unknown>;

const noop = () => {};

/**
 * Renders the user's actual editable CV with the same document canvas used
 * by Templates and the resume editor. No sample/template content is inserted.
 */
export function AtsResumePreview({
  record,
  large = false,
  language = "en",
}: {
  record: AtsResumeRecord;
  large?: boolean;
  language?: "en" | "fr";
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const documentRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(180);
  const [height, setHeight] = useState(A4_HEIGHT);
  const [pages, setPages] = useState<ResumePage[]>([]);
  const [zoom, setZoom] = useState<number | null>(null);

  const resume = useMemo(() => {
    try {
      return normalizeEditorResume(record);
    } catch {
      return null;
    }
  }, [record]);

  const copy = resumeEditorCopy[language];

  useLayoutEffect(() => {
    if (!resume) return;

    const viewport = viewportRef.current;
    const document = documentRef.current;
    if (!viewport || !document) return;

    const measure = () => {
      setWidth(viewport.clientWidth);
      setHeight(document.offsetHeight);
    };

    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    observer.observe(document);
    measure();

    return () => observer.disconnect();
  }, [resume]);

  if (!resume) {
    return (
      <div className="flex h-full min-h-40 items-center justify-center bg-muted p-4 text-center text-xs text-muted-foreground">
        {language === "fr"
          ? "Aperçu indisponible pour ce CV. Ouvrez-le dans l’éditeur."
          : "This resume cannot be previewed. Open it in the editor."}
      </div>
    );
  }

  const paper = resumePaperDimensions(resume.design.paper);
  const fitScale = Math.min(1, width / paper.width);
  const scale = large && zoom !== null ? zoom : fitScale;

  return (
    <div
      className={`template-document-preview ${large ? "is-large" : "is-thumbnail"}`}
      aria-hidden={large ? undefined : true}
    >
      {large && (
        <div className="template-preview-toolbar">
          <span className="truncate">
            {resume.design.documentName || resume.title || "Resume"}
          </span>
          <div className="template-preview-zoom">
            <button
              type="button"
              aria-label="Zoom out"
              disabled={scale <= 0.25}
              onClick={() => setZoom(Math.max(0.25, scale - 0.15))}
            >
              <Minus size={15} />
            </button>
            <span aria-live="polite">{Math.round(scale * 100)}%</span>
            <button
              type="button"
              aria-label="Zoom in"
              disabled={scale >= 1.5}
              onClick={() => setZoom(Math.min(1.5, scale + 0.15))}
            >
              <Plus size={15} />
            </button>
            <button type="button" onClick={() => setZoom(1)}>
              100%
            </button>
            <button type="button" onClick={() => setZoom(null)}>
              Fit
            </button>
          </div>
        </div>
      )}

      <div
        ref={viewportRef}
        className="template-preview-viewport"
        style={{ maxHeight: large ? "68dvh" : 210 }}
        tabIndex={large ? 0 : undefined}
        aria-label={large ? "Resume preview — scroll to see all pages" : undefined}
      >
        <div
          className="template-preview-sizer"
          style={{
            width: paper.width * scale,
            height: (large ? height : paper.height) * scale,
          }}
        >
          <div
            ref={documentRef}
            className="template-preview-document"
            style={{ width: paper.width, transform: `scale(${scale})` }}
          >
            <EditableResumeCanvas
              resume={resume}
              pages={pages}
              copy={copy}
              selected=""
              preview
              onField={noop}
              onSelect={noop}
              onAdd={noop}
              onRemove={noop}
              onDuplicate={noop}
              onMove={noop}
              onAI={noop}
              onPages={setPages}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
