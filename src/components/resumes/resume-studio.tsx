"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { AlignLeft, AlignCenter, AlignRight, ArrowLeft, ArrowDown, ArrowUp, Bold, Check, ChevronDown, Download, GripVertical, Italic, LayoutTemplate, List, Loader2, Minus, Plus, Redo2, Save, Sparkles, Underline, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { A4_WIDTH, A4_HEIGHT, addResumeEntry, fieldValue, moveResumeSection, normalizeEditorResume, orderedSections, resumeContentSchema, resumeFieldHasBullets, resumeFieldSupportsBullets, resumeSections, setResumeField, type EditorResume, type ResumeDesign, type ResumePage, type ResumeSection } from "@/lib/resume-editor";
import { resumeEditorCopy } from "@/lib/resume-editor-copy";
import { EditableResumeCanvas } from "./editable-resume-canvas";
import "./resume-editor.css";

type History = { current: EditorResume | null; past: EditorResume[]; future: EditorResume[] };
type Action = "GENERATE" | "IMPROVE" | "SHORTEN" | "PROFESSIONAL" | "GRAMMAR" | "ATS";
const accents = ["#173F35", "#1E4B8F", "#6B4F3A", "#6D3A65", "#111827", "#B35435"];

export function ResumeEditor() {
  const { id } = useParams<{ id: string }>();
  const { i18n } = useTranslation();
  const c = resumeEditorCopy[i18n.resolvedLanguage?.startsWith("fr") ? "fr" : "en"];
  const { user: session } = useCurrentUser();
  const [history, setHistory] = useState<History>({ current: null, past: [], future: [] });
  const resume = history.current;
  const current = useRef<EditorResume | null>(null); current.current = resume;
  const revision = useRef(0), savedSignature = useRef("");
  const saveLock = useRef<Promise<boolean> | null>(null), editGroup = useRef({ key: "", time: 0 });
  const [status, setStatus] = useState<"saved" | "unsaved" | "saving" | "error">("saved");
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"design" | "sections" | "ai">("design");
  const [toolsOpen, setToolsOpen] = useState(false), [preview, setPreview] = useState(false);
  const [selected, setSelected] = useState("summary.0"), [pages, setPages] = useState<ResumePage[]>([]);
  const [zoom, setZoom] = useState(.85), [fit, setFit] = useState(true), [canvasHeight, setCanvasHeight] = useState(A4_HEIGHT);
  const viewport = useRef<HTMLDivElement>(null), canvas = useRef<HTMLDivElement>(null);
  const [notes, setNotes] = useState(""), [action, setAction] = useState<Action>("GENERATE");
  const [language, setLanguage] = useState<"fr" | "en">(i18n.resolvedLanguage?.startsWith("fr") ? "fr" : "en");
  const [generating, setGenerating] = useState(false), [exporting, setExporting] = useState(false), [aiError, setAIError] = useState("");
  const [proposal, setProposal] = useState<{ path: string; text: string; original: string } | null>(null);

  useEffect(() => {
    if (!session?.id) return;
    let active = true;
    setHistory({ current: null, past: [], future: [] }); setError(""); setProposal(null);
    fetch(`/api/cvs/${id}`, { cache: "no-store" }).then(async response => { if (!response.ok) throw Error("LOAD_FAILED"); return response.json(); }).then(data => {
      if (!active) return;
      const document = normalizeEditorResume(data, { name: session.name || "", email: session.email });
      savedSignature.current = JSON.stringify(document); revision.current = data.revision || 0;
      setHistory({ current: document, past: [], future: [] }); setStatus("saved");
    }).catch(() => { if (active) setError("LOAD_FAILED"); });
    return () => { active = false; };
  }, [id, session?.id]);

  const change = useCallback((update: (doc: EditorResume) => EditorResume, key = "change") => {
    const before = current.current;
    if (!before) return;
    const next = update(before);
    if (JSON.stringify(next) === JSON.stringify(before)) return;
    const grouped = editGroup.current.key === key && Date.now() - editGroup.current.time < 900;
    editGroup.current = { key, time: Date.now() };
    current.current = next;
    setHistory(previous => {
      if (!previous.current) return previous;
      return { current: next, past: grouped ? previous.past : [...previous.past.slice(-59), previous.current], future: [] };
    });
    setStatus(previous => previous === "saving" ? "saving" : "unsaved"); setError(previous => previous === "CONFLICT" ? previous : "");
  }, []);
  const onField = useCallback((path: string, value: string) => change(doc => setResumeField(doc, path, value), path), [change]);
  const design = <K extends keyof ResumeDesign>(key: K, value: ResumeDesign[K]) => change(doc => ({ ...doc, design: { ...doc.design, [key]: value } }), "design:" + key);
  const add = (section: ResumeSection) => change(doc => addResumeEntry(doc, section));
  const remove = (section: ResumeSection, index: number) => change(doc => ({ ...doc, [section]: doc[section].filter((_, i) => i !== index) }));
  const duplicate = (section: ResumeSection, index: number) => change(doc => { const next = structuredClone(doc); (next[section] as unknown[]).splice(index + 1, 0, structuredClone(next[section][index])); return next; });
  const move = (section: ResumeSection, target: ResumeSection) => change(doc => ({ ...doc, design: moveResumeSection(doc.design, section, orderedSections(doc.design).indexOf(target)) }));
  const undoRedo = (redo: boolean) => {
    editGroup.current = { key: "", time: 0 };
    setHistory(previous => {
      if (!previous.current) return previous;
      const source = redo ? previous.future : previous.past;
      if (!source.length) return previous;
      return redo ? { current: source[0], future: source.slice(1), past: [...previous.past, previous.current] }
        : { current: source.at(-1)!, past: source.slice(0, -1), future: [previous.current, ...previous.future] };
    }); setStatus(previous => previous === "saving" ? "saving" : "unsaved");
  };

  const save = useCallback(async () => {
    if (saveLock.current) return saveLock.current;
    const document = current.current;
    if (!document) return false;
    const signature = JSON.stringify(document);
    if (signature === savedSignature.current) { setStatus("saved"); return true; }
    const operation = (async () => {
      setStatus("saving"); setError("");
      try {
        const body = { ...resumeContentSchema.parse(document), revision: revision.current };
        const response = await fetch(`/api/cvs/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        const data = await response.json();
        if (!response.ok) throw Error(response.status === 409 ? "CONFLICT" : "SAVE_FAILED");
        revision.current = data.revision;
        savedSignature.current = signature;
        setStatus(JSON.stringify(current.current) === signature ? "saved" : "unsaved");
        return true;
      } catch (cause) { setError(cause instanceof Error && cause.message === "CONFLICT" ? "CONFLICT" : "SAVE_FAILED"); setStatus("error"); return false; }
      finally { saveLock.current = null; }
    })();
    saveLock.current = operation; return operation;
  }, [id]);
  useEffect(() => {
    if (!resume || status === "saving" || status === "error" || error === "CONFLICT") return;
    if (JSON.stringify(resume) === savedSignature.current) { if (status !== "saved") setStatus("saved"); return; }
    const timer = setTimeout(() => { void save(); }, 1600);
    return () => clearTimeout(timer);
  }, [resume, status, error, save]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (current.current && JSON.stringify(current.current) !== savedSignature.current) event.preventDefault(); };
    window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn);
  }, []);
  useEffect(() => {
    if (!viewport.current) return;
    const observer = new ResizeObserver(entries => { if (fit) setZoom(Math.max(.25, Math.min(1, (entries[0].contentRect.width - 48) / A4_WIDTH))); });
    observer.observe(viewport.current); return () => observer.disconnect();
  }, [Boolean(resume), fit]);
  useEffect(() => {
    if (!canvas.current) return;
    const observer = new ResizeObserver(() => { if (canvas.current) setCanvasHeight(canvas.current.offsetHeight); });
    observer.observe(canvas.current); return () => observer.disconnect();
  }, [Boolean(resume)]);
  useEffect(() => {
    const keys = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.key.toLowerCase() === "s") { event.preventDefault(); void save(); }
      // Native editing undo stays available inside the selected text field.
    };
    window.addEventListener("keydown", keys); return () => window.removeEventListener("keydown", keys);
  }, [save]);

  const aiPath = selected.startsWith("contact.") ? "summary.0" : selected;
  const selectedLabel = selected.startsWith("summary") ? c.fields.summary : c.fields[selected.split(".").at(-1)! as keyof typeof c.fields] || c.sections[selected.split(".")[0] as ResumeSection] || c.fields.summary;
  const openAI = (path: string) => {
    const section = path.split(".")[0] as ResumeSection;
    if (resume && resumeSections.includes(section) && !resume[section].length) add(section);
    setSelected(path); setAction(resume && fieldValue(resume, path).trim() ? "IMPROVE" : "GENERATE"); setTab("ai"); setToolsOpen(true); setAIError("");
  };
  const generate = async () => {
    if (!resume || generating) return;
    setGenerating(true); setAIError(""); setProposal(null);
    const original = fieldValue(resume, aiPath);
    try {
      const response = await fetch("/api/resume-ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cvId: id, text: original, field: aiPath, action, notes, language, draft: resume }) });
      const data = await response.json();
      if (!response.ok) throw Error(data.error || "AI_FAILED");
      setProposal({ path: aiPath, text: data.proposal, original });
    } catch (cause) { setAIError(cause instanceof Error ? cause.message : "AI_FAILED"); }
    finally { setGenerating(false); }
  };
  const applyProposal = () => {
    if (!proposal || !current.current) return;
    if (fieldValue(current.current, proposal.path) !== proposal.original) { setAIError("CHANGED"); return; }
    let document = current.current;
    const section = proposal.path.split(".")[0] as ResumeSection;
    if (resumeSections.includes(section) && !document[section].length) document = addResumeEntry(document, section);
    const next = setResumeField(document, proposal.path, proposal.text);
    change(() => next, "ai-accepted"); setProposal(null); setAIError("");
  };
  const exportPDF = async () => {
    if (!current.current || exporting) return;
    setExporting(true);
    try {
      const [{ pdf }, { ResumePDF }] = await Promise.all([import("@react-pdf/renderer"), import("./resume-pdf")]);
      const blob = await pdf(<ResumePDF resume={current.current} pages={pages} copy={c} />).toBlob();
      const url = URL.createObjectURL(blob), anchor = document.createElement("a");
      anchor.href = url; anchor.download = (current.current.design.documentName || current.current.contact.name || c.untitled).replace(/[\\/:*?"<>|]/g, "_") + ".pdf";
      document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch { setError("EXPORT_FAILED"); }
    finally { setExporting(false); }
  };
  const toggleStyle = (key: "bold" | "italic" | "underline") => {
    if (!resume) return;
    design("fieldStyles", { ...resume.design.fieldStyles, [selected]: { ...resume.design.fieldStyles[selected], [key]: !resume.design.fieldStyles[selected]?.[key] } });
  };
  const toggleBullets = () => {
    if (!resume || preview || !resumeFieldSupportsBullets(selected)) return;
    design("fieldStyles", { ...resume.design.fieldStyles, [selected]: { ...resume.design.fieldStyles[selected], bullets: !resumeFieldHasBullets(resume, selected) } });
    requestAnimationFrame(() => {
      const element = Array.from(canvas.current?.querySelectorAll<HTMLElement>("[data-resume-page] [data-field]") || []).find(field => field.dataset.field === selected);
      if (!element) return;
      element.focus();
      const range = document.createRange(); range.selectNodeContents(element); range.collapse(false);
      const selection = window.getSelection(); selection?.removeAllRanges(); selection?.addRange(range);
    });
  };
  const aiMessage = aiError === "CHANGED" ? c.proposalChanged : aiError === "AI_FACTS_REQUIRED" ? c.aiFacts : ["AI_LIMIT", "AI_RATE_LIMIT"].includes(aiError) ? c.aiLimit : aiError === "AI_AUTH_ERROR" ? c.aiAuth : aiError === "AI_MODEL_UNAVAILABLE" ? c.aiModel : aiError === "AI_TIMEOUT" ? c.aiTimeout : ["AI_UNAVAILABLE", "AI_PROVIDER_UNAVAILABLE"].includes(aiError) ? c.aiUnavailable : c.aiFailed;

  if (!resume) return <div className="rounded-xl border bg-card p-10 text-center"><p role={error ? "alert" : "status"} className="text-sm text-muted-foreground">{error ? c.loadError : c.loading}</p>{!error && <Loader2 className="mx-auto mt-4 size-5 animate-spin text-primary" />}<Button className="mt-6" variant="outline" asChild><Link href="/dashboard/resumes"><ArrowLeft />{c.back}</Link></Button></div>;
  return <div className="resume-studio">
    <header className="studio-header"><Button variant="ghost" size="icon" asChild><Link href="/dashboard/resumes" aria-label={c.back}><ArrowLeft className="size-4" /></Link></Button><div><p className="text-[9px] font-semibold uppercase tracking-[.18em] text-primary">CVcomet / {c.title}</p><Input className="studio-document-name" aria-label={c.name} maxLength={160} value={resume.design.documentName} placeholder={c.untitled} onChange={event => design("documentName", event.target.value)} /><p className="studio-save-status" role="status">{status === "saving" ? <Loader2 className="size-3 animate-spin" /> : status === "saved" ? <Check className="size-3 text-primary" /> : <span className="size-1.5 rounded-full bg-amber-500" />}{c[status === "error" ? "saveError" : status]}</p></div>
      <div className="studio-header-actions"><Button variant="outline" disabled={status === "saving"} onClick={() => void save()}><Save className="size-4" />{c.save}</Button><Button disabled={exporting || !pages.length} onClick={() => void exportPDF()}>{exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}{exporting ? c.exporting : c.export}</Button></div>
    </header>
    {error && <p role="alert" className="mb-4 rounded-lg border border-destructive/25 bg-destructive/5 p-3 text-sm text-destructive">{error === "CONFLICT" ? c.conflict : error === "EXPORT_FAILED" ? c.exportError : c.saveError}</p>}
    <div className="studio-toolbar"><div className="studio-tool-group">
      <Button variant="ghost" size="icon" disabled={!history.past.length} aria-label={c.undo} title={c.undo} onClick={() => undoRedo(false)}><Undo2 className="size-4" /></Button>
      <Button variant="ghost" size="icon" disabled={!history.future.length} aria-label={c.redo} title={c.redo} onClick={() => undoRedo(true)}><Redo2 className="size-4" /></Button>
      <span className="studio-toolbar-separator" />
      {([{ key: "bold", icon: Bold }, { key: "italic", icon: Italic }, { key: "underline", icon: Underline }] as const).map(({ key, icon: Icon }) => <Button key={key} variant={resume.design.fieldStyles[selected]?.[key] ? "secondary" : "ghost"} size="icon" aria-label={c[key]} aria-pressed={!!resume.design.fieldStyles[selected]?.[key]} title={c[key]} onClick={() => toggleStyle(key)}><Icon className="size-4" /></Button>)}
      <Button variant={resumeFieldHasBullets(resume, selected) ? "secondary" : "ghost"} size="icon" aria-label={c.bullets} aria-pressed={resumeFieldHasBullets(resume, selected)} title={c.bulletsHint} disabled={preview || !resumeFieldSupportsBullets(selected)} onClick={toggleBullets}><List className="size-4" /></Button>
      <span className="studio-toolbar-separator" />
      {([{ value: "left", icon: AlignLeft, label: c.alignLeft }, { value: "center", icon: AlignCenter, label: c.alignCenter }, { value: "right", icon: AlignRight, label: c.alignRight }] as const).map(({ value, icon: Icon, label }) => <Button key={value} variant={resume.design.fieldStyles[selected]?.align === value ? "secondary" : "ghost"} size="icon" aria-label={label} title={label} aria-pressed={resume.design.fieldStyles[selected]?.align === value} onClick={() => design("fieldStyles", { ...resume.design.fieldStyles, [selected]: { ...resume.design.fieldStyles[selected], align: value } })}><Icon className="size-4" /></Button>)}
      <Button variant="ghost" size="sm" className="studio-mobile-tools" onClick={() => setToolsOpen(value => !value)}><LayoutTemplate className="size-4" />{c.openTools}</Button></div>
      <div className="studio-tool-group"><Button variant="ghost" size="sm" onClick={() => setPreview(value => !value)}>{preview ? c.edit : c.preview}</Button><Button variant="ghost" size="icon" aria-label={c.zoomOut} onClick={() => { setFit(false); setZoom(value => Math.max(.25, value - .1)); }}><Minus className="size-3" /></Button><button className="min-w-12 text-xs" onClick={() => setFit(true)} title={c.fit}>{Math.round(zoom * 100)}% <ChevronDown className="inline size-3" /></button><Button variant="ghost" size="icon" aria-label={c.zoomIn} onClick={() => { setFit(false); setZoom(value => Math.min(1.5, value + .1)); }}><Plus className="size-3" /></Button></div>
    </div>
    <div className="studio-workspace">
      <aside className={`studio-inspector ${toolsOpen ? "is-open" : ""}`} aria-label={c.openTools}>
        <div className="studio-inspector-tabs" role="tablist">{([{ key: "design", icon: LayoutTemplate, label: c.design }, { key: "sections", icon: List, label: c.sectionsTab }, { key: "ai", icon: Sparkles, label: c.ai }] as const).map(({ key, icon: Icon, label }) => <button type="button" key={key} className="studio-inspector-tab" role="tab" aria-selected={tab === key} onClick={() => setTab(key)}><Icon className="size-4" />{label}</button>)}</div>
        <Button variant="ghost" size="icon" className="studio-mobile-tools ml-auto mr-2 mt-2" aria-label={c.close} onClick={() => setToolsOpen(false)}><X className="size-4" /></Button>
        <div className="studio-panel" role="tabpanel">
          {tab === "design" && <>
            <div><span className="studio-panel-label">{c.templates}</span><div className="studio-template-grid">{(["modern", "classic", "minimal"] as const).map(layout => <button type="button" key={layout} className="studio-template" aria-pressed={resume.design.layout === layout} onClick={() => design("layout", layout)}><div className="studio-template-paper" style={{ borderTop: layout === "modern" ? `3px solid ${resume.design.accent}` : undefined }}><div style={{ height: 5, width: layout === "classic" ? "65%" : "80%", background: resume.design.accent, margin: layout === "classic" ? "0 auto 6px" : "0 0 6px" }} /><div style={{ display: "flex", gap: 4 }}>{layout === "modern" && <div style={{ width: "28%", background: "#EEF3F0", height: 53 }} />}<div style={{ flex: 1 }}>{Array.from({ length: 8 }, (_, index) => <div className="studio-template-lines" key={index} style={{ width: index % 3 === 2 ? "65%" : "100%" }} />)}</div></div></div>{c[layout]}</button>)}</div><p className="mt-3 text-[10px] leading-5 text-muted-foreground">{c.templateHint}</p></div>
            <div><span className="studio-panel-label">{c.accent}</span><div className="flex flex-wrap items-center gap-3">{accents.map(color => <button key={color} type="button" className="studio-swatch" style={{ background: color }} aria-label={c.accent + " " + color} aria-pressed={resume.design.accent === color} onClick={() => design("accent", color)} />)}<input type="color" value={resume.design.accent} aria-label={c.accent} className="size-7 cursor-pointer rounded border-0 bg-transparent" onChange={event => design("accent", event.target.value)} /></div></div>
            <label className="block"><span className="studio-panel-label">{c.font}</span><select className="h-9 w-full rounded-md border bg-background px-3 text-xs" value={resume.design.font} onChange={event => design("font", event.target.value as ResumeDesign["font"])}>{(["sans", "serif", "mono"] as const).map(font => <option key={font} value={font}>{c[font]}</option>)}</select></label>
            {[{ key: "fontSize", label: c.fontSize, min: 11, max: 16, step: .5 }, { key: "lineHeight", label: c.spacing, min: 1.2, max: 1.8, step: .05 }, { key: "padding", label: c.margins, min: 28, max: 64, step: 2 }].map(({ key, label, min, max, step }) => <label key={key}><span className="studio-panel-label flex justify-between">{label}<span className="font-normal text-muted-foreground">{Number(resume.design[key as "fontSize" | "lineHeight" | "padding"]).toFixed(key === "lineHeight" ? 2 : 0)}</span></span><input className="w-full accent-primary" type="range" min={min} max={max} step={step} aria-label={label} value={resume.design[key as "fontSize" | "lineHeight" | "padding"]} onChange={event => design(key as "fontSize" | "lineHeight" | "padding", Number(event.target.value))} /></label>)}
            <div className="studio-ai-banner"><Sparkles className="mb-2 size-5 text-primary" /><p className="text-xs font-semibold">{c.aiTitle}</p><p className="mt-2 text-[11px] leading-5 text-muted-foreground">{c.aiHint}</p><Button size="sm" className="mt-4 w-full text-xs" onClick={() => openAI("summary.0")}><Sparkles className="size-3" />{c.addSummary}</Button></div>
          </>}
          {tab === "sections" && <><div><h2 className="text-sm font-semibold">{c.structure}</h2><p className="mt-2 text-[11px] leading-5 text-muted-foreground">{c.structureHint}</p></div><div>{[...new Set([...resume.design.sectionOrder, ...resumeSections])].map((section, index) => <div key={section} className="studio-section-row"><GripVertical className="size-3 shrink-0 text-muted-foreground" /><input type="checkbox" className="size-3 accent-primary" aria-label={c.visible + " " + c.sections[section]} checked={!resume.design.hiddenSections.includes(section)} onChange={event => design("hiddenSections", event.target.checked ? resume.design.hiddenSections.filter(key => key !== section) : [...resume.design.hiddenSections, section])} /><span className="flex-1 text-xs">{c.sections[section]}</span><button type="button" className="p-1" title={c.add} aria-label={c.add + " " + c.sections[section]} onClick={() => add(section)}><Plus className="size-3" /></button><button type="button" className="p-1 disabled:opacity-30" disabled={index === 0} aria-label={c.moveUp + " " + c.sections[section]} onClick={() => change(doc => ({ ...doc, design: moveResumeSection(doc.design, section, index - 1) }))}><ArrowUp className="size-3" /></button><button type="button" className="p-1 disabled:opacity-30" disabled={index === 6} aria-label={c.moveDown + " " + c.sections[section]} onClick={() => change(doc => ({ ...doc, design: moveResumeSection(doc.design, section, index + 1) }))}><ArrowDown className="size-3" /></button></div>)}</div></>}
          {tab === "ai" && <>
            <div><Sparkles className="mb-3 size-5 text-primary" /><h2 className="text-sm font-semibold">{c.aiTitle}</h2><p className="mt-2 text-[11px] leading-5 text-muted-foreground">{c.aiHint}</p></div>
            <div className="rounded-md border bg-muted/40 p-3"><p className="text-[9px] uppercase tracking-wider text-muted-foreground">{c.selected}</p><p className="mt-1 text-xs font-medium">{selectedLabel}</p><p className="mt-2 line-clamp-4 whitespace-pre-wrap text-[11px] leading-5 text-muted-foreground">{fieldValue(resume, aiPath) || c.selectionHelp}</p></div>
            <label><span className="studio-panel-label">{c.notes}</span><Textarea rows={5} maxLength={8000} value={notes} onChange={event => setNotes(event.target.value)} placeholder={c.notesPlaceholder} className="text-xs leading-6" /><p className="mt-2 text-[10px] leading-5 text-muted-foreground">{c.notesHint}</p></label>
            <label><span className="studio-panel-label">{c.action}</span><select className="h-9 w-full rounded-md border bg-background px-3 text-xs" value={action} onChange={event => setAction(event.target.value as Action)}>{(["GENERATE", "IMPROVE", "SHORTEN", "PROFESSIONAL", "GRAMMAR", "ATS"] as const).map(value => <option key={value} value={value}>{c[value]}</option>)}</select></label>
            <label><span className="studio-panel-label">{c.language}</span><select className="h-9 w-full rounded-md border bg-background px-3 text-xs" value={language} onChange={event => setLanguage(event.target.value as "fr" | "en")}><option value="fr">Français</option><option value="en">English</option></select></label>
            <Button disabled={generating} onClick={() => void generate()}>{generating ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}{generating ? c.generating : c.generate}</Button>
            {aiError && <p role="alert" className="text-xs leading-5 text-destructive">{aiMessage}</p>}
            {proposal && <div className="space-y-3"><p className="text-xs font-semibold">{c.proposal}</p><Textarea aria-label={c.proposal} rows={8} value={proposal.text} onChange={event => setProposal({ ...proposal, text: event.target.value })} className="studio-ai-proposal" /><p className="text-[10px] leading-5 text-muted-foreground">{c.reviewHint}</p><Button className="w-full text-xs" onClick={applyProposal}><Check className="size-3" />{c.apply}</Button><Button variant="ghost" className="w-full text-xs" onClick={() => setProposal(null)}>{c.discard}</Button></div>}
          </>}
        </div>
      </aside>
      <section ref={viewport} className="studio-canvas-viewport" aria-label={c.title}>
        <div className="studio-canvas-sizer" style={{ width: A4_WIDTH * zoom, height: canvasHeight * zoom }}><div ref={canvas} className="studio-canvas-pages" style={{ transform: `scale(${zoom})` }}><EditableResumeCanvas resume={resume} pages={pages} copy={c} selected={selected} preview={preview} onField={onField} onSelect={setSelected} onAdd={add} onRemove={remove} onDuplicate={duplicate} onMove={move} onAI={openAI} onPages={setPages} /></div></div>
        <p className="studio-canvas-footer">{c.hint}</p>
      </section>
    </div>
  </div>;
}
