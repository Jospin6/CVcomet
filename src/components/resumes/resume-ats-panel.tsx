"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUpRight, Loader2, RefreshCw } from "lucide-react";
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

  return (
    <div className="studio-ats-panel" aria-busy={busy}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{c.heading}</h2>
        {analysis && (
          <span
            role="status"
            className={`text-[10px] ${stale ? "text-amber-600" : "text-primary"}`}
          >
            {stale ? c.stale : c.current}
          </span>
        )}
      </div>

      <ResumeAtsJobPicker
        active={active}
        language={language}
        selected={targetJob}
        onSelect={chooseJob}
      />
      {sourceStatus === "PENDING" && (
        <p role="status" className="text-xs text-muted-foreground">{c.loadingSourceJob}</p>
      )}
      {sourceStatus === "FAILED" && (
        <Button size="sm" variant="ghost" onClick={() => void loadSourceJob()}>
          {c.retrySourceJob}
        </Button>
      )}

      {analysis && (
        <section className="space-y-4" aria-label={c.content}>
          <div className="studio-ats-visual-scores">
            {[
              { key: "content", title: c.content, score: analysis.content.score },
              { key: "technical", title: c.technical, score: analysis.technical.score },
              { key: "job", title: c.job, score: analysis.jobMatch.score },
            ].map((item) => (
              <div className="studio-ats-metric" key={item.key} data-ats-score={item.key}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-medium">{item.title}</span>
                  <strong className="text-xs tabular-nums">
                    {item.score === null ? "—" : `${item.score}/100`}
                  </strong>
                </div>
                <div
                  className="studio-ats-meter"
                  role="progressbar"
                  aria-label={item.title}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={item.score === null ? undefined : item.score}
                  aria-valuetext={item.score === null ? c.pending : undefined}
                >
                  <div style={{ width: `${Math.max(0, Math.min(100, item.score ?? 0))}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-md bg-muted/40 p-2">
              <strong className="block text-lg tabular-nums">{issues.filter((i) => i.severity === "critical").length}</strong>
              <span className="text-[10px] text-muted-foreground">{c.critical}</span>
            </div>
            <div className="rounded-md bg-muted/40 p-2">
              <strong className="block text-lg tabular-nums">{issues.filter((i) => i.severity === "warning").length}</strong>
              <span className="text-[10px] text-muted-foreground">{c.warning}</span>
            </div>
            <div className="rounded-md bg-muted/40 p-2">
              <strong className="block text-lg tabular-nums">{issues.filter((i) => i.severity === "info").length}</strong>
              <span className="text-[10px] text-muted-foreground">{c.info}</span>
            </div>
          </div>
          {analysis.review.status !== "COMPLETE" && (
            <p className="text-[11px] leading-5 text-muted-foreground" role="status">
              {reviewMessage}
            </p>
          )}
          {analysis.jobMatch.status === "UNAVAILABLE" && (
            <p className="text-[11px] text-muted-foreground">{c.jobUnavailable}</p>
          )}
        </section>
      )}

      <Button
        className="w-full text-xs"
        onClick={() => void run()}
        disabled={busy || invalidKeywords || (sourceStatus === "PENDING" && !selectionChanged.current)}
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
        {busy ? c[phase] : result ? c.refresh : c.run}
      </Button>
      {error && <p role="alert" className="text-xs text-destructive">{errorMessage}</p>}

      {analysis && (
        <section aria-label={c.recommendations} className="space-y-2">
          <h3 className="text-xs font-semibold">{c.recommendations}</h3>
          {issues.length === 0 && <p className="text-xs text-primary">{c.empty}</p>}
          {issues.slice(0, 3).map((issue) => (
            <article className="studio-ats-priority" key={issue.id}>
              <span className={`studio-ats-severity is-${issue.severity}`}>{c[issue.severity]}</span>
              <p className="mt-1 text-xs font-medium">{issue.title}</p>
              <p className="mt-1 text-[11px] leading-5 text-muted-foreground">{issue.suggestion}</p>
              {(issue.reason || issue.evidence.length > 0) && (
                <details className="mt-2 text-[11px]">
                  <summary className="cursor-pointer text-primary">{language === "fr" ? "Pourquoi ?" : "Why?"}</summary>
                  <p className="mt-2 text-muted-foreground">{issue.reason}</p>
                  {issue.evidence.slice(0, 2).map((source, index) => (
                    <blockquote key={`${index}-${source.field}`} className="studio-ats-evidence">
                      {source.quote}
                    </blockquote>
                  ))}
                </details>
              )}
              {(issue.field || issue.design) && (
                <Button size="sm" variant="ghost" className="mt-1 h-7 px-1 text-[11px]" disabled={stale || busy} onClick={() => onNavigate(issue)}>
                  {issue.design ? c.design : c.edit} <ArrowUpRight className="size-3" />
                </Button>
              )}
              {issue.proposedText && (
                <Button size="sm" variant="ghost" className="mt-1 h-7 px-1 text-[11px]" disabled={stale || busy} onClick={() => onProposal(issue)}>
                  {c.reviewProposal} <ArrowUpRight className="size-3" />
                </Button>
              )}
            </article>
          ))}
          {issues.length > 3 && (
            <details className="studio-ats-details">
              <summary>{language === "fr" ? "Toutes les recommandations" : "All recommendations"} ({issues.length})</summary>
              <div className="mt-3 space-y-3">
                {issues.slice(3).map((issue) => (
                  <article className="space-y-2" key={issue.id}>
                    <span className={`studio-ats-severity is-${issue.severity}`}>{c[issue.severity]}</span>
                    <p className="text-xs font-medium">{issue.title}</p>
                    <p className="text-[11px] text-muted-foreground">{issue.suggestion}</p>
                    {(issue.field || issue.design) && (
                      <Button size="sm" variant="outline" disabled={stale || busy} onClick={() => onNavigate(issue)}>{c.edit}</Button>
                    )}
                    {issue.proposedText && (
                      <Button size="sm" variant="ghost" disabled={stale || busy} onClick={() => onProposal(issue)}>{c.reviewProposal}</Button>
                    )}
                  </article>
                ))}
              </div>
            </details>
          )}
        </section>
      )}

      <details className="studio-ats-details">
        <summary>{language === "fr" ? "Options d'analyse" : "Analysis options"}</summary>
        <div className="mt-3 space-y-4">
          <label className="block text-[11px]">
            {c.upload}
            <input
              type="file"
              accept=".pdf,application/pdf"
              className="mt-2 block w-full text-[10px]"
              onChange={(event) => {
                const selected = event.target.files?.[0];
                if (!selected) return;
                if (selected.size > 5 * 1024 * 1024) { setError("TOO_LARGE"); return; }
                setFile(selected); setError(""); pdfCache.current = null;
              }}
            />
          </label>
          <p className="text-[10px] text-muted-foreground">{file?.name ?? c.sourceCurrent}</p>
          {file && <Button size="sm" variant="ghost" onClick={() => { setFile(null); pdfCache.current = null; }}>{c.resetSource}</Button>}
          <label className="block text-[11px]">
            {c.keywords}
            <Textarea rows={2} maxLength={6500} value={keywords} placeholder={c.placeholder} aria-invalid={invalidKeywords} onChange={(event) => setKeywords(event.target.value)} className="mt-2 text-xs" />
          </label>
          {invalidKeywords && <p role="alert" className="text-xs text-destructive">{c.keywordError}</p>}
        </div>
      </details>
      {analysis && (
        <details className="studio-ats-details">
          <summary>{language === "fr" ? "Détails de l'évaluation" : "Assessment details"}</summary>
          <div className="mt-3 space-y-4">
            <p className="text-[10px] text-muted-foreground">{c.noOverall}</p>
            <CheckList checks={analysis.content.checks} />
            {analysis.technical.status === "VERIFIED" && <CheckList checks={analysis.technical.checks} />}
            {analysis.jobMatch.requirements.map((requirement, index) => (
              <div key={index} className="text-[11px]">
                <p className="font-medium">{requirement.title}</p>
                <p className="text-muted-foreground">{requirement.status}</p>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
