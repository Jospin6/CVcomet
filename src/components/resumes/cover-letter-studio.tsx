"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { AlignCenter, AlignLeft, AlignRight, ArrowLeft, Bold, Briefcase, Check, ChevronDown, Download, Italic, LayoutTemplate, List, Loader2, Minus, Plus, Redo2, Save, Send, Sparkles, Underline, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { coverLetterFonts, normalizeCoverLetter, type CoverLetterDesign, type CoverLetterDocument } from "@/lib/cover-letter-editor";
import { A4_HEIGHT, A4_WIDTH, resumePaperDimensions } from "@/lib/resume-editor";
import { recommendedPaper, type TargetMarket } from "@/lib/career-localization/markets";
import { CareerMarketPanel } from "./career-market-panel";
import { resumeEditorCopy } from "@/lib/resume-editor-copy";
import "./resume-editor.css";

type LetterResponse = CoverLetterDocument & { id: string; revision: number; cv: { id: string; title: string } | null; job: { title: string; company: string | null; description: string } | null };
type Chat = { role: "user" | "assistant"; content: string; changes?: string[] };
type LetterProposal = {
  status: "proposal"; proposalId: string; baseRevision: number; expiresAt: string;
  message: string; changes: string[]; preview: CoverLetterDocument;
  diff: { field: string; before: string; after: string }[];
};
type TextField = Exclude<keyof CoverLetterDocument, "design">;
const accents = ["#173F35", "#1E4B8F", "#6B4F3A", "#6D3A65", "#111827", "#B35435"];
const fieldNames: Record<TextField, [string, string]> = {
  senderName: ["Nom complet", "Full name"], sendertitle: ["Intitulé du poste", "Job title"], senderEmail: ["Adresse e-mail", "Email address"], senderPhone: ["Téléphone", "Phone"], senderAddress: ["Adresse", "Address"],
  recipientName: ["Destinataire", "Recipient"], recipientTitle: ["Fonction du destinataire", "Recipient title"], companyName: ["Entreprise", "Company"], companyAddress: ["Adresse de l’entreprise", "Company address"],
  positionTitle: ["Objet de la lettre", "Letter subject"], introduction: ["Introduction", "Introduction"], body: ["Corps de la lettre", "Letter body"], conclusion: ["Conclusion", "Closing"],
};

// Keep the editable DOM stable while typing, including when another field changes.
function LetterField({ field, value, label, selected, preview, disabled, style, onSelect, onChange }: {
  field: TextField; value: string; label: string; selected: boolean; preview: boolean; disabled: boolean; style: CSSProperties;
  onSelect: (_field: TextField) => void; onChange: (_field: TextField, _value: string) => void;
}) {
  const element = useRef<HTMLDivElement>(null);
  useEffect(() => { if (element.current && element.current.innerText !== value) element.current.textContent = value; }, [value]);
  return <div ref={element} className={`resume-editable ${preview ? "is-preview" : selected ? "is-selected" : ""}`} data-field={field} data-placeholder={label} role="textbox" aria-label={label} aria-multiline="true" aria-readonly={preview || disabled} contentEditable={!preview && !disabled} suppressContentEditableWarning style={style} onFocus={() => onSelect(field)} onInput={event => onChange(field, event.currentTarget.innerText)} onPaste={event => { event.preventDefault(); globalThis.document.execCommand("insertText", false, event.clipboardData.getData("text/plain")); }} />;
}

export function CoverLetterEditor() {
  const { id } = useParams<{ id: string }>();
  const applicationId = useSearchParams().get("applicationId");
  const { i18n } = useTranslation();
  const fr = i18n.resolvedLanguage?.startsWith("fr") ?? false;
  const c = resumeEditorCopy[fr ? "fr" : "en"];
  const title = fr ? "Studio lettre de motivation" : "Cover letter studio";
  const back = fr ? "Retour au CV" : "Back to resume";
  const hint = fr ? "Cliquez sur un texte pour le modifier. Votre lettre est sauvegardée automatiquement." : "Click any text to edit it. Your letter saves automatically.";
  const chatHint = fr ? "Demandez une modification du texte ou du design de votre lettre." : "Ask to change the text or design of your letter.";
  const jobLabel = fr ? "Offre associée" : "Linked job";
  const [letter, setLetter] = useState<LetterResponse | null>(null), [document, setDocument] = useState<CoverLetterDocument | null>(null);
  const ready = Boolean(document);
  const paperSize = resumePaperDimensions(document?.design.paper ?? "A4");
  const [status, setStatus] = useState<"saved" | "saving" | "unsaved" | "error">("saved"), [error, setError] = useState("");
  const [selected, setSelected] = useState<TextField>("body"), [messages, setMessages] = useState<Chat[]>([]), [chat, setChat] = useState(""), [chatting, setChatting] = useState(false);
  const [pendingAI, setPendingAI] = useState<LetterProposal | null>(null), [decidingAI, setDecidingAI] = useState(false);
  const [tab, setTab] = useState<"design" | "sections" | "ai" | "job">("design");
  const [toolsOpen, setToolsOpen] = useState(false), [preview, setPreview] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [zoom, setZoom] = useState(.85), [fit, setFit] = useState(true), [canvasHeight, setCanvasHeight] = useState(A4_HEIGHT);
  const [past, setPast] = useState<CoverLetterDocument[]>([]), [future, setFuture] = useState<CoverLetterDocument[]>([]);
  const viewport = useRef<HTMLElement>(null), canvas = useRef<HTMLDivElement>(null);
  const current = useRef<CoverLetterDocument | null>(null), saved = useRef(""), revision = useRef(0);
  const request = useRef<AbortController | null>(null), saveLock = useRef<Promise<boolean> | null>(null), aiLock = useRef(false);
  const generation = useRef(0), editGroup = useRef({ key: "", time: 0 });

  const load = useCallback(async () => {
    const token = ++generation.current;
    setError(""); setLetter(null); setDocument(null); current.current = null; saved.current = "";
    setPast([]); setFuture([]); setMessages([]); setChat(""); setChatting(false); setPendingAI(null); setDecidingAI(false); aiLock.current = false; saveLock.current = null;
    try {
      const response = await fetch(`/api/cover-letters/${id}`, { cache: "no-store" });
      if (!response.ok) throw new Error("LOAD");
      const data: LetterResponse = await response.json();
      if (token !== generation.current) return;
      const value = normalizeCoverLetter(data);
      setLetter(data); setDocument(value); current.current = value; revision.current = data.revision; saved.current = JSON.stringify(value); setStatus("saved");
      // A pending proposal survives reload, but only while its revision is current.
      try {
        const proposalResponse = await fetch(`/api/cover-letters/${id}/assistant`, { cache: "no-store" });
        if (proposalResponse.ok) {
          const proposal = await proposalResponse.json();
          if (token === generation.current && proposal.status === "proposal" && proposal.baseRevision === data.revision) setPendingAI(proposal as LetterProposal);
        }
      } catch { /* Recovery of pending drafts is best-effort; document remains editable. */ }
    } catch { if (token === generation.current) setError("LOAD"); }
  }, [id]);
  useEffect(() => { void load(); const token = generation.current; return () => { generation.current = token + 1; request.current?.abort(); }; }, [load]);

  const update = (change: (_value: CoverLetterDocument) => CoverLetterDocument, key = "change") => {
    const before = current.current;
    if (!before || aiLock.current || pendingAI) return;
    const next = change(before);
    if (JSON.stringify(before) === JSON.stringify(next)) return;
    if (editGroup.current.key !== key || Date.now() - editGroup.current.time >= 900) setPast(items => [...items.slice(-59), before]);
    editGroup.current = { key, time: Date.now() }; setFuture([]);
    current.current = next; setDocument(next); setStatus(value => value === "saving" ? value : "unsaved");
    setError(value => value === "CONFLICT" ? value : "");
  };
  const save = useCallback(async (): Promise<boolean> => {
    if (saveLock.current) return saveLock.current;
    const value = current.current;
    if (!value) return false;
    const signature = JSON.stringify(value), token = generation.current;
    if (signature === saved.current) { setStatus("saved"); return true; }
    const operation = (async () => {
      setStatus("saving");
      try {
        const response = await fetch(`/api/cover-letters/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...value, revision: revision.current }) });
        const data = await response.json();
        if (!response.ok) throw new Error(response.status === 409 ? "CONFLICT" : "SAVE");
        if (token !== generation.current) return false;
        saved.current = signature; revision.current = data.revision;
        setStatus(JSON.stringify(current.current) === signature ? "saved" : "unsaved"); setError(""); return true;
      } catch (cause) { if (token === generation.current) { setError(cause instanceof Error ? cause.message : "SAVE"); setStatus("error"); } return false; }
      finally { if (token === generation.current) saveLock.current = null; }
    })();
    saveLock.current = operation; return operation;
  }, [id]);
  useEffect(() => { if (!document || status !== "unsaved" || error === "CONFLICT") return; const timer = setTimeout(() => void save(), 1600); return () => clearTimeout(timer); }, [document, save, status, error]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (current.current && JSON.stringify(current.current) !== saved.current) event.preventDefault(); };
    const keys = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") { event.preventDefault(); if (!aiLock.current) void save(); } };
    window.addEventListener("beforeunload", warn); window.addEventListener("keydown", keys);
    return () => { window.removeEventListener("beforeunload", warn); window.removeEventListener("keydown", keys); };
  }, [save]);
  useEffect(() => {
    if (!viewport.current) return;
    const observer = new ResizeObserver(entries => { if (fit) setZoom(Math.max(.25, Math.min(1, (entries[0].contentRect.width - 48) / paperSize.width))); });
    observer.observe(viewport.current); return () => observer.disconnect();
  }, [ready, fit, document?.design.paper]);
  useEffect(() => {
    if (!canvas.current) return;
    const observer = new ResizeObserver(() => { if (canvas.current) setCanvasHeight(canvas.current.offsetHeight); });
    observer.observe(canvas.current); return () => observer.disconnect();
  }, [ready]);

  const design = <K extends keyof CoverLetterDesign>(key: K, value: CoverLetterDesign[K]) => update(doc => ({ ...doc, design: { ...doc.design, [key]: value } }), `design:${key}`);
  const style = (key: "bold" | "italic" | "underline" | "align", value?: boolean | "left" | "center" | "right") => update(doc => ({ ...doc, design: { ...doc.design, fieldStyles: { ...doc.design.fieldStyles, [selected]: { ...doc.design.fieldStyles[selected], [key]: value ?? !doc.design.fieldStyles[selected]?.[key as "bold"] } } } }));
  const onText = (field: TextField, text: string) => update(doc => ({ ...doc, [field]: text }), field);
  const undoRedo = (redo: boolean) => {
    if (!current.current || aiLock.current || pendingAI) return;
    const next = redo ? future[0] : past.at(-1);
    if (!next) return;
    if (redo) { setPast([...past, current.current]); setFuture(future.slice(1)); }
    else { setFuture([current.current, ...future]); setPast(past.slice(0, -1)); }
    editGroup.current = { key: "", time: 0 }; current.current = next; setDocument(next); setStatus(value => value === "saving" ? value : "unsaved");
  };
  const ask = async (event: FormEvent) => {
    event.preventDefault(); if (!chat.trim() || !current.current || aiLock.current || pendingAI) return;
    const instruction = chat.trim(), token = generation.current;
    aiLock.current = true; setChatting(true);
    const controller = new AbortController(); request.current = controller;
    try {
      if (!await save()) return;
      // A save already in flight can finish before the most recent keystrokes.
      if (JSON.stringify(current.current) !== saved.current && !await save()) return;
      if (token !== generation.current) return;
      setError(""); setChat("");
      const response = await fetch(`/api/cover-letters/${id}/assistant`, { method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.any([controller.signal, AbortSignal.timeout(60000)]), body: JSON.stringify({ instruction, language: fr ? "fr" : "en", revision: revision.current, history: messages.slice(-8).map(({ role, content }) => ({ role, content })) }) });
      const data = await response.json(); if (!response.ok) throw new Error(response.status === 409 ? "CONFLICT" : "AI");
      if (token !== generation.current) return;
      if (data.status === "proposal") setPendingAI(data as LetterProposal);
      setMessages(items => [...items, { role: "user", content: instruction }, { role: "assistant", content: data.message, changes: data.changes }]);
    } catch (cause) { if (token === generation.current) { setError(cause instanceof Error && cause.message === "CONFLICT" ? "CONFLICT" : "AI"); setChat(instruction); } }
    finally { if (token === generation.current) { request.current = null; aiLock.current = false; setChatting(false); } }
  };
  const decideAI = async (action: "accept" | "discard") => {
    if (!pendingAI || aiLock.current) return;
    const proposalId = pendingAI.proposalId, token = generation.current;
    aiLock.current = true; setDecidingAI(true); setError("");
    try {
      const response = await fetch(`/api/cover-letters/${id}/assistant/decision`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposalId, action }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(response.status === 409 && ["PROPOSAL_EXPIRED_OR_STALE", "EVIDENCE_CHANGED"].includes(data.error) ? "PROPOSAL_STALE" : response.status === 409 ? "CONFLICT" : "AI");
      if (token !== generation.current) return;
      if (action === "accept" && data.status === "applied") {
        const next = normalizeCoverLetter(data.document);
        const before = current.current!;
        setPast(items => [...items.slice(-59), before]); setFuture([]); editGroup.current = { key: "", time: 0 };
        saved.current = JSON.stringify(next); current.current = next; setDocument(next); revision.current = data.revision; setStatus("saved");
      }
      setPendingAI(null);
    } catch (cause) {
      if (token === generation.current) setError(cause instanceof Error && ["CONFLICT", "PROPOSAL_STALE"].includes(cause.message) ? cause.message : "AI");
    } finally {
      if (token === generation.current) { aiLock.current = false; setDecidingAI(false); }
    }
  };
  const focusField = (field: TextField) => {
    setSelected(field); setPreview(false); setToolsOpen(false);
    requestAnimationFrame(() => { const target = canvas.current?.querySelector<HTMLElement>(`[data-field="${field}"]`); target?.focus(); target?.scrollIntoView({ block: "center", behavior: "smooth" }); });
  };
  const exportPDF = async () => {
    if (!current.current || exporting) return;
    const snapshot = current.current;
    setExporting(true);
    try {
      const [{ pdf }, { CoverLetterPDF }] = await Promise.all([import("@react-pdf/renderer"), import("./cover-letter-pdf")]);
      const blob = await pdf(<CoverLetterPDF letter={snapshot} />).toBlob();
      const url = URL.createObjectURL(blob), anchor = globalThis.document.createElement("a");
      anchor.href = url; anchor.download = (snapshot.positionTitle || "Cover letter").replace(/[\\/:*?"<>|]/g, "_") + ".pdf";
      globalThis.document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch { setError("EXPORT"); }
    finally { setExporting(false); }
  };

  if (!document || !letter) return <div className="border bg-card p-10 text-center"><p role={error ? "alert" : "status"} className="text-sm text-muted-foreground">{error ? (fr ? "Impossible d’ouvrir cette lettre." : "Unable to open this letter.") : c.loading}</p>{!error && <Loader2 className="mx-auto mt-4 size-5 animate-spin text-primary" />}{error && <Button className="mt-6" variant="outline" onClick={() => void load()}>{c.retry}</Button>}</div>;
  const fieldLabel = (field: TextField) => fieldNames[field][fr ? 0 : 1];
  const editable = (field: TextField) => {
    const styles = document.design.fieldStyles[field];
    return <LetterField field={field} value={document[field]} label={fieldLabel(field)} selected={selected === field} preview={preview} disabled={chatting || Boolean(pendingAI)} style={{ fontWeight: styles?.bold ? 700 : undefined, fontStyle: styles?.italic ? "italic" : undefined, textDecoration: styles?.underline ? "underline" : undefined, textAlign: styles?.align }} onSelect={setSelected} onChange={onText} />;
  };
  const errorText = error === "PROPOSAL_STALE" ? (fr ? "La proposition est périmée ou les faits confirmés ont changé. Rejetez-la puis demandez une nouvelle version." : "This proposal is stale or evidence has changed. Discard it and request a new draft.") : error === "CONFLICT" ? (fr ? "Cette lettre a été modifiée dans un autre onglet. Exportez votre version avant de recharger." : "This letter was edited in another tab. Export your version before reloading.") : error === "AI" ? c.chatError : error === "EXPORT" ? c.exportError : c.saveError;

  return <div className="resume-studio cover-letter-studio">
    {applicationId && <div className="mb-2 text-xs"><Link className="text-primary underline" href={`/dashboard/applications/${encodeURIComponent(applicationId)}?tab=documents`}>← Retour au dossier de candidature</Link></div>}
    <header className="studio-header">
      <Button variant="ghost" size="icon" asChild><Link href={applicationId ? `/dashboard/applications/${encodeURIComponent(applicationId)}?tab=documents` : letter.cv ? `/dashboard/resumes/${letter.cv.id}` : "/dashboard/cover-letters"} aria-label={back}><ArrowLeft className="size-4" /></Link></Button>
      <div><p className="text-[9px] font-semibold uppercase tracking-[.18em] text-primary">CVcomet / {title}</p><Input className="studio-document-name" aria-label={fieldLabel("positionTitle")} maxLength={300} value={document.positionTitle} placeholder={fr ? "Ma lettre de motivation" : "My cover letter"} disabled={chatting || Boolean(pendingAI)} onChange={event => onText("positionTitle", event.target.value)} /><p className="studio-save-status" role="status">{status === "saving" ? <Loader2 className="size-3 animate-spin" /> : status === "saved" ? <Check className="size-3 text-primary" /> : <span className="size-1.5 rounded-full bg-amber-500" />}{c[status === "error" ? "saveError" : status]}</p></div>
      <div className="studio-header-actions"><Button variant="outline" asChild><Link href={applicationId ? `/dashboard/applications/${encodeURIComponent(applicationId)}?tab=documents` : letter.cv ? `/dashboard/resumes/${letter.cv.id}` : "/dashboard/cover-letters"}><ArrowLeft className="size-4" />{back}</Link></Button><Button variant="outline" disabled={status === "saving" || chatting || Boolean(pendingAI)} onClick={() => void save()}><Save className="size-4" />{c.save}</Button><Button disabled={exporting} onClick={() => void exportPDF()}>{exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}{exporting ? c.exporting : c.export}</Button></div>
    </header>
    {error && <p role="alert" className="mb-4 rounded-lg border border-destructive/25 bg-destructive/5 p-3 text-sm text-destructive">{errorText}</p>}
    <div className="studio-toolbar"><div className="studio-tool-group">
      <Button variant="ghost" size="icon" disabled={!past.length || chatting || Boolean(pendingAI)} aria-label={c.undo} title={c.undo} onClick={() => undoRedo(false)}><Undo2 className="size-4" /></Button><Button variant="ghost" size="icon" disabled={!future.length || chatting || Boolean(pendingAI)} aria-label={c.redo} title={c.redo} onClick={() => undoRedo(true)}><Redo2 className="size-4" /></Button>
      <span className="studio-toolbar-separator" />
      {([{ key: "bold", icon: Bold }, { key: "italic", icon: Italic }, { key: "underline", icon: Underline }] as const).map(({ key, icon: Icon }) => <Button key={key} variant={document.design.fieldStyles[selected]?.[key] ? "secondary" : "ghost"} size="icon" aria-label={c[key]} aria-pressed={!!document.design.fieldStyles[selected]?.[key]} title={c[key]} disabled={chatting || preview || Boolean(pendingAI)} onClick={() => style(key)}><Icon className="size-4" /></Button>)}
      <span className="studio-toolbar-separator" />
      {([{ value: "left", icon: AlignLeft, label: c.alignLeft }, { value: "center", icon: AlignCenter, label: c.alignCenter }, { value: "right", icon: AlignRight, label: c.alignRight }] as const).map(({ value, icon: Icon, label }) => <Button key={value} variant={document.design.fieldStyles[selected]?.align === value ? "secondary" : "ghost"} size="icon" aria-label={label} title={label} aria-pressed={document.design.fieldStyles[selected]?.align === value} disabled={chatting || preview || Boolean(pendingAI)} onClick={() => style("align", value)}><Icon className="size-4" /></Button>)}
      <Button variant="ghost" size="sm" className="studio-mobile-tools" onClick={() => setToolsOpen(value => !value)}><LayoutTemplate className="size-4" />{c.openTools}</Button></div>
      <div className="studio-tool-group"><Button variant="ghost" size="sm" onClick={() => setPreview(value => !value)}>{preview ? c.edit : c.preview}</Button><Button variant="ghost" size="icon" aria-label={c.zoomOut} onClick={() => { setFit(false); setZoom(value => Math.max(.25, value - .1)); }}><Minus className="size-3" /></Button><button className="min-w-12 text-xs" onClick={() => setFit(true)} title={c.fit}>{Math.round(zoom * 100)}% <ChevronDown className="inline size-3" /></button><Button variant="ghost" size="icon" aria-label={c.zoomIn} onClick={() => { setFit(false); setZoom(value => Math.min(1.5, value + .1)); }}><Plus className="size-3" /></Button></div>
    </div>
    <div className="studio-workspace">
      <aside className={`studio-inspector ${toolsOpen ? "is-open" : ""}`} aria-label={c.openTools}>
        <div className="studio-inspector-tabs" role="tablist">{([{ key: "design", icon: LayoutTemplate, label: c.design }, { key: "sections", icon: List, label: c.sectionsTab }, { key: "ai", icon: Sparkles, label: c.ai }, { key: "job", icon: Briefcase, label: jobLabel }] as const).map(({ key, icon: Icon, label }) => <button type="button" key={key} id={`studio-tab-${key}`} className="studio-inspector-tab" role="tab" aria-controls={`studio-panel-${key}`} aria-selected={tab === key} onClick={() => setTab(key)}><Icon className="size-4" />{label}</button>)}</div>
        <Button variant="ghost" size="icon" className="studio-mobile-tools ml-auto mr-2 mt-2" aria-label={c.close} onClick={() => setToolsOpen(false)}><X className="size-4" /></Button>
        <div className="studio-panel" role="tabpanel" id={`studio-panel-${tab}`} aria-labelledby={`studio-tab-${tab}`}>
          {tab === "design" && <>
            <CareerMarketPanel country={document.design.targetMarket} language={document.design.documentLanguage} fr={fr}
              disabled={chatting || Boolean(pendingAI)}
              onCountry={(targetMarket: TargetMarket) => update(doc => ({ ...doc, design: { ...doc.design, targetMarket, paper: recommendedPaper(targetMarket) } }), "market")}
              onLanguage={value => design("documentLanguage", value)} />
            <div><span className="studio-panel-label">{c.templates}</span><div className="studio-template-grid">{(["accent", "classic", "minimal"] as const).map(layout => <button type="button" key={layout} className="studio-template" aria-pressed={document.design.headerStyle === layout} disabled={chatting || Boolean(pendingAI)} onClick={() => design("headerStyle", layout)}><div className="studio-template-paper" style={{ borderTop: layout === "accent" ? `3px solid ${document.design.accent}` : undefined }}><div style={{ height: 5, width: layout === "classic" ? "65%" : "80%", background: document.design.accent, margin: layout === "classic" ? "0 auto 6px" : "0 0 6px" }} />{Array.from({ length: 8 }, (_, index) => <div className="studio-template-lines" key={index} style={{ width: index % 3 === 2 ? "65%" : "100%" }} />)}</div>{c[layout === "accent" ? "modern" : layout]}</button>)}</div><p className="mt-3 text-[10px] leading-5 text-muted-foreground">{c.templateHint}</p></div>
            <div><span className="studio-panel-label">{fr ? "Couleur de la lettre" : "Letter color"}</span><div className="flex flex-wrap items-center gap-3">{accents.map(color => <button key={color} type="button" className="studio-swatch" style={{ background: color }} aria-label={`${fr ? "Couleur" : "Color"} ${color}`} aria-pressed={document.design.accent === color} disabled={chatting || Boolean(pendingAI)} onClick={() => design("accent", color)} />)}<input type="color" value={document.design.accent} aria-label={fr ? "Couleur personnalisée" : "Custom color"} className="size-7 cursor-pointer rounded border-0 bg-transparent" disabled={chatting || Boolean(pendingAI)} onChange={event => design("accent", event.target.value)} /></div></div>
            <label className="block"><span className="studio-panel-label">{c.font}</span><select className="h-9 w-full rounded-md border bg-background px-3 text-xs" value={document.design.font} disabled={chatting || Boolean(pendingAI)} onChange={event => design("font", event.target.value as CoverLetterDesign["font"])}>{(["sans", "serif", "mono"] as const).map(font => <option key={font} value={font}>{c[font]}</option>)}</select></label>
            {([{ key: "fontSize", label: c.fontSize, min: 11, max: 16, step: .5 }, { key: "lineHeight", label: c.spacing, min: 1.2, max: 2, step: .05 }, { key: "padding", label: c.margins, min: 32, max: 80, step: 2 }] as const).map(({ key, label, min, max, step }) => <label key={key}><span className="studio-panel-label flex justify-between">{label}<span className="font-normal text-muted-foreground">{document.design[key].toFixed(key === "lineHeight" ? 2 : 0)}</span></span><input className="w-full accent-primary" type="range" min={min} max={max} step={step} aria-label={label} value={document.design[key]} disabled={chatting || Boolean(pendingAI)} onChange={event => design(key, Number(event.target.value))} /></label>)}
            <div className="studio-ai-banner"><Sparkles className="mb-2 size-5 text-primary" /><p className="text-xs font-semibold">{c.aiTitle}</p><p className="mt-2 text-[11px] leading-5 text-muted-foreground">{chatHint}</p><Button size="sm" className="mt-4 w-full text-xs" onClick={() => setTab("ai")}><Sparkles className="size-3" />{c.ai}</Button></div>
          </>}
          {tab === "sections" && <><div><h2 className="text-sm font-semibold">{c.sectionsTab}</h2><p className="mt-2 text-[11px] leading-5 text-muted-foreground">{fr ? "Sélectionnez le texte à modifier dans votre lettre." : "Select the text to edit in your letter."}</p></div><div>{(Object.keys(fieldNames) as TextField[]).map(field => <button type="button" key={field} className="studio-section-row w-full text-left" aria-pressed={selected === field} onClick={() => focusField(field)}><span className="flex-1 text-xs">{fieldLabel(field)}</span><AlignLeft className="size-3 text-muted-foreground" /></button>)}</div></>}
          {tab === "ai" && <>
            <div><Sparkles className="mb-3 size-5 text-primary" /><h2 className="text-sm font-semibold">{c.aiTitle}</h2><p className="mt-2 text-[11px] leading-5 text-muted-foreground">{chatHint}</p></div>
            <div className="space-y-3 rounded-md border bg-muted/30 p-3" aria-busy={chatting}><div><p className="text-xs font-semibold">{c.chatTitle}</p><p className="mt-1 text-[11px] leading-5 text-muted-foreground">{c.chatHint}</p></div>
              {messages.length > 0 && <div className="max-h-64 space-y-2 overflow-y-auto pr-1" aria-live="polite">{messages.map((message, index) => <div key={index} className={message.role === "user" ? "rounded-md bg-primary p-2 text-[11px] leading-5 text-primary-foreground" : "rounded-md border bg-background p-2 text-[11px] leading-5"}><p className="whitespace-pre-wrap">{message.content}</p>{message.changes?.length ? <ul className="mt-2 list-disc space-y-1 pl-4 text-[10px] text-muted-foreground">{message.changes.map(change => <li key={change}>{change}</li>)}</ul> : null}</div>)}</div>}
              <div className="flex flex-wrap gap-1.5">{(fr ? [
                ["Plus naturel", "Améliore le ton pour qu'il soit naturel et professionnel, sans ajouter de nouveaux faits."],
                ["Plus concis", "Raccourcis la lettre sans perdre les preuves pertinentes et sans inventer d'informations."],
                ["Plus ciblé", "Adapte l'argumentation aux priorités de l'offre uniquement avec mes expériences confirmées."]
              ] : [
                ["More human", "Make this letter sound natural and professional without adding facts."],
                ["More concise", "Shorten the letter without losing relevant evidence or inventing facts."],
                ["Job-focused", "Tailor the argument to the job requirements using only confirmed evidence."]
              ]).map(([label, instruction]) => <Button key={label} size="sm" variant="outline" className="text-[10px]" disabled={chatting || Boolean(pendingAI)} onClick={() => setChat(instruction)}>{label}</Button>)}</div>
              {pendingAI && <div className="space-y-3 rounded-lg border border-primary/30 bg-background p-3" role="region" aria-label={fr ? "Proposition IA à approuver" : "AI proposal awaiting approval"}>
                <div><p className="text-xs font-semibold">{fr ? "Modifications proposées — non enregistrées" : "Suggested edits — not yet saved"}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">{fr ? "Vérifiez les faits et le ton avant d'accepter. Les propositions expirent après 15 minutes." : "Check facts and tone before accepting. Suggestions expire after 15 minutes."}</p>
                </div>
                <div className="max-h-80 space-y-3 overflow-y-auto" aria-live="polite">{pendingAI.diff.map(change => <div key={change.field} className="space-y-1 rounded-md border p-2">
                  <p className="text-[10px] font-semibold">{change.field}</p>
                  <p className="whitespace-pre-wrap break-words rounded bg-muted/50 p-2 text-[11px] line-through" aria-label={fr ? "Avant" : "Before"}>{change.before || "—"}</p>
                  <p className="whitespace-pre-wrap break-words rounded bg-primary/5 p-2 text-[11px]" aria-label={fr ? "Après" : "After"}>{change.after || "—"}</p>
                </div>)}</div>
                <div className="grid grid-cols-2 gap-2">
                  <Button size="sm" variant="outline" disabled={decidingAI} onClick={() => void decideAI("discard")}><X className="size-3" />{fr ? "Rejeter" : "Discard"}</Button>
                  <Button size="sm" disabled={decidingAI} onClick={() => void decideAI("accept")}>{decidingAI ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}{fr ? "Accepter" : "Approve"}</Button>
                </div>
              </div>}
              <form className="space-y-2" onSubmit={ask}><Textarea aria-label={c.chatInput} rows={4} maxLength={4000} value={chat} disabled={chatting || Boolean(pendingAI) || decidingAI} placeholder={fr ? "Ex. : raccourcis le deuxième paragraphe et passe les titres en bleu marine." : "E.g. shorten the second paragraph and use navy headings."} className="text-xs leading-5" onChange={event => setChat(event.target.value)} /><Button type="submit" size="sm" className="w-full text-xs" disabled={!chat.trim() || chatting || Boolean(pendingAI) || decidingAI}>{chatting ? <Loader2 className="size-3 animate-spin" /> : <Send className="size-3" />}{chatting ? c.chatWorking : c.chatSend}</Button></form>
            </div><div className="rounded-md border bg-muted/40 p-3"><p className="text-[9px] uppercase tracking-wider text-muted-foreground">{c.selected}</p><p className="mt-1 text-xs font-medium">{fieldLabel(selected)}</p><p className="mt-2 line-clamp-4 whitespace-pre-wrap text-[11px] leading-5 text-muted-foreground">{document[selected]}</p></div>
          </>}
          {tab === "job" && <><div><Briefcase className="mb-3 size-5 text-primary" /><h2 className="text-sm font-semibold">{jobLabel}</h2></div>{letter.job ? <div className="rounded-md border bg-muted/40 p-3"><p className="text-xs font-medium">{letter.job.title}</p><p className="mt-2 text-[11px] text-muted-foreground">{letter.job.company}</p><p className="mt-4 whitespace-pre-wrap text-[11px] leading-5 text-muted-foreground">{letter.job.description}</p></div> : <p className="text-xs text-muted-foreground">{fr ? "Aucune offre associée." : "No linked job posting."}</p>}<Button variant="outline" asChild><Link href={applicationId ? `/dashboard/applications/${encodeURIComponent(applicationId)}?tab=documents` : letter.cv ? `/dashboard/resumes/${letter.cv.id}` : "/dashboard/cover-letters"}>{back}</Link></Button></>}
        </div>
      </aside>
      <section ref={viewport} className="studio-canvas-viewport" aria-label={title}>
        <div className="studio-canvas-sizer" style={{ width: paperSize.width * zoom, height: canvasHeight * zoom }}><div ref={canvas} className="studio-canvas-pages" style={{ transform: `scale(${zoom})` }}>
          <article className="resume-paper cover-letter-paper" style={{ "--resume-accent": document.design.accent, width: paperSize.width, minHeight: paperSize.height, padding: document.design.padding, fontFamily: coverLetterFonts[document.design.font], fontSize: document.design.fontSize, lineHeight: document.design.lineHeight } as CSSProperties}>
            <header className="border-b pb-6" style={{ borderColor: document.design.headerStyle === "minimal" ? "#e2e8f0" : document.design.accent, borderBottomWidth: document.design.headerStyle === "accent" ? 4 : 1, textAlign: document.design.alignment }}><div className="text-xl font-semibold" style={{ color: document.design.accent }}>{editable("senderName")}</div><div className="mt-1 text-sm">{editable("sendertitle")}</div><div className="mt-3 text-xs">{editable("senderEmail")}{editable("senderPhone")}{editable("senderAddress")}</div></header>
            <div className="mt-10 grid grid-cols-2 gap-8 text-sm"><div>{editable("recipientName")}{editable("recipientTitle")}</div><div className="text-right">{editable("companyName")}{editable("companyAddress")}</div></div>
            <div className="mt-10 font-medium">{editable("positionTitle")}</div><div className="mt-9 space-y-5 whitespace-pre-wrap">{editable("introduction")}{editable("body")}{editable("conclusion")}</div><footer className="mt-10">{editable("senderName")}</footer>
          </article>
        </div></div><p className="studio-canvas-footer">{hint}</p>
      </section>
    </div>
  </div>;
}
