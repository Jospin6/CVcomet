"use client";

import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Minus, Plus } from "lucide-react";
import { EditableResumeCanvas } from "@/components/resumes/editable-resume-canvas";
import { A4_HEIGHT, A4_WIDTH, resumeFonts, type ResumePage } from "@/lib/resume-editor";
import { resumeEditorCopy } from "@/lib/resume-editor-copy";
import { sampleLetter, sampleResume } from "@/lib/template-samples";
import type { TemplateDefinition } from "@/lib/template-catalog";
import "@/components/resumes/resume-editor.css";
import "./template-preview.css";

const noop = () => {};

function LetterDocument({ template }: { template: TemplateDefinition }) {
  const letter = sampleLetter;
  return <article className={`template-letter-document layout-${template.layout}`} aria-label="Cover letter — John Doe" style={{
    width: A4_WIDTH, minHeight: template.paper === "LETTER" ? 1028 : A4_HEIGHT,
    fontFamily: resumeFonts[template.font], "--letter-accent": template.accent,
  } as CSSProperties}>
    <header className="template-letter-heading">
      <h2>{letter.name}</h2><p className="template-letter-role">{letter.title}</p>
      <p className="template-letter-contact">{letter.email} · {letter.phone}<br />{letter.city}</p>
    </header>
    <p className="template-letter-date">{letter.date}</p>
    <address><strong>{letter.recipient}</strong><br />{letter.recipientTitle}<br />{letter.company}<br />{letter.address}</address>
    <h3>{letter.subject}</h3>
    <p>{letter.salutation}</p>
    {letter.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
    <div className="template-letter-signoff"><p>{letter.closing}</p><p className="template-letter-signature">{letter.name}</p></div>
    <p className="template-letter-enclosure">{letter.enclosure}</p>
  </article>;
}

export function TemplatePreview({ template, large = false }: { template: TemplateDefinition; large?: boolean }) {
  const viewport = useRef<HTMLDivElement>(null), document = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(large ? A4_WIDTH : 180);
  const [height, setHeight] = useState(A4_HEIGHT);
  const [pages, setPages] = useState<ResumePage[]>([]);
  const [zoom, setZoom] = useState<number | null>(null);
  const resume = useMemo(() => sampleResume(template), [template]);
  const copy = useMemo(() => ({ ...resumeEditorCopy.en, sections: { ...resumeEditorCopy.en.sections,
    ...(template.functionalType === "ACADEMIC" ? { projects: "Selected publications", experiences: "Research & teaching" } : {}),
  } }), [template.functionalType]);
  useLayoutEffect(() => {
    const area = viewport.current, content = document.current;
    if (!area || !content) return;
    const measure = () => { setWidth(area.clientWidth); setHeight(content.offsetHeight); };
    const observer = new ResizeObserver(measure);
    observer.observe(area); observer.observe(content); measure();
    return () => observer.disconnect();
  }, []);
  const scale = large && zoom !== null ? zoom : Math.min(1, width / A4_WIDTH);
  const thumbnailHeight = template.type === "COVER_LETTER" && template.paper === "LETTER" ? 1028 : A4_HEIGHT;
  return <div className={`template-document-preview ${large ? "is-large" : "is-thumbnail"}`} aria-hidden={large ? undefined : true}>
    {large && <div className="template-preview-toolbar">
      <span>Fictional sample · John Doe</span>
      <div className="template-preview-zoom">
        <button type="button" aria-label="Zoom out" disabled={scale <= .25} onClick={() => setZoom(Math.max(.25, scale - .15))}><Minus size={15} /></button>
        <span aria-live="polite">{Math.round(scale * 100)}%</span>
        <button type="button" aria-label="Zoom in" disabled={scale >= 1.5} onClick={() => setZoom(Math.min(1.5, scale + .15))}><Plus size={15} /></button>
        <button type="button" onClick={() => setZoom(1)}>100%</button>
        <button type="button" onClick={() => setZoom(null)}>Fit</button>
      </div>
    </div>}
    <div ref={viewport} className="template-preview-viewport" tabIndex={large ? 0 : undefined} aria-label={large ? "Document preview — scroll to see all pages" : undefined}>
      <div className="template-preview-sizer" style={{ width: A4_WIDTH * scale, height: (large ? height : thumbnailHeight) * scale }}>
        <div ref={document} className="template-preview-document" style={{ width: A4_WIDTH, transform: `scale(${scale})` }}>
          {template.type === "COVER_LETTER" ? <LetterDocument template={template} /> : <EditableResumeCanvas
            resume={resume} pages={pages} copy={copy} selected="" preview
            onField={noop} onSelect={noop} onAdd={noop} onRemove={noop} onDuplicate={noop} onMove={noop} onAI={noop} onPages={setPages}
          />}
        </div>
      </div>
    </div>
  </div>;
}
