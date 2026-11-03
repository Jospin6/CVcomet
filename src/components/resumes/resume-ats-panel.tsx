"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, ArrowUpRight, ChevronDown, Loader2, RefreshCw, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { AtsAnalysis, AtsCheck, AtsIssue } from "@/lib/career/ats-types";
import { atsDisplayScore } from "@/lib/career/ats-display-score";
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
  type LinkedApplication = { id: string; jobTitle: string; company: string; hasJobDescription: boolean; hasCoverLetter: boolean };
  const [mode, setMode] = useState<"general" | "job">("general");
  const [applications, setApplications] = useState<LinkedApplication[]>([]);
  const [applicationId, setApplicationId] = useState("");
  const [targetJob, setTargetJob] = useState<SavedJobSummary | null>(null);
  const [jobQuery, setJobQuery] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [showJobDescription, setShowJobDescription] = useState(false);
  const [letterInput, setLetterInput] = useState<"text" | "url" | "upload">("text");
  const [letterText, setLetterText] = useState("");
  const [letterUrl, setLetterUrl] = useState("");
  const [letterLoading, setLetterLoading] = useState(false);
  const [letterError, setLetterError] = useState("");
  const sourceRequest = useRef<AbortController | null>(null);
  const sourceResolved = useRef(false);
  const selectionChanged = useRef(false);
  const [result, setResult] = useState<{ analysis: AtsAnalysis; signature: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<"preparing" | "analyzing">("preparing");
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  const pdfCache = useRef<{ signature: string; base64: string } | null>(null);
  const linkedApplication = applications.find(item => item.id === applicationId) ?? null;
  const linkedLetter = Boolean(linkedApplication?.hasCoverLetter);
  const signature = JSON.stringify({ resume, language, mode, applicationId,
    jobId: targetJob?.id ?? null, jobDescription: jobDescription.trim(),
    letterText: linkedLetter ? "LINKED_APPLICATION_LETTER" : letterText.trim(),
  });
  const latestPages = useRef(pages); latestPages.current = pages;
  const stale = Boolean(result && result.signature !== signature);

  const loadContext = useCallback(async () => {
    sourceRequest.current?.abort();
    const controller = new AbortController(); sourceRequest.current = controller;
    try {
      const response = await fetch(`/api/cvs/${encodeURIComponent(cvId)}/ats-context`, { method: "POST", signal: controller.signal });
      if (!response.ok) return;
      const data: { applications?: LinkedApplication[]; job?: SavedJobSummary | null } = await response.json();
      if (controller.signal.aborted || selectionChanged.current) return;
      const items = data.applications ?? [];
      setApplications(items);
      if (items.length) {
        setApplicationId(items[0].id);
        setMode("job");
      } else if (data.job) {
        setTargetJob(data.job);
        setJobQuery(savedJobLabel(data.job, language));
      }
    } catch { /* General ATS is still available when context lookup fails. */ }
    finally { if (!controller.signal.aborted) sourceResolved.current = true; }
  }, [cvId, language]);
  useEffect(() => { sourceRequest.current?.abort(); sourceRequest.current = null; sourceResolved.current = false; selectionChanged.current = false; setApplications([]); setApplicationId(""); setTargetJob(null); setJobQuery(""); setResult(null); setMode("general"); }, [cvId]);
  useEffect(() => {
    if (active && !sourceResolved.current && (!sourceRequest.current || sourceRequest.current.signal.aborted)) void loadContext();
  }, [active, loadContext]);
  const chooseJob = (job: SavedJobSummary | null) => {
    selectionChanged.current = true;
    setTargetJob(job);
    setJobQuery(job ? savedJobLabel(job, language) : "");
    if (job) setJobDescription("");
  };
  const updateJobQuery = (value: string) => {
    selectionChanged.current = true;
    setJobQuery(value);
    setTargetJob(current => current && savedJobLabel(current, language) === value ? current : null);
  };

  const extractLetter = async (payload: { url: string } | FormData) => {
    setLetterLoading(true); setLetterError("");
    try {
      const response = await fetch("/api/ats/letter/extract", {
        method: "POST",
        ...(payload instanceof FormData ? { body: payload } : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }),
      });
      const data: { text?: string; error?: string } = await response.json().catch(() => ({}));
      if (!response.ok || !data.text) throw new Error(data.error || "LETTER_UNREADABLE");
      selectionChanged.current = true;
      setLetterText(data.text);
    } catch (cause) { setLetterError(cause instanceof Error ? cause.message : "LETTER_UNREADABLE"); }
    finally { setLetterLoading(false); }
  };

  const run = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    setBusy(true); setPhase("preparing"); setError("");
    const snapshot = JSON.parse(signature) as {
      resume: EditorResume; language: "fr" | "en"; mode: "general" | "job"; applicationId: string;
      jobId: string | null; jobDescription: string; letterText: string;
    };
    try {
      if (snapshot.mode === "job" && !snapshot.applicationId && !snapshot.jobId && snapshot.jobDescription.length < 100) {
        throw Error("JOB_DESCRIPTION_REQUIRED");
      }
      const pdfSignature = JSON.stringify({ resume: snapshot.resume, language: snapshot.language });
      let encoded = pdfCache.current?.signature === pdfSignature ? pdfCache.current.base64 : "";
      if (!encoded) {
        try {
          const [{ pdf }, { ResumePDF }] = await Promise.all([import("@react-pdf/renderer"), import("./resume-pdf")]);
          const blob = await pdf(<ResumePDF resume={snapshot.resume} pages={latestPages.current} copy={resumeEditorCopy[snapshot.language]} />).toBlob();
          if (blob.size > 5 * 1024 * 1024) throw Error("TOO_LARGE");
          encoded = await readPdf(blob);
          pdfCache.current = { signature: pdfSignature, base64: encoded };
        } catch {
          // A PDF renderer failure must not block content assessment. The server
          // will show PDF readability as NOT ASSESSED, never fabricate a score.
          encoded = "";
        }
      }
      if (controller.signal.aborted) return;
      setPhase("analyzing");
      const body = {
        cvId, mode: snapshot.mode, draft: snapshot.resume, language: snapshot.language,
        ...(encoded ? { pdf: encoded } : {}),
        ...(snapshot.mode === "job" ? snapshot.applicationId ? { applicationId: snapshot.applicationId }
          : snapshot.jobId ? { jobId: snapshot.jobId } : { jobDescription: snapshot.jobDescription } : {}),
        ...(snapshot.mode === "general" && snapshot.applicationId && linkedLetter ? { letterApplicationId: snapshot.applicationId } : {}),
        ...(snapshot.letterText && snapshot.letterText !== "LINKED_APPLICATION_LETTER" ? { coverLetterText: snapshot.letterText } : {}),
      };
      const response = await fetch("/api/ats", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: controller.signal,
      });
      const analysis: AtsAnalysis & { error?: string } = await response.json().catch(() => ({ error: "REQUEST_FAILED" }) as AtsAnalysis & { error?: string });
      if (!response.ok) throw Error(response.status === 401 ? "AUTH" : analysis.error || `HTTP_${response.status}`);
      if (!controller.signal.aborted) setResult({ analysis, signature });
    } catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "FAILED"); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }, [cvId, signature, linkedLetter]);
  useEffect(() => () => { request.current?.abort(); sourceRequest.current?.abort(); }, []);

  const analysis = result?.analysis;
  const priority = { critical: 0, warning: 1, info: 2 };
  const issues = analysis ? [...analysis.issues].sort((a, b) => priority[a.severity] - priority[b.severity]) : [];
  const reviewMessage = analysis?.review.error === "AI_LIMIT" || analysis?.review.error === "AI_RATE_LIMIT" ? c.aiLimit : analysis?.review.error === "AI_UNAVAILABLE" || analysis?.review.error === "AI_PROVIDER_UNAVAILABLE" ? c.aiUnavailable : c.reviewUnavailable;
  const errorMessages: Record<string, string> = language === "fr" ? {
    AUTH: "Votre session a expiré. Reconnectez-vous.",
    JOB_NOT_FOUND: "Cette offre n’existe plus.",
    JOB_DESCRIPTION_REQUIRED: "Ajoutez une description de poste d’au moins 100 caractères.",
    APPLICATION_JOB_DESCRIPTION_REQUIRED: "La candidature doit être associée à une description de poste complète.",
    APPLICATION_NOT_LINKED_TO_RESUME: "Cette candidature n’est plus liée à ce CV.",
    INVALID_FILE: "Le fichier PDF du CV est invalide.",
    TOO_LARGE: "Le fichier est trop volumineux.",
    VALIDATION: "Vérifiez les informations saisies.",
    AI_RATE_LIMIT: "Limite IA atteinte. Réessayez plus tard.",
    DATABASE_UNAVAILABLE: "La base de données est indisponible. Vérifiez Neon et les migrations Prisma.",
    APPLICATION_RESUME_MISMATCH: "La candidature existante utilise un autre CV.",
  } : {
    AUTH: "Your session has expired. Sign in again.",
    JOB_NOT_FOUND: "This job posting is no longer available.",
    JOB_DESCRIPTION_REQUIRED: "Enter a job description of at least 100 characters.",
    APPLICATION_JOB_DESCRIPTION_REQUIRED: "The application needs a full job description.",
    APPLICATION_NOT_LINKED_TO_RESUME: "This application is no longer linked to this resume.",
    INVALID_FILE: "The resume PDF is invalid.",
    TOO_LARGE: "The file is too large.",
    VALIDATION: "Check the entered information.",
    AI_RATE_LIMIT: "AI rate limit reached. Try again later.",
    DATABASE_UNAVAILABLE: "Database unavailable. Check Neon and Prisma migrations.",
    APPLICATION_RESUME_MISMATCH: "This application is linked to a different resume.",
  };
  const errorMessage = errorMessages[error] || `${c.error} (${error || "UNKNOWN"})`;

  const jobAudit = Boolean(analysis && analysis.jobMatch.status !== "NOT_PROVIDED");
  const completedChecks = analysis ? [...analysis.content.checks, ...analysis.technical.checks] : [];
  const passedChecks = completedChecks.filter(check => check.status === "PASS").length;
  const structureCheck = analysis?.content.checks.find(check => check.id === "structure");
  const structureScore = structureCheck && structureCheck.earned !== null && structureCheck.weight > 0
    ? Math.round(structureCheck.earned / structureCheck.weight * 100) : null;
  const keywordTotal = analysis?.keywords.status === "CHECKED" ? analysis.keywords.matched.length + analysis.keywords.missing.length : 0;
  // Keyword coverage is only calculable from a job-specific list. It is not
  // an ATS acceptance probability or proof that a skill has been demonstrated.
  const keywordScore = analysis?.keywords.status === "CHECKED" && keywordTotal > 0
    ? Math.round(analysis.keywords.matched.length / keywordTotal * 100) : null;
  const numericScore = (value: number | null | undefined) => value === null || value === undefined ? "—" : `${value}/100`;
  // An absent score is NOT a failing score. Show only metrics that were
  // genuinely evaluated; never turn incomplete checks into a universal ATS rate.
  const scoreRows = analysis ? [
    { id: "readability", label: language === "fr" ? "Lisibilité ATS" : "ATS Readability", score: analysis.technical.status === "VERIFIED" ? analysis.technical.score : null },
    { id: "structure", label: language === "fr" ? "Structure du CV" : "Resume Structure", score: structureScore },
    { id: "content", label: language === "fr" ? "Qualité du contenu" : "Content Quality", score: analysis.content.score },
    { id: "keywords", label: language === "fr" ? "Optimisation des mots-clés" : "Keyword Optimization", score: keywordScore },
  ].filter(row => row.score !== null && row.score !== undefined) : [];
  const reviewPending = analysis?.review.status === "UNAVAILABLE";
  const jobPending = analysis?.jobMatch.status === "UNAVAILABLE";
  const criticalCount = issues.filter(issue => issue.severity === "critical").length;
  const warningCount = issues.filter(issue => issue.severity === "warning").length;
  // Read-only presentation score. A partial review never becomes a fake
  // 100-point semantic score in the API or database.
  const displayScore = analysis ? atsDisplayScore(analysis) : null;
  const isJobHeadline = displayScore?.kind === "job";
  const isLimitedHeadline = displayScore?.kind === "verified";
  const assessedWeight = displayScore?.assessedWeight ?? 0;
  const headlineScore = displayScore?.score ?? null;
  const headlineTitle = isLimitedHeadline
    ? language === "fr" ? "Contrôles vérifiés" : "Verified checks"
    : headlineScore === null || headlineScore === undefined
    ? language === "fr" ? "Non évalué" : "Not assessed"
    : headlineScore >= 80
      ? isJobHeadline ? language === "fr" ? "Bonne correspondance" : "Good match" : language === "fr" ? "Bonne qualité" : "Good quality"
      : headlineScore >= 60
        ? language === "fr" ? "À améliorer" : "Needs improvement"
        : language === "fr" ? "Des corrections sont nécessaires" : "Needs attention";
  const limited = Boolean(reviewPending || jobPending || analysis?.diagnostics?.length);
  const issueAction = (issue: AtsIssue) => (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
      {issue.proposedText && (
        <button type="button" className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 transition hover:text-emerald-500 hover:underline disabled:cursor-not-allowed disabled:opacity-40 dark:text-emerald-400"
          disabled={stale || busy} onClick={() => onProposal(issue)}>
          {language === "fr" ? "Corriger avec l’IA" : "Fix with AI"}<ArrowUpRight aria-hidden="true" className="size-3.5" />
        </button>
      )}
      {(issue.field || issue.design) && (
        <button type="button" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline disabled:cursor-not-allowed disabled:opacity-40"
          disabled={stale || busy} onClick={() => onNavigate(issue)}>
          {issue.design ? c.design : c.edit}<ArrowUpRight aria-hidden="true" className="size-3.5" />
        </button>
      )}
    </div>
  );

  return (
    <section className="studio-ats-panel space-y-4" aria-busy={busy} aria-label={c.title}>
      <form
        onSubmit={event => { event.preventDefault(); if (!busy && !letterLoading) void run(); }}
        className="mx-auto w-full max-w-[480px] space-y-4 rounded-[22px] border bg-card px-5 py-5 shadow-sm sm:px-6"
      >
        <div className="flex gap-2" role="group" aria-label={language === "fr" ? "Mode ATS" : "ATS assessment mode"}>
          {(["general", "job"] as const).map(item => (
            <button type="button" key={item} aria-pressed={mode === item}
              onClick={() => { selectionChanged.current = true; setMode(item); }}
              className={`min-w-0 flex-1 rounded-lg border px-3 py-2 text-xs transition-colors ${mode === item ? "border-primary bg-primary/10 font-medium" : "text-muted-foreground hover:bg-muted"}`}>
              {item === "general" ? language === "fr" ? "CV seul" : "Resume only" : language === "fr" ? "Avec une offre" : "With job description"}
            </button>
          ))}
        </div>
        {applications.length > 0 && (
          <div className="space-y-1">
            <label htmlFor="ats-application" className="text-xs text-muted-foreground">{language === "fr" ? "Candidature liée" : "Linked application"}</label>
            <select id="ats-application" value={applicationId} onChange={event => { selectionChanged.current = true; setApplicationId(event.target.value); }}
              className="h-9 w-full rounded-md border bg-background px-3 text-xs">
              {applications.map(item => <option key={item.id} value={item.id}>{item.jobTitle} · {item.company}</option>)}
            </select>
            {linkedApplication && <p className="text-[11px] text-muted-foreground">
              {linkedLetter
                ? language === "fr" ? "Lettre de motivation de la candidature détectée." : "Application cover letter detected."
                : language === "fr" ? "Aucune lettre de motivation liée à cette candidature." : "No cover letter linked to this application."}
            </p>}
          </div>
        )}
        {mode === "job" && (
          applicationId ? (
            <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
              {linkedApplication?.hasJobDescription
                ? language === "fr" ? "Description du poste chargée depuis la candidature." : "Job description loaded from the application."
                : language === "fr" ? "Description de poste manquante dans cette candidature." : "This application has no job description."}
            </p>
          ) : (
            <div className="space-y-2">
              <ResumeAtsJobPicker active={active} language={language} value={jobQuery} selected={targetJob}
                onChange={updateJobQuery} onSelect={chooseJob} />
              <button type="button" className="text-xs text-muted-foreground underline underline-offset-2"
                onClick={() => setShowJobDescription(value => !value)}>
                {language === "fr" ? "Coller une description de poste" : "Paste a job description"}
              </button>
              {showJobDescription && <Textarea value={jobDescription} onChange={event => { selectionChanged.current = true; setJobDescription(event.target.value); if (event.target.value.trim()) { setTargetJob(null); setJobQuery(""); } }}
                maxLength={50000} rows={4} placeholder={c.jobPlaceholder} aria-label={c.jobLabel} />}
            </div>
          )
        )}
        {!linkedLetter && (
          <details open={!applicationId} className="group rounded-lg border border-dashed px-3 py-2">
            <summary className="flex cursor-pointer list-none items-center justify-between text-xs [&::-webkit-details-marker]:hidden">
              {language === "fr" ? "Lettre de motivation (facultatif)" : "Cover letter (optional)"}
              <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
            </summary>
            <div className="mt-3 space-y-2">
              <div className="flex gap-2" role="group" aria-label={language === "fr" ? "Source de la lettre" : "Cover letter source"}>
                {(["text", "url", "upload"] as const).map(item => <button type="button" key={item}
                  aria-pressed={letterInput === item} onClick={() => { setLetterInput(item); setLetterError(""); }}
                  className={`rounded-md px-2 py-1 text-[11px] ${letterInput === item ? "bg-primary/10 font-medium" : "bg-muted text-muted-foreground"}`}>
                  {item === "text" ? language === "fr" ? "Texte" : "Text" : item === "url" ? "URL" : language === "fr" ? "Fichier" : "Upload"}
                </button>)}
              </div>
              {letterInput === "text" && <Textarea rows={3} maxLength={12000} value={letterText}
                onChange={event => { selectionChanged.current = true; setLetterText(event.target.value); }}
                placeholder={language === "fr" ? "Collez votre lettre de motivation…" : "Paste your cover letter…"} />}
              {letterInput === "url" && <div className="flex gap-2">
                <input type="url" value={letterUrl} onChange={event => setLetterUrl(event.target.value)}
                  placeholder="https://…" aria-label={language === "fr" ? "URL de la lettre" : "Cover letter URL"}
                  className="min-w-0 flex-1 rounded-md border bg-background px-2 text-xs" />
                <Button type="button" size="sm" variant="outline" disabled={letterLoading || !letterUrl.trim()}
                  onClick={() => void extractLetter({ url: letterUrl })}>{letterLoading ? <Loader2 className="size-3 animate-spin" /> : language === "fr" ? "Importer" : "Import"}</Button>
              </div>}
              {letterInput === "upload" && <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                <UploadCloud className="size-4" />{language === "fr" ? "Importer PDF, DOCX ou TXT" : "Upload PDF, DOCX or TXT"}
                <input type="file" accept=".pdf,.docx,.txt" className="sr-only" disabled={letterLoading} onChange={event => {
                  const file = event.target.files?.[0]; if (!file) return;
                  const form = new FormData(); form.set("file", file); void extractLetter(form);
                }} />
              </label>}
              {letterText && letterInput !== "text" && <div className="flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
                <span>{language === "fr" ? `Lettre importée (${letterText.length} caractères)` : `Letter imported (${letterText.length} characters)`}</span>
                <button type="button" className="underline" onClick={() => setLetterText("")}>{language === "fr" ? "Effacer" : "Clear"}</button>
              </div>}
              {letterError && <p role="alert" className="text-xs text-destructive">{letterError}</p>}
            </div>
          </details>
        )}
        <div className="flex justify-end">
          <Button type="submit" className="h-9 min-w-[150px] rounded-xl bg-[#b8b5f4] px-6 text-xs font-semibold text-white hover:bg-[#a29fed] dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
            disabled={busy || letterLoading || (mode === "job" && ((!applicationId && !targetJob && jobDescription.trim().length < 100) || Boolean(applicationId && !linkedApplication?.hasJobDescription)))}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            {busy ? c[phase] : language === "fr" ? "Analyser" : "Generate"}
          </Button>
        </div>
        {error && <p role="alert" className="text-xs text-destructive">{errorMessage}</p>}
      </form>

      {analysis && (
        <section className="mx-auto w-full overflow-hidden rounded-[22px] border border-border/70 bg-card px-4 py-5 shadow-sm sm:px-6 sm:py-6" aria-label={language === "fr" ? "Résultats ATS" : "ATS results"}>
          <header className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="text-base font-semibold tracking-tight">ATS Checker</h3>
              <p className="mt-3 text-xs text-muted-foreground">
                {language === "fr" ? "Analyse du CV" : "Resume analysis"} · {analysis.targetJob
                  ? `${analysis.targetJob.title}${analysis.targetJob.company ? `, ${analysis.targetJob.company}` : ""}`
                  : jobAudit
                    ? language === "fr" ? "Analyse pour une offre" : "Job-specific ATS audit"
                    : language === "fr" ? "Audit ATS général" : "General ATS audit"}
              </p>
            </div>
            <span role="status" className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${stale
              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
              : limited ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
              : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"}`}>
              {stale ? language === "fr" ? "À actualiser" : "Needs refresh"
                : limited ? language === "fr" ? "Contrôles disponibles" : "Checks ready"
                : language === "fr" ? "Terminé" : "Completed"}
            </span>
          </header>

          <div className="px-3 pb-7 pt-8 text-center sm:pt-9">
            <p className={`text-[27px] font-semibold leading-none tracking-tight tabular-nums ${headlineScore !== null && headlineScore !== undefined && headlineScore >= 80 ? "text-emerald-500" : headlineScore !== null && headlineScore !== undefined && headlineScore >= 60 ? "text-amber-500" : "text-red-500"}`}>
              {numericScore(headlineScore)}
            </p>
            <p className="mt-3 text-base font-semibold">{headlineTitle}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {isLimitedHeadline
                ? language === "fr"
                  ? `Score limité aux contrôles vérifiés (${assessedWeight}/100 points du barème)`
                  : `Only verified checks scored (${assessedWeight}/100 rubric points)`
                : isJobHeadline
                  ? language === "fr" ? "Correspondance au poste · preuves dans le CV" : "Job match · evidence in resume"
                  : language === "fr" ? "Qualité du CV · pas un taux d’acceptation ATS" : "Resume quality · not an ATS acceptance rate"}
            </p>
          </div>

          {stale && <p role="status" className="mb-4 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">{c.stale}</p>}

          <div className="border-t border-border/60 pt-6">
            <h4 className="mb-5 text-base font-semibold">{language === "fr" ? "Analyse" : "Analysis"}</h4>
            <div className="space-y-5">
              {scoreRows.map(metric => {
                const score = metric.score;
                const tone = score === null || score === undefined ? "bg-muted-foreground/30" : score >= 80 ? "bg-emerald-500" : score >= 60 ? "bg-amber-500" : "bg-red-500";
                return (
                  <div key={metric.id} className="space-y-2.5">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-medium">{metric.label}</span>
                      <span className="shrink-0 tabular-nums">{numericScore(score)}</span>
                    </div>
                    <div className="h-[7px] overflow-hidden rounded-full bg-foreground/15 dark:bg-white/15"
                      role="progressbar" aria-label={metric.label} aria-valuemin={0} aria-valuemax={100}
                      aria-valuenow={score ?? undefined} aria-valuetext={score === null || score === undefined ? language === "fr" ? "Non évalué" : "Not assessed" : undefined}>
                      {score !== null && score !== undefined && (
                        <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.min(100, Math.max(0, score))}%` }} />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

          </div>

          <div className="mt-7 border-t border-border/60 pt-6">
            <h4 className="mb-4 text-base font-semibold">{language === "fr" ? "Problèmes détectés" : "Issues found"}</h4>
            <div className="space-y-3 text-sm">
              {[
                { label: language === "fr" ? "Problèmes critiques" : "Critical issues", count: criticalCount, tone: "bg-red-500/10 text-red-600 dark:text-red-400" },
                { label: language === "fr" ? "Avertissements" : "Warnings", count: warningCount, tone: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
                { label: language === "fr" ? "Contrôles réussis" : "Passed checks", count: passedChecks, tone: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between gap-3 py-0.5">
                  <span>{item.label}</span>
                  <span className={`min-w-6 rounded-full px-1.5 py-0.5 text-center text-xs font-semibold tabular-nums ${item.tone}`}>{item.count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-7 border-t border-border/60 pt-6">
            <h4 className="mb-4 text-base font-semibold">{language === "fr" ? "Recommandations" : "Recommendations"}</h4>
            {issues.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">{c.empty}</p>
            ) : (
              <div className="divide-y divide-border/50">
                {issues.slice(0, 3).map(issue => (
                  <article key={issue.id} className="py-5 first:pt-2">
                    <div className="flex items-start gap-2.5">
                      <AlertCircle aria-hidden="true" className={`mt-0.5 size-4 shrink-0 ${issue.severity === "critical" ? "text-red-500" : issue.severity === "warning" ? "text-amber-500" : "text-muted-foreground"}`} />
                      <div className="min-w-0 flex-1">
                        <h5 className="text-sm font-semibold">{issue.title}</h5>
                        <p className="mt-3 text-sm leading-6 text-muted-foreground">{issue.suggestion}</p>
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${issue.severity === "critical"
                            ? "bg-red-500/10 text-red-600 dark:text-red-400"
                            : issue.severity === "warning" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            : "bg-muted text-muted-foreground"}`}>
                            {issue.severity === "critical"
                              ? language === "fr" ? "Problème critique" : "Critical issue"
                              : issue.severity === "warning"
                                ? language === "fr" ? "À améliorer" : "Needs improvement"
                                : language === "fr" ? "Conseil" : "Suggestion"}
                          </span>
                          {issueAction(issue)}
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>

          <details className="group mt-4 border-t border-border/60 pt-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-xs font-medium text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
              {language === "fr" ? "Voir tous les détails" : "View all details"}
              <ChevronDown aria-hidden="true" className="size-4 transition-transform group-open:rotate-180" />
            </summary>
            <div className="mt-5 space-y-5 border-t border-border/50 pt-4">
              <p className="text-xs leading-5 text-muted-foreground">{c.noOverall}</p>
              {analysis.review.status !== "COMPLETE" && <p role="status" className="text-xs text-muted-foreground">{reviewMessage}</p>}
              {analysis.supportingLetter?.status && analysis.supportingLetter.status !== "NOT_PROVIDED" && (
                <p className="text-xs text-muted-foreground">
                  {language === "fr" ? "Lettre de motivation prise en compte uniquement comme contexte, pas comme preuve de compétences du CV." : "Cover letter used only as context, not evidence of resume skills."}
                </p>
              )}
              {analysis.supportingLetter?.checks?.length ? (
                <div className="space-y-2 text-xs">
                  <h5 className="font-semibold">{language === "fr" ? "Vérifications de la lettre" : "Cover letter checks"}</h5>
                  {analysis.supportingLetter.checks.map((check, index) => <div key={index} className="flex justify-between gap-3 text-muted-foreground">
                    <span>{check.label}</span><span>{check.observed === null ? "—" : check.observed ? "✓" : language === "fr" ? "Non repéré" : "Not found"}</span>
                  </div>)}
                </div>
              ) : null}
              {analysis.jobMatch.status === "UNAVAILABLE" && <p role="status" className="text-xs text-muted-foreground">{c.jobUnavailable}</p>}
              {issues.length > 3 && (
                <div className="space-y-4">
                  <h5 className="text-xs font-semibold">{language === "fr" ? "Autres recommandations" : "Other recommendations"}</h5>
                  {issues.slice(3).map(issue => (
                    <div key={issue.id} className="space-y-2 border-b border-border/50 pb-4 last:border-0">
                      <p className="text-xs font-semibold">{issue.title}</p>
                      <p className="text-xs leading-5 text-muted-foreground">{issue.suggestion}</p>
                      {issueAction(issue)}
                    </div>
                  ))}
                </div>
              )}
              <div className="space-y-3">
                <h5 className="text-xs font-semibold">{language === "fr" ? "Contrôles détaillés" : "Detailed checks"}</h5>
                <CheckList checks={analysis.content.checks} />
                {analysis.technical.status === "VERIFIED" && <CheckList checks={analysis.technical.checks} />}
                {analysis.jobMatch.requirements.map((requirement, index) => (
                  <div key={index} className="mt-3 text-xs">
                    <p className="font-medium">{requirement.title}</p>
                    <p className="mt-1 text-muted-foreground">{requirement.status} · {requirement.evidence}</p>
                  </div>
                ))}
              </div>
            </div>
          </details>
          <div className="mt-5 flex justify-end">
            <Button type="button" size="sm" variant="outline" className="h-8 gap-2 text-xs" disabled={busy || letterLoading}
              onClick={() => void run()}>
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
              {language === "fr" ? "Réanalyser le CV" : "Re-scan resume"}
            </Button>
          </div>
        </section>
      )}
    </section>
  );
}
