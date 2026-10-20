"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, ArrowUpRight, Check, FileSearch, Loader2, RefreshCw, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { AtsAnalysis, AtsCheck, AtsIssue } from "@/lib/career/ats-types";
import type { EditorResume, ResumePage } from "@/lib/resume-editor";
import { resumeAtsCopy } from "@/lib/resume-ats-copy";
import { resumeEditorCopy } from "@/lib/resume-editor-copy";
import { savedJobLabel, type SavedJobSummary } from "@/lib/career/job-opportunities";
import { ResumeAtsJobPicker } from "./resume-ats-job-picker";

type Props = { cvId: string; resume: EditorResume; pages: ResumePage[]; language: "fr" | "en"; active: boolean; onNavigate: (_issue: AtsIssue) => void; onProposal: (_issue: AtsIssue) => void };
const readPdf = (file: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader(); reader.onerror = () => reject(Error("PDF_FAILED"));
  reader.onload = () => resolve(String(reader.result).split(",")[1]); reader.readAsDataURL(file);
});

function CheckList({ checks }: { checks: AtsCheck[] }) {
  return <div className="mt-3 space-y-4">{checks.map(check => <div key={check.id} className="text-[11px]"><div className="flex justify-between gap-3 font-medium"><span>{check.label}</span><span className="shrink-0">{check.earned ?? "—"}/{check.weight}</span></div><p className="mt-1 leading-5 text-muted-foreground">{check.reason}</p></div>)}</div>;
}

export function ResumeAtsPanel({ cvId, resume, pages, language, active, onNavigate, onProposal }: Props) {
  const c = resumeAtsCopy[language];
  const [keywords, setKeywords] = useState(""), [targetJob, setTargetJob] = useState<SavedJobSummary | null>(null);
  const [sourceJob, setSourceJob] = useState<SavedJobSummary | null>(null), [sourceStatus, setSourceStatus] = useState<"PENDING" | "READY" | "FAILED">("PENDING");
  const sourceRequest = useRef<AbortController | null>(null), sourceResolved = useRef(false), selectionChanged = useRef(false);
  const [file, setFile] = useState<File | null>(null), [result, setResult] = useState<{ analysis: AtsAnalysis; signature: string } | null>(null);
  const [busy, setBusy] = useState(false), [phase, setPhase] = useState<"preparing" | "analyzing">("preparing"), [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  const pdfCache = useRef<{ signature: string; base64: string } | null>(null);
  const terms = [...new Set(keywords.split(/[,;\n]+/).map(term => term.trim()).filter(Boolean))];
  const invalidKeywords = terms.length > 60 || terms.some(term => term.length > 100);
  const signature = JSON.stringify({ resume, keywords: terms, language, job: targetJob, file: file ? { name: file.name, size: file.size, lastModified: file.lastModified } : null });
  const latestPages = useRef(pages); latestPages.current = pages;
  const stale = Boolean(result && result.signature !== signature);

  const loadSourceJob = useCallback(async () => {
    sourceRequest.current?.abort();
    const controller = new AbortController(); sourceRequest.current = controller;
    setSourceStatus("PENDING");
    try {
      const response = await fetch(`/api/cvs/${cvId}/ats-context`, { method: "POST", signal: controller.signal });
      if (!response.ok) throw Error("FAILED");
      const data: { job: SavedJobSummary | null } = await response.json();
      if (controller.signal.aborted) return;
      setSourceJob(data.job);
      if (!selectionChanged.current) setTargetJob(data.job);
      sourceResolved.current = true; setSourceStatus("READY");
    } catch { if (!controller.signal.aborted) { sourceResolved.current = true; setSourceStatus("FAILED"); } }
  }, [cvId]);
  useEffect(() => {
    if (active && !sourceResolved.current && (!sourceRequest.current || sourceRequest.current.signal.aborted)) void loadSourceJob();
  }, [active, loadSourceJob]);
  const chooseJob = useCallback((job: SavedJobSummary | null) => {
    selectionChanged.current = true; setTargetJob(job);
  }, []);

  const run = useCallback(async () => {
    if (invalidKeywords || sourceStatus === "PENDING" && !selectionChanged.current) return;
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    setBusy(true); setPhase("preparing"); setError("");
    const snapshot = JSON.parse(signature);
    try {
      const pdfSignature = JSON.stringify({ resume: snapshot.resume, language: snapshot.language, file: snapshot.file });
      let encoded = pdfCache.current?.signature === pdfSignature ? pdfCache.current.base64 : "";
      if (!encoded) {
        let blob: Blob;
        if (file) blob = file;
        else {
          const [{ pdf }, { ResumePDF }] = await Promise.all([import("@react-pdf/renderer"), import("./resume-pdf")]);
          blob = await pdf(<ResumePDF resume={snapshot.resume} pages={latestPages.current} copy={resumeEditorCopy[snapshot.language as "fr" | "en"]} />).toBlob();
        }
        if (blob.size > 5 * 1024 * 1024) throw Error("TOO_LARGE");
        encoded = await readPdf(blob); pdfCache.current = { signature: pdfSignature, base64: encoded };
      }
      if (controller.signal.aborted) return;
      setPhase("analyzing");
      const response = await fetch("/api/ats", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cvId, draft: snapshot.resume, keywords: snapshot.keywords, language: snapshot.language, pdf: encoded, jobId: snapshot.job?.id }), signal: controller.signal });
      const analysis = await response.json();
      if (!response.ok) throw Error(response.status === 401 ? "AUTH" : analysis.error || "FAILED");
      if (!controller.signal.aborted) setResult({ analysis, signature });
    } catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "FAILED"); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }, [cvId, signature, invalidKeywords, file, sourceStatus]);
  useEffect(() => () => { request.current?.abort(); sourceRequest.current?.abort(); }, []);

  const analysis = result?.analysis;
  const priority = { critical: 0, warning: 1, info: 2 };
  const issues = analysis ? [...analysis.issues].sort((a, b) => priority[a.severity] - priority[b.severity]) : [];
  const reviewMessage = analysis?.review.error === "AI_LIMIT" || analysis?.review.error === "AI_RATE_LIMIT" ? c.aiLimit : analysis?.review.error === "AI_UNAVAILABLE" || analysis?.review.error === "AI_PROVIDER_UNAVAILABLE" ? c.aiUnavailable : c.reviewUnavailable;
  const errorMessage = error === "AUTH" ? c.authError : error === "JOB_NOT_FOUND" ? c.jobNotFound : error === "TOO_LARGE" ? c.fileTooLarge : ["ATS_PDF_UNREADABLE", "INVALID_FILE", "PDF_FAILED"].includes(error) ? c.pdfError : c.error;
  const label = (key: string) => c[key as keyof typeof c] ?? key;

  return <div className="studio-ats-panel" aria-busy={busy}>
    <div><ScanLine className="mb-3 size-5 text-primary" /><h2 className="text-sm font-semibold">{c.heading}</h2><p className="mt-2 text-xs leading-5 text-muted-foreground">{c.intro}</p></div>
    <ResumeAtsJobPicker active={active} language={language} selected={targetJob} onSelect={chooseJob} />
    {sourceStatus === "PENDING" && <p role="status" className="text-[11px] text-muted-foreground">{c.loadingSourceJob}</p>}
    {sourceStatus === "FAILED" && <div className="text-[11px] leading-5 text-muted-foreground"><p role="status">{c.sourceJobError}</p><Button variant="ghost" size="sm" className="mt-1 text-[11px]" onClick={() => void loadSourceJob()}>{c.retrySourceJob}</Button></div>}
    {sourceJob && targetJob?.id === sourceJob.id && <p className="text-[11px] leading-5 text-primary">{c.sourceJobSelected}</p>}
    {analysis && <>
      <p role="status" className={`studio-ats-freshness ${stale ? "is-stale" : ""}`}>{stale ? <AlertCircle className="size-4 shrink-0" /> : <Check className="size-4 shrink-0" />}{stale ? c.stale : c.current}</p>
      {analysis.targetJob && <p className="studio-ats-target break-words text-[11px] leading-5"><span className="text-muted-foreground">{c.assessedJob} : </span><strong>{savedJobLabel(analysis.targetJob, language)}</strong></p>}
      <div className="studio-ats-scores">{[{ key: "content", title: c.content, score: analysis.content.score, status: analysis.content.score === null ? c.partial : "" }, { key: "technical", title: c.technical, score: analysis.technical.score, status: analysis.technical.status === "NOT_PROVIDED" ? c.pending : c.verifiedPdf }, { key: "job", title: c.job, score: analysis.jobMatch.score, status: analysis.jobMatch.status === "NOT_PROVIDED" ? c.jobMissing : analysis.jobMatch.score === null ? c.pending : "" }].map(item => <div key={item.key} className="studio-ats-score" data-ats-score={item.key}><span className="text-[11px] font-medium">{item.title}</span><p className="mt-2 text-2xl font-semibold tracking-tight">{item.score ?? "—"}<span className="ml-1 text-xs font-normal text-muted-foreground">{item.score === null ? "" : "/100"}</span></p>{item.status && <p className="mt-1 text-[10px] text-muted-foreground">{item.status}</p>}</div>)}</div>
      <p className="text-[10px] leading-5 text-muted-foreground">{c.noOverall}</p>
      {analysis.review.status !== "COMPLETE" && <p role="status" className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-[11px] leading-5">{reviewMessage}<span className="mt-1 block">{c.coverage} : {analysis.content.assessedWeight}/{analysis.content.totalWeight}</span></p>}
      {analysis.jobMatch.status === "UNAVAILABLE" && <p role="status" className="text-[11px] leading-5 text-muted-foreground">{c.jobUnavailable}</p>}
      {analysis.jobMatch.status === "COMPLETE" && analysis.jobMatch.score === null && <p className="text-[11px] leading-5 text-muted-foreground">{c.unknownJob}{analysis.jobMatch.range && <span className="mt-1 block">{c.jobRange} : {analysis.jobMatch.range.min}–{analysis.jobMatch.range.max}/100 · {c.jobCoverage} : {analysis.jobMatch.coverage}%</span>}</p>}
    </>}
    <Button className="w-full text-xs" onClick={() => void run()} disabled={busy || invalidKeywords || sourceStatus === "PENDING" && !selectionChanged.current}>{busy ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}{busy ? c[phase] : result ? c.refresh : c.run}</Button>
    {error && <p role="alert" className="text-xs leading-5 text-destructive">{errorMessage}</p>}
    {busy && <p role="status" className="text-xs text-muted-foreground">{c[phase]}</p>}
    <details className="studio-ats-source"><summary className="cursor-pointer text-xs font-medium">{c.source}</summary><p className="mt-3 text-[11px] font-medium">{file?.name ?? c.sourceCurrent}</p><p className="mt-2 text-[10px] leading-5 text-muted-foreground">{c.sourceHint}</p><label className="mt-3 block text-[11px]">{c.upload}<input type="file" accept=".pdf,application/pdf" className="mt-2 block w-full text-[10px]" onChange={event => { const selected = event.target.files?.[0]; if (!selected) return; if (selected.size > 5 * 1024 * 1024) { setError("TOO_LARGE"); return; } setFile(selected); setError(""); pdfCache.current = null; }} /></label>{file && <Button size="sm" variant="outline" className="mt-2 w-full text-[11px]" onClick={() => { setFile(null); pdfCache.current = null; }}>{c.resetSource}</Button>}</details>
    <details className="studio-ats-keywords"><summary className="cursor-pointer text-xs font-medium">{c.keywords}{terms.length > 0 ? ` (${terms.length})` : ""}</summary><label className="mt-3 block"><span className="sr-only">{c.keywords}</span><Textarea rows={3} maxLength={6500} value={keywords} placeholder={c.placeholder} aria-invalid={invalidKeywords} onChange={event => setKeywords(event.target.value)} className="text-xs" /><span className="mt-2 block text-[10px] leading-5 text-muted-foreground">{c.keywordHint}</span></label>{analysis?.keywords.status === "CHECKED" && <p className="mt-2 text-[11px] leading-5">{c.matched} : {analysis.keywords.matched.join(", ") || "—"}<br />{c.missing} : {analysis.keywords.missing.join(", ") || "—"}</p>}</details>
    {invalidKeywords && <p role="alert" className="text-xs text-destructive">{c.keywordError}</p>}
    {analysis && <>
      <section aria-label={c.recommendations}><h3 className="studio-panel-label">{c.recommendations} <span className="text-muted-foreground">({issues.length})</span></h3><div className="space-y-3">{issues.map(issue => <article className="studio-ats-issue" key={issue.id}>
        <div className="flex flex-wrap gap-2"><span className={`studio-ats-severity is-${issue.severity}`}>{c[issue.severity]}</span><span className="text-[9px] text-muted-foreground">{c[issue.category]}</span></div><h4 className="mt-2 text-xs font-semibold">{issue.title}</h4><p className="mt-2 text-[11px] leading-5 text-muted-foreground">{issue.reason}</p><p className="mt-2 text-[11px] leading-5">{issue.suggestion}</p>
        {issue.evidence.length > 0 && <details className="mt-3"><summary className="cursor-pointer text-[10px] text-primary">{c.evidence}</summary>{issue.evidence.map((source, index) => <blockquote className="studio-ats-evidence" key={index}>{source.quote}</blockquote>)}</details>}
        {(issue.field || issue.design) && <Button variant="outline" size="sm" className="mt-3 w-full text-[11px]" disabled={stale || busy} onClick={() => onNavigate(issue)}>{issue.design ? c.design : c.edit}<ArrowUpRight className="size-3" /></Button>}
        {issue.proposedText && <Button size="sm" variant="secondary" className="mt-2 w-full text-[11px]" disabled={stale || busy} onClick={() => onProposal(issue)}>{c.reviewProposal}<ArrowUpRight className="size-3" /></Button>}
      </article>)}{!issues.length && <p className="text-xs leading-5 text-primary">{c.empty}</p>}</div></section>
      <details><summary className="cursor-pointer text-xs font-medium">{c.rubric}</summary><p className="mt-3 text-[10px] leading-5 text-muted-foreground">{c.scoreMeaning}</p>{analysis.content.limits.map((limit, index) => <p className="mt-2 text-[11px] leading-5" key={index}>{c.scoreLimit} : {limit.max}/100. {limit.reason}</p>)}<CheckList checks={analysis.content.checks} /></details>
      <details><summary className="cursor-pointer text-xs font-medium">{c.pdfChecks}</summary>{analysis.technical.status === "VERIFIED" ? <><p className="mt-3 text-[11px]">{analysis.technical.pages} {c.pages} · {Math.ceil(analysis.technical.bytes / 1024)} Ko<br />{c.recovery} : {analysis.technical.recovery ?? "—"}%</p><CheckList checks={analysis.technical.checks} /></> : <p className="mt-3 text-[11px] leading-5 text-muted-foreground">{c.noPdf}</p>}</details>
      {analysis.technical.status === "VERIFIED" && <details><summary className="cursor-pointer text-xs font-medium"><FileSearch className="mr-1 inline size-3" />{c.extracted}</summary><pre className="studio-ats-extracted">{analysis.technical.text}</pre></details>}
      {analysis.jobMatch.requirements.length > 0 && <details><summary className="cursor-pointer text-xs font-medium">{c.jobCriteria} ({analysis.jobMatch.requirements.length})</summary><div className="mt-3 space-y-4">{analysis.jobMatch.requirements.map((requirement, index) => <div key={index}><p className="text-xs font-medium">{requirement.title}</p><p className="mt-1 text-[10px] text-muted-foreground">{label(requirement.priority)} · {label(requirement.status)}</p><blockquote className="studio-ats-evidence">{requirement.evidence}</blockquote></div>)}</div></details>}
      {analysis.strengths.length > 0 && <details><summary className="cursor-pointer text-xs font-medium">{c.strengths}</summary><ul className="mt-3 space-y-3">{analysis.strengths.map(strength => <li className="flex gap-2 text-[11px] leading-5" key={strength}><Check className="mt-0.5 size-3 shrink-0 text-primary" />{strength}</li>)}</ul></details>}
    </>}
  </div>;
}
