"use client";

import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FileText, Link2, Sparkles, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useApi } from "@/components/career/data-state";
import { jobCopy } from "@/lib/career/job-copy";
import { MAX_JOB_TEXT, MIN_JOB_TEXT, type JobSource } from "@/lib/career/job-schema";
import { MAX_RESUME_SIZE } from "@/lib/resume-documents";

export async function jobRequest<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, body === undefined ? { cache: "no-store" } : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "UNAVAILABLE");
  return data as T;
}

export function useJobAnalysisForm<T>({ language, onAnalyzed, onTextChanged, onExtracted }: {
  language: "fr" | "en";
  onAnalyzed: (data: T) => void | Promise<void>;
  onTextChanged?: () => void;
  onExtracted?: () => void;
}) {
  const { i18n } = useTranslation();
  const c = jobCopy[i18n.resolvedLanguage?.startsWith("fr") ? "fr" : "en"];
  const resumes = useApi<{ id: string; title: string; design?: { documentName?: string } }[]>("/api/cvs?mine=1");
  const [mode, setMode] = useState<JobSource["type"]>("TEXT"), [url, setUrl] = useState("");
  const [text, setText] = useState(""), [source, setSource] = useState<JobSource>({ type: "TEXT" });
  const [confirmed, setConfirmed] = useState(false), [cvId, setCvId] = useState("");
  const [busy, setBusy] = useState(""), [error, setError] = useState(""), [message, setMessage] = useState("");
  const pending = useRef(false);
  const act = async (key: string, work: () => Promise<void>) => {
    if (busy || pending.current) return;
    pending.current = true;
    setBusy(key); setError(""); setMessage("");
    try { await work(); } catch (failure) { setError(failure instanceof Error ? failure.message : "UNAVAILABLE"); }
    finally { pending.current = false; setBusy(""); }
  };
  const extract = async (file?: File) => act("extract", async () => {
    if (file && file.size > MAX_RESUME_SIZE) throw new Error("TOO_LARGE");
    let response: Response;
    if (file) { const form = new FormData(); form.append("file", file); response = await fetch("/api/job-match/extract", { method: "POST", body: form }); }
    else response = await fetch("/api/job-match/extract", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) });
    const data = await response.json();
    if (!response.ok) { const code = data.error in c.errors ? data.error : data.message || data.error; throw new Error(code); }
    setText(data.text); setSource(data.source); setConfirmed(false); onExtracted?.();
  });
  const ready = text.trim().length >= MIN_JOB_TEXT && text.length <= MAX_JOB_TEXT && confirmed && !busy;
  const analyze = () => act("analyze", async () => {
    if (!ready) return;
    const data = await jobRequest<T>("/api/job-match", { text, source: { ...source, originalText: source.originalText || text }, confirmed: true, cvId: cvId || undefined, language });
    await onAnalyzed(data);
  });
  const changeText = (value: string) => { setText(value); setConfirmed(false); onTextChanged?.(); };
  const errorText = error in c.errors ? c.errors[error as keyof typeof c.errors] : error && !/^[A-Z_]+$/.test(error) ? error : c.genericError;
  return { c, resumes, mode, setMode, url, setUrl, text, setText, source, setSource, confirmed, setConfirmed, cvId, setCvId, busy, setBusy, error, setError, message, setMessage, act, extract, ready, analyze, changeText, errorText };
}

export function JobAnalysisForm({ form }: { form: ReturnType<typeof useJobAnalysisForm> }) {
  const { c, resumes, mode, setMode, url, setUrl, text, setSource, confirmed, setConfirmed, cvId, setCvId, busy, setError, act, extract, ready, analyze, changeText } = form;
  return <div className="min-w-0 space-y-5" aria-busy={!!busy}>
    <div className="flex flex-wrap gap-2">{([{ key: "TEXT", label: c.text, icon: FileText }, { key: "URL", label: c.url, icon: Link2 }, { key: "PDF", label: c.pdf, icon: Upload }] as const).map(({ key, label, icon: Icon }) => <Button key={key} type="button" variant={mode === key ? "secondary" : "outline"} aria-pressed={mode === key} disabled={!!busy} onClick={() => { setMode(key); setError(""); setConfirmed(false); if (key === "TEXT") setSource({ type: "TEXT" }); }}><Icon />{label}</Button>)}</div>
    {mode === "URL" && <div><label htmlFor="job-url" className="text-sm font-medium">{c.urlLabel}</label><div className="mt-2 flex flex-col gap-3 sm:flex-row"><Input id="job-url" type="url" value={url} disabled={!!busy} onChange={event => setUrl(event.target.value)} placeholder="https://careers.company.com/jobs/role" /><Button type="button" variant="outline" disabled={!!busy || !/^https?:\/\//i.test(url)} onClick={() => void extract()}><Link2 />{c.extract}</Button></div></div>}
    {mode === "PDF" && <div className="rounded-xl border border-dashed p-5" onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); const file = event.dataTransfer.files[0]; if (file && !busy) void extract(file); }}><label htmlFor="job-pdf" className="block text-sm font-medium">{c.file}</label><p className="my-2 text-xs leading-5 text-muted-foreground">{c.fileHint}</p><input id="job-pdf" type="file" accept="application/pdf,.pdf" disabled={!!busy} onChange={event => { const file = event.target.files?.[0]; if (file) void extract(file); event.target.value = ""; }} className="max-w-full text-sm" /></div>}
    <div><label htmlFor="job-text" className="text-sm font-medium">{c.review}</label><Textarea id="job-text" className="mt-2 min-h-48" value={text} disabled={!!busy} maxLength={MAX_JOB_TEXT} onChange={event => changeText(event.target.value)} aria-describedby="job-text-hint" /><p id="job-text-hint" className="mt-2 text-xs text-muted-foreground">{c.textHint} · {text.length.toLocaleString()} / 50 000</p></div>
    <div className="grid items-end gap-3 xl:grid-cols-[minmax(0,1fr)_auto]"><div className="min-w-0"><label htmlFor="job-cv" className="text-sm font-medium">{c.resume}</label><select id="job-cv" value={cvId} disabled={!!busy} onChange={event => setCvId(event.target.value)} className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="">{c.profileOnly}</option>{resumes.data?.map(cv => <option key={cv.id} value={cv.id}>{cv.design?.documentName || cv.title || c.resume}</option>)}</select></div><Button type="button" variant="outline" className="h-auto min-h-10 whitespace-normal" disabled={!!busy} onClick={() => void act("create-cv", async () => { const cv = await jobRequest<{ id: string }>("/api/cvs", { source: "PROFILE" }); await resumes.reload(); setCvId(cv.id); })}><FileText />{c.createResume}</Button></div>
    {resumes.error && <p role="alert" className="text-sm text-destructive">{c.genericError} <button type="button" className="underline" onClick={() => void resumes.reload()}>{c.retry}</button></p>}
    <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={confirmed} disabled={!!busy} onChange={event => setConfirmed(event.target.checked)} />{c.confirm}</label>
    <Button type="button" disabled={!ready} onClick={() => void analyze()}><Sparkles />{c.analyze}</Button>
  </div>;
}
