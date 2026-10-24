"use client";
import { useLayoutEffect, useRef, type CSSProperties } from "react";
import { GripVertical, Plus, Sparkles, Trash2, Copy } from "lucide-react";
import { resumePaperDimensions, fieldValue, paginateResume, resumeBulletItems, resumeFieldHasBullets, resumeFonts, resumeUnits, isSidebarSection, tintAccent, type EditorResume, type ResumeUnit, type ResumePage, type ResumeSection } from "@/lib/resume-editor";
import type { ResumeEditorCopy } from "@/lib/resume-editor-copy";
import { sectionHeading } from "@/lib/career-localization/markets";

type Props = {
  resume: EditorResume; pages: ResumePage[]; copy: ResumeEditorCopy; selected: string; preview: boolean;
  onField: (path: string, value: string) => void; onSelect: (path: string) => void; onAdd: (section: ResumeSection) => void;
  onRemove: (section: ResumeSection, index: number) => void; onDuplicate: (section: ResumeSection, index: number) => void;
  onMove: (section: ResumeSection, target: ResumeSection) => void; onAI: (path: string) => void; onPages: (pages: ResumePage[]) => void;
};

function renderBulletList(element: HTMLDivElement, text: string, placeholder: string, preview: boolean) {
  const items = resumeBulletItems(text);
  if (preview && !items.length) { element.replaceChildren(); return; }
  const list = document.createElement("ul");
  list.className = "resume-bullet-list";
  for (const item of items.length ? items : [""]) {
    const entry = document.createElement("li");
    entry.textContent = item;
    entry.dataset.placeholder = placeholder;
    list.append(entry);
  }
  element.replaceChildren(list);
}

function EditableText({ value, label, path, placeholder, multiline = false, bullets = false, max = 8000, selected, preview, style, onField, onSelect }: {
  value: string; label: string; path: string; placeholder?: string; multiline?: boolean; bullets?: boolean; max?: number;
  selected: boolean; preview: boolean; style?: CSSProperties; onField: Props["onField"]; onSelect: Props["onSelect"];
}) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (element && document.activeElement !== element) {
      if (bullets) renderBulletList(element, value, placeholder || label, preview);
      else if (element.textContent !== value || element.querySelector("ul")) element.textContent = value;
    }
  }, [value, preview, bullets, placeholder, label]);
  return <div ref={ref} role={preview ? undefined : "textbox"} aria-label={label} aria-multiline={multiline || undefined}
    data-field={path} data-placeholder={preview ? undefined : placeholder || label} contentEditable={preview ? false : bullets ? true : "plaintext-only"}
    suppressContentEditableWarning tabIndex={preview ? undefined : 0} spellCheck={!preview}
    className={`resume-editable ${selected && !preview ? "is-selected" : ""} ${preview ? "is-preview" : ""}`}
    style={{ whiteSpace: multiline ? "pre-wrap" : "normal", ...style }}
    onFocus={() => onSelect(path)} onClick={() => { if (!preview) onSelect(path); }}
    onInput={event => {
      const element = event.currentTarget;
      const next = element.innerText.replace(/\u00a0/g, " ").slice(0, max);
      if (element.innerText.length > max) element.textContent = next;
      if (bullets && !element.querySelector("ul")) document.execCommand("insertUnorderedList");
      onField(path, bullets ? resumeBulletItems(next).join("\n") : next);
    }}
    onBlur={event => { if (bullets) renderBulletList(event.currentTarget, event.currentTarget.innerText, placeholder || label, preview); }}
    onPaste={event => {
      if (!bullets) return;
      event.preventDefault();
      document.execCommand("insertText", false, resumeBulletItems(event.clipboardData.getData("text/plain")).join("\n"));
    }}
    onKeyDown={event => {
      if (!multiline && event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); }
      if (bullets && event.key === "Enter") {
        const anchor = window.getSelection()?.anchorNode;
        const entry = (anchor?.nodeType === Node.ELEMENT_NODE ? anchor as Element : anchor?.parentElement)?.closest("li");
        if (entry && !entry.textContent?.trim()) event.preventDefault();
      }
    }} />;
}

function ResumeContent({ unit, props, measuring = false }: { unit: ResumeUnit; props: Props; measuring?: boolean }) {
  const { resume, copy: c } = props;
  const { section, index } = unit;
  const field = (key: string, label: string, extra: { bold?: boolean; multiline?: boolean; max?: number; color?: string } = {}) => {
    const path = section === "summary" ? `summary.${Math.max(index, 0)}` : `${section}.${index}.${key}`;
    const custom = resume.design.fieldStyles[path];
    return <EditableText key={path} path={path} label={label} value={index < 0 ? "" : fieldValue(resume, path)} selected={props.selected === path}
      preview={props.preview || measuring} multiline={extra.multiline} bullets={resumeFieldHasBullets(resume, path)} max={extra.max} onField={props.onField} onSelect={props.onSelect}
      style={{ fontWeight: custom?.bold !== undefined ? custom.bold ? 700 : 400 : extra.bold ? 700 : 400, fontStyle: custom?.italic ? "italic" : undefined, textDecoration: custom?.underline ? "underline" : undefined, textAlign: custom?.align, color: extra.color }} />;
  };
  if (index < 0 && section !== "summary") return props.preview || measuring ? <div style={{ height: 32 }} /> : <button type="button" className="resume-empty-entry" onClick={() => props.onAdd(section)}><Plus size={13} />{c.empty}</button>;
  const description = () => field("description", c.fields.description, { multiline: true });
  const dates = () => <div className="resume-entry-dates">{field("start", c.fields.start, { max: 80 })}{(!props.preview || fieldValue(resume, `${section}.${index}.start`) && fieldValue(resume, `${section}.${index}.end`)) && <span>–</span>}{field("end", c.fields.end, { max: 80 })}</div>;
  return <div className="resume-entry group/entry">
    {section === "summary" ? field("", c.fields.summary, { multiline: true, max: 5000 }) : null}
    {section === "experiences" && <><div className="resume-entry-top">{field("title", c.fields.title, { bold: true, max: 200 })}{dates()}</div><div className="resume-entry-meta">{field("company", c.fields.company, { max: 200 })}{field("location", c.fields.location, { max: 200 })}</div>{description()}</>}
    {section === "educations" && <><div className="resume-entry-top">{field("degree", c.fields.degree, { bold: true, max: 200 })}{dates()}</div><div className="resume-entry-meta">{field("school", c.fields.school, { max: 200 })}{field("location", c.fields.location, { max: 200 })}</div>{description()}</>}
    {section === "skills" && <div className="space-y-2">{field("hardskills", c.fields.hardskills, { multiline: true })}{field("softskills", c.fields.softskills, { multiline: true })}{field("tools", c.fields.tools, { multiline: true })}</div>}
    {section === "projects" && <>{field("title", c.fields.title, { bold: true, max: 200 })}{description()}{field("technologies", c.fields.technologies, { max: 2000 })}{field("link", c.fields.link, { max: 2048, color: resume.design.accent })}</>}
    {section === "certifications" && <>{field("title", c.sections.certifications, { bold: true, max: 200 })}{field("issuer", c.fields.issuer, { max: 200 })}{field("date", c.fields.date, { max: 80 })}{description()}</>}
    {section === "languages" && <div className="resume-entry-top">{field("language", c.fields.language, { bold: true, max: 200 })}{field("level", c.fields.level, { max: 200 })}</div>}
    {!props.preview && !measuring && index >= 0 && section !== "summary" && <div className="resume-entry-tools">
      {[{ icon: Copy, label: c.duplicate, action: () => props.onDuplicate(section, index) }, { icon: Trash2, label: c.remove, action: () => props.onRemove(section, index) }].map(({ icon: Icon, label, action }) => <button key={label} type="button" title={label} aria-label={label + " " + c.sections[section]} onClick={action}><Icon size={12} /></button>)}
    </div>}
  </div>;
}

function ResumeColumn({ units, props, measuring = false }: { units: ResumeUnit[]; props: Props; measuring?: boolean }) {
  return <>{units.map((unit, i) => <div key={unit.key} data-unit={measuring ? unit.key : undefined} className="resume-unit"
    onDragOver={event => { if (event.dataTransfer.types.includes("text/x-resume-section")) event.preventDefault(); }}
    onDrop={event => { const section = event.dataTransfer.getData("text/x-resume-section") as ResumeSection; if (section) { event.preventDefault(); props.onMove(section, unit.section); } }}>
    {(i === 0 || units[i - 1].section !== unit.section) && <div className="resume-section-heading" style={{ color: props.resume.design.accent }}>
      <span>{sectionHeading(unit.section, props.resume.design.targetMarket, props.resume.design.documentLanguage, props.copy.sections.summary === "Profil" ? "fr" : "en")}</span>
      {!props.preview && !measuring && <div className="resume-heading-tools">
        <button draggable type="button" title={props.copy.structureHint} aria-label={props.copy.sections[unit.section] + " — " + props.copy.structure}
          onDragStart={event => { event.dataTransfer.setData("text/x-resume-section", unit.section); event.dataTransfer.effectAllowed = "move"; }}><GripVertical size={12} /></button>
        {unit.section !== "languages" && <button type="button" title={props.copy.ai} aria-label={props.copy.ai + " " + props.copy.sections[unit.section]} onClick={() => props.onAI(unit.section === "summary" ? "summary.0" : `${unit.section}.${Math.max(unit.index, 0)}.${unit.section === "skills" ? "hardskills" : "description"}`)}><Sparkles size={12} /></button>}
        {unit.section !== "summary" && <button type="button" title={props.copy.add} aria-label={props.copy.add + " " + props.copy.sections[unit.section]} onClick={() => props.onAdd(unit.section)}><Plus size={12} /></button>}
      </div>}
    </div>}
    <div data-unit-body={measuring ? unit.key : undefined}><ResumeContent unit={unit} props={props} measuring={measuring} /></div>
  </div>)}</>;
}

function ResumeHeader({ props, compact = false, measuring = false }: { props: Props; compact?: boolean; measuring?: boolean }) {
  const { resume, copy: c } = props;
  const field = (path: string, label: string, style: CSSProperties = {}) => {
    const custom = resume.design.fieldStyles[path];
    return <EditableText key={path} path={path} label={label} value={fieldValue(resume, path)} selected={props.selected === path} preview={props.preview || measuring}
      max={path === "contact.name" ? 200 : path === "title" ? 160 : path === "contact.email" ? 254 : path === "contact.phone" ? 80 : path === "contact.city" ? 300 : 2048} onField={props.onField} onSelect={props.onSelect}
      style={{ ...style, ...(custom?.bold !== undefined ? { fontWeight: custom.bold ? 700 : 400 } : {}), fontStyle: custom?.italic ? "italic" : undefined, textDecoration: custom?.underline ? "underline" : undefined, textAlign: custom?.align }} />;
  };
  return <header data-resume-header={measuring && !compact ? "true" : undefined} data-compact-header={measuring && compact ? "true" : undefined} className={`resume-paper-header ${compact ? "is-compact" : ""}`}>
    {field("contact.name", c.fields.name, { fontSize: compact ? 20 : 34, fontWeight: 700, letterSpacing: "-.035em", lineHeight: 1.15 })}
    {field("title", c.fields.title, { fontSize: compact ? 12 : 16, color: resume.design.accent, marginTop: 6, letterSpacing: ".02em" })}
    {!compact && <div className="resume-contact-grid">{(["email", "phone", "city", "linkedin", "website"] as const).map(key => field("contact." + key, c.fields[key], { fontSize: 11.5, color: "#52616A" }))}</div>}
  </header>;
}

export function EditableResumeCanvas(props: Props) {
  const measure = useRef<HTMLDivElement>(null);
  const { resume, copy: c } = props;
  const { design } = resume;
  const units = resumeUnits(resume, !props.preview);
  useLayoutEffect(() => {
    const root = measure.current;
    if (!root) return;
    const heights: Record<string, number> = {};
    root.querySelectorAll<HTMLElement>("[data-unit-body]").forEach(element => { heights[element.dataset.unitBody!] = element.offsetHeight + 12; });
    props.onPages(paginateResume(resume, heights, (root.querySelector<HTMLElement>("[data-resume-header]")?.offsetHeight || 150) + 16, (root.querySelector<HTMLElement>("[data-compact-header]")?.offsetHeight || 64) + 8, !props.preview));
  }, [resume, c, props.onPages, props.preview]);
  const paperStyle: CSSProperties = { width: resumePaperDimensions(design.paper).width, minHeight: resumePaperDimensions(design.paper).height, padding: design.padding, fontFamily: resumeFonts[design.font], fontSize: design.fontSize, lineHeight: design.lineHeight, "--resume-accent": design.accent, "--resume-tint": tintAccent(design.accent) } as CSSProperties;
  const columns = (page: ResumePage, measuring = false) => <div className="resume-paper-columns">
    {design.layout === "modern" && <aside className="resume-paper-side"><ResumeColumn units={page.side} props={props} measuring={measuring} /></aside>}
    <div className="resume-paper-main"><ResumeColumn units={page.main} props={props} measuring={measuring} /></div>
  </div>;
  return <>
    <div ref={measure} className={`resume-paper resume-measure ${props.preview ? "" : "is-editing"} layout-${design.layout}`} style={paperStyle} aria-hidden="true" inert>
      <ResumeHeader props={props} measuring />{columns({ main: units.filter(unit => !isSidebarSection(unit.section, design)), side: units.filter(unit => isSidebarSection(unit.section, design)) }, true)}
      <ResumeHeader props={props} compact measuring />
    </div>
    {(props.pages.length ? props.pages : [{ main: units.filter(unit => !isSidebarSection(unit.section, design)), side: units.filter(unit => isSidebarSection(unit.section, design)) }]).map((page, index) => <article key={index} className={`resume-paper document-paper layout-${design.layout}`} style={paperStyle} aria-label={`${c.page} ${index + 1}`} data-resume-page={index + 1}>
      <ResumeHeader props={props} compact={index > 0} />{columns(page)}
      <footer className="resume-paper-footer"><span>{resume.contact.name}</span><span>{index + 1} / {props.pages.length || 1}</span></footer>
    </article>)}
  </>;
}
