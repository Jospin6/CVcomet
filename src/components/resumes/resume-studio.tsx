"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { AlignLeft, AlignCenter, AlignRight, ArrowLeft, ArrowDown, ArrowUp, Bold, Check, ChevronDown, Download, GripVertical, Italic, LayoutTemplate, List, Loader2, Mail, Minus, Plus, Redo2, Save, ScanLine, Send, Sparkles, Underline, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { A4_HEIGHT, resumePaperDimensions, addResumeEntry, fieldValue, moveResumeSection, normalizeEditorResume, orderedSections, resumeContentSchema, resumeFieldHasBullets, resumeFieldSupportsBullets, resumeSections, setResumeField, type EditorResume, type ResumeDesign, type ResumePage, type ResumeSection } from "@/lib/resume-editor";
import { resumeEditorCopy } from "@/lib/resume-editor-copy";
import { resumeAtsCopy } from "@/lib/resume-ats-copy";
import { templateCatalog } from "@/lib/template-catalog";
import type { AtsIssue } from "@/lib/career/ats";
import { EditableResumeCanvas } from "./editable-resume-canvas";
import { ResumeAtsPanel } from "./resume-ats-panel";
import { LinkedCoverLetters, type LinkedCoverLetter } from "./linked-cover-letters";
import { recommendedPaper, type TargetMarket } from "@/lib/career-localization/markets";
import { CareerMarketPanel } from "./career-market-panel";
import "./resume-editor.css";

type History = { current: EditorResume | null; past: EditorResume[]; future: EditorResume[] };
type Action = "GENERATE" | "IMPROVE" | "SHORTEN" | "PROFESSIONAL" | "GRAMMAR" | "ATS";
type ChatMessage = { role: "user" | "assistant"; content: string; changes?: string[] };
type PendingResumeAI = { proposalId: string; baseRevision: number; expiresAt: string; preview: EditorResume;
  diff: { field: string; before: string; after: string }[]; changes: string[] };
const accents = ["#173F35", "#1E4B8F", "#6B4F3A", "#6D3A65", "#111827", "#B35435"];

export function ResumeEditor() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { i18n } = useTranslation();
  const locale = i18n.resolvedLanguage?.startsWith("fr") ? "fr" : "en";
  const c = resumeEditorCopy[locale], atsCopy = resumeAtsCopy[locale];
  const { user: session } = useCurrentUser();
  const [history, setHistory] = useState<History>({ current: null, past: [], future: [] });
  const resume = history.current;
  const paperSize = resumePaperDimensions(resume?.design.paper ?? "A4");
  const current = useRef<EditorResume | null>(null); current.current = resume;
  const revision = useRef(0), savedSignature = useRef("");
  const saveLock = useRef<Promise<boolean> | null>(null), editGroup = useRef({ key: "", time: 0 });
  const [status, setStatus] = useState<"saved" | "unsaved" | "saving" | "error">("saved");
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"design" | "sections" | "ai" | "ats">("design");
  const [toolsOpen, setToolsOpen] = useState(false), [preview, setPreview] = useState(false);
  const [selected, setSelected] = useState("summary.0"), [pages, setPages] = useState<ResumePage[]>([]);
  const [zoom, setZoom] = useState(.85), [fit, setFit] = useState(true), [canvasHeight, setCanvasHeight] = useState(A4_HEIGHT);
  const viewport = useRef<HTMLDivElement>(null), canvas = useRef<HTMLDivElement>(null);
  const [notes, setNotes] = useState(""), [action, setAction] = useState<Action>("GENERATE");
  const [language, setLanguage] = useState<"fr" | "en">(i18n.resolvedLanguage?.startsWith("fr") ? "fr" : "en");
  const [generating, setGenerating] = useState(false), [exporting, setExporting] = useState(false), [aiError, setAIError] = useState("");
  const [proposal, setProposal] = useState<{ path: string; text: string; original: string } | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]), [chatInput, setChatInput] = useState("");
  const [chatting, setChatting] = useState(false), [chatError, setChatError] = useState("");
  const [pendingAI, setPendingAI] = useState<PendingResumeAI | null>(null);
  const [reviewPreview, setReviewPreview] = useState(false);
  const [deciding, setDeciding] = useState(false);
  const [creatingLetter, setCreatingLetter] = useState(false), [letterError, setLetterError] = useState("");
  const [coverLetters, setCoverLetters] = useState<LinkedCoverLetter[]>([]);
  const chatLock = useRef<"idle" | "saving" | "request">("idle");
  const chatRequest = useRef<AbortController | null>(null);
  const documentId = useRef(id); documentId.current = id;

  useEffect(() => () => { chatRequest.current?.abort(); chatLock.current = "idle"; }, [id]);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("ats") === "1") { setTab("ats"); setToolsOpen(true); }
  }, [id]);

  useEffect(() => {
    if (!session?.id) return;
    let active = true;
    setCoverLetters([]);
    setHistory({ current: null, past: [], future: [] }); setError(""); setProposal(null); setPendingAI(null); setReviewPreview(false); setChatMessages([]); setChatInput(""); setChatError(""); setChatting(false);
    fetch(`/api/cvs/${id}`, { cache: "no-store" }).then(async response => { if (!response.ok) throw Error("LOAD_FAILED"); return response.json(); }).then(data => {
      if (!active) return;
      setCoverLetters(data.coverLetters || []);
      const document = normalizeEditorResume(data, { name: session.name || "", email: session.email });
      savedSignature.current = JSON.stringify(document); revision.current = data.revision || 0;
      setHistory({ current: document, past: [], future: [] }); setStatus("saved");
    }).catch(() => { if (active) setError("LOAD_FAILED"); });
    return () => { active = false; };
  }, [id, session?.id]);

  const change = useCallback((update: (doc: EditorResume) => EditorResume, key = "change") => {
    if (chatLock.current !== "idle") return;
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
    setPendingAI(null); setReviewPreview(false);
    setStatus(previous => previous === "saving" ? "saving" : "unsaved"); setError(previous => previous === "CONFLICT" ? previous : "");
  }, []);
  const onField = useCallback((path: string, value: string) => change(doc => setResumeField(doc, path, value), path), [change]);
  const design = <K extends keyof ResumeDesign>(key: K, value: ResumeDesign[K]) => change(doc => ({ ...doc, design: { ...doc.design, [key]: value } }), "design:" + key);
  const add = (section: ResumeSection) => change(doc => addResumeEntry(doc, section));
  const remove = (section: ResumeSection, index: number) => change(doc => ({ ...doc, [section]: doc[section].filter((_, i) => i !== index) }));
  const duplicate = (section: ResumeSection, index: number) => change(doc => { const next = structuredClone(doc); (next[section] as unknown[]).splice(index + 1, 0, structuredClone(next[section][index])); return next; });
  const move = (section: ResumeSection, target: ResumeSection) => change(doc => ({ ...doc, design: moveResumeSection(doc.design, section, orderedSections(doc.design).indexOf(target)) }));
  const undoRedo = (redo: boolean) => {
    if (chatLock.current !== "idle") return;
    editGroup.current = { key: "", time: 0 };
    setHistory(previous => {
      if (!previous.current) return previous;
      const source = redo ? previous.future : previous.past;
      if (!source.length) return previous;
      return redo ? { current: source[0], future: source.slice(1), past: [...previous.past, previous.current] }
        : { current: source.at(-1)!, past: source.slice(0, -1), future: [previous.current, ...previous.future] };
    }); setPendingAI(null); setReviewPreview(false); setStatus(previous => previous === "saving" ? "saving" : "unsaved");
  };

  const save = useCallback(async () => {
    if (chatLock.current === "request") return false;
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
    const observer = new ResizeObserver(entries => { if (fit) setZoom(Math.max(.25, Math.min(1, (entries[0].contentRect.width - 48) / paperSize.width))); });
    observer.observe(viewport.current); return () => observer.disconnect();
  }, [Boolean(resume), fit, resume?.design.paper]);
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
  const navigateAtsIssue = (issue: AtsIssue) => {
    if (issue.design) {
      setTab("design"); setToolsOpen(true);
      requestAnimationFrame(() => {
        const target = issue.design === "layout" ? document.querySelector<HTMLElement>(".studio-template[aria-pressed=true]")
          : Array.from(document.querySelectorAll<HTMLInputElement>(".studio-panel input[type=range]")).find(input => input.getAttribute("aria-label") === (issue.design === "fontSize" ? c.fontSize : c.spacing));
        target?.scrollIntoView({ block: "nearest", behavior: "smooth" }); target?.focus({ preventScroll: true });
      });
      return;
    }
    if (!issue.field) return;
    const path = issue.field, section = path.split(".")[0] as ResumeSection;
    if (resumeSections.includes(section)) change(doc => {
      let next = doc[section].length ? doc : addResumeEntry(doc, section);
      if (next.design.hiddenSections.includes(section)) next = { ...next, design: { ...next.design, hiddenSections: next.design.hiddenSections.filter(key => key !== section) } };
      return next;
    });
    setPreview(false); setSelected(path); setToolsOpen(false);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const target = Array.from(canvas.current?.querySelectorAll<HTMLElement>("[data-resume-page] [data-field]") || []).find(field => field.dataset.field === path);
      target?.scrollIntoView({ block: "center", behavior: "smooth" }); target?.focus({ preventScroll: true });
    }));
  };
  const generate = async () => {
    if (!resume || generating || chatLock.current !== "idle") return;
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
  const sendConversation = async (event: React.FormEvent) => {
    event.preventDefault();
    const instruction = chatInput.trim();
    if (!instruction || !resume || generating || pendingAI || chatLock.current !== "idle") return;
    chatLock.current = "saving";
    setChatting(true); setChatError("");
    let appended = false;
    const controller = new AbortController(); chatRequest.current = controller;
    try {
      if (!await save()) throw Error("SAVE_FAILED");
      // A save already in flight may contain an older draft; flush the current draft before AI reads it.
      if (JSON.stringify(current.current) !== savedSignature.current && !await save()) throw Error("SAVE_FAILED");
      if (controller.signal.aborted || documentId.current !== id) return;
      const requestSignature = savedSignature.current;
      chatLock.current = "request";
      setChatInput(""); setChatMessages(previous => [...previous, { role: "user", content: instruction }]); appended = true;
      const response = await fetch(`/api/cvs/${id}/assistant`, { method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.any([controller.signal, AbortSignal.timeout(60000)]), body: JSON.stringify({ instruction, language, revision: revision.current, selectedField: selected, history: chatMessages.slice(-8).map(({ role, content }) => ({ role, content })) }) });
      const data = await response.json();
      if (controller.signal.aborted || documentId.current !== id) return;
      if (!response.ok) throw Error(data.error || "AI_FAILED");
      if (data.status === "clarification") {
        setChatMessages(previous => [...previous, { role: "assistant", content: data.message }]);
        return;
      }
      if (JSON.stringify(current.current) !== requestSignature) throw Error("CONFLICT");
      if (data.status !== "proposal" || !data.proposalId || !data.preview) throw Error("AI_INVALID_RESPONSE");
      const suggested = normalizeEditorResume(data.preview, { name: session?.name || "", email: session?.email });
      if (data.baseRevision !== revision.current) throw Error("CONFLICT");
      setPendingAI({ proposalId: data.proposalId, baseRevision: data.baseRevision, preview: suggested,
        diff: data.diff || [], expiresAt: data.expiresAt, changes: data.changes || [] });
      setReviewPreview(true);
      setChatMessages(previous => [...previous, { role: "assistant", content: data.message,
        changes: data.changes }]);
    } catch (cause) {
      if (controller.signal.aborted || documentId.current !== id) return;
      const code = cause instanceof Error ? cause.name === "TimeoutError" ? "AI_TIMEOUT" : cause.message : "AI_FAILED";
      setChatError(code); if (appended) setChatMessages(previous => previous.slice(0, -1)); setChatInput(instruction);
      if (code === "CONFLICT") { setError("CONFLICT"); setStatus("error"); }
    } finally {
      if (chatRequest.current === controller) { chatLock.current = "idle"; setChatting(false); chatRequest.current = null; }
    }
  };
  const decideConversation = async (action: "accept" | "discard") => {
    const proposal = pendingAI;
    if (!proposal || deciding || chatLock.current !== "idle") return;
    if (action === "accept" && (JSON.stringify(current.current) !== savedSignature.current || revision.current !== proposal.baseRevision)) {
      setChatError("CONFLICT"); return;
    }
    chatLock.current = "request"; setDeciding(true); setChatError("");
    try {
      const response = await fetch(`/api/cvs/${id}/assistant/decision`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposalId: proposal.proposalId, action }),
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error || "AI_FAILED");
      if (documentId.current !== id) return;
      if (action === "accept") {
        const updated = normalizeEditorResume(data.document, { name: session?.name || "", email: session?.email });
        current.current = updated; revision.current = data.revision; savedSignature.current = JSON.stringify(updated);
        editGroup.current = { key: "", time: 0 };
        setHistory(previous => previous.current ? { current: updated,
          past: [...previous.past.slice(-59), previous.current], future: [] } : previous);
        setStatus("saved");
      }
      setChatMessages(previous => [...previous, { role: "assistant", content: action === "accept"
        ? locale === "fr" ? "Modifications acceptées et enregistrées." : "Changes approved and saved."
        : locale === "fr" ? "Proposition rejetée. Le CV reste inchangé." : "Proposal discarded. The resume was not changed." }]);
      setPendingAI(null); setReviewPreview(false);
    } catch (cause) {
      if (documentId.current !== id) return;
      setChatError(cause instanceof Error ? cause.message : "AI_FAILED");
    } finally { chatLock.current = "idle"; setDeciding(false); }
  };
  const reviewAtsProposal = (issue: AtsIssue) => {
    if (!issue.field || !issue.proposedText || !current.current) return;
    setSelected(issue.field); setTab("ai"); setToolsOpen(true); setAIError("");
    setProposal({ path: issue.field, text: issue.proposedText, original: fieldValue(current.current, issue.field) });
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
    if (!current.current || exporting || Boolean(pendingAI && reviewPreview)) return;
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
  const exportDOCX = async () => {
    if (!current.current || pendingAI || exporting) return;
    if (!await save()) return;
    setExporting(true); setError("");
    try {
      const response = await fetch(`/api/cvs/${id}/export/docx?language=${locale}`, { cache: "no-store" });
      if (!response.ok) throw Error("EXPORT_FAILED");
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a"); anchor.href = url;
      anchor.download = (current.current?.design.documentName || current.current?.contact.name || c.untitled).replace(/[\\/:*?"<>|]/g, "_") + ".docx";
      document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch { setError("EXPORT_FAILED"); }
    finally { setExporting(false); }
  };
  const createCoverLetter = async () => {
    if (creatingLetter || !await save()) return;
    setCreatingLetter(true); setLetterError("");
    try {
      const response = await fetch(`/api/cvs/${id}/cover-letters`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ language }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "LETTER_FAILED");
      router.push(`/dashboard/cover-letters/${data.id}`);
    } catch (cause) { setLetterError(cause instanceof Error ? cause.message : "LETTER_FAILED"); }
    finally { setCreatingLetter(false); }
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
  const chatMessage = ["PROPOSAL_EXPIRED_OR_STALE", "PROPOSAL_DECIDED", "EVIDENCE_CHANGED"].includes(chatError) ? (locale === "fr" ? "La proposition a expiré ou son contexte a changé. Rechargez le CV et demandez une nouvelle proposition." : "The proposal expired or its context changed. Reload the resume and request a new proposal.") : chatError === "UNSUPPORTED_FACTS" ? (locale === "fr" ? "L’IA a proposé un chiffre sans source fournie. Ajoutez une preuve avant de réessayer." : "AI suggested a number without a user-provided source. Add evidence and retry.") : chatError === "CONFLICT" ? c.conflict : chatError === "SAVE_FAILED" ? c.saveError : ["AI_LIMIT", "AI_RATE_LIMIT"].includes(chatError) ? c.aiLimit : chatError === "AI_AUTH_ERROR" ? c.aiAuth : chatError === "AI_MODEL_UNAVAILABLE" ? c.aiModel : chatError === "AI_TIMEOUT" ? c.aiTimeout : ["AI_UNAVAILABLE", "AI_PROVIDER_UNAVAILABLE"].includes(chatError) ? c.aiUnavailable : chatError === "AI_INVALID_EDIT" || chatError === "AI_INVALID_RESPONSE" ? c.chatInvalid : chatError === "AI_FAILED" ? c.aiFailed : c.chatError;

  if (!resume) return <div className="rounded-xl border bg-card p-10 text-center"><p role={error ? "alert" : "status"} className="text-sm text-muted-foreground">{error ? c.loadError : c.loading}</p>{!error && <Loader2 className="mx-auto mt-4 size-5 animate-spin text-primary" />}<Button className="mt-6" variant="outline" asChild><Link href="/dashboard/resumes"><ArrowLeft />{c.back}</Link></Button></div>;
  return <div className="resume-studio">
    <header className="studio-header"><Button variant="ghost" size="icon" asChild><Link href="/dashboard/resumes" aria-label={c.back}><ArrowLeft className="size-4" /></Link></Button><div><p className="text-[9px] font-semibold uppercase tracking-[.18em] text-primary">CVcomet / {c.title}</p><Input className="studio-document-name" aria-label={c.name} maxLength={160} value={resume.design.documentName} placeholder={c.untitled} onChange={event => design("documentName", event.target.value)} /><p className="studio-save-status" role="status">{status === "saving" ? <Loader2 className="size-3 animate-spin" /> : status === "saved" ? <Check className="size-3 text-primary" /> : <span className="size-1.5 rounded-full bg-amber-500" />}{c[status === "error" ? "saveError" : status]}</p></div>
      <div className="studio-header-actions"><LinkedCoverLetters letters={coverLetters} /><Button variant="outline" disabled={creatingLetter || status === "saving"} onClick={() => void createCoverLetter()}>{creatingLetter ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}{locale === "fr" ? "Générer une lettre" : "Generate cover letter"}</Button><Button variant={tab === "ats" ? "secondary" : "outline"} aria-controls="studio-panel-ats" aria-expanded={tab === "ats"} onClick={() => { setTab("ats"); setToolsOpen(true); }}><ScanLine className="size-4" />{atsCopy.title}</Button><Button variant="outline" disabled={status === "saving"} onClick={() => void save()}><Save className="size-4" />{c.save}</Button><Button variant="outline" disabled={exporting || Boolean(pendingAI) || status === "saving"} onClick={() => void exportDOCX()}><Download className="size-4" />DOCX</Button><Button disabled={exporting || !pages.length || Boolean(pendingAI && reviewPreview)} onClick={() => void exportPDF()}>{exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}{exporting ? c.exporting : c.export}</Button></div>
    </header>
    {error && <p role="alert" className="mb-4 rounded-lg border border-destructive/25 bg-destructive/5 p-3 text-sm text-destructive">{error === "CONFLICT" ? c.conflict : error === "EXPORT_FAILED" ? c.exportError : c.saveError}</p>}
    {letterError && <p role="alert" className="mb-4 rounded-lg border border-destructive/25 bg-destructive/5 p-3 text-sm text-destructive">{letterError === "JOB_REQUIRED" ? (locale === "fr" ? "Cette lettre doit être générée depuis une offre associée à ce CV. Analysez d’abord l’offre avec ce CV." : "This letter must be generated from a job posting linked to this resume. Analyze the job posting with this resume first.") : (locale === "fr" ? "La lettre n’a pas pu être générée. Réessayez." : "The cover letter could not be generated. Please try again.")}</p>}
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
    <div className={`studio-workspace ${tab === "ats" ? "is-ats" : ""}`}>
      <aside className={`studio-inspector ${toolsOpen ? "is-open" : ""}`} aria-label={c.openTools}>
        <div className="studio-inspector-tabs" role="tablist">{([{ key: "design", icon: LayoutTemplate, label: c.design }, { key: "sections", icon: List, label: c.sectionsTab }, { key: "ai", icon: Sparkles, label: c.ai }, { key: "ats", icon: ScanLine, label: atsCopy.tab }] as const).map(({ key, icon: Icon, label }) => <button type="button" key={key} id={`studio-tab-${key}`} className="studio-inspector-tab" role="tab" aria-controls={`studio-panel-${key}`} aria-selected={tab === key} onClick={() => setTab(key)}><Icon className="size-4" />{label}</button>)}</div>
        <Button variant="ghost" size="icon" className="studio-mobile-tools ml-auto mr-2 mt-2" aria-label={c.close} onClick={() => setToolsOpen(false)}><X className="size-4" /></Button>
        <div className="studio-panel" role="tabpanel" id={`studio-panel-${tab}`} aria-labelledby={`studio-tab-${tab}`}>
          {tab === "design" && <>
            <CareerMarketPanel country={resume.design.targetMarket} language={resume.design.documentLanguage} fr={locale === "fr"}
              disabled={Boolean(pendingAI)}
              onCountry={(targetMarket: TargetMarket) => change(doc => ({ ...doc, design: { ...doc.design, targetMarket, paper: recommendedPaper(targetMarket) } }), "market")}
              onLanguage={value => design("documentLanguage", value)} />
            <div><span className="studio-panel-label">{c.templates}</span><div className="studio-template-grid">{(["modern", "classic", "minimal"] as const).map(layout => <button type="button" key={layout} className="studio-template" aria-pressed={resume.design.layout === layout} onClick={() => design("layout", layout)}><div className="studio-template-paper" style={{ borderTop: layout === "modern" ? `3px solid ${resume.design.accent}` : undefined }}><div style={{ height: 5, width: layout === "classic" ? "65%" : "80%", background: resume.design.accent, margin: layout === "classic" ? "0 auto 6px" : "0 0 6px" }} /><div style={{ display: "flex", gap: 4 }}>{layout === "modern" && <div style={{ width: "28%", background: "#EEF3F0", height: 53 }} />}<div style={{ flex: 1 }}>{Array.from({ length: 8 }, (_, index) => <div className="studio-template-lines" key={index} style={{ width: index % 3 === 2 ? "65%" : "100%" }} />)}</div></div></div>{c[layout]}</button>)}</div><label className="mt-4 block"><span className="studio-panel-label">Studio catalogue</span><select aria-label="Change template" className="h-9 w-full rounded-md border bg-background px-3 text-xs" value={resume.design.templateId || ""} onChange={event => { const template = templateCatalog.find(item => item.id === event.target.value); if (!template || template.type !== "CV") return; change(doc => ({ ...doc, design: { ...doc.design, templateId: template.id, templateVersion: template.version, composition: template.composition, functionalType: template.functionalType, layout: template.layout, accent: template.accent, font: template.font, paper: template.paper } }), "template"); }}><option value="">Custom layout</option>{templateCatalog.filter(item => item.type === "CV").map(template => <option key={template.id} value={template.id}>{template.name} · {template.functionalType.replaceAll("_", " ")}</option>)}</select></label><p className="mt-3 text-[10px] leading-5 text-muted-foreground">{c.templateHint}</p></div>
            <div><span className="studio-panel-label">{c.accent}</span><div className="flex flex-wrap items-center gap-3">{accents.map(color => <button key={color} type="button" className="studio-swatch" style={{ background: color }} aria-label={c.accent + " " + color} aria-pressed={resume.design.accent === color} onClick={() => design("accent", color)} />)}<input type="color" value={resume.design.accent} aria-label={c.accent} className="size-7 cursor-pointer rounded border-0 bg-transparent" onChange={event => design("accent", event.target.value)} /></div></div>
            <label className="block"><span className="studio-panel-label">{c.font}</span><select className="h-9 w-full rounded-md border bg-background px-3 text-xs" value={resume.design.font} onChange={event => design("font", event.target.value as ResumeDesign["font"])}>{(["sans", "serif", "mono"] as const).map(font => <option key={font} value={font}>{c[font]}</option>)}</select></label>
            {[{ key: "fontSize", label: c.fontSize, min: 11, max: 16, step: .5 }, { key: "lineHeight", label: c.spacing, min: 1.2, max: 1.8, step: .05 }, { key: "padding", label: c.margins, min: 28, max: 64, step: 2 }].map(({ key, label, min, max, step }) => <label key={key}><span className="studio-panel-label flex justify-between">{label}<span className="font-normal text-muted-foreground">{Number(resume.design[key as "fontSize" | "lineHeight" | "padding"]).toFixed(key === "lineHeight" ? 2 : 0)}</span></span><input className="w-full accent-primary" type="range" min={min} max={max} step={step} aria-label={label} value={resume.design[key as "fontSize" | "lineHeight" | "padding"]} onChange={event => design(key as "fontSize" | "lineHeight" | "padding", Number(event.target.value))} /></label>)}
            <div className="studio-ai-banner"><Sparkles className="mb-2 size-5 text-primary" /><p className="text-xs font-semibold">{c.aiTitle}</p><p className="mt-2 text-[11px] leading-5 text-muted-foreground">{c.aiHint}</p><Button size="sm" className="mt-4 w-full text-xs" onClick={() => openAI("summary.0")}><Sparkles className="size-3" />{c.addSummary}</Button></div>
          </>}
          {tab === "sections" && <><div><h2 className="text-sm font-semibold">{c.structure}</h2><p className="mt-2 text-[11px] leading-5 text-muted-foreground">{c.structureHint}</p></div><div>{[...new Set([...resume.design.sectionOrder, ...resumeSections])].map((section, index) => <div key={section} className="studio-section-row"><GripVertical className="size-3 shrink-0 text-muted-foreground" /><input type="checkbox" className="size-3 accent-primary" aria-label={c.visible + " " + c.sections[section]} checked={!resume.design.hiddenSections.includes(section)} onChange={event => design("hiddenSections", event.target.checked ? resume.design.hiddenSections.filter(key => key !== section) : [...resume.design.hiddenSections, section])} /><span className="flex-1 text-xs">{c.sections[section]}</span><button type="button" className="p-1" title={c.add} aria-label={c.add + " " + c.sections[section]} onClick={() => add(section)}><Plus className="size-3" /></button><button type="button" className="p-1 disabled:opacity-30" disabled={index === 0} aria-label={c.moveUp + " " + c.sections[section]} onClick={() => change(doc => ({ ...doc, design: moveResumeSection(doc.design, section, index - 1) }))}><ArrowUp className="size-3" /></button><button type="button" className="p-1 disabled:opacity-30" disabled={index === 6} aria-label={c.moveDown + " " + c.sections[section]} onClick={() => change(doc => ({ ...doc, design: moveResumeSection(doc.design, section, index + 1) }))}><ArrowDown className="size-3" /></button></div>)}</div></>}
          {tab === "ai" && <>
            <div><Sparkles className="mb-3 size-5 text-primary" /><h2 className="text-sm font-semibold">{c.aiTitle}</h2><p className="mt-2 text-[11px] leading-5 text-muted-foreground">{c.aiHint}</p></div>
            <div className="space-y-3 rounded-md border bg-muted/30 p-3" aria-busy={chatting}>
              <div><p className="text-xs font-semibold">{c.chatTitle}</p><p className="mt-1 text-[11px] leading-5 text-muted-foreground">{c.chatHint}</p></div>
              {chatMessages.length > 0 && <div className="max-h-64 space-y-2 overflow-y-auto pr-1" aria-live="polite">{chatMessages.map((message, index) => <div key={index} className={message.role === "user" ? "rounded-md bg-primary p-2 text-[11px] leading-5 text-primary-foreground" : "rounded-md border bg-background p-2 text-[11px] leading-5"}><p className="whitespace-pre-wrap">{message.content}</p>{message.changes?.length ? <ul className="mt-2 list-disc space-y-1 pl-4 text-[10px] text-muted-foreground">{message.changes.map(change => <li key={change}>{change}</li>)}</ul> : null}</div>)}</div>}
              {!chatMessages.length && <div className="flex flex-wrap gap-1.5">{c.chatSuggestions.map(suggestion => <Button key={suggestion} type="button" variant="outline" size="sm" className="h-auto whitespace-normal px-2 py-1 text-left text-[10px]" onClick={() => setChatInput(suggestion)}>{suggestion}</Button>)}</div>}
              {pendingAI && <section className="space-y-3 rounded-lg border border-primary/30 bg-background p-3" aria-label={locale === "fr" ? "Révision de la proposition IA" : "AI proposal review"}>
                <div className="flex items-center justify-between gap-2"><p className="text-xs font-semibold">{locale === "fr" ? "Modifications proposées — aucune modification enregistrée" : "Proposed changes — nothing saved yet"}</p><span className="text-[10px] text-muted-foreground">{locale === "fr" ? "Valable 15 min" : "Valid 15 min"}</span></div>
                <p className="text-[11px] leading-5 text-muted-foreground">{locale === "fr" ? "Vérifiez les faits et les chiffres. Les informations du coffre sont confirmées par leur propriétaire, pas vérifiées indépendamment." : "Review facts and numbers. Vault facts are owner-confirmed, not independently verified."}</p>
                <div className="max-h-72 space-y-2 overflow-y-auto">{pendingAI.diff.map((item, index) => <div key={item.field + index} className="rounded border p-2 text-[11px]">
                  <p className="mb-2 font-semibold break-all">{item.field}</p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2"><div><p className="text-[10px] font-semibold text-muted-foreground">{locale === "fr" ? "Avant" : "Before"}</p><p className="max-h-32 overflow-y-auto whitespace-pre-wrap break-words">{item.before || "—"}</p></div><div><p className="text-[10px] font-semibold text-muted-foreground">{locale === "fr" ? "Après" : "After"}</p><p className="max-h-32 overflow-y-auto whitespace-pre-wrap break-words">{item.after || "—"}</p></div></div>
                </div>)}</div>
                <Button type="button" size="sm" variant="outline" className="w-full" onClick={() => setReviewPreview(value => !value)}>{reviewPreview ? locale === "fr" ? "Voir mon CV actuel" : "Show current resume" : locale === "fr" ? "Aperçu visuel proposé" : "Preview suggested resume"}</Button>
                <div className="grid grid-cols-2 gap-2"><Button type="button" size="sm" disabled={deciding} onClick={() => void decideConversation("accept")}><Check className="size-3" />{locale === "fr" ? "Accepter" : "Approve"}</Button><Button type="button" variant="outline" size="sm" disabled={deciding} onClick={() => void decideConversation("discard")}><X className="size-3" />{locale === "fr" ? "Rejeter" : "Discard"}</Button></div>
              </section>}
              <form className="space-y-2" onSubmit={sendConversation}><Textarea aria-label={c.chatInput} rows={4} maxLength={4000} value={chatInput} disabled={chatting || Boolean(pendingAI)} onChange={event => setChatInput(event.target.value)} placeholder={c.chatPlaceholder} className="text-xs leading-5" /><Button type="submit" size="sm" className="w-full text-xs" disabled={chatting || Boolean(pendingAI) || !chatInput.trim()}>{chatting ? <Loader2 className="size-3 animate-spin" /> : <Send className="size-3" />}{chatting ? c.chatWorking : c.chatSend}</Button></form>
              {chatError && <p role="alert" className="text-[11px] leading-5 text-destructive">{chatMessage}</p>}
            </div>
            <div className="rounded-md border bg-muted/40 p-3"><p className="text-[9px] uppercase tracking-wider text-muted-foreground">{c.selected}</p><p className="mt-1 text-xs font-medium">{selectedLabel}</p><p className="mt-2 line-clamp-4 whitespace-pre-wrap text-[11px] leading-5 text-muted-foreground">{fieldValue(resume, aiPath) || c.selectionHelp}</p></div>
            <label><span className="studio-panel-label">{c.notes}</span><Textarea rows={5} maxLength={8000} value={notes} onChange={event => setNotes(event.target.value)} placeholder={c.notesPlaceholder} className="text-xs leading-6" /><p className="mt-2 text-[10px] leading-5 text-muted-foreground">{c.notesHint}</p></label>
            <label><span className="studio-panel-label">{c.action}</span><select className="h-9 w-full rounded-md border bg-background px-3 text-xs" value={action} onChange={event => setAction(event.target.value as Action)}>{(["GENERATE", "IMPROVE", "SHORTEN", "PROFESSIONAL", "GRAMMAR", "ATS"] as const).map(value => <option key={value} value={value}>{c[value]}</option>)}</select></label>
            <label><span className="studio-panel-label">{c.language}</span><select className="h-9 w-full rounded-md border bg-background px-3 text-xs" value={language} onChange={event => setLanguage(event.target.value as "fr" | "en")}><option value="fr">Français</option><option value="en">English</option></select></label>
            <Button disabled={generating} onClick={() => void generate()}>{generating ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}{generating ? c.generating : c.generate}</Button>
            {aiError && <p role="alert" className="text-xs leading-5 text-destructive">{aiMessage}</p>}
            {proposal && <div className="space-y-3"><p className="text-xs font-semibold">{c.proposal}</p><Textarea aria-label={c.proposal} rows={8} value={proposal.text} onChange={event => setProposal({ ...proposal, text: event.target.value })} className="studio-ai-proposal" /><p className="text-[10px] leading-5 text-muted-foreground">{c.reviewHint}</p><Button className="w-full text-xs" onClick={applyProposal}><Check className="size-3" />{c.apply}</Button><Button variant="ghost" className="w-full text-xs" onClick={() => setProposal(null)}>{c.discard}</Button></div>}
          </>}
          <div hidden={tab !== "ats"}><ResumeAtsPanel key={id} cvId={id} resume={resume} pages={pages} language={locale} active={tab === "ats"} onNavigate={navigateAtsIssue} onProposal={reviewAtsProposal} /></div>
        </div>
      </aside>
      <section ref={viewport} className="studio-canvas-viewport" aria-label={c.title}>
        <div className="studio-canvas-sizer" style={{ width: paperSize.width * zoom, height: canvasHeight * zoom }}><div ref={canvas} className="studio-canvas-pages" style={{ transform: `scale(${zoom})` }}><EditableResumeCanvas resume={pendingAI && reviewPreview ? pendingAI.preview : resume} pages={pages} copy={c} selected={selected} preview={preview || Boolean(pendingAI && reviewPreview)} onField={onField} onSelect={setSelected} onAdd={add} onRemove={remove} onDuplicate={duplicate} onMove={move} onAI={openAI} onPages={setPages} /></div></div>
        <p className="studio-canvas-footer">{c.hint}</p>
      </section>
    </div>
  </div>;
}
