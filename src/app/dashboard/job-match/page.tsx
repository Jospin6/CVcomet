"use client";
import { translateCentral } from "@/lib/i18n/central-copy";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { ArrowUpRight, BriefcaseBusiness, Copy, FileCheck2, FileText, LoaderCircle, Mail, Save, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useApi } from "@/components/career/data-state";
import { jobRequest as request, useJobAnalysisForm } from "@/components/career/job-analysis-form";
import { JobMatchWizard } from "@/components/career/job-match-wizard";
import { type JobAnalysis, type JobSource, type MatchResult, type TailorProposal } from "@/lib/career/job-schema";
import { JobMatchReport } from "@/components/career/job-match-report";
import type { z } from "zod";
import type { coverLetterSchema } from "@/helpers/schema";

type Letter = z.infer<typeof coverLetterSchema>["coverLetter"];
type Email = { subject: string; body: string };
type Result = { id: string; cvId: string | null; tailoredCvId?: string | null; result: MatchResult | null; tailoring?: TailorProposal | null; job: {
  id: string; title: string; company: string | null; description: string; originalText?: string | null; sourceUrl?: string | null; sourceType: JobSource["type"]; sourceName?: string | null; analysis: JobAnalysis | null;
  documentDrafts?: { letter?: { draft: Letter }; email?: { draft: Email } } | null; applications?: { id: string }[]; coverLetters?: { id: string; cvId: string | null }[];
} };
type History = { id: string; overallScore: number | null; job: { title: string; company: string | null } };
export default function JobMatch() {
  const { i18n } = useTranslation();
  const history = useApi<History[]>("/api/job-match");
  const [result, setResult] = useState<Result | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [proposal, setProposal] = useState<TailorProposal | null>(null), [paths, setPaths] = useState<string[]>([]);
  const [language, setLanguage] = useState<"fr" | "en">(i18n.resolvedLanguage?.startsWith("fr") ? "fr" : "en"), [notes, setNotes] = useState("");
  const [letter, setLetter] = useState<Letter | null>(null), [email, setEmail] = useState<Email | null>(null), [letterConversation, setLetterConversation] = useState(""), [applicationId, setApplicationId] = useState("");
  const form = useJobAnalysisForm<Result>({
    language,
    onTextChanged: () => setResult(null),
    onExtracted: () => { setResult(null); setProposal(null); setLetter(null); setEmail(null); },
    onAnalyzed: async data => {
      setResult(data); setWizardOpen(false); setProposal(null); setLetter(null); setEmail(null); setLetterConversation("");
      const appId = new URLSearchParams(window.location.search).get("applicationId") || "";
      setApplicationId(appId);
      window.history.replaceState(null, "", `?analysis=${encodeURIComponent(data.id)}${appId ? `&applicationId=${encodeURIComponent(appId)}` : ""}`); await history.reload();
    },
  });
  const { c, resumes, cvId, setCvId, setText, setSource, setConfirmed, busy, setBusy, error, setError, message, setMessage, act, errorText } = form;
  const tailoringErrorText = error === "AI_FACTS_REQUIRED"
    ? (i18n.resolvedLanguage?.startsWith("fr") ? "Ajoutez d’abord un résumé, une expérience, des compétences ou un projet à votre CV. L’IA ne peut reformuler que des faits présents dans ces champs." : "Add a summary, experience, skills, or a project to your resume first. AI can only rephrase facts already present in those fields.")
    : errorText;
  const loadMatch = useCallback(async (id: string) => {
    setBusy("history"); setError(""); setMessage("");
    try {
      const data = await request<Result>("/api/job-match?id=" + encodeURIComponent(id));
      setWizardOpen(false); setResult(data); setText(data.job.description); setSource({ type: data.job.sourceType || "TEXT", url: data.job.sourceUrl || undefined, name: data.job.sourceName || undefined, originalText: data.job.originalText || data.job.description }); setConfirmed(false); setCvId(data.cvId || "");
      setProposal(data.tailoredCvId ? null : data.tailoring || null); setPaths(data.tailoring?.changes.map(change => change.path) || []);
      setLetter(data.job.documentDrafts?.letter?.draft || null); setEmail(data.job.documentDrafts?.email?.draft || null); setLetterConversation(data.job.coverLetters?.find(item => item.cvId === (data.tailoredCvId || data.cvId))?.id || "");
      setApplicationId(new URLSearchParams(window.location.search).get("applicationId") || data.job.applications?.[0]?.id || "");
      if (!data.result || !data.job.analysis) setError("JOB_REANALYZE");
      const appId = new URLSearchParams(window.location.search).get("applicationId") || "";
      window.history.replaceState(null, "", `?analysis=${encodeURIComponent(id)}${appId ? `&applicationId=${encodeURIComponent(appId)}` : ""}`);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "UNAVAILABLE"); }
    finally { setBusy(""); }
  }, [setBusy, setError, setMessage, setText, setSource, setConfirmed, setCvId]);
  const initialAnalysis = useRef(false);
  useEffect(() => {
    if (initialAnalysis.current) return;
    initialAnalysis.current = true;
    const params = new URLSearchParams(window.location.search);
    const analysisId = params.get("analysis");
    const appId = params.get("applicationId");
    if (!appId) {
      if (analysisId) void loadMatch(analysisId);
      else setWizardOpen(true);
      return;
    }
    setApplicationId(appId);
    // Application entry: never ask for JD or resume again.
    // Both are read from the owned application on the server.
    void (async () => {
      setWizardOpen(false);
      setBusy("analyze");
      setError("");
      try {
        const response = await fetch(`/api/applications/${encodeURIComponent(appId)}`, { cache: "no-store" });
        if (!response.ok) throw new Error("Candidature introuvable.");
        const app = await response.json() as {
          jobId: string | null;
          cvId: string | null;
          job: {
            description: string;
            matches: { id: string; cvId: string | null }[];
          } | null;
        };
        if (!app.jobId || !app.job?.description || app.job.description.trim().length < 100) {
          throw new Error("La description de cette offre est absente ou incomplète.");
        }
        if (!app.cvId) throw new Error("Associez d'abord un CV à la candidature.");

        if (analysisId && params.get("reanalyze") !== "1" &&
            app.job.matches.some(item => item.id === analysisId && item.cvId === app.cvId)) {
          await loadMatch(analysisId);
          return;
        }
        const existing = app.job.matches.find(item => item.cvId === app.cvId);
        if (existing && params.get("reanalyze") !== "1") {
          await loadMatch(existing.id);
          return;
        }
        const data = await request<Result>("/api/job-match", {
          text: app.job.description,
          source: { type: "TEXT" },
          confirmed: true,
          cvId: app.cvId,
          applicationId: appId,
          language,
        });
        await loadMatch(data.id);
        await history.reload();
      } catch (failure) {
        setError(failure instanceof Error ? failure.message : "Analyse impossible.");
      } finally {
        setBusy("");
      }
    })();
  }, [loadMatch]);
  const generateProposal = (mode: "TAILOR" | "IMPROVE") => act("tailor", async () => {
    if (!result) return;
    // A targeted resume always starts from confirmed profile data when the user
    // has not explicitly chosen a legacy resume for comparison.
    const sourceCvId = cvId || (await request<{ id: string }>("/api/cvs", { source: "PROFILE" })).id;
    if (!cvId) { setCvId(sourceCvId); await resumes.reload(); }
    const data = await request<TailorProposal>("/api/tailor-resume", { action: "PROPOSE", mode, matchId: result.id, cvId: sourceCvId, language });
    setProposal(data); setPaths(data.changes.map(change => change.path));
  });
  const saveProposal = () => act("accept", async () => {
    if (!result || !proposal) return;
    const data = await request<{ cvId: string }>("/api/tailor-resume", { action: "ACCEPT", matchId: result.id, proposalId: proposal.id, paths });
    setResult({ ...result, tailoredCvId: data.cvId }); setProposal(null); setMessage(c.saved); await resumes.reload();
  });
  const documentBody = () => ({ jobId: result!.job.id, cvId: result!.tailoredCvId || cvId || undefined, language, notes });
  const generateLetter = () => act("letter", async () => { const data = await request<{ draft: Letter }>("/api/generate-cover-letter", { ...documentBody(), action: "GENERATE" }); setLetter(data.draft); });
  const generateEmail = () => act("email", async () => { setEmail(await request<Email>("/api/application-email", { ...documentBody(), action: "GENERATE" })); });
  const saveLetter = () => act("save-letter", async () => { const data = await request<{ letterId: string }>("/api/generate-cover-letter", { ...documentBody(), action: "SAVE", draft: letter }); setLetterConversation(data.letterId); setMessage(c.saved); });
  const saveEmail = () => act("save-email", async () => { await request("/api/application-email", { ...documentBody(), action: "SAVE", draft: email }); setMessage(c.saved); });
  const saveApplication = () => act("application", async () => { const selectedResume = result!.tailoredCvId || cvId; if (!selectedResume) throw new Error(translateCentral(language === "fr" ? "fr" : "en", "uiText.app_dashboard_job_match_page.text001")); const data = await request<{ id: string }>("/api/applications", { jobId: result!.job.id, cvId: selectedResume }); setApplicationId(data.id); setMessage(c.saved); });
  const copy = (value: string) => act("copy", async () => { await navigator.clipboard.writeText(value); setMessage(c.copied); });
  const analysis = result?.job.analysis, match = result?.result;
  const applicationCvId = result?.tailoredCvId || cvId;

  const proposalContent = proposal ? (
    <div className="space-y-4 rounded-xl border p-4">
      <div>
        <h3 className="text-sm font-semibold">{c.proposal}</h3>
        {proposal.rejectedCount > 0 && (
          <p className="mt-1 text-xs text-muted-foreground">{c.rejected}</p>
        )}
      </div>
      {proposal.changes.map(change => (
        <div key={change.path} className="space-y-3 border-t pt-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={paths.includes(change.path)}
              onChange={event => setPaths(current =>
                event.target.checked
                  ? [...current, change.path]
                  : current.filter(path => path !== change.path)
              )}
            />
            {change.path.startsWith("summary")
              ? c.summary
              : change.path.startsWith("experiences")
                ? c.experience
                : c.essentialSkills}
          </label>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg bg-red-500/10 p-3">
              <p className="mb-2 text-xs font-semibold text-red-700 dark:text-red-300">
                {c.before}
              </p>
              <p className="whitespace-pre-wrap text-sm leading-6">{change.current || "—"}</p>
            </div>
            <div className="rounded-lg bg-emerald-500/10 p-3">
              <p className="mb-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                {c.after}
              </p>
              <p className="whitespace-pre-wrap text-sm leading-6">{change.proposed}</p>
            </div>
          </div>
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer">{change.reason}</summary>
            <p className="mt-2 whitespace-pre-wrap">{change.evidence}</p>
          </details>
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        <Button disabled={!!busy || !paths.length} onClick={() => void saveProposal()}>
          {c.accept}
        </Button>
        <Button
          variant="outline"
          disabled={!!busy}
          onClick={() => void act("discard", async () => {
            if (!result) return;
            await request("/api/tailor-resume", {
              action: "REJECT",
              matchId: result.id,
            });
            setProposal(null);
          })}
        >
          {c.discard}
        </Button>
      </div>
    </div>
  ) : null;

  const prepareContent = result ? (
    <div className="space-y-5">
      <section className="space-y-3 rounded-xl border p-4">
        <h3 className="text-sm font-semibold">{c.actions}</h3>
        <div className="flex flex-wrap gap-2">
          {result.tailoredCvId && (
            <Button size="sm" variant="outline" asChild>
              <Link href={`/dashboard/resumes/${result.tailoredCvId}`}>
                {c.adapted} <ArrowUpRight className="size-4" />
              </Link>
            </Button>
          )}
          {applicationId ? (
            <Button size="sm" asChild>
              <Link href={`/dashboard/applications/${applicationId}`}>
                {c.viewApplication} <ArrowUpRight className="size-4" />
              </Link>
            </Button>
          ) : applicationCvId ? (
            <Button size="sm" asChild>
              <Link href={`/dashboard/application-agent?jobId=${encodeURIComponent(result.job.id)}&cvId=${encodeURIComponent(applicationCvId)}`}>
                <FileCheck2 className="size-4" /> {c.actions}
              </Link>
            </Button>
          ) : null}
        </div>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_170px]">
          <div>
            <label htmlFor="job-notes" className="text-xs font-medium">{c.notes}</label>
            <Textarea
              id="job-notes"
              className="mt-1 min-h-16"
              rows={2}
              value={notes}
              maxLength={4000}
              onChange={event => setNotes(event.target.value)}
            />
          </div>
          <div>
            <label htmlFor="job-language" className="text-xs font-medium">{c.language}</label>
            <select
              id="job-language"
              value={language}
              className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm"
              onChange={event => setLanguage(event.target.value as "fr" | "en")}
            >
              <option value="fr">Français</option>
              <option value="en">English</option>
            </select>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={!!busy} onClick={() => void generateLetter()}>
            <Mail className="size-4" /> {c.letter}
          </Button>
          <Button size="sm" variant="outline" disabled={!!busy} onClick={() => void generateEmail()}>
            <Mail className="size-4" /> {c.email}
          </Button>
          {applicationId ? (
            <Button size="sm" variant="outline" asChild>
              <Link href={`/dashboard/applications/${applicationId}`}>
                {c.viewApplication} <ArrowUpRight className="size-4" />
              </Link>
            </Button>
          ) : (
            <Button size="sm" variant="outline" disabled={!!busy} onClick={() => void saveApplication()}>
              <BriefcaseBusiness className="size-4" /> {c.application}
            </Button>
          )}
        </div>
      </section>

      {letter && (
        <section className="space-y-3 rounded-xl border p-4">
          <h3 className="text-sm font-semibold">{c.letter}</h3>
          <p className="text-xs text-muted-foreground">{c.documentReview}</p>
          {([
            { key: "introduction", label: c.intro },
            { key: "body", label: c.body },
            { key: "conclusion", label: c.closing },
          ] as const).map(({ key, label }) => (
            <div key={key}>
              <label htmlFor={`job-letter-${key}`} className="text-xs font-medium">{label}</label>
              <Textarea
                id={`job-letter-${key}`}
                rows={3}
                className="mt-1 min-h-20"
                value={letter[key]}
                onChange={event => setLetter({ ...letter, [key]: event.target.value })}
              />
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={!!busy} onClick={() => void saveLetter()}>
              <Save className="size-4" /> {c.saveLetter}
            </Button>
            <Button size="sm" variant="outline" disabled={!!busy} onClick={() => void copy([
              letter.introduction, letter.body, letter.conclusion, letter.senderName,
            ].join("\n\n"))}>
              <Copy className="size-4" /> {c.copy}
            </Button>
            {letterConversation && (
              <Button size="sm" variant="outline" asChild>
                <Link href={`/dashboard/cover-letters/${letterConversation}`}>
                  {c.openLetter} <ArrowUpRight className="size-4" />
                </Link>
              </Button>
            )}
          </div>
        </section>
      )}
      {email && (
        <section className="space-y-3 rounded-xl border p-4">
          <h3 className="text-sm font-semibold">{c.email}</h3>
          <p className="text-xs text-muted-foreground">{c.documentReview}</p>
          <div>
            <label htmlFor="job-email-subject" className="text-xs font-medium">{c.subject}</label>
            <Input
              id="job-email-subject"
              className="mt-1"
              maxLength={300}
              value={email.subject}
              onChange={event => setEmail({ ...email, subject: event.target.value })}
            />
          </div>
          <div>
            <label htmlFor="job-email-body" className="text-xs font-medium">{c.body}</label>
            <Textarea
              id="job-email-body"
              rows={5}
              className="mt-1 min-h-28"
              maxLength={12000}
              value={email.body}
              onChange={event => setEmail({ ...email, body: event.target.value })}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={!!busy} onClick={() => void saveEmail()}>
              <Save className="size-4" /> {c.saveEmail}
            </Button>
            <Button size="sm" variant="outline" disabled={!!busy} onClick={() => void copy(`${email.subject}\n\n${email.body}`)}>
              <Copy className="size-4" /> {c.copy}
            </Button>
          </div>
        </section>
      )}
    </div>
  ) : null;

  return (
    <div className="space-y-5">
      <PageHeader
        title={c.title}
        action={(
          applicationId ? (
            <Button type="button" variant="outline" asChild>
              <Link href={`/dashboard/applications/${encodeURIComponent(applicationId)}?tab=analysis`}>
                Retour à la candidature
              </Link>
            </Button>
          ) : (
            <Button type="button" disabled={!!busy} onClick={() => setWizardOpen(true)}>
              <Sparkles className="size-4" /> {c.analyze}
            </Button>
          )
        )}
      />
      {error && !wizardOpen && (
        <div role="alert" className="rounded-xl border border-destructive/25 bg-destructive/5 p-3 text-sm text-destructive">
          {tailoringErrorText}
          {error === "AI_FACTS_REQUIRED" && cvId && (
            <Link className="ml-2 underline" href={`/dashboard/resumes/${cvId}`}>{c.manual}</Link>
          )}
          {error === "FEATURE_NOT_AVAILABLE" && (
            <Link className="ml-2 underline" href="/upgrade">{c.upgrade}</Link>
          )}
        </div>
      )}
      {busy && !wizardOpen && (
        <p role="status" aria-live="polite" className="flex items-center gap-2 text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" />
          {busy === "extract" ? c.extracting : busy === "analyze" ? c.analyzing : c.working}
        </p>
      )}
      {message && <p role="status" className="text-sm text-primary">{message}</p>}
      <JobMatchWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        form={form}
        errorText={tailoringErrorText}
      />
      {result && analysis && match && (
        <JobMatchReport
          key={result.id}
          analysis={analysis}
          match={match}
          language={i18n.resolvedLanguage?.startsWith("fr") ? "fr" : "en"}
          busy={!!busy}
          cvId={result.tailoredCvId || cvId || result.cvId}
          originalText={result.job.originalText || result.job.description}
          onTailor={() => void generateProposal("TAILOR")}
          onImprove={() => void generateProposal("IMPROVE")}
          proposalContent={proposalContent}
          prepareContent={prepareContent}
        />
      )}
      <details className="rounded-xl border p-4">
        <summary className="cursor-pointer text-sm font-semibold">{c.history}</summary>
        {history.loading ? (
          <p role="status" className="mt-3 text-sm text-muted-foreground">{c.loading}</p>
        ) : history.error ? (
          <div role="alert" className="mt-3 text-sm">
            {c.genericError}
            <Button size="sm" variant="outline" className="ml-2" onClick={() => void history.reload()}>
              {c.retry}
            </Button>
          </div>
        ) : history.data?.length ? (
          <div className="mt-3 divide-y">
            {history.data.map(item => (
              <button
                key={item.id}
                type="button"
                disabled={!!busy}
                className="flex w-full items-center justify-between gap-3 py-3 text-left text-sm hover:text-primary disabled:opacity-50"
                onClick={() => void loadMatch(item.id)}
              >
                <span>{item.job.title || c.unspecified}{item.job.company && ` · ${item.job.company}`}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {item.overallScore === null ? "—" : `${item.overallScore}%`}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">{c.noHistory}</p>
        )}
      </details>
    </div>
  );
}
